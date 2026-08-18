import path from 'node:path';
import { findProjectRoot, indexFile } from '../lib/paths.js';
import { loadIndex, saveIndex } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';

export async function renameGroup(oldName, newName) {
  if (!oldName || !newName) {
    throw new Error('Usage: ledger rename-group <old-group-name> <new-group-name>');
  }

  const index = loadIndex();
  const affected = Object.entries(index.features)
    .filter(([, f]) => f.group === oldName)
    .map(([slug]) => slug);

  if (affected.length === 0) {
    console.log(`No features are tagged "${oldName}". Nothing to do.`);
    return;
  }

  for (const slug of affected) {
    index.features[slug].group = newName;
  }
  saveIndex(index);

  const root = findProjectRoot();
  const sha = stageAndCommit(
    [path.relative(root, indexFile())],
    `chore(ledger): rename-group ${oldName} -> ${newName}`
  );

  console.log(`Retagged ${affected.length} feature(s) (${affected.join(', ')}). Committed ${sha.slice(0, 12)}.`);
}
