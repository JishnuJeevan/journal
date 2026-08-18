import fs from 'node:fs';
import { stepFile } from './paths.js';
import { getCurrentVersion } from './index-store.js';
import { contentHash } from './hash.js';

/**
 * §6.5: once `commit logic` runs, logic.md is meant to stay locked until `new-version` — but
 * unlike Code/Test, Logic has no upstream to append a drift note to (it IS the upstream). So
 * instead of a post-commit note, any `draft`/`commit` call touching this feature checks whether
 * logic.md still matches what was last committed, and flags immediately if not. Non-blocking —
 * only warns and points at `new-version`, never refuses to proceed.
 */
export function checkLogicIntegrity(feature, entry) {
  if (!entry.steps || !entry.steps.includes('logic') || entry.currentVersion == null) return;

  const version = getCurrentVersion(entry);
  const record = version.steps.logic;
  if (!record || !record.committedHash) return; // nothing committed yet this version — nothing to protect

  const file = stepFile(feature, 'logic');
  if (!fs.existsSync(file)) return;

  const current = fs.readFileSync(file, 'utf8');
  if (contentHash(current) !== record.committedHash) {
    console.log(
      `\nWarning: LEDGER/features/${feature}/logic/logic.md was hand-edited after \`commit logic\` — ` +
        `Logic is meant to stay locked until a new version. This doesn't block anything, but if it's a ` +
        `real change (not just a typo fix), run \`ledger new-version ${feature}\`.`
    );
  }
}
