# The Ledger Method — Specification

> **Status:** Draft for implementation. This document is meant to be handed to an AI coding assistant (e.g. Claude Code) to build and evolve the tool. Open questions are marked explicitly and should not be silently resolved by the implementer — flag them back to the author instead. Items marked **(inferred)** are extensions applied by analogy to an already-confirmed pattern elsewhere in the spec, not something explicitly discussed for that specific case — flag these back to the author for confirmation too, don't just build them.

---

## 1. Overview & Philosophy

AI-assisted coding has made it easy to generate working software without engaging with, or understanding, the code that was produced. This creates a specific failure mode: when something breaks, the person who "wrote" the software cannot debug it, because they never actually understood it in the first place.

The Ledger Method is a development methodology (and accompanying tool) designed around four principles:

1. **Engagement** — the person building the software must actively participate in each stage, not just approve AI output.
2. **Understanding** — the person must understand the code and the logic behind it, not just see that it runs.
3. **Provenance** — a record of how each piece of work was produced (human-originated vs. AI-originated), detected automatically from tool usage rather than self-reported.
4. **Friction against blind acceptance** — the workflow should discourage reflexively clicking "yes" to AI suggestions without engagement.

This is explicitly **not** a tool for people who want to vibe-code faster, or who run many autonomous agents in parallel to ship quickly. It is for people who want a structured, incremental way to stay engaged with AI-assisted development, and to have a durable record of how a piece of software actually came to be.

A core workflow principle that runs through this whole method: **features are defined before code is written**, **Logic is defined before Code is written**, and **Logic is defined before Test is written** — each step downstream draws from what was decided upstream, never the reverse (except through the explicit drift-flagging mechanism in §6.5, which surfaces divergence rather than silently allowing it).

**A key lesson from early dogfooding, worth stating explicitly:** the biggest barrier to understanding AI-generated code usually isn't *who* wrote it — it's a mismatch between the code's structure/style and how the person themselves thinks about the problem, and a lack of anything concrete to verify against once code exists. The fixes that emerged from this: let the person provide the *shape* of a solution (via Logic, refined iteratively — §4.1), have Code and Test both derive from that shape rather than inventing their own, and give the person a concrete way to check the result (annotations for unfamiliar code, §6.6; a verification checklist for things that can't be asserted in code, §4.3).

---

## 2. Core Concepts

| Term | Meaning |
|---|---|
| **Feature** | A discrete unit of functionality in the project. The whole project is decomposed into features. |
| **Step** | A stage a feature passes through: **Logic → Code → Test → Document** by default, customizable per feature (§4.5). |
| **Version** | One complete pass through the step pipeline for a feature. A **new version** starts when a feature changes materially. In the dashboard, each version is displayed as a column, following the original spreadsheet-style design. |
| **Attribution** | A tag recorded per step, per version, describing how that step's content was produced: **person**, **ai**, or **legacy**. Automatically detected from tool usage (§5) — not self-reported. |
| **Brain dump** | Free-form input the user provides when drafting a step (raw notes, pseudocode). AI organizes/completes it rather than inventing content from nothing. For Logic, this is an iterative, persistent file (§4.1), not a one-shot input. |
| **Test outline** | The Test step's analogue of a brain dump — a proposed (then user-editable) list of what should be verified for a feature, split into automatable and manual/visual items (§4.3). |
| **Group** | An optional label attached to a feature purely for dashboard organization (e.g. `authentication`). Flat tagging, not structural nesting — features stay in `LEDGER/features/` with no parent/child hierarchy. Assignable by AI (proposed alongside features during `list-features`) or by the user (at `add-feature` time, or retroactively via `set-group`). |

---

## 3. Folder Structure

```
project-root/
├── src/                          (actual project code)
├── tests/                        (actual, runnable test files — e.g. pytest)
├── LEDGER/
│   ├── index.html                 <- generated dashboard. NEVER hand-edited.
│   ├── index.json                 <- data source for the dashboard (§8.1)
│   ├── style.md                   <- global code style + testing preferences (§7)
│   ├── features/
│   │   └── feature-x/
│   │       ├── logic/
│   │       │   ├── brain-dump.md   <- persistent, append-only history of every round (§4.1)
│   │       │   └── logic.md        <- AI-organized, current committed Logic
│   │       ├── code/
│   │       │   ├── sketch.md       <- (inferred) optional code-level sketch, same pattern as brain-dump.md
│   │       │   ├── <code snapshot files>
│   │       │   └── annotations.md  <- unfamiliar-term flags (§6.6)
│   │       ├── test/
│   │       │   ├── test-outline.md <- AI-proposed, user-editable test plan (§4.3)
│   │       │   └── test.md         <- snapshot of the real generated test file(s) + manual checklist
│   │       ├── document/
│   │       │   └── document.md
│   │       └── errors/
│   │           └── errors.md       <- flat, append-only error log for this feature (§4.6)
```

---

## 4. The Four Steps

### 4.1 Logic

- **What it is:** A high-level, human-understandable description of how the feature should work. This is the step where the human's own understanding is the actual product, and the primary input to both Code (§4.2) and Test (§4.3).
- **Command:** `draft logic <feature> ["brain dump text"]` (i.e. `draft <step> <feature> ["description"]`, §11, with step=logic)

**Iterative refinement mechanism:**
- All brain-dump content — however it arrives — lands in a single file, `logic/brain-dump.md`, which is the persistent history for that feature's Logic. CLI-provided text is appended to this file as a new labeled section (e.g. `## Round 1`), not used ephemerally and discarded — this keeps CLI input and direct file edits equivalent, just two ways of adding to the same record.
- **First call, no inline text:** rather than immediately falling back to full AI generation, `draft logic` creates an empty `brain-dump.md` and tells the user where it is, so even a first pass goes through a file rather than an awkward command-line string (useful especially when working from a phone). If the user chooses to leave it empty and re-run the command, AI generates Logic from the feature description alone (attribution `ai`, per §5).
- **Refinement rounds:** the user adds feedback/suggestions as a new labeled section appended below the existing content in `brain-dump.md` (not interleaved into the original text — each round stays a distinct, separately readable block, since the raw original input is what the deferred diff-scoring feature (§12) will eventually want to compare against). Re-running `draft logic <feature>` (no text needed once the file exists) reads the full `brain-dump.md` history plus the current `logic.md` and produces an updated `logic.md`.
- **Locking:** once `commit logic` runs, the discussion is closed for that version. Further changes require `new-version` — no special "edit after commit" path.

### 4.2 Code

- **What it is:** The actual implementation, derived from the feature's committed Logic (the primary input — `draft code` reads it directly, and a well-written Logic naturally determines file structure, including multi-file splits, without a separate mechanism for that).
- **Command:** `draft code <feature> ["sketch"]` (i.e. `draft <step> <feature>`, §11, with step=code and the optional argument used as a sketch)
- **Optional sketch input:** the user may additionally provide a rough code-level sketch/pseudocode. **(Inferred, not yet explicitly confirmed):** by analogy with `brain-dump.md`, this likely should also persist to `code/sketch.md` rather than being used once and discarded, for the same future diff-scoring reasons — flagged in §12 for confirmation.
- **Style:** consults `LEDGER/style.md` (§7) before generating.
- **Annotations:** produces `code/annotations.md` flagging unfamiliar terms not present in the Logic (§6.6).
- **Snapshot:** the real code lives in `src/`; an exact copy is synced to `LEDGER/features/feature-x/code/` at commit time (§6.2).
- **Open/undecided:** whether to show a short outline of planned code structure before writing the full implementation (§12).

### 4.3 Test

- **What it is:** Verification that the code does what Logic said it should do — split explicitly into what can be checked by an automated assertion versus what needs a human to look and confirm.
- **Command:** `draft test <feature>` (i.e. `draft <step> <feature>`, §11, with step=test), used in two phases:
  1. **First run (no `test-outline.md` yet):** reads the feature's committed Logic, derives candidate things to verify, and proposes a split — **automatable** (testable via real assertions) vs. **manual/visual** (things like layout/appearance that can't become code assertions) — writing the result into `test/test-outline.md`.
  2. **User reviews and edits `test-outline.md` directly** — adding/removing cases, reclassifying automatable vs. manual, and adding notes on how a specific test should be written.
  3. **Re-running `draft test <feature>`** (outline now exists) generates the real content: actual test code for automatable items, written to a real, runnable file (e.g. `tests/test_feature.py`, following the testing framework named in `style.md` — §7), with a copy synced into `test/test.md`; and a checklist for manual/visual items, which exists only in `test/test.md` since there's no "real" file for something a human just looks at.
- **`commit test` requirement:** does not complete until automated tests pass **and** every manual checklist item has been explicitly checked off — not a general "looks fine, commit."
- **Re-editing the outline:** no limit — edit `test-outline.md` as many times as needed, rerun `draft test` to regenerate. **(Inferred, not yet explicitly confirmed):** whether edits to `test-outline.md` should follow the same round-labeled convention as `brain-dump.md` (§4.1), or just be freely re-edited without that structure — flagged in §12.

### 4.4 Document
- **What it is:** Documentation of what the code does, written so others (including future-you) can understand it without re-deriving the logic.
- **AI's role:** AI can draft this from the Logic and Code content already produced.

### 4.5 Customizable Step Sets
The four steps above are the default, not fixed. `list-steps` proposes an appropriate pipeline per feature (e.g. adding QA/Verification), which the human confirms.

**Taxonomy for how a customized step should be supported**, decided once a step is actually added:
1. **Checklist-from-Logic** — candidate checks derived from the feature's own Logic, split automatable/manual, each requiring explicit confirmation. This is Test's pattern (§4.3) and is likely directly reusable for QA/Verification-type steps without new engineering, since "verify the feature does what Logic says" is close to what those mean.
2. **Checklist-from-template** — checks come from a fixed, standard list that applies regardless of the specific feature (e.g. Security: "no hardcoded secrets," "input is validated"), not derived from that feature's Logic. Not yet built for any step.
3. **Freeform** — a plain `.md` file, no special tooling. The default for any step without a designed mechanism yet. Can graduate to pattern 1 or 2 later once real use reveals what it actually needs.

**Quality is explicitly freeform for now (pattern 3).** "Quality" bundles several different concerns (maintainability/readability, consistency with style conventions, robustness against bad input) that likely don't share one mechanism — maintainability/consistency overlaps with what linters already do well; robustness likely splits the same automatable/manual way Test does. Rather than guess at a design before the author has actually done a quality pass, this is deliberately left as a blank, user-defined `.md` file until real usage clarifies what's needed.

**Performance is template-seeded, not blank**, since unlike Quality it has a well-known standard structure (load, stress, response time/latency, resource usage) that doesn't depend on project-specific judgment to define. The seeded categories are a starting scaffold, not a schema — fully editable, and an expert can discard them entirely and write whatever's actually relevant (e.g. p95/p99 latency targets, connection pool limits).

**Adding a step to a feature already underway:** `add-step <feature> <step-name>` — registers that a step applies to this feature (creates its folder, adds it to the pipeline) but generates no content itself. Distinct from `list-steps`, which proposes the whole pipeline typically at feature creation; `add-step` handles realizing mid-feature that something else is needed (e.g. Performance, Accessibility).

To actually populate the step, use the unified `draft` command (see §11): `draft <step-name> <feature> ["description"]`.
- **Description given:** same organize-not-invent pattern as Logic (§4.1) — saved to `steps/<step-name>/brain-dump.md`, AI organizes it into the actual step file, attribution `person`. This takes priority regardless of whether the step name matches a known template.
- **No description, step name matches a known template** (Security, Performance — see above): seeded with that template.
- **No description, no known template:** blank, freeform (Quality's treatment).

This means there's no hard split between "steps we've designed for" and "everything else" — describing what you want is always enough to get a real starting point, whether or not the tool has ever seen that step name before.

### 4.6 Errors Log

Not one of the four/customizable steps — a separate, flat, append-only log per feature (`errors/errors.md`), for capturing runtime errors and how they were resolved. Unlike the steps above, it isn't tied to a version — an error can happen at any time, including well after every step has been committed.

- **Logging an error:** `log-error <feature> ["description"]`. If output is piped in (e.g. `npm test | ledger log-error tic-tac-toe`), that becomes the entry automatically. Without piped input or a description, an empty entry opens for manual filling — same fallback pattern as Logic (§4.1). Creates a new, timestamped, **open** entry.
- **Resolving it:** `resolve-error <feature> ["fix note"] [--id <n>] [--agent]` — appends the fix to the most recent open entry (or a specific one via `--id`) and marks it resolved. For longer explanations than the one-line note supports, the user can hand-edit `errors.md` directly afterward — `resolve-error` is meant for the quick note and the status flip together; anything added by hand afterward is purely additive to an already-resolved entry.
- **Attribution — who fixed it:** detected from *how the command was invoked*, not self-reported, consistent with the rest of this method. An AI agent acting autonomously (e.g. fixing a bug on its own without the user typing the command) passes `--agent` when calling `resolve-error`; its absence means a human ran it directly, which is the default (`person`). This is the same "let the mechanism declare it, don't ask anyone to self-report" principle used for step attribution (§5) — just applied to *who invoked the command* rather than *what content was given*.
- **AI does not use this automatically.** An AI agent (e.g. Claude Code) working on the project won't spontaneously start using `log-error`/`resolve-error` just because they exist — it only does so if explicitly instructed to as part of its working instructions for the project. Worth stating directly to any AI agent given autonomy over running/fixing a feature, if this record is wanted.
- **Dashboard:** surfaced as its own cell per feature (§8) — clicking it expands the list of entries (open and resolved), each showing its fix note and attribution dot, same visual treatment as a step.

---

## 5. Attribution Model

Attribution is recorded per step, per version, and is **automatically detected from tool usage** — nothing is self-reported.

- **`person`** — a brain dump (Logic) or sketch (Code) was provided/present when the draft command produced its result. For Logic specifically, this reflects the latest state of `brain-dump.md` at commit time, not a per-round score.
- **`ai`** — no brain dump/sketch was present; AI generated the content from the feature/file description alone.
- **`legacy`** — content originates from `ledger-init`'s bootstrap of a pre-existing codebase (§9.1).

**Deferred (see §12):** degree-of-collaboration scoring via before/after diffs, and scoring based on the full `brain-dump.md` round history rather than just its latest state.

---

## 6. Git Integration

### 6.1 Commit-per-step
Each step has its own commit command. Running it determines attribution (§5), performs a git commit, and records the SHA into `LEDGER/index.json` (§8.1).

### 6.2 Code snapshot sync
`commit code` copies the relevant code into `LEDGER/features/feature-x/code/`, tagged with the commit SHA.

### 6.3 Historical access via SHA
Old-version links in the dashboard resolve via `git show <sha>:<path>`, since step files are overwritten each version.

### 6.4 Commit writes must stay in sync with the index
Every `commit-*` command's git commit and its `LEDGER/index.json` write must not drift apart; fail loudly if both can't complete.

### 6.5 Drift detection (Code and Test)

Because Code and Test are meant to be primarily driven by upstream files (Logic, and the test outline), directly hand-editing the downstream file risks the upstream going silently stale. A single three-tier model applies to both:

1. **Primary path:** update the upstream file (Logic for code; `test-outline.md` for tests) and rerun `draft code` / `draft test` — everything downstream regenerates properly.
2. **Minor direct edit** (styling, formatting, a for-loop instead of a while-loop — no behavior change): detected by comparing the file against what was last generated. Flagged, non-blocking — the tool asks once, after the relevant commit completes, *"You edited this directly — what changed, in one sentence?"* Skippable; if skipped, logged as "possibly stale." The answer is appended as a short note to the corresponding upstream file (Logic for code edits; `test-outline.md` for test edits). A minor code edit does not need to flag Test, and vice versa, since by definition it didn't change behavior.
3. **Major direct edit** (actually changes what the feature does): the recommended path is `new-version`, typically after real review/feedback — matching the original definition of what a version represents.

This check is **post-commit**, not blocking — `commit code`/`commit test` complete normally first, and the check runs afterward.

### 6.6 Code annotations (unfamiliar-term flagging)

After generating code, `draft code` compares the generated code's terms (function calls, imports, notable syntax) against the feature's Logic text — anything present in the code but not implied by Logic gets flagged.

- **v1 approach: purely textual** — does the term appear anywhere in the Logic text? A semantic/conceptual comparison is deferred (§12).
- **Output:** `code/annotations.md`, one or two plain-language lines per flagged item.
- **Passive, not interactive** — informational, nothing blocks on it.

---

## 7. Global Style & Testing Preferences

A single project-level file, `LEDGER/style.md`, holds:
- **Code style preferences** — e.g. "prefer simple, explicit statements over clever one-liners."
- **Testing preferences** — e.g. "Python tests: use pytest." Only needs to cover the kinds of code actually being automated-tested; features whose testing is entirely manual/visual (e.g. UI appearance) don't require any testing-library preference at all, since those items become checklist entries, not code (§4.3).

Both `draft code` and `draft test` read this file every time they run. Set once, early; editable any time, applying to all future calls. A one-off override for a single call is reasonable as a flag rather than changing the global file.

---

## 8. The Dashboard (`index.html`)

- **Generated only**, via `build-dashboard`. Never hand-edited.
- **Layout:** Features as rows, steps as sub-rows, each version displayed as a column (following the original spreadsheet-style design). Features sharing a group tag (§2) cluster together in the display; ungrouped features appear individually. Each cell shows attribution and links to content.
- **Removed features:** hidden by default (a toggle reveals them) — the dashboard's default view shows only active features, keeping it uncluttered, while removed features (§9.3) remain fully present in the underlying data for anyone who wants to look.
- **Not yet surfaced in the dashboard (deferred, §12):** whether a feature's manual test checklist is fully checked off. The Errors log is now surfaced (§4.6) — a per-feature cell showing open/resolved entries with attribution.

### 8.1 Data source: `LEDGER/index.json`
`build-dashboard` reads from a single JSON index file for build performance. Every `commit-*` command writes to it as part of that same command (§6.4).

---

## 9. Bootstrapping onto an Existing Project

### 9.1 `ledger-init` — one-time onboarding
A one-time bootstrap for pre-existing projects: scans the codebase, proposes a feature list + step pipeline per feature (user reviews/adjusts), populates Code snapshots immediately, leaves Logic/Test/Document blank with attribution `legacy`. Safe to re-run without overwriting real (non-`legacy`) entries.

### 9.2 Ongoing feature creation stays feature-first
`list-features` (bulk, at the start) or `add-feature` (one at a time, later) — never `ledger-init` re-runs — is how new features get added going forward. `list-features` proposes features atomic by default (e.g. a "Login," "Signup," "Password Reset," and "Session Management" split rather than one large "Authentication" feature) — a focused Logic is easier to write well than one covering several concerns at once. The review step doubles as where the user merges an over-split proposal back together, or asks for finer breakdown.

### 9.3 Removing a feature
Removal is intentionally split into two separate actions, not one command:
1. **The user deletes the feature's real code from `src/` themselves**, as a normal part of working in the codebase. The tool doesn't attempt to automatically identify and strip a feature's code from the rest of the project — too risky to safely automate.
2. **The user then runs `remove-feature <feature>`** to update LEDGER accordingly.

`remove-feature` marks the feature `removed` in `index.json` — it does **not** delete the LEDGER folder or its files. This matches the method's own premise: a ledger records a reversal, it doesn't erase the original entry. The dashboard (§8) hides removed features by default so the active view stays uncluttered, with a toggle to reveal them — so the record of what a removed feature was, and its full history, stays available without anyone needing to dig through git.

---

## 10. AI Backend Architecture

AI-powered commands call a single internal interface (`AIProvider.generate(prompt, options)`), not any provider's SDK directly. v1: a Claude adapter only, using `claude -p` (headless mode) via the user's existing Claude Code subscription, not a standalone API key. Provider choice is a single global project setting. Per-step provider configuration and additional provider adapters are deferred (§12).

---

## 11. CLI Commands (draft list)

| Command | Purpose |
|---|---|
| `ledger-init` | One-time bootstrap for an existing project (§9.1). |
| `list-features` | Bulk brain-dump → proposed feature list, atomic by default (§2), with a suggested group tag per feature (§2); human reviews/adjusts both. |
| `add-feature <name> ["description"] [--group <group-name>]` | Adds a single new feature before any code is written for it. Group tag optional. |
| `set-group <feature> [<feature> ...] [<group-name>]` | Assigns or changes the group tag for one or more features in one call. Omitting `<group-name>` clears the tag (ungroups) for all listed features. |
| `rename-group <old-group-name> <new-group-name>` | Retags every feature currently tagged `<old-group-name>` to `<new-group-name>`, in one operation. |
| `remove-feature <feature>` | Marks a feature `removed` in `index.json` after its real code has been manually deleted from `src/` by the user first. LEDGER folder and files are kept, not deleted — preserves the record. |
| `list-steps <feature>` | Proposes a step pipeline for a feature; human confirms. |
| `add-step <feature> <step-name>` | Registers a step for a feature already underway (folder + pipeline entry only, no content — see §4.5). |
| `draft <step> <feature> ["description"]` | Unified content-generation command for any step, default or custom. Behavior is step-specific under the hood: Logic (§4.1) manages iterative `brain-dump.md` refinement; Code (§4.2) reads committed Logic (+ optional sketch), consults `style.md`, produces `annotations.md`; Test (§4.3) runs its two-phase outline-then-generate flow; any other step follows the description/template/blank logic in §4.5. |
| `commit <step> <feature>` | Unified commit command for any step. Records attribution + SHA + index entry (§6.1). Step-specific behavior preserved: `commit test` requires passing automated tests + fully checked-off checklist (§4.3); `commit code` and `commit test` both trigger the post-commit drift check (§6.5). |
| `new-version <feature>` | Starts a new version (revision pass) for a feature. |
| `log-error <feature> ["description"]` | Logs a new, open error entry for a feature (§4.6). Piped input is captured automatically; otherwise uses the description or opens an empty entry. |
| `resolve-error <feature> ["fix note"] [--id <n>] [--agent]` | Appends a fix to the most recent open error entry (or a specific one via `--id`), marking it resolved. `--agent` marks attribution as `ai` (AI-agent-invoked); its absence means `person`. |
| `build-dashboard` | Regenerates `index.html` from `LEDGER/index.json`. |

---

## 12. Open Questions / Deferred Scope

- Whether a feature's manual test checklist completion status surfaces in the dashboard.
- How integration tests / cross-feature concerns are represented.
- Generalization of the method beyond coding (research, data science, project management).
- Degree-of-collaboration attribution scoring via before/after diffs, and scoring based on full `brain-dump.md` round history rather than just its latest state — both deferred until there's a clearer need/use case.
- Per-step AI provider configuration, and adapters for providers beyond Claude.
- Whether `draft code` should show a short outline/preview of planned code structure before writing full implementation.
- **(Inferred, needs confirmation)** Whether `code/sketch.md` should persist sketches the same way `brain-dump.md` persists Logic input — applied here by analogy, not explicitly discussed for Code.
- **(Inferred, needs confirmation)** Whether edits to `test-outline.md` should follow the same round-labeled convention as `brain-dump.md`, or just be freely re-edited.
- Upgrading annotation matching (§6.6) from textual to semantic/conceptual.
- Additional comprehension-verification mechanisms discussed but not committed: trusted/standard vs. core-logic marking with a different comprehension bar; tracking concepts the user has demonstrated understanding of over time; AI-generated comprehension questions after a step is drafted. Deliberately not built yet — the author wants to first test whether the Logic-first flow, code annotations, and the test checklist together resolve the comprehension gap before adding more machinery.
