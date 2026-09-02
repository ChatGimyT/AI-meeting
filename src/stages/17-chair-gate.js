/* ── 17. قرار رئيس المجلس + البوابة (Gate) ────────────────────────
 * البوابة لا تصدّق رئيس المجلس على عماه: تتحقق من الأرقام بنفسها.
 * ─────────────────────────────────────────────────────────────── */
const REG  = $('📚 Profiles Registry').first().json.profiles;
const call = $('🗓️ Agenda: Chair Ruling').first();
const s    = call.json.state;
const cfg  = H.cfgOf(REG, s);

const raw  = $input.first().json;
const text = H.readText(raw);
const err  = H.apiError(raw);
const ruling = H.grabJson(text) || {};
if (err) H.fail(s, 'chair_ruling', err);

s.chair = ruling;

/* --- الحقائق التي تحكم البوابة --- */
const th        = cfg.rubric.threshold;
const scores    = Object.assign({}, s.round_scores, ruling.scores_override || {});
const belowList = Object.keys(scores).filter(function (k) {
  const v = typeof scores[k] === 'object' ? Number(scores[k].score) : Number(scores[k]);
  return isFinite(v) && v < th;
});
const criticalCount = (s.panel || []).reduce(function (n, r) { return n + ((r.critical_issues || []).length); }, 0)
                    + ((ruling.blockers || []).length ? 0 : 0);
const mechPass  = s.mechanical && s.mechanical.pass;

const gateReasons = [];
if (!mechPass && cfg.gate.require_mechanical_pass) gateReasons.push('المفتش الآلي: ' + (s.mechanical.hard_failures || 0) + ' مخالفة حرجة');
if (belowList.length) gateReasons.push('بنود تحت العتبة: ' + belowList.join('، '));
if (criticalCount && cfg.gate.require_zero_critical) gateReasons.push('أخطاء حرجة من الطاولة: ' + criticalCount);

const qualityPass = gateReasons.length === 0;
const roundsLeft  = s.round < cfg.gate.max_rounds;

/* --- توجيه المسار --- */
let route;
if (qualityPass) {
  route = 'approve';
} else if (!roundsLeft) {
  if (ruling.decision === 'restart' && s.restarts < cfg.gate.max_restarts) route = 'restart';
  else route = cfg.gate.ship_with_notes_when_exhausted ? 'exhausted' : 'blocked';
} else if (ruling.decision === 'restart' && s.restarts < cfg.gate.max_restarts) {
  route = 'restart';
} else {
  route = 'revise';
}

/* المفتش الآلي يفرض بنوده في موجز التعديل مهما قال المجلس */
const forced = (s.mechanical.checks || [])
  .filter(function (c) { return !c.pass; })
  .map(function (c, i) {
    return { order: i + 1, instruction: 'أصلح مخالفة المفتش الآلي «' + c.id + '»: ' + c.detail,
             section: 'كامل النص', raised_by: ['mechanical_inspector'], must_fix: c.severity === 'high' };
  });
const chairBrief = (ruling.revision_brief || []).map(function (b, i) {
  return Object.assign({ order: forced.length + i + 1 }, b);
});
s.revision_brief = forced.concat(chairBrief);

s.gate = {
  route: route, quality_pass: qualityPass, mechanical_pass: !!mechPass,
  below_threshold: belowList, critical_count: criticalCount,
  reasons: gateReasons, round: s.round, max_rounds: cfg.gate.max_rounds,
  restarts: s.restarts, chair_decision: ruling.decision || 'revise'
};
s.route = route;

H.minute(s, {
  stage: 'gate', actor: '🪑 مروان الحكم + 🚪 البوابة',
  headline: 'قرار المجلس: ' + (ruling.decision || '-') + ' → مسار البوابة: ' + route,
  detail: qualityPass ? 'كل البنود فوق العتبة والفحص الآلي ناجح.' : gateReasons.join(' | '),
  conflicts: ruling.conflicts_resolved || [],
  rejected_notes: ruling.rejected_notes || [],
  brief_items: s.revision_brief.length
});

return [{ json: { state: s, route: route } }];
