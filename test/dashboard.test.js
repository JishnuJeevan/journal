import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDashboardHtml } from '../src/lib/dashboard.js';
import { createEmptyIndex } from '../src/lib/index-store.js';

test('renders a feature with no locked steps', () => {
  const index = createEmptyIndex();
  index.features['thing'] = { name: 'Thing', description: 'A thing.', steps: null };
  const html = generateDashboardHtml(index);
  assert.match(html, /Thing/);
  assert.match(html, /list-steps thing/);
});

test('renders attribution badges and current-column links', () => {
  const index = createEmptyIndex();
  index.features['auth'] = {
    name: 'Auth',
    description: 'Login.',
    steps: ['logic', 'code'],
    codePaths: ['src/auth'],
    currentColumn: 1,
    columns: [
      {
        column: 1,
        steps: {
          logic: { attribution: 'person', commitSha: 'abc123def456', date: '2026-08-17' },
        },
      },
    ],
  };
  const html = generateDashboardHtml(index, { linkPath: () => 'features/auth/logic/logic.md' });
  assert.match(html, /badge-person/);
  assert.match(html, /abc123def456/.test(html) ? /abc123def456/ : /abc123def4/);
  assert.match(html, /features\/auth\/logic\/logic\.md/);
  assert.match(html, /not set/); // code step has no record yet
});

test('escapes HTML in descriptions', () => {
  const index = createEmptyIndex();
  index.features['x'] = { name: '<script>alert(1)</script>', description: 'd', steps: null };
  const html = generateDashboardHtml(index);
  assert.ok(!html.includes('<script>alert'));
});
