export interface CompoundRule {
  word1:   string;   // first word as typed
  word2:   string;   // second word as typed
  result:  string;   // grammatically correct compound (with construct state applied)
  gloss:   string;   // English meaning shown in chip tooltip
}

// Tigrinya construct-state (ዉሱን ቁርን) compound word rules.
// The first noun often drops or transforms its final phoneme before the second.
export const COMPOUND_RULES: CompoundRule[] = [
  // Religious / buildings
  { word1: 'ቤት',   word2: 'ክርስትያን', result: 'ቤተ ክርስትያን', gloss: 'church' },
  { word1: 'ቤት',   word2: 'ትምህርቲ',  result: 'ቤት ትምህርቲ',  gloss: 'school' },
  { word1: 'ቤት',   word2: 'ማሕቡስ',   result: 'ቤት ማሕቡስ',   gloss: 'prison' },
  { word1: 'ቤት',   word2: 'ጸሎት',    result: 'ቤተ ጸሎት',    gloss: 'prayer house' },
  { word1: 'ቤት',   word2: 'መጻሕፍቲ',  result: 'ቤተ መጻሕፍቲ',  gloss: 'library' },
  // Geography
  { word1: 'ሃገር',  word2: 'ኤርትራ',   result: 'ሃገረ ኤርትራ',  gloss: 'state of Eritrea' },
  { word1: 'ምድሪ',  word2: 'ባሕሪ',    result: 'ምድረ ባሕሪ',   gloss: 'sea level / seashore' },
  { word1: 'ገዛ',   word2: 'ኣቦ',     result: 'ገዛ ኣቦ',     gloss: 'father\'s house / home' },
  // Kinship / society
  { word1: 'ወዲ',   word2: 'ሰብ',     result: 'ወዲ ሰብ',     gloss: 'human being' },
  { word1: 'ዓዲ',   word2: 'ሰብ',     result: 'ዓዲ ሰብ',     gloss: 'civilians' },
  { word1: 'ኣቦ',   word2: 'ቤተሰብ',   result: 'ኣቦ ቤተሰብ',   gloss: 'head of family' },
  // Common collocations
  { word1: 'ቃል',   word2: 'ኪዳን',    result: 'ቃለ ኪዳን',    gloss: 'covenant / vow' },
  { word1: 'ቃል',   word2: 'ኣምላኽ',   result: 'ቃለ ኣምላኽ',   gloss: 'word of God' },
  { word1: 'ዳኛ',   word2: 'ቤት',     result: 'ዳኛ ቤት',     gloss: 'court of law' },
  { word1: 'ፍቕሪ',  word2: 'ሃገር',    result: 'ፍቕሪ ሃገር',   gloss: 'patriotism' },
  { word1: 'ሓለዋ',  word2: 'ሃገር',    result: 'ሓለዋ ሃገር',   gloss: 'national defense' },
  { word1: 'ምህዞ',  word2: 'ሓሳብ',    result: 'ምህዞ ሓሳብ',   gloss: 'creative idea' },
];

// O(1) lookup: "word1::word2" → CompoundRule
const INDEX = new Map<string, CompoundRule>(
  COMPOUND_RULES.map(r => [`${r.word1}::${r.word2}`, r])
);

export function checkCompound(word1: string, word2: string): CompoundRule | null {
  return INDEX.get(`${word1}::${word2}`) ?? null;
}
