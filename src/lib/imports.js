import fs from 'node:fs';
import path from 'node:path';

// Deliberately simple, textual scanning (same spirit as §6.6's annotation matching,
// not real static analysis) — covers JS/TS import/require and Python import/from.
const SPEC_RE =
  /import\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|^\s*from\s+([\w.]+)\s+import\b|^\s*import\s+([\w.]+)/gm;

function specifiersInContent(content) {
  const out = [];
  let m;
  SPEC_RE.lastIndex = 0;
  while ((m = SPEC_RE.exec(content))) {
    const spec = m[1] || m[2] || m[3] || m[4];
    if (spec) out.push(spec);
  }
  return out;
}

/** All import/require specifiers found across the given files (relative to `root`). */
export function scanImportsInFiles(root, relPaths) {
  const specs = new Set();
  for (const relPath of relPaths) {
    const abs = path.join(root, relPath);
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) continue;
    for (const s of specifiersInContent(fs.readFileSync(abs, 'utf8'))) specs.add(s);
  }
  return [...specs];
}

const RELATIVE_RE = /^[./]/;

/** External package names (§6.2's `libraries`) — relative/in-project specifiers filtered out. */
export function externalLibraries(specifiers) {
  const libs = new Set();
  for (const spec of specifiers) {
    if (RELATIVE_RE.test(spec)) continue;
    if (spec.includes('.') && !spec.startsWith('@')) continue; // python dotted in-project module path, not a package
    const parts = spec.split('/');
    const name = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
    libs.add(name);
  }
  return [...libs].sort();
}

const RESOLVE_EXTENSIONS = ['', '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs', '.py'];

/** Best-effort resolution of a relative import to a real project file, for the §4.8 dependency safety net. */
export function resolveRelativeImport(root, importingFileRelPath, spec) {
  if (!RELATIVE_RE.test(spec)) return null;
  const dir = path.dirname(path.join(root, importingFileRelPath));
  const base = path.resolve(dir, spec);
  const candidates = [
    ...RESOLVE_EXTENSIONS.map((ext) => `${base}${ext}`),
    ...RESOLVE_EXTENSIONS.map((ext) => path.join(base, `index${ext}`)),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return path.relative(root, c);
  }
  return null;
}

/** True if `resolvedRelPath` falls under any of a feature's recorded codePaths (file or directory match). */
export function pathBelongsToCodePaths(resolvedRelPath, codePaths) {
  return (codePaths || []).some(
    (cp) => resolvedRelPath === cp || resolvedRelPath.startsWith(cp.replace(/\/$/, '') + '/')
  );
}
