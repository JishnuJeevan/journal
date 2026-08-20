# Session notes

Working log for picking up where a prior session left off. Static project facts belong in
`CLAUDE.md` instead — keep this file to state that actually changes over time.

## 2026-08-18 — v2 rewrite

- User rewrote `docs/LEDGER-method-spec.md` as a major overhaul (v1 → v2): versions replace
  columns, groups, real AI-authored code (`draft code` writes files into `src/`), two-phase
  `draft test`, code annotations (§6.6), drift detection (§6.5), `ledger-init` bootstrap,
  errors-with-attribution, `LEDGER/style.md`, unified `draft <step>`/`commit <step>` replacing
  the old per-step commands. Also supplied `docs/ledger-dashboard-template.html` — an
  interactive dashboard template (search, version chips, errors panel) to build the new
  `build-dashboard` around, replacing the old static table renderer.
- Rebuilt the CLI end-to-end against the new spec. New commands: `ledger-init`, `add-feature`,
  `set-group`, `rename-group`, `remove-feature`, `add-step`, `resolve-error`. `draft-logic.js` →
  `draftStep.js` (unified dispatcher), `newColumn.js` → `newVersion.js`. Attribution is now
  auto-detected at commit time (brain-dump/sketch presence, or outline-edit-diff for Test) —
  dropped the old interactive `--attribution` prompt and `person+ai` entirely, since v1's prompt
  actually contradicted the method's own "detected, not self-reported" principle.
- Addressed the one open friction item from `docs/v1-feedback.md`: `ledger commit <step>` now
  auto-runs `build-dashboard` at the end of every successful commit.
- Bugs caught during hand-testing in scratch repos (not caught by unit tests — worth remembering
  this class of bug needs scratch-repo verification, not just `npm test`):
  - A broken template-literal escape leaked literal `${feature}` text into generated stub files.
  - The known meta-commentary leak from v1-feedback.md (`claude -p` narrating its own process)
    reproduced immediately — strengthened all plain-text system prompts in `src/lib/ai.js` to
    explicitly forbid it.
  - `draft test` initially wrote the real test file *inside* `LEDGER/` and imported the frozen
    snapshot copy instead of live source — fixed the prompt (explicit "never under LEDGER/,
    import the real source path") and added a hard path-safety check in `draftStep.js`
    (`assertSafeRelPath`), also applied to `draft code`.
  - The post-commit drift-check prompt could hang forever with no TTY, which would've silently
    blocked the dashboard auto-rebuild — reordered `commitStep.js` so the rebuild always runs
    first, and the prompt now skips cleanly (`process.stdin.isTTY` check) instead of hanging.
- Follow-up ask same session: user attached a further-updated spec adding `LEDGER/architecture.md`
  (project-wide system shape, read by `draft logic` as background context) and Logic-integrity
  drift detection (§6.5 — since `commit logic` locks `logic.md` but Logic has no upstream to
  append a drift note to, any `draft`/`commit` call on that feature now checks `logic.md` against
  what was last committed and prints a non-blocking warning pointing at `new-version`). Added
  `src/lib/logicIntegrity.js`, wired into both `draftStep.js` and `commitStep.js` entry points.
  Caught another real bug during verification: `new-version` crashed (`git add` pathspec error)
  for any feature whose `test` step was never drafted, since it unconditionally tried to stage
  deletions for files that were never created/tracked — fixed with a new `isTracked()` helper in
  `src/lib/git.js`, only staging deletions git actually knows about.
- Created `docs/v2-testing-guide.md` (command walkthrough for testing in another project) and
  `docs/v2-feedback.md` (blank, same 4-section shape as `v1-feedback.md`) for the user to fill in
  while testing v2 on a real project. **User is now going to test v2 elsewhere and will come back
  with `docs/v2-feedback.md` filled in — next session should start by reading that file.**
- All 25 unit tests passing (`npm test`) at end of session. `docs/v1-feedback.md` and
  `docs/LEDGER-method-spec.md` (old version) are superseded/merged — the spec file now holds the
  v2 content directly (the user's second attached copy, `LEDGER-method-spec (1).md`, was merged
  in and deleted, not kept as a separate file).

## 2026-08-17

- Implemented the two-mode `draft-logic` feature requested from `docs/v1-feedback.md`:
  - `ledger draft-logic <feature>` (bare) — unchanged, AI improvises from name + description.
  - `ledger draft-logic <feature> "<brain dump>"` — new. AI now organizes the *user's own* raw
    reasoning into a coherent draft instead of inventing logic from scratch. Implemented via two
    separate system prompts in `src/lib/ai.js::draftLogic`, selected on whether a non-whitespace
    brain dump was passed.
  - Touched: `src/lib/ai.js`, `src/commands/draftLogic.js`, `src/cli.js` (optional positional
    `[brainDump]` arg), `test/ai.test.js` (+3 tests), `README.md`, `docs/LEDGER-method-spec.md`,
    `docs/v1-feedback.md` (marked that item done).
  - All 11 tests passing (`npm test`) at time of commit.

## Remaining open items (from docs/v1-feedback.md, not yet acted on)

- Friction: `commit-*` doesn't auto-run `build-dashboard` afterward.
- Bug: `commit-code`'s linked paths aren't visible in `code.md` (only in `index.json`).
- Bug: `draft-logic` output can leak tool-use meta-commentary — `claude -p` runs the full agent
  harness, not a plain completion endpoint; needs a stronger prompt/permission boundary or output
  stripping. See `src/lib/ai-providers/claude-cli.js`.
- Idea (deferred): `discuss-logic <feature>` — AI critique without editing.
- Idea (deferred): `draft-test` / `draft-document`, mirroring `draft-logic`.
- Open design question: `commit-code` full snapshot vs. pointer for linked files — tradeoff
  against repo bloat on large files, currently intentional per spec §6.2. Needs author decision.
