/* ── 25. المقارنة بالمقال المرجعي + تجهيز صف النتائج ─────────────
 * يقيس المقال الناتج مقابل بصمة المقال المرجعي (المكتوب يدويًا وفق
 * المعايير نفسها) ويكتب الخلاصة في الشيت.
 * ─────────────────────────────────────────────────────────────── */
/* __SHEET__ */
/* __REFERENCE__ */

const pack = $input.first().json;

/* --- بصمة الأسلوب: نفس منطق tools/compare.mjs --- */
const TRANSITIONS = ['ولذلك', 'وبالتالي', 'ومن هنا', 'في المقابل', 'على سبيل المثال', 'كما أن',
                     'غير أن', 'إضافة إلى', 'من ناحية', 'لكن', 'ثم', 'أما', 'بينما', 'إذ', 'حيث'];
const COMPANY_VOICE = ['نحن ', 'نقدم', 'لدينا', 'نتميز', 'نمتلك', 'نسعى', 'نوفر'];
const AI_TELLS = ['في عالمنا الرقمي', 'مع التطور التكنولوجي', 'في عصرنا الحالي', 'لا يخفى على أحد',
                  'يعتبر من أهم', 'مما لا شك فيه', 'في الختام يمكن القول', 'تلعب دورًا محوريًا',
                  'يعد من أبرز', 'في ظل التطور'];

function fingerprint(md) {
  const A = H.parseArticle(md || '');
  const plain = H.stripMd(A.body).replace(/\s+/g, ' ').trim();
  const words = plain.split(' ').filter(Boolean);
  const sentences = plain.split(/[.!؟?]\s+/).map(function (x) { return x.trim(); })
                         .filter(function (x) { return x.split(' ').length > 2; });
  const paras = A.blocks.filter(function (b) { return b.type === 'paragraph'; });
  const per1000 = function (n) { return words.length ? Math.round((n / words.length) * 1000) : 0; };
  const count = function (list) {
    return list.reduce(function (n, p) { return n + H.countPhrase(A.body, p); }, 0);
  };
  return {
    words: words.length,
    paragraphs: paras.length,
    avg_para: paras.length ? Math.round(paras.reduce(function (n, p) { return n + p.words; }, 0) / paras.length) : 0,
    max_para: paras.reduce(function (m, p) { return Math.max(m, p.words); }, 0),
    lists: A.blocks.filter(function (b) { return b.type === 'list'; }).length,
    tables: A.blocks.filter(function (b) { return b.type === 'table'; }).length,
    h2: A.headings.filter(function (h) { return h.level === 2; }).length,
    h3: A.headings.filter(function (h) { return h.level === 3; }).length,
    faq: A.faq.length,
    links: A.links.length,
    lexical_diversity: words.length ? Math.round((new Set(words.map(H.normAr)).size / words.length) * 100) : 0,
    avg_sentence: sentences.length ? Math.round(words.length / sentences.length) : 0,
    long_sentence_pct: sentences.length
      ? Math.round((sentences.filter(function (s) { return s.split(' ').length > 25; }).length / sentences.length) * 100) : 0,
    transitions_per1000: per1000(count(TRANSITIONS)),
    company_voice: count(COMPANY_VOICE),
    numbers_per1000: per1000((plain.match(/\d+(?:[.,]\d+)?\s*%?/g) || []).length),
    ai_tells: count(AI_TELLS)
  };
}

const LABELS = {
  words: 'عدد الكلمات', paragraphs: 'الفقرات', avg_para: 'متوسط طول الفقرة', max_para: 'أطول فقرة',
  lists: 'القوائم', tables: 'الجداول', h2: 'عناوين H2', h3: 'عناوين H3', faq: 'أسئلة FAQ',
  links: 'الروابط', lexical_diversity: 'تنوع المفردات %', avg_sentence: 'متوسط طول الجملة',
  long_sentence_pct: 'جمل طويلة %', transitions_per1000: 'أدوات ربط /1000',
  company_voice: 'جمل «نحن/نقدم»', numbers_per1000: 'أرقام /1000', ai_tells: 'عبارات آلية مكشوفة'
};
/* اتجاه «الأفضل»: 0 = الأقرب للمرجع، -1 = الأقل أفضل، +1 = الأكثر أفضل */
const DIRECTION = { company_voice: -1, ai_tells: -1, max_para: -1, long_sentence_pct: -1,
                    lists: 1, tables: 1, faq: 1, numbers_per1000: 1, lexical_diversity: 1 };

const fCand = fingerprint(pack.article_markdown);
const fRef  = fingerprint(REFERENCE.article);

const rows = [];
let aligned = 0, total = 0;
Object.keys(LABELS).forEach(function (k) {
  const a = fRef[k], b = fCand[k], d = b - a;
  const tol = Math.max(2, Math.abs(a) * 0.35);
  const dir = DIRECTION[k] || 0;
  const ok = dir === 0 ? Math.abs(d) <= tol : (dir > 0 ? b >= a - tol : b <= a + tol);
  total++; if (ok) aligned++;
  rows.push({ metric: LABELS[k], reference: a, candidate: b, delta: d, ok: ok });
});

const checks = (pack.mechanical && pack.mechanical.checks) || [];
const failing = checks.filter(function (c) { return !c.pass; });
const scored = checks.length || 1;
const detScore = Math.round(((scored - failing.filter(function (c) { return c.severity === 'high'; }).length
                              - failing.filter(function (c) { return c.severity !== 'high'; }).length * 0.4) / scored) * 100);
const styleScore = Math.round((aligned / total) * 100);

const md = ['## 📐 مقارنة بالمقال المرجعي', '',
  '| المؤشر | المرجع | المرشّح | الفارق | |', '|---|---|---|---|---|'];
rows.forEach(function (r) {
  md.push('| ' + r.metric + ' | ' + r.reference + ' | ' + r.candidate + ' | ' +
          (r.delta > 0 ? '+' : '') + r.delta + ' | ' + (r.ok ? '✅' : '⚠️') + ' |');
});
md.push('', '**تطابق البصمة الأسلوبية:** ' + styleScore + '% (' + aligned + ' من ' + total + ' مؤشرًا داخل النطاق)');
md.push('**الدرجة الآلية:** المرشّح ' + detScore + '% · المرجع ' + REFERENCE.score + '%');
if (failing.length) {
  md.push('', '**المخالفات الباقية:**');
  failing.forEach(function (c) { md.push('- ' + (c.severity === 'high' ? '❌' : '⚠️') + ' `' + c.id + '`: ' + c.detail); });
}

const comparison = {
  deterministic_score: detScore,
  reference_score: REFERENCE.score,
  style_match_pct: styleScore,
  metrics: rows,
  failing_checks: failing.map(function (c) { return c.id; }),
  markdown: md.join('\n'),
  reference_name: REFERENCE.name
};

/* --- صف النتائج في الشيت --- */
const clip = function (s) { return H.clip(String(s == null ? '' : s), SHEET.max_cell_chars); };
const O = SHEET.out;
const row = {};
let rowNumber = null;
try { rowNumber = $('🎯 Pick Pending Row').first().json.row_number || null; } catch (e) { rowNumber = null; }
row.row_number = rowNumber;
row[O.status]       = pack.ready_to_publish ? '✅ جاهز للنشر'
                    : (pack.status === 'shipped_with_notes' ? '🟡 سُلّم مع تحفّظات' : '🔴 غير جاهز');
row[O.score]        = detScore + '%';
row[O.verdict]      = (pack.mechanical && pack.mechanical.pass) ? 'اجتاز الفحص الآلي' : (failing.length + ' مخالفة');
row[O.violations]   = failing.map(function (c) { return c.id + ': ' + c.detail; }).join('\n') || '—';
row[O.overall]      = ((pack.final_scores && pack.final_scores.overall_score) != null ? pack.final_scores.overall_score + '/10' : '—');
row[O.rounds]       = pack.rounds_used;
row[O.words]        = (pack.meta && pack.meta.word_count) || 0;
row[O.vs_reference] = 'بصمة ' + styleScore + '% | آلي ' + detScore + '% مقابل ' + REFERENCE.score + '%';
row[O.meta_title]   = (pack.meta && pack.meta.meta_title) || '';
row[O.meta_desc]    = (pack.meta && pack.meta.meta_description) || '';
row[O.article]      = clip(pack.article_markdown);
row[O.audit]        = clip((pack.audit_report_markdown || '') + '\n\n' + comparison.markdown);
row[O.minutes]      = clip(pack.meeting_minutes_markdown);
row[O.sources]      = (pack.sources || []).map(function (s) { return (s.publisher || '') + ' — ' + s.url; }).join('\n') || '—';
row[O.finished_at]  = new Date().toISOString().replace('T', ' ').slice(0, 19);
row[O.run_id]       = pack.run_id;

pack.comparison = comparison;
return [{ json: row, pairedItem: 0 }];
