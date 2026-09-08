#!/usr/bin/env node
/* =============================================================
 * اختبارات الأرقام — كل حالة بنعرف إجابتها الصح مقدّمًا.
 * صفر نداءات شبكة، صفر إيميلات.
 *   node alojan/tools/test.mjs
 * ============================================================= */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGET, SITE_WIDE_POSITION, SITE_WIDE_IMPRESSIONS } from './fixtures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const T = (label, cond, extra) => {
  if (cond) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.log('  ❌ ' + label + (extra !== undefined ? '\n       → ' + extra : '')); }
};
const head = (t) => console.log('\n' + t);

/* المحاكي بيتنفّذ في عملية منفصلة ويرجّع الحالة كاملة كـ JSON */
function run(cadence, scenario) {
  const code = `
    process.argv.push('--cadence=${cadence}', '--scenario=${scenario}', '--quiet');
    const m = await import(${JSON.stringify(path.join(ROOT, 'tools', 'simulate.mjs'))});
    const r = m.result;
    const pick = (n) => (r.runs[n] || []).map(x => x.json);
    process.stdout.write(JSON.stringify({
      trace: r.trace.map(t => t.node),
      httpCalls: r.httpCalls,
      mailSent: r.mailSent,
      merge:    pick('Merge History')[0]   || null,
      validate: pick('Validate Data')[0]   || null,
      stats:    pick('Report Stats')[0]    || null,
      email:    pick('Build Email')[0]     || null,
      audit:    pick('Delivery Audit')     || [],
      delivery: pick('Delivery Report')[0] || null,
      diagnose: pick('GSC Diagnose')[0]    || null,
      keywords: pick('Keywords')[0]        || null,
    }));
  `;
  const out = execFileSync('node', ['--input-type=module', '-e', code],
    { encoding: 'utf8', cwd: ROOT, maxBuffer: 1 << 28 });
  return JSON.parse(out);
}

/* ══════════ قائمة الكلمات ══════════ */
head('قائمة الكلمات — قاعدة «مفيش رابط يبقى مفيش صف»');
{
  const r = run('monthly', 'happy');
  const k = r.keywords;
  T('كل كلمة في التقرير ليها رابط صفحة',
    k.keywords.every((x) => x.page && /^https?:\/\//.test(x.page)),
    JSON.stringify(k.keywords.filter((x) => !x.page).map((x) => x.keyword)));
  T('الكلمات اللي مالهاش رابط اتشالت من الحساب', k.excludedCount === 8, k.excludedCount);
  T('لكن اتسجّلت بالاسم عشان متتنسيش',
    k.excluded.length === 8 && k.excluded.every((e) => e.keyword), JSON.stringify(k.excluded[0]));
  T('التقرير الأسبوعي على نفس القائمة بالحرف',
    JSON.stringify(run('weekly', 'happy').keywords.keywords) === JSON.stringify(k.keywords));
}

/* ══════════ الحساب اللي كان بيطلع غلط ══════════ */
head('حساب الموضع والظهور — الحالة اللي كانت بتطلّع «POS 10 / IMP 1»');
for (const cadence of ['monthly', 'weekly']) {
  const r = run(cadence, 'threePages');
  const row = r.merge.data[0];
  const li = row.positions.length - 1;
  T(cadence + ': الموضع = رقم الصفحة المستهدفة (20.9) مش أحسن صفحة (10)',
    row.positions[li] === 20.9, row.positions[li]);
  T(cadence + ': الظهور = ظهور الصفحة المستهدفة (144) مش (1)',
    row.impressionsAll[li] === 144, row.impressionsAll[li]);
  T(cadence + ': الرقم متعلّم إنه على مستوى الصفحة',
    row.scope === 'page', row.scope);
}

head('نفس البيانات → نفس الرقم في التقريرين');
{
  const m = run('monthly', 'threePages').merge.data;
  const w = run('weekly', 'threePages').merge.data;
  const lastOf = (d) => d.positions[d.positions.length - 1];
  const same = m.every((row, i) => lastOf(row) === lastOf(w[i]) &&
    row.impressionsAll[row.impressionsAll.length - 1] === w[i].impressionsAll[w[i].impressionsAll.length - 1]);
  T('كل كلمة بتدي نفس الموضع ونفس الظهور في الشهري والأسبوعي', same);
}

/* ══════════ الصفحة المستهدفة مش ظاهرة ══════════ */
head('الصفحة المستهدفة مش ظاهرة — ممنوع نطلّع رقم صفحة تانية');
for (const cadence of ['monthly', 'weekly']) {
  const r = run(cadence, 'pageMissing');
  const row = r.merge.data[0];
  const li = row.positions.length - 1;
  T(cadence + ': الخانة "مفيش ظهور" مش رقم صفحة تانية',
    row.positions[li] === null && row.cellsPos[li] === '-', JSON.stringify([row.positions[li], row.cellsPos[li]]));
  T(cadence + ': الظهور صفر', row.impressionsAll[li] === 0, row.impressionsAll[li]);
}

/* ══════════ الفرق بين "فشل السحب" و"اختفت" ══════════ */
head('فشل السحب ≠ الكلمة اختفت');
{
  const r = run('monthly', 'fetchFailure');
  const t = r.merge.quality.tally;
  T('الخانات اللي فشل سحبها اتعلّمت holes مش no-data', t.holes > 0 && t.noData === 0,
    JSON.stringify(t));
  T('بوابة الجودة وقفت الرن', r.validate.ok === false, JSON.stringify(r.validate.problems));
  T('الشيت ما اتكتبش', !r.trace.includes('Write To Sheet'));
  T('العرض التقديمي ما اتلمسش', !r.trace.includes('Create Slides'));
  T('اتبعت تنبيه بدل التقرير',
    r.mailSent.length === 1 && r.mailSent[0].node === 'Data Alert Email',
    JSON.stringify(r.mailSent.map((m) => m.node)));
  T('ولا كلمة اتقالت "اختفت"', !r.stats, 'Report Stats المفروض ماتشتغلش أصلًا');
}

/* ══════════ حارس اتقصاص الرد ══════════ */
head('حارس اتقصاص رد جوجل');
{
  const r = run('monthly', 'truncated');
  T('اتعلّم إن فيه صفحات اتقصّت', r.merge.quality.requestStats.truncated > 0,
    r.merge.quality.requestStats.truncated);
  T('والتحذير وصل للتقرير',
    (r.validate.warnings || []).some((w) => /اتقصّت|الحد الأقصى/.test(w)),
    JSON.stringify(r.validate.warnings));
}

/* ══════════ التحقق: كل رقم قابل للمراجعة ══════════ */
head('بلوك «راجع الرقم بنفسك» في الإيميل');
for (const cadence of ['monthly', 'weekly']) {
  const r = run(cadence, 'happy');
  const html = r.email.emailHtml, text = r.email.emailText;
  T(cadence + ': الإيميل فيه خطوات المراجعة على Search Console',
    /تراجع أي رقم بنفسك/.test(html));
  T(cadence + ': بيقول المدى الزمني بالظبط', /Date: Custom/.test(text));
  T(cadence + ': بيقول فلتر الدولة', /Country:/.test(text));
  T(cadence + ': بيقول فلتر الصفحة', /Page: Exact URL/.test(text));
  T(cadence + ': الكلمات المستبعدة مذكورة بالاسم', /كلمات خارج التقرير \(8\)/.test(text));
}

/* ══════════ لا صلاحية ══════════ */
head('مفيش صلاحية على الموقع');
{
  const r = run('monthly', 'noAccess');
  T('الرن وقف قبل أي سحب', r.httpCalls.gsc === 0, r.httpCalls.gsc);
  T('اتبعت تشخيص', r.mailSent.some((m) => m.node === 'GSC Alert Email'),
    JSON.stringify(r.mailSent.map((m) => m.node)));
  T('الشيت ما اتلمسش', !r.trace.includes('Write To Sheet'));
}

console.log('\n' + (fail ? '❌ ' : '✅ ') + pass + ' نجح، ' + fail + ' فشل.\n');
process.exit(fail ? 1 : 0);
