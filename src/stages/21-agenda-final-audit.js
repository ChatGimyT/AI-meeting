/* ── 21. أجندة التدقيق النهائي قبل النشر ── */
const REG = $('📚 Profiles Registry').first().json.profiles;
const s   = $input.first().json.state;
const cfg = H.cfgOf(REG, s);

s.stage = 'final_audit';

const userText = [
  '## المدخلات', '',
  H.articleBlock(s, 'المقال'), '',
  '### نوع المقال المعلن\n' + (s.brief.article_type === 'commercial' ? 'تجاري' : 'معلوماتي / تعليمي'),
  '### الكلمة المفتاحية الرئيسية\n' + (s.brief.primary_keyword || '-'),
  '### السوق المستهدف\n' + (s.brief.target_market || '-'), '',
  H.briefBlock(s, cfg), '',
  H.rulesBlock(cfg), '',
  H.mechanicalBlock(s), '',
  '### معرّفات بنود التقييم المطلوبة في scorecard',
  (cfg.rubric.items || []).map(function (r) { return '- `' + r.id + '` = ' + r.label; }).join('\n'), '',
  '### سجل الجلسة',
  '- عدد الدورات: ' + s.round + ' | إعادات البناء: ' + s.restarts,
  '- مسار البوابة: ' + s.gate.route + (s.gate.reasons.length ? ' | أسباب: ' + s.gate.reasons.join(' | ') : ''),
  '',
  '### مهمتك الآن',
  'نفّذ المراحل السبع كاملة وأعد JSON فقط. لا تجامل.'
].join('\n');

return [H.callFor(cfg, 'final_auditor', userText, s, 'final_audit')];
