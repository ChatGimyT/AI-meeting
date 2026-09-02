/* ── 19. استلام النسخة المعدّلة → تعود للمفتش الآلي والطاولة ── */
const REG   = $('📚 Profiles Registry').first().json.profiles;
const calls = $('🗓️ Agenda: Revise').all();
const s     = calls[0].json.state;
const cfg   = H.cfgOf(REG, s);
const resp  = $input.all();

let note = '';
if (H.chunked(cfg)) {
  const parts = H.collectSections(calls, resp);
  const r = H.applySections(s, parts, cfg, { floor: 0.5 });
  note = r.failed.length ? ('أقسام رُفضت وأُبقيت كما كانت: ' + r.failed.join(' | ')) : 'كل الأقسام نُفِّذت';
  if (r.failed.length) s.warnings.push('دورة تعديل ' + s.round + ': ' + note);
} else {
  const raw  = resp[0].json;
  const text = H.readText(raw);
  const err  = H.apiError(raw);
  const next = H.grabArticle(text);
  if (err || H.words(next) < H.words(s.article) * 0.5) {
    H.fail(s, 'revise', err || 'النسخة المعدّلة ناقصة — أُبقيت النسخة السابقة');
    s.warnings.push('دورة تعديل ' + s.round + ': رُفض ناتج الكاتب آليًا وأُبقيت النسخة السابقة.');
    note = 'رُفضت';
  } else {
    s.article = next;
    s.sections = H.splitSections(s.article);
    note = 'تم';
  }
  const ur = text.match(/<<<UPDATE_REPORT>>>([\s\S]*?)<<<END_UPDATE_REPORT>>>/);
  if (ur) s.update_report = H.grabJson(ur[1]) || s.update_report;
}
s.article_versions.push({ round: s.round, stage: 'revise', words: H.words(s.article) });

H.minute(s, {
  stage: 'revise', actor: '🛠️ ' + H.persona(cfg, 'reviser').name,
  headline: 'سلّمت النسخة ' + s.round + ' (' + H.words(s.article) + ' كلمة) بعد تنفيذ ' + s.revision_brief.length + ' بندًا',
  detail: note
});

return [{ json: { state: s } }];
