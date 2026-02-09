import path from 'node:path';
import { spawnSync } from 'node:child_process';
import fs from 'fs-extra';
import { app } from 'electron';
import simpleGit, { type SimpleGit } from 'simple-git';
import type { AppConfig } from '../shared/types';

const ADDONS_SUBDIR = 'addons';
const PROFILES_SUBDIR = 'profiles';
const META_FILE_NAME = '.wow-sync-meta.json';
const WINDOWS_GIT_CANDIDATES = [
  'C:\\Program Files\\Git\\cmd\\git.exe',
  'C:\\Program Files\\Git\\bin\\git.exe',
  'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
  'C:\\Program Files (x86)\\Git\\bin\\git.exe',
];

type LogFn = (line: string) => void;

interface PreparedRepo {
  git: SimpleGit;
  repoPath: string;
  remoteHasBranch: boolean;
}

interface LatestCommitInfo {
  hash: string;
  email: string;
}

export class GitSyncEngine {
  async run(config: AppConfig, log: LogFn): Promise<string> {
    this.validateConfig(config);
    const gitBinary = await this.resolveGitBinary(config, log);

    const prepared = await this.prepareRepo(config, log, gitBinary);

    if (config.mode === 'source') {
      return this.runSourceSync(prepared, config, log);
    }

    return this.runClientSync(prepared, config, log);
  }

  private validateConfig(config: AppConfig): void {
    if (!config.repoUrl.trim()) {
      throw new Error('Repository URL is required.');
    }

    if (!config.branch.trim()) {
      throw new Error('Branch is required.');
    }

    if (config.mode === 'source' && !config.sourceAddonsPath.trim()) {
      throw new Error('Source addons folder is required in source mode.');
    }

    if (config.mode === 'source' && config.syncProfiles && !config.sourceProfilesPath.trim()) {
      throw new Error('Source profiles folder is required when profile sync is enabled.');
    }

    if (config.mode === 'client' && !config.targetAddonsPath.trim()) {
      throw new Error('Client addons folder is required in client mode.');
    }

    if (config.mode === 'client' && config.syncProfiles && !config.targetProfilesPath.trim()) {
      throw new Error('Client profiles folder is required when profile sync is enabled.');
    }

    if (
      config.mode === 'client' &&
      !config.requireSignedCommits &&
      config.trustedAuthorEmails.length === 0
    ) {
      throw new Error(
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

  private normalizeConfiguredGitPath(inputPath: string): string {
    const trimmed = inputPath.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1).trim();
    }

    return trimmed;
  }

  private isGitBinaryAvailable(binaryPath: string): boolean {
    try {
      const result = spawnSync(binaryPath, ['--version'], {
        windowsHide: true,
        timeout: 3000,
      });

      return result.status === 0;
    } catch {
      return false;
    }
  }

  private async resolveGitBinary(config: AppConfig, log: LogFn): Promise<string> {
    const configured = this.normalizeConfiguredGitPath(config.gitBinaryPath);
    if (configured) {
      if (await fs.pathExists(configured) && this.isGitBinaryAvailable(configured)) {
        return configured;
      }

      throw new Error(
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

    throw new Error(
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
      throw new Error(`Source addons folder does not exist: ${sourceAddonsPath}`);
    }

    const repoAddonsPath = path.join(prepared.repoPath, ADDONS_SUBDIR);
    const sourceProfilesPath = config.sourceProfilesPath.trim();
    const repoProfilesPath = path.join(prepared.repoPath, PROFILES_SUBDIR);

    log('Mirroring addon files into sync repository cache...');
    await this.mirrorDirectory(sourceAddonsPath, repoAddonsPath);

    if (config.syncProfiles) {
      if (!(await fs.pathExists(sourceProfilesPath))) {
        throw new Error(`Source profiles folder does not exist: ${sourceProfilesPath}`);
      }

      log('Mirroring profile files into sync repository cache...');
      await this.mirrorDirectory(sourceProfilesPath, repoProfilesPath);
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
      throw new Error(
        `Remote branch ${config.branch} does not exist yet. Run source sync first to create it.`,
      );
    }

    log('Fetching latest sync commits...');
    await prepared.git.fetch('origin', config.branch);
    await prepared.git.checkout(config.branch);
    await prepared.git.pull('origin', config.branch, { '--ff-only': null });

    const latestCommit = await this.verifyCommitTrust(prepared.git, config);

    const repoAddonsPath = path.join(prepared.repoPath, ADDONS_SUBDIR);
    if (!(await fs.pathExists(repoAddonsPath))) {
      throw new Error('Sync repository has no addons payload yet.');
    }

    log('Applying synced addons to local client folder...');
    await this.mirrorDirectory(repoAddonsPath, targetAddonsPath);

    if (config.syncProfiles) {
      const repoProfilesPath = path.join(prepared.repoPath, PROFILES_SUBDIR);

      if (!(await fs.pathExists(repoProfilesPath))) {
        throw new Error(
          'Sync repository has no profiles payload yet. Run source sync with profiles enabled first.',
        );
      }

      log('Applying synced profile files to local client folder...');
      await this.mirrorDirectory(repoProfilesPath, targetProfilesPath);
    }

    return config.syncProfiles
      ? `Updated addons and profiles from commit ${latestCommit.hash.slice(0, 8)} by ${latestCommit.email}.`
      : `Updated addons from commit ${latestCommit.hash.slice(0, 8)} by ${latestCommit.email}.`;
  }

  private async mirrorDirectory(sourcePath: string, targetPath: string): Promise<void> {
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

  private async writeMetadata(repoPath: string, config: AppConfig): Promise<void> {
    const metadataPath = path.join(repoPath, META_FILE_NAME);

    const metadata = {
      machineLabel: config.machineLabel,
      mode: config.mode,
      syncProfiles: config.syncProfiles,
      updatedAt: new Date().toISOString(),
      branch: config.branch,
    };

    await fs.writeJson(metadataPath, metadata, { spaces: 2 });
  }

  private async verifyCommitTrust(git: SimpleGit, config: AppConfig): Promise<LatestCommitInfo> {
    const logOutput = await git.raw(['log', '--pretty=format:%H|%ae|%G?']);
    const rows = logOutput
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (rows.length === 0) {
      throw new Error('No commits found in sync branch.');
    }

    const allowlist = config.trustedAuthorEmails
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);

    for (const row of rows) {
      const [hash, emailRaw, signatureStatusRaw] = row.split('|');
      const email = (emailRaw ?? '').trim().toLowerCase();
      const signatureStatus = (signatureStatusRaw ?? '').trim();

      if (allowlist.length > 0 && !allowlist.includes(email)) {
        throw new Error(
          `Commit ${hash.slice(0, 8)} is authored by ${email}, which is not in trusted author list.`,
        );
      }

      if (config.requireSignedCommits && !['G', 'U'].includes(signatureStatus)) {
        throw new Error(
          `Commit ${hash.slice(0, 8)} has signature state '${signatureStatus || '?'}'.`,
        );
      }
    }

    const [latestHash, latestEmailRaw] = rows[0].split('|');
    return {
      hash: latestHash,
      email: (latestEmailRaw ?? '').trim(),
    };
  }
}
