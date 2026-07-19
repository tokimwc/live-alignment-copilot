import { describe, expect, it } from "vitest";

import { sceneCommandSchema } from "@lac/contracts";
import {
  fixtureTranscriptChunks,
  judgeSceneCommandFixtures,
  judgeTranscriptChunks,
  validSceneCommandFixtures,
} from "@lac/test-fixtures";

import {
  DEFAULT_GPT_PLANNER_MODEL,
  DeterministicFixturePlanner,
  Gpt56ResponsesPlanner,
  PlannerTransportError,
  PlannerValidationError,
  createPlannerAdapter,
} from "./index.js";

describe("DeterministicFixturePlanner", () => {
  it("returns strict SceneCommand DSL for fixed Japanese fixture chunks in order", async () => {
    const planner = new DeterministicFixturePlanner();
    const first = await planner.plan({
      transcriptChunks: [fixtureTranscriptChunks[0]],
      currentScene: planner.createInitialScene("2026-06-20T00:00:00.000+09:00"),
    });
    const second = await planner.plan({
      transcriptChunks: fixtureTranscriptChunks,
      currentScene: planner.createInitialScene("2026-06-20T00:00:00.000+09:00"),
    });

    expect(first.map((command) => command.commandId)).toEqual([
      "cmd-fixture-001",
      "cmd-fixture-002",
      "cmd-fixture-003",
    ]);
    expect(second.map((command) => command.commandId)).toEqual([
      "cmd-fixture-001",
      "cmd-fixture-002",
      "cmd-fixture-003",
      "cmd-fixture-004",
      "cmd-fixture-005",
      "cmd-fixture-006",
      "cmd-fixture-007",
      "cmd-fixture-008",
      "cmd-fixture-009",
      "cmd-fixture-010",
    ]);
    expect(second.map((command) => sceneCommandSchema.parse(command).type)).toEqual([
      "add_node",
      "add_node",
      "connect_nodes",
      "add_node",
      "highlight",
      "add_node",
      "connect_nodes",
      "update_node",
      "add_node",
      "connect_nodes",
    ]);
  });

  it("returns exactly 10 English judge proposals without changing the Japanese path", async () => {
    const planner = new DeterministicFixturePlanner();
    const commands = await planner.plan({
      transcriptChunks: judgeTranscriptChunks,
      currentScene: planner.createInitialScene("2026-06-20T00:00:00.000+09:00"),
    });

    expect(commands).toHaveLength(10);
    expect(commands.map((command) => command.commandId)).toEqual(
      judgeSceneCommandFixtures.map((command) => command.commandId),
    );
    expect(commands.every((command) => sceneCommandSchema.safeParse(command).success)).toBe(true);
  });
});

describe("GPT-5.6 Responses planner", () => {
  it("falls back to deterministic fixture mode when the API key is missing or blank", async () => {
    let fetchCalls = 0;
    const fakeFetch: typeof globalThis.fetch = async () => {
      fetchCalls += 1;
      throw new Error("Fake fetch must not be called");
    };

    const missingKeySelection = createPlannerAdapter();
    const blankKeySelection = createPlannerAdapter({ apiKey: "   ", fetch: fakeFetch });
    const commands = await blankKeySelection.planner.plan({
      transcriptChunks: [fixtureTranscriptChunks[0]],
      currentScene: new DeterministicFixturePlanner().createInitialScene(
        "2026-06-20T00:00:00.000+09:00",
      ),
    });

    expect(missingKeySelection.mode).toBe("fixture");
    expect(blankKeySelection).toMatchObject({
      mode: "fixture",
      model: "deterministic-fixture-planner",
    });
    expect(blankKeySelection.planner).toBeInstanceOf(DeterministicFixturePlanner);
    expect(commands).toHaveLength(3);
    expect(fetchCalls).toBe(0);
  });

  it("sends a non-persistent strict JSON-schema request with the default model", async () => {
    let capturedInput: Parameters<typeof globalThis.fetch>[0] | undefined;
    let capturedInit: Parameters<typeof globalThis.fetch>[1] | undefined;
    const fakeFetch: typeof globalThis.fetch = async (input, init) => {
      capturedInput = input;
      capturedInit = init;
      return createResponsesApiResponse({ commands: [validSceneCommandFixtures[0]] });
    };
    const selection = createPlannerAdapter({ apiKey: "test-api-key", fetch: fakeFetch });
    const currentScene = new DeterministicFixturePlanner().createInitialScene(
      "2026-06-20T00:00:00.000+09:00",
    );

    const commands = await selection.planner.plan({
      transcriptChunks: [fixtureTranscriptChunks[0]],
      currentScene,
    });

    expect(selection).toMatchObject({ mode: "gpt-5.6", model: DEFAULT_GPT_PLANNER_MODEL });
    expect(commands).toEqual([sceneCommandSchema.parse(validSceneCommandFixtures[0])]);
    expect(String(capturedInput)).toBe("https://api.openai.com/v1/responses");
    expect(capturedInit?.method).toBe("POST");
    expect(new Headers(capturedInit?.headers).get("authorization")).toBe("Bearer test-api-key");

    const bodyText = capturedInit?.body;
    if (typeof bodyText !== "string") {
      throw new Error("Expected a JSON request body");
    }
    const requestBody: unknown = JSON.parse(bodyText);
    expect(requestBody).toMatchObject({
      model: "gpt-5.6-sol",
      store: false,
      reasoning: { effort: "low" },
      text: {
        format: {
          type: "json_schema",
          name: "scene_command_batch",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["commands"],
          },
        },
      },
    });
  });

  it("rejects model output that does not match the declared command schema", async () => {
    const rawOutputMarker = "RAW_MODEL_OUTPUT_MUST_NOT_LEAK";
    const planner = createGptPlannerWithOutput({
      commands: [{ ...validSceneCommandFixtures[0], unexpected: rawOutputMarker }],
    });

    await expect(
      planner.plan({
        transcriptChunks: [fixtureTranscriptChunks[0]],
        currentScene: new DeterministicFixturePlanner().createInitialScene(
          "2026-06-20T00:00:00.000+09:00",
        ),
      }),
    ).rejects.toMatchObject({
      name: "PlannerValidationError",
      message: "Planner response failed validation",
    } satisfies Partial<PlannerValidationError>);
  });

  it("rejects otherwise valid commands that cite a source id outside the input", async () => {
    const planner = createGptPlannerWithOutput({
      commands: [
        {
          ...validSceneCommandFixtures[0],
          sourceSegmentIds: ["chunk-not-in-input"],
        },
      ],
    });

    await expect(
      planner.plan({
        transcriptChunks: [fixtureTranscriptChunks[0]],
        currentScene: new DeterministicFixturePlanner().createInitialScene(
          "2026-06-20T00:00:00.000+09:00",
        ),
      }),
    ).rejects.toBeInstanceOf(PlannerValidationError);
  });

  it("does not include a failed API response body in transport errors", async () => {
    const rawApiMarker = "RAW_API_BODY_MUST_NOT_LEAK";
    const fakeFetch: typeof globalThis.fetch = async () =>
      new Response(rawApiMarker, { status: 500 });
    const planner = new Gpt56ResponsesPlanner({ apiKey: "test-api-key", fetch: fakeFetch });

    await expect(
      planner.plan({
        transcriptChunks: [fixtureTranscriptChunks[0]],
        currentScene: new DeterministicFixturePlanner().createInitialScene(
          "2026-06-20T00:00:00.000+09:00",
        ),
      }),
    ).rejects.toMatchObject({
      name: "PlannerTransportError",
      message: "Planner request failed",
    } satisfies Partial<PlannerTransportError>);
  });
});

function createGptPlannerWithOutput(output: unknown): Gpt56ResponsesPlanner {
  const fakeFetch: typeof globalThis.fetch = async () => createResponsesApiResponse(output);
  return new Gpt56ResponsesPlanner({ apiKey: "test-api-key", fetch: fakeFetch });
}

function createResponsesApiResponse(output: unknown): Response {
  return new Response(
    JSON.stringify({
      status: "completed",
      output: [
        {
          type: "message",
          content: [
            {
              type: "output_text",
              text: JSON.stringify(output),
            },
          ],
        },
      ],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
