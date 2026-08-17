import fs from 'node:fs';
import path from 'node:path';
import { findProjectRoot, dashboardFile, stepFile, ledgerRoot } from '../lib/paths.js';
import { loadIndex } from '../lib/index-store.js';
import { show } from '../lib/git.js';
import { generateDashboardHtml } from '../lib/dashboard.js';

export async function buildDashboard() {
  const root = findProjectRoot();
  const ledger = ledgerRoot();
  const index = loadIndex();

  // Path relative to LEDGER/index.html, for clickable links to the live file.
  const linkPath = (feature, step) => path.relative(ledger, stepFile(feature, step));
  // Path relative to the repo root, matching what was staged in git commits — needed for `git show`.
  const gitPath = (feature, step) => path.relative(root, stepFile(feature, step));

  const showHistorical = (sha, relPath) => {
    try {
      return show(sha, relPath);
    } catch {
      return null;
    }
  };

  const html = generateDashboardHtml(index, {
    linkPath,
    gitPath,
    showHistorical,
    generatedAt: new Date().toISOString(),
  });

  const file = dashboardFile();
  fs.writeFileSync(file, html, 'utf8');
  console.log(`Dashboard regenerated at ${file}`);
}
