/* =============================================================
 * AI Editorial Boardroom — Shared Helper Library  (H)
 * -------------------------------------------------------------
 * This block is injected automatically at the top of EVERY Code
 * node by build/build.mjs. Never paste it manually.
 * ============================================================= */
const H = {

  /* ---------- 1. LLM request building ---------- */

  buildBody(persona, userText, llm) {
    const model       = persona.model       || llm.model;
    const temperature = persona.temperature != null ? persona.temperature : (llm.temperature != null ? llm.temperature : 0.4);
    const maxTokens   = persona.max_tokens  || llm.max_tokens || 8000;

    if (llm.provider === 'openai') {
      return {
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: persona.system },
          { role: 'user',   content: userText }
        ]
      };
    }

    // default: anthropic messages API
    const body = {
      model,
      max_tokens: maxTokens,
      temperature,
      system: persona.system,
      messages: [{ role: 'user', content: userText }]
    };
    if (llm.enable_tools !== false && Array.isArray(persona.tools) && persona.tools.length) {
      body.tools = persona.tools;
    }
    return body;
  },

  /** One fan-out item, ready for the HTTP Request node. */
  call(personaId, persona, userText, state, cfg, extra) {
    return {
      json: Object.assign({
        body: H.buildBody(persona, userText, cfg.llm),
        meta: {
          persona_id: personaId,
          persona_name: persona.name,
          persona_title: persona.title,
          emoji: persona.emoji || '🗣️',
          output_mode: persona.output_mode || 'json',
          stage: (extra && extra.stage) || 'unknown'
        },
        state: state
      }, extra && extra.json ? extra.json : {})
    };
  },

  /* ---------- 2. Reading LLM responses ---------- */

  readText(r) {
    if (!r) return '';
    if (typeof r === 'string') return r;
    if (Array.isArray(r.content)) {
      return r.content
        .filter(function (b) { return b && b.type === 'text' && typeof b.text === 'string'; })
        .map(function (b) { return b.text; })
        .join('\n');
    }
    if (r.choices && r.choices[0]) {
      const m = r.choices[0].message;
      if (m && typeof m.content === 'string') return m.content;
      if (m && Array.isArray(m.content)) {
        return m.content.map(function (c) { return c.text || ''; }).join('\n');
      }
    }
    if (r.data && typeof r.data === 'object') return H.readText(r.data);
    return '';
  },

  /** Extract the URLs the provider's server-side web search actually visited. */
  readSearchResults(r) {
    const out = [];
    if (!r || !Array.isArray(r.content)) return out;
    for (const block of r.content) {
      if (!block) continue;
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
        for (const hit of block.content) {
          if (hit && hit.url) out.push({ url: hit.url, title: hit.title || '', age: hit.page_age || '' });
        }
      }
    }
    return out;
  },

  apiError(r) {
    if (!r) return 'empty response';
    if (r.error) return (r.error.type || 'error') + ': ' + (r.error.message || JSON.stringify(r.error));
    if (r.message && !r.content && !r.choices) return String(r.message);
    return null;
  },

  /* ---------- 3. Tolerant JSON extraction ---------- */

  grabJson(text) {
    if (!text) return null;
    let s = String(text);
    const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1];
    const start = s.indexOf('{');
    if (start < 0) return null;

    // try greedy first
    const end = s.lastIndexOf('}');
    if (end > start) {
      try { return JSON.parse(s.slice(start, end + 1)); } catch (e) { /* fall through */ }
    }
    // balanced brace scan, string/escape aware
    let depth = 0, inStr = false, esc = false;
    for (let i = start; i < s.length; i++) {
      const c = s[i];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(s.slice(start, i + 1)); } catch (e) { return null; }
        }
      }
    }
    return null;
  },

  grabArticle(text) {
    if (!text) return '';
    const s = String(text);
    const m = s.match(/<<<ARTICLE>>>([\s\S]*?)<<<END_ARTICLE>>>/);
    if (m) return m[1].trim();
    const open = s.indexOf('<<<ARTICLE>>>');
    if (open >= 0) return s.slice(open + 13).trim();
    const fence = s.match(/```(?:markdown|md)?\s*([\s\S]*?)```/i);
    if (fence) return fence[1].trim();
    return s.trim();
  },

  /* ---------- 4. Text metrics (Arabic-aware) ---------- */

  stripMd(s) {
    return String(s || '')
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/^\s{0,3}#{1,6}\s+/gm, '')
      .replace(/^\s*[-*+]\s+/gm, '')
      .replace(/^\s*\d+[.)]\s+/gm, '')
      .replace(/[|>*_`~]/g, ' ')
      .replace(/^\s*-{3,}\s*$/gm, ' ');
  },

  words(s) {
    const t = H.stripMd(s).replace(/\s+/g, ' ').trim();
    if (!t) return 0;
    return t.split(' ').filter(function (w) { return /[\p{L}\p{N}]/u.test(w); }).length;
  },

  /** Normalise Arabic for keyword counting: strip tashkeel, unify alef/ya/ta-marbuta. */
  normAr(s) {
    return String(s || '')
      .replace(/[ً-ْـٰ]/g, '')
      .replace(/[آأإٱ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/ة/g, 'ه')
      .replace(/\s+/g, ' ')
      .toLowerCase()
      .trim();
  },

  countPhrase(haystack, phrase) {
    const h = ' ' + H.normAr(H.stripMd(haystack)) + ' ';
    const p = H.normAr(phrase);
    if (!p) return 0;
    let n = 0, i = 0;
    while (true) {
      const k = h.indexOf(p, i);
      if (k < 0) break;
      n++; i = k + p.length;
    }
    return n;
  },

  /* ---------- 5. Article parsing ---------- */

  parseArticle(md) {
    const raw = String(md || '');
    const out = {
      frontmatter: {}, body: raw, headings: [], blocks: [],
      links: [], internal_links: [], external_links: [],
      faq: [], sources_section: '', has_table: false, has_list: false
    };

    // frontmatter (--- key: value ---)
    const fm = raw.match(/^\s*---\s*\n([\s\S]*?)\n---\s*\n?/);
    if (fm) {
      fm[1].split('\n').forEach(function (line) {
        const kv = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.*)$/);
        if (kv) out.frontmatter[kv[1].trim()] = kv[2].trim().replace(/^["']|["']$/g, '');
      });
      out.body = raw.slice(fm[0].length);
    }

    const lines = out.body.split('\n');
    let buf = [], inFence = false;

    function flush() {
      const text = buf.join('\n').trim();
      buf = [];
      if (!text) return;
      const isList  = /^\s*([-*+]\s+|\d+[.)]\s+)/.test(text);
      const isTable = /^\s*\|/.test(text) || /\n\s*\|/.test(text);
      if (isList)  out.has_list = true;
      if (isTable) out.has_table = true;
      out.blocks.push({
        type: isTable ? 'table' : (isList ? 'list' : 'paragraph'),
        text: text,
        words: H.words(text)
      });
    }

    for (const line of lines) {
      if (/^\s*```/.test(line)) { inFence = !inFence; buf.push(line); continue; }
      if (inFence) { buf.push(line); continue; }
      const h = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
      if (h) {
        flush();
        out.headings.push({ level: h[1].length, text: h[2].trim(), index: out.blocks.length });
        out.blocks.push({ type: 'heading', level: h[1].length, text: h[2].trim(), words: 0 });
        continue;
      }
      if (!line.trim()) { flush(); continue; }
      buf.push(line);
    }
    flush();

    // links
    const linkRe = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
    let m;
    while ((m = linkRe.exec(out.body)) !== null) {
      out.links.push({ anchor: m[1].trim(), url: m[2].trim() });
    }
    // bare urls (sources list style)
    const bareRe = /(?:^|[\s(<])((?:https?:\/\/)[^\s)<>\]"']+)/g;
    while ((m = bareRe.exec(out.body)) !== null) {
      const u = m[1].replace(/[.,؛،]+$/, '');
      if (!out.links.some(function (l) { return l.url === u; })) out.links.push({ anchor: '', url: u });
    }

    // FAQ block: everything under a heading containing FAQ / الأسئلة الشائعة
    const faqIdx = out.blocks.findIndex(function (b) {
      return b.type === 'heading' && /faq|الأسئلة\s*الشائعة/i.test(b.text);
    });
    if (faqIdx >= 0) {
      for (let i = faqIdx + 1; i < out.blocks.length; i++) {
        const b = out.blocks[i];
        if (b.type === 'heading' && b.level <= 2) break;
        if (b.type === 'heading') {
          const ans = out.blocks[i + 1] && out.blocks[i + 1].type === 'paragraph' ? out.blocks[i + 1].text : '';
          out.faq.push({ q: b.text, a: ans });
        }
      }
    }

    const srcIdx = out.blocks.findIndex(function (b) {
      return b.type === 'heading' && /المصادر|sources/i.test(b.text);
    });
    if (srcIdx >= 0) {
      const parts = [];
      for (let i = srcIdx + 1; i < out.blocks.length; i++) {
        if (out.blocks[i].type === 'heading' && out.blocks[i].level <= 2) break;
        parts.push(out.blocks[i].text);
      }
      out.sources_section = parts.join('\n');
    }

    return out;
  },

  isInternal(url, domains) {
    const list = domains || [];
    return list.some(function (d) { return d && url.indexOf(d) !== -1; });
  },

  isHomepageOnly(url) {
    try {
      const u = String(url).replace(/^https?:\/\//, '');
      const path = u.split('/').slice(1).join('/').replace(/[?#].*$/, '');
      return path.replace(/\/+$/, '') === '';
    } catch (e) { return false; }
  },

  /* ---------- 6. Boardroom state helpers ---------- */

  minute(state, entry) {
    state.minutes = state.minutes || [];
    state.minutes.push(Object.assign({
      seq: state.minutes.length + 1,
      round: state.round,
      at: new Date().toISOString()
    }, entry));
    return state;
  },

  ok(state) { return [{ json: { state: state } }]; },

  fail(state, stage, message) {
    state.errors = state.errors || [];
    state.errors.push({ stage: stage, message: message, round: state.round, at: new Date().toISOString() });
    return state;
  },

  clip(s, n) {
    const t = String(s == null ? '' : s);
    return t.length <= n ? t : t.slice(0, n) + '\n… [مُختصر]';
  },

  /** Render the shared context block every persona receives. */
  brandBlock(cfg) {
    const b = cfg.brand || {};
    return [
      '### هوية العميل',
      '- الاسم: ' + (b.name || '-'),
      '- سنة التأسيس: ' + (b.founded || '-'),
      '- الدولة: ' + (b.country || '-'),
      '- الأسواق المستهدفة: ' + ((b.markets || []).join('، ') || '-'),
      '- الخدمات: ' + ((b.services || []).join('، ') || '-'),
      '- نبرة الكتابة: ' + (b.tone || '-'),
      '- نقاط الإثبات المتاحة (Social Proof): ' + ((b.proof_points || []).join(' | ') || '-'),
      '- صيغ الـ CTA المسموحة: ' + ((b.cta_options || []).join(' | ') || '-')
    ].join('\n');
  },

  rulesBlock(cfg) {
    const r = cfg.rules || {};
    const lines = ['### القواعد الإلزامية القابلة للقياس (يفحصها المفتش الآلي)'];
    if (r.word_count)  lines.push('- طول النص النهائي: من ' + r.word_count.min + ' إلى ' + r.word_count.max + ' كلمة.');
    if (r.intro_words) lines.push('- المقدمة: من ' + r.intro_words.min + ' إلى ' + r.intro_words.max + ' كلمة.');
    if (r.paragraph_max_words) lines.push('- لا فقرة تتجاوز ' + r.paragraph_max_words + ' كلمة.');
    if (r.h2_answer_words) lines.push('- أول فقرة بعد كل H2 إجابة مباشرة من ' + r.h2_answer_words.min + ' إلى ' + r.h2_answer_words.max + ' كلمة.');
    if (r.meta_title_max_chars) lines.push('- Meta Title ≤ ' + r.meta_title_max_chars + ' حرفًا.');
    if (r.meta_description_max_chars) lines.push('- Meta Description ≤ ' + r.meta_description_max_chars + ' حرفًا.');
    if (r.min_faq) lines.push('- قسم FAQ يحتوي على ' + r.min_faq + ' أسئلة على الأقل بصيغة H3.');
    if (r.max_consecutive_paragraphs_without_list) lines.push('- لا تتجاوز ' + r.max_consecutive_paragraphs_without_list + ' فقرات متتالية دون قائمة أو جدول.');
    if (r.require_sources_section) lines.push('- قسم «المصادر المستخدمة» إلزامي عند وجود أي معلومة خارجية.');
    if (r.forbid_homepage_only_links) lines.push('- ممنوع الاستشهاد برابط الصفحة الرئيسية لأي موقع؛ الرابط المباشر للصفحة فقط.');
    if (r.banned_phrases && r.banned_phrases.length) lines.push('- عبارات ممنوعة تمامًا: ' + r.banned_phrases.map(function (p) { return '«' + p + '»'; }).join('، '));
    return lines.join('\n');
  }
};

/* ---------- 7. Profile resolution & shared prompt blocks ---------- */

H.deepMerge = function (base, patch) {
  if (patch === undefined) return base;   // لا تجاوز
  if (patch === null) return null;        // تجاوز صريح بالإلغاء (مثال: json_ld: null)
  if (Array.isArray(patch) || typeof patch !== 'object') return patch;
  const out = Object.assign({}, base && typeof base === 'object' && !Array.isArray(base) ? base : {});
  for (const k of Object.keys(patch)) out[k] = H.deepMerge(out[k], patch[k]);
  return out;
};

/** Resolve profile for this run: registry entry + per-run overrides from the brief. */
H.cfgOf = function (registry, state) {
  const base = registry[state.profile_id];
  if (!base) throw new Error('Unknown profile_id: ' + state.profile_id);
  return state.overrides ? H.deepMerge(base, state.overrides) : base;
};

H.persona = function (cfg, id) {
  const p = cfg.roster[id];
  if (!p) throw new Error('Unknown persona: ' + id + ' in profile ' + cfg.id);
  return p;
};

/** Chair-grade personas may run on a stronger model. */
H.llmFor = function (cfg, persona) {
  const llm = Object.assign({}, cfg.llm);
  if (persona.use_chair_model && cfg.llm.chair_model) llm.model = cfg.llm.chair_model;
  return llm;
};

H.callFor = function (cfg, personaId, userText, state, stage) {
  const p = H.persona(cfg, personaId);
  const llm = H.llmFor(cfg, p);
  return {
    json: {
      url: llm.url,
      provider: llm.provider || 'anthropic',
      anthropic_version: llm.anthropic_version || '2023-06-01',
      body: H.buildBody(p, userText, llm),
      meta: {
        persona_id: personaId,
        persona_name: p.name,
        persona_title: p.title,
        emoji: p.emoji || '🗣️',
        output_mode: p.output_mode || 'json',
        stage: stage
      },
      state: state
    }
  };
};

/** The shared briefing packet every persona sees. */
H.briefBlock = function (state, cfg) {
  const b = state.brief || {};
  const L = [];
  L.push('### ملف الطلب (مدخلات المستخدم — ملزمة)');
  L.push('- نوع المحتوى: ' + (cfg.content_kind || 'article'));
  L.push('- العنوان المطلوب: ' + (b.title || '(لم يُحدَّد — اقترحه)'));
  L.push('- الهدف من المحتوى: ' + (b.goal || '-'));
  L.push('- نوع المقال: ' + (b.article_type === 'commercial' ? 'تجاري (Commercial)' : b.article_type === 'informational' ? 'معلوماتي / تعليمي (Informational)' : '(غير محدد)'));
  L.push('- السوق المستهدف: ' + (b.target_market || (cfg.brand && cfg.brand.primary_market) || '-'));
  L.push('- الكلمة المفتاحية الرئيسية: «' + (b.primary_keyword || '-') + '»' + (b.primary_keyword_count ? ' — عدد مرات التكرار المطلوب: ' + b.primary_keyword_count : ''));
  if (b.secondary_keywords && b.secondary_keywords.length) L.push('- الكلمات المفتاحية الثانوية: ' + b.secondary_keywords.map(function (k) { return '«' + k + '»'; }).join('، '));
  if (b.semantic_keywords && b.semantic_keywords.length) L.push('- الكلمات المرتبطة دلاليًا: ' + b.semantic_keywords.join('، '));
  if (b.headings && b.headings.length) {
    L.push('- العناوين الداخلية التي أرسلها المستخدم (ملزمة، لا تُعاد صياغتها):');
    b.headings.forEach(function (h) { L.push('  * ' + h); });
  } else {
    L.push('- العناوين الداخلية: لم يرسلها المستخدم — يُسمح ببنائها.');
  }
  if (b.internal_links && b.internal_links.length) {
    L.push('- الروابط الداخلية المطلوبة (نص الأنكور حرفي):');
    b.internal_links.forEach(function (l) { L.push('  * [' + l.anchor + '](' + l.url + ')'); });
  }
  if (b.cluster_role) L.push('- دور المقال في العنقود: ' + b.cluster_role);
  if (b.pillar_url) L.push('- رابط المقالة الأساسية (Pillar): ' + b.pillar_url);
  if (b.mandatory_citations && b.mandatory_citations.length) {
    L.push('- استشهادات إلزامية أرسلها المستخدم (تُدرج كما هي في أنسب موضع):');
    b.mandatory_citations.forEach(function (c) { L.push('  * ' + c); });
  }
  if (b.platforms && b.platforms.length) L.push('- المنصات المطلوبة: ' + b.platforms.join('، '));
  if (b.post_count) L.push('- عدد البوستات المطلوب: ' + b.post_count);
  if (b.notes) L.push('- ملاحظات إضافية من المستخدم: ' + b.notes);
  return L.join('\n');
};

/** Compact evidence pack for writer-side personas. */
H.evidenceBlock = function (state) {
  const ev = (state.evidence && state.evidence.approved) || [];
  if (!ev.length) return '### حزمة الأدلة المعتمدة\n(لا توجد أدلة معتمدة — ممنوع ذكر أي رقم أو نسبة أو تاريخ داخل النص.)';
  const L = ['### حزمة الأدلة المعتمدة (المصدر الوحيد المسموح لأي رقم)'];
  ev.forEach(function (e, i) {
    L.push((i + 1) + ') [' + (e.id || 'E' + (i + 1)) + '] ' + (e.publisher || '') + ' — «' + (e.page_title || '') + '»');
    L.push('   الرابط: ' + (e.url || ''));
    L.push('   الرقم/المعلومة: ' + (e.figure || ''));
    L.push('   الصياغة العربية الجاهزة: ' + (e.arabic_sentence || ''));
    L.push('   القسم المقترح: ' + (e.section || '-'));
    L.push('   سطر المصادر: ' + (e.citation_line || ''));
  });
  const rm = (state.evidence && state.evidence.must_remove) || [];
  if (rm.length) L.push('\n**ممنوع ذكر هذه الادعاءات بأي رقم:** ' + rm.join(' | '));
  return L.join('\n');
};

H.outlineBlock = function (state) {
  const bp = state.blueprint || {};
  return '### المخطط المعتمد (Blueprint)\n```json\n' + H.clip(JSON.stringify(bp, null, 1), 9000) + '\n```';
};

H.articleBlock = function (state, label) {
  return '### ' + (label || 'النسخة الحالية من المحتوى') + '\n```markdown\n' + (state.article || '(فارغ)') + '\n```';
};

H.mechanicalBlock = function (state) {
  const m = state.mechanical || {};
  if (!m.checks) return '';
  const fails = (m.checks || []).filter(function (c) { return !c.pass; });
  const L = ['### تقرير المفتش الآلي (أرقام لا آراء — ملزمة)'];
  L.push('- الحالة: ' + (m.pass ? 'ناجح ✅' : 'راسب ❌ (' + fails.length + ' مخالفة)'));
  (m.checks || []).forEach(function (c) {
    L.push((c.pass ? '  ✅ ' : '  ❌ ') + c.id + ': ' + c.detail);
  });
  return L.join('\n');
};
