/* ── 2. سجل الملفات التعريفية (كل الإعدادات في هذه العقدة) ─────────
 * هذه هي العقدة الوحيدة التي تحتاج لتعديلها لتخصيص المحرك:
 *   • أضف ملفًا جديدًا داخل PROFILES
 *   • أو استخدم extends لوراثة ملف قائم وتعديل ما تريد فقط
 * ─────────────────────────────────────────────────────────────── */

/* __PROFILES__ */

/* حلّ سلسلة الوراثة (extends) */
const resolved = {};
function resolve(id, seen) {
  if (resolved[id]) return resolved[id];
  const p = PROFILES[id];
  if (!p) throw new Error('Profile not found: ' + id);
  seen = seen || {};
  if (seen[id]) throw new Error('Circular extends at profile: ' + id);
  seen[id] = true;
  let out = p;
  if (p.extends) {
    const base = resolve(p.extends, seen);
    out = H.deepMerge(base, p);
    delete out.extends;
  }
  out.id = id;
  resolved[id] = out;
  return out;
}
Object.keys(PROFILES).forEach(function (id) { resolve(id); });

return [{ json: { profiles: resolved, brief: $input.first().json.brief } }];
