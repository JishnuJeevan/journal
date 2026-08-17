import fs from 'node:fs';
import path from 'node:path';
import { indexFile } from './paths.js';

export function createEmptyIndex() {
  return {
    version: 1,
    features: {},
  };
}

export function loadIndex() {
  const file = indexFile();
  if (!fs.existsSync(file)) {
    throw new Error(`${file} not found — run \`ledger init\` first.`);
  }
  const raw = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`Failed to parse ${file}: ${err.message}`);
  }
}

/**
 * Atomic-ish write: write to a temp file in the same directory, then rename.
 * Rename is atomic on POSIX filesystems, avoiding a half-written index.json.
 */
export function saveIndex(index) {
  const file = indexFile();
  const dir = path.dirname(file);
  const tmp = path.join(dir, `.index.json.${process.pid}.${Date.now()}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify(index, null, 2) + '\n', 'utf8');
  fs.renameSync(tmp, file);
}

export function getFeature(index, feature) {
  const entry = index.features[feature];
  if (!entry) {
    throw new Error(
      `Unknown feature "${feature}". Run \`ledger list-features\` or \`ledger list-steps ${feature} --description "..."\` first.`
    );
  }
  return entry;
}

export function getCurrentColumn(featureEntry) {
  const col = featureEntry.columns.find((c) => c.column === featureEntry.currentColumn);
  if (!col) {
    throw new Error(
      `Corrupt index: no column ${featureEntry.currentColumn} recorded for this feature.`
    );
  }
  return col;
}
