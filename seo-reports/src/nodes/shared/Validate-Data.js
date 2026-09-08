// بوابة جودة البيانات — آخر خط دفاع قبل ما نلمس الشيت أو نبني التقرير.
//
// بتقرر: نكمل ولا نوقف؟ وبتبني كمان مصفوفة القيم اللي هتتكتب في الشيت
// مبطّنة لآخر مقاس كان للشيت، عشان أي أعمدة/صفوف قديمة زايدة تتمسح ومايفضلش
// في الشيت بقايا من قايمة كلمات قديمة.
const cfg = $('Config').first().json;
const res = $input.first().json;
const q   = res.quality || {};

const problems = [];   // أسباب توقف الرن
const warnings = [];   // ملاحظات بتوصل في الإيميل ومابتوقفش الرن

// --- 1) الشيت نفسه ---
if (q.sheetError) {
  problems.push('مقدرناش نقرا الشيت: ' + q.sheetError +
                ' — الكتابة اتوقفت عشان ما نمسحش الأرشيف.');
}

// --- 2) سلامة الربط بين الطلبات والردود ---
const p1 = q.pairing && q.pairing.pass1;
if (p1 && p1.strict) {
  warnings.push('عدد ردود جوجل (' + p1.results + ') مش مساوي عدد الطلبات (' +
                p1.tasks + ') — اتعامل معاها بالربط المؤكد (pairedItem).');
}
if (p1 && p1.unpaired > 0) {
  warnings.push(p1.unpaired + ' رد من جوجل مقدرناش نربطه بطلبه واتجاهل.');
}

// --- 3) التغطية ---
const coverage = Number(q.coverage || 0);
const holes    = Number((q.tally || {}).holes || 0);
const minCov   = Number(cfg.minCoverage);
if (!q.noFetch && coverage < minCov) {
  problems.push('نسبة الخانات المكتملة ' + Math.round(coverage * 1000) / 10 +
                '% وأقل حد مسموح ' + Math.round(minCov * 1000) / 10 + '%.');
}
if (!q.noFetch && holes > Number(cfg.maxHoles)) {
  problems.push('عدد الخانات الفاضية ' + holes + ' وأقصى حد مسموح ' + cfg.maxHoles + '.');
}

// --- 4) أعمدة التقرير ---
const months = res.months || [];
if (!months.length) problems.push('مفيش ولا عمود في التقرير.');
if (months.length < Number(cfg.columns)) {
  warnings.push('التقرير فيه ' + months.length + ' عمود بس بدل ' + cfg.columns +
                ' — عادي لو الشيت لسه جديد أو بيانات جوجل ناقصة.');
}

// --- 5) صحة الأرقام نفسها ---
const badNumbers = [];
(res.data || []).forEach(d => {
  d.positions.forEach((p, i) => {
    if (p === null) return;
    if (!(p > 0) || p > 1000 || !isFinite(p)) {
      badNumbers.push(d.keyword + ' / ' + ((months[i] || {}).key || i) + ' = ' + p);
    }
  });
  (d.impressionsAll || []).forEach((v, i) => {
    if (v !== '' && (!isFinite(v) || v < 0)) {
      badNumbers.push(d.keyword + ' / ظهور ' + ((months[i] || {}).key || i) + ' = ' + v);
    }
  });
});
if (badNumbers.length) {
  problems.push('فيه ' + badNumbers.length + ' رقم خارج المدى المنطقي: ' +
                badNumbers.slice(0, 5).join(' | '));
}

// --- 6) عدد الصفوف ---
/* عدد الصفوف المتوقع بيتبع نفس قاعدة التوزيع: كل كلمة في كل دولة، ولا صف واحد
 * لكل كلمة لو القائمة نفسها بتحدد دولة كل كلمة (زي رابح: سوقين بكلمات مختلفة). */
const expectedRows = q.perKeywordCountry
  ? Number(q.keywordCount || 0)
  : (cfg.countries || []).length * Number(q.keywordCount || 0);
if ((res.data || []).length !== expectedRows) {
  problems.push('عدد صفوف التقرير ' + (res.data || []).length +
                ' والمتوقع ' + expectedRows + '.');
}

// --- 7) ملاحظات مش موقّفة ---
if ((q.tally || {}).keptArchive > 0) {
  warnings.push((q.tally.keptArchive) + ' خانة قديمة رجعت من جوجل "مفيش ظهور" ' +
                'رغم إن الأرشيف فيها رقم — مسكنا رقم الأرشيف لأن بيانات الشهور ' +
                'المقفولة مابتتغيرش.');
}
if ((q.pageMisses || []).length) {
  warnings.push((q.pageMisses.length) + ' خانة الصفحة المستهدفة فيها مكانتش ظاهرة، ' +
                'فالرقم اتحسب على مستوى الموقع كله للكلمة (زي فلتر الكلمة لوحدها ' +
                'في واجهة Search Console) — مش من صفحة تانية.');
}
// --- فحص الروابط الفعلي (نود Check Target Pages) ---
// ده بيمسك الرابط اللي بيعمل تحويل أو مكسور **قبل** ما جوجل يتسأل عنه أصلًا.
let pageCheck = { problems: [], tally: {}, networkBlocked: false, checked: 0 };
try { pageCheck = $('Page Check Report').first().json.pageCheck || pageCheck; } catch (e) { /* نود مش موجود */ }
if (pageCheck.networkBlocked) {
  warnings.push('مقدرناش نفحص روابط الصفحات من السيرفر (كل الطلبات اترفضت) — ' +
                'النتيجة اتجاهلت بدل ما نعلن روابط سليمة "مكسورة". راجع خروج n8n للإنترنت.');
} else if ((pageCheck.problems || []).length) {
  const byVerdict = {};
  pageCheck.problems.forEach(function (x) { (byVerdict[x.verdict] = byVerdict[x.verdict] || []).push(x); });
  const label = { redirected: 'بيعمل تحويل', canonical: 'كانوني مختلف',
                  broken: 'مكسور', 'server-error': 'خطأ سيرفر', unreachable: 'مش راجع' };
  Object.keys(byVerdict).forEach(function (v) {
    const list = byVerdict[v];
    warnings.push(list.length + ' رابط ' + (label[v] || v) + ' — فلتر الصفحة في Search Console ' +
      'مش هيطابقه فالخانة هتطلع "مفيش ظهور" وهي غلط. ' +
      list.slice(0, 4).map(function (x) { return x.keyword + ' → ' + (x.suggested || x.note); }).join(' | ') +
      (list.length > 4 ? ' …' : ''));
  });
}

// --- شهادة الروابط من جوجل نفسه: رابط غلط بيطلّع "مفيش ظهور" لصفحة شغالة ---
// دي مش ملاحظة تجميلية: الكلمة اللي ليها ترتيب بصفحات تانية والصفحة
// المستهدفة ما ظهرتش ولا مرة في كل الفترات معناها إن الرابط اللي عندنا
// مش الرابط اللي جوجل بيسجّله. الرقم اللي بيتبعت للعميل ساعتها '-' وهو غلط.
const pa = q.pageAudit || {};
const suspect = pa.suspect || [];
if (suspect.length) {
  warnings.push(suspect.length + ' كلمة صفحتها المستهدفة ما ظهرتش عند جوجل ولا مرة ' +
    'رغم إن الكلمة نفسها ليها ترتيب بصفحات تانية — يعني الرابط في ملف الكلمات ' +
    'غالبًا مش الرابط الكانوني اللي جوجل مسجّله، والخانة بتطلع "مفيش ظهور" وهي غلط. ' +
    'راجع: ' + suspect.slice(0, 6).map(function (x) {
      const sample = (x.samples || [])[0];
      return x.keyword + (x.country ? ' [' + x.country + ']' : '') +
             (sample ? ' (جوجل شايف: ' + sample.topPage + ')' : '');
    }).join(' | ') + (suspect.length > 6 ? ' …' : ''));
}
if ((pa.notRanking || []).length) {
  warnings.push((pa.notRanking || []).length + ' كلمة مالهاش ولا ظهور واحد في أي فترة — ' +
    'الرقم "مفيش ظهور" صح فيها، الصفحة لسه ما دخلتش نتائج البحث.');
}

const noPage = q.keywordsWithoutPage || [];
if (noPage.length) {
  warnings.push(noPage.length + ' كلمة من غير رابط صفحة مستهدفة، فأرقامها على مستوى ' +
                'الموقع كله. لو عايز الرقم يطابق فلتر Query + Page في الواجهة، حط ' +
                'الرابط في ملف الإكسل وأعِد التوليد: ' +
                noPage.slice(0, 8).join(' | ') + (noPage.length > 8 ? ' …' : ''));
}
if ((q.requestStats || {}).truncated > 0) {
  warnings.push(q.requestStats.truncated + ' كلمة رجع فيها عدد صفحات على الحد الأقصى (' +
                cfg.gscRowLimit + ') — يعني فيه صفحات اتقصّت ومجموع الظهور ناقص. ' +
                'ارفع GSC_ROW_LIMIT.');
}
if ((q.invalidEmails || []).length) {
  warnings.push('إيميلات بصيغة غلط واتجاهلت: ' + q.invalidEmails.join(', '));
}
if (q.freshnessSource !== 'gsc') {
  warnings.push('مقدرناش نسأل جوجل عن آخر يوم فيه بيانات، فاستخدمنا LAG_DAYS الاحتياطي.');
}

// --- 8) بناء قيم الشيت مبطّنة لآخر مقاس ---
const header = ['Country', 'Section', 'Keyword', 'Page', 'Article']
  .concat((res.allMonths || []).reduce((a, m) => a.concat([m.key + ' Pos', m.key + ' Impr']), []));

const body = (res.sheetRows || []).map(d =>
  [d.country, d.section, d.keyword, d.page, d.article]
    .concat(d.cellsAll.reduce((a, p, i) => a.concat([p, d.imprAll[i]]), [])));

const values = [header].concat(body);
const oldRows = Number((q.extent || {}).rows || 0);
const oldCols = Number((q.extent || {}).cols || 0);
const width   = Math.max(header.length, oldCols);
values.forEach(r => { while (r.length < width) r.push(''); });
while (values.length < oldRows) values.push(new Array(width).fill(''));

const ok = problems.length === 0;

// --- 9) نص التنبيه لو الرن اتوقف ---
const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const li  = arr => arr.map(t => '<li style="margin:0 0 6px 0;">' + esc(t) + '</li>').join('');

const failLines = (q.failures || []).slice(0, 40)
  .map(f => f.keyword + ' — ' + f.period + ' — ' + f.reason);
const failMore = Math.max(0, (q.failures || []).length - failLines.length);

const alertSubject = 'وقفنا تقرير SEO — ' + cfg.company + ' — البيانات مش مكتملة';

const alertText = [
  'الأوتوميشن اشتغل بس البيانات اللي رجعت من Google Search Console مش مكتملة،',
  'فوقفنا قبل ما نكتب على الشيت أو نبني التقرير — عشان ما نطلّعش أرقام ناقصة',
  'وما نمسحش الأرشيف.',
  '',
  'أسباب التوقف:',
].concat(problems.map(t => '- ' + t))
 .concat(warnings.length ? [''].concat(['ملاحظات:']).concat(warnings.map(t => '- ' + t)) : [])
 .concat(['', 'ملخص السحبة: ' +
   'طلبات ' + ((q.requestStats || {}).requested || 0) + ' | ' +
   'رجع بترتيب ' + ((q.requestStats || {}).ranked || 0) + ' | ' +
   'مفيش ظهور ' + ((q.requestStats || {}).noData || 0) + ' | ' +
   'فشل ' + ((q.requestStats || {}).failed || 0)])
 .concat(failLines.length ? ['', 'أول ' + failLines.length + ' خانة فشلت:'].concat(failLines.map(t => '- ' + t)) : [])
 .concat(failMore ? ['... و' + failMore + ' خانة كمان.'] : [])
 .concat(['', 'مفيش أي حاجة اتغيرت في الشيت ولا في العرض التقديمي.',
          'الرن الجاي هيعيد يسحب كل حاجة من أول وجديد.'])
 .join('\n');

const alertHtml =
'<div style="font-family:Calibri,Arial,sans-serif;direction:rtl;text-align:right;background:#f2f1ee;padding:24px;color:#142f38;font-size:14px;">' +
'<div style="max-width:700px;margin:0 auto;background:#ffffff;border:1px solid #d8d6d0;border-radius:10px;padding:22px;">' +
'<h3 style="margin:0 0 12px 0;font-size:16px;">تقرير SEO اتوقف — البيانات مش مكتملة</h3>' +
'<p style="line-height:1.9;margin:0 0 14px 0;">الأوتوميشن اشتغل بس البيانات اللي رجعت من Google Search Console مش مكتملة، ' +
'فوقفنا قبل ما نكتب على الشيت أو نبني التقرير. <b>الشيت والعرض التقديمي ما اتلمسوش خالص.</b></p>' +
'<div style="background:#f2f1ee;border:1px solid #d8d6d0;border-radius:6px;padding:12px 16px;margin-bottom:14px;">' +
'<b>أسباب التوقف</b><ul style="margin:8px 0 0 0;padding-inline-start:18px;line-height:1.8;">' + li(problems) + '</ul></div>' +
(warnings.length ? '<div style="border:1px solid #d8d6d0;border-radius:6px;padding:12px 16px;margin-bottom:14px;">' +
  '<b>ملاحظات</b><ul style="margin:8px 0 0 0;padding-inline-start:18px;line-height:1.8;">' + li(warnings) + '</ul></div>' : '') +
'<p style="margin:0 0 6px 0;"><b>ملخص السحبة:</b> طلبات ' + ((q.requestStats || {}).requested || 0) +
' • رجع بترتيب ' + ((q.requestStats || {}).ranked || 0) +
' • مفيش ظهور ' + ((q.requestStats || {}).noData || 0) +
' • فشل ' + ((q.requestStats || {}).failed || 0) + '</p>' +
'<p style="margin:0 0 14px 0;"><b>آخر يوم فيه بيانات عند جوجل:</b> ' + esc(q.latestDataDate || '—') + '</p>' +
(failLines.length ? '<div style="border:1px solid #d8d6d0;border-radius:6px;padding:12px 16px;">' +
  '<b>أول ' + failLines.length + ' خانة فشلت</b><ul style="margin:8px 0 0 0;padding-inline-start:18px;line-height:1.7;">' +
  li(failLines) + '</ul>' + (failMore ? '<div style="margin-top:6px;">… و' + failMore + ' خانة كمان.</div>' : '') + '</div>' : '') +
'<p style="margin:14px 0 0 0;line-height:1.9;">الرن الجاي هيعيد يسحب كل حاجة من أول وجديد. ' +
'لو المشكلة اتكررت، راجع صلاحية حساب جوجل المربوط بالأوتوميشن وحدود الاستخدام (Quota).</p>' +
'</div></div>';

return [{ json: {
  ok,
  problems, warnings,
  sheetValues: values,
  sheetRange: cfg.sheetTab + '!A1',
  writtenRows: values.length, writtenCols: width,
  quality: q,
  pageCheck: pageCheck,
  months, data: res.data, allMonths: res.allMonths, lastMonth: res.lastMonth,
  alertSubject, alertHtml, alertText,
  summaryLine: 'تغطية ' + Math.round(coverage * 1000) / 10 + '% • ' +
               'مسحوب: ' + ((q.tally || {}).ranked || 0) + ' • ' +
               'مفيش ظهور: ' + ((q.tally || {}).noData || 0) + ' • ' +
               'من الأرشيف: ' + (((q.tally || {}).fromArchive || 0) + ((q.tally || {}).archiveOnly || 0)) + ' • ' +
               'فاضية: ' + holes,
} }];
