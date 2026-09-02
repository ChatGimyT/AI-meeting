/* =============================================================
 * AI Editorial Boardroom — Shared Helper Library  (H)
 * -------------------------------------------------------------
 * This block is injected automatically at the top of EVERY Code
 * node by build/build.mjs. Never paste it manually.
 * ============================================================= */
const H = {

  /* ---------- 1. LLM request building ---------- */

  buildBody(persona, userText, llm) {
    const model = persona.model || llm.model;
    let temperature = persona.temperature != null ? persona.temperature
                    : (llm.temperature != null ? llm.temperature : 0.4);
    /* بعض المزوّدين يفرضون سقفًا أدنى للحرارة أو يتجاهلونها */
    if (llm.temperature_scale) temperature = Math.min(2, +(temperature * llm.temperature_scale).toFixed(2));
    if (llm.max_temperature != null) temperature = Math.min(temperature, llm.max_temperature);

    /* سقف مخرجات المزوّد يقصّ أي طلب أكبر منه (DeepSeek = 8192) */
    let maxTokens = persona.max_tokens || llm.max_tokens || 8000;
    if (llm.max_output_tokens) maxTokens = Math.min(maxTokens, llm.max_output_tokens);

    const wantsJson = (persona.output_mode || 'json') === 'json';

    /* ---- المزوّدون المتوافقون مع OpenAI: openai · deepseek · openrouter · محلي ---- */
    if (llm.provider && llm.provider !== 'anthropic') {
      const body = {
        model,
        temperature,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: persona.system },
          { role: 'user',   content: userText }
        ]
      };
      /* وضع JSON الصارم يرفع موثوقية النماذج الأضعف بدرجة كبيرة */
      if (wantsJson && llm.json_mode !== false) body.response_format = { type: 'json_object' };
      if (llm.extra_body) Object.assign(body, llm.extra_body);
      return body;
    }

    /* ---- Anthropic Messages API ---- */
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

/* ---------- 8. Chunked (section-wise) workshop mode ---------- */

/** true if the provider cut the answer off at the token ceiling. */
H.truncated = function (resp, text) {
  if (resp) {
    if (resp.stop_reason === 'max_tokens') return true;
    if (resp.choices && resp.choices[0] && resp.choices[0].finish_reason === 'length') return true;
  }
  if (text && text.indexOf('<<<ARTICLE>>>') !== -1 && text.indexOf('<<<END_ARTICLE>>>') === -1) return true;
  return false;
};

H.grabSection = function (text) {
  if (!text) return '';
  const s = String(text);
  const m = s.match(/<<<SECTION>>>([\s\S]*?)<<<END_SECTION>>>/);
  if (m) return m[1].trim();
  const open = s.indexOf('<<<SECTION>>>');
  if (open >= 0) return s.slice(open + 13).trim();
  const fence = s.match(/```(?:markdown|md)?\s*([\s\S]*?)```/i);
  if (fence) return fence[1].trim();
  return s.trim();
};

/** Split an article into the head block plus one chunk per H2. */
H.splitSections = function (md) {
  const raw = String(md || '');
  const lines = raw.split('\n');
  const out = [];
  let cur = { key: '__front__', heading: '', lines: [] };
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) inFence = !inFence;
    const h2 = !inFence && line.match(/^\s{0,3}##\s+(?!#)(.*)$/);
    if (h2) {
      out.push(cur);
      cur = { key: '', heading: h2[1].trim(), lines: [line] };
    } else {
      cur.lines.push(line);
    }
  }
  out.push(cur);
  let n = 0;
  return out
    .map(function (sec) {
      const body = sec.lines.join('\n').trim();
      if (!sec.key) {
        if (/faq|الأسئلة\s*الشائعة/i.test(sec.heading)) sec.key = '__faq__';
        else if (/المصادر|sources/i.test(sec.heading)) sec.key = '__sources__';
        else sec.key = 's' + (++n);
      }
      return { key: sec.key, heading: sec.heading, md: body, words: H.words(body) };
    })
    .filter(function (sec, i) { return i === 0 ? sec.md.length > 0 : true; });
};

H.joinSections = function (sections) {
  return sections
    .filter(function (s) { return s && s.md && s.md.trim(); })
    .map(function (s) { return s.md.trim(); })
    .join('\n\n');
};

/** Build the writing plan: head block, one chunk per outline H2, FAQ, sources. */
H.sectionPlan = function (state, cfg) {
  const R = cfg.rules || {};
  const outline = (state.blueprint && state.blueprint.outline) || [];
  const heads = outline.filter(function (o) { return !o.level || o.level === 2; });
  const total = (R.word_count && R.word_count.max) ? Math.round((R.word_count.min + R.word_count.max) / 2) : 1900;

  const frontWords = (R.intro_words && R.intro_words.max) || 100;
  const faqWords = 40 * ((R.min_faq || 5) + 1);
  let bodyBudget = Math.max(400, total - frontWords - faqWords);
  const declared = heads.reduce(function (n, h) { return n + (Number(h.word_budget) || 0); }, 0);

  const plan = [{
    key: '__front__', order: 0, heading: '(الترويسة + H1 + المقدمة)',
    purpose: 'ترويسة الميتا ثم H1 ثم مقدمة تبدأ بإجابة مباشرة',
    word_budget: frontWords, format: 'paragraph', must_include: []
  }];

  heads.forEach(function (h, i) {
    const share = declared > 0 ? (Number(h.word_budget) || 0) / declared : 1 / Math.max(1, heads.length);
    plan.push({
      key: 's' + (i + 1), order: i + 1,
      heading: h.heading || ('قسم ' + (i + 1)),
      purpose: h.purpose || '',
      word_budget: Math.max(120, Math.round(bodyBudget * share)),
      format: h.format || 'paragraph',
      must_include: h.must_include || [],
      source_needed: !!h.source_needed
    });
  });

  plan.push({
    key: '__faq__', order: plan.length,
    heading: 'الأسئلة الشائعة (FAQ)',
    purpose: 'أسئلة حقيقية يسألها الباحث بإجابات مباشرة قصيرة صالحة لـ FAQ Schema',
    word_budget: faqWords, format: 'faq',
    must_include: (state.blueprint && state.blueprint.faq_questions) || []
  });

  if (R.auto_sources_section !== false) {
    plan.push({ key: '__sources__', order: plan.length, heading: 'المصادر المستخدمة',
                purpose: 'تُبنى آليًا من الأدلة المستشهد بها فعليًا', word_budget: 0, format: 'auto', must_include: [] });
  }

  /* حصة الكلمة المفتاحية لكل قسم — لأن كاتب القسم لا يرى بقية المقال */
  const wantKw = state.brief.primary_keyword_count || 0;
  if (wantKw > 0) {
    const body = plan.filter(function (p) { return p.key !== '__faq__' && p.key !== '__sources__'; });
    let left = wantKw;
    body.forEach(function (p, i) {
      const q = Math.max(1, Math.round(left / (body.length - i)));
      p.keyword_quota = Math.min(q, left);
      left -= p.keyword_quota;
    });
  }
  plan.forEach(function (p) { if (p.keyword_quota == null) p.keyword_quota = 0; });
  return plan;
};

/** Rebuild the sources block from evidence that is actually cited in the body. */
H.buildSourcesSection = function (state) {
  const body = state.article || '';
  const used = (state.evidence.approved || []).filter(function (e) {
    return e.url && body.indexOf(String(e.url).replace(/\/+$/, '')) !== -1;
  });
  if (!used.length) return '';
  const L = ['## المصادر المستخدمة', ''];
  used.forEach(function (e) {
    L.push('- ' + (e.citation_line ||
      ((e.publisher || '') + ' — «' + (e.page_title || '') + '»: ' + e.url +
       ' — المعلومة المستخدمة: ' + (e.figure || ''))));
  });
  return L.join('\n');
};

/** Per-section word table — makes length control concrete instead of vague. */
H.sectionTable = function (state) {
  const secs = H.splitSections(state.article || '');
  if (!secs.length) return '';
  const L = ['### توزيع الكلمات الحالي على الأقسام', '', '| القسم | الكلمات |', '|---|---|'];
  secs.forEach(function (s) {
    L.push('| ' + (s.heading || '(الترويسة والمقدمة)').replace(/\|/g, '/') + ' | ' + s.words + ' |');
  });
  L.push('| **الإجمالي** | **' + H.words(state.article) + '** |');
  return L.join('\n');
};

/** Section-wise mode is on when the profile asks for it. */
H.chunked = function (cfg) { return !!(cfg.llm && cfg.llm.chunked_writing); };

/** Read one fan-out response per section and merge it into state.sections. */
H.collectSections = function (calls, responses) {
  const parts = [];
  calls.forEach(function (c, i) {
    const meta = (c.json && c.json.meta) || {};
    const raw  = responses[i] ? responses[i].json : null;
    const text = H.readText(raw);
    parts.push({
      key: meta.section_key,
      order: meta.order,
      heading: meta.section_heading || '',
      md: H.grabSection(text),
      err: H.apiError(raw),
      truncated: H.truncated(raw, text)
    });
  });
  parts.sort(function (a, b) { return a.order - b.order; });
  return parts;
};

/**
 * Merge freshly written sections into the state.
 * A failed or suspiciously short section keeps its previous text instead of
 * silently shrinking the article.
 */
H.applySections = function (state, parts, cfg, opts) {
  const o = opts || {};
  const prev = {};
  (state.sections || []).forEach(function (s) { prev[s.key] = s; });
  const kept = [], failed = [];

  parts.forEach(function (p) {
    const old = prev[p.key];
    const oldWords = old ? H.words(old.md) : 0;
    const newWords = H.words(p.md);
    const tooShort = o.floor && oldWords > 0 && newWords < oldWords * o.floor;
    if (p.err || !p.md || tooShort) {
      failed.push(p.key + (p.err ? ' (' + p.err + ')' : tooShort ? ' (انكمش من ' + oldWords + ' إلى ' + newWords + ' كلمة)' : ' (فارغ)'));
      if (old) kept.push(old);
      else kept.push({ key: p.key, heading: p.heading, md: '## ' + (p.heading || p.key) + '\n\n(تعذّر إنتاج هذا القسم)' });
    } else {
      kept.push({ key: p.key, heading: p.heading || (old && old.heading) || '', md: p.md });
    }
  });

  /* أقسام لم تُطلب في هذه التمريرة تبقى كما هي */
  (state.sections || []).forEach(function (s) {
    if (!kept.some(function (k) { return k.key === s.key; })) kept.push(s);
  });

  const orderOf = {};
  (state.section_plan || []).forEach(function (p) { orderOf[p.key] = p.order; });
  kept.sort(function (a, b) {
    const oa = orderOf[a.key] != null ? orderOf[a.key] : 999;
    const ob = orderOf[b.key] != null ? orderOf[b.key] : 999;
    return oa - ob;
  });

  state.sections = kept.filter(function (s) { return s.key !== '__sources__'; });
  state.article = H.joinSections(state.sections);

  if (!cfg.rules || cfg.rules.auto_sources_section !== false) {
    const src = H.buildSourcesSection(state);
    if (src) {
      state.sections = state.sections.concat([{ key: '__sources__', heading: 'المصادر المستخدمة', md: src }]);
      state.article = H.joinSections(state.sections);
    }
  }
  return { failed: failed, truncated: parts.filter(function (p) { return p.truncated; }).map(function (p) { return p.key; }) };
};

/** Context a section-writer needs: what comes right before and right after. */
H.neighbourBlock = function (state, key) {
  const secs = state.sections || [];
  const i = secs.findIndex(function (s) { return s.key === key; });
  if (i < 0) return '';
  const tail = i > 0 ? H.clip(secs[i - 1].md.split('\n').slice(-6).join('\n'), 700) : '(هذا أول قسم)';
  const head = i < secs.length - 1 ? H.clip(secs[i + 1].md.split('\n').slice(0, 6).join('\n'), 700) : '(هذا آخر قسم)';
  return ['### نهاية القسم السابق (للانتقال فقط — لا تعد كتابته)', tail, '',
          '### بداية القسم التالي (للانتقال فقط — لا تعد كتابته)', head].join('\n');
};

H.SECTION_SHAPE = `
### شكل المخرجات
أعد **هذا القسم وحده** بصيغة Markdown محصورًا حرفيًا بين العلامتين، ولا تكتب أي شيء خارجهما،
ولا تكتب أقسامًا أخرى، ولا تكرر عنوان قسم سابق أو لاحق:

<<<SECTION>>>
## عنوان القسم كما هو محدد
... محتوى القسم ...
<<<END_SECTION>>>
`;

/**
 * Per-section numeric targets.
 * In section-wise mode no writer sees the whole article, so nobody owns the
 * global word count or keyword count. This turns the global target into a
 * concrete per-section instruction ("you are at 180 words, land on 240").
 */
H.sectionTargets = function (state, cfg) {
  const R = cfg.rules || {};
  const secs = (state.sections || []).filter(function (s) { return s.key !== '__sources__'; });
  if (!secs.length) return {};

  const kw = state.brief.primary_keyword || '';
  const cur = secs.map(function (s) {
    return { key: s.key, words: H.words(s.md), kw: kw ? H.countPhrase(s.md, kw) : 0 };
  });
  const totalWords = cur.reduce(function (n, s) { return n + s.words; }, 0);
  const totalKw = cur.reduce(function (n, s) { return n + s.kw; }, 0);

  /* الهدف الإجمالي = منتصف النطاق المطلوب */
  const wantWords = R.word_count ? Math.round((R.word_count.min + R.word_count.max) / 2) : totalWords;
  const wantKw = state.brief.primary_keyword_count || 0;

  /* أقسام قابلة للتمدد: لا الترويسة (مقيّدة بطول المقدمة) ولا FAQ */
  const flex = cur.filter(function (s) { return s.key !== '__front__' && s.key !== '__faq__'; });
  const flexWords = flex.reduce(function (n, s) { return n + s.words; }, 0) || 1;
  const deltaWords = wantWords - totalWords;

  const out = {};
  cur.forEach(function (s) {
    const isFlex = s.key !== '__front__' && s.key !== '__faq__';
    const share = isFlex ? s.words / flexWords : 0;
    const target = Math.max(60, Math.round(s.words + deltaWords * share));
    out[s.key] = {
      current_words: s.words,
      target_words: isFlex ? target : s.words,
      current_kw: s.kw,
      target_kw: 0,
      total_words: totalWords,
      want_words: wantWords,
      total_kw: totalKw,
      want_kw: wantKw
    };
  });

  /* حصة الكلمة المفتاحية: الترويسة تأخذ واحدة، والباقي يوزَّع على أقسام المحتوى */
  if (wantKw > 0 && kw) {
    let left = wantKw;
    if (out.__front__) { out.__front__.target_kw = Math.min(2, left); left -= out.__front__.target_kw; }
    const bodyKeys = flex.map(function (s) { return s.key; });
    bodyKeys.forEach(function (k, i) {
      const remainingSlots = bodyKeys.length - i;
      const q = Math.max(0, Math.round(left / remainingSlots));
      out[k].target_kw = q;
      left -= q;
    });
    if (out.__faq__) out.__faq__.target_kw = 0;
  }
  return out;
};

/** One line the section writer can act on without seeing the rest of the article. */
H.targetLine = function (t, kw) {
  if (!t) return '';
  const L = [];
  const dw = t.target_words - t.current_words;
  L.push('- طول قسمك: **' + t.current_words + '** كلمة → المطلوب **' + t.target_words + '** كلمة (±10%)' +
         (Math.abs(dw) >= 15 ? (dw > 0 ? '  ⇒ **أضف ~' + dw + ' كلمة من محتوى حقيقي، لا حشو**' : '  ⇒ **احذف ~' + Math.abs(dw) + ' كلمة من الحشو**') : '  ⇒ الطول مناسب'));
  if (kw && t.want_kw) {
    const dk = t.target_kw - t.current_kw;
    L.push('- تكرار «' + kw + '» في قسمك: **' + t.current_kw + '** → المطلوب **' + t.target_kw + '**' +
           (dk > 0 ? '  ⇒ أضفها ' + dk + ' مرة بصياغتها الحرفية وبطبيعية' : dk < 0 ? '  ⇒ استبدل ' + Math.abs(dk) + ' منها بمرادف دلالي' : '  ⇒ مضبوط'));
  }
  L.push('- (للسياق: إجمالي المقال الآن ' + t.total_words + ' كلمة والمطلوب ' + t.want_words +
         (t.want_kw ? ' | إجمالي تكرار الكلمة ' + t.total_kw + ' والمطلوب ' + t.want_kw : '') + ')');
  return L.join('\n');
};

/**
 * What must survive an edit of this section, spelled out.
 * A section editor told to cut 130 words will otherwise delete the paragraph
 * that happened to carry an internal link or a citation.
 */
H.protectedBlock = function (md) {
  const links = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let m;
  while ((m = re.exec(String(md || ''))) !== null) links.push('[' + m[1] + '](' + m[2] + ')');
  const heading = (String(md || '').match(/^\s{0,3}#{1,3}\s+(.*)$/m) || [])[1];
  const L = ['### عناصر لا يجوز حذفها أو تغييرها في هذا القسم'];
  if (heading) L.push('- نص العنوان: «' + heading + '»');
  if (links.length) links.forEach(function (l) { L.push('- الرابط كما هو: ' + l); });
  else L.push('- (لا روابط في هذا القسم — ولا تُضِف روابط جديدة)');
  L.push('- أي رقم أو نسبة موجودة والمصدر المرافق لها');
  return L.join('\n');
};
