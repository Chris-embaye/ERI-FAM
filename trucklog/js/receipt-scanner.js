// Shared receipt scanning module — lazy-loads Tesseract on first use

// ── Image resize ──────────────────────────────────────────────────────────────

export function resizeImage(file, maxW = 1000) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const scale  = Math.min(1, maxW / img.width);
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Tesseract lazy loader ─────────────────────────────────────────────────────

let _tsLoading = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve();
  if (_tsLoading) return _tsLoading;
  _tsLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload  = resolve;
    s.onerror = () => reject(new Error('Tesseract load failed'));
    document.head.appendChild(s);
  });
  return _tsLoading;
}

async function runOCR(dataUrl) {
  try {
    await loadTesseract();
    const { data } = await Tesseract.recognize(dataUrl, 'eng');
    if (!data.text) return null;
    // Reject low-confidence results (blurry photos, non-documents, random images)
    if (data.confidence < 40) return null;
    // Must have at least 8 words recognized with reasonable confidence
    const goodWords = (data.words || []).filter(w => w.confidence > 50);
    if (goodWords.length < 8) return null;
    return data.text;
  } catch { return null; }
}

// ── Date extraction ───────────────────────────────────────────────────────────

function extractDate(text) {
  // MM/DD/YY or MM/DD/YYYY
  const m1 = text.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})\b/);
  if (m1) {
    const yr = m1[3].length === 2 ? '20' + m1[3] : m1[3];
    const d  = new Date(Number(yr), Number(m1[1]) - 1, Number(m1[2]));
    if (!isNaN(d) && d.getFullYear() >= 2020 && d.getFullYear() <= 2099)
      return d.toISOString().slice(0, 10);
  }
  // Month name: "Apr 30, 2026" / "April 30 2026"
  const MONTHS = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  const m2 = text.match(/\b([a-z]{3,9})\s+(\d{1,2})[,.\s]+(\d{2,4})\b/i);
  if (m2) {
    const mon = MONTHS[m2[1].toLowerCase().slice(0,3)];
    if (mon) {
      const yr = m2[3].length === 2 ? '20' + m2[3] : m2[3];
      const d  = new Date(Number(yr), mon - 1, Number(m2[2]));
      if (!isNaN(d) && d.getFullYear() >= 2020) return d.toISOString().slice(0, 10);
    }
  }
  // ISO: 2026-04-30
  const m3 = text.match(/\b(20\d{2})[\/\-](\d{1,2})[\/\-](\d{1,2})\b/);
  if (m3) {
    const d = new Date(Number(m3[1]), Number(m3[2]) - 1, Number(m3[3]));
    if (!isNaN(d)) return d.toISOString().slice(0, 10);
  }
  return null;
}

// ── Fuel receipt parser ───────────────────────────────────────────────────────

const FUEL_BRANDS = [
  'pilot', 'flying j', "love's", 'loves travel', 'petro', 'ta travel',
  'travel centers of america', 'kwik trip', 'speedway', 'marathon',
  'shell', 'bp ', 'exxon', 'chevron', 'casey', 'circle k', 'wawa', 'sheetz',
  'truck stop', 'travel stop', 'travel center', 'fuel stop',
];

function parseFuelReceipt(text) {
  const lines  = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = {};

  // Gallons
  const galRxs = [
    /(?:gallons?|gal(?:lons)?|volume|qty|quantity|pumped)[\s:*]*([0-9]{1,4}[.,][0-9]{1,3})/i,
    /([0-9]{2,4}[.,][0-9]{1,3})\s*(?:gallons?|gal)\b/i,
  ];
  for (const rx of galRxs) {
    const m = text.match(rx);
    if (m) { result.gallons = parseFloat(m[1].replace(',', '.')); break; }
  }

  // Price per gallon (typically 3 decimals, e.g. 3.899)
  const ppgRxs = [
    /(?:price[\s\/*]?(?:per[\s]?)?g(?:al(?:lon)?)?|unit\s*price|ppg|pump\s*price|cash\s*price|rate)[\s:$*]*([0-9]\.[0-9]{2,3})/i,
    /([0-9]\.[0-9]{3})\s*(?:\/\s*)?(?:gal?|g)\b/i,
    /\$\s*([0-9]\.[0-9]{3})\b/i,
  ];
  for (const rx of ppgRxs) {
    const m = text.match(rx);
    if (m) {
      const v = parseFloat(m[1]);
      if (v > 1 && v < 20) { result.pricePerGallon = v; break; }
    }
  }

  // Total — scan "total/amount/sale" lines first
  const totalLines = lines.filter(l => /total|amount|sale|fuel\s*charge|due/i.test(l));
  for (const line of [...totalLines, ...lines]) {
    const m = line.match(/\$\s*([0-9]{2,6}[.,][0-9]{2})\b/);
    if (m) {
      const v = parseFloat(m[1].replace(',', '.'));
      if (v > 5) { result.total = v; break; }
    }
  }

  // Station name — brand match first, then first non-numeric line
  for (const line of lines.slice(0, 8)) {
    if (FUEL_BRANDS.some(b => line.toLowerCase().includes(b))) {
      result.station = line.replace(/[^\w\s\-,.'&]/g, '').trim().slice(0, 50);
      break;
    }
  }
  if (!result.station && lines.length > 0) {
    const first = lines[0].replace(/[^\w\s\-,.'&]/g, '').trim();
    if (first.length > 2 && !/^\d/.test(first)) result.station = first.slice(0, 50);
  }

  result.date = extractDate(text);

  // Cross-check: derive missing field from the other two
  if (result.gallons && result.pricePerGallon && !result.total)
    result.total = parseFloat((result.gallons * result.pricePerGallon).toFixed(2));
  if (result.total && result.gallons && !result.pricePerGallon)
    result.pricePerGallon = parseFloat((result.total / result.gallons).toFixed(3));

  result._found = ['gallons','pricePerGallon','total','station','date'].filter(k => result[k] != null).length;
  return result;
}

// ── Expense receipt parser ────────────────────────────────────────────────────

const CATEGORY_MAP = {
  Fuel:      ['pilot', 'flying j', "love's", 'loves', 'petro', 'ta travel', 'truck stop',
               'fuel stop', 'diesel', 'shell', 'bp ', 'exxon', 'chevron', 'marathon',
               'speedway', 'kwik trip', 'circle k', 'wawa', 'sheetz'],
  Repair:    ['freightliner', 'kenworth', 'peterbilt', 'volvo truck', 'mack truck',
               'navistar', 'truck repair', 'fleet service', 'tire center', 'goodyear',
               'bridgestone', 'firestone', 'michelin', 'truck parts'],
  Toll:      ['toll', 'ez-pass', 'e-zpass', 'ipass', 'i-pass', 'turnpike', 'expressway', 'pike pass'],
  Lodging:   ['hotel', 'motel', 'inn ', 'suites', 'marriott', 'hilton', 'hyatt',
               'holiday inn', 'days inn', 'super 8', 'comfort inn', 'best western',
               'hampton', 'sleep inn', 'extended stay'],
  Food:      ['mcdonald', 'subway', 'wendy', 'burger king', 'taco bell', 'domino',
               'pizza', 'ihop', "denny's", 'waffle house', 'cracker barrel',
               'restaurant', 'diner', 'cafe', 'grill', 'steakhouse'],
  Parking:   ['parking', 'park n ride', 'park & ride'],
  Scale:     ['cat scale', 'certified scale', 'truck scale', 'weigh station'],
  Insurance: ['insurance', 'progressive', 'great west', 'canal insurance', 'national general'],
};

function inferCategory(text, merchant) {
  const hay = (text + ' ' + merchant).toLowerCase();
  for (const [cat, kws] of Object.entries(CATEGORY_MAP)) {
    if (kws.some(k => hay.includes(k))) return cat;
  }
  return 'Other';
}

function parseExpenseReceipt(text) {
  const lines  = text.split('\n').map(l => l.trim()).filter(Boolean);
  const result = {};

  // Total amount — prefer "total" labelled lines
  const totalLines = lines.filter(l => /total|amount\s*due|balance\s*due|grand\s*total|sale\s*total|order\s*total/i.test(l));
  for (const line of [...totalLines, ...lines]) {
    const m = line.match(/\$\s*([0-9]{1,6}[.,][0-9]{2})\b/);
    if (m) {
      const v = parseFloat(m[1].replace(',', '.'));
      if (v > 0.5) { result.amount = v; break; }
    }
  }
  if (!result.amount) {
    const all = [...text.matchAll(/\$\s*([0-9]{1,6}\.[0-9]{2})/g)].map(m => parseFloat(m[1]));
    if (all.length) result.amount = Math.max(...all);
  }

  // Merchant — first meaningful non-boilerplate line
  const skipRe = /^(receipt|transaction|order|invoice|thank|welcome|have a|visit|store\s*#|tel|phone|date|time|\d{1,2}[\/\-]|\$)/i;
  for (const line of lines.slice(0, 8)) {
    if (line.length >= 3 && !skipRe.test(line)) {
      result.merchant = line.replace(/[^\w\s\-&',./]/g, '').trim().slice(0, 45);
      break;
    }
  }

  result.category = inferCategory(text, result.merchant || '');
  result.date     = extractDate(text);
  result._found   = ['amount','merchant','date'].filter(k => result[k] != null).length;
  return result;
}

// ── Trip / Rate-Con document parser ──────────────────────────────────────────

const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]);

// Words that indicate a company/broker name line — not a city line
const COMPANY_WORDS = /\b(?:inc\.?|llc\.?|corp\.?|ltd\.?|co\.|freight|transport(?:ation)?|logistics|trucking|carrier|broker|brokerage|shipping|express|lines|systems|services|solutions|group|agency|dispatch|load(?:ing)?|unload(?:ing)?|warehousing)\b/i;
// Words that indicate a street address line
const STREET_WORDS  = /\b(?:st\.?|ave\.?|blvd\.?|dr\.?|rd\.?|ln\.?|way|hwy|highway|suite|ste\.?|floor|unit|dock)\b/i;

function isCityStateLine(line) {
  // Must match "Word(s), XX" where XX is a valid US state
  const m = line.match(/^([A-Za-z][a-zA-Z\s\-']{1,25})[,\s]+([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/);
  if (!m) return null;
  const st = m[2].toUpperCase();
  if (!US_STATES.has(st)) return null;
  const city = m[1].trim().replace(/\s+/g, ' ');
  if (city.length < 2) return null;
  return `${city}, ${st}`;
}

function extractCityFromSection(sectionText) {
  const lines = sectionText.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    // Skip company names, street addresses, phone numbers, zip-only lines
    if (COMPANY_WORDS.test(line))          continue;
    if (STREET_WORDS.test(line))           continue;
    if (/^\d+\s+[A-Za-z]/.test(line))     continue; // "123 Main St"
    if (/^\(?\d{3}\)?[\s\-]\d{3}/.test(line)) continue; // phone
    if (/^\d{5}(-\d{4})?$/.test(line))    continue; // zip only
    // Check if this line IS a City, ST line
    const hit = isCityStateLine(line);
    if (hit) return hit;
    // Also scan within the line for embedded "City, ST" at end
    const m = line.match(/([A-Za-z][a-zA-Z\s\-']{2,20}),\s*([A-Z]{2})\b/);
    if (m && US_STATES.has(m[2]) && !COMPANY_WORDS.test(m[1]) && !STREET_WORDS.test(m[1])) {
      const city = m[1].trim().replace(/\s+/g, ' ');
      if (city.length >= 2 && !/^\d/.test(city)) return `${city}, ${m[2]}`;
    }
  }
  return null;
}

function parseTripDocument(text) {
  const result = {};
  const lines  = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Quick sanity check — must have enough real text to be a document
  const realWords = lines.filter(l => /[a-zA-Z]{3,}/.test(l)).length;
  if (realWords < 4) return { _found: 0 };

  // ── Revenue ───────────────────────────────────────────────────────────────
  const rateRxs = [
    /(?:rate|pay|revenue|linehaul|line\s*haul|gross|total\s*pay|flat\s*rate|offer(?:ed)?|all[\s-]in|load\s*pay|fuel\s*surcharge\s*incl)[\s:$]*\$?\s*([1-9][0-9]{2,5}(?:[.,][0-9]{2})?)/i,
    /\$\s*([1-9][0-9]{2,5}[.,][0-9]{2})\b/,
    /\$\s*([1-9][0-9]{3,5})\b/,
  ];
  for (const rx of rateRxs) {
    const m = text.match(rx);
    if (m) {
      const v = parseFloat(m[1].replace(/,/g, ''));
      if (v >= 150 && v <= 99999) { result.revenue = v; break; }
    }
  }

  // ── Miles ─────────────────────────────────────────────────────────────────
  const mRxs = [
    /(?:total\s*miles?|loaded\s*miles?|approx\.?\s*miles?|estimated\s*miles?|distance|mileage|est\.?\s*mi)[\s:~]*([0-9]{2,4})\b/i,
    /\b([0-9]{2,4})\s*(?:loaded\s*)?mi(?:les?)?\b/i,
  ];
  for (const rx of mRxs) {
    const m = text.match(rx);
    if (m) {
      const v = parseInt(m[1]);
      if (v >= 10 && v <= 9999) { result.miles = v; break; }
    }
  }

  // ── Load / BOL number ─────────────────────────────────────────────────────
  const bolRx = /(?:bol|bill\s*of\s*lading|load\s*(?:id|#|no\.?|num(?:ber)?)?|order\s*#?|reference\s*#?|ref\s*#?|pro\s*#?|confirmation\s*#?|shipment\s*(?:id|#)?)[\s:#]*([A-Z0-9][A-Z0-9\-]{2,18})/i;
  const bm = text.match(bolRx);
  if (bm) result.loadNum = bm[1].trim().toUpperCase();

  // ── Date ──────────────────────────────────────────────────────────────────
  result.date = extractDate(text);

  // ── Origin ────────────────────────────────────────────────────────────────
  // Find the pickup section, then extract the city/state from within it
  // (skipping company names, street addresses, broker names)
  const origKwRx = /(?:pick\s*up|pickup|origin|ship(?:ment)?\s*from|shipper|p\/u\b|pu\b|load(?:ing)?\s*(?:at|location)|from\s*location)/i;
  const origM = origKwRx.exec(text);
  if (origM) {
    const section = text.slice(origM.index, origM.index + 400);
    result.origin = extractCityFromSection(section);
  }

  // ── Destination ───────────────────────────────────────────────────────────
  const destKwRx = /(?:deliver(?:y|ing)?\s*(?:to|at|location)?|destination|consignee|ship(?:ment)?\s*to|d\/o\b|drop\s*(?:off|location)|unload(?:ing)?|deliver\s*by)/i;
  const destM = destKwRx.exec(text);
  if (destM) {
    const section = text.slice(destM.index, destM.index + 400);
    result.destination = extractCityFromSection(section);
  }

  // ── Fallback: scan ALL lines for City, ST and use first/last ─────────────
  if (!result.origin || !result.destination) {
    const cities = [];
    for (const line of lines) {
      if (COMPANY_WORDS.test(line) || STREET_WORDS.test(line)) continue;
      if (/^\d+\s/.test(line)) continue;
      const m = line.match(/([A-Za-z][a-zA-Z\s\-']{2,20}),\s*([A-Z]{2})\b/);
      if (m && US_STATES.has(m[2])) {
        const city = m[1].trim().replace(/\s+/g, ' ');
        if (city.length >= 2) cities.push(`${city}, ${m[2]}`);
      }
    }
    const unique = [...new Set(cities)];
    if (!result.origin      && unique.length >= 1) result.origin      = unique[0];
    if (!result.destination && unique.length >= 2) result.destination = unique[unique.length - 1];
  }

  result._found = ['revenue','miles','loadNum','origin','destination','date'].filter(k => result[k] != null).length;
  return result;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function scanReceipt(dataUrl, mode) {
  const text = await runOCR(dataUrl);
  if (!text) return { _found: 0, _raw: null, _lowQuality: true };
  const parsed = mode === 'fuel' ? parseFuelReceipt(text)
               : mode === 'trip' ? parseTripDocument(text)
               : parseExpenseReceipt(text);
  return { ...parsed, _raw: text };
}
