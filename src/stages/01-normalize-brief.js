/* ── 1. توحيد المدخلات ─────────────────────────────────────────
 * يستقبل من: Manual Trigger + Set, Form Trigger, Webhook
 * يُخرج: عنصر واحد فيه brief موحّد.
 * ──────────────────────────────────────────────────────────── */
const raw = $input.first().json || {};
const src = raw.body && typeof raw.body === 'object' ? raw.body : raw;

function arr(v) {
  if (v == null || v === '') return [];
  if (Array.isArray(v)) return v.filter(function (x) { return x !== null && x !== undefined && String(x).trim() !== ''; });
  return String(v).split(/[\n،,;|]+/).map(function (x) { return x.trim(); }).filter(Boolean);
}

function links(v) {
  if (Array.isArray(v)) {
    return v.map(function (l) {
      if (typeof l === 'string') {
        const m = l.match(/^\s*(.*?)\s*(?:\||=>|->|::)\s*(https?:\/\/\S+)\s*$/);
        if (m) return { anchor: m[1], url: m[2] };
        const md = l.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
        if (md) return { anchor: md[1], url: md[2] };
        return { anchor: '', url: l.trim() };
      }
      return { anchor: (l.anchor || l.text || '').trim(), url: (l.url || l.href || '').trim() };
    }).filter(function (l) { return l.url; });
  }
  return arr(v).map(function (line) {
    const m = line.match(/^\s*(.*?)\s*(?:\||=>|->|::)\s*(https?:\/\/\S+)\s*$/);
    if (m) return { anchor: m[1], url: m[2] };
    const md = line.match(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
    if (md) return { anchor: md[1], url: md[2] };
    return { anchor: '', url: line };
  }).filter(function (l) { return /^https?:\/\//.test(l.url); });
}

const brief = {
  profile_id:          src.profile_id || src['الملف التعريفي'] || 'rabeh_article_ar',
  title:               (src.title || src['عنوان المقال'] || '').trim(),
  goal:                (src.goal || src['الهدف'] || '').trim(),
  article_type:        (function () {
                         const t = String(src.article_type || src['نوع المقال'] || '').toLowerCase();
                         if (/comm|تجار|بيع/.test(t)) return 'commercial';
                         if (/info|معلوم|تعليم/.test(t)) return 'informational';
                         return '';
                       })(),
  target_market:       (src.target_market || src['السوق المستهدف'] || '').trim(),
  primary_keyword:     (src.primary_keyword || src['الكلمة المفتاحية الرئيسية'] || '').trim(),
  primary_keyword_count: Number(src.primary_keyword_count || src['تكرار الكلمة'] || 0) || 0,
  secondary_keywords:  arr(src.secondary_keywords || src['الكلمات الثانوية']),
  semantic_keywords:   arr(src.semantic_keywords || src['الكلمات المرتبطة']),
  headings:            arr(src.headings || src['العناوين الداخلية']),
  internal_links:      links(src.internal_links || src['الروابط الداخلية']),
  mandatory_citations: arr(src.mandatory_citations || src['استشهادات إلزامية']),
  cluster_role:        (src.cluster_role || src['نوع المقالة'] || '').trim(),
  pillar_url:          (src.pillar_url || '').trim(),
  existing_article:    src.existing_article || src['المقالة الحالية'] || '',
  platforms:           arr(src.platforms || src['المنصات']),
  post_count:          Number(src.post_count || 0) || 0,
  notes:               (src.notes || src['ملاحظات'] || '').trim(),
  allow_auto_headings: src.allow_auto_headings !== false && src.allow_auto_headings !== 'false',
  overrides:           (typeof src.overrides === 'object' && src.overrides) || null,
  delivery:            src.delivery || (raw.headers ? 'webhook' : 'inline')
};

return [{ json: { brief: brief } }];
