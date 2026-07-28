import { DEFAULT_VOCAL_RANGE, type ProjectFile } from "@duet-maker/shared-types";
import { beforeEach, describe, expect, it } from "vitest";
import { clearCurrentProject, loadCurrentProject, saveCurrentProject } from "../../src/lib/storage.js";

function makeProject(overrides: Partial<ProjectFile> = {}): ProjectFile {
  const now = new Date().toISOString();
  return {
    schemaVersion: "1.0.0",
    id: "p1",
    name: "테스트 프로젝트",
    createdAt: now,
    updatedAt: now,
    bpm: 100,
    key: "C major",
    mainMelody: [],
    chords: [],
    sections: [],
    vocalRange: DEFAULT_VOCAL_RANGE,
    arrangements: [],
    ...overrides,
  };
}

describe("IndexedDB project storage", () => {
  beforeEach(async () => {
    await clearCurrentProject();
  });

  it("returns null when nothing has been saved", async () => {
    expect(await loadCurrentProject()).toBeNull();
  });

  it("round-trips a saved project", async () => {
    const project = makeProject({ name: "라운드트립" });
    await saveCurrentProject(project);
    const loaded = await loadCurrentProject();
    expect(loaded).toEqual(project);
  });

  it("overwrites the single autosave slot on repeated saves", async () => {
    await saveCurrentProject(makeProject({ name: "첫번째" }));
    await saveCurrentProject(makeProject({ name: "두번째" }));
    const loaded = await loadCurrentProject();
    expect(loaded?.name).toBe("두번째");
  });

  it("clears the saved project", async () => {
    await saveCurrentProject(makeProject());
    await clearCurrentProject();
    expect(await loadCurrentProject()).toBeNull();
  });

  it("returns null (not a throw) for corrupted/invalid stored data", async () => {
    const project = makeProject({ bpm: -5 as unknown as number });
    await saveCurrentProject(project);
    expect(await loadCurrentProject()).toBeNull();
  });
});
