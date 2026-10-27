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


def check_file(path, copied):
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
