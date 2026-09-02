#!/usr/bin/env node
/* =============================================================
 * مقارنة مقالين وجهًا لوجه: الفحوص الإلزامية + بصمة الأسلوب.
 * بلا أي نداء API (إلا إذا طلبت حكمًا أعمى بـ --judge).
 *
 *   node tools/compare.mjs --gold=a.md --candidate=b.md --brief=brief.json
 *   node tools/compare.mjs --gold=a.md --candidate=b.md --brief=b.json --judge
 * ============================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.slice(k.length + 3) : d;
};
const has = (k) => process.argv.includes('--' + k);

const goldPath = arg('gold');
const candPath = arg('candidate');
const briefPath = arg('brief');
if (!goldPath || !candPath) {
  console.error('usage: node tools/compare.mjs --gold=a.md --candidate=b.md [--brief=b.json] [--judge]');
  process.exit(2);
}

const helpersSrc = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'helpers.js'), 'utf8');
const ctx = vm.createContext({ console, Date, Math, JSON, RegExp, Number, String, Array, Object, isFinite });
vm.runInContext(helpersSrc + '\nglobalThis.H = H;', ctx);
const H = ctx.H;

const brief = briefPath ? JSON.parse(fs.readFileSync(path.resolve(ROOT, briefPath), 'utf8')) : {};

/* ---------- بصمة الأسلوب ---------- */
const TRANSITIONS = ['ولذلك', 'وبالتالي', 'ومن هنا', 'في المقابل', 'على سبيل المثال', 'كما أن', 'غير أن',
                     'إضافة إلى', 'من ناحية', 'لكن', 'ثم', 'أما', 'بينما', 'إذ', 'حيث'];
const COMPANY_VOICE = ['نحن ', 'نقدم', 'لدينا', 'نتميز', 'نمتلك', 'نسعى', 'نوفر'];
const AI_TELLS = ['في عالمنا الرقمي', 'مع التطور التكنولوجي', 'في عصرنا الحالي', 'لا يخفى على أحد',
                  'يعتبر من أهم', 'مما لا شك فيه', 'في الختام يمكن القول', 'تلعب دورًا محوريًا',
                  'يعد من أبرز', 'في ظل التطور'];

function fingerprint(md) {
  const A = H.parseArticle(md);
  const plain = H.stripMd(A.body).replace(/\s+/g, ' ').trim();
  const words = plain.split(' ').filter(Boolean);
  const sentences = plain.split(/[.!؟?]\s+/).map((x) => x.trim()).filter((x) => x.split(' ').length > 2);
  const paras = A.blocks.filter((b) => b.type === 'paragraph');
  const internalDomains = ['rabeh.org'];

  const norm = words.map((w) => H.normAr(w));
  const uniq = new Set(norm).size;

  /* تكرار العبارات الثلاثية — مؤشر الحشو الآلي */
  const tri = {};
  for (let i = 0; i + 2 < norm.length; i++) {
    const k = norm[i] + ' ' + norm[i + 1] + ' ' + norm[i + 2];
    tri[k] = (tri[k] || 0) + 1;
  }
  const repeated = Object.values(tri).filter((n) => n >= 3).length;

  const count = (list) => list.reduce((n, p) => n + H.countPhrase(A.body, p), 0);

  return {
    'عدد الكلمات': words.length,
    'الفقرات': paras.length,
    'متوسط طول الفقرة': paras.length ? Math.round(paras.reduce((n, p) => n + p.words, 0) / paras.length) : 0,
    'أطول فقرة': paras.reduce((m, p) => Math.max(m, p.words), 0),
    'القوائم': A.blocks.filter((b) => b.type === 'list').length,
    'الجداول': A.blocks.filter((b) => b.type === 'table').length,
    'عناوين H2': A.headings.filter((h) => h.level === 2).length,
    'عناوين H3': A.headings.filter((h) => h.level === 3).length,
    'أسئلة FAQ': A.faq.length,
    'روابط داخلية': A.links.filter((l) => H.isInternal(l.url, internalDomains)).length,
    'روابط خارجية': A.links.filter((l) => !H.isInternal(l.url, internalDomains)).length,
    'تنوع المفردات %': words.length ? Math.round((uniq / words.length) * 100) : 0,
    'متوسط طول الجملة': sentences.length ? Math.round(words.length / sentences.length) : 0,
    'جمل طويلة %': sentences.length ? Math.round((sentences.filter((s) => s.split(' ').length > 25).length / sentences.length) * 100) : 0,
    'أدوات ربط /1000': words.length ? Math.round((count(TRANSITIONS) / words.length) * 1000) : 0,
    'جمل «نحن/نقدم»': count(COMPANY_VOICE),
    'أرقام ونسب /1000': words.length ? Math.round(((plain.match(/\d+(?:[.,]\d+)?\s*%?/g) || []).length / words.length) * 1000) : 0,
    'عبارات آلية مكشوفة': count(AI_TELLS),
    'تكرار عبارات /1000': words.length ? Math.round((repeated / words.length) * 1000) : 0
  };
}

/* ---------- الفحوص الإلزامية عبر المصحّح ---------- */
function gradeOf(file) {
  const args = ['tools/grade.mjs', '--article=' + file, '--json'];
  if (briefPath) args.push('--brief=' + briefPath);
  try {
    return JSON.parse(execFileSync('node', args, { cwd: ROOT, encoding: 'utf8' }));
  } catch (e) {
    if (e.stdout) { try { return JSON.parse(e.stdout); } catch (_) {} }
    throw e;
  }
}

const gGold = gradeOf(goldPath);
const gCand = gradeOf(candPath);
const fGold = fingerprint(fs.readFileSync(path.resolve(ROOT, goldPath), 'utf8'));
const fCand = fingerprint(fs.readFileSync(path.resolve(ROOT, candPath), 'utf8'));

const NAME_G = path.basename(goldPath);
const NAME_C = path.basename(candPath);
const pad = (s, n) => String(s).padEnd(n);

console.log('\n╔════════════════════════════════════════════════════════════════════╗');
console.log('║  مقارنة الجودة                                                     ║');
console.log('╚════════════════════════════════════════════════════════════════════╝');
console.log('\n  المرجع    : ' + NAME_G + '   → ' + gGold.score_pct + '%' + (gGold.pass ? ' ✅' : ' ❌'));
console.log('  المرشّح   : ' + NAME_C + '   → ' + gCand.score_pct + '%' + (gCand.pass ? ' ✅' : ' ❌'));
console.log('  الفجوة    : ' + (gCand.score_pct - gGold.score_pct > 0 ? '+' : '') + (gCand.score_pct - gGold.score_pct) + ' نقطة');

console.log('\n  ── الفحوص الإلزامية ───────────────────────────────────────────────');
console.log('  ' + pad('الفحص', 28) + pad('المرجع', 10) + 'المرشّح');
const byId = (g) => Object.fromEntries(g.checks.map((c) => [c.id, c]));
const cg = byId(gGold), cc = byId(gCand);
const ids = [...new Set([...Object.keys(cg), ...Object.keys(cc)])];
let regressions = [];
ids.forEach((id) => {
  const a = cg[id], b = cc[id];
  const m = (c) => !c ? '—' : (c.pass ? '✅' : (c.severity === 'high' ? '❌' : '⚠️'));
  if (a && b && a.pass && !b.pass) regressions.push({ id, detail: b.detail });
  console.log('  ' + pad(id, 28) + pad(m(a), 10) + m(b) + (b && !b.pass ? '   ' + String(b.detail).slice(0, 70) : ''));
});

console.log('\n  ── بصمة الأسلوب ──────────────────────────────────────────────────');
console.log('  ' + pad('المؤشر', 24) + pad('المرجع', 10) + pad('المرشّح', 10) + 'الفارق');
Object.keys(fGold).forEach((k) => {
  const a = fGold[k], b = fCand[k];
  const d = b - a;
  const flag = Math.abs(a) > 0 && Math.abs(d) / Math.max(1, Math.abs(a)) > 0.35 ? '  ⚠️' : '';
  console.log('  ' + pad(k, 24) + pad(a, 10) + pad(b, 10) + (d > 0 ? '+' : '') + d + flag);
});

if (regressions.length) {
  console.log('\n  ── ما يفصل المرشّح عن المرجع ─────────────────────────────────────');
  regressions.forEach((r) => console.log('  ❌ ' + r.id + ': ' + r.detail));
}

/* ---------- الحكم الأعمى (اختياري) ---------- */
if (has('judge')) {
  const KEY = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!KEY) { console.error('\n⚠️  --judge يحتاج LLM_API_KEY في البيئة.'); process.exit(0); }
  const url = arg('judge-url', 'https://api.anthropic.com/v1/messages');
  const model = arg('judge-model', 'claude-opus-5');
  const anthropic = url.includes('anthropic');

  /* ترتيب عشوائي حتى لا يعرف الحَكَم أيهما المرجع */
  const flip = Math.random() < 0.5;
  const A = fs.readFileSync(path.resolve(ROOT, flip ? candPath : goldPath), 'utf8');
  const B = fs.readFileSync(path.resolve(ROOT, flip ? goldPath : candPath), 'utf8');

  const prompt = `أنت Senior SEO Auditor + Content Strategist. أمامك مقالان بالعربية عن الموضوع نفسه، مجهولا المصدر.
قارن بينهما بصرامة وبلا مجاملة على البنود التالية، واحكم في كل بند: A أفضل أم B أفضل أم متعادلان، مع سبب في سطر واحد:
1. تحقيق نية الباحث  2. عمق المحتوى وأصالته مقابل المنافسين  3. E-E-A-T والمصداقية  4. الإقناع التسويقي وقوة الـ CTA
5. جاهزية AEO/GEO (قابلية الاقتباس)  6. السرد وتسلسل الأفكار  7. سلامة اللغة وطبيعية الأسلوب  8. ملاءمة السوق السعودي

ثم أعطِ كل مقال درجة من 10 في كل بند، واذكر بالتحديد **ما الذي يجب أن يتغيّر في المقال الأضعف ليصل إلى مستوى الأقوى** في صورة قائمة تنفيذية.

أعد JSON فقط بالشكل:
{"per_criterion":[{"criterion":"...","winner":"A|B|tie","why":"...","score_a":0,"score_b":0}],
 "overall":{"winner":"A|B|tie","score_a":0,"score_b":0,"summary":"..."},
 "gap_closing_actions":["..."]}

=== المقال A ===
${A}

=== المقال B ===
${B}`;

  const headers = { 'content-type': 'application/json' };
  let body;
  if (anthropic) {
    headers['x-api-key'] = KEY; headers['anthropic-version'] = '2023-06-01';
    body = { model, max_tokens: 6000, temperature: 0.1, messages: [{ role: 'user', content: prompt }] };
  } else {
    headers['authorization'] = 'Bearer ' + KEY;
    body = { model, max_tokens: 6000, temperature: 0.1, response_format: { type: 'json_object' },
             messages: [{ role: 'user', content: prompt }] };
  }
  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  const data = await res.json();
  const verdict = H.grabJson(H.readText(data));
  if (!verdict) { console.error('\n⚠️  تعذّر قراءة حكم الحَكَم:', JSON.stringify(data).slice(0, 400)); process.exit(0); }

  const un = (w) => w === 'tie' ? 'متعادلان' : (flip ? (w === 'A' ? NAME_C : NAME_G) : (w === 'A' ? NAME_G : NAME_C));
  console.log('\n  ── حكم أعمى (' + model + ') ──────────────────────────────────────');
  (verdict.per_criterion || []).forEach((c) => {
    const sg = flip ? c.score_b : c.score_a, sc = flip ? c.score_a : c.score_b;
    console.log('  ' + pad(c.criterion, 26) + 'مرجع ' + pad(sg + '/10', 8) + 'مرشّح ' + pad(sc + '/10', 8) + '→ ' + un(c.winner));
    console.log('     ' + String(c.why || '').slice(0, 110));
  });
  const o = verdict.overall || {};
  console.log('\n  الحكم العام: ' + un(o.winner) + '   (مرجع ' + (flip ? o.score_b : o.score_a) + '/10 · مرشّح ' + (flip ? o.score_a : o.score_b) + '/10)');
  if (o.summary) console.log('  ' + o.summary);
  if ((verdict.gap_closing_actions || []).length) {
    console.log('\n  ── ما يلزم لإغلاق الفجوة ─────────────────────────────────────────');
    verdict.gap_closing_actions.forEach((a, i) => console.log('  ' + (i + 1) + '. ' + a));
  }
  fs.mkdirSync(path.join(ROOT, 'runs'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'runs', 'judge-' + Date.now() + '.json'), JSON.stringify({ flip, verdict }, null, 2));
}
console.log('');
