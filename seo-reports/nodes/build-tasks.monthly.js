// بيبني قائمة الطلبات (كلمة × شهر) اللي هتتبعت لجوجل.
// الفرق عن النسخة القديمة:
//  1) نهاية الفترة بتتقارن بآخر يوم فيه بيانات نهائية عند جوجل (من نود
//     GSC Freshness) مش بتخمين LAG_DAYS — فمش بنطلب شهر لسه ما اكتملش.
//  2) كل طلب معاه taskId + taskIndex عشان الربط بين الطلب والرد يبقى مؤكد.
const cfg   = $('Config').first().json;
const kws   = $('Keywords').first().json.keywords;
const hist  = $('Read Sheet').first().json.__history || { byRow: {} };
const fresh = $('Freshness Guard').first().json;

const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const latest = fresh.latestDataDate;               // 'YYYY-MM-DD'

const today = new Date();
const all = [];
let y = today.getUTCFullYear(), m = today.getUTCMonth();
for (let i = 0; i < 40; i++) {
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const endDate = new Date(Date.UTC(y, m, lastDay)).toISOString().slice(0, 10);
  // الشهر بيتحسب مقفول لما آخر يوم فيه يكون عند جوجل بيانات نهائية عنه.
  if (endDate <= latest) {
    all.push({
      key: y + '-' + String(m + 1).padStart(2, '0'),
      label: MON[m] + ' ' + String(y).slice(2),
      startDate: new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10),
      endDate,
    });
  }
  m--; if (m < 0) { m = 11; y--; }
}
const periods = all.slice(0, cfg.columns).reverse();

if (!periods.length) {
  throw new Error('Build Tasks: مفيش ولا شهر مقفول عند جوجل (آخر يوم بيانات: ' +
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
      // خانة متأكدين منها (فيها رقم) وقديمة → مش محتاجين نعيد سحبها.
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
