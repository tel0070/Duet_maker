import pytest

from app import beatmath


def test_seconds_to_beats_at_120bpm_two_seconds_is_four_beats():
    assert beatmath.seconds_to_beats(2.0, 120.0) == pytest.approx(4.0)


def test_beats_to_seconds_is_the_inverse_of_seconds_to_beats():
    for bpm in (60.0, 90.5, 128.0):
        seconds = 3.75
        beats = beatmath.seconds_to_beats(seconds, bpm)
        assert beatmath.beats_to_seconds(beats, bpm) == pytest.approx(seconds)


def test_seconds_to_beats_rejects_non_positive_bpm():
    with pytest.raises(ValueError):
        beatmath.seconds_to_beats(1.0, 0)


def test_round_beats_snaps_to_default_sixteenth_grid():
    assert beatmath.round_beats(1.03) == pytest.approx(1.0)
    assert beatmath.round_beats(1.07) == pytest.approx(1.0625)


def test_round_beats_supports_a_coarser_resolution():
    assert beatmath.round_beats(1.4, resolution=0.5) == pytest.approx(1.5)
