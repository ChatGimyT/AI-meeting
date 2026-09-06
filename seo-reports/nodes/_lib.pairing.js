// ---------------------------------------------------------------------------
// مكتبة الربط والتحقق بين طلبات GSC وردودها.
// (بتتحقن أوتوماتيك في نودات الكود وقت البناء — متعدّلهاش في n8n)
// ---------------------------------------------------------------------------

// n8n بيحط pairedItem على كل عنصر خارج من HTTP Request بيقول جه من أنهي
// عنصر داخل. ده أضمن من الاعتماد على الترتيب، لأن الرد ممكن يتقسّم أو يتلم.
function srcIndex(item, fallbackIndex) {
  const p = item ? item.pairedItem : undefined;
  if (typeof p === 'number') return p;
  if (p && typeof p.item === 'number') return p.item;
  if (Array.isArray(p) && p.length && p[0] && typeof p[0].item === 'number') return p[0].item;
  return fallbackIndex;
}

function errText(e) {
  if (e === undefined || e === null) return '';
  if (typeof e === 'string') return e.slice(0, 300);
  if (e.message) return String(e.message).slice(0, 300);
  try { return JSON.stringify(e).slice(0, 300); } catch (x) { return String(e).slice(0, 300); }
}

// بيصنّف رد واحد من GSC:
//   ok        = رد سليم من جوجل (سواء فيه صفوف أو مفيش)
//   error     = الطلب فشل (429 / 403 / شبكة / توكن)
//   missing   = مفيش رد أصلاً للطلب ده
function classify(res) {
  if (!res) return { state: 'missing', reason: 'مفيش رد للطلب ده' };
  const j = res.json || {};
  if (j.error !== undefined && j.error !== null) {
    return { state: 'error', reason: errText(j.error) || 'خطأ من جوجل' };
  }
  // GSC بيرجّع {} لما مفيش بيانات — ده رد ناجح مش خطأ.
  const rows = Array.isArray(j.rows) ? j.rows : [];
  return { state: 'ok', rows, truncated: rows.length >= 900 };
}

// بيربط ردود نود HTTP بطلباتها.
// لو عدد الردود = عدد الطلبات → pairedItem وإلا الترتيب.
// لو العدد مختلف → pairedItem بس، وأي طلب ملقاش رد بيتعلّم missing.
// بنرجّع map من taskIndex → { state, rows | reason }
function pairResults(tasks, results) {
  const strict = results.length !== tasks.length;
  const map = {};
  const stats = { results: results.length, tasks: tasks.length, strict, unpaired: 0 };
  results.forEach((r, i) => {
    const idx = strict ? srcIndex(r, -1) : srcIndex(r, i);
    if (idx < 0 || idx >= tasks.length || !tasks[idx]) { stats.unpaired++; return; }
    const t = tasks[idx].json || {};
    if (t.taskId === undefined) { stats.unpaired++; return; }
    // أول رد بيكسب: لو حصل تكرار في pairedItem مانستبدلش رد سليم بواحد فاشل.
    const c = classify(r);
    if (!map[t.taskId] || (map[t.taskId].state !== 'ok' && c.state === 'ok')) {
      map[t.taskId] = c;
    }
  });
  return { map, stats };
}

// ---- تطبيع الروابط للمقارنة ----
function normUrl(u) {
  let s = String(u == null ? '' : u);
  for (let i = 0; i < 2; i++) {                 // فك ترميز مزدوج لو موجود
    try {
      const d = decodeURIComponent(s);
      if (d === s) break;
      s = d;
    } catch (e) { break; }
  }
  s = s.trim().toLowerCase();
  s = s.replace(/[#?].*$/, '');                 // شيل الأنكور والباراميترز
  s = s.replace(/^https?:\/\//, '').replace(/^www\./, '');
  s = s.replace(/\/index\.(html?|php)$/, '/');
  s = s.replace(/\/+$/, '');
  return s;
}

// بيطلع نتيجة خانة واحدة من رد جوجل.
// verdict:
//   ranked  = فيه ترتيب مؤكد
//   no-data = الرد وصل سليم ومفيش ولا ظهور واحد → '-' في الشيت
//   failed  = الطلب فشل → الخانة تفضل فاضية وتتعاد المرة الجاية
function readCell(cls, targetPage, pageMatch) {
  if (!cls || cls.state !== 'ok') {
    return { verdict: 'failed', reason: (cls && cls.reason) || 'مفيش رد', position: null, impressions: 0 };
  }
  const rows = cls.rows || [];
  // صف صالح = عليه ترتيب أكبر من صفر وظهور واحد على الأقل.
  const valid = rows.filter(r => r && Number(r.position) > 0 && Number(r.impressions) > 0);
  if (!valid.length) {
    return { verdict: 'no-data', reason: rows.length ? 'صفوف من غير ترتيب صالح' : 'مفيش ظهور',
             position: null, impressions: 0, matchMode: 'none' };
  }
  const want = normUrl(targetPage);
  let hit = null, mode = 'top';
  if (want) {
    hit = valid.find(r => normUrl((r.keys || [])[0]) === want) || null;
    if (hit) mode = 'exact';
  }
  if (!hit) {
    if (want && pageMatch === 'strict') {
      return { verdict: 'no-data', reason: 'الصفحة المستهدفة مش ظاهرة',
               position: null, impressions: 0, matchMode: 'none' };
    }
    // أعلى صفحة ترتيبًا (مش أعلى صفحة كليكات) — دي أقرب حاجة للرقم اللي
    // بيظهر للكلاينت في واجهة GSC.
    hit = valid.slice().sort((a, b) => Number(a.position) - Number(b.position))[0];
  }
  return {
    verdict: 'ranked',
    position: Math.round(Number(hit.position) * 10) / 10,
    impressions: Math.round(Number(hit.impressions) || 0),
    clicks: Math.round(Number(hit.clicks) || 0),
    matchedPage: String((hit.keys || [])[0] || ''),
    matchMode: mode,
    pagesSeen: valid.length,
    truncated: !!cls.truncated,
  };
}
