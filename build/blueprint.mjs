/* =============================================================
 * مخطط الـ n8n workflow: العقد + الوصلات.
 * build.mjs يقرأ هذا الملف ويحقن كود المراحل ومكتبة المساعدات.
 * ============================================================= */

/* الدقة قبل السرعة: التوزيع على دفعات يمنع انفجار حد المعدل عند المزوّد،
 * وهو الفارق بين أتمتة محترمة وأتمتة تُوقَف حسابها بعد أسبوع. */
const LLM_OPTS = {
  timeout: 300000,
  batching: { batch: { batchSize: 3, batchInterval: 1500 } },
  response: { response: { neverError: true, responseFormat: 'json' } }
};

/** عقدة نداء نموذج لغوي */
const llm = (name, pos, note) => ({
  name, pos, note,
  type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
  retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
  onError: 'continueRegularOutput',
  credentials: { httpHeaderAuth: { id: 'REPLACE_ME', name: 'LLM API Key' } },
  parameters: {
    method: 'POST',
    url: '={{ $json.url }}',
    authentication: 'genericCredentialType',
    genericAuthType: 'httpHeaderAuth',
    sendHeaders: true,
    headerParameters: { parameters: [
      { name: 'content-type', value: 'application/json' },
      { name: 'anthropic-version', value: '={{ $json.anthropic_version }}' }
    ] },
    sendBody: true,
    specifyBody: 'json',
    jsonBody: '={{ JSON.stringify($json.body) }}',
    options: LLM_OPTS
  }
});

/** عقدة كود (jsCode يُحقن من ملف المرحلة) */
const code = (name, stage, pos, note) => ({
  name, pos, note, stage,
  type: 'n8n-nodes-base.code', typeVersion: 2,
  parameters: { mode: 'runOnceForAllItems', jsCode: '__STAGE__' }
});

const SHEET_DOC = '1_LWkR3yYKsKQP9jcjPdi96D8lzTCWYmz5TF3FOsZZGw';
const SHEET_TAB = 'الورقة1';
const docRL  = () => ({ __rl: true, value: SHEET_DOC, mode: 'id' });
const tabRL  = () => ({ __rl: true, value: SHEET_TAB, mode: 'name', cachedResultName: SHEET_TAB });

/** عقدة شيت جوجل */
const sheets = (name, pos, params, note) => ({
  name, pos, note,
  type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5,
  retryOnFail: true, maxTries: 3, waitBetweenTries: 3000,
  credentials: { googleSheetsOAuth2Api: { id: 'REPLACE_ME', name: 'Google Sheets account' } },
  parameters: Object.assign({ documentId: docRL(), sheetName: tabRL() }, params)
});

/** عقدة إرسال عبر Gmail API (تصل إلى أي عنوان: دومين العميل أو Gmail أو غيرهما) */
const gmailSend = (name, pos, note) => ({
  name, pos, note,
  type: 'n8n-nodes-base.gmail', typeVersion: 2.1,
  retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
  onError: 'continueRegularOutput',
  credentials: { gmailOAuth2: { id: 'REPLACE_ME', name: 'Gmail account' } },
  parameters: {
    sendTo: '={{ $json.to }}',
    subject: '={{ $json.subject }}',
    emailType: 'html',
    message: '={{ $json.html }}',
    options: {
      ccList: '={{ $json.cc }}',
      bccList: '={{ $json.bcc }}',
      senderName: '={{ $json.from_name }}',
      appendAttribution: false
    }
  }
});

/** عقدة إرسال عبر SMTP — لمن يفضّل خادمه الخاص بدل Gmail API */
const smtpSend = (name, pos, note) => ({
  name, pos, note,
  type: 'n8n-nodes-base.emailSend', typeVersion: 2.1,
  retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
  onError: 'continueRegularOutput',
  credentials: { smtp: { id: 'REPLACE_ME', name: 'SMTP account' } },
  parameters: {
    fromEmail: '={{ $json.from_email }}',
    toEmail: '={{ $json.to }}',
    ccEmail: '={{ $json.cc }}',
    bccEmail: '={{ $json.bcc }}',
    subject: '={{ $json.subject }}',
    emailFormat: 'html',
    html: '={{ $json.html }}',
    options: {}
  }
});

const sticky = (content, pos, w, h, color) => ({
  name: 'note_' + pos.join('_'),
  type: 'n8n-nodes-base.stickyNote', typeVersion: 1,
  pos, parameters: { content, height: h, width: w, color: color || 4 }
});

export const nodes = [

  /* ═══ 1. المداخل ═══ */
  { name: '▶️ Run Manually', type: 'n8n-nodes-base.manualTrigger', typeVersion: 1, pos: [-880, -80], parameters: {} },

  { name: '📥 Brief — EDIT ME', type: 'n8n-nodes-base.set', typeVersion: 3.4, pos: [-660, -80],
    note: 'عدّل هذا الـ JSON فقط لتشغيل مقال جديد.',
    parameters: { mode: 'raw', jsonOutput: JSON.stringify({
      profile_id: 'rabeh_article_ar',
      title: 'ما هي إعلانات جوجل ادوردز؟ دليل 2026 للسوق السعودي',
      goal: 'جذب عملاء لخدمة إدارة إعلانات جوجل وتحويل الزائر إلى عميل محتمل',
      article_type: 'commercial',
      target_market: 'السعودية',
      primary_keyword: 'اعلانات جوجل ادوردز',
      primary_keyword_count: 8,
      secondary_keywords: ['اعلانات جوجل', 'حملات جوجل الاعلانية', 'اسعار اعلانات جوجل'],
      semantic_keywords: ['Google Ads', 'شبكة البحث', 'الكلمات المفتاحية', 'تكلفة النقرة'],
      headings: [
        'H2: ما هي إعلانات جوجل ادوردز؟',
        'H2: كيف تتم المحاسبة في إعلانات جوجل؟',
        'H2: لماذا تعتبر إعلانات جوجل الأهم في التسويق الإلكتروني؟',
        'H2: الكلمات المفتاحية سر نجاح حملتك',
        'H2: طرق الاستهداف داخل جوجل ادوردز',
        'H2: كيف تساعدك شركة رابح في إدارة حملاتك؟',
        'H2: الأسئلة الشائعة (FAQ)'
      ],
      internal_links: [
        { anchor: 'أنواع إعلانات جوجل', url: 'https://www.rabeh.org/ar/blog-show/انواع-اعلانات-جوجل' },
        { anchor: 'طريقة عمل اعلان على جوجل', url: 'https://www.rabeh.org/ar/blog-show/طريقة-عمل-اعلان-على-جوجل' },
        { anchor: 'ادارة حملات جوجل الاعلانية', url: 'https://www.rabeh.org/ar/blog-show/ادارة-حملات-جوجل-الاعلانية' }
      ],
      mandatory_citations: [],
      cluster_role: 'Pillar',
      allow_auto_headings: true,
      notes: ''
    }, null, 2) } },

  { name: '📨 Form Intake', type: 'n8n-nodes-base.formTrigger', typeVersion: 2.2, pos: [-880, 180],
    webhookId: 'a1f0c2d4-9b3e-4c71-8f2a-1d6e7b90c111',
    note: 'رابط نموذج جاهز لفريق المحتوى.',
    parameters: {
      formTitle: 'طلب كتابة مقال — ورشة المحتوى',
      formDescription: 'املأ البيانات ثم أرسل. سيمر المقال على طاولة الاجتماعات كاملة قبل تسليمه.',
      formFields: { values: [
        { fieldLabel: 'profile_id', fieldType: 'dropdown', requiredField: true,
          fieldOptions: { values: [{ option: 'rabeh_article_ar' }, { option: 'rabeh_refresh_ar' }, { option: 'social_posts_ar' }] } },
        { fieldLabel: 'title', fieldType: 'text', requiredField: false },
        { fieldLabel: 'goal', fieldType: 'textarea', requiredField: false },
        { fieldLabel: 'article_type', fieldType: 'dropdown', requiredField: false,
          fieldOptions: { values: [{ option: 'commercial' }, { option: 'informational' }] } },
        { fieldLabel: 'target_market', fieldType: 'text', requiredField: false },
        { fieldLabel: 'primary_keyword', fieldType: 'text', requiredField: false },
        { fieldLabel: 'primary_keyword_count', fieldType: 'number', requiredField: false },
        { fieldLabel: 'secondary_keywords', fieldType: 'textarea', requiredField: false },
        { fieldLabel: 'headings', fieldType: 'textarea', requiredField: false },
        { fieldLabel: 'internal_links', fieldType: 'textarea', requiredField: false },
        { fieldLabel: 'existing_article', fieldType: 'textarea', requiredField: false },
        { fieldLabel: 'notes', fieldType: 'textarea', requiredField: false }
      ] },
      options: {}
    } },

  { name: '⏱️ Sheet Poll', type: 'n8n-nodes-base.scheduleTrigger', typeVersion: 1.2, pos: [-1120, 620],
    note: 'يفحص الشيت كل دقيقة بحثًا عن صف مُعلَّم بـ ✅ في عمود «تشغيل».',
    parameters: { rule: { interval: [{ field: 'minutes', minutesInterval: 1 }] } } },

  sheets('📊 Read Sheet Rows', [-900, 620], { options: {} }, 'يقرأ كل صفوف الورقة1.'),

  code('🎯 Pick Pending Row', '23-pick-pending-row', [-680, 620],
       'يلتقط أول صف مُعلَّم ولم يُنفَّذ، ويحوّله إلى طلب. بلا صفوف = لا تنفيذ.'),

  code('🟡 Mark Row Running', '24-mark-running', [-680, 820]),

  sheets('📝 Sheets: Mark Running', [-460, 820],
    { operation: 'update',
      columns: { mappingMode: 'autoMapInputData', matchingColumns: ['row_number'], value: {}, schema: [] },
      options: {} },
    'يكتب «⏳ قيد التنفيذ» في الصف فورًا.'),

  { name: '🔌 Webhook Intake', type: 'n8n-nodes-base.webhook', typeVersion: 2, pos: [-880, 400],
    webhookId: 'b2e1d3c5-7a4f-4e82-9c3b-2f7a8c01d222',
    note: 'واجهة API لدمج المحرك في أي نظام آخر.',
    parameters: { httpMethod: 'POST', path: 'ai-boardroom', responseMode: 'responseNode', options: {} } },

  /* ═══ 2. التهيئة ═══ */
  code('🧾 Normalize Brief', '01-normalize-brief', [-420, 100], 'توحيد المدخلات من أي مدخل.'),
  code('📚 Profiles Registry', '02-profiles-registry', [-200, 100], '⚙️ كل الإعدادات والشخصيات هنا — هذه العقدة الوحيدة التي تعدّلها.'),
  code('⚙️ Open Session', '03-open-session', [20, 100], 'التحقق من اكتمال الطلب وفتح الجلسة.'),

  { name: '🚦 Intake Complete?', type: 'n8n-nodes-base.if', typeVersion: 2.2, pos: [240, 100],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: 'c-intake', leftValue: '={{ $json.intake_ok }}', rightValue: '',
        operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} } },

  code('⛔ Intake Rejected', '26-intake-rejected', [460, 300],
       'الطلب ناقص — لا تُستهلك أي نداءات API، والسبب يُكتب في الشيت.'),

  /* ═══ 3. جلسة الإحاطة ═══ */
  code('🗓️ Agenda: Kickoff', '04-agenda-kickoff', [460, 60], 'الاستراتيجية + هندسة الإحاطة معًا.'),
  llm('🧠 LLM · Kickoff Panel', [680, 60], 'نداءان متوازيان.'),
  code('🗓️ Agenda: Blueprint Lock', '05-minutes-kickoff', [900, 60], 'محضر + رفع الملف لرئيس المجلس.'),
  llm('🧠 LLM · Chair Blueprint', [1120, 60]),

  /* ═══ 4. فريق البحث والاستشهادات ═══ */
  code('🗓️ Agenda: Research', '06-minutes-blueprint', [1340, 60], 'تثبيت المخطط ثم تكليف فريق البحث.'),
  llm('🧠 LLM · Research (web search)', [1560, 60], 'يستخدم أداة البحث على الإنترنت فعليًا.'),
  code('🔗 Prep Link Checks', '07-minutes-research', [1780, 60], 'يُخرج رابطًا لكل عنصر لفحصه آليًا.'),

  { name: '🚦 Has Links?', type: 'n8n-nodes-base.if', typeVersion: 2.2, pos: [2000, 60],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: 'c-links', leftValue: '={{ $json.skip_links }}', rightValue: '',
        operator: { type: 'boolean', operation: 'false', singleValue: true } }], combinator: 'and' }, options: {} } },

  { name: '🌐 HTTP · Link Check', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, pos: [2220, -40],
    onError: 'continueRegularOutput', retryOnFail: false,
    note: 'فحص حياة كل رابط قبل الاستشهاد به.',
    parameters: { method: 'HEAD', url: '={{ $json.url }}',
      sendHeaders: true,
      headerParameters: { parameters: [
        { name: 'User-Agent', value: 'AI-Editorial-Boardroom/1.0 (link verification; +https://www.rabeh.org)' },
        { name: 'Accept', value: '*/*' }
      ] },
      options: { timeout: 15000, redirect: { redirect: { followRedirects: true } },
        batching: { batch: { batchSize: 2, batchInterval: 1200 } },
        response: { response: { neverError: true, fullResponse: true, responseFormat: 'text' } } } } },

  { name: '➖ No Links', type: 'n8n-nodes-base.noOp', typeVersion: 1, pos: [2220, 180], parameters: {} },

  code('🗓️ Agenda: Fact-check', '08-collect-links', [2440, 60], 'تجميع الفحص + تكليف مدقق الحقائق.'),
  llm('🧠 LLM · Fact-checker', [2660, 60]),
  code('📋 Minutes: Fact-check', '09-minutes-factcheck', [2880, 60], 'اعتماد حزمة الأدلة النهائية.'),

  /* ═══ 5. ورشة الكتابة ═══ */
  code('🗓️ Agenda: Draft', '10-agenda-draft', [3100, 60], '↩︎ نقطة دخول إعادة البناء أيضًا.'),
  llm('🧠 LLM · Lead Writer', [3320, 60]),
  code('🗓️ Agenda: Narrative Pass', '11-minutes-draft', [3540, 60]),
  llm('🧠 LLM · Narrative Editor', [3760, 60]),
  code('🗓️ Agenda: Style Pass', '12-minutes-narrative', [3980, 60]),
  llm('🧠 LLM · Language Editor', [4200, 60]),
  code('📋 Minutes: Style', '13-minutes-style', [4420, 60]),

  /* ═══ 6. الفحص الآلي وطاولة الاجتماعات ═══ */
  code('🔍 Mechanical Inspector', '14-mechanical-inspector', [4640, 60], '↩︎ عودة دورة التعديل هنا. أرقام لا آراء.'),
  code('🗓️ Agenda: Review Panel', '15-agenda-panel', [4860, 60], 'كل النقاد يقرؤون النص في آنٍ واحد.'),
  llm('🧠 LLM · Review Panel', [5080, 60], 'نداء لكل ناقد على الطاولة.'),
  code('🗓️ Agenda: Chair Ruling', '16-minutes-panel', [5300, 60], 'تجميع التقارير ورفعها لرئيس المجلس.'),
  llm('🧠 LLM · Chair', [5520, 60]),
  code('🚪 Chair Ruling & Gate', '17-chair-gate', [5740, 60], 'البوابة تتحقق من الأرقام ولا تصدّق المجلس على عماه.'),

  { name: '🔀 Route', type: 'n8n-nodes-base.switch', typeVersion: 3.2, pos: [5960, 60],
    parameters: {
      rules: { values: ['approve', 'revise', 'restart', 'exhausted'].map((k) => ({
        conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
          conditions: [{ id: 'r-' + k, leftValue: '={{ $json.route }}', rightValue: k,
            operator: { type: 'string', operation: 'equals' } }], combinator: 'and' },
        renameOutput: true, outputKey: k
      })) },
      options: { fallbackOutput: 'extra', renameFallbackOutput: 'blocked' }
    } },

  /* ═══ 7. دورة التعديل ═══ */
  code('🗓️ Agenda: Revise', '18-agenda-revise', [6180, 300], 'تنفيذ موجز مجلس التحرير.'),
  llm('🧠 LLM · Reviser', [6400, 300]),
  code('📋 Minutes: Revise', '19-minutes-revise', [6620, 300], '↩︎ تعود إلى المفتش الآلي.'),
  code('♻️ Restart Session', '20-restart-session', [6180, 480], '↩︎ تعود إلى أجندة الكتابة.'),

  /* ═══ 8. التدقيق النهائي والتسليم ═══ */
  code('🗓️ Agenda: Final Audit', '21-agenda-final-audit', [6180, 60]),
  llm('🧠 LLM · Final Auditor', [6400, 60]),
  code('📦 Publish Pack', '22-publish-pack', [6620, 60], 'المقال + الميتا + Schema + التقارير + محضر الاجتماع.'),

  /* ═══ 9. بوابة الأرقام: لا يغادر رقم واحد قبل مراجعته ═══ */
  code('🔢 Numbers: Reconcile', '27-numbers-reconcile', [6840, 60],
       'يعيد اشتقاق كل رقم في التقرير من مصدره، ويعيد فحص أرقام المقال تمريرة ثانية مستقلة.'),

  { name: '🚦 Needs Adjudication?', type: 'n8n-nodes-base.if', typeVersion: 2.2, pos: [7060, 60],
    note: 'لا يُستدعى مراجع الأرقام إلا إن بقيت حالة رمادية — توفيرًا للنداءات.',
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: 'c-adj', leftValue: '={{ $json.needs_adjudication }}', rightValue: '',
        operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} } },

  llm('🧠 LLM · Number Auditor', [7280, -40], 'يحكم في الأرقام الرمادية فقط — ولا يملك تبرئة مخالفة حرجة.'),

  { name: '➖ No Adjudication', type: 'n8n-nodes-base.noOp', typeVersion: 1, pos: [7280, 180], parameters: {} },

  code('🧮 Numbers: Verdict', '28-numbers-verdict', [7500, 60],
       'الحكم النهائي على الأرقام + بطاقة الأرقام المعتمدة + إذن مغادرة التقرير.'),

  code('📐 Compare vs Reference', '25-compare-vs-reference', [7720, 60],
       'يقيس الناتج مقابل المقال المرجعي: الفحوص + بصمة الأسلوب.'),

  /* ═══ 10. التسليم بالبريد ═══ */
  code('📧 Build Email', '29-build-email', [7940, 60],
       'يطبّع عناوين المستلمين ويتحقق منها بلا أي تقييد على الدومين، ويبني الرسالة.'),

  { name: '🚦 Send Report?', type: 'n8n-nodes-base.if', typeVersion: 2.2, pos: [8160, 60],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: 'c-send', leftValue: '={{ $json.send }}', rightValue: '',
        operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} } },

  { name: '🚦 Gmail Transport?', type: 'n8n-nodes-base.if', typeVersion: 2.2, pos: [8380, -40],
    note: 'Gmail API يصل إلى أي عنوان. SMTP relay هو ما يُقيَّد عادةً بدومين واحد.',
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: 'c-gmail', leftValue: '={{ $json.use_gmail }}', rightValue: '',
        operator: { type: 'boolean', operation: 'true', singleValue: true } }], combinator: 'and' }, options: {} } },

  gmailSend('📧 Gmail: Send Report', [8600, -140], 'الاعتماد: Gmail OAuth2 بصلاحية gmail.send.'),
  smtpSend('📧 SMTP: Send Report', [8600, 60], 'الاعتماد: SMTP — تأكد أن الخادم يسمح بالإرسال خارج دومينك.'),

  { name: '➖ Not Sent', type: 'n8n-nodes-base.noOp', typeVersion: 1, pos: [8380, 260], parameters: {} },

  code('📮 Delivery Log', '30-delivery-log', [8820, 60],
       'يثبّت: هل وصل؟ لمن؟ ومن استُبعد ولماذا — في الشيت وفي رد الـ webhook.'),

  { name: '🚦 From Sheet?', type: 'n8n-nodes-base.if', typeVersion: 2.2, pos: [9040, 60],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: 'c-sheet', leftValue: '={{ $json.row_number }}', rightValue: '',
        operator: { type: 'number', operation: 'exists', singleValue: true } }], combinator: 'and' }, options: {} } },

  sheets('📝 Sheets: Write Results', [9260, -60],
    { operation: 'update',
      columns: { mappingMode: 'autoMapInputData', matchingColumns: ['row_number'], value: {}, schema: [] },
      options: {} },
    'يكتب المقال والتقارير والمقارنة وحكم بوابة الأرقام وحالة الإرسال في الصف نفسه.'),

  { name: '🚦 Webhook Reply?', type: 'n8n-nodes-base.if', typeVersion: 2.2, pos: [9260, 200],
    parameters: { conditions: { options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
      conditions: [{ id: 'c-hook', leftValue: '={{ $(\'🧾 Normalize Brief\').first().json.brief.delivery }}', rightValue: 'webhook',
        operator: { type: 'string', operation: 'equals' } }], combinator: 'and' }, options: {} } },

  { name: '📤 Respond to Webhook', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1.1, pos: [9480, 140],
    onError: 'continueRegularOutput',
    parameters: { respondWith: 'json', responseBody: '={{ JSON.stringify($json) }}', options: {} } },

  { name: '✅ Done', type: 'n8n-nodes-base.noOp', typeVersion: 1, pos: [9480, 300], parameters: {} },

  /* ═══ ملاحظات على اللوحة ═══ */
  sticky([
    '## 🪑 AI Editorial Boardroom — محرك المحتوى',
    '',
    'ورشة تحرير كاملة: مجلس إدارة + ورشة كتابة + لجنة نقد + مفتش آلي + فريق استشهادات.',
    'المقال يلف على الطاولة حتى يستوفي **كل** المعايير أو تنفد الدورات.',
    '',
    '### خطوات التشغيل (٣ دقائق)',
    '1. أنشئ Credential من نوع **Header Auth** باسم `LLM API Key`:',
    '   - Anthropic: Name = `x-api-key` ، Value = مفتاحك.',
    '   - OpenAI: Name = `Authorization` ، Value = `Bearer sk-...` ثم غيّر `provider` و`url` و`model` داخل عقدة **📚 Profiles Registry**.',
    '2. اربط الـ Credential بكل عقد `🧠 LLM · …` (اختره مرة وسيظهر في الباقي).',
    '3. عدّل عقدة **📥 Brief — EDIT ME**.',
    '4. اضغط Execute Workflow.',
    '',
    '### أين تُعدّل الأشياء؟',
    '- **الشخصيات والأدوار والمعايير والعتبات** → عقدة `📚 Profiles Registry` فقط.',
    '- **الفحوص الرقمية** → عقدة `🔍 Mechanical Inspector`.',
    '- **شكل التسليم** → عقدة `📦 Publish Pack`.'
  ].join('\n'), [-880, -560], 720, 440, 7),

  sticky([
    '### 1️⃣ المداخل',
    'ثلاثة مداخل تصبّ في نفس المحرك:',
    '- تشغيل يدوي + عقدة Brief.',
    '- نموذج ويب لفريق المحتوى.',
    '- Webhook للدمج مع أي نظام.',
    '',
    'كل المدخلات تُوحَّد في `🧾 Normalize Brief`،',
    'وتقبل أسماء الحقول بالعربية والإنجليزية.'
  ].join('\n'), [-420, -300], 400, 320, 5),

  sticky([
    '### 2️⃣ جلسة الإحاطة',
    '🧭 **سلمى القاسم** — مديرة الاستراتيجية: تحدد نية الباحث والزاوية التنافسية ورحلة القارئ.',
    '🏗️ **ياسر البنّاء** — مهندس الإحاطة: هيكل + ميزانية كلمات + خريطة كلمات + خريطة روابط.',
    '🪑 **مروان الحكم** — رئيس المجلس: يثبّت المخطط ويحسم التعارض **قبل** كتابة أي حرف.'
  ].join('\n'), [460, -300], 860, 320, 3),

  sticky([
    '### 3️⃣ فريق البحث والاستشهادات',
    '🔎 **نورة السند**: تبحث فعليًا على الإنترنت (web search) وتجمع أرقامًا بروابط مباشرة.',
    '🌐 **فحص الروابط الآلي**: كل رابط يُطلب فعليًا قبل الاستشهاد به.',
    '🧪 **د. عمر التدقيق**: يرفض أي رابط ميت أو رابط صفحة رئيسية أو رقم لا يطابق مصدره.',
    '',
    '⛔ لا يدخل النص رقمٌ خارج الحزمة المعتمدة.'
  ].join('\n'), [1340, -300], 1300, 320, 6),

  sticky([
    '### 4️⃣ ورشة الكتابة',
    '✍️ **ريم الكاتبة**: المسودة الكاملة من المخطط + الأدلة.',
    '🎬 **طارق الراوي**: يعيد هندسة التدفق وتسلسل الأفكار والانتقالات.',
    '🖋️ **هدى الصياغة**: النحو والترقيم وأدوات الربط وإزالة نبرة الذكاء الاصطناعي.',
    '',
    'حارس أمان: أي تمريرة تُرجع نصًا أقصر من 60% تُرفض آليًا وتبقى النسخة السابقة.'
  ].join('\n'), [3100, -300], 1300, 320, 5),

  sticky([
    '### 5️⃣ الفحص الآلي + طاولة الاجتماعات',
    '🔍 **المفتش الآلي**: عدد الكلمات، طول كل فقرة، إجابة كل H2، الميتا، تكرار الكلمة، FAQ،',
    'الروابط المكسورة، روابط الصفحة الرئيسية، الروابط المختلقة، العبارات الممنوعة، العامية…',
    '',
    'ثم يجلس ٩ نقاد على الطاولة في آنٍ واحد:',
    '📈 SEO · 🤖 AEO/GEO · 🎯 الإقناع · 🛡️ E-E-A-T · 📍 السوق المحلي · 🔥 الفريق الأحمر · 🕸️ الربط الداخلي · 📖 السرد · 📝 الصياغة',
    '',
    'كل ناقد مسؤول عن بنود محددة فقط، ولا يقيّم بنود زملائه.'
  ].join('\n'), [4640, -340], 1300, 360, 4),

  sticky([
    '### 6️⃣ الحسم والدوران',
    '🪑 رئيس المجلس يحسم التعارضات ويرفض الملاحظات الضعيفة',
    'ويدمج الباقي في **موجز تعديل واحد ≤ 12 بندًا**.',
    '',
    '🚪 **البوابة** لا تصدّقه: تتحقق من الأرقام بنفسها.',
    '- كل بند ≥ العتبة؟',
    '- صفر أخطاء حرجة؟',
    '- المفتش الآلي ناجح؟',
    '',
    'المسارات: `approve` → التدقيق النهائي · `revise` → دورة تعديل ↩︎',
    '`restart` → إعادة بناء من المخطط ↩︎ · `exhausted` → تسليم مع تقرير تحفّظات.'
  ].join('\n'), [5740, -380], 900, 400, 2),

  sticky([
    '### 7️⃣ التسليم',
    '⚖️ هيئة التدقيق النهائي تُصدر التقرير الكامل بمراحله السبع.',
    '',
    '📦 حزمة التسليم:',
    '- المقال Markdown + الميتا',
    '- JSON-LD (Article + FAQPage)',
    '- جدول المصادر + تقرير فحص الروابط',
    '- Scorecard + Opportunities + Critical Issues',
    '- **محضر الاجتماع كاملًا** (من قال ماذا ولماذا)',
    '',
    '➕ أضف بعد `📦 Publish Pack` عقدة Google Docs / WordPress / Slack كما تشاء.'
  ].join('\n'), [6620, -380], 800, 400, 7),

  sticky([
    '## 8️⃣ بوابة الأرقام — لا يغادر رقم قبل مراجعته',
    '',
    'الأرقام تُفحص **مرتين**: مرة داخل `🔍 Mechanical Inspector` فتدخل مخالفاتها موجز',
    'التعديل وتُصلَّح على الطاولة، ومرة هنا كتمريرة مستقلة قبل الإرسال مباشرة.',
    '',
    '**`🔢 Numbers: Reconcile`** يُعيد اشتقاق كل رقم في التقرير من مصدره الأصلي:',
    'عدد الكلمات، أسئلة FAQ، صفوف جدول المصادر، استشهادات الـ Schema،',
    'عدّاد المخالفات، الدرجة النهائية (متوسط بنود اللائحة لا ما أعلنه النموذج)،',
    'ثم يمسح التقرير والمحضر بحثًا عن أي رقم لا أصل له في المقال ولا في الأدلة.',
    '',
    '**`🧠 LLM · Number Auditor`** لا يُستدعى إلا إن بقيت حالة رمادية،',
    'ولا يملك تبرئة مخالفة حرجة — أقصى ما يملكه تصعيدها، أو تبرئة رقم رمادي',
    'بسبب مكتوب يُنشر بنصه في تقرير العميل.',
    '',
    '**`🧮 Numbers: Verdict`** يحسم: `clear` · `clear_with_notes` · `hold`.',
    'عند `hold` لا يُرسَل المقال إطلاقًا — يُرسَل إشعار حجز يشرح الخلل فقط.'
  ].join('\n'), [6840, -420], 1080, 440, 3),

  sticky([
    '## 9️⃣ البريد — يصل إلى Gmail كما يصل إلى دومينك',
    '',
    'سبب وصول الرسائل إلى عناوين الدومين دون Gmail هو دائمًا الناقل، لا الكود:',
    '',
    '**١. Google Workspace SMTP relay** مضبوط على «Only addresses in my domains».',
    'هذا الخيار يرفض كل مستلم خارجي بصمت. الحل: بدّله إلى',
    '«Any addresses» في Admin console، أو استخدم مسار Gmail API هنا.',
    '',
    '**٢. اعتماد Gmail بصلاحية ناقصة** — لا بد من `gmail.send`.',
    '',
    '**٣. SPF / DKIM / DMARC غير مضبوطة على الدومين** — الرسائل الداخلية تمر',
    'لأنها لا تخرج من الخادم، والخارجية تُرفض أو تُصنَّف spam.',
    '',
    '**٤. قائمة دومينات مسموحة في الكود** — هنا `allow_domains` فارغة عمدًا،',
    'أي **بلا أي تقييد**. وكل عنوان يُستبعد يُسجَّل مع سببه في',
    '`dropped_recipients` وفي عمود «حالة الإرسال» بالشيت.',
    '',
    'التفاصيل كاملة: `docs/EMAIL.md`'
  ].join('\n'), [7940, -420], 1080, 440, 6)
];

export const connections = {
  '▶️ Run Manually':        [['📥 Brief — EDIT ME']],
  '📥 Brief — EDIT ME':     [['🧾 Normalize Brief']],
  '📨 Form Intake':         [['🧾 Normalize Brief']],
  '🔌 Webhook Intake':      [['🧾 Normalize Brief']],
  '⏱️ Sheet Poll':          [['📊 Read Sheet Rows']],
  '📊 Read Sheet Rows':     [['🎯 Pick Pending Row']],
  '🎯 Pick Pending Row':    [['🧾 Normalize Brief', '🟡 Mark Row Running']],
  '🟡 Mark Row Running':    [['📝 Sheets: Mark Running']],
  '🧾 Normalize Brief':     [['📚 Profiles Registry']],
  '📚 Profiles Registry':   [['⚙️ Open Session']],
  '⚙️ Open Session':        [['🚦 Intake Complete?']],
  '🚦 Intake Complete?':    [['🗓️ Agenda: Kickoff'], ['⛔ Intake Rejected']],

  '🗓️ Agenda: Kickoff':        [['🧠 LLM · Kickoff Panel']],
  '🧠 LLM · Kickoff Panel':    [['🗓️ Agenda: Blueprint Lock']],
  '🗓️ Agenda: Blueprint Lock': [['🧠 LLM · Chair Blueprint']],
  '🧠 LLM · Chair Blueprint':  [['🗓️ Agenda: Research']],
  '🗓️ Agenda: Research':       [['🧠 LLM · Research (web search)']],
  '🧠 LLM · Research (web search)': [['🔗 Prep Link Checks']],
  '🔗 Prep Link Checks':       [['🚦 Has Links?']],
  '🚦 Has Links?':             [['🌐 HTTP · Link Check'], ['➖ No Links']],
  '🌐 HTTP · Link Check':      [['🗓️ Agenda: Fact-check']],
  '➖ No Links':               [['🗓️ Agenda: Fact-check']],
  '🗓️ Agenda: Fact-check':     [['🧠 LLM · Fact-checker']],
  '🧠 LLM · Fact-checker':     [['📋 Minutes: Fact-check']],
  '📋 Minutes: Fact-check':    [['🗓️ Agenda: Draft']],

  '🗓️ Agenda: Draft':          [['🧠 LLM · Lead Writer']],
  '🧠 LLM · Lead Writer':      [['🗓️ Agenda: Narrative Pass']],
  '🗓️ Agenda: Narrative Pass': [['🧠 LLM · Narrative Editor']],
  '🧠 LLM · Narrative Editor': [['🗓️ Agenda: Style Pass']],
  '🗓️ Agenda: Style Pass':     [['🧠 LLM · Language Editor']],
  '🧠 LLM · Language Editor':  [['📋 Minutes: Style']],
  '📋 Minutes: Style':         [['🔍 Mechanical Inspector']],

  '🔍 Mechanical Inspector':   [['🗓️ Agenda: Review Panel']],
  '🗓️ Agenda: Review Panel':   [['🧠 LLM · Review Panel']],
  '🧠 LLM · Review Panel':     [['🗓️ Agenda: Chair Ruling']],
  '🗓️ Agenda: Chair Ruling':   [['🧠 LLM · Chair']],
  '🧠 LLM · Chair':            [['🚪 Chair Ruling & Gate']],
  '🚪 Chair Ruling & Gate':    [['🔀 Route']],

  '🔀 Route': [
    ['🗓️ Agenda: Final Audit'],   // approve
    ['🗓️ Agenda: Revise'],        // revise
    ['♻️ Restart Session'],        // restart
    ['🗓️ Agenda: Final Audit'],   // exhausted
    ['🗓️ Agenda: Final Audit']    // blocked (fallback)
  ],

  '🗓️ Agenda: Revise':   [['🧠 LLM · Reviser']],
  '🧠 LLM · Reviser':    [['📋 Minutes: Revise']],
  '📋 Minutes: Revise':  [['🔍 Mechanical Inspector']],   // ↩︎ دورة التعديل
  '♻️ Restart Session':  [['🗓️ Agenda: Draft']],          // ↩︎ إعادة البناء

  '🗓️ Agenda: Final Audit': [['🧠 LLM · Final Auditor']],
  '🧠 LLM · Final Auditor': [['📦 Publish Pack']],
  '📦 Publish Pack':        [['🔢 Numbers: Reconcile']],

  '🔢 Numbers: Reconcile':  [['🚦 Needs Adjudication?']],
  '🚦 Needs Adjudication?': [['🧠 LLM · Number Auditor'], ['➖ No Adjudication']],
  '🧠 LLM · Number Auditor':[['🧮 Numbers: Verdict']],
  '➖ No Adjudication':      [['🧮 Numbers: Verdict']],
  '🧮 Numbers: Verdict':    [['📐 Compare vs Reference']],
  '📐 Compare vs Reference':[['📧 Build Email']],

  '📧 Build Email':         [['🚦 Send Report?']],
  '🚦 Send Report?':        [['🚦 Gmail Transport?'], ['➖ Not Sent']],
  '🚦 Gmail Transport?':    [['📧 Gmail: Send Report'], ['📧 SMTP: Send Report']],
  '📧 Gmail: Send Report':  [['📮 Delivery Log']],
  '📧 SMTP: Send Report':   [['📮 Delivery Log']],
  '➖ Not Sent':             [['📮 Delivery Log']],

  '📮 Delivery Log':        [['🚦 From Sheet?']],
  '⛔ Intake Rejected':     [['🚦 From Sheet?']],
  '🚦 From Sheet?':         [['📝 Sheets: Write Results'], ['🚦 Webhook Reply?']],
  '📝 Sheets: Write Results': [['🚦 Webhook Reply?']],
  '🚦 Webhook Reply?':      [['📤 Respond to Webhook'], ['✅ Done']]
};
