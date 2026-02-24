import { useEffect, useState } from 'react';
import type { SyncState } from '../../shared/types';

const EMPTY_STATE: SyncState = {
  running: false,
  inFlight: false,
  lastRunAt: null,
  lastSuccessAt: null,
  lastError: null,
  logs: [],
};

export function useSyncState(): SyncState {
  const [state, setState] = useState<SyncState>(EMPTY_STATE);

  useEffect(() => {
    let mounted = true;

    void (async () => {
      const initial = await window.wowSync.getState();
      if (mounted) setState(initial);
    })();

    const unsubscribe = window.wowSync.onState((next) => {
      if (mounted) setState(next);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return state;
}
