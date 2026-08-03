"""Pure time-unit conversion. No audio/model dependency — see docs/DATA_FORMATS.md:
NoteEvent/ChordEvent/SongSection timing is beats (quarter notes) from song start,
but every audio analysis library here works in seconds. This is the single seam
where seconds become beats, so it stays isolated and unit-tested on its own.
"""


def seconds_to_beats(seconds: float, bpm: float) -> float:
    if bpm <= 0:
        raise ValueError(f"bpm은 0보다 커야 합니다: {bpm}")
    return seconds * bpm / 60.0


def beats_to_seconds(beats: float, bpm: float) -> float:
    if bpm <= 0:
        raise ValueError(f"bpm은 0보다 커야 합니다: {bpm}")
    return beats * 60.0 / bpm


def round_beats(beats: float, resolution: float = 1 / 16) -> float:
    """Snaps to the nearest `resolution`-beat grid line (default: 1/16 note).

    Raw audio-derived timing is noisy at the microsecond level; the piano
    roll UI already snaps user edits to a grid, so analysis results should
    land on the same grid rather than showing distracting fractional beats.
    """
    if resolution <= 0:
        raise ValueError(f"resolution은 0보다 커야 합니다: {resolution}")
    return round(beats / resolution) * resolution
