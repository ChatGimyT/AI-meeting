#!/usr/bin/env node
/* =============================================================
 * يبني ملفات n8n الجاهزة للاستيراد من:
 *   base/<cadence>.json     البنية الأصلية (نودات، وصلات، كريدنشيال)
 *   src/lib/*.js            مكتبات مشتركة تُحقن في نودات الكود
 *   src/nodes/<cadence>/    كود كل نود
 *   src/patch.mjs           نودات جديدة + تعديل وصلات + إعدادات
 *
 *   node alojan/build.mjs                 # يبني الاتنين
 *   node alojan/build.mjs --check         # يتأكد إن الدورة كاملة بلا فروق
 * ============================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const CADENCES = ['monthly', 'weekly'];
const CHECK = process.argv.includes('--check');

const slug = (name) => String(name).trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');

/* ---------- المكتبات المشتركة ----------
 * كل مكتبة اسمها ملف، وتُحقن في النود اللي بيطلبها بالعلامة:
 *   /* @use gsc *​/
 * الحقن بيحصل مكان العلامة بالظبط، فترتيب الكود بيفضل مقروء. */
const libDir = path.join(ROOT, 'src', 'lib');
const LIBS = {};
if (fs.existsSync(libDir)) {
  for (const f of fs.readdirSync(libDir).filter((x) => x.endsWith('.js'))) {
    LIBS[f.replace(/\.js$/, '')] = fs.readFileSync(path.join(libDir, f), 'utf8').trimEnd();
  }
}

const USE_RE = /^[ \t]*\/\*\s*@use\s+([a-zA-Z0-9_-]+)\s*\*\/[ \t]*$/gm;

function injectLibs(code, where) {
  const used = [];
  const out = code.replace(USE_RE, (_m, name) => {
    if (!LIBS[name]) throw new Error(where + ': مكتبة غير موجودة @use ' + name);
    used.push(name);
    return '/* ---- مكتبة مشتركة: ' + name + ' (تُولَّد من src/lib/' + name +
           '.js — متعدّلهاش هنا) ---- */\n' + LIBS[name];
  });
  return { code: out, used };
}

/* ---------- الرقعة: نودات جديدة ووصلات ---------- */
let patch = { nodes: () => [], connections: () => ({}), settings: () => ({}), rewrite: () => {} };
const patchPath = path.join(ROOT, 'src', 'patch.mjs');
if (fs.existsSync(patchPath)) {
  patch = Object.assign(patch, await import(pathToFileURL(patchPath).href));
}

let failed = 0;
for (const cadence of CADENCES) {
  const basePath = path.join(ROOT, 'base', cadence + '.json');
  const wf = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  const nodeDir = path.join(ROOT, 'src', 'nodes', cadence);

  /* 1) حقن كود النودات
   * الأولوية لـ src/nodes/shared/ — النود اللي هناك بيتحط في التقريرين
   * بنفس الكود بالحرف، فيستحيل يفترقوا. الفروق الحقيقية بين شهري وأسبوعي
   * بتتقرا من cfg.cadence جوه النود نفسه. */
  const sharedDir = path.join(ROOT, 'src', 'nodes', 'shared');
  const seenShared = new Set(), seenOwn = new Set();
  let injected = 0, libUses = 0, fromShared = 0;
  for (const node of wf.nodes) {
    if (node.type !== 'n8n-nodes-base.code') continue;
    const base = slug(node.name) + '.js';
    const sharedFile = path.join(sharedDir, base);
    const ownFile = path.join(nodeDir, base);
    let file;
    if (fs.existsSync(sharedFile)) {
      if (fs.existsSync(ownFile)) {
        throw new Error(cadence + ': النود «' + node.name + '» موجود في shared/ و' + cadence +
                        '/ مع بعض — امسح واحد منهم عشان مايحصلش لبس.');
      }
      file = sharedFile; seenShared.add(base); fromShared++;
    } else if (fs.existsSync(ownFile)) {
      file = ownFile; seenOwn.add(base);
    } else {
      throw new Error(cadence + ': مفيش ملف كود للنود «' + node.name + '»');
    }
    const raw = fs.readFileSync(file, 'utf8');
    const { code, used } = injectLibs(raw, cadence + '/' + node.name);
    libUses += used.length;
    node.parameters = Object.assign({}, node.parameters, { jsCode: code.trimEnd() + '\n' });
    injected++;
  }
  /* ملف كود مالوش نود = خطأ صامت لو سكتنا عنه */
  for (const f of fs.readdirSync(nodeDir).filter((x) => x.endsWith('.js'))) {
    if (!seenOwn.has(f)) throw new Error(cadence + ': ملف كود مالوش نود مقابل: ' + f);
  }
  if (fs.existsSync(sharedDir)) {
    for (const f of fs.readdirSync(sharedDir).filter((x) => x.endsWith('.js'))) {
      if (!seenShared.has(f)) throw new Error('shared: ملف كود مالوش نود مقابل: ' + f);
    }
  }

  /* 2) نودات جديدة */
  const added = patch.nodes(cadence, wf) || [];
  for (const n of added) {
    const i = wf.nodes.findIndex((x) => x.name === n.name);
    if (i >= 0) wf.nodes[i] = n; else wf.nodes.push(n);
  }

  /* 3) وصلات */
  Object.assign(wf.connections, patch.connections(cadence, wf) || {});

  /* 4) إعدادات + تعديلات حرة */
  Object.assign(wf.settings, patch.settings(cadence, wf) || {});
  patch.rewrite(cadence, wf);

  /* 5) فحص بنيوي قبل الكتابة */
  const names = new Set(wf.nodes.map((n) => n.name));
  const errs = [];
  if (names.size !== wf.nodes.length) errs.push('فيه اسم نود مكرر');
  for (const [from, spec] of Object.entries(wf.connections)) {
    if (!names.has(from)) errs.push('وصلة من نود مش موجود: ' + from);
    for (const outs of (spec.main || [])) {
      for (const t of (outs || [])) {
        if (!names.has(t.node)) errs.push(from + ' → نود مش موجود: ' + t.node);
      }
    }
  }
  for (const n of wf.nodes) {
    if (n.type !== 'n8n-nodes-base.code') continue;
    try { new Function(n.parameters.jsCode); }
    catch (e) { errs.push(n.name + ': خطأ صياغة → ' + e.message); }
    if (/@use\s+[a-zA-Z0-9_-]+\s*\*\//.test(n.parameters.jsCode)) {
      errs.push(n.name + ': فيه @use ما اتحقنش');
    }
  }
  if (errs.length) {
    failed++;
    console.error('❌ ' + cadence + ':\n   ' + errs.join('\n   '));
    continue;
  }

  wf.name = 'ALOJAN - ' + (cadence === 'monthly' ? 'Monthly' : 'Weekly') + ' v4';
  const outFile = path.join(ROOT, 'dist', 'ALOJAN-' + (cadence === 'monthly' ? 'Monthly' : 'Weekly') + '-v4.json');
  const json = JSON.stringify(wf, null, 2);

  if (CHECK && fs.existsSync(outFile) && fs.readFileSync(outFile, 'utf8') !== json) {
    failed++;
    console.error('❌ ' + cadence + ': الملف المبني مختلف عن الموجود في dist — شغّل البناء.');
    continue;
  }
  fs.writeFileSync(outFile, json, 'utf8');
  console.log('✅ ' + cadence + ' → ' + path.relative(process.cwd(), outFile) +
              '  (نودات: ' + wf.nodes.length + ' | كود: ' + injected +
              ' منهم ' + fromShared + ' مشترك | حقن مكتبات: ' + libUses +
              ' | ' + (json.length / 1024).toFixed(0) + ' KB)');
}
process.exit(failed ? 1 : 0);
