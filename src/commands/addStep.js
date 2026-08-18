import fs from 'node:fs';
import path from 'node:path';
import { findProjectRoot, stepDir, stepFile, brainDumpFile, indexFile } from '../lib/paths.js';
import { loadIndex, saveIndex, getFeature, getCurrentVersion } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';
import { writeStepFile } from '../lib/frontmatter.js';
import { blankStepBody, newStepFrontmatter } from '../lib/templates.js';

export async function addStep(feature, stepName) {
  const index = loadIndex();
  const entry = getFeature(index, feature);

  if (!entry.steps) {
    throw new Error(`Feature "${feature}" has no locked step pipeline yet — run \`ledger list-steps ${feature}\` first.`);
  }
  if (entry.steps.includes(stepName)) {
    throw new Error(`Feature "${feature}" already has a "${stepName}" step.`);
  }

  entry.steps.push(stepName);
  const version = getCurrentVersion(entry);
  version.steps[stepName] = version.steps[stepName] || null;

  const root = findProjectRoot();
  const relPaths = [path.relative(root, indexFile())];

  const dir = stepDir(feature, stepName);
  fs.mkdirSync(dir, { recursive: true });

  if (stepName !== 'code' && stepName !== 'test') {
    const file = stepFile(feature, stepName);
    const fm = newStepFrontmatter({ feature, step: stepName, version: entry.currentVersion });
    writeStepFile(file, fm, blankStepBody(stepName));
    relPaths.push(path.relative(root, file));
  }

  saveIndex(index);

  const sha = stageAndCommit(relPaths, `chore(ledger): add-step ${stepName} to ${feature}`);
  console.log(`Added "${stepName}" to ${feature}'s pipeline (registered — no content generated yet). Committed ${sha.slice(0, 12)}.`);
  console.log(`Next: ledger draft ${stepName} ${feature} ["description"]`);
}
