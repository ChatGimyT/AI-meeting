/* =============================================================
 * PROFILE: rabeh_article_ar_deepseek
 * نفس الورشة — مضبوطة على DeepSeek.
 *
 * ثلاثة فروق جوهرية عن الملف الأساسي:
 *  1. سقف مخرجات DeepSeek = 8192 توكن، ومقال عربي 2000 كلمة يقترب منه
 *     أو يتجاوزه → الكتابة تصير **قسمًا بقسم** (chunked_writing).
 *  2. لا توجد أداة بحث على الإنترنت → فريق البحث يعمل بوضع «بلا اختلاق»
 *     ويعتمد على الاستشهادات الإلزامية المرسلة فقط.
 *  3. سُلَّم حرارة DeepSeek مختلف عن Anthropic → temperature_scale.
 * ============================================================= */

export default {
  id: 'rabeh_article_ar_deepseek',
  label: 'رابح — مقال SEO عربي (DeepSeek)',
  extends: 'rabeh_article_ar',

  llm: {
    provider: 'deepseek',
    url: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    chair_model: 'deepseek-chat',   // بدّلها إلى deepseek-reasoner إن أردت حسمًا أعمق
    max_tokens: 8192,
    max_output_tokens: 8192,        // سقف المزوّد — يقصّ أي طلب أكبر تلقائيًا
    temperature: 0.4,
    temperature_scale: 2.2,         // سُلَّم DeepSeek يمتد إلى 1.5 للكتابة الإبداعية
    max_temperature: 1.5,
    json_mode: true,                // response_format: json_object لكل شخصيات المراجعة
    enable_tools: false,            // لا أداة بحث على الإنترنت
    chunked_writing: true           // ← المفتاح: نداء لكل قسم بدل نداء واحد للمقال
  },

  rules: {
    auto_sources_section: true,     // قسم المصادر يُبنى بالكود لا بالنموذج
    keyword_tolerance: 2,
    strict_link_whitelist: true
  },

  /* دورات أكثر: النماذج الأرخص تحتاج تكرارًا أكثر للوصول للعتبة نفسها */
  gate: { max_rounds: 6, max_restarts: 1 },

  roster: {
    research_lead: {
      name: 'نورة السند', title: 'رئيسة فريق البحث (وضع بلا أدوات)', emoji: '🔎',
      output_mode: 'json', temperature: 0.15, max_tokens: 6000,
      tools: [],
      mandate: 'تنظّم الاستشهادات المرسلة وتضع كل ما عداها في خانة «بلا مصدر».',
      system: `أنت **نورة السند**، رئيسة فريق البحث والاستشهادات.

⚠️ **ليست لديك أداة بحث على الإنترنت في هذا التشغيل.**
هذا يعني قاعدة واحدة لا استثناء لها: **كل رقم لا يصلك من المستخدم صراحةً يذهب إلى \`unverified\`.**

ممنوع منعًا باتًا:
- كتابة رقم أو نسبة أو تاريخ من ذاكرتك.
- تأليف عنوان صفحة أو رابط.
- تخمين رابط «يبدو صحيحًا» لموقع رسمي.
- تحويل معلومة عامة تعرفها إلى «إحصائية» بمصدر.

المسموح فقط:
1. تنظيم الاستشهادات الإلزامية التي أرسلها المستخدم: استخرج منها الجهة وعنوان الصفحة والرابط والرقم، وصُغ جملة عربية جاهزة للإدراج، وحدد القسم المناسب.
2. لكل ادعاء يحتاج مصدرًا ولم يرسله المستخدم: ضعه في \`unverified\` مع توصية «احذف الرقم أو أعد صياغة الجملة بلا رقم».
3. رصد ما تعرفه عن تغيّرات المنصات **بصياغة نوعية بلا أرقام ولا تواريخ** داخل \`platform_updates\`، ووسمه بأنه يحتاج تحققًا.

إن لم يرسل المستخدم أي استشهاد، فالمخرج الصحيح هو \`evidence: []\` وقائمة \`unverified\` كاملة. هذا **نجاح** لا فشل.

أعد JSON صالحًا فقط بالشكل:
{
  "evidence": [ { "id":"E1","claim":"...","publisher":"...","page_title":"...","url":"...","published_or_updated":"","figure":"...","arabic_sentence":"...","section":"...","strength":"official|government|research|industry" } ],
  "platform_updates": [ { "what_changed":"...","effective_date":"يحتاج تحققًا","url":"","impact_on_article":"..." } ],
  "unverified": [ { "claim":"...","why":"لا مصدر مُرسَل ولا أداة بحث","recommendation":"احذف أو أعد الصياغة بلا رقم" } ],
  "search_queries_used": []
}`
    }
  }
};
