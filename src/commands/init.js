import fs from 'node:fs';
import path from 'node:path';
import { findProjectRoot, ledgerRoot, indexFile, configFile, styleFile, architectureFile, LEDGER_DIRNAME } from '../lib/paths.js';
import { createEmptyIndex, saveIndex } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';
import { saveConfig, DEFAULT_PROVIDER } from '../lib/ai-providers/provider.js';

const STYLE_STUB = `# Global style & testing preferences

Read by \`ledger draft code\` and \`ledger draft test\` every time they run. Edit any time —
changes apply to future drafts. A one-off override for a single call is a flag on that call,
not a change here.

## Code style

<!-- e.g. "Prefer simple, explicit statements over clever one-liners." -->

## Testing

<!-- e.g. "Python: use pytest." Only needs to cover kinds of code actually being
     automated-tested — features that are entirely manual/visual don't need an entry. -->
`;

const ARCHITECTURE_STUB = `# Architecture

Project-wide system shape — major components, how they relate, key structural decisions. Read
by \`ledger draft logic\` as background context, so an individual feature's Logic stays
consistent with the bigger picture without restating it. Freeform — a starting scaffold, not a
schema; discard sections that don't apply.

## Components

<!-- e.g. "API server (Express) talks to Postgres via a repository layer; a separate worker
     process consumes a queue for async jobs." -->

## Data flow

<!-- e.g. "Requests hit the API layer, which validates and delegates to services; services own
     business logic and talk to repositories; repositories are the only layer touching the DB." -->

## Key decisions

<!-- e.g. "Chose optimistic locking over pessimistic for the bookings table because writes are
     rare relative to reads." -->
`;

export async function init() {
  const root = findProjectRoot();
  const ledger = ledgerRoot();

  if (fs.existsSync(indexFile())) {
    console.log(`${LEDGER_DIRNAME}/ already initialized at ${ledger}.`);
    return;
  }

  fs.mkdirSync(path.join(ledger, 'features'), { recursive: true });
  fs.writeFileSync(styleFile(), STYLE_STUB, 'utf8');
  fs.writeFileSync(architectureFile(), ARCHITECTURE_STUB, 'utf8');

  saveIndex(createEmptyIndex());
  saveConfig({ aiProvider: DEFAULT_PROVIDER, testCommand: null });

  const relPaths = [
    path.relative(root, indexFile()),
    path.relative(root, configFile()),
    path.relative(root, styleFile()),
    path.relative(root, architectureFile()),
  ];

  const sha = stageAndCommit(relPaths, 'chore(ledger): initialize LEDGER');
  console.log(`Initialized ${LEDGER_DIRNAME}/ at ${ledger}`);
  console.log(`Committed ${sha.slice(0, 12)}`);
  console.log(`\nNext: ledger list-features "<brain dump of your project>"`);
  console.log(`(or, for an existing codebase: ledger ledger-init)`);
}
