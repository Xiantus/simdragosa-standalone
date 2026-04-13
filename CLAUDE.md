# Git Branching Workflow

## Branch Strategy

- **`master`** — production/release branch. Only receives merges from `develop`.
- **`develop`** — integration branch for local testing. All feature and fix branches merge here first.
- **Feature/fix branches** — branch off `develop`, merge back into `develop` when done.

## Rules

1. Never commit directly to `master`.
2. Create feature/fix branches from `develop`:
   ```
   git checkout develop
   git checkout -b feature/my-feature
   ```
3. Merge completed work into `develop` first:
   ```
   git checkout develop
   git merge feature/my-feature
   ```
4. To release, merge `develop` into `master`:
   ```
   git checkout master
   git merge develop
   git push
   ```

---

# Project Context (Wiki)

At session start, read these wiki pages for full project context:

- `C:\Users\Xiant\Documents\Projects\vault\Big Vault\wiki\sources\project-simdragosa-standalone.md` — architecture, v1 vs v2 comparison, key constraints
- `C:\Users\Xiant\Documents\Projects\vault\Big Vault\wiki\overviews\simdragosa-ecosystem.md` — how this project fits with auto_sim, addon, sds-lockfile

## Key facts (summary)

- v2 desktop app: Electron + React + TypeScript frontend; Python backend via subprocess with IPC bridge
- User workflow: add characters → select tracks → GO → view ranked DPS bars → `/reload` in WoW
- Writes `SimdragosaData.lua` to WoW addon folder; consumed by `simdragosa-addon`
- Distributed as Windows installer via GitHub Releases; auto-updater via electron-updater
- Python backend lives in `python/` subdirectory; **requires Python 3.10+ from python.org** (not Microsoft Store)
- Supersedes `sds-lockfile` (v1); shares core sim logic with `auto_sim`
- **Raidbots has no public API** — uses internal endpoints; session managed by `raidbots_session.py`
