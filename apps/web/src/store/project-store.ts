import {
  DEFAULT_VOCAL_RANGE,
  type ChordEvent,
  type DuetArrangement,
  type DuetStyle,
  type NoteEvent,
  type ProjectFile,
  type SongSection,
  type VocalRange,
} from "@duet-maker/shared-types";
import { generateDuetArrangement, importMelodyFromMidi, regenerateSection } from "@duet-maker/harmony-core";
import { create } from "zustand";
import { clearCurrentProject, loadCurrentProject, saveCurrentProject } from "../lib/storage.js";

function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function blankProject(): ProjectFile {
  const now = new Date().toISOString();
  return {
    schemaVersion: "1.0.0",
    id: newId("project"),
    name: "새 프로젝트",
    createdAt: now,
    updatedAt: now,
    bpm: 100,
    key: "C major",
    mainMelody: [],
    chords: [],
    sections: [{ id: newId("section"), type: "verse", startTime: 0, endTime: 16, energy: 0.5, harmonyDensity: 0.6 }],
    vocalRange: DEFAULT_VOCAL_RANGE,
    arrangements: [],
  };
}

export interface ProjectState {
  project: ProjectFile;
  selectedStyle: DuetStyle;
  seed: number;
  hydrated: boolean;
  generationError: string | null;
  importError: string | null;

  setName: (name: string) => void;
  setBpm: (bpm: number) => void;
  setKey: (key: string) => void;
  setVocalRange: (range: VocalRange) => void;
  setSelectedStyle: (style: DuetStyle) => void;

  addChord: (chord: Omit<ChordEvent, "id" | "confidence" | "source">) => void;
  updateChord: (id: string, patch: Partial<ChordEvent>) => void;
  removeChord: (id: string) => void;

  addSection: (section: Omit<SongSection, "id">) => void;
  updateSection: (id: string, patch: Partial<SongSection>) => void;
  removeSection: (id: string) => void;

  addNote: (note: Omit<NoteEvent, "id" | "confidence" | "source" | "editable">) => void;
  updateNote: (id: string, patch: Partial<NoteEvent>) => void;
  removeNote: (id: string) => void;

  importMelodyFile: (file: File) => Promise<void>;
  generate: () => void;
  reroll: () => void;
  regenerateSection: (sectionId: string) => void;
  currentArrangement: () => DuetArrangement | null;

  loadSampleProject: (project: ProjectFile) => void;
  newProject: () => void;
  hydrateFromStorage: () => Promise<void>;
  resetStorage: () => Promise<void>;
}

function touch(project: ProjectFile): ProjectFile {
  return { ...project, updatedAt: new Date().toISOString() };
}

let autosaveTimer: ReturnType<typeof setTimeout> | undefined;
function queueAutosave(project: ProjectFile) {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    saveCurrentProject(project).catch((error: unknown) => {
      console.warn("자동 저장에 실패했습니다.", error);
    });
  }, 500);
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: blankProject(),
  selectedStyle: "cleanPop",
  seed: 1,
  hydrated: false,
  generationError: null,
  importError: null,

  setName: (name) => {
    const project = touch({ ...get().project, name });
    set({ project });
    queueAutosave(project);
  },
  setBpm: (bpm) => {
    const project = touch({ ...get().project, bpm });
    set({ project });
    queueAutosave(project);
  },
  setKey: (key) => {
    const project = touch({ ...get().project, key });
    set({ project });
    queueAutosave(project);
  },
  setVocalRange: (vocalRange) => {
    const project = touch({ ...get().project, vocalRange });
    set({ project });
    queueAutosave(project);
  },
  setSelectedStyle: (selectedStyle) => set({ selectedStyle }),

  addChord: (chord) => {
    const newChord: ChordEvent = { id: newId("chord"), confidence: 1, source: "user-input", ...chord };
    const project = touch({ ...get().project, chords: [...get().project.chords, newChord] });
    set({ project });
    queueAutosave(project);
  },
  updateChord: (id, patch) => {
    const project = touch({
      ...get().project,
      chords: get().project.chords.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
    set({ project });
    queueAutosave(project);
  },
  removeChord: (id) => {
    const project = touch({ ...get().project, chords: get().project.chords.filter((c) => c.id !== id) });
    set({ project });
    queueAutosave(project);
  },

  addSection: (section) => {
    const newSection: SongSection = { id: newId("section"), ...section };
    const project = touch({ ...get().project, sections: [...get().project.sections, newSection] });
    set({ project });
    queueAutosave(project);
  },
  updateSection: (id, patch) => {
    const project = touch({
      ...get().project,
      sections: get().project.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
    set({ project });
    queueAutosave(project);
  },
  removeSection: (id) => {
    const project = touch({ ...get().project, sections: get().project.sections.filter((s) => s.id !== id) });
    set({ project });
    queueAutosave(project);
  },

  addNote: (note) => {
    const newNote: NoteEvent = {
      id: newId("note"),
      confidence: 1,
      source: "user-input",
      editable: true,
      ...note,
    };
    const project = touch({ ...get().project, mainMelody: [...get().project.mainMelody, newNote] });
    set({ project });
    queueAutosave(project);
  },
  updateNote: (id, patch) => {
    const project = touch({
      ...get().project,
      mainMelody: get().project.mainMelody.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    });
    set({ project });
    queueAutosave(project);
  },
  removeNote: (id) => {
    const project = touch({ ...get().project, mainMelody: get().project.mainMelody.filter((n) => n.id !== id) });
    set({ project });
    queueAutosave(project);
  },

  importMelodyFile: async (file) => {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const imported = importMelodyFromMidi(bytes);
      if (imported.length === 0) {
        set({ importError: "이 MIDI 파일에서 음표를 찾지 못했습니다." });
        return;
      }
      const project = touch({ ...get().project, mainMelody: imported });
      set({ project, importError: null });
      queueAutosave(project);
    } catch (error) {
      set({ importError: error instanceof Error ? error.message : "MIDI 파일을 읽을 수 없습니다." });
    }
  },

  generate: () => {
    const { project, selectedStyle, seed } = get();
    if (project.mainMelody.length === 0) {
      set({ generationError: "먼저 멜로디를 입력하거나 MIDI 파일을 가져오세요." });
      return;
    }
    try {
      const arrangement = generateDuetArrangement({
        mainMelody: project.mainMelody,
        chords: project.chords,
        key: project.key,
        bpm: project.bpm,
        sections: project.sections,
        vocalRange: project.vocalRange,
        style: selectedStyle,
        seed,
      });
      const withoutSameStyle = project.arrangements.filter((a) => a.style !== selectedStyle);
      const updated = touch({ ...project, arrangements: [...withoutSameStyle, arrangement] });
      set({ project: updated, generationError: null });
      queueAutosave(updated);
    } catch (error) {
      set({ generationError: error instanceof Error ? error.message : "화음 생성에 실패했습니다." });
    }
  },
  reroll: () => {
    set({ seed: get().seed + 1 });
    get().generate();
  },
  regenerateSection: (sectionId) => {
    const { project, selectedStyle, seed } = get();
    const previousArrangement = project.arrangements.find((a) => a.style === selectedStyle);
    if (!previousArrangement) {
      set({ generationError: "먼저 전체 화음을 생성한 뒤 구간별로 다시 생성할 수 있습니다." });
      return;
    }
    try {
      const arrangement = regenerateSection({
        mainMelody: project.mainMelody,
        chords: project.chords,
        key: project.key,
        bpm: project.bpm,
        sections: project.sections,
        vocalRange: project.vocalRange,
        style: selectedStyle,
        seed,
        previousArrangement,
        sectionId,
      });
      const withoutSameStyle = project.arrangements.filter((a) => a.style !== selectedStyle);
      const updated = touch({ ...project, arrangements: [...withoutSameStyle, arrangement] });
      set({ project: updated, generationError: null });
      queueAutosave(updated);
    } catch (error) {
      set({ generationError: error instanceof Error ? error.message : "구간 재생성에 실패했습니다." });
    }
  },
  currentArrangement: () => {
    const { project, selectedStyle } = get();
    return project.arrangements.find((a) => a.style === selectedStyle) ?? null;
  },

  loadSampleProject: (project) => {
    set({ project: touch(project), generationError: null, importError: null });
    queueAutosave(project);
  },
  newProject: () => {
    const project = blankProject();
    set({ project, generationError: null, importError: null, seed: 1 });
    clearCurrentProject().catch(() => undefined);
  },
  hydrateFromStorage: async () => {
    try {
      const stored = await loadCurrentProject();
      if (stored) set({ project: stored });
    } finally {
      set({ hydrated: true });
    }
  },
  resetStorage: async () => {
    await clearCurrentProject();
    set({ project: blankProject() });
  },
}));
