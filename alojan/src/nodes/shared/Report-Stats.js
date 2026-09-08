// بيحسب أرقام الملخص اللي بتظهر في كروت الإيميل (تحسّن/تراجع/ثابت/متوسط التغير).
// النود ده كان بيبني كمان برومبت لتعليق AI — التعليق اتشال والحسابات فضلت.
const cfg = $('Config').first().json;
const res = $('Validate Data').first().json;
const m = res.months || [];
const li = m.length - 1, pi = m.length - 2;
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
// نفس النود للتقريرين — الفرق بس في تسمية الفترة.
const periodLabel = cfg.cadence === 'weekly' ? arWeek : arMonth;
const lastLabel = m.length ? periodLabel(m[li]) : '';
const prevLabel = pi >= 0 ? periodLabel(m[pi]) : '';

let up = 0, down = 0, same = 0, gone = 0, fresh = 0, sum = 0, n = 0;
(res.data || []).forEach(d => {
  const last = d.positions[li], prev = pi >= 0 ? d.positions[pi] : null;
  if (prev === null && last !== null) { fresh++; return; }
  if (prev !== null && last === null) { gone++; return; }
  if (prev !== null && last !== null && prev !== 0) {
    const pct = Math.round(((prev - last) / prev) * 1000) / 10;
    sum += pct; n++;
    if (pct > 0) up++; else if (pct < 0) down++; else same++;
  }
});
const avg = n ? Math.round((sum / n) * 10) / 10 : 0;

// ---- حالة بناء العرض التقديمي ----
// Create Slides شغّال بـ continueRegularOutput (مايعملش retry لأن الـ objectIds
// بتتبعت من عندنا والطلب مش idempotent). فلازم نقرا ردوده بنفسنا ونقول في
// الإيميل لو العرض ما اكتملش، بدل ما نبعت لينك لعرض ناقص من غير ما حد يعرف.
const batches = $('Create Slides').all();
const plan    = $('Build Slide Batches').first().json || {};
let slidesDone = 0;
const slideErrors = [];
batches.forEach((b, i) => {
  const j = b.json || {};
  const err = j.error;
  if (err !== undefined && err !== null) {
    const txt = typeof err === 'string' ? err : (err.message || JSON.stringify(err));
    if (slideErrors.length < 10) slideErrors.push(String(txt).slice(0, 300));
    return;
  }
  const planned = $('Build Slide Batches').all()[i];
  slidesDone += Number((planned && planned.json.slidesInBatch) || 0);
});
const slidesExpected = Number(plan.slidesExpected || 0);
const slidesOk = slideErrors.length === 0 && (!slidesExpected || slidesDone === slidesExpected);

return [{ json: { up, down, same, fresh, gone, avg, lastLabel, prevLabel,
                  slidesOk, slidesDone, slidesExpected, slideErrors } }];
