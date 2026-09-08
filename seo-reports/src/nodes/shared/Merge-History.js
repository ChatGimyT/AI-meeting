// بيدمج أرشيف الشيت مع الخانات اللي اتسحبت دلوقتي، وبيصنّف كل خانة:
//
//   ranked        رقم مؤكد من جوجل                → يتكتب رقم
//   no-data       جوجل رد سليم ومفيش أي ظهور      → يتكتب '-'
//   from-archive  السحبة فشلت والأرشيف فيه رقم    → يتكتب رقم الأرشيف
//   kept-archive  السحبة قالت "مفيش" لعمود قديم   → يتمسك رقم الأرشيف (شبهة)
//   hole          مفيش سحبة ولا أرشيف             → الخانة تفضل فاضية
//
// القاعدة الذهبية: خانة فشل سحبها عمرها ما تتكتب '-' ولا 0 — بتفضل فاضية
// عشان الرن الجاي يعيد يجيبها، والفرق بين "فاضية" و"مفيش ظهور" يفضل واضح.
/* @use gsc */

const cfg   = $('Config').first().json;
const kws   = $('Keywords').first().json.keywords;
const rs    = $('Read Sheet').first().json;
const hist  = rs.__history || { byRow: {}, monthKeys: [] };
const tasks = $('Build Tasks').all();
const collect = $('Collect Results').first().json || {};

const periods = (tasks[0] && tasks[0].json.__periods) || [];
const noFetch = !!(tasks[0] && tasks[0].json.__noFetch);

// ---------- 1) الربط: السحبة الأولى ثم المحاولة التانية ----------
const cells = {};                       // taskId → classify()
const pairing = { pass1: null, pass2: null };

if (!noFetch) {
  const p1 = pairResults(tasks, $('GSC Query').all(), cfg.gscRowLimit);
  pairing.pass1 = p1.stats;
  Object.keys(p1.map).forEach(k => { cells[k] = p1.map[k]; });

  // نود GSC Retry Query بيشتغل بس لما يبقى فيه طلبات محتاجة إعادة.
  if (Number(collect.retryCount) > 0) {
    const retryTasks = $('Collect Results').all();
    const p2 = pairResults(retryTasks, $('GSC Retry Query').all(), cfg.gscRowLimit);
    pairing.pass2 = p2.stats;
    Object.keys(p2.map).forEach(k => {
      // المحاولة التانية بتستبدل نتيجة فاشلة بس — مش بتلغي نتيجة سليمة.
      if (!cells[k] || cells[k].state !== 'ok') cells[k] = p2.map[k];
    });
  }
}

// ---------- 2) قراءة كل خانة ----------
const fresh = {};
const requestStats = { requested: tasks.length, ranked: 0, noData: 0, failed: 0, truncated: 0,
                       scopePage: 0, scopeSite: 0 };
const failures = [];      // تفاصيل كل خانة فشلت
const pageMisses = [];    // الصفحة المستهدفة متحطة بس مكانتش ظاهرة الفترة دي
const noPageKws = {};     // كلمات من غير رابط صفحة مستهدفة أصلاً

// ---- شهادة الرابط: هل الصفحة المستهدفة ظهرت عند جوجل ولا لأ؟ ----
// الفحص ده مجاني: بيستخدم نفس الردود اللي سحبناها. وبيفرّق بين حالتين
// بيدّوا نفس الخانة الفاضية ومعناهم مختلف تمامًا:
//   • الكلمة مالهاش ترتيب أصلاً        → الرقم صح، الصفحة لسه ما ظهرتش
//   • الكلمة ليها ترتيب بصفحات تانية    → الرابط اللي عندنا غالبًا غلط
// التانية دي بتخلي التقرير يقول "مفيش ظهور" لصفحة شغالة فعلًا — رقم غلط
// بيعدّي من غير ما حد يشك فيه، لأن الرابط بيفتح عادي لما تجربه بإيدك.
// المفتاح لازم يكون (الدولة + الكلمة) زي صفوف التقرير بالظبط. لو فهرسناها
// بالكلمة لوحدها، العميل اللي بيستهدف نفس الكلمة في سوقين بتتلم صفوفه في
// إدخال واحد — فنص الشهادات بتختفي والتقرير بيقول "كله تمام" وهو مش فاحص.
const pageEvidence = {};  // country||keyword → { periods, seen, queryRanked, samples }
function noteEvidence(j, cell) {
  const ek = (j.countryName || '') + '||' + j.keyword;
  const e = pageEvidence[ek] || (pageEvidence[ek] = {
    keyword: j.keyword, country: j.countryName || '', page: j.page || '',
    periods: 0, seen: 0, queryRanked: 0, samples: [],
  });
  if (!j.page) return;
  if (cell.verdict === 'failed') return;      // فشل السحب مش شهادة على الرابط
  e.periods++;
  if (cell.pageFound) { e.seen++; return; }
  if (cell.pagesSeen > 0) {
    e.queryRanked++;
    if (e.samples.length < 3 && cell.topPage) {
      e.samples.push({ period: j.period, topPage: cell.topPage, position: cell.topPagePosition });
    }
  }
}

if (!noFetch) {
  tasks.forEach(t => {
    const j = t.json || {};
    if (!j.taskId) return;
    const cell = readCell(cells[j.taskId], j.page, cfg.pageMatch);
    fresh[j.taskId] = cell;
    noteEvidence(j, cell);
    if (!j.page) noPageKws[j.keyword] = 1;
    if (cell.verdict === 'ranked') {
      requestStats.ranked++;
      if (cell.truncated) requestStats.truncated++;
      if (cell.scope === 'page') requestStats.scopePage++; else requestStats.scopeSite++;
      if (j.page && cell.matchMode === 'site-fallback' && pageMisses.length < 200) {
        pageMisses.push({ keyword: j.keyword, period: j.period,
                          expected: j.page, topPage: cell.topPage,
                          pagesSeen: cell.pagesSeen });
      }
    } else if (cell.verdict === 'no-data') {
      requestStats.noData++;
    } else {
      requestStats.failed++;
      if (failures.length < 200) {
        failures.push({ keyword: j.keyword, country: j.countryName,
                        period: j.period, reason: cell.reason });
      }
    }
  });
}

// ---------- 2b) حكم على كل رابط ----------
const pageAudit = { ok: [], suspect: [], notRanking: [], unchecked: [] };
Object.keys(pageEvidence).forEach(function (ek) {
  const e = pageEvidence[ek];
  if (!e.periods)        { pageAudit.unchecked.push(e); return; }
  if (e.seen > 0)        { pageAudit.ok.push(e); return; }
  // الصفحة ما ظهرتش ولا مرة، لكن الكلمة ليها ترتيب بصفحات تانية → شبهة رابط
  if (e.queryRanked > 0) { pageAudit.suspect.push(e); return; }
  pageAudit.notRanking.push(e);
});

// ---------- 3) الأعمدة: كل اللي في الشيت + أي عمود جديد ----------
const allKeysSet = {};
(hist.monthKeys || []).forEach(k => { allKeysSet[k] = true; });
periods.forEach(p => { allKeysSet[p.key] = true; });
const allKeys = Object.keys(allKeysSet).sort();

// الأعمدة اللي لسه بياناتها ممكن تتغير عند جوجل (آخر VOLATILE_TAIL عمود).
// أي عمود أقدم من كده بياناته مقفولة، فلو السحبة رجعت "مفيش" والأرشيف فيه
// رقم → الأرشيف هو الصح والسحبة هي اللي فيها مشكلة.
const volatile = {};
periods.slice(Math.max(0, periods.length - (cfg.volatileTail || 2))).forEach(p => { volatile[p.key] = true; });

const AR_MON = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
// تسمية العمود بتختلف حسب الإيقاع: الشهري بيسمّي الشهر بالعربي،
// والأسبوعي بيستخدم التسمية اللي بناها Build Tasks (أسبوع كذا).
const __cadence = cfg.cadence;
const labelOf = (key) => __cadence === 'weekly'
  ? String(key)
  : (AR_MON[Number(String(key).split('-')[1]) - 1] || String(key));
const lastLabelOf = (p) => __cadence === 'weekly' ? (p.label || String(p.key)) : labelOf(p.key);

// ---------- 4) بناء الصفوف ----------
const data = [];        // للتقرير (آخر COLUMNS عمود)
const sheetRows = [];   // للشيت (كل الأعمدة من أول يوم)
const tally = { ranked: 0, noData: 0, fromArchive: 0, keptArchive: 0, holes: 0, archiveOnly: 0 };
const suspicious = [];  // خانات مسكنا فيها الأرشيف رغم إن السحبة قالت "مفيش"

function resolve(rowKey, key, isReportPeriod) {
  const f = fresh[rowKey + '||' + key];
  const o = (hist.byRow[rowKey] || {})[key];
  const archived = o && o.filled;
  const archivedNum = archived && o.position !== null;

  if (f && f.verdict === 'ranked') {
    return { state: 'ranked', position: f.position, impressions: f.impressions,
             cell: f.position, scope: f.scope, matchedPage: f.matchedPage || '' };
  }
  if (f && f.verdict === 'no-data') {
    // عمود قديم + الأرشيف فيه رقم → نمسك الأرشيف ونسجّل شبهة.
    if (archivedNum && !volatile[key]) {
      if (isReportPeriod && suspicious.length < 200) suspicious.push({ rowKey, period: key, archived: o.position });
      return { state: 'kept-archive', position: o.position, impressions: o.impressions, cell: o.position };
    }
    return { state: 'no-data', position: null, impressions: 0, cell: '-' };
  }
  // السحبة فشلت أو مفيش سحبة أصلاً → الأرشيف لو موجود، وإلا خانة فاضية.
  if (archived) {
    return { state: f ? 'from-archive' : 'archive-only',
             position: o.position, impressions: o.impressions,
             cell: o.position === null ? '-' : o.position };
  }
  return { state: 'hole', position: null, impressions: 0, cell: '' };
}

/* نفس منطق التوزيع اللي في Build Tasks بالحرف — لو اختلفوا، صفوف التقرير
 * هتبقى غير الطلبات اللي اتبعتت فعلاً، وده أخطر من غلطة حسابية لأنه بيبان سليم. */
const byCountryName = {};
cfg.countries.forEach(function (c, i) { byCountryName[c.name] = { c: c, i: i }; });
const perKeywordCountry = kws.some(function (k) { return k && k.country; });

const pairs = [];
if (perKeywordCountry) {
  kws.forEach(function (k) {
    const hit = byCountryName[k.country] || { c: cfg.countries[0], i: 0 };
    pairs.push({ c: hit.c, k: k });
  });
} else {
  cfg.countries.forEach(function (c) { kws.forEach(function (k) { pairs.push({ c: c, k: k }); }); });
}

pairs.forEach(function (pair) {
  const c = pair.c, k = pair.k;
  {
    const rowKey = c.name + '||' + k.keyword;

    // --- الصف الكامل لكل الأعمدة (بيتكتب في الشيت زي ما هو) ---
    const cellsAll = [], imprAll = [];
    allKeys.forEach(mk => {
      const r = resolve(rowKey, mk, false);
      cellsAll.push(r.cell);
      imprAll.push(r.state === 'hole' ? '' : r.impressions);
    });
    sheetRows.push({ country: c.name, section: k.group, keyword: k.keyword,
                     page: k.page || '', article: k.article || '', cellsAll, imprAll });

    // --- أعمدة التقرير بس (السلايدز + الإيميل) ---
    const positions = [], impressions = [], cellsPos = [];
    periods.forEach(p => {
      const r = resolve(rowKey, p.key, true);
      if (r.state === 'ranked')            tally.ranked++;
      else if (r.state === 'no-data')      tally.noData++;
      else if (r.state === 'from-archive') tally.fromArchive++;
      else if (r.state === 'kept-archive') tally.keptArchive++;
      else if (r.state === 'archive-only') tally.archiveOnly++;
      else                                 tally.holes++;
      positions.push(r.position);
      impressions.push(r.impressions || 0);
      cellsPos.push(r.state === 'hole' ? '' : r.cell);
    });

    const li = periods.length - 1;
    const lastCell = periods.length ? fresh[rowKey + '||' + periods[li].key] : null;
    data.push({
      country: c.name, section: k.group, group: k.group + ' — ' + c.name,
      keyword: k.keyword, page: k.page || '', article: k.article || '',
      sv: (k.sv === undefined || k.sv === null) ? '' : k.sv,
      positions, impressionsAll: impressions, cellsPos,
      impressions: impressions[li] || 0,
      // نطاق قياس آخر عمود: 'page' = الصفحة المستهدفة | 'site' = كل صفحات
      // الموقع للكلمة. بيتعرض في السلايد عشان اللي بيراجع يعرف يفلتر نفس
      // الفلتر في واجهة Search Console.
      scope: (lastCell && lastCell.scope) || (k.page ? 'page' : 'site'),
      matchedPage: (lastCell && lastCell.matchedPage) || '',
    });
  }
});

const safe = v => (typeof v === 'number' && !isFinite(v)) ? '' : v;
sheetRows.forEach(r => { r.cellsAll = r.cellsAll.map(safe); r.imprAll = r.imprAll.map(safe); });

const totalCells = data.length * periods.length;
const filled = tally.ranked + tally.noData + tally.fromArchive + tally.keptArchive + tally.archiveOnly;

return [{ json: {
  // الشهري ما عندوش startDate/endDate على الفترة، فبيتساب undefined ومحدش
  // بيقراه — والأسبوعي محتاجهم لبناء عنوان الأسبوع بالعربي.
  months: periods.map(p => ({ key: p.key, label: __cadence === 'weekly' ? p.label : labelOf(p.key),
                              caption: p.caption, year: p.year,
                              startDate: p.startDate, endDate: p.endDate })),
  data,
  allMonths: allKeys.map(k => ({ key: k, label: labelOf(k) })),
  sheetRows,
  lastMonth: periods.length ? lastLabelOf(periods[periods.length - 1]) : null,
  quality: {
    totalCells, filled,
    coverage: totalCells ? Math.round((filled / totalCells) * 10000) / 10000 : 1,
    tally, requestStats, pairing,
    failures, suspicious, pageMisses,
    keywordsWithoutPage: Object.keys(noPageKws),
    pageAudit: {
      ok: pageAudit.ok.length,
      notRanking: pageAudit.notRanking.map(function (e) {
        return e.country ? (e.keyword + ' (' + e.country + ')') : e.keyword;
      }),
      suspect: pageAudit.suspect.map(function (e) {
        return { keyword: e.keyword, country: e.country, page: e.page,
                 periodsRanked: e.queryRanked, periods: e.periods, samples: e.samples };
      }),
    },
    noFetch,
    sheetError: rs.__sheetError || '',
    extent: rs.__extent || { rows: 0, cols: 0 },
    latestDataDate: (tasks[0] && tasks[0].json.__latestDataDate) || '',
    freshnessSource: $('Freshness Guard').first().json.freshnessSource,
    periodsInSheet: (hist.monthKeys || []).length,
    totalPeriodsStored: allKeys.length,
    keywordCount: kws.length,
    perKeywordCountry: perKeywordCountry,
    rowsBuilt: data.length,
    invalidEmails: cfg.mailInvalid || [],
  },
} }];
