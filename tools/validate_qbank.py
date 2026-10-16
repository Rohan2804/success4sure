"""Validate question-bank JSON files: python3 -I tools/validate_qbank.py js/data/qbank/*.json
Each file: {"<examId>": [[chapter, question, [opt1, opt2, opt3, opt4], correctIndex, explanation], ...], ...}
"""
import json, sys, collections

ok = True
for path in sys.argv[1:]:
    try:
        data = json.load(open(path, encoding='utf-8'))
    except Exception as e:
        print(f'{path}: INVALID JSON — {e}'); ok = False; continue
    for exam, qs in data.items():
        errs = []
        seen = set()
        pos = collections.Counter()
        chapters = collections.Counter()
        for i, q in enumerate(qs):
            if not (isinstance(q, list) and len(q) == 5):
                errs.append(f'#{i}: needs 5 fields'); continue
            ch, text, opts, ans, expl = q
            if not all(isinstance(x, str) and x.strip() for x in (ch, text, expl)):
                errs.append(f'#{i}: empty chapter/question/explanation')
            if not (isinstance(opts, list) and len(opts) == 4 and all(isinstance(o, str) and o.strip() for o in opts)):
                errs.append(f'#{i}: needs exactly 4 non-empty options')
            elif len(set(o.strip().lower() for o in opts)) != 4:
                errs.append(f'#{i}: duplicate options')
            if ans not in (0, 1, 2, 3):
                errs.append(f'#{i}: correct index must be 0-3')
            key = text.strip().lower()
            if key in seen: errs.append(f'#{i}: duplicate question')
            seen.add(key)
            pos[ans] += 1; chapters[ch] += 1
        n = len(qs)
        balance = ' '.join(f'{"ABCD"[k]}:{pos[k]}' for k in range(4))
        skew = n and max(pos.values()) / n > 0.4
        print(f'{exam}: {n} questions, {len(chapters)} chapters, answers {balance}{"  ⚠ answer positions skewed" if skew else ""}')
        for c, k in chapters.items(): print(f'    {k:3d}  {c}')
        for e in errs: print('   ✗', e)
        if errs: ok = False
sys.exit(0 if ok else 1)
