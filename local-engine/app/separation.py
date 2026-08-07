"""Wraps Meta's Demucs (MIT-licensed, on-device source separation) by
calling its CLI entry point's `main()` function in-process, since its
`--two-stems` mode already implements exactly the vocal/instrumental split
this app needs — reimplementing that against the lower-level model API
would just be duplicating what the CLI already does.

This calls `demucs.separate.main()` directly rather than spawning
`python3 -m demucs` as a subprocess (an earlier version of this file did
exactly that) — the standalone .exe build has no standalone `python3`
binary on the target machine to spawn at all, so that subprocess call
would always fail there even though it happens to work when local-engine
itself runs from an actual Python install with `python3` on PATH. Calling
the same function in-process works identically in both cases.

Separately, `_ensure_bundled_ffmpeg_on_path()` below works around demucs's
own file-loading step needing the external `ffmpeg`/`ffprobe` binaries,
which Windows doesn't ship and the exe doesn't otherwise bundle.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

import demucs.separate
import librosa
import numpy as np
import torch

MODEL_NAME = "htdemucs"


def _ensure_bundled_ffmpeg_on_path() -> None:
    """demucs.audio.AudioFile loads every input file (regardless of
    extension, wav included) by shelling out to the literal `ffmpeg` and
    `ffprobe` command names via subprocess + PATH lookup - confirmed by
    running it directly against both a synthetic .wav and .mp3 with neither
    binary on PATH: it fails first with `FileNotFoundError: ffprobe`, and
    even demucs's own torchaudio fallback fails too (this pinned torchaudio
    version's ta.load() requires the separate, unbundled `torchcodec`
    package for every format). Windows has no ffmpeg preinstalled, so the
    standalone exe bundles static ffmpeg/ffprobe binaries (see
    build-local-engine-exe.yml) and this prepends their directory to PATH
    before demucs ever runs. A no-op outside the frozen exe - a `pip
    install -r requirements.txt` dev setup needs ffmpeg on PATH already,
    same as running demucs directly would.
    """
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))
    ffmpeg_dir = base / "ffmpeg_bin"
    if ffmpeg_dir.is_dir():
        os.environ["PATH"] = str(ffmpeg_dir) + os.pathsep + os.environ.get("PATH", "")


_ensure_bundled_ffmpeg_on_path()

# Belt-and-suspenders alongside main.py's _cap_cpu_threads() env vars: this
# is torch's own authoritative thread-count API, called directly in case a
# given torch build doesn't honor OMP_NUM_THREADS the same way.
torch.set_num_threads(max(1, (os.cpu_count() or 4) - 1))


class SeparationError(RuntimeError):
    pass


def run_separation(input_path: str, output_dir: str) -> dict:
    track_name = Path(input_path).stem
    try:
        demucs.separate.main(
            ["--two-stems=vocals", "-n", MODEL_NAME, "-o", output_dir, input_path]
        )
    except SystemExit as exc:
        # demucs.separate.main() reports failure via dora.log.fatal(), which
        # calls sys.exit(1) instead of raising a normal exception — convert
        # it so jobs.py's `except Exception` actually catches it (a bare
        # SystemExit doesn't inherit from Exception and would otherwise
        # silently leave the job marked done with no error and no result).
        raise SeparationError(f"보컬 분리에 실패했습니다 (demucs 종료 코드: {exc.code}).") from exc

    vocal_path = Path(output_dir) / MODEL_NAME / track_name / "vocals.wav"
    instrumental_path = Path(output_dir) / MODEL_NAME / track_name / "no_vocals.wav"
    if not vocal_path.exists() or not instrumental_path.exists():
        raise SeparationError("보컬 분리 결과 파일을 찾을 수 없습니다.")

    confidence = _estimate_separation_confidence(input_path, str(vocal_path))
    return {"vocalPath": str(vocal_path), "instrumentalPath": str(instrumental_path), "confidence": confidence}


def _estimate_separation_confidence(original_path: str, vocal_path: str) -> float:
    """A coarse, genuinely-computed proxy — the vocal stem's share of the
    original mix's energy — not a verified separation-accuracy score (that
    would need a clean reference signal this app never has). Kept in the
    plausible 0.3-0.9 range for a normal song: near-silent or all-vocal
    inputs would otherwise report a misleadingly extreme number.
    """
    try:
        y_original, sr = librosa.load(original_path, sr=22050, mono=True)
        y_vocal, _ = librosa.load(vocal_path, sr=22050, mono=True)
    except Exception:
        return 0.5

    original_energy = float(np.sum(y_original**2))
    vocal_energy = float(np.sum(y_vocal**2))
    if original_energy <= 0:
        return 0.5
    ratio = vocal_energy / original_energy
    return max(0.3, min(0.9, 0.3 + ratio))
