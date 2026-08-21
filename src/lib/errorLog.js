import fs from 'node:fs';
import path from 'node:path';
import { errorsFile } from './paths.js';
import { nextErrorId } from './index-store.js';

/** Mutates `entry.errors` with a new open entry and returns it — shared by `log-error` and
 * `commit test`'s automatic logging on a failing run (§4.6). Caller still owns saveFeature(). */
export function openErrorEntry(entry, { errorOutput, description } = {}) {
  const parts = [];
  if (errorOutput && errorOutput.trim()) parts.push(`Error output:\n${errorOutput.trim()}`);
  if (description && description.trim()) parts.push(`Description:\n${description.trim()}`);
  const text = parts.join('\n\n');

  const id = nextErrorId(entry);
  const loggedDate = new Date().toISOString();
  entry.errors = entry.errors || [];
  const record = {
    id,
    status: 'open',
    loggedDate,
    description: text || '',
    fixNote: null,
    resolvedDate: null,
    attribution: null,
    identity: null,
    fixPlanAttribution: null,
    fixPlanIdentity: null,
  };
  entry.errors.push(record);
  return record;
}

/** Appends the entry's block to errors/errors.md — the flat, append-only, per-feature log. */
export function appendErrorBlock(feature, record) {
  const file = errorsFile(feature);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const header = fs.existsSync(file) && fs.statSync(file).size > 0 ? '' : `# Errors — ${feature}\n\n`;
  const block = [
    `## #${record.id} — ${record.loggedDate} (open)`,
    '',
    record.description || '_(no description given)_',
    '',
    '---',
    '',
  ].join('\n');
  fs.appendFileSync(file, header + block);
  return file;
}
