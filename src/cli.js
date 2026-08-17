import { Command } from 'commander';
import { init } from './commands/init.js';
import { listFeatures } from './commands/listFeatures.js';
import { listSteps } from './commands/listSteps.js';
import { draftLogic } from './commands/draftLogic.js';
import { commitStep } from './commands/commitStep.js';
import { newColumn } from './commands/newColumn.js';
import { logError } from './commands/logError.js';
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
    .name('ledger')
    .description('CLI for the Ledger Method — a structured, attribution-tracked, AI-assisted development workflow.')
    .version('0.1.0');

  program
    .command('init')
    .description('Scaffold the LEDGER/ folder in the current git repository')
    .action(run(init));

  program
    .command('list-features <brainDump>')
    .description('Propose a feature list from a free-form project description (AI-assisted, human confirms)')
    .action(run(listFeatures));

  program
    .command('list-steps <feature>')
    .description('Propose (and lock in) a step pipeline for a feature (AI-assisted, human confirms)')
    .option('-d, --description <text>', 'description to use if the feature is not already registered')
    .action(run((feature, opts) => listSteps(feature, opts)));

  program
    .command('draft-logic <feature>')
    .description('AI drafts a starting point for the Logic step — review and edit before committing')
    .action(run(draftLogic));

  for (const step of ['logic', 'code', 'test', 'document']) {
    program
      .command(`commit-${step} <feature>`)
      .description(`Record attribution, commit the ${step} step, and record its SHA into LEDGER/index.json`)
      .option('-a, --attribution <value>', 'person | ai | person+ai')
      .option('--add-path <path>', 'link an additional code path (commit-code only, repeatable)', collect, [])
      .action(run((feature, opts) => commitStep(step, feature, opts)));
  }

  program
    .command('commit <feature> <step>')
    .description('Generic form of commit-<step>, for custom steps outside logic/code/test/document')
    .option('-a, --attribution <value>', 'person | ai | person+ai')
    .option('--add-path <path>', 'link an additional code path (step "code" only, repeatable)', collect, [])
    .action(run((feature, step, opts) => commitStep(step, feature, opts)));

  program
    .command('new-column <feature>')
    .description("Start a new revision pass for a feature — resets working files for its steps")
    .action(run(newColumn));

  program
    .command('log-error <feature>')
    .description('Append an entry to the feature\'s Errors log')
    .option('-e, --error <text>', 'the error/output that occurred')
    .option('-r, --resolution <text>', 'how it was resolved')
    .action(run((feature, opts) => logError(feature, opts)));

  program
    .command('build-dashboard')
    .description('Regenerate LEDGER/index.html from LEDGER/index.json')
    .action(run(buildDashboard));

  return program;
}
