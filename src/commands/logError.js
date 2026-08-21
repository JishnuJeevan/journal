import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import { findProjectRoot, fragmentFile } from '../lib/paths.js';
import { loadFeature, saveFeature } from '../lib/index-store.js';
import { openErrorEntry, appendErrorBlock } from '../lib/errorLog.js';
import { stageAndCommit } from '../lib/git.js';
import { buildDashboard } from './buildDashboard.js';

function readPipedStdin() {
  if (process.stdin.isTTY) return null;
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return null;
  }
}

/** `log-error <feature> [errorOutput] [description]` — the raw terminal/error output,
 * kept separate from your own account of what happened and where (feedback). Piped
 * input (e.g. `npm test | journal log-error feature`) fills errorOutput automatically. */
export async function logError(feature, errorOutput, description) {
  const entry = loadFeature(feature);

  const piped = readPipedStdin();
  if (piped && piped.trim()) errorOutput = piped;

  if ((!errorOutput || !errorOutput.trim()) && (!description || !description.trim())) {
    const { input } = await prompts({
      type: 'text',
      name: 'input',
      message: 'What happened? (the error / output — leave blank to open an empty entry)',
    });
    description = input || '';
  }

  const record = openErrorEntry(entry, { errorOutput, description });
  saveFeature(feature, entry);
  const file = appendErrorBlock(feature, record);
  const id = record.id;

  const root = findProjectRoot();
  const sha = stageAndCommit(
    [path.relative(root, file), path.relative(root, fragmentFile(feature))],
    `chore(journal): log error #${id} for ${feature}`
  );
  console.log(`Logged as #${id}. Committed ${sha.slice(0, 12)}.`);
  console.log(`Plan a fix with: journal fix-error ${feature} --id ${id}`);
  console.log(`Apply it with: journal apply-fix ${feature} --id ${id}`);
  console.log(`Then resolve with: journal resolve-error ${feature} "fix note" --id ${id}`);
  await buildDashboard();
}
