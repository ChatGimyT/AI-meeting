#!/usr/bin/env node
// يبني ملفات n8n الأربعة من مصادر nodes/*.js + keywords/*.json.
//
//   node seo-reports/build.mjs
//
// الخرج في seo-reports/dist/ — استوردها في n8n مكان النسخ القديمة.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const NODES = path.join(HERE, 'nodes');
const DIST = path.join(HERE, 'dist');

// ---------------------------------------------------------------- بيانات المشاريع
const CREDS = {
  google: { googleOAuth2Api: { id: 'zqpCaDcnpV6T6BqM', name: 'rabeh.seven.b' } },
  smtp:   { smtp: { id: 'u4SuwA3OxF79v0f6', name: 'Rabeh SMTP' } },
  deepseek: { httpHeaderAuth: { id: 'UtZ5Hq48pibn5oXX', name: 'DeepSeek' } },
};
const DEEPSEEK_AUTH = 'httpHeaderAuth';

const MAIL_FROM = 'M.gamal@rabeh.org';

const PROJECTS = {
  alojan: {
    site: 'https://www.aaalojan.com/',
    company: 'مركز العوجان لجراحة المخ والأعصاب',
    fromName: 'رابح — تقارير SEO',
    countries: [{ code: 'sau', name: 'السعودية' }],
    keywords: 'alojan',
    // العوجان: مفيش روابط مؤكدة في خطة المحتوى، فبنسيب الرابط فاضي والكود
    // بياخد أعلى صفحة ظاهرة للكلمة.
    pageMatch: 'prefer',
    monthly: {
      name: 'ALOJAN - Monthly Final v3',
      spreadsheet: '13X32MF8WigiF0guqEfLk4H203Z8x4dSerK9Rg2f78kc',
      presentation: '1GtTpO3_8HlbwDR656qVeSdRAo_kTJC_8rtRHrOB-sAA',
      emails: { mailTo_1: 'm.gamal.zaid1@gmail.com', mailTo_2: '',
                mailCc_1: 'M.gamal@rabeh.org', mailCc_2: '', mailCc_3: '',
                mailCc_4: '', mailCc_5: '' },
    },
    weekly: {
      name: 'ALOJAN - Weekly Final v3',
      spreadsheet: '1llEe4oHQyDO2FDavXP4azh-AoFYmc1HQIDFWP5WdRKw',
      presentation: '1SMs_8ZoBkUrulcS9bZVlGRdLUKBSV5wg5aPMqjeio4I',
      emails: { mailTo_1: 'm.gamal.zaid1@gmail.com',
                mailCc_1: 'M.gamal@rabeh.org', mailCc_2: 'gm@rabeh.org',
                mailCc_3: 'mohamedamarawork@gmail.com', mailCc_4: 'soaad@rabeh.org' },
    },
  },
  shoug: {
    site: 'https://shoug-lawyer.com/',
    company: 'المحامية شوق',
    fromName: 'رابح — تقارير SEO',
    countries: [{ code: 'kwt', name: 'الكويت' }],
    keywords: 'shoug',
    pageMatch: 'prefer',
    monthly: {
      name: 'SHOUG - Monthly Final v3',
      spreadsheet: '1HAEfTjq3F4NlFVsbeh_VnyUyyqMLA8ZOWgdWt_aUfTI',
      presentation: '1hbep0bBhTpM36PqZq3rUlPlc7ocpqOzot2qe-Pgi_k8',
      emails: { mailTo_1: 'oo.cmohamedgamal71@gmail.com', mailTo_2: '', mailTo_3: '',
                mailCc_1: 'M.gamal@rabeh.org', mailCc_2: '', mailCc_3: '',
                mailCc_4: '', mailCc_5: '', mailCc_6: '' },
    },
    weekly: {
      name: 'SHOUG - Weekly Final v3',
      spreadsheet: '1O0gJG19A374AvnHSF_Lo-WSkvUlQPclM5pgE4S_IIJw',
      presentation: '1MvSnCMnbiw4-BiH5USN-ONasekFUYIDM1noUfKzW-SU',
      emails: { mailTo_1: 'oo.cmohamedgamal71@gmail.com',
                mailCc_1: 'M.gamal@rabeh.org', mailCc_2: 'gm@rabeh.org',
                mailCc_3: 'soaad@rabeh.org', mailCc_4: 'mohamedamarawork@gmail.com' },
    },
  },
};

const CADENCE = {
  monthly: {
    ar: 'الشهري', periodAr: 'الشهر', lastPeriodAr: 'الشهر الأخير',
    lagDays: 3,
    headerRe: String.raw`/^(\d{4}-\d{2})\s+(Pos|Impr)$/`,
    labelFn: [
      'const labelOf = (key) => AR_MON[Number(String(key).split(\'-\')[1]) - 1] || String(key);',
      'const lastLabelOf = (p) => labelOf(p.key);',
    ].join('\n'),
    monthMap: 'p => ({ key: p.key, label: labelOf(p.key) })',
    periodLabelFn: 'arMonth',
    headlineExpr: "'شهر ' + lastLabel + ' مقابل ' + prevLabel + '\\n' +\n",
    headerLine: "'تقرير شهر ' + nowLabel + (prevLabel ? ' &nbsp;•&nbsp; مقارنةً بشهر ' + prevLabel : '')",
    textHeader: "'شهر ' + nowLabel + (prevLabel ? ' مقارنةً بشهر ' + prevLabel : '')",
    subjectTail: "'شهر ' + nowLabel",
    schedule: { interval: [{ field: 'months', triggerAtDayOfMonth: 3, triggerAtHour: 8 }] },
  },
  weekly: {
    ar: 'الأسبوعي', periodAr: 'الأسبوع', lastPeriodAr: 'الأسبوع الأخير',
    lagDays: 3,
    headerRe: String.raw`/^(\d{4}-W\d{2})\s+(Pos|Impr)$/`,
    labelFn: [
      'const labelOf = (key) => String(key);',
      'const lastLabelOf = (p) => p.label || String(p.key);',
    ].join('\n'),
    monthMap: 'p => ({ key: p.key, label: p.label, caption: p.caption, year: p.year, startDate: p.startDate, endDate: p.endDate })',
    periodLabelFn: 'arWeek',
    headlineExpr: "lastLabel + ' مقابل ' + prevLabel + '\\n' +\n",
    headerLine: "nowLabel + (prevLabel ? ' &nbsp;•&nbsp; مقارنةً بـ' + prevLabel : '')",
    textHeader: "nowLabel + (prevLabel ? ' مقارنةً بـ' + prevLabel : '')",
    subjectTail: 'nowLabel',
    // الأربع 8 صباحًا: الأسبوع بيقفل الأحد وبيانات جوجل النهائية بتبقى جاهزة.
    schedule: { interval: [{ field: 'weeks', triggerAtDay: [3], triggerAtHour: 8 }] },
  },
};

// إعدادات بوابة الجودة
const MIN_COVERAGE = 0.98;
const MAX_HOLES = 12;

// ---------------------------------------------------------------- أدوات
const src = (f) => fs.readFileSync(path.join(NODES, f), 'utf8');

function withIncludes(code) {
  return code.replace(/^[ \t]*\/\/ @include ([\w.\-]+)$/gm, (_, f) => src(f).trimEnd());
}

function fill(code, vars) {
  let out = code;
  for (const [k, v] of Object.entries(vars)) {
    const token = `__${k}__`;
    if (!out.includes(token)) throw new Error(`القالب مافهوش ${token}`);
    out = out.split(token).join(v);
  }
  const left = out.match(/__[A-Z][A-Z0-9_]*__/g);
  if (left) throw new Error(`فاضل placeholders من غير قيمة: ${[...new Set(left)].join(', ')}`);
  return out;
}

let uid = 0;
const idOf = (name) => {
  // معرّف ثابت مشتق من اسم النود عشان الملفات تفضل قابلة للمقارنة بين البناءات.
  let h = 0x811c9dc5;
  for (const ch of `${name}#${uid}`) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  const hex = h.toString(16).padStart(8, '0');
  return `${hex}-0000-4000-8000-${hex}00000000`.slice(0, 36);
};

function node(name, type, typeVersion, position, parameters, extra = {}) {
  uid++;
  return { parameters, id: idOf(name), name, type, typeVersion, position, ...extra };
}

const code = (name, pos, js, extra = {}) =>
  node(name, 'n8n-nodes-base.code', 2, pos, { jsCode: js }, extra);

const http = (name, pos, params, extra = {}) =>
  node(name, 'n8n-nodes-base.httpRequest', 4.2, pos, params, extra);

const ifNode = (name, pos, conditions) =>
  node(name, 'n8n-nodes-base.if', 2, pos, {
    conditions: {
      options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 1 },
      conditions, combinator: 'and',
    },
    options: {},
  });

// ---------------------------------------------------------------- بناء ملف واحد
function buildWorkflow(projectKey, cadenceKey) {
  const P = PROJECTS[projectKey];
  const W = P[cadenceKey];
  const C = CADENCE[cadenceKey];
  uid = 0;

  const kwFile = path.join(HERE, 'keywords', `${P.keywords}.json`);
  const keywords = JSON.parse(fs.readFileSync(kwFile, 'utf8'));

  // ---- شبكة المواقع ----
  const X0 = 0, Y0 = 0, DX = 220;
  let col = 0;
  const at = (row = 0) => [X0 + DX * col++, Y0 + row * 200];

  // ---- Emails (Set) ----
  const emailAssignments = Object.entries(W.emails).map(([name, value], i) => ({
    id: `email-${i + 1}`, name, value, type: 'string',
  }));

  // ---- Search Volume (Set): تعديل يدوي اختياري فوق قيم الإكسل ----
  const svAssignments = keywords.map((k, i) => ({
    id: String(i + 1), name: k.keyword, value: '', type: 'string',
  }));

  const nodes = [];
  const push = (n) => { nodes.push(n); return n; };

  push(node('Manual Trigger', 'n8n-nodes-base.manualTrigger', 1, [X0, Y0 - 100], {}));
  push(node('Schedule Trigger', 'n8n-nodes-base.scheduleTrigger', 1.2, [X0, Y0 + 100], { rule: C.schedule }));
  col = 1;

  push(node('Emails', 'n8n-nodes-base.set', 3.4, at(), {
    assignments: { assignments: emailAssignments }, options: {},
  }));

  push(code('Config', at(), fill(src('config.js'), {
    SITE_URL: P.site,
    SPREADSHEET_ID: W.spreadsheet,
    SHEET_TAB: 'الورقة1',
    PRESENTATION_ID: W.presentation,
    COLUMNS: '15',
    LAG_DAYS: String(C.lagDays),
    MIN_COVERAGE: String(MIN_COVERAGE),
    MAX_HOLES: String(MAX_HOLES),
    PAGE_MATCH: P.pageMatch,
    COMPANY: P.company,
    MANAGER: 'بشمهندس أيمن مصطفى',
    MAIL_FROM,
    MAIL_FROM_NAME: P.fromName,
    MAIL_REPLY_TO: '',
    CADENCE: cadenceKey,
    COUNTRIES: JSON.stringify(P.countries, null, 2).replace(/\n/g, '\n'),
  })));

  push(http('Verify GSC Access', at(), {
    url: "=https://searchconsole.googleapis.com/webmasters/v3/sites/{{ encodeURIComponent($('Config').first().json.siteUrl) }}",
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'googleOAuth2Api',
    options: { timeout: 30000 },
  }, { credentials: CREDS.google, onError: 'continueRegularOutput', alwaysOutputData: true,
       retryOnFail: true, maxTries: 3, waitBetweenTries: 3000 }));

  push(ifNode('GSC Access Check', at(), [{
    id: 'gsc_ok', leftValue: '={{ $json.siteUrl }}', rightValue: '',
    operator: { type: 'string', operation: 'notEmpty', singleValue: true },
  }]));

  // --- سؤال جوجل عن آخر يوم فيه بيانات نهائية ---
  push(http('GSC Freshness', at(), {
    method: 'POST',
    url: "=https://searchconsole.googleapis.com/webmasters/v3/sites/{{ encodeURIComponent($('Config').first().json.siteUrl) }}/searchAnalytics/query",
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'googleOAuth2Api',
    sendBody: true, specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ startDate: new Date(Date.now() - 25*86400000).toISOString().slice(0,10), endDate: new Date().toISOString().slice(0,10), dimensions: ['date'], type: 'web', rowLimit: 30, dataState: $('Config').first().json.gscDataState }) }}",
    options: { timeout: 30000 },
  }, { credentials: CREDS.google, onError: 'continueRegularOutput', alwaysOutputData: true,
       retryOnFail: true, maxTries: 3, waitBetweenTries: 3000 }));

  push(code('Freshness Guard', at(), src('freshness-guard.js')));

  push(code('Keywords', at(), fill(src('keywords.js'), {
    SOURCE_LABEL: `seo-reports/keywords/${P.keywords}.json (من source.xlsx)`,
    KEYWORD_COUNT: String(keywords.length),
    KEYWORDS: JSON.stringify(keywords, null, 2),
  })));

  push(node('Search Volume', 'n8n-nodes-base.set', 3.4, at(), {
    assignments: { assignments: svAssignments }, options: {},
  }));

  push(http('Fetch Sheet', at(), {
    url: "=https://sheets.googleapis.com/v4/spreadsheets/{{ $('Config').first().json.spreadsheetId }}/values/{{ encodeURIComponent($('Config').first().json.sheetTab + '!A1:ZZ5000') }}?valueRenderOption=UNFORMATTED_VALUE&majorDimension=ROWS",
    authentication: 'predefinedCredentialType',
    nodeCredentialType: 'googleOAuth2Api',
    options: { timeout: 60000 },
  }, { credentials: CREDS.google, onError: 'continueRegularOutput', alwaysOutputData: true,
       retryOnFail: true, maxTries: 4, waitBetweenTries: 3000 }));

  push(code('Read Sheet', at(), fill(src('read-sheet.js'), { PERIOD_HEADER_RE: C.headerRe })));

  push(code('Build Tasks', at(), src(`build-tasks.${cadenceKey}.js`)));

  const gscBody = "={{ JSON.stringify({ startDate: $json.startDate, endDate: $json.endDate, dimensions: ['page'], type: 'web', rowLimit: $('Config').first().json.gscRowLimit, dataState: $('Config').first().json.gscDataState, dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: 'equals', expression: $json.keyword }, { dimension: 'country', operator: 'equals', expression: $json.countryCode }] }] }) }}";
  const gscUrl = "=https://searchconsole.googleapis.com/webmasters/v3/sites/{{ encodeURIComponent($('Config').first().json.siteUrl) }}/searchAnalytics/query";

  push(http('GSC Query', at(), {
    method: 'POST', url: gscUrl,
    authentication: 'predefinedCredentialType', nodeCredentialType: 'googleOAuth2Api',
    sendBody: true, specifyBody: 'json', jsonBody: gscBody,
    options: { timeout: 60000, batching: { batch: { batchSize: 5, batchInterval: 700 } } },
  }, { credentials: CREDS.google, onError: 'continueRegularOutput',
       // مهم: alwaysOutputData لازم تفضل false. لو اتفعّلت، n8n بيضيف عنصر
       // فاضي {} لما النود ما يطلّعش حاجة، والعنصر ده بيتقري غلط على إنه
       // "رد ناجح من غير بيانات" فيتكتب '-' في خانة أصلها فشل.
       alwaysOutputData: false,
       retryOnFail: true, maxTries: 5, waitBetweenTries: 5000 }));

  push(code('Collect Results', at(), withIncludes(src('collect-results.js'))));

  push(ifNode('Needs Retry?', at(), [{
    id: 'needs_retry', leftValue: '={{ $json.__retry }}', rightValue: true,
    operator: { type: 'boolean', operation: 'true', singleValue: true },
  }]));

  push(http('GSC Retry Query', at(1), {
    method: 'POST', url: gscUrl,
    authentication: 'predefinedCredentialType', nodeCredentialType: 'googleOAuth2Api',
    sendBody: true, specifyBody: 'json', jsonBody: gscBody,
    options: { timeout: 60000, batching: { batch: { batchSize: 3, batchInterval: 1500 } } },
  }, { credentials: CREDS.google, onError: 'continueRegularOutput', alwaysOutputData: false,
       retryOnFail: true, maxTries: 5, waitBetweenTries: 8000 }));

  push(code('Merge History', at(), withIncludes(fill(src('merge-history.js'), {
    LABEL_FN: C.labelFn,
    MONTH_MAP: C.monthMap,
  }))));

  push(code('Validate Data', at(), src('validate-data.js')));

  push(ifNode('Data Quality Gate', at(), [{
    id: 'data_ok', leftValue: '={{ $json.ok }}', rightValue: true,
    operator: { type: 'boolean', operation: 'true', singleValue: true },
  }]));

  push(http('Write To Sheet', at(), {
    method: 'PUT',
    url: "=https://sheets.googleapis.com/v4/spreadsheets/{{ $('Config').first().json.spreadsheetId }}/values/{{ encodeURIComponent($json.sheetRange) }}?valueInputOption=RAW",
    authentication: 'predefinedCredentialType', nodeCredentialType: 'googleOAuth2Api',
    sendBody: true, specifyBody: 'json',
    jsonBody: '={{ JSON.stringify({ values: $json.sheetValues }) }}',
    options: { timeout: 120000 },
  }, { credentials: CREDS.google, retryOnFail: true, maxTries: 4, waitBetweenTries: 4000 }));

  push(http('Get Presentation', at(), {
    url: "=https://slides.googleapis.com/v1/presentations/{{ $('Config').first().json.presentationId }}?fields=slides.objectId",
    authentication: 'predefinedCredentialType', nodeCredentialType: 'googleOAuth2Api',
    options: { timeout: 60000 },
  }, { credentials: CREDS.google, retryOnFail: true, maxTries: 3, waitBetweenTries: 3000 }));

  push(code('Build Delete Requests', at(), src('build-delete-requests.js')));

  push(ifNode('Has Old Slides?', at(), [{
    id: 'has_old_slides', leftValue: '={{ $json.deleteCount }}', rightValue: 0,
    operator: { type: 'number', operation: 'gt' },
  }]));

  push(http('Delete Old Slides', at(1), {
    method: 'POST',
    url: '=https://slides.googleapis.com/v1/presentations/{{ $json.presentationId }}:batchUpdate',
    authentication: 'predefinedCredentialType', nodeCredentialType: 'googleOAuth2Api',
    sendBody: true, specifyBody: 'json',
    jsonBody: '={{ JSON.stringify({ requests: $json.requests }) }}',
    options: { timeout: 120000 },
  }, { credentials: CREDS.google, retryOnFail: true, maxTries: 3, waitBetweenTries: 3000 }));

  push(code('Build Slide Batches', at(), src('build-slide-batches.js')));

  push(http('Create Slides', at(), {
    method: 'POST',
    url: '=https://slides.googleapis.com/v1/presentations/{{ $json.presentationId }}:batchUpdate',
    authentication: 'predefinedCredentialType', nodeCredentialType: 'googleOAuth2Api',
    sendBody: true, specifyBody: 'json',
    jsonBody: '={{ JSON.stringify({ requests: $json.requests }) }}',
    options: { timeout: 120000, batching: { batch: { batchSize: 1, batchInterval: 1200 } } },
    // batchUpdate في Slides ذرّية (كلها أو ولا حاجة) فإعادة المحاولة آمنة.
  }, { credentials: CREDS.google, retryOnFail: true, maxTries: 3, waitBetweenTries: 4000 }));

  push(code('Build Prompt', at(), withIncludes(fill(src('build-prompt.js'), {
    PERIOD_LABEL_FN: C.periodLabelFn,
    CADENCE_AR: C.ar,
    PERIOD_AR: C.periodAr,
    HEADLINE_EXPR: C.headlineExpr,
  }))));

  push(http('DeepSeek API', at(), {
    method: 'POST', url: 'https://api.deepseek.com/chat/completions',
    authentication: 'genericCredentialType', genericAuthType: DEEPSEEK_AUTH,
    sendBody: true, specifyBody: 'json',
    jsonBody: "={{ JSON.stringify({ model: 'deepseek-chat', temperature: 0.3, messages: [{ role: 'system', content: 'أنت خبير SEO تكتب تعليقاً موجزاً بالعربية. التزم بالتعليمات ولا تخترع أرقاماً.' },{ role: 'user', content: $json.prompt } ] }) }}",
    options: { timeout: 120000 },
  }, { credentials: CREDS.deepseek, retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
       onError: 'continueRegularOutput', alwaysOutputData: true }));

  push(code('Build Email', at(), withIncludes(fill(src('build-email.js'), {
    PERIOD_LABEL_FN: C.periodLabelFn,
    CADENCE_AR: C.ar,
    LAST_PERIOD_AR: C.lastPeriodAr,
    HEADER_LINE: C.headerLine,
    TEXT_HEADER: C.textHeader,
    SUBJECT_TAIL: C.subjectTail,
  }))));

  // ---------- الإيميلات ----------
  // emailFormat=both + نسخة نص + إلغاء توقيع n8n = أهم عوامل التوصيل لجيميل.
  const mailOpts = (extra = {}) => ({
    ccEmail: "={{ $('Config').first().json.mailCc }}",
    replyTo: "={{ $('Config').first().json.mailReplyTo }}",
    appendAttribution: false,
    ...extra,
  });

  push(node('Send Report Email', 'n8n-nodes-base.emailSend', 2.1, at(), {
    fromEmail: "={{ $('Config').first().json.mailFromDisplay }}",
    toEmail: "={{ $('Config').first().json.mailTo }}",
    subject: '={{ $json.subject }}',
    emailFormat: 'both',
    text: '={{ $json.emailText }}',
    html: '={{ $json.emailHtml }}',
    options: mailOpts(),
  }, { credentials: CREDS.smtp, retryOnFail: true, maxTries: 3, waitBetweenTries: 5000,
       alwaysOutputData: true, onError: 'continueRegularOutput' }));

  push(code('Delivery Audit', at(), src('delivery-audit.js')));

  push(ifNode('Needs Resend?', at(), [{
    id: 'needs_resend', leftValue: '={{ $json.__resend }}', rightValue: true,
    operator: { type: 'boolean', operation: 'true', singleValue: true },
  }]));

  push(node('Resend Individually', 'n8n-nodes-base.emailSend', 2.1, at(1), {
    fromEmail: "={{ $('Config').first().json.mailFromDisplay }}",
    toEmail: '={{ $json.recipient }}',
    subject: "={{ $('Build Email').first().json.subject }}",
    emailFormat: 'both',
    text: "={{ $('Build Email').first().json.emailText }}",
    html: "={{ $('Build Email').first().json.emailHtml }}",
    options: { replyTo: "={{ $('Config').first().json.mailReplyTo }}", appendAttribution: false },
  }, { credentials: CREDS.smtp, retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
       alwaysOutputData: true, onError: 'continueRegularOutput' }));

  push(code('Delivery Report', at(), src('delivery-report.js')));

  push(node('Delivery Alert Email', 'n8n-nodes-base.emailSend', 2.1, at(), {
    fromEmail: "={{ $('Config').first().json.mailFromDisplay }}",
    toEmail: "={{ $('Config').first().json.mailAlert }}",
    subject: '={{ $json.alertSubject }}',
    emailFormat: 'both',
    text: '={{ $json.alertText }}',
    html: '={{ $json.alertHtml }}',
    options: { replyTo: "={{ $('Config').first().json.mailReplyTo }}", appendAttribution: false },
  }, { credentials: CREDS.smtp, retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
       onError: 'continueRegularOutput' }));

  // ---- نودات التنبيه (فرع تحت) ----
  push(node('GSC Alert Email', 'n8n-nodes-base.emailSend', 2.1, [X0 + DX * 5, Y0 + 420], {
    fromEmail: "={{ $('Config').first().json.mailFromDisplay }}",
    toEmail: "={{ $('Config').first().json.mailTo }}",
    subject: '=تعذر الوصول لـ Google Search Console — تقرير SEO لم يُرسل',
    emailFormat: 'both',
    text: '=الأوتوميشن حاول يشتغل بس مقدرش يتأكد من الاتصال بـ Google Search Console '
        + '(الصلاحية غالبًا منتهية أو فيه مشكلة في الحساب المربوط).\n\n'
        + 'عشان كده التقرير ما اتبعتش، والشيت ما اتلمسش خالص — عشان منستلمش تقرير فاضي أو ببيانات غلط.\n\n'
        + 'لو سمحت راجع صلاحية حساب Google المربوط بالأوتوميشن (Google OAuth) في n8n وجدّدها، '
        + 'وبعدين شغّل الأوتوميشن تاني يدويًا من زرار Manual Trigger.',
    html: '=<div style="font-family:Calibri,Arial,sans-serif;direction:rtl;text-align:right;background:#f2f1ee;padding:24px;color:#142f38;font-size:14px;">'
        + '<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #d8d6d0;border-radius:10px;padding:22px;">'
        + '<h3 style="margin:0 0 12px 0;font-size:16px;">تنبيه من أوتوميشن تقرير SEO</h3>'
        + '<p style="line-height:1.8;">الأوتوميشن حاول يشتغل بس مقدرش يتأكد من الاتصال بـ Google Search Console '
        + '(الصلاحية غالبًا منتهية أو فيه مشكلة في الحساب المربوط).</p>'
        + '<p style="line-height:1.8;"><b>عشان كده التقرير ما اتبعتش، والشيت ما اتلمسش خالص</b> — عشان منستلمش تقرير فاضي أو ببيانات غلط.</p>'
        + '<p style="line-height:1.8;">لو سمحت راجع صلاحية حساب Google المربوط بالأوتوميشن (Google OAuth) في n8n وجدّدها، '
        + 'وبعدين شغّل الأوتوميشن تاني يدويًا من زرار Manual Trigger.</p>'
        + '</div></div>',
    options: mailOpts(),
  }, { credentials: CREDS.smtp, retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
       onError: 'continueRegularOutput' }));

  push(node('Data Alert Email', 'n8n-nodes-base.emailSend', 2.1, [X0 + DX * 18, Y0 + 420], {
    fromEmail: "={{ $('Config').first().json.mailFromDisplay }}",
    toEmail: "={{ $('Config').first().json.mailAlert }}",
    subject: '={{ $json.alertSubject }}',
    emailFormat: 'both',
    text: '={{ $json.alertText }}',
    html: '={{ $json.alertHtml }}',
    options: { replyTo: "={{ $('Config').first().json.mailReplyTo }}", appendAttribution: false },
  }, { credentials: CREDS.smtp, retryOnFail: true, maxTries: 2, waitBetweenTries: 5000,
       onError: 'continueRegularOutput' }));

  // ---------------------------------------------------------------- الوصلات
  const link = (from, to, out = 0) => ({ from, to, out });
  const wires = [
    link('Manual Trigger', 'Emails'),
    link('Schedule Trigger', 'Emails'),
    link('Emails', 'Config'),
    link('Config', 'Verify GSC Access'),
    link('Verify GSC Access', 'GSC Access Check'),
    link('GSC Access Check', 'GSC Freshness', 0),
    link('GSC Access Check', 'GSC Alert Email', 1),
    link('GSC Freshness', 'Freshness Guard'),
    link('Freshness Guard', 'Keywords'),
    link('Keywords', 'Search Volume'),
    link('Search Volume', 'Fetch Sheet'),
    link('Fetch Sheet', 'Read Sheet'),
    link('Read Sheet', 'Build Tasks'),
    link('Build Tasks', 'GSC Query'),
    link('GSC Query', 'Collect Results'),
    link('Collect Results', 'Needs Retry?'),
    link('Needs Retry?', 'GSC Retry Query', 0),
    link('Needs Retry?', 'Merge History', 1),
    link('GSC Retry Query', 'Merge History'),
    link('Merge History', 'Validate Data'),
    link('Validate Data', 'Data Quality Gate'),
    link('Data Quality Gate', 'Write To Sheet', 0),
    link('Data Quality Gate', 'Data Alert Email', 1),
    link('Write To Sheet', 'Get Presentation'),
    link('Get Presentation', 'Build Delete Requests'),
    link('Build Delete Requests', 'Has Old Slides?'),
    link('Has Old Slides?', 'Delete Old Slides', 0),
    link('Has Old Slides?', 'Build Slide Batches', 1),
    link('Delete Old Slides', 'Build Slide Batches'),
    link('Build Slide Batches', 'Create Slides'),
    link('Create Slides', 'Build Prompt'),
    link('Build Prompt', 'DeepSeek API'),
    link('DeepSeek API', 'Build Email'),
    link('Build Email', 'Send Report Email'),
    link('Send Report Email', 'Delivery Audit'),
    link('Delivery Audit', 'Needs Resend?'),
    link('Needs Resend?', 'Resend Individually', 0),
    link('Resend Individually', 'Delivery Report'),
    link('Delivery Report', 'Delivery Alert Email'),
  ];

  const names = new Set(nodes.map((n) => n.name));
  const connections = {};
  for (const w of wires) {
    if (!names.has(w.from)) throw new Error(`وصلة من نود مش موجود: ${w.from}`);
    if (!names.has(w.to)) throw new Error(`وصلة لنود مش موجود: ${w.to}`);
    connections[w.from] = connections[w.from] || { main: [] };
    const main = connections[w.from].main;
    while (main.length <= w.out) main.push([]);
    main[w.out].push({ node: w.to, type: 'main', index: 0 });
  }
  // فرع الـ IF اللي مالوش وصلة لازم يفضل مصفوفة فاضية مش undefined
  for (const c of Object.values(connections)) {
    c.main = c.main.map((a) => a || []);
  }

  return {
    name: W.name,
    nodes,
    pinData: {},
    connections,
    active: false,
    settings: {
      executionOrder: 'v1',
      binaryMode: 'separate',
      availableInMCP: false,
      timeSavedMode: 'fixed',
      timezone: 'Africa/Cairo',
      callerPolicy: 'workflowsFromSameOwner',
    },
    versionId: `seo-v3-${projectKey}-${cadenceKey}`,
    meta: { instanceId: 'seo-reports-v3' },
    nodeGroups: [],
    // مفيش `id` عن قصد: عشان n8n يستوردها كـ workflow جديد ويسيب القديم
    // زي ما هو للرجوع لو لزم.
    tags: [],
  };
}

// ---------------------------------------------------------------- تشغيل
fs.mkdirSync(DIST, { recursive: true });
const built = [];
for (const projectKey of Object.keys(PROJECTS)) {
  for (const cadenceKey of ['monthly', 'weekly']) {
    const wf = buildWorkflow(projectKey, cadenceKey);
    const file = path.join(DIST, `${wf.name}.json`);
    fs.writeFileSync(file, `${JSON.stringify(wf, null, 2)}\n`, 'utf8');
    built.push({ file, wf });
    console.log(`✓ ${wf.name}  —  ${wf.nodes.length} نود، ${Object.keys(wf.connections).length} وصلة`);
  }
}
console.log(`\nالخرج في: ${DIST}`);
