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


def test_seconds_to_beats_with_map_matches_constant_tempo_on_a_uniform_grid():
    # A perfectly uniform 1-second-per-beat grid should agree with the
    # scalar 60bpm formula exactly.
    beat_times = [0.0, 1.0, 2.0, 3.0, 4.0]
    for seconds in (0.0, 0.5, 1.5, 3.9):
        assert beatmath.seconds_to_beats_with_map(seconds, beat_times) == pytest.approx(
            beatmath.seconds_to_beats(seconds, 60.0)
        )


def test_seconds_to_beats_with_map_tracks_real_tempo_changes_the_scalar_formula_misses():
    # First interval is 1s/beat (60bpm), second is 0.5s/beat (120bpm) - a
    # single average bpm across the whole map gets this wrong. t=1.25s is
    # halfway through the *second* interval (beat 1 to beat 2), so the
    # correct answer is beat 1.5 - not what a single average-tempo (80bpm
    # over these 2 beats / 1.5s) scalar conversion would give (1.667).
    beat_times = [0.0, 1.0, 1.5]
    assert beatmath.seconds_to_beats_with_map(1.25, beat_times) == pytest.approx(1.5)
    average_bpm = 2 / 1.5 * 60
    assert beatmath.seconds_to_beats(1.25, average_bpm) != pytest.approx(1.5)


def test_seconds_to_beats_with_map_extrapolates_before_the_first_beat():
    # A chord/note starting before the first detected beat still needs a
    # (negative-ish) beat position, using the first interval's local tempo,
    # not a clamp to 0.
    beat_times = [2.0, 3.0, 4.0]
    assert beatmath.seconds_to_beats_with_map(1.5, beat_times) == pytest.approx(-0.5)


def test_seconds_to_beats_with_map_extrapolates_after_the_last_beat():
    beat_times = [0.0, 1.0, 2.0]
    assert beatmath.seconds_to_beats_with_map(2.5, beat_times) == pytest.approx(2.5)


def test_beats_to_seconds_with_map_is_the_inverse_of_seconds_to_beats_with_map():
    beat_times = [0.4, 1.1, 1.5, 2.6, 4.0]  # a real, non-uniform detected grid
    for seconds in (0.4, 0.9, 1.8, 3.0, 3.9):
        beats = beatmath.seconds_to_beats_with_map(seconds, beat_times)
        assert beatmath.beats_to_seconds_with_map(beats, beat_times) == pytest.approx(seconds)


def test_seconds_to_beats_with_map_rejects_a_too_short_map():
    with pytest.raises(ValueError):
        beatmath.seconds_to_beats_with_map(1.0, [0.0])
