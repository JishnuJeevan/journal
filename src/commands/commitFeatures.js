import fs from 'node:fs';
import path from 'node:path';
import { findProjectRoot, srsFeaturesFile, fragmentFile } from '../lib/paths.js';
import { featureExists, saveFeature, newFeatureEntry, nextOrder, listFeatureSlugs, loadFeature } from '../lib/index-store.js';
import { parseFeaturesMd } from '../lib/featuresDoc.js';
import { stageAndCommit } from '../lib/git.js';
import { buildDashboard } from './buildDashboard.js';

export async function commitFeatures() {
  const featuresFile = srsFeaturesFile();
  if (!fs.existsSync(featuresFile) || !fs.readFileSync(featuresFile, 'utf8').trim()) {
    throw new Error(`${featuresFile} is empty — run \`journal draft-features\` first.`);
  }

  const parsed = parseFeaturesMd(fs.readFileSync(featuresFile, 'utf8'));
  if (parsed.length === 0) {
    throw new Error(`No features found in ${featuresFile} — nothing to commit.`);
  }

  const root = findProjectRoot();
  const relPaths = [path.relative(root, featuresFile)];
  const created = [];
  let order = nextOrder();

  for (const f of parsed) {
    if (featureExists(f.slug)) continue; // already tracked — re-deriving only ever proposes additions (§9.2)
    // §2/§9.2: group is manual-only — never assigned from a proposed/hand-edited features.md entry.
    const entry = newFeatureEntry({ name: f.name, description: f.description, group: null, order: order++ });
    if (f.codePaths && f.codePaths.length) entry.codePaths = f.codePaths;
    saveFeature(f.slug, entry);
    relPaths.push(path.relative(root, fragmentFile(f.slug)));
    created.push(f.slug);
  }

  // Flag (never auto-remove) a previously-tracked, non-removed feature that's no longer
  // listed in the current features.md — the human decides whether that's intentional.
  const listedSlugs = new Set(parsed.map((f) => f.slug));
  const missing = listFeatureSlugs().filter((slug) => {
    if (listedSlugs.has(slug)) return false;
    const entry = loadFeature(slug);
    return !entry.removed;
  });

  if (created.length === 0 && missing.length === 0) {
    console.log('Nothing new to register — every listed feature is already tracked.');
    return;
  }

  const sha = created.length
    ? stageAndCommit(relPaths, `chore(journal): commit features (${created.join(', ')})`)
    : null;

  if (created.length) {
    console.log(`Registered ${created.length} feature(s): ${created.join(', ')}. Committed ${sha.slice(0, 12)}.`);
  }
  if (missing.length) {
    console.log(
      `\nNote: ${missing.join(', ')} ${missing.length > 1 ? 'were' : 'was'} tracked before but ${missing.length > 1 ? "aren't" : "isn't"} reflected ` +
        `in the current brain dump — intentionally dropped, or just not mentioned this round? Not removed automatically; ` +
        `run \`journal remove-feature <feature>\` yourself if it's really gone.`
    );
  }

  if (created.length) {
    await buildDashboard();
    console.log(`\nNext: journal list-steps <feature> for each, to lock in its step pipeline.`);
  }
}
