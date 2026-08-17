import { execFileSync } from 'node:child_process';
import { findProjectRoot } from '../paths.js';
import { extractJson } from './util.js';

const BINARY = process.env.LEDGER_CLAUDE_BIN || 'claude';

/**
 * AIProvider adapter that shells out to the Claude Code CLI in headless mode
 * (`claude -p`), authenticated via the user's existing Claude Code subscription
 * rather than a separate pay-per-token ANTHROPIC_API_KEY.
 *
 * The prompt is piped over stdin (not passed as an argv string) so it isn't
 * bounded by shell argv-length limits.
 */
export class ClaudeCliProvider {
  // maxTokens is part of the AIProvider contract but has no equivalent flag on
  // `claude -p` (it runs to a natural stopping point) — accepted and ignored.
  async generate(prompt, { system, structured = false } = {}) {
    const combined = system ? `${system}\n\n---\n\n${prompt}` : prompt;

    const args = ['-p'];
    const extraArgs = process.env.LEDGER_CLAUDE_CLI_ARGS;
    if (extraArgs) args.push(...extraArgs.split(' ').filter(Boolean));

    let stdout;
    try {
      stdout = execFileSync(BINARY, args, {
        cwd: findProjectRoot(),
        input: combined,
        encoding: 'utf8',
        maxBuffer: 1024 * 1024 * 32,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(
          `Could not find the "${BINARY}" CLI on PATH. The Ledger Method's AI commands run ` +
            `\`claude -p\` headlessly via your Claude Code subscription — make sure the Claude ` +
            `Code CLI is installed and logged in, or set LEDGER_CLAUDE_BIN if it's installed ` +
            `under a different binary name.`
        );
      }
      const stderr = err.stderr ? err.stderr.toString().trim() : '';
      throw new Error(`\`${BINARY} -p\` failed: ${stderr || err.message}`);
    }

    const text = stdout.trim();
    return structured ? extractJson(text) : text;
  }
}
