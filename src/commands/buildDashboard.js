import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dashboardFile, ledgerRoot, stepFile, stepDir, testFile } from '../lib/paths.js';
import { loadIndex } from '../lib/index-store.js';
import { buildDashboardData } from '../lib/dashboard.js';

const TEMPLATE_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'lib', 'dashboard-template.html');

export async function buildDashboard() {
  const ledger = ledgerRoot();
  const index = loadIndex();

  const relFromLedger = (slug, step) => {
    let abs;
    if (step === 'code') abs = stepDir(slug, 'code');
    else if (step === 'test') abs = testFile(slug);
    else abs = stepFile(slug, step);
    return path.relative(ledger, abs);
  };

  const data = buildDashboardData(index, { relFromLedger, generatedAt: new Date().toISOString() });

  const template = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const html = template.replace('/*__LEDGER_DATA__*/', () => JSON.stringify(data));

  fs.writeFileSync(dashboardFile(), html, 'utf8');
  console.log(`Dashboard regenerated at ${dashboardFile()}`);
}
