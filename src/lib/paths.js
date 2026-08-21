import { execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

export const JOURNAL_DIRNAME = 'JOURNAL';

export function findProjectRoot() {
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return root;
  } catch {
    throw new Error(
      'Not inside a git repository. JOURNAL requires git — run `git init` first.'
    );
  }
}

export function journalRoot() {
  return path.join(findProjectRoot(), JOURNAL_DIRNAME);
}

export function featureDir(feature) {
  return path.join(journalRoot(), 'features', feature);
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

export function fixPlanFile(feature) {
  return path.join(featureDir(feature), 'errors', 'fix-plan.md');
}

export function srsDir() {
  return path.join(journalRoot(), 'SRS');
}

export function srsBrainDumpFile() {
  return path.join(srsDir(), 'brain-dump.md');
}

export function srsFeaturesFile() {
  return path.join(srsDir(), 'features.md');
}

export function styleFile() {
  return path.join(srsDir(), 'style.md');
}

export function architectureFile() {
  return path.join(srsDir(), 'architecture.md');
}

export function indexFile() {
  return path.join(journalRoot(), 'index.json');
}

export function fragmentsDir() {
  return path.join(journalRoot(), 'index-fragments');
}

export function fragmentFile(feature) {
  return path.join(fragmentsDir(), `${feature}.json`);
}

export function configFile() {
  return path.join(journalRoot(), 'config.json');
}

export function dashboardFile() {
  return path.join(journalRoot(), 'index.html');
}

export function requireJournalInitialized() {
  if (!fs.existsSync(styleFile())) {
    throw new Error(
      `${JOURNAL_DIRNAME}/ isn't initialized here. Run \`journal init\` first.`
    );
  }
}
