/* ── 11. استلام المسودة (كاملة أو مُجزَّأة) + أجندة محرر السرد ── */
const REG   = $('📚 Profiles Registry').first().json.profiles;
const calls = $('🗓️ Agenda: Draft').all();
const s     = calls[0].json.state;
const cfg   = H.cfgOf(REG, s);
const resp  = $input.all();

let note = '';
if (H.chunked(cfg)) {
  const parts = H.collectSections(calls, resp);
  const r = H.applySections(s, parts, cfg, {});
  note = (r.failed.length ? 'أقسام أخفقت: ' + r.failed.join(' | ') : 'كل الأقسام سلّمت') +
         (r.truncated.length ? ' | مبتورة: ' + r.truncated.join('، ') : '');
  if (r.failed.length) H.fail(s, 'draft', note);
} else {
  const raw  = resp[0].json;
  const text = H.readText(raw);
  const err  = H.apiError(raw);
  if (err) H.fail(s, 'draft', err);
  if (H.truncated(raw, text)) {
    s.warnings.push('المسودة بُترت عند سقف مخرجات النموذج — فعّل llm.chunked_writing في الملف التعريفي.');
  }
  s.article = H.grabArticle(text);
  s.sections = H.splitSections(s.article);
  note = err ? ('فشل: ' + err) : 'نداء واحد كامل';

  const ur = text.match(/<<<UPDATE_REPORT>>>([\s\S]*?)<<<END_UPDATE_REPORT>>>/);
  if (ur) s.update_report = H.grabJson(ur[1]) || { _raw: ur[1].trim() };
}

s.article_versions.push({ round: s.round, stage: 'draft', words: H.words(s.article) });

H.minute(s, {
  stage: 'draft', actor: '✍️ ' + H.persona(cfg, 'lead_writer').name + ' — الكاتبة الأولى',
  headline: 'سلّمت المسودة (' + H.words(s.article) + ' كلمة' + (H.chunked(cfg) ? ' في ' + s.sections.length + ' قسمًا' : '') + ')',
  detail: note
});

/* ---------- أجندة تمريرة السرد ---------- */
const journey = '### رحلة القارئ المعتمدة\n' +
  ((s.strategy.reader_journey || []).map(function (x, i) { return (i + 1) + '. ' + x; }).join('\n') || '-');

if (!H.chunked(cfg)) {
  const userText = [
    H.briefBlock(s, cfg), '', journey, '', H.outlineBlock(s), '',
    H.articleBlock(s, 'المسودة المطلوب إعادة هندسة تدفقها'), '',
    '### مهمتك الآن\nأعد المقال كاملًا بعد ضبط التسلسل والانتقالات، بين العلامتين.'
  ].join('\n');
  return [H.callFor(cfg, 'narrative_editor', userText, s, 'narrative_pass')];
}

return s.sections
  .filter(function (sec) { return sec.key !== '__sources__'; })
  .map(function (sec, i) {
    const userText = [
      H.briefBlock(s, cfg), '', journey, '',
      '### خريطة الأقسام\n' + s.sections.map(function (x) { return (x.key === sec.key ? '➡️ ' : '   ') + x.key + ' — ' + (x.heading || '(الترويسة والمقدمة)'); }).join('\n'), '',
      H.neighbourBlock(s, sec.key), '',
      '### القسم المطلوب منك الآن\n```markdown\n' + sec.md + '\n```', '',
      H.protectedBlock(sec.md), '',
      '### مهمتك الآن',
      'أعد كتابة **هذا القسم وحده** بعد ضبط تدفقه وانتقاله مما قبله وإلى ما بعده.',
      'لا تضف معلومة أو رقمًا، ولا تحذف رابطًا أو مصدرًا أو كلمة مفتاحية، ولا تغيّر نص العنوان.',
      'حافظ على عدد كلمات القسم كما هو تقريبًا.',
      H.SECTION_SHAPE
    ].join('\n');
    const c = H.callFor(cfg, 'narrative_editor', userText, s, 'narrative_pass');
    c.json.meta.section_key = sec.key;
    c.json.meta.section_heading = sec.heading;
    c.json.meta.order = i;
    return c;
  });
