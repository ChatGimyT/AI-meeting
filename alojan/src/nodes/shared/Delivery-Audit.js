// بيقرأ رد سيرفر الـ SMTP الحقيقي بعد إرسال التقرير.
//
// المشكلة اللي بيحلها: نود Send Email بيعتبر الإرسال ناجح طالما السيرفر
// استلم الرسالة، حتى لو رفض بعض المستلمين (وده اللي بيحصل مع إيميلات جيميل
// لما السيرفر مش مسموح له يوصّل بره الدومين). فالرن بيبان أخضر والإيميل
// مش واصل. هنا بنقارن المستلمين المتوقعين بالمستلمين اللي السيرفر قبلهم
// فعلاً، وأي حد اترفض بنبعتله رسالة منفصلة وبنسجّل السبب.
const cfg  = $('Config').first().json;
const info = $input.first() ? ($input.first().json || {}) : {};

const norm = e => String(e || '').trim().toLowerCase();
const addrOf = (e) => {
  const s = String(e || '');
  const m = s.match(/<([^>]+)>/);
  return norm(m ? m[1] : s);
};

const expected = (cfg.mailAllList || []).map(norm).filter(Boolean);

const accepted = []
  .concat(Array.isArray(info.accepted) ? info.accepted : [])
  .map(addrOf).filter(Boolean);
const rejected = []
  .concat(Array.isArray(info.rejected) ? info.rejected : [])
  .concat(Array.isArray(info.pending)  ? info.pending  : [])
  .map(addrOf).filter(Boolean);

// الإرسال نفسه وقع (نود Send Report Email شغّال بـ continueRegularOutput):
// كل المستلمين محتاجين إعادة إرسال فردي، ولازم يوصل تنبيه.
const sendError = (info.error !== undefined && info.error !== null)
  ? (typeof info.error === 'string' ? info.error : (info.error.message || JSON.stringify(info.error))).slice(0, 300)
  : '';

// لو السيرفر مرجّعش قائمة accepted أصلاً مانفترضش الأسوأ ومانبعتش مرتين.
const knowsAccepted = accepted.length > 0 || rejected.length > 0;

const missing = sendError
  ? expected.slice()
  : (knowsAccepted ? expected.filter(e => accepted.indexOf(e) === -1) : []);

const base = {
  expected,
  accepted,
  rejected,
  missing,
  knowsAccepted,
  sendError,
  messageId: info.messageId || '',
  smtpResponse: sendError || String(info.response || '').slice(0, 300),
  envelopeFrom: (info.envelope && info.envelope.from) || '',
  subject: $('Build Email').first().json.subject,
};

if (!missing.length) {
  return [{ json: Object.assign({ __resend: false, resendCount: 0 }, base) }];
}

return missing.map((recipient, i) => ({ json: Object.assign({
  __resend: true,
  recipient,
  resendIndex: i,
  resendCount: missing.length,
}, base) }));
