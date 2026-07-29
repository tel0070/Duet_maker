import {
  ALL_INSTRUCTIONS_OFF,
  type ArrangementInstruction,
  type DuetStyle,
  type SectionType,
  type SongSection,
} from "@duet-maker/shared-types";
import type { SectionPlan, StyleProfile } from "./types.js";

function instruction(
  overrides: Partial<ArrangementInstruction>,
): ArrangementInstruction {
  return { ...ALL_INSTRUCTIONS_OFF, ...overrides };
}

const CLEAN_POP: StyleProfile = {
  id: "cleanPop",
  displayName: "Clean Pop",
  descriptionKo: "자연스럽고 부르기 쉬운 3도·6도 중심의 화음",
  weights: {
    chordFit: 1.2,
    scaleFit: 1.0,
    consonance: 1.3,
    voiceLeading: 1.2,
    singability: 1.3,
    range: 1.0,
    independence: 0.6,
    tensionResolution: 0.8,
    sectionAppropriateness: 1.0,
    repetitionBalance: 0.8,
    styleMatch: 1.0,
    duetInterest: 0.5,
    phraseShape: 0.9,
  },
  relationPreference: {
    thirdAbove: 1.3,
    thirdBelow: 1.3,
    sixthAbove: 1.15,
    sixthBelow: 1.15,
    unison: 1.0,
    octaveAbove: 0.6,
    octaveBelow: 0.6,
    counterMelody: 0.4,
    custom: 0.5,
  },
  sectionDensityMultiplier: {
    intro: 0.3,
    verse: 0.6,
    preChorus: 0.9,
    chorus: 1.2,
    postChorus: 1.0,
    bridge: 0.8,
    breakdown: 0.4,
    finalChorus: 1.3,
    outro: 0.5,
    custom: 0.8,
  },
  beamWidth: 6,
};

const EMOTIONAL: StyleProfile = {
  id: "emotional",
  displayName: "Emotional",
  descriptionKo: "낮은 화음과 공통음 유지, 서스펜션과 해결 중심의 발라드 스타일",
  weights: {
    chordFit: 1.0,
    scaleFit: 1.0,
    consonance: 1.0,
    voiceLeading: 1.3,
    singability: 1.0,
    range: 1.0,
    independence: 0.9,
    tensionResolution: 1.4,
    sectionAppropriateness: 1.2,
    repetitionBalance: 0.7,
    styleMatch: 1.1,
    duetInterest: 0.8,
    phraseShape: 1.2,
  },
  relationPreference: {
    thirdBelow: 1.3,
    commonTone: 1.4,
    sixthBelow: 1.2,
    unison: 0.9,
    octaveAbove: 0.5,
    octaveBelow: 0.7,
    counterMelody: 0.9,
    custom: 0.6,
  },
  sectionDensityMultiplier: {
    intro: 0.2,
    verse: 0.4,
    preChorus: 0.7,
    chorus: 1.0,
    postChorus: 0.9,
    bridge: 1.1,
    breakdown: 0.3,
    finalChorus: 1.2,
    outro: 0.6,
    custom: 0.7,
  },
  beamWidth: 6,
};

const DRAMATIC: StyleProfile = {
  id: "dramatic",
  displayName: "Dramatic",
  descriptionKo: "넓은 음역과 옥타브·5도 중심으로 클라이맥스를 강조하는 스타일",
  weights: {
    chordFit: 1.0,
    scaleFit: 0.8,
    consonance: 0.9,
    voiceLeading: 0.8,
    singability: 0.7,
    range: 0.9,
    independence: 1.0,
    tensionResolution: 0.9,
    sectionAppropriateness: 1.3,
    repetitionBalance: 0.9,
    styleMatch: 1.3,
    duetInterest: 1.1,
    phraseShape: 1.0,
  },
  relationPreference: {
    octaveAbove: 1.5,
    octaveBelow: 1.2,
    fifthAbove: 1.3,
    fifthBelow: 1.2,
    thirdAbove: 0.9,
    unison: 0.8,
    counterMelody: 0.9,
    custom: 0.5,
  },
  sectionDensityMultiplier: {
    intro: 0.2,
    verse: 0.35,
    preChorus: 0.8,
    chorus: 1.2,
    postChorus: 1.0,
    bridge: 0.5,
    breakdown: 0.25,
    finalChorus: 1.6,
    outro: 0.7,
    custom: 0.7,
  },
  beamWidth: 8,
};

const TRUE_DUET: StyleProfile = {
  id: "trueDuet",
  displayName: "True Duet",
  descriptionKo: "번갈아 부르기, 콜앤리스폰스, 대선율 중심의 진짜 듀엣 스타일",
  weights: {
    chordFit: 0.9,
    scaleFit: 0.9,
    consonance: 0.9,
    voiceLeading: 1.0,
    singability: 1.0,
    range: 1.0,
    independence: 1.4,
    tensionResolution: 1.0,
    sectionAppropriateness: 1.4,
    repetitionBalance: 1.0,
    styleMatch: 1.3,
    duetInterest: 1.5,
    phraseShape: 1.1,
  },
  relationPreference: {
    counterMelody: 1.4,
    unison: 1.2,
    thirdAbove: 1.0,
    sixthBelow: 1.0,
    octaveAbove: 1.0,
    custom: 0.8,
  },
  sectionDensityMultiplier: {
    intro: 0.3,
    verse: 0.5,
    preChorus: 0.8,
    chorus: 1.1,
    postChorus: 1.0,
    bridge: 0.9,
    breakdown: 0.4,
    finalChorus: 1.4,
    outro: 0.6,
    custom: 0.8,
  },
  beamWidth: 8,
};

export const STYLE_PROFILES: Record<DuetStyle, StyleProfile> = {
  cleanPop: CLEAN_POP,
  emotional: EMOTIONAL,
  dramatic: DRAMATIC,
  trueDuet: TRUE_DUET,
};

/**
 * Per-style, per-section-type arrangement strategy. This is what makes the
 * four styles structurally different, not just re-weighted copies of the
 * same algorithm: each style plans a different instruction (and Korean
 * rationale) for the same section type.
 */
function planSectionInstruction(
  style: DuetStyle,
  section: SongSection,
): { instruction: ArrangementInstruction; reason: string } {
  const highEnergy = section.energy >= 0.7;
  const type = section.type;

  switch (style) {
    case "cleanPop":
      return planCleanPop(type, highEnergy);
    case "emotional":
      return planEmotional(type, highEnergy);
    case "dramatic":
      return planDramatic(type, highEnergy);
    case "trueDuet":
      return planTrueDuet(type, highEnergy);
  }
}

function planCleanPop(type: SectionType, highEnergy: boolean) {
  switch (type) {
    case "intro":
    case "outro":
      return {
        instruction: instruction({ rest: true }),
        reason: "인트로/아웃트로는 메인 보컬을 그대로 살리기 위해 화음을 비웁니다.",
      };
    case "verse":
      return {
        instruction: instruction({ harmonyBelow: true }),
        reason: "벌스는 가사 전달을 위해 낮은 화음만 가볍게 배치합니다.",
      };
    case "chorus":
    case "postChorus":
      return {
        instruction: instruction({ harmonyAbove: true, singTogether: true }),
        reason: "코러스는 두 목소리가 함께 부르는 안정적인 위쪽 화음을 사용합니다.",
      };
    case "finalChorus":
      return {
        instruction: instruction({
          harmonyAbove: true,
          singTogether: true,
          octave: highEnergy,
        }),
        reason: "마지막 코러스는 옥타브를 더해 듀엣 구성을 강화합니다.",
      };
    default:
      return {
        instruction: instruction({ harmonyAbove: true }),
        reason: "프리코러스/브리지 구간은 코러스 진입을 준비하는 위쪽 화음을 사용합니다.",
      };
  }
}

function planEmotional(type: SectionType, highEnergy: boolean) {
  switch (type) {
    case "intro":
    case "outro":
      return {
        instruction: instruction({ rest: true }),
        reason: "인트로/아웃트로는 감정선을 위해 두 번째 보컬을 비워둡니다.",
      };
    case "verse":
      return {
        instruction: instruction({ rest: true, delayedEntry: true }),
        reason: "벌스는 대부분 쉬고, 프레이즈 끝에서만 화음이 늦게 들어옵니다.",
      };
    case "preChorus":
      return {
        instruction: instruction({ sustainedPad: true, harmonyBelow: highEnergy }),
        reason: highEnergy
          ? "프리코러스는 공통음을 유지하면서 낮은 화음을 더해 긴장을 쌓습니다."
          : "프리코러스는 공통음을 길게 유지해 긴장을 쌓습니다.",
      };
    case "bridge":
    case "breakdown":
      return {
        instruction: instruction({ sustainedPad: true, harmonyBelow: true }),
        reason: "브리지는 낮은 화음과 서스테인으로 감정을 강조합니다.",
      };
    case "finalChorus":
      return {
        instruction: instruction({ harmonyBelow: true, singTogether: true }),
        reason: "마지막 코러스는 낮은 화음과 함께 부르기로 감정을 최대화합니다.",
      };
    default:
      return {
        instruction: instruction({ harmonyBelow: true }),
        reason: "코러스는 낮은 화음으로 서정적인 색을 더합니다.",
      };
  }
}

function planDramatic(type: SectionType, highEnergy: boolean) {
  switch (type) {
    case "intro":
    case "breakdown":
      return {
        instruction: instruction({ rest: true }),
        reason: "인트로/브레이크다운은 다음 클라이맥스와 대비되도록 비워둡니다.",
      };
    case "verse":
      return {
        instruction: instruction({ rest: true, harmonyBelow: highEnergy }),
        reason: "벌스는 대부분 비우고 에너지가 높을 때만 낮은 화음을 더합니다.",
      };
    case "preChorus":
      return {
        instruction: instruction({ harmonyBelow: true, delayedEntry: true }),
        reason: "프리코러스는 낮은 화음을 늦게 들여보내 상승감을 만듭니다.",
      };
    case "chorus":
    case "postChorus":
      return {
        instruction: instruction({ harmonyAbove: true, octave: true }),
        reason: "코러스는 옥타브를 더해 넓은 음역의 극적인 대비를 만듭니다.",
      };
    case "finalChorus":
      return {
        instruction: instruction({
          harmonyAbove: true,
          octave: true,
          singTogether: true,
        }),
        reason: "마지막 코러스는 옥타브와 함께 부르기를 모두 사용해 밀도를 최대화합니다.",
      };
    default:
      return {
        instruction: instruction({ harmonyAbove: true }),
        reason: "브리지 구간은 다음 클라이맥스를 준비하는 위쪽 화음을 사용합니다.",
      };
  }
}

function planTrueDuet(type: SectionType, highEnergy: boolean) {
  switch (type) {
    case "intro":
    case "outro":
      return {
        instruction: instruction({ rest: true }),
        reason: "인트로/아웃트로는 두 보컬이 아직 만나지 않은 상태로 둡니다.",
      };
    case "verse":
      return {
        instruction: instruction({ callAndResponse: true, delayedEntry: true }),
        reason: "벌스는 메인 보컬의 프레이즈가 끝날 때마다 응답하는 콜앤리스폰스 구조를 사용합니다.",
      };
    case "preChorus":
      return {
        instruction: instruction({ counterMelody: true }),
        reason: "프리코러스는 독립적인 대선율로 두 번째 성부의 존재감을 만듭니다.",
      };
    case "chorus":
    case "postChorus":
      return {
        instruction: instruction({ singTogether: true, unison: true }),
        reason: "코러스는 유니즌으로 함께 부르며 듀엣의 핵심 순간을 만듭니다.",
      };
    case "bridge":
    case "breakdown":
      return {
        instruction: instruction({ callAndResponse: true, counterMelody: true }),
        reason: "브리지는 대선율과 콜앤리스폰스를 섞어 두 보컬의 대화를 보여줍니다.",
      };
    case "finalChorus":
      return {
        instruction: instruction({
          singTogether: true,
          harmonyAbove: true,
          repeatPhrase: true,
          octave: highEnergy,
        }),
        reason: highEnergy
          ? "마지막 코러스는 두 파트가 결합하고 옥타브까지 더해 가장 큰 절정을 만듭니다."
          : "마지막 코러스는 두 파트가 결합하고 마지막 가사를 반복해 듀엣을 완성합니다.",
      };
    default:
      return {
        instruction: instruction({ counterMelody: true }),
        reason: "기본 구간은 대선율로 독립적인 두 번째 성부를 유지합니다.",
      };
  }
}

export function planSections(
  style: DuetStyle,
  sections: SongSection[],
): SectionPlan[] {
  return sections.map((section) => {
    const { instruction: instr, reason } = planSectionInstruction(
      style,
      section,
    );
    return { sectionId: section.id, instruction: instr, reason };
  });
}
