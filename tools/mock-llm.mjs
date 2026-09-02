/* نماذج ردود وهمية تحاكي كل شخصية — تُستخدم في المحاكي فقط. */

const S = (o) => ({ content: [{ type: 'text', text: '```json\n' + JSON.stringify(o) + '\n```' }] });
const MD = (t) => ({ content: [{ type: 'text', text: t }] });

const KW = 'اعلانات جوجل ادوردز';
/* يجب أن تطابق حرفيًا الروابط الداخلية في عقدة «📥 Brief — EDIT ME» */
const LINKS = [
  { anchor: 'أنواع إعلانات جوجل', url: 'https://www.rabeh.org/ar/blog-show/انواع-اعلانات-جوجل' },
  { anchor: 'طريقة عمل اعلان على جوجل', url: 'https://www.rabeh.org/ar/blog-show/طريقة-عمل-اعلان-على-جوجل' },
  { anchor: 'ادارة حملات جوجل الاعلانية', url: 'https://www.rabeh.org/ar/blog-show/ادارة-حملات-جوجل-الاعلانية' }
];
const EV = [
  { id: 'E1', publisher: 'Google Ads Help', page_title: 'About Performance Max', url: 'https://support.google.com/google-ads/answer/10724817',
    figure: '27%', arabic_sentence: 'سجّل المعلنون زيادة متوسطها 27% في التحويلات.', section: 'مميزات الإعلانات',
    citation_line: 'Google Ads Help — «About Performance Max»: https://support.google.com/google-ads/answer/10724817 — المعلومة المستخدمة: زيادة 27% في التحويلات.' },
  { id: 'E2', publisher: 'DataReportal', page_title: 'Digital 2026: Saudi Arabia', url: 'https://datareportal.com/reports/digital-2026-saudi-arabia',
    figure: '99.0%', arabic_sentence: 'بلغت نسبة انتشار الإنترنت في السعودية 99.0%.', section: 'السوق السعودي',
    citation_line: 'DataReportal — «Digital 2026: Saudi Arabia»: https://datareportal.com/reports/digital-2026-saudi-arabia — المعلومة المستخدمة: انتشار الإنترنت 99.0%.' }
];

/* ---------- مولّد مقال اصطناعي بطول مضبوط ---------- */
function sentence(i) {
  const bank = [
    'يعتمد نجاح الحملة على دقة الاستهداف وبنية الحساب قبل حجم الميزانية',
    'تبدأ الخطوة العملية بمراجعة تتبع التحويلات ثم ضبط الكلمات السلبية',
    'يفرّق المعلن المحترف بين نية البحث التجارية ونية البحث المعلوماتية',
    'تكشف تقارير الأداء الأسبوعية الحملات التي تستنزف الميزانية بلا عائد',
    'يقيس الفريق العائد على الإنفاق الإعلاني بدل الاكتفاء بعدد النقرات',
    'تحتاج صفحة الهبوط إلى رسالة واحدة واضحة تطابق وعد الإعلان تمامًا',
    'يخسر كثير من الحسابات ميزانيتها بسبب تكرار الكلمات بين الحملات',
    'يساعد تقسيم الجمهور حسب سلوكه الفعلي على رفع فرص إتمام الصفقة'
  ];
  return bank[i % bank.length];
}
function para(words, seed) {
  const parts = [];
  let n = 0, i = seed;
  while (n < words) { const s = sentence(i++); parts.push(s); n += s.split(' ').length; }
  return parts.join('، ') + '.';
}

function buildArticle(opts) {
  const o = Object.assign({ short: false, keywordCount: 8, faq: 6, target: 1900 }, opts);
  const L = [];
  L.push('<<<ARTICLE>>>');
  L.push('---');
  L.push('title: ما هي ' + KW + '؟ دليل 2026 للسوق السعودي');
  L.push('meta_title: ' + KW + ' 2026: دليل الحملة المناسبة');
  L.push('meta_description: تعرّف على ' + KW + ' وكيف تختار الحملة المناسبة لنشاطك في السعودية، مع خطوات عملية وأخطاء يجب تجنبها.');
  L.push('slug: google-adwords-ads');
  L.push('primary_keyword: ' + KW);
  L.push('secondary_keywords: اعلانات جوجل، حملات جوجل الاعلانية، اسعار اعلانات جوجل');
  L.push('article_type: commercial');
  L.push('---');
  L.push('');
  L.push('# ما هي ' + KW + '؟ دليل عملي للسوق السعودي');
  L.push('');
  /* مقدمة 70-100 كلمة */
  L.push(KW + ' هي منظومة الحملات المدفوعة داخل Google Ads التي تعرض نشاطك أمام من يبحث عن خدمتك في اللحظة نفسها. ' + para(60, 1));
  L.push('');

  const sections = [
    'ما هي ' + KW + ' وكيف تعمل؟',
    'كيف تتم المحاسبة في حملات جوجل؟',
    'لماذا تتصدر اعلانات جوجل وسائل التسويق؟',
    'الكلمات المفتاحية سر نجاح حملتك',
    'طرق الاستهداف داخل حملات جوجل الاعلانية',
    'كيف تساعدك شركة رابح في إدارة حملاتك؟'
  ];
  sections.forEach(function (h, idx) {
    L.push('## ' + h);
    L.push('');
    L.push(para(50, idx + 2));               /* إجابة مباشرة 40-60 */
    L.push('');
    L.push(para(o.short ? 60 : 120, idx + 5));
    L.push('');
    if (idx === 0) {
      L.push('- إعلانات البحث: تلتقط نية شرائية معلنة عبر الكلمات المفتاحية.');
      L.push('- إعلانات التسوق: تعرض المنتج بصورته وسعره داخل نتائج البحث.');
      L.push('- إعلانات الفيديو: تخدم الوعي والوصول أكثر من التحويل المباشر.');
      L.push('');
      L.push('يمكنك التوسع في [' + LINKS[0].anchor + '](' + LINKS[0].url + ') لاختيار النوع الأنسب لنشاطك.');
      L.push('');
    }
    if (idx === 1) {
      L.push('| نوع الحملة | أين تظهر | الهدف الأنسب |');
      L.push('|---|---|---|');
      L.push('| البحث | نتائج جوجل | التحويل المباشر |');
      L.push('| التسوق | تبويب Shopping | مبيعات المتاجر |');
      L.push('');
      L.push('راجع [' + LINKS[1].anchor + '](' + LINKS[1].url + ') قبل إطلاق أول حملة.');
      L.push('');
    }
    if (idx === 2) {
      L.push('سجّل المعلنون زيادة متوسطها 27% في التحويلات بحسب [Google Ads Help](' + EV[0].url + ').');
      L.push('');
    }
    if (idx === 3) {
      L.push('1. حلّل حجم البحث والمنافسة لكل كلمة.');
      L.push('2. استبعد الكلمات غير المرتبطة بنية الشراء.');
      L.push('3. راجع صفحات المنافسين وكلماتهم.');
      L.push('');
      L.push('وتفصيل ذلك تجده في [' + LINKS[2].anchor + '](' + LINKS[2].url + ').');
      L.push('');
    }
    if (idx === 4) {
      L.push('بلغت نسبة انتشار الإنترنت في السعودية 99.0% وفق [DataReportal](' + EV[1].url + ').');
      L.push('');
      L.push('- استهداف زمني حسب ساعات ذروة الطلب في الرياض وجدة.');
      L.push('- استهداف الأجهزة حسب سلوك زوار موقعك الفعلي.');
      L.push('');
    }
    if (idx === 5) {
      L.push('خطوتك التالية: أرسل رابط موقعك ومتوسط إنفاقك الشهري لتحصل على تحليل مجاني يوضح الحملات التي يجب إيقافها قبل زيادة الميزانية.');
      L.push('');
    }
  });

  /* ضبط تكرار الكلمة المفتاحية */
  let extra = [];
  for (let i = 0; i < Math.max(0, o.keywordCount - 4); i++) {
    extra.push('تظل ' + KW + ' الأداة الأسرع للوصول إلى عميل يبحث عنك الآن.');
  }
  if (extra.length) {
    L.push('## خلاصة عملية حول اسعار اعلانات جوجل');
    L.push('');
    L.push(para(50, 9));
    L.push('');
    L.push('- راجع حملات جوجل الاعلانية شهريًا وأوقف ما لا يحقق عائدًا.');
    L.push('- قارن اسعار اعلانات جوجل بين الكلمات قبل رفع الميزانية.');
    L.push('');
    L.push(extra.join(' '));
    L.push('');
  }

  L.push('## الأسئلة الشائعة (FAQ)');
  L.push('');
  for (let i = 0; i < o.faq; i++) {
    L.push('### سؤال رقم ' + (i + 1) + ' عن حملات جوجل؟');
    L.push('إجابة مباشرة ومختصرة توضح النقطة المطلوبة دون إسهاب أو تكرار.');
    L.push('');
  }
  L.push('## المصادر المستخدمة');
  L.push('');
  EV.forEach(function (e) { L.push('- ' + e.citation_line); });
  L.push('<<<END_ARTICLE>>>');

  let text = L.join('\n');
  /* حشو مضبوط للوصول إلى النطاق المطلوب */
  if (!o.short) {
    const target = o.target;
    const cur = text.replace(/<<<[^>]+>>>/g, '').split(/\s+/).length;
    if (cur < target) {
      const pad = [];
      let need = target - cur;
      let i = 20, k = 0;
      while (need > 0) {
        const p = para(Math.min(120, need), i++);
        pad.push('', p);
        need -= p.split(' ').length;
        if (++k % 2 === 0) { pad.push('', '- نقطة تنفيذية ' + k + ': راجع بنية الحساب قبل زيادة الإنفاق.'); }
      }
      text = text.replace('## الأسئلة الشائعة (FAQ)', pad.join('\n') + '\n\n## الأسئلة الشائعة (FAQ)');
    }
  }
  return text;
}


/* ---------- حزمة بوستات اصطناعية ---------- */
function buildPosts() {
  return [
    '<<<ARTICLE>>>',
    '---',
    'title: حزمة بوستات — أخطاء اعلانات جوجل',
    'campaign_angle: الأخطاء التي تستنزف ميزانيتك',
    '---',
    '',
    '## P1 — linkedin',
    '**Hook:** أوقفنا حملة كانت تنفق 18 ألف ريال شهريًا، فارتفعت الطلبات.',
    '',
    'السبب لم يكن الميزانية، بل بنية حساب تُنافس نفسها على الكلمة ذاتها.',
    'راجع تداخل الكلمات بين حملاتك قبل أن تفكر في زيادة الإنفاق على اعلانات جوجل.',
    '',
    '**CTA:** ما أكبر بند إنفاق في حسابك اليوم؟ اكتبه في التعليقات.',
    '**Hashtags:** #اعلانات_جوجل #تسويق_رقمي #السعودية',
    '',
    '## P2 — x',
    '**Hook:** ٣ أخطاء تحرق ميزانية اعلانات جوجل.',
    '',
    'تتبع تحويلات ناقص. كلمات سلبية مهملة. صفحة هبوط لا تطابق وعد الإعلان.',
    '',
    '**CTA:** أيها يحدث عندك؟',
    '**Hashtags:** #اعلانات_جوجل',
    '<<<END_ARTICLE>>>'
  ].join('\n');
}


/* ---------- مولّد قسم واحد (وضع الكتابة المُجزَّأة) ---------- */
function buildSectionFor(meta) {
  const key = meta.section_key;
  const budget = meta.word_budget || 200;
  const quota = meta.keyword_quota || 0;
  const L = ['<<<SECTION>>>'];

  if (key === '__front__') {
    L.push('---');
    L.push('title: ما هي ' + KW + '؟ دليل عملي للسوق السعودي');
    L.push('meta_title: ' + KW + ' 2026: دليل الحملة المناسبة');
    L.push('meta_description: تعرّف على ' + KW + ' وكيف تختار الحملة المناسبة لنشاطك في السعودية، مع خطوات عملية وأخطاء يجب تجنبها.');
    L.push('slug: google-adwords-ads');
    L.push('primary_keyword: ' + KW);
    L.push('secondary_keywords: اعلانات جوجل، حملات جوجل الاعلانية، اسعار اعلانات جوجل');
    L.push('article_type: commercial');
    L.push('---');
    L.push('');
    L.push('# ما هي ' + KW + '؟ دليل عملي للسوق السعودي');
    L.push('');
    L.push(KW + ' هي منظومة الحملات المدفوعة داخل Google Ads التي تعرض نشاطك أمام من يبحث عن خدمتك في اللحظة نفسها. ' + para(60, 1));
  } else if (key === '__faq__') {
    L.push('## الأسئلة الشائعة (FAQ)');
    L.push('');
    for (let i = 0; i < 6; i++) {
      L.push('### سؤال رقم ' + (i + 1) + ' عن حملات جوجل؟');
      L.push('إجابة مباشرة ومختصرة توضح النقطة المطلوبة دون إسهاب أو تكرار.');
      L.push('');
    }
  } else {
    const n = Number(String(key).replace('s', '')) || 1;
    L.push('## ' + meta.section_heading);
    L.push('');
    L.push(para(50, n + 2));
    L.push('');
    let left = Math.max(60, budget - 50);
    let i = n + 5, k = 0;
    while (left > 0) {
      const chunk = Math.min(110, left);
      L.push(para(chunk, i++));
      L.push('');
      left -= chunk;
      if (++k % 2 === 0 && left > 0) {
        L.push('- نقطة تنفيذية: راجع بنية الحساب قبل زيادة الإنفاق.');
        L.push('- نقطة تنفيذية: استبعد الكلمات غير المرتبطة بنية الشراء.');
        L.push('');
        left -= 16;
      }
    }
    if (n === 1) {
      L.push('يمكنك التوسع في [' + LINKS[0].anchor + '](' + LINKS[0].url + ') لاختيار النوع الأنسب لنشاطك.');
      L.push('');
    }
    if (n === 2) {
      L.push('| نوع الحملة | أين تظهر | الهدف الأنسب |');
      L.push('|---|---|---|');
      L.push('| البحث | نتائج جوجل | التحويل المباشر |');
      L.push('| التسوق | تبويب Shopping | مبيعات المتاجر |');
      L.push('');
      L.push('راجع [' + LINKS[1].anchor + '](' + LINKS[1].url + ') قبل إطلاق أول حملة.');
      L.push('');
    }
    if (n === 3) { L.push('سجّل المعلنون زيادة متوسطها 27% في التحويلات بحسب [Google Ads Help](' + EV[0].url + ').'); L.push(''); }
    if (n === 4) { L.push('وتفصيل ذلك تجده في [' + LINKS[2].anchor + '](' + LINKS[2].url + ').'); L.push(''); }
    if (n === 5) { L.push('بلغت نسبة انتشار الإنترنت في السعودية 99.0% وفق [DataReportal](' + EV[1].url + ').'); L.push(''); }
    if (n === 6) {
      L.push('وتبقى اسعار اعلانات جوجل خاضعة للمنافسة على الكلمة.');
      L.push('');
      L.push('خطوتك التالية: أرسل رابط موقعك ومتوسط إنفاقك الشهري لتحصل على تحليل مجاني يوضح الحملات التي يجب إيقافها قبل زيادة الميزانية.');
      L.push('');
    }
  }
  /* قصّ الزائد للوصول إلى الميزانية المطلوبة (يحاكي كاتبًا منضبطًا) */
  if (key !== '__front__' && key !== '__faq__') {
    const wc = (t) => t.replace(/[|#>*`-]/g, ' ').split(/\s+/).filter(Boolean).length;
    while (wc(L.join(' ')) > budget * 1.05 && L.length > 5) {
      let idx = -1;
      for (let j = L.length - 1; j >= 3; j--) {
        if (L[j].trim() && !/^[-|#]/.test(L[j].trim()) && !/\]\(http/.test(L[j])) { idx = j; break; }
      }
      if (idx < 0) break;
      const parts = L[idx].split('، ');
      if (parts.length > 2) L[idx] = parts.slice(0, -1).join('، ') + '.';
      else L.splice(idx, 1);
    }
  }
  /* الالتزام بحصة الكلمة المفتاحية المخصصة لهذا القسم */
  const body0 = L.join('\n');
  let have = (body0.split(KW).length - 1);
  const extra = [];
  while (have < quota) { extra.push('تظل ' + KW + ' الأسرع للوصول إلى عميل يبحث عنك الآن.'); have++; }
  if (extra.length) { L.push(extra.join(' ')); L.push(''); }
  L.push('<<<END_SECTION>>>');
  return L.join('\n');
}

/* ---------- الموزّع ---------- */
export function makeMock() {
  const seen = {};
  return function mock(meta) {
    const id = meta.persona_id;
    const stage = meta.stage;
    seen[stage] = (seen[stage] || 0) + 1;

    if (id === 'brief_architect') return S({
      h1: 'ما هي ' + KW + '؟',
      outline: [
        { level: 2, heading: 'ما هي ' + KW + ' وكيف تعمل؟', purpose: 'تعريف وأنواع', word_budget: 320, format: 'list', source_needed: false },
        { level: 2, heading: 'كيف تتم المحاسبة في حملات جوجل؟', purpose: 'التكلفة', word_budget: 300, format: 'table', source_needed: false },
        { level: 2, heading: 'لماذا تتصدر اعلانات جوجل وسائل التسويق؟', purpose: 'القيمة', word_budget: 300, format: 'paragraph', source_needed: true },
        { level: 2, heading: 'الكلمات المفتاحية سر نجاح حملتك', purpose: 'الخطوات', word_budget: 300, format: 'steps', source_needed: false },
        { level: 2, heading: 'طرق الاستهداف داخل حملات جوجل الاعلانية', purpose: 'الاستهداف', word_budget: 300, format: 'list', source_needed: true },
        { level: 2, heading: 'كيف تساعدك شركة رابح في إدارة حملاتك؟', purpose: 'التحويل', word_budget: 260, format: 'paragraph', source_needed: false }
      ],
      keyword_map: { primary: { phrase: KW, target_count: 8, placements: ['المقدمة', 'أول H2'] }, secondary: [], semantic_variants: ['Google Ads'] },
      internal_link_map: LINKS.map((l, i) => ({ anchor: l.anchor, url: l.url, section: 'قسم ' + i })),
      claims_needing_sources: [{ claim: 'زيادة التحويلات مع Performance Max', section: 'المميزات', why: 'رقم' }],
      faq_questions: ['كيف أقيس نجاح الحملة؟'], word_budget_total: 1900
    });

    if (id === 'strategy_director') return S({
      detected_intent: 'تجارية', intent_matches_declared_type: true,
      title_verdict: { keep: true, suggested_title: '', why: 'يعكس المحتوى' },
      competitive_angle: 'ربط الأنواع بحالة السوق السعودي',
      must_answer_questions: ['كم التكلفة؟', 'متى تظهر النتائج؟'],
      reader_journey: ['مشكلة', 'أثر', 'حل', 'معايير', 'لماذا رابح', 'خطوة'],
      content_gaps_to_own: ['جدول مقارنة'], risks: []
    });

    if (id === 'chair' && stage === 'blueprint_lock') return S({
      decision: 'approve', round_summary: 'المخطط متسق مع نية الباحث.',
      conflicts_resolved: [], rejected_notes: [], revision_brief: [], blockers: [],
      message_to_writer: 'ابدأ بالإجابة قبل البيع، والتزم بميزانية الكلمات.'
    });

    if (id === 'research_lead') return {
      content: [
        { type: 'web_search_tool_result', content: [{ url: EV[0].url, title: EV[0].page_title }] },
        { type: 'text', text: '```json\n' + JSON.stringify({
            evidence: EV, platform_updates: [], unverified: [{ claim: 'ادعاء بلا مصدر', why: 'لا مصدر رسمي', recommendation: 'احذف' }],
            search_queries_used: ['google ads performance max stats'] }) + '\n```' }
      ]
    };

    if (id === 'fact_checker') return S({
      approved: EV, rejected: [], stale: [], must_remove_from_article: [], verdict: 'pass'
    });

    if (meta.section_key) return MD(buildSectionFor(meta));   /* وضع الكتابة المُجزَّأة */
    const social = $LAST.profile === 'social_posts_ar' || $LAST.profile === 'social_posts_deepseek';
    if (social && (id === 'lead_writer' || id === 'narrative_editor' || id === 'reviser')) return MD(buildPosts());
    if (id === 'lead_writer')      return MD(buildArticle({ short: true }));   /* الدورة 1: قصير عمدًا */
    if (id === 'narrative_editor') return MD($LAST.article);
    if (id === 'language_editor')  return MD($LAST.article);
    if (id === 'reviser')          return MD(buildArticle({ short: false, target: $LAST.profile === 'rabeh_refresh_ar' ? 2200 : 1900 }));  /* بعد التعديل: مضبوط */

    if (meta.output_mode === 'json' && stage === 'panel') {
      const seats = social ? 8 : 9;
      const round = seen.panel <= seats ? 1 : 2;
      const persona = id;
      const scores = {};
      (PANEL_SCOPE[persona] || (social ? ['clarity'] : ['content_quality'])).forEach(function (k) {
        scores[k] = { score: round === 1 ? 6 : 9, reason: round === 1 ? 'يحتاج عمقًا أكبر' : 'مستوفٍ' };
      });
      return S({
        persona: persona, verdict: round === 1 ? 'revise' : 'approve', scores: scores,
        critical_issues: round === 1 ? [{ title: 'نقص عمق', why: 'عام', fix: 'أضف جدولًا', where: 'المميزات' }] : [],
        issues: [], opportunities: [{ priority: 'عالية', opportunity: 'جدول مقارنة', impact: 'تحسين الاقتطاف' }],
        note_to_board: round === 1 ? 'غير جاهز' : 'جاهز'
      });
    }

    if (id === 'chair' && stage === 'chair_ruling') {
      const round = seen.chair_ruling;
      return S({
        decision: round === 1 ? 'revise' : 'approve',
        round_summary: 'الجلسة ' + round,
        conflicts_resolved: [{ between: ['conversion_copywriter', 'red_team'], issue: 'قوة الـ CTA', ruling: 'يبقى CTA واحد قوي في النهاية', why: 'المقال تجاري' }],
        rejected_notes: [{ from: 'red_team', note: 'احذف الجدول', why_rejected: 'يخالف طلب المستخدم' }],
        revision_brief: round === 1 ? [{ order: 1, instruction: 'أضف جدول مقارنة', section: 'المميزات', raised_by: ['red_team'], must_fix: true }] : [],
        blockers: [], scores_override: {},
        message_to_writer: 'نفّذ الموجز بالكامل.'
      });
    }

    if (id === 'final_auditor') return S({
      detected_type: 'commercial', type_matches_declared: true,
      scorecard: { seo: { score: 9, reason: 'بنية سليمة' }, eeat: { score: 9, reason: 'مصادر رسمية' } },
      detailed_review: { search_intent: 'مستوفاة', seo_structure: 'سليمة' },
      opportunities: [{ priority: 'متوسطة', opportunity: 'إضافة دراسة حالة', impact: 'ثقة أعلى' }],
      critical_issues: [], final_decision: 'ready',
      final_scores: { seo_score: 9, content_score: 9, business_score: 9, overall_score: 9 },
      publish_note: 'جاهز للنشر.'
    });

    return S({ persona: id, verdict: 'approve', scores: {}, critical_issues: [], issues: [], opportunities: [], note_to_board: '-' });
  };
}

const PANEL_SCOPE = {
  hook_critic: ['hook'],
  platform_specialist: ['platform_fit', 'clarity'],
  brand_voice_critic: ['brand_voice', 'value'],
  cta_strategist: ['cta'],
  seo_auditor: ['seo', 'semantic_seo', 'competitiveness'],
  aeo_geo_specialist: ['aeo_geo', 'readability'],
  conversion_copywriter: ['copywriting', 'conversion_potential'],
  eeat_guardian: ['eeat', 'sourcing'],
  local_market_reviewer: ['local_seo'],
  red_team: ['content_quality', 'search_intent'],
  cluster_architect: ['internal_linking'],
  narrative_critic: ['narrative'],
  language_critic: ['language']
};

export const $LAST = { article: '', profile: 'rabeh_article_ar' };
export { buildArticle };
