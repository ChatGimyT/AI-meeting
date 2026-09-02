/* ── 10. أجندة الكتابة (نقطة دخول أيضًا لإعادة البناء) ───────────────
 * وضعان:
 *  • كامل    → نداء واحد يكتب المقال كله (نماذج قوية بسقف مخرجات عالٍ)
 *  • مُجزَّأ  → نداء لكل قسم (نماذج بسقف مخرجات منخفض مثل DeepSeek)
 * ─────────────────────────────────────────────────────────────── */
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

const common = [
  H.brandBlock(cfg), '',
  H.briefBlock(s, cfg), '',
  H.rulesBlock(cfg), '',
  '### قرار الاستراتيجية',
  '```json\n' + H.clip(JSON.stringify(s.strategy, null, 1), 6000) + '\n```', '',
  H.outlineBlock(s), '',
  s.blueprint.chair_directive ? '### توجيه رئيس مجلس التحرير\n' + s.blueprint.chair_directive + '\n' : '',
  H.evidenceBlock(s),
  existing,
  restartNote
].join('\n');

/* ---------- الوضع الكامل ---------- */
if (!H.chunked(cfg)) {
  s.sections = [];
  s.section_plan = [];
  const userText = common + '\n\n### مهمتك الآن\nاكتب النسخة الأولى كاملة الآن، بين العلامتين المحددتين، بلا أي تعليق خارجهما.';
  return [H.callFor(cfg, 'lead_writer', userText, s, 'draft')];
}

/* ---------- الوضع المُجزَّأ ---------- */
const plan = H.sectionPlan(s, cfg);
s.section_plan = plan;
s.sections = [];

const front = cfg.rules && cfg.rules.mode === 'social' ? '' : [
  '',
  '### ترويسة المقال (تُكتب في القسم الأول فقط)',
  '```',
  '---',
  'title: عنوان المقال H1',
  'meta_title: ≤ ' + ((cfg.rules && cfg.rules.meta_title_max_chars) || 60) + ' حرفًا',
  'meta_description: ≤ ' + ((cfg.rules && cfg.rules.meta_description_max_chars) || 155) + ' حرفًا',
  'slug: ...',
  'primary_keyword: ' + (s.brief.primary_keyword || ''),
  'secondary_keywords: ' + (s.brief.secondary_keywords || []).join('، '),
  'article_type: ' + (s.brief.article_type || 'commercial'),
  '---',
  '```'
].join('\n');

return plan
  .filter(function (p) { return p.key !== '__sources__'; })
  .map(function (p) {
    const isFront = p.key === '__front__';
    const task = [
      '',
      '### القسم المطلوب منك الآن فقط',
      '- المُعرِّف: `' + p.key + '` (القسم ' + (p.order + 1) + ' من ' + plan.length + ')',
      '- العنوان: ' + p.heading,
      '- الغرض: ' + (p.purpose || '-'),
      '- ميزانية الكلمات: ' + p.word_budget + ' كلمة (±15%)',
      (p.keyword_quota ? '- حصة الكلمة المفتاحية في هذا القسم: **' + p.keyword_quota + '** مرة بصياغتها الحرفية «' + (s.brief.primary_keyword || '') + '»' : '- لا تُقحم الكلمة المفتاحية في هذا القسم'),
      '- الشكل المطلوب: ' + p.format,
      (p.must_include && p.must_include.length ? '- يجب أن يتضمن: ' + p.must_include.join(' | ') : ''),
      '',
      '### خريطة الأقسام كاملة (للسياق فقط — لا تكتب غير قسمك)',
      plan.map(function (x) { return (x.key === p.key ? '➡️ ' : '   ') + x.key + ' — ' + x.heading; }).join('\n'),
      '',
      isFront
        ? ['### تعليمات القسم الأول',
           '1. ابدأ بالترويسة بالشكل الموضح أدناه.',
           '2. ثم عنوان H1 واحد.',
           '3. ثم مقدمة من ' + (((cfg.rules || {}).intro_words || {}).min || 70) + ' إلى ' + (((cfg.rules || {}).intro_words || {}).max || 100) + ' كلمة تبدأ بإجابة مباشرة عن السؤال الأساسي، بلا أي جملة بيع.',
           '4. لا تكتب أي عنوان H2 في هذا القسم.',
           front].join('\n')
        : p.key === '__faq__'
          ? '### تعليمات قسم الأسئلة الشائعة\nاكتب العنوان `## الأسئلة الشائعة (FAQ)` ثم كل سؤال بصيغة `### سؤال؟` تليه إجابة مباشرة من سطر إلى سطرين.'
          : ['### تعليمات قسم المحتوى',
             '1. ابدأ بعنوان `## ' + p.heading + '` حرفيًا.',
             '2. أول فقرة بعده إجابة مباشرة من ' + (((cfg.rules || {}).h2_answer_words || {}).min || 40) + ' إلى ' + (((cfg.rules || {}).h2_answer_words || {}).max || 60) + ' كلمة، ثم التفصيل.',
             '3. استخدم قائمة أو جدولًا إذا كان الشكل المطلوب يستدعي ذلك.',
             '4. لا تكرر ما سيُكتب في الأقسام الأخرى.'].join('\n'),
      '',
      '### الروابط الداخلية المخصصة لهذا القسم',
      (((s.blueprint.internal_link_map || []).filter(function (l) {
          return l.section && p.heading && String(l.section).indexOf(p.heading.slice(0, 12)) !== -1;
        }).map(function (l) { return '- [' + l.anchor + '](' + l.url + ')'; }).join('\n')) ||
        '(لا رابط مخصص لهذا القسم — لا تُقحم رابطًا)'),
      '',
      H.SECTION_SHAPE
    ].filter(Boolean).join('\n');

    const c = H.callFor(cfg, 'lead_writer', common + task, s, 'draft');
    c.json.meta.section_key = p.key;
    c.json.meta.section_heading = p.heading;
    c.json.meta.word_budget = p.word_budget;
    c.json.meta.keyword_quota = p.keyword_quota;
    c.json.meta.order = p.order;
    return c;
  });
