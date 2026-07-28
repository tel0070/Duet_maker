# DEPLOYMENT.md

## Current status (be honest about this before claiming "it's live")

- Build, lint, typecheck, unit tests, and a Playwright e2e smoke test all
  pass **locally** for `apps/web`, including with `VITE_BASE_PATH=/Duet_maker/`
  set (verified manually during initial development).
- The workflow files exist and are believed correct, but **have not yet
  been confirmed to run successfully on GitHub's own Actions runners**, and
  the site has **not yet been confirmed reachable at a public URL**.
- This repository (`tel0070/Duet_maker`) is currently **private**. GitHub
  Pages via the Actions deployment method
  (`actions/deploy-pages`) is only available for private repos on
  GitHub Pro/Team/Enterprise, or for any public repo on the free plan.
  **Until the repo is made public (or the account has one of those paid
  plans) and Settings → Pages → Source is switched to "GitHub Actions",
  `deploy-production.yml` will build successfully but the deploy job will
  fail or the resulting URL won't be reachable.** This is a decision only
  a human with access to the GitHub account/billing can make — see
  `docs/adr/0001-hosting-choice.md`.

Do not report "온라인 공개 완료" (public launch complete) until someone has
actually visited the deployed URL and confirmed it loads.

## Hosting decision

**Chosen for now: GitHub Pages**, via `actions/deploy-pages`. Cloudflare
Pages was the spec's stated first choice, but GitHub Pages was selected for
the *initial* deployment because it needs no external account/API token
setup to configure from within a coding-agent session — see the full
reasoning, including Cloudflare Pages' actual advantage on a private repo
(it supports private-repo deploys on its free tier, where GitHub Pages
does not), in `docs/adr/0001-hosting-choice.md`.

## One-time manual setup (a human must do this in the GitHub UI)

1. Decide: make the repo public, or add it to a plan where Pages works
   privately, or switch to Cloudflare Pages instead (see the ADR).
2. Repo Settings → Pages → **Source: GitHub Actions**.
3. Push to `main` (or re-run the workflow) — `deploy-production.yml` will
   then actually publish.

Nothing else is required; there are no secrets/environment variables to
configure for the current GitHub Pages setup (no API tokens needed — the
workflow uses the repo's built-in `GITHUB_TOKEN` via `permissions:
id-token: write` / `pages: write`).

## Build configuration

- `VITE_BASE_PATH` — Vite's `base` config. The deploy workflow sets this to
  `/Duet_maker/` (a GitHub Pages *project* page is served under
  `https://<owner>.github.io/<repo>/`, not the domain root). Local dev
  (`pnpm dev`) and PR checks use the default `/`. If you add a custom
  domain (see below), change this to `/`.
- `VITE_PUBLIC_SITE_URL` — used only for Open Graph/sitemap metadata, not
  for routing.

## SPA routing

The current landing page has no client-side router (single page, no
routes) — there is nothing to configure yet. When Phase 2 adds routes,
GitHub Pages' standard trick applies: a `404.html` that's actually a copy
of `index.html` (with redirect logic) so deep links don't 404 on refresh.
`apps/web/public/404.html` today is a genuinely different, friendly 404
page (there are no real routes to redirect to yet) — revisit this file
when routing is added.

## Preview deployments (pull requests)

Not yet implemented. `pull-request-check.yml` runs the full
lint/typecheck/test/build/e2e gate on every PR but does not currently
publish a preview URL. GitHub Pages doesn't support per-PR preview URLs
natively the way Cloudflare Pages / Vercel do — this is one more point in
Cloudflare Pages' favor if per-PR previews become important; see the ADR.

## Rollback

Via `git revert` on `main` (triggers a normal redeploy of the reverted
state), or re-run an older successful workflow run from the Actions tab
("Re-run all jobs") — GitHub Pages serves whatever the most recent
successful `deploy-production.yml` run published.

## Custom domain

Not configured. To add one: put the domain in a `CNAME` file under
`apps/web/public/`, configure the domain's DNS per GitHub's docs, set
`VITE_BASE_PATH=/` (root, not a subpath), and update
`apps/web/public/sitemap.xml`/`robots.txt` and the hardcoded URLs in
`apps/web/src/App.tsx`/tests to match.

## Migrating to Cloudflare Pages later

1. Connect the GitHub repo in the Cloudflare dashboard, or use `wrangler
   pages deploy apps/web/dist` in a workflow.
2. Build command: `pnpm install && pnpm build` (with `VITE_BASE_PATH=/`
   since Cloudflare Pages serves at the domain root, not a subpath).
3. Output directory: `apps/web/dist`.
4. Cloudflare Pages gives per-PR preview URLs automatically — no extra
   workflow needed for that part, unlike the GitHub Pages setup above.
5. Remove or disable `deploy-production.yml`'s GitHub Pages job to avoid
   double-deploying, or keep both temporarily during a migration.
