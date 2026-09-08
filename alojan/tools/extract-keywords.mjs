#!/usr/bin/env node
/* =============================================================
 * بيقرأ ملف الإكسل ويطلّع قائمة الكلمات الرسمية للأوتوميشن.
 *
 * القاعدة اللي طلبها العميل: **أي كلمة من غير رابط صفحة تُستبعد.**
 * السبب مش تنظيمي — ده اللي بيخلي كل رقم في التقرير قابل للمراجعة
 * في واجهة Search Console بفلتر Query + Page. الكلمة من غير رابط
 * رقمها بيبقى على مستوى الموقع كله، ومحدش يقدر يراجعه.
 *
 *   node alojan/tools/extract-keywords.mjs --xlsx=<path> [--sheet=العوجان]
 * ============================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.slice(k.length + 3) : d;
};
const XLSX  = arg('xlsx', '');
const SHEET = arg('sheet', 'العوجان');
const OUT   = path.join(ROOT, 'keywords', 'alojan.json');
if (!XLSX) { console.error('لازم --xlsx=<path>'); process.exit(1); }

/* openpyxl هو اللي بيقرا الروابط المخفية في الخلايا (hyperlink target) */
const py = `
import json, sys, openpyxl
wb = openpyxl.load_workbook(sys.argv[1])
ws = wb[sys.argv[2]]
rows = []
for r in range(2, ws.max_row + 1):
    kw = ws.cell(r, 2).value
    if kw is None or str(kw).strip() == '':
        rows.append({'__blank': True})
        continue
    cell = ws.cell(r, 5)
    rows.append({
        'row': r,
        'idx': ws.cell(r, 1).value,
        'keyword': str(kw).strip(),
        'sv': ws.cell(r, 3).value,
        'kd': ws.cell(r, 4).value,
        'article': '' if cell.value is None else str(cell.value).strip(),
        'url': cell.hyperlink.target if cell.hyperlink else '',
    })
print(json.dumps(rows, ensure_ascii=False))
`;
const raw = JSON.parse(execFileSync('python3', ['-c', py, XLSX, SHEET], { encoding: 'utf8', maxBuffer: 1 << 26 }));

/* الأقسام: الصفوف الفاضية في الإكسل هي الفاصل بين المجموعات.
 * اسم القسم بيتاخد من المجموعة الحالية في الأوتوميشن (لو الكلمة موجودة)،
 * وإلا من عنوان أول مقالة في المجموعة. */
const prevGroups = {};
try {
  const cur = fs.readFileSync(path.join(ROOT, 'src', 'nodes', 'weekly', 'Keywords.js'), 'utf8');
  const m = cur.match(/const keywords = (\[[\s\S]*?\n\]);/);
  if (m) JSON.parse(m[1]).forEach((k) => { prevGroups[k.keyword] = k.group; });
} catch (e) { /* أول تشغيل */ }

const num = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v).trim();
  if (s === '' || s === '-') return '';
  const n = Number(s.replace(/[^0-9.]/g, ''));
  return isFinite(n) && n > 0 ? Math.round(n) : '';
};

const groups = [];
let cur = [];
raw.forEach((r) => {
  if (r.__blank) { if (cur.length) { groups.push(cur); cur = []; } return; }
  cur.push(r);
});
if (cur.length) groups.push(cur);

const kept = [], dropped = [];
groups.forEach((g) => {
  /* اسم القسم: أول كلمة في المجموعة ليها قسم معروف، وإلا عنوان أول مقالة */
  let name = '';
  for (const r of g) { if (prevGroups[r.keyword]) { name = prevGroups[r.keyword]; break; } }
  if (!name) {
    const withArticle = g.find((r) => r.article && !/لم يتم نشرها/.test(r.article));
    name = withArticle ? withArticle.article.split(':')[0].trim() : 'بدون قسم';
  }
  g.forEach((r) => {
    const rec = {
      group: name,
      page: String(r.url || '').trim(),
      keyword: r.keyword,
      sv: num(r.sv),
      article: r.article,
    };
    if (!rec.page) {
      dropped.push({ keyword: r.keyword, row: r.row, why: r.article || 'مفيش رابط في الإكسل' });
      return;
    }
    kept.push(rec);
  });
});

/* تكرار الكلمة يوقف كل حاجة — صف مكرر معناه رقم مكرر في التقرير */
const seen = {};
const dupes = [];
kept.forEach((k) => { if (seen[k.keyword]) dupes.push(k.keyword); seen[k.keyword] = 1; });
if (dupes.length) { console.error('❌ كلمات مكررة: ' + dupes.join(', ')); process.exit(1); }

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  source: path.basename(XLSX),
  sheet: SHEET,
  extractedAt: new Date().toISOString().slice(0, 10),
  rule: 'أي كلمة من غير رابط صفحة مستهدفة تُستبعد — عشان كل رقم يبقى قابل للمراجعة بفلتر Query + Page',
  keywords: kept,
  dropped,
}, null, 2), 'utf8');

console.log('✅ ' + kept.length + ' كلمة ليها رابط → keywords/alojan.json');
console.log('⛔ ' + dropped.length + ' كلمة اتستبعدت (مفيش رابط):');
dropped.forEach((d) => console.log('   - ' + d.keyword + '  (صف ' + d.row + ' — ' + d.why + ')'));
const byGroup = {};
kept.forEach((k) => { byGroup[k.group] = (byGroup[k.group] || 0) + 1; });
console.log('\nالأقسام:');
Object.keys(byGroup).forEach((g) => console.log('   ' + String(byGroup[g]).padStart(3) + '  ' + g));
