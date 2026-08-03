"""Pydantic response models mirroring the zod schemas in
packages/shared-types/src/*.ts field-for-field, so the JSON this service
returns can be fed straight into the frontend's own schema.parse() at the
trust boundary without a translation layer. See docs/DATA_FORMATS.md.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

PitchClass = Literal["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
ChordQuality = Literal[
    "maj", "min", "dim", "aug", "maj7", "min7", "dom7", "m7b5", "dim7", "sus2", "sus4", "five"
]
SectionType = Literal[
    "intro", "verse", "preChorus", "chorus", "postChorus", "bridge", "breakdown", "finalChorus", "outro", "custom"
]


class HealthResponse(BaseModel):
    status: Literal["ok"]
    version: str


class JobCreatedResponse(BaseModel):
    jobId: str


class JobStatusResponse(BaseModel):
    jobId: str
    stage: str
    fraction: float
    done: bool
    cancelled: bool
    error: str | None = None


class NoteEventOut(BaseModel):
    id: str
    pitch: int
    startTime: float
    duration: float
    velocity: int
    confidence: float
    source: Literal["pitch-detection"]
    editable: bool


class ChordEventOut(BaseModel):
    id: str
    root: PitchClass
    quality: ChordQuality
    extensions: list[str] = []
    startTime: float
    duration: float
    confidence: float
    source: Literal["chord-detection"]


class SongSectionOut(BaseModel):
    id: str
    type: SectionType
    startTime: float
    endTime: float
    energy: float
    harmonyDensity: float
    confidence: float


class SeparationResult(BaseModel):
    confidence: float


class PitchAnalysisResult(BaseModel):
    notes: list[NoteEventOut]


class TempoKeyChordsResult(BaseModel):
    bpm: float
    key: str
    keyConfidence: float
    chords: list[ChordEventOut]


class SectionsResult(BaseModel):
    sections: list[SongSectionOut]
