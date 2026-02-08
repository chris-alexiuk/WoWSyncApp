/// <reference types="vite/client" />

import type { WoWSyncApi } from '../shared/api';

declare global {
  interface Window {
    wowSync: WoWSyncApi;
  }
}

export {};
