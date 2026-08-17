const PROMPTS = {
  logic: `<!--
Describe how this feature should work, in your own words: the reasoning,
not the implementation. This is the step where your own understanding is
the actual product — everything else exists to serve or record it.

AI may have drafted a starting point (see \`ledger draft-logic\`), but the
expectation is that you read, edit, and genuinely understand this before
running \`ledger commit-logic\`.
-->
`,
  code: `<!--
This file is a point-in-time snapshot, synced automatically by
\`ledger commit-code\`. It is overwritten on every commit — do not hand-edit.
The real, live code lives in your normal project source tree.
-->
`,
  test: `<!--
Describe how this feature's behavior was verified against what the Logic
step said it should do. AI can generate tests; you're expected to run and
verify the results yourself before running \`ledger commit-test\`.
-->
`,
  document: `<!--
Document what this feature does, written so someone else (including
future-you) can understand it without re-deriving the logic.
-->
`,
};

export function defaultBodyForStep(step) {
  return PROMPTS[step] ?? `<!--\nContent for the "${step}" step.\n-->\n`;
}

export function newStepFrontmatter({ feature, step, column }) {
  return {
    feature,
    step,
    column,
    attribution: null,
    commit_sha: null,
    date: null,
  };
}
