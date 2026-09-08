#!/usr/bin/env node
/* =============================================================
 * محاكي n8n مصغّر لتقارير ALOJAN.
 * بينفّذ الـ workflow المبني فعليًا، بردود مزيّفة من Google Search
 * Console و Sheets — فيتحقق من الحسابات والبوابات **قبل** ما يلمس
 * أي حساب جوجل وقبل ما يبعت أي إيميل.
 *
 *   node alojan/tools/simulate.mjs --cadence=monthly
 *   node alojan/tools/simulate.mjs --cadence=weekly --scenario=fetch-failure
 * ============================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SCENARIOS } from './fixtures.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.slice(k.length + 3) : d;
};
const CADENCE = arg('cadence', 'monthly');
const SCEN    = arg('scenario', 'happy');
const VERBOSE = process.argv.includes('-v');

const file = path.join(ROOT, 'dist',
  'ALOJAN-' + (CADENCE === 'weekly' ? 'Weekly' : 'Monthly') + '-v4.json');
const wf = JSON.parse(fs.readFileSync(file, 'utf8'));
const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));

const scenario = SCENARIOS[SCEN];
if (!scenario) {
  console.error('سيناريو مش موجود: ' + SCEN + ' — المتاح: ' + Object.keys(SCENARIOS).join(', '));
  process.exit(1);
}

/* ---------- حالة التنفيذ ---------- */
const runs = {};                       /* اسم النود → عناصر مخرجاته */
const trace = [];
const httpCalls = { gsc: 0, sheets: 0, slides: 0, mail: 0 };
const mailSent = [];
let sheetWritten = null;

const $ = (name) => {
  const items = runs[name];
  if (!items) throw new Error("النود ده لسه ماشتغلش: '" + name + "'");
  return { first: () => items[0], all: () => items, last: () => items[items.length - 1], item: items[0] };
};

function runCode(node, items) {
  const $input = {
    first: () => items[0],
    all: () => items,
    last: () => items[items.length - 1],
    item: items[0],
  };
  const fn = new Function('$input', '$', '$json', '$now', 'require', node.parameters.jsCode);
  const out = fn($input, $, items[0] ? items[0].json : {}, new Date(), undefined);
  if (!Array.isArray(out)) throw new Error(node.name + ': ما رجّعش array');
  return out;
}

/* ---------- تقييم شروط الـ IF ---------- */
function evalIf(node, items) {
  const j = (items[0] || {}).json || {};
  switch (node.name) {
    case 'GSC Access Check':   return scenario.gscAccessOk !== false;
    case 'Needs Retry?':       return j.__retry === true;
    case 'Data Quality Gate':  return j.ok === true;
    case 'Has Old Slides?':    return (j.requests || []).length > 0;
    case 'Needs Resend?':      return j.__resend === true;
    default: throw new Error('مفيش تقييم للنود الشرطي: ' + node.name);
  }
}

/* ---------- الردود المزيّفة ---------- */
function httpFor(node, items) {
  const url = String(node.parameters.url || '');
  if (node.name === 'Verify GSC Access') {
    return [{ json: scenario.gscAccessOk === false
      ? { error: { code: 403, message: 'User does not have sufficient permission' } }
      : { siteUrl: 'https://www.aaalojan.com/', permissionLevel: 'siteOwner' } }];
  }
  if (node.name === 'List GSC Sites') {
    return [{ json: { siteEntry: [{ siteUrl: 'https://aaalojan.com/', permissionLevel: 'siteOwner' }] } }];
  }
  if (node.name === 'GSC Freshness') {
    httpCalls.gsc++;
    return [{ json: { rows: scenario.freshnessDates.map((d) => ({ keys: [d] })) } }];
  }
  if (node.name === 'GSC Query' || node.name === 'GSC Retry Query') {
    const retry = node.name === 'GSC Retry Query';
    return items.map((it, i) => {
      httpCalls.gsc++;
      return { json: scenario.gscResponse(it.json, { retry, index: i }), pairedItem: { item: i } };
    });
  }
  if (node.name === 'Fetch Sheet') {
    httpCalls.sheets++;
    return [{ json: scenario.sheet || { values: [] } }];
  }
  if (node.name === 'Write To Sheet') {
    httpCalls.sheets++;
    sheetWritten = items[0].json;
    return [{ json: { updatedRows: (items[0].json.sheetValues || []).length } }];
  }
  if (node.name === 'Get Presentation') {
    httpCalls.slides++;
    return [{ json: { slides: (scenario.existingSlides || []).map((id) => ({ objectId: id })) } }];
  }
  if (node.name === 'Delete Old Slides' || node.name === 'Create Slides') {
    httpCalls.slides++;
    return items.map((it, i) => ({ json: { replies: [] }, pairedItem: { item: i } }));
  }
  throw new Error('مفيش رد مزيّف للنود: ' + node.name + ' (' + url.slice(0, 60) + ')');
}

function mailFor(node, items) {
  return items.map((it) => {
    httpCalls.mail++;
    const p = node.parameters;
    const resolve = (expr) => {
      /* تقييم مبسّط لتعبيرات n8n المستخدمة في نودات البريد */
      const s = String(expr || '');
      if (!s.startsWith('=')) return s;
      const body = s.slice(1).replace(/^\{\{|\}\}$/g, '').trim();
      try {
        return new Function('$', '$json', 'return (' + body + ')')($, it.json);
      } catch (e) { return '<<' + body + '>>'; }
    };
    const to = resolve(p.toEmail);
    const cc = resolve((p.options || {}).ccEmail || '');
    const rec = { node: node.name, to, cc, subject: resolve(p.subject) };
    mailSent.push(rec);
    /* الناقل: بيقبل مين ويرفض مين */
    const all = String(to + ',' + cc).split(/[,;]/).map((x) => x.trim()).filter(Boolean)
      .map((x) => (x.match(/<([^>]+)>/) || [null, x])[1].toLowerCase());
    const accepted = all.filter((e) => scenario.smtpAccepts(e));
    const rejected = all.filter((e) => !scenario.smtpAccepts(e));
    rec.accepted = accepted; rec.rejected = rejected;
    return { json: { accepted, rejected, messageId: '<sim-' + httpCalls.mail + '@rabeh.org>',
                     response: '250 OK', envelope: { from: 'M.gamal@rabeh.org', to: accepted } } };
  });
}

/* ---------- محرك التنفيذ ---------- */
const queue = [{ name: 'Emails', items: [{ json: {} }] }];
let steps = 0;
while (queue.length) {
  const { name, items } = queue.shift();
  const node = byName[name];
  if (!node) throw new Error('نود مش موجود: ' + name);
  if (++steps > 300) throw new Error('تجاوزنا حد الخطوات — يبدو فيه لوب');
  if (!items.length) continue;

  let outputs;
  try {
    switch (node.type) {
      case 'n8n-nodes-base.set': {
        const asg = ((node.parameters.assignments || {}).assignments) || [];
        const obj = {};
        asg.forEach((a) => { obj[a.name] = a.value; });
        outputs = [[{ json: Object.assign({}, items[0].json, obj) }]];
        break;
      }
      case 'n8n-nodes-base.code':
        outputs = [runCode(node, items)];
        break;
      case 'n8n-nodes-base.if': {
        const t = evalIf(node, items);
        outputs = t ? [items, []] : [[], items];
        break;
      }
      case 'n8n-nodes-base.httpRequest':
        outputs = [httpFor(node, items)];
        break;
      case 'n8n-nodes-base.emailSend':
        outputs = [mailFor(node, items)];
        break;
      case 'n8n-nodes-base.manualTrigger':
      case 'n8n-nodes-base.scheduleTrigger':
      case 'n8n-nodes-base.noOp':
        outputs = [items];
        break;
      default:
        throw new Error('نوع نود مش مدعوم: ' + node.type);
    }
  } catch (e) {
    console.error('\n❌ فشل في النود: ' + name + '\n   ' + e.message + '\n');
    console.error(String(e.stack || '').split('\n').slice(1, 5).join('\n'));
    process.exit(1);
  }

  const flat = outputs.flat();
  runs[name] = outputs.find((o) => o && o.length) || flat;
  trace.push({ node: name, in: items.length, out: flat.length });
  if (VERBOSE) console.log('· ' + name + ' (' + items.length + ' → ' + flat.length + ')');

  const conns = wf.connections[name];
  if (!conns) continue;
  conns.main.forEach((targets, i) => {
    const out = outputs[i] || [];
    if (!out.length) return;
    (targets || []).forEach((t) => queue.push({ name: t.node, items: out }));
  });
}

export const result = { runs, trace, httpCalls, mailSent, sheetWritten, scenario: SCEN, cadence: CADENCE };

/* ---------- تقرير ---------- */
if (!process.argv.includes('--quiet')) {
  const line = (k, v) => console.log('  ' + (k + ' ').padEnd(34, '.') + ' ' + v);
  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║  محاكاة ' + (CADENCE === 'weekly' ? 'التقرير الأسبوعي' : 'التقرير الشهري ') +
              ' — سيناريو: ' + SCEN.padEnd(16) + '║');
  console.log('╚══════════════════════════════════════════════════════╝\n');
  line('نودات نُفِّذت', trace.length);
  line('طلبات GSC', httpCalls.gsc);
  line('رسائل بريد', httpCalls.mail);

  const V = runs['Validate Data'] && runs['Validate Data'][0] && runs['Validate Data'][0].json;
  if (V) {
    line('بوابة الجودة', V.ok ? 'عدّت ✅' : 'وقفت ❌');
    line('ملخص', V.summaryLine);
    if (V.problems.length) { console.log('\n  أسباب التوقف:'); V.problems.forEach((p) => console.log('    ⛔ ' + p)); }
    if (V.warnings.length) { console.log('\n  ملاحظات:'); V.warnings.forEach((p) => console.log('    ⚠️  ' + p)); }
  }
  const S = runs['Report Stats'] && runs['Report Stats'][0] && runs['Report Stats'][0].json;
  if (S) {
    console.log('');
    line('تحسّن · تراجع · ثابت', S.up + ' · ' + S.down + ' · ' + S.same);
    line('جديدة · اختفت', S.fresh + ' · ' + S.gone);
    line('متوسط التغير', S.avg + '%');
  }
  if (mailSent.length) {
    console.log('\n  📧 البريد:');
    mailSent.forEach((m) => {
      console.log('    ' + m.node);
      console.log('      to : ' + (m.to || '—'));
      if (m.cc) console.log('      cc : ' + m.cc);
      console.log('      ✅ قبلهم السيرفر: ' + (m.accepted.join(', ') || '—'));
      if (m.rejected.length) console.log('      ❌ رفضهم السيرفر: ' + m.rejected.join(', '));
    });
  }
  console.log('');
}
