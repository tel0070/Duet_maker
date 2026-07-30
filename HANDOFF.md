# HANDOFF.md

## Last updated

2026-07-30 (**Phase 5 (audio upload / local-engine) implemented**: a new
`local-engine` Python service does real vocal separation + tempo/key/chord/
section/melody analysis, wired into the web editor via an "오디오 업로드"
panel and a mixed-playback/MP3-export panel. Verified end-to-end against
synthetic audio in this dev sandbox — see "Known failures / unverified
claims" for exactly what real-song behavior remains unconfirmed. This is
layered on top of the earlier "site is live" milestone below, unchanged.)

## Current phase

Phase 0 and Phase 1 are done. **Phase 2 (web editor) checklist is now
fully done**, including multi-project management and chord/section
piano-roll dragging. **Phase 3 (guide playback & recording) checklist is
fully done**, including the "재생하며 녹음" combined action. The one
remaining known limitation tracked in `AGENTS.md` (two-sided
section-regeneration continuity) is now also fixed. **Phase 5's web-side
wiring is now done** — see "Working features" and "Known failures" below
for what was and wasn't verified this session.

**`main` now has the real project** (previously just a placeholder
README — see "Recent architectural decisions" below), CI runs green on
GitHub's actual infrastructure, and **the first production deploy
succeeded**: https://tel0070.github.io/Duet_maker/ (see "Known failures /
unverified claims" for the one verification step this session's sandbox
could not itself perform). Note: Phase 5's new code has **not yet been
pushed through CI** — see "Next recommended task".

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
- **`local-engine`** (new, Phase 5): a FastAPI service, `127.0.0.1`-only,
  that separates an uploaded song (Demucs `htdemucs`, two-stems), detects
  tempo/key/chords from the instrumental stem (librosa beat/chroma +
  Krumhansl-Schmuckler + chord-template matching), transcribes the vocal
  stem to a melody (basic-pitch), and segments+labels sections
  (chroma/timbre self-similarity + RMS-energy heuristic). Every heavy
  operation is a pollable background job (`GET /jobs/{id}`) with real
  Korean progress text. 20 pytest tests, including a real end-to-end run
  (FastAPI `TestClient` → actual librosa/basic-pitch pipeline) against a
  synthetic fixture with known ground truth (tempo/key/pitch all recovered
  exactly). See `local-engine/README.md` for setup, install-size caveats,
  and limitations.
- **apps/web's "오디오 업로드" panel** (new): checks local-engine's health,
  uploads a file, drives separation → tempo/key/chords → melody → sections
  in sequence (`LocalEngineAudioAnalysisProvider` in
  `apps/web/src/lib/local-engine-client.ts`), shows live progress, and
  fills the editor's key/BPM/melody/chords/sections from the result via a
  new `importAudioAnalysis` store action.
- **apps/web's "업로드한 오디오와 화음 함께 듣기" panel** (new,
  `AudioMixPlayer.tsx`): plays the separated vocal stem, instrumental stem,
  and generated harmony together, each independently mutable/volume-
  adjustable, so e.g. instrumental+harmony-only or vocal-only playback
  both work.
- **MP3 export** (new, `apps/web/src/lib/mp3-export.ts` +
  `renderMixOffline` in `audio-engine.ts`): both the guide-only playback
  panel and the audio-mix panel can render their current mix offline
  (`OfflineAudioContext`) and download it as an MP3, entirely client-side.

## Partially working features

- **Section *type* labeling from audio** (verse/chorus/intro/outro) is a
  same-song relative-RMS-energy heuristic, not a trained classifier —
  boundaries are a real signal-processing result, the label often needs
  manual correction. See `local-engine/README.md`.
- **Chord detection from audio** only distinguishes major/minor triads —
  no 7ths, sus-chords, etc., even though `ChordQuality` supports more.

Every item originally scoped for Phase 2 and Phase 3 is built (unchanged
from before this session).

## Known failures / unverified claims

- **`local-engine` has not been run against a real, multi-minute song, in
  any environment.** What *was* verified in this dev sandbox (see
  `local-engine/README.md`'s "Verified in development" section for the
  exact commands/results): the full FastAPI + job-polling + tempo/key/
  chord/pitch/section pipeline against an 8-second synthetic fixture with
  known ground truth (tempo, key, and pitches all recovered exactly), and
  Demucs's subprocess wiring up through model-loading. **Not** verified
  here: an actual Demucs model-weight download (this sandbox's outbound
  proxy blocks the specific host it downloads from — a sandbox network
  policy, not a code defect, same category of limitation as the GitHub
  Pages curl check below) or runtime/memory behavior on a real 3-4 minute
  song. Try `/separate` on a real file once outside this sandbox before
  trusting it end-to-end.
- **This session's Phase 5 work has not been pushed through CI yet** —
  `pnpm validate`-equivalent (lint/typecheck/test/build, all green — see
  "Commands to reproduce") and `local-engine`'s own `pytest` (20/20
  passing) were run locally in this sandbox, but nothing has been pushed
  or opened as a PR yet. `local-engine`'s Python code is not part of any
  existing CI workflow — `.github/workflows/` only runs the TS/pnpm side
  today; add a Python CI job before relying on it there.
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

- **`local-engine` composes four single-purpose provider endpoints behind
  one `AudioAnalysisProvider`** (`LocalEngineAudioAnalysisProvider` in
  `apps/web/src/lib/local-engine-client.ts`) rather than having each
  standalone provider (`PitchExtractionProvider`, etc.) figure out tempo
  independently — those interfaces have no `bpm` parameter, so used
  standalone they each self-sufficiently re-derive tempo via the chords
  endpoint (correct but wasteful); the composed path derives it once
  (from the instrumental stem) and threads it through pitch/section calls,
  which is what the actual "오디오 업로드" UI flow uses.
- **local-engine's heavy operations are background jobs polled via
  `GET /jobs/{id}`**, not one long-blocking HTTP request — matches
  `ProgressState`/`getProgress()` in `providers.ts`. Cancellation is
  explicitly best-effort (documented in `jobs.py`'s module docstring): a
  computation already inside Demucs/basic-pitch can't actually be
  interrupted from Python, only kept from being served.
- **No numeric "confidence" in local-engine is a placeholder** — chord/key
  confidence come from real template-similarity/correlation math
  (`chroma_math.py`), separation confidence is an explicit, documented
  energy-ratio *proxy* (not a verified accuracy score — no clean reference
  signal exists to check against), consistent with AGENTS.md's rule
  against fabricated confidence numbers.
- **Section *type* labeling is deliberately scoped down** to a same-song
  relative-RMS-energy heuristic rather than attempting a trained
  verse/chorus classifier — boundaries (a real self-similarity
  segmentation result) are more trustworthy than the label, and the
  existing section table already lets users rename by hand.
- **MP3 rendering reuses the live-playback scheduling code as-is** via
  `OfflineAudioContext` (`renderMixOffline` in `audio-engine.ts`) instead
  of a separate offline-only implementation — required widening
  `schedulePlayback`/`playAudioBuffer`'s context parameter type from
  `AudioContext` to `BaseAudioContext` (both extend it; `OfflineAudioContext`
  doesn't extend `AudioContext` directly, so the narrower type would have
  rejected it) rather than duplicating the note-scheduling math for an
  offline path.
- **Demucs is invoked via its own CLI as a subprocess**, not its lower-level
  Python API — `--two-stems=vocals` already does exactly the split needed,
  so calling it directly avoided re-implementing model-loading/output
  handling that the CLI already does correctly.
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

1. **Push Phase 5's work through a PR and real CI**, the way the previous
   deploy work was (see the PR #1 → #2 pattern below) — nothing in this
   session's local-engine/apps/web changes has run on GitHub's actual
   infrastructure yet, only in this local sandbox. Also worth adding: a
   Python CI job for `local-engine` (`pip install -r requirements-dev.txt
   && pytest`) — no workflow currently runs it.
2. **Try `/separate` against a real song outside this sandbox** — the
   Demucs model-weight download couldn't be verified here (proxy blocks
   the download host; see "Known failures"). First real use needs a
   working internet connection once.
3. **Human sanity check**: open https://tel0070.github.io/Duet_maker/ in
   an ordinary browser and confirm it loads — the one verification step
   this session's own sandboxed environment could not perform itself (see
   "Known failures" above). Everything else about the deploy is already
   confirmed via GitHub's own job logs. (Carried over, unchanged, from
   before this session's Phase 5 work.)
4. Phase 4 (vocal file analysis / **browser-side**, no local-engine) is
   still not started — Phase 5 covers the full-mix-upload case with a
   local server instead, so Phase 4 remains a distinct, smaller-scoped
   item if a no-install-required in-browser path is ever wanted too.

## Commands to reproduce current state

```bash
pnpm install
pnpm validate    # lint + typecheck + test + build, all packages
pnpm test:e2e    # Playwright — drag/resize (notes + chord/section bands), section regen, playback, recording, sync, project management
```

```bash
# local-engine (separate venv, see local-engine/README.md)
cd local-engine && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest -q
```

Expected: all green. As of this handoff: 207 TS unit tests (20
shared-types + 104 harmony-core + 83 web) and 33 Playwright e2e tests, all
passing; lint and typecheck clean; build succeeds. `local-engine`: 20
pytest tests passing (verified in this sandbox — see "Known failures" for
what wasn't).

To see it running locally: `pnpm dev`, click "편곡 시작하기 (Beta)", pick a
sample, "화음 생성", try "가이드 재생" → "함께 재생" (try the "구간 반복"
and "카운트인" toggles too, and the new "MP3로 내보내기" button), "녹음" →
"녹음 시작", "재생하며 녹음" to try both together (grant the microphone
permission prompt), add a note or rename the project to see it appear
under "최근 프로젝트", drag a chord or section band on the piano roll, and
try "재생성" on a section that isn't the last one to see two-sided
continuity in action. For Phase 5: start `local-engine` first
(`scripts\start-local-engine.bat`, or the manual steps in
`local-engine/README.md`), then in the editor's "오디오 업로드" section
click "다시 확인" (should report "로컬 엔진 연결됨"), upload an mp3/wav,
watch the progress text, and confirm the melody/chord/section tables and
key/BPM fields filled in — then try the new "업로드한 오디오와 화음 함께
듣기" panel's mute toggles and "MP3로 내보내기".

## Files changed in the latest major work (this session)

Building Phase 5 (audio upload → auto-analysis) end-to-end, from a
standing start (`local-engine/` was just a status README before this):

- `local-engine/app/` — new FastAPI service: `main.py` (routes + job
  wiring), `jobs.py` (background-job registry), `separation.py` (Demucs
  subprocess wrapper), `pitch.py` (basic-pitch wrapper),
  `audio_features.py` (librosa: beat tracking, beat-synced chroma, RMS,
  segmentation), `chroma_math.py` (pure key/chord classification math),
  `keychords.py` (composes the above into tempo+key+chords),
  `sections.py` (composes into labeled sections), `beatmath.py` (pure
  seconds↔beats conversion), `schemas.py` (pydantic response models).
- `local-engine/tests/` — 20 pytest tests: pure math (`beatmath`,
  `chroma_math`, chord-merging) plus `test_api.py`'s real end-to-end
  FastAPI+pipeline run against a synthetic fixture with known ground
  truth.
- `local-engine/requirements.txt`, `requirements-dev.txt`, `pytest.ini` —
  new; see the file for the CPU-vs-CUDA-torch install-size caveat found
  while building this.
- `local-engine/README.md` — rewritten from "not yet implemented" to
  actual setup/usage/verified-status/limitations documentation.
- `apps/web/src/lib/local-engine-client.ts` — new: HTTP client
  implementing `StemSeparationProvider`/`PitchExtractionProvider`/
  `ChordDetectionProvider`/`SectionDetectionProvider`/
  `AudioAnalysisProvider` against local-engine's job-polling API.
- `apps/web/src/components/AudioUploadPanel.tsx` (+ `.css`) — new: the
  "오디오 업로드" panel (availability check, upload, live progress,
  summary).
- `apps/web/src/components/AudioMixPlayer.tsx` (+ `.css`) — new: mixed
  playback of vocal/instrumental stems + generated harmony with
  independent mute/volume per track, plus MP3 export of that mix.
- `apps/web/src/lib/mp3-export.ts` — new: pure-JS MP3 encoding
  (`@breezystack/lamejs`) over a rendered `AudioBuffer`.
- `apps/web/src/lib/audio-engine.ts` — added `decodeAudioBlob`,
  `playAudioBuffer`, `renderMixOffline`, exported `totalDurationSeconds`
  (de-duplicated out of `PlaybackPanel.tsx`); widened
  `schedulePlayback`/`playAudioBuffer`'s context parameter from
  `AudioContext` to `BaseAudioContext` so `OfflineAudioContext` (needed
  for offline MP3 rendering) can be passed in too.
- `apps/web/src/components/PlaybackPanel.tsx` — added an "MP3로
  내보내기" button (renders melody+harmony as guide tones, offline).
- `apps/web/src/store/project-store.ts` — added `importAudioAnalysis`
  (bulk-replaces key/bpm/melody/chords/sections from an analysis result).
- `apps/web/src/pages/EditorPage.tsx`, `LandingPage.tsx` — wired the new
  panels in; flipped the landing page's "음원 업로드·자동 분석" feature
  entry from "준비 중" to "Requires Local Engine".
- `.env.example` — documented the optional `VITE_LOCAL_ENGINE_URL`
  override.
- `AGENTS.md`, `ROADMAP.md`, `docs/MODEL_RESEARCH.md`, `CHANGELOG.md` —
  updated implementation-status table, Phase 5 checklist, new
  models-used table (Demucs/basic-pitch/librosa/KS-algorithm, with
  licenses and why), and user-visible changelog entries.
- `apps/web/tests/e2e/piano-roll-drag.spec.ts` — added
  `scrollIntoViewIfNeeded()` before 3 tests' `boundingBox()` calls; adding
  the new "오디오 업로드" section above the piano roll pushed those
  elements below the default viewport, and their raw `page.mouse.move`/
  `dblclick` calls (unlike locator `.click()`) don't auto-scroll. Found by
  actually running `pnpm test:e2e`, not assumed safe. See
  `docs/DECISIONS.md`.
- `AudioUploadPanel.tsx`'s health check was originally wired to run
  automatically on mount; that broke 9 *other* "no console errors" e2e
  tests (a failed `fetch` to an unreachable local-engine logs a browser
  console error regardless of the JS `catch`) — fixed by making the check
  manual-only. Also found only by running the real e2e suite. See
  `docs/DECISIONS.md`.

Validated locally: `pnpm validate` (lint/typecheck/test/build, all
green — 207 TS tests), `pnpm test:e2e` (33/33 Playwright tests, after the
two fixes above), and `local-engine`'s own `pytest` (20/20, including
a real pipeline run, not just mocks). **Not yet pushed through CI or a
PR** — see "Next recommended task".

(Prior major work: getting the project's first real deployment live
after merging the entire project into `main` via PR #1, fixing 3
CI-config bugs found only by running against real GitHub infrastructure
— see git history for exact diffs.)

(Prior major work: two-sided section-regeneration continuity,
chord/section piano-roll dragging, multi-project management, syncing
recording with playback, A-B loop/count-in, microphone recording, guide
playback, section-level regeneration, piano-roll drag editing, and the
initial Phase 2 editor — see earlier commits.)

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
- **Separation/analysis quality on a real song** — this session verified
  the pipeline's *correctness* against a synthetic fixture with known
  ground truth, not its perceptual *quality* against an actual recording
  (real vocals have vibrato, breathiness, reverb, etc. the synthetic test
  tone didn't). Try it on a few real songs and judge whether the
  separated vocal/instrumental and detected chords/sections are actually
  useful, not just non-crashing.
- **local-engine install friction** — is `pip install -r requirements.txt`
  (several GB, the CPU-vs-CUDA-torch trap documented in
  `local-engine/README.md`) an acceptable ask for this app's actual
  users, or does it need a friendlier install path (a bundled installer,
  a Docker image, clearer step-by-step docs) before Phase 5 is really
  "done" for a non-technical user?
