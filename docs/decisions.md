# Decisions

Record reversible assumptions and architecture decisions here.

## 2026-06-20 - Goal 1 Defaults

- Use pnpm workspaces with strict TypeScript because the existing scaffold already declared pnpm workspace packages.
- Start with fixture-only validation before OpenAI API or microphone input to keep the first demo deterministic and keyless.
- Treat adjacent private automation systems as out of scope and do not read from or write to them during this product MVP.
- Keep the scene model renderer-independent. React/UI and renderer choices must depend on the scene model, not the reverse.
- Use `session-artifact.json` as the future adapter boundary for existing PPTX/HTML generation instead of reimplementing those generators.
- Keep Goal 1's SceneCommand DSL small: node upsert, edge upsert, node removal, focus, and layout.
- Define fixture, manual, and realtime transcript input as interfaces now, but implement only fixture/manual flows in later MVP steps.
- Select `@xyflow/react` as the intended MVP web renderer in ADR 0001, but do not add the dependency until UI implementation starts.
- Keep layout application-owned. The LLM must not generate coordinates or renderer-specific nodes.
- Replace the initial `operation` command shape with `type` plus typed `payload` so Goal 2 fixtures can be routed by command type without executing generated code.
- Enforce transcript display safety at schema boundary and keep a renderer sanitizer contract as defense in depth.

## 2026-06-20 - Deterministic Demo Defaults

- Implement Presenter and Audience as typed page models plus static HTML export first. A browser-rendered component tree can bind to those models later without moving reducer logic into UI components.
- Keep proposal previews in session state as non-published preview scenes; only approved reducer output updates Audience state.
- Treat partial approval as field-level filtering for `update_node` patch commands and subset approval across the proposal queue.
- Track Freeze outside `SceneModel` so the renderer-independent approved scene schema remains focused on published audience state.
- Use deterministic animation intent metadata (`add`, `update`, `highlight`, `remove`, `none`) instead of renderer-specific animation code.
- Let `apps/server` return export strings rather than writing files directly; callers can persist them under `artifacts/` or another approved product path.

## 2026-07-18 - Build Week GPT-5.6 Judge Slice

- Preserve the existing `PlannerBoundary`, reducer, fixture planner, and export
  paths; add GPT-5.6 as one adapter instead of restructuring the repo.
- Default the remote planner to the explicit `gpt-5.6-terra` balanced model and
  Responses API. Use `store: false` and low reasoning effort for this bounded
  structured-planning task.
- Constrain the remote structured-output schema to the smallest visually useful
  subset (`add_node`, `connect_nodes`, `highlight`), then validate it again with
  the broader existing Zod `SceneCommand` contract.
- Select deterministic fixture mode only when the API key is absent/blank. A
  present-key transport or validation failure fails closed rather than silently
  switching provenance or publishing stale output.
- Keep the API key and model transport in the loopback server. Browser state may
  expose only non-secret planner mode/model metadata.
- Use one authored, dependency-free HTML page instead of adding React/Vite or a
  graph library for this slice. This keeps domain logic in the controller and
  scene engine while making the product visible to judges.
- Render all transcript/model values through DOM text sinks. Do not execute or
  inject model-authored HTML, SVG, scripts, coordinates, or renderer code.
- Codex is a development-time contributor, not a runtime dependency. Describe
  GPT-5.6 runtime implementation separately from Codex-assisted engineering.
- Keep microphone, auth, persistence, deployment, complex realtime behavior,
  public publication, and Devpost submission outside this slice.

## 2026-07-19 - English-First Submission Demo

- Make the initial demo English-first so an English-speaking judge can identify
  the work-and-productivity use case and safety boundary in the first viewport.
- Use a four-turn customer-support workflow and ten short English diagram
  proposals as the default judge fixture.
- Preserve the original Japanese transcript, commands, replay artifact, and
  regression tests. Use disjoint IDs so both deterministic scenarios share the
  planner boundary without mixing results.
- Keep Japanese and multilingual capability visible in the English UI. Defer an
  EN/JP toggle because fixed English is the clearest submission default and the
  toggle is not needed to prove multilingual input support.
- Keep deterministic keyless mode as the reproducible judge default. The
  server-only GPT-5.6 adapter remains optional and a paid API run is not a
  submission blocker.

## 2026-07-19 - Runtime Planner Cost Posture

- Keep Codex-assisted engineering history separate from runtime API cost. Codex
  may have used GPT-5.6 Sol during development, but the demo app does not need
  Sol as its default planner.
- Use `gpt-5.6-terra` as the default runtime planner because this slice asks for
  small strict JSON `SceneCommand` proposals, not long-horizon autonomous coding.
- Keep `gpt-5.6-luna` as the documented low-cost override through
  `OPENAI_PLANNER_MODEL`.
