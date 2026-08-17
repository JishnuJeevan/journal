# The Ledger Method

A CLI for a development methodology built around four principles: **engagement**,
**understanding**, **provenance**, and **friction against blind acceptance** of AI output.

Every feature in a project is decomposed into **steps** (default: Logic → Code → Test →
Document). Each step is tagged with who did it — `person`, `ai`, or `person+ai` — and
committed to git individually, producing a granular, attributable history. When a feature
changes materially after completion, a new **column** starts a fresh revision pass; old
columns remain viewable via their recorded commit SHAs.

Full design: [`docs/LEDGER-method-spec.md`](docs/LEDGER-method-spec.md).

## Install

```bash
npm install
npm link   # makes `ledger` available on your PATH
```

AI-assisted commands (`list-features`, `list-steps`, `draft-logic`) go through a single
internal `AIProvider.generate(prompt, options)` interface (spec §10) rather than calling any
provider's SDK/API directly. v1 ships one adapter — `claude-cli` — which shells out to the
Claude Code CLI in headless mode (`claude -p`), authenticated via your existing Claude Code
subscription rather than a separate pay-per-token `ANTHROPIC_API_KEY`. Make sure `claude` is
installed and logged in:

```bash
claude --version
```

Provider choice is a single global setting for the whole project, stored in
`LEDGER/config.json` (written by `ledger init`):

```json
{ "aiProvider": "claude-cli" }
```

There's no per-command or per-step override in v1 (deferred — spec §11). If the `claude`
binary is on your PATH under a different name, set `LEDGER_CLAUDE_BIN`; extra flags to pass
through to `claude -p` can be set via `LEDGER_CLAUDE_CLI_ARGS`.

## Workflow

```bash
cd your-project        # must be a git repo
ledger init             # scaffolds LEDGER/

ledger list-features "brain dump of what you're building"
# → AI proposes features, you confirm which to register

ledger list-steps user-authentication
# → AI proposes a step pipeline (default: logic, code, test, document), you confirm/edit

ledger draft-logic user-authentication
# → AI improvises a starting point for LEDGER/features/user-authentication/logic/logic.md
#   from the feature's name + description alone

ledger draft-logic user-authentication "users log in with email + magic link, session in a cookie, ..."
# → AI instead organizes YOUR brain dump into a coherent draft, grounded in what you wrote

# either way, edit the draft into your own words, then:
ledger commit-logic user-authentication --attribution person

# ... write the actual code in src/, then:
ledger commit-code user-authentication --attribution person+ai
# first run prompts for which src paths belong to this feature; snapshotted into
# LEDGER/features/user-authentication/code/ and committed alongside the real src/ files

ledger commit-test user-authentication --attribution person
ledger commit-document user-authentication --attribution ai

ledger build-dashboard   # regenerates LEDGER/index.html — never hand-edit it

# later, when the feature needs to change materially:
ledger new-column user-authentication
```

Any `--attribution` can be omitted and you'll be prompted interactively instead.

## Commands

| Command | Purpose |
|---|---|
| `ledger init` | Scaffold `LEDGER/` in the current git repo. |
| `ledger list-features "<brain dump>"` | AI proposes features; you confirm which to register. |
| `ledger list-steps <feature> [-d "description"]` | AI proposes a step pipeline; you confirm/edit, then it's locked in. |
| `ledger draft-logic <feature> ["<brain dump>"]` | AI drafts a starting point for the Logic step — improvised from the feature's description alone, or organized from your own brain dump if you pass one. |
| `ledger commit-logic\|commit-code\|commit-test\|commit-document <feature> [-a person\|ai\|person+ai]` | Commit that step, recording attribution and SHA into `LEDGER/index.json`. |
| `ledger commit <feature> <step>` | Generic form of the above, for custom steps (e.g. `qa`, `verification`). |
| `ledger new-column <feature>` | Start a new revision pass; resets working files for all of the feature's steps. |
| `ledger log-error <feature> [-e "..."] [-r "..."]` | Append an entry to `LEDGER/Errors/<feature>/errors.md`. |
| `ledger build-dashboard` | Regenerate `LEDGER/index.html` from `LEDGER/index.json`. |

`--add-path <path>` on the code commands links additional source paths (repeatable) to a
feature; the first `commit-code` run prompts for these if none are linked yet.

## AI provider architecture (spec §10)

```
src/lib/ai.js                        — prompt-building for each AI-assisted command
src/lib/ai-providers/provider.js     — global config resolution + adapter registry
src/lib/ai-providers/claude-cli.js   — the only v1 adapter (`claude -p`, headless)
src/lib/ai-providers/util.js         — shared JSON-extraction helper for structured output
```

Commands never call an adapter directly — they call `proposeFeatures` / `proposeSteps` /
`draftLogic` in `ai.js`, which call `getProvider().generate(prompt, { system, structured })`.
Adding a second provider later (OpenAI/Codex, Gemini — deferred per spec §11) means adding one
file to `ai-providers/` and a registry entry; no command code changes.

## Design decisions made for v1

These were open questions in the spec, resolved for this implementation:

- **Dashboard data source:** a separate `LEDGER/index.json` (not front-matter scanning) is
  the source of truth for `build-dashboard`, for performance on larger projects (§7.1). Every
  `commit-*` command writes to it as part of the same invocation. The step `.md` file's own
  content/attribution is committed first; the resulting SHA is then recorded into both the
  file's frontmatter and `index.json` together, in one commit. If that second commit fails,
  the tool fails loudly with the orphaned SHA and recovery instructions rather than silently
  leaving the index stale (§6.4).
- **Errors log:** tracked on disk (`LEDGER/Errors/<feature>/errors.md`, via `log-error`) but
  **not** surfaced in the dashboard in v1 (§11).
- **Folder name:** `LEDGER/` (the method is "The Ledger Method").
- **AI backend:** single global `AIProvider.generate()` interface; only adapter is
  `claude-cli` (`claude -p`, subscription-based, no separate API key) — see above (§10).

One thing not in the spec but worth flagging as an implementation choice:

- **Which files belong to a feature's code snapshot** isn't specified by the spec. v1 asks
  once per feature (on first `commit-code`) and remembers the answer in `index.json` as
  `codePaths`; add more later with `--add-path`.

Everything else in the spec's open-questions section (integration/cross-feature testing,
generalizing beyond coding, technical enforcement of attribution, per-step AI provider
config, non-Claude adapters) is out of scope for v1, as the spec directs.

Note: the spec has since grown further (§8: `ledger-init` bootstrap onboarding for existing
projects, `add-feature`, `legacy` attribution) beyond what this codebase implements — that's a
separate, larger piece of work not yet built.

## Tests

```bash
npm test
```

Covers the pure dashboard-rendering logic. The git-integrated commands, and the AI provider
plumbing (`claude -p` adapter, structured JSON parsing, `list-features` end-to-end through a
real Claude Code CLI session), were exercised by hand in scratch repos during development;
they aren't yet covered by automated tests since they need a real git repo and, for the AI
commands, the `claude` CLI installed and logged in.
