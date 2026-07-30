"""Wraps Meta's Demucs (MIT-licensed, on-device source separation) via its
CLI, since the CLI's `--two-stems` mode already implements exactly the
vocal/instrumental split this app needs — reimplementing that against the
lower-level Python API would just be duplicating what the CLI does.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

import librosa
import numpy as np

MODEL_NAME = "htdemucs"


class SeparationError(RuntimeError):
    pass


def run_separation(input_path: str, output_dir: str) -> dict:
    track_name = Path(input_path).stem
    result = subprocess.run(
        ["python3", "-m", "demucs", "--two-stems=vocals", "-n", MODEL_NAME, "-o", output_dir, input_path],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise SeparationError(f"보컬 분리에 실패했습니다: {result.stderr.strip()[-2000:]}")

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
