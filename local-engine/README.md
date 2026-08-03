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

## Verified in development (2026-07-30)

Confirmed by actually running the pipeline end-to-end against synthetic
audio with a known ground truth (`pytest`, `tests/test_api.py`): tempo,
key, and pitch detection recovered the exact values the test fixture was
constructed with. `/separate` was confirmed to wire up correctly (FastAPI →
background job → `demucs` subprocess → model-loading code path), but the
actual model-weight download could not be verified from the sandbox this
was built in, which blocks that specific outbound host — that is a sandbox
network policy, not a code issue (a normal machine has no such
restriction). Try `/separate` yourself once and open an issue if the
download itself fails outside this dev sandbox.

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
