import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { findProjectRoot, stepFile, fixPlanFile, fragmentFile } from '../lib/paths.js';
import { loadFeature, saveFeature } from '../lib/index-store.js';
import { readStepFile } from '../lib/frontmatter.js';
import { getLastAiModel } from '../lib/ai-providers/provider.js';
import { stageAndCommit } from '../lib/git.js';
import { draftFixPlan } from '../lib/ai.js';
import { findErrorTarget, roundsForError, planHistoryForError } from '../lib/fixPlan.js';

function gitUserName(root) {
  try {
    return execFileSync('git', ['config', 'user.name'], { cwd: root, encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

export async function fixError(feature, steps, opts = {}) {
  const entry = loadFeature(feature);
  const target = findErrorTarget(entry, opts);

  const root = findProjectRoot();
  const file = fixPlanFile(feature);
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';

  if (opts.file) {
    const priorHistory = planHistoryForError(existing, target.id);
    if (!priorHistory.trim()) {
      throw new Error(`--file given but no existing plan for error #${target.id} in ${file} yet — write into it first, or drop --file to let AI propose one.`);
    }
    steps = null;
    console.log(`(--file) reading fix steps for error #${target.id} from ${file}`);
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

  const ownSteps = opts.file ? planHistoryForError(existing, target.id) : steps;
  console.log(
    ownSteps && ownSteps.trim()
      ? `Asking Claude to organize your fix steps for error #${target.id} on "${feature}"...\n`
      : `Asking Claude to diagnose error #${target.id} on "${feature}" and propose fix steps...\n`
  );
  const plan = await draftFixPlan(feature, { errorText: target.description, logicText, codeContext, ownSteps });

  const hasOwnSteps = Boolean(steps && steps.trim()) || opts.file;
  const attribution = hasOwnSteps ? 'person' : 'ai';
  const identity = attribution === 'person' ? gitUserName(root) : getLastAiModel();

  const nextRound = (() => {
    const rounds = roundsForError(existing, target.id);
    return rounds.length ? Math.max(...rounds) + 1 : 1;
  })();

  const header = existing.trim() ? '' : `# Fix plans — ${feature}\n\n`;
  const block = [`## Plan for Error #${target.id} — Round ${nextRound} (${new Date().toISOString()}, ${attribution}${identity ? ` · ${identity}` : ''})`, '', plan, ''].join('\n');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, header + existing + block, 'utf8');

  target.fixPlanAttribution = attribution;
  target.fixPlanIdentity = identity;
  saveFeature(feature, entry);

  const sha = stageAndCommit(
    [path.relative(root, file), path.relative(root, fragmentFile(feature))],
    `chore(journal): fix-plan round for error #${target.id} on ${feature}`
  );

  console.log(`\n${plan}\n`);
  console.log(`Appended to ${file} (${attribution}${identity ? ` · ${identity}` : ''}). Committed ${sha.slice(0, 12)}.`);
  console.log(`Review/edit the plan if needed, then: journal apply-fix ${feature} --id ${target.id}`);
}
