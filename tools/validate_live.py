"""Validate live listings: python3 -I tools/validate_live.py content/live/nfo.json content/live/govt-exams.json
nfo.json:        {"updated": "YYYY-MM-DD", "items": [{amc, scheme, category, type, open_date, close_date, min_investment, benchmark, exit_load, riskometer, fund_manager, objective, source_url, sid_url?}]}
govt-exams.json: {"updated": "YYYY-MM-DD", "items": [{org, title, sector, status, posts, apply_start, apply_end, exam_date, eligibility, age_limit, official_url, notification_url?, related_exam?}]}
Dates are ISO YYYY-MM-DD or null when not officially announced. Every item needs an https source link.
"""
import json, sys, re, os, datetime
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDS = {x['id'] for x in json.load(open(os.path.join(ROOT, 'content', 'catalog.json')))['EXAMS']}
ISO = re.compile(r'\d{4}-\d{2}-\d{2}$')
def date_ok(v): return v is None or (isinstance(v, str) and ISO.match(v) and datetime.date.fromisoformat(v))
ok = True
for path in sys.argv[1:]:
    d = json.load(open(path, encoding='utf-8')); kind = 'nfo' if 'nfo' in os.path.basename(path) else 'govt'
    errs = []
    if not date_ok(d.get('updated')) or not d.get('updated'): errs.append('updated must be an ISO date')
    seen = set()
    for i, it in enumerate(d.get('items', [])):
        tag = f"#{i + 1} {it.get('scheme') or it.get('title')}"
        need = ('amc', 'scheme', 'category', 'type', 'open_date', 'close_date', 'objective', 'source_url') if kind == 'nfo' else ('org', 'title', 'sector', 'status', 'official_url')
        for k in need:
            if not it.get(k): errs.append(f'{tag}: missing {k}')
        for k in ('open_date', 'close_date', 'apply_start', 'apply_end', 'exam_date'):
            if k in it and not date_ok(it[k]): errs.append(f'{tag}: {k} must be YYYY-MM-DD or null')
        for k in ('source_url', 'sid_url', 'official_url', 'notification_url'):
            if it.get(k) and not str(it[k]).startswith('https://'): errs.append(f'{tag}: {k} must be an https URL')
        if kind == 'nfo' and it.get('open_date') and it.get('close_date') and it['close_date'] < it['open_date']: errs.append(f'{tag}: closes before it opens')
        if kind == 'govt':
            if it.get('sector') not in ('Banking', 'SSC', 'UPSC', 'Railways', 'Defence', 'PSU', 'Insurance', 'Teaching', 'State PSC', 'Other'): errs.append(f'{tag}: unknown sector')
            if it.get('status') not in ('Application open', 'Upcoming', 'Notification expected'): errs.append(f'{tag}: status must be Application open / Upcoming / Notification expected')
            if it.get('related_exam') and it['related_exam'] not in IDS: errs.append(f'{tag}: unknown related_exam')
        key = (it.get('scheme') or it.get('title'), it.get('amc') or it.get('org'))
        if key in seen: errs.append(f'{tag}: duplicate')
        seen.add(key)
    if errs: ok = False; print(path); [print('   ', e) for e in errs[:30]]
    else: print(f"{path}: OK ({len(d.get('items', []))} items, updated {d['updated']})")
sys.exit(0 if ok else 1)
