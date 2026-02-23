export function formatDate(iso: string | null): string {
  if (!iso) {
    return 'Never';
  }

  return new Date(iso).toLocaleString();
}

export function formatMegabytes(bytes: number | null): string {
  if (!bytes || Number.isNaN(bytes)) {
    return '0 MB';
  }

  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

export function asErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function modeLabel(modeValue: import('../shared/types').SyncMode): string {
  return modeValue === 'source' ? 'Source (Push)' : 'Client (Pull)';
}

export function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, '/');
}

export function inferPathSeparator(value: string): string {
  return value.includes('\\') ? '\\' : '/';
}

export function deriveWoWRootFromAddonsPath(addonsPath: string): string {
  const trimmed = addonsPath.trim();
  if (!trimmed) {
    return '';
  }

  const normalized = normalizeSlashes(trimmed).replace(/\/+$/, '');
  const marker = '/interface/addons';
  const lower = normalized.toLowerCase();

  if (lower.endsWith(marker)) {
    return normalized.slice(0, normalized.length - marker.length);
  }

  return '';
}

export function emailsToText(emails: string[]): string {
  return emails.join(', ');
}

export function textToEmails(text: string): string[] {
  return text
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function suggestProfilesPath(addonsPath: string, preset: import('../shared/types').ProfileSyncPreset): string {
  const wowRoot = deriveWoWRootFromAddonsPath(addonsPath);
  if (!wowRoot || preset === 'addons_only') {
    return '';
  }

  const separator = inferPathSeparator(addonsPath);

  if (preset === 'full_wtf') {
    return `${wowRoot}${separator}WTF`;
  }

  return `${wowRoot}${separator}WTF${separator}SavedVariables`;
}
