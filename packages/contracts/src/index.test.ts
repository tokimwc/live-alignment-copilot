import { describe, expect, it } from "vitest";

import {
  type ExportBoundary,
  type FixtureTranscriptAdapter,
  type ManualTranscriptAdapter,
  type PlannerBoundary,
  type RealtimeTranscriptAdapter,
  type RendererBoundary,
  type SceneCommand,
  type SceneCommandType,
  type SceneModel,
  type SessionArtifact,
  type TranscriptionBoundary,
  sanitizeDisplayLabel,
  sanitizeTranscriptText,
  sceneCommandSchema,
  sceneCommandTypeSchema,
  sceneEdgeKindSchema,
  sceneNodeKindSchema,
  sessionArtifactSchema,
  transcriptChunkSchema,
  validateSceneCommand,
} from "./index.js";

const baseEnvelope = {
  kind: "scene.command" as const,
  version: 1 as const,
  commandId: "cmd-001",
  idempotencyKey: "idem-001",
  issuedAt: "2026-06-20T00:00:00.000+09:00",
  sourceSegmentIds: ["chunk-001"],
  confidence: 0.86,
  rationale: "承認前に業務プロセスの中心要素を構造化するため",
};

const validCommand = {
  ...baseEnvelope,
  type: "add_node",
  payload: {
    node: {
      id: "process-001",
      label: "問い合わせ対応",
      kind: "process",
      summary: "顧客問い合わせから回答までの流れ",
      importance: 4,
    },
  },
} satisfies SceneCommand;

function commandWith(
  commandId: string,
  command: Pick<SceneCommand, "type" | "payload">,
): SceneCommand {
  return {
    ...baseEnvelope,
    commandId,
    idempotencyKey: `${commandId}-idem`,
    type: command.type,
    payload: command.payload,
  } as SceneCommand;
}

const validArtifact: SessionArtifact = {
  kind: "session.artifact",
  version: 1,
  sessionId: "session-001",
  createdAt: "2026-06-20T00:00:00.000+09:00",
  transcriptChunks: [],
  candidateCommands: [validCommand],
  presenterDecisions: [
    {
      kind: "presenter.decision",
      version: 1,
      decisionId: "decision-001",
      commandId: "cmd-001",
      decidedAt: "2026-06-20T00:00:10.000+09:00",
      decision: "approve",
    },
  ],
  approvedScene: {
    kind: "scene.model",
    version: 1,
    revision: 1,
    updatedAt: "2026-06-20T00:00:10.000+09:00",
    layout: "force",
    nodes: [
      {
        id: "process-001",
        label: "問い合わせ対応",
        kind: "process",
        importance: 4,
      },
    ],
    edges: [],
    groups: [],
    annotations: [],
    highlightTargetIds: [],
    focusNodeIds: [],
    approvedCommandIds: ["cmd-001"],
  },
};

const requiredCommandTypes: readonly SceneCommandType[] = [
  "add_node",
  "update_node",
  "connect_nodes",
  "disconnect_nodes",
  "create_group",
  "update_group",
  "set_layout",
  "highlight",
  "annotate",
  "focus",
  "remove_element",
];

describe("SceneCommand schema", () => {
  it("accepts the defined envelope and payload DSL", () => {
    const parsed = validateSceneCommand(validCommand);
    expect(parsed.type).toBe("add_node");
    if (parsed.type !== "add_node") {
      throw new Error("Expected add_node command");
    }
    expect(parsed.payload.node.kind).toBe("process");
    expect(parsed.sourceSegmentIds).toEqual(["chunk-001"]);
  });

  it("exposes the required MVP command types", () => {
    expect(sceneCommandTypeSchema.options).toEqual(requiredCommandTypes);
  });

  it("accepts a valid payload for every MVP command type", () => {
    const commands: readonly SceneCommand[] = [
      validCommand,
      commandWith("cmd-update-node", {
        type: "update_node",
        payload: {
          nodeId: "process-001",
          patch: {
            summary: "更新されたプロセス説明",
          },
        },
      }),
      commandWith("cmd-connect", {
        type: "connect_nodes",
        payload: {
          edge: {
            id: "edge-001",
            fromNodeId: "process-001",
            toNodeId: "system-001",
            kind: "automates",
            label: "自動化する",
          },
        },
      }),
      commandWith("cmd-disconnect", {
        type: "disconnect_nodes",
        payload: {
          edgeId: "edge-001",
        },
      }),
      commandWith("cmd-create-group", {
        type: "create_group",
        payload: {
          group: {
            id: "group-001",
            label: "対応チーム",
            nodeIds: ["person-001", "department-001"],
          },
        },
      }),
      commandWith("cmd-update-group", {
        type: "update_group",
        payload: {
          groupId: "group-001",
          patch: {
            summary: "問い合わせ対応に関わる要素",
          },
        },
      }),
      commandWith("cmd-layout", {
        type: "set_layout",
        payload: {
          layout: "matrix",
        },
      }),
      commandWith("cmd-highlight", {
        type: "highlight",
        payload: {
          targetIds: ["process-001"],
          intensity: "high",
          note: "改善候補",
        },
      }),
      commandWith("cmd-annotate", {
        type: "annotate",
        payload: {
          annotation: {
            id: "annotation-001",
            targetId: "process-001",
            text: "Presenter確認用メモ",
          },
        },
      }),
      commandWith("cmd-focus", {
        type: "focus",
        payload: {
          targetIds: ["process-001"],
          note: "現在の焦点",
        },
      }),
      commandWith("cmd-remove", {
        type: "remove_element",
        payload: {
          elementId: "annotation-001",
          elementKind: "annotation",
        },
      }),
    ];

    expect(commands.map((command) => sceneCommandSchema.parse(command).type)).toEqual(
      requiredCommandTypes,
    );
  });

  it("exposes the required MVP node kinds", () => {
    expect(sceneNodeKindSchema.options).toEqual([
      "person",
      "department",
      "customer",
      "process",
      "manual_task",
      "system",
      "database",
      "document",
      "decision",
      "pain_point",
      "ai_agent",
      "automation",
      "outcome",
    ]);
  });

  it("exposes the required MVP edge kinds", () => {
    expect(sceneEdgeKindSchema.options).toEqual([
      "flow",
      "sends",
      "receives",
      "depends_on",
      "causes",
      "blocks",
      "automates",
      "escalates_to",
    ]);
  });

  it("rejects generated JavaScript fields", () => {
    expect(() =>
      sceneCommandSchema.parse({
        ...validCommand,
        javascript: "alert('publish')",
      }),
    ).toThrow();
  });

  it("rejects generated markup labels", () => {
    expect(() =>
      sceneCommandSchema.parse({
        ...baseEnvelope,
        commandId: "cmd-002",
        idempotencyKey: "idem-002",
        type: "add_node",
        payload: {
          node: {
            id: "system-002",
            label: "<svg onload=alert(1)>",
            kind: "system",
          },
        },
      }),
    ).toThrow();
  });

  it("rejects missing source segment evidence", () => {
    expect(() =>
      sceneCommandSchema.parse({
        ...validCommand,
        sourceSegmentIds: [],
      }),
    ).toThrow();
  });

  it("rejects confidence outside the normalized range", () => {
    expect(() =>
      sceneCommandSchema.parse({
        ...validCommand,
        confidence: 1.1,
      }),
    ).toThrow();
  });

  it("sanitizes display labels before rendering layers use them", () => {
    expect(sanitizeDisplayLabel(" <b>重要</b>\u0000 ")).toBe("b重要/b");
  });
});

describe("Transcript safety boundary", () => {
  it("rejects transcript text containing markup-like characters at schema boundary", () => {
    expect(() =>
      transcriptChunkSchema.parse({
        id: "chunk-unsafe",
        receivedAt: "2026-06-20T00:00:00.000+09:00",
        text: "これは<script>alert(1)</script>です",
      }),
    ).toThrow();
  });

  it("provides renderer-side transcript sanitization as a second boundary", () => {
    expect(sanitizeTranscriptText(" <script>危険</script>\u0000 ")).toBe("script危険/script");
  });
});

describe("SessionArtifact schema", () => {
  it("requires approved scene state to be explicit", () => {
    expect(sessionArtifactSchema.parse(validArtifact).approvedScene.approvedCommandIds).toEqual([
      "cmd-001",
    ]);
  });
});

describe("Adapter boundary interfaces", () => {
  it("supports fixture, manual, and realtime transcript input without API keys", async () => {
    const fixtureAdapter: FixtureTranscriptAdapter = {
      kind: "fixture",
      async loadTranscriptChunks(fixtureId) {
        expect(fixtureId).toBe("fixture-001");
        return [
          {
            id: "chunk-fixture-001",
            receivedAt: "2026-06-20T00:00:00.000+09:00",
            text: "fixture input",
          },
        ];
      },
    };

    const manualAdapter: ManualTranscriptAdapter = {
      kind: "manual",
      async appendText(input) {
        return {
          id: "chunk-manual-001",
          receivedAt: input.receivedAt,
          speakerLabel: input.speakerLabel,
          text: input.text,
        };
      },
    };

    const realtimeAdapter: RealtimeTranscriptAdapter = {
      kind: "realtime",
      async subscribe(onChunk) {
        onChunk({
          id: "chunk-realtime-001",
          receivedAt: "2026-06-20T00:00:02.000+09:00",
          text: "realtime input",
        });
        return async () => undefined;
      },
    };

    expect(await fixtureAdapter.loadTranscriptChunks("fixture-001")).toHaveLength(1);
    expect(
      await manualAdapter.appendText({
        text: "manual input",
        receivedAt: "2026-06-20T00:00:01.000+09:00",
      }),
    ).toMatchObject({ id: "chunk-manual-001" });

    const receivedIds: string[] = [];
    const unsubscribe = await realtimeAdapter.subscribe((chunk) => receivedIds.push(chunk.id));
    await unsubscribe();
    expect(receivedIds).toEqual(["chunk-realtime-001"]);
  });

  it("keeps planner, renderer, transcription, and export as explicit boundaries", async () => {
    const currentScene: SceneModel = {
      kind: "scene.model",
      version: 1,
      revision: 0,
      updatedAt: "2026-06-20T00:00:00.000+09:00",
      layout: "force",
      nodes: [],
      edges: [],
      groups: [],
      annotations: [],
      highlightTargetIds: [],
      focusNodeIds: [],
      approvedCommandIds: [],
    } as const;

    const planner: PlannerBoundary = {
      name: "test-planner",
      async plan(input) {
        expect(input.currentScene.revision).toBe(0);
        return [];
      },
    };

    const renderer: RendererBoundary = {
      name: "test-renderer",
      async renderApprovedScene(scene) {
        expect(scene.approvedCommandIds).toEqual([]);
      },
      sanitizeTranscriptText,
    };

    const transcription: TranscriptionBoundary = {
      name: "test-transcription",
      input: {
        kind: "fixture",
        async loadTranscriptChunks() {
          return [];
        },
      },
    };

    const exporter: ExportBoundary = {
      name: "test-exporter",
      async exportSessionArtifact() {
        expect(validArtifact.kind).toBe("session.artifact");
        return new TextEncoder().encode("{}");
      },
    };

    expect(await planner.plan({ transcriptChunks: [], currentScene })).toEqual([]);
    await renderer.renderApprovedScene(currentScene);
    expect(renderer.sanitizeTranscriptText("<b>text</b>")).toBe("btext/b");
    expect(transcription.input.kind).toBe("fixture");
    expect(await exporter.exportSessionArtifact(validArtifact)).toBeInstanceOf(Uint8Array);
  });
});
