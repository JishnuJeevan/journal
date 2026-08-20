import { getProvider } from './ai-providers/provider.js';

export async function proposeFeatures(brainDump) {
  const system = `You help decompose a software project description into a list of discrete
features, for a development methodology called the Ledger Method. A "feature" is a
discrete unit of functionality (a function, module, or user-facing capability).

Respond with ONLY a JSON array, no prose, no markdown fences. Each element:
{ "slug": "kebab-case-id", "name": "Human Readable Name", "description": "One or two sentence description." }

Propose 3-10 features, atomic by default — e.g. split "Login", "Signup", and "Password Reset"
into separate features rather than one large "Authentication" feature; a focused feature is
easier to write good Logic for. Slugs must be unique, lowercase, kebab-case, filesystem-safe.

Order matters: return the array ordered from simplest/most foundational (build and understand
first) to hardest/most dependent (build later, once the simpler pieces exist) — the order you
return is used as the project's suggested build sequence. Do not assign groups/categories —
grouping is done later by the human, not proposed here.`;

  const parsed = await getProvider().generate(brainDump, { system, structured: true });
  if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of features from the AI provider.');
  return parsed;
}

export async function proposeFeaturesFromCode(fileTreeText) {
  const system = `You are bootstrapping the Ledger Method (a structured, attribution-tracked
development methodology) onto an EXISTING codebase. You are given a list of its source files.
Propose a decomposition into discrete features (same atomic-by-default principle as ordinary
feature proposal — prefer several focused features over one broad one), each naming the source
paths that belong to it.

Respond with ONLY a JSON array, no prose, no markdown fences. Each element:
{ "slug": "kebab-case-id", "name": "Human Readable Name", "description": "One or two sentence description.", "group": "kebab-case-group-or-null", "codePaths": ["relative/path", "..."] }

Every input file should end up under some feature's codePaths (a catch-all "misc" or
infrastructure-style feature is fine for things that don't fit elsewhere). Slugs must be unique,
lowercase, kebab-case, filesystem-safe.`;

  const parsed = await getProvider().generate(fileTreeText, { system, structured: true });
  if (!Array.isArray(parsed)) throw new Error('Expected a JSON array of features from the AI provider.');
  return parsed;
}

export async function proposeSteps(feature, description) {
  const system = `You propose a step pipeline for a feature in the Ledger Method, a development
methodology where every feature passes through a sequence of steps (default: Logic, Code, Test,
Document) before being considered complete. Additional steps (e.g. QA, Verification, Security
Review) may be warranted for some features, but the default four are almost always sufficient —
only propose additions when there's a concrete reason for this specific feature.

Respond with ONLY a JSON object, no prose, no markdown fences:
{ "steps": ["logic","code","test","document"], "rationale": "One sentence on why this set." }

Steps must be lowercase, kebab-case, filesystem-safe identifiers, in pipeline order.
"logic" and "code" should almost always be first and second respectively.`;

  const parsed = await getProvider().generate(
    `Feature: ${feature}\nDescription: ${description || '(no description provided)'}`,
    { system, structured: true }
  );
  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error('Expected { steps: string[] } from the AI provider.');
  }
  return parsed;
}

export async function draftLogic(feature, description, brainDumpHistory, currentLogic, architectureText) {
  const architectureNote = `You may also be given the project's overall architecture
(LEDGER/architecture.md) as background context — use it only to keep this feature's Logic
consistent with the bigger picture (e.g. which layer/component this belongs in, existing
conventions to follow). Don't restate it, and don't let it override or invent beyond what the
human actually said about THIS feature.`;

  const dependsOnNote = `If the human's own notes name another feature this one depends on
(by its feature slug, or clearly enough to infer one), include a single line written EXACTLY as
"depends-on: slug-one, slug-two" (that literal format — lowercase, hyphenated key, comma-separated
slugs, nothing else on the line) somewhere in the draft, since this is extracted verbatim by the
tool. Omit the line entirely if no dependency was actually stated — don't invent one.`;

  const groundedSystem = `You draft a starting point for the "Logic" step of a feature in the
Ledger Method. Logic is a high-level, human-understandable description of how a feature should
work — the reasoning, not the implementation. This draft exists ONLY to give a human something to
react to, edit, and correct — it is explicitly not meant to be accepted as-is.

The human has given you their own raw, half-formed thinking about this feature (a "brain dump" —
possibly across several rounds, each a distinct block below). Your job is NOT to invent the logic
yourself — it's to take THEIR reasoning and organize it into a coherent, well-structured draft:
clarify ambiguous points, surface gaps or unstated assumptions as open questions, and put it in
plain prose and short bullet lists where useful. If a prior logic.md draft is included, refine it
in light of the new round rather than starting over. Stay grounded in what they actually wrote;
don't introduce major decisions they didn't make. ${architectureNote} ${dependsOnNote} Do not write code. Respond
with ONLY the markdown content itself, nothing else: no frontmatter, no code fences around the
whole thing, no meta-commentary about being a draft (the tool adds that banner itself), and no
remarks about these instructions, what was or wasn't provided to you, or your own process — the
human only ever sees the raw text you return, so open directly with the actual Logic content.`;

  const improviseSystem = `You draft a starting point for the "Logic" step of a feature in the
Ledger Method. Logic is a high-level, human-understandable description of how a feature should
work — the reasoning, not the implementation. This draft exists ONLY to give a human something to
react to, edit, and correct — it is explicitly not meant to be accepted as-is. Write it as a
genuine, concrete attempt (not vague hand-waving), in plain prose and short bullet lists where
useful. ${architectureNote} ${dependsOnNote} Do not write code. Respond with ONLY the markdown content itself,
nothing else: no frontmatter, no code fences around the whole thing, no meta-commentary about
being a draft (the tool adds that banner itself), and no remarks about these instructions or your
own process — the human only ever sees the raw text you return, so open directly with the actual
Logic content.`;

  const hasBrainDump = Boolean(brainDumpHistory && brainDumpHistory.trim());

  const promptParts = [`Feature: ${feature}`, `Description: ${description || '(no description provided)'}`];
  if (architectureText && architectureText.trim()) {
    promptParts.push(`Project architecture (LEDGER/architecture.md, background context only):\n${architectureText.trim()}`);
  }
  if (hasBrainDump) promptParts.push(`Author's brain dump history:\n${brainDumpHistory.trim()}`);
  if (currentLogic && currentLogic.trim()) {
    promptParts.push(`Current logic.md (refine this in light of the brain dump above, don't discard it):\n${currentLogic.trim()}`);
  }

  const text = await getProvider().generate(promptParts.join('\n\n'), {
    system: hasBrainDump ? groundedSystem : improviseSystem,
    structured: false,
  });
  return text.trim();
}

export async function draftCode(feature, { logicText, styleText, sketchHistory } = {}) {
  const system = `You write the actual implementation for the "Code" step of a feature in the
Ledger Method. The feature's committed Logic (given below) is the primary input — infer file
structure, including multi-file splits, from what Logic describes, rather than inventing your own
organization. If a code-level sketch from the author is included, follow its intent but you may
correct or complete it. Consult the project's style preferences if given.

Respond with ONLY a JSON object, no prose, no markdown fences:
{ "files": [{ "path": "relative/path/from/project/root.ext", "content": "full file content" }], "notes": "one or two sentence summary of what you built" }

Paths must be relative to the project root, must not escape it (no "..", no leading "/"), and
should follow the project's existing source layout conventions where evident. "LEDGER/" is this
tool's own record-keeping directory, not part of the runnable project — never write files there.`;

  const promptParts = [`Feature: ${feature}`, `Committed Logic:\n${logicText || '(none)'}`];
  if (styleText && styleText.trim()) promptParts.push(`Style preferences (LEDGER/style.md):\n${styleText.trim()}`);
  if (sketchHistory && sketchHistory.trim()) promptParts.push(`Author's code sketch:\n${sketchHistory.trim()}`);

  const parsed = await getProvider().generate(promptParts.join('\n\n'), { system, structured: true });
  if (!Array.isArray(parsed.files) || parsed.files.length === 0) {
    throw new Error('Expected { files: [...] } from the AI provider.');
  }
  return parsed;
}

export async function proposeTestOutline(feature, logicText) {
  const system = `You propose a test plan for the "Test" step of a feature in the Ledger Method.
Derive candidate things to verify from the feature's committed Logic, and split them into
"automatable" (checkable via a real code assertion) versus "manual" (things like layout/visual
appearance that can't become a code assertion and need a human to look and confirm).

Respond with ONLY a JSON object, no prose, no markdown fences:
{ "automatable": ["one specific behavior to assert", "..."], "manual": ["one specific thing to visually/manually confirm", "..."] }`;

  const parsed = await getProvider().generate(
    `Feature: ${feature}\n\nCommitted Logic:\n${logicText || '(none)'}`,
    { system, structured: true }
  );
  if (!Array.isArray(parsed.automatable) || !Array.isArray(parsed.manual)) {
    throw new Error('Expected { automatable: string[], manual: string[] } from the AI provider.');
  }
  return parsed;
}

export async function draftTest(feature, { logicText, styleText, outlineText, codePaths } = {}) {
  const system = `You generate the real content for the "Test" step of a feature in the Ledger
Method. You are given the feature's committed Logic, the real source file(s) implementing it, and
a test outline (possibly edited by the author from what was originally proposed) splitting
verification into automatable items and manual/visual items. Write real, runnable test code for
the automatable items only, following the testing framework/conventions in the project's style
preferences if given, and importing/requiring the real source path(s) given — never a copy.

"LEDGER/" is this tool's own record-keeping directory, not part of the runnable project — the
test file you write must live in the project's normal test location (e.g. alongside the source
file, or under a conventional tests/__tests__ directory) and must NEVER be placed under LEDGER/.

Respond with ONLY a JSON object, no prose, no markdown fences:
{ "testFilePath": "relative/path/to/a/real/test/file.ext (never under LEDGER/)", "testCode": "full file content for the automatable items", "manualItems": ["copy each manual item from the outline verbatim, or lightly cleaned up"] }`;

  const promptParts = [`Feature: ${feature}`, `Committed Logic:\n${logicText || '(none)'}`];
  if (codePaths && codePaths.length) promptParts.push(`Real source file(s) to test:\n${codePaths.join('\n')}`);
  if (styleText && styleText.trim()) promptParts.push(`Style/testing preferences (LEDGER/style.md):\n${styleText.trim()}`);
  promptParts.push(`Test outline (author-reviewed):\n${outlineText || '(none)'}`);

  const parsed = await getProvider().generate(promptParts.join('\n\n'), { system, structured: true });
  if (typeof parsed.testFilePath !== 'string' || typeof parsed.testCode !== 'string' || !Array.isArray(parsed.manualItems)) {
    throw new Error('Expected { testFilePath: string, testCode: string, manualItems: string[] } from the AI provider.');
  }
  return parsed;
}

export async function draftDocument(feature, { logicText, codeContext } = {}) {
  const system = `You draft the "Document" step of a feature in the Ledger Method — documentation
of what the code does, written so someone else (including future-you) can understand it without
re-deriving the logic. Draft it from the feature's committed Logic and the code content given
below. Respond with ONLY the markdown content itself, nothing else: no frontmatter, no code fences
around the whole thing, no meta-commentary about being a draft, and no remarks about these
instructions or your own process — the human only ever sees the raw text you return, so open
directly with the actual documentation content.`;

  const prompt = `Feature: ${feature}\n\nCommitted Logic:\n${logicText || '(none)'}\n\nCode:\n${codeContext || '(none)'}`;
  const text = await getProvider().generate(prompt, { system, structured: false });
  return text.trim();
}

export async function organizeStep(feature, step, description, brainDumpHistory) {
  const system = `You organize a human's own raw notes into a coherent draft for the "${step}"
step of a feature in the Ledger Method. Your job is NOT to invent content — it's to take THEIR
own reasoning (given below, possibly across several rounds) and organize it into clear prose
and/or short bullet lists, clarifying ambiguity and surfacing gaps as open questions without
introducing major decisions they didn't make. Respond with ONLY the markdown content itself,
nothing else: no frontmatter, no code fences around the whole thing, no meta-commentary about
being a draft, and no remarks about these instructions or your own process — the human only ever
sees the raw text you return, so open directly with the actual content.`;

  const prompt = `Feature: ${feature}\nStep: ${step}\nDescription: ${description || '(none)'}\n\nAuthor's notes:\n${(brainDumpHistory || '').trim()}`;
  const text = await getProvider().generate(prompt, { system, structured: false });
  return text.trim();
}

export async function diagnoseError(feature, { errorText, logicText, codeContext } = {}) {
  const system = `You diagnose a logged error for a feature in the Ledger Method, using its
committed Logic and code as context. You do NOT write or edit code — this is a read-only
diagnosis, not a fix. Explain, in plain language: (1) why this error most likely happened, given
the Logic and code shown, and (2) a concrete suggested approach to fixing it (what to change and
where, in prose — not a patch). If the cause is ambiguous from what's given, say what's ambiguous
and what you'd want to check. Respond with ONLY the markdown content itself, nothing else: no
frontmatter, no meta-commentary about being a diagnosis, and no remarks about these instructions
or your own process — the human only ever sees the raw text you return, so open directly with the
actual diagnosis.`;

  const prompt = `Feature: ${feature}\n\nLogged error:\n${errorText || '(none)'}\n\nCommitted Logic:\n${logicText || '(none)'}\n\nCode:\n${codeContext || '(none)'}`;
  const text = await getProvider().generate(prompt, { system, structured: false });
  return text.trim();
}

export async function annotateCode(feature, { logicText, codeText } = {}) {
  const system = `You compare generated code against a feature's committed Logic text, purely
textually — for each notable term (function/method call, import, or notable syntax) in the code,
check whether that term (or a clear plain-language equivalent) appears anywhere in the Logic text.
Flag ones that don't. This is informational only, not a code review — don't flag style issues,
bugs, or anything Logic-agnostic.

Respond with ONLY a JSON object, no prose, no markdown fences:
{ "annotations": [{ "term": "the flagged term", "note": "one or two plain-language sentences explaining what it does" }] }
Use an empty array if there's nothing worth flagging.`;

  const prompt = `Feature: ${feature}\n\nLogic:\n${logicText || '(none)'}\n\nGenerated code:\n${codeText || '(none)'}`;
  const parsed = await getProvider().generate(prompt, { system, structured: true });
  if (!Array.isArray(parsed.annotations)) {
    throw new Error('Expected { annotations: [...] } from the AI provider.');
  }
  return parsed.annotations;
}
