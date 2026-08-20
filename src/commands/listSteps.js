import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import { findProjectRoot, stepDir, stepFile, brainDumpFile, sketchFile, testOutlineFile, fragmentFile } from '../lib/paths.js';
import { featureExists, loadFeature, saveFeature, newFeatureEntry, nextOrder } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';
import { proposeSteps } from '../lib/ai.js';
import { writeStepFile } from '../lib/frontmatter.js';
import { defaultBodyForStep, newStepFrontmatter, ensureRoundFile } from '../lib/templates.js';
import { buildDashboard } from './buildDashboard.js';

export async function listSteps(feature, opts = {}) {
  let entry;

  if (!featureExists(feature)) {
    if (!opts.description) {
      throw new Error(
        `Unknown feature "${feature}". Register it first with \`ledger list-features\`, ` +
          `or create it inline with \`ledger list-steps ${feature} --description "..."\`.`
      );
    }
    entry = newFeatureEntry({ name: feature, description: opts.description, order: nextOrder() });
  } else {
    entry = loadFeature(feature);
  }

  if (entry.steps) {
    throw new Error(
      `Feature "${feature}" already has a locked step pipeline: [${entry.steps.join(', ')}]. ` +
        `Step pipelines are immutable in v1 once locked — use \`ledger add-step\` to add one.`
    );
  }

  console.log(`Asking Claude to propose a step pipeline for "${feature}"...\n`);
  const { steps: proposedSteps, rationale } = await proposeSteps(feature, entry.description);

  console.log(`Proposed steps: ${proposedSteps.join(' -> ')}`);
  if (rationale) console.log(`Rationale: ${rationale}`);
  console.log('');

  const { action } = await prompts({
    type: 'select',
    name: 'action',
    message: 'Lock in this step pipeline?',
    choices: [
      { title: 'Accept as proposed', value: 'accept' },
      { title: 'Edit (comma-separated list)', value: 'edit' },
      { title: 'Cancel', value: 'cancel' },
    ],
  });

  let finalSteps = proposedSteps;
  if (action === 'cancel' || !action) {
    console.log('Cancelled. Nothing was written.');
    return;
  }
  if (action === 'edit') {
    const { edited } = await prompts({
      type: 'text',
      name: 'edited',
      message: 'Steps (comma-separated, in order)',
      initial: proposedSteps.join(', '),
    });
    if (!edited) {
      console.log('Cancelled. Nothing was written.');
      return;
    }
    finalSteps = edited.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  }

  entry.steps = finalSteps;
  entry.currentVersion = 1;
  entry.versions = [{ version: 1, steps: {} }];

  const root = findProjectRoot();
  const relPaths = [path.relative(root, fragmentFile(feature))];

  for (const step of finalSteps) {
    const dir = stepDir(feature, step);
    fs.mkdirSync(dir, { recursive: true });
    // "code" and "test" manage their own file set (sketch.md/snapshot/annotations.md,
    // test-outline.md/test.md) rather than a single <step>.md stub.
    if (step !== 'code' && step !== 'test') {
      const file = stepFile(feature, step);
      const fm = newStepFrontmatter({ feature, step, version: 1 });
      writeStepFile(file, fm, defaultBodyForStep(step));
      relPaths.push(path.relative(root, file));

      // Pre-create brain-dump.md now, not just on first `draft` — so there's
      // somewhere to write a large brain dump directly from the start (feedback).
      const bdFile = brainDumpFile(feature, step);
      if (ensureRoundFile(bdFile, { feature, step, version: 1 })) {
        relPaths.push(path.relative(root, bdFile));
      }
    }
    if (step === 'code') {
      const skFile = sketchFile(feature);
      if (ensureRoundFile(skFile, { feature, step: 'code', version: 1 })) {
        relPaths.push(path.relative(root, skFile));
      }
    }
    if (step === 'test') {
      // Pre-created empty (frontmatter only) — `draft test` treats "no real content
      // yet" as the signal to propose an outline, so this is safe to seed early and
      // gives somewhere to write/paste a big outline directly (feedback).
      const outFile = testOutlineFile(feature);
      if (ensureRoundFile(outFile, { feature, step: 'test', version: 1 })) {
        relPaths.push(path.relative(root, outFile));
      }
    }
  }

  saveFeature(feature, entry);

  const sha = stageAndCommit(
    relPaths,
    `chore(ledger): lock step pipeline for ${feature} (${finalSteps.join(', ')})`
  );

  console.log(`\nLocked in. Committed ${sha.slice(0, 12)}.`);
  await buildDashboard();
  console.log(`Next: ledger draft ${finalSteps[0]} ${feature}`);
}
