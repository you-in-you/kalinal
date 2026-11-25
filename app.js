/* Cullinan HTML reservation extractor + UI (readable rebuild) */

const MEALS = [
  { key: 'صبحانه', id: 'cphMain_grdReservationBreakfast', en: 'Breakfast' },
  { key: 'ناهار', id: 'cphMain_grdReservationLunch', en: 'Lunch' },
  { key: 'شام', id: 'cphMain_grdReservationDinner', en: 'Dinner' },
];

const DAY_RE = /(شنبه|یکشنبه|دوشنبه|سه\s*شنبه|چهارشنبه|پنجشنبه|جمعه)[^0-9]*(\d{4}\/\d{2}\/\d{2})?/;

const DAY_EN = {
  'شنبه': 'Saturday',
  'یکشنبه': 'Sunday',
  'دوشنبه': 'Monday',
  'سه شنبه': 'Tuesday',
  'سه\u200cشنبه': 'Tuesday',
  'چهارشنبه': 'Wednesday',
  'پنجشنبه': 'Thursday',
  'جمعه': 'Friday',
};

function dayNameEn(dayFa) {
  const d = clean(dayFa || '').replace(/\u200c/g, ' ').replace(/\s+/g, ' ');
  for (const [fa, en] of Object.entries(DAY_EN)) {
    if (d === fa || d.startsWith(fa)) return en;
  }
  return d || '';
}

function formatDayHeading(itOrKey, date) {
  // prefer structured fields
  if (itOrKey && typeof itOrKey === 'object') {
    const en = dayNameEn(itOrKey.day);
    const dt = itOrKey.date || '';
    return dt ? `${en} ${dt}` : en || itOrKey.dayLabel || '';
  }
  // key string like "شنبه 1405/09/07"
  const s = String(itOrKey || '');
  const m = s.match(DAY_RE);
  if (m) {
    const en = dayNameEn(m[1]);
    const dt = (m[2] || date || '').trim();
    return dt ? `${en} ${dt}` : en;
  }
  return s;
}

function weekRangeEn(range) {
  if (!range) return '';
  return clean(range).replace(/\s*الی\s*/g, ' to ');
}

function dayHasAnyFood(rows) {
  return (rows || []).some((r) => r.food || r.reserved);
}



function clean(t) {
  return String(t || '').replace(/\s+/g, ' ').trim();
}

function selectedOption(selectHtml) {
  if (!selectHtml) return '';
  let m = selectHtml.match(/<option[^>]*\bselected(?:\s*=\s*["']selected["'])?[^>]*>([\s\S]*?)<\/option>/i);
  if (m) return clean(m[1].replace(/<[^>]+>/g, ''));
  m = selectHtml.match(/<option[^>]*>([\s\S]*?)<\/option>/i);
  return m ? clean(m[1].replace(/<[^>]+>/g, '')) : '';
}

function findSelect(row, part) {
  const re = new RegExp(
    `<select[^>]*(?:name|id)=["'][^"']*${part}[^"']*["'][^>]*>([\\s\\S]*?)<\\/select>`,
    'i'
  );
  const m = row.match(re);
  return m ? m[0] : '';
}

function parseRow(row) {
  const dayM = row.match(
    /<td[^>]*>\s*([^<]*(?:شنبه|یکشنبه|دوشنبه|سه\s*شنبه|چهارشنبه|پنجشنبه|جمعه)[^<]*)\s*<\/td>/i
  );
  if (!dayM) return null;

  const dayRaw = clean(dayM[1]);
  let day = dayRaw;
  let date = '';
  const dm = dayRaw.match(DAY_RE);
  if (dm) {
    day = clean(dm[1]);
    date = (dm[2] || '').trim();
  }

  let checked = false;
  let chk = row.match(/chkReserve_\d+["']([^>]*)>/i);
  if (!chk) chk = row.match(/name=["'][^"']*chkReserve["']([^>]*)>/i);
  if (chk && /\bchecked\b/i.test(chk[1])) checked = true;

  const selfName = selectedOption(findSelect(row, 'drpSelf'));
  let food = selectedOption(findSelect(row, 'drpFood'));
  const countStr = selectedOption(findSelect(row, 'drpFoodCount'));

  const amtM = row.match(/lblBuyAmount[^>]*>([^<]*)<\/span>/i);
  const amountRaw = amtM ? clean(amtM[1]) : '0';
  const amount = parseInt(String(amountRaw).replace(/[^\d-]/g, '') || '0', 10) || 0;

  let status = '';
  const stM = row.match(/imgStaus[^>]*title=["']([^"']*)["']/i);
  if (stM) status = clean(stM[1]);
  else if (checked) status = 'رزرو شده';
  else status = 'رزرو نشده';

  if (!selfName && !food && !checked) {
    if (/غیرفعال/.test(row) || amount === 0) status = 'غیرفعال';
  }

  let foodName = food;
  let foodPrice = null;
  const pm = food.match(/^(.*?)\s+(\d[\d,]*)\s*ریال\s*$/);
  if (pm) {
    foodName = clean(pm[1]);
    foodPrice = parseInt(pm[2].replace(/,/g, ''), 10);
  }

  const count = /^\d+$/.test(countStr) ? parseInt(countStr, 10) : checked ? 1 : 0;
  const reserved = checked || status === 'رزرو شده';
  const inactive = status === 'غیرفعال' || (!food && !reserved);

  return {
    day,
    date,
    dayLabel: dayRaw,
    self: selfName || null,
    food: foodName || null,
    foodRaw: food || null,
    foodPrice,
    count,
    amount,
    status,
    reserved,
    inactive,
  };
}

function extractTable(html, tableId) {
  const startRe = new RegExp(`<table[^>]*id=["']${tableId}["'][^>]*>`, 'i');
  const m = html.match(startRe);
  if (!m) return [];
  const start = html.indexOf(m[0]) + m[0].length;
  const end = html.indexOf('</table>', start);
  if (end < 0) return [];
  const body = html.slice(start, end);
  const rows = body.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const parsed = parseRow(rows[i]);
    if (parsed) out.push(parsed);
  }
  return out;
}

function extractMeta(html) {
  const meta = {};
  let m = html.match(/id=["']divUsername["'][^>]*>\s*([^<]+)/i);
  if (m) meta.userName = clean(m[1]);
  m = html.match(/id=["']lblIdNumber["'][^>]*>\s*([^<]+)/i);
  if (m) meta.userId = clean(m[1]);
  m = html.match(/id=["']lblCredit["'][^>]*>\s*([^<]+)/i);
  if (m) meta.credit = clean(m[1]);
  m = html.match(/id=["']cphMain_lblWeekDate["'][^>]*>\s*([^<]+)/i);
  if (m) meta.weekRange = clean(m[1]);
  m = html.match(/id=["']lblTodayDate["'][^>]*>\s*([^<]+)/i);
  if (m) meta.today = clean(m[1]);
  return meta;
}

function extractReservations(html) {
  const meals = {};
  MEALS.forEach(({ key, id }) => {
    meals[key] = extractTable(html, id);
  });

  const items = [];
  MEALS.forEach(({ key }) => {
    (meals[key] || []).forEach((r) => items.push({ meal: key, ...r }));
  });

  const reserved = items.filter((x) => x.reserved);
  const total = reserved.reduce((s, x) => s + (x.amount || 0), 0);

  return {
    meta: extractMeta(html),
    meals,
    items,
    reservedItems: reserved,
    totalReservedAmount: total,
    reservedCount: reserved.length,
  };
}

/* ---- Jalali helpers ---- */
function gregorianToJalali(gy, gm, gd) {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    g_d_m[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm, jd;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return { y: jy, m: jm, d: jd };
}

function todayJalaliStr() {
  const n = new Date();
  const j = gregorianToJalali(n.getFullYear(), n.getMonth() + 1, n.getDate());
  return (
    j.y +
    '/' +
    String(j.m).padStart(2, '0') +
    '/' +
    String(j.d).padStart(2, '0')
  );
}

function dateKey(s) {
  // normalize 1405/9/7 -> 1405/09/07 for compare
  if (!s) return '';
  const p = String(s).split('/');
  if (p.length !== 3) return s;
  return p.map((x, i) => (i === 0 ? x : x.padStart(2, '0'))).join('/');
}

function compareJalali(a, b) {
  const A = dateKey(a);
  const B = dateKey(b);
  if (A < B) return -1;
  if (A > B) return 1;
  return 0;
}

function formatRialFa(n) {
  return Number(n || 0).toLocaleString('en-US') + ' ریال';
}

function formatRialPlain(n) {
  return Number(n || 0).toLocaleString('en-US');
}

/* 10 Rial = 1 Toman in common Iranian display; Cullinan amounts are in Rial */
function toToman(rial) {
  return Math.round(Number(rial || 0) / 10);
}
function formatToman(rial) {
  return toToman(rial).toLocaleString('en-US') + ' T';
}

/** Meal cutoff hours (local device time): breakfast 8, lunch 14, dinner 21 */
const MEAL_CUTOFF = { 'صبحانه': 8, 'ناهار': 14, 'شام': 21 };

function isMealConsumed(dateStr, mealKey) {
  if (!dateStr) return false;
  const today = todayJalaliStr();
  const cmp = compareJalali(dateStr, today);
  if (cmp < 0) return true; // whole day in the past
  if (cmp > 0) return false;
  const hour = new Date().getHours();
  const cut = MEAL_CUTOFF[mealKey];
  if (cut == null) return false;
  return hour >= cut;
}

function mealVisualState(r) {
  // reserved + consumed → done (blue)
  // reserved + upcoming → reserved (green)
  // available not reserved → miss (red)
  // inactive → off
  if (r.reserved) {
    if (isMealConsumed(r.date, r.meal)) return 'done';
    return 'ok';
  }
  if (r.inactive || !r.food) return 'off';
  return 'miss';
}



/* ---- UI ---- */
let currentData = null;
let filterMode = 'all';
const $ = (s) => document.querySelector(s);

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


const STORAGE_KEY = 'cullinan_reader_v1';

function saveToStorage(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), data }));
  } catch (e) {
    console.warn('localStorage save failed', e);
  }
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.data ? parsed.data : null;
  } catch (e) {
    return null;
  }
}

function clearStorage() {
  try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}


function showResults(data) {
  currentData = data;
  saveToStorage(data);
  const empty = $('#appEmpty');
  if (empty) empty.style.display = 'none';
  const res = $('#appResults');
  res.style.display = 'block';
  res.classList.add('show');

  const meta = data.meta || {};
  const parts = [];
  if (meta.userName) parts.push(`<strong>${esc(meta.userName)}</strong>`);
  if (meta.userId) parts.push(`ID ${esc(meta.userId)}`);
  if (meta.credit) parts.push(`Credit ${esc(meta.credit)}`);
  $('#weekSub').innerHTML = parts.join(' <span style="opacity:.35">/</span> ');
  $('#weekTitle').textContent = meta.weekRange
    ? `Week ${weekRangeEn(meta.weekRange)}`
    : 'Weekly reservations';

  const nonFri = (arr) => arr.filter((i) => !/جمعه/.test(i.day || '') && !/جمعه/.test(i.dayLabel || ''));
  const reservedNF = nonFri(data.reservedItems);
  const totalNF = reservedNF.reduce((s, x) => s + (x.amount || 0), 0);
  $('#statCount').textContent = String(reservedNF.length);
  $('#statTotal').textContent = toToman(totalNF).toLocaleString('en-US');
  const daysWith = new Set(
    reservedNF.map((i) => i.date || i.dayLabel).filter(Boolean)
  );
  $('#statDays').textContent = String(daysWith.size);

  renderDays(data);
  scrollToToday();
}

function dayTemporal(dateStr, todayStr) {
  if (!dateStr) return 'unknown';
  const c = compareJalali(dateStr, todayStr);
  if (c < 0) return 'past';
  if (c === 0) return 'today';
  return 'future';
}

function renderDays(data) {
  const todayStr = todayJalaliStr();
  const items = filterMode === 'reserved' ? data.reservedItems : data.items;

  const order = [];
  const seen = new Set();
  data.items.forEach((it) => {
    if (/جمعه/.test(it.day || '') || /جمعه/.test(it.dayLabel || '')) return;
    const key = it.dayLabel || `${it.day} ${it.date}`.trim();
    if (seen.has(key)) return;
    seen.add(key);
    const rows = data.items.filter((x) => (x.dayLabel || `${x.day} ${x.date}`.trim()) === key);
    if (!dayHasAnyFood(rows)) return;
    order.push({ key, date: it.date, day: it.day });
  });

  const byDay = new Map();
  items.forEach((it) => {
    const key = it.dayLabel || `${it.day} ${it.date}`.trim();
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(it);
  });

  // full day meals for miss detection even in reserved filter
  const fullByDay = new Map();
  data.items.forEach((it) => {
    const key = it.dayLabel || `${it.day} ${it.date}`.trim();
    if (!fullByDay.has(key)) fullByDay.set(key, []);
    fullByDay.get(key).push(it);
  });

  const list = $('#daysList');
  list.innerHTML = '';
  let idx = 0;

  order.forEach(({ key, date, day }) => {
    const rows =
      filterMode === 'reserved'
        ? byDay.get(key) || []
        : fullByDay.get(key) || [];
    if (filterMode === 'reserved' && !rows.length) return;

    const source = fullByDay.get(key) || rows;
    idx++;
    const temporal = dayTemporal(date, todayStr);
    const daySum = source
      .filter((r) => r.reserved)
      .reduce((s, r) => s + r.amount, 0);

    const byMeal = {};
    source.forEach((r) => {
      byMeal[r.meal] = r;
    });

    const mealRows = MEALS.map(({ key: mk, en }) => {
      const r = byMeal[mk];
      if (!r) {
        return mealRowHtml(en, null);
      }
      if (filterMode === 'reserved' && !r.reserved) return '';
      // hide completely inactive/empty meals from list? keep structure for 3 slots but empty row optional
      if (!r.food && !r.reserved) return '';
      return mealRowHtml(en, r);
    }).join('');

    if (!mealRows && filterMode === 'reserved') return;

    const el = document.createElement('article');
    el.className = 'day';
    if (temporal === 'past') el.classList.add('is-past');
    if (temporal === 'today') el.classList.add('is-today');
    if (date) el.dataset.date = dateKey(date);
    const titleEn = formatDayHeading({ day, date, dayLabel: key });
    el.innerHTML = `
      <div class="day-bar">
        <span class="idx">${String(idx).padStart(2, '0')}</span>
        <h3>${esc(titleEn)}</h3>
        <span class="sum">${daySum ? formatToman(daySum) : '—'}</span>
      </div>
      <div class="meal-list">${mealRows || '<div class="state" style="padding:16px">No meals</div>'}</div>
    `;
    list.appendChild(el);
  });


  if (!list.children.length) {
    list.innerHTML = '<p class="state">No rows match this filter.</p>';
  }
}

function mealRowHtml(enLabel, r) {
  if (!r) {
    return `<div class="meal-row inactive">
      <div class="meal-type">${enLabel}</div>
      <div class="meal-body"><div class="meal-food empty-txt">Not available</div></div>
      <div class="meal-side"><span class="tag off">n/a</span></div>
    </div>`;
  }

  const vis = mealVisualState(r);
  let cls = 'meal-row';
  if (vis === 'ok') cls += ' reserved';
  else if (vis === 'done') cls += ' done';
  else if (vis === 'off') cls += ' inactive';
  else cls += ' missed';

  const food = r.food
    ? `<div class="meal-food">${esc(r.food)}</div>`
    : `<div class="meal-food empty-txt">—</div>`;
  const self = r.self
    ? `<div class="meal-sub">${esc(r.self)}</div>`
    : '';
  const amt = r.reserved
    ? `<span class="amt">${formatToman(r.amount)}</span>`
    : '';

  return `<div class="${cls}">
    <div class="meal-type">${enLabel}</div>
    <div class="meal-body">${food}${self}</div>
    <div class="meal-side">${amt}</div>
  </div>`;
}

function scrollToToday() {
  const todayStr = todayJalaliStr();
  const el =
    document.querySelector(`.day[data-date="${todayStr}"]`) ||
    document.querySelector('.day.is-today');
  if (el) {
    setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  }
}

function handleFile(file) {
  if (!file) return;
  const err = $('#parseError');
  err.textContent = '';
  err.className = 'state';

  // Mobile browsers often save pages as .mhtml, no extension, or octet-stream.
  // Do not block by MIME/extension — try to read as text and parse.
  const name = (file.name || '').toLowerCase();
  const type = (file.type || '').toLowerCase();
  const looksBinaryImage =
    type.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp|heic)$/i.test(name);
  if (looksBinaryImage) {
    err.textContent =
      'That looks like an image. Save the Cullinan page as HTML / Webpage (not a screenshot), then pick that file.';
    err.className = 'state error';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      let html = String(reader.result || '');
      // Some mobile saves wrap HTML; still search for grid ids
      if (!/cphMain_grdReservation/i.test(html) && /Content-Type:.*text\/html/i.test(html)) {
        // crude MHTML: take largest HTML-ish chunk
        const parts = html.split(/------MultipartBoundary/i);
        let best = html;
        let bestLen = 0;
        parts.forEach((part) => {
          if (/cphMain_grdReservation/i.test(part) && part.length > bestLen) {
            best = part;
            bestLen = part.length;
          }
        });
        html = best;
      }
      const data = extractReservations(html);
      if (!data.items.length) {
        err.textContent =
          'No reservation tables found. On phone: share/save the weekly reservation page as “HTML only” or “Webpage”, then select that download (any name is fine).';
        err.className = 'state error';
        return;
      }
      showResults(data);
    } catch (e) {
      console.error(e);
      err.textContent = 'Parse failed: ' + (e.message || e);
      err.className = 'state error';
    }
  };
  reader.onerror = () => {
    err.textContent = 'Could not read file.';
    err.className = 'state error';
  };
  reader.readAsText(file, 'UTF-8');
}

function downloadJSON() {
  if (!currentData) return;
  const blob = new Blob([JSON.stringify(currentData, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  triggerDownload(blob, 'cullinan-reservations.json');
}

function downloadCSV() {
  if (!currentData) return;
  const rows =
    filterMode === 'reserved' ? currentData.reservedItems : currentData.items;
  const fields = [
    'meal',
    'day',
    'date',
    'dayLabel',
    'self',
    'food',
    'count',
    'amount',
    'status',
    'reserved',
  ];
  const lines = [fields.join(',')];
  rows.forEach((r) => {
    lines.push(
      fields
        .map((f) => {
          let v = r[f];
          if (v == null) v = '';
          v = String(v).replace(/"/g, '""');
          if (/[",\n]/.test(v)) v = `"${v}"`;
          return v;
        })
        .join(',')
    );
  });
  const blob = new Blob(['\ufeff' + lines.join('\n')], {
    type: 'text/csv;charset=utf-8',
  });
  triggerDownload(blob, 'cullinan-reservations.csv');
}

function triggerDownload(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function reset() {
  currentData = null;
  clearStorage();
  $('#fileInput').value = '';
  $('#appResults').style.display = 'none';
  $('#appResults').classList.remove('show');
  const empty = $('#appEmpty');
  if (empty) empty.style.display = 'block';
  $('#parseError').textContent = '';
}




function ensurePngStage() {
  let stage = document.getElementById('pngStage');
  if (!stage) {
    stage = document.createElement('div');
    stage.id = 'pngStage';
    document.body.appendChild(stage);
  }
  return stage;
}

function whenForDate(dateStr) {
  const temporal = dayTemporal(dateStr, todayJalaliStr());
  if (temporal === 'past') return 'Ended';
  if (temporal === 'today') return 'Today';
  return 'Upcoming';
}

function orderedDayKeys(data) {
  const order = [];
  const seen = new Set();
  data.items.forEach((it) => {
    if (/جمعه/.test(it.day || '') || /جمعه/.test(it.dayLabel || '')) return;
    const key = it.dayLabel || `${it.day} ${it.date}`.trim();
    if (seen.has(key)) return;
    seen.add(key);
    const rows = data.items.filter((x) => (x.dayLabel || `${x.day} ${x.date}`.trim()) === key);
    if (!dayHasAnyFood(rows)) return;
    order.push({ key, date: it.date || '', day: it.day || '' });
  });
  return order;
}

function rowsForDayKey(data, dayKey) {
  return data.items.filter((it) => {
    const key = it.dayLabel || `${it.day} ${it.date}`.trim();
    return key === dayKey;
  });
}



function mealBlocksHtml(rows) {
  const byMeal = {};
  rows.forEach((r) => { byMeal[r.meal] = r; });
  return `<div class="ph-rows">` + MEALS.map(({ key, en }) => {
    const r = byMeal[key];
    if (!r || (!r.food && !r.reserved)) return '';
    const vis = mealVisualState(r);
    let cls = 'ph-row';
    let side = '';
    if (vis === 'ok') {
      cls += ' ok';
      side = `<span class="amt">${formatToman(r.amount)}</span>`;
    } else if (vis === 'done') {
      cls += ' done';
      side = `<span class="amt">${formatToman(r.amount)}</span>`;
    } else if (vis === 'off') {
      cls += ' off';
      side = 'off';
    } else {
      cls += ' miss';
      side = 'skip';
    }
    const food = r.food
      ? `<span class="ph-food">${esc(r.food)}</span>`
      : `<span class="ph-food empty">—</span>`;
    return `<div class="${cls}"><span class="ph-type">${en}</span>${food}<span class="ph-side">${side}</span></div>`;
  }).join('') + `</div>`;
}

function buildWeekPhoneHtml(data) {
  const meta = data.meta || {};
  const order = orderedDayKeys(data);
  const total = data.totalReservedAmount || 0;
  // recompute reserved only on non-Friday days shown
  let shownTotal = 0;
  let shownCount = 0;
  const daysHtml = order.map(({ key, date, day }) => {
    const rows = rowsForDayKey(data, key);
    rows.forEach((r) => {
      if (r.reserved) {
        shownTotal += r.amount || 0;
        shownCount += 1;
      }
    });
    const daySum = rows.filter((r) => r.reserved).reduce((s, r) => s + r.amount, 0);
    const titleEn = formatDayHeading({ day: day || '', date, dayLabel: key });
    return `<section class="ph-day">
      <div class="ph-day-head">
        <div class="ph-day-title">${esc(titleEn)}</div>
        <span class="ph-day-sum">${daySum ? formatToman(daySum) : '—'}</span>
      </div>
      ${mealBlocksHtml(rows)}
    </section>`;
  }).join('');

  const who = meta.userName ? esc(meta.userName) : '';
  const week = meta.weekRange ? esc(weekRangeEn(meta.weekRange)) : '';
  return `
    <div class="ph-head">
      <span class="ph-brand">cullinan.reader</span>
      <span class="ph-brand">${shownCount} meals</span>
    </div>
    <div class="ph-title">${week ? week : 'Weekly meals'}</div>
    <div class="ph-sub" dir="rtl">${who}</div>
    ${daysHtml}
    <div class="ph-total">
      <span>Week total</span>
      <strong>${formatToman(shownTotal)}</strong>
    </div>
    <div class="ph-foot">
      <span>compact week card</span>
      <span>${esc(todayJalaliStr())}</span>
    </div>
  `;
}

async function captureStage(stage, filename) {
  if (typeof html2canvas !== 'function') {
    alert('PNG library failed to load. Check your network for the CDN.');
    return false;
  }
  const canvas = await html2canvas(stage, {
    backgroundColor: '#000000',
    scale: 2,
    width: 360,
    windowWidth: 360,
    logging: false,
    useCORS: true,
    onclone: (_doc, node) => {
      node.style.fontFamily = "Tahoma, 'Segoe UI', Arial, sans-serif";
      node.querySelectorAll('.ph-food, .ph-day-title, .ph-title, .ph-sub').forEach((el) => {
        el.style.fontFamily = "Tahoma, 'Segoe UI', Arial, sans-serif";
        el.style.unicodeBidi = 'plaintext';
      });
    },
  });
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        resolve(false);
        return;
      }
      triggerDownload(blob, filename);
      resolve(true);
    }, 'image/png');
  });
}

async function exportWeekPng(btn) {
  if (!currentData) return;
  const stage = ensurePngStage();
  stage.innerHTML = buildWeekPhoneHtml(currentData);
  const label = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'png…';
  }
  try {
    const week = (currentData.meta && currentData.meta.weekRange) || todayJalaliStr();
    const safe = String(week).replace(/[^\w\u0600-\u06ff\-]+/gi, '_').slice(0, 48);
    await captureStage(stage, `cullinan-week-${safe}.png`);
  } catch (e) {
    console.error(e);
    alert('PNG export failed: ' + (e.message || e));
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = label || 'png · week';
    }
    stage.innerHTML = '';
  }
}

/* back-compat names used by buttons */
async function exportDayPng(_dayKey, btn) {
  await exportWeekPng(btn);
}
async function exportAllDaysPng() {
  await exportWeekPng(document.getElementById('btnPngAll'));
}

document.addEventListener('DOMContentLoaded', () => {
  const cached = loadFromStorage();
  if (cached && cached.items && cached.items.length) {
    try { showResults(cached); } catch (e) { console.warn(e); clearStorage(); }
  }
  const drop = $('#dropZone');
  const input = $('#fileInput');

  drop.addEventListener('click', () => input.click());
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('dragover');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('dragover');
    const f = e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) handleFile(f);
  });
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) handleFile(input.files[0]);
  });

  document.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      chip.classList.add('active');
      filterMode = chip.dataset.filter;
      if (currentData) renderDays(currentData);
    });
  });

  $('#btnPngAll')?.addEventListener('click', exportAllDaysPng);
  $('#btnJson')?.addEventListener('click', downloadJSON);
  $('#btnCsv')?.addEventListener('click', downloadCSV);
  $('#btnReset')?.addEventListener('click', reset);
  $('#btnBrowse')?.addEventListener('click', (e) => {
    e.stopPropagation();
    input.click();
  });
  $('#btnToday')?.addEventListener('click', scrollToToday);
});
