#!/usr/bin/env node
/* يولّد صفوف الشيت الجاهزة للصق من تعريف الأعمدة نفسه المستخدم في المحرك،
   فلا تنحرف عناوين الشيت عن الكود أبدًا.
     node tools/sheet-template.mjs > benchmark/sheet-template.tsv */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'src', 'stages', '02b-sheet-config.js'), 'utf8');
const ctx = vm.createContext({});
vm.runInContext(src + '\nglobalThis.SHEET = SHEET;', ctx);
const SHEET = ctx.SHEET;

const IN = SHEET.in, OUT = SHEET.out;
const headers = [
  IN.run, IN.status, IN.profile, IN.title, IN.goal, IN.type, IN.market,
  IN.kw, IN.kw_count, IN.kw_secondary, IN.kw_semantic, IN.headings, IN.links,
  IN.citations, IN.cluster, IN.existing, IN.notes,
  OUT.score, OUT.verdict, OUT.violations, OUT.overall, OUT.rounds, OUT.words,
  OUT.vs_reference, OUT.meta_title, OUT.meta_desc, OUT.article, OUT.audit,
  OUT.minutes, OUT.sources, OUT.finished_at, OUT.run_id
].filter((v, i, a) => a.indexOf(v) === i);

const brief = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmark', 'briefs', 'google-ads-ar.json'), 'utf8'));
const nl = (a) => (a || []).join('\n');

const example = {
  [IN.run]: 'FALSE',
  [IN.status]: '',
  [IN.profile]: 'rabeh_article_ar_deepseek',
  [IN.title]: brief.title,
  [IN.goal]: brief.goal,
  [IN.type]: 'تجاري',
  [IN.market]: 'السعودية',
  [IN.kw]: brief.primary_keyword,
  [IN.kw_count]: String(brief.primary_keyword_count),
  [IN.kw_secondary]: nl(brief.secondary_keywords),
  [IN.kw_semantic]: nl(brief.semantic_keywords),
  [IN.headings]: nl(brief.headings),
  [IN.links]: (brief.internal_links || []).map((l) => l.anchor + ' | ' + l.url).join('\n'),
  [IN.citations]: nl(brief.mandatory_citations),
  [IN.cluster]: 'Pillar',
  [IN.existing]: '',
  [IN.notes]: 'صف المعايرة — يقارن مباشرة بالمقال المرجعي'
};

const esc = (v) => {
  const s = String(v == null ? '' : v);
  return /[\t\n"]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
const fmt = process.argv.includes('--csv') ? ',' : '\t';
const line = (o) => headers.map((h) => esc(o[h] || '')).join(fmt);

console.log(headers.map(esc).join(fmt));
console.log(line(example));
console.log(line({ [IN.run]: 'FALSE', [IN.profile]: 'rabeh_article_ar_deepseek', [IN.type]: 'معلوماتي', [IN.market]: 'السعودية' }));
