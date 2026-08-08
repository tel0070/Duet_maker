import pytest

from app import melody_line


def _is_monophonic(line):
    return all(line[i][1] <= line[i + 1][0] + 1e-9 for i in range(len(line) - 1))


def test_empty_input_gives_empty_line():
    assert melody_line.to_monophonic_line([]) == []


def test_already_monophonic_line_is_left_alone():
    events = [(0.0, 0.5, 60, 0.8), (0.6, 1.2, 62, 0.7), (1.5, 2.0, 64, 0.9)]
    assert melody_line.to_monophonic_line(events) == events


def test_quieter_note_overlapping_a_louder_one_is_dropped():
    events = [(0.0, 1.0, 60, 0.9), (0.3, 0.8, 67, 0.4)]
    line = melody_line.to_monophonic_line(events)
    assert line == [(0.0, 1.0, 60, 0.9)]


def test_louder_note_starting_mid_note_truncates_the_held_note():
    # The held note genuinely happened, it just ended sooner than
    # basic-pitch thought - truncating keeps it, rather than dropping it.
    events = [(0.0, 1.0, 60, 0.4), (0.5, 1.4, 67, 0.9)]
    line = melody_line.to_monophonic_line(events)
    assert line == [(0.0, 0.5, 60, 0.4), (0.5, 1.4, 67, 0.9)]
    assert _is_monophonic(line)


def test_a_louder_note_replaces_a_held_note_it_would_leave_too_short():
    # Truncating here would leave the first note ~0.02s long - shorter than
    # anything singable - so the louder note replaces it outright.
    events = [(0.0, 1.0, 60, 0.4), (0.02, 1.0, 67, 0.9)]
    line = melody_line.to_monophonic_line(events)
    assert line == [(0.02, 1.0, 67, 0.9)]


def test_same_pitch_fragments_separated_by_a_tiny_gap_are_merged():
    # One sung note that vibrato/a consonant split into pieces.
    events = [(0.0, 0.4, 60, 0.7), (0.45, 0.9, 60, 0.8)]
    line = melody_line.to_monophonic_line(events)
    assert line == [(0.0, 0.9, 60, 0.8)]


def test_same_pitch_notes_separated_by_a_real_rest_stay_separate():
    events = [(0.0, 0.4, 60, 0.7), (1.5, 2.0, 60, 0.8)]
    line = melody_line.to_monophonic_line(events)
    assert len(line) == 2


def test_artifact_shorter_than_the_minimum_is_dropped():
    events = [(0.0, 0.5, 60, 0.9), (1.0, 1.02, 72, 0.8), (1.5, 2.0, 62, 0.9)]
    line = melody_line.to_monophonic_line(events)
    assert [e[2] for e in line] == [60, 62]


def test_a_dense_polyphonic_cluster_collapses_to_one_note_at_a_time():
    # The real failure mode: basic-pitch returning several simultaneous
    # notes throughout, which harmony-core would turn into a nonstop
    # harmony cluster with no rhythm at all.
    events = []
    for i in range(10):
        base = i * 0.5
        events.append((base, base + 0.45, 60 + i, 0.9))
        events.append((base + 0.1, base + 0.6, 67 + i, 0.5))
        events.append((base + 0.2, base + 0.7, 72 + i, 0.3))
    line = melody_line.to_monophonic_line(events)
    assert _is_monophonic(line)
    assert len(line) < len(events)


def test_everything_being_shorter_than_the_minimum_still_returns_something():
    # A one-note clip or a tiny test fixture must not come back empty.
    events = [(0.0, 0.05, 60, 0.9)]
    assert melody_line.to_monophonic_line(events) == events


def test_output_is_sorted_by_start_time():
    events = [(2.0, 2.5, 64, 0.9), (0.0, 0.5, 60, 0.8), (1.0, 1.5, 62, 0.7)]
    line = melody_line.to_monophonic_line(events)
    assert [e[0] for e in line] == sorted(e[0] for e in line)


def test_merging_keeps_the_louder_fragments_amplitude():
    events = [(0.0, 0.4, 60, 0.3), (0.44, 0.9, 60, 0.85)]
    line = melody_line.to_monophonic_line(events)
    assert line[0][3] == pytest.approx(0.85)
