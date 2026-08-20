import fs from 'node:fs';
import path from 'node:path';
import { findProjectRoot, stepDir, stepFile, brainDumpFile, sketchFile, testOutlineFile, fragmentFile } from '../lib/paths.js';
import { loadFeature, saveFeature, getCurrentVersion } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';
import { writeStepFile } from '../lib/frontmatter.js';
import { blankStepBody, newStepFrontmatter, ensureRoundFile } from '../lib/templates.js';
import { buildDashboard } from './buildDashboard.js';

export async function addStep(feature, stepName) {
  const entry = loadFeature(feature);

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
  const relPaths = [path.relative(root, fragmentFile(feature))];

  const dir = stepDir(feature, stepName);
  fs.mkdirSync(dir, { recursive: true });

  if (stepName !== 'code' && stepName !== 'test') {
    const file = stepFile(feature, stepName);
    const fm = newStepFrontmatter({ feature, step: stepName, version: entry.currentVersion });
    writeStepFile(file, fm, blankStepBody(stepName));
    relPaths.push(path.relative(root, file));

    const bdFile = brainDumpFile(feature, stepName);
    if (ensureRoundFile(bdFile, { feature, step: stepName, version: entry.currentVersion })) {
      relPaths.push(path.relative(root, bdFile));
    }
  }
  if (stepName === 'code') {
    const skFile = sketchFile(feature);
    if (ensureRoundFile(skFile, { feature, step: 'code', version: entry.currentVersion })) {
      relPaths.push(path.relative(root, skFile));
    }
  }
  if (stepName === 'test') {
    const outFile = testOutlineFile(feature);
    if (ensureRoundFile(outFile, { feature, step: 'test', version: entry.currentVersion })) {
      relPaths.push(path.relative(root, outFile));
    }
  }

  saveFeature(feature, entry);

  const sha = stageAndCommit(relPaths, `chore(ledger): add-step ${stepName} to ${feature}`);
  console.log(`Added "${stepName}" to ${feature}'s pipeline (registered — no content generated yet). Committed ${sha.slice(0, 12)}.`);
  await buildDashboard();
  console.log(`Next: ledger draft ${stepName} ${feature} ["description"]`);
}
