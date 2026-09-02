/* ── 26. طلب ناقص: لا تُستهلك أي نداءات API، وتُبلَّغ لوحة التحكم ── */
/* __SHEET__ */
const s = $input.first().json.state;
const O = SHEET.out;

let rowNumber = null;
try { rowNumber = $('🎯 Pick Pending Row').first().json.row_number || null; } catch (e) { rowNumber = null; }

const row = { row_number: rowNumber };
row[O.status]      = '⛔ الطلب ناقص';
row[O.verdict]     = 'لم تبدأ الجلسة';
row[O.violations]  = 'حقول ناقصة: ' + (s.intake_missing || []).join('، ') +
                     ((s.warnings || []).length ? '\nتنبيهات: ' + s.warnings.join(' | ') : '');
row[O.score]       = '—';
row[O.finished_at] = new Date().toISOString().replace('T', ' ').slice(0, 19);
row[O.run_id]      = s.run_id;

return [{ json: Object.assign({ status: 'intake_rejected', missing: s.intake_missing, warnings: s.warnings }, row) }];
