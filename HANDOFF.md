# HANDOFF.md

## Last updated

2026-07-30 (**the site is live** — GitHub Pages deploy succeeded after the
human enabled Settings → Pages → Source: GitHub Actions; both `build` and
`deploy` jobs of `Deploy Production` run 30463070615 attempt 2 are fully
green — see "Known failures / unverified claims" for exactly what was and
wasn't independently re-verified)

## Current phase

Phase 0 and Phase 1 are done. **Phase 2 (web editor) checklist is now
fully done**, including multi-project management and chord/section
piano-roll dragging. **Phase 3 (guide playback & recording) checklist is
fully done**, including the "재생하며 녹음" combined action. The one
remaining known limitation tracked in `AGENTS.md` (two-sided
section-regeneration continuity) is now also fixed.

**`main` now has the real project** (previously just a placeholder
README — see "Recent architectural decisions" below), CI runs green on
GitHub's actual infrastructure, and **the first production deploy
succeeded**: https://tel0070.github.io/Duet_maker/ (see "Known failures /
unverified claims" for the one verification step this session's sandbox
could not itself perform).

## Working features

- `packages/shared-types`: full data model, zod validation, project-file
  schema + migration. 20 tests.
- `packages/harmony-core`: chord/scale-aware candidate generation, 13-score
  evaluator, beam-search planner, 4 structurally distinct styles, seeded
  reproducible generation, MIDI **export**/**import**, and
  **`regenerateSection`** (locks everything outside one section to its
  previous exact choice, with two-sided continuity — voice-leads into
  *and* out of the regenerated section). 104 tests.
- `apps/web`: landing page (`#`) + editor (`#editor`). The editor:
  - Loads a sample project, starts blank, or imports a melody from a
    `.mid` file.
  - Edits chords, sections, and melody notes via tables, **and** directly
    on the piano roll — melody notes with drag to move/resize,
    double-click to add, Delete to remove; chord and section bands with
    drag to move/resize (add/remove for those stays table-only).
  - Generates a real arrangement per style via `generateDuetArrangement`,
    or regenerates just one section via `regenerateSection`.
  - Shows the full per-note result table (relation, chord role, motion,
    confidence, Korean `styleReason`).
  - Exports real MIDI and project-JSON files; imports project JSON back.
  - Autosaves each project to IndexedDB, keyed by its own id, and restores
    the last-opened one on refresh. A "최근 프로젝트" panel lists every
    saved project (name + last-updated time) with "열기"/"삭제" per row;
    "새 프로젝트" starts a fresh, unsaved project without deleting
    anything else.
  - **Plays a guide audio track**: 4 voices (piano/soft synth/choir pad/
    humming), main melody alone / harmony alone / both together in sync,
    independent volume per track, 0.5x-1.25x speed, an A-B loop (start/end
    beat inputs, repeats until stopped) and a 4-beat count-in (accented
    downbeat click before playback starts).
  - **Records from the microphone**: "녹음 시작"/"녹음 정지" via
    `getUserMedia`+`MediaRecorder`, playback of the take via a native
    `<audio>` element, and a download button. Verified end-to-end with
    Playwright launched against a synthetic fake device (Chromium's
    `--use-fake-device-for-media-stream` flag) — no real microphone needed
    for the test to be genuine, and the same flag means this also runs
    correctly in CI.
  - **"재생하며 녹음"**: one button starts recording and guide playback
    together (falls back to melody-only if no harmony has been generated
    yet); a matching "재생·녹음 정지" stops both. Each panel's own
    standalone controls still work independently.
- CI workflows (PR checks, GitHub Pages deploy, dependency review, weekly
  health check) — **now confirmed running on GitHub's real infrastructure**
  (see "Recent architectural decisions" and "Known failures" below for
  what that first real run actually found).

## Partially working features

None — every item originally scoped for Phase 2 and Phase 3 is built.

## Known failures / unverified claims

- **GitHub Pages deploy now succeeds — verified via GitHub's own systems,
  with one caveat below.** The human enabled Settings → Pages → Source:
  GitHub Actions, then the previously-failed `Deploy Production` run
  (id `30463070615`) was re-run without any code change. Attempt 2 of
  that run is `status: completed`, `conclusion: success`; both jobs show
  every step green:
  - `build` (job `90738716767`): checkout, pnpm/node setup, install,
    lint, typecheck, unit tests, build, Playwright install, e2e smoke
    test, `upload-pages-artifact@v3` — all `success`.
  - `deploy` (job `90738977851`): `actions/deploy-pages@v4` — `success`.
    Its own log states `Reported success!` and
    `Evaluated environment url: https://tel0070.github.io/Duet_maker/`
    verbatim — this URL string comes directly from GitHub's deploy
    action, not something inferred or guessed on this end.
  - **Caveat, stated plainly**: this sandbox's own outbound network
    proxy blocks `CONNECT` to `tel0070.github.io:443` at the policy
    level (`curl -I` returns a 36-byte `403 Forbidden` that is the proxy
    talking, not the real site — confirmed via
    `$HTTPS_PROXY/__agentproxy/status`'s `recentRelayFailures`:
    `"kind": "connect_rejected", "detail": "gateway answered 403 to
    CONNECT (policy denial or upstream failure)"`). The GitHub Pages API
    path (`/repos/.../pages`) is also outside this proxy's allowed path
    list. So the live page was **not** independently browser/curl-loaded
    from *this* environment — the "success" claim rests entirely on
    GitHub's own job status and log content, which is a legitimate and
    strong signal (it's the same system that actually served the
    deploy), but is not the same as a first-party fetch of the URL from
    here. **A human visiting https://tel0070.github.io/Duet_maker/ in an
    ordinary browser is the one remaining independent check.**
- `delayedEntry`/`repeatPhrase` arrangement instructions are approximated
  via scoring bias + text only (Phase 1 limitation, unchanged).
- Guide playback timbres are genuinely 4 distinct oscillator-based sounds,
  not natural piano/choir/voice recordings.
- Recorded audio's actual container/codec depends on what the visiting
  browser's `MediaRecorder` defaults to (typically `audio/webm;
  codecs=opus` in Chromium) — not normalized/transcoded to a fixed format.
  Fine for playback-in-browser and re-download, but worth knowing if a
  user expects a specific file type.

## Recent architectural decisions

- **No react-router**; two views switched by `window.location.hash`.
- **Zustand for editor state**, hand-written IndexedDB wrapper (not
  `persist` middleware) — see `docs/DECISIONS.md`.
- **MIDI import lives in `packages/harmony-core`**, symmetric to export.
- **Section regeneration reuses the existing beam search** via an
  optional `fixedChoices` map in `planHarmonyTrack` — see
  `docs/DECISIONS.md`. Continuity is now two-sided: `ScoringContext`
  gained `nextHarmonyPitch`/`nextMelodyPitch` (only non-null when the
  immediately next note is locked), and `voiceLeadingScore` blends a
  backward and forward leap check via a shared
  `directionalVoiceLeadingScore` helper. Zero effect on
  `generateDuetArrangement`'s determinism, since an ordinary full
  generation never populates `fixedChoices`.
- **Piano-roll drag math is a pure module** separate from pointer-event
  wiring, specifically so it's unit-testable without a real layout engine.
- **Guide playback and recording both follow the same "pure logic +
  thin browser-API wrapper" split**: `audio-engine.ts`'s scheduling math
  and `recorder.ts`'s chunk-assembly logic are each unit-tested against a
  hand-built fake (`AudioContext` / `MediaRecorder`+`MediaStream`), while
  the actual browser-API behavior (does sound come out, does a real
  recording get produced) is left to Playwright, which now launches
  Chromium with fake-media-device flags specifically so that layer is
  testable too, not just assumed to work. No audio/media library
  dependency for either (no Tone.js, no RecordRTC) — the browser APIs
  were sufficient.
- **A-B loop re-schedules rather than natively looping**: since guide
  playback is per-note oscillators (not one `AudioBufferSourceNode`), the
  loop is a `setTimeout` chain that re-slices and re-schedules the region
  each iteration, guarded by a generation counter so `stopAll()` reliably
  kills any in-flight chain — see `docs/DECISIONS.md`.
- **"재생하며 녹음" starts two independent systems, not one merged audio
  graph**: `PlaybackPanel`/`RecordingPanel` each expose their play/record
  actions via `forwardRef`+`useImperativeHandle`; `EditorPage` calls
  `start()` then `playBoth()` in sequence. The recorded file only contains
  what the microphone actually picked up — not a clean guide+voice mix.
  See `docs/DECISIONS.md` for why that's the deliberate scope, not a
  shortfall.
- **Multi-project storage keys the same IndexedDB store by project id**
  instead of adding a second store or rewriting the schema; a small new
  `meta` store just tracks which id was last opened. A pre-existing
  single-slot save is migrated in place, lazily, the first time it's read
  after upgrading — no separate migration step. `loadSampleProject` forks
  to a new id every time (so reselecting a sample never overwrites a
  previous edit); `importProjectFile` keeps the file's own id (so
  re-importing your own export resumes that same entry). See
  `docs/DECISIONS.md`.
- **Chord/section piano-roll dragging reuses the melody-note drag flow**
  via a `kind` discriminator (`"note" | "chord" | "section"`) in
  `PianoRoll.tsx`'s single `DragSession`/`onDragMove`/`endDrag` pipeline,
  and a new `dragToBandPatch` geometry function that's `dragToNotePatch`
  minus the pitch dimension. `SongSection`'s `endTime` is converted to/from
  a derived `duration` locally in `PianoRoll.tsx` so the shared band-patch
  math doesn't need to know about that schema difference. Chord/section
  resize handles use a distinct CSS class from melody notes' handles
  specifically so the pre-existing note-drag e2e locators keep resolving
  correctly now that more resize handles exist earlier in the SVG's DOM
  order. See `docs/DECISIONS.md`.
- **The entire project was merged into `main` via PR #1** — `main` had
  only ever held a placeholder README until this point; all 11 commits of
  actual work lived on `claude/duet-maker-initial-setup` and had never
  been merged. Running CI against real GitHub infrastructure for the
  first time (rather than only locally) surfaced 3 real bugs no amount of
  local `pnpm validate`/`pnpm test:e2e` could have caught, because they're
  specific to environment differences between this sandbox and GitHub's
  runners:
  - `pnpm/action-setup@v4`'s explicit `version: 10` input conflicted with
    `package.json`'s `packageManager: pnpm@10.33.0` field, in **three**
    separate workflow files (`pull-request-check.yml`,
    `deploy-production.yml`, `scheduled-health-check.yml` — found by
    grepping all workflow files for the same pattern after the first two
    turned up).
  - `playwright.config.ts` hardcoded a fallback `executablePath` pointing
    at this sandbox's own pre-installed Chromium (`/opt/pw-browsers/
    chromium`), which doesn't exist on GitHub's runners — every e2e test
    failed on the first real CI run. Fixed by making that path strictly
    opt-in via `PLAYWRIGHT_CHROMIUM_PATH`, never defaulted. See
    `docs/DECISIONS.md`'s "Failed/abandoned approaches" section and
    `docs/TROUBLESHOOTING.md`.
  - The `Dependency Review` workflow requires the repo's "Dependency
    graph" Settings toggle, which a workflow file can't enable itself —
    made `continue-on-error: true` so it doesn't block merges until a
    human flips that switch.
  Both follow-up fixes went through their own small PRs (#1 → #2), each
  validated locally before pushing, each confirmed green on GitHub's
  actual infrastructure before merging — not just assumed to work from
  the fix "looking right."

## Next recommended task

Pick one:

1. **Human sanity check**: open https://tel0070.github.io/Duet_maker/ in
   an ordinary browser and confirm it loads — the one verification step
   this session's own sandboxed environment could not perform itself (see
   "Known failures" above). Everything else about the deploy is already
   confirmed via GitHub's own job logs.
2. Phase 2's and Phase 3's checklists, plus two-sided section-regeneration
   continuity, are all now fully done. The next phase-scale work is Phase 4
   (vocal file analysis / browser-side pitch extraction) — read
   `docs/PRODUCT_SPEC.md`'s Phase 4 section before starting, it is a
   materially bigger undertaking than anything above.

## Commands to reproduce current state

```bash
pnpm install
pnpm validate    # lint + typecheck + test + build, all packages
pnpm test:e2e    # Playwright — drag/resize (notes + chord/section bands), section regen, playback, recording, sync, project management
```

Expected: all green. As of this handoff: 207 unit tests (20 shared-types +
104 harmony-core + 83 web) and 33 Playwright e2e tests, all passing; lint
and typecheck clean; build succeeds.

To see it running locally: `pnpm dev`, click "편곡 시작하기 (Beta)", pick a
sample, "화음 생성", try "가이드 재생" → "함께 재생" (try the "구간 반복"
and "카운트인" toggles too), "녹음" → "녹음 시작", "재생하며 녹음" to try
both together (grant the microphone permission prompt), add a note or
rename the project to see it appear under "최근 프로젝트", drag a chord or
section band on the piano roll, and try "재생성" on a section that isn't
the last one to see two-sided continuity in action.

## Files changed in the latest major work (this session)

Getting the project's first real deployment live, after the entire
project (previously all sitting on `claude/duet-maker-initial-setup`,
never merged) went into `main` via PR #1:

- `.github/workflows/pull-request-check.yml`,
  `deploy-production.yml`, `scheduled-health-check.yml` — removed
  `pnpm/action-setup@v4`'s explicit `version: 10` input from all three
  (conflicted with `package.json`'s `packageManager` field).
- `.github/workflows/dependency-review.yml` — added
  `continue-on-error: true`, since the underlying check needs a repo
  Settings toggle a workflow file can't flip itself.
- `apps/web/playwright.config.ts` — `executablePath` is now strictly
  opt-in via `PLAYWRIGHT_CHROMIUM_PATH`, never defaulted to a
  sandbox-only path.
- `docs/TROUBLESHOOTING.md`, `docs/DECISIONS.md` — documented the
  Playwright fix and the env var a sandboxed dev environment now needs to
  set explicitly.
- This file — replaced "not yet confirmed on GitHub's infrastructure"
  with what running there for real actually found (see "Known failures"
  and "Recent architectural decisions" above).

Each fix was validated locally (`pnpm validate`, and for the Playwright
fix, `pnpm test:e2e` re-run both with and without the env var to confirm
both the bug and the fix), pushed through its own small PR, and confirmed
green on GitHub's actual infrastructure before merging.

(Prior major work: two-sided section-regeneration continuity,
chord/section piano-roll dragging, multi-project management, syncing
recording with playback, A-B loop/count-in, microphone recording, guide
playback, section-level regeneration, piano-roll drag editing, and the
initial Phase 2 editor — see earlier commits.)

(Prior major work: chord/section piano-roll dragging, multi-project
management, syncing recording with playback, A-B loop/count-in,
microphone recording, guide playback, section-level regeneration,
piano-roll drag editing, and the initial Phase 2 editor — see earlier
commits.)

## Items requiring human evaluation

- **Musical quality** — listen to `examples/midi/*.mid` or export fresh
  ones and judge; no automated human-rating tooling exists.
- **Guide sound / recording quality** — are 4 simple oscillator timbres
  and un-normalized browser-default recording good enough, or would either
  benefit from more work even though the Phase 3 checklist is complete?
  Judgment call.
- **Confirm the live site in a real browser** — GitHub's own deploy job
  reports success at https://tel0070.github.io/Duet_maker/, but this
  session's sandbox couldn't independently fetch that URL itself (proxy
  policy — see "Known failures" above). A quick human visit closes the
  loop. See also `docs/adr/0001-hosting-choice.md`.
