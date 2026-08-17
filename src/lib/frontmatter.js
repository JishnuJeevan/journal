import fs from 'node:fs';
import matter from 'gray-matter';

export function readStepFile(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return matter(raw);
}

/**
 * Writes a step markdown file as `---\n<yaml frontmatter>\n---\n\n<body>`.
 * `data` is the frontmatter object; `body` is the markdown content below it.
 */
export function writeStepFile(file, data, body) {
  const out = matter.stringify(body ?? '', data);
  fs.writeFileSync(file, out, 'utf8');
}

export function updateFrontmatter(file, patch) {
  const parsed = readStepFile(file);
  const data = { ...parsed.data, ...patch };
  writeStepFile(file, data, parsed.content);
  return data;
}
