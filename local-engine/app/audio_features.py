"""librosa-backed feature extraction: tempo/beat tracking, beat-synced chroma,
RMS energy, and a chroma-similarity segmentation. Thin wrappers around
librosa calls — the actual classification math lives in chroma_math.py so it
can be unit-tested without loading real audio.
"""

from __future__ import annotations

import librosa
import numpy as np

TARGET_SR = 22050


def load_audio(path: str) -> tuple[np.ndarray, int]:
    y, sr = librosa.load(path, sr=TARGET_SR, mono=True)
    return y, sr


def estimate_tempo_and_beats(y: np.ndarray, sr: int) -> tuple[float, np.ndarray]:
    """Returns (bpm, beat_frames) — `beat_frames` are frame indices, kept as
    frames (not seconds) so callers can pass them straight into
    `librosa.util.sync` for beat-synced chroma without a second conversion.
    """
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    bpm = float(np.atleast_1d(tempo)[0])
    if bpm <= 0:
        bpm = 120.0  # librosa failed to lock onto a pulse (e.g. near-silent input) — a neutral fallback beats a crash.
    return bpm, beat_frames


def beat_synced_chroma(y: np.ndarray, sr: int, beat_frames: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Returns (chroma_by_beat with shape (n_beats, 12), boundary_times_seconds
    with shape (n_beats + 1,)) — `chroma_by_beat[i]` is the average chroma
    between `boundary_times[i]` and `boundary_times[i + 1]`.

    `librosa.util.sync(data, idx)` aggregates into `len(idx) + 1` columns: a
    leading segment before `idx[0]`, one between each consecutive pair, and
    a trailing segment after `idx[-1]` — so the matching boundary list needs
    `0` prepended and the track's frame count appended, not just `idx`
    itself, or every beat after the first is silently paired with the wrong
    time.
    """
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    n_frames = chroma.shape[1]
    frames = np.asarray(beat_frames)
    frames = frames[(frames > 0) & (frames < n_frames)]
    synced = librosa.util.sync(chroma, frames, aggregate=np.mean)  # shape (12, len(frames) + 1)
    boundary_frames = np.concatenate([[0], frames, [n_frames]])
    boundary_times = librosa.frames_to_time(boundary_frames, sr=sr)
    return synced.T, boundary_times


def rms_curve(y: np.ndarray, sr: int) -> tuple[np.ndarray, np.ndarray]:
    """Returns (rms_values, frame_times_seconds), both normalized to [0, 1]
    by the track's own peak so downstream energy comparisons are relative to
    this song, not an absolute loudness scale.
    """
    rms = librosa.feature.rms(y=y)[0]
    peak = float(rms.max()) if rms.size and rms.max() > 0 else 1.0
    normalized = rms / peak
    times = librosa.frames_to_time(np.arange(rms.shape[0]), sr=sr)
    return normalized, times


def mean_rms_between(rms: np.ndarray, times: np.ndarray, start_s: float, end_s: float) -> float:
    mask = (times >= start_s) & (times < end_s)
    if not mask.any():
        return 0.0
    return float(rms[mask].mean())


def segment_boundaries(y: np.ndarray, sr: int, target_segment_seconds: float = 20.0) -> list[float]:
    """Chroma+timbre self-similarity segmentation (`librosa.segment.agglomerative`)
    into a heuristically-chosen segment count based on track duration.
    Returns boundary times in seconds, including 0.0 and the track duration.
    """
    duration = float(librosa.get_duration(y=y, sr=sr))
    target_k = max(2, min(10, round(duration / target_segment_seconds)))

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    mfcc = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
    n_frames = min(chroma.shape[1], mfcc.shape[1])
    features = np.vstack([chroma[:, :n_frames], mfcc[:, :n_frames]])

    boundary_frames = librosa.segment.agglomerative(features, target_k)
    boundary_times = librosa.frames_to_time(boundary_frames, sr=sr).tolist()

    boundaries = sorted({0.0, *boundary_times, duration})
    return boundaries
