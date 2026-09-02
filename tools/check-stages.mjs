import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm';
const dir = 'src/stages';
let bad = 0;
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.js')).sort()) {
  const code = fs.readFileSync(path.join(dir, f), 'utf8').replace('/* __PROFILES__ */', 'const PROFILES={};');
  try { new vm.Script('(async function(){' + code + '})'); }
  catch (e) { bad++; console.log('❌ ' + f + ' → ' + e.message); }
}
console.log(bad ? '\n' + bad + ' stage file(s) failed.' : '✅ all stage files parse');
process.exit(bad ? 1 : 0);
