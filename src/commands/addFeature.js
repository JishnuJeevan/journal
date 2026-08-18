import path from 'node:path';
import { findProjectRoot, indexFile } from '../lib/paths.js';
import { loadIndex, saveIndex, newFeatureEntry } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';

export async function addFeature(name, description, opts = {}) {
  const index = loadIndex();
  const slug = name;

  if (index.features[slug]) {
    throw new Error(`Feature "${slug}" is already registered.`);
  }

  index.features[slug] = newFeatureEntry({
    name: slug,
    description: description || '',
    group: opts.group || null,
  });
  saveIndex(index);

  const root = findProjectRoot();
  const sha = stageAndCommit(
    [path.relative(root, indexFile())],
    `chore(ledger): add feature ${slug}`
  );

  console.log(`Registered "${slug}". Committed ${sha.slice(0, 12)}.`);
  console.log(`Next: ledger list-steps ${slug}`);
}
