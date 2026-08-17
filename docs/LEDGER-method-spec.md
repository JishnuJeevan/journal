# The Ledger Method — Specification (v0.2 Draft)

> **Status:** Draft for implementation. This document is meant to be handed to an AI coding assistant (e.g. Claude Code) to build a working v1 of the tool. Open questions are marked explicitly and should not be silently resolved by the implementer — flag them back to the author instead.

---

## 1. Overview & Philosophy

AI-assisted coding has made it easy to generate working software without engaging with, or understanding, the code that was produced. This creates a specific failure mode: when something breaks, the person who "wrote" the software cannot debug it, because they never actually understood it in the first place.

The Ledger Method is a development methodology (and accompanying tool) designed around four principles:

1. **Engagement** — the person building the software must actively participate in each stage, not just approve AI output.
2. **Understanding** — the person must understand the code and the logic behind it, not just see that it runs.
3. **Provenance** — for every piece of work, there should be a record of who did it: a person, an AI, or a person and AI collaborating. This is where the name comes from — a ledger is fundamentally a record of accountability, and each commit under this method functions as a ledger entry.
4. **Friction against blind acceptance** — the workflow should discourage reflexively clicking "yes" to AI suggestions without engagement.

This is explicitly **not** a tool for people who want to vibe-code faster. It is for people who want a structured way to stay engaged with AI-assisted development, and to have a durable record of how a piece of software actually came to be.

A core workflow principle that runs through this whole method: **features are defined before code is written**, not discovered after the fact. The one exception is onboarding an existing project onto the method (§8.1) — everywhere else, the feature-first order holds.

---

## 2. Core Concepts

| Term | Meaning |
|---|---|
| **Feature** | A discrete unit of functionality in the project (a function, module, or user-facing capability). The whole project is decomposed into features. |
| **Step** | A stage a feature passes through on its way to completion. Default steps: **Logic → Code → Test → Document**. The step set is customizable per feature (see §4.5). |
| **Column** | One complete pass through the step pipeline for a feature. When a feature changes materially after initial completion (e.g. a team review requests a change), a **new column** is started — the same steps are redone, producing a new revision. Think of it like a new column in a spreadsheet: the feature is a row, and each column is a version of that row over time. |
| **Attribution** | A tag recorded per step, per column, indicating who did that step: **person**, **ai**, **person+ai**, or **legacy** (see §8.1 for `legacy`). This is self-reported and honesty-based in v1 — there is no technical enforcement. |

---

## 3. Folder Structure

```
project-root/
├── src/                          (or wherever the actual project code normally lives)
├── LEDGER/
│   ├── index.html                 <- generated dashboard. NEVER hand-edited.
│   ├── index.json                 <- generated/updated data source for the dashboard (see §7.1)
│   ├── features/
│   │   └── feature-x/
│   │       ├── logic/
│   │       │   └── logic.md
│   │       ├── code/
│   │       │   └── <snapshot of relevant code, synced at commit time — see §6.2>
│   │       ├── test/
│   │       │   └── test.md
│   │       └── document/
│   │           └── document.md
│   └── Errors/
│       └── feature-x/
│           └── errors.md
```

Notes:
- Each step's `.md` file (and the code snapshot) gets **overwritten** when a new column starts. Historical versions are **not** kept as separate files — they are recovered via git history, using the commit SHA recorded for that column (see §6).
- Additional step folders can exist per feature if that feature's step set is customized (e.g. `feature-x/qa/`, `feature-x/verification/`).

---

## 4. The Four Steps

### 4.1 Logic
- **What it is:** A high-level, human-understandable description of how the feature should work — the reasoning, not the implementation.
- **Purpose:** This is the step where the human's own understanding is the actual product. Everything else in the pipeline exists to serve or record this understanding.
- **AI's role:** AI may be used to *draft a starting point* (see `draft-logic` in §9) or to answer clarifying questions, but the expectation is that the human reviews and edits this content before considering it done. This is **not technically enforced in v1** — it relies on the attribution tag being filled honestly.

### 4.2 Code
- **What it is:** The actual implementation of the feature.
- **Location:** Lives in the normal project structure (e.g. `src/`), as usual. A **snapshot copy** is placed in `LEDGER/features/feature-x/code/` at commit time (see §6.2), so that the interaction between multiple functions in a feature is readable in one place without hunting through the repo.
- **AI's role:** Normal AI-assisted coding is expected here.

### 4.3 Test
- **What it is:** Verification that the code does what the Logic step said it should do.
- **AI's role:** AI can generate tests; the human is expected to run and verify results.
- **Open question:** how integration tests / cross-feature test concerns are handled is deferred (see §11).

### 4.4 Document
- **What it is:** Documentation of what the code does, written so others (including future-you) can understand it without re-deriving the logic.
- **AI's role:** AI can draft this from the Logic and Code content already produced.

### 4.5 Customizable Step Sets
The four steps above are the **default**, not a fixed requirement. Some features may need additional steps (QA, Verification, Security Review, etc.), and this will vary by feature and, eventually, by project type (see §11, generalization beyond coding).

The `list-steps` command (see §9) is how this customization happens: given a feature description, AI proposes an appropriate step pipeline for that feature, which the human reviews and confirms before it's locked in as that feature's step set. This is a **structural/scaffolding decision**, not content generation — it decides *which* steps apply, not what goes inside them. It carries much lower risk than AI drafting the Logic content itself, and does not conflict with the anti-blind-acceptance philosophy in the same way.

---

## 5. Attribution Model

- Recorded **per step, per column**.
- Values: `person`, `ai`, `person+ai`, `legacy` (see §8.1 — used only for steps backfilled from a pre-existing codebase, where no real authorship record exists).
- Self-reported by the human; no detection or enforcement mechanism in v1 (may be added later if the method proves useful).
- Stored in `LEDGER/index.json` (see §7.1), not in per-file front-matter — this was a deliberate choice to keep dashboard generation fast on larger projects (see §7.1 for the reasoning).

---

## 6. Git Integration

### 6.1 Commit-per-step
"Commit" is not a separate fifth step — it is the closing action of *each* step. Each step has its own commit command (`commit-logic`, `commit-code`, `commit-test`, `commit-document`). Running it:
1. Records the attribution tag for that step (if not already set).
2. Performs a git commit of the relevant files — the step's `.md` file (and, for Code, the real project code in `src/`).
3. Records the resulting commit SHA into `LEDGER/index.json` (see §7.1).

This produces granular git history: one commit per step, per column, each traceable to who did it.

### 6.2 Code snapshot sync
As part of `commit-code`, the tool copies the relevant code for that feature into `LEDGER/features/feature-x/code/`, tagged with the same commit SHA. This snapshot is a **point-in-time copy**, not a live sync — it will not drift, because it's only ever written at commit time and overwritten by the next column's commit.

### 6.3 Historical access via SHA
Because step files are overwritten each column, the dashboard needs the recorded SHA to show historical state. Old-column links in the dashboard resolve via `git show <sha>:<path>` rather than reading the live file.

### 6.4 Commit writes must stay in sync with the index
Every `commit-*` command performs two things that must not drift apart: the git commit itself, and the corresponding write to `LEDGER/index.json`. If one succeeds and the other fails, the dashboard will show inaccurate data. The implementer should make this as close to atomic as practical, and **fail loudly** (not silently) if the two can't both complete — a wrong dashboard is worse than a command that visibly errors out.

---

## 7. The Dashboard (`index.html`)

- **Generated only** — via the `build-dashboard` command. Never hand-edited. This avoids the dashboard drifting from the underlying data, and avoids a person or AI editing HTML directly instead of the real content.
- **Layout:** Features as rows (or row groups), the four (or customized) steps as sub-rows, and columns representing each revision pass. Each cell shows the attribution tag and links to that step's content — either the live file (current column) or a historical view via SHA (past columns).
- **Errors surfacing:** deferred out of v1 (see §11) — the Errors log exists (§9) but is not shown in the dashboard yet.

### 7.1 Data source: `LEDGER/index.json`
`build-dashboard` reads from a single JSON index file rather than scanning every `.md` file's front-matter. This was chosen specifically for build performance on larger projects — scanning many files on every dashboard rebuild would get slower as the project grows, while reading one JSON file stays fast regardless of project size.

This makes `LEDGER/index.json` the authoritative data source for the dashboard. Every `commit-*` command must write to it as part of that same command (see §6.4) — it is not a separate bookkeeping step the user has to remember to run.

---

## 8. Bootstrapping onto an Existing Project

### 8.1 `ledger-init` — one-time onboarding
For projects that already have code before adopting the Ledger Method, `ledger-init` is a **one-time bootstrap command**, conceptually similar to `git init` or Claude Code's `/init` — something run once at the start of using the tool on that project, not part of the ongoing workflow.

What it does:
1. Scans the existing project.
2. Proposes a list of features it finds, and a step pipeline per feature (same underlying mechanism as `list-features` + `list-steps`).
3. The user reviews the proposed list — adds or removes features based on their own understanding of the project — before anything is finalized.
4. For each confirmed feature:
   - **Code step:** populated immediately with a snapshot of the existing code (the code already exists — no reason to leave this blank).
   - **Logic, Test, Document steps:** left blank/unfilled, since no real record of the original reasoning, testing, or documentation process exists.
   - **Attribution:** set to `legacy` for all steps (see §5) rather than `person`/`ai`/`person+ai`, since none of those honestly describe how the code was actually produced.
5. Does **not** re-implement or modify any existing code — this is scaffolding only, applied retroactively.

The user then fills in Logic/Test/Document for these features over time, same as any other feature, using the normal commands (§9).

**Re-running `ledger-init`:** should be safe — if run again (accidentally, or to catch code the method hasn't picked up yet), it must not overwrite or duplicate features that already have real (non-`legacy`) LEDGER entries. It should only create entries for features it doesn't already have a record of. This is a defensive fallback, not the intended way to add new features going forward (see §8.2).

### 8.2 Ongoing feature creation stays feature-first
After the one-time bootstrap (or from day one, on a brand-new project), new features are always defined **before** their code is written:
- `list-features` — bulk brain-dump at the start of a project (or a new phase of work), producing an initial feature list.
- `add-feature` — lightweight, one-at-a-time version for adding a single new feature as it comes up later in the project's life. Same feature-first principle: the user describes the feature, it goes through Logic before any Code step is committed.

`ledger-init` is intentionally **not** the mechanism for adding features over time — doing so would mean writing code first and letting the tool catch up, which runs against the method's core principle (§1).

---

## 9. CLI Commands (draft list)

| Command | Purpose |
|---|---|
| `ledger-init` | **One-time** bootstrap for an existing project. Scans code, proposes features + step pipelines, populates Code snapshots, leaves Logic/Test/Document blank with `legacy` attribution. Safe to re-run without clobbering real entries (see §8.1). |
| `list-features` | Takes a free-form project description (brain dump) and proposes a list of features. Used at the start of a project or a new phase of work. |
| `add-feature` | Adds a single new feature, described by the user, before any code is written for it. The ongoing (non-bootstrap) way features get added over time. |
| `list-steps <feature>` | Proposes a step pipeline for a given feature (default: Logic/Code/Test/Document, may suggest additions like QA/Verification). Human reviews and confirms before it's locked in. |
| `draft-logic <feature> ["<brain dump>"]` | AI drafts a starting point for the Logic step. Bare form improvises from the feature's name + description; with a brain dump, AI instead organizes the human's own raw reasoning into a coherent draft rather than inventing it. Explicitly framed as a draft either way — human is expected to edit before committing. |
| `commit-logic <feature>` | Records attribution + commits the Logic file + writes to `LEDGER/index.json` (see §6.4). |
| `commit-code <feature>` | Records attribution + commits real project code + syncs snapshot into LEDGER + writes to `LEDGER/index.json`. |
| `commit-test <feature>` | Records attribution + commits the Test file + writes to `LEDGER/index.json`. |
| `commit-document <feature>` | Records attribution + commits the Document file + writes to `LEDGER/index.json`. |
| `new-column <feature>` | Starts a new revision pass for a feature — opens fresh working files for its steps (previous content remains accessible via git history + recorded SHAs). |
| `log-error <feature>` | Appends an entry to that feature's Errors log. |
| `build-dashboard` | Regenerates `index.html` from `LEDGER/index.json`. |

This list is a starting point — the implementer should treat command names and exact behavior as adjustable during build.

---

## 10. AI Backend Architecture

The tool's AI-powered commands (`list-features`, `list-steps`, `draft-logic`, `ledger-init`'s scanning, etc.) should not call any single AI provider's SDK/API directly. Instead, they should call a single internal interface, e.g.:

```
AIProvider.generate(prompt, { structured?: boolean }) → text or parsed JSON
```

Each actual provider (Claude, OpenAI, Gemini, etc.) is implemented as a small adapter behind this interface. This keeps provider-specific details (CLI flags, auth, output parsing, billing model) isolated from the commands themselves, since providers' CLIs, billing rules, and availability change over time (this has already happened once during this project's own build — see the Claude billing discussion this spec's author had with their assistant).

**v1 scope:**
- Only the Claude adapter is implemented, using `claude -p` (headless mode) via the user's existing Claude Code subscription — **not** a standalone `ANTHROPIC_API_KEY`, to avoid separate pay-per-token billing on top of the subscription.
- Provider choice is a **single global setting** for the whole project (e.g. in a config file), not configurable per command/step.

**Deferred to a later version (see §11):** per-step provider configuration (e.g. Claude for `draft-logic`, a different provider for another step), and adapters for other providers (OpenAI/Codex, Gemini, etc.).

---

## 11. Open Questions / Deferred Scope

These are intentionally **not** resolved in this document. Do not resolve them unilaterally during implementation — flag them back to the author.

- Whether the Errors log surfaces in the dashboard.
- How integration tests / cross-feature concerns are represented (deferred until author gets feedback from colleagues on the base idea).
- Generalization of the method beyond coding (research, data science, project management) — the `list-steps` mechanism (§4.5) is the intended lever for this, but the actual non-coding step templates are not yet defined.
- Whether/how to eventually add technical enforcement of the attribution model (currently fully honesty-based).
- Per-step AI provider configuration, and adapters for providers beyond Claude (§10).

---

## 12. Appendix — Example Walkthrough

### A. New project
1. Author runs `list-features` with a brain-dump description of a new project → gets back a list of proposed features, including `user-authentication`.
2. Author runs `list-steps user-authentication` → AI proposes Logic → Code → Test → Document (no QA/Verification needed for this one). Author confirms.
3. Author runs `draft-logic user-authentication` → AI drafts a starting explanation of the auth flow. Author edits it into their own words/understanding.
4. Author runs `commit-logic user-authentication` → attribution tagged `person`, file committed, SHA + entry recorded in `LEDGER/index.json`.
5. Author (with AI assistance) writes the actual code in `src/`. Runs `commit-code user-authentication` → attribution tagged `person+ai`, code committed to `src/`, snapshot synced to `LEDGER/features/user-authentication/code/`, index updated.
6. Tests written and run. `commit-test user-authentication` → attribution recorded, committed, index updated.
7. Documentation drafted (AI-assisted) and reviewed. `commit-document user-authentication` → attribution recorded, committed, index updated.
8. Author runs `build-dashboard` → `index.html` regenerated, showing `user-authentication` with all four steps, their attribution tags, and links to each committed file.
9. Two weeks later, the team requests a change to the auth flow. Author runs `new-column user-authentication` → fresh working files opened for the four steps, previous column's content still viewable in the dashboard via its recorded SHAs.
10. Meanwhile, a new feature idea comes up. Author runs `add-feature` to describe it, before writing any code for it — same feature-first flow as step 1 onward.

### B. Existing project, adopting Ledger for the first time
1. Author runs `ledger-init` in an existing repo that has no LEDGER folder yet.
2. Tool scans the codebase, proposes a feature list (e.g. `user-authentication`, `payment-processing`, `email-notifications`).
3. Author reviews the list — removes one that's actually dead code, adds one the scan missed.
4. For each confirmed feature, LEDGER entries are created: Code step populated with a snapshot of existing code, Logic/Test/Document left blank, all attribution set to `legacy`.
5. Author runs `build-dashboard` → dashboard shows all features with `legacy` markers and blank steps, making visible exactly what hasn't been documented/understood yet.
6. Over time, author works through each feature's blank steps using the normal commands (`draft-logic`, `commit-logic`, etc.), gradually replacing `legacy` entries with real ones.
7. Any brand-new feature from this point on goes through `add-feature`, not another `ledger-init` run.
