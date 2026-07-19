import { describe, expect, it } from "vitest";

import type { PlannerBoundary } from "@lac/contracts";
import { DeterministicFixturePlanner } from "@lac/planner";
import { renderJudgeDemoPage } from "@lac/web";

import {
  JudgeDemoController,
  defaultJudgeDemoTranscript,
} from "../../apps/server/src/judge-demo.js";

class FixtureThenInvalidPlanner implements PlannerBoundary {
  readonly #fixture = new DeterministicFixturePlanner();
  #calls = 0;

  async plan(input: Parameters<PlannerBoundary["plan"]>[0]) {
    this.#calls += 1;
    if (this.#calls > 1) {
      const error = new Error("raw model output must not escape");
      error.name = "PlannerValidationError";
      throw error;
    }
    return this.#fixture.plan(input);
  }
}

describe("judge-friendly vertical slice", () => {
  it("renders the one-screen judge path with all review controls and safe DOM sinks", () => {
    const html = renderJudgeDemoPage();

    expect(html).toContain("Live Alignment Copilot");
    expect(html).toContain(
      "Turn messy live meetings into presenter-approved shared structure maps.",
    );
    expect(html).toContain("Supports Japanese and multilingual transcripts");
    expect(html).toContain("Transcript becomes reviewable diagram changes");
    expect(html).toContain("0 review decisions logged");
    expect(html).toContain('" review decision"');
    expect(html).toContain("AI proposal");
    expect(html).toContain("Validated command");
    expect(html).toContain("Presenter approval");
    expect(html).toContain("Published audience map");
    expect(html).toContain("Meeting transcript");
    expect(html).toContain('lang="en"');
    expect(html).toContain(">Run planner</button>");
    expect(html).toContain(">Approve</button>");
    expect(html).toContain(">Reject</button>");
    expect(html).toContain(">Undo</button>");
    expect(html).toContain(">Reset</button>");
    expect(html).toContain('data-testid="conversation-input"');
    expect(html).toContain('data-testid="proposal-preview"');
    expect(html).toContain('data-testid="audience-scene"');
    expect(html).not.toContain("innerHTML");
    expect(html).not.toContain("OPENAI_API_KEY");
  });

  it("runs keyless planning, keeps Audience empty until approval, then supports reject, undo, and reset", async () => {
    const controller = new JudgeDemoController({
      planner: new DeterministicFixturePlanner(),
      plannerMode: "fixture",
      model: "deterministic-fixture-planner",
      now: () => "2026-07-18T12:00:00.000+09:00",
    });

    const proposed = await controller.runPlanner(defaultJudgeDemoTranscript);
    expect(proposed.planner.label).toContain("Deterministic fixture");
    expect(proposed.transcriptText).toContain("Support Lead:");
    expect(proposed.presenter.proposalQueue).toHaveLength(10);
    expect(proposed.presenter.proposalQueue[0]?.command.type).toBe("add_node");
    expect(proposed.presenter.proposalQueue[0]?.previewScene.nodes).toHaveLength(1);
    expect(proposed.audience.scene.nodes).toHaveLength(0);

    const approved = controller.approve("cmd-demo-en-001");
    expect(approved.presenter.proposalQueue[0]?.status).toBe("approved");
    expect(approved.audience.scene.nodes.map((node) => node.label)).toEqual([
      "Support response workflow",
    ]);

    const rejected = controller.reject("cmd-demo-en-002");
    expect(rejected.presenter.proposalQueue[1]?.status).toBe("rejected");
    expect(rejected.presenter.decisionsCount).toBe(2);
    expect(rejected.audience.scene.nodes).toHaveLength(1);

    const undone = controller.undo();
    expect(undone.presenter.decisionsCount).toBe(2);
    expect(undone.audience.scene.nodes).toHaveLength(0);
    expect(undone.canUndo).toBe(false);

    const reset = controller.reset();
    expect(reset.transcriptText).toBe(defaultJudgeDemoTranscript);
    expect(reset.presenter.decisionsCount).toBe(0);
    expect(reset.presenter.proposalQueue).toHaveLength(0);
    expect(reset.audience.scene.nodes).toHaveLength(0);
  });

  it("fails closed when a later model response is invalid", async () => {
    const controller = new JudgeDemoController({
      planner: new FixtureThenInvalidPlanner(),
      plannerMode: "gpt-5.6",
      model: "gpt-5.6-sol",
      now: () => "2026-07-18T12:00:00.000+09:00",
    });

    await controller.runPlanner(defaultJudgeDemoTranscript);
    const approved = controller.approve("cmd-demo-en-001");
    const approvedHash = approved.audience.sceneHash;

    const rejectedOutput = await controller.runPlanner(defaultJudgeDemoTranscript);
    expect(rejectedOutput.error?.code).toBe("SCHEMA_VALIDATION_FAILED");
    expect(rejectedOutput.error?.message).not.toContain("raw model output");
    expect(rejectedOutput.audience.sceneHash).toBe(approvedHash);
    expect(rejectedOutput.audience.scene.nodes).toHaveLength(1);
  });

  it("rejects unsafe transcript markup before planning", async () => {
    const controller = new JudgeDemoController({
      planner: new DeterministicFixturePlanner(),
      plannerMode: "fixture",
      model: "deterministic-fixture-planner",
    });

    const result = await controller.runPlanner("話者A: <script>alert(1)</script>");
    expect(result.error?.code).toBe("INPUT_VALIDATION_FAILED");
    expect(result.presenter.proposalQueue).toHaveLength(0);
    expect(result.audience.scene.nodes).toHaveLength(0);
  });
});
