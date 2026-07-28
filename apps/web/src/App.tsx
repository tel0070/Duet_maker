import "./App.css";

interface FeatureStatus {
  name: string;
  status: "stable" | "beta" | "experimental" | "requiresLocalEngine" | "unsupported";
  note: string;
}

const FEATURES: FeatureStatus[] = [
  {
    name: "화음 생성 엔진 (Harmony Core)",
    status: "beta",
    note: "코드/멜로디/스타일 입력을 받아 4가지 스타일의 화음을 생성합니다. 알고리즘과 테스트는 완료되었지만 아직 편집 화면에 연결되지 않았습니다.",
  },
  {
    name: "MIDI 내보내기",
    status: "beta",
    note: "생성된 화음을 표준 MIDI 파일로 내보내는 기능은 구현되어 있습니다 (예시: examples/midi).",
  },
  {
    name: "브라우저 편집 화면 (피아노롤 등)",
    status: "unsupported",
    note: "아직 개발 중입니다 (Phase 2). 지금은 GitHub 저장소의 예시 프로젝트로만 결과를 확인할 수 있습니다.",
  },
  {
    name: "음원 업로드·자동 분석",
    status: "unsupported",
    note: "아직 개발 중입니다 (Phase 4 이후). 현재는 MIDI/코드 진행 직접 입력만 지원할 계획입니다.",
  },
];

const STATUS_LABEL: Record<FeatureStatus["status"], string> = {
  stable: "Stable",
  beta: "Beta",
  experimental: "Experimental",
  requiresLocalEngine: "Requires Local Engine",
  unsupported: "준비 중",
};

export function App() {
  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Duet Maker</p>
        <h1>Solo-to-Duet Vocal Arranger</h1>
        <p className="tagline">
          솔로곡의 멜로디와 코드를 바탕으로 높은 화음, 낮은 화음, 유니즌, 대선율과 주고받기를
          조합해 새로운 듀엣 파트를 설계하세요.
        </p>
      </header>

      <section className="notice">
        <strong>개인정보 안내:</strong> 업로드한 음악 파일과 프로젝트는 외부 서버로 전송되지
        않습니다. 기본 분석과 편곡은 사용자의 브라우저에서 처리됩니다. 회원가입과 로그인은
        필요하지 않습니다.
      </section>

      <section>
        <h2>현재 개발 단계</h2>
        <p>
          이 프로젝트는 초기 개발 단계입니다. 지금 이 페이지는 아직 편집 화면이 아니라, 프로젝트
          소개와 진행 상태를 보여주는 랜딩 페이지입니다.
        </p>
        <ul className="feature-list">
          {FEATURES.map((feature) => (
            <li key={feature.name} className={`feature-item feature-item--${feature.status}`}>
              <span className={`status-badge status-badge--${feature.status}`}>
                {STATUS_LABEL[feature.status]}
              </span>
              <div>
                <p className="feature-name">{feature.name}</p>
                <p className="feature-note">{feature.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>기술적 한계</h2>
        <ul>
          <li>유료 AI API, 서버 저장, 로그인 없이 동작하도록 설계되어 있습니다.</li>
          <li>화음 생성은 규칙과 점수 기반 알고리즘이며, 자연스러운 AI 가창 합성은 아직 없습니다.</li>
          <li>현재 확인 가능한 결과는 GitHub 저장소의 examples/ 폴더에 있는 샘플 프로젝트와 MIDI 파일입니다.</li>
        </ul>
      </section>

      <footer className="footer">
        <a href="https://github.com/tel0070/Duet_maker" target="_blank" rel="noreferrer">
          GitHub 저장소
        </a>
        <span aria-hidden="true">·</span>
        <span>MIT License</span>
      </footer>
      <p className="disclaimer">
        본 프로그램은 사용자가 직접 제작했거나 사용 권한을 가진 음악 파일의 편곡, 연습 및 창작을
        위한 도구입니다. 타인의 저작물을 무단으로 배포하거나 상업적으로 이용하지 마십시오.
      </p>
    </div>
  );
}
