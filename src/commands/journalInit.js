import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import { findProjectRoot, stepDir, stepFile, fragmentFile, styleFile, srsBrainDumpFile, srsFeaturesFile } from '../lib/paths.js';
import { featureExists, saveFeature, loadFeature, newFeatureEntry, nextOrder } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';
import { proposeSteps } from '../lib/ai.js';
import { deriveFeaturesFromCode } from './draftFeatures.js';
import { init } from './init.js';
import { writeStepFile } from '../lib/frontmatter.js';
import { defaultBodyForStep, newStepFrontmatter } from '../lib/templates.js';
import { buildDashboard } from './buildDashboard.js';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function journalInit() {
  const root = findProjectRoot();

  // §9.1: a one-time bootstrap — scaffold JOURNAL/SRS/ if `journal init` hasn't run yet,
  // rather than requiring it as a separate manual step first.
  if (!fs.existsSync(styleFile())) {
    await init();
  }

  // §9.1/§9.2: triggers `draft features`'s own code-scanning branch — one scanning
  // mechanism, not a separate one duplicated here.
  const proposed = await deriveFeaturesFromCode(root);
  if (!proposed) {
    console.log('No tracked files found to bootstrap from.');
    return;
  }

  const choices = proposed.map((f) => ({
    title: `${f.name}${featureExists(f.slug) ? ' (already registered)' : ''}`,
    description: `${f.slug} — ${f.description} — ${(f.codePaths || []).length} path(s)`,
    value: f,
    selected: !featureExists(f.slug),
    disabled: featureExists(f.slug),
  }));

  console.log('Proposed features:');
  for (const f of proposed) {
    console.log(
      `  - ${f.slug}: ${f.description} (${(f.codePaths || []).length} path(s))${featureExists(f.slug) ? '  [already registered]' : ''}`
    );
  }
  console.log('');

  const { selected } = await prompts({
    type: 'multiselect',
    name: 'selected',
    message: 'Bootstrap which features into JOURNAL? (space to toggle, enter to confirm)',
    choices,
    hint: '- Space to select. Return to submit',
  });

  if (!selected || selected.length === 0) {
    console.log('Nothing bootstrapped. Safe to re-run any time — already-registered features are skipped.');
    return;
  }

  const root2 = root;
  const relPaths = [path.relative(root2, srsBrainDumpFile()), path.relative(root2, srsFeaturesFile())];
  let order = nextOrder();

  for (const f of selected) {
    console.log(`\nAsking Claude to propose a step pipeline for "${f.slug}"...`);
    const { steps } = await proposeSteps(f.slug, f.description);

    // §2/§9.2: group is manual-only — never assigned from an AI proposal, even journal-init's
    // code-scan one.
    const entry = newFeatureEntry({ name: f.name, description: f.description, group: null, order: order++ });
    entry.codePaths = f.codePaths || [];
    entry.steps = steps;
    entry.currentVersion = 1;
    entry.versions = [{ version: 1, steps: {} }];

    for (const step of steps) {
      if (step === 'code' || step === 'test') {
        fs.mkdirSync(stepDir(f.slug, step), { recursive: true });
        continue;
      }
      const file = stepFile(f.slug, step);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      writeStepFile(file, newStepFrontmatter({ feature: f.slug, step, version: 1 }), defaultBodyForStep(step));
      relPaths.push(path.relative(root2, file));
    }

    if (steps.includes('code') && entry.codePaths.length) {
      const codeDir = stepDir(f.slug, 'code');
      for (const relPath of entry.codePaths) {
        const src = path.join(root2, relPath);
        if (!fs.existsSync(src)) continue;
        const dest = path.join(codeDir, relPath);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.cpSync(src, dest, { recursive: true });
        relPaths.push(path.relative(root2, dest));
      }
      entry.versions[0].steps.code = { attribution: 'legacy', identity: null, commitSha: null, date: todayIso() };
    }

    saveFeature(f.slug, entry);
    relPaths.push(path.relative(root2, fragmentFile(f.slug)));
  }

  const sha = stageAndCommit(
    Array.from(new Set(relPaths)),
    `chore(journal): journal-init bootstrap (${selected.map((f) => f.slug).join(', ')})`
  );

  // Record the actual commit SHA into each bootstrapped feature's Code step.
  const fragmentPaths = [];
  for (const f of selected) {
    const e = loadFeature(f.slug);
    if (e?.versions[0]?.steps.code) {
      e.versions[0].steps.code.commitSha = sha;
      saveFeature(f.slug, e);
      fragmentPaths.push(path.relative(root2, fragmentFile(f.slug)));
    }
  }
  const recordSha = fragmentPaths.length
    ? stageAndCommit(fragmentPaths, `chore(journal): record journal-init bootstrap SHA (${sha.slice(0, 12)})`)
    : sha;

  console.log(`\nBootstrapped ${selected.length} feature(s). Committed ${sha.slice(0, 12)} and ${recordSha.slice(0, 12)}.`);
  console.log(`Code snapshots recorded with attribution "legacy". Logic/Test/Document left blank — draft them when ready.`);
  console.log(`Re-run \`journal-init\` any time — already-registered features are skipped automatically.`);
  await buildDashboard();
}
