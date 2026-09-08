/* =============================================================
 * تعديلات على بنية الـ workflow اللي مش جوه نودات الكود:
 * باراميترات نودات HTTP، نودات جديدة، وصلات، وإعدادات.
 * ============================================================= */

/* ---------- نودات جديدة ---------- */
export function nodes(cadence, wf) {
  return [];
}

/* ---------- وصلات ---------- */
export function connections(cadence, wf) {
  return {};
}

/* ---------- إعدادات الـ workflow ---------- */
export function settings(cadence, wf) {
  return {};
}

/* ---------- تعديلات حرة على نودات قائمة ---------- */
export function rewrite(cadence, wf) {
  const byName = Object.fromEntries(wf.nodes.map((n) => [n.name, n]));

  /* ═══ توحيد طلب GSC بين التقريرين ═══
   * aggregationType: 'byPage' بيخلي جوجل يحسب الموضع لكل صفحة على حدة —
   * وده اللي واجهة Search Console بتعرضه في تبويب الصفحات. من غيره جوجل
   * بيستخدم auto فيطلع رقم مختلف لنفس الكلمة في نفس اليوم. كان موجود في
   * الأسبوعي وناقص في الشهري، وده أحد أسباب اختلاف التقريرين. */
  ['GSC Query', 'GSC Retry Query'].forEach((name) => {
    const n = byName[name];
    if (!n || typeof n.parameters.jsonBody !== 'string') return;
    if (n.parameters.jsonBody.includes('aggregationType')) return;
    n.parameters.jsonBody = n.parameters.jsonBody.replace(
      "type: 'web',", "type: 'web', aggregationType: 'byPage',");
  });

  /* حد الصفوف اتوحّد على 1000 في Config — نتأكد إن النود بيقراه من Config
   * مش من رقم متثبّت. */
  ['GSC Query', 'GSC Retry Query'].forEach((name) => {
    const n = byName[name];
    if (!n) return;
    if (!/gscRowLimit/.test(String(n.parameters.jsonBody || ''))) {
      throw new Error(cadence + '/' + name + ': rowLimit مش مقروء من Config');
    }
  });
}
