import path from 'node:path';
import prompts from 'prompts';
import { findProjectRoot } from '../lib/paths.js';
import { loadIndex, saveIndex, newFeatureEntry } from '../lib/index-store.js';
import { indexFile } from '../lib/paths.js';
import { stageAndCommit } from '../lib/git.js';
import { proposeFeatures } from '../lib/ai.js';

export async function listFeatures(brainDump) {
  if (!brainDump || !brainDump.trim()) {
    throw new Error('Usage: ledger list-features "<free-form description of your project>"');
  }

  console.log('Asking Claude to propose features from your description...\n');
  const proposed = await proposeFeatures(brainDump);

  const index = loadIndex();
  const known = new Set(Object.keys(index.features));

  const choices = proposed.map((f) => ({
    title: `${f.name}${known.has(f.slug) ? ' (already registered)' : ''}`,
    description: `${f.slug} — ${f.description}${f.group ? ` [${f.group}]` : ''}`,
    value: f,
    selected: !known.has(f.slug),
    disabled: known.has(f.slug),
  }));

  console.log('Proposed features:');
  for (const f of proposed) {
    console.log(
      `  - ${f.slug}: ${f.description}${f.group ? ` (group: ${f.group})` : ''}${known.has(f.slug) ? '  [already registered]' : ''}`
    );
  }
  console.log('');

  const { selected } = await prompts({
    type: 'multiselect',
    name: 'selected',
    message: 'Register which features into LEDGER? (space to toggle, enter to confirm)',
    choices,
    hint: '- Space to select. Return to submit',
  });

  if (!selected || selected.length === 0) {
    console.log('Nothing registered. Re-run any time — this is purely advisory until confirmed.');
    return;
  }

  for (const f of selected) {
    index.features[f.slug] = newFeatureEntry({ name: f.name, description: f.description, group: f.group ?? null });
  }
  saveIndex(index);

  const root = findProjectRoot();
  const sha = stageAndCommit(
    [path.relative(root, indexFile())],
    `chore(ledger): register features (${selected.map((f) => f.slug).join(', ')})`
  );

  console.log(`\nRegistered ${selected.length} feature(s). Committed ${sha.slice(0, 12)}.`);
  console.log(`Next: ledger list-steps <feature> for each, to lock in its step pipeline.`);
}
