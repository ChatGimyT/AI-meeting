const cfg = $('Config').first().json;
const res = $('Validate Data').first().json;
if (!res || !Array.isArray(res.data) || res.data.length === 0) {
  throw new Error('مفيش بيانات كلمات مفتاحية جاية من Validate Data — اتوقف قبل ما يبني عرض فاضي.');
}
const oldIds = [];
const runId  = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ============ الألوان — غيّرها من هنا ============
const BG   = { red: 0.949, green: 0.945, blue: 0.933 };   // خلفية 242,241,238
const INK  = { red: 0.078, green: 0.184, blue: 0.220 };   // نص 20,47,56
const BAR  = { red: 0.078, green: 0.184, blue: 0.220 };   // أعمدة 20,47,56
const POS  = { red: 0.078, green: 0.184, blue: 0.220 };   // لون الموضع 20,47,56
const IMP  = { red: 0.478, green: 0.561, blue: 0.600 };   // لون الظهور 122,143,153
// ============================================

const baseline = 335, chartLeft = 45, chartRight = 700, maxBarH = 150;

const AR = /[\u0600-\u06FF]/;
function isAr(t) { return AR.test(String(t)); }
function wrap(t) { return isAr(t) ? '\u202B' + t + '\u202C' : '\u202A' + t + '\u202C'; }
function dirOf(t) { return isAr(t) ? 'RIGHT_TO_LEFT' : 'LEFT_TO_RIGHT'; }
function pt(v) { return { magnitude: v, unit: 'PT' }; }
function elem(pageId, x, y, w, h) {
  return { pageObjectId: pageId, size: { width: pt(w), height: pt(h) },
           transform: { scaleX: 1, scaleY: 1, translateX: x, translateY: y, unit: 'PT' } };
}
function textBox(reqs, id, pageId, x, y, w, h, text, size, bold, align, color) {
  const t = String(text);
  reqs.push({ createShape: { objectId: id, shapeType: 'TEXT_BOX', elementProperties: elem(pageId, x, y, w, h) } });
  reqs.push({ insertText: { objectId: id, text: wrap(t), insertionIndex: 0 } });
  reqs.push({ updateTextStyle: { objectId: id, textRange: { type: 'ALL' },
    style: { foregroundColor: { opaqueColor: { rgbColor: color || INK } }, fontSize: pt(size), bold: !!bold, fontFamily: 'Calibri' },
    fields: 'foregroundColor,fontSize,bold,fontFamily' } });
  reqs.push({ updateParagraphStyle: { objectId: id, textRange: { type: 'ALL' },
    style: { alignment: align || 'CENTER', direction: dirOf(t) }, fields: 'alignment,direction' } });
  reqs.push({ updateShapeProperties: { objectId: id, shapeProperties: { contentAlignment: 'MIDDLE' }, fields: 'contentAlignment' } });
}
function rect(reqs, id, pageId, x, y, w, h, color) {
  reqs.push({ createShape: { objectId: id, shapeType: 'RECTANGLE', elementProperties: elem(pageId, x, y, w, h) } });
  reqs.push({ updateShapeProperties: { objectId: id,
    shapeProperties: { shapeBackgroundFill: { solidFill: { color: { rgbColor: color } } }, outline: { propertyState: 'NOT_RENDERED' } },
    fields: 'shapeBackgroundFill.solidFill.color,outline.propertyState' } });
}

// عدد مرات البحث: الأصل من ملف الإكسل (نود Keywords)، وأي قيمة مكتوبة يدويًا
// في نود "Search Volume" بتكسب — عشان تقدر تعدّل من غير ما ترجع للإكسل.
const svOverride = $('Search Volume').first().json || {};
function svText(d) {
  const manual = svOverride[d.keyword];
  const raw = (manual !== undefined && String(manual).trim() !== '') ? manual : d.sv;
  if (raw === undefined || raw === null || String(raw).trim() === '') return '—';
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return (isFinite(n) && n > 0) ? n.toLocaleString('en-US') : String(raw).trim();
}

const out = [];
res.data.forEach((d, idx) => {
  const sid = 's' + runId + '_' + idx;
  const reqs = [];

  reqs.push({ createSlide: { objectId: sid, slideLayoutReference: { predefinedLayout: 'BLANK' } } });
  reqs.push({ updatePageProperties: { objectId: sid,
    pageProperties: { pageBackgroundFill: { solidFill: { color: { rgbColor: BG } } } },
    fields: 'pageBackgroundFill.solidFill.color' } });

  reqs.push({ createShape: { objectId: sid + '_fr', shapeType: 'RECTANGLE', elementProperties: elem(sid, 12, 12, 696, 381) } });
  reqs.push({ updateShapeProperties: { objectId: sid + '_fr',
    shapeProperties: { shapeBackgroundFill: { propertyState: 'NOT_RENDERED' },
      outline: { outlineFill: { solidFill: { color: { rgbColor: INK } } }, weight: pt(2), dashStyle: 'SOLID' } },
    fields: 'shapeBackgroundFill.propertyState,outline' } });

  rect(reqs, sid + '_lg', sid, 36, 32, 11, 11, BAR);
  textBox(reqs, sid + '_lgt', sid, 52, 25, 300, 24, d.group, 11, false, 'START');
  textBox(reqs, sid + '_t', sid, 55, 52, 610, 28, '«' + d.keyword + '»', 16, true, 'CENTER');

  const sub = 'عدد مرات البحث الشهري: ' + svText(d) + '   |   POS = الموضع   |   IMP = عدد الظهور';
  textBox(reqs, sid + '_s', sid, 55, 80, 610, 20, sub, 10, false, 'CENTER');

  const vals = d.positions;
  const imps = d.impressionsAll || [];
  const nums = vals.filter(v => v !== null && v !== undefined);
  const maxV = nums.length ? Math.max.apply(null, nums) : 1;
  const n = vals.length || 1;
  const slot = (chartRight - chartLeft) / n;
  const barW = Math.min(46, Math.max(10, slot * 0.7));

  // --- ضبط حجم الخط تلقائيًا بحيث النص ما يخرجش عن عرض العمود ---
  function fitSize(maxChars, boxW, maxS, minS) {
    const s = (boxW * 0.94) / (Math.max(1, maxChars) * 0.52);
    return Math.max(minS, Math.min(maxS, Math.round(s * 10) / 10));
  }
  let lblChars = 1;
  vals.forEach((v, i) => {
    if (v !== null && v !== undefined) {
      lblChars = Math.max(lblChars, ('POS ' + v).length, ('IMP ' + (imps[i] || 0)).length);
    }
  });
  const valFS = fitSize(lblChars, barW, 7.5, 4.5);

  const months = res.months || [];
  const capOf = mo => String((mo && (mo.caption || mo.label)) || '');
  const yrOf  = mo => String((mo && (mo.year || String(mo.key || '').split('-')[0])) || '');
  let capChars = 1, yrChars = 4;
  months.forEach(mo => {
    capOf(mo).split('\n').forEach(ln => { capChars = Math.max(capChars, ln.length); });
    yrChars = Math.max(yrChars, yrOf(mo).length);
  });
  const capFS = fitSize(capChars, slot, 7.5, 4);
  const yrFS  = fitSize(yrChars, slot, Math.max(4, capFS - 0.5), 4);

  vals.forEach((v, i) => {
    const cx = chartLeft + slot * i + slot / 2;
    if (v !== null && v !== undefined) {
      const h = Math.max(5, (v / (maxV * 1.2)) * maxBarH);
      rect(reqs, sid + '_b' + i, sid, cx - barW / 2, baseline - h, barW, h, BAR);
      textBox(reqs, sid + '_p' + i, sid, cx - slot / 2, baseline - h - 31, slot, 15,
              'POS ' + v, valFS, true, 'CENTER', POS);
      textBox(reqs, sid + '_v' + i, sid, cx - slot / 2, baseline - h - 18, slot, 15,
              'IMP ' + (imps[i] || 0), valFS, false, 'CENTER', IMP);
    }
    const mo = months[i] || {};
    const cap = capOf(mo);
    const multi = cap.indexOf('\n') !== -1;
    textBox(reqs, sid + '_m' + i, sid, cx - slot / 2, baseline + 3, slot, multi ? 30 : 14, cap, capFS, false, 'CENTER');
    const yr = yrOf(mo);
    if (yr) textBox(reqs, sid + '_y' + i, sid, cx - slot / 2, baseline + (multi ? 33 : 17), slot, 14, yr, yrFS, false, 'CENTER', IMP);
  });

  reqs.push({ createLine: { objectId: sid + '_ln', lineCategory: 'STRAIGHT',
    elementProperties: elem(sid, chartLeft - 8, baseline, chartRight - chartLeft + 16, 1) } });
  reqs.push({ updateLineProperties: { objectId: sid + '_ln',
    lineProperties: { lineFill: { solidFill: { color: { rgbColor: INK } } }, weight: pt(1.5) },
    fields: 'lineFill.solidFill.color,weight' } });

  out.push({ json: { presentationId: cfg.presentationId, requests: reqs, oldIds } });
});
return out;
