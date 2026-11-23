"""Build the crawlable pages, sitemap and app data for success4sure.in.

Run from the project root:  python3 -I tools/build_site.py

Inputs : content/catalog.json, content/exam-pages.json, content/site.json, js/data/qbank/*.json
Outputs: js/data/exams.js, js/data/qbank.js, index.html (SEO head + fallback content),
         exams/**, study-material/, about/, how-we-create-questions/, contact/,
         privacy-policy/, terms/, disclaimer/, sitemap.xml, robots.txt
"""
import datetime, glob, html, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = datetime.date.today()
YEAR = TODAY.year
DATE_HUMAN = TODAY.strftime('%-d %B %Y')
ASSET_V = datetime.datetime.now().strftime('%Y%m%d%H%M')  # changes on every build so browsers fetch fresh CSS/JS

def rd(p): return json.load(open(os.path.join(ROOT, p), encoding='utf-8'))
def wr(p, s):
    p = os.path.join(ROOT, p); os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, 'w', encoding='utf-8').write(s)
e = lambda s: html.escape(str(s), quote=True)

CAT = rd('content/catalog.json')
COPY = rd('content/exam-pages.json')
SITE = rd('content/site.json')
BASE = SITE['url'].rstrip('/')
PLANS, GROUPS, EXAMS = CAT['PLANS'], CAT['GROUPS'], CAT['EXAMS']
GROUP = {g['id']: g for g in GROUPS}
NISM_PORTAL = 'https://api.nism.ac.in/cmp/'
warnings = []

# ---------- exam helpers ----------
for x in EXAMS:
    if x['group'] == 'NISM':
        x['links'] = [
            {'label': 'Free official workbook (PDF)', 'url': NISM_PORTAL, 'kind': 'pdf'},
            {'label': 'Exam details & test objectives', 'url': 'https://www.nism.ac.in/' + x['page'], 'kind': 'info'},
        ]

def slugify(s): return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
def code(x): return ('NISM ' + x['series']) if x['group'] == 'NISM' else x['series']
def short_name(x):
    n = re.sub(r'\s*\([^)]*\)', '', x['name']).replace('–', ' ')
    return ' '.join(n.split()[:6])
def exam_slug(x):
    return slugify(f"nism {x['series']} {short_name(x)}") if x['group'] == 'NISM' else slugify(x['series'])
for x in EXAMS: x['slug'] = exam_slug(x) + '-mock-test'
def exam_url(x): return f"/exams/{x['slug']}/"
def group_url(g): return f"/exams/{g['slug']}/"
def competitive(x): return bool(GROUP[x['group']].get('competitive'))
def per_day(x): return x.get('mocksPerDay', 1)
def max_mocks(x): return CAT['MAX_TESTS'] * per_day(x)
def neg_text(x):
    p = x['pattern']; mpq = p['marks'] / p['questions']
    if not p['negative']: return 'No negative marking'
    return f"−{round(p['negative'] * mpq, 2):g} mark per wrong answer"
INDEXABLE = [x for x in EXAMS if not x.get('noindex')]

# ---------- SEO keyword targets (content/seo/*.json, optional) ----------
SEO = {'exams': {}, 'groups': {}, 'hub': {}, 'skills_hub': {}, 'courses': {}, 'lessons': {}}
for f in sorted(glob.glob(os.path.join(ROOT, 'content', 'seo', '*.json'))):
    d = json.load(open(f, encoding='utf-8'))
    for k in ('exams', 'groups', 'courses', 'lessons'): SEO[k].update(d.get(k, {}))
    if os.path.basename(f) == 'exams.json': SEO['hub'] = d.get('hub', {})
    elif d.get('hub'): SEO['skills_hub'] = d['hub']
def seo_title(t):
    t2 = f"{t} | {SITE['name']}"
    return t2 if len(t2) <= 70 else t
def practice_url(x): return exam_url(x) + 'practice-questions/'
PRACTICE_N = 15

# ---------- question bank ----------
QB = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'js', 'data', 'qbank', '*.json'))):
    QB.update(json.load(open(f, encoding='utf-8')))

def chapters(x):
    out = {}
    for q in QB.get(x['id'], []): out[q[0]] = out.get(q[0], 0) + 1
    return out

def samples(x, n=5):
    qs, seen, pick = QB.get(x['id'], []), set(), []
    for q in qs:
        if q[0] not in seen: pick.append(q); seen.add(q[0])
        if len(pick) == n: return pick
    for q in qs:
        if q not in pick: pick.append(q)
        if len(pick) == n: break
    return pick

# ---------- reviewers (only real, configured people) ----------
def reviewers_for(x):
    return [r for r in SITE.get('reviewers', []) if r.get('name') and ('*' in r.get('exams', []) or x['id'] in r.get('exams', []))]

# ---------- page shell ----------
NAV = [('/exams/', 'All Exams')] + [(group_url(g), 'MBA' if g['id'] == 'MBA' else g['label']) for g in GROUPS if g['id'] != 'Insurance & Finance'] + [('/soft-skills/', 'Soft Skills'), ('/blog/', 'Blogs'), ('/tools/', 'Free Tools'), ('/study-material/', 'Study Material')]

def org_ld():
    o = {'@type': 'Organization', '@id': BASE + '/#org', 'name': SITE['name'], 'url': BASE + '/'}
    b = SITE.get('business', {})
    if b.get('legalName'): o['legalName'] = b['legalName']
    if b.get('email'): o['email'] = b['email']
    if b.get('phone'): o['telephone'] = b['phone']
    if b.get('address'): o['address'] = b['address']
    return o

def breadcrumb_ld(items):
    return {'@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': BASE + u} for i, (n, u) in enumerate(items)]}

def crumbs_html(items):
    parts = [f'<a href="{e(u)}">{e(n)}</a>' for n, u in items[:-1]] + [f'<span aria-current="page">{e(items[-1][0])}</span>']
    return '<nav class="crumbs" aria-label="Breadcrumb">' + ' <span class="sep">›</span> '.join(parts) + '</nav>'

def page(path, title, desc, body, ld=None, noindex=False, active='', lang='en-IN', alternates=None):
    canonical = BASE + path
    graph = [org_ld()] + (ld or [])
    nav = ''.join(f'<a href="{u}" class="{"active" if u == active else ""}">{e(t)}</a>' for u, t in NAV)
    return f'''<!doctype html>
<html lang="{lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(title)}</title>
  <meta name="description" content="{e(desc)}">
  <link rel="canonical" href="{canonical}">
{''.join(f'  <link rel="alternate" hreflang="{k}" href="{BASE}{v}">' + chr(10) for k, v in (alternates or {}).items())}  <meta name="robots" content="{'noindex, follow' if noindex else 'index, follow, max-image-preview:large'}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="{e(SITE['name'])}">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(desc)}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:locale" content="{lang.replace('-', '_')}">
  <meta name="twitter:card" content="summary">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@500;600&family=Noto+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/styles.css?v={ASSET_V}">
  <script type="application/ld+json">{json.dumps({'@context': 'https://schema.org', '@graph': graph}, ensure_ascii=False)}</script>
</head>
<body class="static">
  <a class="skip" href="#main">Skip to content</a>
  <header class="topbar"><div class="wrap topbar-inner">
    <a href="/" class="brand"><span class="brand-mark">S<i>4</i></span><span class="brand-name">Success<b>4</b>Sure</span></a>
    <nav class="nav"><div class="nav-links">{nav}</div><div class="nav-right" style="margin-left:auto"><a href="/#/login" class="btn btn-primary btn-sm">Login / Sign up</a></div></nav>
  </div></header>
  <main id="main">
{body}
  </main>
{footer()}
</body>
</html>
'''

def footer():
    pop = [x for x in EXAMS if x.get('popular')][:6]
    return f'''  <footer class="footer">
    <div class="wrap footer-grid">
      <div>
        <a href="/" class="brand"><span class="brand-mark">S<i>4</i></span><span class="brand-name">Success<b>4</b>Sure</span></a>
        <p class="footer-tag">Exam-pattern mock tests with clear explanations for NISM, banking, SSC, MBA entrance and insurance exams.</p>
      </div>
      <div>
        <h4>Popular exams</h4>
        {''.join(f'<a href="{exam_url(x)}">{e(code(x))} mock test</a>' for x in pop)}
      </div>
      <div>
        <h4>Free resources</h4>
        <a href="/study-material/">Free study material</a>
        <a href="/guides/">Exam preparation guides</a>
        <a href="/blog/">Blogs</a>
        <a href="/nfo/">New Fund Offers (NFOs)</a>
        <a href="/govt-exams/">Govt exams open now</a>
        <a href="/glossary/">Finance glossary</a>
        <a href="/topics/">Bank &amp; SSC topics</a>
        <a href="/interview-questions/">Interview questions</a>
        <a href="/tools/">Free calculators</a>
        <a href="/soft-skills/">Soft skills courses</a>
        <a href="/#/daily">Question of the day</a>
      </div>
      <div>
        <h4>Company</h4>
        <a href="/about/">About us</a>
        <a href="/how-we-create-questions/">How we create questions</a>
        <a href="/contact/">Contact</a>
        <a href="/privacy-policy/">Privacy policy</a>
        <a href="/terms/">Terms of use</a>
        <a href="/disclaimer/">Disclaimer</a>
      </div>
    </div>
    <div class="wrap footer-legal">{e(SITE['name'])} is an independent practice platform and is not affiliated with, endorsed by, or connected to NISM, SEBI, IBPS, SBI, RBI, SSC, the IIMs, NTA, AIMA, IRDAI, the Insurance Institute of India, NSE or IIBF. All questions are original practice questions based on publicly available syllabi; they are not actual exam questions.</div>
  </footer>'''

def plans_table(x):
    q = x['pattern']['questions']
    badge = lambda p: (' <span class="badge">' + e(p['tag']) + '</span>') if p.get('tag') else ''
    rows = ''.join(f"<tr><td><b>{e(p['label'])}</b>{badge(p)}</td><td>{p['tests'] * per_day(x)} mock tests</td><td>{p['tests'] * per_day(x) * q:,} questions</td><td><b>₹{p['price']}</b> <span class=\"muted small\">incl. GST</span></td></tr>" for p in PLANS)
    return f'<div class="table-wrap"><table><tr><th>Plan</th><th>Mock tests</th><th>Questions</th><th>Price</th></tr>{rows}</table></div>'

def exam_row(x):
    p = x['pattern']
    return f"<tr><td><a href=\"{exam_url(x)}\"><b>{e(code(x))}</b></a><div class=\"small muted\">{e(x['name'])}</div></td><td>{p['questions']}</td><td>{p['duration']} min</td><td>{p['passPct']}%</td><td>{e(neg_text(x))}</td></tr>"

def exam_table(xs, target=False):
    return f'<div class="table-wrap"><table><tr><th>Exam</th><th>Questions</th><th>Time</th><th>{"Target" if target else "Pass mark"}</th><th>Negative marking</th></tr>{"".join(exam_row(x) for x in xs)}</table></div>'

# ---------- exam pages ----------
def exam_page(x):
    g, p, c = GROUP[x['group']], x['pattern'], COPY.get(x['id'], {})
    if not c: warnings.append(f"missing page copy for {x['id']}")
    ch, smp, revs = chapters(x), samples(x), reviewers_for(x)
    bank = sum(ch.values())
    pw = 'target score' if competitive(x) else 'pass mark'
    title = f"{code(x)} Mock Test {YEAR}: {short_name(x)} | {SITE['name']}"
    if len(title) > 68: title = f"{code(x)} Mock Test {YEAR} – Practice Questions | {SITE['name']}"
    if len(title) > 68: title = f"{code(x)} Mock Test {YEAR} | {SITE['name']}"
    desc = (f"Prepare for {code(x)} ({x['name']}) with up to {max_mocks(x)} full-length mock tests of {p['questions']} questions, "
            f"chapter-wise analysis and an explanation for every answer. 100% free with a one-click sign-up.")
    kw = SEO['exams'].get(x['id'], {})
    if kw.get('title'): title = seo_title(kw['title'])
    if kw.get('description'): desc = kw['description']
    crumbs = [('Home', '/'), ('Exams', '/exams/'), (g['label'], group_url(g)), (code(x), exam_url(x))]
    faqs = [
        (f"How many questions are there in the {code(x)} exam?", f"The {code(x)} paper has {p['questions']} multiple-choice questions for {p['marks']} marks, to be completed in {p['duration']} minutes. This is the indicative pattern — always confirm it in the latest official notification."),
        (f"Is there negative marking in {code(x)}?", (f"Yes. {neg_text(x)} ({round(p['negative'] * 100, 1):g}% of the marks for that question)." if p['negative'] else "No. There is no negative marking, so attempt every question.") + " Our mock tests apply the same rule."),
        (f"What is the {pw} for {code(x)}?", (f"Cut-offs vary by year and category; our mock tests use {p['passPct']}% as a target score to aim for." if competitive(x) else f"You need {p['passPct']}% to pass. Our mock tests show pass or fail against the same mark.")),
        (f"Are the {code(x)} mock tests free?", f"Yes. All {max_mocks(x)} full-length {code(x)} mock tests are free, with no payment or plan. Create a free account (one click with Google) to start; your results are saved across devices. You can retake any test as often as you like."),
        *[tuple(f) for f in kw.get('faqs', [])],
        ("Are these the actual exam questions?", "No. Every question is an original practice question written to match the official syllabus and the exam's style. Reproducing real exam questions is not permitted, and we do not do it."),
        (f"Where can I get the official {code(x)} study material?", ("NISM provides the latest workbook free of cost on its official portal after a short registration. The link is in the Official study material section on this page." if x['group'] == 'NISM' else "The official syllabus and notifications are published by the conducting body — see the Official resources section on this page.")),
    ]
    related = [y for y in INDEXABLE if y['id'] != x['id'] and (y.get('category') == x.get('category') if x['group'] == 'NISM' else y['group'] == x['group'])][:4]
    if len(related) < 4:
        related += [y for y in INDEXABLE if y['id'] != x['id'] and y['group'] == x['group'] and y not in related][:4 - len(related)]

    def rev_card(r):
        who = ('<a href="' + e(r['profileUrl']) + '" rel="noopener">' + e(r['name']) + '</a>') if r.get('profileUrl') else e(r['name'])
        bio = ('<p class="small">' + e(r['bio']) + '</p>') if r.get('bio') else ''
        return '<div class="reviewer"><b>Reviewed by ' + who + '</b><span class="small muted">' + e(r.get('credentials', '')) + '</span>' + bio + '</div>'
    rev_html = ('<div class="reviewers">' + ''.join(rev_card(r) for r in revs) + '</div>') if revs else ''

    sample_html = ''.join(f'''
        <div class="sample">
          <div class="small muted">Sample {i + 1} · {e(q[0])}</div>
          <p class="sample-q">{e(q[1])}</p>
          <ol class="sample-opts" type="A">{''.join(f'<li>{e(o)}</li>' for o in q[2])}</ol>
          <details><summary>Show answer &amp; explanation</summary><p><b>Answer: {"ABCD"[q[3]]}. {e(q[2][q[3]])}</b></p><p>{e(q[4])}</p></details>
        </div>''' for i, q in enumerate(smp))

    links_html = ''.join(f'<li><a href="{e(l["url"])}" target="_blank" rel="noopener noreferrer">{e(l["label"])}</a></li>' for l in x.get('links', []))
    fr = FREE.get(x['id'], {})
    ch_html = ''.join(f'<li><span>{(chr(60) + "a href=" + chr(34) + chapter_url(x, n) + chr(34) + chr(62) + e(n) + "</a>") if n in fr else e(n)}</span><span class="muted small">{k} practice questions</span></li>' for n, k in ch.items())
    gl = guides_for(x)
    guides_html = ('<section><h2>' + e(code(x)) + ' preparation guides</h2><ul class="related">' + ''.join(f'<li><a href="{guide_url(gd)}">{e(gd["title"])}</a></li>' for gd in gl) + '</ul></section>') if gl else ''
    hi_html = f'<p class="small"><a href="{hi_url(x)}" hreflang="hi-IN" lang="hi">{e(HI[x["id"]]["name"])} — हिंदी में पढ़ें</a></p>' if x['id'] in HI else ''

    body = f'''    <section class="page-hero"><div class="wrap">
      {crumbs_html(crumbs)}
      <h1>{e(code(x))} Mock Test: {e(x['name'])}</h1>
      <p class="lead-left">{e(kw['intro']) if kw.get('intro') else f"Up to {max_mocks(x)} full-length mock tests of {p['questions']} questions each, built on the official syllabus, with an explanation for every answer."}</p>
      <p class="meta-row small muted">Last updated {DATE_HUMAN} · By the {e(SITE['name'])} editorial team · <a href="/how-we-create-questions/">How we create questions</a></p>
      {rev_html}{hi_html}
      <div class="row" style="margin-top:20px"><a class="btn btn-primary btn-lg" href="/#/test/{x['id']}/1">Start free mock test</a><a class="btn btn-lg" href="/#/test/{x['id']}?demo=1">Try a free demo</a></div>
    </div></section>
    <div class="wrap page prose">
      {f'<div class="notice">{e(x["note"])}</div>' if x.get('note') else ''}
      <section><h2>About the {e(code(x))} exam</h2><p>{e(c.get('about', ''))}</p><p><b>Who should take it:</b> {e(c.get('who', ''))}</p></section>
      <section><h2>{e(code(x))} exam pattern</h2>
        <div class="table-wrap"><table>
          <tr><th>Questions</th><td>{p['questions']} multiple-choice questions</td></tr>
          <tr><th>Total marks</th><td>{p['marks']}</td></tr>
          <tr><th>Duration</th><td>{p['duration']} minutes</td></tr>
          <tr><th>{'Target score' if competitive(x) else 'Passing score'}</th><td>{p['passPct']}%{' (cut-offs vary by year and category)' if competitive(x) else ''}</td></tr>
          <tr><th>Negative marking</th><td>{e(neg_text(x))}</td></tr>
        </table></div>
        <p class="small muted">Indicative pattern. Exam bodies revise patterns — confirm the details in the latest official notification before your exam.</p>
        <p class="small">Check a mock-test score with this pattern in our <a href="/tools/exam-score-calculator/?exam={x['id']}">exam score calculator</a>{' · Already certified? See when it expires with the <a href="/tools/nism-certificate-validity-checker/">NISM certificate validity checker</a>' if x['group'] == 'NISM' else ''}.</p>
      </section>
      <section><h2>Syllabus covered in our {e(code(x))} question bank</h2>
        <p>Our {bank}-question bank for {e(code(x))} covers every {'chapter' if x['group'] == 'NISM' else 'section'} below. Mock tests mix questions across all of them in the same proportion as the real paper.{' Open any ' + ('chapter' if x['group'] == 'NISM' else 'section') + ' for free practice questions on it.' if fr else ''}</p>
        <ul class="chapter-counts">{ch_html}</ul>
      </section>
      <section><h2>Free {e(code(x))} sample questions</h2>
        <p>Try five questions from our bank. Each mock test gives you {p['questions']} like these, with your score, chapter-wise analysis and explanations at the end.</p>
        {sample_html}
        {'' if x.get('noindex') else f'<p><a class="btn" href="{practice_url(x)}">{PRACTICE_N} more free {e(code(x))} practice questions with answers {"&rarr;"}</a></p>'}
      </section>
      <section><h2>Free {e(code(x))} mock tests</h2>
        <p>Take up to {max_mocks(x)} full-length {e(code(x))} mock tests free — each with {p['questions']} questions in {p['duration']} minutes, the real {'pass mark' if not competitive(x) else 'pattern'}{', negative marking' if p['negative'] else ''}, your score, a chapter-wise analysis and an explanation for every answer. No payment — just a free account.</p>
        <div class="row" style="margin-top:16px"><a class="btn btn-primary" href="/#/test/{x['id']}/1">Start Mock Test 1</a><a class="btn" href="/#/exam/{x['id']}">See all {max_mocks(x)} mock tests</a></div>
      </section>
      <section><h2>Official {'study material' if x['group'] == 'NISM' else 'resources'}</h2>
        <ul>{links_html}</ul>
        <p class="small muted">Links open the official website. We do not host or alter official material.</p>
      </section>
      {guides_html}
      <section><h2>{e(code(x))} mock test FAQs</h2>
        {''.join(f'<details class="faq-item"><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in faqs)}
      </section>
      <section><h2>Related exams</h2>
        <ul class="related">{''.join(f'<li><a href="{exam_url(y)}">{e(code(y))} mock test</a> <span class="muted small">— {e(y["name"])}</span></li>' for y in related)}</ul>
      </section>
    </div>'''
    course = {
        '@type': 'Course', 'name': f"{code(x)} Mock Test Series", 'description': c.get('about', desc),
        'provider': {'@id': BASE + '/#org'}, 'inLanguage': 'en-IN', 'url': BASE + exam_url(x),
        'educationalCredentialAwarded': None,
        'isAccessibleForFree': True, 'offers': {'@type': 'Offer', 'price': 0, 'priceCurrency': 'INR', 'availability': 'https://schema.org/InStock', 'category': 'Free'},
        'hasCourseInstance': {'@type': 'CourseInstance', 'courseMode': 'Online', 'courseWorkload': f"PT{p['duration']}M per mock test"},
        'dateModified': TODAY.isoformat(),
    }
    course.pop('educationalCredentialAwarded')
    if revs: course['reviewedBy'] = [{'@type': 'Person', 'name': r['name'], **({'url': r['profileUrl']} if r.get('profileUrl') else {})} for r in revs]
    ld = [breadcrumb_ld(crumbs), course, {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faqs]}]
    alts = {'en-IN': exam_url(x), 'hi-IN': hi_url(x)} if x['id'] in HI else None
    return page(exam_url(x), title, desc, body, ld, noindex=x.get('noindex'), active=group_url(g), alternates=alts)

def practice_questions(x):
    used = {q[1] for q in samples(x)}
    pool = [q for q in QB.get(x['id'], []) if q[1] not in used]
    by_ch = {}
    for q in pool: by_ch.setdefault(q[0], []).append(q)
    pick, k = [], 0
    while len(pick) < PRACTICE_N and any(len(v) > k for v in by_ch.values()):
        for v in by_ch.values():
            if len(v) > k and len(pick) < PRACTICE_N: pick.append(v[k])
        k += 1
    return pick

def practice_page(x):
    g, p, kw = GROUP[x['group']], x['pattern'], SEO['exams'].get(x['id'], {})
    qs = practice_questions(x)
    crumbs = [('Home', '/'), ('Exams', '/exams/'), (g['label'], group_url(g)), (code(x), exam_url(x)), ('Practice questions', practice_url(x))]
    title = seo_title(kw.get('pq_title') or f"{code(x)} Practice Questions with Answers (Free)")
    desc = kw.get('pq_description') or f"Free {code(x)} practice questions with answers and explanations, covering every chapter of the {x['name']} syllabus. Try them, then take a full mock test."
    chs = list(dict.fromkeys(q[0] for q in qs))
    q_html = ''.join(f'''
        <div class="sample" id="q{i + 1}">
          <div class="small muted">Question {i + 1} · {e(q[0])}</div>
          <p class="sample-q">{e(q[1])}</p>
          <ol class="sample-opts" type="A">{''.join(f'<li>{e(o)}</li>' for o in q[2])}</ol>
          <details><summary>Show answer &amp; explanation</summary><p><b>Answer: {"ABCD"[q[3]]}. {e(q[2][q[3]])}</b></p><p>{e(q[4])}</p></details>
        </div>''' for i, q in enumerate(qs))
    body = f'''    <section class="page-hero"><div class="wrap">
      {crumbs_html(crumbs)}
      <h1>{e(code(x))} practice questions with answers</h1>
      <p class="lead-left">{len(qs)} free practice questions for {e(code(x))} ({e(x['name'])}) from {len(chs)} chapters of the syllabus. Try each one, then open the answer to read why it is correct.</p>
      <p class="meta-row small muted">Last updated {DATE_HUMAN} · By the {e(SITE['name'])} editorial team · <a href="/how-we-create-questions/">How we create questions</a></p>
      <div class="row" style="margin-top:20px"><a class="btn btn-primary btn-lg" href="/#/test/{x['id']}?demo=1">Take a free timed demo</a><a class="btn btn-lg" href="{exam_url(x)}">{e(code(x))} mock tests</a></div>
    </div></section>
    <div class="wrap page prose">
      <section><h2>How to use these questions</h2>
        <p>Answer each question before opening the explanation, and note the chapter of every one you get wrong — those are the chapters to revise first. The real {e(code(x))} paper has {p['questions']} questions in {p['duration']} minutes{', with negative marking' if p['negative'] else ''}, so once you are comfortable, practise under time pressure with a full-length mock test.</p>
        <p class="small muted">These are original practice questions written to the official syllabus. They are not actual exam questions.</p>
      </section>
      <section><h2>Free {e(code(x))} practice questions</h2>{q_html}</section>
      {('<section><h2>Practise chapter by chapter</h2><ul class="related">' + ''.join(f'<li><a href="{chapter_url(x, c)}">{e(c)}</a></li>' for c in FREE[x['id']]) + '</ul></section>') if x['id'] in FREE else ''}
      <section><h2>Ready for a full {e(code(x))} mock test?</h2>
        <p>Each mock test has {p['questions']} questions with a timer, your score, chapter-wise analysis and an explanation for every answer. All {max_mocks(x)} mock tests are free.</p>
        <div class="row"><a class="btn btn-primary" href="/#/test/{x['id']}/1">Start a free mock test</a><a class="btn" href="{exam_url(x)}">Exam pattern &amp; syllabus</a></div>
      </section>
    </div>'''
    lr = {'@type': 'LearningResource', 'name': f"{code(x)} practice questions", 'description': desc, 'url': BASE + practice_url(x), 'inLanguage': 'en-IN',
          'learningResourceType': 'Practice questions', 'educationalLevel': 'Professional certification' if x['group'] in ('NISM', 'Insurance & Finance') else 'Competitive exam',
          'isAccessibleForFree': True, 'provider': {'@id': BASE + '/#org'}, 'dateModified': TODAY.isoformat(), 'about': x['name']}
    alts = {'en-IN': practice_url(x), 'hi-IN': hi_url(x, True)} if x['id'] in HI else None
    return page(practice_url(x), title, desc, body, [breadcrumb_ld(crumbs), lr], active=group_url(g), alternates=alts)

# ---------- group & hub pages ----------
GROUP_INTRO = {
    'NISM': "NISM (National Institute of Securities Markets) certifications are required by SEBI for many roles in India's securities market — mutual fund distribution, derivatives dealing, investment advice, research, depository and broking operations, compliance, AIFs and PMS. Pick your series below for its pattern, syllabus, free sample questions and mock test plans.",
    'Banking': "Bank recruitment exams from IBPS, SBI and RBI start with a timed preliminary paper of English, quantitative aptitude and reasoning (with general awareness for RBI Grade B). Speed and accuracy under sectional timing decide the cut-off, so full-length practice matters.",
    'SSC': "Staff Selection Commission exams recruit for central government posts. Tier 1 papers test reasoning, general awareness, quantitative aptitude and English, with negative marking — practice under exam conditions helps you balance speed and accuracy.",
    'MBA': "MBA entrance exams test verbal ability, data interpretation, logical reasoning and quantitative skills under tight time limits. CAT is the most competitive; CMAT and MAT add general awareness and a broader set of sections.",
    'Insurance & Finance': "Professional certifications for insurance agents, capital market dealers and bankers — IRDAI IC-38, the NCFM Capital Market (Dealers) Module, and IIBF's JAIIB and CAIIB.",
}

GROUP_GUIDE = {
    'NISM': [
        ("How to prepare for a NISM exam", "Read NISM's free official workbook for your series first — the exam is set from it. Then take full-length mock tests under the real time limit, review every explanation, and use the chapter-wise score to go back to weak chapters before the next test. Most NISM exams carry negative marking of 25% per wrong answer, so practise skipping questions you are unsure of."),
        ("What our NISM mock tests include", "Each mock test has the same number of questions, time limit, pass mark and negative marking as the real NISM exam. Questions are spread across every workbook chapter, and every answer has an explanation."),
    ],
    'Banking': [
        ("How to prepare for bank prelims", "Bank prelims reward speed. Learn the common question types in each section — seating puzzles, inequalities and syllogisms in reasoning; simplification, series, data interpretation and arithmetic in quant; reading comprehension, cloze and error spotting in English — then practise full papers against the clock and track sectional accuracy."),
        ("What our banking mock tests include", "Full-length papers with English, quantitative aptitude and reasoning (plus general awareness for RBI Grade B), the official question count and time, negative marking, and worked solutions for every quant and reasoning question."),
    ],
    'SSC': [
        ("How to prepare for SSC Tier 1", "SSC papers test breadth: static general awareness (polity, history, geography, science), arithmetic and algebra, reasoning patterns and English usage. Revise static GK regularly, learn quant shortcuts, and take timed mock tests to manage negative marking."),
        ("What our SSC mock tests include", "Tier 1–style papers across all four sections with the official question count, duration and negative marking, and an explanation for every answer."),
    ],
    'MBA': [
        ("How to prepare for MBA entrance exams", "Build reading speed for VARC, practise DI and LR sets to recognise structures quickly, and strengthen arithmetic, algebra and geometry for quant. Full-length mocks help you plan section-wise time and decide which questions to leave."),
        ("What our MBA mock tests include", "CAT, CMAT and MAT-style papers with reading passages, DI/LR sets and quant problems at each exam's difficulty, the official timing and marking, and worked solutions."),
    ],
    'Insurance & Finance': [
        ("How to prepare for insurance and banking certifications", "Start with the official study material from the Insurance Institute of India, NSE Academy or IIBF, then use mock tests module by module. Focus on concepts, regulatory principles and the calculations each syllabus includes."),
        ("What these mock tests include", "Questions across every module or paper of the official syllabus, in the exam's pattern, with an explanation for every answer."),
    ],
}

def group_faqs(g, xs):
    return [
        (f"Which {g['label']} exams can I practise on {SITE['name']}?", f"{', '.join(code(x) for x in xs)}."),
        (f"Are {g['label']} mock tests free?", f"Yes. Every {g['label']} mock test, practice question and chapter page on {SITE['name']} is free. Practice questions and chapter pages are open to everyone; full mock tests need a free account."),
        ("Are these real exam questions?", "No. All questions are original and written to the official syllabus and pattern. We do not use or sell actual exam questions."),
    ]

def group_page(g):
    xs = [x for x in INDEXABLE if x['group'] == g['id']]
    crumbs = [('Home', '/'), ('Exams', '/exams/'), (g['label'], group_url(g))]
    title = f"{g['label']} Mock Tests {YEAR} – {len(xs)} Exams | {SITE['name']}"
    desc = f"Full-length {g['label']} mock tests for {', '.join(code(x) for x in xs[:4])}{' and more' if len(xs) > 4 else ''}. Exam pattern, syllabus and free practice questions — all free."
    gk = SEO['groups'].get(g['id'], {})
    if gk.get('title'): title = seo_title(gk['title'])
    if gk.get('description'): desc = gk['description']
    if g['id'] == 'NISM':
        blocks = ''.join(f'<h3>{e(cat)}</h3>' + exam_table([x for x in xs if x.get('category') == cat]) for cat in CAT['CATEGORIES'] if any(x.get('category') == cat for x in xs))
    else:
        blocks = exam_table(xs, target=bool(g.get('competitive')))
    faqs = group_faqs(g, xs)
    guide = ''.join(f'<section><h2>{e(h)}</h2><p>{e(t)}</p></section>' for h, t in GROUP_GUIDE[g['id']])
    body = f'''    <section class="page-hero"><div class="wrap">{crumbs_html(crumbs)}<h1>{e(g['label'])} mock tests</h1><p class="lead-left">{e(GROUP_INTRO[g['id']])}</p><p class="meta-row small muted">Last updated {DATE_HUMAN} · <a href="/how-we-create-questions/">How we create questions</a></p></div></section>
    <div class="wrap page prose">
      <section><h2>{e(g['label'])} exams</h2>{blocks}
      <p class="small muted">Patterns are indicative — confirm them in each exam's latest official notification.</p></section>
      {guide}
      <section><h2>{e(g['label'])} mock test FAQs</h2>{''.join(f'<details class="faq-item"><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in faqs)}</section>
    </div>'''
    ld = [breadcrumb_ld(crumbs), {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faqs]}, {'@type': 'CollectionPage', 'name': f"{g['label']} mock tests", 'url': BASE + group_url(g),
          'mainEntity': {'@type': 'ItemList', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': BASE + exam_url(x), 'name': code(x)} for i, x in enumerate(xs)]}}]
    return page(group_url(g), title, desc, body, ld, active=group_url(g))

def exams_hub():
    crumbs = [('Home', '/'), ('Exams', '/exams/')]
    title = f"All Exam Mock Tests – NISM, Banking, SSC, MBA | {SITE['name']}"
    desc = f"Browse {len(INDEXABLE)} exams with full-length mock tests: NISM certifications, IBPS & SBI, SSC, CAT/CMAT/MAT and IRDAI, NCFM, JAIIB & CAIIB. Patterns, syllabus and free samples."
    if SEO['hub'].get('title'): title = seo_title(SEO['hub']['title'])
    if SEO['hub'].get('description'): desc = SEO['hub']['description']
    body = f'    <section class="page-hero"><div class="wrap">{crumbs_html(crumbs)}<h1>All exams</h1><p class="lead-left">{len(INDEXABLE)} exams across {len(GROUPS)} categories. Each page shows the exam pattern, the syllabus our question bank covers, free sample questions and mock test plans.</p></div></section>\n    <div class="wrap page prose">' + ''.join(
        f'<section><h2><a href="{group_url(g)}">{e(g["label"])}</a></h2><p class="muted">{e(g["blurb"])}</p>{exam_table([x for x in INDEXABLE if x["group"] == g["id"]], target=bool(g.get("competitive")))}</section>' for g in GROUPS) + '</div>'
    ld = [breadcrumb_ld(crumbs), {'@type': 'CollectionPage', 'name': 'All exams', 'url': BASE + '/exams/'}]
    return page('/exams/', title, desc, body, ld, active='/exams/')

def study_page():
    crumbs = [('Home', '/'), ('Free study material', '/study-material/')]
    title = f"Free NISM Workbooks & Official Exam Syllabus | {SITE['name']}"
    desc = "Free NISM workbook PDFs from the official portal, NISM test objectives and official syllabus links for IBPS, SBI, RBI, SSC, CAT, CMAT, MAT, IRDAI and IIBF."
    secs = ''
    for g in GROUPS:
        link = lambda l: '<a href="' + e(l['url']) + '" target="_blank" rel="noopener noreferrer">' + e(l['label']) + '</a>'
        rows = ''.join('<tr><td><a href="' + exam_url(x) + '"><b>' + e(code(x)) + '</b></a><div class="small muted">' + e(x['name']) + '</div></td><td>' + '<br>'.join(link(l) for l in x.get('links', [])) + '</td></tr>' for x in INDEXABLE if x['group'] == g['id'])
        intro = ('<p>NISM gives every certification workbook free of cost. Register with your name, email and phone on <a href="https://api.nism.ac.in/cmp/" target="_blank" rel="noopener noreferrer">NISM\'s official workbook portal</a> to view or download the latest version as a PDF.</p>' if g['id'] == 'NISM'
                 else '<p>Syllabus, pattern and notifications are published on each exam body\'s official website. Check there for the latest notification before you apply.</p>')
        secs += f'<section><h2>{e(g["label"])}</h2>{intro}<div class="table-wrap"><table><tr><th>Exam</th><th>Official resources</th></tr>{rows}</table></div></section>'
    body = f'    <section class="page-hero"><div class="wrap">{crumbs_html(crumbs)}<h1>Free study material</h1><p class="lead-left">Official, free resources for every exam we cover — linked straight to the source so you always get the latest version. Study material is © its publishers; we do not host or alter it.</p></div></section>\n    <div class="wrap page prose">{secs}</div>'
    return page('/study-material/', title, desc, body, [breadcrumb_ld(crumbs)], active='/study-material/')

# ---------- trust pages ----------
B = SITE.get('business', {})
GO = SITE.get('grievanceOfficer', {})
for k, label in [('legalName', 'business.legalName'), ('address', 'business.address'), ('email', 'business.email'), ('phone', 'business.phone'), ('gstin', 'business.gstin')]:
    if not B.get(k): warnings.append(f'content/site.json: {label} is empty')
if not GO.get('name') or not GO.get('email'): warnings.append('content/site.json: grievanceOfficer name/email is empty (needed under India\'s IT Rules)')
if not SITE.get('reviewers'): warnings.append('content/site.json: no named subject-expert reviewers yet (the strongest E-E-A-T signal for exam content)')
CONTACT_EMAIL = B.get('email') or ''
def contact_line(): return f'<a href="mailto:{e(CONTACT_EMAIL)}">{e(CONTACT_EMAIL)}</a>' if CONTACT_EMAIL else 'the contact details on our <a href="/contact/">Contact page</a>'
OPERATOR = e(B.get('legalName') or SITE['name'])

def simple(path, h1, title, desc, inner):
    crumbs = [('Home', '/'), (h1, path)]
    body = f'    <section class="page-hero"><div class="wrap">{crumbs_html(crumbs)}<h1>{e(h1)}</h1><p class="meta-row small muted">Last updated {DATE_HUMAN}</p></div></section>\n    <div class="wrap page prose narrow">{inner}</div>'
    return page(path, title, desc, body, [breadcrumb_ld(crumbs)])

def about_page():
    rev = ''.join(f"<li><b>{e(r['name'])}</b> — {e(r.get('credentials', ''))}{(': ' + e(r['bio'])) if r.get('bio') else ''}</li>" for r in SITE.get('reviewers', []) if r.get('name'))
    biz = ''.join(f'<li><b>{lbl}:</b> {e(v)}</li>' for lbl, v in [('Operated by', B.get('legalName')), ('GSTIN', B.get('gstin')), ('Registered address', B.get('address')), ('Email', B.get('email')), ('Phone', B.get('phone'))] if v)
    inner = f'''<p>{e(SITE['name'])} is an online practice platform for Indian certification and recruitment exams. We help candidates prepare for NISM certifications, bank and SSC recruitment, MBA entrance and insurance &amp; banking certifications with full-length mock tests that follow each exam's official pattern.</p>
<h2>What we offer</h2><ul><li>Full-length, timed mock tests with the real exam's question count, duration and negative marking.</li><li>An explanation for every answer and chapter-wise performance analysis after each test.</li><li>Links to free official study material, such as NISM's free workbooks.</li><li>Free chapter-wise practice questions, preparation guides, a finance glossary, calculators and soft-skills courses.</li><li>Everything is free — no plans, no payments.</li></ul>
<h2>How our content is made</h2><p>Every question is original and mapped to the exam's official syllabus. Read our <a href="/how-we-create-questions/">editorial process</a> to see how questions are written, checked and corrected.</p>
{('<h2>Subject-matter reviewers</h2><ul>' + rev + '</ul>') if rev else ''}
<h2>Independence</h2><p>We are not affiliated with NISM, SEBI or any exam-conducting body. We do not use or sell actual exam questions.</p>
{('<h2>Business details</h2><ul>' + biz + '</ul>') if biz else ''}
<p>Questions or feedback? See our <a href="/contact/">Contact page</a>.</p>'''
    return simple('/about/', 'About Success4Sure', f"About {SITE['name']} | Online Mock Tests for Indian Exams", f"Who we are, what {SITE['name']} offers, and how we create original, syllabus-mapped mock tests for NISM, banking, SSC, MBA and insurance exams.", inner)

def method_page():
    inner = '''<p>Candidates rely on practice questions being correct. This page explains how we write, check and update every question on Success4Sure.</p>
<h2>1. Start from the official syllabus</h2><p>Each question bank is organised by the exam's official chapters or sections. For NISM exams we use the curriculum and test objectives NISM publishes for each certification; for other exams we use the conducting body's published syllabus and pattern. Questions are spread across chapters roughly in proportion to how much of the exam each chapter covers.</p>
<h2>2. Write original questions</h2><p>Every question is written fresh. We never copy questions from workbooks, past papers, coaching material or "dump" sites, and we never reproduce actual exam questions — exam bodies prohibit disclosing them. Questions are drafted with the help of AI writing tools and then checked using the process below.</p>
<h2>3. Check accuracy</h2><ul><li>Every numerical question is re-solved from scratch, and puzzles are checked to have exactly one valid answer.</li><li>Automated checks confirm four distinct options, one correct answer, no duplicate questions, full chapter coverage and an even spread of correct-answer positions.</li><li>Facts that change often — tax rates, regulatory limits, fees, current affairs — are only used when we are confident they are current; otherwise we test the underlying concept.</li><li>Every answer carries a short explanation so you can see the reasoning.</li></ul>
<h2>4. Keep it current</h2><p>Regulators and exam bodies revise rules and patterns. We review question banks when official notifications or regulations change, and each exam page shows when it was last updated.</p>
<h2>5. Corrections</h2><p>If you think an answer is wrong or out of date, tell us at ''' + contact_line() + ''' with the exam, question and your reasoning. We review every report and correct or remove the question if needed.</p>
<h2>What our questions are not</h2><p>Our mock tests are practice material. They are not official exam questions and do not guarantee a result. Always read the official study material — see our <a href="/study-material/">free study material</a> page.</p>'''
    return simple('/how-we-create-questions/', 'How we create questions', f"How We Create Our Questions – Editorial Process | {SITE['name']}", "Our editorial process: original questions mapped to the official syllabus, accuracy checks, update policy and how to report an error.", inner)

def contact_page():
    items = ''.join(f'<li><b>{lbl}:</b> {v}</li>' for lbl, v in [
        ('Email', f'<a href="mailto:{e(B["email"])}">{e(B["email"])}</a>' if B.get('email') else ''),
        ('Phone', e(B.get('phone', ''))), ('Address', e(B.get('address', ''))), ('Operated by', e(B.get('legalName', ''))), ('GSTIN', e(B.get('gstin', '')))] if v)
    go = (f'<h2>Grievance officer</h2><p>As required under the Information Technology Rules, our grievance officer is <b>{e(GO["name"])}</b>, reachable at <a href="mailto:{e(GO["email"])}">{e(GO["email"])}</a>. We acknowledge complaints within 24 hours and aim to resolve them within 15 days.</p>' if GO.get('name') and GO.get('email') else '')
    inner = f'''<p>We're happy to help with your account, technical problems or questions about our content.</p>
{('<ul>' + items + '</ul>') if items else '<p>Contact details are being updated.</p>'}
<h2>Report a question error</h2><p>Please include the exam, the mock test number and the question text, and tell us what you think the correct answer is and why. See <a href="/how-we-create-questions/">how we handle corrections</a>.</p>
{go}'''
    return simple('/contact/', 'Contact us', f"Contact {SITE['name']}", f"How to contact {SITE['name']} about your account, technical issues or question corrections.", inner)

def privacy_page():
    inner = f'''<p>This policy explains what personal data {OPERATOR} ("we") collects when you use success4sure.in, why, and your choices.</p>
<h2>Data we collect</h2><ul><li><b>Account details:</b> if you sign in with Google, your name, email address and profile photo from your Google account; if you create an email account, the details you enter.</li><li><b>No payment data:</b> {SITE['name']} is free, so we do not collect any card, UPI or bank details.</li><li><b>Usage data:</b> your mock test attempts, answers and scores, so we can show results and analysis.</li><li><b>Technical data:</b> basic logs such as IP address, browser and device type, used for security and to keep the service running.</li></ul>
<h2>How we use it</h2><ul><li>To provide your account, save your mock-test results and lesson progress, and show your analysis.</li><li>To respond to support requests and send service messages about your account.</li><li>To keep the service secure and improve it.</li></ul><p>We do not sell your personal data.</p>
<h2>Sharing</h2><p>We share data only with service providers who help us run the service — such as hosting, sign-in (Google and Supabase) and email — under appropriate safeguards, or where required by law.</p>
<h2>Retention</h2><p>We keep account and test data while your account is active and for a reasonable period afterwards, then delete or anonymise it. You can ask us to delete your account at any time.</p>
<h2>Your choices and rights</h2><p>You can ask to access, correct or delete your personal data, or withdraw consent, by writing to {contact_line()}. We will respond in line with applicable Indian law, including the Digital Personal Data Protection Act, 2023.</p>
<h2>Cookies and local storage</h2><p>We use essential browser storage to keep you logged in and remember your progress. We do not use advertising cookies.</p>
<h2>Changes</h2><p>We may update this policy and will show the date of the latest version at the top of this page.</p>'''
    return simple('/privacy-policy/', 'Privacy policy', f"Privacy Policy | {SITE['name']}", f"How {SITE['name']} collects, uses and protects your personal data.", inner)

def terms_page():
    inner = f'''<p>These terms govern your use of success4sure.in, operated by {OPERATOR}. By using the site or creating an account you agree to them.</p>
<h2>Free service</h2><p>{e(SITE['name'])} is free to use. There are no plans, subscriptions or payments. Practice questions, notes, guides, the glossary, the blog and calculators are open to everyone; mock tests and course lessons need a free account. We may change, add or remove features at any time.</p>
<h2>Accounts</h2><p>If you sign in, keep your login private and give accurate details. We may suspend accounts that misuse the service, for example through automated scraping or abuse.</p>
<h2>Our content</h2><p>All questions, explanations and site content are our original work and are protected by copyright. You may use them for your personal preparation and share links to our pages. Copying, scraping, reselling or republishing our content is not allowed.</p>
<h2>No guarantee of results</h2><p>Our mock tests, notes and guides are practice and learning material. They are not official exam questions, and we do not guarantee that you will pass or achieve any score. Exam patterns and rules are indicative; always confirm them with the official notification or regulator.</p>
<h2>Not financial advice</h2><p>Glossary entries, calculators and finance lessons are for education only. They are not investment, tax or legal advice for your situation.</p>
<h2>Independence</h2><p>We are not affiliated with or endorsed by NISM, SEBI or any exam-conducting body. Names of exams are used only to describe what our practice material covers.</p>
<h2>Liability</h2><p>The service is provided free and "as is". To the extent permitted by law, we are not liable for any loss arising from your use of it.</p>
<h2>Governing law</h2><p>These terms are governed by the laws of India.</p>
<h2>Contact</h2><p>Questions about these terms: {contact_line()}.</p>'''
    return simple('/terms/', 'Terms of use', f"Terms of Use | {SITE['name']}", f"The terms that apply when you use {SITE['name']}, a free practice platform for Indian exams.", inner)

def refund_page():
    inner = f'''<p>We want you to be happy with your plan. This policy explains when you can get a refund.</p>
<h2>Try before you buy</h2><p>Every exam has a free demo test and free sample questions, so you can check our questions and interface before paying.</p>
<h2>Refund window</h2><p>If you have not started any mock test on a plan, you can request a full refund within 7 days of purchase. Once you have started a mock test on that plan, the plan is non-refundable.</p>
<h2>Payment problems</h2><p>If you were charged but your plan was not activated, or you were charged twice, contact us and we will activate the plan or refund the extra payment.</p>
<h2>How to request a refund</h2><p>Write to {contact_line()} with your registered email, the exam and the payment reference. Approved refunds go back to the original payment method, usually within 5–7 working days, depending on your bank.</p>'''
    return simple('/refund-policy/', 'Refund policy', f"Refund Policy | {SITE['name']}", f"When and how you can get a refund on a {SITE['name']} mock test plan.", inner)

def disclaimer_page():
    inner = '''<p>Success4Sure is an independent practice platform. We are not affiliated with, endorsed by, or connected to the National Institute of Securities Markets (NISM), the Securities and Exchange Board of India (SEBI), IBPS, State Bank of India, the Reserve Bank of India, the Staff Selection Commission, the Indian Institutes of Management, the National Testing Agency, AIMA, IRDAI, the Insurance Institute of India, NSE / NSE Academy or the Indian Institute of Banking &amp; Finance.</p>
<p>All questions on this site are original practice questions written to match publicly available syllabi. They are not actual exam questions. Exam names are used only to describe what our practice material covers.</p>
<p>Exam patterns, cut-offs, eligibility and regulatory details shown on this site are indicative and can change. Always confirm them with the conducting body's latest official notification.</p>
<p>Our content is for exam preparation only and is not investment, tax, legal or career advice.</p>'''
    return simple('/disclaimer/', 'Disclaimer', f"Disclaimer | {SITE['name']}", f"{SITE['name']} is an independent practice platform, not affiliated with NISM, SEBI or any exam body.", inner)

def not_found_page():
    groups = ''.join(f'<li><a href="{group_url(g)}">{e(g["label"])} mock tests</a></li>' for g in GROUPS)
    body = f'''    <section class="page-hero"><div class="wrap"><h1>Page not found</h1><p class="lead-left">The page you were looking for doesn't exist or has moved.</p>
      <div class="row" style="margin-top:20px"><a class="btn btn-primary" href="/">Go to the homepage</a><a class="btn" href="/exams/">Browse all exams</a></div></div></section>
    <div class="wrap page prose"><h2>Popular sections</h2><ul>{groups}<li><a href="/study-material/">Free study material</a></li></ul></div>'''
    return page('/404', f"Page not found | {SITE['name']}", 'This page could not be found.', body, noindex=True)

# ---------- soft skills ----------
SKILL_CATALOG = rd('content/softskills/courses.json')
SKILL_GROUPS = SKILL_CATALOG['groups']
SKILL_META = [{k: v for k, v in c.items() if k != 'lessons'} for c in SKILL_CATALOG['courses']]
TRACK_LABEL = {'core': 'Everyone', 'fresher': 'Freshers', 'professional': 'Finance professionals'}

def load_skills():
    out = []
    for m in SKILL_META:
        p = os.path.join(ROOT, 'content', 'softskills', m['slug'] + '.json')
        if not os.path.exists(p):
            warnings.append(f"soft skills: content/softskills/{m['slug']}.json not written yet — area skipped")
            continue
        d = json.load(open(p, encoding='utf-8'))
        for l in d['lessons']:
            l['quiz'] = [[q[0], q[1], q[2], q[-1]] for q in l['quiz']]  # explanation is always the last field
        out.append({**m, 'id': 'ss-' + m['slug'], 'lessons': d['lessons']})
    return out

SKILLS = load_skills()
def skill_url(a, l=None): return f"/soft-skills/{a['slug']}/" + (f"{l['id']}/" if l else '')

def skill_section_html(s):
    paras = ''.join(f'<p>{e(p)}</p>' for p in str(s['body']).split('\n\n') if p.strip())
    lists = ''
    if s.get('do') or s.get('dont'):
        lists = '<div class="dodont">' + (('<div class="do"><b>Do</b><ul>' + ''.join(f'<li>{e(x)}</li>' for x in s['do']) + '</ul></div>') if s.get('do') else '') \
            + (('<div class="dont"><b>Don\'t</b><ul>' + ''.join(f'<li>{e(x)}</li>' for x in s['dont']) + '</ul></div>') if s.get('dont') else '') + '</div>'
    return f'<section class="lesson-sec"><h2>{e(s["heading"])}</h2>{paras}{lists}</section>'

def skills_hub_page():
    crumbs = [('Home', '/'), ('Soft skills', '/soft-skills/')]
    title = f"{len(SKILLS)} Soft Skills Courses – Communication, AI, Money & More | {SITE['name']}"
    desc = f"{len(SKILLS)} practical soft-skills courses with bite-size lessons, quizzes and workplace scenarios — communication, interviews, working with AI, money skills, negotiation, leadership and more."[:158]
    hk = SEO['skills_hub']
    if hk.get('title'): title = seo_title(hk['title'])
    if hk.get('description'): desc = hk['description']
    course_card = lambda a: f'''<div class="card"><h3 style="font-size:1.15rem"><a href="{skill_url(a)}">{e(a['name'])}</a></h3><p class="muted">{e(a['blurb'])}</p>
      <ul>{''.join(f'<li><a href="{skill_url(a, l)}">{e(l["title"])}</a> <span class="small muted">· {TRACK_LABEL[l["track"]]}{" · free" if i == 0 else ""}</span></li>' for i, l in enumerate(a['lessons']))}</ul></div>'''
    cards = ''.join(f'<section><h2>{e(g["label"])}</h2><p class="muted">{e(g["blurb"])}</p><div class="stack">' + ''.join(course_card(a) for a in SKILLS if a.get('group') == g['id']) + '</div></section>'
                    for g in SKILL_GROUPS if any(a.get('group') == g['id'] for a in SKILLS))
    body = f'''    <section class="page-hero"><div class="wrap">{crumbs_html(crumbs)}<h1>Soft skills for your career</h1>
      {f'<p class="lead-left">{e(hk["intro"])}</p>' if hk.get('intro') else ''}
      <p class="lead-left">{len(SKILLS)} practical courses. Short lessons with a quiz and real workplace scenarios after each one — for freshers starting their first job and finance professionals working with clients. The first lesson in every course is free.</p>
      <p class="meta-row small muted">Last updated {DATE_HUMAN} · By the {e(SITE['name'])} editorial team</p>
      <div class="row" style="margin-top:20px"><a class="btn btn-primary btn-lg" href="/#/skills">Start learning</a></div></div></section>
    <div class="wrap page prose">{cards}
      <section style="margin-top:40px"><h2>How the courses work</h2><p>Each course has six lessons: four core lessons for everyone, one for freshers and one for finance professionals such as mutual fund distributors, advisers and relationship managers. Every lesson takes 5–8 minutes to read and ends with a 10-question quiz and three scenarios where you choose what you would say and see why it works. Every course is free — just create a free account.</p></section>
    </div>'''
    ld = [breadcrumb_ld(crumbs), {'@type': 'ItemList', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': BASE + skill_url(a), 'name': a['name']} for i, a in enumerate(SKILLS)]}]
    return page('/soft-skills/', title, desc, body, ld, active='/soft-skills/')

def skill_area_page(a):
    crumbs = [('Home', '/'), ('Soft skills', '/soft-skills/'), (a['name'], skill_url(a))]
    n = len(a['lessons'])
    title = f"{a['name']} Course – {n} Lessons with Quizzes | {SITE['name']}"
    desc = f"{a['blurb']} {n} practical lessons, {n * 10} quiz questions and {n * 3} workplace scenarios. Free with a one-click sign-up."
    ck = SEO['courses'].get(a['slug'], {})
    if ck.get('title'): title = seo_title(ck['title'])
    if ck.get('description'): desc = ck['description']
    rows = ''.join(f"<tr><td><a href=\"{skill_url(a, l)}\"><b>{e(l['title'])}</b></a><div class=\"small muted\">{e(l['summary'])}</div></td><td>{TRACK_LABEL[l['track']]}</td><td>{l['minutes']} min</td><td>Free</td></tr>" for i, l in enumerate(a['lessons']))
    faqs = [
        (f"Who is the {a['name']} course for?", "Freshers preparing for or starting their first job, and finance professionals such as mutual fund distributors, investment advisers and relationship managers. Core lessons suit everyone; one lesson is written for each of the two groups."),
        ("Is this course free?", f"Yes. All {n} lessons, {n * 10} quiz questions with explanations and {n * 3} practice scenarios are free. Create a free account (one click with Google) to start; your progress is saved across devices."),
    ] + [tuple(f) for f in ck.get('faqs', [])]
    learn = ('<section><h2>What you will learn</h2><ul class="checks">' + ''.join(f'<li>{e(t)}</li>' for t in ck['learn']) + '</ul></section>') if ck.get('learn') else ''
    who = ('<section><h2>Who this course is for</h2><ul>' + ''.join(f'<li>{e(t)}</li>' for t in ck['who']) + '</ul></section>') if ck.get('who') else ''
    intro = f'<section><h2>About this {e(a["name"])} course</h2><p>{e(ck["intro"])}</p></section>' if ck.get('intro') else ''
    body = f'''    <section class="page-hero"><div class="wrap">{crumbs_html(crumbs)}<h1>{e(a['name'])}</h1><p class="lead-left">{e(a['blurb'])}</p>
      <p class="meta-row small muted">Last updated {DATE_HUMAN} · <a href="/how-we-create-questions/">Our editorial process</a></p>
      <div class="row" style="margin-top:20px"><a class="btn btn-primary btn-lg" href="{skill_url(a, a['lessons'][0])}">Start lesson 1</a><a class="btn btn-lg" href="/#/skills/{a['slug']}">Open in the app</a></div></div></section>
    <div class="wrap page prose">
      {('<div class="notice">' + e(a['note']) + '</div>') if a.get('note') else ''}
      {intro}{learn}{who}
      <section><h2>Lessons in this course</h2><div class="table-wrap"><table><tr><th>Lesson</th><th>For</th><th>Read</th><th>Access</th></tr>{rows}</table></div></section>
      <section><h2>FAQs</h2>{''.join(f'<details class="faq-item"><summary>{e(q)}</summary><p>{e(x)}</p></details>' for q, x in faqs)}</section>
    </div>'''
    course = {'@type': 'Course', 'name': a['name'], 'description': ck.get('intro') or a['blurb'], **({'teaches': ck['learn']} if ck.get('learn') else {}), **({'keywords': ', '.join([ck['primary']] + ck.get('secondary', []))} if ck.get('primary') else {}), 'provider': {'@id': BASE + '/#org'}, 'inLanguage': 'en-IN', 'url': BASE + skill_url(a),
              'isAccessibleForFree': True, 'offers': {'@type': 'Offer', 'price': 0, 'priceCurrency': 'INR', 'category': 'Free'},
              'hasCourseInstance': {'@type': 'CourseInstance', 'courseMode': 'Online'}, 'dateModified': TODAY.isoformat()}
    ld = [breadcrumb_ld(crumbs), course, {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': x}} for q, x in faqs]}]
    return page(skill_url(a), title, desc, body, ld, active='/soft-skills/')

def skill_lesson_page(a, i, l):
    free = True  # every lesson is free
    crumbs = [('Home', '/'), ('Soft skills', '/soft-skills/'), (a['name'], skill_url(a)), (l['title'], skill_url(a, l))]
    title = f"{l['title']} | {SITE['name']}"
    if len(title) > 68: title = l['title'][:66]
    desc = l['summary'][:155]
    lk = SEO['lessons'].get(l['id'], {})
    if lk.get('title'): title = seo_title(lk['title'])
    if lk.get('description'): desc = lk['description']
    if free:
        content = ''.join(skill_section_html(s) for s in l['sections']) + '<section class="lesson-sec takeaways"><h2>Key takeaways</h2><ul>' + ''.join(f'<li>{e(t)}</li>' for t in l['takeaways']) + '</ul></section>'
        cta = f'<div class="card"><h3>Practise this lesson</h3><p class="muted">Take the free 10-question quiz and three workplace scenarios for this lesson.</p><a class="btn btn-primary" href="/#/skills/{a["slug"]}/{l["id"]}/quiz">Take the quiz</a></div>'
    else:
        content = skill_section_html(l['sections'][0]) + '<section class="lesson-sec"><h2>In the full lesson</h2><ul>' + ''.join(f'<li>{e(s["heading"])}</li>' for s in l['sections'][1:]) + '</ul></section>' \
            + '<section class="lesson-sec takeaways"><h2>Key takeaways</h2><ul>' + ''.join(f'<li>{e(t)}</li>' for t in l['takeaways']) + '</ul></section>'
        cta = f'<div class="card paywall"><h3>Read the full lesson</h3><p class="muted">Unlock every lesson in {e(a["name"])} with its quiz and practice scenarios, from ₹{PLANS[0]["price"]}.</p><div class="row" style="justify-content:center"><a class="btn btn-primary" href="/#/skills/{a["slug"]}">See plans</a><a class="btn" href="{skill_url(a, a["lessons"][0])}">Read lesson 1 free</a></div></div>'
    q = l['quiz'][0]
    sample = f'''<section class="lesson-sec"><h2>Quick check</h2><div class="sample"><p class="sample-q">{e(q[0])}</p><ol class="sample-opts" type="A">{''.join(f'<li>{e(o)}</li>' for o in q[1])}</ol>
      <details><summary>Show answer &amp; explanation</summary><p><b>Answer: {"ABCD"[q[2]]}. {e(q[1][q[2]])}</b></p><p>{e(q[3])}</p></details></div></section>'''
    others = ''.join(f'<li><a href="{skill_url(a, x)}">{e(x["title"])}</a></li>' for x in a['lessons'] if x['id'] != l['id'])
    body = f'''    <section class="page-hero"><div class="wrap">{crumbs_html(crumbs)}
      <div class="hero-series">{e(a['name'])} · Lesson {i + 1} of {len(a['lessons'])} · {l['minutes']} min read · {TRACK_LABEL[l['track']]}{' · Free' if free else ''}</div>
      <h1 style="margin-top:6px">{e(l['title'])}</h1><p class="lead-left">{e(l['summary'])}</p>
      <p class="meta-row small muted">Last updated {DATE_HUMAN} · By the {e(SITE['name'])} editorial team</p></div></section>
    <div class="wrap page prose lesson">{('<div class="notice" style="margin-bottom:24px">' + e(a['note']) + '</div>') if a.get('note') else ''}{content}{sample}{cta}
      <section class="lesson-sec" style="margin-top:32px"><h2>More in {e(a['name'])}</h2><ul class="related">{others}</ul></section></div>'''
    art = {'@type': 'Article', 'headline': lk.get('title') or l['title'], 'description': l['summary'], **({'keywords': lk['primary']} if lk.get('primary') else {}), 'inLanguage': 'en-IN', 'url': BASE + skill_url(a, l),
           'author': {'@id': BASE + '/#org'}, 'publisher': {'@id': BASE + '/#org'}, 'dateModified': TODAY.isoformat(),
           'isAccessibleForFree': free, 'isPartOf': {'@type': 'Course', 'name': a['name'], 'url': BASE + skill_url(a)}}
    if not free:
        art['hasPart'] = {'@type': 'WebPageElement', 'isAccessibleForFree': False, 'cssSelector': '.paywall'}
    return page(skill_url(a, l), title, desc, body, [breadcrumb_ld(crumbs), art], active='/soft-skills/')

# ---------- free chapter questions, guides and Hindi pages ----------
FREE = {}
for f in sorted(glob.glob(os.path.join(ROOT, 'content', 'free-questions', '*.json'))):
    FREE.update(json.load(open(f, encoding='utf-8')))
FREE = {k: v for k, v in FREE.items() if any(x['id'] == k and not x.get('noindex') for x in EXAMS)}
GUIDES = []
for f in sorted(glob.glob(os.path.join(ROOT, 'content', 'guides', '*.json'))):
    GUIDES += json.load(open(f, encoding='utf-8'))['guides']
GUIDES = [g for g in GUIDES if any(x['id'] == g['exam'] and not x.get('noindex') for x in EXAMS)]
HI = rd('content/hi/exams.json') if os.path.exists(os.path.join(ROOT, 'content', 'hi', 'exams.json')) else {}
HI = {k: v for k, v in HI.items() if any(x['id'] == k for x in EXAMS)}

def chapter_slug(ch):
    s = slugify(ch)[:60].strip('-')
    return 'chapter-' + s if s in ('practice-questions', '') else s
def chapter_url(x, ch): return exam_url(x) + chapter_slug(ch) + '/'
def guide_url(g): return f"/guides/{g['slug']}/"
def guides_for(x): return [g for g in GUIDES if g['exam'] == x['id']]
def hi_url(x, practice=False): return '/hi' + exam_url(x) + ('practice-questions/' if practice else '')

def q_block(i, q, label=''):
    return f'''
        <div class="sample" id="q{i + 1}">
          <div class="small muted">Question {i + 1}{(' · ' + e(label)) if label else ''}</div>
          <p class="sample-q">{e(q[0])}</p>
          <ol class="sample-opts" type="A">{''.join(f'<li>{e(o)}</li>' for o in q[1])}</ol>
          <details><summary>Show answer &amp; explanation</summary><p><b>Answer: {"ABCD"[q[2]]}. {e(q[1][q[2]])}</b></p><p>{e(q[3])}</p></details>
        </div>'''

def chapter_page(x, idx, ch, block):
    g, p = GROUP[x['group']], x['pattern']
    chs = list(FREE[x['id']].keys())
    crumbs = [('Home', '/'), ('Exams', '/exams/'), (g['label'], group_url(g)), (code(x), exam_url(x)), (ch, chapter_url(x, ch))]
    unit = 'Chapter' if x['group'] in ('NISM', 'Insurance & Finance') else 'Section'
    title = seo_title(f"{code(x)} {ch} Questions with Answers")
    if len(title) > 70:
        title = f"{code(x)} {ch} Questions"
        if len(title) > 65: title = f"{code(x)} {ch[:62 - len(code(x)) - 11].rstrip(' ,&-')}… Questions"
    qs = block['questions']
    desc = f"{len(qs)} free {code(x)} practice questions on {ch}, with answers and explanations. Revise this {unit.lower()} and test yourself before the exam."
    if len(desc) > 158: desc = f"{len(qs)} free {code(x)} questions on {ch[:60]} with answers and explanations."
    nav = []
    if idx > 0: nav.append(f'<a class="btn" href="{chapter_url(x, chs[idx - 1])}">&larr; {e(chs[idx - 1])}</a>')
    if idx + 1 < len(chs): nav.append(f'<a class="btn" href="{chapter_url(x, chs[idx + 1])}">{e(chs[idx + 1])} &rarr;</a>')
    gl = guides_for(x)
    body = f'''    <section class="page-hero"><div class="wrap">
      {crumbs_html(crumbs)}
      <div class="hero-series">{e(code(x))} · {unit} {idx + 1} of {len(chs)}</div>
      <h1 style="margin-top:6px">{e(ch)}: {e(code(x))} practice questions</h1>
      <p class="lead-left">{len(qs)} free questions with answers and explanations on {e(ch)}, from the {e(code(x))} ({e(x['name'])}) syllabus.</p>
      <p class="meta-row small muted">Last updated {DATE_HUMAN} · By the {e(SITE['name'])} editorial team · <a href="/how-we-create-questions/">How we create questions</a></p>
    </div></section>
    <div class="wrap page prose">
      <section><h2>What this {unit.lower()} covers</h2><p>{e(block['overview'])}</p>{('<p><a class="btn" href="' + notes_url(x, ch) + '">Read the ' + e(ch) + ' revision notes</a></p>') if (x['id'], ch) in NOTES else ''}</section>
      <section><h2>{e(ch)} questions</h2>{''.join(q_block(i, q) for i, q in enumerate(qs))}</section>
      <div class="row" style="margin:24px 0">{''.join(nav)}</div>
      <section><h2>Practise the full {e(code(x))} paper</h2>
        <p>The real exam mixes every {unit.lower()}: {p['questions']} questions in {p['duration']} minutes{', with negative marking' if p['negative'] else ''}. Full-length mock tests give you the timer, your score and a {unit.lower()}-wise analysis.</p>
        <div class="row"><a class="btn btn-primary" href="/#/test/{x['id']}?demo=1">Take a free demo test</a><a class="btn" href="{exam_url(x)}">{e(code(x))} mock tests</a><a class="btn" href="{practice_url(x)}">Mixed practice questions</a></div>
      </section>
      <section><h2>All {e(code(x))} {unit.lower()}s</h2><ul class="related">{''.join(f'<li><a href="{chapter_url(x, c)}">{e(c)}</a></li>' for c in chs if c != ch)}</ul></section>
      {('<section><h2>Preparation guides</h2><ul class="related">' + ''.join(f'<li><a href="{guide_url(gd)}">{e(gd["title"])}</a></li>' for gd in gl) + '</ul></section>') if gl else ''}
    </div>'''
    lr = {'@type': 'LearningResource', 'name': f"{code(x)} {ch} practice questions", 'description': desc, 'url': BASE + chapter_url(x, ch), 'inLanguage': 'en-IN',
          'learningResourceType': 'Practice questions', 'isAccessibleForFree': True, 'provider': {'@id': BASE + '/#org'}, 'dateModified': TODAY.isoformat(), 'about': ch,
          'isPartOf': {'@type': 'Course', 'name': f"{code(x)} Mock Test Series", 'url': BASE + exam_url(x)}}
    return page(chapter_url(x, ch), title, desc, body, [breadcrumb_ld(crumbs), lr], active=group_url(g))

def guide_page(gd):
    x = next(y for y in EXAMS if y['id'] == gd['exam'])
    crumbs = [('Home', '/'), ('Guides', '/guides/'), (gd['title'], guide_url(gd))]
    secs = ''.join(f'''<section><h2>{e(s["heading"])}</h2>{''.join(f'<p>{e(p)}</p>' for p in s.get('paragraphs', []))}{('<ul>' + ''.join(f'<li>{e(b)}</li>' for b in s['bullets']) + '</ul>') if s.get('bullets') else ''}</section>''' for s in gd['sections'])
    others = [o for o in GUIDES if o is not gd and (o['exam'] == gd['exam'] or GROUP[next(y for y in EXAMS if y['id'] == o['exam'])['group']] is GROUP[x['group']])][:5]
    chs = list(FREE.get(x['id'], {}).keys())
    words = len((gd['intro'] + ' '.join(' '.join(s.get('paragraphs', []) + s.get('bullets', [])) for s in gd['sections'])).split())
    body = f'''    <section class="page-hero"><div class="wrap">{crumbs_html(crumbs)}
      <div class="hero-series">{e(code(x))} · Preparation guide · {max(1, round(words / 200))} min read</div>
      <h1 style="margin-top:6px">{e(gd['title'])}</h1><p class="lead-left">{e(gd['intro'])}</p>
      <p class="meta-row small muted">Last updated {DATE_HUMAN} · By the {e(SITE['name'])} editorial team</p></div></section>
    <div class="wrap page prose lesson">
      {secs}
      <div class="card" style="margin:32px 0"><h3 style="margin-top:0">Practise as you prepare</h3>
        <p class="muted">Test yourself with free {e(code(x))} practice questions, then take full-length timed mock tests with explanations.</p>
        <div class="row"><a class="btn btn-primary" href="{practice_url(x)}">Free practice questions</a><a class="btn" href="{exam_url(x)}">{e(code(x))} mock tests</a><a class="btn" href="/tools/exam-score-calculator/?exam={x['id']}">Score calculator</a></div></div>
      {('<section><h2>Chapter-wise practice</h2><ul class="related">' + ''.join(f'<li><a href="{chapter_url(x, c)}">{e(c)}</a></li>' for c in chs) + '</ul></section>') if chs else ''}
      <section><h2>FAQs</h2>{''.join(f'<details class="faq-item"><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in gd['faqs'])}</section>
      {('<section><h2>More guides</h2><ul class="related">' + ''.join(f'<li><a href="{guide_url(o)}">{e(o["title"])}</a></li>' for o in others) + '</ul></section>') if others else ''}
    </div>'''
    art = {'@type': 'Article', 'headline': gd['title'], 'description': gd['description'], 'inLanguage': 'en-IN', 'url': BASE + guide_url(gd), 'keywords': ', '.join([gd['primary']] + gd.get('secondary', [])),
           'author': {'@id': BASE + '/#org'}, 'publisher': {'@id': BASE + '/#org'}, 'dateModified': TODAY.isoformat(), 'wordCount': words, 'about': x['name']}
    ld = [breadcrumb_ld(crumbs), art, {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in gd['faqs']]}]
    return page(guide_url(gd), seo_title(gd['title']), gd['description'], body, ld, active='/exams/')

def guides_hub():
    crumbs = [('Home', '/'), ('Guides', '/guides/')]
    blocks = ''
    for g in GROUPS:
        gs = [gd for gd in GUIDES if next(y for y in EXAMS if y['id'] == gd['exam'])['group'] == g['id']]
        if gs: blocks += f'<section><h2>{e(g["label"])}</h2><ul class="related">' + ''.join(f'<li><a href="{guide_url(gd)}">{e(gd["title"])}</a> <span class="small muted">— {e(gd["description"][:110])}…</span></li>' for gd in gs) + '</ul></section>'
    body = f'''    <section class="page-hero"><div class="wrap">{crumbs_html(crumbs)}<h1>Exam preparation guides</h1>
      <p class="lead-left">Study plans, chapter strategies and exam comparisons for NISM certifications, bank exams, SSC, CAT and IC-38 — written to the official syllabus.</p></div></section>
    <div class="wrap page prose">{blocks}</div>'''
    ld = [breadcrumb_ld(crumbs), {'@type': 'ItemList', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': BASE + guide_url(gd), 'name': gd['title']} for i, gd in enumerate(GUIDES)]}]
    return page('/guides/', seo_title('Exam Preparation Guides: NISM, Bank, SSC and CAT'), 'Free exam preparation guides: day-by-day study plans, toughest chapters and exam comparisons for NISM, IBPS, SBI, SSC CGL, CAT and IC-38.', body, ld, active='/exams/')

HI_L = {'home': 'होम', 'exams': 'परीक्षाएँ', 'pattern': 'परीक्षा पैटर्न', 'questions': 'प्रश्न', 'marks': 'कुल अंक', 'duration': 'समय', 'minutes': 'मिनट',
        'target': 'लक्ष्य स्कोर', 'pass': 'पासिंग स्कोर', 'neg': 'नेगेटिव मार्किंग', 'none': 'कोई नेगेटिव मार्किंग नहीं', 'about': 'परीक्षा के बारे में', 'who': 'किसे देनी चाहिए',
        'syllabus': 'सिलेबस', 'faqs': 'अक्सर पूछे जाने वाले प्रश्न', 'plans': 'मॉक टेस्ट प्लान', 'start': 'फ्री मॉक टेस्ट शुरू करें', 'demo': 'फ्री डेमो टेस्ट दें',
        'practice': 'फ्री प्रैक्टिस प्रश्न (उत्तर सहित)', 'answer': 'उत्तर और व्याख्या देखें', 'ans': 'उत्तर', 'english': 'Read in English', 'updated': 'अंतिम अपडेट',
        'indicative': 'यह संकेतात्मक पैटर्न है — परीक्षा से पहले नवीनतम आधिकारिक अधिसूचना में पुष्टि करें।', 'not_real': 'ये मूल प्रैक्टिस प्रश्न हैं, असली परीक्षा के प्रश्न नहीं।',
        'days': 'दिन', 'tests': 'मॉक टेस्ट', 'price': 'कीमत (GST सहित)', 'q': 'प्रश्न'}

def hi_exam_page(x):
    h, p, g = HI[x['id']], x['pattern'], GROUP[x['group']]
    comp = competitive(x)
    crumbs = [(HI_L['home'], '/'), (HI_L['exams'], '/exams/'), (g['label'], group_url(g)), (h['name'], hi_url(x))]
    neg = (f"हाँ, हर गलत उत्तर पर उस प्रश्न के {round(p['negative'] * 100, 1):g}% अंक कटते हैं" if p['negative'] else HI_L['none'])
    chs = list(dict.fromkeys(q[0] for q in QB.get(x['id'], [])))
    body = f'''    <section class="page-hero"><div class="wrap">{crumbs_html(crumbs)}
      <h1>{e(h['h1'])}</h1><p class="lead-left">{e(h['intro'])}</p>
      <p class="meta-row small muted">{HI_L['updated']}: {DATE_HUMAN} · <a href="{exam_url(x)}" hreflang="en-IN" lang="en">{HI_L['english']}</a></p>
      <div class="row" style="margin-top:20px"><a class="btn btn-primary btn-lg" href="/#/test/{x['id']}/1">{HI_L['start']}</a><a class="btn btn-lg" href="/#/test/{x['id']}?demo=1">{HI_L['demo']}</a></div>
    </div></section>
    <div class="wrap page prose">
      <section><h2>{HI_L['about']}</h2><p>{e(h['about'])}</p><p><b>{HI_L['who']}:</b> {e(h['who'])}</p></section>
      <section><h2>{e(h['name'])} {HI_L['pattern']}</h2><div class="table-wrap"><table>
        <tr><th>{HI_L['questions']}</th><td>{p['questions']}</td></tr><tr><th>{HI_L['marks']}</th><td>{p['marks']}</td></tr>
        <tr><th>{HI_L['duration']}</th><td>{p['duration']} {HI_L['minutes']}</td></tr>
        <tr><th>{HI_L['target'] if comp else HI_L['pass']}</th><td>{p['passPct']}%</td></tr><tr><th>{HI_L['neg']}</th><td>{neg}</td></tr></table></div>
        <p class="small muted">{HI_L['indicative']}</p></section>
      <section><h2>{HI_L['syllabus']}</h2><ul>{''.join(f'<li>{e(h["chapters"].get(c, c))}</li>' for c in chs)}</ul></section>
      <section><h2>{e(h['name'])} — फ्री मॉक टेस्ट</h2><p>{max_mocks(x)} फुल-लेंथ मॉक टेस्ट, हर एक असली पैटर्न में, स्कोर, चैप्टर-वाइज़ विश्लेषण और हर उत्तर की व्याख्या के साथ — पूरी तरह फ्री। कोई प्लान या पेमेंट नहीं।</p>
        <p><a class="btn btn-primary" href="/#/test/{x['id']}/1">पहला मॉक टेस्ट शुरू करें</a></p></section>
      <p><a class="btn" href="{hi_url(x, True)}">{e(h['name'])} — {HI_L['practice']} &rarr;</a></p>
      <section><h2>{HI_L['faqs']}</h2>{''.join(f'<details class="faq-item"><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in h['faqs'])}</section>
    </div>'''
    ld = [breadcrumb_ld(crumbs), {'@type': 'FAQPage', 'inLanguage': 'hi-IN', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in h['faqs']]}]
    return page(hi_url(x), seo_title(h['title']), h['description'], body, ld, active=group_url(g), lang='hi-IN', alternates={'en-IN': exam_url(x), 'hi-IN': hi_url(x)})

def hi_practice_page(x):
    h, g = HI[x['id']], GROUP[x['group']]
    crumbs = [(HI_L['home'], '/'), (HI_L['exams'], '/exams/'), (h['name'], hi_url(x)), (HI_L['practice'], hi_url(x, True))]
    qs = h['practice']
    blocks = ''.join(f'''
        <div class="sample"><div class="small muted">{HI_L['q']} {i + 1} · {e(q[0])}</div><p class="sample-q">{e(q[1])}</p>
          <ol class="sample-opts" type="A">{''.join(f'<li>{e(o)}</li>' for o in q[2])}</ol>
          <details><summary>{HI_L['answer']}</summary><p><b>{HI_L['ans']}: {"ABCD"[q[3]]}. {e(q[2][q[3]])}</b></p><p>{e(q[4])}</p></details></div>''' for i, q in enumerate(qs))
    body = f'''    <section class="page-hero"><div class="wrap">{crumbs_html(crumbs)}<h1>{e(h['pq_title'])}</h1><p class="lead-left">{e(h['pq_description'])}</p>
      <p class="meta-row small muted">{HI_L['updated']}: {DATE_HUMAN} · <a href="{practice_url(x)}" hreflang="en-IN" lang="en">{HI_L['english']}</a></p>
      <div class="row" style="margin-top:20px"><a class="btn btn-primary btn-lg" href="/#/test/{x['id']}?demo=1">{HI_L['demo']}</a><a class="btn btn-lg" href="{hi_url(x)}">{e(h['name'])}</a></div></div></section>
    <div class="wrap page prose"><p class="small muted">{HI_L['not_real']}</p>{blocks}</div>'''
    lr = {'@type': 'LearningResource', 'name': h['pq_title'], 'description': h['pq_description'], 'url': BASE + hi_url(x, True), 'inLanguage': 'hi-IN', 'isAccessibleForFree': True, 'provider': {'@id': BASE + '/#org'}}
    return page(hi_url(x, True), seo_title(h['pq_title']), h['pq_description'], body, [breadcrumb_ld(crumbs), lr], active=group_url(g), lang='hi-IN',
                alternates={'en-IN': practice_url(x), 'hi-IN': hi_url(x, True)})

# ---------- free resources: glossary, chapter notes, topics, interview questions ----------
def load_items(folder):
    out = []
    for f in sorted(glob.glob(os.path.join(ROOT, 'content', folder, '*.json'))):
        out += json.load(open(f, encoding='utf-8')).get('items', [])
    return out
EXAM_BY_ID = {x['id']: x for x in EXAMS}
GLOSSARY = {}
for it in load_items('glossary'): GLOSSARY.setdefault(it['slug'], it)
NOTES = {}
for it in load_items('notes'):
    x = EXAM_BY_ID.get(it['exam'])
    if x and not x.get('noindex'): NOTES[(it['exam'], it['chapter'])] = it
TOPICS = {}
for it in load_items('topics'): TOPICS.setdefault(it['slug'], it)
INTERVIEW = {}
for it in load_items('interview'): INTERVIEW.setdefault(it['slug'], it)
COURSE_BY_SLUG = {a['slug']: a for a in SKILLS}

def gl_url(t): return f"/glossary/{t['slug']}/"
def notes_url(x, ch): return chapter_url(x, ch) + 'notes/'
def topic_url(t): return f"/topics/{t['slug']}/"
def iv_url(t): return f"/interview-questions/{t['slug']}/"
def faq_html(faqs): return ''.join(f'<details class="faq-item"><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in faqs)
def faq_ld(faqs): return {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faqs]}
def article_ld(headline, desc, url, **extra):
    return {'@type': 'Article', 'headline': headline, 'description': desc, 'inLanguage': 'en-IN', 'url': BASE + url,
            'author': {'@id': BASE + '/#org'}, 'publisher': {'@id': BASE + '/#org'}, 'dateModified': TODAY.isoformat(), 'isAccessibleForFree': True, **extra}
def exam_links(ids):
    xs = [EXAM_BY_ID[i] for i in ids if i in EXAM_BY_ID and not EXAM_BY_ID[i].get('noindex')]
    return ''.join(f'<li><a href="{exam_url(x)}">{e(code(x))} mock tests</a> <span class="small muted">· <a href="{practice_url(x)}">practice questions</a></span></li>' for x in xs)
def hero(crumbs, h1, lead, kicker=''):
    return f'''    <section class="page-hero"><div class="wrap">{crumbs_html(crumbs)}
      {f'<div class="hero-series">{kicker}</div>' if kicker else ''}<h1 style="margin-top:6px">{e(h1)}</h1>{f'<p class="lead-left">{e(lead)}</p>' if lead else ''}
      <p class="meta-row small muted">Last updated {DATE_HUMAN} · By the {e(SITE['name'])} editorial team · Free</p></div></section>'''

# glossary
GL_ORDER = ['Mutual funds', 'Investment advisory', 'Personal finance', 'Securities markets', 'Derivatives', 'Regulation & compliance', 'Banking', 'Insurance', 'Economy']
def glossary_page(t):
    crumbs = [('Home', '/'), ('Glossary', '/glossary/'), (t['term'], gl_url(t))]
    rel = [GLOSSARY[r] for r in t.get('related', []) if r in GLOSSARY and r != t['slug']]
    same = [o for o in GLOSSARY.values() if o['category'] == t['category'] and o is not t and o not in rel][:max(0, 6 - len(rel))]
    body = hero(crumbs, f"What is {t['term']}?", '', f"{e(t['category'])} · Glossary") + f'''
    <div class="wrap page prose lesson">
      <div class="definition"><b>{e(t['term'])}:</b> {e(t['short'])}</div>
      {''.join(f'<p>{e(p)}</p>' for p in t['body'])}
      <section><h2>Example</h2><div class="example-box">{''.join(f'<p>{e(p)}</p>' for p in t['example'].split(chr(10)) if p.strip())}</div></section>
      <section><h2>FAQs</h2>{faq_html(t['faqs'])}</section>
      {('<section><h2>Where this is tested</h2><ul class="related">' + exam_links(t['exams']) + '</ul></section>') if exam_links(t.get('exams', [])) else ''}
      <section><h2>Related terms</h2><ul class="related">{''.join(f'<li><a href="{gl_url(o)}">{e(o["term"])}</a></li>' for o in rel + same)}</ul></section>
      <p class="small muted">For education only — not investment, tax or legal advice. Rules and limits change; check the regulator's website for current values.</p>
    </div>'''
    term = {'@type': 'DefinedTerm', 'name': t['term'], 'description': t['short'], 'url': BASE + gl_url(t), 'inDefinedTermSet': BASE + '/glossary/'}
    return page(gl_url(t), seo_title(t['title']), t['description'], body, [breadcrumb_ld(crumbs), term, faq_ld(t['faqs'])], active='/glossary/')

def glossary_hub():
    crumbs = [('Home', '/'), ('Glossary', '/glossary/')]
    terms = sorted(GLOSSARY.values(), key=lambda t: t['term'].lower())
    letters = sorted({t['term'][0].upper() for t in terms if t['term'][0].isalpha()})
    az = ''.join(f'<a href="#l-{c}">{c}</a>' for c in letters)
    blocks = ''.join(f'<section id="l-{c}"><h2>{c}</h2><ul class="term-list">' + ''.join(f'<li><a href="{gl_url(t)}">{e(t["term"])}</a><span class="small muted">{e(t["short"][:110])}{"…" if len(t["short"]) > 110 else ""}</span></li>' for t in terms if t['term'][0].upper() == c) + '</ul></section>' for c in letters)
    cats = ''.join(f'<li><b>{e(c)}</b> — {sum(1 for t in terms if t["category"] == c)} terms</li>' for c in GL_ORDER if any(t['category'] == c for t in terms))
    body = hero(crumbs, 'Finance glossary', f"{len(terms)} finance, banking, insurance and stock-market terms explained in plain English with Indian examples — the vocabulary you need for NISM, bank and insurance exams.") + f'''
    <div class="wrap page prose"><nav class="az" aria-label="Jump to letter">{az}</nav><ul class="cat-count">{cats}</ul>{blocks}</div>'''
    ld = [breadcrumb_ld(crumbs), {'@type': 'DefinedTermSet', '@id': BASE + '/glossary/', 'name': 'Success4Sure finance glossary', 'hasDefinedTerm': [{'@type': 'DefinedTerm', 'name': t['term'], 'url': BASE + gl_url(t)} for t in terms]}]
    return page('/glossary/', seo_title('Finance Glossary: Banking, Mutual Fund and Market Terms'), f"Free finance glossary: {len(terms)} banking, mutual fund, insurance and stock-market terms explained simply with Indian examples."[:158], body, ld, active='/glossary/')

# chapter notes
def notes_page(x, ch, n):
    g = GROUP[x['group']]
    chs = [c for c in dict.fromkeys(q[0] for q in QB.get(x['id'], [])) if (x['id'], c) in NOTES]
    i = chs.index(ch)
    crumbs = [('Home', '/'), ('Exams', '/exams/'), (code(x), exam_url(x)), (ch, chapter_url(x, ch) if ch in FREE.get(x['id'], {}) else exam_url(x)), ('Notes', notes_url(x, ch))]
    nav = (f'<a class="btn" href="{notes_url(x, chs[i - 1])}">&larr; {e(chs[i - 1])}</a>' if i > 0 else '') + (f'<a class="btn" href="{notes_url(x, chs[i + 1])}">{e(chs[i + 1])} &rarr;</a>' if i + 1 < len(chs) else '')
    body = hero(crumbs, f"{ch}: {code(x)} revision notes", n['intro'], f"{e(code(x))} · Chapter notes · {len(n['points'])} key points") + f'''
    <div class="wrap page prose lesson">
      <section><h2>Key points</h2>{''.join(f'<h3>{k + 1}. {e(p["heading"])}</h3><p>{e(p["text"])}</p>' for k, p in enumerate(n['points']))}</section>
      {('<section><h2>Formulas and rules of thumb</h2><ul class="formula-list">' + ''.join(f'<li>{e(f)}</li>' for f in n['formulas']) + '</ul></section>') if n.get('formulas') else ''}
      <section><h2>Common traps in the exam</h2><ul>{''.join(f'<li>{e(t)}</li>' for t in n['traps'])}</ul></section>
      <div class="card recap"><h3 style="margin-top:0">Quick recap</h3><p style="margin:0">{e(n['recap'])}</p></div>
      <div class="row" style="margin:24px 0">{('<a class="btn btn-primary" href="' + chapter_url(x, ch) + '">Practise ' + e(ch) + ' questions</a>') if ch in FREE.get(x['id'], {}) else ''}<a class="btn" href="/#/test/{x['id']}/1">Take a free mock test</a></div>
      <div class="row">{nav}</div>
      <section><h2>All {e(code(x))} chapter notes</h2><ul class="related">{''.join(f'<li><a href="{notes_url(x, c)}">{e(c)}</a></li>' for c in chs if c != ch)}</ul></section>
    </div>'''
    return page(notes_url(x, ch), seo_title(n['title']), n['description'], body, [breadcrumb_ld(crumbs), article_ld(n['title'], n['description'], notes_url(x, ch), about=ch, learningResourceType='Revision notes')], active=group_url(g))

# topics
SECTION_ORDER = ['Quantitative Aptitude', 'Data Interpretation', 'Reasoning', 'English Language', 'General Awareness']
def topic_page(t):
    crumbs = [('Home', '/'), ('Topics', '/topics/'), (t['topic'], topic_url(t))]
    rel = [o for o in TOPICS.values() if o['section'] == t['section'] and o is not t][:8]
    ex = ''.join(f'<div class="sample"><div class="small muted">Example {k + 1}</div><p class="sample-q">{e(x_["question"])}</p><details open><summary>Solution</summary>{"".join(f"<p>{e(l)}</p>" for l in x_["solution"].split(chr(10)) if l.strip())}</details></div>' for k, x_ in enumerate(t['examples']))
    body = hero(crumbs, t['title'], t['intro'], f"{e(t['section'])} · Topic guide") + f'''
    <div class="wrap page prose lesson">
      {''.join(f'<section><h2>{e(c["heading"])}</h2>{"".join(f"<p>{e(l)}</p>" for l in c["text"].split(chr(10)) if l.strip())}{("<div class=" + chr(34) + "formula" + chr(34) + ">" + e(c["formula"]) + "</div>") if c.get("formula") else ""}</section>' for c in t['concepts'])}
      <section><h2>Shortcuts and tricks</h2><ul>{''.join(f'<li>{e(s_)}</li>' for s_ in t['shortcuts'])}</ul></section>
      <section><h2>Worked examples</h2>{ex}</section>
      <section><h2>Practice questions</h2>{''.join(q_block(k, q) for k, q in enumerate(t['practice']))}</section>
      <section><h2>FAQs</h2>{faq_html(t['faqs'])}</section>
      {('<section><h2>Practise for these exams</h2><ul class="related">' + exam_links(t['exams']) + '</ul></section>') if exam_links(t.get('exams', [])) else ''}
      {('<section><h2>More ' + e(t['section']) + ' topics</h2><ul class="related">' + ''.join(f'<li><a href="{topic_url(o)}">{e(o["topic"])}</a></li>' for o in rel) + '</ul></section>') if rel else ''}
    </div>'''
    return page(topic_url(t), seo_title(t['title']), t['description'], body, [breadcrumb_ld(crumbs), article_ld(t['title'], t['description'], topic_url(t), about=t['topic']), faq_ld(t['faqs'])], active='/topics/')

def topics_hub():
    crumbs = [('Home', '/'), ('Topics', '/topics/')]
    blocks = ''.join(f'<section><h2>{e(sec)}</h2><ul class="term-list">' + ''.join(f'<li><a href="{topic_url(t)}">{e(t["topic"])}</a><span class="small muted">{e(t["description"][:110])}…</span></li>' for t in sorted(TOPICS.values(), key=lambda t: t['topic']) if t['section'] == sec) + '</ul></section>' for sec in SECTION_ORDER if any(t['section'] == sec for t in TOPICS.values()))
    body = hero(crumbs, 'Bank and SSC exam topics', f"{len(TOPICS)} topic guides for IBPS, SBI, RBI, SSC and CAT: concepts, formulas, shortcut tricks, worked examples and free practice questions.") + f'<div class="wrap page prose">{blocks}</div>'
    ld = [breadcrumb_ld(crumbs), {'@type': 'ItemList', 'itemListElement': [{'@type': 'ListItem', 'position': k + 1, 'url': BASE + topic_url(t), 'name': t['topic']} for k, t in enumerate(TOPICS.values())]}]
    return page('/topics/', seo_title('Bank and SSC Exam Topics: Tricks, Formulas, Practice'), f"Free topic-wise preparation for bank and SSC exams: {len(TOPICS)} guides on quant, reasoning and English with tricks, examples and practice questions."[:158], body, ld, active='/topics/')

# interview questions
IV_ORDER = ['HR basics', 'Freshers', 'Behavioural', 'Banking jobs', 'Finance & advisory', 'Sales roles', 'Salary & offers']
def interview_page(t):
    crumbs = [('Home', '/'), ('Interview questions', '/interview-questions/'), (t['question'], iv_url(t))]
    course = COURSE_BY_SLUG.get(t['course'])
    rel = [o for o in INTERVIEW.values() if o['category'] == t['category'] and o is not t][:8]
    body = hero(crumbs, t['title'], '', f"{e(t['category'])} · Interview question") + f'''
    <div class="wrap page prose lesson">
      <div class="definition"><b>The question:</b> “{e(t['question'])}”</div>
      <section><h2>Why interviewers ask this</h2><p>{e(t['why_asked'])}</p></section>
      <section><h2>How to answer</h2><ol>{''.join(f'<li>{e(s_)}</li>' for s_ in t['how_to_answer'])}</ol></section>
      <section><h2>Sample answers</h2>{''.join(f'<div class="card sample-answer"><div class="small muted">{e(s_["who"])}</div>{"".join(f"<p>{e(l)}</p>" for l in s_["answer"].split(chr(10)) if l.strip())}</div>' for s_ in t['samples'])}
        <p class="small muted">Use these as a structure, not a script — replace the placeholders with your own facts.</p></section>
      <section><h2>Mistakes to avoid</h2><ul>{''.join(f'<li>{e(m)}</li>' for m in t['mistakes'])}</ul></section>
      <section><h2>Likely follow-up questions</h2><ul>{''.join(f'<li>{e(f_)}</li>' for f_ in t['follow_ups'])}</ul></section>
      {f'<div class="card" style="margin:24px 0"><h3 style="margin-top:0">Practise with a free course</h3><p class="muted">{e(course["name"])}: {e(course["blurb"])}</p><a class="btn btn-primary" href="{skill_url(course)}">Open the free course</a></div>' if course else ''}
      <section><h2>FAQs</h2>{faq_html(t['faqs'])}</section>
      {('<section><h2>More ' + e(t['category']) + ' questions</h2><ul class="related">' + ''.join(f'<li><a href="{iv_url(o)}">{e(o["question"])}</a></li>' for o in rel) + '</ul></section>') if rel else ''}
    </div>'''
    return page(iv_url(t), seo_title(t['title']), t['description'], body, [breadcrumb_ld(crumbs), article_ld(t['title'], t['description'], iv_url(t), about=t['question']), faq_ld(t['faqs'])], active='/soft-skills/')

def interview_hub():
    crumbs = [('Home', '/'), ('Interview questions', '/interview-questions/')]
    blocks = ''.join(f'<section><h2>{e(c)}</h2><ul class="term-list">' + ''.join(f'<li><a href="{iv_url(t)}">{e(t["question"])}</a></li>' for t in INTERVIEW.values() if t['category'] == c) + '</ul></section>' for c in IV_ORDER if any(t['category'] == c for t in INTERVIEW.values()))
    body = hero(crumbs, 'Interview questions and sample answers', f"{len(INTERVIEW)} common interview questions for freshers, bank jobs and finance roles — why they are asked, how to structure your answer, sample answers and mistakes to avoid.") + f'<div class="wrap page prose">{blocks}</div>'
    ld = [breadcrumb_ld(crumbs), {'@type': 'ItemList', 'itemListElement': [{'@type': 'ListItem', 'position': k + 1, 'url': BASE + iv_url(t), 'name': t['question']} for k, t in enumerate(INTERVIEW.values())]}]
    return page('/interview-questions/', seo_title('Interview Questions and Sample Answers for Freshers'), f"Free interview preparation: {len(INTERVIEW)} HR, fresher, banking and finance interview questions with how to answer, sample answers and mistakes to avoid."[:158], body, ld, active='/soft-skills/')

# ---------- free tools ----------
TOOLS = [
    {'slug': 'ctc-to-in-hand-salary-calculator', 'name': 'CTC to In-Hand Salary Calculator', 'short': 'CTC to in-hand salary',
     'title': 'CTC to In-Hand Salary Calculator 2026 (New Tax Regime)',
     'desc': 'Convert your CTC to monthly in-hand salary for FY 2026-27 under the new tax regime, after PF, gratuity, professional tax and income tax. Free.',
     'lead': 'Got an offer letter? Enter your annual CTC to estimate your monthly take-home salary under the new tax regime, with a line-by-line breakdown of PF, gratuity, professional tax and income tax.',
     'form': '''<form id="ctc-form" class="tool-form" novalidate>
        <label class="field"><span>Annual CTC (₹)</span><input name="ctc" type="number" inputmode="numeric" min="0" step="1000" value="600000"></label>
        <label class="field"><span>Variable pay / bonus in CTC (₹ per year)</span><input name="variable" type="number" inputmode="numeric" min="0" step="1000" value="0"></label>
        <label class="field"><span>Basic salary (% of fixed CTC)</span><input name="basicPct" type="number" min="10" max="100" step="1" value="40"></label>
        <label class="field"><span>Professional tax (₹ per year)</span><input name="pt" type="number" min="0" step="100" value="2500"></label>
        <label class="check"><input type="checkbox" name="pfInCtc" checked> Employer PF is part of my CTC</label>
        <label class="check"><input type="checkbox" name="pfCap"> PF is calculated on basic capped at ₹15,000 a month</label>
        <label class="check"><input type="checkbox" name="gratuity" checked> Gratuity (4.81% of basic) is part of my CTC</label>
      </form>''', 'out': 'ctc-out', 'exams': False,
     'how': ['Your gross fixed salary is your CTC minus the employer\'s PF contribution, gratuity and variable pay, because these are part of the CTC but are not paid to you every month.',
             'From the gross salary we deduct your own PF contribution (12% of basic), professional tax (set by your state — up to ₹2,500 a year) and income tax.',
             'Income tax uses the new tax regime: a ₹75,000 standard deduction, slabs of 0% up to ₹4 lakh, 5% to ₹8 lakh, 10% to ₹12 lakh, 15% to ₹16 lakh, 20% to ₹20 lakh, 25% to ₹24 lakh and 30% above, the section 87A rebate that makes taxable income up to ₹12 lakh tax-free, and 4% cess.',
             'This is an estimate. Your payslip can differ because of allowances, HRA, meal cards, the old tax regime, or how your employer structures PF. Check the exact rules on the income tax department\'s website.'],
     'faqs': [('Why is my in-hand salary lower than my CTC?', 'CTC includes costs your employer pays on your behalf, such as their PF contribution and gratuity, plus variable pay that is paid later. Your own PF, professional tax and income tax are then deducted from the monthly salary, so in-hand pay is usually 70–90% of CTC divided by 12.'),
              ('Is a salary of ₹12 lakh tax-free under the new regime?', 'Under the new regime, taxable income up to ₹12 lakh gets a full rebate under section 87A. Salaried people also get a ₹75,000 standard deduction, so gross salary of about ₹12.75 lakh can work out to zero tax. Confirm the current year\'s rules before you file.'),
              ('Should I choose the old or new tax regime?', 'The new regime has lower rates but almost no deductions. The old regime can work out cheaper if you claim large deductions such as HRA, 80C investments and home-loan interest. Compare both on the income tax department\'s calculator or with a tax adviser — this tool shows the new regime only.')]},
    {'slug': 'sip-calculator', 'name': 'SIP Calculator', 'short': 'SIP calculator',
     'title': 'SIP Calculator – Monthly SIP Returns with Step-Up',
     'desc': 'Estimate how much a monthly SIP could grow to, with an optional yearly step-up. See invested amount, estimated gains and a year-by-year table. Free.',
     'lead': 'See what a monthly SIP could grow to over time. Add a yearly step-up to see how raising your SIP with each salary hike changes the result.',
     'form': '''<form id="sip-form" class="tool-form" novalidate>
        <label class="field"><span>Monthly SIP amount (₹)</span><input name="amount" type="number" inputmode="numeric" min="100" step="100" value="5000"></label>
        <label class="field"><span>Expected annual return (%)</span><input name="rate" type="number" min="0" max="30" step="0.5" value="12"></label>
        <label class="field"><span>Time period (years)</span><input name="years" type="number" min="1" max="50" step="1" value="10"></label>
        <label class="field"><span>Yearly step-up (%)</span><input name="stepup" type="number" min="0" max="50" step="1" value="0"></label>
      </form>''', 'out': 'sip-out', 'exams': False,
     'how': ['Each monthly instalment is invested at the start of the month and grows at the expected return, compounded monthly. With a step-up, the SIP amount rises by that percentage every 12 months.',
             'Mutual fund returns are not fixed. Equity funds can fall in some years, and past returns do not indicate future returns. Use a conservative rate and treat the result as an illustration, not a promise.',
             'This calculator is for education only and is not investment advice. Mutual fund investments are subject to market risks; read all scheme-related documents carefully.'],
     'faqs': [('What return should I assume for a SIP?', 'There is no fixed answer because market-linked returns vary. Many people test a few rates — for example 8%, 10% and 12% for equity funds — to see a range of outcomes. A lower assumed rate gives a more conservative plan.'),
              ('What is a step-up SIP?', 'A step-up SIP increases your monthly instalment by a fixed percentage each year, usually in line with salary hikes. Even a 5–10% yearly increase can make a large difference to the final amount over 10 years or more.'),
              ('Is the SIP calculator result guaranteed?', 'No. It is a mathematical estimate based on the rate you enter. Actual mutual fund returns depend on markets and can be higher or lower, including negative in some periods.')]},
    {'slug': 'emi-calculator', 'name': 'EMI Calculator', 'short': 'EMI calculator',
     'title': 'EMI Calculator for Home, Car and Personal Loans',
     'desc': 'Calculate the monthly EMI for a home, car, education or personal loan, with total interest payable and the balance left each year. Free and instant.',
     'lead': 'Work out the monthly EMI for any loan and see how much of what you repay is interest. Useful before taking a personal, education, car or home loan — or a credit card EMI.',
     'form': '''<form id="emi-form" class="tool-form" novalidate>
        <label class="field"><span>Loan amount (₹)</span><input name="principal" type="number" inputmode="numeric" min="1000" step="1000" value="500000"></label>
        <label class="field"><span>Interest rate (% per year)</span><input name="rate" type="number" min="0" max="50" step="0.1" value="10.5"></label>
        <label class="field"><span>Loan tenure (years)</span><input name="years" type="number" min="0.5" max="30" step="0.5" value="5"></label>
      </form>''', 'out': 'emi-out', 'exams': False,
     'how': ['EMI = P × r × (1 + r)ⁿ ÷ ((1 + r)ⁿ − 1), where P is the loan amount, r is the monthly interest rate (annual rate ÷ 12 ÷ 100) and n is the number of monthly instalments.',
             'In the early years most of each EMI goes towards interest; later, more of it repays the principal. That is why prepaying early saves the most interest.',
             'Lenders may add processing fees, insurance or GST on charges, and rates can change on floating-rate loans. Check the loan agreement for the exact figures.'],
     'faqs': [('How can I reduce my EMI?', 'You can choose a longer tenure, make a larger down payment, or negotiate a lower interest rate. A longer tenure lowers the EMI but increases the total interest you pay, so compare the total cost, not just the EMI.'),
              ('Is a no-cost EMI really free?', 'Often the interest is offset by a discount the seller gives the lender, but processing fees and GST on interest may still apply, and you may lose a cash discount. Read the terms and compare the total amount paid.'),
              ('How much EMI is affordable?', 'A common rule of thumb is to keep all EMIs together below 30–40% of your monthly take-home pay, so you still have room for savings, emergencies and regular expenses.')]},
    {'slug': 'exam-score-calculator', 'name': 'Exam Score Calculator', 'short': 'Exam score calculator',
     'title': 'Exam Score Calculator with Negative Marking',
     'desc': 'Calculate your score for NISM, IBPS, SBI, SSC, CAT, IC-38 and more with negative marking. Enter right and wrong answers to see your marks.',
     'lead': 'Pick your exam and enter how many questions you got right and wrong. The calculator applies that exam\'s marks per question and negative marking, and tells you how far you are from the pass mark or target score.',
     'form': '''<form id="score-form" class="tool-form" novalidate>
        <label class="field field-wide"><span>Exam</span><select name="exam"></select></label>
        <p class="small muted field-wide" id="score-pattern"></p>
        <label class="field"><span>Correct answers</span><input name="right" type="number" inputmode="numeric" min="0" step="1" value="60"></label>
        <label class="field"><span>Wrong answers</span><input name="wrong" type="number" inputmode="numeric" min="0" step="1" value="15"></label>
      </form>''', 'out': 'score-out', 'exams': True,
     'how': ['Score = (correct answers × marks per question) − (wrong answers × negative marks per wrong answer). Unattempted questions score zero.',
             'Marks per question and the negative-marking rule come from the indicative pattern on each exam\'s page. Many exams deduct a quarter of a question\'s marks for each wrong answer; NISM exams with negative marking typically deduct 25%.',
             'Competitive exams such as IBPS, SBI, SSC and CAT have sectional and overall cut-offs that change every year and by category, so the target score shown is a practice benchmark, not an official cut-off.'],
     'faqs': [('Should I attempt questions I am unsure about?', 'With negative marking of one quarter, a guess between two options has a positive expected value, but a blind guess between four does not. Eliminate at least one or two options before guessing.'),
              ('How is negative marking calculated?', 'If a question carries 1 mark and the penalty is 25%, each wrong answer deducts 0.25 marks. Four wrong answers cancel out one correct answer.'),
              ('Is this my official result?', 'No. It is an estimate from your own count of right and wrong answers. Official scores may be normalised across shifts, and cut-offs are published by the exam body.')]},
    {'slug': 'nism-certificate-validity-checker', 'name': 'NISM Certificate Validity Checker', 'short': 'NISM validity checker',
     'title': 'NISM Certificate Validity Checker and Renewal Date',
     'desc': 'Check when your NISM certificate expires. Enter your series and pass date to see the expiry date, days left and when to start renewal. Free.',
     'lead': 'NISM certificates are valid for three years from the date you pass the exam. Enter your series and the date you passed to see your expiry date and when to start renewing.',
     'form': '''<form id="nism-form" class="tool-form" novalidate>
        <label class="field field-wide"><span>NISM series</span><select name="series"></select></label>
        <label class="field"><span>Date you passed the exam</span><input name="passed" type="date"></label>
      </form>''', 'out': 'nism-out', 'exams': True,
     'how': ['An NISM certificate is valid for three years from the date of passing the certification examination.',
             'To keep it valid you can pass the exam again, or — for series where NISM offers it — complete an accredited Continuing Professional Education (CPE) programme before expiry. Rules can change, so confirm on nism.ac.in.',
             'If you work in a role that requires the certificate (for example as a mutual fund distributor, investment adviser or research analyst), let it lapse only after checking with your employer or the relevant registration body.'],
     'faqs': [('How long is an NISM certificate valid?', 'Three years from the date you pass the examination. The expiry date is printed on your certificate and can be checked on the NISM portal.'),
              ('Can I renew my NISM certificate without an exam?', 'For some series NISM accredits Continuing Professional Education (CPE) programmes that can be used to renew the certificate. Check the NISM website for the series and the time window in which CPE must be completed.'),
              ('What happens if my NISM certificate expires?', 'You may not be able to continue in a role that requires it until you re-certify. Plan ahead: book the exam or CPE programme two to three months before expiry.')]},
]
def tool_url(t): return f"/tools/{t['slug']}/"

def tool_page(t):
    crumbs = [('Home', '/'), ('Free tools', '/tools/'), (t['name'], tool_url(t))]
    others = ''.join(f'<li><a href="{tool_url(o)}">{e(o["name"])}</a></li>' for o in TOOLS if o is not t)
    scripts = (f'<script src="/js/data/exams.js?v={ASSET_V}"></script>' if t['exams'] else '') + f'<script src="/js/tools.js?v={ASSET_V}"></script>'
    body = f'''    <section class="page-hero"><div class="wrap">{crumbs_html(crumbs)}<h1>{e(t['name'])}</h1><p class="lead-left">{e(t['lead'])}</p>
      <p class="meta-row small muted">Last updated {DATE_HUMAN} · Free to use</p></div></section>
    <div class="wrap page">
      <div class="tool-grid"><div class="card">{t['form']}</div><div class="card tool-out" id="{t['out']}" aria-live="polite"></div></div>
      <div class="prose" style="margin-top:40px">
        <section><h2>How the {e(t['short'])} works</h2>{''.join(f'<p>{e(p)}</p>' for p in t['how'])}</section>
        <section><h2>FAQs</h2>{''.join(f'<details class="faq-item"><summary>{e(q)}</summary><p>{e(a)}</p></details>' for q, a in t['faqs'])}</section>
        <section><h2>More free tools</h2><ul class="related">{others}</ul></section>
      </div>
    </div>
    {scripts}'''
    app = {'@type': 'WebApplication', 'name': t['name'], 'url': BASE + tool_url(t), 'applicationCategory': 'FinanceApplication' if t['slug'] in ('ctc-to-in-hand-salary-calculator', 'sip-calculator', 'emi-calculator') else 'EducationalApplication',
           'operatingSystem': 'Any', 'offers': {'@type': 'Offer', 'price': 0, 'priceCurrency': 'INR'}, 'provider': {'@id': BASE + '/#org'}, 'inLanguage': 'en-IN'}
    ld = [breadcrumb_ld(crumbs), app, {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in t['faqs']]}]
    return page(tool_url(t), seo_title(t['title']), t['desc'], body, ld, active='/tools/')

# ---------- blog ----------
BLOG_CATS = [
    {'name': 'MBA', 'color': '#7a5af8', 'slug': 'mba', 'blurb': 'CAT, CMAT, MAT and XAT preparation, choosing a B-school and specialisation, and thinking clearly about whether an MBA is worth it for you.'},
    {'name': 'AI', 'color': '#0ea5e9', 'slug': 'ai', 'blurb': 'Practical, hype-free guides to using AI tools for study and work in India — what they do well, where they fail, and how to use them safely.'},
    {'name': 'Stock Market', 'color': '#2457f5', 'slug': 'stock-market', 'blurb': 'How the Indian stock market works, explained from first principles: exchanges, IPOs, ratios, corporate actions and the mistakes beginners make.'},
    {'name': 'Mutual Funds', 'color': '#12b76a', 'slug': 'mutual-funds', 'blurb': 'Mutual funds without jargon: fund categories, SIPs, costs, factsheets and taxation, with worked rupee examples.'},
    {'name': 'Trading', 'color': '#f79009', 'slug': 'trading', 'blurb': 'Trading styles, futures and options, margin and risk management — explained honestly, including why most individual F&O traders lose money.'},
]
BLOG_CAT = {c['name']: c for c in BLOG_CATS}
POSTS = [p for p in load_items('blog') if p.get('category') in BLOG_CAT]
RISK_CATS = {'Stock Market', 'Mutual Funds', 'Trading'}
TOOL_BY_SLUG = {t['slug']: t for t in TOOLS}

def post_url(p): return f"/blog/{p['slug']}/"
def blog_cat_url(c): return f"/blog/{c['slug']}/"
def post_words(p): return len(' '.join([p['excerpt']] + [' '.join(s_.get('paragraphs', []) + s_.get('bullets', [])) for s_ in p['sections']] + p['takeaways']).split())
def read_min(p): return max(3, round(post_words(p) / 220))
def post_card(p):
    c = BLOG_CAT[p['category']]
    return f'''<article class="card post-card" style="--c:{c['color']}"><a class="badge" href="{blog_cat_url(c)}">{e(c['name'])}</a>
      <h3><a href="{post_url(p)}">{e(p['h1'])}</a></h3><p class="muted small">{e(p['excerpt'])}</p><span class="small muted">{read_min(p)} min read</span></article>'''

def blog_table(t):
    return '<div class="table-wrap"><table><tr>' + ''.join(f'<th>{e(h)}</th>' for h in t['head']) + '</tr>' + ''.join('<tr>' + ''.join(f'<td>{e(c)}</td>' for c in r) + '</tr>' for r in t['rows']) + '</table></div>'

def post_page(p):
    c = BLOG_CAT[p['category']]
    crumbs = [('Home', '/'), ('Blogs', '/blog/'), (c['name'], blog_cat_url(c)), (p['h1'], post_url(p))]
    secs = ''.join(f'''<section><h2>{e(s_['heading'])}</h2>{''.join(f'<p>{e(x)}</p>' for x in s_['paragraphs'])}{('<ul>' + ''.join(f'<li>{e(b)}</li>' for b in s_['bullets']) + '</ul>') if s_.get('bullets') else ''}{blog_table(s_['table']) if s_.get('table') else ''}</section>''' for s_ in p['sections'])
    r = p.get('related', {})
    links = []
    links += [f'<li><a href="{gl_url(GLOSSARY[g])}">What is {e(GLOSSARY[g]["term"])}?</a></li>' for g in r.get('glossary', []) if g in GLOSSARY]
    links += [f'<li><a href="{exam_url(EXAM_BY_ID[x])}">{e(code(EXAM_BY_ID[x]))} free mock tests</a></li>' for x in r.get('exams', []) if x in EXAM_BY_ID and not EXAM_BY_ID[x].get('noindex')]
    links += [f'<li><a href="{tool_url(TOOL_BY_SLUG[t])}">{e(TOOL_BY_SLUG[t]["name"])}</a></li>' for t in r.get('tools', []) if t in TOOL_BY_SLUG]
    links += [f'<li><a href="{topic_url(TOPICS[t])}">{e(TOPICS[t]["topic"])}: concepts and practice</a></li>' for t in r.get('topics', []) if t in TOPICS]
    links += [f'<li><a href="{skill_url(COURSE_BY_SLUG[k])}">Free course: {e(COURSE_BY_SLUG[k]["name"])}</a></li>' for k in r.get('courses', []) if k in COURSE_BY_SLUG]
    more = [o for o in POSTS if o['category'] == p['category'] and o is not p][:5]
    disclaimer = '<p class="small muted">This article is for education only and is not investment, tax or trading advice. Investments in securities markets are subject to market risks; read all related documents carefully and consider speaking to a SEBI-registered investment adviser before acting.</p>' if p['category'] in RISK_CATS else ''
    body = f'''    <section class="page-hero"><div class="wrap">{crumbs_html(crumbs)}
      <div class="hero-series"><a href="{blog_cat_url(c)}">{e(c['name'])}</a> · {read_min(p)} min read</div>
      <h1 style="margin-top:6px">{e(p['h1'])}</h1><p class="lead-left">{e(p['excerpt'])}</p>
      <p class="meta-row small muted">By the {e(SITE['name'])} editorial team · Updated {DATE_HUMAN} · <a href="/how-we-create-questions/">Editorial process</a></p></div></section>
    <div class="wrap page prose lesson">
      <div class="card takeaways-card"><h2 style="margin-top:0;font-size:1.1rem">Key takeaways</h2><ul>{''.join(f'<li>{e(t)}</li>' for t in p['takeaways'])}</ul></div>
      {secs}
      {disclaimer}
      <section><h2>FAQs</h2>{faq_html(p['faqs'])}</section>
      {('<section><h2>Related on ' + e(SITE['name']) + '</h2><ul class="related">' + ''.join(links) + '</ul></section>') if links else ''}
      {('<section><h2>More in ' + e(c['name']) + '</h2><div class="post-grid">' + ''.join(post_card(o) for o in more) + '</div></section>') if more else ''}
    </div>'''
    words = post_words(p)
    ld = [breadcrumb_ld(crumbs), {'@type': 'BlogPosting', 'headline': p['h1'], 'description': p['description'], 'inLanguage': 'en-IN', 'url': BASE + post_url(p),
          'mainEntityOfPage': BASE + post_url(p), 'articleSection': c['name'], 'keywords': ', '.join([p['primary']] + p.get('secondary', [])), 'wordCount': words,
          'author': {'@id': BASE + '/#org'}, 'publisher': {'@id': BASE + '/#org'}, 'datePublished': TODAY.isoformat(), 'dateModified': TODAY.isoformat(),
          'isPartOf': {'@type': 'Blog', '@id': BASE + '/blog/'}}, faq_ld(p['faqs'])]
    return page(post_url(p), seo_title(p['title']), p['description'], body, ld, active='/blog/')

def blog_cat_page(c):
    posts = [p for p in POSTS if p['category'] == c['name']]
    crumbs = [('Home', '/'), ('Blogs', '/blog/'), (c['name'], blog_cat_url(c))]
    chips = ''.join(f'<a class="chip {"active" if o is c else ""}" style="--c:{o["color"]}" href="{blog_cat_url(o)}">{e(o["name"])}</a>' for o in BLOG_CATS if any(p['category'] == o['name'] for p in POSTS))
    body = hero(crumbs, f"{c['name']} articles", c['blurb']) + f'''
    <div class="wrap page"><nav class="chips" aria-label="Blog categories"><a class="chip" href="/blog/">All</a>{chips}</nav>
      <div class="post-grid">{''.join(post_card(p) for p in posts)}</div></div>'''
    ld = [breadcrumb_ld(crumbs), {'@type': 'CollectionPage', 'name': f"{c['name']} articles", 'url': BASE + blog_cat_url(c), 'isPartOf': {'@type': 'Blog', '@id': BASE + '/blog/'},
          'mainEntity': {'@type': 'ItemList', 'itemListElement': [{'@type': 'ListItem', 'position': k + 1, 'url': BASE + post_url(p), 'name': p['h1']} for k, p in enumerate(posts)]}}]
    desc = f"{c['name']} articles from {SITE['name']}: {c['blurb']}"
    return page(blog_cat_url(c), seo_title(f"{c['name']} Articles and Guides"), desc[:155].rsplit(' ', 1)[0] + '.', body, ld, active='/blog/')

def blog_hub():
    crumbs = [('Home', '/'), ('Blogs', '/blog/')]
    chips = ''.join(f'<a class="chip" style="--c:{c["color"]}" href="{blog_cat_url(c)}">{e(c["name"])}</a>' for c in BLOG_CATS if any(p['category'] == c['name'] for p in POSTS))
    sections = ''.join(f'<section style="margin-top:32px"><div class="row" style="margin-bottom:12px"><h2 style="margin:0">{e(c["name"])}</h2><span class="spacer"></span><a class="small" href="{blog_cat_url(c)}">All {e(c["name"])} articles &rarr;</a></div><div class="post-grid">' + ''.join(post_card(p) for p in [p for p in POSTS if p['category'] == c['name']][:3]) + '</div></section>' for c in BLOG_CATS if any(p['category'] == c['name'] for p in POSTS))
    body = hero(crumbs, f"{SITE['name']} blogs", 'Clear, practical articles on MBA entrance, AI at work, the stock market, mutual funds and trading — written for Indian students and early-career professionals.') + f'''
    <div class="wrap page"><nav class="chips" aria-label="Blog categories"><a class="chip active" href="/blog/">All</a>{chips}</nav>{sections}</div>'''
    ld = [breadcrumb_ld(crumbs), {'@type': 'Blog', '@id': BASE + '/blog/', 'name': f"{SITE['name']} blogs", 'url': BASE + '/blog/', 'publisher': {'@id': BASE + '/#org'}, 'inLanguage': 'en-IN',
          'blogPost': [{'@type': 'BlogPosting', 'headline': p['h1'], 'url': BASE + post_url(p)} for p in POSTS]}]
    return page('/blog/', seo_title('Blogs: MBA, AI, Stock Market, Mutual Funds, Trading'), 'Free articles on MBA entrance, AI at work, the Indian stock market, mutual funds and trading — practical, jargon-free and written for India.', body, ld, active='/blog/')

# ---------- live listings: NFOs and government exams ----------
def load_live(name):
    p = os.path.join(ROOT, 'content', 'live', name)
    return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else {'updated': None, 'items': []}
LIVE_NFO, LIVE_GOVT = load_live('nfo.json'), load_live('govt-exams.json')
def fmt_d(v):
    if not v: return 'Not announced'
    return datetime.date.fromisoformat(v).strftime('%-d %b %Y')
# Pages are rebuilt when the data changes; this small script also hides anything that has closed since the last build.
LIVE_EXPIRE_JS = '''<script>(function(){var t=new Date();t.setHours(0,0,0,0);document.querySelectorAll('[data-ends]').forEach(function(el){var d=el.getAttribute('data-ends');if(d&&new Date(d+'T23:59:59')<t){el.hidden=true;}});
document.querySelectorAll('[data-left]').forEach(function(el){var d=new Date(el.getAttribute('data-left')+'T00:00:00'),n=Math.round((d-t)/864e5);el.textContent=n<0?'Closed':n===0?'Last day today':n===1?'1 day left':n+' days left';});
document.querySelectorAll('.live-filter button').forEach(function(b){b.addEventListener('click',function(){var v=b.getAttribute('data-f');b.parentNode.querySelectorAll('button').forEach(function(x){x.classList.toggle('active',x===b);});document.querySelectorAll('.live-card').forEach(function(c){c.style.display=(v==='All'||c.getAttribute('data-f')===v)?'':'none';});});});})();</script>'''

def nfo_card(it):
    rows = [('Subscription', f"{fmt_d(it.get('open_date'))} – {fmt_d(it.get('close_date'))}"), ('Type', it.get('type')), ('Minimum investment', it.get('min_investment')),
            ('Benchmark', it.get('benchmark')), ('Exit load', it.get('exit_load')), ('Riskometer', it.get('riskometer')), ('Fund manager', it.get('fund_manager'))]
    links = f'<a class="btn btn-sm" href="{e(it["source_url"])}" target="_blank" rel="noopener nofollow">AMC page</a>' + (f'<a class="btn btn-sm" href="{e(it["sid_url"])}" target="_blank" rel="noopener nofollow">Scheme document</a>' if it.get('sid_url') else '')
    return f'''<article class="card live-card" data-ends="{e(it.get('close_date') or '')}" data-f="{e(it['category'].split(' –')[0].split(' (')[0])}">
      <div class="row"><span class="badge">{e(it['category'])}</span><span class="spacer"></span>{f'<span class="badge badge-warn" data-left="{e(it["close_date"])}">Closes {fmt_d(it["close_date"])}</span>' if it.get('close_date') else ''}</div>
      <h3>{e(it['scheme'])}</h3><div class="small muted">{e(it['amc'])}</div>
      <p class="small" style="margin:10px 0">{e(it['objective'])}</p>
      <dl class="live-dl">{''.join(f'<dt>{k}</dt><dd>{e(v)}</dd>' for k, v in rows if v)}</dl>
      <div class="row" style="margin-top:12px">{links}</div></article>'''

def govt_card(it):
    rel = EXAM_BY_ID.get(it.get('related_exam') or '')
    rows = [('Applications', f"{fmt_d(it.get('apply_start'))} – {fmt_d(it.get('apply_end'))}" if (it.get('apply_start') or it.get('apply_end')) else None), ('Exam date', fmt_d(it['exam_date']) if it.get('exam_date') else None),
            ('Vacancies', it.get('posts')), ('Eligibility', it.get('eligibility')), ('Age limit', it.get('age_limit'))]
    status_cls = {'Application open': 'badge-success', 'Upcoming': '', 'Notification expected': 'badge-warn'}.get(it['status'], '')
    ends = it.get('apply_end') if it['status'] == 'Application open' else (it.get('exam_date') if it['status'] == 'Upcoming' else '')
    links = f'<a class="btn btn-sm" href="{e(it["official_url"])}" target="_blank" rel="noopener nofollow">Official website</a>' + (f'<a class="btn btn-sm" href="{e(it["notification_url"])}" target="_blank" rel="noopener nofollow">Notification</a>' if it.get('notification_url') else '') \
        + (f'<a class="btn btn-sm btn-primary" href="{exam_url(rel)}">Free {e(code(rel))} mock tests</a>' if rel and not rel.get('noindex') else '')
    return f'''<article class="card live-card" data-ends="{e(ends or '')}" data-f="{e(it['sector'])}">
      <div class="row"><span class="badge {status_cls}">{e(it['status'])}</span><span class="badge">{e(it['sector'])}</span><span class="spacer"></span>{f'<span class="badge badge-warn" data-left="{e(it["apply_end"])}">Apply by {fmt_d(it["apply_end"])}</span>' if it['status'] == 'Application open' and it.get('apply_end') else ''}</div>
      <h3>{e(it['title'])}</h3><div class="small muted">{e(it['org'])}</div>
      <dl class="live-dl">{''.join(f'<dt>{k}</dt><dd>{e(v)}</dd>' for k, v in rows if v)}</dl>
      <div class="row" style="margin-top:12px">{links}</div></article>'''

def live_filter(values):
    return '<div class="live-filter chips">' + ''.join(f'<button class="chip {"active" if v == "All" else ""}" data-f="{e(v)}">{e(v)}</button>' for v in ['All'] + values) + '</div>'

def nfo_page():
    items = sorted(LIVE_NFO['items'], key=lambda it: it.get('close_date') or '9999')
    month = datetime.date.fromisoformat(LIVE_NFO['updated']).strftime('%B %Y') if LIVE_NFO.get('updated') else ''
    crumbs = [('Home', '/'), ('New Fund Offers', '/nfo/')]
    cats = sorted({it['category'].split(' –')[0].split(' (')[0] for it in items})
    body = hero(crumbs, f"New Fund Offers (NFOs) open now{' – ' + month if month else ''}", f"Mutual fund NFOs currently open or opening soon across Indian AMCs, with subscription dates, minimum investment, benchmark, exit load and riskometer. Information last checked {fmt_d(LIVE_NFO.get('updated'))} from AMC and AMFI sources.") + f'''
    <div class="wrap page">{live_filter(cats)}<div class="live-grid">{''.join(nfo_card(it) for it in items) or '<p class="muted">No NFOs are open right now. Check back soon.</p>'}</div>
      <div class="notice" style="margin-top:24px">{('<span>')}This list is for information only and is not a recommendation to invest. A new fund has no track record; read the Scheme Information Document (SID) and Key Information Memorandum (KIM) on the AMC's website before investing, and confirm dates there. Mutual fund investments are subject to market risks; read all scheme-related documents carefully.</span></div>
      <section class="prose" style="margin-top:32px"><h2>What is an NFO?</h2><p>A New Fund Offer is the first subscription period of a new mutual fund scheme, when units are usually offered at ₹10 each. Open-ended schemes reopen for continuous purchase shortly after the NFO closes; close-ended schemes can only be bought during the NFO (and later on the stock exchange, if listed). A ₹10 NFO price does not make a fund "cheap" — what matters is the strategy, costs and how it fits your goals. Learn more: <a href="/glossary/">finance glossary</a> · <a href="/blog/mutual-funds/">mutual fund articles</a>.</p></section>
    </div>{LIVE_EXPIRE_JS}'''
    ld = [breadcrumb_ld(crumbs), {'@type': 'ItemList', 'name': 'Open New Fund Offers', 'itemListElement': [{'@type': 'ListItem', 'position': k + 1, 'name': f"{it['scheme']} ({it['amc']})", 'url': it['source_url']} for k, it in enumerate(items)]}]
    return page('/nfo/', seo_title(f"NFO List: New Fund Offers Open Now{' – ' + month if month else ''}"), f"Mutual fund NFOs open now in India{' (' + month + ')' if month else ''}: scheme, AMC, subscription dates, minimum investment, benchmark, exit load and riskometer, with official links.", body, ld, active='/nfo/')

def govt_page():
    items = sorted(LIVE_GOVT['items'], key=lambda it: ({'Application open': 0, 'Upcoming': 1, 'Notification expected': 2}[it['status']], it.get('apply_end') or it.get('exam_date') or '9999'))
    month = datetime.date.fromisoformat(LIVE_GOVT['updated']).strftime('%B %Y') if LIVE_GOVT.get('updated') else ''
    crumbs = [('Home', '/'), ('Government exams', '/govt-exams/')]
    secs = [s for s in ['Banking', 'SSC', 'UPSC', 'Railways', 'Insurance', 'PSU', 'Defence', 'Teaching', 'State PSC', 'Other'] if any(it['sector'] == s for it in items)]
    body = hero(crumbs, f"Government exams and jobs open now{' – ' + month if month else ''}", f"Current and upcoming recruitments from central government, banks, regulators, insurance companies and PSUs — with application dates, vacancies, eligibility and official links. Last checked {fmt_d(LIVE_GOVT.get('updated'))}.") + f'''
    <div class="wrap page">{live_filter(secs)}<div class="live-grid">{''.join(govt_card(it) for it in items) or '<p class="muted">No openings listed right now. Check back soon.</p>'}</div>
      <div class="notice" style="margin-top:24px"><span>Dates, vacancies and eligibility are taken from official notifications but can change through corrigenda. Always confirm on the official website before applying. {e(SITE['name'])} is not affiliated with any recruiting body.</span></div>
      <section class="prose" style="margin-top:32px"><h2>Prepare for free</h2><p>Practise with free full-length mock tests for <a href="/exams/banking/">bank exams</a>, <a href="/exams/ssc/">SSC exams</a> and <a href="/exams/insurance-finance/">insurance exams</a>, revise with <a href="/topics/">topic guides</a> and get ready for the interview round with <a href="/interview-questions/">interview questions and sample answers</a>.</p></section>
    </div>{LIVE_EXPIRE_JS}'''
    ld = [breadcrumb_ld(crumbs), {'@type': 'ItemList', 'name': 'Government exams and jobs open now', 'itemListElement': [{'@type': 'ListItem', 'position': k + 1, 'name': it['title'], 'url': it['official_url']} for k, it in enumerate(items)]}]
    return page('/govt-exams/', seo_title(f"Govt Exams and Jobs Open Now{' – ' + month if month else ''}"), f"Government, bank, SSC, insurance and PSU recruitments open now{' (' + month + ')' if month else ''}: application dates, vacancies, eligibility and official links.", body, ld, active='/govt-exams/')

def tools_hub():
    crumbs = [('Home', '/'), ('Free tools', '/tools/')]
    cards = ''.join(f'<div class="card"><h2 style="font-size:1.15rem;margin-top:0"><a href="{tool_url(t)}">{e(t["name"])}</a></h2><p class="muted">{e(t["lead"])}</p></div>' for t in TOOLS)
    body = f'''    <section class="page-hero"><div class="wrap">{crumbs_html(crumbs)}<h1>Free calculators for exams, salary and money</h1>
      <p class="lead-left">Quick, free tools for students and early-career professionals: work out your take-home salary, plan a SIP, check a loan EMI, score your mock test with negative marking and track your NISM certificate's expiry.</p></div></section>
    <div class="wrap page"><div class="grid">{cards}</div></div>'''
    ld = [breadcrumb_ld(crumbs), {'@type': 'ItemList', 'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'url': BASE + tool_url(t), 'name': t['name']} for i, t in enumerate(TOOLS)]}]
    return page('/tools/', seo_title('Free Salary, SIP, EMI and Exam Score Calculators'), 'Free online calculators: CTC to in-hand salary, SIP with step-up, loan EMI, exam score with negative marking and NISM certificate validity.', body, ld, active='/tools/')

# ---------- home (SPA shell gets SEO head + crawlable fallback) ----------
def home_seo():
    title = f"NISM, Bank, SSC & CAT Mock Tests Online | {SITE['name']}"
    desc = f"Online mock tests with answers for {len(INDEXABLE)} exams – NISM, IBPS, SBI, SSC, CAT, IC-38 – plus soft-skills courses. All free."
    ld = {'@context': 'https://schema.org', '@graph': [org_ld(), {'@type': 'WebSite', '@id': BASE + '/#site', 'name': SITE['name'], 'url': BASE + '/', 'publisher': {'@id': BASE + '/#org'}, 'inLanguage': 'en-IN'}]}
    head = f'''<!-- seo:head -->
  <title>{e(title)}</title>
  <meta name="description" content="{e(desc)}">
  <link rel="canonical" href="{BASE}/">
  <meta name="robots" content="index, follow, max-image-preview:large">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="{e(SITE['name'])}">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(desc)}">
  <meta property="og:url" content="{BASE}/">
  <meta property="og:locale" content="en_IN">
  <script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
  <!-- /seo:head -->'''
    groups = ''.join(f'<h2><a href="{group_url(g)}">{e(g["label"])} mock tests</a></h2><ul>' + ''.join(f'<li><a href="{exam_url(x)}">{e(code(x))} mock test – {e(x["name"])}</a></li>' for x in INDEXABLE if x['group'] == g['id']) + '</ul>' for g in GROUPS)
    body = f'''<!-- seo:body -->
    <div class="wrap page prose">
      <h1>Pass your exam with confidence</h1>
      <p>Exam-pattern mock tests, topic-wise practice and a clear explanation for every answer — for NISM certifications, banking, SSC, MBA entrance and insurance exams. <a href="/exams/">Browse all {len(INDEXABLE)} exams</a> or get <a href="/study-material/">free official study material</a>.</p>
      {groups}
      <p><a href="/about/">About us</a> · <a href="/how-we-create-questions/">How we create questions</a> · <a href="/contact/">Contact</a></p>
    </div>
    <!-- /seo:body -->'''
    return head, body

# ---------- build ----------
def main():
    pages = []  # (path, indexable)
    for x in EXAMS:
        wr(exam_url(x).strip('/') + '/index.html', exam_page(x)); pages.append((exam_url(x), not x.get('noindex')))
        if not x.get('noindex'):
            wr(practice_url(x).strip('/') + '/index.html', practice_page(x)); pages.append((practice_url(x), True))
        for i, (ch, block) in enumerate(FREE.get(x['id'], {}).items()):
            wr(chapter_url(x, ch).strip('/') + '/index.html', chapter_page(x, i, ch, block)); pages.append((chapter_url(x, ch), True))
        if x['id'] in HI:
            wr(hi_url(x).strip('/') + '/index.html', hi_exam_page(x)); pages.append((hi_url(x), True))
            wr(hi_url(x, True).strip('/') + '/index.html', hi_practice_page(x)); pages.append((hi_url(x, True), True))
    if GUIDES:
        wr('guides/index.html', guides_hub()); pages.append(('/guides/', True))
        for gd in GUIDES:
            wr(guide_url(gd).strip('/') + '/index.html', guide_page(gd)); pages.append((guide_url(gd), True))
    # free question data for Question of the Day (shuffled once, deterministically)
    import random
    for old in glob.glob(os.path.join(ROOT, 'js', 'data', 'free', '*.js')): os.remove(old)
    for xid, chs in FREE.items():
        qs = [[ch] + q for ch, b in chs.items() for q in b['questions']]
        random.Random(xid).shuffle(qs)
        wr(f'js/data/free/{xid}.js', '// Generated by tools/build_site.py from content/free-questions — free practice questions.\n'
           + f"(window.FREE_Q = window.FREE_Q || {{}})[{json.dumps(xid)}] = {json.dumps({'qs': qs}, ensure_ascii=False)};\n")
    for g in GROUPS:
        wr(group_url(g).strip('/') + '/index.html', group_page(g)); pages.append((group_url(g), True))
    wr('exams/index.html', exams_hub()); pages.append(('/exams/', True))
    wr('study-material/index.html', study_page()); pages.append(('/study-material/', True))
    for path, fn in [('/about/', about_page), ('/how-we-create-questions/', method_page), ('/contact/', contact_page),
                     ('/privacy-policy/', privacy_page), ('/terms/', terms_page), ('/disclaimer/', disclaimer_page)]:
        wr(path.strip('/') + '/index.html', fn()); pages.append((path, True))

    if GLOSSARY:
        wr('glossary/index.html', glossary_hub()); pages.append(('/glossary/', True))
        for t in GLOSSARY.values(): wr(gl_url(t).strip('/') + '/index.html', glossary_page(t)); pages.append((gl_url(t), True))
    for (xid, ch), n in NOTES.items():
        x = EXAM_BY_ID[xid]; wr(notes_url(x, ch).strip('/') + '/index.html', notes_page(x, ch, n)); pages.append((notes_url(x, ch), True))
    if TOPICS:
        wr('topics/index.html', topics_hub()); pages.append(('/topics/', True))
        for t in TOPICS.values(): wr(topic_url(t).strip('/') + '/index.html', topic_page(t)); pages.append((topic_url(t), True))
    if INTERVIEW:
        wr('interview-questions/index.html', interview_hub()); pages.append(('/interview-questions/', True))
        for t in INTERVIEW.values(): wr(iv_url(t).strip('/') + '/index.html', interview_page(t)); pages.append((iv_url(t), True))
    if POSTS:
        wr('blog/index.html', blog_hub()); pages.append(('/blog/', True))
        for c in BLOG_CATS:
            if any(p['category'] == c['name'] for p in POSTS): wr(blog_cat_url(c).strip('/') + '/index.html', blog_cat_page(c)); pages.append((blog_cat_url(c), True))
        for p in POSTS: wr(post_url(p).strip('/') + '/index.html', post_page(p)); pages.append((post_url(p), True))
    wr('nfo/index.html', nfo_page()); pages.append(('/nfo/', True))
    wr('govt-exams/index.html', govt_page()); pages.append(('/govt-exams/', True))
    wr('js/data/live.js', '// Generated by tools/build_site.py from content/live/*.json — NFOs and government exams for the homepage.\n'
       + f"window.LIVE = {json.dumps({'nfo': LIVE_NFO, 'govt': LIVE_GOVT}, ensure_ascii=False)};\n")
    wr('tools/index.html', tools_hub()); pages.append(('/tools/', True))
    for t in TOOLS:
        wr(tool_url(t).strip('/') + '/index.html', tool_page(t)); pages.append((tool_url(t), True))
    wr('404.html', not_found_page())
    if SKILLS:
        wr('soft-skills/index.html', skills_hub_page()); pages.append(('/soft-skills/', True))
        for a in SKILLS:
            wr(skill_url(a).strip('/') + '/index.html', skill_area_page(a)); pages.append((skill_url(a), True))
            for i, l in enumerate(a['lessons']):
                wr(skill_url(a, l).strip('/') + '/index.html', skill_lesson_page(a, i, l)); pages.append((skill_url(a, l), True))
    # Small catalogue for every page; full lesson content is split per course and loaded on demand.
    stub = lambda l: {'id': l['id'], 'title': l['title'], 'track': l['track'], 'minutes': l['minutes'], 'summary': l['summary'],
                      'nQuiz': len(l['quiz']), 'nScen': len(l['scenarios'])}
    catalog = [{**{k: v for k, v in a.items() if k != 'lessons'}, 'lessons': [stub(l) for l in a['lessons']]} for a in SKILLS]
    wr('js/data/softskills.js', '// Generated by tools/build_site.py from content/softskills/*.json — edit the JSON, then rebuild.\n'
       + f'window.SKILL_GROUPS = {json.dumps(SKILL_GROUPS, ensure_ascii=False)};\n'
       + f'window.SKILL_AREAS = {json.dumps(catalog, ensure_ascii=False)};\n')
    for old in glob.glob(os.path.join(ROOT, 'js', 'data', 'softskills', '*.js')): os.remove(old)
    for a in SKILLS:
        wr(f"js/data/softskills/{a['slug']}.js", '// Generated by tools/build_site.py — full lessons for one course, loaded on demand.\n'
           + f"(window.SKILL_FULL = window.SKILL_FULL || {{}})[{json.dumps(a['slug'])}] = {json.dumps(a['lessons'], ensure_ascii=False)};\n")

    # app data
    app_exams = [{k: v for k, v in x.items() if k not in ('page', 'noindex')} | {'slug': x['slug']} | ({'free': True} if x['id'] in FREE else {}) for x in EXAMS]
    wr('js/data/exams.js', '// Generated by tools/build_site.py from content/catalog.json — edit the JSON, then rebuild.\n'
       + ''.join(f'window.{k} = {json.dumps(CAT[k], ensure_ascii=False)};\n' for k in ('PLANS', 'MAX_TESTS', 'GROUPS', 'CATEGORIES'))
       + f'window.EXAMS = {json.dumps(app_exams, ensure_ascii=False)};\n')
    subprocess.run([sys.executable, '-I', os.path.join(ROOT, 'tools', 'build_qbank.py')], check=True)

    # home
    idx = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    head, body = home_seo()
    idx = re.sub(r'<!-- seo:head -->.*?<!-- /seo:head -->', lambda m: head, idx, flags=re.S)
    idx = re.sub(r'<!-- seo:body -->.*?<!-- /seo:body -->', lambda m: body, idx, flags=re.S)
    idx = re.sub(r'\?v=[0-9a-z]+', f'?v={ASSET_V}', idx)
    wr('index.html', idx)

    # sitemap + robots
    urls = ['/'] + [p for p, ok in pages if ok]
    wr('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
       + ''.join(f'  <url><loc>{BASE}{u}</loc><lastmod>{TODAY.isoformat()}</lastmod></url>\n' for u in urls) + '</urlset>\n')
    wr('robots.txt', f'User-agent: *\nAllow: /\n\nSitemap: {BASE}/sitemap.xml\n')

    ss = (1 + len(SKILLS) + sum(len(a['lessons']) for a in SKILLS)) if SKILLS else 0
    print(f'Sitemap: {len(urls)} URLs  (blog {len(POSTS)}, glossary {len(GLOSSARY)}, notes {len(NOTES)}, topics {len(TOPICS)}, interview {len(INTERVIEW)}, chapter pages {sum(len(v) for v in FREE.values())}, guides {len(GUIDES)}, Hindi {2 * len(HI)}, tools {len(TOOLS) + 1}; home 1, exam hub 1, categories {len(GROUPS)}, exams {len(INDEXABLE)}, practice-question pages {len(INDEXABLE)}, study material 1, trust pages 6, soft skills {ss})')
    print(f'Not in sitemap (noindex): {", ".join(code(x) for x in EXAMS if x.get("noindex"))}')
    for w in warnings: print('WARN', w)

main()
