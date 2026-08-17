# The Ledger Method

A CLI for a development methodology built around four principles: **engagement**,
**understanding**, **provenance**, and **friction against blind acceptance** of AI output.

Every feature in a project is decomposed into **steps** (default: Logic → Code → Test →
Document). Each step is tagged with who did it — `person`, `ai`, or `person+ai` — and
committed to git individually, producing a granular, attributable history. When a feature
changes materially after completion, a new **column** starts a fresh revision pass; old
columns remain viewable via their recorded commit SHAs.

Full design: [`docs/NOTES-method-spec.md`](docs/NOTES-method-spec.md).

## Install

```bash
npm install
npm link   # makes `ledger` available on your PATH
```

AI-assisted commands (`list-features`, `list-steps`, `draft-logic`) call Claude and require:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

## Workflow

```bash
cd your-project        # must be a git repo
ledger init             # scaffolds LEDGER/

ledger list-features "brain dump of what you're building"
# → AI proposes features, you confirm which to register

ledger list-steps user-authentication
# → AI proposes a step pipeline (default: logic, code, test, document), you confirm/edit

ledger draft-logic user-authentication
# → AI drafts a starting point for LEDGER/features/user-authentication/logic/logic.md
#   edit it into your own words, then:
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
| `ledger draft-logic <feature>` | AI drafts a starting point for the Logic step. |
| `ledger commit-logic\|commit-code\|commit-test\|commit-document <feature> [-a person\|ai\|person+ai]` | Commit that step, recording attribution and SHA into `LEDGER/index.json`. |
| `ledger commit <feature> <step>` | Generic form of the above, for custom steps (e.g. `qa`, `verification`). |
| `ledger new-column <feature>` | Start a new revision pass; resets working files for all of the feature's steps. |
| `ledger log-error <feature> [-e "..."] [-r "..."]` | Append an entry to `LEDGER/Errors/<feature>/errors.md`. |
| `ledger build-dashboard` | Regenerate `LEDGER/index.html` from `LEDGER/index.json`. |

`--add-path <path>` on the code commands links additional source paths (repeatable) to a
feature; the first `commit-code` run prompts for these if none are linked yet.

## Design decisions made for v1

These were open questions in the spec (§10), resolved for this implementation:

- **Dashboard data source:** a separate `LEDGER/index.json` (not front-matter scanning) is
  the source of truth for `build-dashboard`, for performance on larger projects. Every
  `commit-*` command writes to it as part of the same invocation. The step `.md` file's own
  content/attribution is committed first; the resulting SHA is then recorded into both the
  file's frontmatter and `index.json` together, in one commit. If that second commit fails,
  the tool fails loudly with the orphaned SHA and recovery instructions rather than silently
  leaving the index stale.
- **Errors log:** tracked on disk (`LEDGER/Errors/<feature>/errors.md`, via `log-error`) but
  **not** surfaced in the dashboard in v1.
- **Folder name:** `LEDGER/` (the method is "The Ledger Method").

Two things not in §10 but worth flagging as implementation choices, not spec requirements:

- **Which files belong to a feature's code snapshot** isn't specified by the spec. v1 asks
  once per feature (on first `commit-code`) and remembers the answer in `index.json` as
  `codePaths`; add more later with `--add-path`.
- **AI backend:** Claude via `@anthropic-ai/sdk`, using `ANTHROPIC_API_KEY`.

Everything else from §10 (integration/cross-feature testing, generalizing beyond coding,
technical enforcement of attribution) is out of scope for v1, as the spec directs.

## Tests

```bash
npm test
```

Covers the pure dashboard-rendering logic. The git-integrated commands were exercised
end-to-end by hand in a scratch repo during development (git plumbing, atomic
content-commit → index-commit sequencing, snapshot sync); they aren't yet covered by
automated tests since they need a real git repo and, for the AI commands, a live API key.
