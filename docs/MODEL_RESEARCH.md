# MODEL_RESEARCH.md

Tracks why each non-trivial dependency was chosen, and its license.
Phase 1's harmony engine is rule/score based, not learned — the first real
ML models entered the project in Phase 5's `local-engine`.

## Models (local-engine, Phase 5)

| Model | License | Why | Alternative considered |
|---|---|---|---|
| [Demucs](https://github.com/facebookresearch/demucs) (`htdemucs`, two-stems mode) | MIT | Vocal/instrumental separation. Used via its own CLI (`python -m demucs --two-stems=vocals`) rather than its lower-level Python API — the CLI already does exactly the split this app needs, so calling it directly avoids re-implementing model loading/output handling. Runs on CPU (slow but no GPU dependency); pulls PyTorch, see the install-size warning in `local-engine/README.md`. | Spleeter (TensorFlow-based, no longer actively maintained as of research time) — Demucs has better separation quality in most published comparisons and is still maintained. |
| [basic-pitch](https://github.com/spotify/basic-pitch) | Apache-2.0 | Audio→MIDI melody transcription, run on the separated vocal stem. Chosen over a hand-rolled pitch tracker (autocorrelation/YIN) because a *real* vocal recording is far messier than the synthesizer tones `packages/harmony-core` was built against — a trained transcription model handles vibrato/breathiness/pitch glide much better than a bare pitch-detection algorithm would. | `crepe` (also usable for monophonic pitch tracking, but doesn't produce discrete note events — would need extra onset/offset segmentation logic that basic-pitch already does). |
| Krumhansl-Schmuckler key-finding + custom chord templates (`local-engine/app/chroma_math.py`) | N/A (hand-implemented, not a pretrained model) | No well-maintained, license-compatible, easy-to-install Python chord/key-detection library was found at research time (`chord-extractor` wraps Vamp plugins with a non-trivial native install; several PyPI chord-recognition packages are unmaintained). The KS algorithm itself is a standard, published (1990) music-theory technique, not a novel approach — reimplementing it directly against `librosa`'s chroma features avoided an extra heavy/fragile dependency for something this well-defined. See `local-engine/README.md` for its known limitation (major/minor triads only). |
| [librosa](https://librosa.org/) | ISC | Beat/tempo tracking, chroma features, RMS energy, self-similarity segmentation — the general-purpose audio analysis toolkit everything else in `local-engine` is built on. Mature, widely used, permissively licensed. |

## Runtime dependencies

| Package | Version | License | Why |
|---|---|---|---|
| `zod` | ^3.23 | MIT | Schema validation for every data model in `shared-types` — actively maintained, zero runtime deps, TS-first, widely used so any future agent already knows it. |
| `react` / `react-dom` | ^18.3 | MIT | Web UI. Chosen over a framework-less approach because the Phase 2 editor's component state (piano roll, multiple editable tables, generated-result display) would get unwieldy fast with plain DOM manipulation. |
| `zustand` | ^5.0 | MIT | Editor state (`apps/web/src/store/project-store.ts`). Small (no boilerplate providers/reducers), TS-first, and explicitly named as an acceptable option in the project's own recommended stack. See `docs/DECISIONS.md` for why not React Context or `persist` middleware. |
| `@breezystack/lamejs` | ^1.2 | LGPL-3.0 | Pure-JS MP3 encoding for the "MP3로 내보내기" feature — runs entirely client-side on a rendered `AudioBuffer` (via `OfflineAudioContext`), no server/API needed. Chosen over the original unmaintained `lamejs` package for its modern ESM build and shipped types. LGPL is copyleft on *this library's own* modifications, not on code that merely calls it as an unmodified dependency — worth a licensing review before any commercial redistribution, same as any other LGPL dependency. |

## Dev dependencies of note

| Package | License | Why |
|---|---|---|
| `vitest` | MIT | Test runner for all packages — fast, native ESM/TS support, no separate ts-jest config needed. |
| `vite` + `@vitejs/plugin-react` | MIT | Dev server + build for `apps/web`. |
| `@playwright/test` | Apache-2.0 | The one e2e smoke test. Chosen over Cypress for first-class multi-browser support if that matters later, and because it's what this dev environment has preinstalled. |
| `@testing-library/react` | MIT | Web unit tests; encourages testing rendered output over implementation details. |
| `eslint` + `typescript-eslint` | MIT | Linting, flat config (ESLint 9). |
| `tsx` | MIT | Runs the one-off `generate-examples.ts` maintenance script without a separate build step. |
| `fake-indexeddb` | MIT | Polyfills `indexedDB` in jsdom for `apps/web`'s storage/store/editor unit tests — jsdom itself doesn't implement IndexedDB. Real browsers (and Playwright's real Chromium for e2e) need no polyfill. |
| `@testing-library/user-event` | MIT | Simulates real user interactions (clicks, typing) in web unit tests, more realistically than firing raw DOM events. |

## Deliberately not used (and why)

- **No MIDI-writing library** (`midi-writer-js`, `@tonejs/midi`, etc.) —
  `packages/harmony-core/src/midi-export.ts` is a ~150-line hand-written
  Standard MIDI File writer instead. The format needed (3 tracks, note
  on/off, one tempo event) is small enough that a dependency would add more
  surface area (transitive deps, license to track, API to learn) than it
  saves, and a self-contained writer is fully covered by an independent
  byte-level test (`midi-export.test.ts`) rather than trusting a third
  party's correctness.
- **No monorepo build tool** (Nx, Turborepo, Lerna) — 4 packages, no slow
  builds yet, no need for remote caching. Revisit if the package count or
  build time grows enough to justify the configuration cost. Record that
  decision in a new ADR if/when it happens.
- **No Tailwind CSS for `apps/web`** — the current landing page is small
  enough that plain CSS (`App.css`) is less overhead than configuring a
  utility framework. Revisit when Phase 2's editor UI has enough surface
  area that utility classes would clearly pay for themselves.
- **No AI/ML model in the harmony engine itself** — see `ARCHITECTURE.md`
  for why `packages/harmony-core` stays rule/score-based rather than a
  trained model; that reasoning is unaffected by `local-engine` gaining
  real ML models for a different job (audio analysis, not harmony
  decisions). When Phase 6 (singing-synthesis adapter) needs a model,
  evaluate candidates here against: license (commercial-use
  compatibility), runtime footprint, maintenance activity, and whether
  weights can be self-hosted rather than requiring a paid API — then
  record the choice as a new ADR, not just an entry in this table.
- **No browser-side pitch/chord model (WASM/TF.js) for Phase 5** — a
  server-side (localhost) Python process was chosen over an in-browser
  model for `local-engine` because Demucs/basic-pitch's Python packages are
  mature and simple to call as-is; porting them to run in-browser would
  mean re-exporting/re-implementing against WASM or TF.js with no
  guarantee of matching quality. Revisit if a strong browser-native option
  becomes the mature choice later.
