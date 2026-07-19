import { describe, expect, it } from "vitest";

import { sceneCommandSchema, sessionArtifactSchema } from "@lac/contracts";

import {
  invalidExternalResponseFixtures,
  judgeSceneCommandFixtures,
  sampleSessionArtifact,
  validSceneCommandFixtures,
} from "./index.js";

describe("Goal 1 fixtures", () => {
  it("keeps valid SceneCommand fixtures inside the DSL", () => {
    expect(
      validSceneCommandFixtures.map((fixture) => sceneCommandSchema.parse(fixture)),
    ).toHaveLength(validSceneCommandFixtures.length);
  });

  it("keeps the English judge fixture inside the same strict DSL", () => {
    expect(
      judgeSceneCommandFixtures.map((fixture) => sceneCommandSchema.parse(fixture)),
    ).toHaveLength(10);
  });

  it("keeps unsafe external responses rejected by schema validation", () => {
    for (const fixture of invalidExternalResponseFixtures) {
      expect(() => sceneCommandSchema.parse(fixture.value), fixture.name).toThrow();
    }
  });

  it("keeps the replay artifact schema-valid", () => {
    expect(sessionArtifactSchema.parse(sampleSessionArtifact).sessionId).toBe(
      "session-fixture-001",
    );
  });
});
