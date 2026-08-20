import { Command } from 'commander';
import { init } from './commands/init.js';
import { journalInit } from './commands/journalInit.js';
import { listFeatures } from './commands/listFeatures.js';
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
    .command('list-features <brainDump>')
    .description('Propose a feature list from a free-form project description (AI-assisted, human confirms). Ordered simplest-to-hardest; features start ungrouped — use set-group afterward.')
    .action(run(listFeatures));

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
    .command('fix-error <feature>')
    .description("Diagnose a logged error (Logic + code as context) and append the diagnosis to errors/diagnosis.md — read-only, never edits code. Defaults to the most recent open error.")
    .option('--id <n>', 'diagnose a specific error entry by id')
    .action(run((feature, opts) => fixError(feature, opts)));

  program
    .command('resolve-error <feature> [fixNote]')
    .description('Mark the most recent open error resolved (or a specific one via --id)')
    .option('--id <n>', 'resolve a specific error entry by id')
    .option('--agent', 'mark attribution as ai (invoked autonomously by an agent)')
    .action(run((feature, fixNote, opts) => resolveError(feature, fixNote, opts)));

  program
    .command('build-dashboard')
    .description('Aggregate JOURNAL/index-fragments/*.json into JOURNAL/index.json and regenerate JOURNAL/index.html')
    .action(run(buildDashboard));

  return program;
}
