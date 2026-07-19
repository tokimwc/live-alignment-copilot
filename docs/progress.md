# Progress

Record each implementation loop, failed verification, cause, change, and next minimal fix here.

## 2026-06-20 - Goal 1 Implementation Loop

- Replaced placeholder root scripts with Prettier, ESLint, TypeScript build, Vitest unit tests, Vitest e2e tests, and build commands.
- Added package boundaries for contracts, test fixtures, planner, scene-engine, server, and web.
- Added strict Zod schemas for the MVP contract surface.
- Added fixtures for valid SceneCommand JSON and invalid non-DSL external responses.
- Added unit and e2e tests proving unsafe external responses are rejected before any Presenter/Audience flow.
- Initialized the project as a Git repository without committing.

## 2026-06-20 - Goal Audit Interface Pass

- Failed verification: not run yet in this pass.
- Cause: audit found the foundation satisfied schemas and tests, but adapter and boundary interfaces were thinner than the explicit Goal text.
- Change: added fixture/manual/realtime transcript adapter interfaces plus Planner, Renderer, Transcription, and Export boundary interfaces to `packages/contracts`.
- Change: updated server runtime boundary composition type, planner adapter type, requirements, architecture, acceptance criteria, decisions, and renderer ADR.
- Next minimal fix: run format, lint, typecheck, unit tests, and build; record any failures here before patching.

## 2026-06-20 - Goal Audit Verification Loop 1

- Failed verification: `pnpm format:check`.
- Cause: Markdown tables in `docs/acceptance-criteria.md` and `docs/adr/0001-renderer-selection.md` needed Prettier normalization.
- Change: run Prettier on the two failing docs only.
- Next minimal fix: rerun `pnpm format:check`, then continue to lint/typecheck/test/build.

## 2026-06-20 - Goal Audit Verification Loop 2

- Failed verification: none.
- Cause: after Markdown normalization, the code and docs satisfied the configured checks.
- Change: no code change required during this loop.
- Result: `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm test:e2e` passed.
- Next minimal fix: none for this Goal.

## 2026-06-20 - DSL Contract Correction Loop 1

- Failed verification: `pnpm typecheck`.
- Cause: new `SceneCommand` tests used a readonly `sourceSegmentIds` literal and accessed `payload.node` before discriminated-union narrowing.
- Change: make the test envelope keep mutable arrays while preserving literal envelope fields, and narrow on `type` before reading add-node payload.
- Next minimal fix: rerun `pnpm typecheck`, then continue with docs and full verification.

## 2026-06-20 - DSL Contract Correction Loop 2

- Failed verification: `pnpm format:check`.
- Cause: the new acceptance-criteria table rows needed Prettier normalization.
- Change: run Prettier on `docs/acceptance-criteria.md`.
- Next minimal fix: rerun `pnpm format:check`, then continue through lint, typecheck, unit tests, e2e, and build.

## 2026-06-20 - DSL Contract Correction Loop 3

- Failed verification: `pnpm test`.
- Cause: fixture tests still expected the old two-command fixture count after expanding the Goal 2 fixture sequence to five commands.
- Change: assert against `validSceneCommandFixtures.length` instead of the old literal count.
- Next minimal fix: rerun unit tests, then continue to e2e and build.

## 2026-06-20 - DSL Contract Correction Loop 4

- Failed verification: none.
- Cause: after the fixture expectation update, the DSL contract, fixtures, and tests matched.
- Change: no code change required in this loop.
- Result: `pnpm test`, `pnpm test:e2e`, and `pnpm build` passed.
- Next minimal fix: record verification results, then rerun the full required command set after documentation updates.

## 2026-06-20 - DSL Contract Correction Loop 5

- Failed verification: none.
- Cause: documentation updates did not introduce formatting, lint, type, test, or build regressions.
- Change: no code change required in this loop.
- Result: final `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, and `pnpm build` passed.
- Next minimal fix: none for this Goal.

## 2026-06-20 - Deterministic Fixture Demo Loop 1

- Failed verification: `pnpm test`.
- Cause: new reducer, planner, and E2E tests were added before implementation; `createDemoSession` and deterministic planner exports did not exist yet.
- Change: implemented `packages/scene-engine` demo session reducer with proposal previews, approval/rejection, partial update approval, label edits, Freeze/Unfreeze, Undo/Redo, idempotency tracking, and scene hashing.
- Change: expanded fixed Japanese fixtures to cover As-Is, issue, AI insertion, and To-Be.
- Change: implemented `DeterministicFixturePlanner`, Presenter/Audience page models, `session-artifact.json` export, static replay HTML export, and server demo composition.
- Next minimal fix: run unit and E2E tests, then typecheck/lint/build.

## 2026-06-20 - Deterministic Fixture Demo Loop 2

- Failed verification: `pnpm test`.
- Cause: the new mock planner test expected only one command for the first fixture chunk, but the As-Is chunk intentionally emits three ordered proposals.
- Change: corrected the test to assert the three As-Is command IDs.
- Result: `pnpm test` passed; 4 test files, 24 tests.
- Next minimal fix: run E2E.

## 2026-06-20 - Deterministic Fixture Demo Loop 3

- Failed verification: `pnpm test:e2e`.
- Cause: optional chaining in `tests/e2e/deterministic-demo.test.ts` was outside the `expect(...)` expression.
- Change: fixed the expression grouping.
- Result: `pnpm test:e2e` passed; 2 test files, 3 tests.
- Next minimal fix: run lint/typecheck/build and final full verification.

## 2026-06-20 - Deterministic Fixture Demo Loop 4

- Failed verification: `pnpm typecheck`.
- Cause: new workspace dependencies were added but `node_modules` symlinks/lock metadata had not been refreshed.
- Change: ran `pnpm install`; no external packages were downloaded.
- Result: `pnpm typecheck` passed after workspace metadata refresh; `pnpm lint` passed.
- Next minimal fix: update docs and run the full required command set.

## 2026-07-18 - GPT-5.6 Judge Slice Loop 1

- Baseline: `pnpm test` passed with 4 files and 24 tests before the new slice.
- Change: added the server-side `Gpt56ResponsesPlanner`, strict Responses JSON
  Schema, second-pass Zod/source validation, safe error classes, and automatic
  no-key deterministic planner selection.
- Change: added a loopback judge-demo controller/server and a one-screen authored
  UI with conversation, proposal JSON/cards, preview, approved Audience state,
  Run planner, Approve, Reject, Undo, and Reset.
- Change: added planner boundary tests and judge-slice e2e tests for fallback,
  strict request shape, invalid output, source IDs, approval gating, unsafe input,
  undo, reset, and safe UI sinks.
- Interim result: `pnpm test` passed with 4 files and 29 tests;
  `pnpm typecheck` passed; `pnpm test:e2e` passed with 3 files and 6 tests before
  the final UI-contract assertion was added.
- Next minimal fix: smoke the live keyless server, align docs, then run the full
  required gate.

## 2026-07-18 - GPT-5.6 Judge Slice Loop 2

- Failed verification: the first sandboxed `pnpm demo` attempt failed with an
  `EPERM` while `tsx` resolved the user-profile path.
- Cause: the runtime needed the approved non-sandboxed Node path on this Windows
  host; this was an execution-environment restriction, not an application error.
- Change: reran the same keyless command with the scoped approval and performed
  HTTP smoke checks against `127.0.0.1:4173`.
- Result: GET `/` returned 200; Run planner returned fixture mode, 10 proposals,
  0 Audience nodes, and no error. Approve produced 1 Audience node, Reject set the
  second proposal to rejected, Undo restored 0 nodes, and Reset cleared proposals.
- Next minimal fix: run formatting, lint, typecheck, unit, e2e, and build after
  all documentation changes.

## 2026-07-18 - GPT-5.6 Judge Slice Loop 3

- Failed verification: the first formatting check found eight changed files;
  no lint, type, test, e2e, or build failure followed.
- Change: ran Prettier only on the reported files, then aligned README and all
  required project documents with the implemented/future boundary.
- Result: format, lint, typecheck, 29 unit tests, 7 e2e tests, and production
  build passed. Exact commands and smoke evidence are in
  `docs/verification.md`.
- Next minimal fix: obtain human-authorized live GPT-5.6 and visual/video
  evidence before Devpost publication; do not mark those external steps done.

## 2026-07-19 - English-First Judge Demo

- Change: replaced the initial mixed-language UI with an English-first product
  headline, safety explanation, empty states, panel labels, and explicit
  `AI proposal -> Validated command -> Presenter approval -> Published audience
map` flow.
- Change: added a four-turn English customer-support fixture and ten English
  commands with disjoint IDs. The original Japanese fixture, replay artifact,
  and regression path remain unchanged.
- Change: tightened the desktop layout for a complete 1280×720 recording frame
  and added mobile wrapping, one-column nodes, and overflow-safe metadata.
- Browser result: keyless Run planner produced 10 proposals; Approve published
  one node; Reject left that one-node Audience map unchanged; Undo returned it
  to zero nodes; Reset restored the English default and zero proposals.
- Browser result: no horizontal overflow at 1280×720 or a 390×844 viewport,
  including after Run planner; browser console warnings/errors were empty.
- Final result: format, lint, typecheck, 31 unit tests, 7 e2e tests, and build
  passed without an API key.
- Next minimal fix: record the short demo video and screenshots, finish Devpost
  copy/assets, then review and publish the repository manually.

## 2026-07-19 - Public Repository Sanitization

- Failed verification: public-facing README/docs still contained host-specific
  absolute paths and personal workspace names.
- Cause: local handoff commands and private workspace boundaries were copied
  into submission-facing documentation.
- Change: replaced local absolute paths with clone-relative setup instructions,
  generalized private-system boundaries, and updated repository/submission
  status to match the public repo state.
- Next minimal fix: rerun local-path and secret-pattern scans, then rerun the
  full verification gate before rewriting the public root commit.

## 2026-07-19 - Runtime Planner Model Cost Update

- Change: switched the optional GPT-5.6 runtime planner default from Sol to
  Terra, keeping Luna as the documented low-cost override through
  `OPENAI_PLANNER_MODEL`.
- Change: updated the server-side planner label so Terra, Luna, and explicit Sol
  overrides are displayed accurately instead of hard-coding Sol.
- Result: format, lint, typecheck, 31 unit tests, 7 e2e tests, and build passed.
- Next minimal fix: push the cost-posture update before final Devpost assets are
  prepared.
