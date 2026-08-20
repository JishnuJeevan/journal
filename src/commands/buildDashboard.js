import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dashboardFile, journalRoot, stepFile, stepDir, testFile, featureDir, findProjectRoot, indexFile } from '../lib/paths.js';
import { aggregateIndex, writeAggregatedIndex } from '../lib/index-store.js';
import { buildDashboardData } from '../lib/dashboard.js';
import { stageAndCommitIfChanged } from '../lib/git.js';

const TEMPLATE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'dashboard-template.html');

export async function buildDashboard() {
  const journal = journalRoot();
  // §8.1: the only place fragments get aggregated into the generated index.json snapshot.
  const index = aggregateIndex();
  writeAggregatedIndex(index);

  const relFromJournal = (slug, step, version, isCurrent) => {
    if (isCurrent) {
      let abs;
      if (step === 'code') abs = stepDir(slug, 'code');
      else if (step === 'test') abs = testFile(slug);
      else abs = stepFile(slug, step);
      return path.relative(journal, abs);
    }
    // §6.3/newVersion: code and test archive their previous version's content locally
    // (code-v<N>/, test.v<N>.md) rather than only relying on git history — link to
    // that when it exists. logic/document/custom steps have no such local archive
    // (only their brain-dump.md is archived) — the dashboard falls back to a
    // `git show <sha>` hint for those (built in buildDashboardData).
    if (step === 'code') {
      const abs = path.join(featureDir(slug), `code-v${version}`);
      return fs.existsSync(abs) ? path.relative(journal, abs) : null;
    }
    if (step === 'test') {
      const abs = path.join(path.dirname(testFile(slug)), `test.v${version}.md`);
      return fs.existsSync(abs) ? path.relative(journal, abs) : null;
    }
    return null;
  };

  const data = buildDashboardData(index, { relFromJournal, generatedAt: new Date().toISOString() });

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const html = template.replace('/*__JOURNAL_DATA__*/', () => JSON.stringify(data));

  fs.writeFileSync(dashboardFile(), html, 'utf8');
  console.log(`Dashboard regenerated at ${dashboardFile()}`);

  // §6.4/§8.1: index.html and the aggregated index.json are generated artifacts that
  // still belong in git (spec's stated design) — commit them if this rebuild actually
  // changed them. Silent no-op when byte-identical, so this never errors on "nothing
  // to commit" when called after an operation that didn't touch dashboard-visible state.
  const root = findProjectRoot();
  const relPaths = [path.relative(root, dashboardFile()), path.relative(root, indexFile())];
  stageAndCommitIfChanged(relPaths, 'chore(journal): rebuild dashboard');
}
