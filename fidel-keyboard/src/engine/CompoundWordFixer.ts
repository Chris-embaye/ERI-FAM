import { checkCompound } from '../data/compound_rules';
import type { CompoundRule } from '../data/compound_rules';

export interface CompoundMatch {
  rule: CompoundRule;
  replaceLastNWords: number;  // how many words to replace from the end of the buffer
}

/**
 * Checks whether the last two non-empty words in `text` form a known
 * Tigrinya compound construct. Returns a match if so, null otherwise.
 */
export function detectCompound(text: string): CompoundMatch | null {
  const trimmed = text.trimEnd();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length < 2) return null;

  const w1 = words[words.length - 2];
  const w2 = words[words.length - 1];
  const rule = checkCompound(w1, w2);
  if (!rule) return null;

  return { rule, replaceLastNWords: 2 };
}

/**
 * Applies a compound rule to the text buffer: strips the last two words
 * and replaces them with the grammatically correct compound form.
 */
export function applyCompound(text: string, match: CompoundMatch): string {
  const words = text.trimEnd().split(/\s+/);
  const prefix = words.slice(0, words.length - match.replaceLastNWords).join(' ');
  const suffix = prefix ? ' ' : '';
  // Preserve any trailing whitespace from the original text
  const trailingSpace = text !== text.trimEnd() ? ' ' : '';
  return prefix + suffix + match.rule.result + trailingSpace;
}
