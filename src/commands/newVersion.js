import fs from 'node:fs';
import path from 'node:path';
import {
  findProjectRoot, stepFile, brainDumpFile, sketchFile, testOutlineFile, testFile,
  stepDir, featureDir, fragmentFile,
} from '../lib/paths.js';
import { loadFeature, saveFeature } from '../lib/index-store.js';
import { stageAndCommit, isTracked, isTrackedDir } from '../lib/git.js';
import { writeStepFile } from '../lib/frontmatter.js';
import { defaultBodyForStep, newStepFrontmatter, archiveRoundFile, ensureRoundFile } from '../lib/templates.js';
import { buildDashboard } from './buildDashboard.js';

function stageRename(relPaths, root, oldAbs, newAbs) {
  const oldRel = path.relative(root, oldAbs);
  const newRel = path.relative(root, newAbs);
  if (isTracked(oldRel)) relPaths.push(oldRel); // records the deletion at the old path
  if (fs.existsSync(newAbs)) relPaths.push(newRel);
}

export async function newVersion(feature) {
  const root = findProjectRoot();
  const entry = loadFeature(feature);

  if (!entry.steps) {
    throw new Error(`Feature "${feature}" has no locked step pipeline yet — run \`ledger list-steps ${feature}\` first.`);
  }

  const oldVersionNum = entry.currentVersion;
  const newVersionNum = oldVersionNum + 1;
  entry.currentVersion = newVersionNum;
  entry.versions.push({ version: newVersionNum, steps: {} });

  const relPaths = [path.relative(root, fragmentFile(feature))];

  for (const step of entry.steps) {
    if (step === 'code' || step === 'test') continue; // handled below — no single working file
    const file = stepFile(feature, step);
    const fm = newStepFrontmatter({ feature, step, version: newVersionNum });
    writeStepFile(file, fm, defaultBodyForStep(step));
    relPaths.push(path.relative(root, file));

    // Archive the previous version's brain-dump.md rather than carrying it forward
    // or erasing it (feedback: a fresh brain-dump.md per version, not the old one's
    // rounds still sitting there) — "a ledger records a reversal, not an erasure"
    // (§9.3's principle, applied here too).
    const bdFile = brainDumpFile(feature, step);
    const archived = archiveRoundFile(bdFile, oldVersionNum);
    if (archived) stageRename(relPaths, root, bdFile, archived);
    ensureRoundFile(bdFile, { feature, step, version: newVersionNum });
    if (fs.existsSync(bdFile)) relPaths.push(path.relative(root, bdFile));
  }

  // Code: archive the whole previous-version code/ dir (snapshot + sketch.md history)
  // as a sibling `code-v<N>/` rather than deleting it — the real source in `src/` isn't
  // touched either way; this only affects LEDGER's own record of that version's snapshot.
  if (entry.steps.includes('code')) {
    const codeDir = stepDir(feature, 'code');
    if (fs.existsSync(codeDir) && fs.readdirSync(codeDir).length > 0) {
      const archiveDir = path.join(featureDir(feature), `code-v${oldVersionNum}`);
      fs.renameSync(codeDir, archiveDir);
      const oldRel = path.relative(root, codeDir);
      const newRel = path.relative(root, archiveDir);
      if (isTrackedDir(oldRel)) relPaths.push(oldRel);
      relPaths.push(newRel);
    }
    fs.mkdirSync(codeDir, { recursive: true });
    ensureRoundFile(sketchFile(feature), { feature, step: 'code', version: newVersionNum });
    relPaths.push(path.relative(root, sketchFile(feature)));
  }

  // Test: archive test-outline.md the same way as brain-dump.md; test.md (a generated
  // snapshot, not a round file) is just renamed aside if it has real content.
  if (entry.steps.includes('test')) {
    const outline = testOutlineFile(feature);
    const archivedOutline = archiveRoundFile(outline, oldVersionNum);
    if (archivedOutline) stageRename(relPaths, root, outline, archivedOutline);
    ensureRoundFile(outline, { feature, step: 'test', version: newVersionNum });
    relPaths.push(path.relative(root, outline));

    const t = testFile(feature);
    if (fs.existsSync(t) && fs.statSync(t).size > 0) {
      const archivedTest = t.replace(/(\.md)$/, `.v${oldVersionNum}$1`);
      fs.renameSync(t, archivedTest);
      stageRename(relPaths, root, t, archivedTest);
    }
  }

  saveFeature(feature, entry);

  const sha = stageAndCommit(
    Array.from(new Set(relPaths)),
    `chore(ledger): start version ${newVersionNum} for ${feature}`
  );

  console.log(`Started version ${newVersionNum} for "${feature}". Committed ${sha.slice(0, 12)}.`);
  console.log(`Previous version's content remains viewable via its recorded commit SHAs, and brain-dump/sketch/outline history is archived alongside the fresh files (e.g. brain-dump.v${oldVersionNum}.md).`);
  await buildDashboard();
}
