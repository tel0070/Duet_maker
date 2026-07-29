import { describe, expect, it } from "vitest";
import {
  clampPitch,
  dragToBandPatch,
  dragToNotePatch,
  pitchToPxY,
  pxToBeats,
  pxToPitch,
  quantizeBeats,
} from "../../src/lib/piano-roll-geometry.js";

describe("pxToBeats / beatsToPx round trip", () => {
  it("converts pixels to beats using the given resolution", () => {
    expect(pxToBeats(56, 28)).toBe(2);
    expect(pxToBeats(14, 28)).toBe(0.5);
  });
});

describe("pxToPitch / pitchToPxY", () => {
  it("round-trips a pitch through its pixel row", () => {
    const y = pitchToPxY(67, 79, 10);
    expect(pxToPitch(y, 79, 10)).toBe(67);
  });

  it("higher pitches sit at smaller y offsets (higher on screen)", () => {
    const highY = pitchToPxY(72, 79, 10);
    const lowY = pitchToPxY(60, 79, 10);
    expect(highY).toBeLessThan(lowY);
  });
});

describe("quantizeBeats", () => {
  it("snaps to the nearest sixteenth note by default", () => {
    expect(quantizeBeats(1.05)).toBe(1);
    expect(quantizeBeats(1.2)).toBe(1.25);
  });

  it("never returns a negative time", () => {
    expect(quantizeBeats(-0.1)).toBe(0);
  });

  it("supports a custom snap resolution", () => {
    expect(quantizeBeats(1.6, 0.5)).toBe(1.5);
  });
});

describe("clampPitch", () => {
  it("clamps to the valid MIDI range", () => {
    expect(clampPitch(-5)).toBe(0);
    expect(clampPitch(200)).toBe(127);
    expect(clampPitch(64)).toBe(64);
  });
});

describe("dragToNotePatch — move", () => {
  it("shifts startTime forward and pitch up when dragged right and up", () => {
    const patch = dragToNotePatch({
      mode: "move",
      originalPitch: 60,
      originalStartTime: 2,
      originalDuration: 1,
      deltaXPx: 28, // +1 beat at 28px/beat
      deltaYPx: -20, // up two rows at 10px/row
      pxPerBeat: 28,
      rowHeight: 10,
    });
    expect(patch.startTime).toBe(3);
    expect(patch.pitch).toBe(62);
    expect(patch.duration).toBe(1);
  });

  it("never produces a negative startTime", () => {
    const patch = dragToNotePatch({
      mode: "move",
      originalPitch: 60,
      originalStartTime: 0.25,
      originalDuration: 1,
      deltaXPx: -1000,
      deltaYPx: 0,
      pxPerBeat: 28,
      rowHeight: 10,
    });
    expect(patch.startTime).toBe(0);
  });

  it("clamps pitch to the MIDI range even for a huge drag", () => {
    const patch = dragToNotePatch({
      mode: "move",
      originalPitch: 60,
      originalStartTime: 2,
      originalDuration: 1,
      deltaXPx: 0,
      deltaYPx: -100000,
      pxPerBeat: 28,
      rowHeight: 10,
    });
    expect(patch.pitch).toBe(127);
  });
});

describe("dragToNotePatch — resize", () => {
  it("only changes duration, never pitch or startTime", () => {
    const patch = dragToNotePatch({
      mode: "resize",
      originalPitch: 60,
      originalStartTime: 2,
      originalDuration: 1,
      deltaXPx: 28,
      deltaYPx: 50, // must be ignored in resize mode
      pxPerBeat: 28,
      rowHeight: 10,
    });
    expect(patch.pitch).toBe(60);
    expect(patch.startTime).toBe(2);
    expect(patch.duration).toBe(2);
  });

  it("never shrinks a note to zero or negative length", () => {
    const patch = dragToNotePatch({
      mode: "resize",
      originalPitch: 60,
      originalStartTime: 2,
      originalDuration: 1,
      deltaXPx: -1000,
      deltaYPx: 0,
      pxPerBeat: 28,
      rowHeight: 10,
    });
    expect(patch.duration).toBeGreaterThan(0);
    expect(patch.duration).toBe(0.25);
  });
});

describe("dragToBandPatch — move", () => {
  it("shifts startTime forward, leaving duration untouched", () => {
    const patch = dragToBandPatch({
      mode: "move",
      originalStartTime: 2,
      originalDuration: 4,
      deltaXPx: 28, // +1 beat at 28px/beat
      pxPerBeat: 28,
    });
    expect(patch.startTime).toBe(3);
    expect(patch.duration).toBe(4);
  });

  it("never produces a negative startTime", () => {
    const patch = dragToBandPatch({
      mode: "move",
      originalStartTime: 0.25,
      originalDuration: 4,
      deltaXPx: -1000,
      pxPerBeat: 28,
    });
    expect(patch.startTime).toBe(0);
  });
});

describe("dragToBandPatch — resize", () => {
  it("only changes duration, never startTime", () => {
    const patch = dragToBandPatch({
      mode: "resize",
      originalStartTime: 2,
      originalDuration: 4,
      deltaXPx: 56, // +2 beats
      pxPerBeat: 28,
    });
    expect(patch.startTime).toBe(2);
    expect(patch.duration).toBe(6);
  });

  it("never shrinks a band to zero or negative length", () => {
    const patch = dragToBandPatch({
      mode: "resize",
      originalStartTime: 2,
      originalDuration: 4,
      deltaXPx: -1000,
      pxPerBeat: 28,
    });
    expect(patch.duration).toBeGreaterThan(0);
    expect(patch.duration).toBe(0.25);
  });
});
