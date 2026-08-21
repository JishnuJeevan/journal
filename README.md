# JOURNAL

A CLI for spec-driven development that's atomic and active: every feature gets its own
Logic (a spec, written before its Code), and the tool actively checks that code stays honest
to it as things change — rather than one project-wide spec, written once and left to go stale.

Every feature in a project is decomposed into **steps** (default: Logic → Code → Test →
Document, customizable per feature). Each step is tagged with attribution — `person`, `ai`, or
`legacy` — **detected automatically from tool usage, never self-reported** (§5), plus a specific
**identity** (the git author's name, or the actual AI model id) — and committed to git
individually, producing a granular, attributable history. When a feature changes materially
after completion, `new-version` starts a fresh revision pass, archiving the old brain-dump/
sketch/test-outline/code/test history alongside the fresh files rather than erasing it.

Full design: [`docs/JOURNAL-spec.md`](docs/JOURNAL-spec.md).

## Install

```bash
npm install
npm link   # makes `journal` available on your PATH
```

AI-assisted commands go through a single internal `AIProvider.generate(prompt, options)`
interface (spec §10) rather than calling any provider's SDK/API directly. v1 ships one adapter
— `claude-cli` — which shells out to the Claude Code CLI in headless mode (`claude -p`),
authenticated via your existing Claude Code subscription rather than a separate pay-per-token
`ANTHROPIC_API_KEY`. Make sure `claude` is installed and logged in:

```bash
claude --version
```

Provider choice is a single global setting for the whole project, stored in
`JOURNAL/config.json` (written by `journal init`), which also holds the shell command used to
run this project's automated tests (`testCommand`, prompted for lazily on the first
`journal commit test`):

```json
{ "aiProvider": "claude-cli", "testCommand": "npm test" }
```

If the `claude` binary is on your PATH under a different name, set `JOURNAL_CLAUDE_BIN`; extra
flags to pass through to `claude -p` can be set via `JOURNAL_CLAUDE_CLI_ARGS`.

## Workflow

```bash
cd your-project        # must be a git repo
journal init             # scaffolds JOURNAL/ (index-fragments/, config.json, SRS/style.md,
                          # SRS/architecture.md, SRS/brain-dump.md)

# --- starting a new project ---
journal draft-features "brain dump of what you're building"
# → appends your text to JOURNAL/SRS/brain-dump.md as a new labeled round, then AI derives a
#   feature list into JOURNAL/SRS/features.md, ordered simplest-to-hardest to implement. Open
#   features.md and edit freely — reword, merge, split, or delete an entry — then:
journal commit-features
# → registers every feature still listed. Re-run draft-features any time to add more (re-derives
#   features.md from the full current brain-dump.md; never auto-removes a previously-tracked
#   feature, just flags it if one seems to have dropped out of the current brain dump).
#   Features start ungrouped, always — nothing here or in journal-init's code scan ever assigns
#   a group. Group them yourself once you see how they cluster:
journal set-group password-reset signup authentication   # last arg is the group name
journal add-feature password-reset "..." --group authentication   # or add one at a time
#   (add-feature is for a deliberate one-off addition, e.g. an integration-test pseudo-feature —
#   it skips the features.md review step, but still logs into SRS/brain-dump.md's history)

# --- or bootstrapping onto an existing codebase ---
journal journal-init
# → scaffolds JOURNAL/ for you if you haven't run init yet, then scans tracked files (the same
#   code-scanning branch draft-features falls back to) and proposes a feature decomposition +
#   pipeline per feature, snapshots Code immediately with attribution "legacy"; Logic/Test/
#   Document left blank. Safe to re-run. Same as above: nothing here is pre-grouped.

journal list-steps user-authentication
# → AI proposes a step pipeline (default: logic, code, test, document), you confirm/edit.
#   This also pre-creates brain-dump.md / sketch.md / test-outline.md, so there's somewhere to
#   write a large round of notes directly in a file instead of a CLI string argument.

# --- Logic: the human's own understanding is the product ---
journal draft logic user-authentication "users log in with email + magic link, session in a cookie"
# → adds this to JOURNAL/features/user-authentication/logic/brain-dump.md (a round-labeled
#   history for THIS version — reset fresh on new-version) and has AI organize the full current
#   history into logic.md — never inventing logic you didn't provide. Bare
#   `journal draft logic user-authentication` (no text) improvises from just the feature's name +
#   description instead; `--file` reads brain-dump.md's current content directly, for when
#   you've written a lot there instead of passing it inline.
# also reads JOURNAL/SRS/architecture.md as background context (project-wide system shape, plus
# an optional per-group override section — see §7 below), so the feature's Logic stays
# consistent with the bigger picture without restating it
# Name a cross-feature dependency by adding a line "depends-on: other-feature-slug" (§4.8) —
# extracted at commit time, feeds the dashboard's dependency graph.
# Edit the draft into your own words, then:
journal commit logic user-authentication
# attribution is auto-detected — "person" if brain-dump.md has content, "ai" if not — plus your
# git author name (person) or the model that drafted it (ai)
# logic.md is now locked for this version — any hand-edit bypassing new-version is flagged
# (non-blocking) the next time you draft/commit ANY step on this feature

# --- Code: AI implements from committed Logic ---
journal draft code user-authentication ["optional code-level sketch"]
# → writes real files into src/ (paths inferred from Logic), flags unfamiliar terms not implied
#   by Logic into code/annotations.md, links the written paths as this feature's codePaths.
#   Also reads JOURNAL/SRS/style.md (+ per-group override) before generating.
journal commit code user-authentication
# scans imports to record external packages as this feature's `libraries` (§6.2), and warns
# (non-blocking) if code imports another feature's files without a matching `depends-on:` (§4.8)
# runs a post-commit drift check if you hand-edited the code after drafting it

# --- Test: outline first, then real generated tests ---
journal draft test user-authentication
# 1st run: proposes an automatable/manual split into test/test-outline.md — edit it freely
journal draft test user-authentication
# 2nd run (outline has content): generates a real, runnable test file + test/test.md snapshot,
#   with a "how to run" section and instructions for what to write next to each manual checkbox
journal commit test user-authentication
# blocks until your test command passes AND every manual checklist item is checked off; stamps
# test.md with when/how it was last verified. A REAL test failure (not just an unchecked manual
# item) auto-opens an error entry with the failing output captured — see the errors lifecycle below.

# --- Errors: log, plan a fix, apply it, verify it ---
npm test 2>&1 | journal log-error user-authentication "trying to log in with a valid magic link"
# pipe fills the raw error-output slot automatically; the second arg is your own description
journal fix-error user-authentication
# organize-not-invent, same pattern as Logic: give your own fix steps as an argument and AI
# organizes them (attribution person), or leave it blank and AI proposes a diagnosis + fix steps
# (attribution ai). Appended as a new round to errors/fix-plan.md, cross-referenced by error id —
# review/edit that file directly if you want, same as test-outline.md. Never edits code itself.
journal apply-fix user-authentication
# reads the current fix-plan and writes the actual code fix — the only place AI writes an error
# fix, and only because a reviewed plan already exists behind it
# review + test the fix yourself, then:
journal resolve-error user-authentication "confirmed the magic-link expiry check now works"
# no --agent flag: attribution is inherited automatically from whoever's fix-plan it was (person
# if you gave the steps, ai if AI proposed them) — nothing to declare at resolve time

# --- Document: drafts from committed Logic + Code ---
journal draft document user-authentication ["or your own notes to organize instead"]
journal commit document user-authentication

# JOURNAL/index.html is regenerated automatically after every `journal commit` (and after
# init/journal-init/draft-features/commit-features/add-feature/set-group/etc.) — never hand-edit it.

# later, when the feature needs to change materially:
journal new-version user-authentication
# brain-dump.md/sketch.md/test-outline.md are archived (e.g. brain-dump.v1.md) and start fresh;
# the previous code/test snapshots are archived too (code-v1/, test.v1.md)
```

## Commands

| Command | Purpose |
|---|---|
| `journal init` | Scaffold `JOURNAL/` in the current git repo, including `JOURNAL/SRS/`. |
| `journal journal-init` | One-time bootstrap for an existing codebase: proposes features + pipelines from tracked files (same code-scanning branch as `draft-features`), snapshots Code with attribution `legacy`. Safe to re-run. |
| `journal draft-features ["<brain dump>"] [--file]` | SRS-driven feature discovery: appends to `JOURNAL/SRS/brain-dump.md` and (re)derives `JOURNAL/SRS/features.md`, or scans existing tracked code if the brain dump is still empty. Ordered simplest-to-hardest; features start ungrouped. |
| `journal commit-features` | Reviews `JOURNAL/SRS/features.md` and registers every newly-listed feature. Never auto-removes a previously-tracked feature — flags a mismatch instead. |
| `journal add-feature <name> ["desc"] [-g/--group <name>]` | Register a single feature directly (skips the features.md review step); still logged into `SRS/brain-dump.md`'s history. |
| `journal set-group <feature...> [<group-name>]` | Assign a group tag to one or more features; omit the group name to clear it. |
| `journal rename-group <old> [<new>]` | Retag every feature currently tagged `<old>`; omit `<new>` to ungroup them instead. |
| `journal remove-feature <feature>` | Mark a feature removed (hidden by default in the dashboard) — doesn't delete its JOURNAL history. |
| `journal list-steps <feature> [-d "description"]` | AI proposes a step pipeline; you confirm/edit, then it's locked in. Pre-creates brain-dump.md/sketch.md/test-outline.md. |
| `journal add-step <feature> <stepName>` | Register an additional step for a feature already underway. |
| `journal draft <step> <feature> ["description"] [--file]` | AI drafts (or organizes your notes into) content for a step. `--file` reads the round file directly instead of an inline arg. Step-specific: Logic manages a per-version `brain-dump.md`; Code writes real files under `src/` + `annotations.md`; Test is two-phase (outline, then real content); Document drafts from committed Logic+Code; any other step follows description/template/blank. |
| `journal commit <step> <feature>` | Commit the step. Attribution + identity are auto-detected (never asked). `commit test` blocks until automated tests pass and the manual checklist is fully checked, and auto-logs an error entry on a real test failure. Dashboard is rebuilt (and committed) automatically afterward. |
| `journal new-version <feature>` | Start a new revision pass; archives brain-dump/sketch/outline/code/test history and resets working files. |
| `journal log-error <feature> [errorOutput] [description]` | Append an open entry to the feature's Errors log. Pipe output in (`npm test \| journal log-error x "what I was doing"`) to fill `errorOutput` automatically. |
| `journal fix-error <feature> ["steps"] [--id <n>] [--file]` | Organize-not-invent, same pattern as `draft`: give your own fix steps (attribution `person`) or leave blank for an AI-proposed diagnosis + fix steps (attribution `ai`). Appends a round to `errors/fix-plan.md`, cross-referenced by error id. Never edits code; defaults to the most recent open error. |
| `journal apply-fix <feature> [--id <n>]` | Reads the current fix-plan and writes the actual code fix — the only place AI is allowed to write an error fix, and only because a reviewed plan already exists. |
| `journal resolve-error <feature> ["fix note"] [--id <n>]` | Verification checkpoint — confirms a fix actually works, marking the entry resolved. Attribution is inherited from the fix-plan's origin, not declared here. |
| `journal build-dashboard` | Aggregate `index-fragments/*.json` into `index.json`, then regenerate `index.html` (also runs automatically after most commands). |

## Attribution & identity (spec §5)

Never asked interactively — computed from tool usage at commit time:

- **Logic / Document / custom steps:** `person` if the step's `brain-dump.md` has content, `ai` if not.
- **Code:** `person` if `code/sketch.md` has content, `ai` if not.
- **Test:** `person` if `test-outline.md` was edited from what AI proposed, `ai` if not.
- **A resolved error:** inherited from whichever origin its `fix-plan.md` entry had — `person` if you gave the fix steps, `ai` if AI proposed them.
- **Any step that was never drafted at all** (hand-authored from scratch, bypassing `draft` entirely) is `person`.
- **`legacy`** is only set by `journal-init`'s bootstrap of pre-existing code.

Each entry also carries a specific **identity**: the git author's name for `person` (read off the
commit itself), or the actual responding model id for `ai` (e.g. `claude-sonnet-5`) — captured
from the AI provider at draft time, not self-reported.

## Cross-feature dependencies (spec §4.8)

Declared, not inferred: add a line `depends-on: other-feature-slug, another-slug` anywhere in a
feature's Logic, and `commit logic` extracts it. Feeds the dashboard's List/Graph toggle (a
dependency graph, features as nodes). As a safety net, `commit code` warns (non-blocking) if the
code imports another feature's files without a matching declaration.

## Drift detection (spec §6.5)

After `commit code`/`commit test`, if the committed content differs from what `draft` last
generated (a direct hand-edit happened in between), the tool asks a single, skippable,
non-blocking question — *"You edited this directly — what changed, in one sentence?"* — and
appends the answer to the relevant upstream file (`logic.md` for code edits, `test-outline.md`
for test edits). Skipped in non-interactive environments rather than hanging.

**Logic integrity** gets the equivalent protection, but differently — Logic *is* the upstream, so
there's nowhere to append a note. Once `commit logic` runs, `logic.md` is meant to stay locked
until `new-version`; any `draft`/`commit` call on that feature (for any step, not just Logic)
checks whether `logic.md` still matches what was committed, and — if it was hand-edited outside
the proper flow — prints a non-blocking warning pointing at `new-version` immediately, every time,
until you either run `new-version` or the check no longer applies.

## Storage: sharded fragments (spec §8.1)

Every `commit`/`add-feature`/`set-group`/etc. reads and writes only the fragment(s) for the
feature(s) it's touching, under `JOURNAL/index-fragments/<slug>.json` — two people committing to
different features never collide, since they touch different files. `JOURNAL/index.json` is a
generated aggregate of all fragments, rebuilt (and committed) by `build-dashboard`; never
hand-edit it or the fragments directly.

## Dashboard (`JOURNAL/index.html`)

Rebuilt automatically after most commands, from `src/lib/dashboard-template.html` (an interactive
template — search, per-feature version chips, an expandable Errors panel, a List/Graph toggle)
with the real aggregated `JOURNAL/index.json` data injected in. Only the *current* version of a
feature ever shows a real, clickable link to its step content — a non-current version always
shows a copyable `git show <sha>[:path]` hint instead, since step files are overwritten each
version (§6.3), even for code/test steps that happen to have a locally-archived snapshot
(`code-v1/`, `test.v1.md`).

## Project-level style, architecture, and features (`JOURNAL/SRS/`, spec §7, §9.2)

Everything project-wide (not per-feature) lives under `JOURNAL/SRS/`:

- **`style.md`** — code style + testing preferences, read by `draft code`/`draft test` every time they run.
- **`architecture.md`** — project-wide system shape, read by `draft logic` as background context.
- **`brain-dump.md`** / **`features.md`** — the feature-discovery pair `draft-features`/`commit-features` read and write.

Both `style.md` and `architecture.md` support an optional **per-group override section** — most
projects only need the global rules at the top, but a `## <group-name>` heading (matching a
feature's group tag) lets a specific component carry its own additional notes, read alongside
the global rules for features tagged with that group.

## AI provider architecture (spec §10)

```
src/lib/ai.js                        — prompt-building for every AI-assisted command
src/lib/ai-providers/provider.js     — global config resolution + adapter registry
src/lib/ai-providers/claude-cli.js   — the only v1 adapter (`claude -p`, headless), captures the
                                        responding model's id via --output-format json when
                                        supported, and retries a malformed structured response
                                        up to 3x before giving up
src/lib/ai-providers/util.js         — shared JSON-extraction helper for structured output
```

Commands never call an adapter directly — they call functions in `ai.js`, which call
`getProvider().generate(prompt, { system, structured })`. Adding a second provider means adding
one file to `ai-providers/` and a registry entry; no command code changes.

## Tests

```bash
npm test
```

Covers the pure logic in `src/lib/ai.js` (prompt-building, via a `StubProvider`) and
`src/lib/dashboard.js` (the aggregated-index → dashboard-data transform). The git-integrated
commands, and the real `claude -p` adapter, are exercised by hand in scratch repos — they need a
real git repo and a logged-in `claude` CLI.
