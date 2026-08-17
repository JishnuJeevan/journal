# v1 Feedback

Notes from testing the Ledger Method CLI on a real project. Free-form — jot things down as
you hit them, clean up later if needed.

## Shortcomings / friction

- `commit-logic`/`commit-code`/`commit-test`/`commit-document` don't auto-run
  `build-dashboard` afterward — have to remember to rebuild it separately every time.
  (raised 2026-08-17)

## Bugs

- `commit-code`'s linked code paths (what you type in response to "which file(s)/dir(s)
  belong to it?") aren't visible anywhere in `code.md` afterward — they're only stored in
  `LEDGER/index.json` (`codePaths`), so there's no way to see what's linked to a feature by
  just looking at its code.md. (raised 2026-08-17)

## Ideas for later

- `discuss-logic <feature>` — AI feedback/critique on a logic draft without editing it
  (raised 2026-08-17, deferred to a later version)
- `draft-test` / `draft-document` — AI-assist commands mirroring `draft-logic`, for the Test
  and Document steps (spec §4.3/§4.4 both call out an AI-drafting role; only `draft-logic`
  exists in v1). (raised 2026-08-17)
- ~~**`draft-logic` should have two modes.**~~ **Done (2026-08-17).** `draft-logic <feature>`
  (bare) still improvises from the feature's name + one-line description. `draft-logic
  <feature> "<brain dump>"` now grounds the draft in a free-form brain dump the user provides
  on the spot, the same way `list-features` takes one for the whole project — AI organizes and
  clarifies the human's own reasoning instead of inventing it from scratch.

## Bugs (continued)

- **`draft-logic` output sometimes contains leaked meta-commentary**, e.g. a real example
  from testing had this sentence sitting right after the DRAFT banner, before any actual
  content: "I'll provide the draft directly as my response rather than editing the file."
  That's not logic content — it reads like the model narrating a decision about whether to
  use a tool (e.g. edit the file itself) rather than just returning text.
  Suspected root cause: `claude -p` (the `claude-cli` adapter) runs the full Claude Code
  agent — the same tool-aware harness as an interactive session — not a bare text-completion
  endpoint. Folding "system" instructions into the piped stdin prompt (see
  `src/lib/ai-providers/claude-cli.js`) isn't a strong enough boundary to stop the model from
  reasoning out loud about actions instead of purely generating text. This is more than a
  formatting nit — nothing currently stops a `generate()` call from attempting real tool use
  (file edits, etc.) inside the project directory. Needs investigation: proper system-prompt
  flags / permission restrictions on the `claude -p` invocation, and/or stripping known
  preamble patterns from the output. (raised 2026-08-17)

## Design questions (need author decision)

- **`commit-code` full snapshot vs. pointer.** Currently `commit-code` copies the full
  content of every linked file into `LEDGER/features/<feature>/code/` at commit time. Author
  asked whether this should instead be a pointer/reference to the real files rather than a
  duplicated copy. Current behavior is intentional per spec §6.2 (readability of a
  multi-file feature in one place, and point-in-time snapshot so historical columns stay
  accurate even as `src/` keeps changing) — but it's a real tradeoff against repo bloat /
  duplication, especially on large files. Needs a decision: keep full copies, switch to
  pointers (losing the point-in-time guarantee), or something in between (e.g. diff-only,
  or only snapshotting on request). (raised 2026-08-17)

