// بيراجع ردود السحبة الأولى ويحدد أنهي طلبات محتاجة محاولة تانية.
// الطلب بيتعاد لو: فشل (429 / 403 / شبكة) أو ملقاش رد أصلاً.
// الطلب اللي رجع سليم — حتى لو مفيش فيه ظهور — مش بيتعاد.
// @include _lib.pairing.js

const cfg     = $('Config').first().json;
const tasks   = $('Build Tasks').all();
const results = $('GSC Query').all();

const noFetch = !!(tasks[0] && tasks[0].json && tasks[0].json.__noFetch);
if (noFetch) {
  return [{ json: { __retry: false, retryCount: 0, pass1: { ok: 0, failed: 0, missing: 0 }, noFetch: true } }];
}

const paired = pairResults(tasks, results, cfg.gscRowLimit);

const retry = [];
const summary = { ok: 0, failed: 0, missing: 0 };
tasks.forEach(t => {
  const j = t.json || {};
  if (!j.taskId) return;
  const c = paired.map[j.taskId];
  if (c && c.state === 'ok') { summary.ok++; return; }
  if (c && c.state === 'error') summary.failed++; else summary.missing++;
  retry.push(j);
});

// حد أقصى للمحاولة التانية عشان ماندخلش في لوب طويل لو جوجل واقع خالص.
const MAX_RETRY = 400;
const capped = retry.slice(0, MAX_RETRY);

if (!capped.length) {
  return [{ json: {
    __retry: false, retryCount: 0,
    pass1: summary, pairing: paired.stats,
  } }];
}

return capped.map((j, i) => ({ json: Object.assign({}, j, {
  __retry: true,
  retryIndex: i,
  retryCount: capped.length,
  retryDropped: retry.length - capped.length,
  pass1: summary,
  pairing: paired.stats,
}) }));
