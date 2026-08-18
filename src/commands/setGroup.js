import path from 'node:path';
import { findProjectRoot, indexFile } from '../lib/paths.js';
import { loadIndex, saveIndex, getFeature } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';

/**
 * `args` is the full trailing arg list from `ledger set-group <feature...> [<group-name>]`.
 * Since features and a trailing group name are positionally indistinguishable, disambiguate
 * against the actual index: if the last arg is itself a registered feature, there's no group
 * name (clear the tag for everyone); otherwise it's the group name to set.
 */
export async function setGroup(args) {
  if (!args || args.length === 0) {
    throw new Error('Usage: ledger set-group <feature> [<feature> ...] [<group-name>]');
  }

  const index = loadIndex();
  const last = args[args.length - 1];
  const lastIsFeature = Boolean(index.features[last]);
  const features = lastIsFeature ? args : args.slice(0, -1);
  const groupName = lastIsFeature ? undefined : last;

  if (features.length === 0) {
    throw new Error('Usage: ledger set-group <feature> [<feature> ...] [<group-name>]');
  }

  for (const f of features) getFeature(index, f); // validate all exist before mutating any

  for (const f of features) {
    index.features[f].group = groupName || null;
  }
  saveIndex(index);

  const root = findProjectRoot();
  const sha = stageAndCommit(
    [path.relative(root, indexFile())],
    `chore(ledger): set-group ${features.join(', ')} -> ${groupName || '(none)'}`
  );

  console.log(
    groupName
      ? `Set group "${groupName}" for: ${features.join(', ')}. Committed ${sha.slice(0, 12)}.`
      : `Cleared group for: ${features.join(', ')}. Committed ${sha.slice(0, 12)}.`
  );
}
