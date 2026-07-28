# ADR 0001: Initial hosting — GitHub Pages over Cloudflare Pages

## Status

Accepted, provisionally. Revisit once the repo's visibility/plan situation
is resolved by a human (see "Consequences" below) — this decision was made
under a real constraint (no ability to create/configure external
accounts/API tokens from within an automated coding session) that a human
maintainer isn't bound by.

## Context

The project brief states Cloudflare Pages as priority 1, GitHub Pages as
priority 2, and asks for one initial choice with the reasoning recorded
here, plus both configurations documented.

## Decision

Use **GitHub Pages**, deployed via `actions/deploy-pages` in
`.github/workflows/deploy-production.yml`, for the initial deployment.

## Reasoning

- GitHub Pages needs zero external setup beyond a one-time repo Settings
  toggle ("Pages → Source: GitHub Actions") and uses the workflow's
  built-in `GITHUB_TOKEN` — no API token to create, store as a secret, or
  hand to anyone.
- Cloudflare Pages would need a Cloudflare account, an API token (stored as
  a repo secret), and a project created in the Cloudflare dashboard — none
  of which a coding-agent session in this repository can set up on its own
  without a human performing those account-level steps first.
- Given the project must actually reach a real public URL as part of
  "Phase 0 done" criteria, the path requiring the fewest external
  dependencies to *attempt* first was chosen.

## Consequences (the tradeoff, stated plainly)

- **This repo is currently private.** GitHub Pages via Actions only
  publishes from private repos on GitHub Pro/Team/Enterprise; on the free
  plan it requires the repo to be public. Cloudflare Pages, by contrast,
  supports deploying from a private repo on its free tier. **This means
  the "GitHub Pages first" choice may not actually be able to go live
  without either making the repo public or paying for a GitHub plan** —
  see `docs/DEPLOYMENT.md` for the exact blocker and options.
- Cloudflare Pages also gives per-PR preview deployments out of the box;
  GitHub Pages does not (see `docs/DEPLOYMENT.md` "Preview deployments").
  If preview URLs become important before this is revisited, that's
  another point toward migrating.
- Both configurations are documented (`docs/DEPLOYMENT.md`) so switching
  later is a config change, not a redesign — nothing in `apps/web`'s code
  is GitHub-Pages-specific beyond the `VITE_BASE_PATH` value and the
  `public/CNAME`-less setup, both trivially adjustable.

## Revisit when

A human decides how to resolve the private-repo constraint (make it
public, pay for a plan, or switch to Cloudflare Pages) — track this in
`HANDOFF.md` "Items requiring human evaluation" until resolved.
