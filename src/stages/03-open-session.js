/* ── 3. افتتاح الجلسة: اختيار الملف + التحقق من المدخلات + تهيئة الحالة ── */
const REG   = $('📚 Profiles Registry').first().json.profiles;
const brief = $input.first().json.brief;

const profileId = REG[brief.profile_id] ? brief.profile_id : 'rabeh_article_ar';
const state = {
  run_id: 'run_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
  started_at: new Date().toISOString(),
  profile_id: profileId,
  overrides: brief.overrides || null,
  brief: brief,
  round: 0,
  restarts: 0,
  stage: 'open_session',
  strategy: {}, blueprint: {},
  evidence: { approved: [], rejected: [], unverified: [], stale: [], must_remove: [], link_report: [], search_urls: [] },
  article: '', article_versions: [],
  mechanical: {}, panel: [], chair: {}, audit: {},
  update_report: null,
  minutes: [], errors: [], warnings: [],
  route: '', decision: ''
};

const cfg = H.cfgOf(REG, state);
const kind = cfg.content_kind || 'article';

/* --- بوابة المدخلات: ما لا يمكن العمل بدونه --- */
const missing = [];
if (!brief.primary_keyword && kind !== 'social') missing.push('الكلمة المفتاحية الرئيسية');
if (!brief.title && !brief.existing_article && kind !== 'social') missing.push('عنوان المقال');
if (kind === 'article_refresh' && !brief.existing_article) missing.push('نص المقالة الحالية (existing_article)');
if (kind === 'social' && !brief.goal && !brief.title) missing.push('موضوع أو هدف الحملة');

if (!brief.headings.length && !brief.allow_auto_headings && kind === 'article') {
  missing.push('العناوين الداخلية H2/H3 (أو فعّل allow_auto_headings)');
}
if (!brief.article_type && kind !== 'social') {
  state.warnings.push('نوع المقال غير محدد — ستحدده مديرة الاستراتيجية من نية الباحث.');
}
if (!brief.internal_links.length && kind === 'article') {
  state.warnings.push('لم تُرسل روابط داخلية — سيُقيَّم الربط الداخلي على أساس الفرص الممكنة فقط.');
}
if (!brief.primary_keyword_count && brief.primary_keyword) {
  state.warnings.push('لم يُحدَّد عدد تكرار الكلمة الرئيسية — سيُستخدم النطاق الطبيعي المحسوب من طول النص.');
}
if (!brief.target_market) {
  state.brief.target_market = (cfg.brand && cfg.brand.primary_market) || '';
}

state.intake_ok = missing.length === 0;
state.intake_missing = missing;

H.minute(state, {
  stage: 'open_session',
  actor: '🗂️ سكرتارية الجلسة',
  headline: state.intake_ok ? 'اكتمل ملف الطلب — تُفتح الجلسة' : 'ملف الطلب ناقص — تُعلَّق الجلسة',
  detail: state.intake_ok
    ? 'الملف: ' + cfg.label + ' | التحذيرات: ' + (state.warnings.length || 'لا شيء')
    : 'ناقص: ' + missing.join('، ')
});

return [{ json: { state: state, intake_ok: state.intake_ok } }];
