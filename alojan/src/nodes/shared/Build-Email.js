const cfg = $('Config').first().json;
const res = $('Validate Data').first().json;
const st  = $('Report Stats').first().json;

// ============ الألوان وحجم الخط — غيّرها من هنا ============
const BG    = '#f2f1ee';   // خلفية 242,241,238
const INK   = '#142f38';   // اللون الأساسي 20,47,56
const LINE  = '#d8d6d0';   // لون الحدود
const GREEN = '#1e7a34', RED = '#c0392b', GREY = '#7a7a7a';
const FS    = '14px';      // حجم الخط الموحّد لكل النصوص
// ========================================================

const AR_MON = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
function arMonth(mo) {
  if (!mo || !mo.key) return '';
  const parts = String(mo.key).split('-');
  return (AR_MON[Number(parts[1]) - 1] || parts[1]) + ' ' + parts[0];
}
function arWeek(mo) {
  if (!mo || !mo.startDate) return '';
  const s = new Date(mo.startDate + 'T00:00:00Z');
  const e = new Date(mo.endDate   + 'T00:00:00Z');
  const sm = AR_MON[s.getUTCMonth()], em = AR_MON[e.getUTCMonth()];
  const y  = e.getUTCFullYear();
  return sm === em
    ? 'أسبوع ' + s.getUTCDate() + ' – ' + e.getUTCDate() + ' ' + em + ' ' + y
    : 'أسبوع ' + s.getUTCDate() + ' ' + sm + ' – ' + e.getUTCDate() + ' ' + em + ' ' + y;
}
// نفس النود للتقريرين — الفرق في تسمية الفترة وكلمة "أسبوعي/شهري" بس.
const WEEKLY = cfg.cadence === 'weekly';
const periodLabel = WEEKLY ? arWeek : arMonth;
const CAD_ADJ  = WEEKLY ? 'الأسبوعي' : 'الشهري';
const CAD_LAST = WEEKLY ? 'الأسبوع الأخير' : 'الشهر الأخير';
const withPrefix = (label) => (WEEKLY || !label) ? label : ('شهر ' + label);

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
  // نجمة على الكلمات اللي رقمها على مستوى الموقع كله مش على صفحة محددة —
  // عشان اللي بيراجع في Search Console يعرف يحط الفلتر الصح.
  const siteWide = d.scope !== 'page';
  return { d, last, prev, pct, color, arrow, txt, sv: svText(d), siteWide };
});
rows.sort((a, b) => (b.pct === null ? -999 : b.pct) - (a.pct === null ? -999 : a.pct));

const td = 'padding:9px 10px;border-bottom:1px solid ' + LINE + ';font-size:' + FS + ';color:' + INK + ';';
const body = rows.map((r, i) => '<tr style="background:' + (i % 2 ? '#ffffff' : BG) + ';">' +
  '<td style="' + td + '">' + esc(r.d.keyword) + (r.siteWide ? ' <span style="color:' + GREY + ';">*</span>' : '') + '</td>' +
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

// تحذير العرض التقديمي: الأرقام في الإيميل والشيت صح في كل الأحوال (الشيت
// بيتكتب قبل بناء العرض)، بس ممكن العرض نفسه ما يكونش اكتمل.
const slidesNote = (st.slidesOk === false)
  ? 'العرض التقديمي ما اكتملش: اتبنى ' + (st.slidesDone || 0) + ' سلايد من ' +
    (st.slidesExpected || 0) + '. الأرقام اللي فوق وفي الشيت صح ومكتملة. ' +
    'الرن الجاي بيمسح العرض ويبنيه من أول تلقائيًا.' +
    ((st.slideErrors || []).length ? ' السبب: ' + st.slideErrors[0] : '')
  : '';

// ---- إزاي تراجع أي رقم في التقرير على Search Console ----
// الأرقام دي مش تقديرات: كل رقم ليه فلتر محدد في الواجهة. السطور دي بتقول
// الفلتر بالظبط عشان أي حد يفتح Search Console ويطلّع نفس الرقم.
const lastMonth = m.length ? m[li] : {};
const rangeTxt = (lastMonth.startDate && lastMonth.endDate)
  ? lastMonth.startDate + ' → ' + lastMonth.endDate
  : nowLabel;
const countryTxt = (cfg.countries || []).map(c => c.name).join(' / ');
const siteWideCount = rows.filter(r => r.siteWide).length;

const verifySteps = [
  'افتح Search Console → Performance → Search results.',
  'Date: Custom → ' + rangeTxt + ' (نفس أيام العمود الأخير في التقرير).',
  'Search type: Web.',
  'Query: Exact query = الكلمة زي ما هي مكتوبة في التقرير بالحرف.',
  'Country: ' + countryTxt + '.',
  'Page: Exact URL = رابط الصفحة المستهدفة للكلمة (جدول الروابط مرفق في الشيت).' +
    (siteWideCount ? ' الكلمات اللي جنبها * مالهاش صفحة مستهدفة، فسيب فلتر Page فاضي.' : ''),
];
const excluded = ($('Keywords').first().json.excluded) || [];
const suspectPages = (((res.quality || {}).pageAudit) || {}).suspect || [];
const brokenLinks = ((res.pageCheck || {}).problems) || [];
const verifyNote = 'ملحوظة: بيانات جوجل نهائية (final) بس، وأي فلتر ناقص أو زايد ' +
  'بيغيّر الرقم — خصوصًا فلتر الدولة وفلتر الصفحة.' +
  (siteWideCount ? ' في التقرير ده ' + siteWideCount + ' كلمة من غير صفحة مستهدفة (*).' : '') +
  (excluded.length ? ' و' + excluded.length + ' كلمة مستبعدة من التقرير لأن مالهاش صفحة منشورة.' : '');

const html =
'<div style="font-family:Calibri,Arial,sans-serif;direction:rtl;text-align:right;background:' + BG + ';padding:22px;font-size:' + FS + ';color:' + INK + ';">' +
'<div style="max-width:900px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid ' + LINE + ';">' +
'<div style="background:' + INK + ';padding:22px;">' +
  '<div style="color:#ffffff;font-size:' + FS + ';font-weight:bold;">تقرير SEO الأسبوعي — ' + esc(cfg.company) + '</div>' +
  '<div style="color:' + BG + ';font-size:' + FS + ';margin-top:6px;">' + withPrefix(nowLabel) + (prevLabel ? ' &nbsp;•&nbsp; مقارنةً بـ' + withPrefix(prevLabel) : '') + '</div>' +
'</div><div style="padding:22px;">' +
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
  '<th style="' + th + 'text-align:center;">الظهور (' + CAD_LAST + ')</th>' +
  '<th style="' + th + 'text-align:center;">التغير</th></tr>' + body + '</table>' +
  '<div style="margin-top:22px;text-align:center;">' +
    '<a href="' + slides + '" style="display:inline-block;background:' + INK + ';color:#ffffff;padding:12px 30px;' +
    'border-radius:6px;text-decoration:none;font-size:' + FS + ';font-weight:bold;">عرض التقرير الكامل</a></div>' +
  '<div style="margin-top:16px;font-size:' + FS + ';color:' + INK + ';text-align:center;">الرقم الأقل = ترتيب أفضل</div>' +
  '<div style="margin-top:8px;font-size:12px;color:' + GREY + ';text-align:center;">' + esc(qualityNote) + '</div>' +
  (slidesNote ? '<div style="margin-top:12px;background:#fdf3f1;border:1px solid #e6b9b0;border-radius:6px;' +
    'padding:10px 14px;font-size:12px;line-height:1.8;color:' + INK + ';">' + esc(slidesNote) + '</div>' : '') +
  '<div style="margin-top:18px;background:' + BG + ';border:1px solid ' + LINE + ';border-radius:6px;padding:14px 16px;font-size:12px;line-height:1.9;">' +
    '<b>تحب تراجع أي رقم بنفسك على Search Console؟</b>' +
    '<ol style="margin:8px 0 0 0;padding-inline-start:18px;">' +
    verifySteps.map(t => '<li>' + esc(t) + '</li>').join('') + '</ol>' +
    '<div style="margin-top:8px;color:' + GREY + ';">' + esc(verifyNote) + '</div>' +
  '</div>' +
  (brokenLinks.length ? '<div style="margin-top:12px;background:#fdf3f1;border:1px solid #e6b9b0;' +
    'border-radius:6px;padding:10px 14px;font-size:12px;line-height:1.9;color:' + INK + ';">' +
    '<b>' + brokenLinks.length + ' رابط صفحة محتاج تصحيح</b> — الرابط اللي في ملف الكلمات مش ' +
    'الرابط النهائي للصفحة، وفلتر الصفحة في Search Console مش هيطابقه:<br>' +
    brokenLinks.slice(0, 8).map(function (x) {
      return '• ' + esc(x.keyword) + ' — ' + esc(x.note);
    }).join('<br>') + '</div>' : '') +
  (suspectPages.length ? '<div style="margin-top:12px;background:#fdf3f1;border:1px solid #e6b9b0;' +
    'border-radius:6px;padding:10px 14px;font-size:12px;line-height:1.9;color:' + INK + ';">' +
    '<b>' + suspectPages.length + ' كلمة رابطها محتاج مراجعة</b> — الصفحة المستهدفة ما ظهرتش ' +
    'عند جوجل ولا مرة رغم إن الكلمة ليها ترتيب بصفحات تانية. يعني الرابط اللي في ملف ' +
    'الكلمات غالبًا مش اللي جوجل مسجّله، والخانة بتطلع «مفيش ظهور» وهي مش صح:<br>' +
    suspectPages.slice(0, 8).map(function (x) {
      const sample = (x.samples || [])[0];
      return '• ' + esc(x.keyword) + (sample ? ' — جوجل شايف: ' + esc(sample.topPage) : '');
    }).join('<br>') + '</div>' : '') +
  (excluded.length ? '<div style="margin-top:12px;border:1px dashed ' + LINE + ';border-radius:6px;' +
    'padding:10px 14px;font-size:12px;line-height:1.9;color:' + GREY + ';">' +
    '<b style="color:' + INK + ';">كلمات خارج التقرير (' + excluded.length + ')</b> — ' +
    'مالهاش صفحة منشورة، فمفيش رابط نقيس عليه. أول ما تتنشر صفحتها ويتحط رابطها ' +
    'في ملف الكلمات، بتدخل التقرير أوتوماتيك:<br>' +
    excluded.map(function (e) { return esc(e.keyword); }).join(' • ') + '</div>' : '') +
'</div></div></div>';

// نسخة نصية — مهمة جدًا لتوصيل الإيميل: الرسائل اللي فيها HTML بس من غير
// نسخة نص عادي بتاخد سكور سبام أعلى عند جيميل وأوتلوك.
const textRows = rows.map(r =>
  '- ' + r.d.keyword + (r.siteWide ? ' *' : '') + ' (' + r.d.section + ') | بحث شهري: ' + r.sv +
  ' | السابق: ' + (r.prev === null ? '-' : r.prev) +
  ' | الحالي: ' + (r.last === null ? '-' : r.last) +
  ' | الظهور: ' + (r.d.impressions || 0) +
  ' | التغير: ' + r.txt);

const text = ['تقرير SEO ' + CAD_ADJ + ' — ' + cfg.company,
              withPrefix(nowLabel) + (prevLabel ? ' مقارنةً بـ' + withPrefix(prevLabel) : ''), '']
  .concat(['تحسّن: ' + st.up + ' | تراجع: ' + st.down + ' | ثابت: ' + st.same +
           ' | متوسط التغير: ' + (st.avg > 0 ? '+' : '') + st.avg + '%', ''])
  .concat(textRows)
  .concat(['', 'الرقم الأقل = ترتيب أفضل.', qualityNote])
  .concat(slidesNote ? ['', '⚠ ' + slidesNote] : [])
  .concat(['', 'مراجعة الأرقام على Search Console:'])
  .concat(verifySteps.map((t, i) => (i + 1) + ') ' + t))
  .concat([verifyNote])
  .concat(brokenLinks.length
    ? ['', brokenLinks.length + ' رابط صفحة محتاج تصحيح:']
        .concat(brokenLinks.slice(0, 8).map(function (x) { return '- ' + x.keyword + ' — ' + x.note; }))
    : [])
  .concat(suspectPages.length
    ? ['', suspectPages.length + ' كلمة رابطها محتاج مراجعة (الصفحة ما ظهرتش عند جوجل ولا مرة):']
        .concat(suspectPages.slice(0, 8).map(function (x) { return '- ' + x.keyword; }))
    : [])
  .concat(excluded.length
    ? ['', 'كلمات خارج التقرير (' + excluded.length + ') — مالهاش صفحة منشورة:']
        .concat(excluded.map(function (e) { return '- ' + e.keyword; }))
    : [])
  .concat(['', 'التقرير الكامل بالسلايدز: ' + slides])
  .join('\n');

return [{ json: {
  emailHtml: html,
  emailText: text,
  periodLabel: nowLabel,
  subject: 'تقرير SEO ' + CAD_ADJ + ' — ' + cfg.company + ' — ' + withPrefix(nowLabel),
} }];
