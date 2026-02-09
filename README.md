# AzerSync

Electron desktop app for syncing World of Warcraft addon folders across multiple machines through a shared GitHub repository.

## Current v0 capabilities

- `Source mode`: watches a local addons folder, mirrors it into a local repo cache, commits changes, and pushes to GitHub.
- `Client mode`: pulls latest branch state from GitHub and applies synced addons to a local target folder.
- Optional profile sync: sync an additional WoW profile/config path (for example `WTF` or `SavedVariables`).
- Local config persistence through Electron `userData`.
- Automatic Git detection (`PATH` plus common Windows Git locations) with optional explicit Git binary path in UI.
- Built-in in-place app updater (check, download, silent apply + restart) powered by GitHub Releases.
- Commit trust checks for client ingest:
  - trusted author email allowlist
  - optional signed-commit enforcement

## Project layout

- `src/main` Electron main process and sync engine
- `src/preload` secure IPC bridge
- `src/renderer` React UI
- `src/shared` shared TypeScript contracts
- `docs` setup and operations docs

## Dev workflow

- Default integration branch: `development`
- `main` remains stable baseline

## Local development

```bash
bun install
bun run dev
```

If package install fails in restricted environments, run development commands on a machine with npm registry access.

## Build and run

```bash
bun run build
bun run start
```

## Package release binaries

```bash
bun run dist:linux
bun run dist:win
```

Artifacts are written to `release/`.

`bun run dist:win` now includes `nsis` installer artifacts required for in-place Windows updates.

`bun run dist:win:installer` builds only the NSIS installer target, but on Linux it typically requires `wine`.

For in-place update delivery, each GitHub release must include the Windows updater metadata files (for example `latest.yml` plus the NSIS `.exe` package).

Windows helper script (run on native Windows PowerShell):

```powershell
.\scripts\release-windows-updater.ps1 -Tag v0.1.9
```

This script builds the Windows NSIS installer, ensures the installer filename matches `latest.yml`, uploads updater assets (`latest.yml`, installer `.exe`, optional `.blockmap`) to an existing GitHub release, and validates the upload.

## Security model (v0)

- Repository should be private.
- Client ingest blocks untrusted commits when trusted emails are configured.
- Signed commits can be enforced for stricter validation.
- GitHub token is currently stored in local app config for automation.
- In-place auto-update requires installer-based Windows builds (portable EXE builds are read-only for updates).

Read `docs/SETUP.md` for source/client setup steps.
