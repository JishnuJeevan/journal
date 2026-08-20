import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { findProjectRoot, errorsFile, fragmentFile } from '../lib/paths.js';
import { loadFeature, saveFeature } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';
import { buildDashboard } from './buildDashboard.js';

function gitUserName(root) {
  try {
    return execFileSync('git', ['config', 'user.name'], { cwd: root, encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

export async function resolveError(feature, fixNote, opts = {}) {
  const entry = loadFeature(feature);
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

  const root = findProjectRoot();
  const attribution = opts.agent ? 'ai' : 'person';
  const identity = attribution === 'person' ? gitUserName(root) : null;
  const resolvedDate = new Date().toISOString();
  target.status = 'resolved';
  target.fixNote = fixNote || '';
  target.resolvedDate = resolvedDate;
  target.attribution = attribution;
  target.identity = identity;
  saveFeature(feature, entry);

  const file = errorsFile(feature);
  fs.appendFileSync(
    file,
    [`## #${target.id} resolved — ${resolvedDate} (${attribution}${identity ? ` · ${identity}` : ''})`, '', fixNote || '_(no note given)_', '', '---', ''].join('\n')
  );

  const sha = stageAndCommit(
    [path.relative(root, file), path.relative(root, fragmentFile(feature))],
    `chore(journal): resolve error #${target.id} for ${feature}`
  );
  console.log(`Resolved #${target.id} (${attribution}${identity ? ` · ${identity}` : ''}). Committed ${sha.slice(0, 12)}.`);
  await buildDashboard();
}
