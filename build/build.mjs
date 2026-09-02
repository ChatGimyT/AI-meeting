#!/usr/bin/env node
/* =============================================================
 * يجمّع ملف n8n واحد قابل للنسخ واللصق من مصادر المشروع.
 *   node build/build.mjs
 * ============================================================= */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { nodes, connections } from './blueprint.mjs';

const ROOT     = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC      = path.join(ROOT, 'src');
const DIST     = path.join(ROOT, 'dist');


/* ---------- خيارات سطر الأوامر ---------- */
const argv = process.argv.slice(2);
const arg = (k, d) => {
  const hit = argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.slice(k.length + 3) : d;
};

const VARIANT   = arg('variant', 'default');
const OUT       = arg('out', VARIANT === 'default'
                  ? 'dist/ai-editorial-boardroom.json'
                  : 'dist/ai-editorial-boardroom-' + VARIANT + '.json');
const CRED_TYPE = arg('credential-type', 'httpHeaderAuth');
const CRED_ID   = arg('credential-id', 'REPLACE_ME');
const CRED_NAME = arg('credential-name', 'LLM API Key');
const DEF_PROF  = arg('default-profile', 'rabeh_article_ar');
const SHEET_DOC = arg('sheet-id', '');
const SHEET_TAB = arg('sheet-tab', '');
const GS_TYPE   = arg('sheets-credential-type', 'googleSheetsOAuth2Api');
const GS_ID     = arg('sheets-credential-id', 'zqpCaDcnpV6T6BqM');
const GS_NAME   = arg('sheets-credential-name', 'Google Sheets account');
const WF_NAME   = arg('name', VARIANT === 'default'
                  ? 'AI Editorial Boardroom — محرك كتابة المحتوى بطاولة اجتماعات'
                  : 'AI Editorial Boardroom — ' + VARIANT);

/* uuid ثابت من الاسم حتى تبقى الفروق في git نظيفة */
const uid = (seed) => {
  const h = crypto.createHash('sha1').update('n8n-boardroom::' + seed).digest('hex');
  return [h.slice(0, 8), h.slice(8, 12), '4' + h.slice(13, 16),
          ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20), h.slice(20, 32)].join('-');
};

/* 1) مكتبة المساعدات */
const helpersSrc = fs.readFileSync(path.join(SRC, 'lib', 'helpers.js'), 'utf8');
/* تُحقن كتلة المساعدات في 22 عقدة، فتُنزع منها أسطر التعليقات المستقلة فقط
   (لا يُمس أي سطر يحتوي كودًا، فتبقى الصياغات النظامية regex سليمة). */
const helpers = helpersSrc
  .split('\n')
  .filter((l) => {
    const t = l.trim();
    if (t === '') return false;
    return !(t.startsWith('//') || t.startsWith('/*') || t.startsWith('*/') || t.startsWith('* ') || t === '*');
  })
  .join('\n')
  .trimEnd();

/* 2) الملفات التعريفية */
const profileDir = path.join(SRC, 'profiles');
const profileFiles = fs.readdirSync(profileDir).filter((f) => f.endsWith('.mjs')).sort();
const PROFILES = {};
for (const f of profileFiles) {
  const mod = await import(pathToFileURL(path.join(profileDir, f)).href);
  const p = mod.default;
  if (!p || !p.id) throw new Error('Profile file missing default export with id: ' + f);
  PROFILES[p.id] = p;
}
const profilesLiteral =
  '/* ===== PROFILES — عدّل هنا فقط ===== */\nconst PROFILES = ' +
  JSON.stringify(PROFILES, null, 2) + ';';

/* 2b) المقال المرجعي — يُحقن في عقدة المقارنة */
const refPath = path.join(ROOT, arg('reference', 'benchmark/gold/google-ads-ar.md'));
const refArticle = fs.existsSync(refPath) ? fs.readFileSync(refPath, 'utf8') : '';
const referenceLiteral =
  '/* ===== المقال المرجعي (يُولَّد من ' + path.relative(ROOT, refPath) + ') ===== */\n' +
  'const REFERENCE = ' + JSON.stringify({
    name: path.basename(refPath),
    score: Number(arg('reference-score', '100')),
    article: refArticle
  }, null, 1) + ';';

/* 3) بناء العقد */
const banner = (title) =>
  '/* ═══════════════════════════════════════════════════════════\n' +
  ' * ' + title + '\n' +
  ' * ⚠️ لا تعدّل كتلة المساعدات (H) يدويًا — تُولَّد من src/lib/helpers.js\n' +
  ' * ═══════════════════════════════════════════════════════════ */\n';

const out = [];
let codeNodes = 0, llmNodes = 0;

for (const n of nodes) {
  const node = {
    parameters: JSON.parse(JSON.stringify(n.parameters || {})),
    id: uid(n.name),
    name: n.name,
    type: n.type,
    typeVersion: n.typeVersion,
    position: n.pos
  };
  if (n.webhookId) node.webhookId = n.webhookId;

  /* ---- ربط اعتماد النموذج اللغوي ---- */
  if (n.credentials && n.credentials.httpHeaderAuth && n.type === 'n8n-nodes-base.httpRequest') {
    if (CRED_TYPE === 'httpHeaderAuth') {
      node.credentials = { httpHeaderAuth: { id: CRED_ID, name: CRED_NAME } };
    } else {
      /* اعتماد جاهز في n8n (مثال: deepSeekApi) بدل Header Auth العام */
      node.credentials = { [CRED_TYPE]: { id: CRED_ID, name: CRED_NAME } };
      node.parameters.authentication = 'predefinedCredentialType';
      node.parameters.nodeCredentialType = CRED_TYPE;
      delete node.parameters.genericAuthType;
    }
  }

  /* ---- اعتماد شيت جوجل ---- */
  if (n.credentials && n.credentials.googleSheetsOAuth2Api) {
    node.credentials = { [GS_TYPE]: { id: GS_ID, name: GS_NAME } };
    if (SHEET_DOC && node.parameters.documentId) node.parameters.documentId.value = SHEET_DOC;
    if (SHEET_TAB && node.parameters.sheetName) {
      node.parameters.sheetName.value = SHEET_TAB;
      node.parameters.sheetName.cachedResultName = SHEET_TAB;
    }
  }

  /* ---- الملف التعريفي الافتراضي في عقدة الطلب ---- */
  if (n.name === '📥 Brief — EDIT ME' && DEF_PROF !== 'rabeh_article_ar') {
    const b = JSON.parse(node.parameters.jsonOutput);
    b.profile_id = DEF_PROF;
    node.parameters.jsonOutput = JSON.stringify(b, null, 2);
  }
  if (n.retryOnFail) { node.retryOnFail = true; node.maxTries = n.maxTries || 3; node.waitBetweenTries = n.waitBetweenTries || 5000; }
  if (n.onError) node.onError = n.onError;
  if (n.note) { node.notes = n.note; node.notesInFlow = true; }

  if (n.stage) {
    const file = path.join(SRC, 'stages', n.stage + '.js');
    let stageCode = fs.readFileSync(file, 'utf8');
    if (stageCode.includes('/* __PROFILES__ */')) stageCode = stageCode.replace('/* __PROFILES__ */', profilesLiteral);
    if (stageCode.includes('/* __REFERENCE__ */')) stageCode = stageCode.replace('/* __REFERENCE__ */', referenceLiteral);
    if (stageCode.includes('/* __SHEET__ */')) {
      let sheetSrc = fs.readFileSync(path.join(SRC, 'stages', '02b-sheet-config.js'), 'utf8');
      if (SHEET_DOC) sheetSrc = sheetSrc.replace(/document_id: '[^']*'/, "document_id: '" + SHEET_DOC + "'");
      if (SHEET_TAB) sheetSrc = sheetSrc.replace(/sheet_name: '[^']*'/, "sheet_name: '" + SHEET_TAB + "'");
      stageCode = stageCode.replace('/* __SHEET__ */', sheetSrc.trimEnd());
    }
    node.parameters.jsCode = banner(n.name) + helpers + '\n\n' + stageCode.trimEnd() + '\n';
    codeNodes++;
  }
  if (n.type === 'n8n-nodes-base.httpRequest' && n.name.startsWith('🧠')) llmNodes++;
  out.push(node);
}

/* 4) الوصلات */
const conn = {};
for (const [from, outputs] of Object.entries(connections)) {
  conn[from] = { main: outputs.map((targets) =>
    targets.map((t) => ({ node: t, type: 'main', index: 0 }))) };
}

/* 5) الملف النهائي */
const workflow = {
  name: WF_NAME,
  nodes: out,
  connections: conn,
  pinData: {},
  settings: {
    executionOrder: 'v1',
    saveManualExecutions: true,
    saveExecutionProgress: true,
    saveDataErrorExecution: 'all',
    saveDataSuccessExecution: 'all',
    executionTimeout: 7200,
    timezone: 'Asia/Riyadh'
  },
  meta: { instanceId: 'ai-editorial-boardroom', templateCredsSetupCompleted: false },
  tags: []
};

const OUT_FILE = path.join(ROOT, OUT);
fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(workflow, null, 2), 'utf8');

/* 6) تقرير */
const personaCount = Object.values(PROFILES).reduce((n, p) => n + Object.keys(p.roster || {}).length, 0);
const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(0);
console.log('✅ تم البناء: ' + path.relative(ROOT, OUT_FILE) + (VARIANT !== 'default' ? '   [' + VARIANT + ']' : ''));
console.log('   الاعتماد: ' + CRED_TYPE + ' → id=' + CRED_ID + ' name="' + CRED_NAME + '"');
console.log('   الملف الافتراضي في الطلب: ' + DEF_PROF);
console.log('   العقد: ' + out.length + ' (كود: ' + codeNodes + ' | نداءات نموذج: ' + llmNodes + ')');
console.log('   الملفات التعريفية: ' + Object.keys(PROFILES).join(', '));
console.log('   الشخصيات المعرَّفة: ' + personaCount);
console.log('   الحجم: ' + kb + ' KB');
