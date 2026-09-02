/* ── 10. أجندة الكتابة (نقطة دخول أيضًا لإعادة البناء) ── */
const REG = $('📚 Profiles Registry').first().json.profiles;
const s   = $input.first().json.state;
const cfg = H.cfgOf(REG, s);

s.stage = 'draft';

const restartNote = s.restart_directive
  ? '\n\n### توجيه إعادة البناء من مجلس التحرير (إلزامي)\n' + s.restart_directive +
    '\n\n### أخطاء النسخة السابقة التي لا يجوز تكرارها\n' +
    (s.restart_failures || []).map(function (f) { return '- ' + f; }).join('\n')
  : '';

const existing = s.brief.existing_article
  ? '\n\n### المقالة الأصلية المطلوب تحديثها (لا تُعِد كتابتها من الصفر)\n```markdown\n' + H.clip(s.brief.existing_article, 30000) + '\n```'
  : '';

const userText = [
  H.brandBlock(cfg), '',
  H.briefBlock(s, cfg), '',
  H.rulesBlock(cfg), '',
  '### قرار الاستراتيجية',
  '```json\n' + H.clip(JSON.stringify(s.strategy, null, 1), 6000) + '\n```', '',
  H.outlineBlock(s), '',
  s.blueprint.chair_directive ? '### توجيه رئيس مجلس التحرير\n' + s.blueprint.chair_directive + '\n' : '',
  H.evidenceBlock(s),
  existing,
  restartNote,
  '',
  '### مهمتك الآن',
  'اكتب النسخة الأولى كاملة الآن، بين العلامتين المحددتين، بلا أي تعليق خارجهما.'
].join('\n');

return [H.callFor(cfg, 'lead_writer', userText, s, 'draft')];
