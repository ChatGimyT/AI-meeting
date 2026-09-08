// ============ إعدادات المشروع — عدّل من هنا بس ============
const SITE_URL        = 'https://www.aaalojan.com/';
const SPREADSHEET_ID  = '1llEe4oHQyDO2FDavXP4azh-AoFYmc1HQIDFWP5WdRKw';
const SHEET_TAB       = 'الورقة1';
const PRESENTATION_ID = '1SMs_8ZoBkUrulcS9bZVlGRdLUKBSV5wg5aPMqjeio4I';
const COLUMNS         = 15;   // عدد الأعمدة في التقرير والسلايدز

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
//   • الكلمة ليها رابط صفحة والصفحة ظاهرة → رقم الصفحة دي بالظبط.
//     ده اللي بتشوفه في الواجهة لما تفلتر Query + Page.
//   • مفيش رابط (أو الصفحة مش ظاهرة و PAGE_MATCH = 'prefer') → رقم الموقع
//     كله للكلمة: الظهور = مجموع كل الصفحات، والموضع = المتوسط الموزون
//     بالظهور. ده اللي بتشوفه في الواجهة لما تفلتر بالكلمة لوحدها.
// 'prefer' = لو الصفحة المستهدفة مش ظاهرة، نرجّع رقم الموقع كله ونعلّمها.
// 'strict' = الصفحة المستهدفة بس — وده الافتراضي دلوقتي لأن كل كلمة ليها رابط.
// 'strict' = الصفحة المحددة بس، وأي حاجة تانية تتحسب "مفيش ظهور".
const PAGE_MATCH      = 'strict';
// الأعمدة الأحدث دي بس هي اللي مسموح لسحبة جديدة إنها تمسح رقم قديم منها.
// أي عمود أقدم من كده بياناته في جوجل مقفولة ومش بتتغير — فلو السحبة رجعت
// فاضية والأرشيف فيه رقم، بنمسك الأرشيف ونعلّمها.
const VOLATILE_TAIL   = 2;

const COMPANY   = 'مركز العوجان لجراحة المخ والأعصاب';
const MANAGER   = 'بشمهندس أيمن مصطفى';

// ---- الإيميل ----
const MAIL_FROM      = 'M.gamal@rabeh.org';       // لازم يساوي المستخدم في كريدنشيال SMTP
const MAIL_FROM_NAME = 'رابح — تقارير SEO';  // الاسم اللي بيظهر للمستلم
const MAIL_REPLY_TO  = '';   // سيبه فاضي عشان يستخدم MAIL_FROM

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

// إيميل التنبيهات التقنية: بنختار العناوين اللي على نفس دومين المُرسِل
// (دي أضمن حاجة توصل)، ولو مفيش بنرجع للمُرسِل نفسه.
const fromDomain = String(MAIL_FROM).split('@')[1] || '';
const sameDomain = to.list.concat(ccList)
  .filter(e => e.split('@')[1] && e.split('@')[1].toLowerCase() === fromDomain.toLowerCase());
const MAIL_ALERT = (sameDomain.length ? sameDomain : [MAIL_FROM]).join(', ');

const COUNTRIES = [
  {
    "code": "sau",
    "name": "السعودية"
  }
];
// =======================================

return [{ json: {
  siteUrl: SITE_URL, spreadsheetId: SPREADSHEET_ID, sheetTab: SHEET_TAB,
  presentationId: PRESENTATION_ID, columns: COLUMNS, lagDays: LAG_DAYS,
  refetchLast: REFETCH_LAST,
  minCoverage: MIN_COVERAGE, maxHoles: MAX_HOLES,
  gscRowLimit: GSC_ROW_LIMIT, gscDataState: GSC_DATA_STATE,
  pageMatch: PAGE_MATCH, volatileTail: VOLATILE_TAIL,
  cadence: 'weekly',
  company: COMPANY, manager: MANAGER,
  mailFrom: MAIL_FROM,
  mailFromDisplay: MAIL_FROM_NAME ? ('"' + MAIL_FROM_NAME + '" <' + MAIL_FROM + '>') : MAIL_FROM,
  mailReplyTo: MAIL_REPLY_TO || MAIL_FROM,
  mailTo: MAIL_TO, mailCc: MAIL_CC, mailAlert: MAIL_ALERT,
  mailToList: to.list, mailCcList: ccList,
  mailAllList: to.list.concat(ccList),
  mailInvalid: to.invalid.concat(cc.invalid),
  countries: COUNTRIES,
} }];
