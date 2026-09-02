/* ── 4. أجندة الجلسة الأولى: الاستراتيجية + هندسة الإحاطة ── */
const REG = $('📚 Profiles Registry').first().json.profiles;
const s   = $input.first().json.state;
const cfg = H.cfgOf(REG, s);

s.stage = 'kickoff';
s.round = 1;

const shared = [
  H.brandBlock(cfg),
  '',
  H.briefBlock(s, cfg),
  '',
  H.rulesBlock(cfg)
].join('\n');

const existing = s.brief.existing_article
  ? '\n\n### المقالة الحالية المطلوب تحديثها\n```markdown\n' + H.clip(s.brief.existing_article, 24000) + '\n```'
  : '';

const seats = (cfg.seats && cfg.seats.kickoff) || ['brief_architect', 'strategy_director'];
return seats.map(function (id) {
  return H.callFor(cfg, id,
    shared + existing + '\n\n### مهمتك الآن\nنفّذ دورك المحدد في تعليماتك على هذا الطلب، وأعد JSON فقط.',
    s, 'kickoff');
});
