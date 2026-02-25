# Changelog

## 0.3.0 (2026-02-25)

### Refactoring
- Extract shared constants from magic numbers across the codebase
- Add structured error types (SyncError, ConfigError, GitError, TrustError, PathError)
- Improve config store with validation and atomic writes
- Extract path utilities, backup manager, and trust validator into dedicated modules
- Organize IPC handlers by domain with section headers
- Improve sync service with async cleanup and better logging
- Break down monolithic App.tsx into focused components:
  - TitleBar, PreflightPanel, UpdatePanel, LogViewer
  - SyncView, SettingsView, DashboardView
- Create shared renderer utilities module
- Create useConfig and useSyncState custom hooks

### Improvements
- Add JSDoc documentation to all shared types and API
- Improve preload bridge type safety with explicit casts
- Refine CSS design tokens and improve variable organization
- Add confirmation dialogs for destructive sync operations
- Improve accessibility with ARIA attributes and focus management
- Add smooth transitions and loading state animations
- Improve .gitignore coverage and add .editorconfig

## 0.2.2

- Add startup preflight checks, profile presets, and rollback snapshots

## 0.2.1

- Polish renderer layout and lighten visual theme

## 0.2.0

- Redesign layout and brand identity

## 0.1.9

- Apply downloaded updates silently on restart
