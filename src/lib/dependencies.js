// §4.8: cross-feature dependencies are declared inside Logic itself, not inferred —
// a `depends-on:` line, extracted the same way commit logic already extracts
// attribution/SHA/identity, rather than a separate declaration mechanism. Matches
// "depends-on:"/"depends on:" (AI-drafted prose tends to write the latter even when
// asked for the former) at the start of a line, optionally bolded/bulleted.
const DEPENDS_ON_RE = /^[\s*_-]*depends[\s-]?on\s*:\*{0,2}\s*(.+)$/im;

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

export function extractDependsOn(logicText) {
  const m = DEPENDS_ON_RE.exec(logicText || '');
  if (!m) return [];
  // AI-organized Logic tends to append a parenthetical/dash explanation after the
  // slug list (e.g. "signup (a user must sign up first)") — cut it off before
  // splitting, and drop anything left that doesn't actually look like a slug.
  const listPart = m[1].split(/[(—–]| - /)[0];
  return [
    ...new Set(
      listPart
        .split(',')
        .map((s) => s.trim().toLowerCase().replace(/[.:;]+$/, ''))
        .filter((s) => SLUG_RE.test(s))
    ),
  ];
}
