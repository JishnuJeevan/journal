import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export const LEDGER_DIRNAME = 'LEDGER';

export function findProjectRoot() {
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return root;
  } catch {
    throw new Error(
      'Not inside a git repository. The Ledger Method requires git — run `git init` first.'
    );
  }
}

export function ledgerRoot() {
  return path.join(findProjectRoot(), LEDGER_DIRNAME);
}

export function featureDir(feature) {
  return path.join(ledgerRoot(), 'features', feature);
}

export function stepDir(feature, step) {
  return path.join(featureDir(feature), step);
}

// Single-file steps (logic, document, any custom step) — code and test manage
// their own file set instead of one <step>.md (see stepDir tree in the spec).
export function stepFile(feature, step) {
  return path.join(stepDir(feature, step), `${step}.md`);
}

// Generic brain-dump file, reused by logic, document, and any custom step.
export function brainDumpFile(feature, step) {
  return path.join(stepDir(feature, step), 'brain-dump.md');
}

export function sketchFile(feature) {
  return path.join(stepDir(feature, 'code'), 'sketch.md');
}

export function codeAnnotationsFile(feature) {
  return path.join(stepDir(feature, 'code'), 'annotations.md');
}

export function testOutlineFile(feature) {
  return path.join(stepDir(feature, 'test'), 'test-outline.md');
}

export function testFile(feature) {
  return path.join(stepDir(feature, 'test'), 'test.md');
}

export function errorsFile(feature) {
  return path.join(featureDir(feature), 'errors', 'errors.md');
}

export function styleFile() {
  return path.join(ledgerRoot(), 'style.md');
}

export function indexFile() {
  return path.join(ledgerRoot(), 'index.json');
}

export function configFile() {
  return path.join(ledgerRoot(), 'config.json');
}

export function dashboardFile() {
  return path.join(ledgerRoot(), 'index.html');
}

export function requireLedgerInitialized() {
  if (!fs.existsSync(indexFile())) {
    throw new Error(
      `No ${LEDGER_DIRNAME}/index.json found. Run \`ledger init\` first.`
    );
  }
}
