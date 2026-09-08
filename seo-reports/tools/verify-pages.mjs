#!/usr/bin/env node
/* =============================================================
 * بيتحقق إن كل رابط في قائمة الكلمات هو فعلًا الرابط اللي جوجل
 * بيسجّله للصفحة دي.
 *
 * ليه ده مهم: فلتر الصفحة في Search Console بيطابق **الرابط الكانوني**
 * بالحرف. لو الرابط في الإكسل بيعمل تحويل (redirect) أو الصفحة معلنة
 * كانوني مختلف، الفلتر بيرجع "مفيش بيانات" — والتقرير بيقول إن الكلمة
 * مالهاش ترتيب وهي في الحقيقة شغالة. ده رقم غلط بيعدّي من غير ما حد
 * يشك فيه، لأن الرابط شغال لما تفتحه بإيدك.
 *
 * الطلبات متسلسلة وبينها فاصل، ومعاها User-Agent معرِّف — الموقع مش
 * موردنا وما ينفعش ندوس عليه.
 *
 *   node alojan/tools/verify-pages.mjs [--delay=800] [--json]
 * ============================================================= */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.slice(k.length + 3) : d;
};
const DELAY  = Number(arg('delay', '800'));
const CLIENT = arg('client', '');
if (!CLIENT) { console.error('لازم --client=<alojan|shoug>'); process.exit(1); }
const AS_JSON = process.argv.includes('--json');
const UA = 'ALOJAN-SEO-Report/1.0 (page verification for Search Console reporting; +https://www.rabeh.org)';

const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'keywords', CLIENT + '.json'), 'utf8'));

/* تطبيع للمقارنة — نفس منطق normUrl جوه الأوتوميشن بالظبط */
function normUrl(u) {
  let s = String(u == null ? '' : u);
  for (let i = 0; i < 2; i++) {
    try { const d = decodeURIComponent(s); if (d === s) break; s = d; } catch (e) { break; }
  }
  return s.trim().toLowerCase()
    .replace(/[#?].*$/, '')
    .replace(/^https?:\/\//, '').replace(/^www\./, '')
    .replace(/\/index\.(html?|php)$/, '/')
    .replace(/\/+$/, '');
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe(url) {
  const out = { url, status: 0, finalUrl: '', canonical: '', error: '' };
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
      signal: AbortSignal.timeout(25000),
    });
    out.status = res.status;
    out.finalUrl = res.url || url;
    const html = await res.text();
    const head = html.slice(0, 200000);
    const m = head.match(/<link[^>]+rel=["']?canonical["']?[^>]*>/i);
    if (m) {
      const h = m[0].match(/href=["']([^"']+)["']/i);
      if (h) {
        let c = h[1].trim();
        if (c.startsWith('/')) { const b = new URL(out.finalUrl); c = b.origin + c; }
        out.canonical = c;
      }
    }
  } catch (e) {
    out.error = String(e && e.message ? e.message : e).slice(0, 200);
    out.unreachable = true;
  }
  return out;
}

/* الروابط المتكررة تُفحص مرة واحدة */
const unique = [];
const seen = {};
src.keywords.forEach((k) => { if (!seen[k.page]) { seen[k.page] = 1; unique.push(k.page); } });

const results = {};
for (let i = 0; i < unique.length; i++) {
  const u = unique[i];
  process.stderr.write('· فحص ' + (i + 1) + '/' + unique.length + ' … ');
  results[u] = await probe(u);
  process.stderr.write(results[u].status + (results[u].error ? ' ' + results[u].error : '') + '\n');
  if (i < unique.length - 1) await sleep(DELAY);
}

/* التصنيف: أي رقم مبني على رابط مش كانوني = رقم غير قابل للمراجعة */
const rows = src.keywords.map((k) => {
  const r = results[k.page] || {};
  const canon = r.canonical || r.finalUrl || '';
  const sameFinal = normUrl(k.page) === normUrl(r.finalUrl || '');
  const sameCanon = canon ? normUrl(k.page) === normUrl(canon) : true;
  let verdict = 'ok', note = 'الرابط مطابق للكانوني';
  /* 403/407 على كل الروابط من غير استثناء = الشبكة اللي احنا فيها هي اللي
   * بتحجب، مش الموقع. الفرق ده مهم: لو حسبناها "روابط مكسورة" هنبعت العميل
   * يصلّح ٢٧ رابط سليم. */
  if (r.error)                  { verdict = 'unreachable'; note = 'مقدرناش نوصل للصفحة: ' + r.error; }
  else if (r.status === 403 || r.status === 407) { verdict = 'blocked'; note = 'HTTP ' + r.status + ' — الأغلب حجب من الشبكة اللي بنفحص منها، مش من الموقع'; }
  else if (r.status >= 400)     { verdict = 'broken';      note = 'HTTP ' + r.status; }
  else if (!sameFinal)       { verdict = 'redirected';  note = 'بيحوّل إلى: ' + (r.finalUrl || '?'); }
  else if (!sameCanon)       { verdict = 'canonical';   note = 'الصفحة معلنة كانوني مختلف: ' + canon; }
  return { keyword: k.keyword, group: k.group, page: k.page,
           status: r.status, finalUrl: r.finalUrl, canonical: canon,
           suggested: canon || r.finalUrl || k.page, verdict, note };
});

if (AS_JSON) { console.log(JSON.stringify({ checkedAt: new Date().toISOString(), rows }, null, 2)); process.exit(0); }

const ICON = { ok: '✅', redirected: '↪️ ', canonical: '⚠️ ', broken: '❌', unreachable: '🚫', blocked: '🚫' };
const tally = {};
rows.forEach((r) => { tally[r.verdict] = (tally[r.verdict] || 0) + 1; });

console.log('\n🔎 فحص الروابط المستهدفة (' + CLIENT + ') — ' + rows.length + ' كلمة على ' + unique.length + ' رابط فريد\n');
rows.forEach((r) => {
  if (r.verdict === 'ok') return;
  console.log(ICON[r.verdict] + ' ' + r.keyword);
  console.log('     في الإكسل : ' + r.page);
  console.log('     ' + r.note);
  if (r.suggested && normUrl(r.suggested) !== normUrl(r.page)) {
    console.log('     المفروض   : ' + r.suggested);
  }
  console.log('');
});
console.log('الخلاصة: ' + Object.keys(tally).map((k) => ICON[k] + ' ' + k + ' ' + tally[k]).join('  |  '));
/* لو كل الروابط اترفضت بنفس الشكل، فالمشكلة في الشبكة — النتيجة مش صالحة */
const blockedAll = rows.length > 1 && rows.every((r) => r.verdict === 'blocked' || r.verdict === 'unreachable');
const bad = rows.filter((r) => r.verdict !== 'ok').length;

if (blockedAll) {
  console.log('\n🚫 كل الروابط اترفضت بنفس الطريقة — الشبكة اللي بنفحص منها هي اللي بتحجب،');
  console.log('   والنتيجة دي **مش دليل** إن فيه رابط غلط. شغّل الأداة من جهاز شبكته مفتوحة،');
  console.log('   أو سيب نود «Verify Target Pages» جوه الأوتوميشن يعمل الفحص ده في كل تشغيلة.\n');
} else {
  console.log(bad ? '\n⛔ ' + bad + ' كلمة رقمها مش هيبقى قابل للمراجعة بفلتر Query + Page لحد ما الرابط يتظبط.\n'
                  : '\n✅ كل الروابط كانونية — كل رقم في التقرير قابل للمراجعة في الواجهة.\n');
}

fs.writeFileSync(path.join(ROOT, 'keywords', CLIENT + '-page-check.json'),
  JSON.stringify({ checkedAt: new Date().toISOString(), rows }, null, 2), 'utf8');
process.exit(blockedAll ? 2 : (bad ? 1 : 0));
