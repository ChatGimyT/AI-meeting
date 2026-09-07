// ============ الكلمات والصفحات ============
// ⚠️ الملف ده مولَّد من ملف الإكسل — متعدّلوش من هنا.
//    عدّل seo-reports/keywords/source.xlsx وبعدين:
//      python3 seo-reports/extract-keywords.py && node seo-reports/build.mjs
//
// كل سطر: group = القسم | page = رابط الصفحة المستهدفة | keyword = الكلمة |
// sv = عدد مرات البحث الشهري | article = اسم المقالة/الصفحة في خطة المحتوى.
//
// page مهم جدًا لأنه بيحدد الرقم اللي هيتكتب في التقرير:
//   • فيه رابط  → رقم الصفحة دي بالظبط = فلتر Query + Page في واجهة GSC.
//   • فاضي      → رقم الموقع كله للكلمة (مجموع الظهور + متوسط الموضع الموزون)
//                 = فلتر Query لوحده في الواجهة.
// الرابط بيتحط من عمود F في الإكسل أو من خرايط الأقسام في extract-keywords.py.
//
// المصدر: __SOURCE_LABEL__
// عدد الكلمات: __KEYWORD_COUNT__

const keywords = __KEYWORDS__;
// ==========================================

// تحقّق دفاعي: أي كلمة فاضية أو مكررة توقف الرن بدل ما تطلّع صف فاضي في التقرير.
const seen = {};
keywords.forEach((k, i) => {
  const kw = String(k.keyword || '').trim();
  if (!kw) throw new Error('Keywords: الصف رقم ' + (i + 1) + ' من غير كلمة مفتاحية.');
  if (seen[kw]) throw new Error('Keywords: الكلمة "' + kw + '" مكررة.');
  seen[kw] = 1;
  k.keyword = kw;
  k.group   = String(k.group || 'بدون قسم').trim();
  k.page    = String(k.page || '').trim();
  k.article = String(k.article || '').trim();
});

return [{ json: { keywords, keywordCount: keywords.length } }];
