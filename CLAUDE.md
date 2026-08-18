# The Ledger Method

CLI (`ledger`) for a development methodology built around four principles: **engagement**,
**understanding**, **provenance**, and **friction against blind acceptance** of AI output.

Full design: `docs/LEDGER-method-spec.md`. User-facing usage: `README.md`. Prior testing notes:
`docs/v1-feedback.md` — superseded by the v2 spec rewrite; kept as historical record only.

## Core model

Every feature is decomposed into **steps** (default: Logic → Code → Test → Document, configurable
per feature). Each step is tagged with attribution — `person`, `ai`, or `legacy` — **auto-detected
from tool usage at commit time, never asked interactively** (spec §5) — and committed to git
individually via the unified `ledger commit <step> <feature>`, producing a granular, attributable
history. `ledger commit` rebuilds `LEDGER/index.html` automatically afterward — never run
`build-dashboard` manually except to force a rebuild without committing anything. When a feature
changes materially after completion, `new-version <feature>` starts a fresh revision pass; old
versions remain viewable via their recorded commit SHAs (`git show <sha>:<path>` — step files are
overwritten each version, so the dashboard doesn't render historical content inline). `Code` is
AI-authored: `draft code` writes real files into `src/` (paths inferred from committed Logic), not
just a snapshot of manually-written code. `LEDGER/index.json` is the source of truth for the
dashboard — never hand-edit `LEDGER/index.html`.

## Architecture

```
src/cli.js                           — commander program, all command wiring
src/commands/                        — one file per command: init, ledgerInit, listFeatures,
                                        addFeature, setGroup, renameGroup, removeFeature,
                                        listSteps, addStep, draftStep (unified `draft <step>`),
                                        commitStep (unified `commit <step>`), newVersion,
                                        logError, resolveError, buildDashboard
src/lib/ai.js                        — prompt-building for every AI-assisted command
src/lib/ai-providers/provider.js     — global config resolution + adapter registry
src/lib/ai-providers/claude-cli.js   — the only v1 adapter: shells out to `claude -p` (headless
                                        Claude Code CLI), auth via existing subscription, not a
                                        separate ANTHROPIC_API_KEY
src/lib/ai-providers/util.js         — shared JSON-extraction helper for structured output
src/lib/hash.js                      — sha256 helpers backing attribution + drift detection (§6.5)
src/lib/logicIntegrity.js            — checks logic.md against what was last committed; called at
                                        the top of every draft/commit call for a feature, since
                                        Logic has no upstream to append a drift note to (§6.5)
src/lib/dashboard.js, dashboard-template.html
                                      — index.json → dashboard-data transform, and the
                                        interactive template it's injected into (search, version
                                        chips, errors panel — template JS is reusable as-is)
src/lib/index-store.js, frontmatter.js, git.js, paths.js, templates.js
                                      — supporting plumbing
```

Commands never call an AI provider adapter directly — they call functions in `src/lib/ai.js`
(`proposeFeatures`, `draftLogic`, `draftCode`, `draftTest`, `annotateCode`, etc.), which call
`getProvider().generate(prompt, { system, structured })`. Adding a second provider means adding
one file to `ai-providers/` plus a registry entry; no command code changes.

## Conventions

- ES modules (`type: module`), Node >=18, no TypeScript.
- Tests: `npm test` (`node --test`). Currently covers pure logic only (`src/lib/ai.js` via a
  `StubProvider`, `src/lib/dashboard.js`'s data transform) — the git-integrated commands and the
  real `claude -p` adapter are exercised by hand in scratch repos, not automated, since they need
  a real git repo and a logged-in `claude` CLI.
- AI-assisted commands are explicitly framed as *drafts* the human must review/edit before
  committing — don't weaken that framing when touching prompts in `src/lib/ai.js`. The system
  prompts also explicitly forbid meta-commentary about the model's own process (a known failure
  mode of the `claude -p` adapter, since it runs the full tool-aware agent harness, not a bare
  completion endpoint) — preserve that framing when editing prompts.
- Any path an AI-assisted command writes to disk (`draft code`, `draft test`) is validated to
  stay inside the project root and outside `LEDGER/` (`assertSafeRelPath` in `draftStep.js`) —
  don't relax this without a reason.

## Status

v2 (the spec's major overhaul — versions, groups, real AI-authored code, two-phase test
generation, drift detection, code annotations, `ledger-init` bootstrap, errors-with-attribution,
`style.md`, unified `draft`/`commit`, an interactive dashboard) is built end-to-end and
hand-verified in scratch repos. `docs/v1-feedback.md` is historical only — current known-issues
tracking, if any, should get a fresh pass rather than reusing that file's stale items.
