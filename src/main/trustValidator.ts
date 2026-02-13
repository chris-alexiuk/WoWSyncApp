import type { SimpleGit } from 'simple-git';
import type { AppConfig } from '../shared/types';
import { TrustError } from '../shared/errors';

export interface LatestCommitInfo {
  hash: string;
  email: string;
}

/** Verify that all commits in the sync branch are from trusted authors. */
export async function verifyCommitTrust(git: SimpleGit, config: AppConfig): Promise<LatestCommitInfo> {
  const logOutput = await git.raw(['log', '--pretty=format:%H|%ae|%G?']);
  const rows = logOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    throw new TrustError('No commits found in sync branch.');
  }

  const allowlist = config.trustedAuthorEmails
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  for (const row of rows) {
    const [hash, emailRaw, signatureStatusRaw] = row.split('|');
    const email = (emailRaw ?? '').trim().toLowerCase();
    const signatureStatus = (signatureStatusRaw ?? '').trim();

    if (allowlist.length > 0 && !allowlist.includes(email)) {
      throw new TrustError(
        `Commit ${hash.slice(0, 8)} is authored by ${email}, which is not in trusted author list.`,
      );
    }

    if (config.requireSignedCommits && !['G', 'U'].includes(signatureStatus)) {
      throw new TrustError(
        `Commit ${hash.slice(0, 8)} has signature state '${signatureStatus || '?'}'.`,
      );
    }
  }

  const [latestHash, latestEmailRaw] = rows[0].split('|');
  return {
    hash: latestHash,
    email: (latestEmailRaw ?? '').trim(),
  };
}
