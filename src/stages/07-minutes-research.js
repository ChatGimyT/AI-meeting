/* ── 7. محضر البحث + تجهيز فحص الروابط الآلي ── */
const REG  = $('📚 Profiles Registry').first().json.profiles;
const call = $('🗓️ Agenda: Research').first();
const s    = call.json.state;
const cfg  = H.cfgOf(REG, s);

const raw  = $input.first().json;
const text = H.readText(raw);
const err  = H.apiError(raw);
const data = H.grabJson(text) || {};
if (err) H.fail(s, 'research', err);

s.evidence.raw            = data.evidence || [];
s.evidence.platform_updates = data.platform_updates || [];
s.evidence.unverified     = data.unverified || [];
s.evidence.search_urls    = H.readSearchResults(raw);
s.research_queries        = data.search_queries_used || [];

H.minute(s, {
  stage: 'research', actor: '🔎 نورة السند — رئيسة فريق البحث',
  headline: 'جمعت ' + s.evidence.raw.length + ' دليلًا، و' + s.evidence.unverified.length + ' ادعاءً بلا مصدر',
  detail: 'استعلامات البحث: ' + (s.research_queries.join(' | ') || '-') +
          ' | صفحات زارها البحث فعليًا: ' + s.evidence.search_urls.length
});

/* تجهيز عناصر فحص الروابط: رابط واحد لكل عنصر */
const urls = [];
const seen = {};
s.evidence.raw.forEach(function (e) {
  const u = (e && e.url ? String(e.url) : '').trim();
  if (!u || !/^https?:\/\//i.test(u) || seen[u]) return;
  seen[u] = true;
  urls.push({ evidence_id: e.id || '', url: u });
});
/* الروابط الداخلية تُفحص أيضًا حتى لا يُنشر رابط مكسور */
(s.brief.internal_links || []).forEach(function (l) {
  const u = String(l.url || '').trim();
  if (!u || seen[u]) return;
  seen[u] = true;
  urls.push({ evidence_id: 'INTERNAL', url: u });
});

if (!urls.length) {
  return [{ json: { state: s, skip_links: true, url: '', evidence_id: '' } }];
}
return urls.map(function (u, i) {
  return { json: { state: i === 0 ? s : { run_id: s.run_id }, skip_links: false, url: u.url, evidence_id: u.evidence_id } };
});
