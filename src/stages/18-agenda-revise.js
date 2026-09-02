/* ── 18. أجندة التعديل: الكاتبة تنفّذ موجز المجلس ── */
const REG = $('📚 Profiles Registry').first().json.profiles;
const s   = $input.first().json.state;
const cfg = H.cfgOf(REG, s);

s.stage = 'revise';
s.round = s.round + 1;

const userText = [
  H.briefBlock(s, cfg), '',
  H.rulesBlock(cfg), '',
  H.evidenceBlock(s), '',
  H.mechanicalBlock(s), '',
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
  s.chair.message_to_writer ? '### كلمة رئيس التحرير\n' + s.chair.message_to_writer : '',
  '',
  H.articleBlock(s, 'النسخة الحالية المطلوب تعديلها'), '',
  '### مهمتك الآن',
  'نفّذ الموجز بالكامل وأعد **النص كاملًا** بين العلامتين، لا التعديلات وحدها.'
].join('\n');

return [H.callFor(cfg, 'reviser', userText, s, 'revise')];
