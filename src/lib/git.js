import { execFileSync } from 'node:child_process';
import { findProjectRoot } from './paths.js';

function git(args, opts = {}) {
  return execFileSync('git', args, {
    cwd: findProjectRoot(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...opts,
  });
}

export function currentSha() {
  return git(['rev-parse', 'HEAD']).trim();
}

export function hasHead() {
  try {
    git(['rev-parse', '--verify', 'HEAD']);
    return true;
  } catch {
    return false;
  }
}

export function show(sha, relPath) {
  return git(['show', `${sha}:${relPath}`]);
}

/**
 * Stage the given paths (relative to project root) and commit them.
 * Throws loudly on failure rather than leaving a partial commit.
 * Returns the new commit SHA.
 */
export function stageAndCommit(relPaths, message) {
  if (relPaths.length === 0) {
    throw new Error('stageAndCommit called with no paths to stage.');
  }
  try {
    git(['add', '--', ...relPaths]);
  } catch (err) {
    throw new Error(`git add failed for [${relPaths.join(', ')}]: ${err.message}`);
  }
  try {
    git(['commit', '-m', message]);
  } catch (err) {
    // Unstage what we just staged so we don't leave a half-staged mess.
    try {
      git(['reset', '--', ...relPaths]);
    } catch {
      /* best-effort */
    }
    throw new Error(
      `git commit failed for [${relPaths.join(', ')}]: ${err.message}\n` +
        `Staged changes were rolled back (unstaged) — nothing was committed.`
    );
  }
  return currentSha();
}

/** True if `relPath` is tracked by git (staging its deletion would otherwise error). */
export function isTracked(relPath) {
  try {
    git(['ls-files', '--error-unmatch', '--', relPath]);
    return true;
  } catch {
    return false;
  }
}

export function isClean() {
  const out = git(['status', '--porcelain']);
  return out.trim().length === 0;
}
