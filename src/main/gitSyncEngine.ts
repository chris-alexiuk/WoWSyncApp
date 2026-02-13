import path from 'node:path';
import { spawnSync } from 'node:child_process';
import fs from 'fs-extra';
import { app } from 'electron';
import simpleGit, { type SimpleGit } from 'simple-git';
import type { AppConfig, PreflightIssue, PreflightResult } from '../shared/types';
import { ConfigError, GitError, PathError } from '../shared/errors';
import {
  ADDONS_SUBDIR,
  PROFILES_SUBDIR,
  META_FILE_NAME,
  WINDOWS_GIT_CANDIDATES,
  GIT_SPAWN_TIMEOUT_MS,
  GIT_REACHABILITY_TIMEOUT_MS,
} from '../shared/constants';
import {
  normalizeConfiguredGitPath,
  isLikelySavedVariablesPath,
  firstLine,
  redactSecret,
} from './pathUtils';
import { BackupManager, mirrorDirectory } from './backupManager';
import { verifyCommitTrust, type LatestCommitInfo } from './trustValidator';

type LogFn = (line: string) => void;

interface PreparedRepo {
  git: SimpleGit;
  repoPath: string;
  remoteHasBranch: boolean;
}

interface ReachabilityCheckResult {
  ok: boolean;
  reason?: string;
}

export class GitSyncEngine {
  private backupManager = new BackupManager();

  async run(config: AppConfig, log: LogFn): Promise<string> {
    this.validateConfig(config);
    const gitBinary = await this.resolveGitBinary(config, log);

    const prepared = await this.prepareRepo(config, log, gitBinary);

    if (config.mode === 'source') {
      return this.runSourceSync(prepared, config, log);
    }

    return this.runClientSync(prepared, config, log);
  }

  async runPreflight(config: AppConfig): Promise<PreflightResult> {
    const issues: PreflightIssue[] = [];

    const addIssue = (issue: PreflightIssue): void => {
      issues.push(issue);
    };

    const mode = config.mode;
    const sourceAddonsPath = config.sourceAddonsPath.trim();
    const sourceProfilesPath = config.sourceProfilesPath.trim();
    const targetAddonsPath = config.targetAddonsPath.trim();
    const targetProfilesPath = config.targetProfilesPath.trim();
    const repoUrl = config.repoUrl.trim();
    const branch = config.branch.trim();

    if (!repoUrl) {
      addIssue({
        code: 'missing_repo_url',
        severity: 'error',
        message: 'Repository URL is required.',
        action: 'openSettings',
      });
    }

    if (!branch) {
      addIssue({
        code: 'missing_branch',
        severity: 'error',
        message: 'Branch is required.',
        action: 'openSettings',
      });
    }

    if (mode === 'source') {
      if (!sourceAddonsPath) {
        addIssue({
          code: 'missing_source_addons_path',
          severity: 'error',
          message: 'Source AddOns folder is required in source mode.',
          action: 'pickSourceAddonsPath',
        });
      } else if (!(await fs.pathExists(sourceAddonsPath))) {
        addIssue({
          code: 'source_addons_path_not_found',
          severity: 'error',
          message: `Source AddOns folder does not exist: ${sourceAddonsPath}`,
          action: 'pickSourceAddonsPath',
        });
      }
    }

    if (mode === 'client') {
      if (!targetAddonsPath) {
        addIssue({
          code: 'missing_target_addons_path',
          severity: 'error',
          message: 'Client AddOns folder is required in client mode.',
          action: 'pickTargetAddonsPath',
        });
      }

      if (!config.requireSignedCommits && config.trustedAuthorEmails.length === 0) {
        addIssue({
          code: 'missing_client_trust_policy',
          severity: 'error',
          message: 'Client mode needs trusted author emails or signed commit enforcement.',
          action: 'openSettings',
        });
      }
    }

    if (config.syncProfiles) {
      if (mode === 'source') {
        if (!sourceProfilesPath) {
          addIssue({
            code: 'missing_source_profiles_path',
            severity: 'error',
            message: 'Source profile folder is required when profile sync is enabled.',
            action: 'pickSourceProfilesPath',
          });
        } else if (!(await fs.pathExists(sourceProfilesPath))) {
          addIssue({
            code: 'source_profiles_path_not_found',
            severity: 'error',
            message: `Source profile folder does not exist: ${sourceProfilesPath}`,
            action: 'pickSourceProfilesPath',
          });
        }

        if (
          config.profileSyncPreset === 'account_saved_variables' &&
          sourceProfilesPath &&
          !isLikelySavedVariablesPath(sourceProfilesPath)
        ) {
          addIssue({
            code: 'source_profiles_not_saved_variables',
            severity: 'warning',
            message:
              "Account SavedVariables preset is active. Point source profile path to a SavedVariables folder (for example .../WTF/Account/<id>/SavedVariables).",
            action: 'pickSourceProfilesPath',
          });
        }
      } else {
        if (!targetProfilesPath) {
          addIssue({
            code: 'missing_target_profiles_path',
            severity: 'error',
            message: 'Client profile folder is required when profile sync is enabled.',
            action: 'pickTargetProfilesPath',
          });
        }

        if (
          config.profileSyncPreset === 'account_saved_variables' &&
          targetProfilesPath &&
          !isLikelySavedVariablesPath(targetProfilesPath)
        ) {
          addIssue({
            code: 'target_profiles_not_saved_variables',
            severity: 'warning',
            message:
              "Account SavedVariables preset is active. Point client profile path to a SavedVariables folder (for example .../WTF/Account/<id>/SavedVariables).",
            action: 'pickTargetProfilesPath',
          });
        }
      }
    }

    let gitBinary = '';
    try {
      gitBinary = await this.resolveGitBinary(config, () => {});
    } catch (error) {
      addIssue({
        code: 'git_unavailable',
        severity: 'error',
        message: error instanceof Error ? error.message : String(error),
        action: 'pickGitBinary',
      });
    }

    if (repoUrl && gitBinary) {
      const reachability = this.checkRepositoryReachability(repoUrl, config.githubToken, gitBinary);
      if (!reachability.ok) {
        addIssue({
          code: 'repo_unreachable',
          severity: 'warning',
          message:
            reachability.reason ??
            'Repository could not be reached right now. Check token/network/repository access.',
          action: 'openSettings',
        });
      }
    }

    return {
      checkedAt: new Date().toISOString(),
      ok: issues.every((issue) => issue.severity !== 'error'),
      issues,
    };
  }

  async restoreLatestClientBackup(config: AppConfig, log: LogFn): Promise<string> {
    return this.backupManager.restoreLatestClientBackup(config, log);
  }

  private validateConfig(config: AppConfig): void {
    if (config.profileSyncPreset === 'addons_only' && config.syncProfiles) {
      throw new ConfigError("Profile preset is 'AddOns only' but profile sync is enabled.");
    }

    if (config.profileSyncPreset !== 'addons_only' && !config.syncProfiles) {
      throw new ConfigError('Profile preset requires profile sync to be enabled.');
    }

    if (!config.repoUrl.trim()) {
      throw new ConfigError('Repository URL is required.');
    }

    if (!config.branch.trim()) {
      throw new ConfigError('Branch is required.');
    }

    if (config.mode === 'source' && !config.sourceAddonsPath.trim()) {
      throw new ConfigError('Source addons folder is required in source mode.');
    }

    if (config.mode === 'source' && config.syncProfiles && !config.sourceProfilesPath.trim()) {
      throw new ConfigError('Source profiles folder is required when profile sync is enabled.');
    }

    if (
      config.mode === 'source' &&
      config.syncProfiles &&
      config.profileSyncPreset === 'account_saved_variables' &&
      !isLikelySavedVariablesPath(config.sourceProfilesPath)
    ) {
      throw new ConfigError(
        "Account SavedVariables preset requires source profile path to point at a SavedVariables folder.",
      );
    }

    if (config.mode === 'client' && !config.targetAddonsPath.trim()) {
      throw new ConfigError('Client addons folder is required in client mode.');
    }

    if (config.mode === 'client' && config.syncProfiles && !config.targetProfilesPath.trim()) {
      throw new ConfigError('Client profiles folder is required when profile sync is enabled.');
    }

    if (
      config.mode === 'client' &&
      config.syncProfiles &&
      config.profileSyncPreset === 'account_saved_variables' &&
      !isLikelySavedVariablesPath(config.targetProfilesPath)
    ) {
      throw new ConfigError(
        "Account SavedVariables preset requires client profile path to point at a SavedVariables folder.",
      );
    }

    if (
      config.mode === 'client' &&
      !config.requireSignedCommits &&
      config.trustedAuthorEmails.length === 0
    ) {
      throw new ConfigError(
        'Client trust check requires at least one trusted author email or signed commit enforcement.',
      );
    }
  }

  private getRepoCachePath(): string {
    return path.join(app.getPath('userData'), 'sync-repo-cache');
  }

  private buildAuthRepoUrl(repoUrl: string, token: string): string {
    const trimmed = repoUrl.trim();

    if (!token.trim()) {
      return trimmed;
    }

    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol === 'https:') {
        parsed.username = token.trim();
        return parsed.toString();
      }
    } catch {
      // Preserve original URL for non-HTTP remotes (SSH/local).
    }

    return trimmed;
  }

  private isGitBinaryAvailable(binaryPath: string): boolean {
    try {
      const result = spawnSync(binaryPath, ['--version'], {
        windowsHide: true,
        timeout: GIT_SPAWN_TIMEOUT_MS,
      });

      return result.status === 0;
    } catch {
      return false;
    }
  }

  private async resolveGitBinary(config: AppConfig, log: LogFn): Promise<string> {
    const configured = normalizeConfiguredGitPath(config.gitBinaryPath);
    if (configured) {
      if (await fs.pathExists(configured) && this.isGitBinaryAvailable(configured)) {
        return configured;
      }

      throw new GitError(
        `Configured Git binary path is invalid: ${configured}. Set it to a valid git executable.`,
      );
    }

    if (this.isGitBinaryAvailable('git')) {
      return 'git';
    }

    if (process.platform === 'win32') {
      for (const candidate of WINDOWS_GIT_CANDIDATES) {
        if ((await fs.pathExists(candidate)) && this.isGitBinaryAvailable(candidate)) {
          log(`Using Git binary at ${candidate}`);
          return candidate;
        }
      }
    }

    throw new GitError(
      "Git executable was not found. Install Git and add it to PATH, or set 'Git Binary Path' (for example: C:\\Program Files\\Git\\cmd\\git.exe).",
    );
  }

  private async prepareRepo(
    config: AppConfig,
    log: LogFn,
    gitBinary: string,
  ): Promise<PreparedRepo> {
    const repoPath = this.getRepoCachePath();
    const gitDir = path.join(repoPath, '.git');
    const authRepoUrl = this.buildAuthRepoUrl(config.repoUrl, config.githubToken);

    if (!(await fs.pathExists(gitDir))) {
      log('Cloning sync repository into local cache...');
      await fs.ensureDir(path.dirname(repoPath));
      await fs.remove(repoPath);
      await simpleGit({
        binary: gitBinary,
        unsafe: { allowUnsafeCustomBinary: true },
      }).clone(authRepoUrl, repoPath);
    }

    const git = simpleGit({
      baseDir: repoPath,
      binary: gitBinary,
      unsafe: { allowUnsafeCustomBinary: true },
    });

    await git.remote(['set-url', 'origin', authRepoUrl]);
    await git.fetch('origin');

    await git.addConfig('user.name', config.authorName.trim() || 'AzerSync Bot', false, 'local');
    await git.addConfig(
      'user.email',
      config.authorEmail.trim() || 'azersync-bot@example.local',
      false,
      'local',
    );

    const localBranches = await git.branchLocal();
    const remoteBranches = await git.branch(['-r']);

    const branchName = config.branch.trim();
    const remoteBranchName = `origin/${branchName}`;
    const remoteHasBranch = remoteBranches.all.includes(remoteBranchName);

    if (localBranches.all.includes(branchName)) {
      await git.checkout(branchName);
    } else if (remoteHasBranch) {
      await git.checkout(['-b', branchName, remoteBranchName]);
    } else {
      await git.checkoutLocalBranch(branchName);
    }

    if (remoteHasBranch) {
      await git.pull('origin', branchName, { '--ff-only': null });
    }

    return { git, repoPath, remoteHasBranch };
  }

  private async runSourceSync(
    prepared: PreparedRepo,
    config: AppConfig,
    log: LogFn,
  ): Promise<string> {
    const sourceAddonsPath = config.sourceAddonsPath.trim();

    if (!(await fs.pathExists(sourceAddonsPath))) {
      throw new PathError(`Source addons folder does not exist: ${sourceAddonsPath}`);
    }

    const repoAddonsPath = path.join(prepared.repoPath, ADDONS_SUBDIR);
    const sourceProfilesPath = config.sourceProfilesPath.trim();
    const repoProfilesPath = path.join(prepared.repoPath, PROFILES_SUBDIR);

    log('Mirroring addon files into sync repository cache...');
    await mirrorDirectory(sourceAddonsPath, repoAddonsPath);

    if (config.syncProfiles) {
      if (!(await fs.pathExists(sourceProfilesPath))) {
        throw new PathError(`Source profiles folder does not exist: ${sourceProfilesPath}`);
      }

      log('Mirroring profile files into sync repository cache...');
      await mirrorDirectory(sourceProfilesPath, repoProfilesPath);
    }

    await this.writeMetadata(prepared.repoPath, config);

    await prepared.git.add(['-A']);
    const status = await prepared.git.status();

    if (status.files.length === 0) {
      return 'No addon changes to push.';
    }

    const machineLabel = config.machineLabel.trim() || 'source';
    const commitMessage = `sync(${machineLabel}) ${new Date().toISOString()}`;

    await prepared.git.commit(commitMessage);

    if (prepared.remoteHasBranch) {
      await prepared.git.push('origin', config.branch);
    } else {
      await prepared.git.push(['-u', 'origin', config.branch]);
    }

    return `Pushed ${status.files.length} changed file(s) to ${config.branch}.`;
  }

  private async runClientSync(
    prepared: PreparedRepo,
    config: AppConfig,
    log: LogFn,
  ): Promise<string> {
    const targetAddonsPath = config.targetAddonsPath.trim();
    const targetProfilesPath = config.targetProfilesPath.trim();

    if (!prepared.remoteHasBranch) {
      throw new PathError(
        `Remote branch ${config.branch} does not exist yet. Run source sync first to create it.`,
      );
    }

    log('Fetching latest sync commits...');
    await prepared.git.fetch('origin', config.branch);
    await prepared.git.checkout(config.branch);
    await prepared.git.pull('origin', config.branch, { '--ff-only': null });

    const latestCommit = await verifyCommitTrust(prepared.git, config);

    const repoAddonsPath = path.join(prepared.repoPath, ADDONS_SUBDIR);
    if (!(await fs.pathExists(repoAddonsPath))) {
      throw new PathError('Sync repository has no addons payload yet.');
    }

    const snapshotName = await this.backupManager.createClientBackup(config, latestCommit);
    if (snapshotName) {
      log(`Created rollback snapshot ${snapshotName}.`);
    } else {
      log('No existing local files to snapshot before apply.');
    }

    log('Applying synced addons to local client folder...');
    await mirrorDirectory(repoAddonsPath, targetAddonsPath);

    if (config.syncProfiles) {
      const repoProfilesPath = path.join(prepared.repoPath, PROFILES_SUBDIR);

      if (!(await fs.pathExists(repoProfilesPath))) {
        throw new PathError(
          'Sync repository has no profiles payload yet. Run source sync with profiles enabled first.',
        );
      }

      log('Applying synced profile files to local client folder...');
      await mirrorDirectory(repoProfilesPath, targetProfilesPath);
    }

    return config.syncProfiles
      ? `Updated addons and profiles from commit ${latestCommit.hash.slice(0, 8)} by ${latestCommit.email}.`
      : `Updated addons from commit ${latestCommit.hash.slice(0, 8)} by ${latestCommit.email}.`;
  }

  private checkRepositoryReachability(
    repoUrl: string,
    token: string,
    gitBinary: string,
  ): ReachabilityCheckResult {
    const authRepoUrl = this.buildAuthRepoUrl(repoUrl, token);

    try {
      const result = spawnSync(gitBinary, ['ls-remote', authRepoUrl, 'HEAD'], {
        windowsHide: true,
        timeout: GIT_REACHABILITY_TIMEOUT_MS,
      });

      if (result.status === 0) {
        return { ok: true };
      }

      const stderr = redactSecret(String(result.stderr ?? ''), token);
      const stdout = redactSecret(String(result.stdout ?? ''), token);
      const reason = firstLine(stderr) || firstLine(stdout) || 'Repository check failed.';
      return { ok: false, reason };
    } catch (error) {
      return {
        ok: false,
        reason: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private async writeMetadata(repoPath: string, config: AppConfig): Promise<void> {
    const metadataPath = path.join(repoPath, META_FILE_NAME);

    const metadata = {
      machineLabel: config.machineLabel,
      mode: config.mode,
      syncProfiles: config.syncProfiles,
      profileSyncPreset: config.profileSyncPreset,
      updatedAt: new Date().toISOString(),
      branch: config.branch,
    };

    await fs.writeJson(metadataPath, metadata, { spaces: 2 });
  }

}
