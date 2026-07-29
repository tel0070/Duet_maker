import type { DuetArrangement } from "@duet-maker/shared-types";
import "./HarmonyResults.css";

export interface HarmonyResultsProps {
  arrangement: DuetArrangement | null;
}

export function HarmonyResults({ arrangement }: HarmonyResultsProps) {
  if (!arrangement) {
    return <p className="harmony-results-empty">아직 생성된 화음이 없습니다. 스타일을 고르고 "화음 생성"을 눌러보세요.</p>;
  }

  return (
    <div className="harmony-results">
      <div className="harmony-results-summary">
        <p data-testid="score-summary">
          종합 점수: <strong>{arrangement.overallScore.toFixed(2)}</strong> (seed {arrangement.randomSeed}, 엔진 v
          {arrangement.generationVersion})
        </p>
        {arrangement.warnings.length > 0 && (
          <ul className="harmony-results-warnings">
            {arrangement.warnings.map((warning) => (
              <li key={warning}>⚠ {warning}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="editor-table" data-testid="harmony-track-table">
        <table>
          <thead>
            <tr>
              <th>관계</th>
              <th>코드 역할</th>
              <th>움직임</th>
              <th>신뢰도</th>
              <th>이유</th>
            </tr>
          </thead>
          <tbody>
            {arrangement.harmonyTrack.map((note, i) => (
              <tr key={`${note.originalNoteId}-${i}`}>
                <td>{note.generatedPitch === null ? "쉼" : note.relationToMelody}</td>
                <td>{note.chordRole}</td>
                <td>{note.motionType}</td>
                <td>{note.confidence.toFixed(2)}</td>
                <td className="harmony-results-reason">{note.styleReason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
