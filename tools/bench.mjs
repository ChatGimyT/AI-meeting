#!/usr/bin/env node
/* =============================================================
 * دورة الجودة كاملة بأمر واحد:
 *   تشغيل حقيقي → تصحيح آلي → مقارنة بالمقال المرجعي → تقرير الفجوة
 *
 *   export DEEPSEEK_API_KEY=sk-...
 *   node tools/bench.mjs --profile=rabeh_article_ar_deepseek \
 *        --brief=benchmark/briefs/google-ads-ar.json \
 *        --gold=benchmark/gold/google-ads-ar.md --judge
 * ============================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.slice(k.length + 3) : d;
};
const has = (k) => process.argv.includes('--' + k);

const profile = arg('profile', 'rabeh_article_ar_deepseek');
const brief   = arg('brief', 'benchmark/briefs/google-ads-ar.json');
const gold    = arg('gold', 'benchmark/gold/google-ads-ar.md');
const label   = arg('label', new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19));
const outDir  = path.join('runs', profile + '-' + label);

if (!process.env.LLM_API_KEY && !process.env.DEEPSEEK_API_KEY && !process.env.ANTHROPIC_API_KEY) {
  console.error('\n❌ لا يوجد مفتاح API في البيئة.\n   export DEEPSEEK_API_KEY=sk-...   (أو LLM_API_KEY / ANTHROPIC_API_KEY)\n');
  process.exit(2);
}

const run = (args, opts) => {
  try { return execFileSync('node', args, Object.assign({ cwd: ROOT, encoding: 'utf8', stdio: 'pipe' }, opts)); }
  catch (e) { return (e.stdout || '') + (e.stderr || ''); }
};

console.log('\n▶ 1/4  تشغيل حقيقي للورشة  [' + profile + ']');
const simOut = run(['tools/simulate.mjs', '--live', '--profile=' + profile, '--brief=' + brief,
                    '--out=' + outDir, '--concurrency=' + arg('concurrency', '4')]);
console.log(simOut.split('\n').filter((l) => /الحالة|الدورات|نداءات|عدد كلمات|الفحص الآلي|📁|❌/.test(l)).join('\n'));

const articlePath = path.join(outDir, 'article.md');
if (!fs.existsSync(path.join(ROOT, articlePath))) {
  console.error('\n❌ لم يُنتج المقال. راجع المخرجات أعلاه.\n');
  console.error(simOut.slice(-2500));
  process.exit(1);
}

console.log('\n▶ 2/4  تصحيح آلي');
console.log(run(['tools/grade.mjs', '--article=' + articlePath, '--brief=' + brief]).split('\n').slice(-4).join('\n'));

console.log('\n▶ 3/4  مقارنة بالمقال المرجعي');
const cmpArgs = ['tools/compare.mjs', '--gold=' + gold, '--candidate=' + articlePath, '--brief=' + brief];
if (has('judge')) {
  cmpArgs.push('--judge');
  if (arg('judge-url')) cmpArgs.push('--judge-url=' + arg('judge-url'));
  if (arg('judge-model')) cmpArgs.push('--judge-model=' + arg('judge-model'));
}
const cmpOut = run(cmpArgs);
console.log(cmpOut);

console.log('▶ 4/4  خلاصة الدورة');
const g = JSON.parse(run(['tools/grade.mjs', '--article=' + articlePath, '--brief=' + brief, '--json']));
const gg = JSON.parse(run(['tools/grade.mjs', '--article=' + gold, '--brief=' + brief, '--json']));
const failing = g.checks.filter((c) => !c.pass);

const summary = {
  at: new Date().toISOString(),
  profile, brief, gold, run_dir: outDir,
  candidate_score: g.score_pct, gold_score: gg.score_pct,
  gap: g.score_pct - gg.score_pct,
  passed: g.pass,
  failing_checks: failing.map((c) => ({ id: c.id, severity: c.severity, detail: c.detail })),
  measured: g.measured
};
fs.writeFileSync(path.join(ROOT, outDir, 'bench.json'), JSON.stringify(summary, null, 2), 'utf8');

const ledger = path.join(ROOT, 'runs', 'ledger.jsonl');
fs.appendFileSync(ledger, JSON.stringify({
  at: summary.at, profile, score: g.score_pct, gold: gg.score_pct,
  pass: g.pass, hard: g.hard_failures, soft: g.soft_failures, words: g.measured.words, dir: outDir
}) + '\n');

console.log('  الدرجة الآلية: المرشّح ' + g.score_pct + '%  مقابل المرجع ' + gg.score_pct + '%');
console.log('  المخالفات الباقية: ' + failing.length + (failing.length ? ' → ' + failing.map((c) => c.id).join('، ') : ' — لا شيء 🎉'));
console.log('  سجل الدورات: runs/ledger.jsonl');

if (failing.length) {
  console.log('\n  ── مقابض الضبط المقترحة ──────────────────────────────────────────');
  const tips = {
    word_count: 'اضبط word_budget في outline، أو ارفع gate.max_rounds — دالة H.sectionTargets توزّع الفارق على الأقسام تلقائيًا.',
    intro_words: 'شدّد تعليمات قسم __front__ في src/stages/10-agenda-draft.js.',
    paragraph_length: 'اخفض llm.temperature أو أضف تذكيرًا بالحد في برومبت language_editor.',
    h2_direct_answer: 'كرّر شرط 40–60 كلمة في تعليمات قسم المحتوى، وارفع أولويته في موجز التعديل.',
    primary_keyword_count: 'تأكد أن brief.primary_keyword_count مضبوط — الحصة تُوزَّع تلقائيًا على الأقسام.',
    primary_keyword_verbatim: 'النموذج يعيد صياغة الكلمة: شدّد البند 4 في دستور الورشة (LAW).',
    secondary_keywords: 'أضف الكلمات الثانوية إلى must_include لأقسام محددة في المخطط.',
    faq: 'ارفع rules.min_faq أو وسّع blueprint.faq_questions.',
    sources_section: 'فعّل rules.auto_sources_section — يُبنى القسم بالكود لا بالنموذج.',
    links_whitelisted: 'النموذج يخترع روابط: هذا سبب وجود strict_link_whitelist. راجع برومبت research_lead.',
    internal_links_used: 'وزّع الروابط في blueprint.internal_link_map على أقسام مختلفة بأسماء عناوين مطابقة.',
    internal_links_spread: 'اجعل internal_link_map يذكر ثلاثة أقسام مختلفة على الأقل.',
    banned_phrases: 'أضف العبارة المرصودة إلى rules.banned_phrases فلا تتكرر أبدًا.',
    dialect: 'أضف المفردة إلى rules.banned_dialect_markers.',
    visual_rhythm: 'اضبط format في outline إلى list أو table لمزيد من الأقسام.',
    numbers_have_evidence: 'النموذج يخترع أرقامًا بلا أدلة: تأكد من mandatory_citations في الطلب.',
    meta_title: 'شدّد حد الأحرف في تعليمات __front__.',
    meta_description: 'شدّد حد الأحرف في تعليمات __front__.'
  };
  [...new Set(failing.map((c) => c.id))].forEach((id) => {
    console.log('  • ' + id + ': ' + (tips[id] || 'راجع البند المقابل في المفتش الآلي.'));
  });
}
console.log('');
