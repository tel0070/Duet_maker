"""Section-boundary detection (chroma/timbre self-similarity) plus an
energy-based verse/chorus labeling heuristic. Boundaries come from a
genuine signal-processing technique (`librosa.segment.agglomerative`);
the section *type* label is a coarser guess (relative RMS energy only) —
callers should treat boundaries as more trustworthy than the type name,
and the UI already lets users rename a section by hand.
"""

from __future__ import annotations

import uuid

import numpy as np

from . import audio_features, beatmath


def analyze_sections(path: str, beat_times: list[float]) -> list[dict]:
    y, sr = audio_features.load_audio(path)
    boundaries = audio_features.segment_boundaries(y, sr)
    rms, times = audio_features.rms_curve(y, sr)

    if len(boundaries) < 2:
        return []

    segment_energies = [
        audio_features.mean_rms_between(rms, times, boundaries[i], boundaries[i + 1])
        for i in range(len(boundaries) - 1)
    ]
    median_energy = float(np.median(segment_energies)) if segment_energies else 0.0

    sections = []
    for i in range(len(boundaries) - 1):
        start_s, end_s = boundaries[i], boundaries[i + 1]
        energy = segment_energies[i]
        is_first = i == 0
        is_last = i == len(boundaries) - 2
        duration_s = end_s - start_s

        if is_first and energy < median_energy * 0.7 and duration_s < 15:
            section_type = "intro"
        elif is_last and energy < median_energy * 0.7 and duration_s < 20:
            section_type = "outro"
        elif energy >= median_energy * 1.05:
            section_type = "chorus"
        else:
            section_type = "verse"

        segment_rms = rms[(times >= start_s) & (times < end_s)]
        mean_rms = float(segment_rms.mean()) if segment_rms.size else 0.0
        coherence = 1.0 - float(segment_rms.std() / (mean_rms + 1e-6)) if segment_rms.size else 0.3
        confidence = max(0.1, min(1.0, coherence))

        sections.append(
            {
                "id": f"section-{uuid.uuid4().hex}",
                "type": section_type,
                # beat_times: the real detected beat grid (see pitch.py's
                # identical comment) - keeps section boundaries accurate
                # even when the song's real tempo drifts over its length.
                "startTime": beatmath.round_beats(beatmath.seconds_to_beats_with_map(start_s, beat_times)),
                "endTime": beatmath.round_beats(beatmath.seconds_to_beats_with_map(end_s, beat_times)),
                "energy": max(0.0, min(1.0, energy)),
                "harmonyDensity": max(0.0, min(1.0, 0.4 + energy * 0.4)),
                "confidence": confidence,
            }
        )

    return sections
