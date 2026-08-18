import fs from 'node:fs';
import path from 'node:path';
import { findProjectRoot, errorsFile, indexFile } from '../lib/paths.js';
import { loadIndex, saveIndex, getFeature } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';

export async function resolveError(feature, fixNote, opts = {}) {
  const index = loadIndex();
  const entry = getFeature(index, feature);
  const errors = entry.errors || [];

  let target;
  if (opts.id) {
    target = errors.find((e) => e.id === Number(opts.id));
    if (!target) throw new Error(`No error #${opts.id} logged for "${feature}".`);
    if (target.status === 'resolved') throw new Error(`Error #${opts.id} is already resolved.`);
  } else {
    target = [...errors].reverse().find((e) => e.status === 'open');
    if (!target) throw new Error(`No open errors for "${feature}".`);
  }

  const attribution = opts.agent ? 'ai' : 'person';
  const resolvedDate = new Date().toISOString();
  target.status = 'resolved';
  target.fixNote = fixNote || '';
  target.resolvedDate = resolvedDate;
  target.attribution = attribution;
  saveIndex(index);

  const file = errorsFile(feature);
  fs.appendFileSync(
    file,
    [`## #${target.id} resolved — ${resolvedDate} (${attribution})`, '', fixNote || '_(no note given)_', '', '---', ''].join('\n')
  );

  const root = findProjectRoot();
  const sha = stageAndCommit(
    [path.relative(root, file), path.relative(root, indexFile())],
    `chore(ledger): resolve error #${target.id} for ${feature}`
  );
  console.log(`Resolved #${target.id} (${attribution}). Committed ${sha.slice(0, 12)}.`);
}
