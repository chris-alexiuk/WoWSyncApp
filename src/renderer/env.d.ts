/// <reference types="vite/client" />

import type { WoWSyncApi } from '../preload/preload';

declare global {
  interface Window {
    wowSync: WoWSyncApi;
  }
}

export {};
