from app.keychords import _merge_consecutive_chords


def test_merges_consecutive_identical_chords_into_one_span():
    raw = [
        {"root": "C", "quality": "maj", "confidence": 0.8, "startSeconds": 0.0, "endSeconds": 0.5},
        {"root": "C", "quality": "maj", "confidence": 0.6, "startSeconds": 0.5, "endSeconds": 1.0},
        {"root": "G", "quality": "maj", "confidence": 0.9, "startSeconds": 1.0, "endSeconds": 1.5},
    ]
    merged = _merge_consecutive_chords(raw)
    assert len(merged) == 2
    assert merged[0]["root"] == "C"
    assert merged[0]["startSeconds"] == 0.0
    assert merged[0]["endSeconds"] == 1.0
    assert merged[1]["root"] == "G"


def test_averages_confidence_across_the_merged_span():
    raw = [
        {"root": "A", "quality": "min", "confidence": 1.0, "startSeconds": 0.0, "endSeconds": 0.5},
        {"root": "A", "quality": "min", "confidence": 0.0, "startSeconds": 0.5, "endSeconds": 1.0},
    ]
    merged = _merge_consecutive_chords(raw)
    assert len(merged) == 1
    assert merged[0]["confidence"] == 0.5


def test_empty_input_returns_empty_list():
    assert _merge_consecutive_chords([]) == []


def test_does_not_merge_a_different_quality_on_the_same_root():
    raw = [
        {"root": "C", "quality": "maj", "confidence": 0.7, "startSeconds": 0.0, "endSeconds": 0.5},
        {"root": "C", "quality": "min", "confidence": 0.7, "startSeconds": 0.5, "endSeconds": 1.0},
    ]
    merged = _merge_consecutive_chords(raw)
    assert len(merged) == 2
