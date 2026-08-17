# The Ledger Method

CLI (`ledger`) for a development methodology built around four principles: **engagement**,
**understanding**, **provenance**, and **friction against blind acceptance** of AI output.

Full design: `docs/LEDGER-method-spec.md`. User-facing usage: `README.md`. Ongoing testing notes
and open items: `docs/v1-feedback.md` — check this file for known bugs, deferred ideas, and
undecided design questions before starting new work.

## Core model

Every feature is decomposed into **steps** (default: Logic → Code → Test → Document, configurable
per feature). Each step is tagged with attribution — `person`, `ai`, or `person+ai` — and
committed to git individually via `commit-<step>`, producing a granular, attributable history.
When a feature changes materially after completion, `new-column <feature>` starts a fresh revision
pass; old columns remain viewable via their recorded commit SHAs. `LEDGER/index.json` is the
source of truth for the dashboard (`build-dashboard` regenerates `LEDGER/index.html` from it —
never hand-edit the HTML).

## Architecture

```
src/cli.js                           — commander program, all command wiring
src/commands/                        — one file per command (init, listFeatures, listSteps,
                                        draftLogic, commitStep, newColumn, logError, buildDashboard)
src/lib/ai.js                        — prompt-building for AI-assisted commands
src/lib/ai-providers/provider.js     — global config resolution + adapter registry
src/lib/ai-providers/claude-cli.js   — the only v1 adapter: shells out to `claude -p` (headless
                                        Claude Code CLI), auth via existing subscription, not a
                                        separate ANTHROPIC_API_KEY
src/lib/ai-providers/util.js         — shared JSON-extraction helper for structured output
src/lib/index-store.js, frontmatter.js, git.js, paths.js, templates.js, dashboard.js
                                      — supporting plumbing
```

Commands never call an AI provider adapter directly — they call `proposeFeatures` /
`proposeSteps` / `draftLogic` in `src/lib/ai.js`, which calls
`getProvider().generate(prompt, { system, structured })`. Adding a second provider means adding
one file to `ai-providers/` plus a registry entry; no command code changes.

## Conventions

- ES modules (`type: module`), Node >=18, no TypeScript.
- Tests: `npm test` (`node --test`). Currently covers pure logic only (`src/lib/ai.js` via a
  `StubProvider`, `src/lib/dashboard.js` rendering) — the git-integrated commands and the real
  `claude -p` adapter are exercised by hand in scratch repos, not automated, since they need a
  real git repo and a logged-in `claude` CLI.
- AI-assisted commands are explicitly framed as *drafts* the human must review/edit before
  committing — don't weaken that framing when touching prompts in `src/lib/ai.js`.

## Status

v1 is built and working end-to-end (init → list-features → list-steps → draft-logic →
commit-* → build-dashboard). Currently in a testing/feedback loop: trying the CLI on real
projects and logging friction into `docs/v1-feedback.md`, then triaging items from there into
actual fixes. See that file for the current punch list.
