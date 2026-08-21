// Render/parse for JOURNAL/SRS/features.md (§9.2) — the human-reviewable draft that
// `commit features` reconciles against tracked features. One "## <slug>" block per feature,
// with **Name:**/**Description:** (and optional **Code paths:**, only present when derived from
// a code scan) fields — plain enough to hand-edit, structured enough to parse back. No **Group:**
// field — grouping is manual-only (§2, §9.2), via `add-feature --group`/`set-group`, never
// proposed or read from here.

const HEADER = `# Project features

<!-- Reviewed here before \`journal commit-features\` registers them — edit freely: reword,
merge, split, or delete an entry to drop a proposed feature. Order (top to bottom) is the
suggested implementation sequence, simplest to hardest; re-order manually if you disagree. -->

`;

export function renderFeaturesMd(features) {
  const blocks = features.map((f) => {
    const lines = [`## ${f.slug}`, `**Name:** ${f.name}`, `**Description:** ${f.description || ''}`];
    if (f.codePaths && f.codePaths.length) lines.push(`**Code paths:** ${f.codePaths.join(', ')}`);
    return lines.join('\n');
  });
  return HEADER + blocks.join('\n\n') + '\n';
}

export function parseFeaturesMd(text) {
  if (!text || !text.trim()) return [];
  const features = [];
  // Split on top-level "## " headings rather than a single capturing regex — simpler to get
  // right for a variable-length, optional-fields block like this.
  const parts = text.split(/^##\s+/m).slice(1);
  for (const part of parts) {
    const [slugLine, ...rest] = part.split('\n');
    const slug = slugLine.trim();
    if (!slug) continue;
    const body = rest.join('\n');
    const name = (body.match(/\*\*Name:\*\*\s*(.+)/) || [])[1] || slug;
    const description = (body.match(/\*\*Description:\*\*\s*(.+)/) || [])[1] || '';
    const codePathsLine = (body.match(/\*\*Code paths:\*\*\s*(.+)/) || [])[1] || '';
    const codePaths = codePathsLine.split(',').map((s) => s.trim()).filter(Boolean);
    features.push({ slug, name: name.trim(), description: description.trim(), codePaths });
  }
  return features;
}
