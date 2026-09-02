/* ── 9. محضر تدقيق الحقائق (نهاية مرحلة الأدلة) ── */
const REG  = $('📚 Profiles Registry').first().json.profiles;
const call = $('🗓️ Agenda: Fact-check').first();
const s    = call.json.state;

const raw  = $input.first().json;
const text = H.readText(raw);
const err  = H.apiError(raw);
const data = H.grabJson(text) || {};
if (err) H.fail(s, 'factcheck', err);

s.evidence.approved    = data.approved || [];
s.evidence.rejected    = data.rejected || [];
s.evidence.stale       = data.stale || [];
s.evidence.must_remove = data.must_remove_from_article || [];
s.evidence.verdict     = data.verdict || 'pass';

H.minute(s, {
  stage: 'factcheck', actor: '🧪 د. عمر التدقيق — مدقق الحقائق',
  headline: 'اعتمد ' + s.evidence.approved.length + ' دليلًا ورفض ' + s.evidence.rejected.length,
  detail: (s.evidence.rejected || []).map(function (r) { return (r.url || r.id) + ': ' + r.reason; }).join(' | ') || 'لا مرفوضات'
});

if (s.evidence.verdict === 'insufficient_evidence') {
  s.warnings.push('فريق الاستشهادات: الأدلة غير كافية — سيُكتب المقال دون أرقام غير موثقة.');
}

return [{ json: { state: s } }];
