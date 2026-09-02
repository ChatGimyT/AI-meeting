#!/usr/bin/env node
/* يشغّل المحاكاة على كل ملف تعريفي ويفشل إن سقط أي تأكيد. */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profiles = ['rabeh_article_ar', 'rabeh_refresh_ar', 'social_posts_ar',
                  'rabeh_article_ar_deepseek', 'social_posts_deepseek'];
let failed = 0;

for (const p of profiles) {
  process.stdout.write('▶ ' + p.padEnd(26) + ' … ');
  try {
    const out = execFileSync('node', [path.join(ROOT, 'tools', 'simulate.mjs'), '--profile=' + p],
      { encoding: 'utf8', cwd: ROOT });
    const rounds = (out.match(/الدورات المستهلكة \.+ (\d+)/) || [])[1];
    const status = (out.match(/الحالة \.+ (\S+)/) || [])[1];
    const calls  = (out.match(/نداءات النموذج \.+ (\d+)/) || [])[1];
    const words  = (out.match(/عدد كلمات المقال \.+ (\d+)/) || [])[1];
    console.log('نجح ✅  (' + status + ' | دورات: ' + rounds + ' | نداءات: ' + calls + ' | كلمات: ' + words + ')');
  } catch (e) {
    failed++;
    console.log('فشل ❌');
    console.log((e.stdout || '').split('\n').filter((l) => l.includes('❌')).join('\n'));
  }
}
console.log('');
if (failed) { console.error('❌ فشل ' + failed + ' من ' + profiles.length + ' ملفات.\n'); process.exit(1); }
console.log('✅ كل الملفات التعريفية تعمل من البداية للنهاية.\n');
