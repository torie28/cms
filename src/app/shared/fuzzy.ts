/**
 * Neutral, language-blind fuzzy matching. It works on raw letters only — lowercasing
 * and stripping accents — with no English sounds or dictionary, so a hard Maasai name
 * is matched exactly like any other. Scores run 0 (no match) to 1 (exact).
 */

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein edit distance between two short strings. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }

  return prev[b.length];
}

/** Best closeness of the query to any single word of the target (0..1). */
function wordRatio(query: string, words: string[]): number {
  let best = 0;
  for (const word of words) {
    if (!word) continue;
    const distance = editDistance(query, word);
    const ratio = 1 - distance / Math.max(query.length, word.length);
    if (ratio > best) best = ratio;
  }
  return best;
}

/**
 * Scores how well `query` matches `target`. Tuned to stay quiet: a loose, far-off
 * query returns 0 rather than noise. Exact and prefix hits rank highest, then
 * whole-word prefixes, then near-spellings of a word (catching typos like Mrao→Mario).
 */
export function fuzzyScore(query: string, target: string): number {
  const q = normalize(query);
  const t = normalize(target);
  if (!q || !t) return 0;
  if (t === q) return 1;

  const index = t.indexOf(q);
  if (index === 0) return 0.95;
  if (index > 0) return 0.85 - Math.min(index, 20) * 0.005;

  const words = t.split(' ');
  if (words.some((word) => word.startsWith(q))) return 0.8;

  // Typo tolerance: only worthwhile for queries long enough to not match everything.
  if (q.length >= 3) {
    const ratio = wordRatio(q, words);
    if (ratio >= 0.6) return ratio * 0.7;
  }

  return 0;
}

/** Whether the query is a good enough match to show at all. */
export function fuzzyMatches(query: string, target: string): boolean {
  return fuzzyScore(query, target) > 0;
}
