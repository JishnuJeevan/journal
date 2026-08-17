export function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  try {
    return JSON.parse(candidate);
  } catch (err) {
    throw new Error(`AI provider did not return parseable JSON: ${err.message}\n---\n${text}\n---`);
  }
}
