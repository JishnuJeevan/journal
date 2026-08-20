# Testing the Ledger Method v2 — quick manual

Everything below assumes `ledger` is already on your PATH (it is — `npm link` was run once
from this repo, which is a global symlink, so it works from any project). Just `cd` into
whatever other project you want to test on. It must be a git repo (`git init` first if not),
and the `claude` CLI must be installed and logged in (`claude --version` to check).

## 0. Setup

```bash
cd /path/to/your-other-project
git status              # must be a git repo
ledger --help            # sanity check it's on PATH
```

## 1. Get the project into LEDGER

Pick ONE of these two:

**A — starting fresh / project has little existing code:**
```bash
ledger init
ledger list-features "<brain dump: what is this project, what are its main pieces>"
# → AI proposes features + group tags; pick which to register (space to toggle, enter to confirm)

# add more one at a time, any time:
ledger add-feature <name> "<description>" --group <group-name>
```

**B — project already has real code you want to bootstrap onto:**
```bash
ledger init
ledger ledger-init
# → scans tracked files, proposes a feature decomposition + pipeline per feature, snapshots
#   Code immediately (attribution "legacy"). Logic/Test/Document start blank — draft them below.
#   Safe to re-run any time; already-registered features are skipped.
```

## 2. Lock in a step pipeline (per feature)

```bash
ledger list-steps <feature>
# → AI proposes logic/code/test/document (or more, e.g. QA); accept, edit, or cancel
```

## 3. Work through the steps

```bash
# --- Logic (do this one first — everything else reads from it) ---
ledger draft logic <feature> "<your raw thinking on how this should work>"
# re-run with more text any time to refine; re-run with NO text to just regenerate from history
# open LEDGER/features/<feature>/logic/logic.md, edit it into your own words, then:
ledger commit logic <feature>

# --- Code (AI writes real files into your project) ---
ledger draft code <feature> ["optional rough code sketch"]
# review what got written + LEDGER/features/<feature>/code/annotations.md, edit as needed:
ledger commit code <feature>

# --- Test (two-phase: outline first, then real tests) ---
ledger draft test <feature>
# → writes LEDGER/features/<feature>/test/test-outline.md — open it, edit the checklist freely
ledger draft test <feature>
# → (outline now exists) generates a real, runnable test file + test/test.md
ledger commit test <feature>
# first time: it'll ask how to run your tests (e.g. "npm test") and save that answer.
# Blocks unless: tests pass AND every manual checklist box in test.md is checked off.

# --- Document ---
ledger draft document <feature> ["optional notes, or leave blank to draft from Logic+Code"]
ledger commit document <feature>
```

`LEDGER/index.html` regenerates automatically after every `commit` — open it in a browser and
check it as you go (search box, group headers, version chips, Errors panel).

## 4. Things worth specifically trying

```bash
# Hand-edit LEDGER/features/<feature>/logic/logic.md directly AFTER commit logic, then run
# any draft/commit for that feature — should print a non-blocking warning pointing at new-version.
ledger draft document <feature>

# Start a fresh revision pass on a feature:
ledger new-version <feature>

# Groups:
ledger set-group <feature> <group-name>
ledger set-group <feature>                 # omit group name to clear it
ledger rename-group <old-group-name> <new-group-name>

# Add a step mid-flight (e.g. security, performance, or anything custom):
ledger add-step <feature> security
ledger draft security <feature>            # no description -> seeded from a template
ledger commit security <feature>

# Errors log:
ledger log-error <feature> "raw error/terminal output" "what you were doing when it happened"
npm test 2>&1 | ledger log-error <feature> "what you were doing"  # pipe fills the error-output slot
ledger fix-error <feature>              # diagnosis only (Logic + code as context) — never edits code
ledger fix-error <feature> --id 1       # diagnose a specific entry
ledger resolve-error <feature> "how you fixed it"
ledger resolve-error <feature> "fixed automatically" --agent --id 1

# Large brain dump / sketch, written directly in the file instead of the terminal:
#   open LEDGER/features/<feature>/logic/brain-dump.md, write under a new "## Round N" section
ledger draft logic <feature> --file     # reads brain-dump.md's current content instead of an inline arg
ledger draft code <feature> --file      # same, for code/sketch.md

# Remove a feature (after deleting its real code yourself):
ledger remove-feature <feature>

# Force a dashboard rebuild without committing anything:
ledger build-dashboard
```

## 5. Where things live, if you want to poke around

- `LEDGER/index.json` — source of truth, one file per project.
- `LEDGER/index.html` — the dashboard, regenerated, never hand-edit.
- `LEDGER/style.md` — code style + testing prefs, read by `draft code`/`draft test`.
- `LEDGER/architecture.md` — project-wide system shape, read by `draft logic`.
- `LEDGER/config.json` — `testCommand` lives here after the first `commit test` prompt.
- `LEDGER/features/<feature>/` — everything per-feature (logic/code/test/document/errors).

Full command reference + design rationale: `README.md` and `docs/LEDGER-method-spec.md` in
*this* repo (The-Notes-Method), not the project you're testing in.

## 6. Logging feedback

Use `docs/v2-feedback.md` (in this repo) — jot things down as you hit them, doesn't need to be
tidy. Bring it back here when you're done and I'll triage it into fixes.
