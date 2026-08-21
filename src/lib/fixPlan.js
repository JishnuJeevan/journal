// Shared helpers for the errors/fix-plan.md format (§4.6): one file, many errors, each error's
// rounds labeled "## Plan for Error #<id> — Round <n>" — `appendRound`'s single-counter
// convention (templates.js) doesn't fit since it assumes one file belongs to one thing.

export function findErrorTarget(entry, opts) {
  const errors = entry.errors || [];
  if (opts.id) {
    const target = errors.find((e) => e.id === Number(opts.id));
    if (!target) throw new Error(`No error #${opts.id} logged for "${entry.name}".`);
    return target;
  }
  const target = [...errors].reverse().find((e) => e.status === 'open');
  if (!target) throw new Error(`No open errors. Pass --id to target a specific one.`);
  return target;
}

export function roundsForError(content, id) {
  const re = new RegExp(`^## Plan for Error #${id} — Round (\\d+)`, 'gm');
  return [...content.matchAll(re)].map((m) => Number(m[1]));
}

/** Full round history (all rounds concatenated) for one error id — apply-fix reads all of it,
 * not just the latest round, since later rounds may only add refinements. */
export function planHistoryForError(content, id) {
  const re = new RegExp(
    `^## Plan for Error #${id} — Round \\d+[^\\n]*\\n\\n([\\s\\S]*?)(?=^## Plan for Error #\\d+ — Round \\d+|\\s*$(?![\\s\\S]))`,
    'gm'
  );
  return [...content.matchAll(re)].map((m) => m[1].trim()).join('\n\n');
}
