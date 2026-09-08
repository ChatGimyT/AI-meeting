/* ── 30. سجل التسليم ──────────────────────────────────────────────
 * يقرأ نتيجة عقدة الإرسال الفعلية (أو غيابها) ويثبّتها في حزمة التسليم
 * وفي الشيت، حتى يكون سؤال «هل وصل التقرير ولمن؟» له جواب مكتوب دائمًا.
 * ─────────────────────────────────────────────────────────────── */
let prep = null;
try { prep = $('📧 Build Email').first().json; } catch (e) { prep = null; }

let pack = null;
try { pack = $('🧮 Numbers: Verdict').first().json; } catch (e) { pack = null; }

const incoming = $input.first().json || {};
/* عقدة الإرسال تُعيد رد المزوّد؛ عقدة التخطي تمرّر عنصر التجهيز نفسه */
const attempted = !!(prep && prep.send);
const isPrepEcho = incoming && incoming.subject !== undefined && incoming.send !== undefined;
const providerResponse = attempted && !isPrepEcho ? incoming : null;

const errText = providerResponse
  ? (providerResponse.error
      ? String(providerResponse.error.message || providerResponse.error)
      : (providerResponse.message && !providerResponse.id && !providerResponse.messageId && !providerResponse.accepted
          ? String(providerResponse.message) : null))
  : null;

const messageId = providerResponse
  ? (providerResponse.id || providerResponse.messageId || providerResponse.threadId || '')
  : '';

const delivery = {
  attempted: attempted,
  sent: attempted && !errText,
  transport: prep ? prep.transport : 'none',
  mode: prep ? prep.mode : 'none',
  to: prep ? prep.to_list || [] : [],
  cc: prep ? prep.cc : '',
  recipients_count: prep ? prep.recipients_resolved : 0,
  recipient_domains: prep ? prep.recipient_domains : {},
  dropped_recipients: prep ? prep.dropped_recipients : [],
  not_sending_because: prep ? prep.not_sending_because : ['لم تُجهَّز رسالة'],
  message_id: messageId,
  error: errText,
  at: new Date().toISOString()
};

/* صف الشيت: عمود واحد يجيب عن «هل وصل ولمن ولماذا لا» */
const summary = delivery.sent
  ? '✅ أُرسل إلى ' + delivery.to.length + ' مستلمًا (' + Object.keys(delivery.recipient_domains || {}).join('، ') + ')' +
    (delivery.mode === 'hold_notice' ? ' — إشعار حجز لا التقرير' : '')
  : delivery.attempted
    ? '❌ فشل الإرسال: ' + delivery.error
    : '⏸️ لم يُرسل: ' + (delivery.not_sending_because || []).join(' | ');

/* صف الشيت جاهز من عقدة المقارنة — نضيف عليه عمود الإرسال فقط */
let row = null;
try { row = Object.assign({}, $('📐 Compare vs Reference').first().json); } catch (e) { row = null; }

if (!row) {
  /* لا صف (تشغيلة بلا شيت): نُخرج الحزمة نفسها للـ webhook */
  const out = Object.assign({}, pack || {});
  out.delivery = delivery;
  out.delivery_summary = summary;
  if (prep && prep.row_number != null) out.row_number = prep.row_number;
  return [{ json: out }];
}

/* __SHEET__ */
row[SHEET.out.delivery] = summary;
if (prep && prep.row_number != null) row.row_number = prep.row_number;

/* الحالة في الشيت تعكس الحجز الرقمي، لا حكم المجلس وحده */
if (pack && pack.numbers && pack.numbers.can_send === false) {
  row[SHEET.out.status] = '🔴 محجوز — مراجعة أرقام';
}

return [{ json: row, pairedItem: 0 }];
