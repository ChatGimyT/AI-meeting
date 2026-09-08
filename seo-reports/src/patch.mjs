/* =============================================================
 * تعديلات على بنية الـ workflow اللي مش جوه نودات الكود:
 * باراميترات نودات HTTP، نودات جديدة، وصلات، وإعدادات.
 * ============================================================= */

/* uuid ثابت من الاسم عشان الفروق في git تفضل نضيفة */
import crypto from 'node:crypto';
const uid = (seed) => {
  const h = crypto.createHash('sha1').update('alojan::' + seed).digest('hex');
  return [h.slice(0, 8), h.slice(8, 12), '4' + h.slice(13, 16),
          ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20), h.slice(20, 32)].join('-');
};

const codeNode = (name, pos) => ({
  parameters: { mode: 'runOnceForAllItems', jsCode: '__STAGE__' },
  id: uid(name), name, type: 'n8n-nodes-base.code', typeVersion: 2, position: pos,
});

/* ---------- نودات جديدة ---------- */
export function nodes(cadence, wf, client) {
  const anchor = wf.nodes.find((n) => n.name === 'Keywords') || { position: [0, 0] };
  const [x, y] = anchor.position;

  return [
    codeNode('Prep Page Checks', [x + 180, y + 220]),

    {
      parameters: {
        url: '={{ $json.url }}',
        sendHeaders: true,
        headerParameters: { parameters: [
          { name: 'User-Agent', value: 'ALOJAN-SEO-Report/1.0 (page verification; +https://www.rabeh.org)' },
          { name: 'Accept', value: 'text/html,application/xhtml+xml' },
        ] },
        options: {
          timeout: 25000,
          /* مانتبعش التحويل: احنا عايزين نعرف إن فيه تحويل أصلاً */
          redirect: { redirect: { followRedirects: false } },
          batching: { batch: { batchSize: 2, batchInterval: 1000 } },
          response: { response: { neverError: true, fullResponse: true, responseFormat: 'text' } },
        },
      },
      id: uid('Check Target Pages'), name: 'Check Target Pages',
      type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
      position: [x + 360, y + 220],
      alwaysOutputData: true, onError: 'continueRegularOutput',
      retryOnFail: true, maxTries: 2, waitBetweenTries: 3000,
      notes: 'فحص إن كل رابط صفحة مستهدفة هو الرابط الكانوني اللي جوجل بيسجّله.',
      notesInFlow: true,
    },

    codeNode('Page Check Report', [x + 540, y + 220]),

    codeNode('Build Gmail Fallback', [x + 180, y + 420]),

    {
      parameters: {
        method: 'POST',
        url: 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
        authentication: 'predefinedCredentialType',
        nodeCredentialType: 'googleOAuth2Api',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ raw: $json.raw }) }}',
        options: {
          timeout: 30000,
          batching: { batch: { batchSize: 2, batchInterval: 1000 } },
          response: { response: { neverError: true } },
        },
      },
      id: uid('Send via Gmail API'), name: 'Send via Gmail API',
      type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
      position: [x + 360, y + 420],
      credentials: { googleOAuth2Api: (client && client.googleCredential)
        ? { id: client.googleCredential.id, name: client.googleCredential.name }
        : { id: 'REPLACE_ME', name: 'Google account' } },
      alwaysOutputData: true, onError: 'continueRegularOutput',
      retryOnFail: true, maxTries: 2, waitBetweenTries: 4000,
      notes: 'مسار بديل لما SMTP يرفض المستلمين الخارجيين. محتاج صلاحية gmail.send على نفس كريدنشيال جوجل.',
      notesInFlow: true,
    },

    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
          conditions: [{ id: 'c-gmail', leftValue: '={{ $json.__gmailSend }}', rightValue: '',
                         operator: { type: 'boolean', operation: 'true', singleValue: true } }],
          combinator: 'and',
        },
        options: {},
      },
      id: uid('Gmail Fallback?'), name: 'Gmail Fallback?',
      type: 'n8n-nodes-base.if', typeVersion: 2.2,
      position: [x + 360, y + 320],
      notes: 'يشتغل بس لو MAIL_GMAIL_FALLBACK = true وفيه مستلم رفضه SMTP.',
      notesInFlow: true,
    },

    /* ═══ التعليق التحليلي ═══
     * العميل اللي مقفّله (aiComment: false) **ما بتتحطّلوش النودات أصلاً** —
     * مش بتتحط وتتخطى. ملف من غير نود لمزوّد خارجي أوضح لأي حد بيراجعه،
     * ومفيش احتمال إن حد يشغّله بالغلط من الواجهة. */
    ...(client && client.aiComment ? [
    codeNode('Build AI Comment', [x + 180, y + 620]),

    {
      parameters: {
        method: 'POST',
        url: (client && client.aiUrl) || 'https://api.deepseek.com/chat/completions',
        authentication: 'genericCredentialType',
        genericAuthType: 'httpHeaderAuth',
        sendBody: true,
        specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ model: ' +
          JSON.stringify((client && client.aiModel) || 'deepseek-chat') +
          ', temperature: 0.3, max_tokens: 400, messages: [{ role: "user", content: $json.prompt }] }) }}',
        options: {
          timeout: 120000,
          response: { response: { neverError: true } },
        },
      },
      id: uid('AI Comment API'), name: 'AI Comment API',
      type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2,
      position: [x + 360, y + 620],
      credentials: (client && client.aiCredential)
        ? { httpHeaderAuth: { id: client.aiCredential.id, name: client.aiCredential.name } }
        : { httpHeaderAuth: { id: 'REPLACE_ME', name: 'AI API Key' } },
      alwaysOutputData: true, onError: 'continueRegularOutput',
      retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
      notes: 'تعليق تحليلي قصير. كل رقم فيه بيتفحص في النود اللي بعده قبل ما يدخل الإيميل.',
      notesInFlow: true,
    },

    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
          conditions: [{ id: 'c-ai', leftValue: '={{ $json.__ai }}', rightValue: '',
                         operator: { type: 'boolean', operation: 'true', singleValue: true } }],
          combinator: 'and',
        },
        options: {},
      },
      id: uid('AI Comment?'), name: 'AI Comment?',
      type: 'n8n-nodes-base.if', typeVersion: 2.2,
      position: [x + 360, y + 520],
      notes: 'العميل اللي مقفّل التعليق بيعدّي من غير نداء ولا تكلفة.',
      notesInFlow: true,
    },

    codeNode('Check AI Comment', [x + 540, y + 620]),
    ] : []),

    /* بوابة: تنبيه التوصيل يتبعت بس لما يكون فيه مستلم ما وصلهوش */
    (function () {
      const dr = wf.nodes.find((n) => n.name === 'Delivery Report') || { position: [0, 0] };
      return {
        parameters: {
          conditions: {
            options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
            conditions: [{ id: 'c-alert', leftValue: '={{ $json.__silent }}', rightValue: '',
                           operator: { type: 'boolean', operation: 'false', singleValue: true } }],
            combinator: 'and',
          },
          options: {},
        },
        id: uid('Delivery Alert?'), name: 'Delivery Alert?',
        type: 'n8n-nodes-base.if', typeVersion: 2.2,
        position: [dr.position[0] + 180, dr.position[1]],
        notes: 'مايبعتش تنبيه لو كل المستلمين قبلهم السيرفر من أول مرة.',
        notesInFlow: true,
      };
    })(),
  ];
}

/* ---------- وصلات ---------- */
export function connections(cadence, wf, client) {
  /* بندخّل سلسلة فحص الروابط بين Keywords و Search Volume */
  return {
    'Keywords':          { main: [[{ node: 'Prep Page Checks', type: 'main', index: 0 }]] },
    'Prep Page Checks':  { main: [[{ node: 'Check Target Pages', type: 'main', index: 0 }]] },
    'Check Target Pages':{ main: [[{ node: 'Page Check Report', type: 'main', index: 0 }]] },
    'Page Check Report': { main: [[{ node: 'Search Volume', type: 'main', index: 0 }]] },

    /* الفرع "مفيش إعادة إرسال" كان بيروح للعدم، فلو الناقل رفض المستلمين
     * الخارجيين ما كانش حد بيعرف. دلوقتي الفرعين بيوصلوا لتقرير التوصيل. */
    'Needs Resend?': { main: [
      [{ node: 'Resend Individually',   type: 'main', index: 0 }],
      [{ node: 'Build Gmail Fallback',  type: 'main', index: 0 }],
    ] },

    /* التعليق التحليلي بين إحصائيات التقرير وبناء الإيميل — لو مقفول،
     * Report Stats بيروح لـ Build Email على طول والسلسلة مش موجودة أصلاً. */
    ...((client && client.aiComment) ? {
      'Report Stats':      { main: [[{ node: 'Build AI Comment', type: 'main', index: 0 }]] },
      'Build AI Comment':  { main: [[{ node: 'AI Comment?', type: 'main', index: 0 }]] },
      'AI Comment?': { main: [
        [{ node: 'AI Comment API',   type: 'main', index: 0 }],
        [{ node: 'Check AI Comment', type: 'main', index: 0 }],
      ] },
      'AI Comment API':    { main: [[{ node: 'Check AI Comment', type: 'main', index: 0 }]] },
      'Check AI Comment':  { main: [[{ node: 'Build Email', type: 'main', index: 0 }]] },
    } : {
      'Report Stats':      { main: [[{ node: 'Build Email', type: 'main', index: 0 }]] },
    }),

    /* المسار البديل: Gmail API لما SMTP يرفض الخارجيين */
    'Build Gmail Fallback': { main: [[{ node: 'Gmail Fallback?', type: 'main', index: 0 }]] },
    'Gmail Fallback?': { main: [
      [{ node: 'Send via Gmail API', type: 'main', index: 0 }],
      [{ node: 'Delivery Report',    type: 'main', index: 0 }],
    ] },
    'Send via Gmail API': { main: [[{ node: 'Delivery Report', type: 'main', index: 0 }]] },

    /* التنبيه مابيتبعتش إلا لما يكون فيه حاجة تتقال */
    'Delivery Report': { main: [[{ node: 'Delivery Alert?', type: 'main', index: 0 }]] },
    'Delivery Alert?': { main: [[{ node: 'Delivery Alert Email', type: 'main', index: 0 }]] },
  };
}

/* ---------- إعدادات الـ workflow ---------- */
export function settings(cadence, wf) {
  return {};
}

/* ---------- تعديلات حرة على نودات قائمة ---------- */
export function rewrite(cadence, wf, client) {
  const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));

  /* ═══ Create Slides: ممنوع retry ═══
   * الطلب بيبعت objectIds بنولّدها احنا، يعني **مش idempotent**: لو اتبعت
   * تاني بعد ما نجح، جوجل بيرد 400 "The object ID should be unique among
   * all pages". و n8n لما بيعيد نود بيعيده من العنصر صفر مش من العنصر اللي
   * فشل — فأول سلايد بيصطدم بنفسه، والعطل العابر بيتحول لعطل دائم وعرض
   * نص مبني. التقرير الأسبوعي للعوجان كان متصلَّح، والتلاتة التانيين لأ. */
  /* ═══ كريدنشيال جوجل لكل عميل ═══
   * الروضة على حساب جوجل مختلف عن العوجان وشوق. البنية واحدة، فالكريدنشيال
   * لازم يتحقن من ملف العميل مش يتساب زي ما هو في القالب. */
  const gcred = client && client.googleCredential;
  if (gcred) {
    wf.nodes.forEach((n) => {
      if (n.credentials && n.credentials.googleOAuth2Api) {
        n.credentials.googleOAuth2Api = { id: gcred.id, name: gcred.name };
      }
    });
  }

  const cs = byName['Create Slides'];
  if (cs) {
    delete cs.retryOnFail;
    delete cs.maxTries;
    delete cs.waitBetweenTries;
    cs.onError = 'continueRegularOutput';
    cs.alwaysOutputData = true;
  }

  /* ═══ توحيد طلب GSC بين التقريرين ═══
   * aggregationType: 'byPage' بيخلي جوجل يحسب الموضع لكل صفحة على حدة —
   * وده اللي واجهة Search Console بتعرضه في تبويب الصفحات. من غيره جوجل
   * بيستخدم auto فيطلع رقم مختلف لنفس الكلمة في نفس اليوم. كان موجود في
   * الأسبوعي وناقص في الشهري، وده أحد أسباب اختلاف التقريرين. */
  ['GSC Query', 'GSC Retry Query'].forEach((name) => {
    const n = byName[name];
    if (!n || typeof n.parameters.jsonBody !== 'string') return;
    if (n.parameters.jsonBody.includes('aggregationType')) return;
    n.parameters.jsonBody = n.parameters.jsonBody.replace(
      "type: 'web',", "type: 'web', aggregationType: 'byPage',");
  });

  /* حد الصفوف اتوحّد على 1000 في Config — نتأكد إن النود بيقراه من Config
   * مش من رقم متثبّت. */
  ['GSC Query', 'GSC Retry Query'].forEach((name) => {
    const n = byName[name];
    if (!n) return;
    if (!/gscRowLimit/.test(String(n.parameters.jsonBody || ''))) {
      throw new Error(cadence + '/' + name + ': rowLimit مش مقروء من Config');
    }
  });
}
