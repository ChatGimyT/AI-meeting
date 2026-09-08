// يقرأ الشرائح الموجودة فعلياً دلوقتي من مخرجات Get Presentation
// لو العرض فاضي (0 شرائح) بيرجّع requests فاضية و hasSlides=false
// عشان نود الـ IF اللي بعده يتخطى الحذف بدل ما Google ترجّع 400
const cfg  = $('Config').first().json;
const pres = $input.first().json || {};

const ids = (pres.slides || []).map(s => s && s.objectId).filter(Boolean);

return [{ json: {
  presentationId: cfg.presentationId,
  deleteCount: ids.length,
  hasSlides: ids.length > 0,
  requests: ids.map(id => ({ deleteObject: { objectId: id } })),
} }];
