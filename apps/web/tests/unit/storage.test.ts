import { DEFAULT_VOCAL_RANGE, type ProjectFile } from "@duet-maker/shared-types";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearAllProjects,
  deleteProject,
  listProjects,
  loadLastOpenedProject,
  loadProject,
  saveProject,
  setLastOpenedProject,
} from "../../src/lib/storage.js";

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

describe("IndexedDB multi-project storage", () => {
  beforeEach(async () => {
    await clearAllProjects();
  });

  it("returns an empty list and null last-opened project when nothing has been saved", async () => {
    expect(await listProjects()).toEqual([]);
    expect(await loadLastOpenedProject()).toBeNull();
  });

  it("round-trips a saved project by id", async () => {
    const project = makeProject({ id: "p1", name: "라운드트립" });
    await saveProject(project);
    expect(await loadProject("p1")).toEqual(project);
  });

  it("returns null for an id that was never saved", async () => {
    expect(await loadProject("nope")).toBeNull();
  });

  it("keeps two different projects as separate entries", async () => {
    await saveProject(makeProject({ id: "p1", name: "첫번째" }));
    await saveProject(makeProject({ id: "p2", name: "두번째" }));
    const list = await listProjects();
    expect(list.map((p) => p.name).sort()).toEqual(["두번째", "첫번째"]);
    expect(await loadProject("p1")).not.toBeNull();
    expect(await loadProject("p2")).not.toBeNull();
  });

  it("overwrites the same project id on repeated saves instead of duplicating it", async () => {
    await saveProject(makeProject({ id: "p1", name: "이름1" }));
    await saveProject(makeProject({ id: "p1", name: "이름2" }));
    const list = await listProjects();
    expect(list).toHaveLength(1);
    expect(list[0]!.name).toBe("이름2");
  });

  it("saving a project marks it as the last-opened one", async () => {
    await saveProject(makeProject({ id: "p1", name: "첫번째" }));
    await saveProject(makeProject({ id: "p2", name: "두번째" }));
    expect((await loadLastOpenedProject())?.id).toBe("p2");
  });

  it("setLastOpenedProject switches which project loadLastOpenedProject returns", async () => {
    await saveProject(makeProject({ id: "p1", name: "첫번째" }));
    await saveProject(makeProject({ id: "p2", name: "두번째" }));
    await setLastOpenedProject("p1");
    expect((await loadLastOpenedProject())?.id).toBe("p1");
  });

  it("deletes a project and clears last-opened if it pointed at the deleted one", async () => {
    await saveProject(makeProject({ id: "p1", name: "삭제될 것" }));
    await deleteProject("p1");
    expect(await loadProject("p1")).toBeNull();
    expect(await listProjects()).toEqual([]);
    expect(await loadLastOpenedProject()).toBeNull();
  });

  it("deleting a project that isn't last-opened leaves last-opened untouched", async () => {
    await saveProject(makeProject({ id: "p1", name: "첫번째" }));
    await saveProject(makeProject({ id: "p2", name: "두번째" }));
    await deleteProject("p1");
    expect((await loadLastOpenedProject())?.id).toBe("p2");
  });

  it("skips a corrupted/invalid stored project instead of throwing", async () => {
    const good = makeProject({ id: "p1", name: "정상" });
    const bad = makeProject({ id: "p2", name: "손상됨", bpm: -5 as unknown as number });
    await saveProject(good);
    await saveProject(bad);
    const list = await listProjects();
    expect(list.map((p) => p.id)).toEqual(["p1"]);
    expect(await loadProject("p2")).toBeNull();
  });

  it("clearAllProjects removes every project and forgets last-opened", async () => {
    await saveProject(makeProject({ id: "p1" }));
    await saveProject(makeProject({ id: "p2" }));
    await clearAllProjects();
    expect(await listProjects()).toEqual([]);
    expect(await loadLastOpenedProject()).toBeNull();
  });

  it("migrates a pre-multi-project legacy autosave (keyed literally \"current\") into a real project", async () => {
    const legacyProject = makeProject({ id: "legacy-1", name: "예전 자동 저장" });
    // Simulate what the old single-slot code wrote: the project stored
    // under the literal key "current" rather than its own id.
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("duet-maker", 2);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains("projects")) database.createObjectStore("projects");
        if (!database.objectStoreNames.contains("meta")) database.createObjectStore("meta");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("projects", "readwrite");
      tx.objectStore("projects").put(legacyProject, "current");
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    const loaded = await loadLastOpenedProject();
    expect(loaded?.id).toBe("legacy-1");
    expect(loaded?.name).toBe("예전 자동 저장");

    // The legacy key is gone and the project now lives under its own id.
    expect(await loadProject("legacy-1")).toEqual(legacyProject);
    const list = await listProjects();
    expect(list.map((p) => p.id)).toEqual(["legacy-1"]);
  });
});
