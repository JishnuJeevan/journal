import fs from 'node:fs';
import path from 'node:path';
import {
  findProjectRoot, journalRoot, fragmentsDir, configFile, srsDir, srsBrainDumpFile,
  styleFile, architectureFile, JOURNAL_DIRNAME,
} from '../lib/paths.js';
import { stageAndCommit } from '../lib/git.js';
import { ensureRoundFile } from '../lib/templates.js';
import { saveConfig, DEFAULT_PROVIDER } from '../lib/ai-providers/provider.js';
import { buildDashboard } from './buildDashboard.js';

const STYLE_STUB = `# Global style & testing preferences

Read by \`journal draft code\` and \`journal draft test\` every time they run. Edit any time —
changes apply to future drafts. A one-off override for a single call is a flag on that call,
not a change here.

## Code style

<!-- e.g. "Prefer simple, explicit statements over clever one-liners." -->

## Testing

<!-- e.g. "Python: use pytest." Only needs to cover kinds of code actually being
     automated-tested — features that are entirely manual/visual don't need an entry. -->

<!-- Per-component override (§7): most projects only need the global rules above. If a
     specific component genuinely needs its own style guidance, add a "## <group-name>" section
     here (matching a feature's group tag) — draft code/draft test reads the global rules plus
     that section for features tagged with that group. e.g.:

## backend

- Prefer explicit error returns over exceptions.
-->
`;

const ARCHITECTURE_STUB = `# Architecture

Project-wide system shape — major components, how they relate, key structural decisions. Read
by \`journal draft logic\` as background context, so an individual feature's Logic stays
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

<!-- Per-component override (§7): a "## <group-name>" section here (matching a feature's group
     tag) is read alongside the global sections above, for features tagged with that group. -->
`;

export async function init() {
  const root = findProjectRoot();
  const journal = journalRoot();

  if (fs.existsSync(styleFile())) {
    console.log(`${JOURNAL_DIRNAME}/ already initialized at ${journal}.`);
    return;
  }

  fs.mkdirSync(path.join(journal, 'features'), { recursive: true });
  fs.mkdirSync(fragmentsDir(), { recursive: true });
  fs.mkdirSync(srsDir(), { recursive: true });
  fs.writeFileSync(styleFile(), STYLE_STUB, 'utf8');
  fs.writeFileSync(architectureFile(), ARCHITECTURE_STUB, 'utf8');
  ensureRoundFile(srsBrainDumpFile(), { scope: 'project', version: null });

  saveConfig({ aiProvider: DEFAULT_PROVIDER, testCommand: null, aiModel: null });

  const relPaths = [
    path.relative(root, configFile()),
    path.relative(root, styleFile()),
    path.relative(root, architectureFile()),
    path.relative(root, srsBrainDumpFile()),
  ];

  const sha = stageAndCommit(relPaths, 'chore(journal): initialize JOURNAL');
  console.log(`Initialized ${JOURNAL_DIRNAME}/ at ${journal}`);
  console.log(`Committed ${sha.slice(0, 12)}`);

  await buildDashboard();

  console.log(`\nNext: journal draft-features "<brain dump of your project>"`);
  console.log(`(or, for an existing codebase: journal journal-init)`);
}
