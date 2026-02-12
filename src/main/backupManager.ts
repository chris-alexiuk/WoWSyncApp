import path from 'node:path';
import fs from 'fs-extra';
import { app } from 'electron';
import type { AppConfig } from '../shared/types';
import {
  ADDONS_SUBDIR,
  PROFILES_SUBDIR,
  CLIENT_BACKUPS_SUBDIR,
  CLIENT_BACKUP_META_FILE,
  MAX_CLIENT_BACKUPS,
} from '../shared/constants';
import { ConfigError, PathError } from '../shared/errors';
import { safePathSegment } from './pathUtils';

type LogFn = (line: string) => void;

export interface LatestCommitInfo {
  hash: string;
  email: string;
}

/** Copy source directory to target, replacing target contents. */
export async function mirrorDirectory(sourcePath: string, targetPath: string): Promise<void> {
  await fs.ensureDir(sourcePath);
  await fs.emptyDir(targetPath);

  await fs.copy(sourcePath, targetPath, {
    overwrite: true,
    errorOnExist: false,
    filter: (entryPath) => {
      const fileName = path.basename(entryPath);
      return fileName !== '.git' && fileName !== '.DS_Store' && fileName !== 'Thumbs.db';
    },
  });
}

export class BackupManager {
  getClientBackupRootPath(config: AppConfig): string {
    const safeBranch = safePathSegment(config.branch.trim() || 'default');
    return path.join(app.getPath('userData'), CLIENT_BACKUPS_SUBDIR, safeBranch);
  }

  async listBackupSnapshots(backupRoot: string): Promise<string[]> {
    const entries = await fs.readdir(backupRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a));
  }

  async pruneClientBackups(backupRoot: string): Promise<void> {
    const snapshots = await this.listBackupSnapshots(backupRoot);
    const expired = snapshots.slice(MAX_CLIENT_BACKUPS);
    for (const snapshotName of expired) {
      await fs.remove(path.join(backupRoot, snapshotName));
    }
  }

  async createClientBackup(
    config: AppConfig,
    latestCommit: LatestCommitInfo,
  ): Promise<string | null> {
    const targetAddonsPath = config.targetAddonsPath.trim();
    const targetProfilesPath = config.targetProfilesPath.trim();
    const backupRoot = this.getClientBackupRootPath(config);
    await fs.ensureDir(backupRoot);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotName = `${timestamp}-${latestCommit.hash.slice(0, 8)}`;
    const snapshotPath = path.join(backupRoot, snapshotName);
    await fs.ensureDir(snapshotPath);

    let hasPayload = false;
    if (await fs.pathExists(targetAddonsPath)) {
      await fs.copy(targetAddonsPath, path.join(snapshotPath, ADDONS_SUBDIR), {
        overwrite: true,
        errorOnExist: false,
      });
      hasPayload = true;
    }

    if (config.syncProfiles && targetProfilesPath && (await fs.pathExists(targetProfilesPath))) {
      await fs.copy(targetProfilesPath, path.join(snapshotPath, PROFILES_SUBDIR), {
        overwrite: true,
        errorOnExist: false,
      });
      hasPayload = true;
    }

    if (!hasPayload) {
      await fs.remove(snapshotPath);
      return null;
    }

    const metadata = {
      createdAt: new Date().toISOString(),
      branch: config.branch,
      commitHash: latestCommit.hash,
      commitAuthor: latestCommit.email,
      syncProfiles: config.syncProfiles,
      profileSyncPreset: config.profileSyncPreset,
      mode: config.mode,
    };
    await fs.writeJson(path.join(snapshotPath, CLIENT_BACKUP_META_FILE), metadata, { spaces: 2 });

    await this.pruneClientBackups(backupRoot);
    return snapshotName;
  }

  async restoreLatestClientBackup(config: AppConfig, log: LogFn): Promise<string> {
    if (config.mode !== 'client') {
      throw new ConfigError('Rollback is available only in client mode.');
    }

    if (!config.targetAddonsPath.trim()) {
      throw new PathError('Client addons folder is required for rollback.');
    }

    const backupRoot = this.getClientBackupRootPath(config);
    if (!(await fs.pathExists(backupRoot))) {
      throw new PathError('No rollback snapshots are available yet.');
    }

    const snapshots = await this.listBackupSnapshots(backupRoot);
    const latestSnapshot = snapshots[0];

    if (!latestSnapshot) {
      throw new PathError('No rollback snapshots are available yet.');
    }

    const snapshotPath = path.join(backupRoot, latestSnapshot);
    const backupAddonsPath = path.join(snapshotPath, ADDONS_SUBDIR);
    if (!(await fs.pathExists(backupAddonsPath))) {
      throw new PathError(`Rollback snapshot ${latestSnapshot} is missing addons data.`);
    }

    log(`Restoring addons from snapshot ${latestSnapshot}...`);
    await mirrorDirectory(backupAddonsPath, config.targetAddonsPath.trim());

    const backupProfilesPath = path.join(snapshotPath, PROFILES_SUBDIR);
    const shouldRestoreProfiles =
      config.syncProfiles && config.targetProfilesPath.trim() && (await fs.pathExists(backupProfilesPath));

    if (shouldRestoreProfiles) {
      log(`Restoring profiles from snapshot ${latestSnapshot}...`);
      await mirrorDirectory(backupProfilesPath, config.targetProfilesPath.trim());
    }

    return shouldRestoreProfiles
      ? `Restored addons and profiles from snapshot ${latestSnapshot}.`
      : `Restored addons from snapshot ${latestSnapshot}.`;
  }
}
