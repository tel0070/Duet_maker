import { beforeEach, describe, expect, it } from "vitest";
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
