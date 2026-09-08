/* ── 29. تجهيز بريد التسليم ───────────────────────────────────────
 * قاعدة العناوين هنا: **لا وجود لقائمة دومينات مسموحة افتراضيًا.**
 * أي عنوان بريد صحيح يُرسَل إليه — على دومين العميل أو Gmail أو غيرهما —
 * وكل عنوان يُستبعد يُسجَّل مع سبب استبعاده حرفيًا، فلا يختفي أحد بصمت.
 *
 * ولا يغادر التقرير هذه العقدة إلا بإذن بوابة الأرقام: إن كانت محجوزة
 * يُرسَل إشعار حجز يشرح الخلل، ولا تُرسَل الأرقام المشكوك فيها إطلاقًا.
 * ─────────────────────────────────────────────────────────────── */

/* حزمة التسليم قد لا تكون موجودة (طلب مرفوض عند المدخل) */
let pack = null, s = null, cfg = null;
try { pack = $('🧮 Numbers: Verdict').first().json; } catch (e) { pack = null; }
try {
  const REG = $('📚 Profiles Registry').first().json.profiles;
  s = $('🗓️ Agenda: Final Audit').first().json.state;
  cfg = H.cfgOf(REG, s);
} catch (e) { s = null; cfg = null; }

const rowIn = $input.first().json || {};
const E = ((cfg && cfg.delivery && cfg.delivery.email) || {});

/* ══════════ 1) قراءة العناوين من كل مصادرها ══════════ */
const splitAddrs = function (v) {
  if (v == null || v === '') return [];
  const list = Array.isArray(v) ? v : String(v).split(/[\n,،;؛|]+/);
  return list.map(function (x) { return String(x).trim(); }).filter(Boolean);
};

const brief = (s && s.brief) || {};
const rawTo  = splitAddrs(E.to).concat(splitAddrs(brief.recipients));
const rawCc  = splitAddrs(E.cc).concat(splitAddrs(brief.recipients_cc));
const rawBcc = splitAddrs(E.bcc).concat(splitAddrs(brief.recipients_bcc));

/* ══════════ 2) التطبيع والتحقق ══════════
 * لا تُخفَّض حالة أحرف الجزء المحلي (بعض الخوادم تفرّق بينها)،
 * ويُخفَّض الدومين وحده لأن الدومينات غير حساسة لحالة الأحرف. */
const ADDR_RE = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[A-Za-z0-9ء-ي](?:[A-Za-z0-9ء-ي-]{0,61}[A-Za-z0-9ء-ي])?\.)+[A-Za-zء-ي]{2,63}$/;

const dropped = [];
const parseOne = function (entry, bucket) {
  const original = String(entry).trim();
  /* صيغة «الاسم <العنوان>» */
  const angled = original.match(/<\s*([^<>]+?)\s*>/);
  let addr = (angled ? angled[1] : original).trim()
    .replace(/^mailto:/i, '')
    .replace(/^[\s"'<]+|[\s"'>,.;]+$/g, '');
  if (!addr) { dropped.push({ input: original, bucket: bucket, reason: 'قيمة فارغة' }); return null; }
  const at = addr.lastIndexOf('@');
  if (at <= 0) { dropped.push({ input: original, bucket: bucket, reason: 'لا يحتوي على @ بصيغة صحيحة' }); return null; }
  const local = addr.slice(0, at);
  const domain = addr.slice(at + 1).toLowerCase();
  addr = local + '@' + domain;
  if (!ADDR_RE.test(addr)) { dropped.push({ input: original, bucket: bucket, reason: 'صيغة العنوان غير صالحة' }); return null; }
  if (addr.length > 254) { dropped.push({ input: original, bucket: bucket, reason: 'العنوان أطول من الحد المسموح' }); return null; }

  /* القوائم فارغة افتراضيًا: لا حجب ولا سماح مشروط — هذا هو المقصود. */
  const allow = (E.allow_domains || []).map(function (d) { return String(d).toLowerCase(); });
  const block = (E.block_domains || []).map(function (d) { return String(d).toLowerCase(); });
  if (block.length && block.indexOf(domain) !== -1) {
    dropped.push({ input: original, bucket: bucket, reason: 'الدومين ' + domain + ' مدرج في block_domains' });
    return null;
  }
  if (allow.length && allow.indexOf(domain) === -1) {
    dropped.push({ input: original, bucket: bucket, reason: 'الدومين ' + domain + ' غير مدرج في allow_domains (القائمة مفعّلة يدويًا)' });
    return null;
  }

  /* مفتاح إزالة التكرار فقط — لا يُرسَل إليه أبدًا.
     Gmail يتجاهل النقاط ووسم +tag ويعامل googlemail كـ gmail. */
  const isGoogle = domain === 'gmail.com' || domain === 'googlemail.com';
  const key = isGoogle
    ? local.toLowerCase().split('+')[0].replace(/\./g, '') + '@gmail.com'
    : local + '@' + domain;
  return { address: addr, domain: domain, key: key, display: original };
};

const collect = function (list, bucket) {
  const out = [], seen = {};
  list.forEach(function (entry) {
    const p = parseOne(entry, bucket);
    if (!p) return;
    if (seen[p.key]) { dropped.push({ input: p.address, bucket: bucket, reason: 'مكرر — أُرسل مرة واحدة' }); return; }
    seen[p.key] = true;
    out.push(p);
  });
  return out;
};

let to  = collect(rawTo, 'to');
const toKeys = {};
to.forEach(function (p) { toKeys[p.key] = true; });
let cc  = collect(rawCc, 'cc').filter(function (p) { return !toKeys[p.key]; });
const ccKeys = Object.assign({}, toKeys);
cc.forEach(function (p) { ccKeys[p.key] = true; });
let bcc = collect(rawBcc, 'bcc').filter(function (p) { return !ccKeys[p.key]; });

const maxTo = E.max_recipients || 25;
if (to.length > maxTo) {
  to.slice(maxTo).forEach(function (p) {
    dropped.push({ input: p.address, bucket: 'to', reason: 'تجاوز حد max_recipients (' + maxTo + ')' });
  });
  to = to.slice(0, maxTo);
}

const addrs = function (l) { return l.map(function (p) { return p.address; }); };
const domainsOf = function (l) {
  const d = {};
  l.forEach(function (p) { d[p.domain] = (d[p.domain] || 0) + 1; });
  return d;
};

/* ══════════ 3) قرار الإرسال ══════════ */
const NUM = (pack && pack.numbers) || null;
const numbersClear = !NUM || NUM.can_send !== false;
const held = !numbersClear;
const sendWhen = E.send_when || 'always';

const reasonsNotSending = [];
if (E.enabled === false) reasonsNotSending.push('الإرسال بالبريد معطّل في الملف التعريفي (delivery.email.enabled = false).');
if (!to.length) reasonsNotSending.push('لا يوجد أي مستلم صالح — املأ عمود «مستلمو التقرير» في الشيت أو delivery.email.to في الملف التعريفي.');
if (held && sendWhen === 'clear_only') reasonsNotSending.push('بوابة الأرقام محجوزة وسياسة الإرسال clear_only.');
if (!pack) reasonsNotSending.push('لم تُنتج هذه التشغيلة حزمة تسليم (طلب مرفوض عند المدخل).');

const willSend = reasonsNotSending.length === 0;
const mode = held ? 'hold_notice' : 'report';

/* ══════════ 4) بناء الرسالة ══════════ */
const esc = function (t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};
const meta = (pack && pack.meta) || {};
const title = meta.h1 || meta.title || brief.title || '(بلا عنوان)';
const prefix = E.subject_prefix || '[ورشة المحتوى]';
const statusTag = held ? '🔴 محجوز — مراجعة أرقام'
                : (pack && pack.ready_to_publish) ? '✅ جاهز للنشر'
                : '🟡 سُلّم مع تحفّظات';
const subject = prefix + ' ' + statusTag + ' — ' + title;

const kv = [];
if (pack) {
  kv.push(['الحالة', statusTag]);
  kv.push(['رقم التشغيل', pack.run_id]);
  kv.push(['الملف التعريفي', pack.profile]);
  kv.push(['عدد الكلمات', meta.word_count]);
  kv.push(['الدورات المستهلكة', pack.rounds_used]);
  kv.push(['المصادر المعتمدة', (pack.sources || []).length]);
  if (NUM) {
    kv.push(['أرقام فُحصت', NUM.scanned]);
    kv.push(['أرقام تحتاج عهدة', NUM.audited]);
    kv.push(['موثّقة بمصدرها', NUM.verified + ' (' + NUM.coverage_pct + '%)']);
    kv.push(['مخالفات رقمية حرجة', NUM.high]);
    kv.push(['ملاحظات رقمية', NUM.medium + ' متوسطة · ' + NUM.low + ' خفيفة']);
  }
  if (pack.final_scores && pack.final_scores.overall_score != null) {
    kv.push(['الدرجة النهائية', pack.final_scores.overall_score + '/10']);
  }
}

const rowsHtml = kv.map(function (r) {
  return '<tr><td style="padding:6px 10px;border:1px solid #e2e5ea;background:#fafbfc">' + esc(r[0]) +
         '</td><td style="padding:6px 10px;border:1px solid #e2e5ea"><b>' + esc(r[1]) + '</b></td></tr>';
}).join('');

const blockList = held
  ? '<h3 style="color:#b3261e">لماذا حُجز التقرير؟</h3><ul>' +
    (NUM.block_reasons || []).map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '</ul>'
  : '';

const findingsHtml = (NUM && (NUM.findings || []).length)
  ? '<h3>ملاحظات الأرقام</h3><table style="border-collapse:collapse;font-size:13px" dir="rtl">' +
    '<tr><th style="padding:6px 10px;border:1px solid #e2e5ea">الدرجة</th>' +
    '<th style="padding:6px 10px;border:1px solid #e2e5ea">الرقم</th>' +
    '<th style="padding:6px 10px;border:1px solid #e2e5ea">السطر</th>' +
    '<th style="padding:6px 10px;border:1px solid #e2e5ea">البيان</th></tr>' +
    NUM.findings.slice(0, 25).map(function (f) {
      const tag = { high: '🔴', medium: '🟡', low: '⚪' }[f.severity] || '';
      return '<tr><td style="padding:6px 10px;border:1px solid #e2e5ea">' + tag + '</td>' +
             '<td style="padding:6px 10px;border:1px solid #e2e5ea">' + esc(f.raw) + '</td>' +
             '<td style="padding:6px 10px;border:1px solid #e2e5ea">' + esc(f.line) + '</td>' +
             '<td style="padding:6px 10px;border:1px solid #e2e5ea">' + esc(f.message) + '</td></tr>';
    }).join('') + '</table>'
  : '';

const articleHtml = (!held && E.attach_article !== false && pack)
  ? '<h3>المقال</h3><pre style="white-space:pre-wrap;font-family:inherit;background:#fafbfc;padding:14px;border:1px solid #e2e5ea;border-radius:6px">' +
    esc(pack.article_markdown) + '</pre>'
  : (held ? '<p style="color:#b3261e"><b>لم يُرفق المقال عمدًا: أرقامه لم تجتز بوابة المراجعة.</b></p>' : '');

const html = [
  '<div dir="rtl" style="font-family:system-ui,Segoe UI,Tahoma,Arial,sans-serif;font-size:14px;line-height:1.8;color:#1b1f24;max-width:820px">',
  '<h2 style="margin:0 0 4px">' + esc(title) + '</h2>',
  '<p style="margin:0 0 16px;color:#5a636e">' + esc(statusTag) + ' · ' + esc(pack ? pack.run_id : '-') + '</p>',
  blockList,
  '<table style="border-collapse:collapse;font-size:13px" dir="rtl">' + rowsHtml + '</table>',
  findingsHtml,
  articleHtml,
  '<hr style="border:0;border-top:1px solid #e2e5ea;margin:24px 0">',
  '<p style="color:#5a636e;font-size:12px">أُرسلت آليًا من محرك ورشة المحتوى بعد اجتياز بوابة مراجعة الأرقام.</p>',
  '</div>'
].join('\n');

const text = [
  title, statusTag, ''
].concat(kv.map(function (r) { return r[0] + ': ' + r[1]; }))
 .concat(held ? [''].concat((NUM.block_reasons || []).map(function (b) { return '- ' + b; })) : [])
 .join('\n');

/* ══════════ 5) المخرجات ══════════ */
const out = {
  row_number: rowIn.row_number != null ? rowIn.row_number : null,
  send: willSend,
  mode: mode,
  transport: (E.transport === 'smtp') ? 'smtp' : 'gmail',
  use_gmail: (E.transport !== 'smtp'),
  to: addrs(to).join(', '),
  cc: addrs(cc).join(', '),
  bcc: addrs(bcc).join(', '),
  to_list: addrs(to),
  from_name: E.from_name || ((cfg && cfg.brand && cfg.brand.name) || 'ورشة المحتوى'),
  from_email: E.from_email || '',
  subject: subject,
  html: html,
  text: text,
  recipients_resolved: to.length + cc.length + bcc.length,
  recipient_domains: Object.assign({}, domainsOf(to), domainsOf(cc), domainsOf(bcc)),
  dropped_recipients: dropped,
  not_sending_because: reasonsNotSending,
  numbers_verdict: NUM ? NUM.verdict : 'n/a',
  run_id: pack ? pack.run_id : ''
};

if (s) {
  H.minute(s, {
    stage: 'delivery_prep', actor: '📧 تجهيز بريد التسليم',
    headline: willSend
      ? ('سيُرسل ' + (mode === 'hold_notice' ? 'إشعار حجز' : 'التقرير') + ' إلى ' + to.length + ' مستلمًا عبر ' + out.transport)
      : 'لن يُرسل بريد',
    detail: (willSend
      ? 'الدومينات: ' + Object.keys(out.recipient_domains).join('، ')
      : reasonsNotSending.join(' | ')) +
      (dropped.length ? ' || عناوين مستبعدة: ' + dropped.map(function (d) { return d.input + ' (' + d.reason + ')'; }).join('، ') : '')
  });
}

return [{ json: out }];
