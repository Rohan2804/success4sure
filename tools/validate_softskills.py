"""Validate soft-skills content files: python3 -I tools/validate_softskills.py content/softskills/*.json

Schema (one file per skill area):
{
  "area": "<area id>",
  "lessons": [
    {
      "id": "kebab-case-slug",
      "title": "Lesson title",
      "track": "core" | "fresher" | "professional",
      "minutes": 4-10,
      "summary": "1-2 sentence summary",
      "sections": [ {"heading": "...", "body": "paragraphs separated by \\n\\n", "do": ["..."], "dont": ["..."]} ],
      "takeaways": ["...", "..."],
      "quiz": [ [question, [optA, optB, optC, optD], correctIndex0to3, explanation], ... 10 items ],
      "scenarios": [ {"title": "...", "situation": "...", "options": [ {"text": "...", "rating": "best"|"good"|"poor", "feedback": "..."} ] } ... 3 items ]
    }
  ]
}
"""
import json, sys, re, collections

TRACKS = {'core', 'fresher', 'professional'}
CARD_KINDS = {'intro', 'tip', 'compare', 'checklist', 'recap'}
ICONS = {'mail', 'flag', 'bolt', 'grid', 'book', 'sparkle', 'check', 'trophy', 'target', 'clock', 'chart', 'bulb', 'user', 'phone', 'shield', 'briefcase', 'star', 'info', 'refresh', 'search'}
REQUIRE_CARDS = '--require-cards' in sys.argv
RATINGS = {'best', 'good', 'poor'}
ok = True

def s(x): return isinstance(x, str) and x.strip()

for path in [a for a in sys.argv[1:] if not a.startswith('--')]:
    errs = []
    try:
        d = json.load(open(path, encoding='utf-8'))
    except Exception as ex:
        print(f'{path}: INVALID JSON — {ex}'); ok = False; continue
    lessons = d.get('lessons', [])
    if not s(d.get('area')): errs.append('missing "area"')
    if len(lessons) != 6: errs.append(f'expected 6 lessons, found {len(lessons)}')
    tracks = collections.Counter(l.get('track') for l in lessons)
    if tracks.get('core') != 4 or tracks.get('fresher') != 1 or tracks.get('professional') != 1:
        errs.append(f'track mix must be 4 core / 1 fresher / 1 professional, got {dict(tracks)}')
    ids = set()
    pos = collections.Counter()
    longest_correct = [0]
    for li, l in enumerate(lessons):
        tag = f'lesson {li + 1} ({l.get("id")})'
        if not (s(l.get('id')) and re.fullmatch(r'[a-z0-9]+(-[a-z0-9]+)*', l['id'])): errs.append(f'{tag}: id must be kebab-case')
        if l.get('id') in ids: errs.append(f'{tag}: duplicate id')
        ids.add(l.get('id'))
        if l.get('track') not in TRACKS: errs.append(f'{tag}: bad track')
        for k in ('title', 'summary'):
            if not s(l.get(k)): errs.append(f'{tag}: missing {k}')
        if not (isinstance(l.get('minutes'), int) and 3 <= l['minutes'] <= 12): errs.append(f'{tag}: minutes must be 3-12')
        secs = l.get('sections', [])
        if not (3 <= len(secs) <= 6): errs.append(f'{tag}: needs 3-6 sections')
        words = 0
        for si, sec in enumerate(secs):
            if not (s(sec.get('heading')) and s(sec.get('body'))): errs.append(f'{tag} section {si + 1}: heading/body missing')
            words += len(str(sec.get('body', '')).split())
            for k in ('do', 'dont'):
                if k in sec and not (isinstance(sec[k], list) and all(s(x) for x in sec[k])): errs.append(f'{tag} section {si + 1}: {k} must be a list of strings')
        if words < 450: errs.append(f'{tag}: lesson body only {words} words (need 450+)')
        if not (isinstance(l.get('takeaways'), list) and 3 <= len(l['takeaways']) <= 6 and all(s(x) for x in l['takeaways'])): errs.append(f'{tag}: needs 3-6 takeaways')
        quiz = l.get('quiz', [])
        if len(quiz) != 10: errs.append(f'{tag}: quiz needs 10 questions, has {len(quiz)}')
        seen = set()
        for qi, q in enumerate(quiz):
            if not (isinstance(q, list) and len(q) in (4, 5)): errs.append(f'{tag} quiz {qi + 1}: needs [question, options, correctIndex, explanation]'); continue
            text, opts, ans, expl = q[0], q[1], q[2], q[-1]
            if not (s(text) and s(expl)): errs.append(f'{tag} quiz {qi + 1}: empty question/explanation')
            if not (isinstance(opts, list) and len(opts) == 4 and all(s(o) for o in opts) and len({o.strip().lower() for o in opts}) == 4): errs.append(f'{tag} quiz {qi + 1}: needs 4 distinct options')
            if ans not in (0, 1, 2, 3): errs.append(f'{tag} quiz {qi + 1}: answer index 0-3')
            else:
                pos[ans] += 1
                lens = [len(str(o)) for o in opts] if isinstance(opts, list) and len(opts) == 4 else []
                if lens and lens[ans] == max(lens) and lens.count(max(lens)) == 1: longest_correct[0] += 1
            if str(text).lower() in seen: errs.append(f'{tag} quiz {qi + 1}: duplicate question')
            seen.add(str(text).lower())
        cards = l.get('cards')
        if REQUIRE_CARDS and not cards: errs.append(f'{tag}: missing "cards"')
        if cards:
            if not (6 <= len(cards) <= 9): errs.append(f'{tag}: needs 6-9 cards, has {len(cards)}')
            if cards[0].get('kind') != 'intro': errs.append(f'{tag}: first card must be kind "intro"')
            if cards[-1].get('kind') != 'recap': errs.append(f'{tag}: last card must be kind "recap"')
            kinds = collections.Counter(c.get('kind') for c in cards)
            if kinds.get('compare', 0) < 2: errs.append(f'{tag}: needs at least 2 "compare" cards (Instead of / Try)')
            for ci, c in enumerate(cards):
                ct = f'{tag} card {ci + 1}'
                k = c.get('kind')
                if k not in CARD_KINDS: errs.append(f'{ct}: kind must be one of {sorted(CARD_KINDS)}'); continue
                if not s(c.get('title')) or len(c['title'].split()) > 8: errs.append(f'{ct}: title required, max 8 words')
                if not s(c.get('text')): errs.append(f'{ct}: text required')
                if c.get('icon') not in ICONS: errs.append(f'{ct}: icon must be one of {sorted(ICONS)}')
                if k == 'compare' and not (s(c.get('bad')) and s(c.get('good'))): errs.append(f'{ct}: compare needs "bad" and "good"')
                if k == 'checklist' and not (isinstance(c.get('items'), list) and 3 <= len(c['items']) <= 5 and all(s(x) for x in c['items'])): errs.append(f'{ct}: checklist needs 3-5 items')
                words = sum(len(str(c.get(f, '')).split()) for f in ('text', 'bad', 'good', 'example', 'tip')) + sum(len(str(x).split()) for x in c.get('items', []))
                if words > 60: errs.append(f'{ct}: {words} words — keep each card to 60 words or fewer')
        scs = l.get('scenarios', [])
        if len(scs) != 3: errs.append(f'{tag}: needs 3 scenarios, has {len(scs)}')
        for ci, sc in enumerate(scs):
            if not (s(sc.get('title')) and s(sc.get('situation'))): errs.append(f'{tag} scenario {ci + 1}: title/situation missing')
            o = sc.get('options', [])
            if not (3 <= len(o) <= 4): errs.append(f'{tag} scenario {ci + 1}: needs 3-4 options')
            r = [x.get('rating') for x in o]
            if r.count('best') != 1: errs.append(f'{tag} scenario {ci + 1}: exactly one option must be rated "best"')
            if any(x not in RATINGS for x in r): errs.append(f'{tag} scenario {ci + 1}: ratings must be best/good/poor')
            if not all(s(x.get('text')) and s(x.get('feedback')) for x in o): errs.append(f'{tag} scenario {ci + 1}: option text/feedback missing')
    n = sum(pos.values())
    skew = n and max(pos.values()) / n > 0.4
    if n and longest_correct[0] / n > 0.35:
        errs.append(f'correct answer is the uniquely longest option in {longest_correct[0]}/{n} questions — keep it to 35% or less so length is not a giveaway')
    print(f'{path}: {len(lessons)} lessons, tracks {dict(tracks)}, quiz answers ' + ' '.join(f'{"ABCD"[k]}:{pos[k]}' for k in range(4)) + ('  ⚠ answer positions skewed' if skew else ''))
    for e in errs: print('   ✗', e)
    if errs or skew: ok = False
sys.exit(0 if ok else 1)
