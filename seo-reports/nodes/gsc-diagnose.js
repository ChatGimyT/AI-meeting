// بيحوّل "مقدرناش نوصل لـ Search Console" لسبب محدد وخطوة واضحة.
//
// بيقرا حاجتين:
//   1) رد طلب الموقع المحدد في Config  (نود Verify GSC Access)
//   2) قائمة المواقع اللي الحساب المربوط شايفها فعلاً (نود List GSC Sites)
// ومن الاتنين دول بيعرف: التوكن واقع؟ ولا الحساب مالوش صلاحية؟ ولا الرابط
// المكتوب في Config مش مطابق لشكل الموقع المسجّل في جوجل؟
const cfg    = $('Config').first().json;
const verify = $('Verify GSC Access').first().json || {};
const listed = $input.first() ? ($input.first().json || {}) : {};

function errText(e) {
  if (e === undefined || e === null) return '';
  if (typeof e === 'string') return e;
  if (e.message) return String(e.message);
  try { return JSON.stringify(e); } catch (x) { return String(e); }
}

const verifyErr = errText(verify.error);
const listErr   = errText(listed.error);
const blob      = (verifyErr + ' ' + listErr);

// المواقع اللي الحساب شايفها
const entries = Array.isArray(listed.siteEntry) ? listed.siteEntry : [];
const sites = entries.map(e => ({
  url: String(e.siteUrl || ''),
  level: String(e.permissionLevel || ''),
}));

const want = String(cfg.siteUrl || '');
const norm = (u) => String(u || '').trim().toLowerCase()
  .replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '');
const wantN = norm(want);

const exact  = sites.find(s => s.url === want);
const sameHost = sites.filter(s => norm(s.url) === wantN && s.url !== want);
const readOnly = sites.filter(s => /^(siteUnverifiedUser|siteRestrictedUser)$/.test(s.level));

// ---------------- تحديد السبب ----------------
let cause, action, severity = 'blocked';

if (/invalid_grant|invalid_token|Token has been expired|revoked|unauthorized_client/i.test(blob)
    || /\b401\b/.test(blob)) {
  cause = 'صلاحية حساب جوجل المربوط بالأوتوميشن انتهت أو اتسحبت. '
        + 'ده بيحصل لما الباسورد يتغيّر، أو حد يشيل صلاحية n8n من إعدادات الحساب، '
        + 'أو التوكن يقعد فترة طويلة من غير استخدام.';
  action = 'افتح n8n ← Credentials ← "' + '__CRED_NAME__' + '" ← اضغط Reconnect وسجّل دخول '
         + 'بحساب جوجل اللي عنده صلاحية على الموقع، وبعدين شغّل الأوتوميشن يدويًا من Manual Trigger.';
} else if (sameHost.length) {
  cause = 'الرابط المكتوب في إعدادات الأوتوميشن مش مطابق لشكل الموقع المسجّل في '
        + 'Search Console. جوجل بيعتبرهم موقعين مختلفين تمامًا حتى لو نفس الدومين.';
  action = 'غيّر SITE_URL في نود Config من "' + want + '" لـ "' + sameHost[0].url + '" بالظبط '
         + '(انسخه زي ما هو من الجدول تحت).';
} else if (sites.length && !exact) {
  cause = 'الحساب المربوط بالأوتوميشن شغّال تمام، بس الموقع "' + want + '" مش موجود '
        + 'في المواقع اللي الحساب ده عنده صلاحية عليها.';
  action = 'يا إما تضيف الحساب ده كمستخدم على الموقع في Search Console '
         + '(الإعدادات ← المستخدمون والأذونات ← إضافة مستخدم)، يا إما تظبط SITE_URL في '
         + 'نود Config على واحد من المواقع الموجودة في الجدول تحت.';
} else if (/\b403\b|does not have sufficient permission|insufficientPermissions|forbidden/i.test(blob)) {
  cause = 'الحساب المربوط متصل بس مالوش صلاحية على الموقع ده في Search Console.';
  action = 'من Search Console: الإعدادات ← المستخدمون والأذونات ← إضافة مستخدم، '
         + 'وضيف حساب جوجل المربوط بالأوتوميشن بصلاحية "كامل" أو "مقيّد".';
} else if (/\b404\b|notFound/i.test(blob) && !sites.length) {
  cause = 'جوجل بيقول إن الموقع ده مش موجود عنده، والأوتوميشن كمان مقدرش يجيب قائمة '
        + 'المواقع — غالبًا الصلاحية واقعة أو الـ API مش مفعّل على المشروع.';
  action = 'راجع كريدنشيال جوجل في n8n (Reconnect)، واتأكد إن Search Console API مفعّل '
         + 'في Google Cloud Console على المشروع اللي عامل منه الـ OAuth.';
} else if (/\b429\b|quota|rateLimit/i.test(blob)) {
  cause = 'جوجل رفض الطلب مؤقتًا بسبب تجاوز حد الاستخدام.';
  action = 'مفيش حاجة تتعمل — شغّل الأوتوميشن تاني بعد شوية. لو اتكررت كل مرة، '
         + 'راجع حصة Search Console API في Google Cloud Console.';
  severity = 'temporary';
} else if (/ETIMEDOUT|ECONNRESET|ENOTFOUND|socket hang up|timeout|\b5\d\d\b/i.test(blob)) {
  cause = 'الاتصال بجوجل نفسه فشل (شبكة أو عطل مؤقت عند جوجل).';
  action = 'شغّل الأوتوميشن تاني من Manual Trigger. لو فضل بيفشل، راجع اتصال سيرفر n8n بالإنترنت.';
  severity = 'temporary';
} else if (!verifyErr && !verify.siteUrl) {
  cause = 'جوجل رد على الطلب بس الرد مالهوش الشكل المتوقع (مفيش siteUrl في الرد).';
  action = 'ابعت لقطة من مخرجات نود "Verify GSC Access" — التفاصيل الخام تحت في الإيميل ده.';
} else {
  cause = 'مقدرناش نحدد السبب أوتوماتيك من رد جوجل.';
  action = 'راجع رسالة الخطأ الخام تحت، وابدأ بعمل Reconnect لكريدنشيال جوجل في n8n.';
}

// ---------------- بناء الإيميل ----------------
const esc = t => String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const LEVEL_AR = {
  siteOwner: 'مالك', siteFullUser: 'صلاحية كاملة',
  siteRestrictedUser: 'صلاحية مقيّدة', siteUnverifiedUser: 'غير مُتحقّق',
};

const sitesHtml = sites.length
  ? '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;border:1px solid #d8d6d0;margin-top:8px;">'
    + '<tr><th style="padding:9px 10px;background:#142f38;color:#fff;text-align:right;font-size:13px;">الموقع كما هو مسجّل في جوجل</th>'
    + '<th style="padding:9px 10px;background:#142f38;color:#fff;text-align:center;font-size:13px;">الصلاحية</th></tr>'
    + sites.map((s, i) => '<tr style="background:' + (i % 2 ? '#ffffff' : '#f2f1ee') + ';">'
      + '<td style="padding:8px 10px;border-bottom:1px solid #d8d6d0;font-family:monospace;direction:ltr;text-align:left;">'
      + esc(s.url) + '</td>'
      + '<td style="padding:8px 10px;border-bottom:1px solid #d8d6d0;text-align:center;">'
      + esc(LEVEL_AR[s.level] || s.level) + '</td></tr>').join('')
    + '</table>'
  : '<p style="margin:8px 0 0 0;color:#c0392b;">مقدرناش نجيب قائمة المواقع كمان — '
    + 'ده بيرجّح إن المشكلة في صلاحية الحساب نفسه مش في الموقع.</p>';

const raw = [
  verifyErr ? 'رد فحص الموقع: ' + verifyErr : '',
  listErr   ? 'رد قائمة المواقع: ' + listErr : '',
].filter(Boolean).join('\n') || 'مفيش رسالة خطأ صريحة من جوجل.';

const subject = 'تقرير SEO ' + (cfg.cadence === 'weekly' ? 'الأسبوعي' : 'الشهري')
              + ' لم يُرسل — ' + cfg.company + ' — مشكلة في الوصول لـ Search Console';

const text = [
  'تقرير SEO ما اتبعتش — ' + cfg.company,
  '',
  'إيه اللي حصل:',
  cause,
  '',
  'إيه اللي تعمله:',
  action,
  '',
  'الموقع المطلوب في الإعدادات: ' + want,
  'المواقع اللي الحساب المربوط شايفها (' + sites.length + '):',
].concat(sites.length
    ? sites.map(s => '  - ' + s.url + '   [' + (LEVEL_AR[s.level] || s.level) + ']')
    : ['  (مقدرناش نجيبها)'])
 .concat([
  '',
  'رسالة جوجل الخام:',
  raw,
  '',
  'الشيت والعرض التقديمي ما اتلمسوش خالص — مفيش أي بيانات اتغيرت.',
 ]).join('\n');

const html =
'<div style="font-family:Calibri,Arial,sans-serif;direction:rtl;text-align:right;background:#f2f1ee;padding:24px;color:#142f38;font-size:14px;">'
+ '<div style="max-width:700px;margin:0 auto;background:#ffffff;border:1px solid #d8d6d0;border-radius:10px;padding:22px;">'
+ '<h3 style="margin:0 0 4px 0;font-size:16px;">تقرير SEO ما اتبعتش — ' + esc(cfg.company) + '</h3>'
+ '<div style="color:#7a7a7a;margin-bottom:16px;">مشكلة في الوصول لـ Google Search Console</div>'

+ '<div style="background:#f2f1ee;border-right:4px solid #c0392b;border-radius:4px;padding:12px 16px;margin-bottom:14px;">'
+ '<b>إيه اللي حصل بالظبط</b>'
+ '<p style="margin:6px 0 0 0;line-height:1.9;">' + esc(cause) + '</p></div>'

+ '<div style="background:#f2f1ee;border-right:4px solid #1e7a34;border-radius:4px;padding:12px 16px;margin-bottom:14px;">'
+ '<b>إيه اللي تعمله</b>'
+ '<p style="margin:6px 0 0 0;line-height:1.9;">' + esc(action) + '</p></div>'

+ '<p style="margin:0 0 4px 0;"><b>الموقع المطلوب في إعدادات الأوتوميشن:</b></p>'
+ '<div style="font-family:monospace;direction:ltr;text-align:left;background:#f2f1ee;border:1px solid #d8d6d0;'
+ 'border-radius:4px;padding:8px 10px;margin-bottom:14px;">' + esc(want) + '</div>'

+ '<p style="margin:0 0 4px 0;"><b>المواقع اللي الحساب المربوط شايفها فعلاً:</b></p>'
+ sitesHtml

+ '<p style="margin:16px 0 4px 0;"><b>رسالة جوجل الخام (للفني):</b></p>'
+ '<div style="font-family:monospace;direction:ltr;text-align:left;background:#f2f1ee;border:1px solid #d8d6d0;'
+ 'border-radius:4px;padding:8px 10px;white-space:pre-wrap;word-break:break-word;font-size:12px;">'
+ esc(raw) + '</div>'

+ '<p style="margin:16px 0 0 0;line-height:1.9;background:#f2f1ee;border-radius:4px;padding:10px 14px;">'
+ '<b>الشيت والعرض التقديمي ما اتلمسوش خالص</b> — مفيش أي بيانات اتغيرت ولا اتمسحت. '
+ 'بعد ما تظبط السبب، شغّل الأوتوميشن يدويًا من زرار Manual Trigger.</p>'

+ '</div></div>';

return [{ json: {
  alertSubject: subject, alertHtml: html, alertText: text,
  diagnosis: { cause, action, severity, want, sites, raw, readOnly: readOnly.length },
} }];
