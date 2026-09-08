#!/usr/bin/env node
/* =============================================================
 * اختبارات الأرقام — كل حالة بنعرف إجابتها الصح مقدّمًا.
 * صفر نداءات شبكة، صفر إيميلات.
 *   node alojan/tools/test.mjs
 * ============================================================= */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TARGET, isHomepage } from './fixtures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const T = (label, cond, extra) => {
  if (cond) { pass++; console.log('  ✅ ' + label); }
  else { fail++; console.log('  ❌ ' + label + (extra !== undefined ? '\n       → ' + extra : '')); }
};
const head = (t) => console.log('\n' + t);

/* المحاكي بيتنفّذ في عملية منفصلة ويرجّع الحالة كاملة كـ JSON */
/* كل التقارير الأربعة: عميلين × إيقاعين */
const ALL = [];
for (const client of ['alojan', 'shoug'])
  for (const cadence of ['monthly', 'weekly']) ALL.push({ client, cadence, tag: client + '/' + cadence });

function run(cadence, scenario, client) {
  client = client || 'alojan';
  const code = `
    process.argv.push('--client=${client}', '--cadence=${cadence}', '--scenario=${scenario}', '--quiet');
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
      config:   pick('Config')[0]          || null,
      pageCheckNode: pick('Page Check Report')[0] || null,
    }));
  `;
  const out = execFileSync('node', ['--input-type=module', '-e', code],
    { encoding: 'utf8', cwd: ROOT, maxBuffer: 1 << 28 });
  return JSON.parse(out);
}

/* ══════════ ضمانة عدم الانحراف بين التقارير ══════════ */
head('بنية الملفات — التقارير الأربعة على كود واحد');
{
  const fs2 = await import('node:fs');
  const crypto = await import('node:crypto');
  const sha = (t) => crypto.createHash('sha1').update(t).digest('hex');
  const files = ALL.map(({ client, cadence, tag }) => ({
    tag,
    wf: JSON.parse(fs2.readFileSync(
      path.join(ROOT, 'dist', client.toUpperCase() + '-' +
        (cadence === 'weekly' ? 'Weekly' : 'Monthly') + '-v4.json'), 'utf8')),
  }));

  const codes = {};
  files.forEach(({ tag, wf }) => {
    wf.nodes.filter((n) => n.type === 'n8n-nodes-base.code')
      .forEach((n) => { (codes[n.name] = codes[n.name] || {})[tag] = sha(n.parameters.jsCode); });
  });

  /* Config و Keywords بيختلفوا في البيانات المحقونة بس — المنطق واحد.
   * أي نود تاني بيختلف معناه إن التقارير بدأت تنحرف تاني. */
  const dataDriven = ['Config', 'Keywords'];
  const drifted = Object.keys(codes).filter((n) =>
    dataDriven.indexOf(n) === -1 && new Set(Object.values(codes[n])).size > 1);
  T('كل نودات المنطق بنفس الكود بالحرف في الأربعة', drifted.length === 0,
    JSON.stringify(drifted));
  T('عدد النودات المشتركة = ' + (Object.keys(codes).length - dataDriven.length),
    Object.keys(codes).length - dataDriven.length >= 16);

  files.forEach(({ tag, wf }) => {
    const cs = wf.nodes.find((n) => n.name === 'Create Slides');
    T(tag + ': Create Slides من غير retry (الطلب مش idempotent)', !cs.retryOnFail);
    const q = wf.nodes.find((n) => n.name === 'GSC Query');
    T(tag + ': طلب GSC فيه aggregationType byPage',
      /aggregationType: 'byPage'/.test(q.parameters.jsonBody));
    const names = new Set(wf.nodes.map((n) => n.name));
    const targets = new Set();
    Object.values(wf.connections).forEach((spec) =>
      (spec.main || []).forEach((outs) => (outs || []).forEach((t) => targets.add(t.node))));
    const orphans = [...names].filter((n) =>
      !targets.has(n) && n !== 'Manual Trigger' && n !== 'Schedule Trigger');
    T(tag + ': مفيش نود مش موصول', orphans.length === 0, JSON.stringify(orphans));
  });
}

/* ══════════ قائمة الكلمات ══════════ */
head('قائمة الكلمات — قاعدة «مفيش رابط يبقى مفيش صف»');
{
  for (const client of ['alojan', 'shoug']) {
    const k = run('monthly', 'happy', client).keywords;
    T(client + ': كل كلمة في التقرير ليها رابط صفحة',
      k.keywords.length > 0 && k.keywords.every((x) => x.page && /^https?:\/\//.test(x.page)),
      JSON.stringify(k.keywords.filter((x) => !x.page).map((x) => x.keyword)));
    T(client + ': كل كلمة مستبعدة مسجّلة بالاسم',
      k.excluded.every((e) => e.keyword && e.why), JSON.stringify(k.excluded[0] || null));
    T(client + ': الشهري والأسبوعي على نفس القائمة بالحرف',
      JSON.stringify(run('weekly', 'happy', client).keywords.keywords) === JSON.stringify(k.keywords));
  }
  T('عوجان: 27 معتمدة و8 مستبعدة',
    run('monthly', 'happy', 'alojan').keywords.keywordCount === 27 &&
    run('monthly', 'happy', 'alojan').keywords.excludedCount === 8);
  T('شوق: 25 معتمدة و0 مستبعدة',
    run('monthly', 'happy', 'shoug').keywords.keywordCount === 25 &&
    run('monthly', 'happy', 'shoug').keywords.excludedCount === 0);
}

/* ══════════ الحساب اللي كان بيطلع غلط ══════════ */
head('حساب الموضع والظهور — الحالة اللي كانت بتطلّع «POS 10 / IMP 1»');
for (const { client, cadence, tag } of ALL) {
  const r = run(cadence, 'threePages', client);
  const row = r.merge.data[0];
  const li = row.positions.length - 1;
  T(tag + ': الموضع = رقم الصفحة المستهدفة (20.9) مش أحسن صفحة (10)',
    row.positions[li] === 20.9, row.positions[li]);
  T(tag + ': الظهور = ظهور الصفحة المستهدفة (144) مش (1)',
    row.impressionsAll[li] === 144, row.impressionsAll[li]);
  T(tag + ': الرقم متعلّم إنه على مستوى الصفحة',
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
for (const { client, cadence, tag } of ALL) {
  const r = run(cadence, 'pageMissing', client);
  const row = r.merge.data[0];
  const li = row.positions.length - 1;
  T(tag + ': الخانة "مفيش ظهور" مش رقم صفحة تانية',
    row.positions[li] === null && row.cellsPos[li] === '-', JSON.stringify([row.positions[li], row.cellsPos[li]]));
  T(tag + ': الظهور صفر', row.impressionsAll[li] === 0, row.impressionsAll[li]);
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

/* ══════════ فحص الروابط الفعلي ══════════ */
head('فحص الروابط قبل ما جوجل يتسأل');
for (const { client, cadence, tag } of ALL) {
  const r = run(cadence, 'redirectingUrl', client);
  const pc = r.validate.pageCheck;
  const uniquePages = [...new Set(r.keywords.keywords.map((k) => k.page))];
  const expectRedirect = uniquePages.filter((u) => !isHomepage(u)).length;
  T(tag + ': الروابط اللي بتعمل تحويل اتمسكت (' + expectRedirect + ')',
    (pc.tally.redirected || 0) === expectRedirect, JSON.stringify(pc.tally));
  T(tag + ': ومعاها الرابط النهائي الصح',
    /\/public\//.test((pc.problems[0] || {}).suggested || ''),
    (pc.problems[0] || {}).suggested);
  T(tag + ': التحذير وصل لبوابة الجودة',
    (r.validate.warnings || []).some((w) => /بيعمل تحويل/.test(w)));
  T(tag + ': والإيميل بيقول الكلمات بالاسم',
    /رابط صفحة محتاج تصحيح/.test(r.email.emailText));
  T(tag + ': لكن الرن ما وقفش — الأرقام التانية لسه صالحة', r.validate.ok === true);
}
{
  const r = run('monthly', 'happy');
  T('الروابط السليمة ما بتولّدش أي تحذير',
    ((r.validate.pageCheck || {}).problems || []).length === 0,
    JSON.stringify((r.validate.pageCheck || {}).tally));
}

/* ══════════ رابط غلط في ملف الكلمات ══════════ */
head('رابط غلط ≠ الصفحة مالهاش ترتيب');
for (const { client, cadence, tag } of ALL) {
  const r = run(cadence, 'wrongUrl', client);
  const pa = r.merge.quality.pageAudit;
  /* السيناريو بيغيّر مسار صفحات المقالات بس — الصفحة الرئيسية مالهاش مسار
   * يتغيّر، فبتفضل سليمة. المتوقع بيتحسب من قائمة كل عميل مش رقم متثبّت. */
  const kws = r.keywords.keywords;
  const expectSuspect = kws.filter((k) => !isHomepage(k.page)).length;
  const expectOk = kws.length - expectSuspect;
  T(tag + ': كل رابط مكسور اتحدد بالاسم (' + expectSuspect + ')',
    (pa.suspect || []).length === expectSuspect, (pa.suspect || []).length);
  T(tag + ': والروابط السليمة ما اتبلّغش عنها (' + expectOk + ')', pa.ok === expectOk, pa.ok);
  T(tag + ': ومعاها الرابط اللي جوجل شايفه فعلًا',
    (((pa.suspect[0] || {}).samples || [])[0] || {}).topPage
      ? /\/public\//.test(pa.suspect[0].samples[0].topPage) : false,
    JSON.stringify((pa.suspect[0] || {}).samples));
  T(tag + ': التحذير وصل لبوابة الجودة',
    (r.validate.warnings || []).some((w) => /الرابط الكانوني|ما ظهرتش عند جوجل/.test(w)),
    JSON.stringify(r.validate.warnings).slice(0, 200));
  T(tag + ': والإيميل بيقول الكلمات بالاسم',
    /رابطها محتاج مراجعة/.test(r.email.emailText));
  T(tag + ': ما اتقالش إن الكلمة "اختفت"', r.stats.gone === 0, r.stats.gone);
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
for (const { client, cadence, tag } of ALL) {
  const r = run(cadence, 'happy', client);
  const html = r.email.emailHtml, text = r.email.emailText;
  T(tag + ': الإيميل فيه خطوات المراجعة على Search Console',
    /تراجع أي رقم بنفسك/.test(html));
  T(tag + ': بيقول المدى الزمني بالظبط', /Date: Custom/.test(text));
  T(tag + ': بيقول فلتر الدولة', /Country:/.test(text));
  T(tag + ': بيقول فلتر الصفحة', /Page: Exact URL/.test(text));
  /* شوق مالوش كلمات مستبعدة، فالقسم ده المفروض ما يظهرش أصلًا */
  const nExcluded = r.keywords.excludedCount;
  T(tag + ': ' + (nExcluded ? 'الكلمات المستبعدة مذكورة بالاسم (' + nExcluded + ')'
                            : 'مفيش قسم كلمات مستبعدة لأن مفيش ولا واحدة'),
    nExcluded
      ? new RegExp('كلمات خارج التقرير \\(' + nExcluded + '\\)').test(text)
      : !/كلمات خارج التقرير/.test(text));
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

/* ══════════ التسليم بالبريد ══════════ */
head('البريد — الناقل رافض يوصّل بره الدومين');
{
  const r = run('monthly', 'domainOnlySmtp');
  const a = r.audit[0];
  T('اتشخّص إن الرفض على أساس الدومين', a.relayBlocksExternal === true);
  T('العناوين الخارجية اتحددت بالاسم',
    (a.externalMissing || []).length === 2, JSON.stringify(a.externalMissing));
  T('ما اتعادتش المحاولة على نفس السيرفر الرافض',
    !r.trace.includes('Resend Individually'));
  T('التشخيص فيه الحل بالخطوات', /Admin console/.test(a.relayDiagnosis || ''));
  T('التنبيه اتبعت', r.mailSent.some((m) => m.node === 'Delivery Alert Email'));
  T('والتنبيه راح لكل المستلمين مش لدومين رابح بس',
    r.mailSent.filter((m) => m.node === 'Delivery Alert Email')
      .every((m) => /gmail\.com/.test(m.to)),
    JSON.stringify(r.mailSent.filter((m) => m.node === 'Delivery Alert Email').map((m) => m.to)));
  T('عنوان التنبيه بيقول السبب', /الناقل رافض/.test(r.delivery.alertSubject));
}

head('البريد — المسار البديل (Gmail API) لما SMTP يرفض الخارجيين');
{
  const r = run('monthly', 'gmailFallback');
  T('المسار البديل اشتغل', r.trace.includes('Send via Gmail API'));
  T('العنوانين اللي على جيميل وصلوا',
    r.delivery.deliveryRows.length === 2 && r.delivery.deliveryRows.every((x) => x.ok),
    JSON.stringify(r.delivery.deliveryRows));
  T('واتسجّل إنهم راحوا عبر Gmail API',
    r.delivery.deliveryRows.every((x) => x.via === 'gmail-api'));
  T('وما اتبعتش تنبيه لأن كله وصل', r.delivery.__silent === true);
  T('ما اتعادتش محاولة SMTP فاشلة', !r.trace.includes('Resend Individually'));
}

head('البريد — كل حاجة تمام');
{
  const r = run('monthly', 'happy');
  T('التقرير اتبعت', r.mailSent.some((m) => m.node === 'Send Report Email'));
  T('عنوان الجيميل ضمن المستلمين', /gmail\.com/.test(r.mailSent[0].to + r.mailSent[0].cc));
  T('ما اتبعتش تنبيه توصيل بلا داعي',
    !r.mailSent.some((m) => m.node === 'Delivery Alert Email'),
    JSON.stringify(r.mailSent.map((m) => m.node)));
  T('ما اتعادتش أي محاولة إرسال', !r.trace.includes('Resend Individually'));
}

console.log('\n' + (fail ? '❌ ' : '✅ ') + pass + ' نجح، ' + fail + ' فشل.\n');
process.exit(fail ? 1 : 0);
