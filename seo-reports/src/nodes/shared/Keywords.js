// ============ الكلمات والصفحات ============
// ⚠️ الملف ده مولَّد — متعدّلوش من هنا.
//    عدّل ملف الإكسل وبعدين:
//      node tools/extract-keywords.mjs --xlsx=<ملف> --client=<العميل>
//      node tools/verify-pages.mjs --client=<العميل>
//      node build.mjs
//
// قاعدة القائمة: **أي كلمة من غير رابط صفحة مستهدفة مستبعدة.**
// السبب مش تنظيمي: الرقم اللي بيتبني على رابط محدد يقدر أي حد يراجعه في
// واجهة Search Console بفلتر Query + Page ويطلع نفس الرقم بالظبط. الكلمة
// من غير رابط رقمها بيبقى على مستوى الموقع كله ومحدش يقدر يتحقق منه.

/* @keywords */

const keywords = KW.keywords;
const excluded = (KW.dropped || []).map(function (d) { return { keyword: d.keyword, why: d.why }; });
// ==========================================

// تحقّق دفاعي: أي كلمة فاضية أو مكررة أو من غير رابط توقف الرن.
// أوقف الرن أحسن من إني أطلّع صف رقمه مش قابل للمراجعة.
//
// التكرار بيتحسب على **(الدولة + الكلمة)** مش على الكلمة لوحدها: العميل اللي
// بيشتغل في أكتر من سوق بيستهدف نفس الكلمة في كل سوق، ودول صفين مختلفين
// بأرقام مختلفة تمامًا — مش تكرار. التكرار الحقيقي هو نفس الكلمة مرتين في
// نفس الدولة، لأنه بيطلّع صفين متطابقين في التقرير.
const seen = {};
keywords.forEach(function (k, i) {
  const kw = String(k.keyword || '').trim();
  if (!kw) throw new Error('Keywords: الصف رقم ' + (i + 1) + ' من غير كلمة مفتاحية.');
  const country = String(k.country || '').trim();
  const key = country ? (country + '||' + kw) : kw;
  if (seen[key]) {
    throw new Error('Keywords: الكلمة "' + kw + '"' +
                    (country ? ' مكررة في "' + country + '"' : ' مكررة') + '.');
  }
  seen[key] = 1;
  k.country = country;
  k.keyword = kw;
  k.group   = String(k.group || 'بدون قسم').trim();
  k.page    = String(k.page || '').trim();
  k.article = String(k.article || '').trim();
  if (!k.page) {
    throw new Error('Keywords: الكلمة "' + kw + '" من غير رابط صفحة — ' +
                    'المفروض تكون اتستبعدت وقت التوليد. أعِد تشغيل extract-keywords.mjs.');
  }
});

if (!keywords.length) {
  throw new Error('Keywords: مفيش ولا كلمة معتمدة — كل الكلمات مالهاش روابط. ' +
                  'حط الروابط في الإكسل وأعِد التوليد.');
}

return [{ json: {
  keywords,
  keywordCount: keywords.length,
  excluded,
  excludedCount: excluded.length,
  keywordsSource: KW.source,
  keywordsExtractedAt: KW.extractedAt,
} }];
