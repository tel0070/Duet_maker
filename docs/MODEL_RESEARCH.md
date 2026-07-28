# MODEL_RESEARCH.md

Tracks why each non-trivial dependency was chosen, and its license. There
is no ML model in this project yet (Phase 1's harmony engine is rule/score
based, not learned) — this file will gain a "models" section once Phase 4+
adds browser-side pitch extraction or a singing-synthesis adapter.

## Runtime dependencies

| Package | Version | License | Why |
|---|---|---|---|
| `zod` | ^3.23 | MIT | Schema validation for every data model in `shared-types` — actively maintained, zero runtime deps, TS-first, widely used so any future agent already knows it. |
| `react` / `react-dom` | ^18.3 | MIT | Only dependency for the (currently minimal) web UI. Chosen over a framework-less approach because Phase 2's editor will need real component state (piano roll, multiple tracks) where plain DOM manipulation would get unwieldy fast. |

## Dev dependencies of note

| Package | License | Why |
|---|---|---|
| `vitest` | MIT | Test runner for all packages — fast, native ESM/TS support, no separate ts-jest config needed. |
| `vite` + `@vitejs/plugin-react` | MIT | Dev server + build for `apps/web`. |
| `@playwright/test` | Apache-2.0 | The one e2e smoke test. Chosen over Cypress for first-class multi-browser support if that matters later, and because it's what this dev environment has preinstalled. |
| `@testing-library/react` | MIT | Web unit tests; encourages testing rendered output over implementation details. |
| `eslint` + `typescript-eslint` | MIT | Linting, flat config (ESLint 9). |
| `tsx` | MIT | Runs the one-off `generate-examples.ts` maintenance script without a separate build step. |

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
- **No AI/ML model of any kind** — see `ARCHITECTURE.md` for why the
  harmony engine is rule/score-based rather than a trained model. When
  Phase 4 (browser pitch extraction) or Phase 6 (singing synthesis adapter)
  actually needs one, evaluate candidates here against: license
  (commercial-use compatibility), browser support (WebGPU/WASM, model file
  size), maintenance activity, and whether weights can be self-hosted as a
  static file rather than requiring a paid API — then record the choice
  as a new ADR, not just an entry in this table.
