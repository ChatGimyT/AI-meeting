/* ── 13. استلام تمريرة الصياغة → يذهب للمفتش الآلي ── */
const REG  = $('📚 Profiles Registry').first().json.profiles;
const call = $('🗓️ Agenda: Style Pass').first();
const s    = call.json.state;
const cfg  = H.cfgOf(REG, s);

const raw  = $input.first().json;
const text = H.readText(raw);
const err  = H.apiError(raw);
const next = H.grabArticle(text);

if (err || H.words(next) < H.words(s.article) * 0.6) {
  H.fail(s, 'style_pass', err || 'ناتج تمريرة الصياغة أقصر من المسموح — أُبقيت النسخة السابقة');
  s.warnings.push('تمريرة الصياغة رُفضت آليًا وأُبقيت النسخة السابقة.');
} else {
  s.article = next;
  s.article_versions.push({ round: s.round, stage: 'style_pass', words: H.words(s.article) });
}

H.minute(s, {
  stage: 'style_pass', actor: '🖋️ ' + H.persona(cfg, 'language_editor').name + ' — محررة اللغة',
  headline: 'أنهت التحرير اللغوي (' + H.words(s.article) + ' كلمة)',
  detail: err ? ('فشل: ' + err) : 'تم'
});

return [{ json: { state: s } }];
