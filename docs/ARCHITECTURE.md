# ARCHITECTURE.md

## Layers

```
apps/web            React + Vite static app. Renders UI, calls harmony-core
                     directly (no network hop — it's a library, not a service).
packages/harmony-core  Pure TypeScript. No DOM, no fetch, no fs. Runs identically
                     in the browser, in Node (tests), or from a CLI script.
packages/shared-types  Data model + zod schemas + provider interfaces. Depended
                     on by both of the above (and, later, by local-engine's
                     TypeScript-facing contracts, even though local-engine
                     itself is Python).
local-engine         Optional, separate Python process. Not started. Talks to
                     the web app only via localhost HTTP, and only for the
                     Level 2/3 analysis features — never required for core use.
```

Why this split: the spec requires the app to work with zero server cost and
zero required accounts, and to keep user files off any server by default.
Putting the actual harmony algorithm in a dependency-free TypeScript package
means it runs the same way everywhere (browser, tests, future CLI tools)
and can be audited/tested without spinning up a browser or a server.

## Data flow (once Phase 2 exists)

```
MIDI file / manual input
        │
        ▼
NoteEvent[] + ChordEvent[] + SongSection[]   (packages/shared-types)
        │
        ▼
generateDuetArrangement()                     (packages/harmony-core)
        │
        ▼
DuetArrangement { harmonyTrack, sectionPlans, scoreBreakdown, warnings }
        │
        ├──► rendered piano roll / explanations (apps/web UI)
        └──► exportArrangementToMidi() ──► downloadable .mid file
```

Everything above the `local-engine` box runs in the visitor's browser.
Nothing in that path performs a network request.

## Why a pure-TS harmony engine instead of calling an AI model

This was a deliberate, spec-mandated constraint, not a default: no paid
LLM/audio APIs, no server-side inference. `packages/harmony-core` is a
rule- and score-based system (candidate generation + weighted multi-criteria
scoring + beam search), not a machine-learning model. See
`docs/HARMONY_RULES.md` for how it actually decides notes, and
`docs/DECISIONS.md` for alternatives that were considered.

## Provider interfaces: the seam for optional heavier analysis

`packages/shared-types/src/providers.ts` defines interfaces
(`PitchExtractionProvider`, `ChordDetectionProvider`,
`SectionDetectionProvider`, `StemSeparationProvider`,
`AudioAnalysisProvider`, `VocalSynthesisProvider`) that any future
implementation must satisfy. Two consequences that matter for anyone
extending this project:

1. Application code (the web app) must depend on these interfaces, never on
   a concrete model/library name. Swapping the underlying model later
   should not require touching call sites.
2. `isAvailable()` must reflect a real capability check (WebGPU/WASM
   support detected, local-engine reachable at `localhost`, etc.) — never a
   hardcoded `true`. A feature that can't actually run must say so, not
   silently fail or fake a result.

Only `LocalGuideSynthProvider` (simple Web Audio playback: piano / soft
synth / choir pad / humming — no model, no network) is planned as the
initial `VocalSynthesisProvider`; it hasn't been built yet either (Phase 3).

## Monorepo tooling

pnpm workspaces, no Nx/Turborepo/Lerna. At this package count (4, likely
growing to ~6 by Phase 5), a build-orchestration tool would add
configuration surface without solving a real problem yet — see
`docs/DECISIONS.md` if that changes.

## Deployment

Static site only (no server-rendered app, no serverless functions in the
happy path). See `docs/DEPLOYMENT.md` for the GitHub Pages vs Cloudflare
Pages decision and current status.
