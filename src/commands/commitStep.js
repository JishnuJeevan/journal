import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import prompts from 'prompts';
import {
  findProjectRoot, stepFile, stepDir, brainDumpFile, sketchFile, codeAnnotationsFile,
  testOutlineFile, testFile, indexFile,
} from '../lib/paths.js';
import { loadIndex, saveIndex, getFeature, getCurrentVersion } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';
import { readStepFile, writeStepFile } from '../lib/frontmatter.js';
import { hasContent, appendNote } from '../lib/templates.js';
import { contentHash, hashOfFiles } from '../lib/hash.js';
import { loadConfig, saveConfig } from '../lib/ai-providers/provider.js';
import { checkLogicIntegrity } from '../lib/logicIntegrity.js';
import { buildDashboard } from './buildDashboard.js';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function requireStepInPipeline(entry, feature, step) {
  if (!entry.steps || !entry.steps.includes(step)) {
    throw new Error(
      `Feature "${feature}" has no "${step}" step in its pipeline (steps: ${entry.steps ? entry.steps.join(', ') : 'none locked yet'}).`
    );
  }
}

function computeAttribution(step, feature, version) {
  const record = version.steps[step] || {};
  switch (step) {
    case 'code':
      if (!record.generatedHash) return 'person'; // draft code never ran — fully hand-authored
      return hasContent(sketchFile(feature)) ? 'person' : 'ai';
    case 'test': {
      if (!record.outlineHash) return 'person';
      const outline = fs.existsSync(testOutlineFile(feature)) ? fs.readFileSync(testOutlineFile(feature), 'utf8') : '';
      return contentHash(outline) !== record.outlineHash ? 'person' : 'ai';
    }
    default:
      if (!record.drafted) return 'person'; // never drafted — fully hand-authored
      return hasContent(brainDumpFile(feature, step)) ? 'person' : 'ai';
  }
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
        'No code paths linked yet. Which file(s)/dir(s) belong to this feature? ' +
        '(comma-separated, relative to project root)',
    });
    if (!input) throw new Error('Cancelled — commit code requires at least one linked path.');
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
  const keep = new Set(['sketch.md', 'annotations.md']);
  fs.mkdirSync(codeDir, { recursive: true });
  for (const entry of fs.readdirSync(codeDir)) {
    if (keep.has(entry)) continue;
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

function relIfExists(root, absPath) {
  return fs.existsSync(absPath) ? path.relative(root, absPath) : null;
}

async function driftCheck({ upstreamFile, upstreamLabel }) {
  if (!process.stdin.isTTY) {
    console.log(`Skipped (non-interactive) — logged as possibly stale. (${upstreamLabel})`);
    return false;
  }
  const { answer } = await prompts({
    type: 'text',
    name: 'answer',
    message: `You edited this directly — what changed, in one sentence? (blank to skip)`,
  });
  if (answer && answer.trim()) {
    appendNote(upstreamFile, `Direct edit note (${todayIso()})`, answer);
    return true;
  }
  console.log(`Skipped — logged as possibly stale. (${upstreamLabel})`);
  return false;
}

export async function commitStep(step, feature, opts = {}) {
  const root = findProjectRoot();
  const index = loadIndex();
  const entry = getFeature(index, feature);
  requireStepInPipeline(entry, feature, step);
  checkLogicIntegrity(feature, entry);
  const version = getCurrentVersion(entry);

  if (version.steps[step]?.commitSha) {
    throw new Error(
      `"${step}" for "${feature}" is already committed for version ${version.version}. ` +
        `Run \`ledger new-version ${feature}\` to start a fresh revision.`
    );
  }

  const date = todayIso();
  let contentRelPaths = [];

  if (step === 'code') {
    if (!fs.existsSync(stepDir(feature, 'code'))) fs.mkdirSync(stepDir(feature, 'code'), { recursive: true });
    const codePaths = await resolveCodePaths(entry, root, opts);
    const snapshotRelPaths = syncCodeSnapshot(feature, root, codePaths);
    contentRelPaths.push(...snapshotRelPaths);
    for (const relPath of codePaths) {
      contentRelPaths.push(...collectFilesUnder(root, path.join(root, relPath)));
    }
    const ann = relIfExists(root, codeAnnotationsFile(feature));
    if (ann) contentRelPaths.push(ann);
    const sk = relIfExists(root, sketchFile(feature));
    if (sk) contentRelPaths.push(sk);
  } else if (step === 'test') {
    if (!version.steps.test?.generatedHash) {
      throw new Error(`No generated test content yet for "${feature}" — run \`ledger draft test ${feature}\` (both phases) first.`);
    }

    const config = loadConfig();
    let { testCommand } = config;
    if (!testCommand) {
      const { cmd } = await prompts({
        type: 'text',
        name: 'cmd',
        message: "How should I run this project's automated tests? (saved to LEDGER/config.json for future commit-test runs)",
      });
      if (!cmd || !cmd.trim()) throw new Error('Cancelled — commit test needs a test command to verify automated tests pass.');
      testCommand = cmd.trim();
      saveConfig({ ...config, testCommand });
    }

    console.log(`Running: ${testCommand}`);
    try {
      execSync(testCommand, { cwd: root, stdio: 'inherit' });
    } catch {
      throw new Error(`Automated tests failed ("${testCommand}") — fix them before committing test.`);
    }

    const tFile = testFile(feature);
    const tContent = fs.existsSync(tFile) ? fs.readFileSync(tFile, 'utf8') : '';
    const manualSection = tContent.split(/^## Manual/m)[1] || '';
    if (/-\s\[ \]/.test(manualSection)) {
      throw new Error(`Unchecked manual checklist items remain in ${tFile} — check them off (or remove them) before committing test.`);
    }

    contentRelPaths.push(path.relative(root, tFile));
    const realTestPath = version.steps.test.testFilePath;
    if (realTestPath && fs.existsSync(path.join(root, realTestPath))) {
      contentRelPaths.push(realTestPath);
    }
    const outline = relIfExists(root, testOutlineFile(feature));
    if (outline) contentRelPaths.push(outline);
  } else {
    const file = stepFile(feature, step);
    if (!fs.existsSync(file)) {
      throw new Error(`${file} does not exist. Run \`ledger list-steps ${feature}\` or \`ledger add-step ${feature} ${step}\` first.`);
    }
    contentRelPaths.push(path.relative(root, file));
    const bd = relIfExists(root, brainDumpFile(feature, step));
    if (bd) contentRelPaths.push(bd);
  }

  const attribution = computeAttribution(step, feature, version);

  // For single-file steps, stamp attribution/date into the file's own frontmatter too.
  if (step !== 'code' && step !== 'test') {
    const file = stepFile(feature, step);
    const parsed = readStepFile(file);
    writeStepFile(file, { ...parsed.data, attribution, version: version.version, date, commit_sha: null }, parsed.content);
  }

  const dedupedContentPaths = Array.from(new Set(contentRelPaths));
  const contentSha = stageAndCommit(
    dedupedContentPaths,
    `${feature}: commit ${step} (version ${version.version}, ${attribution})`
  );

  try {
    let committedHash;
    if (step !== 'code' && step !== 'test') {
      const file = stepFile(feature, step);
      const after = readStepFile(file);
      writeStepFile(file, { ...after.data, commit_sha: contentSha }, after.content);
      if (step === 'logic') committedHash = contentHash(fs.readFileSync(file, 'utf8'));
    }

    version.steps[step] = {
      ...(version.steps[step] || {}),
      attribution,
      commitSha: contentSha,
      date,
      ...(committedHash ? { committedHash } : {}),
    };
    saveIndex(index);

    const recordRelPaths = [path.relative(root, indexFile())];
    if (step !== 'code' && step !== 'test') recordRelPaths.push(path.relative(root, stepFile(feature, step)));
    const recordSha = stageAndCommit(
      recordRelPaths,
      `chore(ledger): record ${feature} ${step} version ${version.version} SHA (${contentSha.slice(0, 12)})`
    );

    console.log(`Committed ${step} for "${feature}" (${attribution}): ${contentSha.slice(0, 12)}`);
    console.log(`Recorded in LEDGER/index.json: ${recordSha.slice(0, 12)}`);
  } catch (err) {
    console.error(
      `\nCONTENT WAS COMMITTED (${contentSha}) but recording it into LEDGER/index.json failed:\n` +
        `  ${err.message}\n\n` +
        `The dashboard will be out of sync until this is fixed. Options:\n` +
        `  - Fix whatever failed and re-run \`ledger commit ${step} ${feature}\`\n` +
        `  - Or manually edit LEDGER/index.json and commit it yourself.`
    );
    throw err;
  }

  // Friction fix: never let the dashboard go stale after a commit. Runs before the
  // (optional, potentially-interactive) drift check below so it's never held up by it.
  try {
    await buildDashboard();
  } catch (err) {
    console.error(`Warning: commit succeeded but dashboard rebuild failed: ${err.message}`);
  }

  // Post-commit drift check (§6.5) — non-blocking, only for code/test.
  if (step === 'code' && version.steps.code.generatedPaths) {
    const currentHash = hashOfFiles(root, version.steps.code.generatedPaths);
    if (currentHash !== version.steps.code.generatedHash) {
      console.log(`\nNote: the committed code differs from what \`draft code\` last generated.`);
      const answered = await driftCheck({ upstreamFile: stepFile(feature, 'logic'), upstreamLabel: 'logic.md' });
      if (answered) {
        stageAndCommit(
          [path.relative(root, stepFile(feature, 'logic'))],
          `chore(ledger): drift note for ${feature} code edit`
        );
      }
    }
  } else if (step === 'test' && version.steps.test.generatedHash) {
    const currentHash = contentHash(fs.readFileSync(testFile(feature), 'utf8'));
    if (currentHash !== version.steps.test.generatedHash) {
      console.log(`\nNote: the committed test.md differs from what \`draft test\` last generated.`);
      const answered = await driftCheck({ upstreamFile: testOutlineFile(feature), upstreamLabel: 'test-outline.md' });
      if (answered) {
        stageAndCommit(
          [path.relative(root, testOutlineFile(feature))],
          `chore(ledger): drift note for ${feature} test edit`
        );
      }
    }
  }
}
