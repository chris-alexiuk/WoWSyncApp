# Setup Guide

This guide describes one source machine and one or more client machines.

## 1. Create sync data repository

1. Create a private GitHub repo that will hold synced addon payload.
2. Choose the shared branch name (default: `development`).
3. Create a GitHub Personal Access Token with repo read/write permissions.

## 2. Configure source machine

1. Open app.
2. Select mode: `Source Machine (Push)`.
3. Fill:
   - Machine Label (example: `Raid-PC-Source`)
   - GitHub Repository URL
   - Branch
   - GitHub Token
   - Optional Git Binary Path (set this if Git is not on PATH)
   - Source Addons Folder (`World of Warcraft/_retail_/Interface/AddOns`)
   - Optional: enable profile sync and set Source Profiles Folder (`World of Warcraft/_retail_/WTF` or account `SavedVariables`)
   - Git author name/email
4. Save config.
5. Press `Sync Now` once to initialize branch and payload.
6. Press `Start Auto Sync` to keep pushing incremental changes.

## 3. Configure each client machine

1. Open app.
2. Select mode: `Client Machine (Pull)`.
3. Fill:
   - Machine Label
   - Same GitHub Repository URL
   - Same Branch
   - GitHub Token (read access is enough)
   - Optional Git Binary Path (example: `C:\Program Files\Git\cmd\git.exe`)
   - Client Addons Folder (`World of Warcraft/_retail_/Interface/AddOns`)
   - Optional: enable profile sync and set Client Profiles Folder to matching destination path
4. Configure trust guardrail:
   - add trusted author email(s), and/or
   - enable `Require signed commits on client ingest`
5. Save config.
6. Press `Sync Now` to ingest latest addons.
7. Optional: `Start Auto Sync` for periodic pulls.
8. Use `App Updates`:
   - `Check for Updates`
   - `Download` when a release is available
   - `Install and Restart` to apply in place

## 4. Trust validation behavior

Client mode validates commit history on the chosen branch:

- If trusted emails are configured, every commit author email must match the allowlist.
- If signed commit enforcement is enabled, every commit must have a valid trusted signature state.

If validation fails, sync is aborted and the runtime panel shows the failure reason.

## 5. Notes

- Auto-sync in source mode also watches file changes and schedules a near-immediate push.
- v0 mirrors addon folder content as-is (target folder is replaced with synced payload each run).
- If profile sync is enabled, the profile target folder is also replaced with synced payload each run.
- Windows in-place updates require the NSIS installer build (portable builds show an unsupported message).
