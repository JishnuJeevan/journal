# The Ledger Method

A CLI for a development methodology built around four principles: **engagement**,
**understanding**, **provenance**, and **friction against blind acceptance** of AI output.

Every feature in a project is decomposed into **steps** (default: Logic → Code → Test →
Document, customizable per feature). Each step is tagged with attribution — `person`, `ai`, or
`legacy` — **detected automatically from tool usage, never self-reported** (§5), and committed
to git individually, producing a granular, attributable history. When a feature changes
materially after completion, `new-version` starts a fresh revision pass; old versions remain
viewable via their recorded commit SHAs.

Full design: [`docs/LEDGER-method-spec.md`](docs/LEDGER-method-spec.md).

## Install

```bash
npm install
npm link   # makes `ledger` available on your PATH
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
`LEDGER/config.json` (written by `ledger init`), which also holds the shell command used to
run this project's automated tests (`testCommand`, prompted for lazily on the first
`ledger commit test`):

```json
{ "aiProvider": "claude-cli", "testCommand": "npm test" }
```

If the `claude` binary is on your PATH under a different name, set `LEDGER_CLAUDE_BIN`; extra
flags to pass through to `claude -p` can be set via `LEDGER_CLAUDE_CLI_ARGS`.

## Workflow

```bash
cd your-project        # must be a git repo
ledger init             # scaffolds LEDGER/ (index.json, config.json, style.md)

# --- starting a new project ---
ledger list-features "brain dump of what you're building"
# → AI proposes features (+ a group tag per feature), you confirm which to register
ledger add-feature password-reset "..." --group authentication   # or add one at a time

# --- or bootstrapping onto an existing codebase ---
ledger ledger-init
# → scans tracked files, proposes a feature decomposition + pipeline per feature, snapshots
#   Code immediately with attribution "legacy"; Logic/Test/Document left blank. Safe to re-run.

ledger list-steps user-authentication
# → AI proposes a step pipeline (default: logic, code, test, document), you confirm/edit

# --- Logic: the human's own understanding is the product ---
ledger draft logic user-authentication "users log in with email + magic link, session in a cookie"
# → adds this to LEDGER/features/user-authentication/logic/brain-dump.md (a persistent, round-
#   labeled history) and has AI organize the FULL history into logic.md — never inventing logic
#   you didn't provide. Bare `ledger draft logic user-authentication` (no text) improvises from
#   just the feature's name + description instead.
# Edit the draft into your own words, then:
ledger commit logic user-authentication
# attribution is auto-detected — "person" if brain-dump.md has content, "ai" if not

# --- Code: AI implements from committed Logic ---
ledger draft code user-authentication ["optional code-level sketch"]
# → writes real files into src/ (paths inferred from Logic), flags unfamiliar terms not implied
#   by Logic into code/annotations.md, links the written paths as this feature's codePaths
ledger commit code user-authentication
# runs a post-commit drift check if you hand-edited the code after drafting it

# --- Test: outline first, then real generated tests ---
ledger draft test user-authentication
# 1st run: proposes an automatable/manual split into test/test-outline.md — edit it freely
ledger draft test user-authentication
# 2nd run (outline exists): generates a real, runnable test file + test/test.md snapshot
ledger commit test user-authentication
# blocks until your test command passes AND every manual checklist item is checked off

# --- Document: drafts from committed Logic + Code ---
ledger draft document user-authentication ["or your own notes to organize instead"]
ledger commit document user-authentication

# LEDGER/index.html is regenerated automatically after every `ledger commit` — never hand-edit it.

# later, when the feature needs to change materially:
ledger new-version user-authentication
```

## Commands

| Command | Purpose |
|---|---|
| `ledger init` | Scaffold `LEDGER/` in the current git repo. |
| `ledger ledger-init` | One-time bootstrap for an existing codebase: proposes features + pipelines from tracked files, snapshots Code with attribution `legacy`. Safe to re-run. |
| `ledger list-features "<brain dump>"` | AI proposes features (+ group tags); you confirm which to register. |
| `ledger add-feature <name> ["desc"] [-g/--group <name>]` | Register a single feature. |
| `ledger set-group <feature...> [<group-name>]` | Assign a group tag to one or more features; omit the group name to clear it. |
| `ledger rename-group <old> <new>` | Retag every feature currently tagged `<old>`. |
| `ledger remove-feature <feature>` | Mark a feature removed (hidden by default in the dashboard) — doesn't delete its LEDGER history. |
| `ledger list-steps <feature> [-d "description"]` | AI proposes a step pipeline; you confirm/edit, then it's locked in. |
| `ledger add-step <feature> <stepName>` | Register an additional step for a feature already underway. |
| `ledger draft <step> <feature> ["description"]` | AI drafts (or organizes your notes into) content for a step. Step-specific: Logic manages a persistent `brain-dump.md`; Code writes real files under `src/` + `annotations.md`; Test is two-phase (outline, then real content); Document drafts from committed Logic+Code; any other step follows description/template/blank. |
| `ledger commit <step> <feature> [--add-path <path>]` | Commit the step. Attribution is auto-detected (never asked). `commit test` blocks until automated tests pass and the manual checklist is fully checked. Dashboard is rebuilt automatically afterward. |
| `ledger new-version <feature>` | Start a new revision pass; resets working files for its steps. |
| `ledger log-error <feature> ["desc"]` | Append an open entry to the feature's Errors log — pipe output in (`npm test \| ledger log-error x`) or pass a description. |
| `ledger resolve-error <feature> ["fix note"] [--id <n>] [--agent]` | Resolve the most recent open error (or a specific one). `--agent` marks attribution `ai`. |
| `ledger build-dashboard` | Regenerate `LEDGER/index.html` from `LEDGER/index.json` (also runs automatically after every commit). |

## Attribution (spec §5)

Never asked interactively — computed from tool usage at commit time:

- **Logic / Document / custom steps:** `person` if the step's `brain-dump.md` has content, `ai` if not.
- **Code:** `person` if `code/sketch.md` has content, `ai` if not.
- **Test:** `person` if `test-outline.md` was edited from what AI proposed, `ai` if not.
- **Any step that was never drafted at all** (hand-authored from scratch, bypassing `draft` entirely) is `person`.
- **`legacy`** is only set by `ledger-init`'s bootstrap of pre-existing code.

## Drift detection (spec §6.5)

After `commit code`/`commit test`, if the committed content differs from what `draft` last
generated (a direct hand-edit happened in between), the tool asks a single, skippable,
non-blocking question — *"You edited this directly — what changed, in one sentence?"* — and
appends the answer to the relevant upstream file (`logic.md` for code edits, `test-outline.md`
for test edits). Skipped in non-interactive environments rather than hanging.

## Dashboard (`LEDGER/index.html`)

Rebuilt automatically after every `ledger commit`, from `src/lib/dashboard-template.html` (an
interactive template — search, per-feature version chips, an expandable Errors panel) with the
real `LEDGER/index.json` data injected in. Historical (non-current) versions show their
attribution/SHA/date but no live link, since step files are overwritten each version — full
historical content stays reachable via `git show <sha>:<path>` (§6.3).

## AI provider architecture (spec §10)

```
src/lib/ai.js                        — prompt-building for every AI-assisted command
src/lib/ai-providers/provider.js     — global config resolution + adapter registry
src/lib/ai-providers/claude-cli.js   — the only v1 adapter (`claude -p`, headless)
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
`src/lib/dashboard.js` (the `index.json` → dashboard-data transform). The git-integrated
commands, and the real `claude -p` adapter, are exercised by hand in scratch repos — they need a
real git repo and a logged-in `claude` CLI.
