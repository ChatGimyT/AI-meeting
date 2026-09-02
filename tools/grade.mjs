#!/usr/bin/env node
/* =============================================================
 * مصحّح مستقل: يقيس أي مقال (من المحرك أو من أي مصدر آخر)
 * بنفس كود المفتش الآلي المستخدم داخل الـ workflow — بلا أي نداء API.
 *
 *   node tools/grade.mjs --article=path.md --brief=briefs/x.json
 *   node tools/grade.mjs --article=a.md --brief=b.json --check-links --json
 * ============================================================= */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.slice(k.length + 3) : d;
};
const has = (k) => process.argv.includes('--' + k);

const articlePath = arg('article');
const briefPath   = arg('brief');
if (!articlePath) { console.error('usage: node tools/grade.mjs --article=file.md [--brief=file.json] [--profile=id] [--check-links] [--json]'); process.exit(2); }

/* ---------- تحميل المساعدات والملفات التعريفية ---------- */
const helpersSrc = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'helpers.js'), 'utf8');
const ctx = vm.createContext({ console, Date, Math, JSON, RegExp, Number, String, Array, Object, isFinite });
vm.runInContext(helpersSrc + '\nglobalThis.H = H;', ctx);
const H = ctx.H;

const profileDir = path.join(ROOT, 'src', 'profiles');
const PROFILES = {};
for (const f of fs.readdirSync(profileDir).filter((x) => x.endsWith('.mjs'))) {
  const mod = await import(pathToFileURL(path.join(profileDir, f)).href);
  PROFILES[mod.default.id] = mod.default;
}
const resolved = {};
(function resolveAll() {
  const walk = (id) => {
    if (resolved[id]) return resolved[id];
    const p = PROFILES[id];
    let out = p;
    if (p.extends) { out = H.deepMerge(walk(p.extends), p); delete out.extends; }
    out.id = id;
    return (resolved[id] = out);
  };
  Object.keys(PROFILES).forEach(walk);
})();

/* ---------- بناء الحالة ---------- */
const article = fs.readFileSync(path.resolve(ROOT, articlePath), 'utf8');
const brief = briefPath
  ? JSON.parse(fs.readFileSync(path.resolve(ROOT, briefPath), 'utf8'))
  : { profile_id: 'rabeh_article_ar' };
const profileId = arg('profile', brief.profile_id || 'rabeh_article_ar');
const cfg = resolved[profileId];
if (!cfg) { console.error('unknown profile: ' + profileId); process.exit(2); }

/* المقال المُقيَّم قد لا يأتي من المحرك، فنشتق حزمة الأدلة من قسم المصادر */
const parsed = H.parseArticle(article);
const srcUrls = [...new Set((parsed.sources_section.match(/https?:\/\/[^\s)<>\]"']+/g) || [])
  .map((u) => u.replace(/[.,؛،]+$/, '')))];
const bodyUrls = [...new Set(parsed.links.map((l) => l.url))];
const evidenceUrls = [...new Set(srcUrls.concat(bodyUrls))];

const linkReport = [];
if (has('check-links')) {
  for (const u of evidenceUrls) {
    try {
      const r = await fetch(u, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(15000) });
      linkReport.push({ url: u, status: r.status, alive: (r.status >= 200 && r.status < 400) || [403, 405, 429].includes(r.status) });
    } catch (e) { linkReport.push({ url: u, status: 0, alive: false, error: String(e.message || e) }); }
  }
}

const internalDomains = (cfg.brand && cfg.brand.internal_domains) || [];
const state = {
  run_id: 'grade', round: 1, restarts: 0,
  brief: Object.assign({
    primary_keyword: '', primary_keyword_count: 0,
    secondary_keywords: [], internal_links: [], article_type: 'commercial'
  }, brief),
  profile_id: profileId, overrides: null,
  article, sections: [], section_plan: [],
  evidence: {
    approved: evidenceUrls
      .filter((u) => !H.isInternal(u, internalDomains))
      .map((u, i) => ({ id: 'G' + (i + 1), url: u, publisher: '', page_title: '', figure: '' })),
    rejected: [], unverified: [], stale: [], must_remove: [], link_report: linkReport
  },
  minutes: [], errors: [], warnings: [], mechanical: {}
};

/* ---------- تشغيل كود المفتش الآلي نفسه ---------- */
const stage = fs.readFileSync(path.join(ROOT, 'src', 'stages', '14-mechanical-inspector.js'), 'utf8');
const fn = vm.runInContext(
  '(function($input, $){' + helpersSrc + '\n' + stage + '})', ctx);
fn(
  { first: () => ({ json: { state } }), all: () => [{ json: { state } }] },
  (name) => ({ first: () => ({ json: { profiles: resolved } }), all: () => [{ json: { profiles: resolved } }] })
);

const m = state.mechanical;
const hard = m.checks.filter((c) => !c.pass && c.severity === 'high');
const soft = m.checks.filter((c) => !c.pass && c.severity !== 'high');
const scored = m.checks.length;
const pct = Math.round(((scored - hard.length - soft.length * 0.4) / scored) * 100);

const result = {
  article: path.relative(ROOT, path.resolve(ROOT, articlePath)),
  profile: profileId,
  pass: m.pass,
  score_pct: pct,
  hard_failures: hard.length,
  soft_failures: soft.length,
  measured: m.measured,
  frontmatter: m.frontmatter,
  checks: m.checks,
  link_report: linkReport
};

if (has('json')) { console.log(JSON.stringify(result, null, 2)); process.exit(m.pass ? 0 : 1); }

console.log('\n📏 تصحيح: ' + result.article + '   [' + profileId + ']');
console.log('   ' + Object.entries(m.measured).map(([k, v]) => k + '=' + v).join(' · '));
console.log('');
m.checks.forEach((c) => {
  console.log('  ' + (c.pass ? '✅' : c.severity === 'high' ? '❌' : '⚠️ ') + ' ' + c.id.padEnd(26) + ' ' + String(c.detail).slice(0, 100));
});
if (linkReport.length) {
  console.log('\n  🔗 فحص الروابط:');
  linkReport.forEach((l) => console.log('    ' + (l.alive ? '✅' : '❌') + ' ' + l.status + '  ' + l.url.slice(0, 90)));
}
console.log('\n  الحكم: ' + (m.pass ? 'اجتاز ✅' : 'راسب ❌') +
            '   |   الدرجة الآلية: ' + pct + '%   |   مخالفات حرجة: ' + hard.length + '   |   ملاحظات: ' + soft.length + '\n');
process.exit(m.pass ? 0 : 1);
