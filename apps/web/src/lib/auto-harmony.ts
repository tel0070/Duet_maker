import type { DuetArrangement } from "@duet-maker/shared-types";
import { generateDuetArrangement, STYLE_PROFILES, type HarmonyGenerationInput } from "@duet-maker/harmony-core";

const SEEDS_PER_STYLE = 3;

/**
 * The old editor exposed harmony-core's 4 styles as a manual picker plus a
 * "다른 결과 보기" reroll button — useful for composing by hand, but this
 * app no longer has a composing screen: it should just hand back the best
 * result it can. Every style x a few seeds is generated (the search itself
 * is a fast in-browser candidate search, not the slow part of this app —
 * that's local-engine's ML analysis) and the highest `overallScore`
 * candidate wins, so the output stays the richly-varied, best-fit harmony
 * the engine can produce without asking the user to choose anything.
 */
export function generateBestArrangement(input: Omit<HarmonyGenerationInput, "style" | "seed">): DuetArrangement {
  let best: DuetArrangement | null = null;
  for (const profile of Object.values(STYLE_PROFILES)) {
    for (let seed = 1; seed <= SEEDS_PER_STYLE; seed++) {
      const candidate = generateDuetArrangement({ ...input, style: profile.id, seed });
      if (!best || candidate.overallScore > best.overallScore) {
        best = candidate;
      }
    }
  }
  if (!best) {
    throw new Error("화음을 생성하지 못했습니다.");
  }
  return best;
}
