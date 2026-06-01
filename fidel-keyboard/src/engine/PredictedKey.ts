import { TransliterationRules } from './PhoneticParser';

// Reverse map: Ge'ez character → shortest Latin sequence that produces it
const REVERSE: Map<string, string> = new Map();
for (const [latin, geez] of Object.entries(TransliterationRules)) {
  if (!REVERSE.has(geez) || latin.length < (REVERSE.get(geez)!.length)) {
    REVERSE.set(geez, latin);
  }
}

/**
 * Given the committed Ge'ez so far, the current raw Latin buffer, and the
 * center-chip prediction, returns the NEXT Latin key the user should press.
 *
 * Example: center='ሰላም', currentGeez='', rawBuffer=''  → 's'  (start 'se')
 * Example: center='ሰላም', currentGeez='', rawBuffer='s' → 'e'  (finish 'se' → ሰ)
 * Example: center='ሰላም', currentGeez='ሰ', rawBuffer='' → 'l'  (start 'la')
 */
export function predictNextLatinKey(
  currentGeez: string,
  rawBuffer: string,
  centerChip: string
): string | null {
  if (!centerChip) return null;

  const currentChars = [...currentGeez];
  const chipChars    = [...centerChip];

  // The next Ge'ez character the chip predicts after what's already committed
  const nextGeez = chipChars[currentChars.length];
  if (!nextGeez) return null;

  // The full Latin sequence needed to produce that Ge'ez character
  const latin = REVERSE.get(nextGeez);
  if (!latin) return null;

  // If the user has already typed part of this sequence in their raw buffer,
  // guide them to the very next character they need — not the first one again
  const remaining = latin.slice(rawBuffer.length);
  if (!remaining) return null;

  return remaining[0].toLowerCase();
}
