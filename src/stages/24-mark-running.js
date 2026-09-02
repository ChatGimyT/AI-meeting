/* ── 24. تعليم الصف «قيد التنفيذ» قبل بدء الجلسة ── */
/* __SHEET__ */
const j = $input.first().json;
const out = {};
out.row_number = j.row_number;
out[SHEET.out.status] = '⏳ قيد التنفيذ';
out[SHEET.out.finished_at] = '';
out[SHEET.out.run_id] = '';
return [{ json: out, pairedItem: 0 }];
