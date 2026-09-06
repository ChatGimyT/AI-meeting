const cfg = $('Config').first().json;
const res = $('Validate Data').first().json;
const m = res.months || [];
const li = m.length - 1, pi = m.length - 2;
// @include _lib.report-labels.js
const periodLabel = __PERIOD_LABEL_FN__;
const lastLabel = m.length ? periodLabel(m[li]) : '';
const prevLabel = pi >= 0 ? periodLabel(m[pi]) : '';

let up = 0, down = 0, same = 0, gone = 0, fresh = 0, sum = 0, n = 0;
const lines = [];
(res.data || []).forEach(d => {
  const last = d.positions[li], prev = pi >= 0 ? d.positions[pi] : null;
  let pct = null, state;
  if (prev === null && last !== null) { state = 'جديدة'; fresh++; }
  else if (prev !== null && last === null) { state = 'اختفت'; gone++; }
  else if (prev !== null && last !== null && prev !== 0) {
    pct = Math.round(((prev - last) / prev) * 1000) / 10;
    sum += pct; n++;
    state = pct > 0 ? 'تحسّن' : (pct < 0 ? 'تراجع' : 'ثابت');
    if (pct > 0) up++; else if (pct < 0) down++; else same++;
  } else state = 'لا بيانات';
  lines.push('- ' + d.keyword + ' (' + d.country + ') | السابق: ' + (prev === null ? '-' : prev) +
             ' | الحالي: ' + (last === null ? '-' : last) +
             ' | التغير: ' + (pct === null ? '-' : (pct > 0 ? '+' : '') + pct + '%') + ' | ' + state);
});
const avg = n ? Math.round((sum / n) * 10) / 10 : 0;

const prompt =
'اكتب فقرتين قصيرتين فقط (بحد أقصى 90 كلمة) كتعليق تحليلي على تقرير SEO __CADENCE_AR__ لشركة "' + cfg.company + '".\n' +
'ابدأ بالضبط بـ: "تحية طيبة ' + cfg.manager + ' المدير،"\n' +
'الرقم الأقل في الترتيب أفضل. النسبة الموجبة تحسّن والسالبة تراجع.\n' +
'لا تكتب جداول ولا قوائم ولا Markdown ولا رموز # أو *. نص عادي فقط. ولا تذكر أي روابط.\n' +
'الفقرة الأولى: خلاصة __PERIOD_AR__. الفقرة الثانية: توصية عملية واحدة.\n\n' +
__HEADLINE_EXPR__ +
'تحسّن: ' + up + ' | تراجع: ' + down + ' | ثابت: ' + same + ' | جديدة: ' + fresh + ' | اختفت: ' + gone + '\n' +
'متوسط التغير: ' + (avg > 0 ? '+' : '') + avg + '%\n\n' + lines.join('\n');

return [{ json: { prompt, up, down, same, fresh, gone, avg, lastLabel, prevLabel } }];
