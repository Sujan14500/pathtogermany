"""Validate agent-written content in data/src before it is built on. Prints ALL OK or the problems.

usage:  python scripts/check_content.py data/src/words-A1-1.tsv [more files …]
        python scripts/check_content.py --test

The kind of content comes from the file name prefix (words-…). Every file must be UTF-8 with LF line endings.
words-<level>-*.tsv columns: lemma, pos, article, plural, forms, english, example_de, example_en, station
  pos      n (noun), v (verb), adj, adv, prep, conj, pron, num, art, phrase, other
  article  der / die / das for nouns, pl for plural-only nouns, empty otherwise
  plural   the plural form (Tische), '-' when the noun has none in use, empty for non-nouns
  forms    verbs only: 3rd person present, Präteritum, Perfekt, e.g. 'fährt, fuhr, ist gefahren'
  station  1–12 within the level
assign-<level>.tsv columns: article, word, pos, station — every row of data/src/goethe-<level>.tsv exactly once,
  station 1–12 (0 = not a learner word, dropped); extra rows allowed; 35–100 words per station.
grammar-<level>-*.json: [{id, pattern, explain, compare_en, table?, examples}] — id from data/src/syllabus.json;
  table: [[header cells], [row cells] …] (optional); examples: 2–4 of
  {de: [German chunks], en: [[[chunk indexes], "English text"] …], v: [indexes of the verb chunks]}
  where every German chunk is linked from some English part.
gq-<level>-*.json: [{g, q, opts, a, why, en}] — g a grammar id, q with exactly one ___, 4 different opts,
  a = index of the right one, why and en (the English of the full sentence) not empty.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WORD_COLS = ['lemma', 'pos', 'article', 'plural', 'forms', 'english', 'example_de', 'example_en', 'station']
POS = {'n', 'v', 'adj', 'adv', 'prep', 'conj', 'pron', 'num', 'art', 'phrase', 'other'}
FORMS = re.compile(r'^[^,]+, [^,]+, (hat|ist|hat/ist) [^,]+$')


def goethe_sentences():
    """Sentences of the Goethe word lists (cached locally), so a copied example is caught."""
    text = ' '.join(p.read_text(encoding='utf-8') for p in (ROOT / 'data/cache/goethe').glob('*-plain.txt'))
    return {norm(s) for s in re.split(r'(?<=[.!?])\s+', re.sub(r'\s+', ' ', text)) if len(s.split()) >= 4}


def norm(s):
    return re.sub(r'[^\wäöüß]+', ' ', s.lower()).strip()


def check_words(rows, copied=frozenset()):
    """rows: list of dicts. Returns a list of problems."""
    out, seen = [], set()
    for i, r in enumerate(rows, 2):
        where = f'line {i} ({r.get("lemma", "?")})'
        missing = [c for c in ['lemma', 'pos', 'english', 'example_de', 'example_en', 'station'] if not r.get(c, '').strip()]
        if missing:
            out.append(f'{where}: empty {", ".join(missing)}')
            continue
        pos, art, lemma = r['pos'], r['article'], r['lemma']
        if pos not in POS:
            out.append(f'{where}: pos {pos!r} is not one of {sorted(POS)}')
        if pos == 'n':
            if art not in ('der', 'die', 'das', 'pl'):
                out.append(f'{where}: a noun needs article der/die/das/pl, not {art!r}')
            if art != 'pl' and not r['plural']:
                out.append(f"{where}: a noun needs its plural, or '-'")
            if not lemma[:1].isupper():
                out.append(f'{where}: nouns are capitalised')
            forms = [lemma] + ([r['plural']] if r['plural'] not in ('', '-') else [])
            if not any(re.search(r'(?<![\wäöüß])' + re.escape(f), r['example_de']) for f in forms):
                out.append(f'{where}: the example does not use the noun')
        elif art:
            out.append(f'{where}: only nouns have an article')
        if pos == 'v' and not FORMS.match(r['forms']):
            out.append(f"{where}: verb forms should look like 'fährt, fuhr, ist gefahren', not {r['forms']!r}")
        if pos != 'v' and r['forms']:
            out.append(f'{where}: only verbs have forms')
        if not r['station'].isdigit() or not 1 <= int(r['station']) <= 12:
            out.append(f'{where}: station must be 1–12')
        if not re.search(r'[.!?…]["“”]?$', r['example_de'].strip()):
            out.append(f'{where}: the German example should end with . ! or ?')
        if re.search(r'[äöüß]', r['example_en']) or r['example_en'] == r['example_de']:
            out.append(f'{where}: example_en should be English')
        if norm(r['example_de']) in copied:
            out.append(f'{where}: the example is copied from the Goethe word list; write an original one')
        key = (lemma, art, pos)
        if key in seen:
            out.append(f'{where}: duplicate word')
        seen.add(key)
    return out


def check_assign(rows, goethe):
    """rows: assignment dicts; goethe: [(article, word, pos)] checklist of the level."""
    out, count, seen = [], {}, {}
    for i, r in enumerate(rows, 2):
        key = (r['article'], r['word'], r['pos'])
        if key in seen:
            out.append(f'line {i} ({r["word"]}): duplicate of line {seen[key]}')
        seen[key] = i
        if not r['station'].isdigit() or not 0 <= int(r['station']) <= 12:
            out.append(f'line {i} ({r["word"]}): station must be 0–12')
            continue
        if r['pos'] == 'n' and r['article'] not in ('der', 'die', 'das', 'pl'):
            out.append(f'line {i} ({r["word"]}): a noun needs der/die/das/pl')
        count[int(r['station'])] = count.get(int(r['station']), 0) + 1
    out += [f'missing from the checklist: {a} {w} ({p})'.replace('  ', ' ') for a, w, p in goethe if (a, w, p) not in seen]
    out += [f'station {k}: {count.get(k, 0)} words (keep 35–100)' for k in range(1, 13) if not 35 <= count.get(k, 0) <= 100]
    return out


def grammar_ids():
    levels = json.loads((ROOT / 'data/src/syllabus.json').read_text(encoding='utf-8'))
    return {gid for lv in levels for st in lv['stations'] for gid, _ in st['grammar']}


def check_grammar(points, ids):
    out, seen = [], set()
    for i, g in enumerate(points):
        where = f'point {i} ({g.get("id", "?")})'
        if g.get('id') not in ids:
            out.append(f'{where}: id is not a grammar point in syllabus.json')
        if g.get('id') in seen:
            out.append(f'{where}: duplicate id')
        seen.add(g.get('id'))
        for k in ('pattern', 'explain'):
            if not str(g.get(k, '')).strip():
                out.append(f'{where}: empty {k}')
        if 'compare_en' not in g:
            out.append(f'{where}: compare_en missing (use "" only when English offers nothing useful)')
        t = g.get('table')
        if t is not None and (not isinstance(t, list) or len(t) < 2 or len({len(r) for r in t}) != 1):
            out.append(f'{where}: table must be a list of rows of equal length, header first')
        exs = g.get('examples', [])
        if not 2 <= len(exs) <= 4:
            out.append(f'{where}: {len(exs)} examples, expected 2–4')
        for j, ex in enumerate(exs):
            de, en, v = ex.get('de', []), ex.get('en', []), ex.get('v', [])
            w = f'{where} example {j}'
            if len(de) < 2 or not all(isinstance(c, str) and c.strip() for c in de):
                out.append(f'{w}: de must be 2+ non-empty chunks')
                continue
            linked = set()
            for part in en:
                if not (isinstance(part, list) and len(part) == 2 and isinstance(part[0], list) and isinstance(part[1], str) and part[1].strip()):
                    out.append(f'{w}: each en part is [[chunk indexes], "text"]')
                    continue
                if any(not isinstance(k, int) or not 0 <= k < len(de) for k in part[0]):
                    out.append(f'{w}: en part {part[1]!r} points to a chunk that does not exist')
                linked.update(part[0])
            if set(range(len(de))) - linked:
                out.append(f'{w}: German chunks {sorted(set(range(len(de))) - linked)} are not linked to any English')
            if not v or any(not isinstance(k, int) or not 0 <= k < len(de) for k in v):
                out.append(f'{w}: v must list the verb chunk indexes')
            if not re.search(r'[.!?]$', de[-1].strip()):
                out.append(f'{w}: the sentence should end with . ! or ?')
    return out


def check_gq(qs, ids):
    out, pos = [], []
    for i, q in enumerate(qs):
        where = f'question {i} ({q.get("g", "?")})'
        if q.get('g') not in ids:
            out.append(f'{where}: g is not a grammar point in syllabus.json')
        if str(q.get('q', '')).count('___') != 1:
            out.append(f'{where}: q needs exactly one ___')
        opts = q.get('opts', [])
        if len(opts) != 4 or len(set(opts)) != 4 or not all(str(o).strip() for o in opts):
            out.append(f'{where}: 4 different, non-empty options')
        if not isinstance(q.get('a'), int) or not 0 <= q['a'] < len(opts):
            out.append(f'{where}: a must be the index of the right option')
        else:
            pos.append(q['a'])
        for k in ('why', 'en'):
            if not str(q.get(k, '')).strip():
                out.append(f'{where}: empty {k}')
    if len(pos) >= 8 and max(pos.count(k) for k in range(4)) > .4 * len(pos):
        out.append(f'answer positions are lopsided ({[pos.count(k) for k in range(4)]}); vary where the right option sits')
    return out


def read_json(path):
    raw = path.read_bytes()
    problems = ['CR characters: save with LF line endings'] if b'\r' in raw else []
    try:
        data = json.loads(raw.decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        return [], problems + [f'not valid UTF-8 JSON ({e})']
    if not isinstance(data, list):
        return [], problems + ['the file must hold one JSON array']
    return data, problems


def read_tsv(path, cols=WORD_COLS):
    raw = path.read_bytes()
    problems = []
    if b'\r' in raw:
        problems.append('CR characters: save with LF line endings')
    try:
        text = raw.decode('utf-8')
    except UnicodeDecodeError as e:
        return [], [f'not UTF-8 ({e})']
    lines = [l for l in text.split('\n') if l.strip()]
    if not lines or lines[0].split('\t') != cols:
        return [], problems + [f'the header must be: {chr(9).join(cols)}']
    rows = []
    for i, l in enumerate(lines[1:], 2):
        cells = l.split('\t')
        if len(cells) != len(cols):
            problems.append(f'line {i}: {len(cells)} columns, expected {len(cols)}')
            continue
        rows.append(dict(zip(cols, (c.strip() for c in cells))))
    return rows, problems


# ---- exam-format content (docs/08-exam-formats.md): reading, listening, writing, speaking ----

OPTS = {'rf': ['richtig', 'falsch'], 'jn': ['ja', 'nein']}
READ_PARTS = {'A1': {'Teil 1': ('rf', 5), 'Teil 2': ('match', 5), 'Teil 3': ('rf', 5)},
              'A2': {'Teil 1': ('abc', 5), 'Teil 2': ('abc', 5), 'Teil 3': ('abc', 5), 'Teil 4': ('match', 5)},
              'B1': {'Teil 1': ('rf', 6), 'Teil 2': ('abc', 3), 'Teil 3': ('match', 7), 'Teil 4': ('jn', 7), 'Teil 5': ('abc', 4)}}
LISTEN_PARTS = {'A1': {'Teil 1': (['abc'], 1), 'Teil 2': (['rf'], 1), 'Teil 3': (['abc'], 1)},
                'A2': {'Teil 1': (['abc'], 1), 'Teil 2': (['match'] * 5, 5), 'Teil 3': (['abc'], 1), 'Teil 4': (['jn'] * 5, 5)},
                'B1': {'Teil 1': (['rf', 'abc'], 2), 'Teil 2': (['abc'] * 5, 5), 'Teil 3': (['rf'] * 7, 7), 'Teil 4': (['match'] * 8, 8)}}
WRITE_PARTS = {'A1': ['Teil 1', 'Teil 2'], 'A2': ['Teil 1', 'Teil 2'], 'B1': ['Teil 1', 'Teil 2', 'Teil 3']}
SPEAK_PARTS = {'A1': ['Teil 1', 'Teil 2', 'Teil 3'], 'A2': ['Teil 1', 'Teil 2', 'Teil 3'], 'B1': ['Teil 1', 'Teil 2', 'Teil 3']}
READ_WORDS = {'A1': (30, 260), 'A2': (60, 420), 'B1': (120, 750)}


def blank(x):
    return not (isinstance(x, str) and x.strip())


def check_question(q, where, fmt, valid_ev, labels=()):
    """One exam question: format, options, answer index, evidence, explanation."""
    out = []
    if q.get('format') != fmt:
        out.append(f'{where}: format should be {fmt!r} for this part, not {q.get("format")!r}')
    opts, a = q.get('opts', []), q.get('a')
    if fmt in OPTS and opts != OPTS[fmt]:
        out.append(f'{where}: opts must be {OPTS[fmt]}')
    if fmt == 'abc' and (len(opts) != 3 or len(set(opts)) != 3):
        out.append(f'{where}: abc needs 3 different options')
    if fmt == 'match' and (len(opts) < 2 or (labels and not set(opts) <= set(labels) | {'x'})):
        out.append(f'{where}: match options must be the labels of the texts/ads ({sorted(labels)}) or x')
    if not isinstance(a, int) or not 0 <= a < len(opts):
        out.append(f'{where}: a must index opts')
    if blank(q.get('q')) and fmt != 'match':
        out.append(f'{where}: empty q')
    if blank(q.get('why')):
        out.append(f'{where}: empty why (say why the answer is right)')
    ev = q.get('ev', [])
    if not ev and not (isinstance(a, int) and a < len(opts) and opts[a] == 'x'):
        out.append(f'{where}: ev must point to the evidence')
    if any(e not in valid_ev for e in ev):
        out.append(f'{where}: ev {ev} points to something that does not exist')
    return out


def lopsided(answers, n_opts):
    return len(answers) >= 9 and max(answers.count(k) for k in range(n_opts)) > .55 * len(answers)


def check_reading(texts, level):
    out, ids, abc = [], set(), []
    for i, t in enumerate(texts):
        where = f'text {i} ({t.get("id", "?")})'
        if t.get('id') in ids or blank(t.get('id')):
            out.append(f'{where}: id missing or repeated')
        ids.add(t.get('id'))
        if not isinstance(t.get('station'), int) or not 1 <= t['station'] <= 12:
            out.append(f'{where}: station must be 1–12')
        part = READ_PARTS[level].get(t.get('part'))
        if not part:
            out.append(f'{where}: part must be one of {list(READ_PARTS[level])}')
            continue
        for k in ('type', 'title'):
            if blank(t.get(k)):
                out.append(f'{where}: empty {k}')
        blocks = t.get('blocks', [])
        sids, labels, words, bids = set(), set(), 0, set()
        for b in blocks:
            if blank(b.get('id')) or b['id'] in bids:
                out.append(f'{where}: every block needs its own id')
            bids.add(b.get('id'))
            if b.get('t') not in ('h', 'p', 'ad', 'sign', 'comment', 'list'):
                out.append(f'{where} block {b.get("id")}: t must be h, p, ad, sign, comment or list')
            if b.get('label'):
                labels.add(b['label'])
            for k, pair in enumerate(b.get('s', [])):
                if not (isinstance(pair, list) and len(pair) == 2 and not blank(pair[0]) and not blank(pair[1])):
                    out.append(f'{where} block {b.get("id")}: s is a list of ["German", "English"] pairs')
                    continue
                sids.add(f'{b["id"]}.{k}')
                words += len(pair[0].split())
            if not b.get('s'):
                out.append(f'{where} block {b.get("id")}: no sentences')
        lo, hi = READ_WORDS[level]
        if not lo <= words <= hi:
            out.append(f'{where}: {words} German words; {level} texts here have {lo}–{hi}')
        fmt, n = part
        qs = t.get('questions', [])
        if len(qs) != n:
            out.append(f'{where}: {t["part"]} has {n} questions, not {len(qs)}')
        for j, q in enumerate(qs):
            out += check_question(q, f'{where} question {j}', fmt, sids, labels)
            if fmt == 'abc' and isinstance(q.get('a'), int):
                abc.append(q['a'])
        text = ' '.join(p[0] for b in blocks for p in b.get('s', []) if isinstance(p, list) and p).lower()
        for g in t.get('glossary', []):
            if blank(g.get('w')) or blank(g.get('en')):
                out.append(f'{where}: glossary entries need w and en')
            elif g['w'].lower() not in text:
                out.append(f'{where}: glossary word {g["w"]!r} is not in the text')
        pr = t.get('predict', {})
        if blank(pr.get('q')) or len(pr.get('opts', [])) != 3 or pr.get('a') not in (0, 1, 2):
            out.append(f'{where}: predict needs q, 3 opts and a')
    if lopsided(abc, 3):
        out.append(f'abc answer positions are lopsided ({[abc.count(k) for k in range(3)]})')
    return out


def check_listening(items, level):
    out, ids, abc = [], set(), []
    for i, it in enumerate(items):
        where = f'item {i} ({it.get("id", "?")})'
        if it.get('id') in ids or blank(it.get('id')):
            out.append(f'{where}: id missing or repeated')
        ids.add(it.get('id'))
        if not isinstance(it.get('station'), int) or not 1 <= it['station'] <= 12:
            out.append(f'{where}: station must be 1–12')
        part = LISTEN_PARTS[level].get(it.get('part'))
        if not part:
            out.append(f'{where}: part must be one of {list(LISTEN_PARTS[level])}')
            continue
        if blank(it.get('setup')):
            out.append(f'{where}: empty setup (one English line: who is talking, where)')
        lines = it.get('lines', [])
        if not lines:
            out.append(f'{where}: no lines')
        for k, l in enumerate(lines):
            if l.get('who') not in ('A', 'B', 'N') or blank(l.get('de')) or blank(l.get('en')):
                out.append(f'{where} line {k}: needs who (A, B or N), de and en')
        fmts, n = part
        qs = it.get('questions', [])
        if len(qs) != n:
            out.append(f'{where}: {it["part"]} has {n} question(s) per item, not {len(qs)}')
        for j, q in enumerate(qs):
            fmt = fmts[min(j, len(fmts) - 1)]
            out += check_question(q, f'{where} question {j}', fmt, set(range(len(lines))))
            if fmt == 'match' and len(q.get('opts', [])) < 3:
                out.append(f'{where} question {j}: match needs 3+ options')
            if fmt == 'abc' and isinstance(q.get('a'), int):
                abc.append(q['a'])
    if lopsided(abc, 3):
        out.append(f'abc answer positions are lopsided ({[abc.count(k) for k in range(3)]})')
    return out


def pairs_ok(xs):
    return isinstance(xs, list) and xs and all(isinstance(p, list) and len(p) == 2 and not blank(p[0]) and not blank(p[1]) for p in xs)


def check_writing(tasks, level):
    out, ids = [], set()
    for i, t in enumerate(tasks):
        where = f'task {i} ({t.get("id", "?")})'
        if t.get('id') in ids or blank(t.get('id')):
            out.append(f'{where}: id missing or repeated')
        ids.add(t.get('id'))
        if not isinstance(t.get('station'), int) or not 1 <= t['station'] <= 12:
            out.append(f'{where}: station must be 1–12')
        if t.get('part') not in WRITE_PARTS[level]:
            out.append(f'{where}: part must be one of {WRITE_PARTS[level]}')
        for k in ('task_en', 'task_de', 'model', 'model_en'):
            if blank(t.get(k)):
                out.append(f'{where}: empty {k}')
        form = level == 'A1' and t.get('part') == 'Teil 1'
        if form:
            f = t.get('form', {})
            if blank(f.get('text_de')) or len(f.get('fields', [])) != 5 or not pairs_ok(f.get('fields')):
                out.append(f'{where}: A1 Teil 1 needs form.text_de and 5 form.fields ["label", "answer"]')
        else:
            if len(t.get('points', [])) != 3 or any(blank(p) for p in t.get('points', [])):
                out.append(f'{where}: 3 points to cover')
            w = t.get('words', [])
            if not (isinstance(w, list) and len(w) == 2 and 0 < w[0] < w[1]):
                out.append(f'{where}: words is [min, max]')
            elif not w[0] * .8 <= len(t.get('model', '').split()) <= w[1] * 1.25:
                out.append(f'{where}: the model has {len(t.get("model", "").split())} words for a {w} task')
            if not pairs_ok(t.get('phrases')) or len(t['phrases']) < 4:
                out.append(f'{where}: 4+ phrases as ["German", "English"]')
            if len(t.get('rubric', [])) < 3:
                out.append(f'{where}: 3+ rubric lines')
    return out


def check_speaking(tasks, level):
    out, ids = [], set()
    for i, t in enumerate(tasks):
        where = f'task {i} ({t.get("id", "?")})'
        if t.get('id') in ids or blank(t.get('id')):
            out.append(f'{where}: id missing or repeated')
        ids.add(t.get('id'))
        if not isinstance(t.get('station'), int) or not 1 <= t['station'] <= 12:
            out.append(f'{where}: station must be 1–12')
        if t.get('part') not in SPEAK_PARTS[level]:
            out.append(f'{where}: part must be one of {SPEAK_PARTS[level]}')
        for k in ('task_en', 'task_de'):
            if blank(t.get(k)):
                out.append(f'{where}: empty {k}')
        if not t.get('cards') or any(blank(c) for c in t['cards']):
            out.append(f'{where}: cards (the prompts on the exam cards) missing')
        if not pairs_ok(t.get('phrases')) or len(t['phrases']) < 4:
            out.append(f'{where}: 4+ phrases as ["German", "English"]')
        model = t.get('model', [])
        if not model or any(not (isinstance(m, list) and len(m) == 3 and m[0] in ('A', 'B') and not blank(m[1]) and not blank(m[2])) for m in model):
            out.append(f'{where}: model is a list of ["A" or "B", "German", "English"]')
        if not isinstance(t.get('partner', []), list) or (t.get('partner') and not pairs_ok(t['partner'])):
            out.append(f'{where}: partner is a list of ["German", "English"] lines the app says as your partner')
        if not all(isinstance(t.get(k), int) and t[k] > 0 for k in ('prep_s', 'speak_s')):
            out.append(f'{where}: prep_s and speak_s in seconds')
    return out


def known_words():
    """(lemma, article) of every course word, from data/src/words-*.tsv."""
    out = set()
    for p in (ROOT / 'data/src').glob('words-*.tsv'):
        rows, _ = read_tsv(p)
        out |= {(r['lemma'], r['article']) for r in rows}
    return out


SCENE_ANIMS = {'drive', 'pass', 'fall'}
VIEW_W, VIEW_H = 1000, 620


def label_box(o):
    """The name board's rectangle in scene coordinates: bottom-centre at at + tag."""
    text = f'{o.get("a") or ""} {o["w"]}'.strip()
    w, h = len(text) * 11 + 22, 30
    x = o.get('at', [0, 0])[0] + o.get('tag', [0, 0])[0]
    y = o.get('at', [0, 0])[1] + o.get('tag', [0, 0])[1]
    return x - w / 2, y - h, x + w / 2, y


def check_scenes(scenes, words=None):
    import xml.etree.ElementTree as ET
    words = known_words() if words is None else words
    out, ids = [], set()
    for sc in scenes:
        where = f'scene {sc.get("id", "?")}'
        if sc.get('id') in ids or blank(sc.get('id')):
            out.append(f'{where}: id missing or repeated')
        ids.add(sc.get('id'))
        for k in ('de', 'en', 'sky', 'back'):
            if blank(sc.get(k)):
                out.append(f'{where}: empty {k}')
        if not sc.get('stations') or not all(isinstance(n, int) and 1 <= n <= 36 for n in sc['stations']):
            out.append(f'{where}: stations is a list of station numbers 1–36')
        svgs = [('back', sc.get('back', ''))] + [(f'object {i}', o.get('svg', '')) for i, o in enumerate(sc.get('objs', []))]
        for name, svg in svgs:
            try:
                ET.fromstring(f'<g xmlns="http://www.w3.org/2000/svg">{svg}</g>')
            except ET.ParseError as e:
                out.append(f'{where} {name}: the SVG is not well-formed ({e})')
        live = [o for o in sc.get('objs', []) if o.get('w')]
        if len(live) < 15:
            out.append(f'{where}: {len(live)} labelled words, needs 15 or more')
        seen = set()
        for o in live:
            w = f'{o.get("a") or ""} {o["w"]}'.strip()
            if (o['w'], o.get('a') or '') not in words:
                out.append(f'{where}: "{w}" is not a course word (lemma and article as in data/src/words-*.tsv)')
            if w in seen:
                out.append(f'{where}: "{w}" is labelled twice')
            seen.add(w)
            if not (isinstance(o.get('at'), list) and len(o['at']) == 2 and isinstance(o.get('tag'), list) and len(o['tag']) == 2):
                out.append(f'{where} "{w}": at and tag are [x, y]')
                continue
            if o.get('mv') and (len(o['mv']) not in (3, 4) or o.get('move') not in SCENE_ANIMS):
                out.append(f'{where} "{w}": mv is [from, to, seconds, delay] with move drive, pass or fall')
            if o.get('only') not in (None, 'sun', 'rain', 'snow'):
                out.append(f'{where} "{w}": only is sun, rain or snow')
            x0, y0, x1, y1 = label_box(o)
            if not o.get('mv') and (x0 < 0 or y0 < 0 or x1 > VIEW_W or y1 > VIEW_H):
                out.append(f'{where} "{w}": its label sticks out of the picture')
        still = [o for o in live if not o.get('mv') and isinstance(o.get('at'), list) and isinstance(o.get('tag'), list)]
        for i, a in enumerate(still):
            for b in still[i + 1:]:
                if a.get('only') and b.get('only') and a['only'] != b['only']:
                    continue
                ax0, ay0, ax1, ay1 = label_box(a)
                bx0, by0, bx1, by1 = label_box(b)
                if ax0 < bx1 and bx0 < ax1 and ay0 < by1 and by0 < ay1:
                    out.append(f'{where}: the labels of "{a["w"]}" and "{b["w"]}" overlap')
    return out


def check_vq(qs, level, words=None):
    words = known_words() if words is None else words
    lemmas = {w for w, _ in words}
    out, pos = [], []
    for i, q in enumerate(qs):
        where = f'question {i} ({q.get("w", "?")})'
        if q.get('type') not in ('synonym', 'usage', 'context'):
            out.append(f'{where}: type is synonym, usage or context')
        if q.get('w') not in lemmas:
            out.append(f'{where}: w must be a course word (its lemma)')
        if blank(q.get('q')) or blank(q.get('why')):
            out.append(f'{where}: q and why must not be empty')
        if q.get('type') == 'context' and str(q.get('q', '')).count('___') != 1:
            out.append(f'{where}: a context question has exactly one ___')
        if q.get('type') == 'synonym' and (blank(q.get('u')) or q['u'] not in q.get('q', '')):
            out.append(f'{where}: a synonym question names the underlined part u, which appears in q')
        opts = q.get('opts', [])
        if len(opts) != 4 or len(set(opts)) != 4 or any(blank(o) for o in opts):
            out.append(f'{where}: 4 different options')
        if not isinstance(q.get('a'), int) or not 0 <= q['a'] < 4:
            out.append(f'{where}: a indexes opts')
        else:
            pos.append(q['a'])
        if not isinstance(q.get('station'), int) or not 1 <= q['station'] <= 12:
            out.append(f'{where}: station 1–12')
    if lopsided(pos, 4):
        out.append(f'answer positions are lopsided ({[pos.count(k) for k in range(4)]})')
    return out


def check_sounds(sounds, level=None):
    out, ids = [], set()
    for s in sounds:
        where = f'sound {s.get("id", "?")}'
        if s.get('id') in ids or blank(s.get('id')):
            out.append(f'{where}: id missing or repeated')
        ids.add(s.get('id'))
        for k in ('sound', 'title', 'how'):
            if blank(s.get(k)):
                out.append(f'{where}: empty {k}')
        m = s.get('mouth', {})
        if m.get('lips') not in ('round', 'spread', 'open', 'neutral') or m.get('tongue') not in ('front', 'mid', 'back', 'tip', 'low') \
                or not isinstance(m.get('jaw'), (int, float)) or not 0 <= m['jaw'] <= 1:
            out.append(f'{where}: mouth needs lips (round/spread/open/neutral), tongue (front/mid/back/tip/low) and jaw 0–1')
        if not pairs_ok(s.get('examples')) or len(s['examples']) < 4:
            out.append(f'{where}: 4+ examples as ["German word", "English"]')
        ps = s.get('pairs', [])
        if len(ps) < 4 or any(not (isinstance(p, list) and len(p) == 4 and not any(blank(x) for x in p) and p[0] != p[1]) for p in ps):
            out.append(f'{where}: 4+ minimal pairs as ["word with this sound", "contrast word", "English 1", "English 2"]')
    return out


CHECKS = {'reading-': check_reading, 'listen-': check_listening, 'writing-': check_writing, 'speaking-': check_speaking,
          'scenes-': check_scenes, 'vq-': check_vq, 'sounds': check_sounds}


def check_file(path, copied):
    for prefix, check in CHECKS.items():
        if path.name.startswith(prefix):
            data, problems = read_json(path)
            parts = path.stem.split('-')
            return problems + check(data, parts[1] if len(parts) > 1 else None)
    if path.name.startswith('words-'):
        rows, problems = read_tsv(path)
        return problems + check_words(rows, copied)
    if path.name.startswith('assign-'):
        rows, problems = read_tsv(path, ['article', 'word', 'pos', 'station'])
        level = path.stem.split('-')[1]
        goethe_rows, _ = read_tsv(ROOT / f'data/src/goethe-{level}.tsv', ['article', 'word', 'pos'])
        goethe = [(r['article'], r['word'], r['pos']) for r in goethe_rows]
        return problems + check_assign(rows, goethe)
    if path.name.startswith(('grammar-', 'gq-')):
        data, problems = read_json(path)
        check = check_grammar if path.name.startswith('grammar-') else check_gq
        return problems + check(data, grammar_ids())
    return [f'unknown content kind (file name prefix): {path.name}']


def test():
    ok = dict(lemma='Tisch', pos='n', article='der', plural='Tische', forms='', english='table',
              example_de='Der Tisch ist neu.', example_en='The table is new.', station='5')
    assert check_words([ok]) == []
    assert check_words([dict(ok, example_de='Die Tische sind neu.')]) == []
    assert check_words([dict(ok, example_de='Das Krankenhaus ist neu.', lemma='Haus', plural='Häuser', article='das')]), 'Haus inside Krankenhaus'
    assert check_words([dict(ok, article='')]), 'noun without article'
    assert check_words([dict(ok, station='13')]), 'station out of range'
    verb = dict(ok, lemma='fahren', pos='v', article='', plural='', forms='fährt, fuhr, ist gefahren', example_de='Ich fahre nach Berlin.', example_en='I am going to Berlin.')
    assert check_words([verb]) == []
    assert check_words([dict(verb, forms='fährt')]), 'incomplete verb forms'
    assert check_words([ok, ok]), 'duplicate'
    assert check_words([ok], copied={norm('Der Tisch ist neu.')}), 'copied example'
    rows = [dict(article='der', word='Tisch', pos='n', station=str(1 + i % 12)) for i in range(12 * 35)]
    for i, r in enumerate(rows):
        r['word'] += str(i)
    goethe = [(r['article'], r['word'], r['pos']) for r in rows]
    assert check_assign(rows, goethe) == []
    assert check_assign(rows[1:], goethe), 'a checklist word is missing and station 1 has 34'
    ex = {'de': ['Am Montag', 'gehe', 'ich', 'ins Kino.'], 'en': [[[2], 'I'], [[1], 'go'], [[3], 'to the cinema'], [[0], 'on Monday.']], 'v': [1]}
    g = {'id': 'a1-inversion', 'pattern': 'Time + verb + subject', 'explain': 'x', 'compare_en': 'y', 'examples': [ex, ex]}
    assert check_grammar([g], {'a1-inversion'}) == []
    assert check_grammar([dict(g, examples=[ex])], {'a1-inversion'}), 'one example is too few'
    assert check_grammar([dict(g, examples=[ex, dict(ex, en=[[[2], 'I']])])], {'a1-inversion'}), 'unlinked chunks'
    assert check_grammar([dict(g, id='nope')], {'a1-inversion'}), 'unknown id'
    q = {'g': 'a1-inversion', 'q': 'Am Montag ___ ich.', 'opts': ['gehe', 'ich gehe', 'gehen', 'geht'], 'a': 0, 'why': 'V2', 'en': 'On Monday I go.'}
    assert check_gq([q], {'a1-inversion'}) == []
    assert check_gq([dict(q, opts=['a', 'a', 'b', 'c'])], {'a1-inversion'}), 'duplicate options'
    assert check_gq([dict(q, q='no blank')], {'a1-inversion'}), 'no blank'
    assert check_gq([q] * 8, {'a1-inversion'}), 'all answers in the same position'
    text = {'id': 'r1', 'station': 2, 'part': 'Teil 1', 'type': 'email', 'title': 'Hallo Lena', 'intro': '',
            'blocks': [{'id': 'b1', 't': 'p', 's': [['Ich heiße Priya und ich komme aus Indien.', "I'm Priya and I'm from India."]] * 6}],
            'glossary': [{'w': 'Indien', 'en': 'India'}], 'predict': {'q': '?', 'opts': ['a', 'b', 'c'], 'a': 0},
            'questions': [{'q': 'Priya kommt aus Indien.', 'format': 'rf', 'opts': ['richtig', 'falsch'], 'a': 0, 'ev': ['b1.0'], 'why': 'x'}] * 5}
    assert check_reading([text], 'A1') == [], check_reading([text], 'A1')
    assert check_reading([dict(text, part='Teil 9')], 'A1'), 'unknown part'
    bad_q = dict(text['questions'][0], ev=['b9.9'])
    assert check_reading([dict(text, questions=[bad_q] * 5)], 'A1'), 'evidence that does not exist'
    item = {'id': 'h1', 'station': 1, 'part': 'Teil 1', 'setup': 'At a café.', 'lines': [{'who': 'A', 'de': 'Ein Kaffee, bitte.', 'en': 'A coffee, please.'}],
            'questions': [{'q': 'Was bestellt sie?', 'format': 'abc', 'opts': ['Kaffee', 'Tee', 'Wasser'], 'a': 0, 'ev': [0], 'why': 'x'}]}
    assert check_listening([item], 'A1') == [], check_listening([item], 'A1')
    assert check_listening([dict(item, lines=[{'who': 'Z', 'de': 'x', 'en': 'y'}])], 'A1'), 'unknown speaker'
    words = {(f'Ding{i}', 'das') for i in range(20)}
    objs = [{'w': f'Ding{i}', 'a': 'das', 'at': [90 + (i % 5) * 190, 100 + (i // 5) * 120], 'tag': [0, -10], 'svg': '<circle r="10" fill="#c00"/>'} for i in range(16)]
    sc = {'id': 'test', 'de': 'Test', 'en': 'Test', 'sky': '#fff', 'back': '<rect width="1000" height="620"/>', 'stations': [1], 'objs': objs}
    assert check_scenes([sc], words) == [], check_scenes([sc], words)
    assert check_scenes([dict(sc, objs=objs[:14])], words), 'too few words'
    assert check_scenes([dict(sc, objs=objs + [dict(objs[0], w='Ding17', at=[92, 101])])], words), 'overlapping labels'
    assert check_scenes([dict(sc, back='<rect width="1000"')], words), 'broken SVG'
    print('ok')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if '--test' in sys.argv:
        test()
        sys.exit(0)
    copied = goethe_sentences()
    bad = 0
    for f in sys.argv[1:]:
        problems = check_file(Path(f), copied)
        bad += len(problems)
        for p in problems:
            print(f'{f}: {p}')
    print('ALL OK' if not bad else f'{bad} problems')
    sys.exit(1 if bad else 0)
