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
- [x] IndexedDB project save/restore across refresh (single autosave slot, debounced; verified manually in a real browser — see `HANDOFF.md`)
- [x] Bonus, not originally listed: project JSON export/import, sample project loader (3 demo songs), "다른 결과 보기" (reroll with a new seed)
- [ ] **Not done**: section-level partial regeneration (regenerating one section while keeping the rest fixed) — current "생성" always regenerates the whole arrangement for the selected style; a true partial re-optimization needs planner changes not yet made (see `AGENTS.md` §9)
- [ ] **Not done**: multi-project management (recent projects list, per-project delete) — only a single autosave slot exists
- [ ] **Not done**: dragging/resizing *chords* or *sections* on the piano roll (only melody notes are drag-editable; chords/sections remain table-only)

## Phase 3 — Guide playback & recording

- [ ] Piano / soft synth / choir pad / humming guide playback
- [ ] Synced main+second playback
- [ ] Microphone recording
- [ ] A-B loop, playback speed, count-in

## Phase 4 — Vocal file analysis

- [ ] Vocal/a cappella upload
- [ ] Browser-side pitch extraction (Level 2, capability-gated)
- [ ] Auto-extracted melody editable in the piano roll
- [ ] Linked to chord progression input

## Phase 5 — Full mix analysis (optional local engine)

- [ ] `local-engine` FastAPI service (currently just a status README, no code)
- [ ] Stem separation
- [ ] Chord/key/section detection from a full mix
- [ ] Long-file handling
- [ ] Wired to the web app via the existing provider interfaces

## Phase 6 — Advanced duet generation

- [ ] Stronger counter-melody generation
- [ ] Lyric distribution across the two parts
- [ ] Call-and-response refinement
- [ ] Voice-swap between the two parts
- [ ] Final-chorus expansion beyond the current density heuristic
- [ ] Genre presets
- [ ] Natural singing-synthesis adapter evaluation (`VocalSynthesisProvider`)
