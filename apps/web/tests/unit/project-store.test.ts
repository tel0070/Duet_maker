import { DEFAULT_VOCAL_RANGE, type ProjectFile } from "@duet-maker/shared-types";
import { beforeEach, describe, expect, it } from "vitest";
import { saveProject } from "../../src/lib/storage.js";
import { useProjectStore } from "../../src/store/project-store.js";

describe("useProjectStore", () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  it("starts with one default section and no notes/chords", () => {
    const { project } = useProjectStore.getState();
    expect(project.mainMelody).toHaveLength(0);
    expect(project.chords).toHaveLength(0);
    expect(project.sections).toHaveLength(1);
  });

  it("adds, updates, and removes a note", () => {
    useProjectStore.getState().addNote({ pitch: 64, startTime: 0, duration: 1, velocity: 90 });
    let note = useProjectStore.getState().project.mainMelody[0]!;
    expect(note.pitch).toBe(64);

    useProjectStore.getState().updateNote(note.id, { pitch: 67 });
    note = useProjectStore.getState().project.mainMelody[0]!;
    expect(note.pitch).toBe(67);

    useProjectStore.getState().removeNote(note.id);
    expect(useProjectStore.getState().project.mainMelody).toHaveLength(0);
  });

  it("adds, updates, and removes a chord", () => {
    useProjectStore.getState().addChord({ root: "C", quality: "maj", extensions: [], startTime: 0, duration: 4 });
    let chord = useProjectStore.getState().project.chords[0]!;
    expect(chord.root).toBe("C");

    useProjectStore.getState().updateChord(chord.id, { quality: "min" });
    chord = useProjectStore.getState().project.chords[0]!;
    expect(chord.quality).toBe("min");

    useProjectStore.getState().removeChord(chord.id);
    expect(useProjectStore.getState().project.chords).toHaveLength(0);
  });

  it("refuses to generate with an empty melody and reports a Korean error", () => {
    useProjectStore.getState().generate();
    expect(useProjectStore.getState().generationError).toMatch(/멜로디/);
    expect(useProjectStore.getState().currentArrangement()).toBeNull();
  });

  it("generates an arrangement once a melody and chord exist", () => {
    useProjectStore.getState().addNote({ pitch: 64, startTime: 0, duration: 2, velocity: 90 });
    useProjectStore.getState().addNote({ pitch: 67, startTime: 2, duration: 2, velocity: 90 });
    useProjectStore.getState().addChord({ root: "C", quality: "maj", extensions: [], startTime: 0, duration: 4 });

    useProjectStore.getState().generate();

    const arrangement = useProjectStore.getState().currentArrangement();
    expect(arrangement).not.toBeNull();
    expect(arrangement!.harmonyTrack).toHaveLength(2);
    expect(useProjectStore.getState().generationError).toBeNull();
  });

  it("replaces the arrangement for the same style on re-generation instead of duplicating it", () => {
    useProjectStore.getState().addNote({ pitch: 64, startTime: 0, duration: 2, velocity: 90 });
    useProjectStore.getState().addChord({ root: "C", quality: "maj", extensions: [], startTime: 0, duration: 4 });
    useProjectStore.getState().generate();
    useProjectStore.getState().generate();
    const { arrangements } = useProjectStore.getState().project;
    expect(arrangements.filter((a) => a.style === "cleanPop")).toHaveLength(1);
  });

  it("keeps arrangements for other styles when switching styles and generating", () => {
    useProjectStore.getState().addNote({ pitch: 64, startTime: 0, duration: 2, velocity: 90 });
    useProjectStore.getState().addChord({ root: "C", quality: "maj", extensions: [], startTime: 0, duration: 4 });
    useProjectStore.getState().generate(); // cleanPop
    useProjectStore.getState().setSelectedStyle("dramatic");
    useProjectStore.getState().generate(); // dramatic
    const { arrangements } = useProjectStore.getState().project;
    expect(arrangements.map((a) => a.style).sort()).toEqual(["cleanPop", "dramatic"]);
  });

  it("reroll changes the seed and regenerates deterministically for that new seed", () => {
    useProjectStore.getState().addNote({ pitch: 64, startTime: 0, duration: 2, velocity: 90 });
    useProjectStore.getState().addChord({ root: "C", quality: "maj", extensions: [], startTime: 0, duration: 4 });
    useProjectStore.getState().generate();
    const seedBefore = useProjectStore.getState().seed;
    useProjectStore.getState().reroll();
    expect(useProjectStore.getState().seed).toBe(seedBefore + 1);
    expect(useProjectStore.getState().currentArrangement()?.randomSeed).toBe(seedBefore + 1);
  });

  it("reports a Korean error for an unparseable MIDI file without throwing", async () => {
    const file = new File([new Uint8Array([1, 2, 3, 4])], "bad.mid");
    await useProjectStore.getState().importMelodyFile(file);
    expect(useProjectStore.getState().importError).toBeTruthy();
  });

  it("refuses to regenerate a section before any full generation has happened", () => {
    const sectionId = useProjectStore.getState().project.sections[0]!.id;
    useProjectStore.getState().regenerateSection(sectionId);
    expect(useProjectStore.getState().generationError).toMatch(/먼저 전체 화음을/);
  });

  it("regenerates only the target section, leaving the other section's pitches untouched", () => {
    const store = useProjectStore.getState();
    // Replace the default single section with two, so there's something
    // to keep separate.
    store.removeSection(store.project.sections[0]!.id);
    store.addSection({ type: "verse", startTime: 0, endTime: 4, energy: 0.4, harmonyDensity: 0.8 });
    store.addSection({ type: "chorus", startTime: 4, endTime: 8, energy: 0.8, harmonyDensity: 0.8 });
    store.addNote({ pitch: 64, startTime: 0, duration: 2, velocity: 90 });
    store.addNote({ pitch: 67, startTime: 2, duration: 2, velocity: 90 });
    store.addNote({ pitch: 69, startTime: 4, duration: 2, velocity: 90 });
    store.addNote({ pitch: 72, startTime: 6, duration: 2, velocity: 90 });
    store.addChord({ root: "C", quality: "maj", extensions: [], startTime: 0, duration: 4 });
    store.addChord({ root: "G", quality: "maj", extensions: [], startTime: 4, duration: 4 });

    store.generate();
    const before = useProjectStore.getState().currentArrangement()!;
    const chorusSectionId = useProjectStore.getState().project.sections.find((s) => s.type === "chorus")!.id;

    useProjectStore.getState().regenerateSection(chorusSectionId);
    const after = useProjectStore.getState().currentArrangement()!;

    const versePitchesBefore = before.harmonyTrack.slice(0, 2).map((h) => h.generatedPitch);
    const versePitchesAfter = after.harmonyTrack.slice(0, 2).map((h) => h.generatedPitch);
    expect(versePitchesAfter).toEqual(versePitchesBefore);
    expect(useProjectStore.getState().generationError).toBeNull();
  });
});

describe("useProjectStore multi-project management", () => {
  function makeStoredProject(overrides: Partial<ProjectFile> = {}): ProjectFile {
    const now = new Date().toISOString();
    return {
      schemaVersion: "1.0.0",
      id: "stored-1",
      name: "저장된 프로젝트",
      createdAt: now,
      updatedAt: now,
      bpm: 120,
      key: "C major",
      mainMelody: [],
      chords: [],
      sections: [],
      vocalRange: DEFAULT_VOCAL_RANGE,
      arrangements: [],
      ...overrides,
    };
  }

  beforeEach(async () => {
    await useProjectStore.getState().resetStorage();
  });

  it("loadSampleProject assigns a fresh id each time, even for the same sample object", () => {
    const sample = makeStoredProject({ id: "sample-fixed-id", name: "샘플" });
    useProjectStore.getState().loadSampleProject(sample);
    const firstId = useProjectStore.getState().project.id;
    useProjectStore.getState().loadSampleProject(sample);
    const secondId = useProjectStore.getState().project.id;
    expect(firstId).not.toBe(secondId);
    expect(firstId).not.toBe("sample-fixed-id");
  });

  it("importProjectFile keeps the imported file's own id", () => {
    const imported = makeStoredProject({ id: "imported-1", name: "가져온 파일" });
    useProjectStore.getState().importProjectFile(imported);
    expect(useProjectStore.getState().project.id).toBe("imported-1");
  });

  it("refreshProjectList reflects what's actually saved in storage", async () => {
    await saveProject(makeStoredProject({ id: "a", name: "A" }));
    await saveProject(makeStoredProject({ id: "b", name: "B" }));
    await useProjectStore.getState().refreshProjectList();
    expect(useProjectStore.getState().projects.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("openProject switches the current in-memory project to the stored one", async () => {
    await saveProject(makeStoredProject({ id: "other", name: "다른 프로젝트", bpm: 140 }));
    await useProjectStore.getState().openProject("other");
    expect(useProjectStore.getState().project.id).toBe("other");
    expect(useProjectStore.getState().project.bpm).toBe(140);
  });

  it("openProject with an unknown id leaves the current project untouched", async () => {
    const before = useProjectStore.getState().project.id;
    await useProjectStore.getState().openProject("does-not-exist");
    expect(useProjectStore.getState().project.id).toBe(before);
  });

  it("deleteProjectById removes it from the list and, if it was open, switches to a fresh blank project", async () => {
    await saveProject(makeStoredProject({ id: "to-delete", name: "삭제할 프로젝트" }));
    await useProjectStore.getState().openProject("to-delete");
    expect(useProjectStore.getState().project.id).toBe("to-delete");

    await useProjectStore.getState().deleteProjectById("to-delete");

    expect(useProjectStore.getState().project.id).not.toBe("to-delete");
    expect(useProjectStore.getState().projects.find((p) => p.id === "to-delete")).toBeUndefined();
  });

  it("deleteProjectById on a project that isn't open doesn't touch the current project", async () => {
    await saveProject(makeStoredProject({ id: "bystander", name: "다른 프로젝트" }));
    const currentBefore = useProjectStore.getState().project.id;

    await useProjectStore.getState().deleteProjectById("bystander");

    expect(useProjectStore.getState().project.id).toBe(currentBefore);
  });

  it("newProject does not delete any previously saved project", async () => {
    await saveProject(makeStoredProject({ id: "keep-me", name: "유지되어야 함" }));
    useProjectStore.getState().newProject();
    await useProjectStore.getState().refreshProjectList();
    expect(useProjectStore.getState().projects.find((p) => p.id === "keep-me")).toBeTruthy();
  });
});
