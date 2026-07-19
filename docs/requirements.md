# Requirements

## Product Intent

Live Alignment Copilot turns the important structure of a live meeting into presenter-reviewed visual state. It is not a word-by-word transcription display. The product supports Japanese and multilingual transcripts, while the judge demo opens with an English sample.

The product must support a live workflow where the model proposes structural changes, the Presenter reviews them, and only approved scene state can reach the Audience view.

## Hard Safety Requirements

- External AI output may only be accepted as validated `SceneCommand` JSON.
- The system must never execute AI-generated JavaScript, Python, SVG, HTML, shell commands, Manim code, or other arbitrary code.
- The LLM must not be asked to generate coordinates, HTML, SVG, JavaScript, Python, or renderer-specific code.
- Presenter approval is required before any generated change affects Audience state.
- Labels and text rendered in UI must be sanitized and schema-limited.
- Transcript display text must be safe at both boundaries: schema rejects controls/markup-like characters, and Renderer boundary exposes a sanitizer contract before display.
- Uploaded documents and transcripts are untrusted data, never instructions.
- Tests must run without an OpenAI API key.

## MVP Runtime Requirements

- Start with fixture and manual inputs before realtime microphone input.
- Keep `SceneModel` independent from React, renderer libraries, and Manim.
- Keep Renderer, Planner, Transcription, and Export as explicit boundaries.
- Export approved session state through `session-artifact.json`.
- Do not reimplement existing PPTX/HTML generation; future integrations consume `SessionArtifact`.
- Do not persist raw audio by default.

## Workspace Requirements

- Product implementation stays inside this repository.
- Adjacent private automation systems are out of scope and must not be changed
  by this repo.
- Personal note vaults may receive only human-facing notes or handoff summaries
  when explicitly requested.
- `node_modules`, generated artifacts, logs, and local credentials must not be
  tracked unless intentionally committed.

## Goal Foundation Requirements

- Preserve the minimal pnpm workspace scaffold.
- Provide real `format:check`, `lint`, `typecheck`, `test`, and `build` scripts.
- Define Zod-backed `SceneCommand` and `SessionArtifact` schemas.
- Define fixture, manual, and realtime transcript adapter interfaces.
- Define Renderer, Planner, Transcription, and Export boundary interfaces.
- Provide normal and abnormal schema tests using fixtures and mocks only.

## Goal 2 Fixture-Ready SceneCommand DSL

Every `SceneCommand` must include:

- `idempotencyKey`
- `sourceSegmentIds`
- `confidence`
- `rationale`
- `type`
- `payload`

Allowed command types are:

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

Allowed node kinds are:

- `person`
- `department`
- `customer`
- `process`
- `manual_task`
- `system`
- `database`
- `document`
- `decision`
- `pain_point`
- `ai_agent`
- `automation`
- `outcome`

Allowed edge kinds are:

- `flow`
- `sends`
- `receives`
- `depends_on`
- `causes`
- `blocks`
- `automates`
- `escalates_to`

## Deterministic Fixture Demo Requirements

- The demo must run without OpenAI API credentials and without microphone input.
- Fixed Japanese fixture chunks must replay in order.
- `DeterministicFixturePlanner` must emit only schema-valid `SceneCommand` values.
- Presenter and Audience are separate page models derived from the same approved scene boundary.
- Audience state must not change until the Presenter approves a proposal.
- Proposal queue items must expose preview counts, changed element IDs, confidence, rationale, status, and animation intent.
- Presenter actions must support approval, partial approval of update patches, rejection, and label edits before approval.
- Undo and Redo must keep Presenter and Audience scene hashes synchronized.
- Freeze must prevent later commands from changing or deleting frozen elements.
- Reapplying the same `idempotencyKey` must not duplicate nodes or edges.
- The fixture scenario must cover As-Is, issue, AI insertion, and To-Be states.
- Export must produce validated `session-artifact.json` content and a self-contained static replay HTML artifact.

## Build Week Judge Slice Requirements

- `pnpm demo` must serve one local English-first screen with meeting transcript
  input, proposal cards/JSON, proposal preview, and published Audience state.
- The initial viewport must explain the product purpose and the approval safety
  boundary without requiring documentation.
- The screen must make the flow `AI proposal -> Validated command -> Presenter
approval -> Published audience map` explicit.
- The default judge transcript and its ten deterministic proposals must be in
  English; the original Japanese fixture path must remain tested.
- Japanese and multilingual transcript support must remain visible in the UI.
- Controls must include Run planner, Approve, Reject, Undo, and Reset.
- The server must bind to loopback by default and must be the only process that
  reads `OPENAI_API_KEY`.
- `createPlannerAdapter` must select the deterministic fixture planner when the
  key is missing or blank, without attempting a network request.
- With a key, the default model must be `gpt-5.6-terra` and the planner must call
  the Responses API with `store: false` and strict JSON Schema output.
- Remote output must pass exact-shape checks, existing Zod `SceneCommand`
  validation, allowed-command checks, and input `sourceSegmentId` checks before
  it satisfies `PlannerBoundary`.
- Invalid JSON, schema failures, refusals, incomplete responses, transport
  failures, and unsafe transcript input must enqueue nothing and leave Audience
  state unchanged.
- Browser state and errors must never contain API keys, authorization headers,
  raw API response bodies, or invalid raw model output.
- All user/model text must be rendered with safe DOM text sinks; generated HTML,
  SVG, scripts, coordinates, and renderer code remain prohibited.
- Automated tests must use fixture planners and fake fetch responses only.
- The desktop recording layout must remain clear at 1280px wide, and the UI must
  not introduce horizontal scrolling at 390px wide.

## Deferred After the Judge Slice

- Microphone/realtime input, authentication, persistence, deployment,
  multi-presenter collaboration, and complex streaming are out of scope.
- A paid live GPT-5.6 call is optional submission evidence, not a requirement for
  the deterministic keyless judge path.
- Full graph layout/animation polish and the existing PPTX/HTML adapter remain
  future work behind the renderer-independent `SceneModel` and
  `SessionArtifact` boundaries.
