/* ملحق سجل الملفات التعريفية: تعريف أعمدة شيت جوجل في مكان واحد */
const SHEET = {
  document_id: '1_LWkR3yYKsKQP9jcjPdi96D8lzTCWYmz5TF3FOsZZGw',
  sheet_name: 'الورقة1',

  /* أعمدة المدخلات — غيّر النص هنا فقط إن غيّرت عناوين الشيت */
  in: {
    run:            'تشغيل',
    status:         'الحالة',
    profile:        'الملف التعريفي',
    title:          'عنوان المقال',
    goal:           'الهدف',
    type:           'نوع المقال',
    market:         'السوق المستهدف',
    kw:             'الكلمة المفتاحية الرئيسية',
    kw_count:       'تكرار الكلمة',
    kw_secondary:   'الكلمات الثانوية',
    kw_semantic:    'الكلمات المرتبطة',
    headings:       'العناوين الداخلية',
    links:          'الروابط الداخلية',
    citations:      'استشهادات إلزامية',
    cluster:        'دور المقالة',
    existing:       'المقالة الحالية',
    notes:          'ملاحظات'
  },

  /* أعمدة النتائج — يكتبها المحرك */
  out: {
    status:         'الحالة',
    score:          'الدرجة الآلية',
    verdict:        'نتيجة الفحص',
    violations:     'المخالفات الباقية',
    overall:        'الدرجة النهائية',
    rounds:         'الدورات',
    words:          'عدد الكلمات',
    vs_reference:   'مقارنة بالمرجع',
    meta_title:     'Meta Title',
    meta_desc:      'Meta Description',
    article:        'المقال',
    audit:          'تقرير التدقيق',
    minutes:        'محضر الاجتماع',
    sources:        'المصادر',
    finished_at:    'وقت التنفيذ',
    run_id:         'رقم التشغيل'
  },

  /* القيم التي تُعتبر «شغّل الآن» في خانة تشغيل */
  truthy: ['TRUE', 'true', 'نعم', '1', '✔', '✓', 'x', 'X', 'yes'],
  max_cell_chars: 45000
};
