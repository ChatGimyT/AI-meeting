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
function classify(res, rowLimit) {
  if (!res) return { state: 'missing', reason: 'مفيش رد للطلب ده' };
  const j = res.json || {};
  if (j.error !== undefined && j.error !== null) {
    return { state: 'error', reason: errText(j.error) || 'خطأ من جوجل' };
  }
  // GSC بيرجّع {} لما مفيش بيانات — ده رد ناجح مش خطأ.
  const rows = Array.isArray(j.rows) ? j.rows : [];
  // الرد بيتقصّ عند rowLimit اللي احنا طلبناه. المقارنة كانت متثبّتة على 900
  // والـ rowLimit الفعلي 500 — يعني الحارس ده عمره ما كان بيشتغل، وأي كلمة
  // ليها صفحات أكتر من الحد كان مجموعها بيطلع ناقص من غير ما حد يعرف.
  const limit = Number(rowLimit) > 0 ? Number(rowLimit) : 0;
  return { state: 'ok', rows, truncated: limit > 0 && rows.length >= limit };
}

// بيربط ردود نود HTTP بطلباتها.
// لو عدد الردود = عدد الطلبات → pairedItem وإلا الترتيب.
// لو العدد مختلف → pairedItem بس، وأي طلب ملقاش رد بيتعلّم missing.
// بنرجّع map من taskIndex → { state, rows | reason }
function pairResults(tasks, results, rowLimit) {
  const strict = results.length !== tasks.length;
  const map = {};
  const stats = { results: results.length, tasks: tasks.length, strict, unpaired: 0 };
  results.forEach((r, i) => {
    const idx = strict ? srcIndex(r, -1) : srcIndex(r, i);
    if (idx < 0 || idx >= tasks.length || !tasks[idx]) { stats.unpaired++; return; }
    const t = tasks[idx].json || {};
    if (t.taskId === undefined) { stats.unpaired++; return; }
    // أول رد بيكسب: لو حصل تكرار في pairedItem مانستبدلش رد سليم بواحد فاشل.
    const c = classify(r, rowLimit);
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

// ---- تجميع صفوف الصفحات لرقم واحد على مستوى الموقع ----
// جوجل بيرجّع صف لكل صفحة: متوسط موضع الصفحة دي + عدد ظهورها للكلمة.
// الرقم اللي واجهة Search Console بتعرضه للكلمة من غير فلتر صفحة هو المتوسط
// الموزون بعدد الظهور:
//
//     الموضع = مجموع(الموضع × الظهور) ÷ مجموع(الظهور)
//     الظهور = مجموع الظهور
//
// النسخة القديمة كانت بتاخد "أقل موضع" بين الصفحات وظهور الصفحة دي لوحدها.
// ده رقم صفحة واحدة متقفشة من بين ٥٠٠ صفحة — بيطلّع موضع أحسن من الحقيقة
// وظهور أقل منها بكتير. ده بالظبط سبب "POS 10 / IMP 1" في التقرير مقابل
// "20.9 / 144" في الواجهة.
//
// ملحوظة: مجموع الظهور على مستوى الصفحات ممكن يزيد شوية عن رقم الواجهة لو
// أكتر من صفحة من الموقع ظهرت في نفس نتيجة البحث. الرقم المضبوط تمامًا
// بييجي من الصفحة المستهدفة (page) — عشان كده كل كلمة المفروض يكون ليها رابط.
function aggregateRows(rows) {
  let impressions = 0, clicks = 0, weighted = 0;
  rows.forEach(r => {
    const im = Number(r.impressions) || 0;
    impressions += im;
    clicks      += Number(r.clicks) || 0;
    weighted    += Number(r.position) * im;
  });
  return {
    impressions,
    clicks,
    position: impressions > 0 ? weighted / impressions : null,
  };
}

const round1 = v => (v === null || v === undefined) ? null : Math.round(Number(v) * 10) / 10;

// بيطلع نتيجة خانة واحدة من رد جوجل.
// verdict:
//   ranked  = فيه ترتيب مؤكد
//   no-data = الرد وصل سليم ومفيش ولا ظهور واحد → '-' في الشيت
//   failed  = الطلب فشل → الخانة تفضل فاضية وتتعاد المرة الجاية
//
// scope بيقول الرقم ده بيوصف إيه بالظبط — وده اللي بيخلي التقرير قابل
// للمراجعة في واجهة GSC:
//   page = الصفحة المستهدفة نفسها (يقابل فلتر Query + Page في الواجهة)
//   site = كل صفحات الموقع للكلمة (يقابل فلتر Query لوحده في الواجهة)
function readCell(cls, targetPage, pageMatch) {
  if (!cls || cls.state !== 'ok') {
    return { verdict: 'failed', reason: (cls && cls.reason) || 'مفيش رد',
             position: null, impressions: 0, scope: '', matchMode: 'none' };
  }
  const rows = cls.rows || [];
  // صف صالح = عليه ترتيب أكبر من صفر وظهور واحد على الأقل.
  const valid = rows.filter(r => r && Number(r.position) > 0 && Number(r.impressions) > 0);
  if (!valid.length) {
    return { verdict: 'no-data', reason: rows.length ? 'صفوف من غير ترتيب صالح' : 'مفيش ظهور',
             position: null, impressions: 0, scope: '', matchMode: 'none' };
  }

  // أعلى صفحة ترتيبًا — للتشخيص بس، مش رقم التقرير.
  const best = valid.slice().sort((a, b) => Number(a.position) - Number(b.position))[0];
  const diag = {
    pagesSeen: valid.length,
    topPage: String((best.keys || [])[0] || ''),
    topPagePosition: round1(best.position),
    truncated: !!cls.truncated,
  };

  const want = normUrl(targetPage);
  const hit = want ? (valid.find(r => normUrl((r.keys || [])[0]) === want) || null) : null;

  if (hit) {
    return Object.assign({
      verdict: 'ranked',
      scope: 'page',
      matchMode: 'exact',
      position: round1(hit.position),
      impressions: Math.round(Number(hit.impressions) || 0),
      clicks: Math.round(Number(hit.clicks) || 0),
      matchedPage: String((hit.keys || [])[0] || ''),
    }, diag);
  }

  // الصفحة المستهدفة مش ظاهرة والوضع strict → الخانة تتحسب "مفيش ظهور".
  if (want && pageMatch === 'strict') {
    return Object.assign({
      verdict: 'no-data', reason: 'الصفحة المستهدفة مش ظاهرة',
      position: null, impressions: 0, scope: '', matchMode: 'none',
    }, diag);
  }

  // مفيش صفحة مستهدفة (أو مش ظاهرة والوضع prefer) → رقم الموقع كله للكلمة.
  // ده اللي الواجهة بتعرضه لما تفلتر بالكلمة لوحدها.
  const agg = aggregateRows(valid);
  return Object.assign({
    verdict: 'ranked',
    scope: 'site',
    matchMode: want ? 'site-fallback' : 'site',
    position: round1(agg.position),
    impressions: Math.round(agg.impressions),
    clicks: Math.round(agg.clicks),
    matchedPage: '',
  }, diag);
}
