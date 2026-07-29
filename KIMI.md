# KIMI.md

Read `AGENTS.md` first — it is the single source of truth for this
repository. Also read `docs/ARCHITECTURE.md` and `HANDOFF.md` before
starting work. This file only adds Kimi-specific notes.

- Do not assume any prior conversation with Claude or any other agent took
  place. Work only from what is in the repository.
- After changing code, update the relevant tests and, if you changed
  behavior described in `docs/HARMONY_RULES.md`, `docs/DATA_FORMATS.md`, or
  `HANDOFF.md`, update those documents in the same change.
- Run `pnpm validate` before reporting a task complete.
