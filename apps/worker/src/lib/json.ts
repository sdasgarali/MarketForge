/**
 * Tolerant JSON extraction from LLM text output. Models often wrap JSON in
 * prose or ```json fences; this pulls the first balanced object/array out and
 * parses it, returning undefined on failure so callers can fall back safely.
 */

/** Extract and parse the first JSON object/array found in `text`. */
export function extractJson<T = unknown>(text: string): T | undefined {
  if (!text) return undefined;

  // Strip code fences first.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? text;

  // Find the first balanced { } or [ ] region.
  const start = candidate.search(/[{[]/);
  if (start === -1) return undefined;
  const open = candidate[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < candidate.length; i++) {
    const ch = candidate[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        const slice = candidate.slice(start, i + 1);
        try {
          return JSON.parse(slice) as T;
        } catch {
          return undefined;
        }
      }
    }
  }
  return undefined;
}

/** Split a comma/newline/hash-separated string into a clean hashtag list. */
export function parseHashtags(input: string | string[] | undefined): string[] {
  if (!input) return [];
  const raw = Array.isArray(input) ? input : input.split(/[\s,]+/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const tag = t.trim().replace(/^#+/, '');
    if (!tag) continue;
    const norm = `#${tag}`;
    if (!seen.has(norm.toLowerCase())) {
      seen.add(norm.toLowerCase());
      out.push(norm);
    }
  }
  return out;
}
