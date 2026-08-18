import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import prompts from 'prompts';
import { findProjectRoot, stepDir, stepFile, indexFile } from '../lib/paths.js';
import { loadIndex, saveIndex, newFeatureEntry } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';
import { proposeFeaturesFromCode, proposeSteps } from '../lib/ai.js';
import { writeStepFile } from '../lib/frontmatter.js';
import { defaultBodyForStep, newStepFrontmatter } from '../lib/templates.js';

function listTrackedFiles(root) {
  const out = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  return out
    .split('\n')
    .filter(Boolean)
    .filter((p) => !p.startsWith('LEDGER/') && !p.startsWith('node_modules/'));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export async function ledgerInit() {
  const root = findProjectRoot();
  const index = loadIndex();
  const files = listTrackedFiles(root);

  if (files.length === 0) {
    console.log('No tracked files found to bootstrap from.');
    return;
  }

  console.log(`Asking Claude to propose a feature decomposition for ${files.length} tracked file(s)...\n`);
  const proposed = await proposeFeaturesFromCode(files.join('\n'));

  const known = new Set(Object.keys(index.features));
  const choices = proposed.map((f) => ({
    title: `${f.name}${known.has(f.slug) ? ' (already registered)' : ''}`,
    description: `${f.slug} — ${f.description}${f.group ? ` [${f.group}]` : ''} — ${(f.codePaths || []).length} path(s)`,
    value: f,
    selected: !known.has(f.slug),
    disabled: known.has(f.slug),
  }));

  console.log('Proposed features:');
  for (const f of proposed) {
    console.log(
      `  - ${f.slug}: ${f.description} (${(f.codePaths || []).length} path(s))${known.has(f.slug) ? '  [already registered]' : ''}`
    );
  }
  console.log('');

  const { selected } = await prompts({
    type: 'multiselect',
    name: 'selected',
    message: 'Bootstrap which features into LEDGER? (space to toggle, enter to confirm)',
    choices,
    hint: '- Space to select. Return to submit',
  });

  if (!selected || selected.length === 0) {
    console.log('Nothing bootstrapped. Safe to re-run any time — already-registered features are skipped.');
    return;
  }

  const relPaths = [path.relative(root, indexFile())];

  for (const f of selected) {
    console.log(`\nAsking Claude to propose a step pipeline for "${f.slug}"...`);
    const { steps } = await proposeSteps(f.slug, f.description);

    const entry = newFeatureEntry({ name: f.name, description: f.description, group: f.group ?? null });
    entry.codePaths = f.codePaths || [];
    entry.steps = steps;
    entry.currentVersion = 1;
    entry.versions = [{ version: 1, steps: {} }];
    index.features[f.slug] = entry;

    for (const step of steps) {
      if (step === 'code' || step === 'test') {
        fs.mkdirSync(stepDir(f.slug, step), { recursive: true });
        continue;
      }
      const file = stepFile(f.slug, step);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      writeStepFile(file, newStepFrontmatter({ feature: f.slug, step, version: 1 }), defaultBodyForStep(step));
      relPaths.push(path.relative(root, file));
    }

    if (steps.includes('code') && entry.codePaths.length) {
      const codeDir = stepDir(f.slug, 'code');
      for (const relPath of entry.codePaths) {
        const src = path.join(root, relPath);
        if (!fs.existsSync(src)) continue;
        const dest = path.join(codeDir, relPath);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.cpSync(src, dest, { recursive: true });
        relPaths.push(path.relative(root, dest));
      }
      entry.versions[0].steps.code = { attribution: 'legacy', commitSha: null, date: todayIso() };
    }
  }

  saveIndex(index);

  const sha = stageAndCommit(
    Array.from(new Set(relPaths)),
    `chore(ledger): ledger-init bootstrap (${selected.map((f) => f.slug).join(', ')})`
  );

  // Record the actual commit SHA into each bootstrapped feature's Code step.
  const index2 = loadIndex();
  for (const f of selected) {
    const e = index2.features[f.slug];
    if (e?.versions[0]?.steps.code) e.versions[0].steps.code.commitSha = sha;
  }
  saveIndex(index2);
  const recordSha = stageAndCommit(
    [path.relative(root, indexFile())],
    `chore(ledger): record ledger-init bootstrap SHA (${sha.slice(0, 12)})`
  );

  console.log(`\nBootstrapped ${selected.length} feature(s). Committed ${sha.slice(0, 12)} and ${recordSha.slice(0, 12)}.`);
  console.log(`Code snapshots recorded with attribution "legacy". Logic/Test/Document left blank — draft them when ready.`);
  console.log(`Re-run \`ledger-init\` any time — already-registered features are skipped automatically.`);
}
