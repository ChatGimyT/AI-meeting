/* ── 23. التقاط أول صف مُعلَّم بالتشغيل في شيت جوجل ──────────────
 * الشيت هو لوحة التحكم: تملأ صفًا، تعلّم ✅ في «تشغيل»، فيلتقطه المحرك.
 * ─────────────────────────────────────────────────────────────── */
const rows = $input.all().map(function (i) { return i.json; });

/* تعريف الأعمدة مطابق لعقدة 📚 Profiles Registry */
/* __SHEET__ */

const IN = SHEET.in;
const isOn = function (v) {
  if (v === true) return true;
  return SHEET.truthy.indexOf(String(v == null ? '' : v).trim()) !== -1;
};

/* أول صف مُعلَّم ولم يُنفَّذ بعد */
const pending = rows.filter(function (r) {
  const done = String(r[IN.status] || '').trim();
  return isOn(r[IN.run]) && (done === '' || /بانتظار|إعادة|retry/i.test(done));
});

if (!pending.length) return [];

const r = pending[0];
const txt = function (k) { return String(r[k] == null ? '' : r[k]).trim(); };

const brief = {
  profile_id:            txt(IN.profile) || 'rabeh_article_ar_deepseek',
  title:                 txt(IN.title),
  goal:                  txt(IN.goal),
  article_type:          txt(IN.type),
  target_market:         txt(IN.market),
  primary_keyword:       txt(IN.kw),
  primary_keyword_count: Number(txt(IN.kw_count)) || 0,
  secondary_keywords:    txt(IN.kw_secondary),
  semantic_keywords:     txt(IN.kw_semantic),
  headings:              txt(IN.headings),
  internal_links:        txt(IN.links),
  mandatory_citations:   txt(IN.citations),
  cluster_role:          txt(IN.cluster),
  existing_article:      txt(IN.existing),
  notes:                 txt(IN.notes),
  allow_auto_headings:   txt(IN.headings) === '',
  delivery:              'sheet',
  sheet_row:             r.row_number || null
};

return [{ json: { brief: brief, row_number: r.row_number || null, sheet_row_raw: r } }];
