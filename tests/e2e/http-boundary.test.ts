import { request, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, it } from "vitest";

import type { PlannerBoundary } from "@lac/contracts";
import { DeterministicFixturePlanner, PlannerTransportError } from "@lac/planner";

import { createJudgeDemoHttpServer } from "../../apps/server/src/demo-server.js";
import {
  JudgeDemoController,
  defaultJudgeDemoTranscript,
} from "../../apps/server/src/judge-demo.js";

// The server's body cap is 32 KiB (MAX_REQUEST_BYTES in apps/server/src/demo-server.ts).
const MAX_REQUEST_BYTES = 32 * 1024;
// commandId cap in readCommandId (apps/server/src/demo-server.ts).
const MAX_COMMAND_ID_LENGTH = 80;

interface HttpResult {
  readonly status: number;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  readonly text: string;
}

interface Harness {
  readonly controller: JudgeDemoController;
  readonly send: (method: string, path: string, body?: string | Buffer) => Promise<HttpResult>;
  readonly getState: () => Promise<unknown>;
}

const openServers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    openServers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

// Loopback only (127.0.0.1, ephemeral port); no external network and no API key.
async function startHarness(planner: PlannerBoundary = new DeterministicFixturePlanner()) {
  const controller = new JudgeDemoController({
    planner,
    plannerMode: "fixture",
    model: "deterministic-fixture-planner",
    now: () => "2026-07-18T12:00:00.000+09:00",
  });
  const server = createJudgeDemoHttpServer(controller);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  openServers.push(server);
  const port = (server.address() as AddressInfo).port;

  const send: Harness["send"] = (method, path, body) =>
    new Promise<HttpResult>((resolve, reject) => {
      const req = request(
        { host: "127.0.0.1", port, method, path, headers: { "Content-Type": "application/json" } },
        (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () =>
            resolve({
              status: res.statusCode ?? 0,
              headers: res.headers,
              text: Buffer.concat(chunks).toString("utf8"),
            }),
          );
          res.on("error", reject);
        },
      );
      req.on("error", reject);
      req.end(body);
    });

  const getState: Harness["getState"] = async () =>
    JSON.parse((await send("GET", "/api/state")).text);
  const harness: Harness = { controller, send, getState };
  return harness;
}

function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}

describe("demo HTTP boundary (loopback, no API key)", () => {
  it("serves the page and state with hardening headers and no secret names", async () => {
    const { send } = await startHarness();

    const page = await send("GET", "/");
    expect(page.status).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
    expect(page.headers["x-content-type-options"]).toBe("nosniff");
    expect(page.headers["cache-control"]).toBe("no-store");
    expect(String(page.headers["content-security-policy"])).toContain("default-src 'self'");
    expect(page.text).not.toContain("OPENAI_API_KEY");

    const state = await send("GET", "/api/state");
    expect(state.status).toBe(200);
    expect(state.text).not.toContain("OPENAI_API_KEY");
    expect(JSON.parse(state.text)).toMatchObject({ error: null, canUndo: false });
  });

  it("returns 404 for unknown URLs and for known paths with the wrong method, without state change", async () => {
    const { send, getState } = await startHarness();
    const before = await getState();

    for (const [method, path] of [
      ["GET", "/nope"],
      ["POST", "/api/unknown"],
      ["GET", "/api/plan"],
      ["POST", "/api/state"],
      ["DELETE", "/api/reset"],
    ] as const) {
      const result = await send(method, path);
      expect(result.status, `${method} ${path}`).toBe(404);
      expect(JSON.parse(result.text)).toEqual({ error: "Not found" });
    }

    expect(await getState()).toEqual(before);
  });

  it("answers a malformed request target with a client error instead of crashing the server", async () => {
    const { send, getState } = await startHarness();
    const before = await getState();

    // `new URL("//", base)` throws; the server must stay up and answer later requests.
    const malformed = await send("GET", "//");
    expect(malformed.status).toBeGreaterThanOrEqual(400);
    expect(malformed.status).toBeLessThan(500);

    expect((await send("GET", "/api/state")).status).toBe(200);
    expect(await getState()).toEqual(before);
  });

  it("rejects malformed JSON, non-object JSON, and wrong field types without changing state", async () => {
    const { send, getState } = await startHarness();
    const proposed = await send(
      "POST",
      "/api/plan",
      jsonBody({ transcriptText: defaultJudgeDemoTranscript }),
    );
    expect(proposed.status).toBe(200);
    const before = await getState();

    const badBodies: ReadonlyArray<readonly [string, string, string]> = [
      ["/api/plan", "{not json", "malformed JSON"],
      ["/api/plan", "[]", "array body"],
      ["/api/plan", "null", "null body"],
      ["/api/plan", "42", "number body"],
      ["/api/plan", jsonBody({}), "missing transcriptText"],
      ["/api/plan", jsonBody({ transcriptText: 123 }), "non-string transcriptText"],
      ["/api/approve", "{not json", "malformed JSON"],
      ["/api/approve", jsonBody({}), "missing commandId"],
      ["/api/approve", jsonBody({ commandId: 7 }), "non-string commandId"],
      ["/api/reject", jsonBody({ commandId: null }), "null commandId"],
      ["/api/undo", "[1]", "array body"],
      ["/api/reset", "{not json", "malformed JSON"],
    ];
    for (const [path, body, label] of badBodies) {
      const result = await send("POST", path, body);
      expect(result.status, `${path} ${label}`).toBe(400);
      expect(JSON.parse(result.text)).toEqual({ error: "Invalid demo request" });
    }

    expect(await getState()).toEqual(before);
  });

  it("rejects a body over 32 KiB (counted in bytes) and accepts a valid plan request of exactly 32 KiB", async () => {
    const { send, getState } = await startHarness();
    const before = await getState();

    const envelope = jsonBody({ transcriptText: "" });
    const overflowPad = "a".repeat(MAX_REQUEST_BYTES + 1 - Buffer.byteLength(envelope));
    const tooLarge = jsonBody({ transcriptText: overflowPad });
    expect(Buffer.byteLength(tooLarge)).toBe(MAX_REQUEST_BYTES + 1);
    const rejected = await send("POST", "/api/plan", tooLarge);
    expect(rejected.status).toBe(400);
    expect(JSON.parse(rejected.text)).toEqual({ error: "Invalid demo request" });

    // 11,000 x 3-byte characters = 33,000 bytes > 32,768 even though it is only 11,000 characters.
    const multibyte = jsonBody({ transcriptText: "あ".repeat(11_000) });
    expect(Buffer.byteLength(multibyte)).toBeGreaterThan(MAX_REQUEST_BYTES);
    expect((await send("POST", "/api/plan", multibyte)).status).toBe(400);

    expect(await getState()).toEqual(before);

    // Exactly at the limit passes the size gate. Trailing JSON whitespace pads a valid plan request
    // to the cap, so the outcome depends only on the size gate, not on transcript content rules.
    const validPlan = jsonBody({ transcriptText: defaultJudgeDemoTranscript });
    const atLimit = validPlan + " ".repeat(MAX_REQUEST_BYTES - Buffer.byteLength(validPlan));
    expect(Buffer.byteLength(atLimit)).toBe(MAX_REQUEST_BYTES);
    const accepted = await send("POST", "/api/plan", atLimit);
    expect(accepted.status).toBe(200);
    const acceptedState = JSON.parse(accepted.text) as {
      error: unknown;
      presenter: { proposalQueue: unknown[] };
    };
    expect(acceptedState.error).toBeNull();
    expect(acceptedState.presenter.proposalQueue).toHaveLength(10);

    // The same valid request one byte over the cap is refused by the size gate.
    const oneOver = atLimit + " ";
    expect(Buffer.byteLength(oneOver)).toBe(MAX_REQUEST_BYTES + 1);
    expect((await send("POST", "/api/plan", oneOver)).status).toBe(400);
  });

  it("rejects commandId longer than 80 chars while an 80-char unknown id only gets a safe action error", async () => {
    const { send, getState } = await startHarness();
    await send("POST", "/api/plan", jsonBody({ transcriptText: defaultJudgeDemoTranscript }));
    const before = await getState();

    for (const path of ["/api/approve", "/api/reject"]) {
      const tooLong = await send(
        "POST",
        path,
        jsonBody({ commandId: "x".repeat(MAX_COMMAND_ID_LENGTH + 1) }),
      );
      expect(tooLong.status, path).toBe(400);
    }
    expect(await getState()).toEqual(before);

    const unknownButBounded = await send(
      "POST",
      "/api/approve",
      jsonBody({ commandId: "x".repeat(MAX_COMMAND_ID_LENGTH) }),
    );
    expect(unknownButBounded.status).toBe(200);
    const afterUnknown = JSON.parse(unknownButBounded.text) as {
      error: { code: string };
      audience: unknown;
      presenter: unknown;
    };
    expect(afterUnknown.error.code).toBe("ACTION_REJECTED");
    const baseline = before as { audience: unknown; presenter: unknown };
    expect(afterUnknown.audience).toEqual(baseline.audience);
    expect(afterUnknown.presenter).toEqual(baseline.presenter);
  });

  it("keeps the audience empty over HTTP until a valid approve, and failed requests do not alter it", async () => {
    const { send } = await startHarness();

    const planned = JSON.parse(
      (await send("POST", "/api/plan", jsonBody({ transcriptText: defaultJudgeDemoTranscript })))
        .text,
    ) as { audience: { scene: { nodes: unknown[] } }; presenter: { proposalQueue: unknown[] } };
    expect(planned.presenter.proposalQueue).toHaveLength(10);
    expect(planned.audience.scene.nodes).toHaveLength(0);

    expect((await send("POST", "/api/approve", "{broken")).status).toBe(400);
    const unchanged = JSON.parse((await send("GET", "/api/state")).text) as typeof planned;
    expect(unchanged.audience.scene.nodes).toHaveLength(0);

    const approved = JSON.parse(
      (await send("POST", "/api/approve", jsonBody({ commandId: "cmd-demo-en-001" }))).text,
    ) as typeof planned;
    expect(approved.audience.scene.nodes).toHaveLength(1);
  });

  it("fails closed over HTTP when the planner throws, without leaking the thrown message", async () => {
    const leakMarker = "RAW_PLANNER_ERROR_MUST_NOT_LEAK";
    let calls = 0;
    const flaky: PlannerBoundary = {
      name: "flaky-test-planner",
      async plan(input) {
        calls += 1;
        if (calls > 1) {
          throw new Error(leakMarker);
        }
        return new DeterministicFixturePlanner().plan(input);
      },
    };
    const { send, getState } = await startHarness(flaky);

    await send("POST", "/api/plan", jsonBody({ transcriptText: defaultJudgeDemoTranscript }));
    await send("POST", "/api/approve", jsonBody({ commandId: "cmd-demo-en-001" }));
    const before = (await getState()) as { audience: unknown; presenter: unknown };

    const failed = await send(
      "POST",
      "/api/plan",
      jsonBody({ transcriptText: defaultJudgeDemoTranscript }),
    );
    expect(failed.status).toBe(200);
    expect(failed.text).not.toContain(leakMarker);
    const failedState = JSON.parse(failed.text) as {
      error: { code: string };
      audience: unknown;
      presenter: unknown;
    };
    expect(failedState.error.code).toBe("PLANNER_UNAVAILABLE");
    expect(failedState.audience).toEqual(before.audience);
    expect(failedState.presenter).toEqual(before.presenter);
  });

  it("maps a planner transport error to a safe error and leaves a fresh session untouched", async () => {
    const failing: PlannerBoundary = {
      name: "failing-test-planner",
      async plan() {
        throw new PlannerTransportError();
      },
    };
    const { send, getState } = await startHarness(failing);
    const before = (await getState()) as { audience: unknown; presenter: unknown };

    const result = await send(
      "POST",
      "/api/plan",
      jsonBody({ transcriptText: defaultJudgeDemoTranscript }),
    );
    const state = JSON.parse(result.text) as {
      error: { code: string };
      audience: unknown;
      presenter: unknown;
    };
    expect(state.error.code).toBe("PLANNER_UNAVAILABLE");
    expect(state.audience).toEqual(before.audience);
    expect(state.presenter).toEqual(before.presenter);
  });

  it("accepts an empty body for undo and reset", async () => {
    const { send } = await startHarness();
    expect((await send("POST", "/api/undo")).status).toBe(200);
    expect((await send("POST", "/api/reset")).status).toBe(200);
  });
});
