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

This dev environment has Chromium preinstalled at
`/opt/pw-browsers/chromium` (`playwright.config.ts` points there via
`PLAYWRIGHT_CHROMIUM_PATH` with that as the default) and
`PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1` is set so `npm install` doesn't try to
re-fetch it. On a GitHub Actions runner (a different environment), the
workflow instead runs `npx playwright install --with-deps chromium` — see
`.github/workflows/pull-request-check.yml`. If you're running locally
outside this specific dev container and don't have that env var set, run
`npx playwright install chromium` once.

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
