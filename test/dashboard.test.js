import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDashboardData } from '../src/lib/dashboard.js';
import { createEmptyIndex, newFeatureEntry } from '../src/lib/index-store.js';

test('a feature with no locked pipeline has pipelineSet: false and no steps', () => {
  const index = createEmptyIndex();
  index.features['thing'] = newFeatureEntry({ name: 'Thing', description: 'A thing.' });

  const data = buildDashboardData(index);
  const f = data.features.find((f) => f.slug === 'thing');

  assert.equal(f.pipelineSet, false);
  assert.deepEqual(f.steps, []);
});

test('transforms versions/steps into the template shape, with fileUrl only on the current version', () => {
  const index = createEmptyIndex();
  const entry = newFeatureEntry({ name: 'Auth', description: 'Login.', group: 'authentication' });
  entry.codePaths = ['src/auth'];
  entry.steps = ['logic', 'code'];
  entry.currentVersion = 2;
  entry.versions = [
    { version: 1, steps: { logic: { attribution: 'person', commitSha: 'abc123def456', date: '2026-08-10' } } },
    { version: 2, steps: { logic: { attribution: 'ai', commitSha: 'def456abc123', date: '2026-08-17' } } },
  ];
  index.features['auth'] = entry;

  // Mimics the real relFromLedger contract: only resolves a local file for the
  // current version (no per-version archive available in this test).
  const relFromLedger = (slug, step, version, isCurrent) => (isCurrent ? 'features/auth/logic/logic.md' : null);
  const data = buildDashboardData(index, { relFromLedger });
  const f = data.features.find((f) => f.slug === 'auth');

  assert.equal(f.group, 'authentication');
  assert.equal(f.pipelineSet, true);
  assert.equal(f.versions.length, 2);

  const v1 = f.versions.find((v) => v.version === 1);
  const v2 = f.versions.find((v) => v.version === 2);
  assert.equal(v1.current, false);
  assert.equal(v2.current, true);

  assert.equal(v1.stepData.logic.attribution, 'person');
  assert.equal(v1.stepData.logic.sha, 'abc123def456');
  assert.equal(v1.stepData.logic.fileUrl, null); // historical — no local link
  assert.equal(v1.stepData.logic.historicalHint, 'git show abc123def456:LEDGER/features/auth/logic/logic.md');

  assert.equal(v2.stepData.logic.attribution, 'ai');
  assert.equal(v2.stepData.logic.fileUrl, 'features/auth/logic/logic.md'); // current — linked
  assert.equal(v2.stepData.logic.historicalHint, null); // current — no hint needed

  assert.equal(v2.stepData.code.attribution, null); // registered step, no record yet
  assert.equal(v2.stepData.code.fileUrl, null);
});

test('carries identity, libraries, and dependsOn through to the template shape', () => {
  const index = createEmptyIndex();
  const entry = newFeatureEntry({ name: 'Auth', description: 'Login.' });
  entry.libraries = ['bcrypt', 'express-session'];
  entry.dependsOn = ['session-management'];
  entry.steps = ['logic'];
  entry.currentVersion = 1;
  entry.versions = [
    { version: 1, steps: { logic: { attribution: 'ai', identity: 'claude-sonnet-4-6', commitSha: 'abc123', date: '2026-08-17' } } },
  ];
  index.features['auth'] = entry;

  const data = buildDashboardData(index);
  const f = data.features.find((f) => f.slug === 'auth');

  assert.deepEqual(f.libraries, ['bcrypt', 'express-session']);
  assert.deepEqual(f.dependsOn, ['session-management']);
  assert.equal(f.versions[0].stepData.logic.identity, 'claude-sonnet-4-6');
});

test('orders features by their `order` field', () => {
  const index = createEmptyIndex();
  index.features['second'] = newFeatureEntry({ name: 'Second', description: '.', order: 1 });
  index.features['first'] = newFeatureEntry({ name: 'First', description: '.', order: 0 });

  const data = buildDashboardData(index);
  assert.deepEqual(data.features.map((f) => f.slug), ['first', 'second']);
});

test('carries errors through untouched, keyed by slug', () => {
  const index = createEmptyIndex();
  const entry = newFeatureEntry({ name: 'Auth', description: 'Login.' });
  entry.errors = [{ id: 1, status: 'open', loggedDate: '2026-08-17', description: 'boom', fixNote: null, resolvedDate: null, attribution: null }];
  index.features['auth'] = entry;

  const data = buildDashboardData(index);
  assert.deepEqual(data.features[0].errors, entry.errors);
});

test('carries removed through untouched', () => {
  const index = createEmptyIndex();
  const entry = newFeatureEntry({ name: 'Old', description: 'gone' });
  entry.removed = true;
  index.features['old'] = entry;

  const data = buildDashboardData(index);
  assert.equal(data.features[0].removed, true);
});
