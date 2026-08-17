import test from 'node:test';
import assert from 'node:assert/strict';
import { proposeFeatures, proposeSteps, draftLogic } from '../src/lib/ai.js';
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
  const stub = new StubProvider([{ slug: 'auth', name: 'Auth', description: 'Login.' }]);
  _setProviderForTesting(stub);

  const result = await proposeFeatures('a project with logins');

  assert.equal(stub.calls[0].options.structured, true);
  assert.match(stub.calls[0].options.system, /discrete\nfeatures/);
  assert.deepEqual(result, [{ slug: 'auth', name: 'Auth', description: 'Login.' }]);
});

test('proposeFeatures rejects a non-array structured response', async () => {
  _setProviderForTesting(new StubProvider({ not: 'an array' }));
  await assert.rejects(() => proposeFeatures('x'), /Expected a JSON array/);
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

test('draftLogic with a brain dump grounds the draft in it', async () => {
  const stub = new StubProvider('draft');
  _setProviderForTesting(stub);

  await draftLogic('auth', 'login flow', '  users log in with email + magic link  ');

  assert.match(stub.calls[0].options.system, /take THEIR reasoning/);
  assert.match(stub.calls[0].prompt, /Author's brain dump:\nusers log in with email \+ magic link/);
});

test('draftLogic treats a whitespace-only brain dump as absent', async () => {
  const stub = new StubProvider('draft');
  _setProviderForTesting(stub);

  await draftLogic('auth', 'login flow', '   ');

  assert.match(stub.calls[0].options.system, /genuine, concrete attempt/);
});
