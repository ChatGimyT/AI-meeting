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
export function nodes(cadence, wf) {
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
      credentials: { googleOAuth2Api: { id: 'zqpCaDcnpV6T6BqM', name: 'rabeh.seven.b' } },
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
export function connections(cadence, wf) {
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
export function rewrite(cadence, wf) {
  const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));

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
