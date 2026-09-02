/* ── 12. استلام تمريرة السرد + أجندة محررة اللغة ── */
const REG   = $('📚 Profiles Registry').first().json.profiles;
const calls = $('🗓️ Agenda: Narrative Pass').all();
const s     = calls[0].json.state;
const cfg   = H.cfgOf(REG, s);
const resp  = $input.all();

let note = '';
if (H.chunked(cfg)) {
  const parts = H.collectSections(calls, resp);
  const r = H.applySections(s, parts, cfg, { floor: 0.6 });
  note = r.failed.length ? ('أقسام رُفضت وأُبقيت كما كانت: ' + r.failed.join(' | ')) : 'كل الأقسام مرّت';
  if (r.failed.length) s.warnings.push('تمريرة السرد: ' + note);
} else {
  const raw  = resp[0].json;
  const text = H.readText(raw);
  const err  = H.apiError(raw);
  const next = H.grabArticle(text);
  if (err || H.words(next) < H.words(s.article) * 0.6) {
    H.fail(s, 'narrative_pass', err || 'ناتج تمريرة السرد أقصر من المسموح — أُبقيت النسخة السابقة');
    s.warnings.push('تمريرة السرد رُفضت آليًا وأُبقيت النسخة السابقة.');
    note = 'رُفضت';
  } else {
    s.article = next;
    s.sections = H.splitSections(s.article);
    note = 'تم';
  }
}
s.article_versions.push({ round: s.round, stage: 'narrative_pass', words: H.words(s.article) });

H.minute(s, {
  stage: 'narrative_pass', actor: '🎬 ' + H.persona(cfg, 'narrative_editor').name + ' — محرر السرد',
  headline: 'أعاد هندسة التدفق (' + H.words(s.article) + ' كلمة)', detail: note
});

/* ---------- أجندة تمريرة الصياغة ---------- */
if (!H.chunked(cfg)) {
  const userText = [
    H.briefBlock(s, cfg), '', H.rulesBlock(cfg), '',
    H.articleBlock(s, 'النص المطلوب تحريره لغويًا'), '',
    '### مهمتك الآن\nأعيدي المقال كاملًا بعد التحرير اللغوي، بين العلامتين، دون تغيير المعنى أو حذف رابط أو مصدر.'
  ].join('\n');
  return [H.callFor(cfg, 'language_editor', userText, s, 'style_pass')];
}

return s.sections
  .filter(function (sec) { return sec.key !== '__sources__'; })
  .map(function (sec, i) {
    const userText = [
      H.briefBlock(s, cfg), '', H.rulesBlock(cfg), '',
      H.neighbourBlock(s, sec.key), '',
      '### القسم المطلوب تحريره لغويًا\n```markdown\n' + sec.md + '\n```', '',
      H.protectedBlock(sec.md), '',
      '### مهمتك الآن',
      'حرّري **هذا القسم وحده** لغويًا وأعيديه بين العلامتين.',
      'لا تغيّري المعنى ولا تحذفي رابطًا ولا مصدرًا ولا كلمة مفتاحية ولا نص العنوان.',
      'قسّمي أي فقرة تجاوزت ' + (((cfg.rules || {}).paragraph_max_words) || 150) + ' كلمة.',
      H.SECTION_SHAPE
    ].join('\n');
    const c = H.callFor(cfg, 'language_editor', userText, s, 'style_pass');
    c.json.meta.section_key = sec.key;
    c.json.meta.section_heading = sec.heading;
    c.json.meta.order = i;
    return c;
  });
