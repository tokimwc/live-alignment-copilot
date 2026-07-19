import {
  sessionArtifactSchema,
  type SceneCommand,
  type SceneModel,
  type SessionArtifact,
} from "@lac/contracts";
import type { DemoSessionState, ProposalStatus } from "@lac/scene-engine";
import { getSceneHash } from "@lac/scene-engine";

export { renderJudgeDemoPage } from "./judge-demo.js";

export function getAudienceRevision(scene: SceneModel): number {
  return scene.revision;
}

export interface PageSceneNode {
  readonly id: string;
  readonly label: string;
  readonly kind: string;
  readonly highlighted: boolean;
  readonly frozen: boolean;
}

export interface PageSceneEdge {
  readonly id: string;
  readonly label: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly kind: string;
}

export interface PageScene {
  readonly revision: number;
  readonly nodes: readonly PageSceneNode[];
  readonly edges: readonly PageSceneEdge[];
}

export interface PresenterProposalView {
  readonly commandId: string;
  readonly type: string;
  readonly status: ProposalStatus;
  readonly rationale: string;
  readonly confidence: number;
  readonly command: SceneCommand;
  readonly previewScene: PageScene;
  readonly preview: {
    readonly nodeCount: number;
    readonly edgeCount: number;
    readonly changedElementIds: readonly string[];
  };
  readonly animation: string;
}

export interface PresenterPageView {
  readonly page: "presenter";
  readonly sceneHash: string;
  readonly scene: PageScene;
  readonly proposalQueue: readonly PresenterProposalView[];
  readonly frozenElementIds: readonly string[];
  readonly decisionsCount: number;
}

export interface AudiencePageView {
  readonly page: "audience";
  readonly sceneHash: string;
  readonly scene: PageScene;
}

export function renderPresenterPage(session: DemoSessionState): PresenterPageView {
  return {
    page: "presenter",
    sceneHash: getSceneHash(session.presenterScene),
    scene: mapScene(session.presenterScene, session.frozenElementIds),
    proposalQueue: session.proposals.map((proposal) => ({
      commandId: proposal.command.commandId,
      type: proposal.command.type,
      status: proposal.status,
      rationale: proposal.command.rationale,
      confidence: proposal.command.confidence,
      command: proposal.command,
      previewScene: mapScene(proposal.previewScene, session.frozenElementIds),
      preview: proposal.preview,
      animation: proposal.animation.kind,
    })),
    frozenElementIds: session.frozenElementIds,
    decisionsCount: session.presenterDecisions.length,
  };
}

export function renderAudiencePage(session: DemoSessionState): AudiencePageView {
  return {
    page: "audience",
    sceneHash: getSceneHash(session.audienceScene),
    scene: mapScene(session.audienceScene, session.frozenElementIds),
  };
}

export function createSessionArtifact(session: DemoSessionState): SessionArtifact {
  return sessionArtifactSchema.parse({
    kind: "session.artifact",
    version: 1,
    sessionId: session.sessionId,
    createdAt: session.startedAt,
    transcriptChunks: session.transcriptChunks,
    candidateCommands: session.candidateCommands,
    presenterDecisions: session.presenterDecisions,
    approvedScene: session.audienceScene,
  });
}

export function exportSessionArtifactJson(session: DemoSessionState): string {
  return `${JSON.stringify(createSessionArtifact(session), null, 2)}\n`;
}

export function exportStaticReplayHtml(session: DemoSessionState): string {
  const audience = renderAudiencePage(session);
  const nodes = audience.scene.nodes
    .map(
      (node) =>
        `<li data-node-id="${escapeHtml(node.id)}" class="${node.highlighted ? "highlighted" : ""}"><strong>${escapeHtml(node.label)}</strong><span>${escapeHtml(node.kind)}</span></li>`,
    )
    .join("");
  const edges = audience.scene.edges
    .map(
      (edge) =>
        `<li data-edge-id="${escapeHtml(edge.id)}">${escapeHtml(edge.fromNodeId)} -> ${escapeHtml(edge.toNodeId)}: ${escapeHtml(edge.label)}</li>`,
    )
    .join("");
  const artifactJson = escapeHtml(exportSessionArtifactJson(session));

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>Live Alignment Copilot Replay</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 32px; background: #f7f7f4; color: #202124; }
    main { max-width: 920px; margin: 0 auto; }
    h1 { font-size: 28px; margin: 0 0 16px; }
    section { margin: 24px 0; }
    ul { display: grid; gap: 10px; padding: 0; list-style: none; }
    li { border: 1px solid #c9c6bd; border-radius: 8px; padding: 12px; background: #fff; }
    li span { display: block; color: #5f6368; font-size: 13px; margin-top: 4px; }
    .highlighted { border-color: #d14; box-shadow: inset 4px 0 0 #d14; }
    pre { white-space: pre-wrap; border: 1px solid #c9c6bd; border-radius: 8px; padding: 12px; background: #fff; }
  </style>
</head>
<body>
  <main>
    <h1>Live Alignment Copilot Replay</h1>
    <p>Revision ${audience.scene.revision} / Scene hash ${escapeHtml(audience.sceneHash)}</p>
    <section aria-label="Nodes"><h2>Nodes</h2><ul>${nodes}</ul></section>
    <section aria-label="Edges"><h2>Edges</h2><ul>${edges}</ul></section>
    <section aria-label="Artifact"><h2>session-artifact.json</h2><pre>${artifactJson}</pre></section>
  </main>
</body>
</html>
`;
}

function mapScene(scene: SceneModel, frozenElementIds: readonly string[]): PageScene {
  return {
    revision: scene.revision,
    nodes: scene.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      kind: node.kind,
      highlighted: scene.highlightTargetIds.includes(node.id),
      frozen: frozenElementIds.includes(node.id),
    })),
    edges: scene.edges.map((edge) => ({
      id: edge.id,
      label: edge.label ?? "",
      fromNodeId: edge.fromNodeId,
      toNodeId: edge.toNodeId,
      kind: edge.kind,
    })),
  };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
