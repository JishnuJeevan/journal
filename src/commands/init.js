import fs from 'node:fs';
import path from 'node:path';
import { findProjectRoot, ledgerRoot, indexFile, LEDGER_DIRNAME } from '../lib/paths.js';
import { createEmptyIndex, saveIndex } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';

export async function init() {
  const root = findProjectRoot();
  const ledger = ledgerRoot();

  if (fs.existsSync(indexFile())) {
    console.log(`${LEDGER_DIRNAME}/ already initialized at ${ledger}.`);
    return;
  }

  fs.mkdirSync(path.join(ledger, 'features'), { recursive: true });
  fs.mkdirSync(path.join(ledger, 'Errors'), { recursive: true });
  fs.writeFileSync(path.join(ledger, 'Errors', '.gitkeep'), '');

  saveIndex(createEmptyIndex());

  const relPaths = [
    path.relative(root, indexFile()),
    path.relative(root, path.join(ledger, 'Errors', '.gitkeep')),
  ];

  const sha = stageAndCommit(relPaths, 'chore(ledger): initialize LEDGER');
  console.log(`Initialized ${LEDGER_DIRNAME}/ at ${ledger}`);
  console.log(`Committed ${sha.slice(0, 12)}`);
  console.log(`\nNext: ledger list-features "<brain dump of your project>"`);
}
