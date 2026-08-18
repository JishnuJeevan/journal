import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import { findProjectRoot, errorsFile, indexFile } from '../lib/paths.js';
import { loadIndex, saveIndex, getFeature, nextErrorId } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';

function readPipedStdin() {
  if (process.stdin.isTTY) return null;
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return null;
  }
}

export async function logError(feature, description) {
  const index = loadIndex();
  const entry = getFeature(index, feature);

  let text = description;
  const piped = readPipedStdin();
  if (piped && piped.trim()) {
    text = piped;
  }
  if (!text || !text.trim()) {
    const { input } = await prompts({
      type: 'text',
      name: 'input',
      message: 'What happened? (the error / output — leave blank to open an empty entry)',
    });
    text = input || '';
  }

  const id = nextErrorId(entry);
  const loggedDate = new Date().toISOString();
  entry.errors = entry.errors || [];
  entry.errors.push({
    id,
    status: 'open',
    loggedDate,
    description: text.trim(),
    fixNote: null,
    resolvedDate: null,
    attribution: null,
  });
  saveIndex(index);

  const file = errorsFile(feature);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const header = fs.existsSync(file) && fs.statSync(file).size > 0 ? '' : `# Errors — ${feature}\n\n`;
  const block = [
    `## #${id} — ${loggedDate} (open)`,
    '',
    text.trim() || '_(no description given)_',
    '',
    '---',
    '',
  ].join('\n');
  fs.appendFileSync(file, header + block);

  const root = findProjectRoot();
  const sha = stageAndCommit(
    [path.relative(root, file), path.relative(root, indexFile())],
    `chore(ledger): log error #${id} for ${feature}`
  );
  console.log(`Logged as #${id}. Committed ${sha.slice(0, 12)}.`);
  console.log(`Resolve it later with: ledger resolve-error ${feature} "fix note" --id ${id}`);
}
