import fs from 'node:fs';
import { configFile } from '../paths.js';
import { ClaudeCliProvider } from './claude-cli.js';

// Registry of available AIProvider adapters. v1 ships only claude-cli; other
// providers (OpenAI/Codex, Gemini, ...) are deferred (see spec §11) but can be
// added here without touching any command code, since commands only ever
// depend on the AIProvider.generate(prompt, options) interface.
const PROVIDERS = {
  'claude-cli': () => new ClaudeCliProvider(),
};

export const DEFAULT_PROVIDER = 'claude-cli';

export function loadConfig() {
  const file = configFile();
  if (!fs.existsSync(file)) {
    return { aiProvider: DEFAULT_PROVIDER };
  }
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse ${file}: ${err.message}`);
  }
  return { aiProvider: DEFAULT_PROVIDER, ...parsed };
}

export function saveConfig(config) {
  fs.writeFileSync(configFile(), JSON.stringify(config, null, 2) + '\n', 'utf8');
}

let cached;

/**
 * Resolves the single, project-wide AIProvider, per LEDGER/config.json's
 * "aiProvider" field. Provider choice is global, not configurable per
 * command/step (spec §10) — every AI-assisted command goes through this.
 */
export function getProvider() {
  if (cached) return cached;
  const { aiProvider } = loadConfig();
  const factory = PROVIDERS[aiProvider];
  if (!factory) {
    throw new Error(
      `Unknown aiProvider "${aiProvider}" in LEDGER/config.json. Available: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }
  cached = factory();
  return cached;
}

// For tests: allows resetting/overriding the cached provider instance.
export function _setProviderForTesting(provider) {
  cached = provider;
}
