import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import { findProjectRoot, errorsFile } from '../lib/paths.js';
import { loadIndex, getFeature } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';

export async function logError(feature, opts = {}) {
  const root = findProjectRoot();
  const index = loadIndex();
  getFeature(index, feature); // validates the feature is known

  let { error, resolution } = opts;
  if (!error) {
    ({ error } = await prompts({
      type: 'text',
      name: 'error',
      message: 'What happened? (the error / output)',
    }));
    if (!error) throw new Error('Cancelled — no error text given.');
  }
  if (!resolution) {
    ({ resolution } = await prompts({
      type: 'text',
      name: 'resolution',
      message: 'How was it resolved? (leave blank if still open)',
    }));
  }

  const file = errorsFile(feature);
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const timestamp = new Date().toISOString();
  const entry = [
    `## ${timestamp}`,
    '',
    '**Error:**',
    '',
    error,
    '',
    '**Resolution:**',
    '',
    resolution && resolution.trim() ? resolution : '_(unresolved)_',
    '',
    '---',
    '',
  ].join('\n');

  fs.appendFileSync(file, (fs.existsSync(file) && fs.statSync(file).size > 0 ? '' : `# Errors — ${feature}\n\n`) + entry);

  const sha = stageAndCommit([path.relative(root, file)], `chore(ledger): log error for ${feature}`);
  console.log(`Logged. Committed ${sha.slice(0, 12)}.`);
}
