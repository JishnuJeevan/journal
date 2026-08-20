import fs from 'node:fs';
import path from 'node:path';
import { indexFile, fragmentsDir, fragmentFile } from './paths.js';

/**
 * Storage layer (spec §8.1): each feature lives in its own fragment file under
 * LEDGER/index-fragments/<slug>.json. Every command reads/writes only the
 * fragment(s) for the feature(s) it's touching — two people committing to
 * different features never collide, by construction, since they touch
 * different files. LEDGER/index.json is generated-only, aggregated from the
 * fragments by `build-dashboard` (§6.1, §6.4) — nothing else writes it.
 */

function atomicWrite(file, data) {
  const dir = path.dirname(file);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.${path.basename(file)}.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

/**
 * One-time, transparent upgrade path: if index-fragments/ doesn't exist yet but a
 * legacy single-file LEDGER/index.json does (pre-§8.1 projects), split it into
 * per-feature fragments so every read/write path below can assume fragments are
 * the source of truth. Safe to call repeatedly — no-ops once fragments exist.
 */
function migrateLegacyIndexIfNeeded() {
  if (fs.existsSync(fragmentsDir())) return;
  const legacy = indexFile();
  if (!fs.existsSync(legacy)) return;
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(legacy, 'utf8'));
  } catch {
    return; // unreadable legacy file — nothing safe to migrate, leave it alone
  }
  const features = parsed.features || {};
  if (Object.keys(features).length === 0) return;
  fs.mkdirSync(fragmentsDir(), { recursive: true });
  for (const [slug, entry] of Object.entries(features)) {
    atomicWrite(fragmentFile(slug), entry);
  }
  console.log(`(migrated ${Object.keys(features).length} feature(s) from legacy index.json into index-fragments/)`);
}

export function featureExists(feature) {
  migrateLegacyIndexIfNeeded();
  return fs.existsSync(fragmentFile(feature));
}

export function loadFeature(feature) {
  migrateLegacyIndexIfNeeded();
  const file = fragmentFile(feature);
  if (!fs.existsSync(file)) {
    throw new Error(
      `Unknown feature "${feature}". Run \`ledger list-features\` or \`ledger add-feature ${feature} "..."\` first.`
    );
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse ${file}: ${err.message}`);
  }
}

export function saveFeature(feature, entry) {
  atomicWrite(fragmentFile(feature), entry);
}

export function listFeatureSlugs() {
  migrateLegacyIndexIfNeeded();
  if (!fs.existsSync(fragmentsDir())) return [];
  return fs
    .readdirSync(fragmentsDir())
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .sort();
}

/** Reads every fragment. Used by aggregation, renameGroup, and dependency lookups. */
export function loadAllFeatures() {
  const slugs = listFeatureSlugs();
  const features = {};
  for (const slug of slugs) features[slug] = loadFeature(slug);
  return features;
}

/** Rebuilds the generated LEDGER/index.json snapshot from the fragments (§8.1). Only `build-dashboard` calls this. */
export function aggregateIndex() {
  return { version: 2, features: loadAllFeatures() };
}

export function writeAggregatedIndex(index) {
  atomicWrite(indexFile(), index);
}

/** Next display-order value (feedback: features listed simplest-to-hardest, §2) — max existing + 1, 0 if none yet. */
export function nextOrder() {
  const all = Object.values(loadAllFeatures());
  const orders = all.map((f) => (typeof f.order === 'number' ? f.order : 0));
  return orders.length ? Math.max(...orders) + 1 : 0;
}

/** Shape helper matching aggregateIndex()'s output — handy for tests/tools that build one in memory. */
export function createEmptyIndex() {
  return { version: 2, features: {} };
}

export function newFeatureEntry({ name, description, group = null, order = 0 }) {
  return {
    name,
    description,
    group,
    order,
    removed: false,
    codePaths: [],
    libraries: [],
    dependsOn: [],
    steps: null,
    currentVersion: null,
    versions: [],
    errors: [],
  };
}

export function getCurrentVersion(featureEntry) {
  const v = featureEntry.versions.find((v) => v.version === featureEntry.currentVersion);
  if (!v) {
    throw new Error(
      `Corrupt fragment: no version ${featureEntry.currentVersion} recorded for this feature.`
    );
  }
  return v;
}

export function nextErrorId(featureEntry) {
  const ids = (featureEntry.errors || []).map((e) => e.id);
  return ids.length ? Math.max(...ids) + 1 : 1;
}
