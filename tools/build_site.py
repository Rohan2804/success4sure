"""Build the crawlable pages, sitemap and app data for success4sure.in.

Run from the project root:  python3 -I tools/build_site.py

Inputs : content/catalog.json, content/exam-pages.json, content/site.json, js/data/qbank/*.json
Outputs: js/data/exams.js, js/data/qbank.js, index.html (SEO head + fallback content),
         exams/**, study-material/, about/, how-we-create-questions/, contact/,
         privacy-policy/, terms/, refund-policy/, disclaimer/, sitemap.xml, robots.txt
"""
import datetime, glob, html, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = datetime.date.today()
YEAR = TODAY.year
DATE_HUMAN = TODAY.strftime('%-d %B %Y')
ASSET_V = TODAY.strftime('%Y%m%d')

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
def neg_text(x):
    p = x['pattern']; mpq = p['marks'] / p['questions']
    if not p['negative']: return 'No negative marking'
    return f"−{round(p['negative'] * mpq, 2):g} mark per wrong answer"
INDEXABLE = [x for x in EXAMS if not x.get('noindex')]

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
NAV = [('/exams/', 'All Exams')] + [(group_url(g), 'MBA' if g['id'] == 'MBA' else g['label']) for g in GROUPS if g['id'] != 'Insurance & Finance'] + [('/study-material/', 'Study Material')]

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

def page(path, title, desc, body, ld=None, noindex=False, active=''):
    canonical = BASE + path
    graph = [org_ld()] + (ld or [])
    nav = ''.join(f'<a href="{u}" class="{"active" if u == active else ""}">{e(t)}</a>' for u, t in NAV)
    return f'''<!doctype html>
<html lang="en-IN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{e(title)}</title>
  <meta name="description" content="{e(desc)}">
  <link rel="canonical" href="{canonical}">
  <meta name="robots" content="{'noindex, follow' if noindex else 'index, follow, max-image-preview:large'}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="{e(SITE['name'])}">
  <meta property="og:title" content="{e(title)}">
  <meta property="og:description" content="{e(desc)}">
  <meta property="og:url" content="{canonical}">
  <meta property="og:locale" content="en_IN">
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
        <h4>Company</h4>
        <a href="/about/">About us</a>
        <a href="/how-we-create-questions/">How we create questions</a>
        <a href="/contact/">Contact</a>
        <a href="/study-material/">Free study material</a>
        <a href="/privacy-policy/">Privacy policy</a>
        <a href="/terms/">Terms of use</a>
        <a href="/refund-policy/">Refund policy</a>
        <a href="/disclaimer/">Disclaimer</a>
      </div>
    </div>
    <div class="wrap footer-legal">{e(SITE['name'])} is an independent practice platform and is not affiliated with, endorsed by, or connected to NISM, SEBI, IBPS, SBI, RBI, SSC, the IIMs, NTA, AIMA, IRDAI, the Insurance Institute of India, NSE or IIBF. All questions are original practice questions based on publicly available syllabi; they are not actual exam questions.</div>
  </footer>'''

def plans_table(x):
    q = x['pattern']['questions']
    badge = lambda p: (' <span class="badge">' + e(p['tag']) + '</span>') if p.get('tag') else ''
    rows = ''.join(f"<tr><td><b>{e(p['label'])}</b>{badge(p)}</td><td>{p['tests']} mock tests</td><td>{p['tests'] * q:,} questions</td><td><b>₹{p['price']}</b> <span class=\"muted small\">incl. GST</span></td></tr>" for p in PLANS)
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
    desc = (f"Prepare for {code(x)} ({x['name']}) with up to {CAT['MAX_TESTS']} full-length mock tests of {p['questions']} questions, "
            f"chapter-wise analysis and an explanation for every answer. Free demo; plans from ₹{PLANS[0]['price']}.")
    crumbs = [('Home', '/'), ('Exams', '/exams/'), (g['label'], group_url(g)), (code(x), exam_url(x))]
    faqs = [
        (f"How many questions are there in the {code(x)} exam?", f"The {code(x)} paper has {p['questions']} multiple-choice questions for {p['marks']} marks, to be completed in {p['duration']} minutes. This is the indicative pattern — always confirm it in the latest official notification."),
        (f"Is there negative marking in {code(x)}?", (f"Yes. {neg_text(x)} ({round(p['negative'] * 100, 1):g}% of the marks for that question)." if p['negative'] else "No. There is no negative marking, so attempt every question.") + " Our mock tests apply the same rule."),
        (f"What is the {pw} for {code(x)}?", (f"Cut-offs vary by year and category; our mock tests use {p['passPct']}% as a target score to aim for." if competitive(x) else f"You need {p['passPct']}% to pass. Our mock tests show pass or fail against the same mark.")),
        (f"How many {code(x)} mock tests do I get?", f"One full-length mock test is unlocked for each day of your plan: {', '.join(str(pl['tests']) for pl in PLANS[:-1])} or {PLANS[-1]['tests']} mock tests on the {', '.join(pl['label'] for pl in PLANS[:-1])} or {PLANS[-1]['label']} plans. You can retake any unlocked test while your plan is active."),
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
    ch_html = ''.join(f'<li><span>{e(n)}</span><span class="muted small">{k} practice questions</span></li>' for n, k in ch.items())

    body = f'''    <section class="page-hero"><div class="wrap">
      {crumbs_html(crumbs)}
      <h1>{e(code(x))} Mock Test: {e(x['name'])}</h1>
      <p class="lead-left">Up to {CAT['MAX_TESTS']} full-length mock tests of {p['questions']} questions each, built on the official syllabus, with an explanation for every answer.</p>
      <p class="meta-row small muted">Last updated {DATE_HUMAN} · By the {e(SITE['name'])} editorial team · <a href="/how-we-create-questions/">How we create questions</a></p>
      {rev_html}
      <div class="row" style="margin-top:20px"><a class="btn btn-primary btn-lg" href="/#/exam/{x['id']}">See plans &amp; start</a><a class="btn btn-lg" href="/#/test/{x['id']}?demo=1">Try a free demo</a></div>
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
      </section>
      <section><h2>Syllabus covered in our {e(code(x))} question bank</h2>
        <p>Our {bank}-question bank for {e(code(x))} covers every {'chapter' if x['group'] == 'NISM' else 'section'} below. Mock tests mix questions across all of them in the same proportion as the real paper.</p>
        <ul class="chapter-counts">{ch_html}</ul>
      </section>
      <section><h2>Free {e(code(x))} sample questions</h2>
        <p>Try five questions from our bank. Each mock test gives you {p['questions']} like these, with your score, chapter-wise analysis and explanations at the end.</p>
        {sample_html}
      </section>
      <section><h2>{e(code(x))} mock test plans</h2>
        <p>Every plan unlocks one full-length mock test per day of the plan. Prices include GST.</p>
        {plans_table(x)}
        <div class="row" style="margin-top:16px"><a class="btn btn-primary" href="/#/exam/{x['id']}">Choose a plan</a><a class="btn" href="/refund-policy/">Refund policy</a></div>
      </section>
      <section><h2>Official {'study material' if x['group'] == 'NISM' else 'resources'}</h2>
        <ul>{links_html}</ul>
        <p class="small muted">Links open the official website. We do not host or alter official material.</p>
      </section>
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
        'offers': {'@type': 'AggregateOffer', 'priceCurrency': 'INR', 'lowPrice': PLANS[0]['price'], 'highPrice': PLANS[-1]['price'], 'offerCount': len(PLANS), 'availability': 'https://schema.org/InStock', 'category': 'Paid'},
        'hasCourseInstance': {'@type': 'CourseInstance', 'courseMode': 'Online', 'courseWorkload': f"PT{p['duration']}M per mock test"},
        'dateModified': TODAY.isoformat(),
    }
    course.pop('educationalCredentialAwarded')
    if revs: course['reviewedBy'] = [{'@type': 'Person', 'name': r['name'], **({'url': r['profileUrl']} if r.get('profileUrl') else {})} for r in revs]
    ld = [breadcrumb_ld(crumbs), course, {'@type': 'FAQPage', 'mainEntity': [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': a}} for q, a in faqs]}]
    return page(exam_url(x), title, desc, body, ld, noindex=x.get('noindex'), active=group_url(g))

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
    plans = ', '.join(f"{p['label']} ({p['tests']} mock tests, ₹{p['price']})" for p in PLANS)
    return [
        (f"Which {g['label']} exams can I practise on {SITE['name']}?", f"{', '.join(code(x) for x in xs)}."),
        (f"How much do {g['label']} mock tests cost?", f"Each exam has its own plan: {plans}. Prices include GST, and every exam has a free demo test."),
        ("Are these real exam questions?", "No. All questions are original and written to the official syllabus and pattern. We do not use or sell actual exam questions."),
    ]

def group_page(g):
    xs = [x for x in INDEXABLE if x['group'] == g['id']]
    crumbs = [('Home', '/'), ('Exams', '/exams/'), (g['label'], group_url(g))]
    title = f"{g['label']} Mock Tests {YEAR} – {len(xs)} Exams | {SITE['name']}"
    desc = f"Full-length {g['label']} mock tests for {', '.join(code(x) for x in xs[:4])}{' and more' if len(xs) > 4 else ''}. Exam pattern, syllabus, free sample questions and plans from ₹{PLANS[0]['price']}."
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
    body = f'    <section class="page-hero"><div class="wrap">{crumbs_html(crumbs)}<h1>All exams</h1><p class="lead-left">{len(INDEXABLE)} exams across {len(GROUPS)} categories. Each page shows the exam pattern, the syllabus our question bank covers, free sample questions and mock test plans.</p></div></section>\n    <div class="wrap page prose">' + ''.join(
        f'<section><h2><a href="{group_url(g)}">{e(g["label"])}</a></h2><p class="muted">{e(g["blurb"])}</p>{exam_table([x for x in INDEXABLE if x["group"] == g["id"]], target=bool(g.get("competitive")))}</section>' for g in GROUPS) + '</div>'
    ld = [breadcrumb_ld(crumbs), {'@type': 'CollectionPage', 'name': 'All exams', 'url': BASE + '/exams/'}]
    return page('/exams/', title, desc, body, ld, active='/exams/')

def study_page():
    crumbs = [('Home', '/'), ('Free study material', '/study-material/')]
    title = f"Free NISM Workbooks & Official Exam Syllabus | {SITE['name']}"
    desc = "Official, free study resources for every exam we cover: NISM's free workbook portal, NISM test objectives, and official syllabus pages for IBPS, SBI, RBI, SSC, CAT, CMAT, MAT, IRDAI, NSE and IIBF."
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
<h2>What we offer</h2><ul><li>Full-length, timed mock tests with the real exam's question count, duration and negative marking.</li><li>An explanation for every answer and chapter-wise performance analysis after each test.</li><li>Links to free official study material, such as NISM's free workbooks.</li><li>Simple per-exam plans of 10 to 30 days, with one mock test unlocked for each day.</li></ul>
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
    inner = f'''<p>We're happy to help with subscriptions, payments, technical problems or questions about our content.</p>
{('<ul>' + items + '</ul>') if items else '<p>Contact details are being updated.</p>'}
<h2>Report a question error</h2><p>Please include the exam, the mock test number and the question text, and tell us what you think the correct answer is and why. See <a href="/how-we-create-questions/">how we handle corrections</a>.</p>
{go}'''
    return simple('/contact/', 'Contact us', f"Contact {SITE['name']}", f"How to contact {SITE['name']} about subscriptions, payments, technical issues or question corrections.", inner)

def privacy_page():
    inner = f'''<p>This policy explains what personal data {OPERATOR} ("we") collects when you use success4sure.in, why, and your choices.</p>
<h2>Data we collect</h2><ul><li><b>Account details:</b> your name, email address and mobile number when you sign up.</li><li><b>Payment details:</b> payments are processed by our payment gateway partner. We receive the payment status and a transaction reference; we do not see or store your full card, UPI or bank credentials.</li><li><b>Usage data:</b> your mock test attempts, answers and scores, so we can show results and analysis.</li><li><b>Technical data:</b> basic logs such as IP address, browser and device type, used for security and to keep the service running.</li></ul>
<h2>How we use it</h2><ul><li>To provide your account, subscriptions and mock tests.</li><li>To process payments, issue GST invoices and handle refunds.</li><li>To respond to support requests and send service messages about your account.</li><li>To keep the service secure and improve it.</li></ul><p>We do not sell your personal data.</p>
<h2>Sharing</h2><p>We share data only with service providers who help us run the service — such as hosting, payment processing and email — under appropriate safeguards, or where required by law.</p>
<h2>Retention</h2><p>We keep account and test data while your account is active and for a reasonable period afterwards for legal, tax and accounting purposes, then delete or anonymise it.</p>
<h2>Your choices and rights</h2><p>You can ask to access, correct or delete your personal data, or withdraw consent, by writing to {contact_line()}. We will respond in line with applicable Indian law, including the Digital Personal Data Protection Act, 2023.</p>
<h2>Cookies and local storage</h2><p>We use essential browser storage to keep you logged in and remember your progress. We do not use advertising cookies.</p>
<h2>Changes</h2><p>We may update this policy and will show the date of the latest version at the top of this page.</p>'''
    return simple('/privacy-policy/', 'Privacy policy', f"Privacy Policy | {SITE['name']}", f"How {SITE['name']} collects, uses and protects your personal data.", inner)

def terms_page():
    inner = f'''<p>These terms govern your use of success4sure.in, operated by {OPERATOR}. By creating an account or buying a plan you agree to them.</p>
<h2>Accounts</h2><p>You must give accurate details and keep your login private. Plans are for one person; sharing an account is not allowed and may lead to suspension.</p>
<h2>Plans and access</h2><p>Each plan is for one exam and runs for the number of days shown at purchase, unlocking one mock test for each day of the plan. Access ends automatically when the plan ends. Prices include GST.</p>
<h2>Our content</h2><p>All questions, explanations and site content are our original work and are protected by copyright. You may use them for your personal preparation only. Copying, scraping, reselling or republishing them is not allowed.</p>
<h2>No guarantee of results</h2><p>Our mock tests are practice material. They are not official exam questions, and we do not guarantee that you will pass or achieve any score. Exam patterns are indicative; always confirm them with the official notification.</p>
<h2>Independence</h2><p>We are not affiliated with or endorsed by NISM, SEBI or any exam-conducting body. Names of exams are used only to describe what our practice material covers.</p>
<h2>Liability</h2><p>To the extent permitted by law, our total liability for any claim is limited to the amount you paid for the plan concerned.</p>
<h2>Refunds</h2><p>See our <a href="/refund-policy/">refund policy</a>.</p>
<h2>Governing law</h2><p>These terms are governed by the laws of India.</p>
<h2>Contact</h2><p>Questions about these terms: {contact_line()}.</p>'''
    return simple('/terms/', 'Terms of use', f"Terms of Use | {SITE['name']}", f"The terms that apply when you use {SITE['name']} and buy a mock test plan.", inner)

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

# ---------- home (SPA shell gets SEO head + crawlable fallback) ----------
def home_seo():
    title = f"{SITE['name']} – NISM, Banking, SSC & CAT Mock Tests"
    desc = f"Full-length mock tests with explanations for {len(INDEXABLE)} exams: NISM certifications, IBPS, SBI, RBI, SSC, CAT, CMAT, MAT, IRDAI IC-38, NCFM, JAIIB and CAIIB. Free demo; plans from ₹{PLANS[0]['price']}."
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
    for g in GROUPS:
        wr(group_url(g).strip('/') + '/index.html', group_page(g)); pages.append((group_url(g), True))
    wr('exams/index.html', exams_hub()); pages.append(('/exams/', True))
    wr('study-material/index.html', study_page()); pages.append(('/study-material/', True))
    for path, fn in [('/about/', about_page), ('/how-we-create-questions/', method_page), ('/contact/', contact_page),
                     ('/privacy-policy/', privacy_page), ('/terms/', terms_page), ('/refund-policy/', refund_page), ('/disclaimer/', disclaimer_page)]:
        wr(path.strip('/') + '/index.html', fn()); pages.append((path, True))

    # app data
    app_exams = [{k: v for k, v in x.items() if k not in ('page', 'noindex')} | {'slug': x['slug']} for x in EXAMS]
    wr('js/data/exams.js', '// Generated by tools/build_site.py from content/catalog.json — edit the JSON, then rebuild.\n'
       + ''.join(f'window.{k} = {json.dumps(CAT[k], ensure_ascii=False)};\n' for k in ('PLANS', 'MAX_TESTS', 'GROUPS', 'CATEGORIES'))
       + f'window.EXAMS = {json.dumps(app_exams, ensure_ascii=False)};\n')
    subprocess.run([sys.executable, '-I', os.path.join(ROOT, 'tools', 'build_qbank.py')], check=True)

    # home
    idx = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    head, body = home_seo()
    idx = re.sub(r'<!-- seo:head -->.*?<!-- /seo:head -->', lambda m: head, idx, flags=re.S)
    idx = re.sub(r'<!-- seo:body -->.*?<!-- /seo:body -->', lambda m: body, idx, flags=re.S)
    idx = re.sub(r'\?v=[0-9]+', f'?v={ASSET_V}', idx)
    wr('index.html', idx)

    # sitemap + robots
    urls = ['/'] + [p for p, ok in pages if ok]
    wr('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
       + ''.join(f'  <url><loc>{BASE}{u}</loc><lastmod>{TODAY.isoformat()}</lastmod></url>\n' for u in urls) + '</urlset>\n')
    wr('robots.txt', f'User-agent: *\nAllow: /\n\nSitemap: {BASE}/sitemap.xml\n')

    print(f'Sitemap: {len(urls)} URLs  (home 1, exam hub 1, categories {len(GROUPS)}, exams {len(INDEXABLE)}, study material 1, trust pages 7)')
    print(f'Not in sitemap (noindex): {", ".join(code(x) for x in EXAMS if x.get("noindex"))}')
    for w in warnings: print('WARN', w)

main()
