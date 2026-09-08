#!/usr/bin/env node
/* يبني نود Keywords للتقريرين من keywords/alojan.json — نفس القائمة للاتنين.
 *   node alojan/tools/gen-keywords.mjs */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'keywords', 'alojan.json'), 'utf8'));

const header = `// ============ الكلمات والصفحات ============
// ⚠️ الملف ده مولَّد — متعدّلوش من هنا.
//    عدّل ملف الإكسل وبعدين:
//      node alojan/tools/extract-keywords.mjs --xlsx=<path>
//      node alojan/tools/verify-pages.mjs
//      node alojan/build.mjs
//
// قاعدة القائمة: **أي كلمة من غير رابط صفحة مستهدفة مستبعدة.**
// السبب مش تنظيمي: الرقم اللي بيتبني على رابط محدد يقدر أي حد يراجعه في
// واجهة Search Console بفلتر Query + Page ويطلع نفس الرقم بالظبط. الكلمة
// من غير رابط رقمها بيبقى على مستوى الموقع كله ومحدش يقدر يتحقق منه.
//
// المصدر : ${src.source} · ورقة ${src.sheet}
// اتسحبت: ${src.extractedAt}
// عدد الكلمات المعتمدة : ${src.keywords.length}
// كلمات مستبعدة (مفيش رابط): ${src.dropped.length}
${src.dropped.map((d) => '//   ⛔ ' + d.keyword + '  — ' + d.why).join('\n')}

const keywords = ${JSON.stringify(src.keywords, null, 2)};

// الكلمات اللي اتشالت من التقرير — بتتذكر في الإيميل عشان محدش يفتكر
// إنها اتنسيت، ولما يتحط لها رابط تدخل تاني أوتوماتيك.
const excluded = ${JSON.stringify(src.dropped.map((d) => ({ keyword: d.keyword, why: d.why })), null, 2)};
// ==========================================

// تحقّق دفاعي: أي كلمة فاضية أو مكررة أو من غير رابط توقف الرن.
// أوقف الرن أحسن من إني أطلّع صف رقمه مش قابل للمراجعة.
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
  if (!k.page) {
    throw new Error('Keywords: الكلمة "' + kw + '" من غير رابط صفحة — ' +
                    'المفروض تكون اتستبعدت وقت التوليد. أعِد تشغيل extract-keywords.mjs.');
  }
});

return [{ json: {
  keywords,
  keywordCount: keywords.length,
  excluded,
  excludedCount: excluded.length,
  keywordsSource: ${JSON.stringify(src.source)},
  keywordsExtractedAt: ${JSON.stringify(src.extractedAt)},
} }];
`;

for (const cadence of ['monthly', 'weekly']) {
  fs.writeFileSync(path.join(ROOT, 'src', 'nodes', cadence, 'Keywords.js'), header, 'utf8');
}
console.log('✅ نود Keywords اتولّد للتقريرين: ' + src.keywords.length + ' كلمة معتمدة، ' +
            src.dropped.length + ' مستبعدة.');
