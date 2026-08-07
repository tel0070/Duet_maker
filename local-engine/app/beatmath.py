"""Pure time-unit conversion. No audio/model dependency — see docs/DATA_FORMATS.md:
NoteEvent/ChordEvent/SongSection timing is beats (quarter notes) from song start,
but every audio analysis library here works in seconds. This is the single seam
where seconds become beats, so it stays isolated and unit-tested on its own.
"""

import bisect


def seconds_to_beats(seconds: float, bpm: float) -> float:
    if bpm <= 0:
        raise ValueError(f"bpm은 0보다 커야 합니다: {bpm}")
    return seconds * bpm / 60.0


def beats_to_seconds(beats: float, bpm: float) -> float:
    if bpm <= 0:
        raise ValueError(f"bpm은 0보다 커야 합니다: {bpm}")
    return beats * 60.0 / bpm


def seconds_to_beats_with_map(seconds: float, beat_times: list[float]) -> float:
    """Like `seconds_to_beats`, but anchored to the REAL detected beat grid
    (`beat_times[i]` = the actual timestamp of beat i) instead of a single
    constant-tempo formula. `seconds_to_beats`'s "one bpm for the whole
    song" assumption drifts for any real song whose tempo isn't perfectly
    constant — confirmed on a real user's song, where librosa's own beat
    tracker measured tempo climbing from ~130 to ~131 BPM start-to-finish.
    That's under 1% per beat, but it accumulates linearly over a
    multi-minute song into a drift large enough to throw generated harmony
    completely off the real beat by the second half. Extrapolates using
    the nearest real interval's local tempo for time before the first
    detected beat or after the last one, rather than clamping — a note
    there still needs *some* beat position, not a wrong one at the edge.
    """
    if len(beat_times) < 2:
        raise ValueError("beat_times는 최소 2개 이상의 박자가 필요합니다.")
    if seconds <= beat_times[0]:
        i = 0
    elif seconds >= beat_times[-1]:
        i = len(beat_times) - 2
    else:
        i = max(0, min(bisect.bisect_right(beat_times, seconds) - 1, len(beat_times) - 2))
    interval = beat_times[i + 1] - beat_times[i]
    if interval <= 0:
        return float(i)
    return i + (seconds - beat_times[i]) / interval


def beats_to_seconds_with_map(beats: float, beat_times: list[float]) -> float:
    """Inverse of `seconds_to_beats_with_map`."""
    if len(beat_times) < 2:
        raise ValueError("beat_times는 최소 2개 이상의 박자가 필요합니다.")
    i = int(beats) if beats >= 0 else 0
    i = min(i, len(beat_times) - 2)
    interval = beat_times[i + 1] - beat_times[i]
    return beat_times[i] + (beats - i) * interval


def round_beats(beats: float, resolution: float = 1 / 16) -> float:
    """Snaps to the nearest `resolution`-beat grid line (default: 1/16 note).

    Raw audio-derived timing is noisy at the microsecond level; the piano
    roll UI already snaps user edits to a grid, so analysis results should
    land on the same grid rather than showing distracting fractional beats.
    """
    if resolution <= 0:
        raise ValueError(f"resolution은 0보다 커야 합니다: {resolution}")
    return round(beats / resolution) * resolution
