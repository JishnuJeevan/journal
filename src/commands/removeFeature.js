import path from 'node:path';
import { findProjectRoot, indexFile } from '../lib/paths.js';
import { loadIndex, saveIndex, getFeature } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';

export async function removeFeature(feature) {
  const index = loadIndex();
  const entry = getFeature(index, feature);

  if (entry.removed) {
    console.log(`"${feature}" is already marked removed.`);
    return;
  }

  entry.removed = true;
  saveIndex(index);

  const root = findProjectRoot();
  const sha = stageAndCommit(
    [path.relative(root, indexFile())],
    `chore(ledger): remove-feature ${feature}`
  );

  console.log(`Marked "${feature}" removed. LEDGER/features/${feature}/ and its history are kept, just hidden by default in the dashboard.`);
  console.log(`Committed ${sha.slice(0, 12)}.`);
  console.log(`Reminder: this only updates the ledger — delete the real code from src/ yourself if you haven't already.`);
}
