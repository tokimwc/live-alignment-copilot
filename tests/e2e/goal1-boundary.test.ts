import { describe, expect, it } from "vitest";

import { sceneCommandSchema, sessionArtifactSchema } from "@lac/contracts";
import {
  invalidExternalResponseFixtures,
  sampleSessionArtifact,
  validSceneCommandFixtures,
} from "@lac/test-fixtures";

describe("Goal 1 safety boundary", () => {
  it("accepts fixture commands and rejects non-DSL external responses", () => {
    for (const command of validSceneCommandFixtures) {
      expect(sceneCommandSchema.safeParse(command).success).toBe(true);
    }

    for (const fixture of invalidExternalResponseFixtures) {
      expect(sceneCommandSchema.safeParse(fixture.value).success, fixture.name).toBe(false);
    }
  });

  it("exports only approved scene state in session artifacts", () => {
    const artifact = sessionArtifactSchema.parse(sampleSessionArtifact);
    expect(artifact.approvedScene.approvedCommandIds).toEqual(
      validSceneCommandFixtures.map((command) => command.commandId),
    );
    expect(artifact.candidateCommands.every((command) => "payload" in command)).toBe(true);
  });
});
