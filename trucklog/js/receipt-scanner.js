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
    const { data: { text } } = await Tesseract.recognize(dataUrl, 'eng');
    return text || null;
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

function extractCityState(text, afterKeyword) {
  // Match "City, ST" or "City ST" patterns near the keyword region
  const rx = /([A-Za-z][a-zA-Z\s]{2,25})[,\s]+([A-Z]{2})\b/g;
  let m;
  while ((m = rx.exec(afterKeyword)) !== null) {
    const st = m[2].toUpperCase();
    if (US_STATES.has(st)) {
      const city = m[1].trim().replace(/\s+/g, ' ');
      if (city.length >= 3 && !/^\d/.test(city)) return `${city}, ${st}`;
    }
  }
  return null;
}

function parseTripDocument(text) {
  const result = {};

  // Revenue — handles "$1,800", "$1800", "$1,800.00", "Rate: 1800"
  const rateRxs = [
    /(?:rate|pay|revenue|linehaul|line\s*haul|gross|total\s*pay|flat\s*rate|offer(?:ed)?|all\s*in|load\s*pay)[\s:$]*\$?\s*([1-9][0-9]{2,5}(?:[.,][0-9]{2})?)/i,
    /\$\s*([1-9][0-9]{2,5}[.,][0-9]{2})\b/,
    /\$\s*([1-9][0-9]{3,5})\b/,
  ];
  for (const rx of rateRxs) {
    const m = text.match(rx);
    if (m) {
      const v = parseFloat(m[1].replace(/,/g, ''));
      if (v >= 100 && v <= 99999) { result.revenue = v; break; }
    }
  }

  // Miles — "450 miles", "Total Miles: 312", "loaded 287 mi", "Approx. 450 mi"
  const mRxs = [
    /(?:total\s*miles?|loaded\s*miles?|approx\.?\s*miles?|distance|mileage|est\.?\s*miles?)[\s:~]*([0-9]{2,4})\b/i,
    /\b([0-9]{2,4})\s*(?:loaded\s*)?mi(?:les?)?\b/i,
  ];
  for (const rx of mRxs) {
    const m = text.match(rx);
    if (m) {
      const v = parseInt(m[1]);
      if (v >= 10 && v <= 9999) { result.miles = v; break; }
    }
  }

  // Load / BOL / Order number
  const bolRx = /(?:bol|bill\s*of\s*lading|load\s*(?:id|#|no\.?|num)?|order\s*#?|reference\s*#?|ref\s*#?|pro\s*#?|confirmation\s*#?|shipment\s*#?)[\s:#]*([A-Z0-9][A-Z0-9\-]{2,18})/i;
  const bm = text.match(bolRx);
  if (bm) result.loadNum = bm[1].trim().toUpperCase();

  // Date
  result.date = extractDate(text);

  // Origin — extract the section after pickup keywords, then find City, ST
  const origKwRx = /(?:pick\s*up|pickup|origin|ship(?:ping)?\s*from|shipper|p\/u\b|pu\b|loading|load\s*at)/i;
  const origKwM = origKwRx.exec(text);
  if (origKwM) {
    const region = text.slice(origKwM.index, origKwM.index + 300);
    result.origin = extractCityState(text, region);
  }

  // Destination — extract section after delivery keywords
  const destKwRx = /(?:deliver(?:y|ing)?\s*(?:to)?|destination|consignee|ship(?:ping)?\s*to|d\/o\b|drop\s*off|unload(?:ing)?|delivery\s*at)/i;
  const destKwM = destKwRx.exec(text);
  if (destKwM) {
    const region = text.slice(destKwM.index, destKwM.index + 300);
    result.destination = extractCityState(text, region);
  }

  // Fallback: if we have no origin/destination, find all City, ST pairs in order
  if (!result.origin || !result.destination) {
    const allCities = [];
    const cityRx = /([A-Za-z][a-zA-Z\s]{2,20})[,\s]+([A-Z]{2})\b/g;
    let cm;
    while ((cm = cityRx.exec(text)) !== null) {
      const st = cm[2].toUpperCase();
      const city = cm[1].trim().replace(/\s+/g, ' ');
      if (US_STATES.has(st) && city.length >= 3 && !/^\d/.test(city) && !/(?:date|ref|bol|load|ship|order|invoice|page)/i.test(city)) {
        allCities.push(`${city}, ${st}`);
      }
    }
    const unique = [...new Set(allCities)];
    if (!result.origin      && unique.length >= 1) result.origin      = unique[0];
    if (!result.destination && unique.length >= 2) result.destination = unique[unique.length - 1];
  }

  result._found = ['revenue','miles','loadNum','origin','destination','date'].filter(k => result[k] != null).length;
  return result;
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function scanReceipt(dataUrl, mode) {
  const text = await runOCR(dataUrl);
  if (!text) return { _found: 0, _raw: null };
  const parsed = mode === 'fuel' ? parseFuelReceipt(text)
               : mode === 'trip' ? parseTripDocument(text)
               : parseExpenseReceipt(text);
  return { ...parsed, _raw: text };
}
