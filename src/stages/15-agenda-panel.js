/* ── 15. أجندة طاولة الاجتماعات: كل النقاد يقرؤون النص في آنٍ واحد ── */
const REG = $('📚 Profiles Registry').first().json.profiles;
const s   = $input.first().json.state;
const cfg = H.cfgOf(REG, s);

s.stage = 'panel';

const isCommercial = s.brief.article_type === 'commercial';
const rubricList = (cfg.rubric.items || [])
  .filter(function (r) { return !r.applies_to || r.applies_to.indexOf(isCommercial ? 'commercial' : 'informational') !== -1; });

const shared = [
  H.brandBlock(cfg), '',
  H.briefBlock(s, cfg), '',
  H.rulesBlock(cfg), '',
  '### نوع المحتوى المعلن: ' + (isCommercial ? 'تجاري' : 'معلوماتي / تعليمي') +
    ' — طبّق بنود المراجعة الخاصة بهذا النوع.',
  '',
  '### الزاوية التنافسية المعتمدة\n' + (s.strategy.competitive_angle || '-'),
  '',
  '### حزمة الأدلة المعتمدة (لا يجوز وجود رقم خارجها)',
  ((s.evidence.approved || []).map(function (e) { return '- [' + e.id + '] ' + e.figure + ' — ' + e.url; }).join('\n')) || '(لا توجد)',
  '',
  H.mechanicalBlock(s),
  '',
  H.articleBlock(s, 'النص المعروض على الطاولة — الدورة رقم ' + s.round),
  '',
  '### عتبة القبول: ' + cfg.rubric.threshold + '/10 لكل بند. ما دون ذلك يوقف النشر.'
].join('\n');

const seats = (cfg.seats && cfg.seats.panel) || [];
return seats.map(function (id) {
  const p = H.persona(cfg, id);
  const mine = (p.scores_for || []).filter(function (r) {
    return rubricList.some(function (x) { return x.id === r; });
  });
  const task = [
    '',
    '### مهمتك الآن',
    'أنت مسؤول أمام مجلس التحرير عن البنود التالية حصرًا: ' +
      (mine.length ? mine.map(function (m) {
        const it = rubricList.find(function (x) { return x.id === m; });
        return '`' + m + '` (' + (it ? it.label : m) + ')';
      }).join('، ') : '(لا بنود مخصصة — قيّم من زاويتك)'),
    'ضع درجاتك في scores بهذه المعرّفات فقط، ولا تقيّم بنود زملائك.',
    'كل ملاحظة يجب أن يقابلها إصلاح تنفيذي محدد يستطيع الكاتب تنفيذه فورًا.',
    'أعد JSON فقط.'
  ].join('\n');
  return H.callFor(cfg, id, shared + task, s, 'panel');
});
