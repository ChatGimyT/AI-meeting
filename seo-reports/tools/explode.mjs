#!/usr/bin/env node
/* =============================================================
 * بيفكّ ملفات n8n الأصلية إلى نودات كود منفصلة قابلة للمراجعة.
 * يُشغَّل مرة واحدة عند استيراد نسخة جديدة من n8n — بعدها المصدر
 * هو src/ والملف الأصلي في base/ بيفضل مرجع للبنية بس.
 *
 *   node alojan/tools/explode.mjs
 * ============================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CADENCES = ['monthly', 'weekly'];

/* اسم ملف آمن من اسم النود */
export const slug = (name) => String(name).trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');

for (const cadence of CADENCES) {
  const wf = JSON.parse(fs.readFileSync(path.join(ROOT, 'base', cadence + '.json'), 'utf8'));
  const dir = path.join(ROOT, 'src', 'nodes', cadence);
  fs.mkdirSync(dir, { recursive: true });
  let n = 0;
  for (const node of wf.nodes) {
    if (node.type !== 'n8n-nodes-base.code') continue;
    const code = (node.parameters || {}).jsCode;
    if (typeof code !== 'string') continue;
    fs.writeFileSync(path.join(dir, slug(node.name) + '.js'), code, 'utf8');
    n++;
  }
  console.log('✅ ' + cadence + ': استُخرج ' + n + ' نود كود إلى src/nodes/' + cadence + '/');
}
