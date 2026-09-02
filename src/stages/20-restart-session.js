/* ── 20. إعادة البناء من المخطط (قرار مجلس الإدارة) ── */
const REG = $('📚 Profiles Registry').first().json.profiles;
const s   = $input.first().json.state;
const cfg = H.cfgOf(REG, s);

s.restarts = s.restarts + 1;
s.round    = s.round + 1;

s.restart_directive = (s.chair.message_to_writer || '') + '\n' +
  (s.revision_brief || []).map(function (b) { return '- ' + b.instruction; }).join('\n');

s.restart_failures = []
  .concat((s.gate.reasons || []))
  .concat((s.mechanical.checks || []).filter(function (c) { return !c.pass; }).map(function (c) { return c.id + ': ' + c.detail; }))
  .concat((s.panel || []).reduce(function (acc, r) {
    return acc.concat((r.critical_issues || []).map(function (ci) { return r._persona_id + ': ' + ci.title; }));
  }, []));

/* المخطط يُعدَّل بما قرره المجلس قبل إعادة الكتابة */
if (s.chair.revision_brief) s.blueprint.board_amendments = s.chair.revision_brief;
s.blueprint.chair_directive = s.chair.message_to_writer || s.blueprint.chair_directive;

s.article_versions.push({ round: s.round, stage: 'restart', words: 0 });
s.article = '';

H.minute(s, {
  stage: 'restart', actor: '♻️ مجلس التحرير',
  headline: 'إعادة بناء المقال من المخطط (إعادة رقم ' + s.restarts + ' من ' + cfg.gate.max_restarts + ')',
  detail: H.clip(s.restart_directive, 1200)
});

return [{ json: { state: s } }];
