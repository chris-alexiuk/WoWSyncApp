# WoW Sync App

Electron desktop app for syncing World of Warcraft addon folders across multiple machines through a shared GitHub repository.

## Current v0 capabilities

- `Source mode`: watches a local addons folder, mirrors it into a local repo cache, commits changes, and pushes to GitHub.
- `Client mode`: pulls latest branch state from GitHub and applies synced addons to a local target folder.
- Local config persistence through Electron `userData`.
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

## Security model (v0)

- Repository should be private.
- Client ingest blocks untrusted commits when trusted emails are configured.
- Signed commits can be enforced for stricter validation.
- GitHub token is currently stored in local app config for automation.

Read `docs/SETUP.md` for source/client setup steps.
