/**
 * Deterministic PRNG (mulberry32). Same seed always produces the same
 * sequence, on any JS engine — required for reproducible generation
 * (spec: "동일 seed 재현성"). Do not swap in Math.random anywhere in this
 * package.
 */
export type Rng = () => number;

export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return function next() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}
