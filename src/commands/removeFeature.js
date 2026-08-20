import path from 'node:path';
import { findProjectRoot, fragmentFile } from '../lib/paths.js';
import { loadFeature, saveFeature } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';
import { buildDashboard } from './buildDashboard.js';

export async function removeFeature(feature) {
  const entry = loadFeature(feature);

  if (entry.removed) {
    console.log(`"${feature}" is already marked removed.`);
    return;
  }

  entry.removed = true;
  saveFeature(feature, entry);

  const root = findProjectRoot();
  const sha = stageAndCommit(
    [path.relative(root, fragmentFile(feature))],
    `chore(ledger): remove-feature ${feature}`
  );

  console.log(`Marked "${feature}" removed. LEDGER/features/${feature}/ and its history are kept, just hidden by default in the dashboard.`);
  console.log(`Committed ${sha.slice(0, 12)}.`);
  console.log(`Reminder: this only updates the ledger — delete the real code from src/ yourself if you haven't already.`);
  await buildDashboard();
}
