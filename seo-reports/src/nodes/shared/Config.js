// ============ إعدادات المشروع ============
// ⚠️ النود ده واحد للأربع تقارير (عوجان/شوق × شهري/أسبوعي).
//    كل اللي بيخص عميل معيّن بيتقرا من clients/<العميل>.json وبيتحقن هنا
//    وقت البناء. لو عايز تغيّر موقع أو شيت أو مستلمين — عدّل ملف العميل
//    وأعِد البناء، مش هنا.
//
//    السبب: أي تعديل في المنطق كان لازم يتعمل ٤ مرات، ودي بالظبط الطريقة
//    اللي بيها اتصلّح التقرير الأسبوعي وفضل الشهري غلط شهور.

/* @client */

// =======================================

const SITE_URL        = CLIENT.siteUrl;
const SPREADSHEET_ID  = CAD.spreadsheetId;
const SHEET_TAB       = CAD.sheetTab;
const PRESENTATION_ID = CAD.presentationId;
const COLUMNS         = CAD.columns;   // عدد الأعمدة في التقرير والسلايدز

// LAG_DAYS دلوقتي احتياطي بس: الأوتوميشن بيسأل جوجل نفسه آخر يوم فيه بيانات
// نهائية (نود GSC Freshness)، ولو السؤال ده فشل بنرجع للرقم ده.
const LAG_DAYS        = 3;
const REFETCH_LAST    = COLUMNS;       // بيعيد سحب كل الأعمدة من جوجل كل مرة

// ---- بوابة جودة البيانات ----
// أقل نسبة خانات مسحوبة بنجاح نسمح بعدها بالكتابة على الشيت وبناء التقرير.
// أقل من كده = الرن بيتوقف، الشيت ما بيتلمسش، وبيوصل إيميل بالتفاصيل.
const MIN_COVERAGE    = 0.98;
// أقصى عدد خانات ناقصة مسموح بيه حتى لو النسبة عدّت.
const MAX_HOLES       = 12;

// ---- إعدادات سحب جوجل سيرش كونسول ----
const GSC_ROW_LIMIT   = 1000;     // عدد الصفحات اللي بنطلبها لكل كلمة
const GSC_DATA_STATE  = 'final';  // بيانات نهائية بس — مش تقديرية
// إزاي بنحسب رقم الكلمة:
//   • الصفحة المستهدفة ظاهرة → رقم الصفحة دي بالظبط.
//     ده اللي بتشوفه في الواجهة لما تفلتر Query + Page.
//   • الصفحة مش ظاهرة و PAGE_MATCH = 'strict' → الخانة "مفيش ظهور" ('-').
//   • الصفحة مش ظاهرة و PAGE_MATCH = 'prefer' → رقم الموقع كله للكلمة
//     (المتوسط الموزون بالظهور)، ويتعلّم في التقرير إنه رقم موقع مش صفحة.
//
// 'strict' هو الافتراضي دلوقتي لأن كل كلمة في القائمة ليها رابط: الرقم بيوصف
// الصفحة دي وبس، ولو مش ظاهرة يبقى ظهورها صفر فعلًا — مش رقم صفحة تانية.
const PAGE_MATCH      = 'strict';
// الأعمدة الأحدث دي بس هي اللي مسموح لسحبة جديدة إنها تمسح رقم قديم منها.
// أي عمود أقدم من كده بياناته في جوجل مقفولة ومش بتتغير — فلو السحبة رجعت
// فاضية والأرشيف فيه رقم، بنمسك الأرشيف ونعلّمها.
const VOLATILE_TAIL   = 2;

const COMPANY   = CLIENT.company;
const MANAGER   = CLIENT.manager;

// ---- الإيميل ----
const MAIL_FROM      = CLIENT.mailFrom;          // لازم يساوي المستخدم في كريدنشيال SMTP
const MAIL_FROM_NAME = CLIENT.mailFromName;      // الاسم اللي بيظهر للمستلم
const MAIL_REPLY_TO  = '';   // سيبه فاضي عشان يستخدم MAIL_FROM

// مسار إرسال بديل عبر Gmail API لما SMTP يرفض المستلمين الخارجيين.
// شغّله بعد ما تضيف صلاحية gmail.send على كريدنشيال جوجل المربوط
// (نفس الكريدنشيال بتاع Search Console — مش محتاج واحد جديد).
// سيبه false لحد ما تضيف الصلاحية، وإلا النداء هيفشل بـ 403.
const MAIL_GMAIL_FALLBACK = false;

// الإيميلات بتتقرأ من نود "Emails".
// أي خانة اسمها بيبدأ بـ mailTo_ = مستلم أساسي | mailCc_ = نسخة CC.
// الخانات الفاضية بتتجاهل، وتقدر تحط أكتر من إيميل في نفس الخانة بينهم فاصلة.
const emailsNode = $('Emails').first().json || {};

// تحقق شكلي من صيغة الإيميل — بيمنع إن إيميل غلط يوقّف الإرسال كله.
const EMAIL_RE = /^[^\s@,;<>"']+@[^\s@,;<>"'.]+(\.[^\s@,;<>"'.]+)+$/;

function collect(prefix) {
  const seen = {};
  const good = [], bad = [];
  Object.keys(emailsNode)
    .filter(k => k.indexOf(prefix) === 0)
    .sort((a, b) => Number(a.split('_')[1] || 0) - Number(b.split('_')[1] || 0))
    .forEach(k => {
      String(emailsNode[k] == null ? '' : emailsNode[k])
        .split(/[,;]/)
        .map(s => s.trim())
        .filter(s => s)
        .forEach(s => {
          const key = s.toLowerCase();
          if (seen[key]) return;
          seen[key] = 1;
          (EMAIL_RE.test(s) ? good : bad).push(s);
        });
    });
  return { list: good, invalid: bad };
}

const to = collect('mailTo_');
const cc = collect('mailCc_');

// أي إيميل موجود في To بيتشال من CC — بعض سيرفرات SMTP بترفض التكرار.
const toKeys = {};
to.list.forEach(e => { toKeys[e.toLowerCase()] = 1; });
const ccList = cc.list.filter(e => !toKeys[e.toLowerCase()]);

const MAIL_TO = to.list.join(', ');
const MAIL_CC = ccList.join(', ');

// إيميل التنبيهات التقنية.
//
// كان بيتفلتر على دومين المُرسِل بس ("دي أضمن حاجة توصل")، والنتيجة إن أي
// تنبيه — رن وقف، بيانات ناقصة، إيميل ما وصلش — كان بيروح لعناوين رابح بس
// وعناوين الجيميل عمرها ما شافت حاجة. الفلتر ده اتشال: التنبيه بيروح لكل
// المستلمين زي التقرير بالظبط.
//
// لو الناقل بتاعك فعلاً مش بيوصّل بره الدومين، الحل مش إننا نخفي التنبيه —
// الحل في إعداد الناقل، ونود Delivery Audit بيشخّصه بالاسم.
const MAIL_ALERT = (to.list.concat(ccList).length ? to.list.concat(ccList) : [MAIL_FROM]).join(', ');
const MAIL_FROM_DOMAIN = String(MAIL_FROM).split('@')[1] || '';
const MAIL_EXTERNAL = to.list.concat(ccList)
  .filter(e => (e.split('@')[1] || '').toLowerCase() !== MAIL_FROM_DOMAIN.toLowerCase());

const COUNTRIES = CLIENT.countries;
// =======================================

return [{ json: {
  siteUrl: SITE_URL, spreadsheetId: SPREADSHEET_ID, sheetTab: SHEET_TAB,
  presentationId: PRESENTATION_ID, columns: COLUMNS, lagDays: LAG_DAYS,
  refetchLast: REFETCH_LAST,
  minCoverage: MIN_COVERAGE, maxHoles: MAX_HOLES,
  gscRowLimit: GSC_ROW_LIMIT, gscDataState: GSC_DATA_STATE,
  pageMatch: PAGE_MATCH, volatileTail: VOLATILE_TAIL,
  cadence: CADENCE,
  company: COMPANY, manager: MANAGER,
  mailFrom: MAIL_FROM,
  mailFromDisplay: MAIL_FROM_NAME ? ('"' + MAIL_FROM_NAME + '" <' + MAIL_FROM + '>') : MAIL_FROM,
  mailReplyTo: MAIL_REPLY_TO || MAIL_FROM,
  mailTo: MAIL_TO, mailCc: MAIL_CC, mailAlert: MAIL_ALERT,
  mailFromDomain: MAIL_FROM_DOMAIN,
  gmailFallback: MAIL_GMAIL_FALLBACK,
  mailExternal: MAIL_EXTERNAL,
  mailToList: to.list, mailCcList: ccList,
  mailAllList: to.list.concat(ccList),
  mailInvalid: to.invalid.concat(cc.invalid),
  countries: COUNTRIES,
} }];
