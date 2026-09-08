// بيبني قائمة الطلبات (كلمة × فترة) اللي هتتبعت لجوجل.
//
// النود ده واحد للتقريرين — الفرق الوحيد بينهم هو تعريف "الفترة":
// الشهري = شهر ميلادي كامل | الأسبوعي = أسبوع إثنين→أحد بترقيم ISO.
// أي حاجة تانية (إمتى الفترة تتحسب مقفولة، إعادة السحب، بناء الطلبات)
// مشتركة بالحرف — عشان التقريرين مايختلفوش على نفس الكلمة في نفس اليوم.
//
//  1) الفترة بتتحسب "مقفولة" لما آخر يوم فيها يكون عند جوجل بيانات نهائية
//     عنه (من نود GSC Freshness) مش بتخمين LAG_DAYS. ده كان أكبر سبب
//     لأرقام ناقصة أو فاضية في آخر عمود.
//  2) كل طلب معاه taskId + taskIndex عشان الربط بين الطلب والرد يبقى مؤكد.
const cfg   = $('Config').first().json;
const kws   = $('Keywords').first().json.keywords;
const hist  = $('Read Sheet').first().json.__history || { byRow: {} };
const fresh = $('Freshness Guard').first().json;

const DAY    = 86400000;
const latest = fresh.latestDataDate;               // 'YYYY-MM-DD'
const today  = new Date();
const pad    = v => String(v).padStart(2, '0');
const MON    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function isoWeek(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));   // خميس نفس الأسبوع
  const yStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const wk = Math.ceil((((t - yStart) / DAY) + 1) / 7);
  return t.getUTCFullYear() + '-W' + pad(wk);
}

// ---------- بناء الفترات ----------
const all = [];
if (cfg.cadence === 'weekly') {
  // إثنين الأسبوع الحالي — نقطة البداية اللي بنرجع منها للخلف
  const offset  = (today.getUTCDay() + 6) % 7;
  const thisMon = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - offset));

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
} else {
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
}

const periods = cfg.cadence === 'weekly' ? all.reverse() : all.slice(0, cfg.columns).reverse();

if (!periods.length) {
  throw new Error('Build Tasks: مفيش ولا ' + (cfg.cadence === 'weekly' ? 'أسبوع' : 'شهر') +
                  ' مقفول عند جوجل (آخر يوم بيانات: ' + latest +
                  ') — الرن اتوقف قبل ما يطلّع تقرير فاضي.');
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
