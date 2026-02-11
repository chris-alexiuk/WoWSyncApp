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

export async function loadConfig(): Promise<AppConfig> {
  const filePath = getConfigPath();

  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    const migratedPreset =
      parsed.profileSyncPreset ?? (parsed.syncProfiles ? 'full_wtf' : DEFAULT_CONFIG.profileSyncPreset);

    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      profileSyncPreset: migratedPreset,
      syncProfiles: migratedPreset !== 'addons_only',
      trustedAuthorEmails: parsed.trustedAuthorEmails ?? DEFAULT_CONFIG.trustedAuthorEmails,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function saveConfig(config: AppConfig): Promise<void> {
  const filePath = getConfigPath();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(config, null, 2), 'utf8');
}
