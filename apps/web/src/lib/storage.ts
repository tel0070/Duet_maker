import { migrateProjectFile, type ProjectFile } from "@duet-maker/shared-types";

const DB_NAME = "duet-maker";
const DB_VERSION = 2;
const PROJECTS_STORE = "projects";
const META_STORE = "meta";
/** Where every project pre-multi-project used to live, keyed by this
 * literal string rather than its own id. Migrated in place on first read
 * after upgrading — see `migrateLegacyCurrentProject`. */
const LEGACY_CURRENT_KEY = "current";
const LAST_OPENED_META_KEY = "lastOpenedProjectId";

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE);
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB를 열 수 없습니다."));
  });
}

/**
 * One-time migration: a pre-multi-project autosave lived under the literal
 * key "current" in the same object store real projects now use (keyed by
 * their own `id`). If it's still there, adopt it as a real project (keyed
 * by its own id) and mark it the last-opened one, then remove the legacy
 * key. A no-op once this has run — the legacy key won't exist afterward.
 */
async function migrateLegacyCurrentProject(db: IDBDatabase): Promise<void> {
  const legacy = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readonly");
    const request = tx.objectStore(PROJECTS_STORE).get(LEGACY_CURRENT_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("이전 저장 데이터를 확인할 수 없습니다."));
  });
  if (legacy === undefined || legacy === null) return;

  let migrated: ProjectFile | null = null;
  try {
    migrated = migrateProjectFile(legacy);
  } catch {
    migrated = null;
  }

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([PROJECTS_STORE, META_STORE], "readwrite");
    tx.objectStore(PROJECTS_STORE).delete(LEGACY_CURRENT_KEY);
    if (migrated) {
      tx.objectStore(PROJECTS_STORE).put(migrated, migrated.id);
      tx.objectStore(META_STORE).put(migrated.id, LAST_OPENED_META_KEY);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("이전 저장 데이터를 옮기지 못했습니다."));
  });
}

export async function saveProject(project: ProjectFile): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([PROJECTS_STORE, META_STORE], "readwrite");
    tx.objectStore(PROJECTS_STORE).put(project, project.id);
    tx.objectStore(META_STORE).put(project.id, LAST_OPENED_META_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("프로젝트 저장에 실패했습니다."));
  });
  db.close();
}

export async function listProjects(): Promise<ProjectSummary[]> {
  const db = await openDatabase();
  await migrateLegacyCurrentProject(db);
  const all = await new Promise<unknown[]>((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readonly");
    const request = tx.objectStore(PROJECTS_STORE).getAll();
    request.onsuccess = () => resolve(request.result as unknown[]);
    request.onerror = () => reject(request.error ?? new Error("프로젝트 목록을 불러올 수 없습니다."));
  });
  db.close();

  const summaries: ProjectSummary[] = [];
  for (const raw of all) {
    try {
      const project = migrateProjectFile(raw);
      summaries.push({ id: project.id, name: project.name, updatedAt: project.updatedAt });
    } catch (error) {
      console.warn("목록에서 유효하지 않은 프로젝트를 건너뜁니다.", error);
    }
  }
  summaries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
  return summaries;
}

export async function loadProject(id: string): Promise<ProjectFile | null> {
  const db = await openDatabase();
  const raw = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(PROJECTS_STORE, "readonly");
    const request = tx.objectStore(PROJECTS_STORE).get(id);
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

export async function deleteProject(id: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([PROJECTS_STORE, META_STORE], "readwrite");
    tx.objectStore(PROJECTS_STORE).delete(id);
    const metaStore = tx.objectStore(META_STORE);
    const lastOpenedRequest = metaStore.get(LAST_OPENED_META_KEY);
    lastOpenedRequest.onsuccess = () => {
      if (lastOpenedRequest.result === id) metaStore.delete(LAST_OPENED_META_KEY);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("프로젝트 삭제에 실패했습니다."));
  });
  db.close();
}

export async function setLastOpenedProject(id: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readwrite");
    tx.objectStore(META_STORE).put(id, LAST_OPENED_META_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("마지막으로 연 프로젝트 정보를 저장할 수 없습니다."));
  });
  db.close();
}

export async function loadLastOpenedProject(): Promise<ProjectFile | null> {
  const db = await openDatabase();
  await migrateLegacyCurrentProject(db);
  const lastId = await new Promise<unknown>((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readonly");
    const request = tx.objectStore(META_STORE).get(LAST_OPENED_META_KEY);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("마지막으로 연 프로젝트 정보를 불러올 수 없습니다."));
  });
  db.close();
  if (typeof lastId !== "string") return null;
  return loadProject(lastId);
}

/** Deletes every saved project and forgets which one was last opened.
 * Used by the "새로 시작" reset path in tests and by a from-scratch wipe —
 * not exposed as a casual button in the UI (see `AGENTS.md`). */
export async function clearAllProjects(): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([PROJECTS_STORE, META_STORE], "readwrite");
    tx.objectStore(PROJECTS_STORE).clear();
    tx.objectStore(META_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("전체 삭제에 실패했습니다."));
  });
  db.close();
}
