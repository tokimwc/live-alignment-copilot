import { describe, expect, it } from "vitest";

import type { SceneCommand } from "@lac/contracts";

import {
  approveProposal,
  createDemoSession,
  enqueuePlannerCommands,
  freezeElement,
  getSceneHash,
  redoScene,
  rejectProposal,
  undoScene,
} from "./index.js";

const now = "2026-06-20T00:00:00.000+09:00";

const addNodeCommand: SceneCommand = {
  kind: "scene.command",
  version: 1,
  commandId: "cmd-add-process",
  idempotencyKey: "idem-add-process",
  issuedAt: now,
  sourceSegmentIds: ["chunk-001"],
  confidence: 0.91,
  rationale: "As-Is の中心プロセスを追加する",
  type: "add_node",
  payload: {
    node: {
      id: "process-support-response",
      label: "問い合わせ対応",
      kind: "process",
      importance: 5,
    },
  },
};

const updateNodeCommand: SceneCommand = {
  kind: "scene.command",
  version: 1,
  commandId: "cmd-update-process",
  idempotencyKey: "idem-update-process",
  issuedAt: "2026-06-20T00:00:01.000+09:00",
  sourceSegmentIds: ["chunk-002"],
  confidence: 0.87,
  rationale: "課題が明確になったためラベルと要約を更新する",
  type: "update_node",
  payload: {
    nodeId: "process-support-response",
    patch: {
      label: "問い合わせ対応の課題",
      summary: "手作業確認で応答が遅い",
      importance: 5,
    },
  },
};

describe("demo session scene reducer", () => {
  it("keeps Audience unchanged until Presenter approval, then syncs both scene hashes", () => {
    let session = createDemoSession({ sessionId: "session-test", startedAt: now });
    session = enqueuePlannerCommands(session, [addNodeCommand]);

    expect(session.presenterScene.nodes).toHaveLength(0);
    expect(session.audienceScene.nodes).toHaveLength(0);
    expect(session.proposals[0]?.previewScene.nodes).toHaveLength(1);

    session = approveProposal(session, "cmd-add-process", { decidedAt: now });

    expect(session.presenterScene.nodes.map((node) => node.id)).toEqual([
      "process-support-response",
    ]);
    expect(getSceneHash(session.presenterScene)).toBe(getSceneHash(session.audienceScene));
  });

  it("rejects queued proposals without applying them to either scene", () => {
    let session = createDemoSession({ sessionId: "session-test", startedAt: now });
    session = enqueuePlannerCommands(session, [addNodeCommand]);
    session = rejectProposal(session, "cmd-add-process", {
      decidedAt: now,
      reason: "Presenter judged it too early",
    });

    expect(session.presenterScene.nodes).toHaveLength(0);
    expect(session.audienceScene.nodes).toHaveLength(0);
    expect(session.proposals[0]?.status).toBe("rejected");
  });

  it("supports label editing and partial approval of update patches", () => {
    let session = createDemoSession({ sessionId: "session-test", startedAt: now });
    session = enqueuePlannerCommands(session, [addNodeCommand, updateNodeCommand]);
    session = approveProposal(session, "cmd-add-process", {
      decidedAt: now,
      labelEdits: { "process-support-response": "顧客問い合わせ対応" },
    });
    session = approveProposal(session, "cmd-update-process", {
      decidedAt: "2026-06-20T00:00:02.000+09:00",
      allowedPatchFields: ["summary"],
    });

    expect(session.presenterScene.nodes[0]).toMatchObject({
      label: "顧客問い合わせ対応",
      summary: "手作業確認で応答が遅い",
    });
    expect(
      session.proposals.find((proposal) => proposal.command.commandId === "cmd-update-process")
        ?.status,
    ).toBe("partially_approved");
  });

  it("prevents later commands from changing or deleting frozen elements", () => {
    let session = createDemoSession({ sessionId: "session-test", startedAt: now });
    session = enqueuePlannerCommands(session, [addNodeCommand]);
    session = approveProposal(session, "cmd-add-process", { decidedAt: now });
    session = freezeElement(session, "process-support-response");
    session = enqueuePlannerCommands(session, [updateNodeCommand]);
    session = approveProposal(session, "cmd-update-process", {
      decidedAt: "2026-06-20T00:00:02.000+09:00",
    });

    expect(session.presenterScene.nodes[0]?.label).toBe("問い合わせ対応");
    expect(session.presenterScene.nodes[0]?.summary).toBeUndefined();
  });

  it("deduplicates repeated idempotency keys and keeps undo/redo scene hashes synced", () => {
    const duplicateCommand = {
      ...addNodeCommand,
      commandId: "cmd-add-process-duplicate",
    } satisfies SceneCommand;

    let session = createDemoSession({ sessionId: "session-test", startedAt: now });
    session = enqueuePlannerCommands(session, [addNodeCommand, duplicateCommand]);
    session = approveProposal(session, "cmd-add-process", { decidedAt: now });
    session = approveProposal(session, "cmd-add-process-duplicate", {
      decidedAt: "2026-06-20T00:00:01.000+09:00",
    });

    expect(session.presenterScene.nodes).toHaveLength(1);

    session = undoScene(session);
    expect(getSceneHash(session.presenterScene)).toBe(getSceneHash(session.audienceScene));
    expect(session.presenterScene.nodes).toHaveLength(0);

    session = redoScene(session);
    expect(getSceneHash(session.presenterScene)).toBe(getSceneHash(session.audienceScene));
    expect(session.presenterScene.nodes).toHaveLength(1);
  });
});
