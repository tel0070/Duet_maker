"""Minimal background-job registry so the four analysis endpoints can report
real progress via polling (matching `ProgressState`/`getProgress()` in
shared-types/src/providers.ts) instead of the client blocking on one long
HTTP request. Deliberately not a task queue (Celery/RQ, etc.) — this process
serves exactly one local user at a time, so an in-memory dict plus a daemon
thread per job is the whole problem, not a simplification that will bite
later.

Cancellation is best-effort: `cancel()` stops the job from ever being
*served* to the client and flips its status to cancelled, but a computation
already inside a blocking model call (Demucs, basic-pitch) cannot actually be
interrupted from here — it keeps running in the background until it finishes
on its own. That limitation is called out in local-engine/README.md, not
hidden behind a UI that claims to have stopped real work.
"""

from __future__ import annotations

import threading
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class Job:
    id: str
    stage: str = "대기 중"
    fraction: float = 0.0
    done: bool = False
    cancelled: bool = False
    error: str | None = None
    result: Any = None
    _lock: threading.Lock = field(default_factory=threading.Lock)

    def update(self, stage: str, fraction: float) -> None:
        with self._lock:
            self.stage = stage
            self.fraction = fraction

    def to_status(self) -> dict:
        with self._lock:
            return {
                "jobId": self.id,
                "stage": self.stage,
                "fraction": self.fraction,
                "done": self.done,
                "cancelled": self.cancelled,
                "error": self.error,
            }


_JOBS: dict[str, Job] = {}
_REGISTRY_LOCK = threading.Lock()


def start_job(work: Callable[[Job], Any]) -> Job:
    job = Job(id=uuid.uuid4().hex)
    with _REGISTRY_LOCK:
        _JOBS[job.id] = job

    def run() -> None:
        try:
            result = work(job)
            with job._lock:
                job.result = result
                job.stage = "완료"
                job.fraction = 1.0
        except Exception as error:  # noqa: BLE001 - surfaced to the client as job.error, not swallowed
            with job._lock:
                job.error = str(error)
        finally:
            with job._lock:
                job.done = True

    threading.Thread(target=run, daemon=True).start()
    return job


def get_job(job_id: str) -> Job | None:
    with _REGISTRY_LOCK:
        return _JOBS.get(job_id)


def cancel_job(job_id: str) -> bool:
    job = get_job(job_id)
    if job is None:
        return False
    with job._lock:
        job.cancelled = True
    return True
