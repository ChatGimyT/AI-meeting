/* ── 19. استلام النسخة المعدّلة → تعود للمفتش الآلي والطاولة ── */
const REG  = $('📚 Profiles Registry').first().json.profiles;
const call = $('🗓️ Agenda: Revise').first();
const s    = call.json.state;
const cfg  = H.cfgOf(REG, s);

const raw  = $input.first().json;
const text = H.readText(raw);
const err  = H.apiError(raw);
const next = H.grabArticle(text);

if (err || H.words(next) < H.words(s.article) * 0.5) {
  H.fail(s, 'revise', err || 'النسخة المعدّلة ناقصة — أُبقيت النسخة السابقة');
  s.warnings.push('دورة تعديل ' + s.round + ': رُفض ناتج الكاتب آليًا وأُبقيت النسخة السابقة.');
} else {
  s.article = next;
  s.article_versions.push({ round: s.round, stage: 'revise', words: H.words(s.article) });
}

const ur = text.match(/<<<UPDATE_REPORT>>>([\s\S]*?)<<<END_UPDATE_REPORT>>>/);
if (ur) s.update_report = H.grabJson(ur[1]) || s.update_report;

H.minute(s, {
  stage: 'revise', actor: '🛠️ ' + H.persona(cfg, 'reviser').name,
  headline: 'سلّمت النسخة ' + s.round + ' (' + H.words(s.article) + ' كلمة) بعد تنفيذ ' + s.revision_brief.length + ' بندًا',
  detail: err ? ('فشل: ' + err) : 'تم — تعود إلى المفتش الآلي ثم الطاولة'
});

return [{ json: { state: s } }];
