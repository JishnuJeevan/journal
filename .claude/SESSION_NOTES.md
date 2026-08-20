# Session notes

Working log for picking up where a prior session left off. Static project facts belong in
`CLAUDE.md` instead — keep this file to state that actually changes over time.

## 2026-08-20 — user off to test v3 on a real project

- User is now going to test v3 (fragment-sharded storage, identity capture, cross-feature
  dependencies, `fix-error`, JOURNAL rename) on a real project, following
  `docs/v3-testing-guide.md`, and will fill in `docs/v3-feedback.md` (currently blank) while doing
  so. **Next session should start by reading `docs/v3-feedback.md`** for what came up, same
  pattern as the v1→v2 and v2→v3 feedback loops.

## 2026-08-20 — v3 features + rename to JOURNAL

- User filled in `docs/v2-feedback.md` from real dogfooding (a Sudoku project) and separately
  hand-updated `docs/LEDGER-method-spec.md`/`docs/ledger-dashboard-template.html` with several
  previously-open spec items now resolved. Implemented both in one pass:
  - **§8.1 fragment-sharded storage**: rewrote `src/lib/index-store.js` around
    `loadFeature`/`saveFeature` (one JSON file per feature under `index-fragments/`); every
    command that used to read/write the single `index.json` now touches only its own feature's
    fragment. `index.json` is generated-only (`aggregateIndex()`, called by `build-dashboard`).
    Deferred §6.7's push-based lock detection at the user's explicit request (fragment sharding
    alone already removes the cross-feature collision case) — if built later, make it opt-in, not
    a silent change to what `commit-*` does.
  - **§5 identity capture**: person entries carry `git config`/commit author name; ai entries
    carry the actual responding model id. Required teaching `claude-cli.js` to request
    `--output-format json` and parse the envelope — live-tested and found the envelope's
    `modelUsage` can list more than one model (an auxiliary call alongside the real one); fixed by
    picking the entry with the largest token volume, not the first object key.
  - **§4.8 cross-feature dependencies**: `depends-on:` line in Logic, extracted at `commit logic`
    (`src/lib/dependencies.js`). Live-tested with the real AI adapter and found it writes "Depends
    on:" (space) rather than the literal "depends-on:" — loosened the extraction regex and added
    an explicit instruction to the `draftLogic` prompt requesting the literal token.
  - **§6.2 libraries + §4.8 safety net**: `src/lib/imports.js` scans imports at `commit code`,
    recording external packages as `libraries` and warning (non-blocking) on an unrecorded
    cross-feature import — both verified against a real committed feature.
  - **`fix-error` (§4.6)**, scoped per explicit user direction to diagnosis-only: reads the error +
    committed Logic + code, appends a plain-language diagnosis to `errors/diagnosis.md`. Never
    edits code, never touches the `resolve-error` flow.
  - Feedback-driven fixes: dashboard now rebuilds after `init`/`list-features`/`add-feature` too;
    `list-features` no longer auto-groups (and orders proposals simplest-to-hardest, persisted as
    each feature's `order`, which the dashboard now sorts by); `rename-group` with no new name
    ungroups; `new-version` archives brain-dump/sketch/test-outline/code/test history instead of
    silently discarding it (`brain-dump.v1.md`, `code-v1/`, `test.v1.md`); `test.md` gained a "how
    to run" section and a "Verified passing" stamp on `commit test`, plus instructions for what to
    write next to a manual checkbox; `log-error` takes separate error-output/description args;
    `--file` flag on `draft`; a malformed structured AI response now retries up to 3x.
  - Caught and fixed one more bug during live testing, unrelated to the above: `commit test`'s
    "Verified passing" stamp used `^(# Test — .+\n\n)/` without the `m` flag, so it silently never
    matched (the heading isn't at string-start, an HTML comment precedes it) — stamp was never
    actually inserted. Also found — pre-existing, not introduced this session —
    `index.html`/`index.json`/`config.json` were regenerated on disk but never `git add`ed by any
    code path; added `stageAndCommitIfChanged` (a no-op-safe variant of `stageAndCommit`) and wired
    it into `build-dashboard` and the `commit test` config-save path.
  - All verified end-to-end against the real `claude -p` adapter in a scratch repo (fresh feature
    through all four steps, `new-version`, errors log, `--file`, dashboard data shape), not just
    `npm test` (27 passing).
- **Same-day follow-up: renamed the whole project from "The Ledger Method" to JOURNAL**, per a new
  `docs/JOURNAL-spec.md` + `docs/journal-dashboard-template.html` (confirmed via diff to be a pure
  rename plus formalizing the already-built `fix-error` section into the spec — no new functional
  requirements). `LEDGER/` → `JOURNAL/`, `ledger` binary → `journal`, `ledger-init` →
  `journal-init`, `bin/ledger.js` → `bin/journal.js`, `src/commands/ledgerInit.js` →
  `journalInit.js`, package name/bin entry, `LEDGER_CLAUDE_BIN`/`LEDGER_CLAUDE_CLI_ARGS` →
  `JOURNAL_*`. Deleted the superseded `docs/LEDGER-method-spec.md`/`ledger-dashboard-template.html`
  (the user had already tried to delete these once this session and had to restore them from
  backup — confirmed re-deleting was the actual intent once the diff-check was done). Rewrote
  `CLAUDE.md` and `README.md`, which had gone stale after the v3 work above (never updated at the
  time) as well as the rename. Re-ran `npm link` (old `ledger` symlink removed, `journal` on PATH)
  and re-verified end-to-end in a fresh scratch repo. `npm test` still 27/27.
  - Note on tooling: several rounds of `sed -i ''` silently no-op'd or errored inconsistently
    across files in this session, for reasons not fully root-caused (macOS/BSD sed; `\b` isn't
    supported there, which explains part of it but not all of it) — switched to a small inline
    Node script (plain `String.replace` over the file list) for the bulk of the rename, which
    behaved deterministically. Worth defaulting to that approach over `sed -i` for any future
    multi-file rename in this repo.

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
