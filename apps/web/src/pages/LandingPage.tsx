import "./LandingPage.css";

interface FeatureStatus {
  name: string;
  status: "stable" | "beta" | "experimental" | "requiresLocalEngine" | "unsupported";
  note: string;
}

const FEATURES: FeatureStatus[] = [
  {
    name: "화음 생성 엔진 (Harmony Core)",
    status: "beta",
    note: "코드/멜로디/스타일 입력을 받아 4가지 스타일의 화음을 생성합니다. 편집기에 연결되어 실제로 사용할 수 있습니다.",
  },
  {
    name: "편집기 (멜로디·코드·구간 입력, 화음 생성/내보내기)",
    status: "beta",
    note: "MIDI 가져오기, 피아노롤에서 음표 드래그·크기조절·추가·삭제, 코드/구간 표 편집, 스타일별 생성, 구간별 재생성, MIDI·JSON 내보내기, 자동 저장을 지원합니다. 코드·구간은 아직 표로만 편집할 수 있습니다.",
  },
  {
    name: "프로젝트 저장",
    status: "beta",
    note: "브라우저 IndexedDB에 자동 저장되어 새로고침 후에도 복구됩니다. 여러 프로젝트를 목록으로 관리하는 기능은 아직 없습니다 (자동 저장 슬롯 1개).",
  },
  {
    name: "가이드 재생",
    status: "beta",
    note: "피아노·신시사이저·합창 패드·허밍 중 하나로 메인 멜로디, 두 번째 보컬, 또는 둘을 동시에 재생할 수 있습니다. 구간을 반복하는 A-B 루프와 4비트 카운트인을 지원합니다. 실제 악기나 목소리를 흉내낸 것이 아니라 단순한 합성음입니다.",
  },
  {
    name: "녹음",
    status: "beta",
    note: "마이크로 녹음하고 바로 들어본 뒤 파일로 내보낼 수 있습니다. 가이드 재생과 동시에 맞춰 시작되지는 않습니다 (각각 따로 시작).",
  },
  {
    name: "음원 업로드·자동 분석",
    status: "unsupported",
    note: "아직 개발 중입니다 (Phase 4 이후). 현재는 MIDI/코드 진행 직접 입력만 지원합니다.",
  },
];

const STATUS_LABEL: Record<FeatureStatus["status"], string> = {
  stable: "Stable",
  beta: "Beta",
  experimental: "Experimental",
  requiresLocalEngine: "Requires Local Engine",
  unsupported: "준비 중",
};

export function LandingPage() {
  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">Duet Maker</p>
        <h1>Solo-to-Duet Vocal Arranger</h1>
        <p className="tagline">
          솔로곡의 멜로디와 코드를 바탕으로 높은 화음, 낮은 화음, 유니즌, 대선율과 주고받기를
          조합해 새로운 듀엣 파트를 설계하세요.
        </p>
        <a className="hero-cta" href="#editor">
          편곡 시작하기 (Beta)
        </a>
      </header>

      <section className="notice">
        <strong>개인정보 안내:</strong> 업로드한 음악 파일과 프로젝트는 외부 서버로 전송되지
        않습니다. 기본 분석과 편곡은 사용자의 브라우저에서 처리됩니다. 회원가입과 로그인은
        필요하지 않습니다.
      </section>

      <section>
        <h2>현재 개발 단계</h2>
        <p>
          Harmony Core 엔진과 기본 편집기가 연결되어 실제로 화음을 생성하고 MIDI로 내보낼 수
          있습니다. 다만 아직 초기 버전이며, 아래처럼 기능별로 지원 수준이 다릅니다.
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
          <li>피아노롤에서 멜로디 음표는 드래그로 편집할 수 있지만, 코드와 구간은 아직 표로만 편집할 수 있습니다.</li>
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
