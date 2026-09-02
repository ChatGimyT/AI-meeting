/* ── 11. استلام المسودة + أجندة محرر السرد ── */
const REG  = $('📚 Profiles Registry').first().json.profiles;
const call = $('🗓️ Agenda: Draft').first();
const s    = call.json.state;
const cfg  = H.cfgOf(REG, s);

const raw  = $input.first().json;
const text = H.readText(raw);
const err  = H.apiError(raw);
if (err) H.fail(s, 'draft', err);

s.article = H.grabArticle(text);
s.article_versions.push({ round: s.round, stage: 'draft', words: H.words(s.article) });

/* تقرير التحديث (ملف التحديث فقط) */
const ur = text.match(/<<<UPDATE_REPORT>>>([\s\S]*?)<<<END_UPDATE_REPORT>>>/);
if (ur) s.update_report = H.grabJson(ur[1]) || { _raw: ur[1].trim() };

H.minute(s, {
  stage: 'draft', actor: '✍️ ' + H.persona(cfg, 'lead_writer').name + ' — الكاتبة الأولى',
  headline: 'سلّمت المسودة (' + H.words(s.article) + ' كلمة)',
  detail: H.clip(s.article, 500)
});

const userText = [
  H.briefBlock(s, cfg), '',
  '### رحلة القارئ المعتمدة\n' + ((s.strategy.reader_journey || []).map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n') || '-'), '',
  H.outlineBlock(s), '',
  H.articleBlock(s, 'المسودة المطلوب إعادة هندسة تدفقها'), '',
  '### مهمتك الآن\nأعد المقال كاملًا بعد ضبط التسلسل والانتقالات، بين العلامتين.'
].join('\n');

return [H.callFor(cfg, 'narrative_editor', userText, s, 'narrative_pass')];
