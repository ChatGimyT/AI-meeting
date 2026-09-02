#!/usr/bin/env node
/* =============================================================
 * محاكي n8n مصغّر: ينفّذ dist/ai-editorial-boardroom.json فعليًا
 * بنموذج لغوي وهمي، للتحقق من تدفق البيانات والدورات والبوابة
 * قبل رفع الـ workflow إلى n8n.
 *
 *   node tools/simulate.mjs [--profile rabeh_article_ar] [-v]
 * ============================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeMock, $LAST } from './mock-llm.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const wf = JSON.parse(fs.readFileSync(path.join(ROOT, 'dist', 'ai-editorial-boardroom.json'), 'utf8'));
const VERBOSE = process.argv.includes('-v');
const profileArg = (process.argv.find((a) => a.startsWith('--profile=')) || '').split('=')[1];

const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
const runs = {};                       /* آخر مخرجات كل عقدة */
const mock = makeMock();
const trace = [];
let llmCalls = 0;

const $ = (name) => {
  const items = runs[name];
  if (!items) throw new Error("Referenced node has no output yet: '" + name + "'");
  return { first: () => items[0], all: () => items, last: () => items[items.length - 1], item: items[0] };
};

function runCode(node, items) {
  const $input = {
    first: () => items[0],
    all: () => items,
    last: () => items[items.length - 1],
    item: items[0]
  };
  const fn = new Function('$input', '$', '$json', '$now', 'require', node.parameters.jsCode);
  const out = fn($input, $, items[0] ? items[0].json : {}, new Date(), undefined);
  if (!Array.isArray(out)) throw new Error(node.name + ' did not return an array');
  return out;
}

function evalIf(node, items) {
  const j = items[0].json;
  switch (node.name) {
    case '🚦 Intake Complete?': return !!j.intake_ok;
    case '🚦 Has Links?':       return j.skip_links === false;
    case '🚦 Webhook Reply?':   return $('🧾 Normalize Brief').first().json.brief.delivery === 'webhook';
    default: throw new Error('No evaluator for IF node ' + node.name);
  }
}

function runNode(node, items) {
  switch (node.type) {
    case 'n8n-nodes-base.code':
      return { outputs: [runCode(node, items)] };

    case 'n8n-nodes-base.set': {
      const raw = node.parameters.jsonOutput;
      if (typeof raw === 'string' && raw.startsWith('=')) return { outputs: [items] };
      const parsed = JSON.parse(raw);
      const preset = profileArg && PRESETS[profileArg];
      return { outputs: [[{ json: preset ? preset : parsed }]] };
    }

    case 'n8n-nodes-base.httpRequest': {
      if (node.name === '🌐 HTTP · Link Check') {
        return { outputs: [items.map(() => ({ json: { statusCode: 200, body: '' } }))] };
      }
      const st = items[0] && items[0].json.state;
      $LAST.article = (st && st.article) || '';
      llmCalls += items.length;
      return { outputs: [items.map((it) => ({ json: mock(it.json.meta) }))] };
    }

    case 'n8n-nodes-base.if': {
      const t = evalIf(node, items);
      return { outputs: t ? [items, []] : [[], items] };
    }

    case 'n8n-nodes-base.switch': {
      const route = items[0].json.route;
      const keys = node.parameters.rules.values.map((r) => r.outputKey);
      let idx = keys.indexOf(route);
      if (idx < 0) idx = keys.length;                       /* fallback = blocked */
      const outs = new Array(keys.length + 1).fill(null).map(() => []);
      outs[idx] = items;
      return { outputs: outs };
    }

    case 'n8n-nodes-base.noOp':
    case 'n8n-nodes-base.respondToWebhook':
      return { outputs: [items] };

    default:
      throw new Error('Unsupported node type in simulator: ' + node.type + ' (' + node.name + ')');
  }
}

/* ---------- محرك التنفيذ ---------- */
const startName = '📥 Brief — EDIT ME';
const PRESETS = {
  social_posts_ar: {
    profile_id: 'social_posts_ar',
    title: 'حزمة بوستات: أخطاء إعلانات جوجل',
    goal: 'رفع الوعي وجذب استشارات',
    target_market: 'السعودية',
    platforms: ['linkedin', 'x'],
    post_count: 2,
    primary_keyword: 'اعلانات جوجل',
    notes: ''
  },
  rabeh_refresh_ar: {
    profile_id: 'rabeh_refresh_ar',
    title: 'ما هي إعلانات جوجل ادوردز؟',
    goal: 'تحديث مقالة منشورة',
    article_type: 'commercial',
    target_market: 'السعودية',
    primary_keyword: 'اعلانات جوجل ادوردز',
    primary_keyword_count: 8,
    secondary_keywords: ['اعلانات جوجل', 'حملات جوجل الاعلانية', 'اسعار اعلانات جوجل'],
    internal_links: [
      { anchor: 'أنواع إعلانات جوجل', url: 'https://www.rabeh.org/ar/blog-show/انواع-اعلانات-جوجل' },
      { anchor: 'طريقة عمل اعلان على جوجل', url: 'https://www.rabeh.org/ar/blog-show/طريقة-عمل-اعلان-على-جوجل' },
      { anchor: 'ادارة حملات جوجل الاعلانية', url: 'https://www.rabeh.org/ar/blog-show/ادارة-حملات-جوجل-الاعلانية' }
    ],
    existing_article: '# ما هي إعلانات جوجل ادوردز؟\n\nجوجل ادورد هي إعلانات شبكة البحث…',
    allow_auto_headings: true
  }
};
$LAST.profile = profileArg || 'rabeh_article_ar';
let queue = [{ name: startName, items: [{ json: {} }] }];
const pendingMerge = {};                 /* عقد لها أكثر من مصدر: تُنفَّذ عند وصول أول دفعة */
let steps = 0;

while (queue.length) {
  const { name, items } = queue.shift();
  const node = byName[name];
  if (!node) throw new Error('Unknown node ' + name);
  if (++steps > 400) throw new Error('Step limit exceeded — probable infinite loop');
  if (!items.length) continue;

  const t0 = Date.now();
  let res;
  try {
    res = runNode(node, items);
  } catch (e) {
    console.error('\n❌ فشل في العقدة: ' + name + '\n   ' + e.message + '\n');
    console.error(e.stack.split('\n').slice(0, 6).join('\n'));
    process.exit(1);
  }
  runs[name] = res.outputs[0] && res.outputs[0].length ? res.outputs[0] : (runs[name] || []);
  if (res.outputs[0]) runs[name] = res.outputs[0].length ? res.outputs[0] : runs[name];
  /* الحفاظ على مخرجات الفروع للمراجع $() */
  const flat = res.outputs.flat();
  if (flat.length) runs[name] = res.outputs.find((o) => o && o.length) || flat;

  trace.push({ node: name, items: items.length, out: flat.length, ms: Date.now() - t0 });
  if (VERBOSE) console.log('· ' + name + '  (in ' + items.length + ' → out ' + flat.length + ')');

  const conns = wf.connections[name];
  if (!conns) continue;
  conns.main.forEach((targets, outIdx) => {
    const outItems = res.outputs[outIdx] || [];
    if (!outItems.length) return;
    (targets || []).forEach((t) => queue.push({ name: t.node, items: outItems }));
  });
}

/* ---------- التقرير ---------- */
const pack = runs['📦 Publish Pack'] && runs['📦 Publish Pack'][0] && runs['📦 Publish Pack'][0].json;
if (!pack) { console.error('❌ لم تصل التنفيذة إلى حزمة النشر.'); process.exit(1); }

const line = (k, v) => console.log('  ' + (k + ' ').padEnd(30, '.') + ' ' + v);
console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║  محاكاة كاملة لمحرك طاولة الاجتماعات                  ║');
console.log('╚══════════════════════════════════════════════════════╝\n');
line('عقد نُفِّذت', trace.length);
line('نداءات النموذج', llmCalls);
line('الملف التعريفي', pack.profile);
line('الحالة', pack.status);
line('جاهز للنشر', pack.ready_to_publish ? 'نعم ✅' : 'لا');
line('الدورات المستهلكة', pack.rounds_used);
line('عدد كلمات المقال', pack.meta.word_count);
line('Meta Title', pack.meta.meta_title.length + ' حرفًا');
line('Meta Description', pack.meta.meta_description.length + ' حرفًا');
line('أسئلة FAQ', pack.faq.length);
line('المصادر المعتمدة', pack.sources.length);
line('روابط فُحصت', pack.link_report.length);
line('الفحص الآلي', pack.mechanical.pass ? 'ناجح ✅' : 'راسب ❌');
line('JSON-LD', pack.json_ld ? pack.json_ld['@graph'].map((g) => g['@type']).join(' + ') : '—');
line('بنود محضر الاجتماع', (pack.meeting_minutes_markdown.match(/^### /gm) || []).length);
line('طول تقرير التدقيق', pack.audit_report_markdown.length + ' حرفًا');

console.log('\n  فحوص المفتش الآلي (النسخة النهائية):');
pack.mechanical.checks.forEach((c) => {
  console.log('    ' + (c.pass ? '✅' : (c.severity === 'high' ? '❌' : '⚠️ ')) + ' ' + c.id.padEnd(26) + ' ' + c.detail.slice(0, 90));
});

if (pack.warnings.length) { console.log('\n  تنبيهات:'); pack.warnings.forEach((w) => console.log('    • ' + w)); }
if (pack.errors.length)   { console.log('\n  أخطاء تقنية:'); pack.errors.forEach((e) => console.log('    • [' + e.stage + '] ' + e.message)); }

/* ---------- تأكيدات ---------- */
const isArticle = pack.profile !== 'social_posts_ar';
const assertions = [
  ['وصلت إلى حزمة النشر', !!pack],
  ['دارت الجلسة أكثر من دورة واحدة', pack.rounds_used >= 2],
  ['دورة التعديل عادت للمفتش الآلي', trace.filter((t) => t.node === '🔍 Mechanical Inspector').length >= 2],
  ['الطاولة اجتمعت مرتين', trace.filter((t) => t.node === '🧠 LLM · Review Panel').length >= 2],
  ['المقال ضمن نطاق طول الملف التعريفي', !isArticle || pack.mechanical.checks.some((c) => c.id === 'word_count' && c.pass)],
  ['الفحص الآلي نجح في النهاية', pack.mechanical.pass === true],
  ['البوابة سمحت بالنشر', pack.ready_to_publish === true],
  ['Schema فيه FAQPage', !isArticle || (!!pack.json_ld && pack.json_ld['@graph'].some((g) => g['@type'] === 'FAQPage'))],
  ['محضر الاجتماع غير فارغ', pack.meeting_minutes_markdown.length > 2000],
  ['المصادر انتقلت لحزمة النشر', pack.sources.length === 2],
].concat(isArticle ? [] : [
  ['حزمة السوشيال أنتجت بوستات', pack.mechanical.checks.some((c) => c.id === 'posts_found' && c.pass)]
]).concat([
  ['لا أخطاء تقنية', pack.errors.length === 0]
]);
console.log('\n  التأكيدات:');
let failed = 0;
assertions.forEach(([label, ok]) => { if (!ok) failed++; console.log('    ' + (ok ? '✅' : '❌') + ' ' + label); });
console.log('');
if (failed) { console.error('❌ فشل ' + failed + ' تأكيدًا.\n'); process.exit(1); }
console.log('✅ المحاكاة اكتملت بنجاح.\n');
