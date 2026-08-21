import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import prompts from 'prompts';
import { findProjectRoot, srsBrainDumpFile, srsFeaturesFile } from '../lib/paths.js';
import { appendRound, readOrEmpty, hasContent } from '../lib/templates.js';
import { renderFeaturesMd } from '../lib/featuresDoc.js';
import { stageAndCommit } from '../lib/git.js';
import { proposeFeatures, proposeFeaturesFromCode } from '../lib/ai.js';

function listTrackedFiles(root) {
  const out = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' });
  return out
    .split('\n')
    .filter(Boolean)
    .filter((p) => !p.startsWith('JOURNAL/') && !p.startsWith('node_modules/'));
}

/**
 * Branch 3 of `draft features` (§9.2): no brain-dump input yet, but tracked code already
 * exists — scan it, write a reverse-engineered round into SRS/brain-dump.md, and derive
 * SRS/features.md from that. Shared with `journal-init`, which triggers this same branch for
 * a pre-existing project rather than running its own separate scanner.
 */
export async function deriveFeaturesFromCode(root) {
  const files = listTrackedFiles(root);
  if (files.length === 0) return null;

  console.log(`Asking Claude to propose a feature decomposition for ${files.length} tracked file(s)...\n`);
  const proposed = await proposeFeaturesFromCode(files.join('\n'));

  const summary = proposed
    .map((f) => `- **${f.slug}** — ${f.description} (${(f.codePaths || []).length} path(s))`)
    .join('\n');
  appendRound(
    srsBrainDumpFile(),
    `(auto, from scanning ${files.length} tracked file(s))\n\n${summary}`,
    { scope: 'project' }
  );

  fs.writeFileSync(srsFeaturesFile(), renderFeaturesMd(proposed), 'utf8');
  return proposed;
}

export async function draftFeatures(brainDump, opts = {}) {
  const root = findProjectRoot();
  const bdFile = srsBrainDumpFile();
  const featuresFile = srsFeaturesFile();

  if (opts.file) {
    if (!hasContent(bdFile)) {
      throw new Error(`--file given but ${bdFile} has no content yet — write into it first, then re-run.`);
    }
    brainDump = null;
    console.log(`(--file) reading brain dump from ${bdFile}`);
  }

  if (brainDump && brainDump.trim()) {
    appendRound(bdFile, brainDump, { scope: 'project' });
    console.log(`Appended round to ${bdFile}`);
  }

  let proposed;
  if (hasContent(bdFile)) {
    // Branches 1/2: fresh input just appended above, or input already sitting in the file
    // from a prior round/hand-edit — either way, re-derive features.md from the file's
    // full current content.
    const history = readOrEmpty(bdFile);
    console.log(`Asking Claude to derive a feature list from SRS/brain-dump.md...\n`);
    proposed = await proposeFeatures(history);
  } else {
    // Branch 3: nothing written yet — fall back to scanning existing code, if any.
    proposed = await deriveFeaturesFromCode(root);
    if (!proposed) {
      // Branch 4: no input, no code — ask rather than guess.
      const { input } = await prompts({
        type: 'text',
        name: 'input',
        message: 'SRS/brain-dump.md is empty and no code exists yet — describe your project:',
      });
      if (!input || !input.trim()) {
        throw new Error(`Usage: journal draft-features "<free-form description of your project>" (or write directly into ${bdFile} and re-run with --file)`);
      }
      appendRound(bdFile, input, { scope: 'project' });
      console.log(`Asking Claude to derive a feature list from your description...\n`);
      proposed = await proposeFeatures(input);
    }
  }

  fs.writeFileSync(featuresFile, renderFeaturesMd(proposed), 'utf8');

  const relPaths = [path.relative(root, bdFile), path.relative(root, featuresFile)];
  const sha = stageAndCommit(relPaths, 'chore(journal): draft features');

  console.log(`\nProposed ${proposed.length} feature(s), written to ${featuresFile}. Committed ${sha.slice(0, 12)}.`);
  console.log(`Review/edit it (rename, reword, merge, split, or delete an entry), then: journal commit-features`);
}
