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
