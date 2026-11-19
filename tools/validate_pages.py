"""Validate content for the organic-growth page types.

  python3 -I tools/validate_pages.py glossary  content/glossary/*.json
  python3 -I tools/validate_pages.py notes     content/notes/*.json
  python3 -I tools/validate_pages.py topics    content/topics/*.json
  python3 -I tools/validate_pages.py interview content/interview/*.json

Formats are described in the briefs (tools/briefs/*.md). Checks: required fields, lengths, word counts,
slug format, uniqueness across all files given, links to real exams/chapters/courses, banned wording.
"""
import json, sys, os, re, glob, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = json.load(open(os.path.join(ROOT, 'content', 'catalog.json'), encoding='utf-8'))
EXAM_IDS = {x['id'] for x in CAT['EXAMS'] if not x.get('noindex')}
QB = {}
for f in glob.glob(os.path.join(ROOT, 'js', 'data', 'qbank', '*.json')): QB.update(json.load(open(f, encoding='utf-8')))
CHAPTERS = {k: list(dict.fromkeys(q[0] for q in v)) for k, v in QB.items()}
COURSES = {c['slug'] for c in json.load(open(os.path.join(ROOT, 'content', 'softskills', 'courses.json'), encoding='utf-8'))['courses']}
SLUG = re.compile(r'[a-z0-9]+(-[a-z0-9]+)*$')
BANNED = re.compile(r'guarantee[ds]? (returns?|pass|success|job|selection)|100% (pass|success|selection)|previous[- ]year question|actual exam question|leaked|risk[- ]free return', re.I)
words = lambda *parts: len(' '.join(str(p) for p in parts).split())

def common(it, errs, seen):
    for k in ('title', 'description'):
        if not it.get(k): errs.append(f'missing {k}')
    t, d = it.get('title', ''), it.get('description', '')
    if len(t) > 60: errs.append(f'title {len(t)} > 60 chars')
    if d and not 120 <= len(d) <= 158: errs.append(f'description {len(d)} chars (120–158)')
    if t in seen['title']: errs.append('duplicate title')
    if d in seen['desc']: errs.append('duplicate description')
    seen['title'].add(t); seen['desc'].add(d)
    for m in BANNED.finditer(json.dumps(it, ensure_ascii=False)): errs.append(f'banned wording: {m.group(0)}')
    for f in it.get('faqs', []):
        if not (isinstance(f, list) and len(f) == 2 and 20 <= len(f[1].split()) <= 90): errs.append('faq must be [question, answer of 20–90 words]')

def mcq(q, tag, errs):
    if not (isinstance(q, list) and len(q) == 4 and isinstance(q[1], list) and len(q[1]) == 4 and q[2] in (0, 1, 2, 3) and len(q[3].split()) >= 10):
        errs.append(f'{tag}: practice item must be [question, [4 options], index 0-3, explanation ≥10 words]')

def check(kind, it, errs, seen, all_slugs):
    common(it, errs, seen)
    if kind == 'glossary':
        for k in ('slug', 'term', 'category', 'short', 'body', 'example', 'related', 'exams', 'faqs'):
            if k not in it: errs.append(f'missing {k}')
        if errs: return
        if not SLUG.match(it['slug']): errs.append('bad slug')
        if it['slug'] in seen['slug']: errs.append('duplicate slug')
        seen['slug'].add(it['slug'])
        if it['category'] not in ('Mutual funds', 'Securities markets', 'Derivatives', 'Banking', 'Insurance', 'Personal finance', 'Economy', 'Regulation & compliance', 'Investment advisory'):
            errs.append(f'unknown category {it["category"]}')
        if not 8 <= len(it['short'].split()) <= 40: errs.append('short definition must be 8–40 words')
        wc = words(it['short'], *it['body'], it['example'])
        if not 230 <= wc <= 650: errs.append(f'{wc} words (230–650)')
        if not 3 <= len(it['related']) <= 8: errs.append('related needs 3–8 slugs')
        bad = [x for x in it['exams'] if x not in EXAM_IDS]
        if bad: errs.append(f'unknown exam ids {bad}')
        if len(it['faqs']) != 2: errs.append('need exactly 2 faqs')
    elif kind == 'notes':
        for k in ('exam', 'chapter', 'intro', 'points', 'traps', 'recap'):
            if k not in it: errs.append(f'missing {k}')
        if errs: return
        if it['exam'] not in EXAM_IDS: errs.append('unknown exam id')
        elif it['chapter'] not in CHAPTERS.get(it['exam'], []): errs.append(f'chapter not in paid bank: {it["chapter"]}')
        key = (it['exam'], it['chapter'])
        if key in seen['slug']: errs.append('duplicate exam+chapter')
        seen['slug'].add(key)
        if not 8 <= len(it['points']) <= 16: errs.append('points: 8–16 items')
        if not 3 <= len(it['traps']) <= 6: errs.append('traps: 3–6 items')
        wc = words(it['intro'], *[p.get('heading', '') + ' ' + p.get('text', '') for p in it['points']], *it.get('formulas', []), *it['traps'], it['recap'])
        if not 450 <= wc <= 1100: errs.append(f'{wc} words (450–1100)')
        for p in it['points']:
            if not (isinstance(p, dict) and p.get('heading') and p.get('text')): errs.append('each point needs heading + text'); break
    elif kind == 'topics':
        for k in ('slug', 'section', 'topic', 'intro', 'concepts', 'shortcuts', 'examples', 'practice', 'exams', 'faqs'):
            if k not in it: errs.append(f'missing {k}')
        if errs: return
        if not SLUG.match(it['slug']): errs.append('bad slug')
        if it['slug'] in seen['slug']: errs.append('duplicate slug')
        seen['slug'].add(it['slug'])
        if it['section'] not in ('Quantitative Aptitude', 'Reasoning', 'English Language', 'General Awareness', 'Data Interpretation'): errs.append('unknown section')
        if not 2 <= len(it['concepts']) <= 6: errs.append('concepts: 2–6')
        if not 3 <= len(it['examples']) <= 6: errs.append('examples: 3–6 worked examples')
        if len(it['practice']) != 5: errs.append('practice: exactly 5 questions')
        for i, q in enumerate(it['practice']): mcq(q, f'practice {i + 1}', errs)
        bad = [x for x in it['exams'] if x not in EXAM_IDS]
        if bad: errs.append(f'unknown exam ids {bad}')
        wc = words(it['intro'], *[c.get('heading', '') + ' ' + c.get('text', '') for c in it['concepts']], *it['shortcuts'], *[x.get('question', '') + ' ' + x.get('solution', '') for x in it['examples']])
        if not 550 <= wc <= 1500: errs.append(f'{wc} words (550–1500)')
        if len(it['faqs']) != 2: errs.append('need exactly 2 faqs')
    elif kind == 'interview':
        for k in ('slug', 'question', 'category', 'why_asked', 'how_to_answer', 'samples', 'mistakes', 'follow_ups', 'course', 'faqs'):
            if k not in it: errs.append(f'missing {k}')
        if errs: return
        if not SLUG.match(it['slug']): errs.append('bad slug')
        if it['slug'] in seen['slug']: errs.append('duplicate slug')
        seen['slug'].add(it['slug'])
        if it['category'] not in ('HR basics', 'Freshers', 'Banking jobs', 'Finance & advisory', 'Sales roles', 'Behavioural', 'Salary & offers'): errs.append('unknown category')
        if it['course'] not in COURSES: errs.append(f'unknown course {it["course"]}')
        if not 3 <= len(it['how_to_answer']) <= 6: errs.append('how_to_answer: 3–6 steps')
        if not 2 <= len(it['samples']) <= 3: errs.append('samples: 2–3')
        for s_ in it['samples']:
            if not (isinstance(s_, dict) and s_.get('who') and 40 <= len(s_.get('answer', '').split()) <= 180): errs.append('each sample needs who + answer of 40–180 words'); break
        if not 3 <= len(it['mistakes']) <= 6: errs.append('mistakes: 3–6')
        wc = words(it['why_asked'], *it['how_to_answer'], *[x.get('answer', '') for x in it['samples']], *it['mistakes'], *it['follow_ups'])
        if not 400 <= wc <= 1100: errs.append(f'{wc} words (400–1100)')
        if len(it['faqs']) != 2: errs.append('need exactly 2 faqs')

BLOG_CATS = ('MBA', 'AI', 'Stock Market', 'Mutual Funds', 'Trading')
TOOL_SLUGS = {'ctc-to-in-hand-salary-calculator', 'sip-calculator', 'emi-calculator', 'exam-score-calculator', 'nism-certificate-validity-checker'}
def known_slugs(folder):
    out = set()
    for f in glob.glob(os.path.join(ROOT, 'content', folder, '*.json')):
        out |= {it.get('slug') for it in json.load(open(f, encoding='utf-8')).get('items', [])}
    return out
def check_blog(it, errs, seen):
    for k in ('slug', 'category', 'title', 'h1', 'description', 'primary', 'secondary', 'excerpt', 'sections', 'takeaways', 'faqs', 'related'):
        if k not in it: errs.append(f'missing {k}')
    if errs: return
    if not SLUG.match(it['slug']): errs.append('bad slug')
    if it['slug'] in seen['slug']: errs.append('duplicate slug')
    seen['slug'].add(it['slug'])
    if it['category'] not in BLOG_CATS: errs.append(f'category must be one of {BLOG_CATS}')
    if it['primary'].lower() not in (it['title'] + ' ' + it['h1'] + ' ' + it['excerpt']).lower(): errs.append('primary keyword not in title/h1/excerpt')
    if not 30 <= len(it['excerpt'].split()) <= 80: errs.append('excerpt 30–80 words')
    if not 5 <= len(it['sections']) <= 10: errs.append('sections: 5–10')
    for s_ in it['sections']:
        if not s_.get('heading') or not s_.get('paragraphs'): errs.append('each section needs heading + paragraphs'); break
        t = s_.get('table')
        if t and not (isinstance(t, dict) and t.get('head') and t.get('rows') and all(len(r) == len(t['head']) for r in t['rows'])): errs.append(f'bad table in "{s_["heading"]}"')
    wc = words(it['excerpt'], *[' '.join(s_.get('paragraphs', []) + s_.get('bullets', [])) for s_ in it['sections']], *it['takeaways'])
    if not 1100 <= wc <= 2200: errs.append(f'{wc} words (1100–2200)')
    if not 3 <= len(it['takeaways']) <= 6: errs.append('takeaways: 3–6')
    if len(it['faqs']) != 3: errs.append('need exactly 3 faqs')
    r = it['related']
    gl, tp, cs = known_slugs('glossary'), known_slugs('topics'), COURSES
    bad = [x for x in r.get('glossary', []) if x not in gl] + [x for x in r.get('exams', []) if x not in EXAM_IDS] + [x for x in r.get('tools', []) if x not in TOOL_SLUGS] + [x for x in r.get('topics', []) if x not in tp] + [x for x in r.get('courses', []) if x not in cs]
    if bad: errs.append(f'unknown related slugs/ids: {bad}')
    if sum(len(v) for v in r.values()) < 3: errs.append('related: at least 3 internal links in total')

kind, paths = sys.argv[1], sys.argv[2:]
items = []
for p in paths:
    try: items += [(os.path.basename(p), it) for it in json.load(open(p, encoding='utf-8'))['items']]
    except Exception as e: print(f'{p}: cannot read — {e}'); sys.exit(1)
seen, ok = collections.defaultdict(set), True
all_slugs = {it.get('slug') for _, it in items}
for fname, it in items:
    errs = []
    (check_blog(it, errs, seen) if kind == 'blog' else None) if kind == 'blog' else check(kind, it, errs, seen, all_slugs)
    if kind == 'blog': common(it, errs, seen)
    name = it.get('slug') or f"{it.get('exam')}/{it.get('chapter')}"
    if errs: ok = False; print(f'{fname} {name}:'); [print('   ', x) for x in errs[:12]]
if kind == 'glossary':
    missing = sorted({r for _, it in items for r in it.get('related', []) if r not in all_slugs})
    if missing: print(f'note: {len(missing)} related slugs not defined in these files (fine if another file defines them): {missing[:15]}')
print(f'{len(items)} items checked — {"OK" if ok else "ERRORS"}')
sys.exit(0 if ok else 1)
