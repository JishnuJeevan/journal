import fs from 'node:fs';
import path from 'node:path';
import { findProjectRoot, stepFile, fixPlanFile } from '../lib/paths.js';
import { loadFeature } from '../lib/index-store.js';
import { readStepFile } from '../lib/frontmatter.js';
import { draftFixCode } from '../lib/ai.js';
import { assertSafeRelPath } from '../lib/safePath.js';
import { findErrorTarget, planHistoryForError } from '../lib/fixPlan.js';

/**
 * `apply-fix <feature> [--id <n>]` (§4.6) — reads whatever's currently in the fix plan and
 * writes the actual code. The only place AI is allowed to write an error fix, and only because
 * a reviewed plan (from `fix-error`) already exists behind it — same relationship as `draft
 * code` reading committed Logic, not autonomous fixing. Writes real files for review, same as
 * `draft code`; doesn't commit them itself — review/test, then `journal resolve-error` once
 * confirmed working, and commit the change through your normal git workflow.
 */
export async function applyFix(feature, opts = {}) {
  const entry = loadFeature(feature);
  const target = findErrorTarget(entry, opts);

  const root = findProjectRoot();
  const planFile = fixPlanFile(feature);
  const planContent = fs.existsSync(planFile) ? fs.readFileSync(planFile, 'utf8') : '';
  const fixPlanText = planHistoryForError(planContent, target.id);
  if (!fixPlanText.trim()) {
    throw new Error(`No fix plan recorded for error #${target.id} yet — run \`journal fix-error ${feature} --id ${target.id}\` first.`);
  }

  const logicFile = stepFile(feature, 'logic');
  const logicText = fs.existsSync(logicFile) ? readStepFile(logicFile).content.trim() : '';
  const codeContext = (entry.codePaths || [])
    .map((p) => {
      const abs = path.join(root, p);
      if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) return null;
      return `--- ${p} ---\n${fs.readFileSync(abs, 'utf8')}`;
    })
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 20000);

  console.log(`Asking Claude to implement the fix plan for error #${target.id} on "${feature}"...\n`);
  const { files, notes } = await draftFixCode(feature, { logicText, fixPlanText, codeContext });

  const writtenPaths = [];
  for (const f of files) {
    const rel = assertSafeRelPath(f.path);
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, f.content, 'utf8');
    writtenPaths.push(rel);
  }

  console.log(`Wrote ${writtenPaths.length} file(s):`);
  for (const p of writtenPaths) console.log(`  - ${p}`);
  if (notes) console.log(`Notes: ${notes}`);

  console.log(`\nReview and test the fix, then: journal resolve-error ${feature} "fix note" --id ${target.id}`);
  console.log(`(commit the code change itself through your normal git workflow — apply-fix only writes it)`);
}
