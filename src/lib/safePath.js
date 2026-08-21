import path from 'node:path';
import { JOURNAL_DIRNAME } from './paths.js';

/** Refuses an AI-proposed path that escapes the project root or targets JOURNAL/'s own
 * bookkeeping directory — shared by any command that lets AI write real files (draft code,
 * draft test, apply-fix). */
export function assertSafeRelPath(p) {
  const normalized = path.normalize(p).replace(/^[/\\]+/, '');
  const segments = normalized.split(path.sep);
  if (path.isAbsolute(p) || segments.includes('..')) {
    throw new Error(`AI proposed an unsafe path "${p}" — refusing to write outside the project.`);
  }
  if (segments[0] === JOURNAL_DIRNAME) {
    throw new Error(`AI proposed writing into "${p}", inside ${JOURNAL_DIRNAME}/ — that's this tool's own bookkeeping, not runnable project code. Refusing to write it.`);
  }
  return normalized;
}
