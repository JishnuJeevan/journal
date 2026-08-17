# Session notes

Working log for picking up where a prior session left off. Static project facts belong in
`CLAUDE.md` instead — keep this file to state that actually changes over time.

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
