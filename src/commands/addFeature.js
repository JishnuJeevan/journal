import path from 'node:path';
import { findProjectRoot, fragmentFile, srsBrainDumpFile } from '../lib/paths.js';
import { featureExists, saveFeature, newFeatureEntry, nextOrder } from '../lib/index-store.js';
import { appendRound } from '../lib/templates.js';
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
  const bdFile = srsBrainDumpFile();
  // §9.2: kept in the project's brain-dump history too, same as any other round, so
  // `add-feature`'s fast path doesn't leave a silent gap in the record.
  appendRound(bdFile, `Added directly via add-feature: \`${slug}\`${description ? ` — ${description}` : ''}`, { scope: 'project' });

  const sha = stageAndCommit(
    [path.relative(root, fragmentFile(slug)), path.relative(root, bdFile)],
    `chore(journal): add feature ${slug}`
  );

  console.log(`Registered "${slug}". Committed ${sha.slice(0, 12)}.`);
  await buildDashboard();
  console.log(`Next: journal list-steps ${slug}`);
}
