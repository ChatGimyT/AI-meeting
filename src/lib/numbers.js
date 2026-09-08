/* =============================================================
 * مختبر الأرقام (Numeric Lab)  —  N
 * -------------------------------------------------------------
 * كل رقم يمر بسبع طبقات قبل أن يُسلَّم:
 *   L0 تطبيع     — توحيد الأرقام العربية والفواصل والنسب
 *   L1 استخراج   — كل رقم في النص مع وحدته وسياقه وقسمه
 *   L2 تصنيف     — رقم إحصائي؟ سنة؟ ترقيم قائمة؟ عدّ ذاتي؟
 *   L3 عهدة      — لكل رقم إحصائي دليل معتمد ورابط بجواره
 *   L4 مطابقة    — قيمة الرقم = قيمة المصدر حرفيًا أو تقريبًا مشروعًا
 *   L5 اتساق     — لا تناقض داخلي، لا نسبة مستحيلة، لا نطاق مقلوب
 *   L6 مصالحة    — كل رقم في التقرير مُعاد اشتقاقه من مصدر واحد
 *
 * هذا الملف يُحقن في العقد التي تحتاجه فقط (لا في كل العقد).
 * ============================================================= */
const N = {

  AR_DIGITS: '٠١٢٣٤٥٦٧٨٩',
  FA_DIGITS: '۰۱۲۳۴۵۶۷۸۹',

  /* ══════════ L0 — التطبيع (لا يغيّر طول النص أبدًا) ══════════
   * ثبات الطول شرط: كل الفهارس (القسم، السطر، قرب الرابط) تُحسب عليه. */

  digits: function (s) {
    return String(s == null ? '' : s).replace(/[٠-٩۰-۹]/g, function (d) {
      const i = N.AR_DIGITS.indexOf(d);
      return String(i >= 0 ? i : N.FA_DIGITS.indexOf(d));
    });
  },

  normalize: function (s) {
    return N.digits(s)
      .replace(/٫/g, '.')    /* الفاصلة العشرية العربية */
      .replace(/٪/g, '%')    /* علامة النسبة العربية */
      .replace(/−/g, '-')    /* إشارة الطرح الرياضية */
      .replace(/⁄/g, '/');   /* شرطة الكسر */
  },

  /* حجب ما ليس رقمًا في المتن: الأكواد وأهداف الروابط — بنفس الطول */
  mask: function (s) {
    const blank = function (m) { return m.replace(/[^\n]/g, ' '); };
    return String(s || '')
      .replace(/```[\s\S]*?```/g, blank)
      .replace(/`[^`\n]*`/g, blank)
      .replace(/\]\([^)\s]*\)/g, blank)
      .replace(/https?:\/\/[^\s)<>\]"']+/g, blank);
  },

  /* رقم واحد كنص → قيمة */
  value: function (raw) {
    const v = Number(String(raw).replace(/[,،٬  ]/g, ''));
    return isFinite(v) ? v : null;
  },

  /* ══════════ L1 — قواميس الوحدات ══════════ */

  SCALES: [
    { mult: 1e3,  word: 'ألف',     re: /^\s*(?:آلاف|الاف|ألفًا|ألفا|الفا|ألف|الف)(?![ء-ي])/ },
    { mult: 1e6,  word: 'مليون',   re: /^\s*(?:ملايين|مليونًا|مليونا|مليون)(?![ء-ي])/ },
    { mult: 1e9,  word: 'مليار',   re: /^\s*(?:مليارات|مليارًا|مليارا|مليار|بليون)(?![ء-ي])/ },
    { mult: 1e12, word: 'تريليون', re: /^\s*(?:تريليونات|تريليون|ترليون)(?![ء-ي])/ }
  ],

  CURRENCIES: [
    { code: 'SAR', post: /^\s*(?:ريالات|ريالًا|ريالا|ريال|ر\.?\s?س|SAR)(?![ء-ي])/i, pre: /(?:SAR|ر\.?\s?س)\s*$/i },
    { code: 'USD', post: /^\s*(?:دولارات|دولارًا|دولارا|دولار|USD)(?![ء-ي])/i,        pre: /(?:\$|USD)\s*$/i },
    { code: 'EGP', post: /^\s*(?:جنيهات|جنيهًا|جنيها|جنيه|EGP)(?![ء-ي])/i,            pre: /EGP\s*$/i },
    { code: 'AED', post: /^\s*(?:دراهم|درهمًا|درهما|درهم|AED)(?![ء-ي])/i,             pre: /AED\s*$/i },
    { code: 'EUR', post: /^\s*(?:يورو|EUR|€)(?![ء-ي])/i,                              pre: /(?:€|EUR)\s*$/i },
    { code: 'KWD', post: /^\s*(?:دنانير|دينارًا|دينار|KWD)(?![ء-ي])/i,                pre: /KWD\s*$/i }
  ],

  RE_PERCENT:  /^\s*(?:%|في\s*ال?مائة|في\s*ال?مئة|بال?مئة|بال?مائة|percent)/i,
  RE_PP:       /^\s*نق(?:طة|اط)\s*مئوية/,
  RE_DURATION: /^\s*(?:ثوان[ٍي]?|ثانية|دقائق|دقيقة|ساعات|ساعة|أيام|ايام|يومًا|يوما|يوم|أسابيع|اسابيع|أسبوعًا|أسبوع|أشهر|اشهر|شهرًا|شهرا|شهر|سنوات|سنة|أعوام|اعوام|عامًا|عاما)(?![ء-ي])/,
  RE_TIMES:    /^\s*(?:أضعاف|اضعاف|ضعفًا|ضعفا|ضعف|مرات|مرة|×)(?![ء-ي])/,
  RE_GROWTH:   /(?:زياد[ةه]|ارتفاع|نمو|مضاعف[ةه]|تضاعف|أضعاف|اضعاف|قفز|انخفاض|تراجع|هبوط|نسبة\s*النمو|ROI|عائد)/,

  /* ادعاء من طرف العميل نفسه (نتائجنا، عملاؤنا) — لا يُطلب له مصدر خارجي،
   * لكنه لا يمر صامتًا: يُرفع للعميل ليؤكده بنفسه قبل النشر. */
  RE_FIRST_PARTY: /(?:^|[\s،.؛:«"(])(?:أوقفنا|اوقفنا|حققنا|سجّلنا|سجلنا|رفعنا|خفّضنا|خفضنا|أدرنا|ادرنا|أطلقنا|اطلقنا|بنينا|ساعدنا|وفّرنا|وفرنا|لدينا|نمتلك|نخدم|أنجزنا|انجزنا|عملاؤنا|عملائنا|فريقنا|نتائجنا|حساباتنا|تجربتنا|خبرتنا|محفظتنا)/,

  /* أسماء العدّ التي تصف المقال نفسه («٥ خطوات»، «٣ أنواع») */
  RE_COUNTING: /^\s*(?:خطوات|خطوة|أنواع|انواع|نوعًا|نوع|طرق|طريقة|أسباب|اسباب|سببًا|سبب|نصائح|نصيحة|مراحل|مرحلة|عوامل|عامل|أخطاء|اخطاء|خطأ|عناصر|عنصر|بنود|بند|أقسام|اقسام|قسم|محاور|محور|مزايا|ميزة|فوائد|فائدة|أسئلة|اسئلة|سؤال|نقاط|نقطة)(?![ء-ي])/,

  /* اسم معدود يسبق الرقم فيجعله ترتيبًا لا ادعاءً: «نقطة ٢» «سؤال رقم ٣» */
  RE_ORDINAL_BEFORE: /(?:رقم|نقطة|خطوة|سؤال|قسم|بند|نوع|طريقة|مرحلة|عنصر|محور|جزء|فصل|شكل|جدول|صورة|مثال|حالة|خيار|مستوى|فقرة|سطر|صف|عمود|إصدار|نسخة|No\.?|#)(?:\s+[ء-ي]{2,})?\s*$/i,

  RE_RANGE_SEP: /^(?:إلى|الى|-|–|—)$/,
  /* كلمات الوحدة التي تفصل حدَّي النطاق: «من ٩٠ ريالًا إلى ١٤٠ ريالًا» */
  RE_UNIT_WORDS: /%|٪|ريالات|ريالًا|ريالا|ريال|دولارات|دولارًا|دولارا|دولار|جنيهات|جنيهًا|جنيه|دراهم|درهمًا|درهم|يورو|دنانير|دينارًا|دينار|في\s*ال?مائة|في\s*ال?مئة|بال?مئة|بال?مائة|آلاف|الاف|ألفًا|ألف|الف|ملايين|مليونًا|مليون|مليارات|مليارًا|مليار|تريليون|ثانية|ثوان|دقائق|دقيقة|ساعات|ساعة|أيام|يومًا|يوم|أسابيع|أسبوعًا|أسبوع|أشهر|شهرًا|شهر|سنوات|سنة|أعوام|عامًا|عام|أضعاف|ضعفًا|ضعف|مرات|مرة/g,

  /* ══════════ L1 — الاستخراج ══════════
   * يُعيد كل رقم مع: قيمته الفعّالة، وحدته، سطره، قسمه، سياقه ودوره. */

  scan: function (text, opts) {
    const o    = opts || {};
    const src  = String(text || '');
    const norm = N.normalize(N.mask(src));
    const plain = N.normalize(src);   /* غير محجوب — للبحث عن الروابط والسياق */

    /* فهارس بدايات الأسطر لحساب رقم السطر بالبحث الثنائي */
    const starts = [0];
    for (let i = 0; i < norm.length; i++) if (norm[i] === '\n') starts.push(i + 1);
    const lineOf = function (idx) {
      let lo = 0, hi = starts.length - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= idx) lo = mid; else hi = mid - 1; }
      return lo;
    };
    const lineAt = function (idx) {
      const l = lineOf(idx);
      const end = l + 1 < starts.length ? starts[l + 1] - 1 : norm.length;
      return { no: l + 1, start: starts[l], text: src.slice(starts[l], end) };
    };

    /* خريطة العناوين: أي رقم يعرف تحت أي H2/H3 يقع */
    const heads = [];
    for (let l = 0; l < starts.length; l++) {
      const end = l + 1 < starts.length ? starts[l + 1] - 1 : norm.length;
      const raw = src.slice(starts[l], end);
      const m = raw.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
      if (m) heads.push({ start: starts[l], end: end, level: m[1].length, text: m[2].trim() });
    }
    const sectionAt = function (idx) {
      let cur = '', lvl = 0;
      for (const h of heads) { if (h.start > idx) break; if (h.level <= 3) { cur = h.text; lvl = h.level; } }
      return { heading: cur, level: lvl };
    };
    const inHeading = function (idx) { return heads.some(function (h) { return idx >= h.start && idx <= h.end; }); };

    const out = [];
    const re = /\d{1,3}(?:[,،٬  ]\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/g;
    let m;
    while ((m = re.exec(norm)) !== null) {
      const raw = m[0];
      const start = m.index;
      const end = start + raw.length;
      const prevCh = start > 0 ? norm[start - 1] : '';
      const nextCh = norm[end] || '';
      /* أجزاء من كلمة أو معرّف (v4، H2، ID2026) ليست أرقامًا مستقلة */
      if (/[A-Za-zء-ي_@#]/.test(prevCh)) continue;
      if (/[A-Za-z_]/.test(nextCh)) continue;

      const value = N.value(raw);
      if (value === null) continue;

      const before = norm.slice(Math.max(0, start - 40), start);
      let after = norm.slice(end, end + 40);

      /* الوحدة */
      let unit = 'plain', currency = null, scale = 1, scaleWord = '';
      for (const sc of N.SCALES) {
        if (sc.re.test(after)) { scale = sc.mult; scaleWord = sc.word; after = after.replace(sc.re, ''); break; }
      }
      for (const c of N.CURRENCIES) {
        if (c.post.test(after) || c.pre.test(before)) { currency = c.code; break; }
      }
      if (N.RE_PERCENT.test(after)) unit = 'percent';
      else if (N.RE_PP.test(after)) unit = 'pp';
      else if (currency) unit = 'money';
      else if (scale > 1) unit = 'magnitude';
      else if (N.RE_DURATION.test(after)) unit = 'duration';
      else if (N.RE_TIMES.test(after)) unit = 'multiplier';
      else if (Number.isInteger(value) && value >= 1900 && value <= 2100) unit = 'year';

      const ln = lineAt(start);
      const sec = sectionAt(start);
      const isHeading = inHeading(start);
      const listMarker = /^\s{0,6}\d+[.)]\s/.test(ln.text) && (start - ln.start) <= 6;
      const inTable = /^\s{0,3}\|/.test(ln.text);

      /* الدور */
      let role;
      if (listMarker) role = 'list_marker';
      else if (unit === 'percent' || unit === 'pp' || unit === 'money' || unit === 'magnitude' || unit === 'multiplier') role = 'stat';
      else if (isHeading) role = 'heading';
      else if (unit === 'year') role = 'year';
      else if (unit === 'duration') role = 'quantified';
      else if (Number.isInteger(value) && value <= (o.benign_max == null ? 12 : o.benign_max) &&
               (N.RE_COUNTING.test(after) || N.RE_ORDINAL_BEFORE.test(before))) role = 'enumeration';
      else role = 'bare';

      out.push({
        raw: raw, value: value, scale: scale, scale_word: scaleWord,
        effective: value * scale, unit: unit, currency: currency,
        index: start, line: ln.no, section: sec.heading, in_table: inTable,
        role: role,
        before: before.replace(/\s+/g, ' ').trim(),
        after: norm.slice(end, end + 40).replace(/\s+/g, ' ').trim(),
        context: N.normalize(src.slice(Math.max(0, start - 90), Math.min(src.length, end + 90)))
          .replace(/\s+/g, ' ').trim(),
        sentence: N.sentenceAt(plain, start)
      });
    }
    return out;
  },

  sentenceAt: function (plain, idx) {
    const stop = /[.!?؟\n]/;
    let a = idx, b = idx;
    while (a > 0 && !stop.test(plain[a - 1])) a--;
    while (b < plain.length && !stop.test(plain[b])) b++;
    return plain.slice(a, b).replace(/\s+/g, ' ').trim();
  },

  /* بصمة الادعاء: نص الجملة بلا أرقام — لكشف تناقض نفس العبارة بقيمتين */
  claimKey: function (tok) {
    return H.normAr(String(tok.sentence || tok.context || '')
      .replace(/\d+(?:[.,]\d+)?/g, '#')
      .replace(/[^ء-ي#\s]/g, ' '))
      .replace(/\s+/g, ' ').trim().slice(0, 160);
  },

  /* ══════════ L4 — المطابقة مع المصدر ══════════
   * الافتراضي: مطابقة حرفية. التقريب مسموح فقط إن كان تقريبًا رياضيًا
   * صحيحًا لقيمة المصدر (27.4% → 27%)، لا «قريبًا منها». */

  sameValue: function (a, b, opt) {
    const o = opt || {};
    if (a === b) return 'exact';
    if (o.allow_rounding !== false) {
      for (let d = 0; d <= 3; d++) {
        const p = Math.pow(10, d);
        if (Math.round(b * p) / p === a) return 'rounded';
      }
    }
    const abs = o.abs_tolerance || 0;
    const rel = o.rel_tolerance || 0;
    const slack = Math.max(abs, rel * Math.max(Math.abs(a), Math.abs(b)));
    if (slack > 0 && Math.abs(a - b) <= slack) return 'within_tolerance';
    return null;
  },

  /* كل الأرقام التي «يملكها» دليل معتمد */
  evidenceTokens: function (e) {
    const text = [e.figure, e.arabic_sentence, e.citation_line].filter(Boolean).join(' ⟂ ');
    return N.scan(text).filter(function (t) { return t.role !== 'list_marker'; });
  },

  /* ══════════ L3 — قرب الاستشهاد ══════════ */
  urlPositions: function (src, url) {
    const clean = String(url || '').replace(/\/+$/, '');
    if (!clean) return [];
    const hay = String(src || '');
    const pos = [];
    let i = 0;
    while ((i = hay.indexOf(clean, i)) !== -1) { pos.push(i); i += clean.length; }
    return pos;
  }
};

/* ══════════ الإعدادات (كل ملف تعريفي يستطيع تشديدها أو تخفيفها) ══════════ */
N.conf = function (cfg) {
  const d = {
    enabled: true,
    benign_max: 12,          /* «٥ خطوات» تصف المقال نفسه ولا تحتاج مصدرًا */
    proximity_chars: 700,    /* رابط المصدر يجب أن يقع داخل هذه المسافة من الرقم */
    require_proximity: true,
    allow_rounding: true,    /* 27.4% في المصدر → 27% في النص: تقريب مشروع */
    abs_tolerance: 0,
    rel_tolerance: 0,
    max_percent: 100,
    allow_values: [],        /* أرقام يعتمدها العميل بلا مصدر خارجي */
    severity: {
      stat: 'high', quantified: 'medium', bare: 'medium',
      year: 'low', enumeration: 'off', list_marker: 'off', heading: 'off',
      first_party: 'medium'
    },
    block_delivery_on: ['high'],   /* لا يُرسل الإيميل ما دامت هذه الدرجات قائمة */
    adjudicate: true,              /* عرض الحالات الرمادية على مراجع بشري-آلي */
    max_adjudicated: 40
  };
  return H.deepMerge(d, (cfg && cfg.numbers) || {});
};

/* الأرقام المسموح بها بلا مصدر خارجي: ما أدخله المستخدم وما تملكه العلامة */
N.ownValues = function (state, cfg) {
  const C = N.conf(cfg);
  const bag = {};
  const add = function (v) { if (v !== null && isFinite(v)) bag[String(v)] = true; };
  const addText = function (t) { N.scan(t || '').forEach(function (k) { add(k.effective); add(k.value); }); };

  (C.allow_values || []).forEach(add);
  const b = (cfg && cfg.brand) || {};
  add(Number(b.founded));
  (b.proof_points || []).forEach(addText);
  (b.services || []).forEach(addText);

  const br = state.brief || {};
  addText(br.title); addText(br.notes); addText(br.goal);
  (br.headings || []).forEach(addText);
  (br.mandatory_citations || []).forEach(addText);
  (br.secondary_keywords || []).forEach(addText);
  addText(br.primary_keyword);
  add(Number(br.primary_keyword_count));
  add(Number(br.post_count));
  return bag;
};

/* ══════════ L2→L5 — تدقيق أرقام المقال ══════════ */
N.auditArticle = function (state, cfg) {
  const C = N.conf(cfg);
  const A = H.parseArticle(state.article || '');
  const body = A.body || '';
  const tokens = N.scan(body, { benign_max: C.benign_max });
  const own = N.ownValues(state, cfg);
  const approved = ((state.evidence || {}).approved || []).filter(function (e) { return e && e.url; });
  const thisYear = new Date().getFullYear();

  /* حدود قسم المصادر: أرقامه هي أرقام سطور الاستشهاد نفسها */
  const srcStart = A.sources_section ? body.indexOf(A.sources_section) : -1;

  const evs = approved.map(function (e, i) {
    return {
      id: e.id || ('E' + (i + 1)), e: e,
      toks: N.evidenceTokens(e),
      pos: N.urlPositions(body, e.url)
    };
  });

  const findings = [];
  const verified = [];
  const grey = [];
  const flag = function (code, severity, tok, msg, extra) {
    findings.push(Object.assign({
      code: code, severity: severity, raw: tok.raw, value: tok.value,
      effective: tok.effective, unit: tok.unit, line: tok.line,
      section: tok.section || '(المقدمة)', context: tok.context, message: msg
    }, extra || {}));
  };

  /* --- مطابقة قيمة برقم دليل، مع مراعاة الوحدة --- */
  const matchTok = function (tok, ev) {
    for (const et of ev.toks) {
      if (tok.unit === 'percent' || tok.unit === 'pp') {
        if (et.unit !== 'percent' && et.unit !== 'pp') continue;
      } else if (tok.unit === 'money') {
        if (et.unit !== 'money' && et.unit !== 'magnitude' && et.unit !== 'plain') continue;
        if (tok.currency && et.currency && tok.currency !== et.currency) continue;
      } else if (tok.unit === 'year') {
        if (et.unit !== 'year' && et.unit !== 'plain') continue;
      }
      const how = N.sameValue(tok.effective, et.effective, C);
      if (how) return { how: how, evidence_value: et.raw, evidence_effective: et.effective };
    }
    return null;
  };

  tokens.forEach(function (tok) {
    const sev = (C.severity || {})[tok.role] || 'off';
    tok.audited = sev !== 'off';

    /* ── فحوص السلامة الذاتية: تنطبق حتى على الأرقام المعفاة ── */
    if (tok.unit === 'percent') {
      const growth = N.RE_GROWTH.test(tok.before) || N.RE_GROWTH.test(tok.sentence || '');
      if (tok.value > C.max_percent && !growth) {
        flag('impossible_percent', 'high', tok,
          'نسبة ' + tok.raw + '% تتجاوز ' + C.max_percent + '% بلا صياغة نمو أو مضاعفة.');
      }
      const dec = String(tok.raw).split('.')[1];
      if (dec && dec.length > 2) {
        flag('over_precision', 'low', tok, 'دقة زائدة في النسبة (' + dec.length + ' منازل عشرية) — قرّبها أو انسبها لمصدرها حرفيًا.');
      }
    }
    if (tok.unit === 'year' && tok.value > thisYear + 1) {
      flag('future_year', 'medium', tok, 'سنة مستقبلية (' + tok.raw + ') تُقدَّم كأنها واقع.');
    }

    if (!tok.audited) return;
    if (srcStart >= 0 && tok.index >= srcStart) { tok.audited = false; return; }   /* قسم المصادر */
    if (own[String(tok.effective)] || own[String(tok.value)]) {
      tok.verdict = 'own_value';
      verified.push({ raw: tok.raw, line: tok.line, source: 'مدخلات المستخدم / هوية العلامة', how: 'declared' });
      return;
    }

    const near = evs.filter(function (ev) {
      return ev.pos.some(function (p) { return Math.abs(p - tok.index) <= C.proximity_chars; });
    });
    let hit = null, hitEv = null;
    for (const ev of evs) { const r = matchTok(tok, ev); if (r) { hit = r; hitEv = ev; break; } }
    const nearHit = near.length ? (function () {
      for (const ev of near) { const r = matchTok(tok, ev); if (r) return { r: r, ev: ev }; }
      return null;
    })() : null;

    if (nearHit) {
      tok.verdict = 'verified';
      tok.evidence_id = nearHit.ev.id;
      verified.push({ raw: tok.raw, line: tok.line, source: nearHit.ev.id + ' — ' + (nearHit.ev.e.publisher || ''), how: nearHit.r.how });
      if (nearHit.r.how !== 'exact') {
        flag('rounded_value', 'low', tok,
          'الرقم مقرَّب عن مصدره (' + nearHit.r.evidence_value + ' في ' + nearHit.ev.id + ') — مقبول، لكن الأدق نقله حرفيًا.',
          { evidence_id: nearHit.ev.id, expected: nearHit.r.evidence_value });
      }
      return;
    }

    if (hit && !C.require_proximity) {
      tok.verdict = 'verified';
      tok.evidence_id = hitEv.id;
      verified.push({ raw: tok.raw, line: tok.line, source: hitEv.id, how: hit.how });
      return;
    }

    if (hit) {
      tok.verdict = 'uncited_inline';
      flag('uncited_inline', 'medium', tok,
        'الرقم يطابق الدليل ' + hitEv.id + ' لكن رابط المصدر غير مذكور بجواره — ضع الاستشهاد في الفقرة نفسها.',
        { evidence_id: hitEv.id, fix: 'أضف [' + (hitEv.e.publisher || 'المصدر') + '](' + hitEv.e.url + ') في الجملة نفسها.' });
      return;
    }

    if (near.length && tok.role === 'stat') {
      tok.verdict = 'value_mismatch';
      const ev = near[0];
      flag('value_mismatch', 'high', tok,
        'الرقم ' + tok.raw + ' منسوب إلى ' + ev.id + ' (' + (ev.e.publisher || '') + ') والمصدر يذكر «' +
        (ev.e.figure || '—') + '» — لا تطابق.',
        { evidence_id: ev.id, expected: ev.e.figure || '',
          fix: 'اكتب الرقم كما ورد في المصدر حرفيًا، أو احذف الجملة.' });
      return;
    }

    if (N.RE_FIRST_PARTY.test(tok.sentence || '') || N.RE_FIRST_PARTY.test(tok.before)) {
      tok.verdict = 'first_party';
      flag('first_party_number', (C.severity || {}).first_party || 'medium', tok,
        'رقم من طرف العميل نفسه («' + tok.raw + '») لا مصدر خارجي له — يحتاج تأكيدًا مكتوبًا من العميل قبل النشر.',
        { fix: 'أكّد الرقم مع العميل وأضِفه إلى allow_values في الملف التعريفي، أو احذفه.' });
      return;
    }

    tok.verdict = 'orphan';
    flag('orphan_number', sev, tok,
      'رقم بلا دليل معتمد ولا رابط مصدر بجواره: «' + tok.raw + '» في «' + (tok.section || 'المقدمة') + '».',
      { fix: 'اربطه بدليل من الحزمة المعتمدة، أو أعد صياغة الجملة بلا رقم.' });
    if (sev !== 'high') grey.push(tok);
  });

  /* ── تناقض داخلي: نفس الجملة بقيمتين مختلفتين ── */
  const byClaim = {};
  tokens.forEach(function (t) {
    if (!t.audited || t.role === 'list_marker' || t.role === 'enumeration') return;
    const k = N.claimKey(t);
    if (k.length < 25) return;
    (byClaim[k] = byClaim[k] || []).push(t);
  });
  Object.keys(byClaim).forEach(function (k) {
    const vals = {};
    byClaim[k].forEach(function (t) { vals[String(t.effective)] = t; });
    const keys = Object.keys(vals);
    if (keys.length > 1) {
      const t = vals[keys[0]];
      flag('contradiction', 'high', t,
        'الادعاء نفسه يظهر بقيمتين مختلفتين: ' + keys.map(function (v) { return vals[v].raw; }).join(' ≠ ') +
        ' (سطور ' + keys.map(function (v) { return vals[v].line; }).join('، ') + ').',
        { fix: 'وحّد الرقم على قيمة المصدر المعتمد واحذف الأخرى.' });
    }
  });

  /* ── نطاق مقلوب: «من ٩٠ إلى ٤٠» ── */
  for (let i = 0; i + 1 < tokens.length; i++) {
    const a = tokens[i], b = tokens[i + 1];
    if (a.unit !== b.unit) continue;
    if (b.index - (a.index + a.raw.length) > 30) continue;
    const between = N.normalize(body).slice(a.index + a.raw.length, b.index)
      .replace(N.RE_UNIT_WORDS, ' ').replace(/\s+/g, ' ').trim();
    if (!N.RE_RANGE_SEP.test(between)) continue;
    if (a.effective > b.effective) {
      flag('inverted_range', 'high', a,
        'نطاق مقلوب: «' + a.raw + '» إلى «' + b.raw + '» — الحد الأدنى أكبر من الأعلى.',
        { fix: 'بدّل ترتيب الحدين.' });
    }
  }

  const count = function (s) { return findings.filter(function (f) { return f.severity === s; }).length; };
  const audited = tokens.filter(function (t) { return t.audited; }).length;
  return {
    enabled: C.enabled !== false,
    scanned: tokens.length,
    audited: audited,
    verified_count: verified.length,
    verified: verified,
    findings: findings,
    grey: grey.slice(0, C.max_adjudicated).map(function (t) {
      return { raw: t.raw, unit: t.unit, line: t.line, section: t.section, sentence: t.sentence };
    }),
    high: count('high'), medium: count('medium'), low: count('low'),
    pass: count('high') === 0,
    coverage_pct: audited ? Math.round((verified.length / audited) * 100) : 100
  };
};

/* ══════════ L6 — مصالحة أرقام التقرير ══════════
 * كل رقم يظهر في التقرير يُعاد اشتقاقه من مصدره الوحيد ويُقارن. */
N.recon = function (rows) {
  const out = [];
  rows.forEach(function (r) {
    if (r.expected == null || r.actual == null) return;
    const a = Number(r.expected), b = Number(r.actual);
    if (!isFinite(a) || !isFinite(b)) return;
    const tol = r.tol || 0;
    const ok = Math.abs(a - b) <= tol;
    out.push({ id: r.id, label: r.label, expected: a, actual: b, tol: tol, ok: ok,
               source: r.source || '', note: r.note || '' });
  });
  return out;
};

/* مجموعة القيم التي يحق للتقرير أن يذكرها */
N.allowedValues = function (sources) {
  const bag = {};
  const add = function (v) {
    if (v === null || v === undefined || v === '') return;
    const n = Number(v);
    if (isFinite(n)) bag[String(n)] = true;
  };
  (sources || []).forEach(function (s) {
    if (s == null) return;
    if (typeof s === 'number') { add(s); return; }
    N.scan(String(s)).forEach(function (t) { add(t.value); add(t.effective); });
  });
  return bag;
};

/* أرقام ظهرت في التقرير ولا أصل لها في أي مصدر معتمد */
N.orphansInReport = function (md, bag, opts) {
  const o = opts || {};
  const skip = o.skip_max == null ? 12 : o.skip_max;   /* أرقام الترقيم والعدّ الصغيرة */
  const seen = {};
  const out = [];
  N.scan(String(md || '')).forEach(function (t) {
    if (t.role === 'list_marker') return;
    if (t.unit === 'plain' && Number.isInteger(t.value) && t.value <= skip) return;
    if (bag[String(t.value)] || bag[String(t.effective)]) return;
    const k = t.raw + '@' + t.line;
    if (seen[k]) return;
    seen[k] = true;
    out.push({ raw: t.raw, unit: t.unit, line: t.line, context: t.context });
  });
  return out;
};

H.N = N;
