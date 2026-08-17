import path from 'node:path';
import { findProjectRoot, stepFile, indexFile } from '../lib/paths.js';
import { loadIndex, saveIndex, getFeature } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';
import { writeStepFile } from '../lib/frontmatter.js';
import { defaultBodyForStep, newStepFrontmatter } from '../lib/templates.js';

export async function newColumn(feature) {
  const root = findProjectRoot();
  const index = loadIndex();
  const entry = getFeature(index, feature);

  if (!entry.steps) {
    throw new Error(`Feature "${feature}" has no locked step pipeline yet — run \`ledger list-steps ${feature}\` first.`);
  }

  const newColumnNum = entry.currentColumn + 1;
  entry.currentColumn = newColumnNum;
  entry.columns.push({ column: newColumnNum, steps: {} });

  const relPaths = [path.relative(root, indexFile())];
  for (const step of entry.steps) {
    const file = stepFile(feature, step);
    const fm = newStepFrontmatter({ feature, step, column: newColumnNum });
    writeStepFile(file, fm, defaultBodyForStep(step));
    relPaths.push(path.relative(root, file));
  }

  saveIndex(index);

  const sha = stageAndCommit(relPaths, `chore(ledger): start column ${newColumnNum} for ${feature}`);

  console.log(`Started column ${newColumnNum} for "${feature}". Committed ${sha.slice(0, 12)}.`);
  console.log(`Previous column's content remains viewable in the dashboard via its recorded SHAs.`);
}
