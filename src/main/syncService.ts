import path from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import type { AppConfig, PreflightResult, SyncRunResult, SyncState } from '../shared/types';
import {
  MAX_LOG_LINES,
  MIN_SYNC_INTERVAL_SECONDS,
  WATCHER_DEBOUNCE_MS,
  WATCHER_STABILITY_THRESHOLD_MS,
  WATCHER_POLL_INTERVAL_MS,
} from '../shared/constants';
import { GitSyncEngine } from './gitSyncEngine';

type Listener = (state: SyncState) => void;

function nowISO(): string {
  return new Date().toISOString();
}

function formatLogTimestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

export class SyncService {
  private timer: NodeJS.Timeout | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private watcher: FSWatcher | null = null;
  private listener: Listener;
  private engine = new GitSyncEngine();
  private activeConfig: AppConfig | null = null;
  private inFlight = false;

  private state: SyncState = {
    running: false,
    inFlight: false,
    lastRunAt: null,
    lastSuccessAt: null,
    lastError: null,
    logs: [],
  };

  constructor(listener: Listener) {
    this.listener = listener;
  }

  getState(): SyncState {
    return this.state;
  }

  async start(config: AppConfig): Promise<void> {
    this.activeConfig = config;

    this.clearTimer();
    await this.clearWatcher();
    this.clearDebounce();

    this.state.running = true;
    this.pushLog(`Auto-sync enabled (${Math.max(config.syncIntervalSeconds, MIN_SYNC_INTERVAL_SECONDS)}s interval).`);
    this.emit();

    void this.runNow(config);

    this.timer = setInterval(() => {
      if (this.activeConfig) {
        void this.runNow(this.activeConfig);
      }
    }, Math.max(config.syncIntervalSeconds, MIN_SYNC_INTERVAL_SECONDS) * 1000);

    this.startSourceWatcher(config);
  }

  async stop(): Promise<void> {
    this.clearTimer();
    await this.clearWatcher();
    this.clearDebounce();

    this.activeConfig = null;
    this.state.running = false;
    this.pushLog('Auto-sync stopped.');
    this.emit();
  }

  async runNow(config: AppConfig): Promise<SyncRunResult> {
    if (this.inFlight) {
      this.pushLog('Sync skipped because another sync run is still active.');
      this.emit();
      return { ok: false, message: 'Sync already in progress.' };
    }

    this.inFlight = true;
    this.state.inFlight = true;
    this.state.lastRunAt = nowISO();
    this.state.lastError = null;
    this.pushLog(`Sync run started (${config.mode}).`);
    this.emit();

    try {
      const message = await this.engine.run(config, (line) => {
        this.pushLog(line);
        this.emit();
      });

      this.state.lastSuccessAt = nowISO();
      this.pushLog(message);
      this.emit();

      return { ok: true, message };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state.lastError = message;
      this.pushLog(`Sync failed: ${message}`);
      this.emit();
      return { ok: false, message };
    } finally {
      this.inFlight = false;
      this.state.inFlight = false;
      this.emit();
    }
  }

  async restoreLatestBackup(config: AppConfig): Promise<SyncRunResult> {
    if (this.inFlight) {
      this.pushLog('Rollback skipped because another sync run is still active.');
      this.emit();
      return { ok: false, message: 'Another sync operation is in progress.' };
    }

    this.inFlight = true;
    this.state.inFlight = true;
    this.state.lastRunAt = nowISO();
    this.state.lastError = null;
    this.pushLog('Rollback run started.');
    this.emit();

    try {
      const message = await this.engine.restoreLatestClientBackup(config, (line) => {
        this.pushLog(line);
        this.emit();
      });

      this.state.lastSuccessAt = nowISO();
      this.pushLog(message);
      this.emit();

      return { ok: true, message };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state.lastError = message;
      this.pushLog(`Rollback failed: ${message}`);
      this.emit();
      return { ok: false, message };
    } finally {
      this.inFlight = false;
      this.state.inFlight = false;
      this.emit();
    }
  }

  async runPreflight(config: AppConfig): Promise<PreflightResult> {
    return this.engine.runPreflight(config);
  }

  private startSourceWatcher(config: AppConfig): void {
    if (config.mode !== 'source' || !config.sourceAddonsPath.trim()) {
      return;
    }

    const watchPaths = [config.sourceAddonsPath.trim()];
    if (config.syncProfiles && config.sourceProfilesPath.trim()) {
      watchPaths.push(config.sourceProfilesPath.trim());
    }

    this.watcher = chokidar.watch(watchPaths, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: WATCHER_STABILITY_THRESHOLD_MS,
        pollInterval: WATCHER_POLL_INTERVAL_MS,
      },
    });

    this.watcher.on('all', (_event, changedPath) => {
      if (!this.state.running) {
        return;
      }

      const fileName = path.basename(changedPath);
      if (fileName.startsWith('.')) {
        return;
      }

      this.pushLog(`Change detected: ${fileName}`);
      this.emit();

      this.clearDebounce();
      this.debounceTimer = setTimeout(() => {
        if (this.activeConfig) {
          void this.runNow(this.activeConfig);
        }
      }, WATCHER_DEBOUNCE_MS);
    });

    this.watcher.on('error', (error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.pushLog(`Watcher error: ${message}`);
      this.emit();
    });

    this.pushLog(
      config.syncProfiles ? 'Source watcher active (addons + profiles).' : 'Source watcher active (addons).',
    );
    this.emit();
  }

  private clearTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async clearWatcher(): Promise<void> {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }
  }

  private clearDebounce(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
  }

  private pushLog(line: string): void {
    this.state.logs = [`[${formatLogTimestamp()}] ${line}`, ...this.state.logs].slice(0, MAX_LOG_LINES);
  }

  private emit(): void {
    this.listener({ ...this.state, logs: [...this.state.logs] });
  }
}
