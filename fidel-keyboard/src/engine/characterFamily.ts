/**
 * Maps Ge'ez base characters (1st order / ə-form) to their phonetic family.
 * Used to color-code the keyboard so learners can visually group the alphabet.
 */
export type CharFamily =
  | 'guttural'   // ሀ ሐ ኀ ዐ  — throat / glottal
  | 'nasal'      // መ ነ ኘ     — nasal
  | 'liquid'     // ለ ረ       — lateral / rhotic
  | 'labial'     // በ ቨ ፈ ወ   — lips
  | 'sibilant'   // ሰ ሸ ዘ ዠ  — hissing
  | 'velar'      // ቀ ቐ ከ ኸ ገ — back-of-mouth
  | 'dental'     // ተ ደ       — tongue-tip
  | 'palatal'    // ቸ ጀ የ     — palate
  | 'emphatic'   // ጠ ጨ ጰ ጸ  — ejective stops
  | 'glide';     // ወ የ       — semi-vowels (shared with labial/palatal)

const FAMILY: Record<string, CharFamily> = {
  // Gutturals
  'ሀ': 'guttural', 'ሐ': 'guttural', 'ኀ': 'guttural', 'ዐ': 'guttural',
  // Nasals
  'መ': 'nasal', 'ነ': 'nasal', 'ኘ': 'nasal',
  // Liquids
  'ለ': 'liquid', 'ረ': 'liquid',
  // Labials
  'በ': 'labial', 'ቨ': 'labial', 'ፈ': 'labial',
  // Sibilants
  'ሰ': 'sibilant', 'ሸ': 'sibilant', 'ዘ': 'sibilant', 'ዠ': 'sibilant',
  // Velars
  'ቀ': 'velar', 'ቐ': 'velar', 'ከ': 'velar', 'ኸ': 'velar', 'ገ': 'velar',
  // Dentals
  'ተ': 'dental', 'ደ': 'dental',
  // Palatals
  'ቸ': 'palatal', 'ጀ': 'palatal',
  // Emphatics
  'ጠ': 'emphatic', 'ጨ': 'emphatic', 'ጰ': 'emphatic', 'ጸ': 'emphatic',
  // Glides
  'ወ': 'glide', 'የ': 'glide',
};

/** Returns the phonetic family CSS class name for a Ge'ez base character, or null */
export function getCharFamily(char: string): string | null {
  if (!char) return null;
  const family = FAMILY[char];
  return family ? `kbd-key--family-${family}` : null;
}
