#!/usr/bin/env node
/* فحص سريع لمفتاح المزوّد قبل إنفاق أي شيء:
     export DEEPSEEK_API_KEY=sk-...
     node tools/ping.mjs                       # deepseek افتراضيًا
     node tools/ping.mjs --provider=anthropic  */
const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith('--' + k + '='));
  return hit ? hit.slice(k.length + 3) : d;
};
const provider = arg('provider', 'deepseek');
const KEY = process.env.LLM_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.ANTHROPIC_API_KEY || '';
if (!KEY) { console.error('❌ لا يوجد مفتاح. export DEEPSEEK_API_KEY=sk-...'); process.exit(2); }

const CFG = {
  deepseek:  { url: 'https://api.deepseek.com/chat/completions', model: arg('model', 'deepseek-chat') },
  openai:    { url: 'https://api.openai.com/v1/chat/completions', model: arg('model', 'gpt-4.1') },
  anthropic: { url: 'https://api.anthropic.com/v1/messages',      model: arg('model', 'claude-sonnet-5') }
}[provider];
if (!CFG) { console.error('❌ مزوّد غير معروف: ' + provider); process.exit(2); }

const headers = { 'content-type': 'application/json' };
let body;
if (provider === 'anthropic') {
  headers['x-api-key'] = KEY; headers['anthropic-version'] = '2023-06-01';
  body = { model: CFG.model, max_tokens: 40, messages: [{ role: 'user', content: 'قل: جاهز.' }] };
} else {
  headers['authorization'] = 'Bearer ' + KEY;
  body = { model: CFG.model, max_tokens: 40, temperature: 0.3,
           messages: [{ role: 'user', content: 'قل: جاهز.' }] };
}

const t0 = Date.now();
try {
  const res = await fetch(CFG.url, { method: 'POST', headers, body: JSON.stringify(body) });
  const raw = await res.text();
  let data;
  try { data = JSON.parse(raw); }
  catch (e) {
    console.error('❌ رد غير متوقع من ' + CFG.url + ' (HTTP ' + res.status + ')');
    console.error('   ' + raw.slice(0, 200));
    console.error('   ← غالبًا وسيط شبكة يحجب المضيف، لا مشكلة في المفتاح.');
    process.exit(1);
  }
  const ms = Date.now() - t0;
  if (data.error) { console.error('❌ ' + provider + ': ' + JSON.stringify(data.error)); process.exit(1); }
  const text = data.content ? (data.content.find((c) => c.type === 'text') || {}).text
                            : ((data.choices || [{}])[0].message || {}).content;
  const u = data.usage || {};
  console.log('✅ ' + provider + ' يعمل  |  النموذج: ' + (data.model || CFG.model) + '  |  ' + ms + ' ms');
  console.log('   توكنات: ' + (u.prompt_tokens || u.input_tokens || 0) + ' / ' + (u.completion_tokens || u.output_tokens || 0));
  console.log('   الرد: ' + String(text || '').trim().slice(0, 80));
} catch (e) {
  console.error('❌ تعذّر الوصول إلى ' + CFG.url + '\n   ' + (e.message || e));
  process.exit(1);
}
