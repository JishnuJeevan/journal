import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import { findProjectRoot, errorsFile, fragmentFile } from '../lib/paths.js';
import { loadFeature, saveFeature, nextErrorId } from '../lib/index-store.js';
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
 * input (e.g. `npm test | ledger log-error feature`) fills errorOutput automatically. */
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

  const parts = [];
  if (errorOutput && errorOutput.trim()) parts.push(`Error output:\n${errorOutput.trim()}`);
  if (description && description.trim()) parts.push(`Description:\n${description.trim()}`);
  const text = parts.join('\n\n');

  const id = nextErrorId(entry);
  const loggedDate = new Date().toISOString();
  entry.errors = entry.errors || [];
  entry.errors.push({
    id,
    status: 'open',
    loggedDate,
    description: text || '',
    fixNote: null,
    resolvedDate: null,
    attribution: null,
    identity: null,
  });
  saveFeature(feature, entry);

  const file = errorsFile(feature);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const header = fs.existsSync(file) && fs.statSync(file).size > 0 ? '' : `# Errors — ${feature}\n\n`;
  const block = [
    `## #${id} — ${loggedDate} (open)`,
    '',
    text || '_(no description given)_',
    '',
    '---',
    '',
  ].join('\n');
  fs.appendFileSync(file, header + block);

  const root = findProjectRoot();
  const sha = stageAndCommit(
    [path.relative(root, file), path.relative(root, fragmentFile(feature))],
    `chore(ledger): log error #${id} for ${feature}`
  );
  console.log(`Logged as #${id}. Committed ${sha.slice(0, 12)}.`);
  console.log(`Diagnose it with: ledger fix-error ${feature} --id ${id}`);
  console.log(`Resolve it later with: ledger resolve-error ${feature} "fix note" --id ${id}`);
  await buildDashboard();
}
