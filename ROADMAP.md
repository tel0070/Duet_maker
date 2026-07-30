# ROADMAP.md

Checkboxes reflect actual, verified state (tests passing / manually
checked) — not intent. Update this file, not just your memory, whenever an
item's state changes.

## Phase 0 — Repo & docs foundation

- [x] Monorepo structure (`apps/`, `packages/`, `examples/`, `scripts/`, `docs/`)
- [x] `AGENTS.md`, `CLAUDE.md`, `KIMI.md`, `CODEX.md`, `HANDOFF.md`, `ROADMAP.md`
- [x] `docs/ARCHITECTURE.md`, `docs/PRODUCT_SPEC.md`, `docs/HARMONY_RULES.md`, `docs/DATA_FORMATS.md`
- [x] Standard commands (`pnpm install/build/test/lint/typecheck/validate`)
- [x] Sample chord progressions + MIDI (`examples/`)
- [x] `pnpm install && pnpm build && pnpm test && pnpm typecheck` succeed
- [x] Core data structures have passing tests (`packages/shared-types`)
- [x] CI workflows written (`pull-request-check.yml`, `deploy-production.yml`, `dependency-review.yml`)
- [ ] CI confirmed green on GitHub Actions (not yet verified against real GitHub infra)
- [ ] Site actually live at a public URL (blocked on repo visibility/plan — see `docs/adr/0001-hosting-choice.md`)

## Phase 1 — Harmony Core MVP

- [x] Inputs: MIDI-shaped main melody, chord progression, key, BPM, sections, vocal range
- [x] Outputs: Clean Pop, Emotional, Dramatic, True Duet arrangements
- [x] MIDI export
- [x] Per-note generation reason (Korean) + score breakdown
- [x] Four styles produce genuinely different results (verified by test, not just weights)
- [x] Vocal range constraint enforced (verified by test)
- [x] Harmony changes when chords change (verified by test)
- [x] Same seed → identical output (verified by test)
- [x] 20+ unit tests (actual: 95, plus a MIDI importer added during Phase 2 with its own round-trip tests)
- [x] Generated MIDI is playable (valid SMF, verified with an independent byte reader)

## Phase 2 — Web piano roll & arrangement editor

- [x] MIDI import in the browser (`importMelodyFromMidi` in harmony-core, wired to a file input in the editor)
- [x] Chord progression input (editable table: root/quality/timing, add/remove)
- [x] Section input (editable table: type/timing/energy/density, add/remove)
- [x] Piano roll (main melody + generated harmony, chord/section bands), **now with drag-to-move, drag-to-resize, double-click-to-add, and Delete-to-remove** (see below) — plus a parallel table editor for the same data
- [x] Style picker + generate action wired to `packages/harmony-core`
- [x] Harmony track display with reasons/scores visible (full per-note table: relation, chord role, motion, confidence, reason)
- [x] Manual note editing — **two ways**: drag/resize/add/delete directly on the piano roll (`apps/web/src/components/PianoRoll.tsx`, pointer events, verified with 5 Playwright e2e tests), or via the note table (add/edit/delete rows)
- [x] MIDI export from the UI (downloads a real, byte-verified .mid)
- [x] IndexedDB project save/restore across refresh (debounced autosave; verified manually in a real browser — see `HANDOFF.md`)
- [x] Bonus, not originally listed: project JSON export/import, sample project loader (3 demo songs), "다른 결과 보기" (reroll with a new seed)
- [x] Section-level partial regeneration — a "재생성" button per row in the section table calls `regenerateSection` (`packages/harmony-core`), which locks every note outside the target section to its previous exact pitch/relation and only re-runs the beam search for notes inside it. Requires a full generation to exist first (button is disabled until then). **Two-sided continuity**: the seam into the section (from the locked note before) and the seam back out (into the locked note after) are both considered by the scoring — see `AGENTS.md` §9.
- [x] Multi-project management — a "최근 프로젝트" panel (`apps/web/src/components/ProjectList.tsx`) lists every project saved in IndexedDB (`apps/web/src/lib/storage.ts`, now keyed by each project's own id instead of a single fixed slot, with a lazy one-time migration of any pre-existing single-slot autosave), with "열기"/"삭제" per row. "새 프로젝트" no longer deletes anything — it just starts an unsaved blank project.
- [x] Dragging/resizing chords and sections on the piano roll — the same drag-to-move/drag-to-resize interaction already built for melody notes, extended to chord bands (pink) and section bands (purple) via a shared `dragToBandPatch` helper (`apps/web/src/lib/piano-roll-geometry.ts`). Chords and sections are still also editable via their tables, in sync with the piano roll.

**Phase 2 checklist is now fully done.**

## Phase 3 — Guide playback & recording

- [x] Piano / soft synth / choir pad / humming guide playback — Web Audio oscillators with a per-voice attack/sustain/release envelope (`apps/web/src/lib/audio-engine.ts`); deliberately simple, synthetic timbres, not a claim of natural sound
- [x] Synced main+second playback — "함께 재생" schedules both tracks against the same `startAt`, verified they share it (unit test) and sound together (manual + e2e check)
- [x] Playback speed — 0.5x/0.75x/1x/1.25x selector, scales note timing
- [x] Per-track volume — independent sliders for main melody and second vocal
- [x] Microphone recording — `getUserMedia` + `MediaRecorder` (`apps/web/src/lib/recorder.ts`), record/stop/playback/download; verified with Playwright's fake-device flags (`--use-fake-device-for-media-stream`) so it runs in CI without real hardware.
- [x] A-B loop — "구간 반복" toggle + start/end beat inputs on the playback panel; loops the selected region indefinitely until stopped (`sliceScheduledToRegion` + a self-rescheduling `setTimeout` chain in `PlaybackPanel.tsx`), verified with a real-timing e2e test that the loop keeps playing well past when a one-shot would have auto-stopped.
- [x] Count-in — "카운트인 (4비트)" toggle adds 4 metronome clicks (accented downbeat) before playback starts (`scheduleCountIn` in `apps/web/src/lib/audio-engine.ts`), verified with a real-timing e2e test that playback is genuinely delayed and still auto-stops afterward.
- [x] Sync recording with guide playback — a "재생하며 녹음" button starts microphone recording and guide playback together (`EditorPage.tsx`, via `ref`-exposed imperative handles on `PlaybackPanel`/`RecordingPanel`); falls back to melody-only playback if no harmony has been generated yet. Not sample-accurate audio-graph sync — a single combined click starting both independent systems, not merged into one recording (see `docs/DECISIONS.md`).

## Phase 4 — Vocal file analysis

- [ ] Vocal/a cappella upload
- [ ] Browser-side pitch extraction (Level 2, capability-gated)
- [ ] Auto-extracted melody editable in the piano roll
- [ ] Linked to chord progression input

## Phase 5 — Full mix analysis (optional local engine)

- [x] `local-engine` FastAPI service (Demucs + basic-pitch + librosa, localhost-only, job-polling API — see `local-engine/README.md`)
- [x] Stem separation (Demucs `htdemucs`, two-stems)
- [x] Chord/key/section detection from a full mix (librosa beat/chroma + Krumhansl-Schmuckler + chord templates + self-similarity segmentation)
- [x] Wired to the web app via the existing provider interfaces (`apps/web/src/lib/local-engine-client.ts`, `AudioUploadPanel`, `AudioMixPlayer`)
- [ ] Long-file handling — untested on a real multi-minute song in this dev sandbox (no length cap exists, but runtime on a full song was never measured here; see local-engine/README.md's "Verified in development" note)

## Phase 6 — Advanced duet generation

- [ ] Stronger counter-melody generation
- [ ] Lyric distribution across the two parts
- [ ] Call-and-response refinement
- [ ] Voice-swap between the two parts
- [ ] Final-chorus expansion beyond the current density heuristic
- [ ] Genre presets
- [ ] Natural singing-synthesis adapter evaluation (`VocalSynthesisProvider`)
