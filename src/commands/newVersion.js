import fs from 'node:fs';
import path from 'node:path';
import { findProjectRoot, stepFile, testOutlineFile, stepDir, indexFile } from '../lib/paths.js';
import { loadIndex, saveIndex, getFeature } from '../lib/index-store.js';
import { stageAndCommit, isTracked } from '../lib/git.js';
import { writeStepFile } from '../lib/frontmatter.js';
import { defaultBodyForStep, newStepFrontmatter } from '../lib/templates.js';

export async function newVersion(feature) {
  const root = findProjectRoot();
  const index = loadIndex();
  const entry = getFeature(index, feature);

  if (!entry.steps) {
    throw new Error(`Feature "${feature}" has no locked step pipeline yet — run \`ledger list-steps ${feature}\` first.`);
  }

  const newVersionNum = entry.currentVersion + 1;
  entry.currentVersion = newVersionNum;
  entry.versions.push({ version: newVersionNum, steps: {} });

  const relPaths = [path.relative(root, indexFile())];
  for (const step of entry.steps) {
    if (step === 'code' || step === 'test') continue; // reset below — no single working file
    const file = stepFile(feature, step);
    const fm = newStepFrontmatter({ feature, step, version: newVersionNum });
    writeStepFile(file, fm, defaultBodyForStep(step));
    relPaths.push(path.relative(root, file));
  }

  // Reset code/test working state so the new version starts genuinely fresh — old
  // content stays reachable via the previous version's recorded commit SHAs. Stage
  // the resulting deletions too, or they'd sit uncommitted after this runs.
  if (entry.steps.includes('code')) {
    const codeDir = stepDir(feature, 'code');
    if (fs.existsSync(codeDir)) fs.rmSync(codeDir, { recursive: true, force: true });
    fs.mkdirSync(codeDir, { recursive: true });
    relPaths.push(path.relative(root, codeDir));
  }
  if (entry.steps.includes('test')) {
    const outline = testOutlineFile(feature);
    const outlineRel = path.relative(root, outline);
    if (fs.existsSync(outline)) {
      const wasTracked = isTracked(outlineRel);
      fs.rmSync(outline, { force: true });
      if (wasTracked) relPaths.push(outlineRel); // stage the deletion — only if git ever knew about it
    }
    const t = stepFile(feature, 'test');
    const tRel = path.relative(root, t);
    if (fs.existsSync(t)) {
      const wasTracked = isTracked(tRel);
      fs.rmSync(t, { force: true });
      if (wasTracked) relPaths.push(tRel);
    }
  }

  saveIndex(index);

  const sha = stageAndCommit(relPaths, `chore(ledger): start version ${newVersionNum} for ${feature}`);

  console.log(`Started version ${newVersionNum} for "${feature}". Committed ${sha.slice(0, 12)}.`);
  console.log(`Previous version's content remains viewable in the dashboard via its recorded SHAs.`);
}
