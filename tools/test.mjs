#!/usr/bin/env node
/* يشغّل المحاكاة على كل ملف تعريفي ويفشل إن سقط أي تأكيد. */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profiles = ['rabeh_article_ar', 'rabeh_refresh_ar', 'social_posts_ar'];
let failed = 0;

for (const p of profiles) {
  process.stdout.write('▶ ' + p.padEnd(20) + ' … ');
  try {
    const out = execFileSync('node', [path.join(ROOT, 'tools', 'simulate.mjs'), '--profile=' + p],
      { encoding: 'utf8', cwd: ROOT });
    const rounds = (out.match(/الدورات المستهلكة \.+ (\d+)/) || [])[1];
    const status = (out.match(/الحالة \.+ (\S+)/) || [])[1];
    console.log('نجح ✅  (الحالة: ' + status + ' | دورات: ' + rounds + ')');
  } catch (e) {
    failed++;
    console.log('فشل ❌');
    console.log((e.stdout || '').split('\n').filter((l) => l.includes('❌')).join('\n'));
  }
}
console.log('');
if (failed) { console.error('❌ فشل ' + failed + ' من ' + profiles.length + ' ملفات.\n'); process.exit(1); }
console.log('✅ كل الملفات التعريفية تعمل من البداية للنهاية.\n');
