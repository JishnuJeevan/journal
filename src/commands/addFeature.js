import path from 'node:path';
import { findProjectRoot, fragmentFile } from '../lib/paths.js';
import { featureExists, saveFeature, newFeatureEntry, nextOrder } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';
import { buildDashboard } from './buildDashboard.js';

export async function addFeature(name, description, opts = {}) {
  const slug = name;

  if (featureExists(slug)) {
    throw new Error(`Feature "${slug}" is already registered.`);
  }

  const entry = newFeatureEntry({
    name: slug,
    description: description || '',
    group: opts.group || null,
    order: nextOrder(),
  });
  saveFeature(slug, entry);

  const root = findProjectRoot();
  const sha = stageAndCommit(
    [path.relative(root, fragmentFile(slug))],
    `chore(ledger): add feature ${slug}`
  );

  console.log(`Registered "${slug}". Committed ${sha.slice(0, 12)}.`);
  await buildDashboard();
  console.log(`Next: ledger list-steps ${slug}`);
}
