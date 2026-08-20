import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const STEP_STUBS = {
  logic: `<!--
Describe how this feature should work, in your own words: the reasoning,
not the implementation. This is the step where your own understanding is
the actual product — everything else exists to serve or record it.

Use \`ledger draft logic <feature> "<brain dump>"\` to add your raw thinking to
brain-dump.md and have AI organize it here, or edit this file directly. Either
way, understand this before running \`ledger commit logic <feature>\`.
-->
`,
  test: `<!--
Point-in-time snapshot of the real, runnable test file plus the manual/visual
checklist, synced automatically by \`ledger draft test\`. Automated content is
overwritten each draft — hand-edit the manual checklist items' checkboxes only.
-->
`,
  document: `<!--
Document what this feature does, written so someone else (including
future-you) can understand it without re-deriving the logic.
-->
`,
};

export function defaultBodyForStep(step) {
  return STEP_STUBS[step] ?? `<!--\nContent for the "${step}" step.\n-->\n`;
}

export function newStepFrontmatter({ feature, step, version }) {
  return {
    feature,
    step,
    version,
    attribution: null,
    commit_sha: null,
    date: null,
  };
}

// --- Round-labeled append-only files (brain-dump.md, sketch.md) -----------
//
// These carry a small YAML frontmatter block (feature/step/version), the same
// convention as the single-file steps (logic.md etc.) — visible at the top of
// the file itself, per feedback, so it's obvious which version's rounds you're
// looking at without cross-referencing the dashboard.

function existingRoundNumbers(content) {
  const matches = [...content.matchAll(/^## Round (\d+)/gm)];
  return matches.map((m) => Number(m[1]));
}

/**
 * Creates `file` with frontmatter and an empty body if it doesn't already exist —
 * a no-op otherwise. Called at step-registration time (list-steps/add-step) so
 * brain-dump.md/sketch.md exist from the start, ready to write a large round into
 * directly rather than only via a CLI string argument.
 */
export function ensureRoundFile(file, { feature, step, version }) {
  if (fs.existsSync(file)) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, matter.stringify('', { feature, step, version }), 'utf8');
  return true;
}

/**
 * Appends `text` to `file` as a new `## Round N` section below any existing
 * rounds, creating the file (and its parent dir, and frontmatter if `meta` is
 * given) if needed. Never rewrites prior rounds — this is the persistent-history
 * mechanism shared by brain-dump.md and sketch.md.
 */
export function appendRound(file, text, meta) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let data = meta || {};
  let existingBody = '';
  if (fs.existsSync(file)) {
    const parsed = matter(fs.readFileSync(file, 'utf8'));
    data = { ...parsed.data, ...(meta || {}) };
    existingBody = parsed.content;
  }
  const nums = existingRoundNumbers(existingBody);
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  const newBody = `${existingBody}## Round ${next}\n\n${text.trim()}\n\n`;
  fs.writeFileSync(file, matter.stringify(newBody, data), 'utf8');
  return next;
}

/** True if `file` exists and has any non-whitespace content below its frontmatter (if any). */
export function hasContent(file) {
  if (!fs.existsSync(file)) return false;
  return matter(fs.readFileSync(file, 'utf8')).content.trim().length > 0;
}

/** Body content only — frontmatter (if any) stripped. A no-op parse for files with none. */
export function readOrEmpty(file) {
  if (!fs.existsSync(file)) return '';
  return matter(fs.readFileSync(file, 'utf8')).content;
}

/** Archives `file` to `<name>.v<version>.md` alongside it, if it exists and has content — used by new-version (§4.1's "fresh start" for brain-dump.md/sketch.md, preserving rather than erasing prior rounds). */
export function archiveRoundFile(file, version) {
  if (!fs.existsSync(file)) return null;
  const parsed = matter(fs.readFileSync(file, 'utf8'));
  if (!parsed.content.trim()) return null; // nothing but frontmatter — nothing worth archiving
  const archived = file.replace(/(\.md)$/, `.v${version}$1`);
  fs.renameSync(file, archived);
  return archived;
}

/** Appends a one-off labeled note (e.g. a drift-check answer) to a file. */
export function appendNote(file, heading, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  fs.writeFileSync(file, `${existing}## ${heading}\n\n${text.trim()}\n\n`, 'utf8');
}

// --- Custom-step templates (spec §4.5, pattern 2: checklist-from-template) -

export const KNOWN_STEP_TEMPLATES = {
  security: `# Security

Freeform checklist — edit freely; not derived from Logic.

- [ ] No hardcoded secrets, API keys, or credentials.
- [ ] All external input is validated before use.
- [ ] Authentication/authorization checks are in place for anything that needs them.
- [ ] No unsanitized input reaches a shell command, SQL query, or template render.
- [ ] Dependencies with known vulnerabilities are flagged/updated.
`,
  performance: `# Performance

Seeded scaffold — fully editable; discard whatever isn't relevant to this feature.

## Load
- Expected concurrent usage / request volume:

## Stress
- Behavior under peak/abnormal load:

## Response time / latency
- Target (e.g. p95/p99):

## Resource usage
- Memory / CPU / connection-pool limits:
`,
};

export function blankStepBody(step) {
  return `<!--\nFreeform content for the "${step}" step. No template or brain-dump mechanism\nis defined for this step name yet — write whatever's relevant.\n-->\n`;
}
