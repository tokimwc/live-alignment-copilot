import { describe, expect, it } from "vitest";

import { validateSessionArtifact } from "@lac/contracts";
import { fixtureTranscriptChunks } from "@lac/test-fixtures";
import {
  approveProposal,
  createDemoSession,
  enqueuePlannerCommands,
  freezeElement,
  getSceneHash,
  rejectProposal,
  undoScene,
  unfreezeElement,
} from "@lac/scene-engine";
import { DeterministicFixturePlanner } from "@lac/planner";
import {
  exportSessionArtifactJson,
  exportStaticReplayHtml,
  renderAudiencePage,
  renderPresenterPage,
} from "@lac/web";

describe("deterministic Live Alignment Copilot demo", () => {
  it("runs fixture playback through Presenter approval, Audience sync, undo, freeze, and exports", async () => {
    const planner = new DeterministicFixturePlanner();
    let session = createDemoSession({
      sessionId: "session-fixture-001",
      startedAt: "2026-06-20T00:00:00.000+09:00",
      transcriptChunks: fixtureTranscriptChunks,
    });

    const allCommands = await planner.plan({
      transcriptChunks: fixtureTranscriptChunks,
      currentScene: session.presenterScene,
    });
    session = enqueuePlannerCommands(session, allCommands);

    const presenterBeforeApproval = renderPresenterPage(session);
    const audienceBeforeApproval = renderAudiencePage(session);
    expect(presenterBeforeApproval.proposalQueue).toHaveLength(10);
    expect(presenterBeforeApproval.proposalQueue[0]?.preview.nodeCount).toBe(1);
    expect(audienceBeforeApproval.scene.nodes).toHaveLength(0);

    session = approveProposal(session, "cmd-fixture-001", {
      decidedAt: "2026-06-20T00:00:11.000+09:00",
      labelEdits: { "process-support-response": "顧客問い合わせ対応" },
    });
    session = rejectProposal(session, "cmd-fixture-002", {
      decidedAt: "2026-06-20T00:00:12.000+09:00",
      reason: "部分承認デモのため、この提案は却下する",
    });
    session = approveProposal(session, "cmd-fixture-003", {
      decidedAt: "2026-06-20T00:00:13.000+09:00",
    });

    expect(renderAudiencePage(session).scene.nodes.map((node) => node.label)).toEqual([
      "顧客問い合わせ対応",
    ]);
    expect(renderAudiencePage(session).scene.edges).toHaveLength(0);

    session = approveProposal(session, "cmd-fixture-004", {
      decidedAt: "2026-06-20T00:00:14.000+09:00",
    });
    session = freezeElement(session, "pain-response-delay");
    session = approveProposal(session, "cmd-fixture-005", {
      decidedAt: "2026-06-20T00:00:15.000+09:00",
    });
    session = approveProposal(session, "cmd-fixture-006", {
      decidedAt: "2026-06-20T00:00:16.000+09:00",
    });
    session = approveProposal(session, "cmd-fixture-007", {
      decidedAt: "2026-06-20T00:00:17.000+09:00",
    });
    session = approveProposal(session, "cmd-fixture-008", {
      decidedAt: "2026-06-20T00:00:18.000+09:00",
      allowedPatchFields: ["summary"],
    });

    expect(
      renderAudiencePage(session).scene.nodes.find((node) => node.id === "pain-response-delay")
        ?.label,
    ).toBe("応答遅延");
    expect(
      renderAudiencePage(session).scene.nodes.find((node) => node.id === "ai-draft-agent")?.label,
    ).toBe("AI下書きエージェント");

    const hashBeforeUndo = getSceneHash(session.presenterScene);
    session = undoScene(session);
    expect(getSceneHash(session.presenterScene)).toBe(getSceneHash(session.audienceScene));
    expect(getSceneHash(session.presenterScene)).not.toBe(hashBeforeUndo);
    session = unfreezeElement(session, "pain-response-delay");

    session = approveProposal(session, "cmd-fixture-009", {
      decidedAt: "2026-06-20T00:00:19.000+09:00",
    });
    session = approveProposal(session, "cmd-fixture-010", {
      decidedAt: "2026-06-20T00:00:20.000+09:00",
    });

    expect(renderPresenterPage(session).sceneHash).toBe(renderAudiencePage(session).sceneHash);
    expect(renderAudiencePage(session).scene.nodes.map((node) => node.kind)).toEqual([
      "process",
      "pain_point",
      "ai_agent",
      "outcome",
    ]);

    const artifactJson = exportSessionArtifactJson(session);
    const artifact = validateSessionArtifact(JSON.parse(artifactJson));
    expect(artifact.approvedScene.nodes.map((node) => node.id)).toEqual([
      "process-support-response",
      "pain-response-delay",
      "ai-draft-agent",
      "outcome-shorter-response",
    ]);

    const replayHtml = exportStaticReplayHtml(session);
    expect(replayHtml).toContain("<!doctype html>");
    expect(replayHtml).toContain("Live Alignment Copilot Replay");
    expect(replayHtml).toContain("AI下書きエージェント");
  });
});
