/* ── 5. محضر الجلسة الأولى + أجندة تثبيت المخطط لدى رئيس المجلس ── */
const REG   = $('📚 Profiles Registry').first().json.profiles;
const calls = $('🗓️ Agenda: Kickoff').all();
const s     = calls[0].json.state;
const cfg   = H.cfgOf(REG, s);
const resp  = $input.all();

const reports = {};
resp.forEach(function (item, i) {
  const meta = (calls[i] && calls[i].json.meta) || { persona_id: 'unknown_' + i };
  const err  = H.apiError(item.json);
  const text = H.readText(item.json);
  const data = H.grabJson(text);
  if (err || !data) {
    H.fail(s, 'kickoff', meta.persona_id + ': ' + (err || 'تعذّر قراءة JSON'));
  }
  reports[meta.persona_id] = data || { _raw: H.clip(text, 2000), _error: err || 'parse_failed' };
  H.minute(s, {
    stage: 'kickoff', actor: meta.emoji + ' ' + meta.persona_name + ' — ' + meta.persona_title,
    headline: data ? 'سلّم مخرجاته' : 'أخفق في التسليم',
    detail: H.clip(JSON.stringify(data || text), 1200)
  });
});

s.strategy  = reports.strategy_director || {};
s.blueprint = reports.brief_architect  || {};

/* نوع المقال: مدخلات المستخدم أولًا، ثم قراءة الاستراتيجية */
if (!s.brief.article_type && s.strategy.detected_intent) {
  s.brief.article_type = /تجار|شراء|معامل|commercial|transactional/i.test(s.strategy.detected_intent)
    ? 'commercial' : 'informational';
  s.warnings.push('نوع المقال استُنتج من نية الباحث: ' + s.brief.article_type);
}

/* أجندة رئيس المجلس: تثبيت المخطط قبل الكتابة */
const userText = [
  H.brandBlock(cfg), '', H.briefBlock(s, cfg), '', H.rulesBlock(cfg), '',
  '### تقرير مديرة الاستراتيجية',
  '```json\n' + H.clip(JSON.stringify(s.strategy, null, 1), 7000) + '\n```',
  '',
  '### مخطط مهندس الإحاطة',
  '```json\n' + H.clip(JSON.stringify(s.blueprint, null, 1), 12000) + '\n```',
  '',
  '### مهمتك الآن — جلسة تثبيت المخطط (قبل الكتابة)',
  'أنت لا تراجع مقالًا بعد. أمامك مخطط ومقترح استراتيجي.',
  'احسم أي تعارض بينهما (النوع، العنوان، ترتيب الأقسام، ميزانية الكلمات، الأسئلة الإلزامية).',
  'استخدم decision = "approve" لتثبيت المخطط، أو "revise" لو المخطط يخالف مدخلات المستخدم أو نية الباحث.',
  'ضع في revision_brief التعديلات الملزمة على المخطط نفسه (لا على مقال غير موجود).',
  'وضع في message_to_writer توجيهًا واحدًا واضحًا للكاتب قبل أن يبدأ.'
].join('\n');

return [H.callFor(cfg, 'chair', userText, s, 'blueprint_lock')];
