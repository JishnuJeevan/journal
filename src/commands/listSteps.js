import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import { findProjectRoot, stepDir, stepFile, indexFile } from '../lib/paths.js';
import { loadIndex, saveIndex } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';
import { proposeSteps } from '../lib/ai.js';
import { writeStepFile } from '../lib/frontmatter.js';
import { defaultBodyForStep, newStepFrontmatter } from '../lib/templates.js';

export async function listSteps(feature, opts = {}) {
  const index = loadIndex();
  let entry = index.features[feature];

  if (!entry) {
    if (!opts.description) {
      throw new Error(
        `Unknown feature "${feature}". Register it first with \`ledger list-features\`, ` +
          `or create it inline with \`ledger list-steps ${feature} --description "..."\`.`
      );
    }
    entry = {
      name: feature,
      description: opts.description,
      steps: null,
      codePaths: [],
      currentColumn: null,
      columns: [],
    };
    index.features[feature] = entry;
  }

  if (entry.steps) {
    throw new Error(
      `Feature "${feature}" already has a locked step pipeline: [${entry.steps.join(', ')}]. ` +
        `Step pipelines are immutable in v1 once locked.`
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
  entry.currentColumn = 1;
  entry.columns = [{ column: 1, steps: {} }];

  const root = findProjectRoot();
  const relPaths = [path.relative(root, indexFile())];

  for (const step of finalSteps) {
    const dir = stepDir(feature, step);
    fs.mkdirSync(dir, { recursive: true });
    const file = stepFile(feature, step);
    const fm = newStepFrontmatter({ feature, step, column: 1 });
    writeStepFile(file, fm, defaultBodyForStep(step));
    relPaths.push(path.relative(root, file));
  }

  saveIndex(index);

  const sha = stageAndCommit(
    relPaths,
    `chore(ledger): lock step pipeline for ${feature} (${finalSteps.join(', ')})`
  );

  console.log(`\nLocked in. Committed ${sha.slice(0, 12)}.`);
  console.log(`Next: ledger draft-logic ${feature}  (or edit LEDGER/features/${feature}/logic/logic.md directly)`);
}
