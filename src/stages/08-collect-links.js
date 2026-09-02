/* ── 8. تجميع نتائج فحص الروابط + أجندة مدقق الحقائق ── */
const REG   = $('📚 Profiles Registry').first().json.profiles;
const prep  = $('🔗 Prep Link Checks').all();
const s     = prep[0].json.state;
const cfg   = H.cfgOf(REG, s);
const items = $input.all();

const report = [];
if (!prep[0].json.skip_links) {
  prep.forEach(function (p, i) {
    const r  = items[i] ? items[i].json : {};
    const st = Number(r.statusCode || r.status || (r.error && r.error.status) || 0);
    /* 403/405/429 = الخادم موجود لكنه يحجب الفحص الآلي — لا يُعتبر رابطًا مكسورًا */
    const alive = (st >= 200 && st < 400) || st === 403 || st === 405 || st === 429;
    report.push({
      evidence_id: p.json.evidence_id,
      url: p.json.url,
      status: st || 'no_response',
      alive: alive,
      homepage_only: H.isHomepageOnly(p.json.url)
    });
  });
}
s.evidence.link_report = report;

const dead = report.filter(function (r) { return !r.alive; });
const home = report.filter(function (r) { return r.homepage_only && r.evidence_id !== 'INTERNAL'; });

H.minute(s, {
  stage: 'link_check', actor: '🔗 المفتش الآلي للروابط',
  headline: 'فُحص ' + report.length + ' رابطًا — ' + dead.length + ' معطّل، ' + home.length + ' رابط صفحة رئيسية',
  detail: dead.map(function (d) { return d.url + ' → ' + d.status; }).join(' | ') || 'كل الروابط تستجيب'
});

const userText = [
  H.briefBlock(s, cfg), '',
  '### حزمة الأدلة الخام من فريق البحث',
  '```json\n' + H.clip(JSON.stringify(s.evidence.raw, null, 1), 16000) + '\n```',
  '',
  '### تقرير فحص الروابط الآلي (حقائق لا آراء)',
  '```json\n' + H.clip(JSON.stringify(report, null, 1), 6000) + '\n```',
  '',
  s.evidence.platform_updates.length
    ? '### تحديثات المنصات المرصودة\n```json\n' + H.clip(JSON.stringify(s.evidence.platform_updates, null, 1), 4000) + '\n```'
    : '',
  '',
  '### مهمتك الآن',
  'اعتمد أو ارفض كل دليل. أي دليل رابطه غير حي (alive=false) أو homepage_only=true يُرفض تلقائيًا.',
  'ابنِ لكل دليل معتمد سطر مصدر جاهزًا للصق في قسم «المصادر المستخدمة».',
  'أعد JSON فقط.'
].join('\n');

return [H.callFor(cfg, 'fact_checker', userText, s, 'factcheck')];
