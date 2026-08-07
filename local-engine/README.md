# local-engine

Optional, localhost-only Python service (AGENTS.md/ROADMAP.md Phase 5). Turns
an uploaded audio file (mp3/wav/etc.) into the same data shapes
`packages/harmony-core` already consumes — melody notes, chords, sections,
key, bpm — so a solo recording can skip manual note/chord entry entirely.

**Nothing here ever leaves this machine.** The web app only talks to
`http://127.0.0.1:8000`; this service binds to `127.0.0.1` only (never
`0.0.0.0`) and makes no outbound network calls itself except the
one-time model-weight downloads noted below. See `docs/PRIVACY.md`.

## What it does

| Endpoint | Model/technique | Output |
|---|---|---|
| `POST /separate` | [Demucs](https://github.com/facebookresearch/demucs) (`htdemucs`, two-stems) | vocal stem + instrumental stem (wav) |
| `POST /pitch/analyze` | [basic-pitch](https://github.com/spotify/basic-pitch) | melody `NoteEvent[]` (run this on the *vocal stem*, not the full mix) |
| `POST /analyze/tempo-key-chords` | librosa beat tracking + chroma, Krumhansl-Schmuckler key profiles, chord template matching | `bpm`, `key`, `ChordEvent[]` |
| `POST /analyze/sections` | librosa chroma/timbre self-similarity segmentation + RMS energy | `SongSection[]` (boundaries are a real signal-processing result; the verse/chorus *type* label is a coarse energy-based guess — rename freely in the editor) |

Every endpoint starts a background job and returns `{"jobId": ...}`
immediately; poll `GET /jobs/{jobId}` for `{stage, fraction, done, error}`
(Korean `stage` text, matches `ProgressState` in
`packages/shared-types/src/providers.ts`), then fetch the type-specific
result endpoint once `done` is true. `POST /jobs/{jobId}/cancel` exists but
is best-effort — a computation already inside Demucs/basic-pitch can't
actually be interrupted from Python, so cancelling only stops the result
from being served, not the CPU work already in flight.

No numeric "confidence" field here is a placeholder — every one is computed
from the actual audio (template-match similarity, KS correlation, an
energy-ratio proxy for separation, etc.), documented in each module's
docstring. `/separate`'s confidence is explicitly *not* a verified
separation-accuracy score (that needs a clean reference this app never has)
— it is a coarse proxy and is described as such in `app/separation.py`.

## Setup

**Option A — standalone .exe, no Python required (Windows):** Download
the zip from **https://github.com/tel0070/Duet_maker/releases/tag/local-engine-latest**
(public, no GitHub login needed — a direct Actions-artifact download
does require sign-in and is easy to miss, which is why this Release
exists instead). Unzip it and run `duet-maker-local-engine.exe`
*from inside the extracted folder* — it's a `--onedir` build, not a
single self-contained file, so it needs the files next to it; don't
move just the .exe out on its own. ~750MB total (bundles
PyTorch/TensorFlow/Demucs/basic-pitch/librosa plus a static
ffmpeg+ffprobe — see bug 6 below — via PyInstaller).

**This exe bundles the web app itself and opens it in your default
browser automatically** — `app.main` mounts apps/web's production build
(copied into `static/` by the build workflow) as a fallback route behind
every API endpoint, and `app_entry.py` polls `/health` on a background
thread and calls `webbrowser.open()` the moment the server is actually
up. Running the exe is the whole experience: no separate `pnpm dev`, no
typing a URL, just a console window (leave it open — closing it stops
the server) and a browser tab with the working app. If the tab doesn't
open on its own, the console prints the exact URL to open by hand.

That Release is rebuilt in place (same URL every time) by the "Build
local-engine Windows Executable" workflow (Actions tab →
`workflow_dispatch`, ~10 minutes) whenever local-engine's dependencies,
`app_entry.py`, or the web app change.

Bugs found and fixed while getting this exe to actually run, in order —
kept here because every one of them will resurface if this build is ever
redone from scratch without this history:
1. `--onefile` re-extracts its entire payload to a fresh temp directory
   on *every* launch — with this much bundled, several minutes of a
   black window with a blinking cursor and zero output before anything
   starts, easily mistaken for a hang. Fixed by switching to `--onedir`
   (unpacks once at build time).
2. Windows Explorer's zip extractor refuses paths past ~260 characters;
   torch bundles a `licenses/` folder that vendors *other* projects'
   license texts 6-7 directories deep (torch → kineto → ... → duktape).
   Fixed by deleting any `licenses/` folder directly under a
   `*.dist-info` directory after the build (pure copyright text, not
   imported by anything) and torch's `include/` C++ headers (also
   unused at runtime, ~37MB/9000+ files, another source of long paths).
3. The exe crashed on launch with `ModuleNotFoundError: No module named
   'backports'` — pkg_resources's PyInstaller runtime hook imports
   `jaraco.context`, which needs `backports.tarfile`, a separate PyPI
   distribution that was never actually installed in the build
   environment (so `--collect-all backports` had nothing real to
   collect — confirmed by the build log's own "not a package" warning).
   Fixed by `pip install backports.tarfile` before building.
4. (Architecture change, not a bug fix) The exe originally only ran the
   headless analysis API with no visible result — confusing on its own.
   Fixed by bundling the web app's build output and auto-opening it, as
   described above, instead of asking the user to separately run
   `pnpm dev`.
5. Found by a from-scratch code audit (not a user report): `/separate`
   ran `subprocess.run(["python3", "-m", "demucs", ...])`, but the frozen
   exe has no standalone `python3` binary to spawn at all — this always
   failed silently in the exe even after every fix above, since no crash
   had ever gotten far enough at runtime to reach this code path. Fixed
   by calling `demucs.separate.main([...])` directly in-process (see
   `app/separation.py`), with `SystemExit` converted to a real exception
   since demucs signals failure via `sys.exit(1)`, which a bare
   `except Exception` in `jobs.py` would not otherwise catch.
6. Found by the same audit, one layer deeper: even after fix 5, demucs's
   own `AudioFile` loads every input file — `.wav` included, not just
   `.mp3` — by shelling out to the literal `ffmpeg`/`ffprobe` commands via
   PATH lookup, and its fallback (`torchaudio.load()`) also fails on this
   pinned torchaudio version because it needs the separate, unbundled
   `torchcodec` package for every format. Windows has no ffmpeg
   preinstalled, so `/separate` would still fail end-to-end on every real
   upload. Confirmed directly (synthetic `.mp3` and `.wav` both failed the
   same way; both succeeded once real `ffmpeg`+`ffprobe` binaries were put
   on `PATH`). Fixed by downloading a static Windows ffmpeg+ffprobe build
   (BtbN, LGPL) in the build workflow, bundling both via `--add-binary`,
   and prepending their directory to `PATH` at import time in
   `app/separation.py` (a no-op outside the frozen exe).
7. (Not an exe-specific bug — reported by a real user running the exe on
   their own machine) The whole computer, not just this app, froze while a
   real song was processing. Cause: torch (demucs) and numpy/scipy's BLAS
   backends default to using every CPU core, starving every other running
   program. Fixed by capping thread counts (`OMP_NUM_THREADS` and friends
   in `app/main.py`'s `_cap_cpu_threads()`, plus `torch.set_num_threads()`
   directly in `app/separation.py`) to `cpu_count - 1`, leaving one core
   free. This does not make separation itself faster — on-device ML
   inference on a CPU is genuinely slow, minutes for a real song — it just
   stops it from locking out everything else while it runs.
8. Reported by the same real user, on the next attempt after fix 6 shipped:
   `/separate` failed with "TorchCodec is required for
   save_with_torchcodec." — demucs writes every separated `.wav` via
   `torchaudio.save()`, which (separately from the *loading* side fixed in
   6) also needs the unbundled `torchcodec` package on this pinned
   torchaudio version, for saving. Bundling ffmpeg/ffprobe doesn't touch
   this at all — it's a direct Python call into torchcodec, not a
   subprocess. Fixed by monkeypatching both `torchaudio.save` and
   `torchaudio.load` to thin soundfile-backed implementations before
   demucs ever runs (`app/separation.py`'s
   `_patch_torchaudio_to_avoid_torchcodec()`) — soundfile has no
   ffmpeg/torchcodec dependency at all. Verified directly: the patched
   `save`/`load` round-trip a real tensor correctly, and demucs's own
   `load_track()` now succeeds even with *no* ffmpeg/ffprobe on `PATH`
   at all (it falls through to the patched `torchaudio.load`).
9. Reported by the same real user, after fixes 5-8 all shipped and the
   pipeline finally ran end-to-end on a real song: the generated harmony
   sounded completely off-beat, and the harmony pitches didn't fit either.
   Root cause: this app used a single averaged bpm for the *entire* song to
   convert every note/chord/section's timing between seconds and "beats"
   (`beatmath.seconds_to_beats`, anchored at t=0 with one constant tempo).
   Confirmed directly on the user's own exported mix: librosa's beat
   tracker measured the real tempo climbing from ~130 to ~131 BPM
   start-to-finish - under 1% per beat, but a real user's actual song is
   essentially never *perfectly* constant-tempo, and that error compounds
   linearly over a multi-minute song into a drift large enough to throw
   generated harmony completely off the real beat by the second half (and
   any harmony landing on the wrong instant sounds wrong against whatever
   chord is *actually* playing there).

   Fixed by introducing a real beat-time tempo map: `beatmath.py`'s
   `seconds_to_beats_with_map`/`beats_to_seconds_with_map` use the actual
   detected beat timestamps (already computed by librosa's beat tracker,
   previously discarded down to one scalar) instead of a constant-tempo
   formula, piecewise-linear between real beats and extrapolated past
   either edge. `keychords.py` now returns this map (`beatTimes`) alongside
   `bpm`; `pitch.py`/`sections.py` and their `/pitch/analyze`/
   `/analyze/sections` endpoints take it instead of a bare bpm number
   (JSON-encoded in a `beat_times` form field, since it's an array).
   `apps/web`'s `audio-engine.ts` gained the mirror-image
   `beatsToSecondsWithMap`, and `notesToScheduled`/`harmonyToScheduled`/
   `renderMixOffline` now accept either a scalar bpm (kept for existing
   tests and the MIDI export's single-tempo track, a known remaining gap -
   see HomePage.tsx) or this real map — `AudioMixPlayer.tsx` always passes
   the map now, so playback/export mixing stays locked to the song's actual
   rhythm. Verified with new unit tests on both sides (a real local tempo
   change the old scalar formula gets measurably wrong) and a real browser
   run confirming the new `beat_times` field actually reaches the analyze
   endpoints.

The static-file-serving side of this (step 4) was verified locally
against a real `apps/web` production build via FastAPI's `TestClient` —
`/` serves `index.html`, `/assets/*` serves real built JS/CSS, unknown
paths still 404 — before ever pushing to CI. The exe's actual launch
(server starts, browser opens, page loads) has been confirmed to *build*
successfully on GitHub's real windows-latest CI; whether it now runs
end-to-end on a real Windows machine is the next thing to confirm.

**Option B — Python install:**

```
scripts\start-local-engine.bat
```

on Windows creates a venv, installs `requirements.txt`, and runs
`uvicorn app.main:app --reload` (binds `127.0.0.1:8000` by default). On
macOS/Linux, do the equivalent by hand:

```
cd local-engine
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Install size / the CPU-vs-GPU torch trap:** Demucs depends on PyTorch.
`pip install -r requirements.txt` can resolve a CUDA-enabled torch wheel
even on a machine with no CUDA setup, pulling several GB of GPU libraries
this app never uses (verified while building this: it added ~8GB). If that
matters, install the CPU-only wheel *first*, then the rest:

```
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements.txt
```

`basic-pitch` pulls in TensorFlow regardless of which optional backend
extra (`[onnx]`, `[tf]`, `[coreml]`) is chosen — the extras add an
*additional* inference path, they don't replace the base TensorFlow
dependency. Budget a few GB total for a working install either way.

Demucs downloads the `htdemucs` model weights (~80MB) on first real use and
caches them under `~/.cache/torch/hub`; that first `/separate` call needs
a working internet connection once.

**ffmpeg/ffprobe:** demucs loads every audio file it separates (any
format, `.wav` included) by shelling out to the external `ffmpeg` and
`ffprobe` commands. The standalone exe bundles both (see bug 6 above) —
a Python install (Option B) does not, so install ffmpeg yourself and make
sure both `ffmpeg` and `ffprobe` are on `PATH` before calling `/separate`.

## Verified in development (2026-07-30)

Confirmed by actually running the pipeline end-to-end against synthetic
audio with a known ground truth (`pytest`, `tests/test_api.py`): tempo,
key, and pitch detection recovered the exact values the test fixture was
constructed with. `/separate` was confirmed to wire up correctly (FastAPI →
background job → `demucs.separate.main()` → model-loading code path), and
`demucs`'s own file-loading step (`AudioFile`/`ffmpeg`/`ffprobe`) was
confirmed directly against both a synthetic `.wav` and a real `.mp3` with
static ffmpeg/ffprobe binaries on `PATH` (see bug 6 above) — both loaded
successfully. What could *not* be verified from this dev sandbox is the
actual `htdemucs` model-weight download, since the sandbox's network policy
blocks that specific outbound host — that is a sandbox network policy, not
a code issue (a normal machine has no such restriction). Try `/separate`
yourself once end-to-end and open an issue if anything past the download
fails outside this dev sandbox.

## Known limitations

- Chord detection covers every `ChordQuality` in `packages/shared-types`
  (maj/min/dim/aug/maj7/min7/dom7/m7b5/dim7/sus2/sus4/five) via template
  matching against 144 root×quality combinations — but it's still simple
  cosine-similarity template matching, not a trained model, so genuinely
  ambiguous or noisy real-audio frames (e.g. a 7th's energy partly masked
  by vocal harmonics) will sometimes get simplified to the nearest triad.
  No slash chords (`bass`) or extensions beyond a single 7th are detected.
- Section *type* labeling (verse vs. chorus) is a same-song relative-energy
  heuristic, not a trained classifier — expect to rename sections by hand
  sometimes.
- Single in-memory job registry, no persistence across a restart, and no
  concurrent-job limit — this is a single-local-user tool, not a service
  meant to handle multiple simultaneous uploads.
