# Listy

[![CI](https://github.com/firstprateek/listy/actions/workflows/ci.yml/badge.svg)](https://github.com/firstprateek/listy/actions/workflows/ci.yml)

A personal infinite-list tracker for anything on your mind. Installable PWA,
local-first, built for scroll performance.

## Stack

- **Vite + React + TypeScript**
- **@tanstack/react-virtual** — windowed rendering; ~40 DOM rows regardless of
  list size (tested at 50,000 items), native scrolling so iOS momentum physics
  apply
- **idb (IndexedDB)** — all data stays on-device, newest-first via a
  `by-createdAt` index, write-through on every mutation
- **vite-plugin-pwa** — installable, auto-updating service worker, offline app
  shell

## Develop

```sh
npm install
npm run dev          # or: npx vite
```

Dev console helper: `__listySeed(50000)` seeds N test items (dev builds only).

## Build & serve

```sh
npx tsc -b && npx vite build
npx vite preview     # serve dist/ locally
```

Install on iOS: open in Safari → Share → Add to Home Screen.

## Tests & CI

```sh
npm run test         # vitest (jsdom + fake-indexeddb)
npm run check        # lint + typecheck + test + build, same as CI
```

GitHub Actions runs audit → lint → typecheck → test → build on every push and
PR (`.github/workflows/ci.yml`) and uploads the built `dist/` as a deployable
artifact. Pushing a `v*` tag builds and attaches a `dist` tarball plus its
`.sha256` checksum to a GitHub Release (`.github/workflows/release.yml`) — grab
it to deploy on the Mac Mini and verify with `shasum -a 256 -c`.

A git **pre-push hook** (`.githooks/pre-push`) runs lint + typecheck + test
before every push so broken code never leaves your machine; it self-installs
via the `prepare` script on `npm install`. Bypass once with `git push
--no-verify`. **Dependabot** (`.github/dependabot.yml`) opens grouped weekly
PRs for npm and Actions updates, which CI validates automatically.

> Note: branch protection / required status checks are paywalled for private
> repos on the free plan, so the pre-push hook is the enforcement mechanism
> here. CI still re-checks everything server-side within ~30 s of a push.

## Manual testing notes

Verified interactively (30 checks): add flows (trim/whitespace-reject/unicode/
XSS-as-text/multiline measurement/rapid adds), toggle + delete + empty state,
reload persistence, relative time buckets, 50k-item virtualization (window
correctness, no overlap, bounded DOM, ~44 ms worst-case far-jump window
rebuild in dev mode), add-while-scrolled-deep snaps to top, 320–1280 px
layouts, a11y labels, and production PWA (manifest, icons, service worker
activation, precache, SW-controlled reload persistence).

`_recovered/` preserves files from a pre-existing project found in this
directory before scaffolding; see its README.
