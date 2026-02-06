import { app } from 'electron';
import { autoUpdater, type ProgressInfo, type UpdateInfo } from 'electron-updater';
import type { AppUpdateState } from '../shared/types';
import { MAX_RELEASE_NOTES_LENGTH } from '../shared/constants';

const LATEST_RELEASE_URL = 'https://github.com/chris-alexiuk/WoWSyncApp/releases/latest';

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '');
}

function summarizeNotes(notes?: string): string | null {
  if (!notes) {
    return null;
  }

  const trimmed = notes.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > MAX_RELEASE_NOTES_LENGTH ? `${trimmed.slice(0, MAX_RELEASE_NOTES_LENGTH)}...` : trimmed;
}

function normalizeReleaseNotes(releaseNotes: UpdateInfo['releaseNotes']): string | null {
  if (!releaseNotes) {
    return null;
  }

  if (typeof releaseNotes === 'string') {
    return summarizeNotes(releaseNotes);
  }

  const merged = releaseNotes
    .map((entry) => entry.note?.trim() ?? '')
    .filter(Boolean)
    .join('\n\n');

  return summarizeNotes(merged);
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function createInitialState(message: string): AppUpdateState {
  const currentVersion = normalizeVersion(app.getVersion());

  return {
    phase: 'idle',
    currentVersion,
    latestVersion: null,
    hasUpdate: false,
    releaseUrl: LATEST_RELEASE_URL,
    publishedAt: null,
    notes: null,
    message,
    checkedAt: null,
    downloadPercent: null,
    bytesPerSecond: null,
    transferredBytes: null,
    totalBytes: null,
    canCheck: true,
    canDownload: false,
    canInstall: false,
  };
}

export class UpdateService {
  private state: AppUpdateState;

  constructor(private readonly onStateChange: (state: AppUpdateState) => void) {
    this.state = this.createSupportedState();

    autoUpdater.autoDownload = false;
    // Keep apply explicit so we can force silent installer args on Windows.
    autoUpdater.autoInstallOnAppQuit = false;

    autoUpdater.on('checking-for-update', () => {
      this.setState({
        phase: 'checking',
        message: `Checking for updates (v${this.state.currentVersion})...`,
        checkedAt: null,
        canCheck: false,
      });
    });

    autoUpdater.on('update-available', (info) => {
      this.applyUpdateInfo(info);
      this.setState({
        phase: 'available',
        hasUpdate: true,
        message: `Update available: v${this.state.latestVersion ?? 'unknown'}.`,
        canCheck: true,
        canDownload: true,
        canInstall: false,
      });
    });

    autoUpdater.on('update-not-available', (info) => {
      this.applyUpdateInfo(info);
      this.setState({
        phase: 'not-available',
        hasUpdate: false,
        message: `You are up to date (v${this.state.currentVersion}).`,
        checkedAt: new Date().toISOString(),
        downloadPercent: null,
        bytesPerSecond: null,
        transferredBytes: null,
        totalBytes: null,
        canCheck: true,
        canDownload: false,
        canInstall: false,
      });
    });

    autoUpdater.on('download-progress', (progress: ProgressInfo) => {
      this.setState({
        phase: 'downloading',
        message: `Downloading update: ${progress.percent.toFixed(1)}%`,
        downloadPercent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        transferredBytes: progress.transferred,
        totalBytes: progress.total,
        canCheck: false,
        canDownload: false,
        canInstall: false,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.applyUpdateInfo(info);
      this.setState({
        phase: 'downloaded',
        hasUpdate: true,
        checkedAt: new Date().toISOString(),
        downloadPercent: 100,
        message: `Update ready: v${this.state.latestVersion ?? 'unknown'}. Restart to apply.`,
        canCheck: true,
        canDownload: false,
        canInstall: true,
      });
    });

    autoUpdater.on('error', (error: Error) => {
      this.setState({
        phase: 'error',
        message: `Update error: ${error.message}`,
        checkedAt: new Date().toISOString(),
        canCheck: true,
        canDownload: this.state.hasUpdate && !this.state.canInstall,
        canInstall: this.state.canInstall,
      });
    });
  }

  getState(): AppUpdateState {
    return this.state;
  }

  async checkForUpdates(): Promise<AppUpdateState> {
    if (this.state.phase === 'unsupported') {
      return this.state;
    }

    try {
      await autoUpdater.checkForUpdates();
      return this.state;
    } catch (error) {
      this.setState({
        phase: 'error',
        message: `Update check failed: ${toErrorMessage(error)}`,
        checkedAt: new Date().toISOString(),
        canCheck: true,
      });
      return this.state;
    }
  }

  async downloadUpdate(): Promise<AppUpdateState> {
    if (this.state.phase === 'unsupported') {
      return this.state;
    }

    if (!this.state.hasUpdate) {
      this.setState({
        message: 'No update is available to download.',
      });
      return this.state;
    }

    if (this.state.canInstall) {
      return this.state;
    }

    try {
      await autoUpdater.downloadUpdate();
      return this.state;
    } catch (error) {
      this.setState({
        phase: 'error',
        message: `Download failed: ${toErrorMessage(error)}`,
        checkedAt: new Date().toISOString(),
        canCheck: true,
        canDownload: true,
      });
      return this.state;
    }
  }

  installUpdateAndRestart(): { ok: boolean; message: string } {
    if (this.state.phase === 'unsupported') {
      return { ok: false, message: this.state.message };
    }

    if (!this.state.canInstall) {
      return { ok: false, message: 'No downloaded update is ready to install.' };
    }

    setImmediate(() => {
      // Use silent mode for NSIS so users do not get installer wizard prompts.
      autoUpdater.quitAndInstall(true, true);
    });

    return { ok: true, message: 'Applying update silently and restarting app...' };
  }

  private createSupportedState(): AppUpdateState {
    if (!app.isPackaged) {
      return {
        ...createInitialState('Auto-update works in packaged builds. Development mode is unsupported.'),
        phase: 'unsupported',
        canCheck: false,
      };
    }

    if (process.platform === 'win32' && process.env.PORTABLE_EXECUTABLE_FILE) {
      return {
        ...createInitialState(
          'Portable build detected. Install the NSIS installer build once to enable in-place auto-updates.',
        ),
        phase: 'unsupported',
        canCheck: false,
      };
    }

    return createInitialState('Ready to check for updates.');
  }

  private applyUpdateInfo(info: UpdateInfo): void {
    this.setState({
      latestVersion: normalizeVersion(info.version),
      publishedAt: info.releaseDate ?? null,
      notes: normalizeReleaseNotes(info.releaseNotes),
      releaseUrl: LATEST_RELEASE_URL,
    });
  }

  private setState(patch: Partial<AppUpdateState>): void {
    this.state = {
      ...this.state,
      ...patch,
    };
    this.onStateChange(this.state);
  }
}
