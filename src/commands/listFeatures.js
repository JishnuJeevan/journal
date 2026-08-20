import path from 'node:path';
import prompts from 'prompts';
import { findProjectRoot, fragmentFile } from '../lib/paths.js';
import { featureExists, saveFeature, newFeatureEntry, nextOrder } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';
import { proposeFeatures } from '../lib/ai.js';
import { buildDashboard } from './buildDashboard.js';

export async function listFeatures(brainDump) {
  if (!brainDump || !brainDump.trim()) {
    throw new Error('Usage: journal list-features "<free-form description of your project>"');
  }

  console.log('Asking Claude to propose features from your description...\n');
  const proposed = await proposeFeatures(brainDump);

  // Features start ungrouped — group manually via `set-group` once you've actually
  // registered enough of them to see how they cluster (feedback: auto-grouping at
  // proposal time was premature and not what the author wanted by default).
  const choices = proposed.map((f) => ({
    title: `${f.name}${featureExists(f.slug) ? ' (already registered)' : ''}`,
    description: `${f.slug} — ${f.description}`,
    value: f,
    selected: !featureExists(f.slug),
    disabled: featureExists(f.slug),
  }));

  console.log('Proposed features (ordered simplest to hardest to implement):');
  for (const f of proposed) {
    console.log(`  - ${f.slug}: ${f.description}${featureExists(f.slug) ? '  [already registered]' : ''}`);
  }
  console.log('');

  const { selected } = await prompts({
    type: 'multiselect',
    name: 'selected',
    message: 'Register which features into JOURNAL? (space to toggle, enter to confirm)',
    choices,
    hint: '- Space to select. Return to submit',
  });

  if (!selected || selected.length === 0) {
    console.log('Nothing registered. Re-run any time — this is purely advisory until confirmed.');
    return;
  }

  const root = findProjectRoot();
  const relPaths = [];
  let order = nextOrder();
  // Registered in the AI's proposed (simplest-to-hardest) order, so `order` reflects
  // implementation sequence rather than selection order.
  for (const f of proposed) {
    if (!selected.includes(f)) continue;
    const entry = newFeatureEntry({ name: f.name, description: f.description, group: null, order: order++ });
    saveFeature(f.slug, entry);
    relPaths.push(path.relative(root, fragmentFile(f.slug)));
  }

  const sha = stageAndCommit(relPaths, `chore(journal): register features (${selected.map((f) => f.slug).join(', ')})`);

  console.log(`\nRegistered ${selected.length} feature(s). Committed ${sha.slice(0, 12)}.`);
  await buildDashboard();
  console.log(`Next: journal list-steps <feature> for each, to lock in its step pipeline.`);
}
