import fs from 'node:fs';
import path from 'node:path';
import prompts from 'prompts';
import { findProjectRoot, stepFile, stepDir } from '../lib/paths.js';
import { loadIndex, saveIndex, getFeature, getCurrentColumn } from '../lib/index-store.js';
import { indexFile } from '../lib/paths.js';
import { stageAndCommit } from '../lib/git.js';
import { readStepFile, writeStepFile } from '../lib/frontmatter.js';

const VALID_ATTRIBUTIONS = ['person', 'ai', 'person+ai'];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

async function resolveAttribution(opts) {
  if (opts.attribution) {
    if (!VALID_ATTRIBUTIONS.includes(opts.attribution)) {
      throw new Error(`--attribution must be one of: ${VALID_ATTRIBUTIONS.join(', ')}`);
    }
    return opts.attribution;
  }
  const { attribution } = await prompts({
    type: 'select',
    name: 'attribution',
    message: 'Who did this step?',
    choices: [
      { title: 'Person', value: 'person' },
      { title: 'AI', value: 'ai' },
      { title: 'Person + AI (collaborated)', value: 'person+ai' },
    ],
  });
  if (!attribution) throw new Error('Cancelled — no attribution given.');
  return attribution;
}

async function resolveCodePaths(entry, root, opts) {
  let paths = entry.codePaths || [];
  if (opts.addPath && opts.addPath.length > 0) {
    paths = Array.from(new Set([...paths, ...opts.addPath]));
  }
  if (paths.length === 0) {
    const { input } = await prompts({
      type: 'text',
      name: 'input',
      message:
        'No code paths linked to this feature yet. Which file(s)/dir(s) belong to it? ' +
        '(comma-separated, relative to project root, e.g. "src/auth/, src/middleware/session.js")',
    });
    if (!input) throw new Error('Cancelled — commit-code requires at least one linked path.');
    paths = input.split(',').map((s) => s.trim()).filter(Boolean);
  }
  for (const p of paths) {
    if (!fs.existsSync(path.join(root, p))) {
      throw new Error(`Linked code path "${p}" does not exist relative to project root.`);
    }
  }
  entry.codePaths = paths;
  return paths;
}

function syncCodeSnapshot(feature, root, codePaths) {
  const codeDir = stepDir(feature, 'code');
  const keep = path.basename(stepFile(feature, 'code')); // code.md holds this step's frontmatter — not part of the snapshot
  fs.mkdirSync(codeDir, { recursive: true });
  for (const entry of fs.readdirSync(codeDir)) {
    if (entry === keep) continue;
    fs.rmSync(path.join(codeDir, entry), { recursive: true, force: true });
  }
  const snapshotRelPaths = [];
  for (const relPath of codePaths) {
    const src = path.join(root, relPath);
    const dest = path.join(codeDir, relPath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(src, dest, { recursive: true });
    snapshotRelPaths.push(path.relative(root, dest));
  }
  return snapshotRelPaths;
}

function collectFilesUnder(root, absDir, out = []) {
  if (!fs.existsSync(absDir)) return out;
  const stat = fs.statSync(absDir);
  if (stat.isFile()) {
    out.push(path.relative(root, absDir));
    return out;
  }
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    collectFilesUnder(root, path.join(absDir, entry.name), out);
  }
  return out;
}

export async function commitStep(step, feature, opts = {}) {
  const root = findProjectRoot();
  const index = loadIndex();
  const entry = getFeature(index, feature);

  if (!entry.steps || !entry.steps.includes(step)) {
    throw new Error(
      `Feature "${feature}" has no "${step}" step in its locked pipeline (steps: ${
        entry.steps ? entry.steps.join(', ') : 'none locked yet'
      }).`
    );
  }

  const file = stepFile(feature, step);
  if (!fs.existsSync(file)) {
    throw new Error(`${file} does not exist. Run \`ledger list-steps ${feature}\` first.`);
  }

  const column = getCurrentColumn(entry);
  const attribution = await resolveAttribution(opts);

  const contentRelPaths = [path.relative(root, file)];

  if (step === 'code') {
    const codePaths = await resolveCodePaths(entry, root, opts);
    const snapshotRelPaths = syncCodeSnapshot(feature, root, codePaths);
    contentRelPaths.push(...snapshotRelPaths);
    for (const relPath of codePaths) {
      contentRelPaths.push(...collectFilesUnder(root, path.join(root, relPath)));
    }
  }

  const date = todayIso();
  const parsed = readStepFile(file);
  writeStepFile(file, { ...parsed.data, attribution, column: column.column, date, commit_sha: null }, parsed.content);

  // Phase 1: commit the real content (step file, code snapshot, real src).
  const dedupedContentPaths = Array.from(new Set(contentRelPaths));
  const contentSha = stageAndCommit(
    dedupedContentPaths,
    `${feature}: commit-${step} (column ${column.column}, ${attribution})`
  );

  // Phase 2: record the resulting SHA into the step file's frontmatter and index.json,
  // as a single atomic commit. If this fails, the content commit above still stands —
  // fail loudly rather than silently leaving the index out of sync.
  try {
    const afterContent = readStepFile(file);
    writeStepFile(file, { ...afterContent.data, commit_sha: contentSha }, afterContent.content);

    column.steps[step] = { attribution, commitSha: contentSha, date };
    saveIndex(index);

    const recordRelPaths = [path.relative(root, file), path.relative(root, indexFile())];
    const recordSha = stageAndCommit(
      recordRelPaths,
      `chore(ledger): record ${feature} ${step} column ${column.column} SHA (${contentSha.slice(0, 12)})`
    );

    console.log(`Committed ${step} for "${feature}": ${contentSha.slice(0, 12)}`);
    console.log(`Recorded in LEDGER/index.json: ${recordSha.slice(0, 12)}`);
  } catch (err) {
    console.error(
      `\nCONTENT WAS COMMITTED (${contentSha}) but recording it into LEDGER/index.json failed:\n` +
        `  ${err.message}\n\n` +
        `The dashboard will be out of sync until this is fixed. Options:\n` +
        `  - Fix whatever failed and re-run \`ledger commit-${step} ${feature} --attribution ${attribution}\`\n` +
        `    (it will safely re-record over the same column since the step file's own SHA field is what's stale)\n` +
        `  - Or manually edit LEDGER/index.json and commit it yourself.`
    );
    throw err;
  }
}
