/** Maximum number of client backup snapshots to retain per branch. */
export const MAX_CLIENT_BACKUPS = 3;

/** Maximum number of log lines kept in the runtime log buffer. */
export const MAX_LOG_LINES = 140;

/** Minimum allowed sync interval in seconds. */
export const MIN_SYNC_INTERVAL_SECONDS = 10;

/** Delay (ms) after a file-system change before triggering a sync run. */
export const WATCHER_DEBOUNCE_MS = 1800;

/** Chokidar stability threshold (ms) for awaitWriteFinish. */
export const WATCHER_STABILITY_THRESHOLD_MS = 900;

/** Chokidar poll interval (ms) for awaitWriteFinish. */
export const WATCHER_POLL_INTERVAL_MS = 120;

/** Timeout (ms) for spawning git binary availability checks. */
export const GIT_SPAWN_TIMEOUT_MS = 3000;

/** Timeout (ms) for git ls-remote reachability checks. */
export const GIT_REACHABILITY_TIMEOUT_MS = 7000;

/** Maximum length for release notes before truncation. */
export const MAX_RELEASE_NOTES_LENGTH = 1000;

/** Subdirectory name for addons inside the sync repository. */
export const ADDONS_SUBDIR = 'addons';

/** Subdirectory name for profiles inside the sync repository. */
export const PROFILES_SUBDIR = 'profiles';

/** Subdirectory name for client backup snapshots. */
export const CLIENT_BACKUPS_SUBDIR = 'client-backups';

/** File name for backup metadata. */
export const CLIENT_BACKUP_META_FILE = 'backup-meta.json';

/** File name for sync repository metadata. */
export const META_FILE_NAME = '.wow-sync-meta.json';

/** Common Windows git binary paths to probe when git is not on PATH. */
export const WINDOWS_GIT_CANDIDATES = [
  'C:\\Program Files\\Git\\cmd\\git.exe',
  'C:\\Program Files\\Git\\bin\\git.exe',
  'C:\\Program Files (x86)\\Git\\cmd\\git.exe',
  'C:\\Program Files (x86)\\Git\\bin\\git.exe',
];
