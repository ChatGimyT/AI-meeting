/* ── 28. حكم الأرقام النهائي + بوابة التسليم ─────────────────────
 * هنا فقط يُقرَّر: هل يُسمح لهذا التقرير بمغادرة المحرك؟
 * قاعدة الحكم: الرقمي يحسم، والمراجع اللغوي يضيف ولا يُبرّئ مجانًا.
 * أي تبرئة تُنشر في التقرير بنصها حتى يقرأها العميل.
 * ─────────────────────────────────────────────────────────────── */
/* __NUMBERS__ */

const REG   = $('📚 Profiles Registry').first().json.profiles;
const prev  = $('🔢 Numbers: Reconcile').first().json;
const s     = prev.state;
const pack  = prev.pack || $('📦 Publish Pack').first().json;
const cfg   = H.cfgOf(REG, s);
const C     = H.N.conf(cfg);
const NR    = s.numbers_report;

/* ══════════ 1) قراءة حكم مراجع الأرقام (إن استُدعي) ══════════ */
let adj = { items: [], summary: '', consulted: false };
if (prev.needs_adjudication) {
  const raw  = $input.first().json;
  const text = H.readText(raw);
  const err  = H.apiError(raw);
  const data = H.grabJson(text) || {};
  if (err) H.fail(s, 'number_audit', err);
  adj = {
    consulted: true,
    items: Array.isArray(data.items) ? data.items : [],
    summary: data.summary || '',
    error: err || null
  };
}
NR.adjudication = adj;

/* ══════════ 2) تطبيق الحكم — بحدود صارمة ══════════
 * يُسمح للمراجع بـ: تصعيد رقم رمادي إلى مخالفة حرجة.
 * ولا يُسمح له بـ: إسقاط أي مخالفة حرجة أصدرها المفتش الرقمي. */
const findings = (NR.second_pass.findings || []).map(function (f) { return Object.assign({}, f); });
const byRaw = {};
findings.forEach(function (f) { (byRaw[f.raw + '@' + f.line] = byRaw[f.raw + '@' + f.line] || []).push(f); });

let escalated = 0, cleared = 0;
adj.items.forEach(function (it) {
  const key = String(it.raw == null ? '' : it.raw) + '@' + it.line;
  const list = byRaw[key] || [];
  const why = String(it.reason || '').trim() || '(بلا تبرير مكتوب)';
  list.forEach(function (f) {
    if (f.severity === 'high') { f.adjudicator_note = why; return; }   /* الحرج لا يُبرَّأ */
    if (it.verdict === 'claim_needs_source') {
      f.severity = 'high'; f.escalated_by = 'number_auditor'; f.adjudicator_note = why; escalated++;
    } else if (it.verdict === 'descriptive_no_source_needed' && why !== '(بلا تبرير مكتوب)') {
      f.severity = 'low'; f.cleared_by = 'number_auditor'; f.adjudicator_note = why; cleared++;
    } else if (it.verdict === 'first_party_needs_client_confirmation') {
      f.code = 'first_party_number'; f.severity = 'medium'; f.adjudicator_note = why;
    } else {
      f.adjudicator_note = why;
    }
  });
});

const sev = function (level) { return findings.filter(function (f) { return f.severity === level; }); };
const high = sev('high'), medium = sev('medium'), low = sev('low');

/* ══════════ 3) أسباب حجز التسليم ══════════ */
const block = [];
if (high.length) {
  block.push('أرقام مخالفة في النص: ' + high.length +
    ' (' + high.slice(0, 3).map(function (f) { return f.code + ' «' + f.raw + '» سطر ' + f.line; }).join('، ') + ')');
}
if ((NR.reconciliation_failures || []).length) {
  block.push('أرقام التقرير لا تطابق إعادة اشتقاقها: ' +
    NR.reconciliation_failures.map(function (r) { return r.label + ' (' + r.expected + ' ≠ ' + r.actual + ')'; }).join('، '));
}
if (NR.pass_drift) {
  block.push('تمريرتا التدقيق الرقمي لم تتفقا على النتيجة — خلل في المحرك يمنع التسليم.');
}
const unexplainedOrphans = (NR.report_orphans || []).filter(function (o) {
  return !adj.items.some(function (it) {
    return String(it.raw) === String(o.raw) && it.verdict === 'descriptive_no_source_needed' && String(it.reason || '').trim();
  });
});
if (unexplainedOrphans.length) {
  block.push('أرقام في التقرير بلا أصل موثّق: ' +
    unexplainedOrphans.slice(0, 4).map(function (o) { return '«' + o.raw + '»'; }).join('، '));
}
if (!(pack.mechanical && pack.mechanical.pass) && (cfg.gate || {}).require_mechanical_pass) {
  block.push('المفتش الآلي راسب: ' + ((pack.mechanical || {}).hard_failures || 0) + ' مخالفة حرجة.');
}

const blockOn = C.block_delivery_on || ['high'];
const canSend = block.length === 0;
const verdict = canSend
  ? (medium.length || low.length ? 'clear_with_notes' : 'clear')
  : 'hold';

/* ══════════ 4) بطاقة الأرقام المعتمدة (تُنشر مع التقرير) ══════════ */
const card = ['## 🔢 بطاقة الأرقام المعتمدة', '',
  '**حكم بوابة الأرقام:** ' +
  ({ clear: '✅ كل رقم موثّق — التقرير مصرَّح بإرساله',
     clear_with_notes: '🟡 مصرَّح بالإرسال مع ملاحظات مرفقة',
     hold: '🔴 محجوز — لن يُرسل حتى تُصلَّح الأرقام' }[verdict]), '',
  '| الطبقة | ما فُحص | النتيجة |', '|---|---|---|',
  '| L1 استخراج | كل رقم في النص | ' + NR.second_pass.scanned + ' رقمًا |',
  '| L2 تصنيف | أرقام تحتاج عهدة | ' + NR.second_pass.audited + ' رقمًا |',
  '| L3+L4 عهدة ومطابقة | موثّقة بمصدرها | ' + NR.second_pass.verified + ' (' + NR.second_pass.coverage_pct + '%) |',
  '| L5 اتساق | نسب مستحيلة · نطاقات مقلوبة · تناقض | ' +
    ((NR.second_pass.findings || []).filter(function (f) {
      return ['impossible_percent', 'inverted_range', 'contradiction', 'future_year'].indexOf(f.code) !== -1;
    }).length) + ' مخالفة |',
  '| L6 مصالحة | أرقام التقرير المُعاد اشتقاقها | ' +
    ((NR.reconciliation || []).length - (NR.reconciliation_failures || []).length) + ' من ' +
    (NR.reconciliation || []).length + ' مطابقة |',
  '| شبكة الأمان | أرقام في التقرير بلا أصل | ' + (NR.report_orphans || []).length + ' |',
  '| المراجعة | حالات رمادية عُرضت على مراجع الأرقام | ' +
    (adj.consulted ? adj.items.length + ' (صُعِّد ' + escalated + '، بُرِّئ ' + cleared + ')' : 'لا حاجة') + ' |',
  ''];

if (findings.length) {
  card.push('### تفصيل ملاحظات الأرقام', '',
    '| الدرجة | الرمز | الرقم | السطر | القسم | البيان |', '|---|---|---|---|---|---|');
  findings.slice(0, 40).forEach(function (f) {
    card.push('| ' + ({ high: '🔴 حرج', medium: '🟡 متوسط', low: '⚪ ملاحظة' }[f.severity] || f.severity) +
      ' | `' + f.code + '` | ' + f.raw + ' | ' + f.line + ' | ' + String(f.section || '').replace(/\|/g, '/') +
      ' | ' + String(f.message + (f.adjudicator_note ? ' — حكم المراجع: ' + f.adjudicator_note : '')).replace(/\|/g, '/') + ' |');
  });
  card.push('');
}
if ((NR.reconciliation || []).length) {
  card.push('### مصالحة أرقام التقرير (L6)', '',
    '| الرقم | المصدر المعتمد | المحسوب | المكتوب في التقرير | |', '|---|---|---|---|---|');
  NR.reconciliation.forEach(function (r) {
    card.push('| ' + r.label + ' | ' + r.source + ' | ' + r.expected + ' | ' + r.actual + ' | ' + (r.ok ? '✅' : '❌') + ' |');
  });
  card.push('');
}
if (block.length) {
  card.push('### 🔴 أسباب حجز الإرسال', '');
  block.forEach(function (b) { card.push('- ' + b); });
  card.push('');
}
if (adj.summary) card.push('> **خلاصة مراجع الأرقام:** ' + adj.summary, '');

/* ══════════ 5) تحديث الحزمة ══════════ */
const numbers = {
  verdict: verdict,
  can_send: canSend,
  block_reasons: block,
  block_on: blockOn,
  scanned: NR.second_pass.scanned,
  audited: NR.second_pass.audited,
  verified: NR.second_pass.verified,
  coverage_pct: NR.second_pass.coverage_pct,
  high: high.length, medium: medium.length, low: low.length,
  findings: findings,
  reconciliation: NR.reconciliation,
  reconciliation_failures: NR.reconciliation_failures,
  report_orphans: NR.report_orphans,
  adjudication: { consulted: adj.consulted, escalated: escalated, cleared: cleared, summary: adj.summary, items: adj.items },
  card_markdown: card.join('\n')
};

pack.numbers = numbers;
pack.audit_report_markdown = (pack.audit_report_markdown || '') + '\n\n' + numbers.card_markdown;
pack.ready_to_publish = !!pack.ready_to_publish && canSend;
if (!canSend && pack.status === 'published') pack.status = 'held_numeric_review';

s.numbers_report = NR;
s.numbers = numbers;

H.minute(s, {
  stage: 'numbers_verdict', actor: '🧮 بوابة الأرقام',
  headline: 'الحكم: ' + verdict + ' | موثّق ' + numbers.verified + ' من ' + numbers.audited +
            ' (' + numbers.coverage_pct + '%) | حرج ' + high.length + ' · متوسط ' + medium.length,
  detail: block.length ? block.join(' | ') : 'كل رقم في النص والتقرير مطابق لمصدره — التسليم مصرَّح به.'
});

return [{ json: pack }];
