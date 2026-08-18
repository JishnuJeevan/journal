import fs from 'node:fs';
import path from 'node:path';
import { findProjectRoot, ledgerRoot, indexFile, configFile, styleFile, LEDGER_DIRNAME } from '../lib/paths.js';
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

export async function init() {
  const root = findProjectRoot();
  const ledger = ledgerRoot();

  if (fs.existsSync(indexFile())) {
    console.log(`${LEDGER_DIRNAME}/ already initialized at ${ledger}.`);
    return;
  }

  fs.mkdirSync(path.join(ledger, 'features'), { recursive: true });
  fs.writeFileSync(styleFile(), STYLE_STUB, 'utf8');

  saveIndex(createEmptyIndex());
  saveConfig({ aiProvider: DEFAULT_PROVIDER, testCommand: null });

  const relPaths = [
    path.relative(root, indexFile()),
    path.relative(root, configFile()),
    path.relative(root, styleFile()),
  ];

  const sha = stageAndCommit(relPaths, 'chore(ledger): initialize LEDGER');
  console.log(`Initialized ${LEDGER_DIRNAME}/ at ${ledger}`);
  console.log(`Committed ${sha.slice(0, 12)}`);
  console.log(`\nNext: ledger list-features "<brain dump of your project>"`);
  console.log(`(or, for an existing codebase: ledger ledger-init)`);
}
