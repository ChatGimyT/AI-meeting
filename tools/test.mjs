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
  .concat([
    { label: 'sheet → rabeh_article_ar_deepseek', args: ['--sheet', '--profile=rabeh_article_ar_deepseek'] },
    /* رقم مغشوش عمدًا: يجب أن تمسكه البوابة وتمنع تسليم التقرير */
    { label: 'رقم مغشوش → البوابة تحجز', args: ['--profile=rabeh_article_ar', '--corrupt-number'], corrupt: true },
    { label: 'رقم مغشوش (مُجزَّأ) → البوابة تحجز', args: ['--profile=rabeh_article_ar_deepseek', '--corrupt-number'], corrupt: true }
  ]);

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
    if (c.corrupt) {
      if (!/البوابة أمسكت الرقم المغشوش/.test(out)) {
        throw Object.assign(new Error('gate did not hold'), { stdout: out + '\n❌ لم تمسك البوابة الرقم المغشوش' });
      }
      console.log('نجح ✅  (حُجز التقرير ومُنع تسليم الرقم الخاطئ)');
      continue;
    }
    const numbers = (out.match(/الحكم: (\S+) \| مصرَّح بالإرسال/) || [])[1] || '—';
    console.log('نجح ✅  (' + status + ' | دورات: ' + rounds + ' | نداءات: ' + calls + ' | كلمات: ' + words +
                ' | أرقام: ' + numbers + ')');
  } catch (e) {
    failed++;
    console.log('فشل ❌');
    console.log((e.stdout || '').split('\n').filter((l) => l.includes('❌')).join('\n'));
  }
}
console.log('');
if (failed) { console.error('❌ فشل ' + failed + ' من ' + cases.length + ' حالة.\n'); process.exit(1); }
console.log('✅ كل الحالات تعمل من البداية للنهاية (' + cases.length + ' حالة).\n');
