/**
 * Search utility functions
 * Reusable search and matching helpers
 */

/**
 * Normalize search text for comparison
 */
export function normalizeSearchText(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Fuzzy match - allows for typos and partial matches
 */
export function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true;
  if (!text) return false;

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // Exact match
  if (textLower.includes(queryLower)) return true;

  // Fuzzy match - allows for typos and partial matches
  let textIndex = 0;
  let queryIndex = 0;

  while (textIndex < textLower.length && queryIndex < queryLower.length) {
    if (textLower[textIndex] === queryLower[queryIndex]) {
      queryIndex++;
    }
    textIndex++;
  }

  // If we matched most of the query characters, consider it a match
  return queryIndex >= queryLower.length * 0.7;
}

/**
 * Get highlight parts for search results
 */
export function getHighlightParts(text: string, query: string): Array<{ text: string; highlight: boolean }> {
  if (!query || !text) return [{ text, highlight: false }];

  const regex = new RegExp(`(${query.split("").join(".*?")})`, "gi");
  const parts: Array<{ text: string; highlight: boolean }> = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), highlight: false });
    }
    parts.push({ text: match[0], highlight: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlight: false });
  }

  return parts.length > 0 ? parts : [{ text, highlight: false }];
}

/**
 * Smart search with phrase matching
 */
export function smartSearch<T>(
  items: T[],
  query: string,
  searchFields: (keyof T)[]
): T[] {
  if (!query) return items;

  const q = normalizeSearchText(query);

  return items.filter((item) =>
    searchFields.some((field) => {
      const value = String(item[field] || "");
      return fuzzyMatch(value, q);
    })
  );
}

/**
 * Exact match search
 */
export function exactMatch<T>(items: T[], query: string, searchFields: (keyof T)[]): T[] {
  if (!query) return items;

  const q = normalizeSearchText(query);

  return items.filter((item) =>
    searchFields.some((field) => {
      const value = String(item[field] || "").toLowerCase();
      return value === q || value.includes(q);
    })
  );
}

/**
 * Multi-field search with weights
 */
export function weightedSearch<T>(
  items: T[],
  query: string,
  fieldWeights: Record<string, number>
): Array<{ item: T; score: number }> {
  if (!query) return items.map((item) => ({ item, score: 1 }));

  const q = normalizeSearchText(query);

  return items
    .map((item) => {
      let score = 0;
      for (const [field, weight] of Object.entries(fieldWeights)) {
        const value = String((item as any)[field] || "").toLowerCase();
        if (value === q) score += weight * 2;
        else if (value.includes(q)) score += weight;
        else if (fuzzyMatch(value, q)) score += weight * 0.5;
      }
      return { item, score };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score);
}
