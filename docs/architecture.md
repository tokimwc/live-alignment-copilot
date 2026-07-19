# Architecture

## Dependency Direction

```text
apps/server ─┬─> apps/web ───────────┐
             ├─> packages/planner ───┼─> packages/contracts
             ├─> packages/scene-engine ─┘
             └─> packages/test-fixtures ─> packages/contracts

packages/planner ───────> packages/test-fixtures
packages/planner ───────> packages/scene-engine
packages/scene-engine ──> packages/contracts
```

Rules:

- `packages/contracts` is the lowest-level public contract package.
- `packages/scene-engine` owns scene-state behavior and must not import React or renderer libraries.
- `packages/planner` owns planner adapter shape and must return only validated `SceneCommand` values. The deterministic fixture planner may import fixture data.
- `apps/server` composes Planner, Transcription, Renderer, and Export boundaries.
- `apps/web` may render validated proposal previews in the Presenter surface and
  approved `SceneModel` in Audience; it must never execute candidate model output
  or publish a preview as Audience state.

## Data Flow

```text
Meeting transcript -> validated TranscriptChunk[] -> createPlannerAdapter

No OPENAI_API_KEY:
  -> DeterministicFixturePlanner -> Zod-validated SceneCommand[]

OPENAI_API_KEY present:
  -> server-side gpt-5.6-sol Responses request
  -> strict JSON Schema response
  -> exact-shape + Zod + source-id validation
  -> SceneCommand[]

Either successful lane:
  -> proposal queue + previewScene
  -> PresenterDecision
  -> approved SceneModel only
  -> Audience page / RendererBoundary / ExportBoundary
  -> SessionArtifact

Any input, transport, refusal, parse, or schema error:
  -> safe UI error -> no enqueue -> Audience unchanged
```

Candidate commands are audit data. Audience state comes from `approvedScene`, not from raw planner output.

`OPENAI_API_KEY` is consumed only by `apps/server`. It is not part of any web
view model or HTTP response. The local server binds to `127.0.0.1` unless an
explicit host is supplied by a caller.

## Deterministic Demo Runtime

`packages/scene-engine` now owns the presenter-reviewed session reducer:

- `createDemoSession`
- `enqueuePlannerCommands`
- `approveProposal`
- `rejectProposal`
- `freezeElement` / `unfreezeElement`
- `undoScene` / `redoScene`
- `getSceneHash`

The reducer keeps `presenterScene` and `audienceScene` synchronized only after approval. Queued proposals carry a preview scene, changed element IDs, and animation intent, but those previews are not published to Audience state.

`apps/web` maps the approved scene into separate Presenter and Audience page models and exports a self-contained replay HTML string. `apps/server` exposes `runDeterministicFixtureDemo` as a composition entrypoint for producing `session-artifact.json` and replay HTML without touching OpenAI, microphone input, Manim, personal note vaults, or adjacent private automation systems.

## Build Week Judge Runtime

- `packages/planner/Gpt56ResponsesPlanner` owns the remote call. It supports the
  smallest useful structured-output subset (`add_node`, `connect_nodes`, and
  `highlight`) and returns only commands accepted by the broader existing DSL.
- `createPlannerAdapter` selects GPT-5.6 only when a non-blank key is supplied;
  otherwise it returns `DeterministicFixturePlanner` without calling fetch.
- The deterministic planner filters two disjoint fixture sets through the same
  boundary: an English judge sample and the preserved Japanese regression
  scenario. Their transcript and command IDs do not overlap.
- `apps/server/JudgeDemoController` owns the mutable local session and all
  planner/reducer actions. A failed planner run changes only the safe error view,
  not the session or Audience scene.
- `apps/server/demo-server.ts` exposes same-origin JSON actions and the authored
  HTML shell. Request bodies are bounded and error responses do not echo input.
- `apps/web/renderJudgeDemoPage` is a dependency-free UI. Its browser script
  renders transcript and model values through DOM `textContent` and sends only
  conversation text or selected command IDs back to the loopback server.
- Proposal preview and approved Audience state are rendered separately, making
  the approval boundary visible to judges.

## Boundary Interfaces

- `FixtureTranscriptAdapter`: loads deterministic transcript chunks by fixture ID.
- `ManualTranscriptAdapter`: accepts manually entered text and returns a `TranscriptChunk`.
- `RealtimeTranscriptAdapter`: emits `TranscriptChunk` values through a subscription interface.
- `PlannerBoundary`: receives transcript chunks plus current scene and returns `SceneCommand[]`.
- `RendererBoundary`: renders only approved `SceneModel` and sanitizes transcript display text before display.
- `TranscriptionBoundary`: names and wraps one transcript input adapter.
- `ExportBoundary`: exports a validated `SessionArtifact`.

## Schema Boundary

`packages/contracts` defines:

- `SceneCommand`: the only accepted planner output DSL.
- `SceneModel`: renderer-independent approved scene state.
- `PresenterDecision`: approval/rejection audit record.
- `SessionArtifact`: replay/export boundary for future adapters.

The current DSL uses a strict command envelope plus a typed `payload`.

Envelope fields:

- `kind`
- `version`
- `commandId`
- `idempotencyKey`
- `issuedAt`
- `sourceSegmentIds`
- `confidence`
- `rationale`
- `type`
- `payload`

Command types:

- `add_node`
- `update_node`
- `connect_nodes`
- `disconnect_nodes`
- `create_group`
- `update_group`
- `set_layout`
- `highlight`
- `annotate`
- `focus`
- `remove_element`

`SceneModel` holds approved nodes, edges, groups, annotations, highlight targets, focus targets, and approved command IDs. Labels and transcript text reject controls and markup-like characters at schema boundary. Renderer implementations must still call `sanitizeTranscriptText` or equivalent before display.

## Out of Scope for This Goal

- Microphone input.
- Authentication, persistence, deployment, and complex realtime streaming.
- Live paid GPT-5.6 verification in automated tests; a human-authorized trace is
  optional submission evidence and is not required for keyless judging.
- Manim.
- Full graph renderer/PPTX/HTML generator implementation.
- Changes to adjacent private automation systems.
