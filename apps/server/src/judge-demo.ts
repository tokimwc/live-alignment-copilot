import { transcriptChunkSchema, type PlannerBoundary, type TranscriptChunk } from "@lac/contracts";
import {
  approveProposal,
  createDemoSession,
  enqueuePlannerCommands,
  rejectProposal,
  undoScene,
  type DemoSessionState,
} from "@lac/scene-engine";
import { judgeTranscriptChunks } from "@lac/test-fixtures";
import {
  renderAudiencePage,
  renderPresenterPage,
  type AudiencePageView,
  type PresenterPageView,
} from "@lac/web";

export type JudgeDemoPlannerMode = "fixture" | "gpt-5.6";

export interface JudgeDemoError {
  readonly code:
    | "INPUT_VALIDATION_FAILED"
    | "PLANNER_UNAVAILABLE"
    | "SCHEMA_VALIDATION_FAILED"
    | "NO_PROPOSALS"
    | "ACTION_REJECTED";
  readonly message: string;
}

export interface JudgeDemoState {
  readonly planner: {
    readonly mode: JudgeDemoPlannerMode;
    readonly model: string;
    readonly label: string;
  };
  readonly transcriptText: string;
  readonly presenter: PresenterPageView;
  readonly audience: AudiencePageView;
  readonly canUndo: boolean;
  readonly error: JudgeDemoError | null;
}

export interface JudgeDemoControllerOptions {
  readonly planner: PlannerBoundary;
  readonly plannerMode: JudgeDemoPlannerMode;
  readonly model: string;
  readonly now?: () => string;
}

const FIXTURE_START = Date.parse("2026-06-20T00:00:00.000+09:00");

export const defaultJudgeDemoTranscript = judgeTranscriptChunks
  .map((chunk) => `${chunk.speakerLabel ?? "Speaker"}: ${chunk.text}`)
  .join("\n");

class DemoInputError extends Error {
  override readonly name = "DemoInputError";
}

class DemoNoProposalsError extends Error {
  override readonly name = "DemoNoProposalsError";
}

export class JudgeDemoController {
  readonly #planner: PlannerBoundary;
  readonly #plannerMode: JudgeDemoPlannerMode;
  readonly #model: string;
  readonly #now: () => string;
  #session: DemoSessionState;
  #transcriptText = defaultJudgeDemoTranscript;
  #error: JudgeDemoError | null = null;

  constructor(options: JudgeDemoControllerOptions) {
    this.#planner = options.planner;
    this.#plannerMode = options.plannerMode;
    this.#model = options.model;
    this.#now = options.now ?? (() => new Date().toISOString());
    this.#session = this.#createInitialSession();
  }

  getState(): JudgeDemoState {
    return {
      planner: {
        mode: this.#plannerMode,
        model: this.#model,
        label:
          this.#plannerMode === "fixture"
            ? "Deterministic fixture · no API key"
            : "GPT-5.6 Sol · server-side",
      },
      transcriptText: this.#transcriptText,
      presenter: renderPresenterPage(this.#session),
      audience: renderAudiencePage(this.#session),
      canUndo: this.#session.undoStack.length > 0,
      error: this.#error,
    };
  }

  async runPlanner(transcriptText: string): Promise<JudgeDemoState> {
    try {
      const transcriptChunks = parseTranscriptInput(transcriptText);
      const commands = await this.#planner.plan({
        transcriptChunks,
        currentScene: this.#session.presenterScene,
      });
      if (commands.length === 0) {
        throw new DemoNoProposalsError("Planner returned no proposals");
      }

      const candidateSession: DemoSessionState = {
        ...this.#session,
        transcriptChunks,
        proposals: [],
        candidateCommands: [],
      };
      const nextSession = enqueuePlannerCommands(candidateSession, commands);

      this.#session = nextSession;
      this.#transcriptText = transcriptText;
      this.#error = null;
    } catch (error: unknown) {
      this.#error = toSafeDemoError(error);
    }

    return this.getState();
  }

  approve(commandId: string): JudgeDemoState {
    try {
      this.#session = approveProposal(this.#session, commandId, {
        decidedAt: this.#now(),
        reason: "Presenter approved the schema-validated proposal",
      });
      this.#error = null;
    } catch {
      this.#error = {
        code: "ACTION_REJECTED",
        message: "This proposal cannot be approved now. The audience map was not changed.",
      };
    }
    return this.getState();
  }

  reject(commandId: string): JudgeDemoState {
    try {
      this.#session = rejectProposal(this.#session, commandId, {
        decidedAt: this.#now(),
        reason: "Presenter rejected the proposal in the judge demo",
      });
      this.#error = null;
    } catch {
      this.#error = {
        code: "ACTION_REJECTED",
        message: "This proposal cannot be rejected now. The audience map was not changed.",
      };
    }
    return this.getState();
  }

  undo(): JudgeDemoState {
    this.#session = undoScene(this.#session);
    this.#error = null;
    return this.getState();
  }

  reset(): JudgeDemoState {
    this.#session = this.#createInitialSession();
    this.#transcriptText = defaultJudgeDemoTranscript;
    this.#error = null;
    return this.getState();
  }

  #createInitialSession(): DemoSessionState {
    return createDemoSession({
      sessionId: "session-judge-demo-001",
      startedAt: "2026-06-20T00:00:00.000+09:00",
      transcriptChunks: judgeTranscriptChunks,
    });
  }
}

export function parseTranscriptInput(transcriptText: string): readonly TranscriptChunk[] {
  const lines = transcriptText
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0 || lines.length > 20) {
    throw new DemoInputError("Transcript must contain between 1 and 20 non-empty lines");
  }

  return lines.map((line, index) => {
    const speakerMatch = /^([^:：]{1,20})[:：]\s*(.+)$/u.exec(line);
    const value = transcriptChunkSchema.safeParse({
      id: `demo-en-${String(index + 1).padStart(3, "0")}`,
      receivedAt: new Date(FIXTURE_START + index * 8_000).toISOString(),
      speakerLabel: speakerMatch?.[1]?.trim() || undefined,
      text: (speakerMatch?.[2] ?? line).trim(),
    });

    if (!value.success) {
      throw new DemoInputError("Transcript line failed validation");
    }
    return value.data;
  });
}

function toSafeDemoError(error: unknown): JudgeDemoError {
  if (error instanceof DemoInputError) {
    return {
      code: "INPUT_VALIDATION_FAILED",
      message: "Check the transcript: use 1–20 lines of safe text.",
    };
  }
  if (error instanceof DemoNoProposalsError) {
    return {
      code: "NO_PROPOSALS",
      message: "No valid proposals were produced. The audience map was not changed.",
    };
  }
  if (error instanceof Error && error.name === "PlannerValidationError") {
    return {
      code: "SCHEMA_VALIDATION_FAILED",
      message:
        "The model output did not match the SceneCommand schema, so it was rejected. The audience map was not changed.",
    };
  }
  return {
    code: "PLANNER_UNAVAILABLE",
    message: "The planner could not run. The audience map was not changed.",
  };
}
