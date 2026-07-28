import { z } from "zod";
import { chordEventSchema } from "./chord-event.js";
import { duetArrangementSchema } from "./arrangement.js";
import { noteEventSchema } from "./note-event.js";
import { songSectionSchema } from "./song-section.js";
import { vocalRangeSchema } from "./vocal-range.js";

/**
 * Every persisted project (IndexedDB record or exported .json) carries an
 * explicit schemaVersion. Bump CURRENT_SCHEMA_VERSION and add a branch to
 * `migrateProjectFile` whenever the shape below changes — never silently
 * reinterpret old fields under a new meaning.
 */
export const CURRENT_SCHEMA_VERSION = "1.0.0" as const;

export const projectFileSchemaV1 = z.object({
  schemaVersion: z.literal("1.0.0"),
  id: z.string().min(1),
  name: z.string().min(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  bpm: z.number().positive(),
  /** Tonic + mode, e.g. "C major", "A minor". Free text for MVP. */
  key: z.string().min(1),
  mainMelody: z.array(noteEventSchema),
  chords: z.array(chordEventSchema),
  sections: z.array(songSectionSchema),
  vocalRange: vocalRangeSchema,
  arrangements: z.array(duetArrangementSchema),
});
export type ProjectFileV1 = z.infer<typeof projectFileSchemaV1>;

// There is only one schema version today. When a v2 is introduced, define
// `projectFileSchemaV2`, union them into `projectFileSchema`, and extend
// `migrateProjectFile` below — do not delete the v1 schema, old exported
// project.json files must remain loadable.
export const projectFileSchema = projectFileSchemaV1;
export type ProjectFile = ProjectFileV1;

export class UnsupportedSchemaVersionError extends Error {
  constructor(readonly foundVersion: string) {
    super(
      `지원하지 않는 프로젝트 파일 버전입니다: ${foundVersion} (지원 버전: ${CURRENT_SCHEMA_VERSION})`,
    );
    this.name = "UnsupportedSchemaVersionError";
  }
}

/**
 * Upgrades a raw parsed JSON object to the current schema version, or
 * throws UnsupportedSchemaVersionError. Currently a no-op beyond validation
 * because only one version exists; this is the single place future
 * migrations plug into.
 */
export function migrateProjectFile(raw: unknown): ProjectFile {
  const versionCheck = z
    .object({ schemaVersion: z.string() })
    .safeParse(raw);
  if (!versionCheck.success) {
    throw new UnsupportedSchemaVersionError("알 수 없음");
  }

  switch (versionCheck.data.schemaVersion) {
    case "1.0.0":
      return projectFileSchemaV1.parse(raw);
    default:
      throw new UnsupportedSchemaVersionError(
        versionCheck.data.schemaVersion,
      );
  }
}
