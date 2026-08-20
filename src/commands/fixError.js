import fs from 'node:fs';
import path from 'node:path';
import { findProjectRoot, stepFile, diagnosisFile } from '../lib/paths.js';
import { loadFeature } from '../lib/index-store.js';
import { readStepFile } from '../lib/frontmatter.js';
import { stageAndCommit } from '../lib/git.js';
import { diagnoseError } from '../lib/ai.js';

/**
 * `fix-error <feature> [--id <n>]` — diagnosis only, never edits code (confirmed scope: no
 * autonomous or assisted-write mode). Reads the logged error (a specific one via --id, or the
 * most recent open one by default) plus the feature's committed Logic and code, and appends a
 * plain-language diagnosis to errors/diagnosis.md, cross-referenced by the same error number
 * used in errors.md. Never overwritten — same append-only pattern as errors.md/brain-dump.md.
 * The person reads it, writes the actual fix themselves, then runs `resolve-error` as before —
 * this command doesn't touch that flow at all.
 */
export async function fixError(feature, opts = {}) {
  const entry = loadFeature(feature);
  const errors = entry.errors || [];

  let target;
  if (opts.id) {
    target = errors.find((e) => e.id === Number(opts.id));
    if (!target) throw new Error(`No error #${opts.id} logged for "${feature}".`);
  } else {
    target = [...errors].reverse().find((e) => e.status === 'open');
    if (!target) throw new Error(`No open errors for "${feature}". Pass --id to diagnose a resolved one anyway.`);
  }

  const root = findProjectRoot();
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

  console.log(`Asking Claude to diagnose error #${target.id} for "${feature}"...\n`);
  const diagnosis = await diagnoseError(feature, { errorText: target.description, logicText, codeContext });

  const file = diagnosisFile(feature);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const header = fs.existsSync(file) && fs.statSync(file).size > 0 ? '' : `# Diagnoses — ${feature}\n\n`;
  const block = [`## Diagnosis for Error #${target.id} — ${new Date().toISOString()}`, '', diagnosis, '', '---', ''].join('\n');
  fs.appendFileSync(file, header + block);

  const sha = stageAndCommit(
    [path.relative(root, file)],
    `chore(ledger): diagnose error #${target.id} for ${feature}`
  );

  console.log(`\n${diagnosis}\n`);
  console.log(`Appended to ${file}. Committed ${sha.slice(0, 12)}.`);
  console.log(`Write the actual fix yourself, then: ledger resolve-error ${feature} "fix note" --id ${target.id}`);
}
