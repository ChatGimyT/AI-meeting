#!/usr/bin/env node
// خطة الاختبار منفّذة كود — كل حالة هنا بتقابل بند في docs/TESTING.md
import { runNode, loadWorkflow, test, group, assert, equal, summary,
         gscRow, okResponse, emptyResponse, errResponse } from './tests/harness.mjs';

const M = 'ALOJAN - Monthly Final v3';
const W = 'ALOJAN - Weekly Final v3';
const S = 'SHOUG - Monthly Final v3';

// ---------------------------------------------------------------- مساعدات
const CFG = {
  siteUrl: 'https://www.aaalojan.com/', spreadsheetId: 'SS', sheetTab: 'الورقة1',
  presentationId: 'PP', columns: 3, lagDays: 3, refetchLast: 3,
  minCoverage: 0.98, maxHoles: 12,
  gscRowLimit: 500, gscDataState: 'final', pageMatch: 'prefer', volatileTail: 1,
  cadence: 'monthly', company: 'شركة', manager: 'المدير',
  mailFrom: 'M.gamal@rabeh.org', mailFromDisplay: '"رابح" <M.gamal@rabeh.org>',
  mailReplyTo: 'M.gamal@rabeh.org',
  mailTo: 'a@gmail.com', mailCc: 'b@rabeh.org', mailAlert: 'b@rabeh.org',
  mailToList: ['a@gmail.com'], mailCcList: ['b@rabeh.org'],
  mailAllList: ['a@gmail.com', 'b@rabeh.org'], mailInvalid: [],
  countries: [{ code: 'sau', name: 'السعودية' }],
};

const KWS = [
  { group: 'ق1', page: '', keyword: 'كلمة أ', sv: 100, article: 'مقال أ' },
  { group: 'ق1', page: 'https://www.aaalojan.com/target/', keyword: 'كلمة ب', sv: '', article: 'مقال ب' },
];

const PERIODS = [
  { key: '2025-06', label: 'Jun 25', startDate: '2025-06-01', endDate: '2025-06-30' },
  { key: '2025-07', label: 'Jul 25', startDate: '2025-07-01', endDate: '2025-07-31' },
  { key: '2025-08', label: 'Aug 25', startDate: '2025-08-01', endDate: '2025-08-31' },
];

const task = (kwIndex, pIdx, extra = {}) => ({
  taskId: `السعودية||${KWS[kwIndex].keyword}||${PERIODS[pIdx].key}`,
  taskIndex: kwIndex * PERIODS.length + pIdx,
  period: PERIODS[pIdx].key, label: PERIODS[pIdx].label,
  startDate: PERIODS[pIdx].startDate, endDate: PERIODS[pIdx].endDate,
  keyword: KWS[kwIndex].keyword, page: KWS[kwIndex].page, group: KWS[kwIndex].group,
  countryCode: 'sau', countryName: 'السعودية', ci: 0, ki: kwIndex, pIdx,
  __periods: PERIODS, __latestDataDate: '2025-09-05',
  ...extra,
});

const ALL_TASKS = [0, 1].flatMap((k) => [0, 1, 2].map((p) => task(k, p)));

const emptyHistory = { monthKeys: [], byRow: {} };

function mergeRun({ tasks = ALL_TASKS, results, retryTasks = null, retryResults = null,
                    history = emptyHistory, sheetError = '', cfg = CFG, kws = KWS,
                    extent = { rows: 0, cols: 0 } }) {
  const collect = retryTasks
    ? retryTasks.map((t, i) => ({ ...t, __retry: true, retryIndex: i, retryCount: retryTasks.length }))
    : [{ __retry: false, retryCount: 0 }];
  return runNode({
    workflow: M, node: 'Merge History',
    nodes: {
      Config: [cfg],
      Keywords: [{ keywords: kws, keywordCount: kws.length }],
      'Read Sheet': [{ __history: history, __sheetError: sheetError, __extent: extent,
                       __sheetStats: { dataRows: 0, periodsInSheet: 0 } }],
      'Build Tasks': tasks,
      'GSC Query': results,
      'Collect Results': collect,
      ...(retryResults ? { 'GSC Retry Query': retryResults } : {}),
      'Freshness Guard': [{ latestDataDate: '2025-09-05', freshnessSource: 'gsc' }],
    },
    input: results,
  })[0].json;
}

const cellOf = (res, kwIndex, pIdx) => res.data[kwIndex].cellsPos[pIdx];
const posOf = (res, kwIndex, pIdx) => res.data[kwIndex].positions[pIdx];

// ============================================================ 1) سحب الأرقام
group('١) سحب الأرقام من جوجل — التفريق بين "مفيش ظهور" و"فشل"', () => {
  test('رد سليم فيه ترتيب → الرقم بيتكتب', () => {
    const res = mergeRun({
      results: ALL_TASKS.map((t, i) =>
        okResponse([gscRow('https://www.aaalojan.com/p1', 4.32, 90, 3)], { item: i })),
    });
    equal(posOf(res, 0, 0), 4.3, 'الترتيب بيتقرّب لخانة عشرية واحدة');
    equal(cellOf(res, 0, 0), 4.3);
    equal(res.quality.tally.holes, 0, 'مفيش خانات فاضية');
  });

  test('رد سليم من غير أي ظهور → "-" مش خانة فاضية', () => {
    const res = mergeRun({ results: ALL_TASKS.map((t, i) => emptyResponse({ item: i })) });
    equal(cellOf(res, 0, 0), '-', 'مفيش ظهور مؤكد = "-"');
    equal(posOf(res, 0, 0), null);
    equal(res.quality.tally.noData, 6);
    equal(res.quality.tally.holes, 0);
  });

  test('طلب فشل (429) → الخانة تفضل فاضية، وعمرها ما تتكتب "-"', () => {
    const results = ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 5, 10)], { item: i }));
    results[0] = errResponse('429 Too Many Requests', { item: 0 });
    const res = mergeRun({ results });
    equal(cellOf(res, 0, 0), '', 'خانة فشلت لازم تفضل فاضية');
    equal(res.quality.tally.holes, 1);
    equal(res.quality.requestStats.failed, 1);
    assert(res.quality.failures[0].reason.includes('429'), 'سبب الفشل بيتسجّل');
  });

  test('صف من جوجل من غير ترتيب صالح بيتعامل كـ "مفيش ظهور" مش كرقم', () => {
    const res = mergeRun({
      results: ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 0, 0)], { item: i })),
    });
    equal(cellOf(res, 0, 0), '-');
    equal(res.quality.tally.ranked, 0);
  });
});

// ============================================================ 2) الربط
group('٢) الربط بين الطلب والرد (السبب الرئيسي للأرقام الفاضية)', () => {
  test('ردود جاية بترتيب مقلوب → بتترتب صح بـ pairedItem', () => {
    const results = ALL_TASKS.map((t, i) =>
      okResponse([gscRow('https://x/p', i + 1, 10)], { item: i })).reverse();
    const res = mergeRun({ results });
    equal(posOf(res, 0, 0), 1, 'أول طلب لازم ياخد أول رد مهما كان ترتيب الوصول');
    equal(posOf(res, 1, 2), 6);
    equal(res.quality.tally.holes, 0);
  });

  test('رد واحد بس لكل الطلبات (فشل على مستوى النود) → باقي الخانات فاضية مش "-"', () => {
    const res = mergeRun({ results: [errResponse('401 invalid_grant', { item: 0 })] });
    equal(res.quality.tally.holes, 6, 'كل الست خانات فاضية: واحدة فشلت وخمسة من غير رد');
    equal(res.quality.requestStats.failed, 6, 'كلها اتحسبت فشل مش نجاح');
    equal(res.quality.tally.noData, 0, 'ولا خانة اتكتبت "-" بالغلط');
    equal(cellOf(res, 1, 2), '');
    assert(res.quality.pairing.pass1.strict, 'الربط اتحوّل للوضع الصارم');
  });

  test('رد زيادة من غير pairedItem في وضع صارم → بيتجاهل مش بيزحلق الباقي', () => {
    const results = ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', i + 1, 10)], { item: i }));
    results.splice(2, 0, okResponse([gscRow('https://x/ghost', 99, 1)], undefined));
    const res = mergeRun({ results });
    equal(posOf(res, 0, 2), 3, 'الخانة التالتة لسه بترتيبها الصح');
    assert(!res.data.some((d) => d.positions.includes(99)), 'الرد اليتيم مادخلش أي خانة');
  });
});

// ============================================================ 3) المحاولة التانية
group('٣) المحاولة التانية للطلبات اللي فشلت', () => {
  test('Collect Results بيرجّع الطلبات الفاشلة بس', () => {
    const results = ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 3, 10)], { item: i }));
    results[1] = errResponse('503', { item: 1 });
    results[4] = errResponse('429', { item: 4 });
    const out = runNode({
      workflow: M, node: 'Collect Results',
      nodes: { Config: [CFG], 'Build Tasks': ALL_TASKS, 'GSC Query': results },
      input: results,
    });
    equal(out.length, 2, 'اتنين طلب بس محتاجين إعادة');
    equal(out.map((o) => o.json.taskId), [ALL_TASKS[1].taskId, ALL_TASKS[4].taskId]);
    assert(out[0].json.__retry === true);
  });

  test('كل الطلبات نجحت → عنصر واحد بـ __retry=false (مايفتحش فرع الإعادة)', () => {
    const results = ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 3, 10)], { item: i }));
    const out = runNode({
      workflow: M, node: 'Collect Results',
      nodes: { Config: [CFG], 'Build Tasks': ALL_TASKS, 'GSC Query': results },
      input: results,
    });
    equal(out.length, 1);
    equal(out[0].json.__retry, false);
    equal(out[0].json.retryCount, 0);
  });

  test('المحاولة التانية بتملا الخانة اللي فشلت في الأولى', () => {
    const results = ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 8, 10)], { item: i }));
    results[3] = errResponse('429', { item: 3 });
    const res = mergeRun({
      results,
      retryTasks: [ALL_TASKS[3]],
      retryResults: [okResponse([gscRow('https://x/p', 2.5, 40)], { item: 0 })],
    });
    equal(posOf(res, 1, 0), 2.5, 'الخانة اتملت من المحاولة التانية');
    equal(res.quality.tally.holes, 0);
  });

  test('المحاولة التانية مابتلغيش نتيجة سليمة من الأولى', () => {
    const results = ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 8, 10)], { item: i }));
    const res = mergeRun({
      results,
      retryTasks: [ALL_TASKS[3]],
      retryResults: [errResponse('500', { item: 0 })],
    });
    equal(posOf(res, 1, 0), 8, 'النتيجة السليمة الأصلية فضلت');
  });
});

// ============================================================ 4) مطابقة الصفحة
group('٤) مطابقة الصفحة المستهدفة', () => {
  const rowsFor = (i) => (ALL_TASKS[i].keyword === 'كلمة ب'
    ? [gscRow('https://www.aaalojan.com/other', 9, 50), gscRow('https://www.aaalojan.com/target', 3, 20)]
    : [gscRow('https://www.aaalojan.com/p1', 6, 30)]);

  test('الرابط بيتطابق حتى لو اختلف في www والسلاش والحروف', () => {
    const res = mergeRun({ results: ALL_TASKS.map((t, i) => okResponse(rowsFor(i), { item: i })) });
    equal(posOf(res, 1, 0), 3, 'اتاخد ترتيب الصفحة المستهدفة مش أعلى صفحة');
    equal(res.quality.pageMisses.length, 0);
  });

  test('الصفحة المستهدفة مش ظاهرة → رقم الموقع كله للكلمة مش أعلى صفحة', () => {
    const res = mergeRun({
      results: ALL_TASKS.map((t, i) => okResponse(
        [gscRow('https://www.aaalojan.com/other', 7, 50),
         gscRow('https://www.aaalojan.com/third', 4, 5)], { item: i })),
    });
    // (7×50 + 4×5) ÷ 55 = 6.7 — مش 4 (أقل موضع) ولا 7 (أعلى ظهور).
    equal(posOf(res, 1, 0), 6.7, 'المتوسط الموزون بالظهور');
    equal(res.data[1].impressionsAll[0], 55, 'مجموع ظهور كل الصفحات');
    assert(res.quality.pageMisses.length > 0, 'الحالة اتسجّلت كملاحظة');
    equal(res.quality.tally.holes, 0, 'اختلاف الرابط عمره ما يطلّع خانة فاضية');
  });

  test('الصفحة المستهدفة ظاهرة → رقمها هي بالظبط مش رقم الموقع', () => {
    const res = mergeRun({
      results: ALL_TASKS.map((t, i) => okResponse(
        [gscRow('https://www.aaalojan.com/other', 3, 900),
         gscRow('https://www.aaalojan.com/target', 21, 4)], { item: i })),
    });
    equal(posOf(res, 1, 0), 21, 'رقم الصفحة المستهدفة');
    equal(res.data[1].impressionsAll[0], 4, 'ظهور الصفحة المستهدفة لوحدها');
    equal(res.data[1].scope, 'page');
  });

  test('وضع strict: الصفحة مش ظاهرة → "-" مؤكدة مش رقم صفحة تانية', () => {
    const res = mergeRun({
      cfg: { ...CFG, pageMatch: 'strict' },
      results: ALL_TASKS.map((t, i) => okResponse([gscRow('https://www.aaalojan.com/other', 7, 50)], { item: i })),
    });
    equal(cellOf(res, 1, 0), '-');
  });
});

// ============================================================ 5) حماية الأرشيف
group('٥) حماية الأرشيف من المسح', () => {
  const history = {
    monthKeys: ['2025-06', '2025-07', '2025-08'],
    byRow: {
      'السعودية||كلمة أ': {
        '2025-06': { position: 5.5, impressions: 120, filled: true },
        '2025-07': { position: 4.1, impressions: 130, filled: true },
        '2025-08': { position: 3.9, impressions: 140, filled: true },
      },
    },
  };

  test('طلب فشل + الأرشيف فيه رقم → بيرجّع رقم الأرشيف مش خانة فاضية', () => {
    const results = ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 2, 10)], { item: i }));
    results[0] = errResponse('429', { item: 0 });
    const res = mergeRun({ results, history });
    equal(posOf(res, 0, 0), 5.5, 'رقم الأرشيف اتحافظ عليه');
    equal(res.quality.tally.fromArchive, 1);
    equal(res.quality.tally.holes, 0);
  });

  test('عمود قديم مقفول رجع "مفيش ظهور" والأرشيف فيه رقم → الأرشيف بيكسب', () => {
    const res = mergeRun({ results: ALL_TASKS.map((t, i) => emptyResponse({ item: i })), history });
    equal(posOf(res, 0, 0), 5.5, 'يونيو مقفول — بياناته مابتتغيرش');
    equal(posOf(res, 0, 1), 4.1, 'يوليو كمان مقفول');
    equal(res.quality.tally.keptArchive, 2);
    assert(res.quality.suspicious.length === 2, 'الحالة اتسجّلت للمراجعة');
  });

  test('آخر عمود (volatile) رجع "مفيش ظهور" → بيتحدّث فعلاً لـ "-"', () => {
    const res = mergeRun({ results: ALL_TASKS.map((t, i) => emptyResponse({ item: i })), history });
    equal(cellOf(res, 0, 2), '-', 'آخر عمود لسه ممكن يتغير فبنثق في السحبة');
  });

  test('فشل قراءة الشيت → البوابة بتوقف الرن قبل ما يمسح الأرشيف', () => {
    const merged = mergeRun({
      results: ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 2, 10)], { item: i })),
      sheetError: '403 The caller does not have permission',
    });
    const v = runNode({
      workflow: M, node: 'Validate Data',
      nodes: { Config: [CFG] }, input: [merged],
    })[0].json;
    assert(!v.ok, 'الرن لازم يتوقف');
    assert(v.problems.some((p) => p.includes('مقدرناش نقرا الشيت')), 'السبب واضح في التنبيه');
  });
});

// ============================================================ 6) قراءة الشيت
group('٦) قراءة الشيت وتحويل الأرقام', () => {
  const readSheet = (values, extra = {}) => runNode({
    workflow: M, node: 'Read Sheet', nodes: {}, input: [{ values, ...extra }],
  })[0].json;

  test('عمود فاضي ≠ عمود فيه "-"', () => {
    const r = readSheet([
      ['Country', 'Section', 'Keyword', 'Page', 'Article', '2025-06 Pos', '2025-06 Impr', '2025-07 Pos', '2025-07 Impr'],
      ['السعودية', 'ق1', 'كلمة أ', '', '', '-', 0, '', ''],
    ]);
    const rec = r.__history.byRow['السعودية||كلمة أ'];
    equal(rec['2025-06'].filled, true, '"-" = اتسحبت ومفيش ظهور');
    equal(rec['2025-06'].position, null);
    equal(rec['2025-07'].filled, false, 'الفاضية = ما اتسحبتش');
  });

  test('أرقام عربية وفواصل آلاف بتتقري صح', () => {
    const r = readSheet([
      ['Country', 'Section', 'Keyword', 'Page', 'Article', '2025-06 Pos', '2025-06 Impr'],
      ['السعودية', 'ق1', 'كلمة أ', '', '', '٤٫٥', '١٬٢٣٤'],
    ]);
    const rec = r.__history.byRow['السعودية||كلمة أ'];
    equal(rec['2025-06'].position, 4.5);
    equal(rec['2025-06'].impressions, 1234);
  });

  test('الأعمدة الناقصة في آخر الصف (جوجل بيقصّها) بتتقري كـ "ما اتسحبتش"', () => {
    const r = readSheet([
      ['Country', 'Section', 'Keyword', 'Page', 'Article', '2025-06 Pos', '2025-06 Impr', '2025-07 Pos', '2025-07 Impr'],
      ['السعودية', 'ق1', 'كلمة أ', '', '', 3, 50],
    ]);
    equal(r.__history.byRow['السعودية||كلمة أ']['2025-07'].filled, false);
  });

  test('فشل الجلب بيتسجّل كـ sheetError مش كشيت فاضي', () => {
    const r = runNode({ workflow: M, node: 'Read Sheet', nodes: {},
                        input: [{ error: '500 Internal Error' }] })[0].json;
    assert(r.__sheetError.includes('500'), 'الخطأ اتسجّل');
    equal(Object.keys(r.__history.byRow).length, 0);
  });

  test('مقاس الشيت القديم بيتسجّل عشان الكتابة تمسح الزايد', () => {
    const r = readSheet([
      ['Country', 'Section', 'Keyword', 'Page', '2025-06 Pos', '2025-06 Impr'],
      ['السعودية', 'ق1', 'كلمة قديمة', '', 3, 50],
      ['السعودية', 'ق1', 'كلمة قديمة ٢', '', 4, 20],
    ]);
    equal(r.__extent, { rows: 3, cols: 6 });
  });
});

// ============================================================ 7) الكتابة على الشيت
group('٧) الكتابة على الشيت', () => {
  test('الصفوف الزيادة من قايمة كلمات قديمة بتتمسح بالتبطين', () => {
    const merged = mergeRun({
      results: ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 3, 10)], { item: i })),
      extent: { rows: 40, cols: 60 },
    });
    const v = runNode({ workflow: M, node: 'Validate Data', nodes: { Config: [CFG] }, input: [merged] })[0].json;
    equal(v.writtenRows, 40, 'بنكتب لغاية آخر صف كان موجود');
    equal(v.writtenCols, 60, 'وبنغطي كل الأعمدة القديمة');
    const tail = v.sheetValues[39];
    assert(tail.every((c) => c === ''), 'الصفوف الزيادة بتتكتب فاضية');
    assert(v.sheetValues.every((r) => r.length === 60), 'كل الصفوف بنفس العرض');
  });

  test('ترويسة الشيت فيها عمود Article الجديد', () => {
    const merged = mergeRun({ results: ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 3, 10)], { item: i })) });
    const v = runNode({ workflow: M, node: 'Validate Data', nodes: { Config: [CFG] }, input: [merged] })[0].json;
    equal(v.sheetValues[0].slice(0, 5), ['Country', 'Section', 'Keyword', 'Page', 'Article']);
    equal(v.sheetValues[0][5], '2025-06 Pos');
  });

  test('خانة فاضية بتتكتب فاضية في الشيت (مش 0)', () => {
    const results = ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 3, 10)], { item: i }));
    results[0] = errResponse('429', { item: 0 });
    const merged = mergeRun({ results });
    const v = runNode({ workflow: M, node: 'Validate Data', nodes: { Config: [CFG] }, input: [merged] })[0].json;
    equal(v.sheetValues[1][5], '', 'خانة الترتيب فاضية');
    equal(v.sheetValues[1][6], '', 'وخانة الظهور فاضية كمان — مش صفر');
  });
});

// ============================================================ 8) بوابة الجودة
group('٨) بوابة جودة البيانات', () => {
  const validate = (merged, cfg = CFG) =>
    runNode({ workflow: M, node: 'Validate Data', nodes: { Config: [cfg] }, input: [merged] })[0].json;

  test('كل الخانات مسحوبة → البوابة بتفتح', () => {
    const v = validate(mergeRun({ results: ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 3, 10)], { item: i })) }));
    assert(v.ok, `المفروض تعدي: ${v.problems.join(' | ')}`);
    equal(v.quality.coverage, 1);
  });

  test('تغطية أقل من الحد → البوابة بتقفل والشيت مابيتلمسش', () => {
    const results = ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 3, 10)], { item: i }));
    results[0] = errResponse('429', { item: 0 });
    results[1] = errResponse('429', { item: 1 });
    const v = validate(mergeRun({ results }));
    assert(!v.ok, 'لازم توقف');
    assert(v.problems.some((p) => p.includes('نسبة الخانات المكتملة')));
    assert(v.alertHtml.includes('429'), 'التنبيه فيه سبب الفشل الحقيقي');
    assert(v.alertText.includes('الشيت'), 'النسخة النصية موجودة');
  });

  test('عدد الخانات الفاضية فوق الحد → البوابة بتقفل', () => {
    const v = validate(mergeRun({ results: [errResponse('401', { item: 0 })] }),
                       { ...CFG, minCoverage: 0, maxHoles: 2 });
    assert(!v.ok);
    assert(v.problems.some((p) => p.includes('الخانات الفاضية')));
  });

  test('رقم خارج المدى المنطقي بيوقف الرن', () => {
    const merged = mergeRun({ results: ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 3, 10)], { item: i })) });
    merged.data[0].positions[0] = 4000;
    assert(!validate(merged).ok, 'ترتيب 4000 مش منطقي');
  });

  test('عدد الصفوف مش مطابق لعدد الكلمات بيوقف الرن', () => {
    const merged = mergeRun({ results: ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 3, 10)], { item: i })) });
    merged.data.pop();
    assert(!validate(merged).ok);
  });

  test('الملاحظات المش موقّفة بتوصل من غير ما توقف الرن', () => {
    const merged = mergeRun({
      results: ALL_TASKS.map((t, i) => okResponse(
        [gscRow('https://www.aaalojan.com/other', 4, 10)], { item: i })),
    });
    const v = validate(merged);
    assert(v.ok, 'الرن كمّل');
    assert(v.warnings.some((w) => w.includes('الصفحة المستهدفة')), 'الملاحظة اتسجّلت');
  });
});

// ============================================================ 9) نضارة البيانات
group('٩) آخر يوم فيه بيانات عند جوجل', () => {
  const fresh = (input) => runNode({
    workflow: M, node: 'Freshness Guard', nodes: { Config: [CFG] }, input: [input],
  })[0].json;

  test('بياخد أحدث تاريخ من رد جوجل', () => {
    const r = fresh({ rows: [{ keys: ['2025-09-01'] }, { keys: ['2025-09-03'] }, { keys: ['2025-08-30'] }] });
    equal(r.latestDataDate, '2025-09-03');
    equal(r.freshnessSource, 'gsc');
  });

  test('الطلب فشل → بيرجع لـ LAG_DAYS الاحتياطي وبيسجّل السبب', () => {
    const r = fresh({ error: '429' });
    equal(r.freshnessSource, 'fallback');
    assert(r.probeError.includes('429'));
    assert(/^\d{4}-\d{2}-\d{2}$/.test(r.latestDataDate));
  });

  test('تاريخ في المستقبل بيتقص لإمبارح', () => {
    const future = new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
    const r = fresh({ rows: [{ keys: [future] }] });
    assert(r.latestDataDate < future, 'ما ينفعش نطلب فترة لسه ما حصلتش');
  });
});

// ============================================================ 10) بناء الطلبات
group('١٠) بناء الفترات المطلوبة', () => {
  const buildTasks = (workflow, latest, history = emptyHistory) => runNode({
    workflow, node: 'Build Tasks',
    nodes: {
      Config: [{ ...CFG, columns: 15, refetchLast: 15 }],
      Keywords: [{ keywords: KWS }],
      'Read Sheet': [{ __history: history }],
      'Freshness Guard': [{ latestDataDate: latest, freshnessSource: 'gsc' }],
    },
    input: [{}],
  });

  test('شهري: ما بيطلبش شهر لسه بياناته ما اكتملتش عند جوجل', () => {
    const out = buildTasks(M, '2025-09-05');
    const periods = out[0].json.__periods.map((p) => p.key);
    assert(!periods.includes('2025-09'), 'سبتمبر لسه شغال');
    equal(periods[periods.length - 1], '2025-08', 'آخر شهر مقفول');
    equal(periods.length, 15);
  });

  test('شهري: شهر مقفول بس بياناته لسه ناقصة عند جوجل بيتأجّل', () => {
    const periods = buildTasks(M, '2025-08-29')[0].json.__periods.map((p) => p.key);
    equal(periods[periods.length - 1], '2025-07', 'أغسطس لسه ما اكتملش عند جوجل');
  });

  test('أسبوعي: الأسبوع اللي قفل الأحد وبياناته ما وصلتش لسه بيتأجّل', () => {
    // 2025-09-08 اتنين. الأسبوع 01/09→07/09 قفل امبارح بس بيانات جوجل
    // لغاية 05/09 بس — فالأسبوع ده مالوش لازمة دلوقتي.
    const out = buildTasks(W, '2025-09-05');
    const last = out[0].json.__periods[out[0].json.__periods.length - 1];
    assert(last.endDate <= '2025-09-05', `آخر أسبوع لازم يكون مقفول: ${last.endDate}`);
  });

  test('كل طلب معاه taskId فريد', () => {
    const out = buildTasks(M, '2025-09-05');
    const ids = out.map((o) => o.json.taskId);
    equal(new Set(ids).size, ids.length, 'مفيش taskId مكرر');
    assert(out.every((o) => typeof o.json.taskIndex === 'number'));
  });

  test('خانة متأكد منها وقديمة مابتتطلبش تاني لما REFETCH_LAST يقل', () => {
    const history = { monthKeys: ['2020-01'], byRow: {} };
    const withArchive = runNode({
      workflow: M, node: 'Build Tasks',
      nodes: {
        Config: [{ ...CFG, columns: 15, refetchLast: 1 }],
        Keywords: [{ keywords: [KWS[0]] }],
        'Read Sheet': [{ __history: history }],
        'Freshness Guard': [{ latestDataDate: '2025-09-05' }],
      },
      input: [{}],
    });
    equal(withArchive.length, 15, 'من غير أرشيف بيطلب كل حاجة');

    const periods = withArchive[0].json.__periods;
    const byRow = { 'السعودية||كلمة أ': {} };
    periods.slice(0, 14).forEach((p) => {
      byRow['السعودية||كلمة أ'][p.key] = { position: 3, impressions: 10, filled: true };
    });
    const cached = runNode({
      workflow: M, node: 'Build Tasks',
      nodes: {
        Config: [{ ...CFG, columns: 15, refetchLast: 1 }],
        Keywords: [{ keywords: [KWS[0]] }],
        'Read Sheet': [{ __history: { monthKeys: periods.map((p) => p.key), byRow } }],
        'Freshness Guard': [{ latestDataDate: '2025-09-05' }],
      },
      input: [{}],
    });
    equal(cached.length, 1, 'آخر عمود بس هو اللي بيتعاد');
  });
});

// ============================================================ 11) الإيميلات
group('١١) بناء الإيميلات وقايمة المستلمين', () => {
  const runConfig = (emails) => runNode({
    workflow: M, node: 'Config', nodes: { Emails: [emails] }, input: [{}],
  })[0].json;

  test('إيميلات جيميل بتفضل في القايمة زي أي إيميل تاني', () => {
    const c = runConfig({ mailTo_1: 'a@gmail.com', mailTo_2: 'b@rabeh.org', mailCc_1: 'c@gmail.com' });
    equal(c.mailTo, 'a@gmail.com, b@rabeh.org');
    equal(c.mailCc, 'c@gmail.com');
    equal(c.mailAllList.length, 3);
  });

  test('التكرار بين To و CC بيتشال (بعض سيرفرات SMTP بترفضه)', () => {
    const c = runConfig({ mailTo_1: 'a@gmail.com', mailCc_1: 'A@Gmail.com', mailCc_2: 'b@rabeh.org' });
    equal(c.mailCc, 'b@rabeh.org');
  });

  test('إيميل بصيغة غلط بيتشال وبيتسجّل بدل ما يوقّف الإرسال كله', () => {
    const c = runConfig({ mailTo_1: 'a@gmail.com, مش-إيميل, b@rabeh.org' });
    equal(c.mailTo, 'a@gmail.com, b@rabeh.org');
    equal(c.mailInvalid, ['مش-إيميل']);
  });

  test('إيميل التنبيهات التقني = عناوين دومين المُرسِل', () => {
    const c = runConfig({ mailTo_1: 'a@gmail.com', mailCc_1: 'M.gamal@rabeh.org', mailCc_2: 'gm@rabeh.org' });
    equal(c.mailAlert, 'M.gamal@rabeh.org, gm@rabeh.org');
  });

  test('مفيش عنوان على دومين المُرسِل → التنبيه بيروح للمُرسِل نفسه', () => {
    const c = runConfig({ mailTo_1: 'a@gmail.com' });
    equal(c.mailAlert, 'M.gamal@rabeh.org');
  });

  test('اسم المُرسِل بيتحط بصيغة صحيحة', () => {
    const c = runConfig({ mailTo_1: 'a@gmail.com' });
    assert(c.mailFromDisplay.endsWith('<M.gamal@rabeh.org>'), c.mailFromDisplay);
    equal(c.mailReplyTo, 'M.gamal@rabeh.org');
  });
});

// ============================================================ 12) توصيل الإيميل
group('١٢) التأكد من توصيل الإيميل فعلاً', () => {
  const audit = (info, cfg = CFG) => runNode({
    workflow: M, node: 'Delivery Audit',
    nodes: { Config: [cfg], 'Build Email': [{ subject: 'تقرير' }] },
    input: [info],
  });

  test('السيرفر رفض إيميل الجيميل → بيتعاد إرساله لوحده', () => {
    const out = audit({ accepted: ['b@rabeh.org'], rejected: ['a@gmail.com'],
                        response: '550 relay not permitted', messageId: '<1>' });
    equal(out.length, 1);
    equal(out[0].json.recipient, 'a@gmail.com');
    equal(out[0].json.__resend, true);
    assert(out[0].json.smtpResponse.includes('550'));
  });

  test('السيرفر قبل الكل → مفيش إعادة إرسال', () => {
    const out = audit({ accepted: ['a@gmail.com', 'b@rabeh.org'], rejected: [] });
    equal(out.length, 1);
    equal(out[0].json.__resend, false);
  });

  test('مستلم سكت عنه السيرفر (مش في accepted ولا rejected) بيتحسب ناقص', () => {
    const out = audit({ accepted: ['b@rabeh.org'], rejected: [] });
    equal(out[0].json.recipient, 'a@gmail.com');
  });

  test('الإرسال نفسه وقع → كل المستلمين بيتعاد لهم فرديًا مع تنبيه', () => {
    const out = audit({ error: '535 Authentication failed' });
    equal(out.length, 2, 'كل المستلمين محتاجين إعادة');
    assert(out.every((o) => o.json.__resend === true));
    assert(out[0].json.smtpResponse.includes('535'), 'سبب الفشل بيتنقل للتنبيه');
  });

  test('السيرفر مرجّعش قوايم أصلاً → مابنبعتش مرتين', () => {
    const out = audit({ messageId: '<1>', response: '250 OK' });
    equal(out[0].json.__resend, false);
    equal(out[0].json.knowsAccepted, false);
  });

  test('العنوان بصيغة "الاسم <إيميل>" بيتقارن صح', () => {
    const out = audit({ accepted: ['Ali <a@gmail.com>', '<b@rabeh.org>'], rejected: [] });
    equal(out[0].json.__resend, false);
  });

  test('تقرير التوصيل بيقول مين وصله ومين لأ', () => {
    const auditItems = [{ recipient: 'a@gmail.com', expected: ['a@gmail.com', 'b@rabeh.org'],
                          accepted: ['b@rabeh.org'], missing: ['a@gmail.com'],
                          smtpResponse: '550 relay denied', subject: 'تقرير' }];
    const out = runNode({
      workflow: M, node: 'Delivery Report',
      nodes: { Config: [CFG], 'Delivery Audit': auditItems },
      input: [{ error: '550 5.7.1 Relaying denied' }],
    })[0].json;
    equal(out.stillFailing, ['a@gmail.com']);
    assert(out.alertHtml.includes('a@gmail.com'));
    assert(out.alertText.includes('550'));
    assert(out.alertSubject.includes('ما وصلش'));
  });

  test('إعادة الإرسال نجحت → التنبيه بيقول اتصلّح', () => {
    const auditItems = [{ recipient: 'a@gmail.com', expected: ['a@gmail.com'], accepted: [],
                          missing: ['a@gmail.com'], smtpResponse: '', subject: 'تقرير' }];
    const out = runNode({
      workflow: M, node: 'Delivery Report',
      nodes: { Config: [CFG], 'Delivery Audit': auditItems },
      input: [{ accepted: ['a@gmail.com'], rejected: [], response: '250 OK' }],
    })[0].json;
    equal(out.stillFailing, []);
    equal(out.recovered, ['a@gmail.com']);
  });
});

// ============================================================ 13) التقرير
group('١٣) بناء التقرير والسلايدز', () => {
  const merged = () => mergeRun({
    results: ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', (i % 3) + 2, 10 * (i + 1))], { item: i })),
  });
  const validated = () => runNode({ workflow: M, node: 'Validate Data', nodes: { Config: [CFG] }, input: [merged()] })[0].json;

  test('الإيميل بيطلع بنسخة HTML ونسخة نص عادي', () => {
    const v = validated();
    const out = runNode({
      workflow: M, node: 'Build Email',
      nodes: { Config: [CFG], 'Validate Data': [v], 'Search Volume': [{}],
               'Report Stats': [{ up: 1, down: 1, same: 0, avg: 2.5 }] },
      input: [{ up: 1, down: 1, same: 0, avg: 2.5 }],
    })[0].json;
    assert(out.emailHtml.includes('<table'), 'فيه جدول HTML');
    assert(out.emailText.length > 100, 'فيه نسخة نصية حقيقية');
    assert(!out.emailText.includes('<'), 'النسخة النصية من غير HTML');
    assert(out.subject.includes('تقرير SEO الشهري'));
    assert(out.emailHtml.includes('عدد مرات البحث'), 'عمود حجم البحث موجود');
  });

  test('مفيش أي تعليق AI في الإيميل', () => {
    const v = validated();
    const out = runNode({
      workflow: M, node: 'Build Email',
      nodes: { Config: [CFG], 'Validate Data': [v], 'Search Volume': [{}],
               'Report Stats': [{ up: 1, down: 1, same: 0, avg: 0 }] },
      input: [{}],
    })[0].json;
    assert(out.emailHtml.includes('<table'), 'التقرير بيتبني عادي');
    assert(!out.emailHtml.includes('تحية طيبة'), 'مفيش فقرة AI');
  });

  test('Report Stats بيحسب التحسّن والتراجع صح', () => {
    const merged = mergeRun({
      results: ALL_TASKS.map((t, i) => okResponse(
        [gscRow('https://x/p', [9, 5, 3, 2, 4, 8][i], 10)], { item: i })),
    });
    const v = runNode({ workflow: M, node: 'Validate Data', nodes: { Config: [CFG] }, input: [merged] })[0].json;
    const st = runNode({
      workflow: M, node: 'Report Stats',
      nodes: { Config: [CFG], 'Validate Data': [v],
               'Build Slide Batches': [{ slidesInBatch: 2, slidesExpected: 2, batchCount: 1 }],
               'Create Slides': [{ replies: [] }] },
      input: [v],
    })[0].json;
    // كلمة أ: 5 → 3 = تحسّن | كلمة ب: 4 → 8 = تراجع
    equal(st.up, 1);
    equal(st.down, 1);
    assert(st.prompt === undefined, 'مفيش برومبت AI');
  });

  test('حجم البحث من الإكسل بيظهر، والتعديل اليدوي بيكسب', () => {
    const v = validated();
    const build = (sv) => runNode({
      workflow: M, node: 'Build Email',
      nodes: { Config: [CFG], 'Validate Data': [v], 'Search Volume': [sv],
               'Report Stats': [{ up: 0, down: 0, same: 0, avg: 0 }] },
      input: [{}],
    })[0].json.emailHtml;
    assert(build({}).includes('>100<'), 'قيمة الإكسل ظاهرة');
    assert(build({ 'كلمة أ': '999' }).includes('>999<'), 'التعديل اليدوي بيكسب');
  });

  test('السلايدز بتتبني سلايد لكل كلمة وبعنوان صحيح', () => {
    const v = validated();
    const out = runNode({
      workflow: M, node: 'Build Slide Batches',
      nodes: { Config: [CFG], 'Validate Data': [v], 'Search Volume': [{}] },
      input: [v],
    });
    // الكلمتين بيتجمّعوا في call واحد (SLIDES_PER_BATCH = 5)
    equal(out.length, 1, 'call واحد للكلمتين');
    equal(out[0].json.slidesInBatch, 2);
    equal(out[0].json.slidesExpected, 2);
    equal(out[0].json.batchCount, 1);
    const created = out[0].json.requests.filter((r) => r.createSlide);
    equal(created.length, 2, 'سلايد لكل كلمة');
    const ids = created.map((r) => r.createSlide.objectId);
    equal(new Set(ids).size, ids.length, 'الـ objectIds مالهاش تكرار');
    const texts = out[0].json.requests.filter((r) => r.insertText).map((r) => r.insertText.text);
    assert(texts.some((t) => t.includes('كلمة أ')), 'اسم الكلمة في السلايد');
    assert(texts.some((t) => t.includes('عدد مرات البحث')), 'سطر حجم البحث');
  });

  test('خانة فاضية مابتترسمش عمود في السلايد', () => {
    const results = ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 3, 10)], { item: i }));
    results[0] = errResponse('429', { item: 0 });
    const m = mergeRun({ results });
    const v = runNode({ workflow: M, node: 'Validate Data', nodes: { Config: [{ ...CFG, minCoverage: 0, maxHoles: 99 }] }, input: [m] })[0].json;
    const out = runNode({
      workflow: M, node: 'Build Slide Batches',
      nodes: { Config: [CFG], 'Validate Data': [v], 'Search Volume': [{}] },
      input: [v],
    });
    const sid = out[0].json.requests.find((r) => r.createSlide).createSlide.objectId;
    const bars = out[0].json.requests.filter((r) => r.createShape
      && r.createShape.objectId.indexOf(sid + '_b') === 0);
    equal(bars.length, 2, 'عمودين بس — الخانة الفاضية مالهاش عمود');
  });

  test('عرض فاضي (٠ سلايد) مابيوقعش نود الحذف', () => {
    const out = runNode({
      workflow: M, node: 'Build Delete Requests',
      nodes: { Config: [CFG] }, input: [{}],
    })[0].json;
    equal(out.deleteCount, 0);
    equal(out.hasSlides, false);
    equal(out.requests, []);
  });
});

// ============================================================ 14) الأسبوعي
group('١٤) الفروق الخاصة بالتقرير الأسبوعي', () => {
  test('قراءة أعمدة الأسابيع (2025-W36) مش الشهور', () => {
    const r = runNode({
      workflow: W, node: 'Read Sheet', nodes: {},
      input: [{ values: [
        ['Country', 'Section', 'Keyword', 'Page', 'Article', '2025-W35 Pos', '2025-W35 Impr', '2025-08 Pos', '2025-08 Impr'],
        ['السعودية', 'ق1', 'كلمة أ', '', '', 3, 50, 9, 9],
      ] }],
    })[0].json;
    equal(r.__history.monthKeys, ['2025-W35'], 'أعمدة الشهور بتتجاهل في الأسبوعي');
  });

  test('عنوان الإيميل الأسبوعي بيوصف مدى التواريخ', () => {
    const weekMonths = [
      { key: '2025-W34', label: '18/08', caption: '18/08\n↓\n24/08', year: '2025', startDate: '2025-08-18', endDate: '2025-08-24' },
      { key: '2025-W35', label: '25/08', caption: '25/08\n↓\n31/08', year: '2025', startDate: '2025-08-25', endDate: '2025-08-31' },
    ];
    const out = runNode({
      workflow: W, node: 'Build Email',
      nodes: {
        Config: [CFG], 'Search Volume': [{}],
        'Report Stats': [{ up: 0, down: 0, same: 0, avg: 0 }],
        'Validate Data': [{ months: weekMonths, quality: { tally: { holes: 0 } },
          data: [{ country: 'السعودية', section: 'ق1', keyword: 'كلمة أ', sv: 10,
                   positions: [5, 3], impressionsAll: [10, 20], impressions: 20 }] }],
      },
      input: [{}],
    })[0].json;
    assert(out.subject.includes('الأسبوعي'), out.subject);
    assert(out.subject.includes('أسبوع 25 – 31 أغسطس 2025'), out.subject);
  });

  test('السلايد الأسبوعي بيرسم كابشن سطرين + سنة', () => {
    const weekMonths = [
      { key: '2025-W35', label: '25/08', caption: '25/08\n↓\n31/08', year: '2025', startDate: '2025-08-25', endDate: '2025-08-31' },
    ];
    const out = runNode({
      workflow: W, node: 'Build Slide Batches',
      nodes: { Config: [CFG], 'Search Volume': [{}],
        'Validate Data': [{ months: weekMonths,
          data: [{ group: 'ق1', country: 'السعودية', keyword: 'كلمة أ', sv: 10,
                   positions: [4], impressionsAll: [20] }] }] },
      input: [{}],
    });
    const texts = out[0].json.requests.filter((r) => r.insertText).map((r) => r.insertText.text);
    assert(texts.some((t) => t.includes('25/08') && t.includes('31/08')), 'كابشن المدى');
    assert(texts.some((t) => t.includes('2025')), 'السنة تحتيه');
  });
});

// ============================================================ 15) الكلمات الجديدة
group('١٥) قوائم الكلمات المحدّثة من الإكسل', () => {
  const kwOf = (wf) => runNode({ workflow: wf, node: 'Keywords', nodes: {}, input: [{}] })[0].json;

  test('العوجان: ٣٥ كلمة في ٦ أقسام', () => {
    const k = kwOf(M);
    equal(k.keywordCount, 35);
    equal(new Set(k.keywords.map((x) => x.group)).size, 6);
    assert(k.keywords.every((x) => x.keyword && x.group));
  });

  test('شوق: ٢٥ كلمة في ٨ أقسام + روابط للأقسام المعروفة', () => {
    const k = kwOf(S);
    equal(k.keywordCount, 25);
    equal(new Set(k.keywords.map((x) => x.group)).size, 8);
    const home = k.keywords.filter((x) => x.group === 'الصفحة الرئيسية');
    assert(home.every((x) => x.page === 'https://shoug-lawyer.com/'), 'الرئيسية ليها رابط');
  });

  test('الأسبوعي والشهري بنفس قايمة الكلمات', () => {
    equal(kwOf(M).keywords.map((x) => x.keyword), kwOf(W).keywords.map((x) => x.keyword));
  });

  test('حجم البحث من الإكسل موجود مع الكلمات', () => {
    const k = kwOf(M);
    const withSv = k.keywords.filter((x) => x.sv !== '' && x.sv !== null);
    assert(withSv.length >= 15, `المفروض معظم الكلمات ليها حجم بحث، لقينا ${withSv.length}`);
    equal(k.keywords.find((x) => x.keyword === 'الدماغ والحبل الشوكي').sv, 1900);
  });
});

// ============================================================ ١٦) تشخيص فشل GSC
group('١٦) تنبيه فشل الوصول لـ Search Console بيقول السبب', () => {
  const diagnose = (verify, list, cfg = CFG) => runNode({
    workflow: M, node: 'GSC Diagnose',
    nodes: { Config: [cfg], 'Verify GSC Access': [verify] },
    input: [list],
  })[0].json;

  const SITES = { siteEntry: [
    { siteUrl: 'sc-domain:aaalojan.com', permissionLevel: 'siteOwner' },
    { siteUrl: 'https://shoug-lawyer.com/', permissionLevel: 'siteFullUser' },
  ] };

  test('توكن منتهي → يقول اعمل Reconnect ويسمّي الكريدنشيال', () => {
    const d = diagnose({ error: '401 invalid_grant: Token has been expired or revoked.' },
                       { error: '401 invalid_grant' });
    assert(d.diagnosis.cause.includes('انتهت'), d.diagnosis.cause);
    assert(d.diagnosis.action.includes('Reconnect'));
    assert(d.diagnosis.action.includes('rabeh.seven.b'), 'اسم الكريدنشيال في الرسالة');
    // شوق على حساب جوجل تاني — التنبيه بتاعه لازم يسمّي الكريدنشيال بتاعه هو
    const ds = runNode({
      workflow: S, node: 'GSC Diagnose',
      nodes: { Config: [{ ...CFG, siteUrl: 'https://shoug-lawyer.com/' }],
               'Verify GSC Access': [{ error: '401 invalid_grant' }] },
      input: [{ error: '401' }],
    })[0].json;
    assert(ds.diagnosis.action.includes('"Google"'), ds.diagnosis.action);
    assert(!ds.diagnosis.action.includes('rabeh.seven.b'), 'مايسمّيش كريدنشيال العوجان');
    assert(d.alertHtml.includes('invalid_grant'), 'رسالة جوجل الخام موجودة');
  });

  test('الموقع مسجّل كـ Domain Property → يقول غيّر SITE_URL للشكل الصح', () => {
    const d = diagnose({ error: '404 Not Found' }, SITES);
    assert(d.diagnosis.cause.includes('مش مطابق'), d.diagnosis.cause);
    assert(d.diagnosis.action.includes('sc-domain:aaalojan.com'), d.diagnosis.action);
    assert(d.alertHtml.includes('sc-domain:aaalojan.com'), 'الشكل الصح ظاهر في الإيميل');
  });

  test('الحساب مالوش صلاحية على الموقع → يقول ضيفه في Search Console', () => {
    const d = diagnose({ error: '403 forbidden' },
                       { siteEntry: [{ siteUrl: 'https://other.com/', permissionLevel: 'siteOwner' }] });
    assert(d.diagnosis.cause.includes('مش موجود'), d.diagnosis.cause);
    assert(d.diagnosis.action.includes('المستخدمون والأذونات'));
  });

  test('تجاوز حد الاستخدام → يتصنّف مؤقت', () => {
    const d = diagnose({ error: '429 Quota exceeded' }, { error: '429' });
    equal(d.diagnosis.severity, 'temporary');
  });

  test('عطل شبكة → يتصنّف مؤقت ويقول شغّله تاني', () => {
    const d = diagnose({ error: 'ETIMEDOUT' }, { error: 'ETIMEDOUT' });
    equal(d.diagnosis.severity, 'temporary');
    assert(d.diagnosis.action.includes('Manual Trigger'));
  });

  test('التنبيه بيسرد كل المواقع اللي الحساب شايفها', () => {
    const d = diagnose({ error: '404' }, SITES);
    equal(d.diagnosis.sites.length, 2);
    assert(d.alertHtml.includes('shoug-lawyer.com'));
    assert(d.alertText.includes('sc-domain:aaalojan.com'));
  });

  test('التنبيه بيطمّن إن الشيت ما اتلمسش، وبنسخة نصية', () => {
    const d = diagnose({ error: '401' }, { error: '401' });
    assert(d.alertHtml.includes('ما اتلمسوش'));
    assert(d.alertText.includes('ما اتلمسوش'));
    assert(!d.alertText.includes('<div'), 'النسخة النصية من غير HTML');
    assert(d.alertSubject.includes('لم يُرسل'));
  });

  test('المشروعين على حسابين جوجل مختلفين — الخلط بينهم بيطلّع 404', () => {
    // الحالة الحقيقية اللي حصلت: ملفات شوق اتبنت بكريدنشيال العوجان،
    // فالحساب شاف موقع العوجان بس ورجّع 404 لموقع شوق.
    const d = diagnose(
      { error: 'The resource you are requesting could not be found' },
      { siteEntry: [{ siteUrl: 'https://www.aaalojan.com/', permissionLevel: 'siteOwner' }] },
      { ...CFG, siteUrl: 'https://shoug-lawyer.com/' },
    );
    assert(d.diagnosis.cause.includes('مش موجود'), d.diagnosis.cause);
    equal(d.diagnosis.sites.map((s) => s.url), ['https://www.aaalojan.com/']);
    assert(d.alertText.includes('https://shoug-lawyer.com/'), 'بيقول إيه المطلوب');
    assert(d.alertText.includes('https://www.aaalojan.com/'), 'وإيه المتاح');
  });
});

// ====================================== 17) مطابقة أرقام التقرير لواجهة GSC
// الحالة اللي اتبلّغت: التقرير قال «POS 10 / IMP 1» لكلمة «جراح مخ واعصاب»
// على الرئيسية، والواجهة بنفس الكلمة ونفس الرابط بتقول موضع 20.9 وظهور أكتر.
// السبب: الكود القديم كان بياخد "أقل موضع" بين كل صفحات الموقع وظهور الصفحة
// دي لوحدها — يعني رقم صفحة تانية خالص.
group('١٧) الأرقام تطابق واجهة Search Console', () => {
  const HOME = 'https://www.aaalojan.com/';

  // نفس شكل رد جوجل في الحالة الحقيقية: الرئيسية بترتيب ضعيف وظهور معقول،
  // وصفحة داخلية ظهرت مرة واحدة بس بترتيب ممتاز.
  const realRows = [
    gscRow(HOME, 20.9, 12),
    gscRow('https://www.aaalojan.com/blog/article-x', 10, 1),
  ];

  const KW_HOME = [
    { group: 'الرئيسية — كلمات تجارية', page: HOME, keyword: 'كلمة أ', sv: '', article: 'الرئيسية' },
    { group: 'ق1', page: '', keyword: 'كلمة ب', sv: '', article: 'مقال ب' },
  ];

  // Build Tasks بيحمل الرابط مع كل طلب، فلازم الطلبات تتبني من نفس القايمة.
  const HOME_TASKS = [0, 1].flatMap((k) => [0, 1, 2].map((pIdx) => ({
    ...task(k, pIdx), page: KW_HOME[k].page, group: KW_HOME[k].group,
  })));

  const homeRun = (rows) => mergeRun({
    kws: KW_HOME,
    tasks: HOME_TASKS,
    results: HOME_TASKS.map((t, i) => okResponse(rows, { item: i })),
  });

  test('الكلمة ليها رابط الرئيسية → التقرير بيقول رقم الرئيسية (20.9 / 12)', () => {
    const res = homeRun(realRows);
    equal(posOf(res, 0, 0), 20.9, 'موضع الرئيسية مش موضع الصفحة الداخلية');
    equal(res.data[0].impressionsAll[0], 12, 'ظهور الرئيسية');
    equal(res.data[0].scope, 'page');
    equal(res.data[0].matchedPage, HOME);
  });

  test('الرقم القديم الغلط (POS 10 / IMP 1) مابقاش يطلع', () => {
    const res = homeRun(realRows);
    assert(posOf(res, 0, 0) !== 10, 'مش أقل موضع بين الصفحات');
    assert(res.data[0].impressionsAll[0] !== 1, 'مش ظهور صفحة واحدة متقفشة');
  });

  test('كلمة من غير رابط → متوسط موزون ومجموع ظهور، مش أقل موضع', () => {
    const res = homeRun(realRows);
    // (20.9×12 + 10×1) ÷ 13 = 20.06…
    equal(posOf(res, 1, 0), 20.1);
    equal(res.data[1].impressionsAll[0], 13, 'مجموع ظهور كل الصفحات');
    equal(res.data[1].scope, 'site');
  });

  test('الكلمات من غير رابط بتتسجّل كتحذير باسمها', () => {
    const res = homeRun(realRows);
    equal(res.quality.keywordsWithoutPage, ['كلمة ب']);
    const v = runNode({ workflow: M, node: 'Validate Data', nodes: { Config: [CFG] }, input: [res] })[0].json;
    assert(v.warnings.some(w => w.includes('من غير رابط صفحة مستهدفة') && w.includes('كلمة ب')),
           'التحذير بيسمّي الكلمة: ' + JSON.stringify(v.warnings));
  });

  test('صف واحد بس → الموضع زي ما هو من غير تشويه من المتوسط', () => {
    const res = mergeRun({
      results: ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 7.4, 3)], { item: i })),
    });
    equal(posOf(res, 0, 0), 7.4);
    equal(res.data[0].impressionsAll[0], 3);
  });

  test('عدد الصفحات وصل الحد الأقصى → بيتعلّم truncated وبيطلع تحذير', () => {
    const many = [];
    for (let i = 0; i < 4; i++) many.push(gscRow('https://x/p' + i, 5 + i, 2));
    const res = mergeRun({
      cfg: { ...CFG, gscRowLimit: 4 },
      results: ALL_TASKS.map((t, i) => okResponse(many, { item: i })),
    });
    assert(res.quality.requestStats.truncated > 0, 'الحارس اشتغل');
    const v = runNode({ workflow: M, node: 'Validate Data',
                        nodes: { Config: [{ ...CFG, gscRowLimit: 4 }] }, input: [res] })[0].json;
    assert(v.warnings.some(w => w.includes('GSC_ROW_LIMIT')), 'التحذير وصل للإيميل');
  });

  test('عدد الصفحات أقل من الحد → مفيش تحذير قطع', () => {
    const res = mergeRun({
      cfg: { ...CFG, gscRowLimit: 500 },
      results: ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 5, 2)], { item: i })),
    });
    equal(res.quality.requestStats.truncated, 0);
  });

  test('طلب GSC بيتبعت بـ aggregationType=byPage زي الواجهة', () => {
    const wf = JSON.parse(JSON.stringify(loadWorkflow(W)));
    ['GSC Query', 'GSC Retry Query'].forEach((name) => {
      const body = wf.nodes.find(n => n.name === name).parameters.jsonBody;
      assert(body.includes("aggregationType: 'byPage'"), name + ' من غير aggregationType');
      assert(body.includes("dimension: 'query', operator: 'equals'"), name + ': الكلمة لازم exact');
    });
  });

  test('الإيميل بيقول إزاي تراجع الرقم على Search Console', () => {
    const merged = homeRun(realRows);
    const v = runNode({ workflow: M, node: 'Validate Data', nodes: { Config: [CFG] }, input: [merged] })[0].json;
    const out = runNode({
      workflow: M, node: 'Build Email',
      nodes: { Config: [CFG], 'Validate Data': [v], 'Search Volume': [{}],
               'Report Stats': [{ up: 0, down: 0, same: 0, avg: 0 }] },
      input: [{}],
    })[0].json;
    assert(out.emailHtml.includes('Exact query'), 'بيقول الفلتر بالحرف');
    assert(out.emailHtml.includes('Exact URL'), 'وبيقول فلتر الصفحة');
    assert(out.emailHtml.includes('السعودية'), 'وبيقول الدولة');
    assert(out.emailText.includes('Search type: Web'), 'وموجود في النسخة النصية');
    assert(!out.emailText.includes('<'), 'النسخة النصية فضلت من غير HTML');
  });

  test('السلايد بيكتب نطاق القياس والصفحة المستهدفة', () => {
    const merged = homeRun(realRows);
    const v = runNode({ workflow: M, node: 'Validate Data', nodes: { Config: [CFG] }, input: [merged] })[0].json;
    const batches = runNode({
      workflow: M, node: 'Build Slide Batches',
      nodes: { Config: [CFG], 'Validate Data': [v], 'Search Volume': [{}] },
      input: [v],
    });
    const all = batches.map(b => b.json.requests.filter(r => r.insertText)
      .map(r => r.insertText.text).join(' | ')).join(' || ');
    assert(all.includes('www.aaalojan.com/'), 'صفحة مستهدفة مكتوبة في السلايد');
    assert(all.includes('نطاق القياس'), 'عنوان السطر موجود');
    assert(all.includes('كل صفحات الموقع للكلمة'), 'الكلمة من غير رابط متعلّمة');
  });
});

// ============================ 18) بناء العرض التقديمي — تكرار objectId
// الحالة اللي اتبلّغت من n8n:
//   400 Invalid requests[0].createSlide: The object ID (s..._0) should be
//       unique among all pages and page elements.
// السبب: الـ objectIds بتتولّد مرة واحدة وبتتحقن في الداتا، وكان على نود
// Create Slides retryOnFail. n8n بيعيد النود كله من العنصر صفر — فأول سلايد
// كان بيتبعت تاني وهو موجود خلاص.
group('١٨) بناء العرض التقديمي — تكرار objectId', () => {
  const many = (n) => ({
    months: PERIODS.map(p => ({ ...p })),
    data: Array.from({ length: n }, (_, i) => ({
      country: 'السعودية', section: 'ق', group: 'ق — السعودية',
      keyword: 'كلمة ' + i, page: '', article: 'a', sv: 10,
      positions: [3, 4, 5], impressionsAll: [1, 2, 3], cellsPos: [3, 4, 5],
      impressions: 3, scope: 'site', matchedPage: '',
    })),
  });
  const batchesOf = (n) => runNode({
    workflow: M, node: 'Build Slide Batches',
    nodes: { Config: [CFG], 'Validate Data': [many(n)], 'Search Volume': [{}] },
    input: [many(n)],
  });

  test('Create Slides من غير retryOnFail — الطلب مش idempotent', () => {
    for (const name of [M, W, S]) {
      const n = loadWorkflow(name).nodes.find(x => x.name === 'Create Slides');
      equal(!!n.retryOnFail, false, name + ': retryOnFail لازم تتقفل');
      equal(n.onError, 'continueRegularOutput', name + ': لازم يكمل بتحذير');
    }
  });

  test('كل objectId في الرن كله فريد — سلايدات وعناصر', () => {
    const ids = [];
    batchesOf(35).forEach(b => b.json.requests.forEach(r => {
      const o = (r.createSlide || r.createShape || r.createLine || {}).objectId;
      if (o) ids.push(o);
    }));
    assert(ids.length > 500, 'فيه عناصر كتير فعلاً: ' + ids.length);
    equal(new Set(ids).size, ids.length, 'مفيش أي objectId مكرر');
  });

  test('٣٥ كلمة → ٧ calls مش ٣٥ (ضغط أقل على كوتة جوجل)', () => {
    const b = batchesOf(35);
    equal(b.length, 7);
    equal(b.map(x => x.json.slidesInBatch), [5, 5, 5, 5, 5, 5, 5]);
    equal(b[0].json.slidesExpected, 35);
    equal(b[0].json.batchCount, 7);
  });

  test('عدد غير قابل للقسمة → آخر call بيشيل الباقي', () => {
    const b = batchesOf(12);
    equal(b.map(x => x.json.slidesInBatch), [5, 5, 2]);
    const created = b.reduce((a, x) => a + x.json.requests.filter(r => r.createSlide).length, 0);
    equal(created, 12, 'كل الكلمات ليها سلايد');
  });

  test('كل call فيه presentationId ومقاسه معقول', () => {
    batchesOf(35).forEach((b, i) => {
      equal(b.json.presentationId, CFG.presentationId, 'call ' + i);
      const kb = JSON.stringify({ requests: b.json.requests }).length / 1024;
      assert(kb < 1024, 'call ' + i + ' حجمه ' + kb.toFixed(0) + 'KB — أكبر من اللازم');
    });
  });

  test('فشل call → الإيميل بيقول العرض ما اكتملش والأرقام فضلت صح', () => {
    const v = runNode({ workflow: M, node: 'Validate Data', nodes: { Config: [CFG] },
                        input: [mergeRun({ results: ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 3, 10)], { item: i })) })] })[0].json;
    const st = runNode({
      workflow: M, node: 'Report Stats',
      nodes: { Config: [CFG], 'Validate Data': [v],
               'Build Slide Batches': [{ slidesInBatch: 5, slidesExpected: 10, batchCount: 2 },
                                       { slidesInBatch: 5, slidesExpected: 10, batchCount: 2 }],
               'Create Slides': [{ replies: [] }, { error: '429 Quota exceeded' }] },
      input: [v],
    })[0].json;
    equal(st.slidesOk, false);
    equal(st.slidesDone, 5);
    equal(st.slidesExpected, 10);
    assert(st.slideErrors[0].includes('429'), 'السبب الحقيقي متسجّل');

    const out = runNode({
      workflow: M, node: 'Build Email',
      nodes: { Config: [CFG], 'Validate Data': [v], 'Search Volume': [{}], 'Report Stats': [st] },
      input: [st],
    })[0].json;
    assert(out.emailHtml.includes('العرض التقديمي ما اكتملش'), 'التحذير في الـ HTML');
    assert(out.emailHtml.includes('5 سلايد من 10'), 'بيقول اتبنى كام من كام');
    assert(out.emailText.includes('429'), 'السبب في النسخة النصية');
    assert(out.emailHtml.includes('<table'), 'الجدول والأرقام فضلوا زي ما هما');
    assert(!out.emailText.includes('<'), 'النسخة النصية من غير HTML');
  });

  test('كل الـ calls نجحت → مفيش تحذير عرض في الإيميل', () => {
    const v = runNode({ workflow: M, node: 'Validate Data', nodes: { Config: [CFG] },
                        input: [mergeRun({ results: ALL_TASKS.map((t, i) => okResponse([gscRow('https://x/p', 3, 10)], { item: i })) })] })[0].json;
    const st = runNode({
      workflow: M, node: 'Report Stats',
      nodes: { Config: [CFG], 'Validate Data': [v],
               'Build Slide Batches': [{ slidesInBatch: 2, slidesExpected: 2, batchCount: 1 }],
               'Create Slides': [{ replies: [] }] },
      input: [v],
    })[0].json;
    equal(st.slidesOk, true);
    const out = runNode({
      workflow: M, node: 'Build Email',
      nodes: { Config: [CFG], 'Validate Data': [v], 'Search Volume': [{}], 'Report Stats': [st] },
      input: [st],
    })[0].json;
    assert(!out.emailHtml.includes('ما اكتملش'), 'مفيش تحذير من غير سبب');
  });
});

process.exit(summary());
