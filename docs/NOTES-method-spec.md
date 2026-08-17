# The NOTES Method — Specification (v0.1 Draft)

> **Status:** Draft for implementation. This document is meant to be handed to an AI coding assistant (e.g. Claude Code) to build a working v1 of the tool. Open questions are marked explicitly and should not be silently resolved by the implementer — flag them back to the author instead.

---

## 1. Overview & Philosophy

AI-assisted coding has made it easy to generate working software without engaging with, or understanding, the code that was produced. This creates a specific failure mode: when something breaks, the person who "wrote" the software cannot debug it, because they never actually understood it in the first place.

The NOTES method is a development methodology (and accompanying tool) designed around four principles:

1. **Engagement** — the person building the software must actively participate in each stage, not just approve AI output.
2. **Understanding** — the person must understand the code and the logic behind it, not just see that it runs.
3. **Provenance** — for every piece of work, there should be a record of who did it: a person, an AI, or a person and AI collaborating.
4. **Friction against blind acceptance** — the workflow should discourage reflexively clicking "yes" to AI suggestions without engagement.

This is explicitly **not** a tool for people who want to vibe-code faster. It is for people who want a structured way to stay engaged with AI-assisted development, and to have a durable record of how a piece of software actually came to be.

---

## 2. Core Concepts

| Term | Meaning |
|---|---|
| **Feature** | A discrete unit of functionality in the project (a function, module, or user-facing capability). The whole project is decomposed into features. |
| **Step** | A stage a feature passes through on its way to completion. Default steps: **Logic → Code → Test → Document**. The step set is customizable per feature (see §4.5). |
| **Column** | One complete pass through the step pipeline for a feature. When a feature changes materially after initial completion (e.g. a team review requests a change), a **new column** is started — the same steps are redone, producing a new revision. Think of it like a new column in a spreadsheet: the feature is a row, and each column is a version of that row over time. |
| **Attribution** | A tag recorded per step, per column, indicating who did that step: **Person**, **AI**, or **Person/AI collaborated**. This is self-reported and honesty-based in v1 — there is no technical enforcement. |

---

## 3. Folder Structure

```
project-root/
├── src/                          (or wherever the actual project code normally lives)
├── NOTES/                        (placeholder name — may be renamed later)
│   ├── index.html                 <- generated dashboard. NEVER hand-edited.
│   ├── <data source — see §7.1, open question>
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
- **AI's role:** AI may be used to *draft a starting point* (see `draft-logic` in §8) or to answer clarifying questions, but the expectation is that the human reviews and edits this content before considering it done. This is **not technically enforced in v1** — it relies on the attribution tag being filled honestly.

### 4.2 Code
- **What it is:** The actual implementation of the feature.
- **Location:** Lives in the normal project structure (e.g. `src/`), as usual. A **snapshot copy** is placed in `NOTES/features/feature-x/code/` at commit time (see §6.2), so that the interaction between multiple functions in a feature is readable in one place without hunting through the repo.
- **AI's role:** Normal AI-assisted coding is expected here.

### 4.3 Test
- **What it is:** Verification that the code does what the Logic step said it should do.
- **AI's role:** AI can generate tests; the human is expected to run and verify results.
- **Open question:** how integration tests / cross-feature test concerns are handled is deferred (see §10).

### 4.4 Document
- **What it is:** Documentation of what the code does, written so others (including future-you) can understand it without re-deriving the logic.
- **AI's role:** AI can draft this from the Logic and Code content already produced.

### 4.5 Customizable Step Sets
The four steps above are the **default**, not a fixed requirement. Some features may need additional steps (QA, Verification, Security Review, etc.), and this will vary by feature and, eventually, by project type (see §10, generalization beyond coding).

The `list-steps` command (see §8) is how this customization happens: given a feature description, AI proposes an appropriate step pipeline for that feature, which the human reviews and confirms before it's locked in as that feature's step set. This is a **structural/scaffolding decision**, not content generation — it decides *which* steps apply, not what goes inside them. It carries much lower risk than AI drafting the Logic content itself, and does not conflict with the anti-blind-acceptance philosophy in the same way.

---

## 5. Attribution Model

- Recorded **per step, per column**.
- Values: `person`, `ai`, `person+ai`.
- Self-reported by the human; no detection or enforcement mechanism in v1 (may be added later if the method proves useful).
- Suggested storage: as front-matter metadata inside each step's `.md` file (see §7.1 for how this feeds the dashboard).

Example front-matter block for a step file:

```markdown
---
feature: feature-x
step: logic
column: 1
attribution: person
commit_sha: <populated at commit time>
date: 2026-08-17
---

(step content below)
```

---

## 6. Git Integration

### 6.1 Commit-per-step
"Commit" is not a separate fifth step — it is the closing action of *each* step. Each step has its own commit command (`commit-logic`, `commit-code`, `commit-test`, `commit-document`). Running it:
1. Records the attribution tag for that step (if not already set).
2. Performs a git commit of the relevant files — the step's `.md` file (and, for Code, the real project code in `src/`).
3. Records the resulting commit SHA into that step's front matter.

This produces granular git history: one commit per step, per column, each traceable to who did it.

### 6.2 Code snapshot sync
As part of `commit-code`, the tool copies the relevant code for that feature into `NOTES/features/feature-x/code/`, tagged with the same commit SHA. This snapshot is a **point-in-time copy**, not a live sync — it will not drift, because it's only ever written at commit time and overwritten by the next column's commit.

### 6.3 Historical access via SHA
Because step files are overwritten each column, the dashboard needs the recorded SHA to show historical state. Old-column links in the dashboard resolve via `git show <sha>:<path>` rather than reading the live file.

---

## 7. The Dashboard (`index.html`)

- **Generated only** — via the `build-dashboard` command. Never hand-edited. This avoids the dashboard drifting from the underlying `.md` files, and avoids a person or AI editing HTML directly instead of the real content.
- **Layout:** Features as rows (or row groups), the four (or customized) steps as sub-rows, and columns representing each revision pass. Each cell shows the attribution tag and links to that step's content — either the live file (current column) or a historical view via SHA (past columns).
- **Errors surfacing:** open question — not yet decided whether the Errors log (§9) appears in the dashboard.

### 7.1 Data source — OPEN QUESTION
Not yet decided how `build-dashboard` sources its data. Two candidate approaches:
- **Front-matter scanning:** the command scans all step `.md` files' front matter (as shown in §5) and builds the dashboard directly from that — no separate index file needed.
- **Separate index file:** a `NOTES/index.json` (or `.yaml`) tracks feature/step/column/attribution/SHA data explicitly, updated by the commit commands, and `build-dashboard` reads from that instead of re-scanning every file.

**Recommendation for the implementer:** front-matter scanning is likely simpler and avoids a second source of truth that could get out of sync, but this is explicitly left open for the author to decide before or during implementation.

---

## 8. CLI Commands (draft list)

| Command | Purpose |
|---|---|
| `list-features` | Takes a free-form project description (brain dump) and proposes a list of features. |
| `list-steps <feature>` | Proposes a step pipeline for a given feature (default: Logic/Code/Test/Document, may suggest additions like QA/Verification). Human reviews and confirms before it's locked in. |
| `draft-logic <feature>` | AI drafts a starting point for the Logic step. Explicitly framed as a draft — human is expected to edit before committing. |
| `commit-logic <feature>` | Records attribution + commits the Logic file + captures SHA. |
| `commit-code <feature>` | Records attribution + commits real project code + syncs snapshot into NOTES + captures SHA. |
| `commit-test <feature>` | Records attribution + commits the Test file + captures SHA. |
| `commit-document <feature>` | Records attribution + commits the Document file + captures SHA. |
| `new-column <feature>` | Starts a new revision pass for a feature — opens fresh working files for its steps (previous content remains accessible via git history + recorded SHAs). |
| `log-error <feature>` | Appends an entry to that feature's Errors log. |
| `build-dashboard` | Regenerates `index.html` from the underlying data (see §7.1). |

This list is a starting point — the implementer should treat command names and exact behavior as adjustable during build.

---

## 9. Errors Log

- Location: `NOTES/Errors/feature-x/errors.md` (or one file per error — implementer's call).
- Captures: the output/error that occurred, and how it was resolved.
- Open question: whether this surfaces in the dashboard (§7).

---

## 10. Open Questions / Deferred Scope

These are intentionally **not** resolved in this document. Do not resolve them unilaterally during implementation — flag them back to the author.

- Final data format for the dashboard (§7.1: front-matter scanning vs. separate index file).
- Whether the Errors log surfaces in the dashboard.
- How integration tests / cross-feature concerns are represented (deferred until author gets feedback from colleagues on the base idea).
- Generalization of the method beyond coding (research, data science, project management) — the `list-steps` mechanism (§4.5) is the intended lever for this, but the actual non-coding step templates are not yet defined.
- Final name for the `NOTES` folder (currently a placeholder).
- Whether/how to eventually add technical enforcement of the attribution model (currently fully honesty-based).

---

## 11. Appendix — Example Walkthrough

1. Author runs `list-features` with a brain-dump description of a new project → gets back a list of proposed features, including `user-authentication`.
2. Author runs `list-steps user-authentication` → AI proposes Logic → Code → Test → Document (no QA/Verification needed for this one). Author confirms.
3. Author runs `draft-logic user-authentication` → AI drafts a starting explanation of the auth flow. Author edits it into their own words/understanding.
4. Author runs `commit-logic user-authentication` → attribution tagged `person`, file committed, SHA recorded.
5. Author (with AI assistance) writes the actual code in `src/`. Runs `commit-code user-authentication` → attribution tagged `person+ai`, code committed to `src/`, snapshot synced to `NOTES/features/user-authentication/code/`, SHA recorded.
6. Tests written and run. `commit-test user-authentication` → attribution recorded, committed, SHA recorded.
7. Documentation drafted (AI-assisted) and reviewed. `commit-document user-authentication` → attribution recorded, committed, SHA recorded.
8. Author runs `build-dashboard` → `index.html` regenerated, showing `user-authentication` with all four steps, their attribution tags, and links to each committed file.
9. Two weeks later, the team requests a change to the auth flow. Author runs `new-column user-authentication` → fresh working files opened for the four steps, previous column's content still viewable in the dashboard via its recorded SHAs.
