/* ── 27. مصالحة أرقام التقرير (L6) + تجهيز مراجع الأرقام ─────────
 * لا يثق هذا المفتش بأي رقم كتبه أحد قبله — ولا بنفسه في المرة السابقة.
 * يعيد اشتقاق كل رقم يظهر في حزمة التسليم من مصدره الأصلي ويقارن،
 * ثم يعيد فحص أرقام المقال من الصفر (تمريرة ثانية مستقلة)،
 * ثم يمسح التقرير والمحضر بحثًا عن أي رقم لا أصل له.
 * ما لا يستطيع حسمه رقميًا فقط يُرفع إلى مراجع الأرقام.
 * ─────────────────────────────────────────────────────────────── */
/* __NUMBERS__ */

const REG  = $('📚 Profiles Registry').first().json.profiles;
const pack = $input.first().json;
const s    = $('🗓️ Agenda: Final Audit').first().json.state;
const cfg  = H.cfgOf(REG, s);
const C    = H.N.conf(cfg);

const A  = H.parseArticle(pack.article_markdown || '');
const md = pack.article_markdown || '';

/* ══════════ 1) إعادة اشتقاق كل رقم في حزمة التسليم ══════════
 * المصدر الوحيد لكل رقم هو النص نفسه، لا ما قاله نموذج لغوي عنه. */
const words      = H.words(A.body);
const faqCount   = A.faq.length;
const srcRows    = (pack.sources || []).length;
const evApproved = ((s.evidence || {}).approved || []).length;
const jsonLdCites = pack.json_ld && pack.json_ld['@graph']
  ? ((pack.json_ld['@graph'].find(function (g) { return Array.isArray(g.citation); }) || {}).citation || []).length
  : null;
const jsonLdFaq = pack.json_ld && pack.json_ld['@graph']
  ? ((pack.json_ld['@graph'].find(function (g) { return g['@type'] === 'FAQPage'; }) || {}).mainEntity || []).length
  : null;
const srcSectionLines = A.sources_section
  ? A.sources_section.split('\n').filter(function (l) { return /https?:\/\//.test(l); }).length
  : 0;
const checks     = (pack.mechanical && pack.mechanical.checks) || [];
const hardFails  = checks.filter(function (c) { return !c.pass && c.severity === 'high'; }).length;
const softFails  = checks.filter(function (c) { return !c.pass && c.severity !== 'high'; }).length;
const measured   = (pack.mechanical && pack.mechanical.measured) || {};

/* الدرجة النهائية تُحسب حسابيًا من بنود اللائحة، لا يعلنها نموذج */
const rubricIds  = (cfg.rubric.items || []).map(function (i) { return i.id; });
const scoreMap   = {};
Object.keys(s.round_scores || {}).forEach(function (k) {
  const v = s.round_scores[k];
  const n = typeof v === 'object' ? Number(v.score) : Number(v);
  if (isFinite(n)) scoreMap[k] = n;
});
Object.keys((pack.scorecard) || {}).forEach(function (k) {
  const n = Number(((pack.scorecard[k]) || {}).score);
  if (isFinite(n)) scoreMap[k] = n;
});
const scored = rubricIds.filter(function (k) { return scoreMap[k] != null; });
const computedOverall = scored.length
  ? Math.round((scored.reduce(function (n, k) { return n + scoreMap[k]; }, 0) / scored.length) * 10) / 10
  : null;

const recon = H.N.recon([
  { id: 'word_count', label: 'عدد الكلمات في حزمة التسليم', source: 'إعادة عدّ نص المقال',
    expected: words, actual: (pack.meta || {}).word_count },
  { id: 'reading_minutes', label: 'زمن القراءة', source: 'عدد الكلمات ÷ 200',
    expected: Math.max(1, Math.round(words / 200)), actual: (pack.meta || {}).reading_minutes },
  { id: 'mechanical_words', label: 'عدد الكلمات في تقرير المفتش الآلي', source: 'إعادة عدّ نص المقال',
    expected: words, actual: measured.words },
  { id: 'faq_pack', label: 'عدد أسئلة FAQ في الحزمة', source: 'إعادة تحليل المقال',
    expected: faqCount, actual: (pack.faq || []).length },
  { id: 'faq_schema', label: 'عدد أسئلة FAQ داخل الـ Schema', source: 'إعادة تحليل المقال',
    expected: faqCount, actual: jsonLdFaq },
  { id: 'sources_table', label: 'صفوف جدول المصادر', source: 'الأدلة المعتمدة من مدقق الحقائق',
    expected: evApproved, actual: srcRows },
  { id: 'sources_schema', label: 'استشهادات الـ Schema', source: 'الأدلة المعتمدة من مدقق الحقائق',
    expected: evApproved, actual: jsonLdCites },
  { id: 'hard_failures', label: 'عدد المخالفات الحرجة', source: 'إعادة عدّ فحوص المفتش الآلي',
    expected: hardFails, actual: (pack.mechanical || {}).hard_failures },
  { id: 'soft_failures', label: 'عدد الملاحظات المتوسطة', source: 'إعادة عدّ فحوص المفتش الآلي',
    expected: softFails, actual: (pack.mechanical || {}).soft_failures },
  { id: 'link_report', label: 'عدد الروابط المفحوصة', source: 'تقرير فحص الروابط',
    expected: ((s.evidence || {}).link_report || []).length, actual: (pack.link_report || []).length },
  { id: 'rounds_used', label: 'عدد الدورات', source: 'عدّاد الجلسة',
    expected: s.round, actual: pack.rounds_used },
  { id: 'restarts_used', label: 'عدد إعادات البناء', source: 'عدّاد الجلسة',
    expected: s.restarts, actual: pack.restarts_used },
  { id: 'overall_score', label: 'الدرجة النهائية Overall', source: 'متوسط بنود اللائحة المُقيَّمة',
    expected: computedOverall, actual: ((pack.final_scores) || {}).overall_score, tol: 0.5 }
]);
const reconBad = recon.filter(function (r) { return !r.ok; });

/* ══════════ 2) تمريرة ثانية مستقلة على أرقام المقال ══════════ */
const second = H.N.auditArticle({ article: md, brief: s.brief, evidence: s.evidence }, cfg);
const first  = s.numeric || { findings: [], high: 0, medium: 0, low: 0, audited: 0, verified_count: 0, grey: [] };

/* اختلاف التمريرتين على الرقم نفسه = خلل في المحرك، لا في المقال */
const driftBad = first.audited !== second.audited || first.high !== second.high;

/* ══════════ 3) شبكة أمان: أرقام في التقرير بلا أصل ══════════
 * كل رقم يظهر في تقرير التدقيق أو المحضر يجب أن يكون له أصل في:
 * نص المقال، أو حزمة الأدلة، أو الأرقام المُعاد اشتقاقها أعلاه. */
const stateNumbers = [
  JSON.stringify(s.blueprint || {}),          /* ميزانيات الكلمات المعتمدة في المخطط */
  JSON.stringify(s.section_plan || []),       /* خطة الأقسام ورقم كل قسم */
  JSON.stringify(measured),                   /* ما قاسه المفتش الآلي */
  JSON.stringify(s.round_scores || {}),
  JSON.stringify(pack.scorecard || {}),
  JSON.stringify(pack.final_scores || {}),
  JSON.stringify(((s.evidence || {}).link_report || [])),
  JSON.stringify(H.splitSections(md).map(function (x) { return x.words; }))
].join(' ');

const bag = H.N.allowedValues(
  [md, stateNumbers]
    .concat(((s.evidence || {}).approved || []).map(function (e) {
      return [e.figure, e.arabic_sentence, e.citation_line].filter(Boolean).join(' ');
    }))
    .concat(checks.map(function (c) { return c.detail; }))
    .concat(Object.keys(scoreMap).map(function (k) { return String(scoreMap[k]); }))
    .concat(recon.map(function (r) { return String(r.expected) + ' ' + String(r.actual); }))
    .concat([String(computedOverall), String(words), String(cfg.rubric.threshold),
             String((cfg.gate || {}).max_rounds), String(s.round), String(s.restarts),
             String((s.minutes || []).length), String((s.panel || []).length),
             String(((s.evidence || {}).link_report || []).length)])
);
/* تُمسح **النصوص التي كتبها النماذج بحريّة** فقط — لا محضر الجلسة الذي
 * يولّده الكود من قياسات حقيقية، وإلا صارت الشبكة تصطاد نفسها.
 * هنا بالضبط يظهر الرقم المختلق: داخل فقرة رأي، لا داخل جدول قياس. */
const prose = [];
const addProse = function (label, v) {
  const t = String(v == null ? '' : v).trim();
  if (t) prose.push({ label: label, text: t });
};
const AUD = s.audit || {};
Object.keys(AUD.detailed_review || {}).forEach(function (k) {
  addProse('التدقيق النهائي · ' + k, AUD.detailed_review[k]);
});
(AUD.opportunities || []).forEach(function (o, i) {
  addProse('فرصة تحسين #' + (i + 1), [o.opportunity, o.impact].filter(Boolean).join(' — '));
});
(AUD.critical_issues || []).forEach(function (c, i) {
  addProse('خطأ حرج #' + (i + 1), [c.title, c.why, c.fix].filter(Boolean).join(' — '));
});
addProse('ملاحظة النشر', AUD.publish_note);

const CH = s.chair || {};
addProse('خلاصة جلسة المجلس', CH.round_summary);
addProse('توجيه رئيس المجلس', CH.message_to_writer);
(CH.blockers || []).forEach(function (b, i) { addProse('عائق #' + (i + 1), b); });
(CH.conflicts_resolved || []).forEach(function (c, i) {
  addProse('حسم تعارض #' + (i + 1), [c.issue, c.ruling, c.why].filter(Boolean).join(' — '));
});
(CH.rejected_notes || []).forEach(function (r, i) {
  addProse('ملاحظة مرفوضة #' + (i + 1), [r.note, r.why_rejected].filter(Boolean).join(' — '));
});
(s.revision_brief || []).forEach(function (b, i) { addProse('بند تعديل #' + (i + 1), b.instruction); });

(s.panel || []).forEach(function (pn) {
  const who = pn._name || pn.persona || 'ناقد';
  addProse('كلمة ' + who + ' للمجلس', pn.note_to_board);
  (pn.issues || []).forEach(function (x, i) {
    addProse('ملاحظة ' + who + ' #' + (i + 1), [x.title, x.fix].filter(Boolean).join(' — '));
  });
  (pn.opportunities || []).forEach(function (x, i) {
    addProse('فرصة ' + who + ' #' + (i + 1), [x.opportunity, x.impact].filter(Boolean).join(' — '));
  });
  Object.keys(pn.scores || {}).forEach(function (k) {
    addProse('سبب درجة ' + who + ' / ' + k, (pn.scores[k] || {}).reason);
  });
});
Object.keys(pack.scorecard || {}).forEach(function (k) {
  addProse('سبب الدرجة النهائية / ' + k, (pack.scorecard[k] || {}).reason);
});
((s.evidence || {}).unverified || []).forEach(function (uv, i) {
  addProse('ادعاء بلا مصدر #' + (i + 1), [uv.claim, uv.why].filter(Boolean).join(' — '));
});

const reportOrphans = [];
prose.forEach(function (src) {
  H.N.orphansInReport(src.text, bag).forEach(function (o) {
    reportOrphans.push({ raw: o.raw, unit: o.unit, where: src.label, context: o.context });
  });
});

/* ══════════ 4) ما يحتاج حكمًا بشريًا-آليًا ══════════ */
const grey = second.grey || [];
const needsAdjudication = C.adjudicate !== false && (grey.length > 0 || reportOrphans.length > 0);

s.numbers_report = {
  reconciliation: recon,
  reconciliation_failures: reconBad,
  second_pass: {
    scanned: second.scanned, audited: second.audited, verified: second.verified_count,
    high: second.high, medium: second.medium, low: second.low,
    coverage_pct: second.coverage_pct, findings: second.findings
  },
  first_pass: { audited: first.audited, verified: first.verified_count, high: first.high },
  pass_drift: driftBad,
  report_orphans: reportOrphans,
  computed_overall: computedOverall,
  adjudication: null
};

H.minute(s, {
  stage: 'numbers_reconcile', actor: '🔢 مصالحة أرقام التقرير — L6',
  headline: 'صُولح ' + recon.length + ' رقمًا في التقرير — ' + reconBad.length + ' اختلاف، ' +
            reportOrphans.length + ' رقمًا بلا أصل، ' + grey.length + ' حالة رمادية',
  detail: (reconBad.map(function (r) { return r.label + ': المحسوب ' + r.expected + ' ≠ المكتوب ' + r.actual; })
    .concat(reportOrphans.map(function (o) { return 'رقم بلا أصل في التقرير: «' + o.raw + '» في ' + o.where; }))
    .join(' | ')) || 'كل أرقام التقرير مطابقة لمصادرها المُعاد اشتقاقها.'
});

if (!needsAdjudication) {
  return [{ json: { state: s, pack: pack, needs_adjudication: false } }];
}

/* ══════════ 5) ملف المراجعة المرفوع لمراجع الأرقام ══════════ */
const userText = [
  H.briefBlock(s, cfg), '',
  '### حزمة الأدلة المعتمدة (المرجع الوحيد لأي رقم خارجي)',
  '```json\n' + H.clip(JSON.stringify(((s.evidence || {}).approved || []).map(function (e) {
    return { id: e.id, publisher: e.publisher, url: e.url, figure: e.figure, arabic_sentence: e.arabic_sentence };
  }), null, 1), 7000) + '\n```', '',
  '### أرقام لم يستطع المفتش الرقمي حسمها (تحتاج حكمك)',
  '```json\n' + H.clip(JSON.stringify(grey, null, 1), 7000) + '\n```', '',
  reportOrphans.length
    ? '### أرقام ظهرت في التقرير أو المحضر بلا أصل في المقال ولا في الأدلة\n```json\n' +
      H.clip(JSON.stringify(reportOrphans, null, 1), 4000) + '\n```'
    : '',
  '',
  '### مهمتك الآن',
  'لكل عنصر: هل هو **ادعاء يحتاج مصدرًا**، أم **وصف لا يحتاج مصدرًا** (ترقيم، عدّ لعناصر المقال نفسه، مثال افتراضي معلن)،',
  'أم **رقم من طرف العميل** يحتاج تأكيده هو؟ برّر كل حكم بجملة واحدة تُنشر في التقرير.',
  'لا تُبرّئ رقمًا لمجرد أنه معقول: البراءة تحتاج سببًا مكتوبًا.',
  'أعد JSON فقط.'
].join('\n');

const callItem = H.callFor(cfg, 'number_auditor', userText, s, 'number_audit');
callItem.json.needs_adjudication = true;
callItem.json.pack = pack;
return [callItem];
