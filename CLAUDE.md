# JOURNAL

CLI (`journal`) for a development methodology built around four principles: **engagement**,
**understanding**, **provenance**, and **friction against blind acceptance** of AI output.

Full design: `docs/JOURNAL-spec.md`. User-facing usage: `README.md`. Prior testing notes:
`docs/v1-feedback.md`, `docs/v2-feedback.md`, `docs/v3-feedback.md`, and the `docs/v*-testing-guide.md`
files — historical record of dogfooding rounds that have since been triaged into the spec/code;
not a live issue tracker.

## Core model

Every feature is decomposed into **steps** (default: Logic → Code → Test → Document, configurable
per feature). Each step is tagged with attribution — `person`, `ai`, or `legacy` — **auto-detected
from tool usage at commit time, never asked interactively** (spec §5), and committed to git
individually via the unified `journal commit <step> <feature>`, producing a granular, attributable
history. Attribution also carries a specific **identity** — the git author name for `person`, or
the actual model id (e.g. `claude-sonnet-5`) for `ai`, captured automatically off the commit/draft
call rather than self-reported. `journal commit` rebuilds `JOURNAL/index.html` automatically
afterward — never run `build-dashboard` manually except to force a rebuild without committing
anything. When a feature changes materially after completion, `new-version <feature>` starts a
fresh revision pass — brain-dump/sketch/test-outline history is archived alongside fresh files
(e.g. `brain-dump.v1.md`), and code/test snapshots are archived too (`code-v1/`, `test.v1.md`).
Old content with a local archive (code/test) stays a real link in the dashboard; everything else
remains viewable only via its recorded commit SHA (`git show <sha>:<path>`). `Code` is AI-authored:
`draft code` writes real files into `src/` (paths inferred from committed Logic), not just a
snapshot of manually-written code. `JOURNAL/index.json` is a generated aggregate of
`JOURNAL/index-fragments/*.json` (the actual per-feature write targets, §8.1) — never hand-edit
either `index.json` or `index.html`.

Project-level (not per-feature) artifacts live under `JOURNAL/SRS/`: `style.md` and
`architecture.md` (global rules plus optional per-`group` override sections, §7), and
`brain-dump.md`/`features.md`, the SRS-driven feature-discovery pair (§9.2) that `draft-features`/
`commit-features` read and write — the primary path for registering new features, with
`add-feature` kept only for a deliberate one-off addition (e.g. an integration-test
pseudo-feature). The errors lifecycle is a full loop, not just a log: `log-error` →
`fix-error` (organize-not-invent plan into `errors/fix-plan.md`, round-labeled per error id) →
`apply-fix` (the only place AI writes an error fix, gated on a reviewed plan already existing) →
`resolve-error` (verification checkpoint; attribution is inherited from the fix-plan's origin, not
declared at resolve time). `commit test` auto-opens an error entry when the automated run actually
fails (not for an unchecked manual item).

## Architecture

```
src/cli.js                           — commander program, all command wiring
src/commands/                        — one file per command: init, journalInit, draftFeatures
                                        (`draft-features`, replaces list-features, §9.2),
                                        commitFeatures (`commit-features`), addFeature, setGroup,
                                        renameGroup, removeFeature, listSteps, addStep,
                                        draftStep (unified `draft <step>`), commitStep (unified
                                        `commit <step>`), newVersion, logError, fixError,
                                        applyFix (`apply-fix`), resolveError, buildDashboard
src/lib/ai.js                        — prompt-building for every AI-assisted command
src/lib/ai-providers/provider.js     — global config resolution + adapter registry
src/lib/ai-providers/claude-cli.js   — the only v1 adapter: shells out to `claude -p` (headless
                                        Claude Code CLI) with --output-format json when available
                                        (to capture the responding model's id), auth via existing
                                        subscription, not a separate ANTHROPIC_API_KEY. Retries a
                                        structured call up to 3x on a malformed-JSON response.
src/lib/ai-providers/util.js         — shared JSON-extraction helper for structured output
src/lib/hash.js                      — sha256 helpers backing attribution + drift detection (§6.5)
src/lib/logicIntegrity.js            — checks logic.md against what was last committed; called at
                                        the top of every draft/commit call for a feature, since
                                        Logic has no upstream to append a drift note to (§6.5)
src/lib/dependencies.js              — extracts a `depends-on:` line from committed Logic (§4.8)
src/lib/imports.js                   — textual import/require scanning: external `libraries`
                                        (§6.2) and the §4.8 missed-dependency safety net
src/lib/index-store.js               — fragment-sharded storage (§8.1): loadFeature/saveFeature
                                        read/write exactly one feature's JSON file under
                                        index-fragments/; aggregateIndex() is the only path that
                                        reads across all of them (build-dashboard only)
src/lib/featuresDoc.js               — render/parse for JOURNAL/SRS/features.md (§9.2): one
                                        "## <slug>" block per feature, human-editable and
                                        machine-parseable
src/lib/errorLog.js                  — shared open-entry + errors.md-append helpers behind both
                                        `log-error` and `commit test`'s automatic logging on a
                                        failing run (§4.6)
src/lib/fixPlan.js                   — shared helpers for errors/fix-plan.md's format: one file,
                                        many errors, each error's rounds labeled "## Plan for
                                        Error #<id> — Round <n>" (§4.6)
src/lib/safePath.js                  — `assertSafeRelPath`, shared by any command that lets AI
                                        write real files (draft code, draft test, apply-fix):
                                        refuses a path that escapes the project root or targets
                                        JOURNAL/ itself
src/lib/dashboard.js, dashboard-template.html
                                      — aggregated index → dashboard-data transform, and the
                                        interactive template it's injected into (search, version
                                        chips, errors panel, List/Graph toggle — template JS is
                                        reusable as-is). Non-current code/test steps stay real
                                        links when a local archive exists; the git-show hint is
                                        the fallback otherwise (§6.3)
src/lib/frontmatter.js, git.js, paths.js, templates.js
                                      — supporting plumbing (templates.js also owns the
                                        round-labeled brain-dump.md/sketch.md/test-outline.md
                                        convention: frontmatter + `## Round N` sections, archived
                                        rather than erased on new-version; paths.js resolves
                                        `style.md`/`architecture.md`/`brain-dump.md`/`features.md`
                                        under `JOURNAL/SRS/`)
```

Commands never call an AI provider adapter directly — they call functions in `src/lib/ai.js`
(`proposeFeatures`, `draftLogic`, `draftCode`, `draftTest`, `annotateCode`, `draftFixPlan`,
`draftFixCode`, etc.), which call `getProvider().generate(prompt, { system, structured })`. Adding
a second provider means adding one file to `ai-providers/` plus a registry entry; no command code
changes.

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
- `fix-error` never writes or edits code — it only appends a round to `errors/fix-plan.md`
  (organize-not-invent: the human's own fix steps if given, otherwise an AI-proposed diagnosis +
  steps). `apply-fix` is the **only** place AI is allowed to write an error fix, and only because
  a reviewed plan already exists behind it (spec §4.6) — this replaced an earlier, stricter
  diagnosis-only design once the author's own spec revision explicitly asked for `apply-fix`.
  Don't loosen this further (e.g. skipping the fix-plan step, or letting `resolve-error` write
  code) without the author explicitly asking for it again.
- Any path an AI-assisted command writes to disk (`draft code`, `draft test`, `apply-fix`) is
  validated to stay inside the project root and outside `JOURNAL/` (`assertSafeRelPath` in
  `src/lib/safePath.js`) — don't relax this without a reason.
- `index.html`/`index.json` are generated but still belong in git (spec's stated design, §12) —
  `build-dashboard` commits them itself via `stageAndCommitIfChanged` when they actually changed;
  don't reintroduce a path where they're regenerated but never staged.

## Status

v2 (the spec's major overhaul — versions, groups, real AI-authored code, two-phase test
generation, drift detection, code annotations, `journal-init` bootstrap, errors-with-attribution,
`style.md`, unified `draft`/`commit`, an interactive dashboard) plus the v3 additions (fragment-
sharded storage, identity capture, cross-feature dependencies + graph view, `fix-error`
diagnosis, and a round of UX fixes from real dogfooding) are built end-to-end and hand-verified
against the real `claude -p` adapter in scratch repos. The project itself was renamed from "The
Ledger Method" to JOURNAL — `LEDGER/` is now `JOURNAL/`, the `ledger` binary is now `journal`,
`ledger-init` is now `journal-init`.

A v4 round (spec-driven feature discovery, the fuller errors lifecycle, and a per-component style/
architecture split) is also built and hand-verified end-to-end against the real `claude -p`
adapter: `list-features` was replaced by `draft-features`/`commit-features`, reading/writing
`JOURNAL/SRS/brain-dump.md` and `SRS/features.md` (four branches — fresh input, existing brain
dump, code-scan when both are empty, or ask — §9.2); `journal-init` now triggers that same
code-scanning branch rather than its own separate scanner. `style.md`/`architecture.md` moved to
`JOURNAL/SRS/`, with an optional `## <group-name>` section read alongside the global rules for a
feature tagged with that group (§7 — `group` doubles as "component" here; JOURNAL has no separate
component concept). The errors lifecycle grew a middle: `fix-error` now writes a round-labeled
`errors/fix-plan.md` (was diagnosis-only into `errors/diagnosis.md`) and a new `apply-fix` command
writes the actual fix from that reviewed plan; `resolve-error` dropped `--agent` and now inherits
attribution from the fix-plan's origin. `commit test` auto-opens an error entry on an actual test
failure. One deliberate deviation from the literal spec text worth knowing: the dashboard keeps
real clickable links to locally-archived historical code/test snapshots (`code-v<N>/`,
`test.v<N>.md`) rather than reducing every non-current version to a `git show` hint — confirmed
with the author during implementation, since the archive-link capability already existed and
worked (§6.3, §8).

`docs/v1-feedback.md`/`docs/v2-feedback.md`/`docs/v3-feedback.md` are historical only — current
known-issues tracking, if any, should get a fresh pass rather than reusing those files' stale
items.
