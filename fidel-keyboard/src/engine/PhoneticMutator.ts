import type { GeezMatrix } from '../types/keyboard.types';

// Vowel modifier → order index in the Ge'ez abugida family array
// 0=base 1=u 2=i 3=a 4=e 5=ə(reduced) 6=o 7=wa(labial)
const VOWEL_ORDER_MAP: Record<string, number> = {
  'ኡ': 1,  // u  — 2nd order
  'ኢ': 2,  // i  — 3rd order
  'አ': 3,  // a  — 4th order (short form; appears in እ variants)
  'ኣ': 3,  // a  — 4th order (long form)
  'ኤ': 4,  // e  — 5th order (appears in እ variants)
  'ኦ': 6,  // o  — 7th order
};

export class PhoneticMutator {
  private matrix: GeezMatrix;
  // Maps every variant back to its family base key for O(1) reverse lookup
  private charToFamily: Map<string, string>;

  constructor(matrix: GeezMatrix) {
    this.matrix = matrix;
    this.charToFamily = new Map();

    for (const [base, variants] of Object.entries(matrix)) {
      this.charToFamily.set(base, base);
      for (const v of variants) {
        this.charToFamily.set(v, base);
      }
    }
  }

  isVowelModifier(char: string): boolean {
    return Object.prototype.hasOwnProperty.call(VOWEL_ORDER_MAP, char);
  }

  /**
   * If `inputChar` is a vowel modifier and `currentText` ends with a Ge'ez
   * consonant syllable, returns the mutated text string. Otherwise null.
   *
   * Spreading with [...str] handles multi-byte Unicode code points correctly.
   */
  tryMutate(currentText: string, inputChar: string): string | null {
    const orderIdx = VOWEL_ORDER_MAP[inputChar];
    if (orderIdx === undefined || currentText.length === 0) return null;

    const chars = [...currentText];
    const lastChar = chars[chars.length - 1];
    const familyKey = this.charToFamily.get(lastChar);
    if (!familyKey) return null;

    const variants = this.matrix[familyKey];
    if (!variants || orderIdx >= variants.length) return null;

    return chars.slice(0, -1).join('') + variants[orderIdx];
  }
}
