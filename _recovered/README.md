# Recovered files from pre-existing listy project

On 2026-06-09 ~21:37, Claude scaffolded a new Vite app into this directory
without noticing it already contained a project (files dated ~20:59 the same
evening). Some pre-existing files were overwritten or deleted in the process.

## Fully recovered (exact copies, saved in this folder)

- `index.html` — original referenced `/favicon.svg`, title "listy"
- `vite.config.ts` — stock Vite react template config
- `src-main.tsx` — stock template main.tsx

## Partially recovered (only the first 5 lines were seen; saved as fragments)

- `src-App.tsx.fragment` — imported useState, reactLogo, viteLogo,
  **heroImg from './assets/hero.png'**, and './App.css'
- `src-index.css.fragment` — custom design tokens (light theme)

## Lost, not recoverable

- `src/App.css`
- `src/assets/hero.png`
- `src/assets/vite.svg` (8.7 KB — larger than stock, possibly customized)
- `src/assets/react.svg`
- `public/icons.svg` (5 KB)
- `public/favicon.svg` (if it existed)

Checked for recovery without success: git history (none existed), APFS local
snapshots (none), VS Code/Cursor/Zed/Sublime local history (no entries for
this path), Spotlight search for copies elsewhere (none), Trash (nothing).
