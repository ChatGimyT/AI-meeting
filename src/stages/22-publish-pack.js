/* ── 22. حزمة النشر: المقال + الميتا + Schema + التقارير + محضر الاجتماع ── */
const REG  = $('📚 Profiles Registry').first().json.profiles;
const call = $('🗓️ Agenda: Final Audit').first();
const s    = call.json.state;
const cfg  = H.cfgOf(REG, s);

const raw  = $input.first().json;
const text = H.readText(raw);
const err  = H.apiError(raw);
const audit = H.grabJson(text) || {};
if (err) H.fail(s, 'final_audit', err);
s.audit = audit;

H.minute(s, {
  stage: 'final_audit', actor: '⚖️ هيئة التدقيق النهائي',
  headline: 'القرار: ' + (audit.final_decision || '-') + ' | Overall: ' + ((audit.final_scores || {}).overall_score || '-') + '/10',
  detail: audit.publish_note || H.clip(text, 800)
});

const A  = H.parseArticle(s.article || '');
const fm = A.frontmatter || {};

/* ---------- الميتا ---------- */
const meta = {
  h1:               (A.headings.find(function (h) { return h.level === 1; }) || {}).text || fm.title || s.brief.title,
  title:            fm.title || s.brief.title,
  meta_title:       fm.meta_title || '',
  meta_description: fm.meta_description || '',
  slug:             fm.slug || '',
  primary_keyword:  fm.primary_keyword || s.brief.primary_keyword,
  secondary_keywords: (fm.secondary_keywords || (s.brief.secondary_keywords || []).join('، ')),
  article_type:     fm.article_type || s.brief.article_type,
  word_count:       H.words(A.body),
  reading_minutes:  Math.max(1, Math.round(H.words(A.body) / 200))
};

/* ---------- JSON-LD ---------- */
let jsonLd = null;
if (cfg.output && cfg.output.json_ld) {
  const graph = [{
    '@type': cfg.output.json_ld.type || 'Article',
    headline: meta.h1,
    description: meta.meta_description,
    inLanguage: cfg.language || 'ar',
    keywords: [meta.primary_keyword].concat(s.brief.secondary_keywords || []).filter(Boolean).join(', '),
    wordCount: meta.word_count,
    datePublished: new Date().toISOString().slice(0, 10),
    dateModified: new Date().toISOString().slice(0, 10),
    author:    { '@type': 'Organization', name: cfg.brand.name },
    publisher: { '@type': 'Organization', name: cfg.output.json_ld.publisher || cfg.brand.name },
    citation: (s.evidence.approved || []).map(function (e) {
      return { '@type': 'CreativeWork', name: e.page_title, url: e.url, publisher: e.publisher };
    })
  }];
  if (cfg.output.json_ld.include_faq && A.faq.length) {
    graph.push({
      '@type': 'FAQPage',
      mainEntity: A.faq.map(function (f) {
        return { '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } };
      })
    });
  }
  jsonLd = { '@context': 'https://schema.org', '@graph': graph };
}

/* ---------- جدول المصادر ---------- */
const sourcesTable = (s.evidence.approved || []).map(function (e) {
  return { id: e.id, publisher: e.publisher, page_title: e.page_title, url: e.url, figure: e.figure, section: e.section };
});

/* ---------- محضر الاجتماع ---------- */
const mm = ['# 🪑 محضر اجتماع ورشة المحتوى', '',
  '**رقم التشغيل:** `' + s.run_id + '`  ',
  '**الملف التعريفي:** ' + cfg.label + '  ',
  '**بدأت:** ' + s.started_at + '  ',
  '**الدورات:** ' + s.round + ' من ' + cfg.gate.max_rounds + ' | **إعادات البناء:** ' + s.restarts,
  '', '---', ''];
(s.minutes || []).forEach(function (m) {
  mm.push('### ' + m.seq + '. [دورة ' + m.round + ' · ' + m.stage + '] ' + m.actor);
  mm.push('**' + m.headline + '**', '');
  if (m.detail) mm.push('> ' + String(m.detail).replace(/\n/g, '\n> '), '');
  if (m.scores && Object.keys(m.scores).length) {
    mm.push('| البند | الدرجة | السبب |', '|---|---|---|');
    Object.keys(m.scores).forEach(function (k) {
      const v = m.scores[k] || {};
      mm.push('| `' + k + '` | ' + (v.score != null ? v.score + '/10' : '-') + ' | ' + String(v.reason || '').replace(/\|/g, '/') + ' |');
    });
    mm.push('');
  }
  if (m.conflicts && m.conflicts.length) {
    mm.push('**تعارضات حُسمت:**');
    m.conflicts.forEach(function (c) {
      mm.push('- بين ' + [].concat(c.between || []).join(' و ') + ' حول: ' + c.issue + ' → **الحكم:** ' + c.ruling);
    });
    mm.push('');
  }
  if (m.rejected_notes && m.rejected_notes.length) {
    mm.push('**ملاحظات رُفضت:**');
    m.rejected_notes.forEach(function (r) { mm.push('- (' + r.from + ') ' + r.note + ' → ' + r.why_rejected); });
    mm.push('');
  }
});

/* ---------- تقرير التدقيق ---------- */
const sc = audit.scorecard || {};
const ar = ['# ⚖️ تقرير التدقيق النهائي', '',
  '**القرار:** ' + ({ ready: '✅ جاهز للنشر', ready_after_minor_edits: '🟡 جاهز بعد تعديلات بسيطة', not_ready: '🔴 غير جاهز للنشر' }[audit.final_decision] || audit.final_decision || '-'),
  '', '## Scorecard', '', '| البند | الدرجة | السبب |', '|---|---|---|'];
(cfg.rubric.items || []).forEach(function (it) {
  const v = sc[it.id] || {};
  ar.push('| ' + it.label + ' (`' + it.id + '`) | ' + (v.score != null ? v.score + '/10' : '—') + ' | ' + String(v.reason || '').replace(/\|/g, '/') + ' |');
});
const fs2 = audit.final_scores || {};
ar.push('', '## التقييم النهائي', '',
  '- SEO Score: **' + (fs2.seo_score != null ? fs2.seo_score : '-') + '/10**',
  '- Content Score: **' + (fs2.content_score != null ? fs2.content_score : '-') + '/10**',
  '- Business Score: **' + (fs2.business_score != null ? fs2.business_score : '-') + '/10**',
  '- Overall Score: **' + (fs2.overall_score != null ? fs2.overall_score : '-') + '/10**', '');
if ((audit.critical_issues || []).length) {
  ar.push('## 🔴 Critical Issues', '');
  audit.critical_issues.forEach(function (c) { ar.push('- **' + c.title + '** — ' + c.why + '  \n  الإصلاح: ' + c.fix); });
  ar.push('');
}
if ((audit.opportunities || []).length) {
  ar.push('## 💡 Opportunities', '', '| الأولوية | فرصة التحسين | التأثير المتوقع |', '|---|---|---|');
  audit.opportunities.forEach(function (o) { ar.push('| ' + o.priority + ' | ' + String(o.opportunity).replace(/\|/g, '/') + ' | ' + String(o.impact || '').replace(/\|/g, '/') + ' |'); });
  ar.push('');
}
const dr = audit.detailed_review || {};
if (Object.keys(dr).length) {
  ar.push('## المراجعة التفصيلية', '');
  Object.keys(dr).forEach(function (k) { ar.push('### ' + k, '', String(dr[k]), ''); });
}
ar.push('## 🔍 تقرير المفتش الآلي', '', '| الفحص | الحالة | التفصيل |', '|---|---|---|');
(s.mechanical.checks || []).forEach(function (c) {
  ar.push('| `' + c.id + '` | ' + (c.pass ? '✅' : (c.severity === 'high' ? '❌' : '⚠️')) + ' | ' + String(c.detail).replace(/\|/g, '/') + ' |');
});
if ((s.evidence.rejected || []).length) {
  ar.push('', '## 🧪 أدلة رفضها مدقق الحقائق', '');
  s.evidence.rejected.forEach(function (r) { ar.push('- ' + (r.url || r.id) + ' → ' + r.reason); });
}
if ((s.evidence.unverified || []).length) {
  ar.push('', '## ⚠️ ادعاءات بلا مصدر موثوق (لم تُدرج في النص)', '');
  s.evidence.unverified.forEach(function (u) { ar.push('- ' + u.claim + ' → ' + u.why); });
}
if ((s.warnings || []).length) { ar.push('', '## تنبيهات التشغيل', ''); s.warnings.forEach(function (w) { ar.push('- ' + w); }); }
if ((s.errors || []).length)   { ar.push('', '## أخطاء تقنية أثناء التشغيل', ''); s.errors.forEach(function (e) { ar.push('- [' + e.stage + '] ' + e.message); }); }

/* ---------- الحالة النهائية ---------- */
const shipped = s.gate.route === 'approve' && audit.final_decision !== 'not_ready';
s.decision = shipped ? 'published' : (s.gate.route === 'exhausted' ? 'shipped_with_notes' : 'blocked');

const payload = {
  run_id: s.run_id,
  profile: cfg.id,
  content_kind: cfg.content_kind || 'article',
  content_mode: (cfg.rules && cfg.rules.mode) || 'article',
  status: s.decision,
  ready_to_publish: shipped,
  rounds_used: s.round,
  restarts_used: s.restarts,
  gate: s.gate,
  meta: meta,
  article_markdown: s.article,
  article_body_only: A.body.trim(),
  json_ld: jsonLd,
  faq: A.faq,
  sources: sourcesTable,
  link_report: s.evidence.link_report,
  scorecard: sc,
  final_scores: fs2,
  critical_issues: audit.critical_issues || [],
  opportunities: audit.opportunities || [],
  mechanical: s.mechanical,
  update_report: s.update_report,
  audit_report_markdown: ar.join('\n'),
  meeting_minutes_markdown: mm.join('\n'),
  blockers: (s.chair && s.chair.blockers) || [],
  warnings: s.warnings,
  errors: s.errors
};

return [{ json: payload }];
