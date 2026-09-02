<div dir="rtl">

# دليل التوسعة — كيف تحوّل المحرك لأي مشروع آخر

المحرك لا يعرف شيئًا عن رابح ولا عن السيو. **كل شيء يعيش في الملفات التعريفية (Profiles).**

هناك طريقان:

| الطريق | متى؟ |
|---|---|
| **أ. التعديل داخل n8n مباشرة** | تغيير سريع: عتبة، طول، شخصية، برومبت |
| **ب. التعديل في المستودع ثم `npm run build`** | تغييرات جوهرية، أو عمل جماعي، أو تتبّع بـ git |

---

## أ. التعديل داخل n8n

افتح عقدة **`📚 Profiles Registry`**. كل الإعدادات في كائن `PROFILES` أعلى العقدة.
لا تلمس ما تحتها (حلّ الوراثة).

### أمثلة سريعة

<div dir="ltr">

```js
// طول مختلف
PROFILES.rabeh_article_ar.rules.word_count = { min: 1200, max: 1500 };

// عتبة أشد
PROFILES.rabeh_article_ar.rubric.threshold = 9;

// دورات أكثر
PROFILES.rabeh_article_ar.gate.max_rounds = 6;

// طاولة أصغر (توفير تكلفة)
PROFILES.rabeh_article_ar.seats.panel = ['seo_auditor', 'red_team', 'eeat_guardian'];

// نبرة كاتب مختلفة
PROFILES.rabeh_article_ar.roster.lead_writer.system += '\nاكتب بضمير المتكلم الجمع ونبرة أكثر جرأة.';

// عبارة ممنوعة جديدة
PROFILES.rabeh_article_ar.rules.banned_phrases.push('يعتبر من أهم');
```

</div>

---

## ب. التعديل في المستودع

<div dir="ltr">

```bash
git clone <repo> && cd ai-meeting
# عدّل src/profiles/*.mjs
npm test          # build + validate + محاكاة الملفات الثلاثة
# استورد dist/ai-editorial-boardroom.json في n8n
```

</div>

---

## إنشاء ملف تعريفي جديد

أنشئ `src/profiles/my_client_en.mjs`:

<div dir="ltr">

```js
export default {
  id: 'my_client_en',
  label: 'Acme — English SEO article',
  extends: 'rabeh_article_ar',        // يرث كل الشخصيات والقواعد واللائحة
  language: 'en',

  brand: {
    name: 'Acme Ltd', founded: 2011, country: 'UK',
    internal_domains: ['acme.co.uk'],
    markets: ['United Kingdom'],
    services: ['Technical SEO', 'PPC'],
    tone: 'Direct, practical, no fluff',
    primary_market: 'United Kingdom',
    proof_points: ['Managing £4M+ in annual ad spend since 2011'],
    cta_options: ['Book a free 20-minute audit']
  },

  rules: {
    word_count: { min: 1400, max: 1700 },
    banned_dialect_markers: [],              // لا ينطبق على الإنجليزية
    banned_phrases: ['In today\'s fast-paced digital world', 'As an AI language model']
  },

  roster: {
    lead_writer:     { system: 'You are a senior SEO writer at Acme…' },
    language_editor: { system: 'You are a British English copy editor…' }
  },

  seats: {
    panel: ['seo_auditor', 'aeo_geo_specialist', 'eeat_guardian', 'red_team', 'language_critic']
  }
};
```

</div>

`npm run build` يلتقط الملف تلقائيًا. للتشغيل: `"profile_id": "my_client_en"` في الطلب.

### قواعد الوراثة

| القيمة في الملف الوارث | النتيجة |
|---|---|
| مفتاح غير مذكور | يرث قيمة الأب |
| كائن | **دمج عميق** مع كائن الأب |
| مصفوفة | **استبدال كامل** لمصفوفة الأب |
| `null` | **إلغاء صريح** للقيمة (مثال: `output.json_ld: null`) |

---

## إضافة شخصية جديدة للطاولة

<div dir="ltr">

```js
roster: {
  serp_analyst: {
    name: 'ريان المنافسة',
    title: 'محلل نتائج البحث',
    emoji: '🔬',
    output_mode: 'json',
    temperature: 0.3,
    scores_for: ['competitiveness'],          // البنود التي يقيّمها حصرًا
    tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 6 }],
    system: `أنت ريان المنافسة… ابحث عن أفضل ١٠ نتائج للكلمة المفتاحية
وحدد ما ينقص هذا المقال ليتفوق عليها. أعد JSON فقط بالشكل: { … }`
  }
},
seats: { panel: [...السابقين, 'serp_analyst'] }
```

</div>

لا حاجة لأي تعديل على العقد أو الوصلات: عقدة `🗓️ Agenda: Review Panel`
تُخرج عنصرًا لكل مقعد، وعقدة `🧠 LLM · Review Panel` تُنفَّذ مرة لكل عنصر تلقائيًا.

**بند تقييم جديد؟** أضفه إلى `rubric.items` واذكر معرّفه في `scores_for` الخاص بالشخصية.
استخدم `applies_to: ['commercial']` لبند لا ينطبق إلا على نوع معيّن.

---

## إضافة فحص آلي جديد

في `src/stages/14-mechanical-inspector.js`:

<div dir="ltr">

```js
// كل سؤال بصيغة سؤال يجب أن يليه علامة استفهام
const badQ = A.headings.filter(h => /^(ما|كيف|لماذا|متى|هل)/.test(h.text) && !/[؟?]\s*$/.test(h.text));
chk('question_headings', badQ.length === 0,
  badQ.length ? ('عناوين استفهامية بلا علامة استفهام: ' + badQ.map(h => h.text).join(' | '))
              : 'كل العناوين الاستفهامية منتهية بعلامة استفهام',
  'medium');   // 'high' = يمنع النشر · غير ذلك = ملاحظة فقط
```

</div>

اجعله مشروطًا بقاعدة في الملف التعريفي (`if (R.require_question_marks) { … }`) ليبقى المحرك عامًّا.

---

## نوع محتوى مختلف كليًا

ملف `social_posts_ar` هو الدليل العملي: نفس المحرك، نفس ٥٤ عقدة، ولا سطر واحد تغيّر في الرسم البياني.
ما تغيّر: `rules.mode = 'social'` وشخصيات جديدة (`hook_critic`, `platform_specialist`, `cta_strategist`)
ولائحة تقييم مختلفة.

نفس النمط ينطبق على: أوصاف المنتجات، النشرات البريدية، سكربتات الفيديو، صفحات الهبوط، وثائق المساعدة.
الخطوات: (١) ملف تعريفي يرث الأساس، (٢) `rules.mode` جديد + فرعه في المفتش الآلي،
(٣) شخصيات نقد مناسبة، (٤) `output.deliverables` في `📦 Publish Pack`.

---

## ربط مخرجات إضافية

بعد عقدة `📦 Publish Pack` أضف ما تشاء:

| الوجهة | العقدة | الحقل |
|---|---|---|
| Google Docs | *Google Docs → Create* | `{{ $json.article_markdown }}` |
| WordPress | *WordPress → Create Post* | `{{ $json.article_body_only }}` + `{{ $json.meta.meta_title }}` |
| Google Sheets | *Sheets → Append* | `run_id`, `status`, `final_scores.overall_score`, `meta.word_count` |
| Slack | *Slack → Send* | `{{ $json.audit_report_markdown }}` |
| ملف | *Convert to File* | `meeting_minutes_markdown` |

</div>
