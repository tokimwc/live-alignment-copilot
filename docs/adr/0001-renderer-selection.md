# ADR 0001: Renderer Selection

Status: Accepted for MVP foundation

## Context

The product needs a Presenter canvas and Audience view for structured conversation diagrams. The renderer must consume approved `SceneModel` state and must not consume or execute raw LLM output.

The LLM is not allowed to generate coordinates, SVG, HTML, JavaScript, Python, Manim, or renderer-specific code. Layout is application-owned.

## Options Considered

| Option              | Strengths                                                                                                      | Weaknesses                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Custom SVG renderer | Deterministic, easy to snapshot, no large graph dependency.                                                    | Interaction, selection, pan/zoom, and editing controls would be hand-built.                             |
| `@xyflow/react`     | Mature node-edge canvas, presenter interaction model, controlled state, testable with deterministic positions. | Adds React renderer dependency and requires app-owned layout to avoid model-generated coordinates.      |
| Excalidraw          | Familiar whiteboard feel and export support.                                                                   | Document model is not the product domain model; harder to enforce SceneCommand-only structural changes. |

## Decision

Use `@xyflow/react` as the intended MVP web renderer for Presenter and Audience views, but keep it outside Goal foundation dependencies until UI implementation begins.

The renderer will receive app-owned `SceneModel` plus app-computed layout. The LLM will never produce `@xyflow/react` nodes, coordinates, SVG, HTML, or code. Renderer-specific mapping belongs in `apps/web`, not `packages/contracts` or `packages/scene-engine`.

## Consequences

- `SceneModel` remains renderer-independent.
- `packages/scene-engine` can be tested without DOM or React.
- Presenter UI can later use `@xyflow/react` controls for pan, zoom, selection, and preview.
- Audience view can reuse the approved scene projection while staying isolated from unapproved candidate commands.
- Export to existing PPTX/HTML generation remains a `SessionArtifact` adapter concern, not a renderer concern.

## Rejected for MVP

- Manim runtime: not needed for live MVP and conflicts with the no-generated-code boundary.
- Excalidraw as the core renderer: too document-oriented for the SceneCommand contract.
- LLM-generated SVG/HTML: explicitly disallowed.
