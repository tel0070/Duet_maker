"""Composes audio_features (librosa I/O) + chroma_math (pure classification)
into the actual analysis result: tempo, key, and a beat-quantized chord
progression — everything the frontend needs to fill in
HarmonyGenerationInput.key/bpm and ProjectFile.chords.
"""

from __future__ import annotations

import uuid

import numpy as np

from . import audio_features, beatmath, chroma_math


def analyze_tempo_key_chords(path: str) -> dict:
    y, sr = audio_features.load_audio(path)
    bpm, beat_frames = audio_features.estimate_tempo_and_beats(y, sr)
    chroma_by_beat, beat_times = audio_features.beat_synced_chroma(y, sr, beat_frames)

    overall_chroma = chroma_by_beat.mean(axis=0) if chroma_by_beat.shape[0] > 0 else np.zeros(12)
    key_label, key_confidence = chroma_math.estimate_key(overall_chroma)

    raw_chords = []
    for i in range(chroma_by_beat.shape[0]):
        root, quality, confidence = chroma_math.match_chord(chroma_by_beat[i])
        raw_chords.append(
            {
                "root": root,
                "quality": quality,
                "confidence": confidence,
                "startSeconds": float(beat_times[i]),
                "endSeconds": float(beat_times[i + 1]),
            }
        )

    merged = _merge_consecutive_chords(raw_chords)

    # `beat_times` (from beat_synced_chroma) is a *chord-segmentation*
    # boundary list: [0.0, real beat 1, real beat 2, ..., real beat N,
    # track duration] - the first and last entries are NOT real beats, just
    # "start of song" / "end of song" markers so every chord segment has a
    # boundary on both sides (see audio_features.py's docstring). Using
    # this array's edges as if they were real beat 0 and the last real beat
    # would make seconds_to_beats_with_map treat "song start -> first real
    # beat" (often several real seconds, e.g. an intro) as a single beat
    # interval - a huge, fake tempo distortion right at the start (and the
    # mirror case at the end). Stripping the two bookends leaves only real
    # detected beat positions, which is what every *_with_map conversion
    # (and the beatTimes this endpoint exposes to the frontend) should
    # anchor to; seconds_to_beats_with_map's own edge extrapolation already
    # handles notes before the first beat / after the last one correctly.
    real_beat_times = beat_times[1:-1]
    if len(real_beat_times) < 2:
        real_beat_times = beat_times

    beat_times_list = [float(t) for t in real_beat_times]

    chord_events = []
    for chord in merged:
        start_beats = beatmath.round_beats(
            beatmath.seconds_to_beats_with_map(chord["startSeconds"], beat_times_list)
        )
        end_beats = beatmath.round_beats(
            beatmath.seconds_to_beats_with_map(chord["endSeconds"], beat_times_list)
        )
        duration_beats = end_beats - start_beats
        if duration_beats <= 0:
            continue
        chord_events.append(
            {
                "id": f"chord-{uuid.uuid4().hex}",
                "root": chord["root"],
                "quality": chord["quality"],
                "extensions": [],
                "startTime": start_beats,
                "duration": duration_beats,
                "confidence": chord["confidence"],
                "source": "chord-detection",
            }
        )

    return {
        "bpm": round(bpm, 2),
        "key": key_label,
        "keyConfidence": key_confidence,
        "chords": chord_events,
        # The real, non-uniform detected beat grid — see beatmath's
        # `*_with_map` functions. `bpm` above is still the single average
        # (kept for display and for the MIDI export's single-tempo track),
        # but every other seconds<->beats conversion in this app now uses
        # this map instead, so generated harmony stays locked to the song's
        # actual rhythm even when its real tempo isn't perfectly constant.
        "beatTimes": beat_times_list,
    }


def _merge_consecutive_chords(raw_chords: list[dict]) -> list[dict]:
    if not raw_chords:
        return []
    merged = [dict(raw_chords[0])]
    confidences = [raw_chords[0]["confidence"]]
    for chord in raw_chords[1:]:
        last = merged[-1]
        if chord["root"] == last["root"] and chord["quality"] == last["quality"]:
            last["endSeconds"] = chord["endSeconds"]
            confidences.append(chord["confidence"])
        else:
            last["confidence"] = float(np.mean(confidences))
            merged.append(dict(chord))
            confidences = [chord["confidence"]]
    merged[-1]["confidence"] = float(np.mean(confidences))
    return merged
