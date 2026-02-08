import { app } from 'electron';
import type { UpdateCheckResult } from '../shared/types';

const LATEST_RELEASE_API = 'https://api.github.com/repos/chris-alexiuk/WoWSyncApp/releases/latest';

interface LatestReleaseResponse {
  tag_name?: string;
  html_url?: string;
  published_at?: string;
  body?: string;
}

function normalizeVersion(version: string): string {
  return version.trim().replace(/^v/i, '');
}

function compareVersions(a: string, b: string): number {
  const aParts = normalizeVersion(a)
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);
  const bParts = normalizeVersion(b)
    .split('.')
    .map((part) => Number.parseInt(part, 10) || 0);

  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i += 1) {
    const av = aParts[i] ?? 0;
    const bv = bParts[i] ?? 0;

    if (av > bv) {
      return 1;
    }

    if (av < bv) {
      return -1;
    }
  }

  return 0;
}

function summarizeNotes(body?: string): string | null {
  if (!body) {
    return null;
  }

  const trimmed = body.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > 700 ? `${trimmed.slice(0, 700)}...` : trimmed;
}

export async function checkForAppUpdate(): Promise<UpdateCheckResult> {
  const currentVersion = normalizeVersion(app.getVersion());

  try {
    const response = await fetch(LATEST_RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'wow-sync-app',
      },
    });

    if (!response.ok) {
      return {
        currentVersion,
        latestVersion: null,
        hasUpdate: false,
        releaseUrl: null,
        publishedAt: null,
        notes: null,
        message: `Update check failed (HTTP ${response.status}).`,
      };
    }

    const release = (await response.json()) as LatestReleaseResponse;
    const latestVersion = normalizeVersion(release.tag_name ?? '');

    if (!latestVersion) {
      return {
        currentVersion,
        latestVersion: null,
        hasUpdate: false,
        releaseUrl: release.html_url ?? null,
        publishedAt: release.published_at ?? null,
        notes: summarizeNotes(release.body),
        message: 'No valid release version found from GitHub.',
      };
    }

    const hasUpdate = compareVersions(latestVersion, currentVersion) > 0;

    return {
      currentVersion,
      latestVersion,
      hasUpdate,
      releaseUrl: release.html_url ?? null,
      publishedAt: release.published_at ?? null,
      notes: summarizeNotes(release.body),
      message: hasUpdate
        ? `Update available: v${latestVersion}`
        : `You are up to date (v${currentVersion}).`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      currentVersion,
      latestVersion: null,
      hasUpdate: false,
      releaseUrl: null,
      publishedAt: null,
      notes: null,
      message: `Update check failed: ${message}`,
    };
  }
}
