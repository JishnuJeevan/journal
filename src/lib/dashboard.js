function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

const ATTR_LABEL = {
  person: 'Person',
  ai: 'AI',
  'person+ai': 'Person + AI',
};

function attributionBadge(attribution) {
  if (!attribution) return '<span class="badge badge-none">not set</span>';
  const cls = attribution === 'person' ? 'badge-person' : attribution === 'ai' ? 'badge-ai' : 'badge-both';
  return `<span class="badge ${cls}">${esc(ATTR_LABEL[attribution] || attribution)}</span>`;
}

function renderCell(feature, step, columnNum, isCurrent, record, relPath, showHistorical) {
  if (!record) {
    return `<td class="cell cell-empty">${attributionBadge(null)}</td>`;
  }
  const badge = attributionBadge(record.attribution);
  const sha = record.commitSha ? `<code class="sha">${esc(record.commitSha.slice(0, 12))}</code>` : '';
  const date = record.date ? `<span class="date">${esc(record.date)}</span>` : '';

  if (isCurrent) {
    const href = `${encodeURI(relPath)}`;
    return `<td class="cell">
      ${badge}
      ${sha}
      ${date}
      <div><a class="file-link" href="${href}">${esc(step)}.md</a></div>
    </td>`;
  }

  let historical = '';
  if (record.commitSha) {
    const content = showHistorical ? showHistorical(record.commitSha, relPath) : null;
    historical = content
      ? `<details><summary>view column ${columnNum} (historical)</summary><pre class="historical">${esc(content)}</pre></details>`
      : `<div class="hint">git show ${esc(record.commitSha.slice(0, 12))}:${esc(relPath)}</div>`;
  }

  return `<td class="cell cell-historical">
    ${badge}
    ${sha}
    ${date}
    ${historical}
  </td>`;
}

export function generateDashboardHtml(index, { linkPath, gitPath, showHistorical, generatedAt } = {}) {
  const features = Object.entries(index.features || {});

  const featureSections = features
    .map(([slug, entry]) => {
      if (!entry.steps) {
        return `<section class="feature">
          <h2>${esc(entry.name || slug)} <span class="slug">${esc(slug)}</span></h2>
          <p class="desc">${esc(entry.description || '')}</p>
          <p class="hint">Step pipeline not yet locked in — run <code>ledger list-steps ${esc(slug)}</code>.</p>
        </section>`;
      }

      const columns = entry.columns || [];
      const header = `<tr><th>Step</th>${columns
        .map((c) => `<th>Column ${c.column}${c.column === entry.currentColumn ? ' (current)' : ''}</th>`)
        .join('')}</tr>`;

      const rows = entry.steps
        .map((step) => {
          const cells = columns
            .map((c) => {
              const record = c.steps ? c.steps[step] : null;
              const isCurrent = c.column === entry.currentColumn;
              const relPath = isCurrent
                ? linkPath
                  ? linkPath(slug, step)
                  : `features/${slug}/${step}/${step}.md`
                : gitPath
                  ? gitPath(slug, step)
                  : `features/${slug}/${step}/${step}.md`;
              return renderCell(slug, step, c.column, isCurrent, record, relPath, showHistorical);
            })
            .join('');
          return `<tr><th class="step-name">${esc(step)}</th>${cells}</tr>`;
        })
        .join('');

      return `<section class="feature">
        <h2>${esc(entry.name || slug)} <span class="slug">${esc(slug)}</span></h2>
        <p class="desc">${esc(entry.description || '')}</p>
        ${entry.codePaths && entry.codePaths.length ? `<p class="hint">Code paths: ${entry.codePaths.map(esc).join(', ')}</p>` : ''}
        <table>
          <thead>${header}</thead>
          <tbody>${rows}</tbody>
        </table>
      </section>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Ledger — Dashboard</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root {
    --bg: #ffffff; --fg: #1a1a1a; --muted: #666; --border: #e2e2e2;
    --card: #fafafa; --person: #2563eb; --ai: #9333ea; --both: #059669; --none: #999;
  }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#15161a; --fg:#e7e7e9; --muted:#9a9aa2; --border:#2b2c33; --card:#1c1d22; }
  }
  * { box-sizing: border-box; }
  body { background: var(--bg); color: var(--fg); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 2rem; }
  h1 { margin-top: 0; }
  .generated { color: var(--muted); font-size: 0.85rem; margin-bottom: 2rem; }
  .feature { background: var(--card); border: 1px solid var(--border); border-radius: 10px; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; }
  .feature h2 { margin: 0 0 0.25rem 0; font-size: 1.15rem; }
  .slug { color: var(--muted); font-weight: normal; font-size: 0.85rem; }
  .desc { color: var(--muted); margin: 0 0 0.75rem 0; }
  .hint { color: var(--muted); font-size: 0.85rem; }
  table { border-collapse: collapse; width: 100%; margin-top: 0.5rem; }
  th, td { border: 1px solid var(--border); padding: 0.5rem 0.65rem; text-align: left; vertical-align: top; font-size: 0.85rem; }
  th { background: rgba(127,127,127,0.08); }
  .step-name { text-transform: capitalize; font-weight: 600; white-space: nowrap; }
  .badge { display: inline-block; border-radius: 999px; padding: 0.1rem 0.6rem; font-size: 0.75rem; font-weight: 600; color: white; }
  .badge-person { background: var(--person); }
  .badge-ai { background: var(--ai); }
  .badge-both { background: var(--both); }
  .badge-none { background: var(--none); }
  .sha { display: block; margin-top: 0.3rem; color: var(--muted); font-size: 0.75rem; }
  .date { display: block; color: var(--muted); font-size: 0.75rem; }
  .file-link { font-size: 0.8rem; }
  .cell-historical .historical { max-height: 220px; overflow: auto; font-size: 0.75rem; background: rgba(127,127,127,0.08); padding: 0.5rem; border-radius: 6px; }
  .cell-empty { color: var(--muted); }
</style>
</head>
<body>
  <h1>Ledger Dashboard</h1>
  <p class="generated">Generated ${esc(generatedAt || new Date().toISOString())} by <code>ledger build-dashboard</code>. Never hand-edit this file.</p>
  ${featureSections || '<p>No features registered yet. Run <code>ledger list-features</code>.</p>'}
</body>
</html>
`;
}
