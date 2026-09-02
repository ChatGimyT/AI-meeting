/* ── 18. أجندة التعديل: الكاتبة تنفّذ موجز المجلس ── */
const REG = $('📚 Profiles Registry').first().json.profiles;
const s   = $input.first().json.state;
const cfg = H.cfgOf(REG, s);

s.stage = 'revise';
s.round = s.round + 1;

const brief = [
  '### موجز التعديل الصادر عن مجلس التحرير (ملزم، بالترتيب)',
  s.revision_brief.map(function (b) {
    return b.order + '. ' + (b.must_fix ? '**[إلزامي]** ' : '') + b.instruction +
           (b.section ? '  ← الموضع: ' + b.section : '') +
           (b.raised_by ? '  (أثارها: ' + [].concat(b.raised_by).join('، ') + ')' : '');
  }).join('\n') || '(لا شيء)',
  '',
  (s.chair.rejected_notes || []).length
    ? '### ملاحظات رفضها رئيس المجلس — لا تنفّذها\n' +
      s.chair.rejected_notes.map(function (r) { return '- ' + r.note + ' → السبب: ' + r.why_rejected; }).join('\n')
    : '',
  '',
  s.chair.message_to_writer ? '### كلمة رئيس التحرير\n' + s.chair.message_to_writer : ''
].filter(Boolean).join('\n');

const common = [
  H.briefBlock(s, cfg), '',
  H.rulesBlock(cfg), '',
  H.evidenceBlock(s), '',
  H.mechanicalBlock(s), '',
  brief
].join('\n');

if (!H.chunked(cfg)) {
  const userText = [
    common, '',
    H.articleBlock(s, 'النسخة الحالية المطلوب تعديلها'), '',
    '### مهمتك الآن',
    'نفّذ الموجز بالكامل وأعد **النص كاملًا** بين العلامتين، لا التعديلات وحدها.'
  ].join('\n');
  return [H.callFor(cfg, 'reviser', userText, s, 'revise')];
}

/* الوضع المُجزَّأ: كل قسم يستلم الموجز كاملًا وينفّذ ما يخصه فقط */
const table   = H.sectionTable(s);
const targets = H.sectionTargets(s, cfg);
return s.sections
  .filter(function (sec) { return sec.key !== '__sources__'; })
  .map(function (sec, i) {
    const budget = (s.section_plan || []).find(function (p) { return p.key === sec.key; });
    const userText = [
      common, '', table, '',
      H.neighbourBlock(s, sec.key), '',
      '### القسم المطلوب منك الآن',
      '- المُعرِّف: `' + sec.key + '` — ' + (sec.heading || '(الترويسة والمقدمة)'),
      H.targetLine(targets[sec.key], s.brief.primary_keyword),
      '',
      '```markdown\n' + sec.md + '\n```',
      H.protectedBlock(sec.md), '',
      '',
      '### مهمتك الآن',
      'نفّذ في **هذا القسم وحده** كل بند من موجز التعديل يخصه أو يخص كامل النص.',
      'إن لم يكن في الموجز ما يخص هذا القسم، أعده كما هو حرفيًا دون تغيير.',
      'لا تنفّذ ما رفضه رئيس المجلس، ولا تُدخل رقمًا أو مصدرًا خارج الحزمة المعتمدة،',
      'ولا تحذف رابطًا داخليًا ولا تغيّر نص الأنكور.',
      H.SECTION_SHAPE
    ].join('\n');
    const c = H.callFor(cfg, 'reviser', userText, s, 'revise');
    const t = targets[sec.key] || {};
    c.json.meta.section_key = sec.key;
    c.json.meta.section_heading = sec.heading;
    c.json.meta.word_budget = t.target_words || (budget && budget.word_budget) || 0;
    c.json.meta.keyword_quota = t.target_kw || 0;
    c.json.meta.order = i;
    return c;
  });
