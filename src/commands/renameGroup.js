import path from 'node:path';
import { findProjectRoot, fragmentFile } from '../lib/paths.js';
import { loadAllFeatures, saveFeature } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';
import { buildDashboard } from './buildDashboard.js';

/** Omitting `newName` ungroups every feature currently tagged `oldName`, same convention as set-group. */
export async function renameGroup(oldName, newName) {
  if (!oldName) {
    throw new Error('Usage: ledger rename-group <old-group-name> [<new-group-name>]');
  }

  const all = loadAllFeatures();
  const affected = Object.entries(all)
    .filter(([, f]) => f.group === oldName)
    .map(([slug]) => slug);

  if (affected.length === 0) {
    console.log(`No features are tagged "${oldName}". Nothing to do.`);
    return;
  }

  const root = findProjectRoot();
  const relPaths = [];
  for (const slug of affected) {
    all[slug].group = newName || null;
    saveFeature(slug, all[slug]);
    relPaths.push(path.relative(root, fragmentFile(slug)));
  }

  const sha = stageAndCommit(relPaths, `chore(ledger): rename-group ${oldName} -> ${newName || '(none)'}`);

  console.log(
    newName
      ? `Retagged ${affected.length} feature(s) (${affected.join(', ')}) to "${newName}". Committed ${sha.slice(0, 12)}.`
      : `Ungrouped ${affected.length} feature(s) (${affected.join(', ')}) previously tagged "${oldName}". Committed ${sha.slice(0, 12)}.`
  );
  await buildDashboard();
}
