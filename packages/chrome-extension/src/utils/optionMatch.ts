/**
 * Matching a stored template value against the options of a select field.
 *
 * The old form's select2 matched the typed value as a case-insensitive substring, and templates
 * rely on that (a stored project "Client - Project" matches the option of the same name, a stored
 * contact "Muster AG" matches "Muster AG"). The new modal (#168) adds a second rule: bexio lists
 * people there as "Lastname Firstname", where the old form showed — and templates stored —
 * "Firstname Lastname" (and the old form was not even consistent about it). A value therefore also
 * matches when every one of its words is a word of the option, in any order.
 */

/** Collapses runs of whitespace, trims and lower-cases. */
export function normalizeOptionText(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

const words = (normalized: string) => normalized.split(" ").filter((word) => word !== "");

/**
 * How well `optionText` matches the template value `value`, best first:
 * `"exact"`, `"substring"` (select2's rule), `"words"` (every word of the value is a word of the
 * option, any order), or `null`.
 */
export function matchOption(optionText: string, value: string): "exact" | "substring" | "words" | null {
  const option = normalizeOptionText(optionText);
  const needle = normalizeOptionText(value);
  if (option === "" || needle === "") return null;
  if (option === needle) return "exact";
  if (option.includes(needle)) return "substring";
  const optionWords = new Set(words(option));
  return words(needle).every((word) => optionWords.has(word)) ? "words" : null;
}

const RANK = { exact: 0, substring: 1, words: 2 } as const;

/**
 * The option that matches `value` best: an exact match over a substring match over a word match,
 * and among equals the first in list order — select2 highlighted the first hit, too.
 */
export function findBestOption<T>(options: T[], value: string, textOf: (option: T) => string): T | null {
  let best: T | null = null;
  let bestRank: number = Number.POSITIVE_INFINITY;
  for (const option of options) {
    const match = matchOption(textOf(option), value);
    if (match !== null && RANK[match] < bestRank) {
      best = option;
      bestRank = RANK[match];
      if (bestRank === RANK.exact) break;
    }
  }
  return best;
}
