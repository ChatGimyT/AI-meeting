// بيجهّز طلب فحص لكل رابط صفحة مستهدفة — مرة واحدة لكل رابط فريد.
//
// ليه الفحص ده موجود: فلتر الصفحة في Search Console بيطابق **الرابط الكانوني**
// بالحرف. لو الرابط اللي في ملف الكلمات بيعمل تحويل (redirect) أو الصفحة معلنة
// كانوني مختلف، جوجل ما بيرجّعش الصفحة دي فالخانة بتطلع "مفيش ظهور" — والرقم
// ده غلط، ومحدش بيشك فيه لأن الرابط بيفتح عادي لما تجربه بإيدك.
const kws = $('Keywords').first().json.keywords || [];

const seen = {};
const urls = [];
kws.forEach(function (k) {
  const u = String(k.page || '').trim();
  if (!u || !/^https?:\/\//i.test(u) || seen[u]) return;
  seen[u] = 1;
  urls.push(u);
});

if (!urls.length) {
  return [{ json: { __skipPageCheck: true, url: '', pageCount: 0 } }];
}

return urls.map(function (u, i) {
  return { json: { __skipPageCheck: false, url: u, pageIndex: i, pageCount: urls.length } };
});
