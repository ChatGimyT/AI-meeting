#!/usr/bin/env node
/* تحقق بنيوي من ملف n8n قبل الاستيراد. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(ROOT, 'dist', 'ai-editorial-boardroom.json');
const wf = JSON.parse(fs.readFileSync(file, 'utf8'));
const errs = [], warns = [];

/* 1) المفاتيح الأساسية */
['name', 'nodes', 'connections', 'settings'].forEach((k) => { if (!(k in wf)) errs.push('missing workflow key: ' + k); });

/* 2) العقد */
const names = new Set(), ids = new Set();
for (const n of wf.nodes) {
  ['id', 'name', 'type', 'typeVersion', 'position', 'parameters'].forEach((k) => {
    if (n[k] === undefined) errs.push(n.name + ': missing node key ' + k);
  });
  if (names.has(n.name)) errs.push('duplicate node name: ' + n.name);
  if (ids.has(n.id)) errs.push('duplicate node id: ' + n.id);
  names.add(n.name); ids.add(n.id);
  if (!Array.isArray(n.position) || n.position.length !== 2) errs.push(n.name + ': bad position');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(n.id)) errs.push(n.name + ': id is not a v4 uuid');

  if (n.type === 'n8n-nodes-base.code') {
    try { new vm.Script('(function(){' + n.parameters.jsCode + '})'); }
    catch (e) { errs.push(n.name + ': jsCode syntax error → ' + e.message); }
    if (n.parameters.jsCode.includes('__STAGE__')) errs.push(n.name + ': stage code was not injected');
    if (n.parameters.jsCode.includes('__PROFILES__')) errs.push(n.name + ': profiles were not injected');
    if (!/^\s*return\s|\n\s*return\s/.test(n.parameters.jsCode)) warns.push(n.name + ': no return statement found');
  }
  if ((n.type === 'n8n-nodes-base.webhook' || n.type === 'n8n-nodes-base.formTrigger') && !n.webhookId) {
    errs.push(n.name + ': trigger node needs a webhookId');
  }
}

/* 3) الوصلات */
for (const [from, spec] of Object.entries(wf.connections)) {
  if (!names.has(from)) errs.push('connection from unknown node: ' + from);
  if (!spec.main) { errs.push(from + ': connection has no main'); continue; }
  spec.main.forEach((targets, i) => (targets || []).forEach((t) => {
    if (!names.has(t.node)) errs.push(from + '[' + i + '] → unknown node: ' + t.node);
    if (t.type !== 'main' || typeof t.index !== 'number') errs.push(from + '[' + i + ']: bad connection shape');
  }));
}

/* 4) مراجع $('اسم العقدة') داخل الكود يجب أن تشير لعقد موجودة */
for (const n of wf.nodes) {
  if (n.type !== 'n8n-nodes-base.code') continue;
  const refs = [...n.parameters.jsCode.matchAll(/\$\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);
  [...new Set(refs)].forEach((r) => { if (!names.has(r)) errs.push(n.name + ": references unknown node $('" + r + "')"); });
}
/* نفس الفحص داخل تعبيرات العقد الأخرى */
for (const n of wf.nodes) {
  const json = JSON.stringify(n.parameters);
  [...json.matchAll(/\$\(\\?'([^'\\]+)\\?'\)/g)].forEach((m) => {
    if (!names.has(m[1])) errs.push(n.name + ": expression references unknown node '" + m[1] + "'");
  });
}

/* 5) عقد لا تصلها أي وصلة (عدا المشغّلات والملاحظات) */
const reached = new Set(['▶️ Run Manually', '📨 Form Intake', '🔌 Webhook Intake']);
Object.values(wf.connections).forEach((s) => s.main.forEach((t) => (t || []).forEach((x) => reached.add(x.node))));
wf.nodes.forEach((n) => {
  if (n.type === 'n8n-nodes-base.stickyNote') return;
  if (!reached.has(n.name)) warns.push('unreachable node: ' + n.name);
});

/* 6) اعتماد النموذج اللغوي */
const llm = wf.nodes.filter((n) => n.type === 'n8n-nodes-base.httpRequest' && n.name.startsWith('🧠'));
llm.forEach((n) => {
  if (!n.credentials || !n.credentials.httpHeaderAuth) errs.push(n.name + ': missing httpHeaderAuth credential slot');
  if (n.parameters.url !== '={{ $json.url }}') errs.push(n.name + ': url must come from the item');
});

const size = (fs.statSync(file).size / 1024).toFixed(0);
console.log('🔎 فحص ' + path.relative(ROOT, file));
console.log('   العقد: ' + wf.nodes.length + ' | الوصلات: ' + Object.keys(wf.connections).length + ' | الحجم: ' + size + ' KB');
warns.forEach((w) => console.log('   ⚠️  ' + w));
if (errs.length) { errs.forEach((e) => console.log('   ❌ ' + e)); console.log('\n❌ فشل التحقق (' + errs.length + ').\n'); process.exit(1); }
console.log('\n✅ الملف صالح للاستيراد في n8n.\n');
