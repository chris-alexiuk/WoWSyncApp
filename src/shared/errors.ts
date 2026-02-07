/** Base error for all AzerSync operations. */
export class SyncError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

/** Raised when the application configuration is invalid or incomplete. */
export class ConfigError extends SyncError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR');
    this.name = 'ConfigError';
  }
}

/** Raised when a git operation fails. */
export class GitError extends SyncError {
  constructor(message: string) {
    super(message, 'GIT_ERROR');
    this.name = 'GitError';
  }
}

/** Raised when commit trust verification fails. */
export class TrustError extends SyncError {
  constructor(message: string) {
    super(message, 'TRUST_ERROR');
    this.name = 'TrustError';
  }
}

/** Raised when a required path is missing or invalid. */
export class PathError extends SyncError {
  constructor(message: string) {
    super(message, 'PATH_ERROR');
    this.name = 'PathError';
  }
}
