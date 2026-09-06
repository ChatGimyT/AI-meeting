const AR_MON = ['يناير','فبراير','مارس','أبريل','مايو','يونيو',
                'يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
function arMonth(mo) {
  if (!mo || !mo.key) return '';
  const parts = String(mo.key).split('-');
  return (AR_MON[Number(parts[1]) - 1] || parts[1]) + ' ' + parts[0];
}
function arWeek(mo) {
  if (!mo || !mo.startDate) return '';
  const s = new Date(mo.startDate + 'T00:00:00Z');
  const e = new Date(mo.endDate   + 'T00:00:00Z');
  const sm = AR_MON[s.getUTCMonth()], em = AR_MON[e.getUTCMonth()];
  const y  = e.getUTCFullYear();
  return sm === em
    ? 'أسبوع ' + s.getUTCDate() + ' – ' + e.getUTCDate() + ' ' + em + ' ' + y
    : 'أسبوع ' + s.getUTCDate() + ' ' + sm + ' – ' + e.getUTCDate() + ' ' + em + ' ' + y;
}
