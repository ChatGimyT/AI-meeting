/* =============================================================
 * ردود مزيّفة من Google Search Console و Sheets.
 *
 * الفكرة: نعرف الإجابة الصح مقدّمًا، فنقدر نتأكد إن الأوتوميشن طلّعها.
 * السيناريوهات مبنية على حالات حصلت فعلًا في التقارير، مش حالات نظرية.
 * ============================================================= */

/* الصفحة المستهدفة بتتاخد من الطلب نفسه، فالسيناريوهات بتشتغل مع أي عميل */
const SITE = 'https://www.aaalojan.com';

/* آخر يوم عند جوجل فيه بيانات نهائية — ثابت عشان الاختبارات تبقى متكررة */
export const LATEST = '2026-08-31';
const freshnessDates = ['2026-08-29', '2026-08-30', LATEST];

/* الصفحة اللي بنقيس عليها في السيناريوهات: صفحة مقالة حقيقية من قائمة الكلمات */
export const TARGET = SITE + '/news/5/%D8%A7%D9%84%D8%AF%D9%85%D8%A7%D8%BA-%D9%88%D8%A7%D9%84%D8%AD%D8%A8%D9%84-%D8%A7%D9%84%D8%B4%D9%88%D9%83%D9%8A';

/* ---------- الحالة اللي كانت بتطلّع الرقم الغلط ----------
 * كلمة ظاهرة بـ ٣ صفحات:
 *   الصفحة المستهدفة  : موضع 20.9 · ظهور 144   ← ده الرقم الصح
 *   صفحة تانية متقفشة : موضع 10.0 · ظهور 1     ← ده اللي كان بيتاخد
 *   صفحة تالتة        : موضع 45.0 · ظهور 20
 *
 * الحساب القديم كان بياخد "أقل موضع" = 10.0 وظهوره 1.
 * الحساب الصح بياخد الصفحة المستهدفة نفسها = 20.9 وظهورها 144. */
export const THREE_PAGES = [
  { keys: [TARGET],                position: 20.9, impressions: 144, clicks: 6 },
  { keys: [SITE + '/tag/brain'],   position: 10.0, impressions: 1,   clicks: 0 },
  { keys: [SITE + '/news/9/other'],position: 45.0, impressions: 20,  clicks: 1 },
];
/* المتوسط الموزون بالظهور لكل الصفحات = (20.9×144 + 10×1 + 45×20) ÷ 165 */
export const SITE_WIDE_POSITION =
  Math.round(((20.9 * 144 + 10.0 * 1 + 45.0 * 20) / 165) * 10) / 10;
export const SITE_WIDE_IMPRESSIONS = 165;

/* شيت فاضي = أول تشغيلة (مفيش أرشيف) */
const emptySheet = { values: [] };

/* ردّ افتراضي: كل كلمة ظاهرة بصفحتها المستهدفة بموضع ثابت لكل فترة */
function steadyResponse(task, offsetByPeriod) {
  const page = task.page || TARGET;
  const off = offsetByPeriod ? offsetByPeriod(task.period) : 0;
  return {
    rows: [
      { keys: [page], position: 20 + off, impressions: 100, clicks: 4 },
      { keys: [SITE + '/tag/x'], position: 3.0, impressions: 1, clicks: 0 },
    ],
  };
}

/* هل الرابط ده الصفحة الرئيسية؟ (مالهاش مسار نغيّره) */
export const isHomepage = (u) => {
  const m = String(u).match(/^https?:\/\/[^/]+(\/.*)?$/);
  const path = (m && m[1]) || '/';
  return path.replace(/\/+$/, '') === '';
};

/* بيحوّل الرابط لمسار تاني — يحاكي رابط في الإكسل مش الكانوني.
 * محايد بالنسبة للعميل: بيشتغل مع aaalojan.com و shoug-lawyer.com وأي موقع. */
export const mangle = (u) => isHomepage(u)
  ? u
  : String(u).replace(/^(https?:\/\/[^/]+)\//, '$1/public/');

/* الافتراضي: كل الروابط سليمة وكانونية */
const healthyPage = (url) => ({ statusCode: 200, body: '<link rel="canonical" href="' + url + '">' });

export const SCENARIOS = {

  /* كل حاجة تمام: كل كلمة ظاهرة بصفحتها، والترتيب بيتحسّن آخر فترة */
  happy: {
    freshnessDates,
    sheet: emptySheet,
    existingSlides: ['slide_old_1', 'slide_old_2'],
    gscResponse: (task) => steadyResponse(task, (p) => 0),
    pageCheck: healthyPage,
    smtpAccepts: () => true,
  },

  /* رابط في ملف الكلمات بيعمل تحويل — لازم يتمسك قبل ما يطلّع رقم غلط */
  redirectingUrl: {
    freshnessDates,
    sheet: emptySheet,
    existingSlides: [],
    gscResponse: (task) => steadyResponse(task),
    pageCheck: (url) => isHomepage(url)
      ? { statusCode: 200, body: '<link rel="canonical" href="' + url + '">' }
      : { statusCode: 301, headers: { location: mangle(url) }, body: '' },
    smtpAccepts: () => true,
  },

  /* الحالة اللي كانت بتطلّع "POS 10 / IMP 1" بدل "20.9 / 144" */
  threePages: {
    freshnessDates,
    sheet: emptySheet,
    existingSlides: [],
    gscResponse: (task) => ({ rows: [
      { keys: [task.page || TARGET],   position: 20.9, impressions: 144, clicks: 6 },
      { keys: [SITE + '/tag/brain'],   position: 10.0, impressions: 1,   clicks: 0 },
      { keys: [SITE + '/news/9/other'],position: 45.0, impressions: 20,  clicks: 1 },
    ] }),
    pageCheck: healthyPage,
    smtpAccepts: () => true,
  },

  /* الصفحة المستهدفة مش ظاهرة خالص — المفروض '-' مش رقم صفحة تانية */
  pageMissing: {
    freshnessDates,
    sheet: emptySheet,
    existingSlides: [],
    gscResponse: () => ({ rows: [
      { keys: [SITE + '/tag/brain'],    position: 8.0,  impressions: 30, clicks: 1 },
      { keys: [SITE + '/news/99/other'],position: 12.0, impressions: 50, clicks: 2 },
    ] }),
    pageCheck: healthyPage,
    smtpAccepts: () => true,
  },

  /* جوجل رجّع خطأ لبعض الطلبات — الخانة تفضل فاضية ولا تتقال "اختفت" */
  fetchFailure: {
    freshnessDates,
    sheet: emptySheet,
    existingSlides: [],
    gscResponse: (task, ctx) => {
      /* أول كلمة بس بتفشل، وبتفضل فاشلة حتى في إعادة المحاولة */
      if (task.ki === 0) return { error: { code: 429, message: 'Quota exceeded' } };
      return steadyResponse(task);
    },
    pageCheck: healthyPage,
    smtpAccepts: () => true,
  },

  /* الرد بيتقصّ عند الحد الأقصى — لازم يتعلّم truncated */
  truncated: {
    freshnessDates,
    sheet: emptySheet,
    existingSlides: [],
    gscResponse: (task) => ({
      rows: new Array(1000).fill(0).map((_, i) => ({
        keys: [i === 0 ? (task.page || TARGET) : SITE + '/p/' + i],
        position: 20 + (i % 30), impressions: 10, clicks: 0,
      })),
    }),
    pageCheck: healthyPage,
    smtpAccepts: () => true,
  },

  /* الرابط في ملف الكلمات مش الرابط اللي جوجل مسجّله (redirect أو كانوني
   * مختلف). الكلمة ليها ترتيب كويس بس بصفحة تانية — والتقرير القديم كان
   * بيقول "مفيش ظهور" وهو غلط. المفروض يتبلّغ عنه بالاسم. */
  wrongUrl: {
    freshnessDates,
    sheet: emptySheet,
    existingSlides: [],
    gscResponse: (task) => ({ rows: [
      /* نفس الصفحة بس على مسار مختلف — يحاكي رابط بيعمل تحويل أو كانوني مختلف.
       * الصفحة الرئيسية مالهاش مسار تغيّره، فبتفضل مطابقة — وده المقصود:
       * السيناريو بيأثر على صفحات المقالات بس. */
      { keys: [mangle(task.page || TARGET)], position: 14.2, impressions: 210, clicks: 9 },
    ] }),
    pageCheck: healthyPage,
    smtpAccepts: () => true,
  },

  /* مفيش صلاحية على الموقع — الرن يقف ويبعت تشخيص */
  noAccess: {
    freshnessDates,
    gscAccessOk: false,
    sheet: emptySheet,
    existingSlides: [],
    gscResponse: () => ({ rows: [] }),
    pageCheck: healthyPage,
    smtpAccepts: () => true,
  },

  /* النموذج اخترع رقم في فقرة الرأي — لازم التعليق كله يتشال.
   * دي الحالة اللي بتخلي تقرير أرقامه صح يوصل فيه رقم مختلق. */
  aiInventsNumber: {
    freshnessDates,
    sheet: emptySheet,
    existingSlides: [],
    gscResponse: (task) => steadyResponse(task),
    pageCheck: healthyPage,
    smtpAccepts: () => true,
    aiComment: 'تحية طيبة بشمهندس أيمن مصطفى المدير،\n\n' +
      'الفترة دي شافت تحسّنًا واضحًا، والزيارات ارتفعت بنسبة 37% مقارنة بالفترة السابقة.\n\n' +
      'التوصية: زوّد المحتوى على الصفحات الأعلى ترتيبًا.',
  },

  /* نداء التعليق فشل — الرن يكمّل عادي والتقرير يتبعت من غيره */
  aiUnavailable: {
    freshnessDates,
    sheet: emptySheet,
    existingSlides: [],
    gscResponse: (task) => steadyResponse(task),
    pageCheck: healthyPage,
    smtpAccepts: () => true,
    aiComment: null,
  },

  /* شيت قديم بالشكل اللي كان بيكتبه جيل v2 عند الروضة:
   * ٤ أعمدة ثابتة (Country · Section · Keyword · Page) من غير عمود Article.
   * الكود الجديد بيكتب ٥ — فلازم نتأكد إنه بيقرا القديم صح ومابيضيّعش الأرشيف. */
  legacySheet: {
    freshnessDates,
    sheet: {
      values: [
        ['Country', 'Section', 'Keyword', 'Page', '2026-07 Pos', '2026-07 Impr', '2026-08 Pos', '2026-08 Impr'],
        ['السعودية', 'قسم', 'مصنع الروضة للبيوت المحمية', 'https://www.rgh.com.sa/', '4.5', '320', '3.9', '410'],
      ],
    },
    existingSlides: [],
    gscResponse: (task) => steadyResponse(task),
    pageCheck: healthyPage,
    smtpAccepts: () => true,
  },

  /* نفس الحالة بس المسار البديل (Gmail API) مفتوح — لازم يوصل للجيميل */
  gmailFallback: {
    freshnessDates,
    sheet: emptySheet,
    existingSlides: [],
    gscResponse: (task) => steadyResponse(task),
    pageCheck: healthyPage,
    smtpAccepts: (email) => /@rabeh\.org$/i.test(email),
    gmailApiAccepts: () => true,
    enableGmailFallback: true,
  },

  /* الناقل بيرفض أي مستلم بره الدومين — دي حالة SMTP relay المقفول */
  domainOnlySmtp: {
    freshnessDates,
    sheet: emptySheet,
    existingSlides: [],
    gscResponse: (task) => steadyResponse(task),
    smtpAccepts: (email) => /@rabeh\.org$/i.test(email),
  },
};
