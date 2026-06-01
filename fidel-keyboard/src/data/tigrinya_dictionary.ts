// Sorted roughly by frequency for best prefix-match results first
export const DICTIONARY: string[] = [
  // Core greetings & responses
  'ሰላም', 'ጽቡቅ', 'የቐንየለይ', 'ምስጋና', 'ይቕረታ',
  // Pronouns & verb forms
  'ኣነ', 'ንሱ', 'ንሳ', 'ንሕና', 'ንሳቶም', 'ንሳተን',
  'ኣለኻ', 'ኣለኺ', 'ኣለና', 'ኣሎ', 'ኣላ', 'ኣለዉ',
  'እዬ', 'ኢዩ', 'ኢያ', 'ኢና', 'ኢዮም',
  // Prepositions & connectors
  'ካብ', 'ናብ', 'ምስ', 'ኣብ', 'ብ', 'ን', 'ከም',
  'ድሕሪ', 'ቅድሚ', 'ብዛዕባ', 'ዘይ',
  // Common nouns
  'ሰብ', 'ሃገር', 'ቤት', 'ቤተሰብ', 'ዓለም', 'ቋንቋ',
  'ትምህርቲ', 'ስራሕ', 'ዕዮ', 'ህይወት', 'ፍቕሪ', 'ሰላም',
  'ሓቂ', 'ሓጺር', 'ሓድሽ', 'ሃብቲ', 'ሓይሊ', 'ሓዊ',
  'ቀን', 'ሰሙን', 'ወርሒ', 'ዓመት', 'ሰዓት',
  'ኤርትራ', 'ትግርኛ', 'ኣፍሪቃ',
  // Common verbs (infinitive / noun form)
  'ምባል', 'ምሕጋዝ', 'ምስራሕ', 'ምኻድ', 'ምምጻእ',
  'ምርዳእ', 'ምዝራብ', 'ምፍቃር', 'ምሓዝ',
  // Descriptors
  'ጽቡቅ', 'ሕማቅ', 'ዓቢ', 'ንኡስ', 'ሓጺር', 'ነዊሕ',
  'ሓዲሽ', 'ዝሓለፈ', 'ቀዳማይ', 'ካልኣይ',
  // Common phrases (treated as single tokens for prefix matching)
  'ሰሓቢ', 'ሰሓባዊ', 'ሰናዳ', 'ሰፊሕ',
];

// Bigram model: after typing this word → these words are likely next
export const BIGRAMS: Record<string, string[]> = {
  'ሰላም':     ['ከመይ', 'ምስ', 'ዓለም', 'ኣሕዋት'],
  'ከመይ':     ['ኣለኻ', 'ኣለኺ', 'ኣለና', 'ኢሉ'],
  'ጽቡቅ':     ['እዬ', 'ኢዩ', 'ኢያ', 'ኢና'],
  'ናብ':      ['ሃገር', 'ቤት', 'ኤርትራ', 'ዓለም'],
  'ካብ':      ['ሃገር', 'ኤርትራ', 'ቤት', 'ኣፍሪቃ'],
  'ኣብ':      ['ሃገር', 'ቤት', 'ትምህርቲ', 'ስራሕ'],
  'ምስ':      ['ሰብ', 'ሰላም', 'ቤተሰብ', 'ፍቕሪ'],
  'ብዛዕባ':   ['ሃገር', 'ሰብ', 'ፍቕሪ', 'ህይወት'],
  'ትምህርቲ': ['ጽቡቅ', 'ምስ', 'ናብ'],
  'ህይወት':   ['ጽቡቅ', 'ምስ', 'ናብ', 'ብዛዕባ'],
  'ፍቕሪ':    ['ምስ', 'ናብ', 'ካብ'],
  'ኤርትራ':  ['ሃገር', 'ናብ', 'ካብ'],
};

// Smart greeting chips — shown when input is empty
export const GREETING_CHIPS: string[] = [
  'ሰላም ።',
  'ሰላም ከመይ ኣለኻ ፧',
  'ጽቡቅ እዬ ።',
  'የቐንየለይ ።',
  'ሰላም ከመይ ኣለኺ ፧',
  'ምስ ሰላምታ ።',
];

// Common phrase templates for phrase mode
export const PHRASE_TEMPLATES: string[] = [
  'ሰላም ።',
  'ጽቡቅ እዬ ።',
  'የቐንየለይ ።',
  'ይቕረታ ።',
  'ምስ ሰላምታ ።',
];
