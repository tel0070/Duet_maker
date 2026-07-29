# BROWSER_SUPPORT.md

## Today (Phase 0/1)

The only shipped artifact is a static landing page (`apps/web`) built with
Vite/React using standard, broadly-supported web APIs (no WebGPU/WASM/
SharedArrayBuffer dependency yet). It should work in any current version
of Chrome, Firefox, Safari, or Edge, on desktop or mobile. No capability
detection exists yet because nothing on the page needs it.

`packages/harmony-core` itself has zero DOM dependency and runs in any
JS engine (browser or Node) — its browser compatibility is bounded only by
whatever bundler/target the consuming app uses (currently ES2022).

## Planned capability tiers (not yet implemented — see `ROADMAP.md`)

| Feature | Requires | Fallback if unsupported |
|---|---|---|
| MIDI import, chord input, harmony generation, MIDI export (Phase 2) | Any modern browser, IndexedDB, Web Worker | None needed — this is the baseline tier and must work everywhere. |
| Piano/synth/hum guide playback, recording (Phase 3) | Web Audio API, `AudioWorklet`; microphone permission for recording | Playback degrades gracefully without recording if mic permission is denied; the rest of the app still works. |
| Browser-side pitch extraction from an uploaded vocal (Phase 4, "Level 2") | WebAssembly at minimum; WebGPU preferred for speed | Feature is hidden/disabled with an explicit message (e.g. "현재 브라우저에서는 고급 보컬 분석을 지원하지 않습니다. MIDI 기반 듀엣 편곡 기능은 계속 사용할 수 있습니다.") — MIDI-based features remain fully usable. |
| Full-mix stem/chord/section analysis (Phase 5) | The optional `local-engine` process running on `localhost` | Feature is simply absent from the UI if `local-engine` isn't detected — no fallback to a cloud service, ever. |

When Phase 4 actually adds a capability-gated feature, implement the
detection for real (test `navigator.gpu`, `WebAssembly`, actual
`SharedArrayBuffer` availability, etc.) before shipping the UI for it —
don't ship a button that's silently broken on unsupported browsers.

## Mobile

The current landing page is responsive (relative units, no fixed-width
layout) and has been checked at mobile viewport widths conceptually via
the CSS, but not yet verified on a real device or with a device-emulation
test. Phase 2's piano-roll editor will very likely need a reduced/simplified
mobile editing mode per the original product brief — full piano-roll
editing is expected to be desktop/tablet-oriented, with mobile treated as
view/light-edit only. Not designed yet.

## Accessibility

Baseline expectations for anything added to `apps/web`: keyboard
navigability, visible focus states, accessible names on interactive
elements, sufficient color contrast, and never encoding meaning by color
alone (relevant once the piano roll exists — note states must also be
distinguishable by shape/label, not color only). The current landing page
uses only `<a>` links (no custom interactive widgets yet), so there isn't
much to verify beyond contrast, which was chosen to meet at least WCAG AA
for body text against the dark background — not independently audited
with a contrast-checking tool yet.
