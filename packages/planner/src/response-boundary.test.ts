import { describe, expect, it } from "vitest";

import { fixtureTranscriptChunks, validSceneCommandFixtures } from "@lac/test-fixtures";

import {
  DeterministicFixturePlanner,
  Gpt56ResponsesPlanner,
  PlannerTransportError,
  PlannerValidationError,
  createPlannerAdapter,
} from "./index.js";

// Fixture/fake-fetch only: nothing here reaches a network or needs a real API key.
const TEST_KEY = "test-api-key-not-real";
const MAX_COMMANDS = 20;

const planInput = {
  transcriptChunks: [fixtureTranscriptChunks[0]],
  currentScene: new DeterministicFixturePlanner().createInitialScene(
    "2026-06-20T00:00:00.000+09:00",
  ),
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function messageWith(...content: readonly unknown[]): Record<string, unknown> {
  return { status: "completed", output: [{ type: "message", content }] };
}

function outputText(text: string): Record<string, unknown> {
  return { type: "output_text", text };
}

function plannerReturning(response: () => Response | Promise<Response>): Gpt56ResponsesPlanner {
  return new Gpt56ResponsesPlanner({ apiKey: TEST_KEY, fetch: async () => response() });
}

// Every command in a batch gets its own commandId, idempotencyKey and node id, so no test here
// depends on (or pins) how the adapter treats duplicate identifiers.
function uniqueCommand(index: number) {
  const base = validSceneCommandFixtures.find((command) => command.type === "add_node");
  if (base?.type !== "add_node") {
    throw new Error(
      "fixture invariant: validSceneCommandFixtures must contain an add_node command",
    );
  }
  return {
    ...base,
    commandId: `cmd-batch-${index}`,
    idempotencyKey: `batch-${index}-add-node`,
    payload: { node: { ...base.payload.node, id: `node-batch-${index}` } },
  };
}

function batch(count: number): string {
  return JSON.stringify({
    commands: Array.from({ length: count }, (_unused, index) => uniqueCommand(index)),
  });
}

describe("Gpt56ResponsesPlanner response boundary", () => {
  it("rejects a refusal content item as a validation failure", async () => {
    const planner = plannerReturning(() =>
      jsonResponse(messageWith({ type: "refusal", refusal: "I cannot help with that." })),
    );

    await expect(planner.plan(planInput)).rejects.toBeInstanceOf(PlannerValidationError);
  });

  it("fails closed when a refusal is mixed with otherwise valid output_text", async () => {
    const planner = plannerReturning(() =>
      jsonResponse(messageWith(outputText(batch(1)), { type: "refusal", refusal: "no" })),
    );

    await expect(planner.plan(planInput)).rejects.toBeInstanceOf(PlannerValidationError);
  });

  it.each(["incomplete", "failed", "in_progress", "cancelled"])(
    "treats response status %s as a transport failure even when the output looks valid",
    async (status) => {
      const planner = plannerReturning(() =>
        jsonResponse({ ...messageWith(outputText(batch(1))), status }),
      );

      await expect(planner.plan(planInput)).rejects.toBeInstanceOf(PlannerTransportError);
    },
  );

  it.each<[string, unknown]>([
    ["empty object", {}],
    ["no output array", { status: "completed" }],
    ["empty output array", { status: "completed", output: [] }],
    ["message without content array", { status: "completed", output: [{ type: "message" }] }],
    ["content without output_text", messageWith({ type: "reasoning", text: "thinking" })],
    ["non-string output_text", messageWith({ type: "output_text", text: 42 })],
    ["JSON array body", []],
    ["JSON null body", null],
  ])("rejects an incomplete response shape: %s", async (_label, body) => {
    const planner = plannerReturning(() => jsonResponse(body));

    await expect(planner.plan(planInput)).rejects.toBeInstanceOf(PlannerValidationError);
  });

  it.each([
    ["empty text", ""],
    ["not JSON", "not json at all"],
    ["truncated JSON", batch(1).slice(0, -5)],
    ["JSON array instead of object", "[]"],
    ["missing commands key", "{}"],
    ["commands is not an array", '{"commands":"x"}'],
    ["extra top-level key", JSON.stringify({ commands: [], extra: true })],
  ])("rejects output_text that is %s", async (_label, text) => {
    const planner = plannerReturning(() => jsonResponse(messageWith(outputText(text))));

    await expect(planner.plan(planInput)).rejects.toBeInstanceOf(PlannerValidationError);
  });

  it("rejects update_node and other commands outside the add_node/connect_nodes/highlight subset", async () => {
    const outsideSubset = validSceneCommandFixtures.find(
      (command) => command.type === "update_node",
    );
    expect(outsideSubset).toBeDefined();
    const planner = plannerReturning(() =>
      jsonResponse(messageWith(outputText(JSON.stringify({ commands: [outsideSubset] })))),
    );

    await expect(planner.plan(planInput)).rejects.toBeInstanceOf(PlannerValidationError);
  });

  it("rejects the whole batch when one command is invalid among valid ones", async () => {
    const text = JSON.stringify({
      commands: [
        uniqueCommand(0),
        { ...uniqueCommand(1), sourceSegmentIds: ["chunk-not-in-input"] },
      ],
    });
    const planner = plannerReturning(() => jsonResponse(messageWith(outputText(text))));

    await expect(planner.plan(planInput)).rejects.toBeInstanceOf(PlannerValidationError);
  });

  it("accepts an empty command list and returns no commands", async () => {
    const planner = plannerReturning(() =>
      jsonResponse(messageWith(outputText(JSON.stringify({ commands: [] })))),
    );

    await expect(planner.plan(planInput)).resolves.toEqual([]);
  });

  it(`accepts exactly ${MAX_COMMANDS} commands and rejects ${MAX_COMMANDS + 1}`, async () => {
    const atLimit = plannerReturning(() =>
      jsonResponse(messageWith(outputText(batch(MAX_COMMANDS)))),
    );
    await expect(atLimit.plan(planInput)).resolves.toHaveLength(MAX_COMMANDS);

    const overLimit = plannerReturning(() =>
      jsonResponse(messageWith(outputText(batch(MAX_COMMANDS + 1)))),
    );
    await expect(overLimit.plan(planInput)).rejects.toBeInstanceOf(PlannerValidationError);
  });

  it("fails closed when multiple output_text parts concatenate into something that is not one valid batch", async () => {
    const planner = plannerReturning(() =>
      jsonResponse(messageWith(outputText(batch(1)), outputText(batch(1)))),
    );

    await expect(planner.plan(planInput)).rejects.toBeInstanceOf(PlannerValidationError);
  });

  // CHARACTERIZATION ONLY: the adapter joins every output_text part with "" before parsing, so a
  // JSON document split across parts is accepted. Whether that is intended product behavior is
  // not specified in docs/; this pins current behavior so a change is noticed, not endorsed.
  it("characterization: joins a JSON batch split across output_text parts", async () => {
    const text = batch(1);
    const middle = Math.floor(text.length / 2);
    const planner = plannerReturning(() =>
      jsonResponse(messageWith(outputText(text.slice(0, middle)), outputText(text.slice(middle)))),
    );

    await expect(planner.plan(planInput)).resolves.toHaveLength(1);
  });

  // CHARACTERIZATION ONLY: a top-level `output_text` string is preferred over the `output` array.
  // The output array here deliberately holds no refusal: this test pins precedence only and says
  // nothing about refusal handling (see the refusal tests above and the known failure below).
  it("characterization: prefers a top-level output_text string over the output array", async () => {
    const planner = plannerReturning(() =>
      jsonResponse({
        status: "completed",
        output_text: batch(1),
        output: [
          { type: "message", content: [outputText("not json, ignored in favor of top level")] },
        ],
      }),
    );

    await expect(planner.plan(planInput)).resolves.toHaveLength(1);
  });

  // KNOWN FAILURE (expected-failure, existing adapter behavior; the adapter is intentionally not
  // changed in this review-fix): docs/requirements.md ("refusals ... must enqueue nothing") and
  // docs/architecture.md ("Any ... refusal ... -> no enqueue") require a refusal to fail closed.
  // extractOutputText() returns a top-level `output_text` string before it ever inspects the
  // `output` array, so a refusal item next to a top-level `output_text` is currently ignored and
  // the commands are returned. The assertion below states the REQUIRED behavior; `it.fails` passes
  // while the adapter still violates it and starts failing once the adapter is fixed, at which
  // point `.fails` must be removed. Whether a real Responses payload can carry both is unverified.
  it.fails(
    "rejects a refusal in output even when a top-level output_text string is present",
    async () => {
      const planner = plannerReturning(() =>
        jsonResponse({
          status: "completed",
          output_text: batch(1),
          output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }],
        }),
      );

      await expect(planner.plan(planInput)).rejects.toBeInstanceOf(PlannerValidationError);
    },
  );

  it("maps a thrown fetch to a transport error without leaking the thrown message or the key", async () => {
    const marker = "RAW_FETCH_EXCEPTION_MUST_NOT_LEAK";
    const planner = new Gpt56ResponsesPlanner({
      apiKey: TEST_KEY,
      fetch: async () => {
        throw new Error(`${marker} ${TEST_KEY}`);
      },
    });

    const failure = await planner.plan(planInput).then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(PlannerTransportError);
    const serialized = `${String((failure as Error).message)} ${JSON.stringify(failure)}`;
    expect(serialized).not.toContain(marker);
    expect(serialized).not.toContain(TEST_KEY);
  });

  it("maps a non-JSON 200 body and non-2xx statuses to transport errors", async () => {
    const notJson = plannerReturning(() => new Response("<html>gateway</html>", { status: 200 }));
    await expect(notJson.plan(planInput)).rejects.toBeInstanceOf(PlannerTransportError);

    for (const status of [400, 401, 429, 500, 503]) {
      const planner = plannerReturning(() =>
        jsonResponse(messageWith(outputText(batch(1))), status),
      );
      await expect(planner.plan(planInput), String(status)).rejects.toBeInstanceOf(
        PlannerTransportError,
      );
    }
  });

  it("does not include transcript-derived or model-derived text in validation errors", async () => {
    const marker = "RAW_MODEL_TEXT_MUST_NOT_LEAK";
    const planner = plannerReturning(() => jsonResponse(messageWith(outputText(marker))));

    const failure = await planner.plan(planInput).then(
      () => undefined,
      (error: unknown) => error,
    );

    expect(failure).toBeInstanceOf(PlannerValidationError);
    expect(String((failure as Error).message)).not.toContain(marker);
  });

  it("rejects construction with a blank key instead of calling out", () => {
    expect(
      () => new Gpt56ResponsesPlanner({ apiKey: "   ", fetch: async () => jsonResponse({}) }),
    ).toThrow(PlannerTransportError);
  });

  it("selects the fixture planner for a blank key and never invokes the supplied fetch", async () => {
    let calls = 0;
    const selection = createPlannerAdapter({
      apiKey: "",
      fetch: async () => {
        calls += 1;
        return jsonResponse({});
      },
    });

    expect(selection.mode).toBe("fixture");
    await selection.planner.plan(planInput);
    expect(calls).toBe(0);
  });
});
