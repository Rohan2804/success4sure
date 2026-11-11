"""Validate free chapter-question files: python3 -I tools/validate_free.py content/free-questions/*.json
Each file: {"<examId>": {"<chapter name exactly as in the paid bank>": {"overview": "...", "questions": [[question, [4 options], correctIndex, explanation], ...]}}}
Checks: chapter names match the paid bank, question count per chapter, format, answer-position balance,
correct option not a giveaway by length, and no question that copies the paid bank.
"""
import json, sys, glob, os, re, collections
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
QB = {}
for f in glob.glob(os.path.join(ROOT, 'js', 'data', 'qbank', '*.json')): QB.update(json.load(open(f, encoding='utf-8')))
CAT = json.load(open(os.path.join(ROOT, 'content', 'catalog.json'), encoding='utf-8'))
GROUP = {x['id']: x['group'] for x in CAT['EXAMS']}
def per_chapter(exam): return 15 if GROUP.get(exam) in ('Banking', 'SSC', 'MBA') else 8
norm = lambda t: re.sub(r'[^a-z0-9 ]', '', t.lower())
def words(t): return set(norm(t).split())
def sim(a, b):
    A, B = words(a), words(b)
    return len(A & B) / max(1, len(A | B))
ok = True
for path in sys.argv[1:]:
    try: data = json.load(open(path, encoding='utf-8'))
    except Exception as e: print(f'{path}: INVALID JSON — {e}'); ok = False; continue
    for exam, chs in data.items():
        errs = []
        if exam not in QB: errs.append('unknown exam id'); print(path, exam, errs); ok = False; continue
        paid = QB[exam]; paid_ch = list(dict.fromkeys(q[0] for q in paid))
        missing = [c for c in paid_ch if c not in chs]; extra = [c for c in chs if c not in paid_ch]
        if missing: errs.append(f'missing chapters: {missing}')
        if extra: errs.append(f'unknown chapters (must match paid bank names exactly): {extra}')
        pos, longest, seen, n = collections.Counter(), 0, set(), 0
        for ch, block in chs.items():
            ov = block.get('overview', '')
            if not 50 <= len(ov.split()) <= 120: errs.append(f'{ch}: overview should be 50–120 words ({len(ov.split())})')
            qs = block.get('questions', [])
            if len(qs) != per_chapter(exam): errs.append(f'{ch}: needs exactly {per_chapter(exam)} questions, has {len(qs)}')
            for i, q in enumerate(qs):
                tag = f'{ch} #{i + 1}'
                if not (isinstance(q, list) and len(q) == 4 and isinstance(q[1], list) and len(q[1]) == 4 and q[2] in (0, 1, 2, 3)):
                    errs.append(f'{tag}: format must be [question, [4 options], index 0-3, explanation]'); continue
                n += 1; pos[q[2]] += 1
                if len(set(o.strip().lower() for o in q[1])) < 4: errs.append(f'{tag}: duplicate options')
                if len(q[3].split()) < 12: errs.append(f'{tag}: explanation too short')
                L = [len(o) for o in q[1]]
                if L[q[2]] == max(L) and L.count(max(L)) == 1: longest += 1
                k = norm(q[0])
                if k in seen: errs.append(f'{tag}: duplicate question')
                seen.add(k)
                for p in paid:
                    if sim(q[0], p[1]) > 0.7: errs.append(f'{tag}: too similar to paid-bank question "{p[1][:60]}"'); break
        if n:
            if max(pos.values()) / n > 0.34 or min(pos[i] for i in range(4)) / n < 0.16: errs.append(f'answer positions unbalanced {dict(pos)}')
            if longest / n > 0.35: errs.append(f'correct answer is the uniquely longest option in {longest / n:.0%} (max 35%)')
        if errs: ok = False; print(f'{os.path.basename(path)} {exam}:'); [print('   ', x) for x in errs[:25]]
        else: print(f'{os.path.basename(path)} {exam}: OK ({n} questions)')
sys.exit(0 if ok else 1)
