# TROUBLESHOOTING.md

## `pnpm install` fails / workspace packages not found

Make sure you're running pnpm commands from the repo root, and that
`pnpm-workspace.yaml` still lists `apps/*` and `packages/*`. If you added a
new package directory, it needs its own `package.json` before pnpm will
recognize it — an empty directory is silently ignored, not an error.

## `tsc` complains about a workspace package's types

Cross-package imports (e.g. `@duet-maker/harmony-core` importing
`@duet-maker/shared-types`) resolve via pnpm's workspace symlinks in
`node_modules`, not TypeScript project references — each package's
`tsconfig.json` extends the root `tsconfig.base.json` independently and
does *not* use `"references"` (that requires `"composite": true` on the
referenced project, which was more configuration than this repo's size
currently justifies). If you see `TS6306`, you've likely re-added a
`references` entry — remove it.

## A package's tests pass but `pnpm typecheck` still fails

Each package's `typecheck` script runs *two* `tsc` invocations: one for
`src/` (`tsconfig.json`) and one that also includes `tests/`
(`tsconfig.test.json`). Vitest's esbuild transform doesn't full-typecheck
test files, so a type error in a test can slip past `pnpm test` but should
still be caught by `pnpm typecheck` — if it isn't, check that the package's
`tsconfig.test.json` actually includes the file in question.

## ESLint errors on an unused function parameter

The shared `eslint.config.mjs` requires unused args/vars to be prefixed
with `_`, with one exception: **prefer actually using the parameter
meaningfully** (see the `highEnergy` fix in `styles.ts` during initial
development — the right fix was to use the parameter to vary behavior, not
to prefix it with `_` and ship a dead parameter that misleads the next
reader into thinking it does something).

## Playwright e2e test can't find a browser

`playwright.config.ts` only sets `launchOptions.executablePath` when the
`PLAYWRIGHT_CHROMIUM_PATH` env var is explicitly set — it is **not**
defaulted to any path, specifically because an earlier version hardcoded
a sandbox-only fallback (`/opt/pw-browsers/chromium`) that broke CI, where
that path doesn't exist (see `docs/DECISIONS.md`).

- **On a GitHub Actions runner**: nothing to do — the workflow runs
  `npx playwright install --with-deps chromium` first, which installs a
  browser at Playwright's own default cache location, and `pnpm test:e2e`
  finds it automatically with no override needed.
- **In a dev sandbox that preinstalls Chromium at a fixed path** (e.g.
  `/opt/pw-browsers/chromium`, with `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1`
  set so `npm install` doesn't try to re-fetch it): export
  `PLAYWRIGHT_CHROMIUM_PATH=/opt/pw-browsers/chromium` before running
  `pnpm test:e2e`, since the installed browser's headless-shell revision
  can mismatch what this project's pinned `@playwright/test` version
  expects by default otherwise (`chromium.launch()` defaults to
  `chrome-headless-shell`, a separate download from full Chromium).
- **Any other local machine**: run `npx playwright install chromium` once
  if you don't have a Chromium install Playwright already knows about.

## `generateDuetArrangement` gives different results on what should be a repeat run

Check that you're passing the exact same `mainMelody`/`chords`/`sections`
*objects* (or at least value-identical ones) and the same `seed` — if
you're constructing fresh test fixtures with auto-incrementing IDs each
call (see the `note()`/`chord()` helpers in
`packages/harmony-core/tests/fixtures.ts`), two separately-built "identical"
inputs will actually have different `id` fields, and the harmony track's
`originalNoteId` values will differ even though the pitches are the same.
This bit the initial reproducibility test during development — the fix was
to build the input once and generate twice from the same object, not to
rebuild fixtures twice.

## GitHub Pages deploy workflow runs but the site is 404

See `docs/DEPLOYMENT.md` — most likely causes are (a) the repo is private
and on the free plan (GitHub Pages via Actions needs a public repo or a
paid plan for private repos), or (b) Settings → Pages → Source hasn't been
set to "GitHub Actions" yet (one-time manual step in the GitHub UI, not
automatable by a workflow file).
