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
const seen = {};
keywords.forEach(function (k, i) {
  const kw = String(k.keyword || '').trim();
  if (!kw) throw new Error('Keywords: الصف رقم ' + (i + 1) + ' من غير كلمة مفتاحية.');
  if (seen[kw]) throw new Error('Keywords: الكلمة "' + kw + '" مكررة.');
  seen[kw] = 1;
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
