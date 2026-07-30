"""End-to-end smoke tests against the real FastAPI app + real librosa/basic-pitch
pipeline (no mocks) on a short synthetic tone — verifies the HTTP layer, the
job-polling contract, and that tempo/key/pitch detection land on values that
match how the fixture was actually constructed. Does not exercise /separate:
that needs Demucs' pretrained weights, which are downloaded on first use and
not guaranteed to be reachable in every test environment (see
local-engine/README.md).
"""

from __future__ import annotations

import time

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture
def synthetic_c_major_scale(tmp_path):
    """8 one-second tones at 60 quarter-notes/minute: C4 D4 E4 F4 (x2) — a
    diatonic-to-C-major melody with an unambiguous, known tempo/pitch
    ground truth to assert against.
    """
    sr = 22050
    freqs = [261.63, 293.66, 329.63, 349.23] * 2  # C4 D4 E4 F4
    signal = np.concatenate(
        [0.3 * np.sin(2 * np.pi * f * np.linspace(0, 1.0, sr, endpoint=False)) for f in freqs]
    )
    path = tmp_path / "scale.wav"
    sf.write(str(path), signal, sr)
    return str(path)


def _await_job(job_id: str, timeout_s: float = 30.0) -> dict:
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        status = client.get(f"/jobs/{job_id}").json()
        if status["done"]:
            return status
        time.sleep(0.2)
    raise TimeoutError(f"작업이 시간 내에 끝나지 않았습니다: {job_id}")


def test_health_reports_ok():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_tempo_key_chords_pipeline_matches_the_known_fixture(synthetic_c_major_scale):
    with open(synthetic_c_major_scale, "rb") as f:
        started = client.post("/analyze/tempo-key-chords", files={"file": ("scale.wav", f, "audio/wav")})
    assert started.status_code == 200
    job_id = started.json()["jobId"]

    status = _await_job(job_id)
    assert status["error"] is None

    result = client.get(f"/analyze/{job_id}/chords-result")
    assert result.status_code == 200
    body = result.json()
    assert body["bpm"] == pytest.approx(60, abs=3)
    assert body["key"] == "C major"
    assert len(body["chords"]) > 0


def test_pitch_pipeline_recovers_the_known_note_sequence(synthetic_c_major_scale):
    with open(synthetic_c_major_scale, "rb") as f:
        started = client.post("/pitch/analyze", params={"bpm": 60}, files={"file": ("scale.wav", f, "audio/wav")})
    assert started.status_code == 200
    job_id = started.json()["jobId"]

    status = _await_job(job_id)
    assert status["error"] is None

    result = client.get(f"/pitch/{job_id}/result")
    assert result.status_code == 200
    notes = result.json()["notes"]
    assert len(notes) >= 4
    pitches = [n["pitch"] for n in notes]
    assert 60 in pitches  # C4
    for note in notes:
        assert 0.0 <= note["confidence"] <= 1.0
        assert note["source"] == "pitch-detection"


def test_unknown_job_id_is_a_404():
    assert client.get("/jobs/does-not-exist").status_code == 404


def test_result_before_done_is_not_a_500(synthetic_c_major_scale):
    with open(synthetic_c_major_scale, "rb") as f:
        started = client.post("/analyze/sections", params={"bpm": 60}, files={"file": ("scale.wav", f, "audio/wav")})
    job_id = started.json()["jobId"]
    # Immediately probing the result before the background thread finishes
    # must be a well-formed "still working" response, not a crash on a None result.
    immediate = client.get(f"/analyze/{job_id}/sections-result")
    assert immediate.status_code in (200, 202)
    _await_job(job_id)
