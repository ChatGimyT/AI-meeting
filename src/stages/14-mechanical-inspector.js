/* ── 14. المفتش الآلي (Deterministic QA) ─────────────────────────
 * لا يقرأ المعنى. يقيس فقط. مخرجاته حقائق رقمية غير قابلة للنقاش،
 * ويستحيل على أي عضو في الاجتماع أن يجادل فيها.
 * ─────────────────────────────────────────────────────────────── */
const REG = $('📚 Profiles Registry').first().json.profiles;
const s   = $input.first().json.state;
const cfg = H.cfgOf(REG, s);
const R   = cfg.rules || {};
const A   = H.parseArticle(s.article || '');
const checks = [];

function chk(id, pass, detail, severity) {
  checks.push({ id: id, pass: !!pass, detail: detail, severity: severity || (pass ? 'ok' : 'high') });
}

/* ══════════ وضع المقالات ══════════ */
if (R.mode !== 'social') {

  /* — الطول الإجمالي — */
  const total = H.words(A.body);
  if (R.word_count) {
    chk('word_count', total >= R.word_count.min && total <= R.word_count.max,
      'عدد الكلمات = ' + total + ' (المطلوب ' + R.word_count.min + '–' + R.word_count.max + ')');
  }

  /* — H1 — */
  const h1s = A.headings.filter(function (h) { return h.level === 1; });
  chk('h1_single', h1s.length === 1, 'عدد عناوين H1 = ' + h1s.length + ' (المطلوب 1)');

  /* — المقدمة — */
  const introIdx = A.blocks.findIndex(function (b) { return b.type === 'paragraph'; });
  const intro = introIdx >= 0 ? A.blocks[introIdx] : null;
  if (R.intro_words) {
    const iw = intro ? intro.words : 0;
    chk('intro_words', iw >= R.intro_words.min && iw <= R.intro_words.max,
      'المقدمة = ' + iw + ' كلمة (المطلوب ' + R.intro_words.min + '–' + R.intro_words.max + ')');
  }

  /* — طول الفقرات — */
  if (R.paragraph_max_words) {
    const longs = A.blocks.filter(function (b) { return b.type === 'paragraph' && b.words > R.paragraph_max_words; });
    chk('paragraph_length', longs.length === 0,
      longs.length ? (longs.length + ' فقرة تتجاوز ' + R.paragraph_max_words + ' كلمة → ' +
        longs.map(function (b) { return b.words + ' كلمة: «' + b.text.slice(0, 45) + '…»'; }).join(' | '))
        : 'كل الفقرات ضمن الحد');
  }

  /* — أول H2 يحتوي الكلمة الرئيسية — */
  const h2s = A.blocks.map(function (b, i) { return { b: b, i: i }; })
                      .filter(function (x) { return x.b.type === 'heading' && x.b.level === 2; });
  if (R.require_first_h2_has_primary_keyword && s.brief.primary_keyword) {
    const first = h2s[0];
    const ok = first && H.normAr(first.b.text).indexOf(H.normAr(s.brief.primary_keyword)) !== -1;
    chk('first_h2_keyword', ok, first ? 'أول H2: «' + first.b.text + '»' : 'لا يوجد H2 إطلاقًا');
  }

  /* — إجابة مباشرة بعد كل H2 — */
  if (R.h2_answer_words) {
    const bad = [];
    h2s.forEach(function (x) {
      let j = x.i + 1, p = null;
      while (j < A.blocks.length && A.blocks[j].type !== 'heading') {
        if (A.blocks[j].type === 'paragraph') { p = A.blocks[j]; break; }
        j++;
      }
      if (/faq|الأسئلة\s*الشائعة|المصادر|sources/i.test(x.b.text)) return;
      const w = p ? p.words : 0;
      if (w < R.h2_answer_words.min || w > R.h2_answer_words.max) bad.push(x.b.text + ' (' + w + ')');
    });
    chk('h2_direct_answer', bad.length === 0,
      bad.length ? ('عناوين لا تبدأ بإجابة ' + R.h2_answer_words.min + '–' + R.h2_answer_words.max + ' كلمة: ' + bad.join(' | ')) : 'كل H2 يبدأ بإجابة مباشرة');
  }

  /* — الميتا — */
  const fm = A.frontmatter || {};
  if (R.meta_title_max_chars) {
    const mt = (fm.meta_title || '').trim();
    chk('meta_title', mt.length > 0 && mt.length <= R.meta_title_max_chars,
      'Meta Title = ' + mt.length + ' حرفًا (الحد ' + R.meta_title_max_chars + ') → «' + mt + '»');
  }
  if (R.meta_description_max_chars) {
    const md = (fm.meta_description || '').trim();
    chk('meta_description', md.length > 0 && md.length <= R.meta_description_max_chars,
      'Meta Description = ' + md.length + ' حرفًا (الحد ' + R.meta_description_max_chars + ')');
  }

  /* — الكلمة المفتاحية: العدد + الصياغة الحرفية — */
  const pk = s.brief.primary_keyword;
  if (pk) {
    const count = H.countPhrase(A.body, pk);
    const target = s.brief.primary_keyword_count || 0;
    if (target) {
      const tol = R.keyword_tolerance == null ? 2 : R.keyword_tolerance;
      chk('primary_keyword_count', Math.abs(count - target) <= tol,
        'تكرار «' + pk + '» = ' + count + ' (المطلوب ' + target + ' ±' + tol + ')');
    } else {
      chk('primary_keyword_count', count >= 3,
        'تكرار «' + pk + '» = ' + count + ' (لم يُحدَّد هدف — الحد الأدنى الطبيعي 3)');
    }
    chk('primary_keyword_verbatim', A.body.indexOf(pk) !== -1,
      A.body.indexOf(pk) !== -1 ? 'الكلمة الرئيسية وردت بصياغتها الحرفية' : 'الكلمة الرئيسية لم ترد بصياغتها الحرفية «' + pk + '»');
  }
  const missSec = (s.brief.secondary_keywords || []).filter(function (k) { return H.countPhrase(A.body, k) === 0; });
  if ((s.brief.secondary_keywords || []).length) {
    chk('secondary_keywords', missSec.length === 0,
      missSec.length ? ('كلمات ثانوية لم تُستخدم: ' + missSec.join('، ')) : 'كل الكلمات الثانوية مستخدمة', 'medium');
  }

  /* — FAQ — */
  if (R.min_faq) {
    chk('faq', A.faq.length >= R.min_faq, 'عدد أسئلة FAQ = ' + A.faq.length + ' (الحد الأدنى ' + R.min_faq + ')');
  }

  /* — الروابط — */
  const internalDomains = (cfg.brand && cfg.brand.internal_domains) || [];
  const ext = A.links.filter(function (l) { return !H.isInternal(l.url, internalDomains); });
  const int = A.links.filter(function (l) { return H.isInternal(l.url, internalDomains); });

  if (R.require_sources_section) {
    chk('sources_section', !ext.length || A.sources_section.length > 20,
      A.sources_section.length > 20 ? 'قسم المصادر موجود' : 'قسم «المصادر المستخدمة» مفقود رغم وجود ' + ext.length + ' رابطًا خارجيًا');
  }
  if (R.forbid_homepage_only_links) {
    const hp = ext.filter(function (l) { return H.isHomepageOnly(l.url); });
    chk('no_homepage_links', hp.length === 0,
      hp.length ? ('روابط صفحة رئيسية ممنوعة: ' + hp.map(function (l) { return l.url; }).join(' | ')) : 'كل الروابط الخارجية مباشرة');
  }
  /* كل رابط خارجي يجب أن يكون من الأدلة المعتمدة (منع اختلاق الروابط) */
  if (R.strict_link_whitelist !== false) {
    const allowed = {};
    (s.evidence.approved || []).forEach(function (e) { if (e.url) allowed[String(e.url).replace(/\/+$/, '')] = 1; });
    (s.brief.internal_links || []).forEach(function (l) { allowed[String(l.url).replace(/\/+$/, '')] = 1; });
    if (s.brief.pillar_url) allowed[s.brief.pillar_url.replace(/\/+$/, '')] = 1;
    (s.brief.existing_links || []).forEach(function (u) { allowed[String(u).replace(/\/+$/, '')] = 1; });
    const rogue = A.links.filter(function (l) {
      const u = l.url.replace(/\/+$/, '');
      return !allowed[u] && !H.isInternal(l.url, internalDomains);
    });
    chk('links_whitelisted', rogue.length === 0,
      rogue.length ? ('روابط خارج الأدلة المعتمدة (يُحتمل أنها مختلقة): ' + rogue.map(function (l) { return l.url; }).join(' | ')) : 'كل الروابط من مصادر معتمدة');
  }
  /* الروابط الداخلية المطلوبة: كلها مستخدمة بالأنكور الحرفي وموزّعة */
  const req = s.brief.internal_links || [];
  if (req.length) {
    const notUsed = req.filter(function (l) { return A.body.indexOf(l.url) === -1; });
    chk('internal_links_used', notUsed.length === 0,
      notUsed.length ? ('روابط داخلية مطلوبة ولم تُستخدم: ' + notUsed.map(function (l) { return l.anchor || l.url; }).join(' | ')) : 'كل الروابط الداخلية مستخدمة');
    const badAnchor = req.filter(function (l) {
      if (!l.anchor) return false;
      return A.links.some(function (al) { return al.url === l.url && al.anchor && al.anchor !== l.anchor; });
    });
    chk('internal_anchor_verbatim', badAnchor.length === 0,
      badAnchor.length ? ('نص أنكور تغيّر: ' + badAnchor.map(function (l) { return '«' + l.anchor + '»'; }).join(' | ')) : 'نصوص الأنكور كما أرسلها المستخدم', 'medium');
    /* التوزيع: لا تتجمع كل الروابط في قسم واحد */
    if (req.length >= 3) {
      const sections = {};
      let cur = 'intro';
      A.blocks.forEach(function (b) {
        if (b.type === 'heading' && b.level <= 3) cur = b.text;
        else if (b.type !== 'heading') {
          req.forEach(function (l) { if (b.text.indexOf(l.url) !== -1) sections[cur] = (sections[cur] || 0) + 1; });
        }
      });
      const nSec = Object.keys(sections).length;
      chk('internal_links_spread', nSec >= Math.min(3, req.length),
        'الروابط الداخلية موزّعة على ' + nSec + ' قسمًا (المطلوب ' + Math.min(3, req.length) + ' على الأقل)', 'medium');
    }
  }
  /* لا مصدر في القائمة النهائية لم يُستخدم داخل النص */
  if (A.sources_section) {
    const srcUrls = (A.sources_section.match(/https?:\/\/[^\s)<>\]"']+/g) || [])
      .map(function (u) { return u.replace(/[.,؛،]+$/, ''); });
    const bodyOnly = A.body.slice(0, A.body.indexOf(A.sources_section) >= 0 ? A.body.indexOf(A.sources_section) : A.body.length);
    const unused = srcUrls.filter(function (u) { return bodyOnly.indexOf(u) === -1; });
    chk('sources_all_cited_inline', unused.length === 0,
      unused.length ? ('مصادر في القائمة لم تُذكر داخل النص: ' + unused.join(' | ')) : 'كل مصادر القائمة مستشهد بها داخل النص', 'medium');
  }

  /* — القوائم والجداول — */
  if (R.max_consecutive_paragraphs_without_list) {
    let run = 0, worst = 0;
    A.blocks.forEach(function (b) {
      if (b.type === 'paragraph') { run++; worst = Math.max(worst, run); }
      else if (b.type === 'list' || b.type === 'table') run = 0;
      else if (b.type === 'heading' && b.level <= 2) run = 0;
    });
    chk('visual_rhythm', worst <= R.max_consecutive_paragraphs_without_list,
      'أطول تتابع فقرات بلا قائمة أو جدول = ' + worst + ' (الحد ' + R.max_consecutive_paragraphs_without_list + ')', 'medium');
  }

} else {
  /* ══════════ وضع السوشيال ميديا ══════════ */
  const posts = [];
  let cur = null;
  A.blocks.forEach(function (b) {
    if (b.type === 'heading' && b.level === 2) {
      if (cur) posts.push(cur);
      const m = b.text.match(/^\s*(\S+)\s*[—\-–]\s*(\S+)/);
      cur = { id: m ? m[1] : b.text, platform: (m ? m[2] : '').toLowerCase(), text: '', chars: 0 };
    } else if (cur) { cur.text += b.text + '\n'; }
  });
  if (cur) posts.push(cur);
  posts.forEach(function (p) { p.chars = p.text.trim().length; });

  chk('posts_found', posts.length > 0, 'عدد البوستات = ' + posts.length);
  if (s.brief.post_count) {
    chk('post_count', posts.length === s.brief.post_count,
      'عدد البوستات = ' + posts.length + ' (المطلوب ' + s.brief.post_count + ')');
  }
  const plats = R.platforms || {};
  const overLong = posts.filter(function (p) {
    const lim = plats[p.platform] && plats[p.platform].max_chars;
    return lim && p.chars > lim;
  });
  chk('platform_length', overLong.length === 0,
    overLong.length ? overLong.map(function (p) { return p.id + '/' + p.platform + ' = ' + p.chars + ' حرفًا'; }).join(' | ') : 'كل البوستات ضمن حدود منصاتها');

  const badTags = [];
  posts.forEach(function (p) {
    const rng = plats[p.platform] && plats[p.platform].hashtags;
    if (!rng) return;
    const n = (p.text.match(/#[^\s#]+/g) || []).length;
    if (n < rng[0] || n > rng[1]) badTags.push(p.id + ': ' + n + ' هاشتاج (المطلوب ' + rng[0] + '–' + rng[1] + ')');
  });
  chk('hashtags', badTags.length === 0, badTags.join(' | ') || 'عدد الهاشتاجات مضبوط', 'medium');
  s.social_posts = posts;
}

/* ══════════ فحوص مشتركة ══════════ */
const banned = (R.banned_phrases || []).filter(function (p) { return H.normAr(A.body).indexOf(H.normAr(p)) !== -1; });
chk('banned_phrases', banned.length === 0,
  banned.length ? ('عبارات ممنوعة وردت: ' + banned.map(function (b) { return '«' + b + '»'; }).join('، ')) : 'لا عبارات ممنوعة');

const dial = (R.banned_dialect_markers || []).filter(function (w) {
  return new RegExp('(^|[\\s،.؛:!?«»"\'()])' + w + '($|[\\s،.؛:!?«»"\'()])').test(A.body);
});
chk('dialect', dial.length === 0,
  dial.length ? ('مفردات عامية: ' + dial.join('، ')) : 'اللغة فصحى بلا مفردات عامية', 'medium');

const nums = (H.stripMd(A.body).match(/\d+(?:[.,]\d+)?\s*%/g) || []).length;
chk('numbers_have_evidence', !(nums > 0 && (s.evidence.approved || []).length === 0),
  nums > 0 && (s.evidence.approved || []).length === 0
    ? ('النص يحتوي ' + nums + ' نسبة مئوية ولا توجد أدلة معتمدة إطلاقًا')
    : 'النسب المئوية مسنودة بحزمة أدلة معتمدة');

/* ══════════ الحكم ══════════ */
const hard   = checks.filter(function (c) { return !c.pass && c.severity === 'high'; });
const soft   = checks.filter(function (c) { return !c.pass && c.severity !== 'high'; });
s.mechanical = {
  pass: hard.length === 0,
  hard_failures: hard.length,
  soft_failures: soft.length,
  checks: checks,
  measured: {
    words: H.words(A.body),
    headings: A.headings.length,
    paragraphs: A.blocks.filter(function (b) { return b.type === 'paragraph'; }).length,
    lists: A.blocks.filter(function (b) { return b.type === 'list'; }).length,
    tables: A.blocks.filter(function (b) { return b.type === 'table'; }).length,
    links: A.links.length,
    faq: A.faq.length
  },
  frontmatter: A.frontmatter
};

H.minute(s, {
  stage: 'mechanical', actor: '🔍 المفتش الآلي — Deterministic QA',
  headline: (s.mechanical.pass ? 'اجتاز الفحص الآلي ✅' : 'رسب في الفحص الآلي ❌') +
            ' (' + hard.length + ' مخالفة حرجة، ' + soft.length + ' ملاحظة)',
  detail: checks.filter(function (c) { return !c.pass; }).map(function (c) { return c.id + ' → ' + c.detail; }).join(' | ') || 'لا مخالفات'
});

return [{ json: { state: s } }];
