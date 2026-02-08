import type { AppConfig, SyncRunResult, SyncState } from '../shared/types';

type Listener = (state: SyncState) => void;

function nowISO(): string {
  return new Date().toISOString();
}

export class SyncService {
  private timer: NodeJS.Timeout | null = null;
  private listener: Listener;
  private state: SyncState = {
    running: false,
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

  start(config: AppConfig): void {
    if (this.timer) {
      clearInterval(this.timer);
    }

    this.state.running = true;
    this.pushLog(`Auto-sync enabled (${config.syncIntervalSeconds}s interval)`);

    void this.runNow(config);

    this.timer = setInterval(() => {
      void this.runNow(config);
    }, Math.max(config.syncIntervalSeconds, 10) * 1000);

    this.emit();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    this.state.running = false;
    this.pushLog('Auto-sync stopped');
    this.emit();
  }

  async runNow(config: AppConfig): Promise<SyncRunResult> {
    this.state.lastRunAt = nowISO();
    this.state.lastError = null;
    this.pushLog(`Sync run started (${config.mode})`);
    this.emit();

    try {
      // v0 scaffold placeholder. Real git sync engine is added next.
      await new Promise((resolve) => setTimeout(resolve, 300));
      this.state.lastSuccessAt = nowISO();
      this.pushLog('Sync completed (scaffold mode)');
      this.emit();
      return { ok: true, message: 'Sync completed (scaffold mode)' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.state.lastError = message;
      this.pushLog(`Sync failed: ${message}`);
      this.emit();
      return { ok: false, message };
    }
  }

  private pushLog(line: string): void {
    this.state.logs = [`[${new Date().toLocaleTimeString()}] ${line}`, ...this.state.logs].slice(0, 120);
  }

  private emit(): void {
    this.listener(this.state);
  }
}
