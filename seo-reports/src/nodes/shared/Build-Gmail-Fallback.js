// مسار بديل للإرسال: Gmail API بدل SMTP.
//
// ليه موجود: لما خدمة SMTP relay تكون مضبوطة على "Only addresses in my
// domains" بترفض كل مستلم خارجي، وإعادة المحاولة على نفس السيرفر بتفشل
// بنفس الطريقة. Gmail API بيبعت من صندوق الحساب المربوط مباشرة ومابيعديش
// على خدمة الترحيل أصلًا، فالقيد ده مالوش وجود عنده.
//
// بيستخدم نفس كريدنشيال جوجل المربوط بـ Search Console و Sheets — محتاج بس
// إضافة صلاحية gmail.send عليه، مش كريدنشيال جديد.
const cfg   = $('Config').first().json;
const audit = $('Delivery Audit').first().json || {};
const mail  = $('Build Email').first().json || {};

const targets = (audit.externalMissing || []).length
  ? audit.externalMissing
  : (audit.missing || []);

if (!cfg.gmailFallback || !targets.length) {
  return [{ json: { __gmailSend: false, gmailTargets: [], gmailSkipReason:
    !cfg.gmailFallback ? 'المسار البديل مقفول في Config (MAIL_GMAIL_FALLBACK)' : 'مفيش مستلم محتاج إرسال بديل' } }];
}

/* ---- بناء رسالة RFC822 ---- */
// العناوين اللي فيها حروف عربية لازم تتشفّر (RFC 2047)، وإلا السيرفر بيرفض
// الرسالة أو بيطلّع رموز مكسورة عند المستلم.
const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');
const encHeader = (s) => /^[\x20-\x7E]*$/.test(String(s))
  ? String(s)
  : '=?UTF-8?B?' + b64(s) + '?=';

const fromName = String(cfg.mailFromDisplay || cfg.mailFrom).replace(/^"(.*)"\s*<.*$/, '$1');
const from = /</.test(cfg.mailFromDisplay || '')
  ? encHeader(fromName) + ' <' + cfg.mailFrom + '>'
  : cfg.mailFrom;

const boundary = 'alojan_' + Date.now().toString(36);

function buildRaw(recipient) {
  const lines = [
    'From: ' + from,
    'To: ' + recipient,
    'Reply-To: ' + (cfg.mailReplyTo || cfg.mailFrom),
    'Subject: ' + encHeader(mail.subject || ''),
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    b64(mail.emailText || '').replace(/(.{76})/g, '$1\r\n'),
    '',
    '--' + boundary,
    'Content-Type: text/html; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
    '',
    b64(mail.emailHtml || '').replace(/(.{76})/g, '$1\r\n'),
    '',
    '--' + boundary + '--',
    '',
  ];
  // Gmail API بياخد base64url (بـ - و _ بدل + و /) ومن غير padding
  return Buffer.from(lines.join('\r\n'), 'utf8').toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

return targets.map((recipient, i) => ({ json: {
  __gmailSend: true,
  recipient,
  gmailIndex: i,
  gmailTargets: targets,
  raw: buildRaw(recipient),
} }));
