# Testing JOURNAL v3 — quick manual

Everything below assumes `journal` is already on your PATH (it is — `npm link` was run once
from this repo, which is a global symlink, so it works from any project). Just `cd` into
whatever other project you want to test on. It must be a git repo (`git init` first if not),
and the `claude` CLI must be installed and logged in (`claude --version` to check).

## 0. Setup

```bash
cd /path/to/your-other-project
git status              # must be a git repo
journal --help           # sanity check it's on PATH
```

## 1. Get the project into JOURNAL

`journal init` scaffolds `JOURNAL/`, including `JOURNAL/SRS/` — the project-level (not
per-feature) home for `style.md`, `architecture.md`, and the SRS brain-dump/features pair below.

Pick ONE of these two:

**A — starting fresh / project has little existing code:**
```bash
journal init
journal draft-features "<brain dump: what is this project, what are its main pieces>"
# → appends your text to JOURNAL/SRS/brain-dump.md as a new round, then AI derives a feature
#   list into JOURNAL/SRS/features.md, ordered simplest-to-hardest. Open features.md and edit
#   freely — reword, merge, split, or delete an entry — then:
journal commit-features
# → registers every feature still listed. Features start ungrouped, always — nothing here or in
#   journal-init's code-scan ever assigns a group; use set-group yourself once registered (§4).

# re-run draft-features any time to add more (appends another round to brain-dump.md and
# re-derives features.md — never auto-removes a previously-tracked feature, just flags a
# mismatch if one seems to have dropped out of the current brain dump)

# or add a single one-off feature directly (skips the features.md review step, but still logs
# into SRS/brain-dump.md's history so there's no gap in the record):
journal add-feature <name> "<description>" --group <group-name>
```

**B — project already has real code you want to bootstrap onto:**
```bash
journal journal-init
# → scaffolds JOURNAL/ (running init for you) if you haven't already, then scans tracked files
#   via the same code-scanning branch draft-features uses — proposes a feature decomposition +
#   pipeline per feature, snapshots Code immediately (attribution "legacy"). Logic/Test/Document
#   start blank — draft them below. Safe to re-run any time; already-registered features are
#   skipped. Same as branch A: no feature comes out of this pre-grouped.
```

## 2. Lock in a step pipeline (per feature)

```bash
journal list-steps <feature>
# → AI proposes logic/code/test/document (or more, e.g. QA); accept, edit, or cancel
# → also pre-creates brain-dump.md / sketch.md / test-outline.md, so there's somewhere to write
#   a large round of notes directly in a file rather than only via a CLI string argument
```

## 3. Work through the steps

```bash
# --- Logic (do this one first — everything else reads from it) ---
journal draft logic <feature> "<your raw thinking on how this should work>"
# re-run with more text any time to refine; re-run with NO text to just regenerate from history
# open JOURNAL/features/<feature>/logic/logic.md, edit it into your own words, then:
journal commit logic <feature>
# attribution + identity are recorded automatically — your git author name (person) or the
# actual AI model that drafted it (ai)

# If this feature depends on another one, name it in Logic itself — anywhere in the text, a line
# written exactly as:
#   depends-on: other-feature-slug, another-slug
# gets extracted at commit time and feeds the dashboard's dependency graph (§4 below).

# --- Code (AI writes real files into your project) ---
journal draft code <feature> ["optional rough code sketch"]
# review what got written + JOURNAL/features/<feature>/code/annotations.md, edit as needed:
journal commit code <feature>
# external packages your code imports are recorded automatically as this feature's "libraries";
# if the code imports another feature's files without a matching depends-on: line, you'll get a
# non-blocking warning after the commit

# --- Test (two-phase: outline first, then real tests) ---
journal draft test <feature>
# → writes JOURNAL/features/<feature>/test/test-outline.md — open it, edit the checklist freely
journal draft test <feature>
# → (outline now has content) generates a real, runnable test file + test/test.md, including a
#   "how to run" section and a note on what to write next to each manual checkbox
journal commit test <feature>
# first time: it'll ask how to run your tests (e.g. "npm test") and save that answer.
# Blocks unless: tests pass AND every manual checklist box in test.md is checked off.
# test.md gets stamped with when/how it was last verified once the commit succeeds.
# A REAL TEST FAILURE now auto-opens an error entry (captures the failing output) instead of
# just refusing — the error message tells you the id it was logged as; feed that straight into
# the errors lifecycle in §4 below (fix-error → apply-fix → resolve-error → retry commit test).

# --- Document ---
journal draft document <feature> ["optional notes, or leave blank to draft from Logic+Code"]
journal commit document <feature>
```

`JOURNAL/index.html` regenerates automatically after most commands (not just commits — also
`init`/`journal-init`/`draft-features`/`commit-features`/`add-feature`/`set-group`/etc.) — open
it in a browser and check it as you go (search box, group headers, version chips, Errors panel,
List/Graph toggle).

## 4. Things worth specifically trying

```bash
# Hand-edit JOURNAL/features/<feature>/logic/logic.md directly AFTER commit logic, then run
# any draft/commit for that feature — should print a non-blocking warning pointing at new-version.
journal draft document <feature>

# Start a fresh revision pass on a feature:
journal new-version <feature>
# → brain-dump.md/sketch.md/test-outline.md are archived (e.g. brain-dump.v1.md) and start fresh
#   with new frontmatter; the previous code/test snapshots are archived too (code-v1/, test.v1.md)
#   — worth checking the dashboard can still show/link the old version's content afterward.
#   Non-current versions never show a real clickable link in the dashboard any more, even when a
#   local archive exists — only a copyable `git show <sha>[:path]` hint. Worth confirming this
#   for both a logic/document-style step (no local archive ever) and a code/test step (which
#   does have one) — both should render as the hint, not a link, once the version isn't current.

# Groups — always manual, never auto-assigned (not by draft-features, not by journal-init's
# code scan, not by hand-editing features.md and committing it):
journal set-group <feature> <group-name>
journal set-group <feature>                 # omit group name to clear it
journal rename-group <old-group-name> <new-group-name>
journal rename-group <old-group-name>       # omit new name to ungroup instead

# Per-component style/architecture override (§7) — worth exercising directly, since it's new:
# open JOURNAL/SRS/style.md (or architecture.md) and add a section like:
#   ## <group-name>
#   - some component-specific rule
# then draft logic/code/test for a feature actually tagged with that group and confirm the
# component-specific note shows up alongside the global rules (check the AI's output reflects
# it, or add a print/log if you want to see the raw text draft-step sends). Note the file ships
# with a commented-out "## backend" example as boilerplate — naming your real group "backend"
# should still pick up YOUR section, not the commented-out example text.

# Dependency graph: in the dashboard, click "Graph" (next to the search box) to see features as
# nodes and depends-on: declarations as edges. Integration-test-style features (a pipeline with
# no "code" step) should show up gray and in their own "Integration Tests" section in List view.

# Add a step mid-flight (e.g. security, performance, or anything custom):
journal add-step <feature> security
journal draft security <feature>            # no description -> seeded from a template
journal commit security <feature>

# Errors log — full lifecycle now, not diagnosis-only:
journal log-error <feature> "raw error/terminal output" "what you were doing when it happened"
npm test 2>&1 | journal log-error <feature> "what you were doing"  # pipe fills the error-output slot
journal fix-error <feature>                 # blank -> AI proposes a diagnosis + fix steps (attribution ai)
journal fix-error <feature> "my own fix steps"   # your own steps -> organized, not replaced (attribution person)
journal fix-error <feature> --id 1          # target a specific error entry
# review/edit JOURNAL/features/<feature>/errors/fix-plan.md directly if needed, then:
journal apply-fix <feature>                 # writes the actual code fix from the reviewed plan
journal apply-fix <feature> --id 1
# review + test the fix yourself, then:
journal resolve-error <feature> "confirmed the magic-link expiry check now works"
# no --agent flag any more — attribution is inherited automatically from whoever's plan it was
# (person if you gave the fix steps, ai if AI proposed them) — nothing to declare at resolve time

# Large brain dump / sketch, written directly in the file instead of the terminal:
#   open JOURNAL/features/<feature>/logic/brain-dump.md, write under a new "## Round N" section
journal draft logic <feature> --file     # reads brain-dump.md's current content instead of an inline arg
journal draft code <feature> --file      # same, for code/sketch.md
journal draft-features --file            # same, for JOURNAL/SRS/brain-dump.md
journal fix-error <feature> --file       # same, for errors/fix-plan.md's current round

# Remove a feature (after deleting its real code yourself):
journal remove-feature <feature>

# Force a dashboard rebuild without committing anything:
journal build-dashboard
```

## 5. Where things live, if you want to poke around

- `JOURNAL/index-fragments/<feature>.json` — source of truth, one file per feature.
- `JOURNAL/index.json` — generated aggregate of all fragments, rebuilt by build-dashboard.
- `JOURNAL/index.html` — the dashboard, regenerated, never hand-edit.
- `JOURNAL/SRS/style.md` — code style + testing prefs (+ optional per-group override sections), read by `draft code`/`draft test`.
- `JOURNAL/SRS/architecture.md` — project-wide system shape (+ optional per-group override sections), read by `draft logic`.
- `JOURNAL/SRS/brain-dump.md` / `JOURNAL/SRS/features.md` — the project-level feature-discovery pair `draft-features`/`commit-features` read and write.
- `JOURNAL/config.json` — `testCommand` lives here after the first `commit test` prompt.
- `JOURNAL/features/<feature>/` — everything per-feature (logic/code/test/document/errors).
- `JOURNAL/features/<feature>/errors/fix-plan.md` — round-labeled fix plans from `fix-error`, cross-referenced by error id; read by `apply-fix`.

Full command reference + design rationale: `README.md` and `docs/JOURNAL-spec.md` in
*this* repo (journal), not the project you're testing in.

## 6. Logging feedback

Use `docs/v3-feedback.md` (in this repo) — jot things down as you hit them, doesn't need to be
tidy. Bring it back here when you're done and I'll triage it into fixes.
