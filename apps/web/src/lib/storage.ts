import { migrateProjectFile, type ProjectFile } from "@duet-maker/shared-types";

const DB_NAME = "duet-maker";
const DB_VERSION = 1;
const STORE_NAME = "projects";
/**
 * Single autosave slot. This is intentionally not a multi-project library
 * (no "recent projects" list, no per-project delete) — see AGENTS.md/
 * HANDOFF.md for why that's deferred rather than faked.
 */
const CURRENT_PROJECT_KEY = "current";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB를 열 수 없습니다."));
  });
}

export async function saveCurrentProject(project: ProjectFile): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(project, CURRENT_PROJECT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("프로젝트 저장에 실패했습니다."));
  });
  db.close();
}

export async function loadCurrentProject(): Promise<ProjectFile | null> {
  const db = await openDatabase();
  const raw = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(CURRENT_PROJECT_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("프로젝트를 불러올 수 없습니다."));
  });
  db.close();
  if (raw === undefined || raw === null) return null;
  try {
    return migrateProjectFile(raw);
  } catch (error) {
    console.warn("저장된 프로젝트 데이터가 유효하지 않아 무시합니다.", error);
    return null;
  }
}

export async function clearCurrentProject(): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(CURRENT_PROJECT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("프로젝트 삭제에 실패했습니다."));
  });
  db.close();
}
