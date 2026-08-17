import { getProvider } from './ai-providers/provider.js';

export async function proposeFeatures(brainDump) {
  const system = `You help decompose a software project description into a list of discrete
features, for a development methodology called the Ledger Method. A "feature" is a
discrete unit of functionality (a function, module, or user-facing capability).

Respond with ONLY a JSON array, no prose, no markdown fences. Each element:
{ "slug": "kebab-case-id", "name": "Human Readable Name", "description": "One or two sentence description." }

Propose 3-10 features. Slugs must be unique, lowercase, kebab-case, filesystem-safe.`;

  const parsed = await getProvider().generate(brainDump, { system, structured: true });
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

export async function draftLogic(feature, description, brainDump) {
  const groundedSystem = `You draft a starting point for the "Logic" step of a feature in the
Ledger Method. Logic is a high-level, human-understandable description of how a feature should
work — the reasoning, not the implementation. This draft exists ONLY to give a human something to
react to, edit, and correct — it is explicitly not meant to be accepted as-is.

The human has given you their own raw, half-formed thinking about this feature below (a "brain
dump"). Your job is NOT to invent the logic yourself — it's to take THEIR reasoning and organize
it into a coherent, well-structured draft: clarify ambiguous points, surface gaps or unstated
assumptions as open questions, and put it in plain prose and short bullet lists where useful. Stay
grounded in what they actually wrote; don't introduce major decisions they didn't make. Do not
write code. Respond with the markdown content only — no frontmatter, no code fences around the
whole thing, no meta-commentary about being a draft (the tool adds that banner itself).`;

  const improviseSystem = `You draft a starting point for the "Logic" step of a feature in the
Ledger Method. Logic is a high-level, human-understandable description of how a feature should
work — the reasoning, not the implementation. This draft exists ONLY to give a human something to
react to, edit, and correct — it is explicitly not meant to be accepted as-is. Write it as a
genuine, concrete attempt (not vague hand-waving), in plain prose and short bullet lists where
useful. Do not write code. Respond with the markdown content only — no frontmatter, no code
fences around the whole thing, no meta-commentary about being a draft (the tool adds that banner
itself).`;

  const hasBrainDump = Boolean(brainDump && brainDump.trim());

  const prompt = hasBrainDump
    ? `Feature: ${feature}\nDescription: ${description || '(no description provided)'}\n\nAuthor's brain dump:\n${brainDump.trim()}`
    : `Feature: ${feature}\nDescription: ${description || '(no description provided)'}`;

  const text = await getProvider().generate(prompt, {
    system: hasBrainDump ? groundedSystem : improviseSystem,
    structured: false,
  });
  return text.trim();
}
