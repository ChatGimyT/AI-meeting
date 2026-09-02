/* ── 16. محضر طاولة الاجتماعات + رفع الملف لرئيس المجلس ── */
const REG   = $('📚 Profiles Registry').first().json.profiles;
const calls = $('🗓️ Agenda: Review Panel').all();
const s     = calls[0].json.state;
const cfg   = H.cfgOf(REG, s);
const resp  = $input.all();

const reports = [];
resp.forEach(function (item, i) {
  const meta = (calls[i] && calls[i].json.meta) || { persona_id: 'unknown_' + i, persona_name: '?', emoji: '❓' };
  const err  = H.apiError(item.json);
  const text = H.readText(item.json);
  const data = H.grabJson(text);
  if (err || !data) H.fail(s, 'panel', meta.persona_id + ': ' + (err || 'تعذّر قراءة JSON'));

  const rep = Object.assign(
    { persona: meta.persona_id, verdict: 'revise', scores: {}, critical_issues: [], issues: [], opportunities: [], note_to_board: '' },
    data || {}
  );
  rep._persona_id = meta.persona_id;
  rep._name  = meta.persona_name;
  rep._title = meta.persona_title;
  rep._emoji = meta.emoji;
  reports.push(rep);

  const low = Object.keys(rep.scores || {}).filter(function (k) {
    return Number((rep.scores[k] || {}).score) < cfg.rubric.threshold;
  });
  H.minute(s, {
    stage: 'panel', actor: meta.emoji + ' ' + meta.persona_name + ' — ' + meta.persona_title,
    headline: 'الحكم: ' + rep.verdict + (low.length ? ' | بنود تحت العتبة: ' + low.join('، ') : ' | كل بنوده فوق العتبة'),
    detail: rep.note_to_board || H.clip(text, 600),
    scores: rep.scores,
    critical: (rep.critical_issues || []).length
  });
});
s.panel = reports;

/* تجميع الدرجات */
const scores = {};
reports.forEach(function (r) {
  Object.keys(r.scores || {}).forEach(function (k) {
    const v = Number((r.scores[k] || {}).score);
    if (!isFinite(v)) return;
    if (!scores[k] || v < scores[k].score) scores[k] = { score: v, reason: (r.scores[k] || {}).reason || '', by: r._persona_id };
  });
});
s.round_scores = scores;

/* رفع الملف لرئيس المجلس */
const digest = reports.map(function (r) {
  return [
    '#### ' + r._emoji + ' ' + r._name + ' (' + r._persona_id + ') — الحكم: ' + r.verdict,
    'الدرجات: ' + JSON.stringify(r.scores),
    (r.critical_issues || []).length ? 'أخطاء حرجة: ' + JSON.stringify(r.critical_issues) : '',
    (r.issues || []).length ? 'ملاحظات: ' + JSON.stringify(r.issues) : '',
    (r.opportunities || []).length ? 'فرص: ' + JSON.stringify(r.opportunities) : '',
    r.note_to_board ? 'كلمته للمجلس: ' + r.note_to_board : ''
  ].filter(Boolean).join('\n');
}).join('\n\n');

const userText = [
  H.briefBlock(s, cfg), '',
  '### حالة الجلسة',
  '- الدورة: ' + s.round + ' من ' + cfg.gate.max_rounds,
  '- إعادات البناء المستهلكة: ' + s.restarts + ' من ' + cfg.gate.max_restarts,
  '- عتبة القبول: ' + cfg.rubric.threshold + '/10',
  '',
  H.mechanicalBlock(s), '',
  '### تقارير أعضاء الطاولة',
  H.clip(digest, 40000), '',
  '### أدنى درجة لكل بند',
  '```json\n' + JSON.stringify(scores, null, 1) + '\n```', '',
  H.articleBlock(s, 'النص محل النقاش'), '',
  '### مهمتك الآن',
  'أدر الجلسة: احسم التعارضات، ارفض الملاحظات الضعيفة أو المخالفة لمدخلات المستخدم،',
  'وادمج الباقي في موجز تعديل واحد لا يتجاوز 12 بندًا مرتبًا بالأولوية.',
  'مخالفات المفتش الآلي تدخل الموجز إجباريًا وبأعلى أولوية.',
  'ثم اختر decision: approve أو revise أو restart.',
  'أعد JSON فقط.'
].join('\n');

return [H.callFor(cfg, 'chair', userText, s, 'chair_ruling')];
