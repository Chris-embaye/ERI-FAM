/**
 * Acoustic Phonetic Mapping Engine for Tigrinya Ge'ez.
 *
 * Case-sensitivity rule (matches the user's document):
 *   lowercase t → ተ  (soft)     uppercase T → ጠ  (emphatic ejective)
 *   lowercase c → ቸ  (ch-soft)  uppercase C → ጨ  (ch-emphatic)
 *   lowercase p → ፈ  (f-sound)  uppercase P → ጰ  (p-emphatic)
 *   lowercase h → ሀ  (light h)  uppercase H → ሐ  (pharyngeal h)
 *
 * Look-ahead priority: 4-char → 3-char → 2-char → 1-char → keep as-is
 */
export const TransliterationRules: Record<string, string> = {
  // ── H, ሐ, ኀ families & pure vowels / glottals ──────────────────
  "he":"ሀ","hu":"ሁ","hi":"ሂ","ha":"ሃ","hie":"ሄ","h":"ህ","ho":"ሆ",
  "He":"ሐ","Hu":"ሑ","Hi":"ሒ","Ha":"ሓ","Hie":"ሔ","H":"ሕ","Ho":"ሖ","Hua":"ሕዋ",
  "h2e":"ኀ","h2u":"ኁ","h2i":"ኂ","h2a":"ኃ","h2ie":"ኄ","h2":"ኅ","h2o":"ኆ",

  // Pure vowels (standalone)
  "a":"ኣ","u":"ኡ","i":"ኢ","e":"እ","ie":"ኤ","o":"ኦ",

  // ዐ-family (pharyngeal)
  "Ae":"ዐ","Au":"ዑ","Ai":"ዒ","Aa":"ዓ","Aie":"ዔ","A":"ዕ","Ao":"ዖ",

  // ── L, M, R, S, SH families ─────────────────────────────────────
  "le":"ለ","lu":"ሉ","li":"ሊ","la":"ላ","lie":"ሌ","l":"ል","lo":"ሎ","lua":"ሏ",
  "me":"መ","mu":"ሙ","mi":"ሚ","ma":"ማ","mie":"ሜ","m":"ም","mo":"ሞ","mua":"ሟ",
  "re":"ረ","ru":"ሩ","ri":"ሪ","ra":"ራ","rie":"ሬ","r":"ር","ro":"ሮ","rua":"ሯ",
  "se":"ሰ","su":"ሱ","si":"ሲ","sa":"ሳ","sie":"ሴ","s":"ስ","so":"ሶ","sua":"ሷ",
  "she":"ሸ","shu":"ሹ","shi":"ሺ","sha":"ሻ","shie":"ሼ","sh":"ሽ","sho":"ሾ","shua":"ሿ",

  // ── Q, B, T (soft), CH (soft), N, NY families ────────────────────
  "qe":"ቀ","qu":"ቁ","qi":"ቂ","qa":"ቃ","qie":"ቄ","q":"ቅ","qo":"ቆ","qua":"ቋ",
  "be":"በ","bu":"ቡ","bi":"ቢ","ba":"ባ","bie":"ቤ","b":"ብ","bo":"ቦ","bua":"ቧ",
  "te":"ተ","tu":"ቱ","ti":"ቲ","ta":"ታ","tie":"ቴ","t":"ት","to":"ቶ","tua":"ቷ",
  "che":"ቸ","chu":"ቹ","chi":"ቺ","cha":"ቻ","chie":"ቼ","ch":"ች","cho":"ቾ","chua":"ቿ",
  "ne":"ነ","nu":"ኑ","ni":"ኒ","na":"ና","nie":"ኔ","n":"ን","no":"ኖ","nua":"ኗ",
  "nye":"ኘ","nyu":"ኙ","nyi":"ኚ","nya":"ኛ","nyie":"ኜ","ny":"ኝ","nyo":"ኞ","nyua":"ኧ",

  // ── K, KH, W, Z, ZH, Y families ─────────────────────────────────
  "ke":"ከ","ku":"ኩ","ki":"ኪ","ka":"ካ","kie":"ኬ","k":"ክ","ko":"ኮ","kua":"ኳ",
  "khe":"ኸ","khu":"ኹ","khi":"ኺ","kha":"ኻ","khie":"ኼ","kh":"ኽ","kho":"ኾ","khua":"ዃ",
  "we":"ወ","wu":"ዉ","wi":"ዊ","wa":"ዋ","wie":"ዌ","w":"ው","wo":"ዎ",
  "ze":"ዘ","zu":"ዙ","zi":"ዚ","za":"ዛ","zie":"ዜ","z":"ዝ","zo":"ዞ","zua":"ዟ",
  "zhe":"ዠ","zhu":"ዡ","zhi":"ዢ","zha":"ዣ","zhie":"ዤ","zh":"ዥ","zho":"ዦ","zhua":"ዧ",
  "ye":"የ","yu":"ዩ","yi":"ዪ","ya":"ያ","yie":"ዬ","y":"ይ","yo":"ዮ",

  // ── D, J, G, NG (Gy) families ────────────────────────────────────
  "de":"ደ","du":"ዱ","di":"ዲ","da":"ዳ","die":"ዴ","d":"ድ","do":"ዶ","dua":"ዷ",
  "je":"ጀ","ju":"ጁ","ji":"ጂ","ja":"ጃ","jie":"ጄ","j":"ጅ","jo":"ጆ","jua":"ጇ",
  "ge":"ገ","gu":"ጉ","gi":"ጊ","ga":"ጋ","gie":"ጌ","g":"ግ","go":"ጎ","gua":"ጓ",
  "Gye":"ጘ","Gyu":"ጙ","Gyi":"ጚ","Gya":"ጛ","Gyie":"ጜ","Gy":"ጝ","Gyo":"ጞ",

  // ── Emphatic ejectives: T', C', P', TS' ─────────────────────────
  "Te":"ጠ","Tu":"ጡ","Ti":"ጢ","Ta":"ጣ","Tie":"ጤ","T":"ጥ","To":"ጦ","Tua":"ጧ",
  "Ce":"ጨ","Cu":"ጩ","Ci":"ጪ","Ca":"ጫ","Cie":"ጬ","C":"ጭ","Co":"ጮ","Cua":"ጯ",
  "Pe":"ጰ","Pu":"ጱ","Pi":"ጲ","Pa":"ጳ","Pie":"ጴ","P":"ጵ","Po":"ጶ","Pua":"ጷ",
  "tse":"ጸ","tsu":"ጹ","tsi":"ጺ","tsa":"ጻ","tsie":"ጼ","ts":"ጽ","tso":"ጾ",

  // ── F/P family (ፈ — modern Tigrinya merges f and p) ─────────────
  "fe":"ፈ","fu":"ፉ","fi":"ፊ","fa":"ፋ","fie":"ፌ","f":"ፍ","fo":"ፎ","fua":"ፏ",
  "pe":"ፈ","pu":"ፉ","pi":"ፊ","pa":"ፋ","pie":"ፌ","p":"ፍ","po":"ፎ","pua":"ፏ",

  // P2 family (ፐ — rare bilabial stop)
  "P2e":"ፐ","P2u":"ፑ","P2i":"ፒ","P2a":"ፓ","P2ie":"ፔ","P2":"ፕ","P2o":"ፖ",

  // ── Ge'ez punctuation shortcuts ──────────────────────────────────
  ":":"፡","::":"።",",":"፣",";":"፤","?":"፧",

  // ── Ge'ez numeral shortcuts (digit + slash) ───────────────────────
  "1/":"፩","2/":"፪","3/":"፫","4/":"፬","5/":"፭",
  "6/":"፮","7/":"፯","8/":"፰","9/":"፱","10/":"፲",
};

/** True if the string contains at least one Ge'ez (Ethiopic) code point */
export function hasGeezChars(str: string): boolean {
  return /[ሀ-፿ᎀ-᎟]/.test(str);
}

/**
 * Converts a Latin phonetic string to its Ge'ez syllabary representation.
 *
 * Evaluation order: 4-char → 3-char → 2-char → 1-char → keep as-is.
 * Case-sensitive: uppercase maps to emphatic consonants (T, C, H, etc.).
 */
export function convertPhoneticToGeez(input: string): string {
  let result = '';
  let i = 0;

  while (i < input.length) {
    let matched = false;

    for (const len of [4, 3, 2, 1]) {
      if (i + len <= input.length) {
        const chunk = input.substring(i, i + len);
        const mapped = TransliterationRules[chunk];
        if (mapped !== undefined) {
          result += mapped;
          i += len;
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      // Fallback: try lowercase version of the char so regular uppercase (K, B, D…)
      // maps identically to lowercase. Only the EXPLICITLY defined emphatic uppercase
      // entries (T, C, H, A, P, Gy…) take priority via the earlier look-up above.
      const lower = input[i].toLowerCase();
      const lowerMapped = lower !== input[i] ? TransliterationRules[lower] : undefined;
      result += lowerMapped ?? input[i];
      i++;
    }
  }

  return result;
}

/** Checks whether a string is made of Latin letters only (a-z, A-Z, apostrophe, hyphen). */
export function isLatinOnly(str: string): boolean {
  return /^[a-zA-Z'2/-]+$/.test(str);
}
