import { execFileSync } from 'node:child_process';
import { findProjectRoot } from '../paths.js';
import { extractJson } from './util.js';

const BINARY = process.env.LEDGER_CLAUDE_BIN || 'claude';

/**
 * `modelUsage` in the JSON envelope can list more than one model (e.g. a small
 * auxiliary/routing call alongside the model that actually produced the response) —
 * picking the first key isn't reliable. The model that did the heavy lifting is the
 * one with by far the largest token volume (input + cache read/creation + output),
 * so use that as the identity rather than whichever happens to sort first.
 */
function pickPrimaryModel(modelUsage) {
  if (!modelUsage || typeof modelUsage !== 'object') return null;
  let best = null;
  let bestTokens = -1;
  for (const [key, usage] of Object.entries(modelUsage)) {
    const tokens =
      (usage?.inputTokens || 0) +
      (usage?.outputTokens || 0) +
      (usage?.cacheReadInputTokens || 0) +
      (usage?.cacheCreationInputTokens || 0);
    if (tokens > bestTokens) {
      bestTokens = tokens;
      best = usage?.canonicalModel || key;
    }
  }
  return best;
}

/**
 * AIProvider adapter that shells out to the Claude Code CLI in headless mode
 * (`claude -p`), authenticated via the user's existing Claude Code subscription
 * rather than a separate pay-per-token ANTHROPIC_API_KEY.
 *
 * The prompt is piped over stdin (not passed as an argv string) so it isn't
 * bounded by shell argv-length limits.
 */
export class ClaudeCliProvider {
  constructor() {
    // Set after each generate() call — the model identifier that actually produced
    // the last response (§5), when the CLI's JSON envelope exposes one. null if the
    // installed CLI version doesn't support --output-format json, or the field isn't
    // present. Commands read this synchronously right after drafting to persist it.
    this.lastModel = null;
  }

  runCli(args, combined) {
    return execFileSync(BINARY, args, {
      cwd: findProjectRoot(),
      input: combined,
      encoding: 'utf8',
      maxBuffer: 1024 * 1024 * 32,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  }

  // One full round-trip: returns { text, model }. Does not parse `text` as JSON —
  // that's the caller's job, so it can retry a malformed response without re-doing
  // the envelope/fallback dance.
  runOnceForText(combined, extra) {
    this.lastModel = null;
    let raw;
    let usedJsonEnvelope = false;
    try {
      // Ask for the JSON envelope first — it's the only way to learn which model
      // actually produced the response (§5), information the plain-text form
      // doesn't carry at all.
      raw = this.runCli(['-p', '--output-format', 'json', ...extra], combined).trim();
      usedJsonEnvelope = true;
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(
          `Could not find the "${BINARY}" CLI on PATH. The Ledger Method's AI commands run ` +
            `\`claude -p\` headlessly via your Claude Code subscription — make sure the Claude ` +
            `Code CLI is installed and logged in, or set LEDGER_CLAUDE_BIN if it's installed ` +
            `under a different binary name.`
        );
      }
      // Older CLI versions may not support --output-format json — fall back to the
      // plain call rather than failing the whole draft over an identity nicety. If
      // this also fails, it's a real error (auth, network, ...) and should surface.
      try {
        raw = this.runCli(['-p', ...extra], combined).trim();
      } catch (err2) {
        const stderr = err2.stderr ? err2.stderr.toString().trim() : '';
        throw new Error(`\`${BINARY} -p\` failed: ${stderr || err2.message}`);
      }
    }

    let text = raw;
    let model = null;
    if (usedJsonEnvelope) {
      try {
        const envelope = JSON.parse(raw);
        if (envelope && typeof envelope.result === 'string') {
          text = envelope.result;
          model = envelope.model || pickPrimaryModel(envelope.modelUsage) || null;
        }
      } catch {
        // Not an envelope after all (flag silently ignored by this CLI version) —
        // `raw` is the direct response text/JSON, used as-is. Identity stays unknown.
      }
    }
    this.lastModel = model;
    return text;
  }

  // maxTokens is part of the AIProvider contract but has no equivalent flag on
  // `claude -p` (it runs to a natural stopping point) — accepted and ignored.
  async generate(prompt, { system, structured = false } = {}) {
    const combined = system ? `${system}\n\n---\n\n${prompt}` : prompt;
    const extraArgs = process.env.LEDGER_CLAUDE_CLI_ARGS;
    const extra = extraArgs ? extraArgs.split(' ').filter(Boolean) : [];

    if (!structured) {
      return this.runOnceForText(combined, extra);
    }

    // Structured responses occasionally come back truncated/malformed (a known
    // rough edge of the headless agent harness, not a real content problem) — retry
    // a couple of times with a fresh call before giving up.
    const maxAttempts = 3;
    let lastErr;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const text = this.runOnceForText(combined, extra);
      try {
        return extractJson(text);
      } catch (err) {
        lastErr = err;
        if (attempt < maxAttempts) {
          console.log(`(AI response wasn't valid JSON — retrying, attempt ${attempt + 1}/${maxAttempts})`);
        }
      }
    }
    throw new Error(`${lastErr.message}\n(failed after ${maxAttempts} attempts)`);
  }
}
