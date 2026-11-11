"""Validate exam guide files: python3 -I tools/validate_guides.py content/guides/*.json
Each file: {"guides": [{slug, exam, title, description, primary, secondary, intro, sections:[{heading, paragraphs:[...], bullets?:[...]}], faqs:[[q, a] x3]}]}
"""
import json, sys, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDS = {x['id'] for x in json.load(open(os.path.join(ROOT, 'content', 'catalog.json')))['EXAMS']}
ok, slugs, titles = True, set(), set()
BANNED = re.compile(r'guarantee|100% pass|previous year question|actual exam question|leaked', re.I)
for path in sys.argv[1:]:
    for g in json.load(open(path, encoding='utf-8'))['guides']:
        errs = []
        for k in ('slug', 'exam', 'title', 'description', 'primary', 'secondary', 'intro', 'sections', 'faqs'):
            if k not in g: errs.append(f'missing {k}')
        if errs: print(path, g.get('slug'), errs); ok = False; continue
        if g['exam'] not in IDS: errs.append('unknown exam id')
        if not re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', g['slug']): errs.append('slug must be lowercase-hyphenated')
        if g['slug'] in slugs: errs.append('duplicate slug')
        if g['title'] in titles: errs.append('duplicate title')
        slugs.add(g['slug']); titles.add(g['title'])
        if len(g['title']) > 60: errs.append(f'title {len(g["title"])} > 60 chars')
        if not 130 <= len(g['description']) <= 158: errs.append(f'description {len(g["description"])} chars (130–158)')
        if not 4 <= len(g['sections']) <= 9: errs.append('need 4–9 sections')
        text = g['intro'] + ' ' + ' '.join(' '.join(s.get('paragraphs', []) + s.get('bullets', [])) for s in g['sections'])
        wc = len(text.split())
        if not 1000 <= wc <= 1800: errs.append(f'{wc} words in body (1000–1800)')
        if len(g['faqs']) != 3: errs.append('need exactly 3 faqs')
        if g['primary'].lower() not in (g['title'] + ' ' + g['intro']).lower(): errs.append('primary keyword not in title/intro')
        for m in BANNED.finditer(text + json.dumps(g['faqs'])): errs.append(f'banned wording: {m.group(0)}')
        if errs: ok = False; print(g['slug'], errs)
        else: print(g['slug'], f'OK ({wc} words)')
sys.exit(0 if ok else 1)
