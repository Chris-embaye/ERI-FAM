import type { Suggestion, LayoutMode } from '../types/keyboard.types';
import { WordTrie } from '../engine/WordTrie';
import { detectHomophoneAmbiguity } from './HomophoneCorrector';
import { detectCompound } from '../engine/CompoundWordFixer';
import { convertPhoneticToGeez, hasGeezChars, isLatinOnly } from '../engine/PhoneticParser';
import { lookupTransliteration } from '../data/transliteration';
import { todayEthiopian } from '../data/ethiopian_calendar';
import { DICTIONARY, BIGRAMS, GREETING_CHIPS, PHRASE_TEMPLATES } from '../data/tigrinya_dictionary';

const trie = new WordTrie();
for (const word of DICTIONARY) trie.insert(word);

/**
 * Fuzzy cascading prefix search.
 * Tries the full Ge'ez phonetic string first, then falls back to progressively
 * shorter prefixes until matches are found. This handles mid-syllable input
 * where "ሰል" (from "sel") has no matches but "ሰ" (from "se") finds many.
 */
function cascadeSearch(phonetic: string, limit: number): string[] {
  const chars = [...phonetic];           // handles multi-byte Ethiopic correctly
  for (let len = chars.length; len >= 1; len--) {
    const prefix = chars.slice(0, len).join('');
    const results = trie.search(prefix, limit + 1).filter(w => w !== phonetic);
    if (results.length > 0) return results.slice(0, limit);
  }
  return [];
}

export class ContextualSuggestions {
  getSuggestions(
    text: string,
    showCalendar = false,
    layoutMode: LayoutMode = 'geez',
    phoneticMode = true
  ): Suggestion[] {
    // ── Calendar / number pad ────────────────────────────────────────────
    if (showCalendar) {
      return [
        { text: todayEthiopian(), type: 'calendar', gloss: 'Today (ዓዲ ዓዲ)' },
        { text: '፩፪፫',            type: 'calendar', gloss: 'Ge\'ez numerals'  },
      ];
    }

    const trimmed = text.trimEnd();

    // ── English layout — phonetic engine OFF ─────────────────────────────
    if (layoutMode === 'english' && !phoneticMode) {
      return GREETING_CHIPS.slice(0, 3).map(t => ({ text: t, type: 'greeting' as const }));
    }

    // ── English layout — Dynamic Suggestion Engine (rolling window) ───────
    if (layoutMode === 'english' && phoneticMode) {
      const inputWords = trimmed.split(' ');
      const currentWord    = inputWords[inputWords.length - 1];
      const completedWords = inputWords.slice(0, -1);

      // Convert every completed word that is Latin phonetics → Ge'ez
      const convertedParts = completedWords.map(w =>
        isLatinOnly(w) ? convertPhoneticToGeez(w) : w
      );
      const prefixStr = convertedParts.length > 0
        ? convertedParts.join(' ') + ' '
        : '';

      if (currentWord && isLatinOnly(currentWord)) {
        // Acoustic phonetic conversion of the active partial word
        const convertedCurrent = convertPhoneticToGeez(currentWord);

        // Cascading fuzzy prefix search across the trie
        const matches = hasGeezChars(convertedCurrent)
          ? cascadeSearch(convertedCurrent, 3)
          : [];

        // Also check the whole-word transliteration map for a direct match
        const wordMatch = lookupTransliteration(currentWord);

        const chips: Suggestion[] = [
          // LEFT: exact phonetic of what has been typed so far (full rolling sentence)
          {
            text:  prefixStr + (hasGeezChars(convertedCurrent) ? convertedCurrent : currentWord),
            type:  'transliteration',
            gloss: 'ፊደሊ',
          },
          // CENTRE: best dictionary completion (or word-level match, or contextual fallback)
          matches[0]
            ? { text: prefixStr + matches[0], type: 'completion' }
            : wordMatch
              ? { text: prefixStr + wordMatch, type: 'transliteration', gloss: 'ቃልቁ' }
              : { text: prefixStr + (convertedCurrent || currentWord) + ' ከመይ', type: 'prediction' },
          // RIGHT: second match, or pure English safety-valve
          matches[1]
            ? { text: prefixStr + matches[1], type: 'completion' }
            : { text: currentWord, type: 'phrase', gloss: 'English' },
        ];

        return chips;
      }

      // Nothing being typed on English layout
      return GREETING_CHIPS.slice(0, 3).map(t => ({ text: t, type: 'greeting' as const }));
    }

    // ── Ge'ez layout ─────────────────────────────────────────────────────
    if (trimmed.length === 0) {
      return GREETING_CHIPS.slice(0, 3).map(t => ({ text: t, type: 'greeting' as const }));
    }

    const words       = trimmed.split(/\s+/);
    const currentWord = words[words.length - 1];
    const prevWord    = words.length > 1 ? words[words.length - 2] : '';

    // Compound grammar check
    const compound = detectCompound(text);
    if (compound) {
      const chips: Suggestion[] = [
        { text: compound.rule.result, type: 'compound', gloss: compound.rule.gloss },
      ];
      trie.search(currentWord, 2).forEach(w => { if (chips.length < 3) chips.push({ text: w, type: 'completion' }); });
      return chips;
    }

    // Homophone spelling correction
    if (currentWord && currentWord.length > 1) {
      const { hasAmbiguity, alternatives } = detectHomophoneAmbiguity(currentWord);
      if (hasAmbiguity) {
        const chips: Suggestion[] = alternatives.map(a => ({ text: a, type: 'homophone' as const }));
        trie.search(currentWord, 1)
          .filter(w => !alternatives.includes(w))
          .forEach(w => { if (chips.length < 3) chips.push({ text: w, type: 'completion' }); });
        return chips.slice(0, 3);
      }
    }

    // Trie prefix completions — O(|prefix|) via the cascading search
    if (currentWord) {
      const completions = cascadeSearch(currentWord, 3);
      if (completions.length) return completions.map(w => ({ text: w, type: 'completion' as const }));
    }

    // Bigram next-word prediction
    const anchor = currentWord || prevWord;
    if (anchor) {
      const preds = BIGRAMS[anchor];
      if (preds?.length) return preds.slice(0, 3).map(w => ({ text: w, type: 'prediction' as const }));
    }

    // Spelling check: if the previous completed word is unknown, suggest corrections
    if (prevWord && prevWord.length > 2 && hasGeezChars(prevWord)) {
      const exact = trie.search(prevWord, 1);
      if (exact[0] !== prevWord) {
        const corrections = cascadeSearch(prevWord, 2);
        if (corrections.length) {
          return [
            { text: corrections[0], type: 'completion' as const, gloss: '✓ ቅኑዕ?' },
            ...(corrections[1] ? [{ text: corrections[1], type: 'completion' as const, gloss: '✓ ቅኑዕ?' }] : []),
            ...PHRASE_TEMPLATES.slice(0, 1).map(p => ({ text: p, type: 'phrase' as const })),
          ].slice(0, 3);
        }
      }
    }

    return PHRASE_TEMPLATES.slice(0, 3).map(p => ({ text: p, type: 'phrase' as const }));
  }

  /** Returns the set of Ge'ez words in `text` that are NOT in the dictionary */
  getUnknownWords(text: string): Set<string> {
    const unknown = new Set<string>();
    const words = text.split(/[\s፡።፣፤፧]+/).filter(Boolean);
    for (const word of words) {
      if (!hasGeezChars(word) || word.length < 2) continue;
      const exact = trie.search(word, 1);
      if (exact[0] !== word) unknown.add(word);
    }
    return unknown;
  }
}
