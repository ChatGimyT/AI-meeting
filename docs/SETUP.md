<div dir="rtl">

# دليل التشغيل

## ١. الاستيراد

**الطريقة المفضّلة (ملف بحجم ~٦٥٠ كيلوبايت):**
`n8n → Workflows → القائمة (…) → Import from File` واختر `dist/ai-editorial-boardroom.json`.

**أو النسخ واللصق:** افتح الملف، انسخ محتواه كاملًا، ثم الصقه داخل لوحة workflow فارغة في n8n.

## ٢. مفتاح النموذج اللغوي

عقد `🧠 LLM · …` تستخدم **Header Auth** واحدة، فتعمل مع أي مزوّد بلا تعديل في العقد.

`Credentials → New → Header Auth` وسمّها **`LLM API Key`**:

| المزوّد | Name | Value |
|---|---|---|
| Anthropic *(الافتراضي)* | `x-api-key` | `sk-ant-...` |
| OpenAI / DeepSeek | `Authorization` | `Bearer sk-...` |
| OpenRouter / Azure / محلي | حسب المزوّد | حسب المزوّد |

ثم افتح أي عقدة `🧠 LLM · …` واختر الـ Credential — سيقترحها n8n على باقي العقد.

### DeepSeek (النسخة الجاهزة)

استورد `dist/ai-editorial-boardroom-deepseek.json`. هذه النسخة:

- مربوطة مسبقًا بالكريدينشال `UtZ5Hq48pibn5oXX` باسم `DeepSeek account` ونوع `deepSeekApi`.
- ملفها التعريفي الافتراضي `rabeh_article_ar_deepseek`.
- تكتب المقال **قسمًا بقسم** لأن سقف مخرجات DeepSeek 8192 توكن.

**إن كان الكريدينشال عندك من نوع Header Auth لا DeepSeek**، أعد البناء بسطر واحد:

<div dir="ltr">

```bash
npm run build -- --variant=deepseek --credential-type=httpHeaderAuth \
  --credential-id=UtZ5Hq48pibn5oXX --credential-name="DeepSeek account" \
  --default-profile=rabeh_article_ar_deepseek
```

</div>

أو افتح أي عقدة `🧠 LLM · …` في n8n وبدّل الاعتماد يدويًا؛ n8n سيقترحه على باقي العقد.

> ملاحظة: مُعرِّف الكريدينشال مأخوذ من الرابط الذي أرسلته
> (`/projects/z2YgyCs6QEctHLNH/credentials/UtZ5Hq48pibn5oXX`). المفتاح نفسه يبقى داخل n8n
> ولا يظهر في أي ملف من هذا المستودع.

### لغير Anthropic
افتح عقدة `📚 Profiles Registry` وعدّل داخل `PROFILES.rabeh_article_ar.llm`:

<div dir="ltr">

```js
llm: {
  provider: 'openai',
  url: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4.1',
  chair_model: 'gpt-4.1',
  max_tokens: 12000,
  temperature: 0.4,
  enable_tools: false      // البحث على الإنترنت متاح عبر أدوات Anthropic فقط في هذا الإصدار
}
```

</div>

> `H.buildBody` يبني جسم الطلب بالشكل الصحيح لكل مزوّد تلقائيًا.

## ٣. البحث على الإنترنت (اختياري لكنه مهم)

شخصية `research_lead` تستخدم أداة `web_search_20250305` من Anthropic لجمع إحصائيات حقيقية.

- **إن كانت الأداة غير مفعّلة على حسابك**: اضبط `llm.enable_tools = false`.
  سيعمل المحرك، لكن مدقق الحقائق سيرفض معظم الأرقام، وسيخرج المقال بلا إحصائيات —
  وهذا **سلوك مقصود**: لا رقم بلا مصدر متحقَّق منه.
- **البديل**: املأ حقل `mandatory_citations` في الطلب بمصادرك الجاهزة.

## ٤. أول تشغيل

عدّل عقدة **`📥 Brief — EDIT ME`**:

<div dir="ltr">

```json
{
  "profile_id": "rabeh_article_ar",
  "title": "عنوان المقال",
  "goal": "الهدف من المقال",
  "article_type": "commercial",
  "target_market": "السعودية",
  "primary_keyword": "الكلمة المفتاحية الرئيسية",
  "primary_keyword_count": 8,
  "secondary_keywords": ["كلمة ثانوية", "كلمة أخرى"],
  "semantic_keywords": ["كلمة مرتبطة دلاليًا"],
  "headings": ["H2: العنوان الأول", "H2: العنوان الثاني"],
  "internal_links": [
    { "anchor": "نص الأنكور كما تريده حرفيًا", "url": "https://…" }
  ],
  "mandatory_citations": [],
  "cluster_role": "Pillar",
  "pillar_url": "",
  "allow_auto_headings": true,
  "notes": ""
}
```

</div>

ثم **Execute Workflow**. النتيجة في مخرجات عقدة `📦 Publish Pack`.

### الحقول الإلزامية
`primary_keyword` و`title` (أو `existing_article` في ملف التحديث).
إن نقص شيء، توقف الجلسة عند `⛔ Intake Rejected` وتعيد قائمة الناقص — ولا تُستهلك أي نداءات API.

### `allow_auto_headings`
- `false` → لا يكتب المحرك بلا عناوين H2/H3 منك (سلوك البرومبت الأصلي).
- `true` → يبني `🏗️ ياسر البنّاء` الهيكل بنفسه.

## ٥. المداخل الثلاثة

| المدخل | الاستخدام |
|---|---|
| `▶️ Run Manually` + `📥 Brief` | التجريب والتشغيل اليدوي |
| `📨 Form Intake` | نموذج ويب جاهز لفريق المحتوى — فعّل الـ workflow واستخدم رابط Production |
| `🔌 Webhook Intake` | `POST /webhook/ai-boardroom` بنفس شكل الـ JSON أعلاه، والرد يعود بحزمة النشر كاملة |

جميعها تمر عبر `🧾 Normalize Brief` الذي يقبل أسماء الحقول **بالعربية والإنجليزية**،
ويحوّل النصوص متعددة الأسطر إلى مصفوفات، ويفهم صيغ الروابط الثلاث:
`نص الأنكور | https://…` و`[نص الأنكور](https://…)` و`{ "anchor": "…", "url": "…" }`.

## ٦. التوقيتات والتكلفة

| البند | القيمة |
|---|---|
| نداءات دورة ناجحة | ~٢٠ |
| نداءات كل دورة إضافية | +١١ |
| زمن تشغيلة نموذجية | ٦–١٢ دقيقة |
| `executionTimeout` المضبوطة | ٧٢٠٠ ثانية |

للتخفيض: قلّص `seats.panel`، أو اخفض `gate.max_rounds`،
أو استخدم نموذجًا أصغر في `llm.model` مع إبقاء `llm.chair_model` قويًا.

## ٧. حل المشكلات

| العَرَض | السبب المرجّح | الحل |
|---|---|---|
| `Referenced node has no output yet` | تغيّر اسم عقدة | أعد الاسم كما هو، أو حدّث المرجع `$('…')` في الكود |
| كل الفحوص ترسب والمقال فارغ | خطأ اعتماد أو نموذج غير صحيح | افتح مخرجات `🧠 LLM · Lead Writer` وراجع `state.errors` في حزمة النشر |
| «تعذّر قراءة JSON» في المحضر | ردّ النموذج بنص حر | اخفض `temperature` للشخصية، أو استخدم نموذجًا أقوى |
| المقال بلا أي إحصائيات | أداة البحث غير مفعّلة أو كل الأدلة رُفضت | راجع `link_report` و`evidence.rejected` في تقرير التدقيق |
| الجلسة تنتهي بـ `shipped_with_notes` | نفدت الدورات قبل بلوغ العتبة | ارفع `gate.max_rounds` أو راجع `critical_issues` في التقرير |
| `Respond to Webhook` يشتكي | شُغِّل يدويًا لا عبر webhook | متوقع — المسار محمي بعقدة `🚦 Webhook Reply?` |

</div>
