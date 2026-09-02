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
const OUT_FILE = path.join(DIST, 'ai-editorial-boardroom.json');

const WF_NAME = 'AI Editorial Boardroom — محرك كتابة المحتوى بطاولة اجتماعات';

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
  if (n.credentials) node.credentials = n.credentials;
  if (n.retryOnFail) { node.retryOnFail = true; node.maxTries = n.maxTries || 3; node.waitBetweenTries = n.waitBetweenTries || 5000; }
  if (n.onError) node.onError = n.onError;
  if (n.note) { node.notes = n.note; node.notesInFlow = true; }

  if (n.stage) {
    const file = path.join(SRC, 'stages', n.stage + '.js');
    let stageCode = fs.readFileSync(file, 'utf8');
    if (stageCode.includes('/* __PROFILES__ */')) stageCode = stageCode.replace('/* __PROFILES__ */', profilesLiteral);
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

fs.mkdirSync(DIST, { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(workflow, null, 2), 'utf8');

/* 6) تقرير */
const personaCount = Object.values(PROFILES).reduce((n, p) => n + Object.keys(p.roster || {}).length, 0);
const kb = (fs.statSync(OUT_FILE).size / 1024).toFixed(0);
console.log('✅ تم البناء: ' + path.relative(ROOT, OUT_FILE));
console.log('   العقد: ' + out.length + ' (كود: ' + codeNodes + ' | نداءات نموذج: ' + llmNodes + ')');
console.log('   الملفات التعريفية: ' + Object.keys(PROFILES).join(', '));
console.log('   الشخصيات المعرَّفة: ' + personaCount);
console.log('   الحجم: ' + kb + ' KB');
