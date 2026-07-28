import type { DuetStyle } from "@duet-maker/shared-types";
import { useProjectStore } from "../store/project-store.js";
import "./StylePicker.css";

const STYLES: Array<{ id: DuetStyle; label: string; description: string }> = [
  { id: "cleanPop", label: "Clean Pop", description: "자연스럽고 부르기 쉬운 3도·6도 중심" },
  { id: "emotional", label: "Emotional", description: "낮은 화음과 공통음 유지, 서스펜션" },
  { id: "dramatic", label: "Dramatic", description: "넓은 음역, 옥타브·5도, 극적인 대비" },
  { id: "trueDuet", label: "True Duet", description: "콜앤리스폰스, 대선율, 유니즌" },
];

export function StylePicker() {
  const selectedStyle = useProjectStore((s) => s.selectedStyle);
  const setSelectedStyle = useProjectStore((s) => s.setSelectedStyle);

  return (
    <div className="style-picker" role="radiogroup" aria-label="편곡 스타일 선택">
      {STYLES.map((style) => (
        <button
          key={style.id}
          type="button"
          role="radio"
          aria-checked={selectedStyle === style.id}
          className={`style-picker-option${selectedStyle === style.id ? " style-picker-option--active" : ""}`}
          onClick={() => setSelectedStyle(style.id)}
        >
          <strong>{style.label}</strong>
          <span>{style.description}</span>
        </button>
      ))}
    </div>
  );
}
