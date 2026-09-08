// بيلمّ نتايج الإرسال الفردي ويبني تنبيه بحالة التوصيل لكل مستلم.
const cfg   = $('Config').first().json;
const audit = $('Delivery Audit').first().json || {};
const tries = $input.all();

const norm = e => String(e || '').trim().toLowerCase();
const addrOf = (e) => {
  const s = String(e || '');
  const m = s.match(/<([^>]+)>/);
  return norm(m ? m[1] : s);
};

// الربط بـ pairedItem زي باقي النودات — الترتيب لوحده مش ضمان.
const auditItems = $('Delivery Audit').all();
function srcIndex(item, fallbackIndex) {
  const p = item ? item.pairedItem : undefined;
  if (typeof p === 'number') return p;
  if (p && typeof p.item === 'number') return p.item;
  if (Array.isArray(p) && p.length && p[0] && typeof p[0].item === 'number') return p[0].item;
  return fallbackIndex;
}

// النود ده بيوصله ٣ أشكال دخل مختلفة، ولازم يفرّق بينهم:
//   1) ردود إعادة الإرسال عبر SMTP     → فيها accepted/rejected
//   2) ردود الإرسال البديل عبر Gmail API → فيها id أو error
//   3) عنصر عابر من غير أي إرسال        → مفيش لا ده ولا ده
// الخلط بينهم كان بيخلي التقرير يقول "ما وصلش" على رن كل حاجة فيه تمام.
const isSmtpReply  = (j) => Array.isArray(j.accepted) || Array.isArray(j.rejected);
const isGmailReply = (j) => j.labelIds !== undefined || (j.id !== undefined && j.raw === undefined);
const sendReplies  = tries.filter((t) => {
  const j = (t && t.json) || {};
  return (isSmtpReply(j) || isGmailReply(j)) && j.__resend === undefined && j.__gmailSend === undefined;
});
const noResend = sendReplies.length === 0;
const viaGmail = sendReplies.length > 0 && sendReplies.every((t) => isGmailReply(t.json || {}));

/* المسار البديل بيجيب اسم المستلم من نود التجهيز مش من رد جوجل */
let gmailPlan = [];
try { gmailPlan = $('Build Gmail Fallback').all(); } catch (e) { gmailPlan = []; }

const rows = [];
if (!noResend) sendReplies.forEach((item, i) => {
  const j = item.json || {};
  const idx = srcIndex(item, i);
  const src = viaGmail
    ? (gmailPlan[idx] || gmailPlan[i] || {})
    : (auditItems[idx] || auditItems[i] || {});
  const target = norm((src.json || {}).recipient || '');
  const err = (j.error !== undefined && j.error !== null)
    ? (typeof j.error === 'string' ? j.error : (j.error.message || JSON.stringify(j.error))).slice(0, 300)
    : '';
  const accepted = (Array.isArray(j.accepted) ? j.accepted : []).map(addrOf);
  rows.push({
    recipient: target,
    ok: viaGmail ? !err : (!err && accepted.indexOf(target) !== -1),
    error: err,
    response: viaGmail ? ('Gmail API' + (j.id ? ' · ' + j.id : '')) : String(j.response || '').slice(0, 200),
    via: viaGmail ? 'gmail-api' : 'smtp',
  });
});

const failed = rows.filter(r => !r.ok);
const fixed  = rows.filter(r => r.ok);

// سياسة الناقل: الرفض على أساس الدومين. مفيش إعادة إرسال ليها معنى هنا،
// والتقرير لازم يقول السبب والحل بدل ما يقول "ما وصلش" ويسيب الناس تخمّن.
const relayBlocked = !!audit.relayBlocksExternal;
const blockedList = audit.externalMissing || [];

const esc = t => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const line = r => (r.ok ? 'وصل بعد إعادة الإرسال' : 'ما وصلش') + ' — ' + r.recipient +
                  (r.error ? ' — ' + r.error : (r.response ? ' — ' + r.response : ''));

const text = [
  'تقرير حالة توصيل إيميل SEO — ' + cfg.company,
  '',
  'الموضوع: ' + (audit.subject || ''),
  'المستلمين المتوقعين: ' + (audit.expected || []).join(', '),
  'اللي السيرفر قبلهم في الإرسال الأول: ' + ((audit.accepted || []).join(', ') || 'مفيش'),
  'اللي اترفضوا أو ماتأكدوش: ' + ((audit.missing || []).join(', ') || 'مفيش'),
  'رد سيرفر SMTP: ' + (audit.smtpResponse || '—'),
  '',
  relayBlocked && noResend ? 'إعادة الإرسال: اتوقفت عن قصد — السبب مش عنوان غلط.'
    : viaGmail ? 'اتبعت عبر المسار البديل (Gmail API) للمستلمين اللي SMTP رفضهم:'
    : 'نتيجة إعادة الإرسال الفردي:',
].concat((relayBlocked && noResend)
   ? ['', 'المستلمين اللي ما وصلهمش: ' + blockedList.join(', '), '', audit.relayDiagnosis]
   : rows.map(r => '- ' + line(r)))
 .concat((!relayBlocked && failed.length) ? [
   '',
   'المستلمين دول لسه ما وصلهمش الإيميل. ده معناه إن سيرفر SMTP نفسه رافض',
   'يوصّل لبره الدومين، أو إن الرسالة بتتحجب عند المستلم. الحل في الإعدادات',
   'مش في الأوتوميشن — راجع ملف EMAIL-DELIVERABILITY.md.',
 ] : (relayBlocked ? [] : (noResend
     ? ['', 'كل المستلمين قبلهم السيرفر من أول مرة.']
     : ['', 'كل المستلمين وصلهم الإيميل بعد إعادة الإرسال الفردي.'])))
 .join('\n');

const html =
'<div style="font-family:Calibri,Arial,sans-serif;direction:rtl;text-align:right;background:#f2f1ee;padding:24px;color:#142f38;font-size:14px;">' +
'<div style="max-width:700px;margin:0 auto;background:#ffffff;border:1px solid #d8d6d0;border-radius:10px;padding:22px;">' +
'<h3 style="margin:0 0 12px 0;font-size:16px;">حالة توصيل إيميل التقرير — ' + esc(cfg.company) + '</h3>' +
((relayBlocked && noResend)
  ? '<div style="background:#fdf3f1;border:1px solid #e6b9b0;border-radius:6px;padding:12px 16px;margin-bottom:14px;line-height:1.9;">' +
    '<b>الناقل رافض يوصّل بره الدومين.</b><br>' +
    'المستلمين اللي ما وصلهمش: ' + esc(blockedList.join(', ')) + '<br><br>' +
    esc(audit.relayDiagnosis) + '</div>'
  : '<p style="line-height:1.9;margin:0 0 14px 0;">الإرسال الأول ما وصلش لكل المستلمين، فأعدنا الإرسال لكل واحد لوحده. ' +
    'دي النتيجة النهائية:</p>') +
(rows.length ? '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #d8d6d0;">' +
'<tr><th style="padding:10px;background:#142f38;color:#fff;text-align:right;">المستلم</th>' +
'<th style="padding:10px;background:#142f38;color:#fff;text-align:center;">الحالة</th>' +
'<th style="padding:10px;background:#142f38;color:#fff;text-align:right;">رد السيرفر</th></tr>' +
rows.map((r, i) => '<tr style="background:' + (i % 2 ? '#ffffff' : '#f2f1ee') + ';">' +
  '<td style="padding:9px 10px;border-bottom:1px solid #d8d6d0;">' + esc(r.recipient) + '</td>' +
  '<td style="padding:9px 10px;border-bottom:1px solid #d8d6d0;text-align:center;color:' +
    (r.ok ? '#1e7a34' : '#c0392b') + ';font-weight:bold;">' + (r.ok ? 'وصل' : 'ما وصلش') + '</td>' +
  '<td style="padding:9px 10px;border-bottom:1px solid #d8d6d0;">' + esc(r.error || r.response || '—') + '</td></tr>').join('') +
'</table>' : '') +
'<p style="margin:14px 0 0 0;line-height:1.9;"><b>رد سيرفر SMTP في الإرسال الأول:</b> ' + esc(audit.smtpResponse || '—') + '</p>' +
((relayBlocked && noResend) ? ''
  : failed.length
  ? '<p style="margin:10px 0 0 0;line-height:1.9;">لسه فيه ' + failed.length + ' مستلم ما وصلهوش. ' +
    'المشكلة في إعدادات السيرفر مش في الأوتوميشن — راجع ملف <b>docs/EMAIL.md</b> ' +
    '(صلاحية الإرسال الخارجي + SPF و DKIM و DMARC).</p>'
  : '<p style="margin:10px 0 0 0;line-height:1.9;color:#1e7a34;">' +
    (noResend ? 'كل المستلمين قبلهم السيرفر من أول مرة.' : 'كل المستلمين وصلهم الإيميل بعد إعادة الإرسال الفردي.') + '</p>') +
'</div></div>';

return [{ json: {
  deliveryRows: rows,
  stillFailing: failed.map(r => r.recipient),
  recovered: fixed.map(r => r.recipient),
  relayBlocked,
  blockedRecipients: blockedList,
  viaGmail,
  alertSubject: ((relayBlocked && noResend) ? 'الناقل رافض يوصّل بره الدومين — ' :
                 failed.length ? 'إيميل التقرير ما وصلش لكل المستلمين — ' :
                 noResend ? 'حالة توصيل إيميل التقرير — ' :
                 'إيميل التقرير اتصلّح بعد إعادة الإرسال — ') + cfg.company,
  /* مافيش تنبيه إلا لما يكون فيه حاجة تتقال فعلاً */
  __silent: (noResend && !relayBlocked) || (viaGmail && failed.length === 0),
  alertHtml: html,
  alertText: text,
} }];
