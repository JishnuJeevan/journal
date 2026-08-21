import { Command } from 'commander';
import { init } from './commands/init.js';
import { journalInit } from './commands/journalInit.js';
import { draftFeatures } from './commands/draftFeatures.js';
import { commitFeatures } from './commands/commitFeatures.js';
import { addFeature } from './commands/addFeature.js';
import { setGroup } from './commands/setGroup.js';
import { renameGroup } from './commands/renameGroup.js';
import { removeFeature } from './commands/removeFeature.js';
import { listSteps } from './commands/listSteps.js';
import { addStep } from './commands/addStep.js';
import { draftStep } from './commands/draftStep.js';
import { commitStep } from './commands/commitStep.js';
import { newVersion } from './commands/newVersion.js';
import { logError } from './commands/logError.js';
import { resolveError } from './commands/resolveError.js';
import { fixError } from './commands/fixError.js';
import { applyFix } from './commands/applyFix.js';
import { buildDashboard } from './commands/buildDashboard.js';

function collect(value, previous) {
  return [...previous, value];
}

function run(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(`\nError: ${err.message}`);
      process.exitCode = 1;
    }
  };
}

export function buildProgram() {
  const program = new Command();
  program
    .name('journal')
    .description('CLI for JOURNAL — a structured, attribution-tracked, AI-assisted development workflow.')
    .version('0.1.0');

  program
    .command('init')
    .description('Scaffold the JOURNAL/ folder in the current git repository')
    .action(run(init));

  program
    .command('journal-init')
    .description('One-time bootstrap for an existing codebase: proposes features + pipelines from tracked files, snapshots Code with attribution "legacy"')
    .action(run(journalInit));

  program
    .command('draft-features [brainDump]')
    .description('SRS-driven feature discovery (§9.2, replaces list-features): appends to JOURNAL/SRS/brain-dump.md and (re)derives JOURNAL/SRS/features.md from it, or scans existing tracked code if the brain dump is still empty. Ordered simplest-to-hardest; features start ungrouped — use set-group after commit-features.')
    .option('--file', 'read the brain dump from JOURNAL/SRS/brain-dump.md directly instead of an inline description')
    .action(run((brainDump, opts) => draftFeatures(brainDump, opts)));

  program
    .command('commit-features')
    .description('Reviews JOURNAL/SRS/features.md and registers every newly-listed feature. Never auto-removes a previously-tracked feature — flags a mismatch instead.')
    .action(run(commitFeatures));

  program
    .command('add-feature <name> [description]')
    .description('Register a single feature before any code is written for it')
    .option('-g, --group <name>', 'group tag for this feature')
    .action(run((name, description, opts) => addFeature(name, description, opts)));

  program
    .command('set-group <args...>')
    .description('Assign or clear the group tag for one or more features: <feature...> [<group-name>] — omit the group name to clear')
    .action(run((args) => setGroup(args)));

  program
    .command('rename-group <oldName> [newName]')
    .description('Retag every feature currently tagged <oldName> to <newName> — omit <newName> to ungroup them instead')
    .action(run(renameGroup));

  program
    .command('remove-feature <feature>')
    .description('Mark a feature removed (hidden by default in the dashboard) — does not delete its JOURNAL history')
    .action(run(removeFeature));

  program
    .command('list-steps <feature>')
    .description('Propose (and lock in) a step pipeline for a feature (AI-assisted, human confirms)')
    .option('-d, --description <text>', 'description to use if the feature is not already registered')
    .action(run((feature, opts) => listSteps(feature, opts)));

  program
    .command('add-step <feature> <stepName>')
    .description('Register an additional step for a feature already underway (no content generated yet)')
    .action(run(addStep));

  program
    .command('draft <step> <feature> [description]')
    .description('AI drafts (or organizes your own notes into) content for a step — review and edit before committing')
    .option('--file', 'read from brain-dump.md/sketch.md directly instead of an inline description (for large input)')
    .action(run((step, feature, description, opts) => draftStep(step, feature, description, opts)));

  program
    .command('commit <step> <feature>')
    .description('Record attribution + identity (auto-detected), commit the step, and record it into JOURNAL/index-fragments/<feature>.json')
    .option('--add-path <path>', 'link an additional code path (step "code" only, repeatable)', collect, [])
    .action(run((step, feature, opts) => commitStep(step, feature, opts)));

  program
    .command('new-version <feature>')
    .description('Start a new revision pass for a feature — archives brain-dump/sketch/outline history and resets working files for its steps')
    .action(run(newVersion));

  program
    .command('log-error <feature> [errorOutput] [description]')
    .description("Append an open entry to the feature's Errors log — raw error/terminal output, and/or your own description of what happened. Pipe output in to fill errorOutput automatically.")
    .action(run(logError));

  program
    .command('fix-error <feature> [steps]')
    .description("Organize-not-invent, same pattern as draft: give your own fix steps (attribution person) or leave blank for an AI-proposed diagnosis + fix steps (attribution ai). Appends a round to errors/fix-plan.md, cross-referenced by error id. Never edits code. Defaults to the most recent open error.")
    .option('--id <n>', 'target a specific error entry by id')
    .option('--file', 'read the fix steps from errors/fix-plan.md directly instead of an inline description')
    .action(run((feature, steps, opts) => fixError(feature, steps, opts)));

  program
    .command('apply-fix <feature>')
    .description("Reads the current fix-plan and writes the actual code fix — the only place AI is allowed to write an error fix, and only because a reviewed plan already exists.")
    .option('--id <n>', 'apply a specific error entry\'s plan by id')
    .action(run((feature, opts) => applyFix(feature, opts)));

  program
    .command('resolve-error <feature> [fixNote]')
    .description('Verification checkpoint — confirms a fix actually works and marks the entry resolved (or a specific one via --id). Attribution is inherited from the fix-plan\'s origin (§4.6), not declared here.')
    .option('--id <n>', 'resolve a specific error entry by id')
    .action(run((feature, fixNote, opts) => resolveError(feature, fixNote, opts)));

  program
    .command('build-dashboard')
    .description('Aggregate JOURNAL/index-fragments/*.json into JOURNAL/index.json and regenerate JOURNAL/index.html')
    .action(run(buildDashboard));

  return program;
}
