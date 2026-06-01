// Characters that are acoustically identical in modern spoken Tigrinya
// but have distinct traditional spellings.
const HOMOPHONE_GROUPS: string[][] = [
  ['ሰ', 'ሠ'],        // "se"
  ['ሀ', 'ሐ', 'ኀ'],  // "ha"
  ['አ', 'ዐ'],        // glottal "a"
  ['ጸ', 'ፀ'],        // ejective "ts'"
];

const SIBLINGS: Map<string, string[]> = new Map();
for (const group of HOMOPHONE_GROUPS) {
  for (const ch of group) {
    SIBLINGS.set(ch, group.filter(x => x !== ch));
  }
}

export interface HomophoneResult {
  hasAmbiguity: boolean;
  alternatives: string[];
}

/**
 * Scans the first characters of `word` for known homophones and returns
 * up to 2 alternative spellings for the suggestion bar.
 */
export function detectHomophoneAmbiguity(word: string): HomophoneResult {
  const chars = [...word];
  const alternatives: string[] = [];

  for (let i = 0; i < chars.length && alternatives.length < 2; i++) {
    const siblings = SIBLINGS.get(chars[i]);
    if (!siblings) continue;

    for (const sibling of siblings) {
      const alt = [...chars];
      alt[i] = sibling;
      alternatives.push(alt.join(''));
      if (alternatives.length >= 2) break;
    }
  }

  return { hasAmbiguity: alternatives.length > 0, alternatives };
}
