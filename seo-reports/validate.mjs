#!/usr/bin/env node
// فحص ساكن لملفات n8n المولّدة — بيمسك الأخطاء اللي بتظهر بس وقت الرن:
// كود مكسور، إشارة لنود مش موجود أو بيشتغل بعدين، وصلة ناقصة، كريدنشيال ناقص.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(HERE, 'dist');

let failures = 0;
const fail = (wf, msg) => { failures++; console.error(`  ✗ [${wf}] ${msg}`); };
const ok = (msg) => console.log(`  ✓ ${msg}`);

// النودات اللي مسموح ليها تكون فاضية الإخراج ومع ذلك الكود يقراها
const NEEDS_CREDENTIALS = new Set(['n8n-nodes-base.httpRequest', 'n8n-nodes-base.emailSend']);

function reachableBefore(wf) {
  // بيرجّع map: اسم النود → Set بأسماء النودات اللي أكيد اشتغلت قبله
  const incoming = {};
  for (const [from, conn] of Object.entries(wf.connections)) {
    for (const outs of conn.main || []) {
      for (const c of outs || []) {
        (incoming[c.node] = incoming[c.node] || []).push(from);
      }
    }
  }
  const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));
  const memo = {};
  const ancestors = (name, seen = new Set()) => {
    if (memo[name]) return memo[name];
    if (seen.has(name)) return new Set();
    seen.add(name);
    const out = new Set();
    for (const p of incoming[name] || []) {
      out.add(p);
      for (const a of ancestors(p, seen)) out.add(a);
    }
    memo[name] = out;
    return out;
  };
  const res = {};
  for (const n of wf.nodes) res[n.name] = ancestors(n.name);
  return { res, byName };
}

for (const file of fs.readdirSync(DIST).filter((f) => f.endsWith('.json')).sort()) {
  const wf = JSON.parse(fs.readFileSync(path.join(DIST, file), 'utf8'));
  console.log(`\n${wf.name}`);
  const names = new Set(wf.nodes.map((n) => n.name));

  // 1) أسماء فريدة
  if (names.size !== wf.nodes.length) fail(wf.name, 'فيه أسماء نودات مكررة');

  // 2) الوصلات بتشاور على نودات موجودة
  for (const [from, conn] of Object.entries(wf.connections)) {
    if (!names.has(from)) fail(wf.name, `وصلة من نود مش موجود: ${from}`);
    for (const outs of conn.main || []) {
      for (const c of outs || []) {
        if (!names.has(c.node)) fail(wf.name, `وصلة لنود مش موجود: ${c.node}`);
      }
    }
  }

  // 3) مفيش نود معزول (غير التريجرز)
  const targets = new Set();
  for (const conn of Object.values(wf.connections)) {
    for (const outs of conn.main || []) for (const c of outs || []) targets.add(c.node);
  }
  for (const n of wf.nodes) {
    const isTrigger = n.type.endsWith('Trigger');
    if (!isTrigger && !targets.has(n.name)) fail(wf.name, `نود مالوش أي مدخل: ${n.name}`);
  }

  // 4) كود النودات يترجم من غير أخطاء + مفيش placeholders فاضلة
  for (const n of wf.nodes) {
    const js = n.parameters?.jsCode;
    if (!js) continue;
    const left = js.match(/__[A-Z][A-Z0-9_]*__/g);
    if (left) fail(wf.name, `${n.name}: فاضل placeholder ${[...new Set(left)].join(', ')}`);
    try {
      // eslint-disable-next-line no-new-func
      new Function('$', '$input', '$json', js);
    } catch (e) {
      fail(wf.name, `${n.name}: كود مكسور — ${e.message}`);
    }
  }

  // 5) كل $('X') بيشاور على نود موجود وبيشتغل قبله
  const { res: ancestorsOf } = reachableBefore(wf);
  for (const n of wf.nodes) {
    const js = n.parameters?.jsCode;
    if (!js) continue;
    const refs = [...js.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]);
    for (const r of new Set(refs)) {
      if (!names.has(r)) { fail(wf.name, `${n.name}: بيشاور على نود مش موجود $('${r}')`); continue; }
      if (!ancestorsOf[n.name].has(r)) {
        fail(wf.name, `${n.name}: بيشاور على $('${r}') وهو مش أكيد بيشتغل قبله`);
      }
    }
  }

  // 6) نفس الفحص على تعبيرات الـ HTTP/Email
  for (const n of wf.nodes) {
    const blob = JSON.stringify(n.parameters || {});
    const refs = [...blob.matchAll(/\\?\$\('([^']+)'\)/g)].map((m) => m[1]);
    for (const r of new Set(refs)) {
      if (!names.has(r)) { fail(wf.name, `${n.name}: تعبير بيشاور على نود مش موجود $('${r}')`); continue; }
      if (!ancestorsOf[n.name].has(r)) {
        fail(wf.name, `${n.name}: تعبير بيشاور على $('${r}') وهو مش أكيد بيشتغل قبله`);
      }
    }
  }

  // 7) كل نود HTTP/Email معاه كريدنشيال
  for (const n of wf.nodes) {
    if (!NEEDS_CREDENTIALS.has(n.type)) continue;
    if (!n.credentials || !Object.keys(n.credentials).length) {
      fail(wf.name, `${n.name}: من غير كريدنشيال`);
    }
  }

  // 8) الشرط الحرج: GSC Query لازم alwaysOutputData = false
  for (const nm of ['GSC Query', 'GSC Retry Query']) {
    const n = wf.nodes.find((x) => x.name === nm);
    if (!n) { fail(wf.name, `نود ${nm} مش موجود`); continue; }
    if (n.alwaysOutputData) {
      fail(wf.name, `${nm}: alwaysOutputData لازم تكون false عشان مايتخلقش عنصر فاضي يتقري غلط`);
    }
    if (n.onError !== 'continueRegularOutput') {
      fail(wf.name, `${nm}: onError لازم تكون continueRegularOutput عشان نقدر نعرف الطلب اللي فشل`);
    }
    if (!n.retryOnFail || n.maxTries < 3) fail(wf.name, `${nm}: إعادة المحاولة ناقصة`);
  }

  // 9) الإيميلات: نسخة نصية + إلغاء توقيع n8n
  for (const n of wf.nodes.filter((x) => x.type === 'n8n-nodes-base.emailSend')) {
    if (n.parameters.emailFormat !== 'both') fail(wf.name, `${n.name}: emailFormat لازم تكون both`);
    if (!n.parameters.text) fail(wf.name, `${n.name}: مفيش نسخة نصية`);
    if (n.parameters.options?.appendAttribution !== false) {
      fail(wf.name, `${n.name}: appendAttribution لازم تكون false`);
    }
    if (!String(n.parameters.fromEmail).includes('mailFromDisplay')) {
      fail(wf.name, `${n.name}: fromEmail لازم يستخدم mailFromDisplay`);
    }
  }

  // 9ب) مفيش أي أثر للـ AI (اتشال بناءً على طلب صريح)
  const blobAll = JSON.stringify(wf);
  for (const bad of ['deepseek', 'api.openai.com', 'choices[0]', 'Build Prompt']) {
    if (blobAll.toLowerCase().includes(bad.toLowerCase())) {
      fail(wf.name, `فيه أثر للـ AI المفروض اتشال: ${bad}`);
    }
  }

  // 9ج) تنبيه فشل GSC لازم يكون تشخيصي مش نص ثابت
  const alert = wf.nodes.find((n) => n.name === 'GSC Alert Email');
  if (alert && !String(alert.parameters.html).includes('alertHtml')) {
    fail(wf.name, 'GSC Alert Email: لازم ياخد نصه من نود GSC Diagnose مش نص ثابت');
  }
  const diagOuts = wf.connections['GSC Access Check']?.main || [];
  if (diagOuts[1]?.[0]?.node !== 'List GSC Sites') {
    fail(wf.name, 'فرع فشل GSC لازم يعدّي على List GSC Sites قبل التنبيه');
  }

  // 10) الشيت بيتكتب بقيمة مبنية في الكود مش بتعبير طويل
  const write = wf.nodes.find((n) => n.name === 'Write To Sheet');
  if (!String(write?.parameters?.jsonBody || '').includes('sheetValues')) {
    fail(wf.name, 'Write To Sheet: لازم يكتب $json.sheetValues');
  }

  // 11) بوابة الجودة قبل الكتابة
  const gateOuts = wf.connections['Data Quality Gate']?.main || [];
  if (gateOuts[0]?.[0]?.node !== 'Write To Sheet') {
    fail(wf.name, 'الفرع الناجح من Data Quality Gate لازم يروح لـ Write To Sheet');
  }
  if (gateOuts[1]?.[0]?.node !== 'Data Alert Email') {
    fail(wf.name, 'الفرع الفاشل من Data Quality Gate لازم يروح لـ Data Alert Email');
  }

  // 12) عدد الكلمات = عدد خانات Search Volume
  const kwNode = wf.nodes.find((n) => n.name === 'Keywords');
  const svNode = wf.nodes.find((n) => n.name === 'Search Volume');
  const kwCount = (kwNode.parameters.jsCode.match(/"keyword":/g) || []).length;
  const svCount = svNode.parameters.assignments.assignments.length;
  if (kwCount !== svCount) fail(wf.name, `عدد الكلمات ${kwCount} مش مساوي خانات Search Volume ${svCount}`);
  else ok(`${kwCount} كلمة متطابقة بين Keywords و Search Volume`);

  ok(`${wf.nodes.length} نود — الفحص خلص`);
}

console.log(failures ? `\n✗ ${failures} مشكلة` : '\n✓ كل الملفات سليمة');
process.exit(failures ? 1 : 0);
