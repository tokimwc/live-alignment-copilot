# Acceptance Criteria

## Goal Foundation Criteria

| ID    | Criterion                                                                                                | Evidence                                                                                                                  |
| ----- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| AC-01 | Minimal scaffold is preserved as a pnpm workspace.                                                       | `package.json`, `pnpm-workspace.yaml`, package manifests.                                                                 |
| AC-02 | Requirements document is concrete.                                                                       | `docs/requirements.md`.                                                                                                   |
| AC-03 | Architecture explains dependency direction and boundaries.                                               | `docs/architecture.md`.                                                                                                   |
| AC-04 | Acceptance criteria are mapped to evidence or tests.                                                     | This document.                                                                                                            |
| AC-05 | Decisions record fixture-first, no-pipeline, no-Manim, and artifact-boundary defaults.                   | `docs/decisions.md`.                                                                                                      |
| AC-06 | Renderer ADR selects the MVP renderer approach and rejects unsafe alternatives.                          | `docs/adr/0001-renderer-selection.md`.                                                                                    |
| AC-07 | `SceneCommand` schema is defined with normal and abnormal tests.                                         | `packages/contracts/src/index.ts`, `packages/contracts/src/index.test.ts`.                                                |
| AC-08 | `SessionArtifact` schema is defined and tested.                                                          | `packages/contracts/src/index.ts`, `packages/contracts/src/index.test.ts`, `packages/test-fixtures/src/fixtures.test.ts`. |
| AC-09 | Fixture, manual, and realtime adapter interfaces exist.                                                  | `packages/contracts/src/index.ts`, adapter interface unit test.                                                           |
| AC-10 | Renderer, Planner, Transcription, and Export boundaries exist.                                           | `packages/contracts/src/index.ts`, `apps/server/src/index.ts`, boundary unit test.                                        |
| AC-11 | Tests run without OpenAI API keys or microphone input.                                                   | Vitest tests use fixtures and in-memory mocks only.                                                                       |
| AC-12 | Format, lint, typecheck, unit test, and build commands are real and pass.                                | `docs/verification.md` command results.                                                                                   |
| AC-13 | `SceneCommand` envelope includes idempotency, source segments, confidence, rationale, type, and payload. | `packages/contracts/src/index.ts`, envelope unit tests.                                                                   |
| AC-14 | Goal 2 command, node, and edge kinds are accepted by schema and old arbitrary fields are rejected.       | `packages/contracts/src/index.test.ts`, fixture tests.                                                                    |
| AC-15 | Transcript display text has an explicit schema boundary and Renderer sanitizer contract.                 | `transcriptChunkSchema`, `RendererBoundary`, transcript safety unit tests.                                                |

## Deterministic Fixture Demo Criteria

| ID    | Criterion                                                                      | Evidence                                                                                     |
| ----- | ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| AC-16 | Presenter and Audience page models exist and are rendered from approved state. | `apps/web/src/index.ts`, `tests/e2e/deterministic-demo.test.ts`.                             |
| AC-17 | Audience does not change before approval and syncs after approval.             | `packages/scene-engine/src/demo-session.test.ts`, deterministic demo e2e.                    |
| AC-18 | Fixed Japanese fixture playback produces strict ordered `SceneCommand` values. | `packages/planner/src/mock-planner.test.ts`, `packages/test-fixtures/src/index.ts`.          |
| AC-19 | Proposal queue exposes diff preview and animation intent.                      | `DemoProposal` in `packages/scene-engine/src/index.ts`, Presenter page e2e assertions.       |
| AC-20 | Approval, partial approval, rejection, and label editing are implemented.      | `packages/scene-engine/src/demo-session.test.ts`, deterministic demo e2e.                    |
| AC-21 | Undo, Redo, Freeze, and Unfreeze are implemented.                              | `packages/scene-engine/src/demo-session.test.ts`, deterministic demo e2e.                    |
| AC-22 | Frozen elements are protected from later command changes/deletes.              | `packages/scene-engine/src/demo-session.test.ts`, deterministic demo e2e.                    |
| AC-23 | Repeated `idempotencyKey` application does not duplicate scene elements.       | `packages/scene-engine/src/demo-session.test.ts`.                                            |
| AC-24 | The scenario covers As-Is, issue, AI insertion, and To-Be.                     | `packages/test-fixtures/src/index.ts`, deterministic demo e2e final scene assertion.         |
| AC-25 | `session-artifact.json` and self-contained replay HTML can be exported.        | `apps/web/src/index.ts`, `apps/server/src/index.ts`, deterministic demo e2e artifact checks. |

## Build Week Judge Slice Criteria

| ID    | Criterion                                                                                         | Evidence                                                                      |
| ----- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| AC-26 | One English-first screen explains the product and the four-stage safe publication flow.           | `apps/web/src/judge-demo.ts`, `tests/e2e/judge-demo.test.ts`.                 |
| AC-27 | Run planner, Approve, Reject, Undo, and Reset are wired through the server controller.            | `apps/server/src/judge-demo.ts`, `apps/server/src/demo-server.ts`, judge e2e. |
| AC-28 | A missing/blank API key selects the deterministic planner without a fetch call.                   | `createPlannerAdapter`, planner unit test.                                    |
| AC-29 | A present key selects `gpt-5.6-sol` by default and sends a strict Responses schema request.       | `Gpt56ResponsesPlanner`, fake-fetch request-shape unit test.                  |
| AC-30 | Invalid commands and unknown transcript source IDs are rejected after the model boundary.         | Planner schema/source rejection unit tests.                                   |
| AC-31 | Invalid model output leaves the current Audience scene unchanged and returns a safe error.        | `JudgeDemoController`, fail-closed judge e2e.                                 |
| AC-32 | Browser HTML/state contains no API key and uses text-only DOM sinks for untrusted values.         | Judge UI e2e contract, `renderJudgeDemoPage`.                                 |
| AC-33 | The keyless path produces ten proposals; Approve publishes, Reject does not, and Undo/Reset work. | Live browser and controller evidence in `docs/verification.md`.               |
| AC-34 | Full format, lint, typecheck, unit, e2e, and build gate passes without a key.                     | Final 2026-07-19 results in `docs/verification.md`.                           |
| AC-35 | The live demo is recording-ready at 1280px and has no horizontal overflow at 390px.               | Browser QA evidence in `docs/verification.md`.                                |

## Future Acceptance Criteria

| ID     | Criterion                                                                               | Planned Goal             |
| ------ | --------------------------------------------------------------------------------------- | ------------------------ |
| AC-F01 | Playwright screenshots verify final visual layout and responsive behavior.              | Visual QA goal.          |
| AC-F02 | Realtime transcription adapter is implemented without raw-audio persistence by default. | Realtime input goal.     |
| AC-F03 | Existing PPTX/HTML generators consume `session-artifact.json` through an adapter.       | Export/integration goal. |
| AC-F04 | Authentication, persistence, and hosted deployment meet production controls.            | Production goal.         |
