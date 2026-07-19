# Build Week Submission

## Devpost Summary

Live Alignment Copilot turns messy live meetings into presenter-approved shared
structure maps. The English-first judge sample shows a support team moving from
manual FAQ lookup and slow responses to an AI-assisted, human-reviewed target
workflow. A judge can run the planner, inspect strict `SceneCommand` JSON and a
visual preview, then Approve, Reject, Undo, or Reset. Only approved state reaches
the Audience panel. Japanese and multilingual transcripts remain supported.

The submission has two planner lanes behind the same typed boundary:

- With `OPENAI_API_KEY`, the loopback server calls `gpt-5.6-terra` by default
  through the Responses API using strict structured output, then validates every
  command again with the existing Zod schema.
- Without a key, the same UI automatically uses the deterministic English judge
  fixture. The original Japanese fixture path remains tested, while the judge
  path stays reproducible and secret-free.

Core implementation was built with Codex using GPT-5.6 Sol. Codex was the
development-time engineering agent for this vertical slice; it is not embedded
in the runtime.

## Judge Demo

```powershell
git clone https://github.com/tokimwc/live-alignment-copilot.git
cd live-alignment-copilot
pnpm install
$env:OPENAI_API_KEY=$null
$env:LAC_DEMO_PORT="4185"
pnpm demo
```

Open `http://127.0.0.1:4185`.

1. The left panel contains an editable four-line English support-workflow
   transcript.
2. **Run planner** fills the middle panel with validated command cards and JSON.
3. Selecting a card shows its proposal preview on the right; Audience remains
   unchanged.
4. **Approve** publishes only that reducer result to Audience. **Reject** records
   a decision without publishing.
5. **Undo** reverses the last approved scene change; **Reset** restores the
   keyless starting state.

The mode badge makes the active path explicit, such as
`GPT-5.6 Terra · server-side`, `GPT-5.6 Luna · server-side`, or
`Deterministic fixture · no API key`.

Keyless mode is intentionally a repeatable English fixture mapping: line IDs
select ten fixed proposals, while free-text semantic interpretation is the
optional GPT-5.6 lane.

For a human-authorized GPT run:

```powershell
$env:OPENAI_API_KEY="<your key>"
$env:OPENAI_PLANNER_MODEL="gpt-5.6-terra" # optional default; use gpt-5.6-luna to spend less
pnpm demo
```

## Implemented Now vs Future Work

| Implemented now                                   | Future work                                     |
| ------------------------------------------------- | ----------------------------------------------- |
| One-screen, dependency-free browser UI            | Microphone/realtime input                       |
| Editable English judge sample; multilingual input | Authentication and multi-user sessions          |
| Server-only GPT-5.6 Responses adapter             | Persistence and hosted deployment               |
| Automatic no-key deterministic planner selection  | Streaming/complex realtime updates              |
| Strict JSON Schema plus Zod validation            | Full graph-layout renderer and animation polish |
| Proposal JSON/cards and preview scene             | Existing PPTX/HTML pipeline adapter             |
| Approve, Reject, Undo, Reset                      | Video upload and Devpost submission             |
| Approved Audience state only                      | Production monitoring and cost controls         |

## GPT-5.6 Planner Boundary

```text
Meeting TranscriptChunk[] + current SceneModel
  -> server-side gpt-5.6-terra Responses call by default (store: false)
  -> strict JSON Schema: add_node | connect_nodes | highlight
  -> parse response text
  -> exact shape + existing Zod SceneCommand validation
  -> verify every sourceSegmentId belongs to the input
  -> Presenter proposal queue
  -> explicit approval
  -> Audience SceneModel
```

Failure path:

```text
timeout / HTTP error / refusal / invalid JSON / schema mismatch / unknown source
  -> safe presenter-facing error
  -> enqueue nothing
  -> current Audience scene remains unchanged
```

No response body, raw model output, API key, or authorization header is included
in UI state, error messages, logs, artifacts, or test output.

## Why the Slice Is Compelling

- The model is not a decorative chat box; it occupies one narrow, testable
  `PlannerBoundary` between conversation data and an existing typed DSL.
- Structured output is not treated as the only safety layer. Application-side
  validation and human approval are separate gates.
- The judge sees the safety property directly: proposal preview and approved
  Audience state are visible at the same time.
- The keyless fallback makes the complete interaction reliable during judging,
  while the server boundary shows the concrete GPT-5.6 request path.
- The existing deterministic reducer/export suite remains intact.

## Codex Contribution

Core implementation was built with Codex using GPT-5.6 Sol. Codex was used to:

- map the existing `SceneCommand`, `SessionArtifact`, planner, reducer, and
  Presenter/Audience boundaries;
- implement the narrow GPT-5.6 adapter and no-key selector without moving
  domain logic into the browser;
- create the loopback controller and judge-friendly UI;
- add fake-transport, schema rejection, source validation, approval, undo, and
  fail-closed tests;
- preserve the deterministic fixture/export path; and
- update documentation and execute the full repository gate.

The app does not call Codex at runtime.

## Safety and Scope

- No model-authored JavaScript, Python, HTML, SVG, shell, Manim, coordinates, or
  renderer code is requested or executed.
- Browser rendering uses authored UI code and `textContent` for all user/model
  values.
- `OPENAI_API_KEY` is read only by the local server process.
- The HTTP server binds to loopback by default and has no deployment/auth layer.
- Tests use fixtures and fake fetch responses only; they never need a real key.
- No microphone, raw-audio persistence, auth, database, or deployment was added.
- Adjacent private automation systems and personal note vaults were not
  modified.

## Verification Gate

```powershell
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Exact final counts and the keyless live-server smoke evidence are recorded in
`docs/verification.md`.

## Remaining Devpost Blockers

1. Capture/upload the short demo video and capture the final public URL.
2. Finalize the Devpost copy, thumbnail, privacy disclosures, and judging notes.
3. Submit the Devpost entry after final human review.

A human-authorized live GPT-5.6 trace can be added as optional evidence, but it
is not a blocker for the deterministic keyless judging path.

The repository has been published for judging; video upload and Devpost
submission remain human-controlled external actions.
