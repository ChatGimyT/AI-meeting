// أسابيع كاملة (إثنين → أحد).
// الفرق عن النسخة القديمة:
//  1) الأسبوع بيتحسب "مقفول" لما يوم الأحد بتاعه يكون عند جوجل بيانات نهائية
//     عنه (من نود GSC Freshness). قبل كده كان LAG_DAYS = 0، يعني الرن اللي
//     بيحصل الإثنين كان بيطلب أسبوع لسه بياناته ما وصلتش لجوجل — ودي كانت
//     أكبر سبب لأرقام ناقصة أو فاضية في آخر عمود.
//  2) كل طلب معاه taskId + taskIndex عشان الربط بين الطلب والرد يبقى مؤكد.
const cfg   = $('Config').first().json;
const kws   = $('Keywords').first().json.keywords;
const hist  = $('Read Sheet').first().json.__history || { byRow: {} };
const fresh = $('Freshness Guard').first().json;

const DAY = 86400000;
const latest = fresh.latestDataDate;
const today  = new Date();

const pad = v => String(v).padStart(2, '0');
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));   // خميس نفس الأسبوع
  const yStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const wk = Math.ceil((((t - yStart) / DAY) + 1) / 7);
  return t.getUTCFullYear() + '-W' + pad(wk);
}

// إثنين الأسبوع الحالي
const offset  = (today.getUTCDay() + 6) % 7;
const thisMon = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset));

const all = [];
for (let i = 1; i <= 60 && all.length < cfg.columns; i++) {
  const start = new Date(thisMon.getTime() - i * 7 * DAY);
  const end   = new Date(start.getTime() + 6 * DAY);
  const endDate = end.toISOString().slice(0, 10);
  if (endDate > latest) continue;              // الأسبوع لسه بياناته ما اكتملتش
  const sd = pad(start.getUTCDate()), sm = pad(start.getUTCMonth() + 1);
  const ed = pad(end.getUTCDate()),   em = pad(end.getUTCMonth() + 1);
  const sy = start.getUTCFullYear(),  ey = end.getUTCFullYear();
  const yearLine = (sy === ey) ? String(ey) : (sy + '–' + String(ey).slice(2));
  all.push({
    key: isoWeek(start),
    caption: sd + '/' + sm + '\n↓\n' + ed + '/' + em,
    year: yearLine,
    label: sd + '/' + sm,
    startDate: start.toISOString().slice(0, 10),
    endDate,
  });
}
const periods = all.reverse();

if (!periods.length) {
  throw new Error('Build Tasks: مفيش ولا أسبوع مقفول عند جوجل (آخر يوم بيانات: ' +
                  latest + ') — الرن اتوقف قبل ما يطلّع تقرير فاضي.');
}

const forceFrom = periods.length - (cfg.refetchLast || 0);

const out = [];
let taskIndex = 0;
cfg.countries.forEach((c, ci) => {
  kws.forEach((k, ki) => {
    const rec = hist.byRow[c.name + '||' + k.keyword] || {};
    periods.forEach((p, pIdx) => {
      const cell = rec[p.key];
      if (cell && cell.filled && cell.position !== null && pIdx < forceFrom) return;
      out.push({ json: {
        taskId: c.name + '||' + k.keyword + '||' + p.key,
        taskIndex: taskIndex++,
        period: p.key, label: p.label,
        startDate: p.startDate, endDate: p.endDate,
        keyword: k.keyword, page: k.page || '', group: k.group,
        countryCode: c.code, countryName: c.name, ci, ki, pIdx,
        __periods: periods,
        __latestDataDate: latest,
      } });
    });
  });
});

if (!out.length) {
  return [{ json: { __noFetch: true, __periods: periods, __latestDataDate: latest, taskIndex: 0 } }];
}
return out;
