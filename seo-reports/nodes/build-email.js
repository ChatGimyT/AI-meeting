const cfg = $('Config').first().json;
const res = $('Validate Data').first().json;
const st  = $('Build Prompt').first().json;

// ============ الألوان وحجم الخط — غيّرها من هنا ============
const BG    = '#f2f1ee';   // خلفية 242,241,238
const INK   = '#142f38';   // اللون الأساسي 20,47,56
const LINE  = '#d8d6d0';   // لون الحدود
const GREEN = '#1e7a34', RED = '#c0392b', GREY = '#7a7a7a';
const FS    = '14px';      // حجم الخط الموحّد لكل النصوص
// ========================================================

// @include _lib.report-labels.js
const periodLabel = __PERIOD_LABEL_FN__;

let ai = '';
try { ai = $json.choices[0].message.content || ''; } catch (e) { ai = ''; }
ai = String(ai).replace(/[#*]/g, '').trim();
const aiParas = ai ? ai.split(/\n+/).filter(p => p.trim()) : [];
const aiHtml = aiParas.map(p =>
  '<p style="margin:0 0 10px 0;font-size:' + FS + ';">' + p + '</p>').join('');

const m  = res.months || [];
const li = m.length - 1, pi = m.length - 2;
const nowLabel  = m.length ? periodLabel(m[li]) : '';
const prevLabel = pi >= 0 ? periodLabel(m[pi]) : '';

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// عدد مرات البحث: الأصل من الإكسل (نود Keywords)، وأي تعديل يدوي في نود
// "Search Volume" بيكسب.
const svOverride = $('Search Volume').first().json || {};
function svText(d) {
  const manual = svOverride[d.keyword];
  const raw = (manual !== undefined && String(manual).trim() !== '') ? manual : d.sv;
  if (raw === undefined || raw === null || String(raw).trim() === '') return '–';
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return (isFinite(n) && n > 0) ? n.toLocaleString('en-US') : String(raw).trim();
}

const rows = (res.data || []).map(d => {
  const last = d.positions[li], prev = pi >= 0 ? d.positions[pi] : null;
  let pct = null, color = GREY, arrow = '–', txt = '–';
  if (prev !== null && last !== null && prev !== 0) {
    pct = Math.round(((prev - last) / prev) * 1000) / 10;
    if (pct > 0)      { color = GREEN; arrow = '▲'; txt = '+' + pct + '%'; }
    else if (pct < 0) { color = RED;   arrow = '▼'; txt = pct + '%'; }
    else              { txt = '0%'; }
  } else if (prev === null && last !== null) { color = GREEN; arrow = '★'; txt = 'جديدة'; }
  else if (prev !== null && last === null)   { color = RED;   arrow = '✕'; txt = 'اختفت'; }
  return { d, last, prev, pct, color, arrow, txt, sv: svText(d) };
});
rows.sort((a, b) => (b.pct === null ? -999 : b.pct) - (a.pct === null ? -999 : a.pct));

const td = 'padding:9px 10px;border-bottom:1px solid ' + LINE + ';font-size:' + FS + ';color:' + INK + ';';
const body = rows.map((r, i) => '<tr style="background:' + (i % 2 ? '#ffffff' : BG) + ';">' +
  '<td style="' + td + '">' + esc(r.d.keyword) + '</td>' +
  '<td style="' + td + '">' + esc(r.d.section) + '</td>' +
  '<td style="' + td + 'text-align:center;">' + esc(r.d.country) + '</td>' +
  '<td style="' + td + 'text-align:center;">' + r.sv + '</td>' +
  '<td style="' + td + 'text-align:center;">' + (r.prev === null ? '–' : r.prev) + '</td>' +
  '<td style="' + td + 'text-align:center;font-weight:bold;">' + (r.last === null ? '–' : r.last) + '</td>' +
  '<td style="' + td + 'text-align:center;">' + (r.d.impressions || 0) + '</td>' +
  '<td style="' + td + 'text-align:center;color:' + r.color + ';font-weight:bold;white-space:nowrap;">' +
  r.arrow + ' ' + r.txt + '</td></tr>').join('');

const th = 'padding:11px 10px;text-align:right;font-size:' + FS + ';color:#ffffff;background:' + INK + ';font-weight:bold;';
const card = (label, val, color) =>
  '<td style="padding:14px 8px;text-align:center;background:' + BG + ';border:1px solid ' + LINE + ';border-radius:6px;">' +
  '<div style="font-size:' + FS + ';font-weight:bold;color:' + color + ';">' + val + '</div>' +
  '<div style="font-size:' + FS + ';color:' + INK + ';margin-top:3px;">' + label + '</div></td>';

const slides = 'https://docs.google.com/presentation/d/' + cfg.presentationId;

// سطر جودة البيانات — بيخلي أي خانة ناقصة مرئية بدل ما تعدّي في صمت.
const q = res.quality || {};
const holes = (q.tally || {}).holes || 0;
const qualityNote = holes
  ? 'ملاحظة: ' + holes + ' خانة لسه فاضية وهتتسحب في الرن الجاي.'
  : 'كل الخانات مسحوبة ومتأكد منها.';

const html =
'<div style="font-family:Calibri,Arial,sans-serif;direction:rtl;text-align:right;background:' + BG + ';padding:22px;font-size:' + FS + ';color:' + INK + ';">' +
'<div style="max-width:900px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid ' + LINE + ';">' +
'<div style="background:' + INK + ';padding:22px;">' +
  '<div style="color:#ffffff;font-size:' + FS + ';font-weight:bold;">تقرير SEO __CADENCE_AR__ — ' + esc(cfg.company) + '</div>' +
  '<div style="color:' + BG + ';font-size:' + FS + ';margin-top:6px;">' + __HEADER_LINE__ + '</div>' +
'</div><div style="padding:22px;">' +
  (aiHtml ? '<div style="line-height:1.9;color:' + INK + ';margin-bottom:20px;">' + aiHtml + '</div>' : '') +
  '<table width="100%" cellspacing="8" cellpadding="0" style="margin-bottom:20px;"><tr>' +
    card('تحسّن', st.up, GREEN) + card('تراجع', st.down, RED) +
    card('ثابت', st.same, GREY) + card('متوسط التغير', (st.avg > 0 ? '+' : '') + st.avg + '%', st.avg >= 0 ? GREEN : RED) +
  '</tr></table>' +
  '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid ' + LINE + ';">' +
  '<tr><th style="' + th + '">الكلمة</th><th style="' + th + '">القسم</th>' +
  '<th style="' + th + 'text-align:center;">الدولة</th>' +
  '<th style="' + th + 'text-align:center;">عدد مرات البحث</th>' +
  '<th style="' + th + 'text-align:center;">السابق</th>' +
  '<th style="' + th + 'text-align:center;">الحالي</th>' +
  '<th style="' + th + 'text-align:center;">الظهور (__LAST_PERIOD_AR__)</th>' +
  '<th style="' + th + 'text-align:center;">التغير</th></tr>' + body + '</table>' +
  '<div style="margin-top:22px;text-align:center;">' +
    '<a href="' + slides + '" style="display:inline-block;background:' + INK + ';color:#ffffff;padding:12px 30px;' +
    'border-radius:6px;text-decoration:none;font-size:' + FS + ';font-weight:bold;">عرض التقرير الكامل</a></div>' +
  '<div style="margin-top:16px;font-size:' + FS + ';color:' + INK + ';text-align:center;">الرقم الأقل = ترتيب أفضل</div>' +
  '<div style="margin-top:8px;font-size:12px;color:' + GREY + ';text-align:center;">' + esc(qualityNote) + '</div>' +
'</div></div></div>';

// نسخة نصية — مهمة جدًا لتوصيل الإيميل: الرسائل اللي فيها HTML بس من غير
// نسخة نص عادي بتاخد سكور سبام أعلى عند جيميل وأوتلوك.
const textRows = rows.map(r =>
  '- ' + r.d.keyword + ' (' + r.d.section + ') | بحث شهري: ' + r.sv +
  ' | السابق: ' + (r.prev === null ? '-' : r.prev) +
  ' | الحالي: ' + (r.last === null ? '-' : r.last) +
  ' | الظهور: ' + (r.d.impressions || 0) +
  ' | التغير: ' + r.txt);

const text = ['تقرير SEO __CADENCE_AR__ — ' + cfg.company, __TEXT_HEADER__, '']
  .concat(aiParas.length ? aiParas.concat(['']) : [])
  .concat(['تحسّن: ' + st.up + ' | تراجع: ' + st.down + ' | ثابت: ' + st.same +
           ' | متوسط التغير: ' + (st.avg > 0 ? '+' : '') + st.avg + '%', ''])
  .concat(textRows)
  .concat(['', 'الرقم الأقل = ترتيب أفضل.', qualityNote, '',
           'التقرير الكامل بالسلايدز: ' + slides])
  .join('\n');

return [{ json: {
  emailHtml: html,
  emailText: text,
  periodLabel: nowLabel,
  subject: 'تقرير SEO __CADENCE_AR__ — ' + cfg.company + ' — ' + __SUBJECT_TAIL__,
} }];
