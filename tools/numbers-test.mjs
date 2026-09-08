#!/usr/bin/env node
/* =============================================================
 * اختبار وحدة لمختبر الأرقام: كل طبقة على حدة.
 * لا يلمس الشبكة ولا يستهلك أي نداء API.
 *   node tools/numbers-test.mjs
 * ============================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const helpers = fs.readFileSync(path.join(ROOT, 'src/lib/helpers.js'), 'utf8');
const numbers = fs.readFileSync(path.join(ROOT, 'src/lib/numbers.js'), 'utf8');
const { H } = new Function(helpers + '\n' + numbers + '\nreturn { H };')();
const N = H.N;

let pass = 0, fail = 0;
const T = (label, cond, extra) => {
  if (cond) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.log('  ❌ ' + label + (extra ? '\n       → ' + extra : '')); }
};
const head = (t) => console.log('\n' + t);

/* ══════════ L0 — التطبيع ══════════ */
head('L0 · التطبيع');
T('الأرقام العربية تُقرأ', N.digits('٢٧٪') === '27٪');
T('الأرقام الفارسية تُقرأ', N.digits('۹۹') === '99');
T('الفاصلة العشرية العربية', N.normalize('٩٩٫٥') === '99.5');
T('علامة النسبة العربية', N.normalize('٢٧٪') === '27%');
T('التطبيع لا يغيّر طول النص', N.normalize('٩٩٫٥٪ نمو').length === '٩٩٫٥٪ نمو'.length);
T('الحجب لا يغيّر طول النص', N.mask('انظر [هنا](https://x.com/a/12345) الآن').length === 'انظر [هنا](https://x.com/a/12345) الآن'.length);

/* ══════════ L1 — الاستخراج ══════════ */
head('L1 · الاستخراج والوحدات');
const u = (t) => { const k = N.scan(t); return k[0] || {}; };
T('نسبة مئوية', u('ارتفع بنسبة 27% هذا العام').unit === 'percent');
T('نسبة بالعربية', u('ارتفع بنسبة 27 في المائة').unit === 'percent', JSON.stringify(u('ارتفع بنسبة 27 في المائة')));
T('عملة بعدية', u('التكلفة 500 ريال شهريًا').currency === 'SAR');
T('عملة قبلية', u('التكلفة $500 شهريًا').currency === 'USD');
T('مقياس مليون', u('وصل إلى 3 ملايين مستخدم').effective === 3e6);
T('مقياس + عملة', (() => { const k = u('بميزانية 5 ملايين ريال'); return k.effective === 5e6 && k.currency === 'SAR'; })());
T('فاصلة الآلاف', u('بلغ 1,250,000 زيارة').value === 1250000);
T('سنة', u('في عام 2024 أعلنت جوجل').unit === 'year');
T('مدة', u('خلال 6 أشهر فقط').unit === 'duration');
T('مضاعف', u('تضاعف 3 أضعاف').unit === 'multiplier');
T('روابط لا تُحسب أرقامًا', N.scan('[دليل](https://x.com/answer/10724817)').length === 0);
T('الأكواد لا تُحسب أرقامًا', N.scan('استخدم `utm_id=99999`').length === 0);
T('لا يلتقط جزءًا من كلمة', N.scan('النسخة v4.2 من الأداة').length === 0);
T('ترقيم القائمة يُعرف', N.scan('1. الخطوة الأولى')[0].role === 'list_marker');
T('العدّ الذاتي يُعرف', N.scan('نستعرض 5 خطوات عملية')[0].role === 'enumeration');
T('رقم داخل عنوان لا يُعامل كترقيم', N.scan('## أفضل 7 طرق')[0].role === 'heading');
T('نسبة داخل عنوان تبقى ادعاءً', N.scan('## زيادة 40% في التحويلات')[0].role === 'stat');
T('القسم يُنسب للعنوان', (() => {
  const k = N.scan('# ع\n\n## قسم التكلفة\n\nالمتوسط 27% تقريبًا.');
  return k[0].section === 'قسم التكلفة';
})());

/* ══════════ L4 — المطابقة ══════════ */
head('L4 · المطابقة مع المصدر');
T('تطابق حرفي', N.sameValue(27, 27, {}) === 'exact');
T('تقريب مشروع', N.sameValue(27, 27.4, { allow_rounding: true }) === 'rounded');
T('لا تقريب لقيمة بعيدة', N.sameValue(27, 34, { allow_rounding: true }) === null);
T('قلب الأرقام يُرفض', N.sameValue(34, 43, { allow_rounding: true }) === null);
T('التسامح المطلق عند تفعيله', N.sameValue(27, 27.9, { allow_rounding: false, abs_tolerance: 1 }) === 'within_tolerance');

/* ══════════ L2→L5 — التدقيق الكامل ══════════ */
const EV = [
  { id: 'E1', publisher: 'Google Ads Help', page_title: 'About Performance Max',
    url: 'https://support.google.com/google-ads/answer/10724817',
    figure: '27%', arabic_sentence: 'زيادة متوسطها 27% في التحويلات.' },
  { id: 'E2', publisher: 'DataReportal', page_title: 'Digital 2026: Saudi Arabia',
    url: 'https://datareportal.com/reports/digital-2026-saudi-arabia',
    figure: '99.0%', arabic_sentence: 'انتشار الإنترنت 99.0%.' }
];
const CFG = { brand: { founded: 2014, name: 'رابح', proof_points: [] }, numbers: {} };
const mkState = (article) => ({
  article: article,
  brief: { title: 'دليل إعلانات جوجل', notes: '', goal: '', headings: [], mandatory_citations: [], secondary_keywords: [], primary_keyword: 'اعلانات جوجل' },
  evidence: { approved: EV }
});
const audit = (article) => N.auditArticle(mkState(article), CFG);
const codes = (r) => r.findings.map((f) => f.code);

head('L3/L4 · عهدة الأرقام');
const good = `# دليل

## المميزات

سجّل المعلنون زيادة متوسطها 27% في التحويلات بحسب [Google Ads Help](https://support.google.com/google-ads/answer/10724817).

## المصادر المستخدمة

- Google Ads Help — «About Performance Max»: https://support.google.com/google-ads/answer/10724817 — المعلومة المستخدمة: 27%.`;
let r = audit(good);
T('الرقم الصحيح المستشهد به يمر', r.pass && r.high === 0, JSON.stringify(codes(r)));
T('يُحسب ضمن المتحقق منه', r.verified_count === 1, JSON.stringify(r.verified));

r = audit(good.replace('27% في التحويلات', '72% في التحويلات'));
T('قلب رقمين يُكشف كـ value_mismatch', codes(r).includes('value_mismatch'), JSON.stringify(codes(r)));
T('ويوقف التسليم', r.pass === false);

r = audit(good.replace('27%', '٢٧٪'));
T('نفس الرقم بالأرقام العربية يمر', r.pass && r.verified_count === 1, JSON.stringify(codes(r)));

r = audit(`# د\n\n## المميزات\n\nترتفع التحويلات بنسبة 63% مع الحملات الذكية.`);
T('رقم بلا أي مصدر يُكشف كـ orphan', codes(r).includes('orphan_number'), JSON.stringify(codes(r)));

r = audit(`# د\n\n## المميزات\n\nترتفع التحويلات بنسبة 27% مع الحملات الذكية.`);
T('رقم صحيح بلا استشهاد بجواره يُكشف كـ uncited_inline', codes(r).includes('uncited_inline'), JSON.stringify(codes(r)));

head('L5 · الاتساق والسلامة');
r = audit(`# د\n\n## ن\n\nحققت الحملة نسبة نجاح 140% من الأهداف.`);
T('نسبة مستحيلة تُكشف', codes(r).includes('impossible_percent'), JSON.stringify(codes(r)));

r = audit(`# د\n\n## ن\n\nسجّلت زيادة 140% في المبيعات بحسب التقرير.`);
T('نسبة نمو فوق 100% مسموحة', !codes(r).includes('impossible_percent'), JSON.stringify(codes(r)));

r = audit(`# د\n\n## ن\n\nتتراوح التكلفة من 90 ريالًا إلى 40 ريالًا للنقرة.`);
T('نطاق مقلوب يُكشف', codes(r).includes('inverted_range'), JSON.stringify(codes(r)));

r = audit(`# د\n\n## أ\n\nسجّل المعلنون زيادة متوسطها 27% في التحويلات.\n\n## ب\n\nسجّل المعلنون زيادة متوسطها 34% في التحويلات.`);
T('نفس الادعاء بقيمتين يُكشف كتناقض', codes(r).includes('contradiction'), JSON.stringify(codes(r)));

r = audit(`# د\n\n## ن\n\nستبلغ الحصة 45% في عام 2099 بحسب التقديرات.`);
T('سنة مستقبلية تُكشف', codes(r).includes('future_year'), JSON.stringify(codes(r)));

r = audit(`# د\n\n## ن\n\nتأسست رابح عام 2014 وتعمل في ثلاثة أسواق.`);
T('أرقام هوية العلامة معفاة', !codes(r).includes('orphan_number'), JSON.stringify(codes(r)));

r = audit(`# د\n\n## ن\n\nنستعرض هنا 6 خطوات عملية:\n\n1. اضبط الحساب.\n2. اختر الكلمات.`);
T('العدّ الذاتي وترقيم القوائم معفاة', r.findings.length === 0, JSON.stringify(codes(r)));

/* ══════════ L6 — مصالحة التقرير ══════════ */
head('L6 · مصالحة أرقام التقرير');
const rec = N.recon([
  { id: 'words', label: 'عدد الكلمات', expected: 1850, actual: 1850 },
  { id: 'faq', label: 'أسئلة FAQ', expected: 5, actual: 4 }
]);
T('المطابق يمر', rec.find((x) => x.id === 'words').ok === true);
T('المختلف يُرصد', rec.find((x) => x.id === 'faq').ok === false);

const bag = N.allowedValues(['عدد الكلمات 1850', 27, 'نسبة 99.0%']);
T('القيم المعتمدة تُجمع', bag['1850'] && bag['27'] && bag['99']);
const orph = N.orphansInReport('الدرجة 9/10 والمقال 1850 كلمة وحقق نموًا 45% غير موثق.', bag);
T('رقم دخيل في التقرير يُكشف', orph.some((o) => o.raw === '45'), JSON.stringify(orph));
T('الأرقام المعتمدة لا تُبلَّغ', !orph.some((o) => o.raw === '1850'), JSON.stringify(orph));

console.log('\n' + (fail ? '❌ ' : '✅ ') + pass + ' نجحت، ' + fail + ' فشلت.\n');
process.exit(fail ? 1 : 0);
