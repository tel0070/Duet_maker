/**
 * Pure coordinate math for the piano roll, split out from PianoRoll.tsx so
 * it can be unit-tested without a DOM/SVG layout engine (jsdom doesn't lay
 * out SVG, so anything depending on real getBoundingClientRect() values
 * can only be verified in a real browser/Playwright — this file is
 * everything that doesn't).
 */

export function pxToBeats(px: number, pxPerBeat: number): number {
  return px / pxPerBeat;
}

export function beatsToPx(beats: number, pxPerBeat: number): number {
  return beats * pxPerBeat;
}

/** Nearest pitch row (integer MIDI note) for a given y offset within the grid. */
export function pxToPitch(y: number, maxPitch: number, rowHeight: number): number {
  return Math.round(maxPitch - y / rowHeight);
}

export function pitchToPxY(pitch: number, maxPitch: number, rowHeight: number): number {
  return (maxPitch - pitch) * rowHeight;
}

/** Snaps a beat position to the nearest grid line (default: sixteenth notes). */
export function quantizeBeats(beats: number, snap = 0.25): number {
  return Math.max(0, Math.round(beats / snap) * snap);
}

export function clampPitch(pitch: number): number {
  return Math.min(127, Math.max(0, pitch));
}

export interface DragToNotePatchInput {
  mode: "move" | "resize";
  originalPitch: number;
  originalStartTime: number;
  originalDuration: number;
  deltaXPx: number;
  deltaYPx: number;
  pxPerBeat: number;
  rowHeight: number;
  snapBeats?: number;
}

export interface NotePatch {
  pitch: number;
  startTime: number;
  duration: number;
}

/**
 * Turns a pointer-drag delta (in pixels) into the new note pitch/time/
 * duration. `mode: "move"` shifts both time and pitch; `mode: "resize"`
 * only changes duration (dragging the note's right edge), with a floor of
 * one snap unit so a note can never be dragged to zero/negative length.
 */
export function dragToNotePatch(input: DragToNotePatchInput): NotePatch {
  const snap = input.snapBeats ?? 0.25;
  const deltaBeats = pxToBeats(input.deltaXPx, input.pxPerBeat);
  const deltaPitchRows = Math.round(input.deltaYPx / input.rowHeight);

  if (input.mode === "resize") {
    const rawDuration = input.originalDuration + deltaBeats;
    return {
      pitch: input.originalPitch,
      startTime: input.originalStartTime,
      duration: Math.max(snap, quantizeBeats(rawDuration, snap)),
    };
  }

  return {
    pitch: clampPitch(input.originalPitch - deltaPitchRows),
    startTime: quantizeBeats(input.originalStartTime + deltaBeats, snap),
    duration: input.originalDuration,
  };
}
