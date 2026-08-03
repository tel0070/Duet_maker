"""Pure chroma-vector classification: key detection (Krumhansl-Schmuckler) and
chord template matching. Takes plain 12-bin chroma vectors (numpy arrays) —
no audio I/O, no librosa — so this is unit-testable with synthetic vectors
without loading any real audio or model.
"""

from __future__ import annotations

import numpy as np

PITCH_CLASS_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]

# Krumhansl & Kessler (1982) key profiles, C-rooted. Rotated for the other 11
# tonics below. This is the standard reference algorithm for audio key
# detection from a chroma vector — not a project-specific invention.
_KK_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
_KK_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def _rotate(profile: np.ndarray, semitones: int) -> np.ndarray:
    return np.roll(profile, semitones)


def estimate_key(mean_chroma: np.ndarray) -> tuple[str, float]:
    """`mean_chroma`: a 12-bin chroma vector averaged over the whole track
    (bin 0 = C). Returns (e.g. "C major"), correlation) via Pearson
    correlation against every rotation of the KK major/minor profiles —
    the standard Krumhansl-Schmuckler key-finding algorithm.
    """
    if mean_chroma.shape != (12,):
        raise ValueError(f"mean_chroma는 12개 원소여야 합니다: shape={mean_chroma.shape}")

    best_score = -2.0
    best_label = "C major"
    for tonic in range(12):
        for mode_name, profile in (("major", _KK_MAJOR), ("minor", _KK_MINOR)):
            rotated = _rotate(profile, tonic)
            score = float(np.corrcoef(mean_chroma, rotated)[0, 1])
            if np.isnan(score):
                continue
            if score > best_score:
                best_score = score
                best_label = f"{PITCH_CLASS_NAMES[tonic]} {mode_name}"
    # Pearson correlation is in [-1, 1]; real chroma vs. the "right" key
    # profile typically lands well above 0, so map to [0, 1] as a confidence.
    confidence = max(0.0, min(1.0, (best_score + 1) / 2))
    return best_label, confidence


# Semitone offsets from the root + a weight per tone (root always 1.0,
# the color tone(s) 0.8, the fifth 0.6, a 7th/extension tone 0.5 — lower
# because a real recording's overtones make a genuine 7th harder to
# distinguish from noise than the triad tones are). Quality names match
# `chordQualitySchema` in packages/shared-types/src/chord-event.ts exactly,
# so `match_chord`'s output can be dropped straight into a ChordEvent.
_CHORD_INTERVALS: dict[str, list[tuple[int, float]]] = {
    "maj": [(0, 1.0), (4, 0.8), (7, 0.6)],
    "min": [(0, 1.0), (3, 0.8), (7, 0.6)],
    "dim": [(0, 1.0), (3, 0.8), (6, 0.6)],
    "aug": [(0, 1.0), (4, 0.8), (8, 0.6)],
    "maj7": [(0, 1.0), (4, 0.8), (7, 0.6), (11, 0.5)],
    "min7": [(0, 1.0), (3, 0.8), (7, 0.6), (10, 0.5)],
    "dom7": [(0, 1.0), (4, 0.8), (7, 0.6), (10, 0.5)],
    "m7b5": [(0, 1.0), (3, 0.8), (6, 0.6), (10, 0.5)],
    "dim7": [(0, 1.0), (3, 0.8), (6, 0.6), (9, 0.5)],
    "sus2": [(0, 1.0), (2, 0.8), (7, 0.6)],
    "sus4": [(0, 1.0), (5, 0.8), (7, 0.6)],
    "five": [(0, 1.0), (7, 0.6)],
}


def _chord_template(root: int, quality: str) -> np.ndarray:
    intervals = _CHORD_INTERVALS.get(quality)
    if intervals is None:
        raise ValueError(f"지원하지 않는 코드 성질입니다: {quality}")
    template = np.zeros(12)
    for interval, weight in intervals:
        template[(root + interval) % 12] = weight
    return template


_CHORD_TEMPLATES: list[tuple[int, str, np.ndarray]] = [
    (root, quality, _chord_template(root, quality)) for root in range(12) for quality in _CHORD_INTERVALS
]


def match_chord(chroma_vec: np.ndarray) -> tuple[str, str, float]:
    """`chroma_vec`: one 12-bin chroma vector (bin 0 = C), e.g. averaged over
    one beat. Returns (root name, quality, confidence) — quality is one of
    `_CHORD_INTERVALS`'s keys (12 roots x 12 qualities = 144 candidate
    templates). Confidence is the winning template's cosine similarity
    minus the runner-up's, so a clearly-dominant match scores near 1 and an
    ambiguous frame (more likely now that closely-related templates like
    `maj` vs. `maj7` differ by only one weak tone) scores near 0 — that's
    the classifier being honestly uncertain, not a bug.
    """
    if chroma_vec.shape != (12,):
        raise ValueError(f"chroma_vec는 12개 원소여야 합니다: shape={chroma_vec.shape}")
    norm = np.linalg.norm(chroma_vec)
    if norm == 0:
        return "C", "maj", 0.0

    scored = []
    for root, quality, template in _CHORD_TEMPLATES:
        template_norm = np.linalg.norm(template)
        similarity = float(np.dot(chroma_vec, template) / (norm * template_norm))
        scored.append((similarity, root, quality))
    scored.sort(key=lambda item: item[0], reverse=True)

    best_similarity, best_root, best_quality = scored[0]
    runner_up_similarity = scored[1][0] if len(scored) > 1 else 0.0
    confidence = max(0.0, min(1.0, best_similarity - runner_up_similarity + best_similarity * 0.3))
    return PITCH_CLASS_NAMES[best_root], best_quality, confidence
