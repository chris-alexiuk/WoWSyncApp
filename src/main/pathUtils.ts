/**
 * Pure utility functions for path handling and string sanitization
 * used throughout the sync engine.
 */

/**
 * Strip surrounding quotes from a user-configured git binary path.
 * Handles both single and double quotes that users may paste from
 * file-manager "Copy as path" features.
 */
export function normalizeConfiguredGitPath(inputPath: string): string {
  const trimmed = inputPath.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
}

/**
 * Replace characters that are unsafe in directory names with underscores.
 * Keeps alphanumerics, dots, hyphens, and underscores.
 */
export function safePathSegment(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Return `true` when the given path looks like a WoW
 * `SavedVariables` directory (case-insensitive, either separator).
 */
export function isLikelySavedVariablesPath(inputPath: string): boolean {
  const normalized = inputPath.replace(/\\/g, '/').toLowerCase();
  return normalized.split('/').includes('savedvariables');
}

/**
 * Extract the first non-empty line from a multi-line string.
 * Returns an empty string when every line is blank.
 */
export function firstLine(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? '';
}

/**
 * Replace every occurrence of `secret` inside `value` with `[redacted]`.
 * Returns the original string unchanged when the secret is blank.
 */
export function redactSecret(value: string, secret: string): string {
  if (!secret.trim()) {
    return value;
  }

  return value.split(secret.trim()).join('[redacted]');
}
