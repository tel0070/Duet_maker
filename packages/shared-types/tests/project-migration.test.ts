import { describe, expect, it } from "vitest";
import {
  DEFAULT_VOCAL_RANGE,
  UnsupportedSchemaVersionError,
  migrateProjectFile,
} from "../src/index.js";

function makeV1Project() {
  return {
    schemaVersion: "1.0.0",
    id: "proj-1",
    name: "샘플 프로젝트",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    bpm: 120,
    key: "C major",
    mainMelody: [],
    chords: [],
    sections: [],
    vocalRange: DEFAULT_VOCAL_RANGE,
    arrangements: [],
  };
}

describe("migrateProjectFile", () => {
  it("passes through a valid current-version project unchanged", () => {
    const project = makeV1Project();
    const migrated = migrateProjectFile(project);
    expect(migrated).toEqual(project);
  });

  it("throws UnsupportedSchemaVersionError for a future version", () => {
    const future = { ...makeV1Project(), schemaVersion: "9.9.9" };
    expect(() => migrateProjectFile(future)).toThrow(
      UnsupportedSchemaVersionError,
    );
  });

  it("throws UnsupportedSchemaVersionError when schemaVersion is missing", () => {
    const { schemaVersion: _drop, ...withoutVersion } = makeV1Project();
    expect(() => migrateProjectFile(withoutVersion)).toThrow(
      UnsupportedSchemaVersionError,
    );
  });

  it("rejects a structurally invalid v1 project", () => {
    const broken = { ...makeV1Project(), bpm: -10 };
    expect(() => migrateProjectFile(broken)).toThrow();
  });
});
