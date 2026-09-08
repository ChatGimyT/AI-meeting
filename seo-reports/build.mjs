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
const arg = (k) => {
  const hit = process.argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.slice(k.length + 3) : '';
};

/* العملاء: كل ملف في clients/ = تقريران (شهري وأسبوعي) */
const CLIENTS = fs.readdirSync(path.join(ROOT, 'clients'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'clients', f), 'utf8')))
  .filter((c) => !arg('client') || c.id === arg('client'));

const TITLE = (id) => id.toUpperCase();

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

let failed = 0, built = 0;
for (const client of CLIENTS)
for (const cadence of CADENCES) {
  const tag = client.id + '/' + cadence;
  const basePath = path.join(ROOT, 'base', client.id, cadence + '.json');
  const wf = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  const nodeDir = path.join(ROOT, 'src', 'nodes', client.id + '-' + cadence);

  /* كتلة إعدادات العميل اللي بتتحقن في نود Config */
  const clientLiteral =
    '/* ===== إعدادات العميل (تتولّد من clients/' + client.id + '.json) ===== */\n' +
    'const CLIENT = ' + JSON.stringify(client, null, 2) + ';\n' +
    'const CADENCE = ' + JSON.stringify(cadence) + ';\n' +
    'const CAD = CLIENT.cadences[CADENCE];\n' +
    'const KEYWORDS_SOURCE = ' + JSON.stringify(client.keywordsFile) + ';';

  /* 1) نودات جديدة — قبل الحقن عشان كودها يتحقن هي كمان */
  const added = patch.nodes(cadence, wf, client) || [];
  for (const n of added) {
    const i = wf.nodes.findIndex((x) => x.name === n.name);
    if (i >= 0) wf.nodes[i] = n; else wf.nodes.push(n);
  }


  /* 2) حقن كود النودات (الجديدة والقديمة)
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
        throw new Error(tag + ': النود «' + node.name + '» موجود في shared/ و' + client.id + '-' + cadence +
                        '/ مع بعض — امسح واحد منهم عشان مايحصلش لبس.');
      }
      file = sharedFile; seenShared.add(base); fromShared++;
    } else if (fs.existsSync(ownFile)) {
      file = ownFile; seenOwn.add(base);
    } else {
      throw new Error(tag + ': مفيش ملف كود للنود «' + node.name + '»');
    }
    let raw = fs.readFileSync(file, 'utf8');
    if (raw.includes('/* @client */')) raw = raw.replace('/* @client */', clientLiteral);
    if (raw.includes('/* @keywords */')) {
      const kw = JSON.parse(fs.readFileSync(path.join(ROOT, client.keywordsFile), 'utf8'));
      raw = raw.replace('/* @keywords */',
        'const KW = ' + JSON.stringify({ keywords: kw.keywords, dropped: kw.dropped,
                                         source: kw.source, extractedAt: kw.extractedAt }, null, 2) + ';');
    }
    const { code, used } = injectLibs(raw, tag + '/' + node.name);
    libUses += used.length;
    node.parameters = Object.assign({}, node.parameters, { jsCode: code.trimEnd() + '\n' });
    injected++;
  }
  /* ملف كود مالوش نود = خطأ صامت لو سكتنا عنه */
  if (fs.existsSync(nodeDir)) {
    for (const f of fs.readdirSync(nodeDir).filter((x) => x.endsWith('.js'))) {
      if (!seenOwn.has(f)) throw new Error(tag + ': ملف كود مالوش نود مقابل: ' + f);
    }
  }
  if (fs.existsSync(sharedDir)) {
    for (const f of fs.readdirSync(sharedDir).filter((x) => x.endsWith('.js'))) {
      if (!seenShared.has(f)) throw new Error('shared: ملف كود مالوش نود مقابل: ' + f);
    }
  }

  /* 3) وصلات */
  Object.assign(wf.connections, patch.connections(cadence, wf, client) || {});

  /* 4) إعدادات + تعديلات حرة */
  Object.assign(wf.settings, patch.settings(cadence, wf, client) || {});
  patch.rewrite(cadence, wf, client);

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
  /* حارس: العميل لازم يعلن كريدنشيال جوجل بتاعه — البناء بينسخ بنية عميل
   * تاني، فلو الكريدنشيال ما اتحقنش التقرير هيسحب من حساب الموقع الغلط. */
  if (!client.googleCredential) {
    errs.push('clients/' + client.id + '.json: ناقصه googleCredential');
  } else {
    const wrong = wf.nodes.filter((n) => n.credentials && n.credentials.googleOAuth2Api &&
      n.credentials.googleOAuth2Api.id !== client.googleCredential.id);
    if (wrong.length) errs.push('كريدنشيال جوجل غلط في: ' + wrong.map((n) => n.name).join(', '));
  }

  /* حارس دائم: أي بناء يرجّع retry على Create Slides يتوقف */
  const cs2 = wf.nodes.find((n) => n.name === 'Create Slides');
  if (cs2 && cs2.retryOnFail) {
    errs.push('Create Slides عليه retryOnFail — الطلب مش idempotent وجوجل هيرد 400.');
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
    console.error('❌ ' + tag + ':\n   ' + errs.join('\n   '));
    continue;
  }

  const cadTitle = cadence === 'monthly' ? 'Monthly' : 'Weekly';
  wf.name = TITLE(client.id) + ' - ' + cadTitle + ' v4';
  const outFile = path.join(ROOT, 'dist', TITLE(client.id) + '-' + cadTitle + '-v4.json');
  const json = JSON.stringify(wf, null, 2);

  if (CHECK && fs.existsSync(outFile) && fs.readFileSync(outFile, 'utf8') !== json) {
    failed++;
    console.error('❌ ' + tag + ': الملف المبني مختلف عن الموجود في dist — شغّل البناء.');
    continue;
  }
  fs.writeFileSync(outFile, json, 'utf8');
  built++;
  console.log('✅ ' + tag.padEnd(16) + ' → ' + path.relative(process.cwd(), outFile) +
              '  (نودات: ' + wf.nodes.length + ' | كود: ' + injected +
              ' منهم ' + fromShared + ' مشترك | حقن مكتبات: ' + libUses +
              ' | ' + (json.length / 1024).toFixed(0) + ' KB)');
}
console.log((failed ? '\n❌ فشل ' + failed : '\n✅ اتبنى ' + built) + ' من ' +
            (CLIENTS.length * CADENCES.length) + ' تقرير.');
process.exit(failed ? 1 : 0);
