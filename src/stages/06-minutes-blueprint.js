/* ── 6. تثبيت المخطط + أجندة فريق البحث والاستشهادات ── */
const REG  = $('📚 Profiles Registry').first().json.profiles;
const call = $('🗓️ Agenda: Blueprint Lock').first();
const s    = call.json.state;
const cfg  = H.cfgOf(REG, s);

const text = H.readText($input.first().json);
const err  = H.apiError($input.first().json);
const ruling = H.grabJson(text) || {};
if (err) H.fail(s, 'blueprint_lock', err);

s.blueprint_ruling = ruling;
if (Array.isArray(ruling.revision_brief) && ruling.revision_brief.length) {
  s.blueprint.board_amendments = ruling.revision_brief;
}
s.blueprint.chair_directive = ruling.message_to_writer || '';

H.minute(s, {
  stage: 'blueprint_lock', actor: '🪑 مروان الحكم — رئيس مجلس التحرير',
  headline: 'قرار تثبيت المخطط: ' + (ruling.decision || 'غير محدد'),
  detail: H.clip(ruling.round_summary || text, 1500),
  conflicts: ruling.conflicts_resolved || []
});

/* أجندة البحث */
const claims = []
  .concat(s.blueprint.claims_needing_sources || [])
  .concat(s.blueprint.staleness_checks || []);

const userText = [
  H.brandBlock(cfg), '', H.briefBlock(s, cfg), '',
  '### الادعاءات التي تحتاج مصدرًا (من مهندس الإحاطة)',
  claims.length ? '```json\n' + H.clip(JSON.stringify(claims, null, 1), 8000) + '\n```' : '(لا شيء محدد — ابحثي عن أحدث بيانات الموضوع والمنصات المذكورة فيه.)',
  '',
  '### الأسئلة الإلزامية التي يجب أن يجيب عنها المقال',
  ((s.strategy.must_answer_questions || []).map(function (q) { return '- ' + q; }).join('\n')) || '-',
  '',
  s.brief.mandatory_citations.length
    ? '### استشهادات إلزامية أرسلها المستخدم (تحقّقي منها ولا تحذفيها)\n' + s.brief.mandatory_citations.map(function (c) { return '- ' + c; }).join('\n')
    : '',
  '',
  '### مهمتك الآن',
  'ابحثي فعليًا وجمّعي الأدلة. أولوية البيانات الخاصة بـ«' + (s.brief.target_market || '-') + '».',
  'أعيدي JSON فقط.'
].join('\n');

return [H.callFor(cfg, 'research_lead', userText, s, 'research')];
