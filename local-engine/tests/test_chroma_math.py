import numpy as np

from app import chroma_math


def test_estimate_key_recognizes_the_c_major_profile_itself():
    label, confidence = chroma_math.estimate_key(chroma_math._KK_MAJOR)
    assert label == "C major"
    assert confidence > 0.9


def test_estimate_key_recognizes_a_rotated_minor_profile():
    # A minor's KK profile is the C-major profile rotated by 9 semitones.
    rotated = np.roll(chroma_math._KK_MINOR, 9)
    label, _confidence = chroma_math.estimate_key(rotated)
    assert label == "A minor"


def test_match_chord_identifies_a_pure_c_major_triad():
    chroma = np.zeros(12)
    chroma[0] = 1.0  # C
    chroma[4] = 0.8  # E
    chroma[7] = 0.6  # G
    root, quality, confidence = chroma_math.match_chord(chroma)
    assert root == "C"
    assert quality == "maj"
    assert confidence > 0


def test_match_chord_identifies_a_pure_a_minor_triad():
    chroma = np.zeros(12)
    chroma[9] = 1.0  # A
    chroma[0] = 0.8  # C
    chroma[4] = 0.6  # E
    root, quality, _confidence = chroma_math.match_chord(chroma)
    assert root == "A"
    assert quality == "min"


def test_match_chord_identifies_a_dominant_seventh():
    chroma = np.zeros(12)
    chroma[7] = 1.0  # G
    chroma[11] = 0.8  # B
    chroma[2] = 0.6  # D
    chroma[5] = 0.5  # F (minor 7th above G)
    root, quality, confidence = chroma_math.match_chord(chroma)
    assert root == "G"
    assert quality == "dom7"
    assert confidence > 0


def test_match_chord_identifies_a_sus4():
    chroma = np.zeros(12)
    chroma[0] = 1.0  # C
    chroma[5] = 0.8  # F (4th above C)
    chroma[7] = 0.6  # G
    root, quality, _confidence = chroma_math.match_chord(chroma)
    assert root == "C"
    assert quality == "sus4"


def test_match_chord_prefers_the_simpler_triad_when_no_seventh_is_present():
    # A pure triad (no 7th-degree energy at all) should not be explained
    # away as a 7th chord just because the 7th-chord template's other
    # tones also match — the extra unmatched tone should cost it the win.
    chroma = np.zeros(12)
    chroma[0] = 1.0  # C
    chroma[4] = 0.8  # E
    chroma[7] = 0.6  # G
    root, quality, _confidence = chroma_math.match_chord(chroma)
    assert (root, quality) == ("C", "maj")


def test_match_chord_handles_silence_without_crashing():
    root, quality, confidence = chroma_math.match_chord(np.zeros(12))
    assert root == "C"
    assert quality == "maj"
    assert confidence == 0.0


def test_match_chord_rejects_wrong_shape():
    import pytest

    with pytest.raises(ValueError):
        chroma_math.match_chord(np.zeros(11))
