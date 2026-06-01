// Ethiopian / Eritrean calendar converter (Ge'ez calendar — ዓዲ ዓዲ)
// The Ge'ez calendar has 13 months: 12 × 30 days + Pagumē (5–6 days).
// It runs ~7 years 8 months behind the Gregorian calendar.

export const ETH_MONTHS_TI: string[] = [
  'መስከረም',  // 1  Sep–Oct
  'ጥቅምቲ',   // 2  Oct–Nov
  'ሕዳር',    // 3  Nov–Dec
  'ታሕሳስ',   // 4  Dec–Jan
  'ጥሪ',     // 5  Jan–Feb
  'ለካቲት',   // 6  Feb–Mar
  'መጋቢት',   // 7  Mar–Apr
  'ሚያዝያ',   // 8  Apr–May
  'ግንቦት',   // 9  May–Jun
  'ሰነ',     // 10 Jun–Jul
  'ሓምለ',    // 11 Jul–Aug
  'ነሓሰ',    // 12 Aug–Sep
  'ጳጉሜ',    // 13 Sep 6–10
];

// Ge'ez ordinal numerals for days 1–30
const GEEZ_DAY: string[] = [
  '', '፩','፪','፫','፬','፭','፮','፯','፰','፱','፲',
  '፲፩','፲፪','፲፫','፲፬','፲፭','፲፮','፲፯','፲፰','፲፱','፳',
  '፳፩','፳፪','፳፫','፳፬','፳፭','፳፮','፳፯','፳፰','፳፱','፴',
];

export interface EthiopianDate {
  year:  number;
  month: number;  // 1-indexed
  day:   number;
  monthName: string;
  formatted: string;  // e.g. "፲፭ ሓምለ ፳፻፲፮"
}

function isGregorianLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Ethiopian New Year (Enkutatash) — Sep 11 or Sep 12 in Gregorian leap years */
function ethNewYearGregorianDOY(gYear: number): number {
  // Day of year for Sep 11 in a non-leap year = 254; in leap year Sep 12 = 256
  // Ethiopian calendar follows Julian; Gregorian leap year pushes NYE to Sep 12
  return isGregorianLeapYear(gYear) ? 256 : 254;
}

function gregorianDOY(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

export function toEthiopianDate(gDate: Date = new Date()): EthiopianDate {
  const gy = gDate.getFullYear();
  const doy = gregorianDOY(gDate);
  const nyeDOY = ethNewYearGregorianDOY(gy);

  let ethYear: number;
  let daysSinceNYE: number;

  if (doy >= nyeDOY) {
    // On or after Ethiopian New Year of this Gregorian year
    ethYear = gy - 7;
    daysSinceNYE = doy - nyeDOY;
  } else {
    // Before Ethiopian New Year — still in the previous Ethiopian year
    ethYear = gy - 8;
    const prevNYE = ethNewYearGregorianDOY(gy - 1);
    const prevYearDays = isGregorianLeapYear(gy - 1) ? 366 : 365;
    daysSinceNYE = prevYearDays - prevNYE + doy;
  }

  const ethMonth = Math.min(13, Math.floor(daysSinceNYE / 30) + 1);
  const ethDay   = (daysSinceNYE % 30) + 1;
  const monthName = ETH_MONTHS_TI[ethMonth - 1] ?? 'ጳጉሜ';

  // Format year in Ge'ez numerals
  const yearStr = geezNumber(ethYear);
  const dayStr  = GEEZ_DAY[ethDay] ?? String(ethDay);
  const formatted = `${dayStr} ${monthName} ${yearStr}`;

  return { year: ethYear, month: ethMonth, day: ethDay, monthName, formatted };
}

/** Convert a positive integer to Ge'ez numeral notation */
export function geezNumber(n: number): string {
  if (n <= 0) return '';
  if (n < 10)  return ['','፩','፪','፫','፬','፭','፮','፯','፰','፱'][n];
  if (n < 100) {
    const tens  = Math.floor(n / 10);
    const units = n % 10;
    const T = ['','','፳','፴','፵','፶','፷','፸','፹','፺'][tens];
    const U = units > 0 ? ['','፩','፪','፫','፬','፭','፮','፯','፰','፱'][units] : '';
    return T + U;
  }
  if (n === 100) return '፻';
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const rem = n % 100;
    const H = h > 0 ? geezNumber(h) : '';
    return H + '፻' + (rem > 0 ? geezNumber(rem) : '');
  }
  // For large numbers (years) use hundreds with remainder
  const thousands = Math.floor(n / 1000);
  const rem = n % 1000;
  return geezNumber(thousands) + '፼' + (rem > 0 ? geezNumber(rem) : '');
}

/** Today's Ethiopian date as a pasteable string */
export function todayEthiopian(): string {
  return toEthiopianDate(new Date()).formatted;
}

// Ge'ez numeral to Arabic
export const GEEZ_NUMERALS: { arabic: string; geez: string }[] = [
  { arabic: '1',  geez: '፩' },
  { arabic: '2',  geez: '፪' },
  { arabic: '3',  geez: '፫' },
  { arabic: '4',  geez: '፬' },
  { arabic: '5',  geez: '፭' },
  { arabic: '6',  geez: '፮' },
  { arabic: '7',  geez: '፯' },
  { arabic: '8',  geez: '፰' },
  { arabic: '9',  geez: '፱' },
  { arabic: '0',  geez: '፲' },
  { arabic: '10', geez: '፲' },
  { arabic: '20', geez: '፳' },
  { arabic: '30', geez: '፴' },
  { arabic: '100',geez: '፻' },
];
