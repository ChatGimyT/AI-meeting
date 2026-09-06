#!/usr/bin/env python3
"""يستخرج قوائم الكلمات المفتاحية من ملف الإكسل إلى JSON يقرأه build.mjs.

قواعد القراءة:
  A = رقم | B = الكلمة | C = SV (السعودية/الكويت) | D = KD | E = المقالة/القسم
  الصفوف الفاضية بتفصل بين المجموعات.

الاستخدام:  python3 extract-keywords.py
الخرج:      keywords/alojan.json  +  keywords/shoug.json
"""
import json, os, re, sys, unicodedata

try:
    import openpyxl
except ImportError:
    sys.exit('openpyxl مش متسطّب:  pip install openpyxl')

HERE = os.path.dirname(os.path.abspath(__file__))
XLSX = os.path.join(HERE, 'keywords', 'source.xlsx')

# ---------------------------------------------------------------- تطبيع النص
ZERO_WIDTH = ''.join(chr(c) for c in (0x200B, 0x200C, 0x200D, 0x200E, 0x200F,
                                      0x202A, 0x202B, 0x202C, 0x202D, 0x202E,
                                      0x2066, 0x2067, 0x2068, 0x2069, 0xFEFF))
TATWEEL = 'ـ'
HARAKAT = re.compile(r'[ؐ-ًؚ-ٰٟۖ-ۭ]')


def clean(v):
    """ينضّف نص الكلمة: يشيل المحارف الخفية والتشكيل والمسافات المكررة.

    ملحوظة: مش بنوحّد الألف/التاء المربوطة هنا — الكلمة بتتبعت لجوجل زي ما
    الكلاينت كاتبها بالظبط، والتوحيد بيحصل وقت المقارنة بس (في n8n)."""
    if v is None:
        return ''
    s = unicodedata.normalize('NFKC', str(v))
    s = ''.join(ch for ch in s if ch not in ZERO_WIDTH)
    s = s.replace(TATWEEL, '')
    s = HARAKAT.sub('', s)
    return re.sub(r'\s+', ' ', s).strip()


def sv(v):
    """عمود حجم البحث: رقم → رقم | '-' أو فاضي → ''."""
    if v is None:
        return ''
    if isinstance(v, (int, float)):
        return int(v) if float(v).is_integer() else float(v)
    s = clean(v)
    if s in ('', '-', '—', '–', 'N/A', 'n/a'):
        return ''
    m = re.sub(r'[^\d.]', '', s)
    if not m:
        return ''
    f = float(m)
    return int(f) if f.is_integer() else f


def read_blocks(ws, last_row):
    """يرجّع قائمة مجموعات؛ كل مجموعة = صفوف متتالية من غير سطر فاضي."""
    blocks, cur = [], []
    for r in range(2, last_row + 1):
        kw = clean(ws.cell(r, 2).value)
        if not kw:
            if cur:
                blocks.append(cur)
                cur = []
            continue
        cur.append({
            'row': r,
            'keyword': kw,
            'sv': sv(ws.cell(r, 3).value),
            'kd': sv(ws.cell(r, 4).value),
            'article': clean(ws.cell(r, 5).value),
        })
    if cur:
        blocks.append(cur)
    return blocks


# ------------------------------------------------- خرائط الأقسام لكل مشروع
# أسماء الأقسام مربوطة بترتيب المجموعات في الإكسل، ومعاها العدد المتوقع
# عشان لو الإكسل اتغيّر السكريبت يقف بصوت عالي بدل ما يطلّع أقسام غلط.
ALOJAN_GROUPS = [
    ('أورام المخ والحبل الشوكي', 8),
    ('الاستسقاء الدماغي',        8),
    ('التحام عظام الجمجمة',      2),
    ('الدروز الجبهي',            1),
    ('تجميل الجمجمة',            1),
    ('الرئيسية — كلمات تجارية',  15),
]

# شوق: اسم القسم موجود في عمود E نفسه، بس بنظبّط الاسم المبهم "مقال".
SHOUG_SECTION_FIX = {
    'مقال': 'مقال: أفضل محامية في الكويت',
}

# روابط الصفحات المعروفة (من الأوتوميشن القديم — متأكدين منها).
# أي قسم مش هنا بيتساب من غير رابط، والكود في n8n بياخد أعلى صفحة ظاهرة
# للكلمة تلقائيًا بدل ما يرجّع خانة فاضية.
SHOUG_PAGES = {
    'الصفحة الرئيسية': 'https://shoug-lawyer.com/',
    'قضايا الأحوال الشخصية والأسرة':
        'https://shoug-lawyer.com/service/'
        '%D9%85%D8%AD%D8%A7%D9%85%D9%8A-%D8%A7%D8%AD%D9%88%D8%A7%D9%84-'
        '%D8%B4%D8%AE%D8%B5%D9%8A%D8%A9-%D9%88%D9%82%D8%B6%D8%A7%D9%8A%D8%A7-'
        '%D8%B7%D9%84%D8%A7%D9%82-%D8%A7%D9%84%D9%83%D9%88%D9%8A%D8%AA',
    'مقال: أفضل محامية في الكويت':
        'https://shoug-lawyer.com/blog/'
        '%D8%A7%D9%81%D8%B6%D9%84-%D9%85%D8%AD%D8%A7%D9%85%D9%8A%D8%A9-'
        '%D9%81%D9%8A-%D8%A7%D9%84%D9%83%D9%88%D9%8A%D8%AA',
}


def build_alojan(ws):
    blocks = read_blocks(ws, 41)
    if len(blocks) != len(ALOJAN_GROUPS):
        sys.exit(f'العوجان: عدد المجموعات في الإكسل {len(blocks)} '
                 f'والمتوقع {len(ALOJAN_GROUPS)} — راجع الملف.')
    out = []
    for (name, expected), block in zip(ALOJAN_GROUPS, blocks):
        if len(block) != expected:
            sys.exit(f'العوجان: مجموعة "{name}" فيها {len(block)} كلمة '
                     f'والمتوقع {expected} — راجع الملف.')
        for item in block:
            out.append({
                'group': name,
                'page': '',              # مفيش روابط مؤكدة للعوجان
                'keyword': item['keyword'],
                'sv': item['sv'],
                'article': item['article'],
            })
    return out


def build_shoug(ws):
    out = []
    for block in read_blocks(ws, 32):
        for item in block:
            section = SHOUG_SECTION_FIX.get(item['article'], item['article'])
            if not section:
                sys.exit(f'شوق: الصف {item["row"]} من غير قسم في عمود E.')
            out.append({
                'group': section,
                'page': SHOUG_PAGES.get(section, ''),
                'keyword': item['keyword'],
                'sv': item['sv'],
                'article': item['article'],
            })
    return out


def check_duplicates(name, rows):
    seen = {}
    for r in rows:
        key = r['keyword']
        if key in seen:
            sys.exit(f'{name}: الكلمة "{key}" مكررة (قسم {seen[key]} و{r["group"]}).')
        seen[key] = r['group']


def main():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    projects = {
        'alojan': build_alojan(wb['العوجان']),
        'shoug':  build_shoug(wb['شوق']),
    }
    for name, rows in projects.items():
        check_duplicates(name, rows)
        path = os.path.join(HERE, 'keywords', f'{name}.json')
        with open(path, 'w', encoding='utf-8') as fh:
            json.dump(rows, fh, ensure_ascii=False, indent=2)
            fh.write('\n')
        groups = []
        for r in rows:
            if r['group'] not in groups:
                groups.append(r['group'])
        print(f'{name}: {len(rows)} كلمة في {len(groups)} قسم → {path}')
        for g in groups:
            print(f'    - {g}: {sum(1 for r in rows if r["group"] == g)}')


if __name__ == '__main__':
    main()
