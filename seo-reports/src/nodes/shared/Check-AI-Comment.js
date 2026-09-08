// بيقرأ رد النموذج ويتحقق من كل رقم فيه قبل ما يدخل الإيميل.
//
// أي رقم مالوش أصل في الأرقام المحسوبة = التعليق كله يتشال. مش بنصلّح
// التعليق ولا بنشيل الرقم وسيبه — لأن الجملة اللي فيها رقم مختلق معناها
// كله مشكوك فيه، مش رقمها بس.
const prep = $('Build AI Comment').first().json || {};
const raw  = $input.first() ? ($input.first().json || {}) : {};

if (!prep.__ai) {
  return [{ json: { aiComment: '', aiOk: true, aiSkipped: true, aiNote: prep.aiSkipReason || '' } }];
}

/* قراءة الرد من أي مزوّد (DeepSeek/OpenAI أو Anthropic) */
function readText(r) {
  if (!r) return '';
  if (typeof r === 'string') return r;
  if (r.choices && r.choices[0] && r.choices[0].message) {
    const c = r.choices[0].message.content;
    return typeof c === 'string' ? c : '';
  }
  if (Array.isArray(r.content)) {
    return r.content.filter(b => b && b.type === 'text').map(b => b.text).join('\n');
  }
  return '';
}

const err = (raw.error !== undefined && raw.error !== null)
  ? (typeof raw.error === 'string' ? raw.error : (raw.error.message || JSON.stringify(raw.error))).slice(0, 250)
  : '';
let text = String(readText(raw) || '').trim();

if (err || !text) {
  return [{ json: { aiComment: '', aiOk: false, aiSkipped: true,
                    aiNote: err ? ('نداء التعليق فشل: ' + err) : 'النموذج رجّع نص فاضي' } }];
}

/* تنظيف: ممنوع Markdown ولا روابط — لو ظهرت نشيلها */
text = text.replace(/https?:\/\/\S+/g, '').replace(/[#*`_>]/g, '').replace(/\n{3,}/g, '\n\n').trim();

/* ---- التحقق: كل رقم في النص له أصل؟ ---- */
const AR_DIGITS = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9' };
const norm = text.replace(/[٠-٩]/g, ch => AR_DIGITS[ch] || ch).replace(/٫/g, '.').replace(/٪/g, '%');

const allowed = {};
(prep.allowedNumbers || []).forEach(v => { allowed[String(v)] = true; });

const found = norm.match(/\d+(?:\.\d+)?/g) || [];
const orphans = [];
found.forEach(v => {
  const n = Number(v);
  if (!isFinite(n)) return;
  if (allowed[String(Math.abs(n))]) return;
  if (Number.isInteger(n) && n <= 12) return;    /* أعداد صغيرة وصفية */
  if (orphans.indexOf(v) === -1) orphans.push(v);
});

if (orphans.length) {
  return [{ json: {
    aiComment: '', aiOk: false, aiSkipped: false,
    aiOrphans: orphans,
    aiRejectedText: text.slice(0, 600),
    aiNote: 'التعليق اتشال: فيه ' + orphans.length + ' رقم (' + orphans.join('، ') +
            ') مالوش أصل في الأرقام المحسوبة. رقم مختلق في فقرة رأي أخطر من غياب التعليق.',
  } }];
}

return [{ json: { aiComment: text, aiOk: true, aiSkipped: false, aiNote: '' } }];
