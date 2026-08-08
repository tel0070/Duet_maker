"""Reduces basic-pitch's raw output to a single singable melody line.

basic-pitch is a *polyphonic* transcriber. Even pointed at a separated
vocal stem it returns overlapping notes: vibrato split into fragments,
breath/consonant artifacts, octave doubles, and whatever the separation
left behind. Measured on a real user's song, its raw output averaged 3.25
simultaneous notes, 7.45 note-onsets per second, and covered 98.5% of the
timeline with at least one note sounding.

That matters because harmony-core emits exactly one harmony note per
melody note (see planner.ts's loop over every note). Feeding it the raw
output makes the generated harmony a continuous, dense cluster that never
articulates and never rests - which is heard as "the harmony has no rhythm
at all", not as a subtly mistimed line. Two rounds of fixing the
seconds<->beats timing math changed nothing audible for exactly this
reason: the timing was never what was wrong.

Reducing to one note at a time - and letting the gaps between sung phrases
survive as real rests - is what makes the generated harmony follow the
vocal's phrasing.

Pure list-in/list-out on (start_s, end_s, pitch, amplitude) tuples, so it
is unit-tested without loading audio or running a model.
"""

from __future__ import annotations

# Shorter than this and it can't be sung as a distinct note - at a typical
# 120bpm a 16th note is ~0.125s, so this keeps real fast passages while
# dropping transcription artifacts.
MIN_NOTE_SECONDS = 0.12

# A sung note broken into fragments by vibrato or a consonant lands as
# same-pitch pieces a few tens of ms apart; rejoin those rather than
# harmonizing each piece separately.
MERGE_GAP_SECONDS = 0.08

Event = tuple[float, float, int, float]


def to_monophonic_line(events: list[Event]) -> list[Event]:
    """Raw basic-pitch events -> one note at a time, ordered by start time."""
    if not events:
        return []
    stripped = _strip_overlaps(events)
    merged = _merge_fragments(stripped)
    line = [e for e in merged if e[1] - e[0] >= MIN_NOTE_SECONDS]
    # A very short or very sparse input (a test fixture, a one-note clip)
    # can lose everything to the duration filter - returning the merged
    # line unfiltered beats returning nothing at all.
    return line or merged


def _strip_overlaps(events: list[Event]) -> list[Event]:
    """Keeps one note sounding at a time, preferring the louder note.

    A quieter note starting inside a louder one is dropped outright. A
    louder note starting inside a quieter one truncates it instead of
    dropping it - real singing does move on mid-note, so the earlier note
    genuinely happened, it just ended sooner than basic-pitch thought.
    """
    kept: list[Event] = []
    # Louder first among notes sharing a start, so the winner is held.
    for note in sorted(events, key=lambda e: (e[0], -e[3])):
        start, _end, _pitch, amplitude = note
        drop = False
        while kept and start < kept[-1][1]:
            prev_start, _prev_end, prev_pitch, prev_amplitude = kept[-1]
            if amplitude <= prev_amplitude:
                drop = True
                break
            if start - prev_start >= MIN_NOTE_SECONDS:
                kept[-1] = (prev_start, start, prev_pitch, prev_amplitude)
                break
            # Truncating would leave the held note too short to be real;
            # this louder note replaces it entirely.
            kept.pop()
        if not drop:
            kept.append(note)
    return kept


def _merge_fragments(events: list[Event]) -> list[Event]:
    """Rejoins consecutive same-pitch notes separated by only a tiny gap."""
    merged: list[Event] = []
    for start, end, pitch, amplitude in events:
        if merged:
            prev_start, prev_end, prev_pitch, prev_amplitude = merged[-1]
            if pitch == prev_pitch and start - prev_end <= MERGE_GAP_SECONDS:
                merged[-1] = (prev_start, max(prev_end, end), prev_pitch, max(prev_amplitude, amplitude))
                continue
        merged.append((start, end, pitch, amplitude))
    return merged
