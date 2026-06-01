// Latin phonetic → Tigrinya Ge'ez lookup table.
// Keyed in lowercase for case-insensitive matching.
export const TRANSLITERATION_MAP: Record<string, string> = {
  // Greetings
  'selam':        'ሰላም',
  'salam':        'ሰላም',
  'kemey':        'ከመይ',
  'tsbuq':        'ጽቡቅ',
  'tsbuq eye':    'ጽቡቅ እዬ',
  'yeqenyeley':   'የቐንየለይ',
  'yiqenyeley':   'የቐንየለይ',
  'yiqre':        'ይቕረ',
  'yiqreta':      'ይቕረታ',
  'misgana':      'ምስጋና',
  // Pronouns
  'ane':          'ኣነ',
  'nssu':         'ንሱ',
  'nsa':          'ንሳ',
  'nhna':         'ንሕና',
  'nsatom':       'ንሳቶም',
  // Prepositions
  'ab':           'ኣብ',
  'kab':          'ካብ',
  'nab':          'ናብ',
  'mis':          'ምስ',
  'bzaaba':       'ብዛዕባ',
  'dhri':         'ድሕሪ',
  'qdmi':         'ቅድሚ',
  // Common nouns
  'seb':          'ሰብ',
  'hager':        'ሃገር',
  'bet':          'ቤት',
  'beteseb':      'ቤተሰብ',
  'alem':         'ዓለም',
  'hiwet':        'ህይወት',
  'fiqri':        'ፍቕሪ',
  'sirah':        'ስራሕ',
  'tmhrti':       'ትምህርቲ',
  'kwankwa':      'ቋንቋ',
  'eritrea':      'ኤርትራ',
  'tigrinya':     'ትግርኛ',
  'africa':       'ኣፍሪቃ',
  // Numbers (Tigrinya spoken forms)
  'hade':         'ሓደ',
  'kilte':        'ክልተ',
  'seleste':      'ሰለስተ',
  'arbaite':      'ኣርባዕተ',
  'hamushte':     'ሓሙስተ',
  'shudushte':    'ሽዱስተ',
  'shewwate':     'ሸውዓተ',
  'shmonte':      'ሸሞንተ',
  'teshaite':     'ትሸዓተ',
  'aserte':       'ዓሰርተ',
};

/**
 * Given a lowercase Latin word, returns the Tigrinya equivalent or null.
 */
export function lookupTransliteration(word: string): string | null {
  return TRANSLITERATION_MAP[word.toLowerCase()] ?? null;
}

/** Returns true if every code point in the string is ASCII (Latin keyboard). */
export function isLatinWord(word: string): boolean {
  return /^[a-zA-Z'-]+$/.test(word);
}
