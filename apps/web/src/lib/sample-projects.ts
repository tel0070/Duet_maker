import { migrateProjectFile, type ProjectFile } from "@duet-maker/shared-types";

export interface SampleProjectSummary {
  slug: string;
  name: string;
}

/**
 * Kept as a static list rather than an index.json fetch — there are only
 * three demo projects and this avoids an extra network round-trip. Add an
 * entry here when scripts/sync-samples.mjs picks up a new example.
 */
export const SAMPLE_PROJECTS: SampleProjectSummary[] = [
  { slug: "c-g-am-f-pop-ballad", name: "C-G-Am-F 팝 발라드 예시" },
  { slug: "ii-v-i-jazz-turnaround", name: "ii-V-I 재즈 턴어라운드 예시" },
  { slug: "minor-ballad", name: "단조 발라드 예시" },
];

export async function loadSampleProject(slug: string): Promise<ProjectFile> {
  const response = await fetch(`${import.meta.env.BASE_URL}samples/${slug}.json`);
  if (!response.ok) {
    throw new Error(`샘플 프로젝트를 불러오지 못했습니다: ${slug}`);
  }
  const raw = await response.json();
  return migrateProjectFile(raw);
}
