// بيحدد آخر يوم عند جوجل فيه بيانات نهائية (final) للموقع ده.
// ده بيلغي التخمين بتاع LAG_DAYS: مش بنطلب فترة لسه بياناتها ما اكتملتش،
// وده كان أكبر سبب لخانات بترجع فاضية أو بأرقام ناقصة.
const cfg = $('Config').first().json;
const r   = $input.first() ? ($input.first().json || {}) : {};

const DAY = 86400000;
const iso = (d) => new Date(d).toISOString().slice(0, 10);

let latest = null;
let source = 'fallback';
let probedRows = 0;
let probeError = '';

if (r && r.error !== undefined && r.error !== null) {
  probeError = typeof r.error === 'string' ? r.error : JSON.stringify(r.error).slice(0, 300);
} else if (r && Array.isArray(r.rows)) {
  probedRows = r.rows.length;
  const dates = r.rows
    .map(x => String(((x || {}).keys || [])[0] || ''))
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort();
  if (dates.length) {
    latest = dates[dates.length - 1];
    source = 'gsc';
  }
}

if (!latest) {
  // احتياطي: النهاردة ناقص LAG_DAYS (بحد أدنى 3 أيام — ده المتوسط الحقيقي
  // لتأخير بيانات GSC النهائية).
  const lag = Math.max(3, Number(cfg.lagDays) || 0);
  latest = iso(Date.now() - lag * DAY);
}

// حزام أمان: لو جوجل رجّع تاريخ في المستقبل (فرق توقيت) نقصّه لإمبارح.
const yesterday = iso(Date.now() - DAY);
if (latest > yesterday) latest = yesterday;

return [{ json: {
  latestDataDate: latest,
  freshnessSource: source,
  probedRows,
  probeError,
} }];
