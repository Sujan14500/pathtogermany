"""Build app/data/*.json from data/src, then bundle app/WegNachDeutschland.html.

usage:  python scripts/build_data.py          build the JSON and the bundle
        python scripts/build_data.py --test   run the self-checks
        python scripts/build_data.py --verb-fixture   write app/test-verbs.json (Wiktionary conjugations) for test.html

Inputs:  data/src/syllabus.json    levels → stations (German and English title, can-do line, grammar points)
         data/cache/kaikki-german.jsonl   kaikki.org German entries of English Wiktionary (CC BY-SA), downloaded
                                          once from https://kaikki.org/dictionary/German/kaikki.org-dictionary-German.jsonl
Writes:  app/data/syllabus.json, app/WegNachDeutschland.html (via bundle.py); data/cache/kaikki-index.json
"""
import hashlib
import json
import re
import sys
from pathlib import Path

from bundle import bundle

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT, CACHE = ROOT / 'data/src', ROOT / 'app/data', ROOT / 'data/cache'
STATIONS_PER_LEVEL = 12

# ---- Wiktionary (kaikki.org): article, plural, IPA, glosses and verb principal parts per lemma ----

KAIKKI, INDEX = CACHE / 'kaikki-german.jsonl', CACHE / 'kaikki-index.json'
POS = {'noun': 'n', 'verb': 'v', 'adj': 'adj', 'adv': 'adv', 'prep': 'prep', 'postp': 'prep', 'conj': 'conj', 'pron': 'pron',
       'num': 'num', 'article': 'art', 'det': 'art', 'phrase': 'phrase', 'intj': 'other', 'particle': 'other', 'name': 'name',
       'contraction': 'other', 'prep_phrase': 'phrase'}
SKIP_TAGS = {'vulgar', 'offensive', 'derogatory', 'archaic', 'obsolete', 'slur', 'ethnic'}
CRUDE = re.compile(r'\b(fuck\w*|shit\w*|cunt|cock|prick|piss\w*|whore|slut|bitch|arse(hole)?|asshole|wank\w*|tits|nigger|fag+ot|retard\w*)\b', re.I)
GENDER = {'masculine': 'm', 'feminine': 'f', 'neuter': 'n'}


def lemma_entry(e):
    """One kaikki entry → compact dict, or None for inflected forms and entries with nothing clean to show."""
    senses = [s for s in e.get('senses', []) if s.get('glosses')
              and not {'form-of', 'alt-of', 'misspelling'} & set(s.get('tags', [])) and not s.get('form_of')]
    clean = [s for s in senses if not SKIP_TAGS & set(s.get('tags', [])) and not CRUDE.search(' '.join(s['glosses']))]
    if not clean or e.get('pos') not in POS:
        return None
    tags = [t for s in senses for t in s.get('tags', [])]
    head = [f for f in e.get('forms', []) if 'source' not in f]
    form = lambda *want: next((f['form'] for f in head if set(want) <= set(f.get('tags', []))), '')
    ipa = [s['ipa'] for s in e.get('sounds', []) if 'ipa' in s and not SKIP_TAGS & set(s.get('tags', []))]
    out = {'p': POS[e['pos']], 'ipa': ipa[0] if ipa else '',
           'gl': list(dict.fromkeys(s['glosses'][-1] for s in clean))[:4]}
    if out['p'] == 'n':
        out['g'] = ''.join(dict.fromkeys(GENDER[t] for t in tags if t in GENDER))
        out['pl'] = form('plural')
        if 'plural-only' in tags:
            out['pt'] = 1
    if out['p'] == 'v':
        out['v'] = [form('present', 'third-person', 'singular'), next((f['form'] for f in head if f.get('tags') == ['past']), ''),
                    form('participle', 'past'), [f['form'] for f in head if f.get('tags') == ['auxiliary']]]
    return out


def kaikki_index():
    """word → [lemma entries]; built once from the 1 GB dump, then read from data/cache/kaikki-index.json."""
    if INDEX.exists() and INDEX.stat().st_mtime > KAIKKI.stat().st_mtime:
        return json.loads(INDEX.read_text(encoding='utf-8'))
    idx = {}
    with KAIKKI.open(encoding='utf-8') as f:
        for line in f:
            e = json.loads(line)
            x = lemma_entry(e)
            if x:
                idx.setdefault(e['word'], []).append(x)
    INDEX.write_text(json.dumps(idx, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    return idx


LEVELS = ['A1', 'A2', 'B1']
WORD_COLS = ['lemma', 'pos', 'article', 'plural', 'forms', 'english', 'example_de', 'example_en', 'station']
ARTICLE_OF = {'m': 'der', 'f': 'die', 'n': 'das'}


def word_id(lemma, pos, article):
    """Stable across rebuilds and station moves, so progress survives."""
    return 'w' + hashlib.sha1(f'{lemma}|{pos}|{article}'.encode()).hexdigest()[:8]


def read_words():
    """data/src/words-<level>-*.tsv → rows with n, the station number across levels (1…36)."""
    rows = []
    for path in sorted(SRC.glob('words-*.tsv')):
        offset = LEVELS.index(path.stem.split('-')[1]) * STATIONS_PER_LEVEL
        lines = path.read_text(encoding='utf-8').split('\n')
        assert lines[0].split('\t') == WORD_COLS, f'{path.name}: unexpected header'
        for line in lines[1:]:
            if line.strip():
                r = dict(zip(WORD_COLS, (c.strip() for c in line.split('\t'))))
                r['n'] = offset + int(r['station'])
                rows.append(r)
    return rows


def build_words(rows, idx):
    """Rows → app words, the first station keeping a word taught twice; plus disagreements with Wiktionary."""
    out, seen, notes = [], set(), []
    for r in sorted(rows, key=lambda r: r['n']):
        lemma, pos, art = r['lemma'], r['pos'], r['article']
        key = (lemma, pos, art)
        if key in seen:
            continue
        seen.add(key)
        entries = idx.get(re.sub(r'^sich ', '', lemma), [])
        same = [e for e in entries if e['p'] == pos] or entries
        e = same[0] if same else {}
        if pos == 'n' and e.get('g') and art in ARTICLE_OF.values() and art not in [ARTICLE_OF[g] for g in e['g']]:
            notes.append((lemma, f'article {art}, Wiktionary has {"/".join(ARTICLE_OF[g] for g in e["g"])}'))
        if pos == 'n' and r['plural'] not in ('', '-') and e.get('pl') and r['plural'] != e['pl']:
            notes.append((lemma, f'plural {r["plural"]}, Wiktionary has {e["pl"]}'))
        if pos == 'v' and e.get('v') and r['forms']:
            pres, past, perf = [x.strip() for x in r['forms'].split(',')]
            mine = [pres.replace(' sich', ''), past.replace(' sich', ''), perf.split()[-1]]
            theirs = e['v'][:3]
            if any(a and b and a != b for a, b in zip(mine, theirs)):
                notes.append((lemma, f'forms {r["forms"]}, Wiktionary has {", ".join(theirs)} ({"/".join(e["v"][3])})'))
        if not entries:
            notes.append((lemma, 'not in Wiktionary'))
        w = {'id': word_id(lemma, pos, art), 'w': lemma, 'p': pos, 'en': r['english'], 'de': r['example_de'],
             'ee': r['example_en'], 'n': r['n']}
        if art:
            w['a'] = art
        if r['plural']:
            w['pl'] = r['plural']
        if r['forms']:
            w['f'] = r['forms']
        if e.get('ipa'):
            w['ipa'] = e['ipa']
        out.append(w)
    return out, notes


def build_grammar(levels, points, gq):
    """Grammar points in syllabus order with their station and title; form-choice questions keep only known ids."""
    where = {gid: (st['n'], title) for lv in levels for st in lv['stations'] for gid, title in st['grammar']}
    by_id = {g['id']: g for g in points if g['id'] in where}
    out = [dict(by_id[gid], n=n, title=title) for gid, (n, title) in where.items() if gid in by_id]
    missing = [gid for gid in where if gid not in by_id]
    return out, [q for q in gq if q['g'] in where], missing


def level_content(kind):
    """data/src/<kind>-<level>-*.json → one list, each item with its level and n, the station across levels (1…36)."""
    out = []
    for p in sorted(SRC.glob(f'{kind}-*.json')):
        level = p.stem.split('-')[1]
        for x in json.loads(p.read_text(encoding='utf-8')):
            out.append(dict(x, level=level, n=LEVELS.index(level) * STATIONS_PER_LEVEL + x['station']))
    ids = [x['id'] for x in out if 'id' in x]
    assert len(ids) == len(set(ids)), f'{kind}: repeated ids'
    return out


def read_json_files(pattern):
    return [x for p in sorted(SRC.glob(pattern)) for x in json.loads(p.read_text(encoding='utf-8'))]


def verb_fixture(words, count=60):
    """Wiktionary's present, preterite and imperative forms for the course's first verbs → app/test-verbs.json,
    so app/test.html can check the conjugation helpers. Separable prefixes are dropped (they go to the end)."""
    verbs = [w for w in words if w['p'] == 'v' and w.get('f') and not w['w'].startswith('sich ')][:count]
    want = {w['w']: w for w in verbs}
    cells = {'present': 'present', 'preterite': 'preterite'}
    person = [('first-person', 'singular'), ('second-person', 'singular'), ('third-person', 'singular'),
              ('first-person', 'plural'), ('second-person', 'plural'), ('third-person', 'plural')]
    out = {}
    with KAIKKI.open(encoding='utf-8') as f:
        for line in f:
            if '"pos": "verb"' not in line[:20]:
                continue
            e = json.loads(line)
            w = want.get(e['word'])
            if not w or e['word'] in out:
                continue
            conj = [x for x in e.get('forms', []) if x.get('source') == 'conjugation' and 'subordinate-clause' not in x.get('tags', [])]
            if not conj:
                continue
            table = {'w': w['w'], 'f': w['f']}
            for tense in cells:
                table[tense] = [sorted({x['form'].split(' ')[0] for x in conj if {tense, 'indicative', *p} <= set(x['tags'])}) for p in person]
            table['imperative'] = [sorted({x['form'] for x in conj if {'imperative', 'second-person', n} <= set(x['tags'])}) for n in ('singular', 'plural')]
            out[e['word']] = table
    (ROOT / 'app/test-verbs.json').write_text('[\n' + ',\n'.join(json.dumps(t, ensure_ascii=False) for t in out.values()) + '\n]\n',
                                             encoding='utf-8', newline='\n')
    return len(out)


def build_syllabus(levels):
    """Number the stations 1…36 across the levels and check every grammar id is unique."""
    seen, n = set(), 0
    for lv in levels:
        assert len(lv['stations']) == STATIONS_PER_LEVEL, f"{lv['level']}: {len(lv['stations'])} stations"
        for k, st in enumerate(lv['stations'], 1):
            n += 1
            st.update(n=n, k=k, level=lv['level'])
            assert st['de'] and st['en'] and st['can'] and st['grammar'], f'station {n} is missing a field'
            for gid, title in st['grammar']:
                assert gid.startswith(lv['level'].lower() + '-'), f'{gid}: id must start with its level'
                assert gid not in seen, f'{gid}: duplicate grammar id'
                assert title, f'{gid}: no title'
                seen.add(gid)
    return levels


def write_json(name, data):
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / f'{name}.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8', newline='\n')


def main():
    levels = build_syllabus(json.loads((SRC / 'syllabus.json').read_text(encoding='utf-8')))
    write_json('syllabus', levels)
    print(f"syllabus: {sum(len(lv['stations']) for lv in levels)} stations, "
          f"{sum(len(st['grammar']) for lv in levels for st in lv['stations'])} grammar points")
    words, notes = build_words(read_words(), kaikki_index())
    write_json('words', words)
    (CACHE / 'word-check.tsv').write_text(''.join(f'{w}\t{n}\n' for w, n in notes), encoding='utf-8')
    print(f'words: {len(words)} ({", ".join(f"{lv} {sum(1 for w in words if LEVELS[(w["n"] - 1) // 12] == lv)}" for lv in LEVELS)}); '
          f'{len(notes)} differences from Wiktionary → data/cache/word-check.tsv')
    grammar, gq, missing = build_grammar(levels, read_json_files('grammar-*.json'), read_json_files('gq-*.json'))
    write_json('grammar', grammar)
    vq = level_content('vq')
    write_json('drills', {'gq': gq, 'vq': vq})
    print(f'grammar: {len(grammar)} points ({len(missing)} not written yet), {len(gq)} form-choice questions, {len(vq)} vocabulary questions')
    counts = []
    for kind, name in (('reading', 'reading'), ('listen', 'listening'), ('writing', 'writing'), ('speaking', 'speaking')):
        items = level_content(kind)
        write_json(name, items)
        counts.append(f'{name} {len(items)}')
    scenes = read_json_files('scenes-*.json')
    write_json('scenes', scenes)
    sounds = json.loads((SRC / 'sounds.json').read_text(encoding='utf-8')) if (SRC / 'sounds.json').exists() else []
    write_json('sounds', sounds)
    print(', '.join(counts) + f', scenes {len(scenes)}, sounds {len(sounds)}')
    out = bundle()
    print(f'{out.relative_to(ROOT)}: {out.stat().st_size // 1024} KB')


def test():
    lv = build_syllabus([{'level': 'A1', 'stations': [{'de': 'x', 'en': 'x', 'can': 'x', 'grammar': [[f'a1-g{i}', 't']]}
                                                      for i in range(STATIONS_PER_LEVEL)]}])
    assert [st['n'] for st in lv[0]['stations']] == list(range(1, 13))
    try:
        build_syllabus([{'level': 'A1', 'stations': [{'de': 'x', 'en': 'x', 'can': 'x', 'grammar': [['a1-same', 't']]}] * 12}])
        failed = False
    except AssertionError as e:
        failed = 'duplicate' in str(e)
    assert failed, 'a repeated grammar id must be rejected'
    build_syllabus(json.loads((SRC / 'syllabus.json').read_text(encoding='utf-8')))

    row = dict(lemma='Tisch', pos='n', article='der', plural='Tische', forms='', english='table', example_de='Der Tisch.', example_en='The table.')
    idx = {'Tisch': [{'p': 'n', 'g': 'm', 'pl': 'Tische', 'ipa': '/tɪʃ/'}], 'fahren': [{'p': 'v', 'v': ['fährt', 'fuhr', 'gefahren', ['sein']]}],
           'Joghurt': [{'p': 'n', 'g': 'mn', 'pl': 'Joghurts'}]}
    words, notes = build_words([dict(row, n=5), dict(row, n=2), dict(row, lemma='Joghurt', plural='Joghurts', n=4, article='das'),
                                dict(row, lemma='fahren', pos='v', article='', plural='', forms='fährt, fuhr, ist gefahren', n=9),
                                dict(row, lemma='Haus', article='die', plural='Häuser', n=1)], idx)
    assert [w['w'] for w in words] == ['Haus', 'Tisch', 'Joghurt', 'fahren'] and words[1]['n'] == 2, words   # first station wins
    assert words[1]['ipa'] == '/tɪʃ/' and words[1]['id'] == word_id('Tisch', 'n', 'der')
    assert notes == [('Haus', 'not in Wiktionary')], notes        # das Joghurt is fine (m/n), fahren's forms agree
    _, notes = build_words([dict(row, article='die', plural='Tischen', n=1)], idx)
    assert [n for _, n in notes] == ['article die, Wiktionary has der', 'plural Tischen, Wiktionary has Tische'], notes

    lv = [{'stations': [{'n': 4, 'grammar': [['a1-x', 'X'], ['a1-y', 'Y']]}]}]
    out, gq, missing = build_grammar(lv, [{'id': 'a1-y', 'pattern': 'p'}, {'id': 'zz'}], [{'g': 'a1-y'}, {'g': 'zz'}])
    assert out == [{'id': 'a1-y', 'pattern': 'p', 'n': 4, 'title': 'Y'}] and gq == [{'g': 'a1-y'}] and missing == ['a1-x'], (out, gq, missing)
    print('ok')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    if '--verb-fixture' in sys.argv:
        print(f'app/test-verbs.json: {verb_fixture(build_words(read_words(), kaikki_index())[0])} verbs')
    else:
        test() if '--test' in sys.argv else main()
