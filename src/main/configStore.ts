import fs from 'node:fs/promises';
import path from 'node:path';
import { app } from 'electron';
import type { AppConfig } from '../shared/types';

const DEFAULT_CONFIG: AppConfig = {
  mode: 'source',
  machineLabel: 'AzerSync Source',
  repoUrl: '',
  branch: 'development',
  githubToken: '',
  gitBinaryPath: '',
  profileSyncPreset: 'addons_only',
  syncProfiles: false,
  sourceAddonsPath: '',
  sourceProfilesPath: '',
  targetAddonsPath: '',
  targetProfilesPath: '',
  syncIntervalSeconds: 30,
  trustedAuthorEmails: [],
  requireSignedCommits: false,
  authorName: 'AzerSync Bot',
  authorEmail: 'azersync-bot@example.local',
};

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

/** Ensure loaded config has all expected keys with sane fallbacks. */
function sanitizeConfig(raw: Partial<AppConfig>): AppConfig {
  const migratedPreset =
    raw.profileSyncPreset ?? (raw.syncProfiles ? 'full_wtf' : DEFAULT_CONFIG.profileSyncPreset);

  return {
    ...DEFAULT_CONFIG,
    ...raw,
    profileSyncPreset: migratedPreset,
    syncProfiles: migratedPreset !== 'addons_only',
    trustedAuthorEmails: Array.isArray(raw.trustedAuthorEmails)
      ? raw.trustedAuthorEmails
      : DEFAULT_CONFIG.trustedAuthorEmails,
  };
}

export async function loadConfig(): Promise<AppConfig> {
  const filePath = getConfigPath();

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    return sanitizeConfig(parsed);
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const filePath = getConfigPath();
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });

  // Atomic write: write to temp file then rename to avoid partial writes.
  const tmpFile = path.join(dir, `.config-${process.pid}-${Date.now()}.tmp`);
  try {
    await fs.writeFile(tmpFile, JSON.stringify(config, null, 2), 'utf8');
    await fs.rename(tmpFile, filePath);
  } catch (error) {
    // Clean up temp file on failure.
    try { await fs.unlink(tmpFile); } catch {}
    throw error;
  }
}
