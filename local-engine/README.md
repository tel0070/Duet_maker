# local-engine (not yet implemented)

Status: **Phase 5, not started.** This directory is reserved for the
optional, purely-local (no cloud, localhost-only) audio analysis engine
described in `AGENTS.md` and `docs/ARCHITECTURE.md`:

- vocal/instrumental stem separation
- pitch extraction from a vocal recording
- BPM/key/chord/section detection from a full mix

None of this exists yet. The web app and `packages/harmony-core` do not
depend on it and work fully without it — this engine is meant to sit behind
the `StemSeparationProvider` / `PitchExtractionProvider` / etc. interfaces
already defined in `packages/shared-types/src/providers.ts`, so it can be
built later without changing any call site.

When implementation starts, follow the plan in `AGENTS.md` §Phase 5:
Python + FastAPI, `localhost`-only, no data leaves the machine.

`scripts/start-local-engine.bat` currently detects that `app/main.py`
doesn't exist and prints this status instead of pretending to start a
server.
