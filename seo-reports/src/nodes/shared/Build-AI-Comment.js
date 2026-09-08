// تعليق تحليلي قصير من نموذج لغوي — كان موجود عند الروضة بس.
//
// ⚠️ الخطر اللي بيحرسه النود ده: النموذج بيكتب **نص حر عن أرقام**، ودي بالظبط
// المنطقة اللي بيتولد فيها رقم مختلق («ارتفعت التحويلات ٤٠٪») من غير ما حد
// يشك — لأنه جوه فقرة تبدو معقولة جنب جدول أرقامه صح.
//
// فالقاعدة هنا: **أي رقم في التعليق لازم يكون له أصل في الأرقام المحسوبة.**
// الأرقام المسموحة: إحصائيات الملخص، ومواضع الكلمات ونسب تغيّرها، والسنوات.
// لو النموذج جاب رقم من عنده، التعليق كله يتشال ويتسجّل السبب — تعليق ناقص
// أرخص من رقم مختلق في تقرير بيتبعت لعميل.
const cfg = $('Config').first().json;
const res = $('Validate Data').first().json;
const st  = $('Report Stats').first().json;

if (!cfg.aiComment) {
  return [{ json: { __ai: false, aiSkipReason: 'التعليق التحليلي مقفول لهذا العميل', prompt: '' } }];
}

const m = res.months || [];
const li = m.length - 1, pi = m.length - 2;

/* ---- الأرقام المسموح للنموذج يذكرها ---- */
const allowed = {};
const allow = (v) => {
  const n = Number(v);
  if (isFinite(n)) allowed[String(Math.abs(n))] = true;
};
[st.up, st.down, st.same, st.fresh, st.gone, st.avg, (res.data || []).length].forEach(allow);
allow(new Date().getFullYear());
(m || []).forEach((mo) => { String(mo.key || '').split(/[-W]/).forEach(allow); });

const lines = [];
(res.data || []).forEach((d) => {
  const last = d.positions[li], prev = pi >= 0 ? d.positions[pi] : null;
  let pct = null, state;
  if (prev === null && last !== null)      { state = 'جديدة'; }
  else if (prev !== null && last === null) { state = 'اختفت'; }
  else if (prev !== null && last !== null && prev !== 0) {
    pct = Math.round(((prev - last) / prev) * 1000) / 10;
    state = pct > 0 ? 'تحسّن' : (pct < 0 ? 'تراجع' : 'ثابت');
  } else state = 'لا بيانات';
  allow(last); allow(prev); allow(pct); allow(d.impressions);
  lines.push('- ' + d.keyword + ' | السابق: ' + (prev === null ? '-' : prev) +
             ' | الحالي: ' + (last === null ? '-' : last) +
             ' | التغير: ' + (pct === null ? '-' : (pct > 0 ? '+' : '') + pct + '%') + ' | ' + state);
});

const label = (mo) => String((mo && (mo.label || mo.key)) || '');
const prompt =
'اكتب فقرتين قصيرتين فقط (بحد أقصى 90 كلمة) كتعليق تحليلي على تقرير SEO لشركة "' + cfg.company + '".\n' +
'ابدأ بالضبط بـ: "تحية طيبة ' + cfg.manager + ' المدير،"\n' +
'الرقم الأقل في الترتيب أفضل. النسبة الموجبة تحسّن والسالبة تراجع.\n' +
'لا تكتب جداول ولا قوائم ولا Markdown ولا رموز # أو *. نص عادي فقط. ولا تذكر أي روابط.\n' +
'**ممنوع تمامًا تذكر أي رقم غير الأرقام الموجودة في البيانات تحت.** لا تحسب نسبًا جديدة ' +
'ولا تتوقع أرقامًا مستقبلية ولا تقدّر شيئًا. لو محتاج تقول حاجة من غير رقم، قولها بالكلام.\n' +
'الفقرة الأولى: خلاصة الفترة. الفقرة الثانية: توصية عملية واحدة.\n\n' +
label(m[li]) + (pi >= 0 ? ' مقابل ' + label(m[pi]) : '') + '\n' +
'تحسّن: ' + st.up + ' | تراجع: ' + st.down + ' | ثابت: ' + st.same +
' | جديدة: ' + st.fresh + ' | اختفت: ' + st.gone + '\n' +
'متوسط التغير: ' + (st.avg > 0 ? '+' : '') + st.avg + '%\n\n' + lines.join('\n');

return [{ json: {
  __ai: true,
  prompt: prompt,
  allowedNumbers: Object.keys(allowed),
} }];
