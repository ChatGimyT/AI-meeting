/* ── 12. استلام تمريرة السرد + أجندة محررة اللغة ── */
const REG  = $('📚 Profiles Registry').first().json.profiles;
const call = $('🗓️ Agenda: Narrative Pass').first();
const s    = call.json.state;
const cfg  = H.cfgOf(REG, s);

const raw  = $input.first().json;
const text = H.readText(raw);
const err  = H.apiError(raw);
const next = H.grabArticle(text);

if (err || H.words(next) < H.words(s.article) * 0.6) {
  H.fail(s, 'narrative_pass', err || 'ناتج تمريرة السرد أقصر من المسموح — أُبقيت النسخة السابقة');
  s.warnings.push('تمريرة السرد رُفضت آليًا وأُبقيت النسخة السابقة.');
} else {
  s.article = next;
  s.article_versions.push({ round: s.round, stage: 'narrative_pass', words: H.words(s.article) });
}

H.minute(s, {
  stage: 'narrative_pass', actor: '🎬 ' + H.persona(cfg, 'narrative_editor').name + ' — محرر السرد',
  headline: 'أعاد هندسة التدفق (' + H.words(s.article) + ' كلمة)',
  detail: err ? ('فشل: ' + err) : 'تم'
});

const userText = [
  H.briefBlock(s, cfg), '',
  H.rulesBlock(cfg), '',
  H.articleBlock(s, 'النص المطلوب تحريره لغويًا'), '',
  '### مهمتك الآن\nأعيدي المقال كاملًا بعد التحرير اللغوي، بين العلامتين، دون تغيير المعنى أو حذف رابط أو مصدر.'
].join('\n');

return [H.callFor(cfg, 'language_editor', userText, s, 'style_pass')];
