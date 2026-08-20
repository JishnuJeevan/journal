import path from 'node:path';
import { findProjectRoot, fragmentFile } from '../lib/paths.js';
import { featureExists, loadFeature, saveFeature } from '../lib/index-store.js';
import { stageAndCommit } from '../lib/git.js';
import { buildDashboard } from './buildDashboard.js';

/**
 * `args` is the full trailing arg list from `journal set-group <feature...> [<group-name>]`.
 * Since features and a trailing group name are positionally indistinguishable, disambiguate
 * against the actual registered features: if the last arg is itself a registered feature,
 * there's no group name (clear the tag for everyone); otherwise it's the group name to set.
 */
export async function setGroup(args) {
  if (!args || args.length === 0) {
    throw new Error('Usage: journal set-group <feature> [<feature> ...] [<group-name>]');
  }

  const last = args[args.length - 1];
  const lastIsFeature = featureExists(last);
  const features = lastIsFeature ? args : args.slice(0, -1);
  const groupName = lastIsFeature ? undefined : last;

  if (features.length === 0) {
    throw new Error('Usage: journal set-group <feature> [<feature> ...] [<group-name>]');
  }

  const entries = features.map((f) => [f, loadFeature(f)]); // validate all exist before mutating any

  const root = findProjectRoot();
  const relPaths = [];
  for (const [f, entry] of entries) {
    entry.group = groupName || null;
    saveFeature(f, entry);
    relPaths.push(path.relative(root, fragmentFile(f)));
  }

  const sha = stageAndCommit(
    relPaths,
    `chore(journal): set-group ${features.join(', ')} -> ${groupName || '(none)'}`
  );

  console.log(
    groupName
      ? `Set group "${groupName}" for: ${features.join(', ')}. Committed ${sha.slice(0, 12)}.`
      : `Cleared group for: ${features.join(', ')}. Committed ${sha.slice(0, 12)}.`
  );
  await buildDashboard();
}
