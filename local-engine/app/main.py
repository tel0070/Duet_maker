"""FastAPI entrypoint for local-engine (AGENTS.md Phase 5): a localhost-only
optional analysis service. Never bind this to 0.0.0.0 or add auth-bypassing
convenience — "never leaves this machine" is the entire privacy promise (see
docs/PRIVACY.md), and that promise is only as good as this staying
unreachable from outside 127.0.0.1.

Every heavy operation (separation, pitch/chord/section analysis) runs as a
background job polled via GET /jobs/{id} — see jobs.py for why, and for the
honest limits of "cancel".
"""

from __future__ import annotations

import shutil
import sys
import tempfile
from pathlib import Path

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from . import jobs, keychords, pitch, sections, separation
from .schemas import HealthResponse, JobCreatedResponse, JobStatusResponse

VERSION = "0.1.0"

app = FastAPI(title="Duet Maker local-engine", version=VERSION)

# Only ever consumed by the web app running on the same machine (Vite dev on
# 5173, `vite preview` on 4173, or a future static build served locally) —
# the real security boundary is uvicorn binding to 127.0.0.1, not this list.
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1):\d+$",
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_JOB_KIND: dict[str, str] = {}
_JOB_WORKDIR: dict[str, Path] = {}


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", version=VERSION)


async def _save_upload(file: UploadFile) -> tuple[Path, Path]:
    workdir = Path(tempfile.mkdtemp(prefix="duetmaker-"))
    suffix = Path(file.filename or "audio").suffix or ".audio"
    input_path = workdir / f"input{suffix}"
    with input_path.open("wb") as out:
        shutil.copyfileobj(file.file, out)
    return workdir, input_path


@app.post("/separate", response_model=JobCreatedResponse)
async def start_separation(file: UploadFile) -> JobCreatedResponse:
    workdir, input_path = await _save_upload(file)

    def work(job: jobs.Job) -> dict:
        job.update("보컬 분리 모델 실행 중 (곡 길이에 따라 몇 분 걸릴 수 있습니다)...", 0.2)
        result = separation.run_separation(str(input_path), str(workdir / "out"))
        job.update("분리 완료", 0.9)
        return result

    job = jobs.start_job(work)
    _JOB_KIND[job.id] = "separate"
    _JOB_WORKDIR[job.id] = workdir
    return JobCreatedResponse(jobId=job.id)


@app.post("/pitch/analyze", response_model=JobCreatedResponse)
async def start_pitch_analysis(file: UploadFile, bpm: float) -> JobCreatedResponse:
    workdir, input_path = await _save_upload(file)

    def work(job: jobs.Job) -> dict:
        job.update("멜로디 채보 중...", 0.3)
        notes = pitch.analyze_pitch(str(input_path), bpm)
        return {"notes": notes}

    job = jobs.start_job(work)
    _JOB_KIND[job.id] = "pitch"
    _JOB_WORKDIR[job.id] = workdir
    return JobCreatedResponse(jobId=job.id)


@app.post("/analyze/tempo-key-chords", response_model=JobCreatedResponse)
async def start_chords_analysis(file: UploadFile) -> JobCreatedResponse:
    workdir, input_path = await _save_upload(file)

    def work(job: jobs.Job) -> dict:
        job.update("템포/키/코드 분석 중...", 0.3)
        return keychords.analyze_tempo_key_chords(str(input_path))

    job = jobs.start_job(work)
    _JOB_KIND[job.id] = "chords"
    _JOB_WORKDIR[job.id] = workdir
    return JobCreatedResponse(jobId=job.id)


@app.post("/analyze/sections", response_model=JobCreatedResponse)
async def start_sections_analysis(file: UploadFile, bpm: float) -> JobCreatedResponse:
    workdir, input_path = await _save_upload(file)

    def work(job: jobs.Job) -> dict:
        job.update("구간(벌스/코러스) 분석 중...", 0.3)
        return {"sections": sections.analyze_sections(str(input_path), bpm)}

    job = jobs.start_job(work)
    _JOB_KIND[job.id] = "sections"
    _JOB_WORKDIR[job.id] = workdir
    return JobCreatedResponse(jobId=job.id)


def _require_job(job_id: str) -> jobs.Job:
    job = jobs.get_job(job_id)
    if job is None:
        raise HTTPException(404, "존재하지 않는 작업입니다.")
    return job


@app.get("/jobs/{job_id}", response_model=JobStatusResponse)
def job_status(job_id: str) -> JobStatusResponse:
    job = _require_job(job_id)
    return JobStatusResponse(**job.to_status())


@app.post("/jobs/{job_id}/cancel")
def cancel(job_id: str) -> dict:
    found = jobs.cancel_job(job_id)
    if not found:
        raise HTTPException(404, "존재하지 않는 작업입니다.")
    return {"cancelled": True}


def _require_done_result(job_id: str) -> dict:
    job = _require_job(job_id)
    if job.cancelled:
        raise HTTPException(409, "취소된 작업입니다.")
    if job.error:
        raise HTTPException(500, job.error)
    if not job.done:
        raise HTTPException(202, "아직 처리 중입니다.")
    return job.result


@app.get("/pitch/{job_id}/result")
def pitch_result(job_id: str) -> dict:
    return _require_done_result(job_id)


@app.get("/analyze/{job_id}/chords-result")
def chords_result(job_id: str) -> dict:
    return _require_done_result(job_id)


@app.get("/analyze/{job_id}/sections-result")
def sections_result(job_id: str) -> dict:
    return _require_done_result(job_id)


@app.get("/separate/{job_id}/confidence")
def separation_confidence(job_id: str) -> dict:
    result = _require_done_result(job_id)
    return {"confidence": result["confidence"]}


@app.get("/separate/{job_id}/vocal")
def separation_vocal(job_id: str) -> FileResponse:
    result = _require_done_result(job_id)
    return FileResponse(result["vocalPath"], media_type="audio/wav")


@app.get("/separate/{job_id}/instrumental")
def separation_instrumental(job_id: str) -> FileResponse:
    result = _require_done_result(job_id)
    return FileResponse(result["instrumentalPath"], media_type="audio/wav")


def _bundled_web_app_dir() -> Path:
    # PyInstaller sets `sys._MEIPASS` to the frozen app's data directory in
    # both --onefile and --onedir builds; running from source (dev, tests),
    # `static/` next to local-engine's own root is used instead — the build
    # workflow copies apps/web's `pnpm build` output there before freezing.
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))
    return base / "static"


_web_app_dir = _bundled_web_app_dir()
if _web_app_dir.is_dir():
    # Mounted last and at "/" so every route above still takes priority —
    # Starlette tries routes in registration order, and only falls through
    # to this catch-all for paths none of the API routes matched (the web
    # app's own static assets, and "/" itself via `html=True`'s index.html
    # fallback). This is what turns "run the exe" into "a browser tab with
    # the actual app opens" instead of a bare headless API with nothing to
    # look at — see app_entry.py for the auto-open-browser half of that.
    app.mount("/", StaticFiles(directory=str(_web_app_dir), html=True), name="web-app")
