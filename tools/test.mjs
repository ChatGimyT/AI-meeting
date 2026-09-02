#!/usr/bin/env node
/* يشغّل المحاكاة على كل ملف تعريفي ويفشل إن سقط أي تأكيد. */
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const profiles = ['rabeh_article_ar', 'rabeh_refresh_ar', 'social_posts_ar',
                  'rabeh_article_ar_deepseek', 'social_posts_deepseek'];
let failed = 0;

const cases = profiles.map((p) => ({ label: p, args: ['--profile=' + p] }))
  .concat([{ label: 'sheet → rabeh_article_ar_deepseek', args: ['--sheet', '--profile=rabeh_article_ar_deepseek'] }]);

for (const c of cases) {
  const p = c.label;
  process.stdout.write('▶ ' + p.padEnd(34) + ' … ');
  try {
    const out = execFileSync('node', [path.join(ROOT, 'tools', 'simulate.mjs')].concat(c.args),
      { encoding: 'utf8', cwd: ROOT });
    const rounds = (out.match(/الدورات المستهلكة \.+ (\d+)/) || [])[1];
    const status = (out.match(/الحالة \.+ (\S+)/) || [])[1];
    const calls  = (out.match(/نداءات النموذج \.+ (\d+)/) || [])[1];
    const words  = (out.match(/عدد كلمات المقال \.+ (\d+)/) || [])[1];
    const sheetOk = !c.args.includes('--sheet') || /Sheets: Write Results/.test(out);
    if (!sheetOk) throw Object.assign(new Error('sheet write missing'), { stdout: out + '\n❌ لم تُكتب النتائج في الشيت' });
    console.log('نجح ✅  (' + status + ' | دورات: ' + rounds + ' | نداءات: ' + calls + ' | كلمات: ' + words + ')');
  } catch (e) {
    failed++;
    console.log('فشل ❌');
    console.log((e.stdout || '').split('\n').filter((l) => l.includes('❌')).join('\n'));
  }
}
console.log('');
if (failed) { console.error('❌ فشل ' + failed + ' من ' + cases.length + ' حالة.\n'); process.exit(1); }
console.log('✅ كل الحالات تعمل من البداية للنهاية (' + cases.length + ' حالة).\n');
