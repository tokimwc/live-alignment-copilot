# Live Alignment Copilot

**Turn messy live meetings into presenter-approved shared structure maps.**

Live Alignment Copilot turns live meeting transcripts into structured diagram
proposals. AI can suggest changes, but only presenter-approved commands are
published to the audience view. The English-first Build Week demo uses a support
workflow that judges can understand immediately, while the product continues to
support Japanese and multilingual transcripts.

When `OPENAI_API_KEY` is available, a server-side Responses API adapter uses
`gpt-5.6-terra` by default. Without a key, the same UI automatically selects the
deterministic fixture planner, so judges and tests can run the complete approval
loop without secrets.

## 30-Second Demo

```powershell
git clone https://github.com/tokimwc/live-alignment-copilot.git
cd live-alignment-copilot
pnpm install
$env:OPENAI_API_KEY=$null
$env:LAC_DEMO_PORT="4185"
pnpm demo
```

Open `http://127.0.0.1:4185`, then:

1. Read the four-line English support-workflow meeting sample.
2. Select **Run planner** and inspect the proposed `SceneCommand` cards and JSON.
3. Select a proposal to compare its preview with the still-empty Audience state.
4. Select **Approve** or **Reject**. Only approval updates Audience.
5. Try **Undo** and **Reset**.

No API key is required. Keyless mode shows
`Deterministic fixture · no API key` in the header and maps the input line IDs
to ten fixed English demo proposals. Editing text is displayed but is not
semantically re-planned until GPT mode is enabled. The original Japanese
deterministic fixture remains covered by the unit and end-to-end suites.

To exercise the GPT-5.6 boundary, set the key only in the server shell:

```powershell
$env:OPENAI_API_KEY="<your key>"
$env:OPENAI_PLANNER_MODEL="gpt-5.6-terra" # optional; this is the default
pnpm demo
```

Use `gpt-5.6-luna` instead when cost and latency matter more than planner
quality.

The key is never included in browser HTML, API state, logs, artifacts, or test
output. The demo server binds to `127.0.0.1` by default.

## What Is Implemented Now

| Surface         | Implemented now                                                                 | Deliberately deferred                    |
| --------------- | ------------------------------------------------------------------------------- | ---------------------------------------- |
| Input           | Editable English judge fixture; Japanese/multilingual transcripts supported     | Microphone and realtime transcription    |
| Planner         | Server-side GPT-5.6 Responses adapter; automatic no-key fixture selection       | Multi-turn streaming and planner retries |
| Output contract | Strict Responses JSON Schema followed by existing Zod `SceneCommand` validation | Arbitrary generated HTML/SVG/code        |
| Review          | Proposal cards, JSON, preview, Approve, Reject, Undo, Reset                     | Auth, multi-presenter collaboration      |
| Audience        | Approved `SceneModel` only                                                      | Public deployment and persistence        |
| Export          | Existing validated `SessionArtifact` and static replay string boundaries        | PPTX/HTML pipeline integration           |

An invalid, incomplete, refused, or non-schema model response fails closed: the
UI shows a safe error, no proposal is enqueued, and the current Audience scene
is unchanged. API transport failures do not silently publish output or replace
the current state.

## Architecture

```text
Browser: live meeting transcript + review controls
  -> loopback server (the browser never receives OPENAI_API_KEY)
  -> createPlannerAdapter
       ├─ key present: GPT-5.6 Terra by default / Responses / strict JSON Schema
       └─ no key: DeterministicFixturePlanner
  -> existing Zod SceneCommand validation
  -> proposal queue + previewScene
  -> Presenter Approve / Reject
  -> approved SceneModel only
  -> Audience preview / SessionArtifact boundary
```

Important boundaries:

- `packages/contracts`: strict Zod schemas and TypeScript contracts for
  `SceneCommand`, `SceneModel`, `PresenterDecision`, `TranscriptChunk`, and
  `SessionArtifact`.
- `packages/planner`: deterministic planner plus the isolated GPT-5.6 Responses
  adapter and no-key selector. The live adapter intentionally supports the
  smallest useful command subset: `add_node`, `connect_nodes`, and `highlight`.
- `packages/scene-engine`: proposal preview, approval/rejection, idempotency,
  freeze, undo/redo, and Presenter/Audience state transitions.
- `apps/server`: loopback HTTP boundary and stateful judge-demo controller.
- `apps/web`: dependency-free one-screen UI plus typed Presenter/Audience page
  models and existing replay exports.

The scene model remains renderer-independent. The browser renders text with DOM
`textContent`; it does not execute or inject model-authored markup, scripts, SVG,
Python, shell, Manim, or renderer code.

## Test and Verification

All automated tests use fixtures, fake `fetch` responses, and loopback-only
HTTP. They never require or call an OpenAI credential and need no microphone.

Environment this was verified on: Linux, Node.js v22.23.4, pnpm 10.10.0 (the
`packageManager` pin). Other Node versions, operating systems, and
performance characteristics have not been verified.

Reproduce on Linux without any API key:

```bash
corepack enable                      # or install pnpm 10.10.0 another way
unset OPENAI_API_KEY                 # not needed by any check below
pnpm install --frozen-lockfile       # fails if pnpm-lock.yaml is out of date
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test        # unit tests: packages/**/*.test.ts
pnpm test:e2e    # controller / HTTP / HTML contract tests: tests/e2e/**/*.test.ts
pnpm build       # tsc -b
```

What `pnpm test:e2e` is and is not: despite the name, it runs Vitest against the
`JudgeDemoController`, the HTTP handler on a loopback ephemeral port, and the
rendered HTML string. It does **not** drive a real browser, so it is not browser
QA (layout, real DOM behavior, the 1280×720 and 390px checks). It also does not
call the real OpenAI API; the GPT-5.6 adapter is exercised only against fake
responses, so real-API behavior is unverified by these checks.

The judge-slice evidence is concentrated in:

- `packages/planner/src/mock-planner.test.ts`: no-key fallback, strict GPT-5.6
  request shape, schema/source rejection, and secret-safe transport errors.
- `packages/planner/src/response-boundary.test.ts`: refusal, incomplete or
  malformed Responses payloads, multiple `output_text` parts, the 20-command
  cap, and thrown-fetch handling, all against fake `fetch`.
- `tests/e2e/http-boundary.test.ts`: malformed JSON, the 32 KiB body cap, the
  80-character `commandId` cap, unknown URLs, and unchanged state after rejected
  requests, over loopback HTTP.
- `tests/e2e/judge-demo.test.ts`: visible UI contract, approval-before-publish,
  reject, undo, reset, unsafe input rejection, and invalid-output fail-closed
  behavior.
- `tests/e2e/deterministic-demo.test.ts`: the richer reducer/export fixture path.
- `docs/verification.md`: exact final gate and live loopback smoke results.

## Codex and GPT-5.6 Story

Core implementation was built with Codex using GPT-5.6 Sol. Codex acted as the
development-time engineering agent that inspected the existing contracts,
added the narrow planner/server/UI slice, wrote safety tests, updated the
submission narrative, and ran the verification gate. Codex is not embedded in
the shipped runtime.

GPT-5.6 is the optional runtime planner. The default model is the explicit
`gpt-5.6-terra` balanced identifier, called only from the server through the
Responses API with `store: false`, low reasoning effort, and a strict JSON
Schema. `gpt-5.6-luna` can be selected through `OPENAI_PLANNER_MODEL` for a more
cost-efficient demo run. Application-side Zod validation remains mandatory even
after structured output, and Presenter approval remains mandatory after
validation.

## Safety Boundaries

- Transcript text and current scene labels are untrusted data, never model
  instructions.
- Only the defined `SceneCommand` DSL crosses the planner boundary.
- Every remote command is checked against both the declared structured-output
  shape and the existing Zod schema.
- Every cited `sourceSegmentId` must exist in the submitted transcript chunks.
- Candidate output never updates Audience directly.
- Tests run without keys, microphone access, deployment, or persistence.
- Raw audio is not captured or persisted.
- Generated artifacts, logs, and local credentials stay out of tracked files.

## Submission Status

Implemented code, automated checks, and the local/keyless judge path are ready.
Browser QA at 1280×720 and 390px wide is recorded in
`docs/verification.md`. A live GPT-5.6 API trace is optional additional evidence,
not a requirement for judging. A public GitHub repository is available for
judging. Remaining human-controlled submission work is capturing/uploading the
demo video, finalizing project copy/assets, and submitting the Devpost entry.
