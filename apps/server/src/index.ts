import { validateSceneCommand } from "@lac/contracts";
import type {
  ExportBoundary,
  PlannerBoundary,
  RendererBoundary,
  TranscriptionBoundary,
} from "@lac/contracts";
import { DeterministicFixturePlanner } from "@lac/planner";
import {
  approveProposal,
  createDemoSession,
  enqueuePlannerCommands,
  freezeElement,
} from "@lac/scene-engine";
import { fixtureTranscriptChunks } from "@lac/test-fixtures";
import {
  exportSessionArtifactJson,
  exportStaticReplayHtml,
  renderAudiencePage,
  renderPresenterPage,
} from "@lac/web";

export function validatePlannerResponse(input: unknown): ReturnType<typeof validateSceneCommand> {
  return validateSceneCommand(input);
}

export {
  JudgeDemoController,
  defaultJudgeDemoTranscript,
  parseTranscriptInput,
  type JudgeDemoControllerOptions,
  type JudgeDemoError,
  type JudgeDemoPlannerMode,
  type JudgeDemoState,
} from "./judge-demo.js";

export { createJudgeDemoHttpServer, startJudgeDemoServer } from "./demo-server.js";

export interface RuntimeBoundaries {
  readonly planner: PlannerBoundary;
  readonly transcription: TranscriptionBoundary;
  readonly renderer: RendererBoundary;
  readonly exporter: ExportBoundary;
}

export async function runDeterministicFixtureDemo(): Promise<{
  readonly sessionArtifactJson: string;
  readonly staticReplayHtml: string;
  readonly presenterSceneHash: string;
  readonly audienceSceneHash: string;
}> {
  const planner = new DeterministicFixturePlanner();
  let session = createDemoSession({
    sessionId: "session-fixture-001",
    startedAt: "2026-06-20T00:00:00.000+09:00",
    transcriptChunks: fixtureTranscriptChunks,
  });
  const commands = await planner.plan({
    transcriptChunks: fixtureTranscriptChunks,
    currentScene: session.presenterScene,
  });
  session = enqueuePlannerCommands(session, commands);

  for (const command of commands) {
    if (command.commandId === "cmd-fixture-008") {
      session = freezeElement(session, "pain-response-delay");
      session = approveProposal(session, command.commandId, {
        decidedAt: "2026-06-20T00:00:28.000+09:00",
        allowedPatchFields: ["summary"],
      });
    } else {
      session = approveProposal(session, command.commandId, {
        decidedAt: "2026-06-20T00:00:27.000+09:00",
      });
    }
  }

  return {
    sessionArtifactJson: exportSessionArtifactJson(session),
    staticReplayHtml: exportStaticReplayHtml(session),
    presenterSceneHash: renderPresenterPage(session).sceneHash,
    audienceSceneHash: renderAudiencePage(session).sceneHash,
  };
}
