import test from 'node:test';
import assert from 'node:assert/strict';
import {
  proposeFeatures,
  proposeFeaturesFromCode,
  proposeSteps,
  draftLogic,
  draftCode,
  proposeTestOutline,
  draftTest,
  draftDocument,
  organizeStep,
  annotateCode,
} from '../src/lib/ai.js';
import { _setProviderForTesting } from '../src/lib/ai-providers/provider.js';

class StubProvider {
  constructor(response) {
    this.response = response;
    this.calls = [];
  }
  async generate(prompt, options) {
    this.calls.push({ prompt, options });
    return this.response;
  }
}

test('proposeFeatures requests structured output and returns the parsed array', async () => {
  const stub = new StubProvider([{ slug: 'auth', name: 'Auth', description: 'Login.', group: null }]);
  _setProviderForTesting(stub);

  const result = await proposeFeatures('a project with logins');

  assert.equal(stub.calls[0].options.structured, true);
  assert.match(stub.calls[0].options.system, /discrete\nfeatures/);
  assert.deepEqual(result, [{ slug: 'auth', name: 'Auth', description: 'Login.', group: null }]);
});

test('proposeFeatures rejects a non-array structured response', async () => {
  _setProviderForTesting(new StubProvider({ not: 'an array' }));
  await assert.rejects(() => proposeFeatures('x'), /Expected a JSON array/);
});

test('proposeFeaturesFromCode requests structured output and returns the parsed array', async () => {
  const stub = new StubProvider([{ slug: 'auth', name: 'Auth', description: 'Login.', group: null, codePaths: ['src/auth.js'] }]);
  _setProviderForTesting(stub);

  const result = await proposeFeaturesFromCode('src/auth.js\nsrc/index.js');

  assert.equal(stub.calls[0].options.structured, true);
  assert.match(stub.calls[0].options.system, /bootstrapping/);
  assert.deepEqual(result[0].codePaths, ['src/auth.js']);
});

test('proposeSteps requests structured output and returns steps + rationale', async () => {
  const stub = new StubProvider({ steps: ['logic', 'code', 'qa'], rationale: 'needs QA' });
  _setProviderForTesting(stub);

  const result = await proposeSteps('payments', 'handles money');

  assert.equal(stub.calls[0].options.structured, true);
  assert.match(stub.calls[0].prompt, /Feature: payments/);
  assert.deepEqual(result.steps, ['logic', 'code', 'qa']);
});

test('proposeSteps rejects a response with no steps array', async () => {
  _setProviderForTesting(new StubProvider({ rationale: 'oops' }));
  await assert.rejects(() => proposeSteps('x', 'y'), /Expected \{ steps/);
});

test('draftLogic requests plain text and trims it', async () => {
  const stub = new StubProvider('  Some draft logic text.  ');
  _setProviderForTesting(stub);

  const result = await draftLogic('auth', 'login flow');

  assert.equal(stub.calls[0].options.structured, false);
  assert.equal(result, 'Some draft logic text.');
});

test('draftLogic without a brain dump uses the improvise system prompt', async () => {
  const stub = new StubProvider('draft');
  _setProviderForTesting(stub);

  await draftLogic('auth', 'login flow');

  assert.match(stub.calls[0].options.system, /genuine, concrete attempt/);
  assert.doesNotMatch(stub.calls[0].prompt, /brain dump/);
});

test('draftLogic with a brain dump history grounds the draft in it', async () => {
  const stub = new StubProvider('draft');
  _setProviderForTesting(stub);

  await draftLogic('auth', 'login flow', '## Round 1\n\nusers log in with email + magic link');

  assert.match(stub.calls[0].options.system, /take THEIR reasoning/);
  assert.match(stub.calls[0].prompt, /Author's brain dump history:\n## Round 1/);
});

test('draftLogic includes the current draft for refinement when given', async () => {
  const stub = new StubProvider('draft');
  _setProviderForTesting(stub);

  await draftLogic('auth', 'login flow', '## Round 1\n\nnotes', 'Prior AI DRAFT logic text');

  assert.match(stub.calls[0].prompt, /Current logic\.md \(refine this/);
});

test('draftLogic includes architecture.md as background context when given', async () => {
  const stub = new StubProvider('draft');
  _setProviderForTesting(stub);

  await draftLogic('auth', 'login flow', null, null, 'API layer talks to Postgres via a repository layer.');

  assert.match(stub.calls[0].prompt, /Project architecture \(JOURNAL\/SRS\/architecture\.md, background context only\):\nAPI layer/);
  assert.match(stub.calls[0].options.system, /background context/);
});

test('draftLogic treats a whitespace-only brain dump as absent', async () => {
  const stub = new StubProvider('draft');
  _setProviderForTesting(stub);

  await draftLogic('auth', 'login flow', '   ');

  assert.match(stub.calls[0].options.system, /genuine, concrete attempt/);
});

test('draftCode requests structured output and validates the files array', async () => {
  const stub = new StubProvider({ files: [{ path: 'src/auth.js', content: 'code' }], notes: 'done' });
  _setProviderForTesting(stub);

  const result = await draftCode('auth', { logicText: 'logic text', styleText: 'use pytest', sketchHistory: '## Round 1\n\nsketch' });

  assert.equal(stub.calls[0].options.structured, true);
  assert.match(stub.calls[0].prompt, /Committed Logic:\nlogic text/);
  assert.match(stub.calls[0].prompt, /Style preferences/);
  assert.match(stub.calls[0].prompt, /Author's code sketch/);
  assert.deepEqual(result.files, [{ path: 'src/auth.js', content: 'code' }]);
});

test('draftCode rejects a response with no files array', async () => {
  _setProviderForTesting(new StubProvider({ notes: 'oops' }));
  await assert.rejects(() => draftCode('auth', {}), /Expected \{ files/);
});

test('proposeTestOutline requests structured output and validates both arrays', async () => {
  const stub = new StubProvider({ automatable: ['a'], manual: ['b'] });
  _setProviderForTesting(stub);

  const result = await proposeTestOutline('auth', 'logic text');

  assert.equal(stub.calls[0].options.structured, true);
  assert.deepEqual(result, { automatable: ['a'], manual: ['b'] });
});

test('proposeTestOutline rejects a malformed response', async () => {
  _setProviderForTesting(new StubProvider({ automatable: ['a'] }));
  await assert.rejects(() => proposeTestOutline('auth', 'x'), /Expected \{ automatable/);
});

test('draftTest requests structured output and validates the shape', async () => {
  const stub = new StubProvider({ testFilePath: 'tests/test_auth.py', testCode: 'code', manualItems: ['check layout'] });
  _setProviderForTesting(stub);

  const result = await draftTest('auth', { logicText: 'l', styleText: 'pytest', outlineText: 'outline' });

  assert.equal(stub.calls[0].options.structured, true);
  assert.equal(result.testFilePath, 'tests/test_auth.py');
});

test('draftTest rejects a malformed response', async () => {
  _setProviderForTesting(new StubProvider({ testFilePath: 'x' }));
  await assert.rejects(() => draftTest('auth', {}), /Expected \{ testFilePath/);
});

test('draftDocument requests plain text from Logic + code context', async () => {
  const stub = new StubProvider('  doc text  ');
  _setProviderForTesting(stub);

  const result = await draftDocument('auth', { logicText: 'logic', codeContext: 'code' });

  assert.equal(stub.calls[0].options.structured, false);
  assert.match(stub.calls[0].prompt, /Committed Logic:\nlogic/);
  assert.equal(result, 'doc text');
});

test('organizeStep requests plain text and includes the step name + notes', async () => {
  const stub = new StubProvider('organized text');
  _setProviderForTesting(stub);

  const result = await organizeStep('auth', 'security', 'desc', 'notes here');

  assert.equal(stub.calls[0].options.structured, false);
  assert.match(stub.calls[0].prompt, /Step: security/);
  assert.equal(result, 'organized text');
});

test('annotateCode requests structured output and returns the annotations array', async () => {
  const stub = new StubProvider({ annotations: [{ term: 'bcrypt', note: 'password hashing' }] });
  _setProviderForTesting(stub);

  const result = await annotateCode('auth', { logicText: 'l', codeText: 'c' });

  assert.equal(stub.calls[0].options.structured, true);
  assert.deepEqual(result, [{ term: 'bcrypt', note: 'password hashing' }]);
});

test('annotateCode rejects a malformed response', async () => {
  _setProviderForTesting(new StubProvider({ notAnnotations: [] }));
  await assert.rejects(() => annotateCode('auth', {}), /Expected \{ annotations/);
});
