# CODEX.md

Read `AGENTS.md` first — it is the single source of truth for this
repository. Also read `docs/ARCHITECTURE.md` and `HANDOFF.md` before
starting work. This file only adds Codex-specific notes.

- Do not assume any prior conversation with Claude, Kimi, or any other
  agent took place. Work only from what is in the repository.
- Preserve the existing contracts listed in `AGENTS.md` §7 (schemas,
  determinism guarantee, MIDI export format, browser-only data handling)
  unless you update the docs and tests in the same change.
- If refactoring, run the full test suite before and after to confirm no
  behavioral regression — `pnpm test` — and don't weaken assertions to make
  them pass.
