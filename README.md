# Duet Maker

**Solo-to-Duet Vocal Arranger** — a browser-based tool that turns a solo
melody and chord progression into a musically coherent second vocal part:
harmony above/below, unison, octave doubling, common-tone holds,
counter-melody, and call-and-response, varied by song section and by one of
four arrangement styles.

> 이 프로그램은 사용자가 직접 제작했거나 사용 권한을 가진 음악 파일의 편곡,
> 연습 및 창작을 위한 도구입니다. 타인의 저작물을 무단으로 배포하거나
> 상업적으로 이용하지 마십시오.

## Status

Early development. The harmony-generation engine (`packages/harmony-core`)
is implemented and tested; the browser editor UI that would let a visitor
actually use it (upload a melody, pick a style, hear/edit the result) has
**not** been built yet — see `HANDOFF.md` and `ROADMAP.md` for exactly what
works today versus what's planned.

**Public URL:** not yet confirmed live. A GitHub Pages deploy workflow
exists (`.github/workflows/deploy-production.yml`) and builds successfully,
but this repository is currently private, which blocks GitHub Pages
publishing on the free plan. See `docs/DEPLOYMENT.md` for what needs to
happen (make the repo public, or upgrade, or switch to Cloudflare Pages)
before there is a real public URL to put here.

## Why this exists

Most "harmonizer" tools just shift every note up a fixed interval (a third,
a fifth). That doesn't sound like a real second singer. This project scores
many candidate notes per melody note — chord tones, tensions, common-tone
holds, passing tones, rests — using ~13 weighted criteria (chord fit, voice
leading, singability, vocal range, section appropriateness, style match,
and more), then picks a sequence via beam search so the choice is
phrase-aware rather than purely greedy. Four styles (Clean Pop, Emotional,
Dramatic, True Duet) use genuinely different section-level strategies, not
just different weight numbers.

## No server, no account, no cloud cost

- No paid AI APIs, no required login, no required server.
- Core generation runs in the browser (or in Node, for tests/tooling) —
  `packages/harmony-core` has no DOM dependency.
- User audio/MIDI/project files are never uploaded anywhere. See
  `docs/PRIVACY.md`.
- Deployable as a static site (GitHub Pages today; Cloudflare Pages
  documented as an alternative — see `docs/DEPLOYMENT.md`).

## Repository layout

```
apps/web/               React + Vite landing page (editor UI: Phase 2, not started)
packages/shared-types/  Core data model + zod schemas + provider interfaces
packages/harmony-core/  The harmony generation engine (pure TypeScript)
local-engine/           Reserved for an optional local Python analysis server (Phase 5, not started)
examples/               Demo projects, chord progressions, generated MIDI
scripts/                Windows .bat helpers
docs/                   Architecture, product spec, harmony rules, deployment, privacy, ADRs
```

## Getting started

```bash
pnpm install
pnpm dev        # apps/web dev server
pnpm test       # unit tests, all packages
pnpm validate   # lint + typecheck + test + build
```

Windows: `scripts\setup-windows.bat`, then `scripts\start-web.bat`.

Try the engine directly (no UI needed) by reading
`packages/harmony-core/tests/generate.test.ts`, or inspect the pre-generated
examples under `examples/demo-projects/` and `examples/midi/`.

## Documentation map

- `AGENTS.md` — start here if you're a coding agent (Claude/Kimi/Codex or
  human) picking up this project. It is the single source of truth; the
  per-agent `CLAUDE.md`/`KIMI.md`/`CODEX.md` files only point back to it.
- `HANDOFF.md` — current state, in detail, updated after major work.
- `ROADMAP.md` — phase-by-phase checklist.
- `docs/ARCHITECTURE.md`, `docs/PRODUCT_SPEC.md`, `docs/HARMONY_RULES.md`,
  `docs/DATA_FORMATS.md`, `docs/TEST_STRATEGY.md`, `docs/DEPLOYMENT.md`,
  `docs/PRIVACY.md`, `docs/BROWSER_SUPPORT.md`, `docs/MODEL_RESEARCH.md`,
  `docs/TROUBLESHOOTING.md`, `docs/DECISIONS.md`, `docs/adr/`.

## License

MIT — see `LICENSE`. Library/dependency licenses are tracked in
`docs/MODEL_RESEARCH.md` as they're added.
