// بيقرأ ردود فحص الروابط ويحكم على كل رابط.
//
// الحكم بيدخل بوابة الجودة وبيظهر في الإيميل. مش بيوقف الرن لوحده —
// رابط مكسور مش معناه إن باقي الأرقام غلط — لكنه بيمنع إن رقم مبني على
// رابط مش كانوني يعدّي وهو محسوب "مفيش ظهور".
const prep = $('Prep Page Checks').all();
const kws  = $('Keywords').first().json.keywords || [];
const res  = $input.all();

function normUrl(u) {
  let s = String(u == null ? '' : u);
  for (let i = 0; i < 2; i++) {
    try { const d = decodeURIComponent(s); if (d === s) break; s = d; } catch (e) { break; }
  }
  s = s.trim().toLowerCase();
  s = s.replace(/[#?].*$/, '');
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
  s = s.replace(/\/index\.(html?|php)$/, '/');
  s = s.replace(/\/+$/, '');
  return s;
}

const skipped = !!(prep[0] && prep[0].json.__skipPageCheck);
const byUrl = {};

if (!skipped) {
  prep.forEach(function (p, i) {
    const url = p.json.url;
    const r = (res[i] && res[i].json) || {};
    const err = (r.error !== undefined && r.error !== null)
      ? (typeof r.error === 'string' ? r.error : (r.error.message || JSON.stringify(r.error))).slice(0, 200)
      : '';
    const status = Number(r.statusCode || r.status || 0);
    const finalUrl = String((r.headers && (r.headers.location || r.headers.Location)) || r.url || url);
    const body = typeof r.body === 'string' ? r.body : '';

    let canonical = '';
    const m = body.slice(0, 200000).match(/<link[^>]+rel=["']?canonical["']?[^>]*>/i);
    if (m) {
      const h = m[0].match(/href=["']([^"']+)["']/i);
      if (h) {
        canonical = h[1].trim();
        if (canonical.indexOf('/') === 0) {
          const base = url.match(/^(https?:\/\/[^/]+)/);
          if (base) canonical = base[1] + canonical;
        }
      }
    }

    let verdict = 'ok', note = 'الرابط مطابق للكانوني';
    if (err)                       { verdict = 'unreachable'; note = 'مقدرناش نوصل للصفحة: ' + err; }
    else if (status === 0)         { verdict = 'unreachable'; note = 'مفيش رد من الصفحة'; }
    else if (status >= 500)        { verdict = 'server-error'; note = 'HTTP ' + status; }
    else if (status === 404 || status === 410) { verdict = 'broken'; note = 'HTTP ' + status + ' — الصفحة مش موجودة'; }
    else if (status >= 300 && status < 400)    { verdict = 'redirected'; note = 'HTTP ' + status + ' — بيحوّل إلى: ' + finalUrl; }
    else if (canonical && normUrl(canonical) !== normUrl(url)) {
      verdict = 'canonical'; note = 'الصفحة معلنة كانوني مختلف: ' + canonical;
    }
    byUrl[url] = { url: url, status: status, canonical: canonical, suggested: canonical || finalUrl,
                   verdict: verdict, note: note };
  });
}

/* كل استبعاد أو شبهة بتترجم لكلمات بأسمائها — مش لعدد مجرّد */
const problems = [];
kws.forEach(function (k) {
  const r = byUrl[k.page];
  if (!r || r.verdict === 'ok') return;
  problems.push({ keyword: k.keyword, page: k.page, verdict: r.verdict,
                  note: r.note, suggested: r.suggested });
});

const tally = {};
Object.keys(byUrl).forEach(function (u) { tally[byUrl[u].verdict] = (tally[byUrl[u].verdict] || 0) + 1; });

/* مهم: لو كل الروابط اترفضت بنفس الشكل فالمشكلة في الشبكة اللي n8n شغال
 * عليها، مش في الروابط. إعلان ٢٧ رابط سليم "مكسور" أسوأ من السكوت. */
const total = Object.keys(byUrl).length;
const allFailed = total > 1 && (tally.unreachable || 0) + (tally['server-error'] || 0) === total;

return [{ json: {
  pageCheck: {
    skipped: skipped,
    checked: total,
    tally: tally,
    problems: allFailed ? [] : problems,
    networkBlocked: allFailed,
    results: Object.keys(byUrl).map(function (u) { return byUrl[u]; }),
  },
} }];
