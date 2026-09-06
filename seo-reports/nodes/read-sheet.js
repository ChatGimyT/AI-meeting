// بيحوّل صفوف الشيت لذاكرة تاريخية + بيسجّل مقاس الشيت القديم عشان الكتابة
// الجديدة تمسح أي بقايا أعمدة/صفوف قديمة.
//
// قراءة الخانة:
//   فاضية        = ما اتسحبتش أصلًا (هنحاول تاني)
//   '-'          = اتسحبت من جوجل ومفيش ظهور مؤكد
//   رقم          = ترتيب مؤكد
const rows = Array.isArray($json.values) ? $json.values : null;

// Fetch Sheet شغّال بـ continueRegularOutput، فلو فشل بيوصلنا error.
// مهم جدًا نفرّق بين "الشيت فاضي" و"مقدرناش نقراه": في الحالة التانية ممنوع
// نكتب على الشيت، لأن الكتابة هتمسح كل الأرشيف.
const fetchError = ($json && $json.error !== undefined && $json.error !== null)
  ? (typeof $json.error === 'string' ? $json.error : JSON.stringify($json.error).slice(0, 300))
  : '';
const sheetError = fetchError || (rows === null ? 'رد Google Sheets مالهوش الشكل المتوقع (مفيش values).' : '');

// أرقام عربية/هندية + الفاصلة العشرية العربية + فواصل الآلاف.
const AR_DIGITS = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
                    '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9' };

function num(v) {
  if (v === '' || v === undefined || v === null) return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  let s = String(v);
  s = s.replace(/[٠-٩۰-۹]/g, ch => AR_DIGITS[ch] || ch);   // أرقام عربية → لاتينية
  s = s.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, ''); // محارف اتجاه
  s = s.replace(/[\u066C,\s]/g, '');                        // فواصل الآلاف
  s = s.replace(/[\u066B\u060C]/g, '.');                   // فاصلة عشرية عربية
  s = s.replace(/[^0-9.+-]/g, '');
  if (s === '' || s === '-' || s === '.' || s === '+') return null;
  const n = Number(s);
  return isFinite(n) ? n : null;
}

const hist = { monthKeys: [], byRow: {} };
let extentRows = 0, extentCols = 0, dataRows = 0;

if (!sheetError && rows.length) {
  extentRows = rows.length;
  rows.forEach(r => { extentCols = Math.max(extentCols, (r || []).length); });
}

if (!sheetError && rows.length > 1) {
  const head = rows[0].map(h => String(h == null ? '' : h).trim());
  const cols = {};
  head.forEach((h, i) => {
    const mm = h.match(__PERIOD_HEADER_RE__);
    if (mm) {
      cols[mm[1]] = cols[mm[1]] || {};
      cols[mm[1]][mm[2]] = i;
      if (hist.monthKeys.indexOf(mm[1]) === -1) hist.monthKeys.push(mm[1]);
    }
  });
  hist.monthKeys.sort();

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const country = String(row[0] == null ? '' : row[0]).trim();
    const keyword = String(row[2] == null ? '' : row[2]).trim();
    if (!keyword) continue;
    dataRows++;
    const rec = {};
    hist.monthKeys.forEach(mk => {
      const c = cols[mk] || {};
      const rawP = c.Pos === undefined ? undefined : row[c.Pos];
      const rawI = c.Impr === undefined ? undefined : row[c.Impr];
      const p = (rawP === undefined || rawP === null) ? '' : String(rawP).trim();
      const imp = num(rawI);
      rec[mk] = {
        position:    (p === '' || p === '-' || p === '—' || p === '–') ? null : num(rawP),
        impressions: imp === null ? 0 : imp,
        filled:      p !== '',
      };
    });
    hist.byRow[country + '||' + keyword] = rec;
  }
}

return [{ json: {
  __history: hist,
  __sheetError: sheetError,
  __extent: { rows: extentRows, cols: extentCols },
  __sheetStats: { dataRows, periodsInSheet: hist.monthKeys.length },
} }];
