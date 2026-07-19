import { z } from "zod";

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/u, "IDs must be stable ASCII tokens");

const isoDateTimeSchema = z.string().datetime({ offset: true });

function hasUnsafeDisplayCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return (
      codePoint === undefined ||
      codePoint < 32 ||
      codePoint === 127 ||
      character === "<" ||
      character === ">"
    );
  });
}

const safeText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((value) => !hasUnsafeDisplayCharacter(value), message);

const displayLabelSchema = safeText(80, "Labels must not contain controls or markup");
const displayTextSchema = safeText(240, "Text must not contain controls or markup");
const transcriptTextSchema = safeText(
  2000,
  "Transcript text must not contain controls or markup-like characters",
);

export const sceneNodeKindSchema = z.enum([
  "person",
  "department",
  "customer",
  "process",
  "manual_task",
  "system",
  "database",
  "document",
  "decision",
  "pain_point",
  "ai_agent",
  "automation",
  "outcome",
]);

export const sceneEdgeKindSchema = z.enum([
  "flow",
  "sends",
  "receives",
  "depends_on",
  "causes",
  "blocks",
  "automates",
  "escalates_to",
]);

export const sceneLayoutSchema = z.enum(["force", "timeline", "matrix"]);

export const sceneCommandTypeSchema = z.enum([
  "add_node",
  "update_node",
  "connect_nodes",
  "disconnect_nodes",
  "create_group",
  "update_group",
  "set_layout",
  "highlight",
  "annotate",
  "focus",
  "remove_element",
]);

export const sceneNodeSchema = z
  .object({
    id: idSchema,
    label: displayLabelSchema,
    kind: sceneNodeKindSchema,
    summary: displayTextSchema.optional(),
    importance: z.number().int().min(1).max(5).default(3),
  })
  .strict();

export const sceneEdgeSchema = z
  .object({
    id: idSchema,
    fromNodeId: idSchema,
    toNodeId: idSchema,
    label: displayLabelSchema.optional(),
    kind: sceneEdgeKindSchema,
  })
  .strict();

export const sceneGroupSchema = z
  .object({
    id: idSchema,
    label: displayLabelSchema,
    nodeIds: z.array(idSchema).min(1).max(30),
    summary: displayTextSchema.optional(),
  })
  .strict();

export const sceneAnnotationSchema = z
  .object({
    id: idSchema,
    targetId: idSchema,
    text: displayTextSchema,
  })
  .strict();

export const sceneHighlightSchema = z
  .object({
    targetIds: z.array(idSchema).min(1).max(10),
    intensity: z.enum(["low", "medium", "high"]).default("medium"),
    note: displayTextSchema.optional(),
  })
  .strict();

const nodePatchSchema = z
  .object({
    label: displayLabelSchema.optional(),
    kind: sceneNodeKindSchema.optional(),
    summary: displayTextSchema.optional(),
    importance: z.number().int().min(1).max(5).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Node patch must include at least one field");

const groupPatchSchema = z
  .object({
    label: displayLabelSchema.optional(),
    nodeIds: z.array(idSchema).min(1).max(30).optional(),
    summary: displayTextSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, "Group patch must include at least one field");

const commandEnvelopeSchema = z
  .object({
    kind: z.literal("scene.command"),
    version: z.literal(1),
    commandId: idSchema,
    idempotencyKey: idSchema,
    issuedAt: isoDateTimeSchema,
    sourceSegmentIds: z.array(idSchema).min(1).max(20),
    confidence: z.number().min(0).max(1),
    rationale: displayTextSchema,
  })
  .strict();

const addNodeCommandSchema = commandEnvelopeSchema
  .extend({
    type: z.literal("add_node"),
    payload: z
      .object({
        node: sceneNodeSchema,
      })
      .strict(),
  })
  .strict();

const updateNodeCommandSchema = commandEnvelopeSchema
  .extend({
    type: z.literal("update_node"),
    payload: z
      .object({
        nodeId: idSchema,
        patch: nodePatchSchema,
      })
      .strict(),
  })
  .strict();

const connectNodesCommandSchema = commandEnvelopeSchema
  .extend({
    type: z.literal("connect_nodes"),
    payload: z
      .object({
        edge: sceneEdgeSchema,
      })
      .strict(),
  })
  .strict();

const disconnectNodesCommandSchema = commandEnvelopeSchema
  .extend({
    type: z.literal("disconnect_nodes"),
    payload: z
      .object({
        edgeId: idSchema,
      })
      .strict(),
  })
  .strict();

const createGroupCommandSchema = commandEnvelopeSchema
  .extend({
    type: z.literal("create_group"),
    payload: z
      .object({
        group: sceneGroupSchema,
      })
      .strict(),
  })
  .strict();

const updateGroupCommandSchema = commandEnvelopeSchema
  .extend({
    type: z.literal("update_group"),
    payload: z
      .object({
        groupId: idSchema,
        patch: groupPatchSchema,
      })
      .strict(),
  })
  .strict();

const setLayoutCommandSchema = commandEnvelopeSchema
  .extend({
    type: z.literal("set_layout"),
    payload: z
      .object({
        layout: sceneLayoutSchema,
      })
      .strict(),
  })
  .strict();

const highlightCommandSchema = commandEnvelopeSchema
  .extend({
    type: z.literal("highlight"),
    payload: sceneHighlightSchema,
  })
  .strict();

const annotateCommandSchema = commandEnvelopeSchema
  .extend({
    type: z.literal("annotate"),
    payload: z
      .object({
        annotation: sceneAnnotationSchema,
      })
      .strict(),
  })
  .strict();

const focusCommandSchema = commandEnvelopeSchema
  .extend({
    type: z.literal("focus"),
    payload: z
      .object({
        targetIds: z.array(idSchema).min(1).max(5),
        note: displayTextSchema.optional(),
      })
      .strict(),
  })
  .strict();

const removeElementCommandSchema = commandEnvelopeSchema
  .extend({
    type: z.literal("remove_element"),
    payload: z
      .object({
        elementId: idSchema,
        elementKind: z.enum(["node", "edge", "group", "annotation", "highlight"]),
      })
      .strict(),
  })
  .strict();

export const sceneCommandSchema = z.discriminatedUnion("type", [
  addNodeCommandSchema,
  updateNodeCommandSchema,
  connectNodesCommandSchema,
  disconnectNodesCommandSchema,
  createGroupCommandSchema,
  updateGroupCommandSchema,
  setLayoutCommandSchema,
  highlightCommandSchema,
  annotateCommandSchema,
  focusCommandSchema,
  removeElementCommandSchema,
]);

export const presenterDecisionSchema = z
  .object({
    kind: z.literal("presenter.decision"),
    version: z.literal(1),
    decisionId: idSchema,
    commandId: idSchema,
    decidedAt: isoDateTimeSchema,
    decision: z.enum(["approve", "reject"]),
    reason: displayTextSchema.optional(),
  })
  .strict();

export const transcriptChunkSchema = z
  .object({
    id: idSchema,
    receivedAt: isoDateTimeSchema,
    speakerLabel: displayLabelSchema.optional(),
    text: transcriptTextSchema,
  })
  .strict();

export const sceneModelSchema = z
  .object({
    kind: z.literal("scene.model"),
    version: z.literal(1),
    revision: z.number().int().min(0),
    updatedAt: isoDateTimeSchema,
    layout: sceneLayoutSchema.default("force"),
    nodes: z.array(sceneNodeSchema).max(100),
    edges: z.array(sceneEdgeSchema).max(160),
    groups: z.array(sceneGroupSchema).max(40).default([]),
    annotations: z.array(sceneAnnotationSchema).max(100).default([]),
    highlightTargetIds: z.array(idSchema).max(10).default([]),
    focusNodeIds: z.array(idSchema).max(5).default([]),
    approvedCommandIds: z.array(idSchema),
  })
  .strict();

export const sessionArtifactSchema = z
  .object({
    kind: z.literal("session.artifact"),
    version: z.literal(1),
    sessionId: idSchema,
    createdAt: isoDateTimeSchema,
    transcriptChunks: z.array(transcriptChunkSchema),
    candidateCommands: z.array(sceneCommandSchema),
    presenterDecisions: z.array(presenterDecisionSchema),
    approvedScene: sceneModelSchema,
  })
  .strict();

export type SceneNodeKind = z.infer<typeof sceneNodeKindSchema>;
export type SceneEdgeKind = z.infer<typeof sceneEdgeKindSchema>;
export type SceneCommandType = z.infer<typeof sceneCommandTypeSchema>;
export type SceneNode = z.infer<typeof sceneNodeSchema>;
export type SceneEdge = z.infer<typeof sceneEdgeSchema>;
export type SceneGroup = z.infer<typeof sceneGroupSchema>;
export type SceneAnnotation = z.infer<typeof sceneAnnotationSchema>;
export type SceneCommand = z.infer<typeof sceneCommandSchema>;
export type PresenterDecision = z.infer<typeof presenterDecisionSchema>;
export type TranscriptChunk = z.infer<typeof transcriptChunkSchema>;
export type SceneModel = z.infer<typeof sceneModelSchema>;
export type SessionArtifact = z.infer<typeof sessionArtifactSchema>;

export interface FixtureTranscriptAdapter {
  readonly kind: "fixture";
  loadTranscriptChunks(fixtureId: string): Promise<readonly TranscriptChunk[]>;
}

export interface ManualTranscriptAdapter {
  readonly kind: "manual";
  appendText(input: {
    readonly text: string;
    readonly speakerLabel?: string;
    readonly receivedAt: string;
  }): Promise<TranscriptChunk>;
}

export interface RealtimeTranscriptAdapter {
  readonly kind: "realtime";
  subscribe(onChunk: (chunk: TranscriptChunk) => void): Promise<() => Promise<void>>;
}

export type TranscriptInputAdapter =
  | FixtureTranscriptAdapter
  | ManualTranscriptAdapter
  | RealtimeTranscriptAdapter;

export interface PlannerBoundary {
  readonly name: string;
  plan(input: {
    readonly transcriptChunks: readonly TranscriptChunk[];
    readonly currentScene: SceneModel;
  }): Promise<readonly SceneCommand[]>;
}

export interface RendererBoundary {
  readonly name: string;
  renderApprovedScene(scene: SceneModel): Promise<void>;
  sanitizeTranscriptText(text: string): string;
}

export interface TranscriptionBoundary {
  readonly name: string;
  readonly input: TranscriptInputAdapter;
}

export interface ExportBoundary {
  readonly name: string;
  exportSessionArtifact(artifact: SessionArtifact): Promise<Uint8Array>;
}

export function validateSceneCommand(input: unknown): SceneCommand {
  return sceneCommandSchema.parse(input);
}

export function validateSessionArtifact(input: unknown): SessionArtifact {
  return sessionArtifactSchema.parse(input);
}

export function sanitizeDisplayLabel(label: string): string {
  return Array.from(label)
    .filter((character) => !hasUnsafeDisplayCharacter(character))
    .join("")
    .trim()
    .slice(0, 80);
}

export function sanitizeTranscriptText(text: string): string {
  return Array.from(text)
    .filter((character) => !hasUnsafeDisplayCharacter(character))
    .join("")
    .trim()
    .slice(0, 2000);
}
