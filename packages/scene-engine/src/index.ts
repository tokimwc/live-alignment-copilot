import {
  sceneCommandSchema,
  sceneModelSchema,
  type PresenterDecision,
  type SceneCommand,
  type SceneModel,
  type SceneNode,
  type TranscriptChunk,
} from "@lac/contracts";

export function createEmptySceneModel(updatedAt: string): SceneModel {
  return {
    kind: "scene.model",
    version: 1,
    revision: 0,
    updatedAt,
    layout: "force",
    nodes: [],
    edges: [],
    groups: [],
    annotations: [],
    highlightTargetIds: [],
    focusNodeIds: [],
    approvedCommandIds: [],
  };
}

export type ProposalStatus = "pending" | "approved" | "partially_approved" | "rejected";

export interface SceneAnimation {
  readonly kind: "add" | "update" | "highlight" | "remove" | "none";
  readonly elementIds: readonly string[];
}

export interface ProposalPreview {
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly changedElementIds: readonly string[];
}

export interface DemoProposal {
  readonly command: SceneCommand;
  readonly status: ProposalStatus;
  readonly previewScene: SceneModel;
  readonly preview: ProposalPreview;
  readonly animation: SceneAnimation;
}

interface HistoryFrame {
  readonly scene: SceneModel;
  readonly appliedIdempotencyKeys: readonly string[];
}

export interface DemoSessionState {
  readonly sessionId: string;
  readonly startedAt: string;
  readonly transcriptChunks: readonly TranscriptChunk[];
  readonly presenterScene: SceneModel;
  readonly audienceScene: SceneModel;
  readonly proposals: readonly DemoProposal[];
  readonly candidateCommands: readonly SceneCommand[];
  readonly presenterDecisions: readonly PresenterDecision[];
  readonly frozenElementIds: readonly string[];
  readonly appliedIdempotencyKeys: readonly string[];
  readonly undoStack: readonly HistoryFrame[];
  readonly redoStack: readonly HistoryFrame[];
}

export interface CreateDemoSessionInput {
  readonly sessionId: string;
  readonly startedAt: string;
  readonly transcriptChunks?: readonly TranscriptChunk[];
}

export interface ProposalDecisionInput {
  readonly decidedAt: string;
  readonly reason?: string;
  readonly labelEdits?: Readonly<Record<string, string>>;
  readonly allowedPatchFields?: readonly (keyof SceneNode)[];
}

interface ApplyCommandOptions {
  readonly frozenElementIds: readonly string[];
  readonly appliedIdempotencyKeys: readonly string[];
  readonly labelEdits?: Readonly<Record<string, string>>;
  readonly allowedPatchFields?: readonly (keyof SceneNode)[];
}

interface ApplyCommandResult {
  readonly scene: SceneModel;
  readonly changed: boolean;
  readonly animation: SceneAnimation;
}

export function createDemoSession(input: CreateDemoSessionInput): DemoSessionState {
  const scene = createEmptySceneModel(input.startedAt);
  return {
    sessionId: input.sessionId,
    startedAt: input.startedAt,
    transcriptChunks: input.transcriptChunks ?? [],
    presenterScene: scene,
    audienceScene: scene,
    proposals: [],
    candidateCommands: [],
    presenterDecisions: [],
    frozenElementIds: [],
    appliedIdempotencyKeys: [],
    undoStack: [],
    redoStack: [],
  };
}

export function enqueuePlannerCommands(
  session: DemoSessionState,
  commands: readonly SceneCommand[],
): DemoSessionState {
  const validatedCommands = commands.map((command) => sceneCommandSchema.parse(command));
  const newProposals = validatedCommands.map((command) => createProposal(session, command));
  return {
    ...session,
    candidateCommands: [...session.candidateCommands, ...validatedCommands],
    proposals: [...session.proposals, ...newProposals],
  };
}

export function approveProposal(
  session: DemoSessionState,
  commandId: string,
  input: ProposalDecisionInput,
): DemoSessionState {
  const proposal = findProposal(session, commandId);
  if (proposal.status !== "pending") {
    return session;
  }

  const partial = Boolean(input.allowedPatchFields && input.allowedPatchFields.length > 0);
  const decision: PresenterDecision = {
    kind: "presenter.decision",
    version: 1,
    decisionId: `decision-${commandId}`,
    commandId,
    decidedAt: input.decidedAt,
    decision: "approve",
    reason: input.reason ?? (partial ? "Partially approved by Presenter" : undefined),
  };

  if (session.appliedIdempotencyKeys.includes(proposal.command.idempotencyKey)) {
    return updateProposalStatus(
      {
        ...session,
        presenterDecisions: [...session.presenterDecisions, decision],
      },
      commandId,
      partial ? "partially_approved" : "approved",
    );
  }

  const result = applyCommandToScene(session.presenterScene, proposal.command, {
    frozenElementIds: session.frozenElementIds,
    appliedIdempotencyKeys: session.appliedIdempotencyKeys,
    labelEdits: input.labelEdits,
    allowedPatchFields: input.allowedPatchFields,
  });

  const nextAppliedKeys = result.changed
    ? [...session.appliedIdempotencyKeys, proposal.command.idempotencyKey]
    : session.appliedIdempotencyKeys;
  const nextSession = updateProposalStatus(
    {
      ...session,
      presenterScene: result.scene,
      audienceScene: result.scene,
      presenterDecisions: [...session.presenterDecisions, decision],
      appliedIdempotencyKeys: nextAppliedKeys,
      undoStack: result.changed
        ? [
            ...session.undoStack,
            {
              scene: session.presenterScene,
              appliedIdempotencyKeys: session.appliedIdempotencyKeys,
            },
          ]
        : session.undoStack,
      redoStack: result.changed ? [] : session.redoStack,
    },
    commandId,
    partial ? "partially_approved" : "approved",
  );

  return nextSession;
}

export function rejectProposal(
  session: DemoSessionState,
  commandId: string,
  input: Pick<ProposalDecisionInput, "decidedAt" | "reason">,
): DemoSessionState {
  const proposal = findProposal(session, commandId);
  if (proposal.status !== "pending") {
    return session;
  }

  const decision: PresenterDecision = {
    kind: "presenter.decision",
    version: 1,
    decisionId: `decision-${commandId}`,
    commandId,
    decidedAt: input.decidedAt,
    decision: "reject",
    reason: input.reason,
  };

  return updateProposalStatus(
    {
      ...session,
      presenterDecisions: [...session.presenterDecisions, decision],
    },
    commandId,
    "rejected",
  );
}

export function freezeElement(session: DemoSessionState, elementId: string): DemoSessionState {
  if (session.frozenElementIds.includes(elementId)) {
    return session;
  }
  return {
    ...session,
    frozenElementIds: [...session.frozenElementIds, elementId],
  };
}

export function unfreezeElement(session: DemoSessionState, elementId: string): DemoSessionState {
  return {
    ...session,
    frozenElementIds: session.frozenElementIds.filter((id) => id !== elementId),
  };
}

export function undoScene(session: DemoSessionState): DemoSessionState {
  const previous = session.undoStack.at(-1);
  if (!previous) {
    return session;
  }
  return {
    ...session,
    presenterScene: previous.scene,
    audienceScene: previous.scene,
    appliedIdempotencyKeys: previous.appliedIdempotencyKeys,
    undoStack: session.undoStack.slice(0, -1),
    redoStack: [
      ...session.redoStack,
      {
        scene: session.presenterScene,
        appliedIdempotencyKeys: session.appliedIdempotencyKeys,
      },
    ],
  };
}

export function redoScene(session: DemoSessionState): DemoSessionState {
  const next = session.redoStack.at(-1);
  if (!next) {
    return session;
  }
  return {
    ...session,
    presenterScene: next.scene,
    audienceScene: next.scene,
    appliedIdempotencyKeys: next.appliedIdempotencyKeys,
    redoStack: session.redoStack.slice(0, -1),
    undoStack: [
      ...session.undoStack,
      {
        scene: session.presenterScene,
        appliedIdempotencyKeys: session.appliedIdempotencyKeys,
      },
    ],
  };
}

export function getSceneHash(scene: SceneModel): string {
  return JSON.stringify(normalizeScene(scene));
}

function createProposal(session: DemoSessionState, command: SceneCommand): DemoProposal {
  const result = applyCommandToScene(session.presenterScene, command, {
    frozenElementIds: session.frozenElementIds,
    appliedIdempotencyKeys: session.appliedIdempotencyKeys,
  });
  return {
    command,
    status: "pending",
    previewScene: result.scene,
    preview: {
      nodeCount: result.scene.nodes.length,
      edgeCount: result.scene.edges.length,
      changedElementIds: result.animation.elementIds,
    },
    animation: result.animation,
  };
}

function findProposal(session: DemoSessionState, commandId: string): DemoProposal {
  const proposal = session.proposals.find((item) => item.command.commandId === commandId);
  if (!proposal) {
    throw new Error(`Proposal not found: ${commandId}`);
  }
  return proposal;
}

function updateProposalStatus(
  session: DemoSessionState,
  commandId: string,
  status: ProposalStatus,
): DemoSessionState {
  return {
    ...session,
    proposals: session.proposals.map((proposal) =>
      proposal.command.commandId === commandId ? { ...proposal, status } : proposal,
    ),
  };
}

function applyCommandToScene(
  scene: SceneModel,
  command: SceneCommand,
  options: ApplyCommandOptions,
): ApplyCommandResult {
  if (options.appliedIdempotencyKeys.includes(command.idempotencyKey)) {
    return unchanged(scene);
  }

  switch (command.type) {
    case "add_node": {
      const node = applyNodeLabelEdit(command.payload.node, options.labelEdits);
      if (scene.nodes.some((existing) => existing.id === node.id)) {
        return unchanged(scene);
      }
      return changed(scene, command, { nodes: [...scene.nodes, node] }, "add", [node.id]);
    }
    case "update_node": {
      if (options.frozenElementIds.includes(command.payload.nodeId)) {
        return unchanged(scene);
      }
      const patch = filterNodePatch(command.payload.patch, options.allowedPatchFields);
      const changedNodeIds: string[] = [];
      const nodes = scene.nodes.map((node) => {
        if (node.id !== command.payload.nodeId) {
          return node;
        }
        changedNodeIds.push(node.id);
        return { ...node, ...patch };
      });
      return changedNodeIds.length > 0
        ? changed(scene, command, { nodes }, "update", changedNodeIds)
        : unchanged(scene);
    }
    case "connect_nodes": {
      const edge = applyEdgeLabelEdit(command.payload.edge, options.labelEdits);
      if (
        scene.edges.some((existing) => existing.id === edge.id) ||
        !scene.nodes.some((node) => node.id === edge.fromNodeId) ||
        !scene.nodes.some((node) => node.id === edge.toNodeId)
      ) {
        return unchanged(scene);
      }
      return changed(scene, command, { edges: [...scene.edges, edge] }, "add", [edge.id]);
    }
    case "disconnect_nodes": {
      if (options.frozenElementIds.includes(command.payload.edgeId)) {
        return unchanged(scene);
      }
      const edges = scene.edges.filter((edge) => edge.id !== command.payload.edgeId);
      return edges.length === scene.edges.length
        ? unchanged(scene)
        : changed(scene, command, { edges }, "remove", [command.payload.edgeId]);
    }
    case "create_group": {
      const group = command.payload.group;
      if (
        scene.groups.some((existing) => existing.id === group.id) ||
        group.nodeIds.some((nodeId) => !scene.nodes.some((node) => node.id === nodeId))
      ) {
        return unchanged(scene);
      }
      return changed(scene, command, { groups: [...scene.groups, group] }, "add", [group.id]);
    }
    case "update_group": {
      if (options.frozenElementIds.includes(command.payload.groupId)) {
        return unchanged(scene);
      }
      const changedGroupIds: string[] = [];
      const groups = scene.groups.map((group) => {
        if (group.id !== command.payload.groupId) {
          return group;
        }
        changedGroupIds.push(group.id);
        return { ...group, ...command.payload.patch };
      });
      return changedGroupIds.length > 0
        ? changed(scene, command, { groups }, "update", changedGroupIds)
        : unchanged(scene);
    }
    case "set_layout":
      return scene.layout === command.payload.layout
        ? unchanged(scene)
        : changed(scene, command, { layout: command.payload.layout }, "update", []);
    case "highlight": {
      const existingTargets = command.payload.targetIds.filter((targetId) =>
        scene.nodes.some((node) => node.id === targetId),
      );
      return arraysEqual(existingTargets, scene.highlightTargetIds)
        ? unchanged(scene)
        : changed(
            scene,
            command,
            { highlightTargetIds: existingTargets },
            "highlight",
            existingTargets,
          );
    }
    case "annotate": {
      const annotation = command.payload.annotation;
      if (
        scene.annotations.some((existing) => existing.id === annotation.id) ||
        !scene.nodes.some((node) => node.id === annotation.targetId)
      ) {
        return unchanged(scene);
      }
      return changed(scene, command, { annotations: [...scene.annotations, annotation] }, "add", [
        annotation.id,
      ]);
    }
    case "focus": {
      const existingTargets = command.payload.targetIds.filter((targetId) =>
        scene.nodes.some((node) => node.id === targetId),
      );
      return arraysEqual(existingTargets, scene.focusNodeIds)
        ? unchanged(scene)
        : changed(scene, command, { focusNodeIds: existingTargets }, "highlight", existingTargets);
    }
    case "remove_element":
      return removeElement(scene, command, options);
  }
}

function removeElement(
  scene: SceneModel,
  command: Extract<SceneCommand, { type: "remove_element" }>,
  options: ApplyCommandOptions,
): ApplyCommandResult {
  const { elementId, elementKind } = command.payload;
  if (options.frozenElementIds.includes(elementId)) {
    return unchanged(scene);
  }
  if (elementKind === "node") {
    const nodes = scene.nodes.filter((node) => node.id !== elementId);
    if (nodes.length === scene.nodes.length) {
      return unchanged(scene);
    }
    return changed(
      scene,
      command,
      {
        nodes,
        edges: scene.edges.filter(
          (edge) => edge.fromNodeId !== elementId && edge.toNodeId !== elementId,
        ),
        groups: scene.groups.map((group) => ({
          ...group,
          nodeIds: group.nodeIds.filter((nodeId) => nodeId !== elementId),
        })),
        highlightTargetIds: scene.highlightTargetIds.filter((targetId) => targetId !== elementId),
        focusNodeIds: scene.focusNodeIds.filter((targetId) => targetId !== elementId),
      },
      "remove",
      [elementId],
    );
  }
  if (elementKind === "edge") {
    const edges = scene.edges.filter((edge) => edge.id !== elementId);
    return edges.length === scene.edges.length
      ? unchanged(scene)
      : changed(scene, command, { edges }, "remove", [elementId]);
  }
  if (elementKind === "group") {
    const groups = scene.groups.filter((group) => group.id !== elementId);
    return groups.length === scene.groups.length
      ? unchanged(scene)
      : changed(scene, command, { groups }, "remove", [elementId]);
  }
  if (elementKind === "annotation") {
    const annotations = scene.annotations.filter((annotation) => annotation.id !== elementId);
    return annotations.length === scene.annotations.length
      ? unchanged(scene)
      : changed(scene, command, { annotations }, "remove", [elementId]);
  }
  return unchanged(scene);
}

function changed(
  scene: SceneModel,
  command: SceneCommand,
  patch: Partial<SceneModel>,
  animationKind: SceneAnimation["kind"],
  elementIds: readonly string[],
): ApplyCommandResult {
  return {
    scene: sceneModelSchema.parse({
      ...scene,
      ...patch,
      revision: scene.revision + 1,
      updatedAt: command.issuedAt,
      approvedCommandIds: [...scene.approvedCommandIds, command.commandId],
    }),
    changed: true,
    animation: {
      kind: animationKind,
      elementIds,
    },
  };
}

function unchanged(scene: SceneModel): ApplyCommandResult {
  return {
    scene,
    changed: false,
    animation: {
      kind: "none",
      elementIds: [],
    },
  };
}

function applyNodeLabelEdit(
  node: SceneNode,
  labelEdits: Readonly<Record<string, string>> | undefined,
): SceneNode {
  const label = labelEdits?.[node.id];
  return label ? { ...node, label } : node;
}

function applyEdgeLabelEdit(
  edge: Extract<SceneCommand, { type: "connect_nodes" }>["payload"]["edge"],
  labelEdits: Readonly<Record<string, string>> | undefined,
): Extract<SceneCommand, { type: "connect_nodes" }>["payload"]["edge"] {
  const label = labelEdits?.[edge.id];
  return label ? { ...edge, label } : edge;
}

function filterNodePatch(
  patch: Extract<SceneCommand, { type: "update_node" }>["payload"]["patch"],
  allowedFields: readonly (keyof SceneNode)[] | undefined,
): Extract<SceneCommand, { type: "update_node" }>["payload"]["patch"] {
  if (!allowedFields || allowedFields.length === 0) {
    return patch;
  }
  return Object.fromEntries(
    Object.entries(patch).filter(([field]) => allowedFields.includes(field as keyof SceneNode)),
  ) as Extract<SceneCommand, { type: "update_node" }>["payload"]["patch"];
}

function normalizeScene(scene: SceneModel): SceneModel {
  return {
    ...scene,
    nodes: [...scene.nodes].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [...scene.edges].sort((left, right) => left.id.localeCompare(right.id)),
    groups: [...scene.groups].sort((left, right) => left.id.localeCompare(right.id)),
    annotations: [...scene.annotations].sort((left, right) => left.id.localeCompare(right.id)),
    highlightTargetIds: [...scene.highlightTargetIds].sort(),
    focusNodeIds: [...scene.focusNodeIds].sort(),
    approvedCommandIds: [...scene.approvedCommandIds].sort(),
  };
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}
