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

    chord_events = []
    for chord in merged:
        start_beats = beatmath.round_beats(beatmath.seconds_to_beats(chord["startSeconds"], bpm))
        duration_beats = beatmath.round_beats(
            beatmath.seconds_to_beats(chord["endSeconds"] - chord["startSeconds"], bpm)
        )
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
