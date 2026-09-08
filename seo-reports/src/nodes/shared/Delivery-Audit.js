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

// ---- تشخيص: هل الرفض على أساس الدومين؟ ----
// لو كل اللي اترفض بره دومين المُرسِل وكل اللي اتقبل جواه، فدي مش مشكلة
// عنوان ولا مشكلة شبكة — دي **سياسة الناقل**: خدمة SMTP relay مضبوطة على
// "Only addresses in my domains". إعادة الإرسال على نفس السيرفر هتفشل بنفس
// الطريقة بالظبط، فمفيش أي فايدة من المحاولة.
const fromDomain = String(cfg.mailFromDomain || '').toLowerCase();
const domainOf = (e) => String(e).split('@')[1] || '';
const externalMissing = missing.filter(e => domainOf(e) !== fromDomain);
const internalMissing = missing.filter(e => domainOf(e) === fromDomain);
const acceptedExternal = accepted.filter(e => domainOf(e) !== fromDomain);

const relayBlocksExternal = knowsAccepted && !sendError &&
  externalMissing.length > 0 && internalMissing.length === 0 && acceptedExternal.length === 0;

// المستلمين اللي إعادة الإرسال ليها معنى معاهم: أي حد اترفض لسبب غير
// سياسة الدومين. لو السبب هو السياسة، مفيش إعادة إرسال — فيه تشخيص.
const retryable = relayBlocksExternal ? [] : missing;

const relayDiagnosis = relayBlocksExternal
  ? ('الناقل قبل كل المستلمين على دومين ' + fromDomain + ' ورفض كل اللي بره الدومين (' +
     externalMissing.join(', ') + '). ده مش خطأ في العناوين ولا في الأوتوميشن — ده إعداد ' +
     'خدمة SMTP relay مضبوط على «Only addresses in my domains». ' +
     'الحل: Google Admin console ← Apps ← Google Workspace ← Gmail ← Routing ← SMTP relay ' +
     'service ← غيّر Allowed recipients لـ «Any addresses». ' +
     'إعادة الإرسال على نفس السيرفر هتفشل بنفس الطريقة فمابنعملهاش.')
  : '';

const base = {
  expected,
  accepted,
  rejected,
  missing,
  externalMissing,
  relayBlocksExternal,
  relayDiagnosis,
  knowsAccepted,
  sendError,
  messageId: info.messageId || '',
  smtpResponse: sendError || String(info.response || '').slice(0, 300),
  envelopeFrom: (info.envelope && info.envelope.from) || '',
  subject: $('Build Email').first().json.subject,
};

if (!retryable.length) {
  return [{ json: Object.assign({ __resend: false, resendCount: 0 }, base) }];
}

return retryable.map((recipient, i) => ({ json: Object.assign({
  __resend: true,
  recipient,
  resendIndex: i,
  resendCount: retryable.length,
}, base) }));
