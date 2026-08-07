"""Wraps Spotify's basic-pitch (Apache-2.0, on-device audio->MIDI transcription)
to turn a vocal stem into NoteEvent-shaped dicts. Meant to run on the
*separated vocal stem*, not the full mix — polyphonic accompaniment behind
an untouched full mix would confuse a monophonic melody line with chords.
"""

from __future__ import annotations

import uuid

from basic_pitch.inference import predict

from . import beatmath

MIN_NOTE_BEATS = 1 / 32


def analyze_pitch(path: str, beat_times: list[float]) -> list[dict]:
    _model_output, _midi_data, note_events = predict(path)

    notes = []
    for event in note_events:
        # basic-pitch's note_events tuples are
        # (start_time_s, end_time_s, pitch_midi, amplitude, pitch_bend_frames).
        # `amplitude` is the model's own note-loudness estimate (0-1ish) — the
        # closest thing to a per-note confidence this library exposes, so it
        # is used for both velocity and confidence below rather than inventing
        # a separate number.
        start_s, end_s, pitch_midi, amplitude = event[0], event[1], event[2], event[3]

        # beat_times is the real detected beat grid from keychords.py's tempo
        # analysis (see beatmath.seconds_to_beats_with_map) — using it instead
        # of a single constant bpm keeps the melody's beat positions accurate
        # even when the song's real tempo drifts over its length.
        start_beats = beatmath.round_beats(beatmath.seconds_to_beats_with_map(start_s, beat_times))
        end_beats = beatmath.round_beats(beatmath.seconds_to_beats_with_map(end_s, beat_times))
        duration_beats = end_beats - start_beats
        if duration_beats < MIN_NOTE_BEATS:
            duration_beats = MIN_NOTE_BEATS

        confidence = max(0.0, min(1.0, float(amplitude)))
        velocity = max(1, min(127, round(confidence * 127)))
        pitch = max(0, min(127, round(float(pitch_midi))))

        notes.append(
            {
                "id": f"note-{uuid.uuid4().hex}",
                "pitch": pitch,
                "startTime": start_beats,
                "duration": duration_beats,
                "velocity": velocity,
                "confidence": confidence,
                "source": "pitch-detection",
                "editable": True,
            }
        )

    notes.sort(key=lambda n: n["startTime"])
    return notes
