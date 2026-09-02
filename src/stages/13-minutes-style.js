/* ── 13. استلام تمريرة الصياغة → يذهب للمفتش الآلي ── */
const REG   = $('📚 Profiles Registry').first().json.profiles;
const calls = $('🗓️ Agenda: Style Pass').all();
const s     = calls[0].json.state;
const cfg   = H.cfgOf(REG, s);
const resp  = $input.all();

let note = '';
if (H.chunked(cfg)) {
  const parts = H.collectSections(calls, resp);
  const r = H.applySections(s, parts, cfg, { floor: 0.6 });
  note = r.failed.length ? ('أقسام رُفضت وأُبقيت كما كانت: ' + r.failed.join(' | ')) : 'كل الأقسام مرّت';
  if (r.failed.length) s.warnings.push('تمريرة الصياغة: ' + note);
} else {
  const raw  = resp[0].json;
  const text = H.readText(raw);
  const err  = H.apiError(raw);
  const next = H.grabArticle(text);
  if (err || H.words(next) < H.words(s.article) * 0.6) {
    H.fail(s, 'style_pass', err || 'ناتج تمريرة الصياغة أقصر من المسموح — أُبقيت النسخة السابقة');
    s.warnings.push('تمريرة الصياغة رُفضت آليًا وأُبقيت النسخة السابقة.');
    note = 'رُفضت';
  } else {
    s.article = next;
    s.sections = H.splitSections(s.article);
    note = 'تم';
  }
}
s.article_versions.push({ round: s.round, stage: 'style_pass', words: H.words(s.article) });

H.minute(s, {
  stage: 'style_pass', actor: '🖋️ ' + H.persona(cfg, 'language_editor').name + ' — محررة اللغة',
  headline: 'أنهت التحرير اللغوي (' + H.words(s.article) + ' كلمة)', detail: note
});

return [{ json: { state: s } }];
