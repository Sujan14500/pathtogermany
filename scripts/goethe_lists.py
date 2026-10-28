"""Extract the headword checklist from the Goethe-Zertifikat word lists → data/src/goethe-<level>.tsv

usage:  python scripts/goethe_lists.py           write the checklists
        python scripts/goethe_lists.py --test    self-check
input:  data/cache/goethe/<level>-plain.txt  text of the PDFs (pdftotext; made from data/cache/goethe/*.pdf if missing)
        data/cache/kaikki-german.jsonl       Wiktionary entries; a small index of every entry → data/cache/kaikki-forms.json

Only headwords are kept (article, word, part of speech), as a checklist of what each level expects; the PDFs' example
sentences are copyrighted and never enter the app. Each level's file lists only the words new at that level.
Headwords come from both parts of each list:
- the Wortgruppen pages (numbers, time, countries, jobs, family, school subjects, abbreviations …), where nouns often stand
  without an article (Lehrer, - / Lehrerin, -nen): every word there that Wiktionary knows, the article from its gender;
- the alphabetical list: a line's first word, if Wiktionary knows it as a word in its own right. That includes entries
  Wiktionary files as 'form-of' (agent nouns like Lehrer, feminine forms like Lehrerin, adjectival nouns like der
  Erwachsene), abbreviations (Lkw, SMS) and plural-only nouns marked (Pl.). Stem entries (dies-, letzt-, all-) become
  their lemma (dieser, letzte, alle). A participle counts only when an example follows it (geboren Ich bin … geboren.).
  Inflected forms (fährt ab, hat abgefahren, Minuten) and the tails of example sentences are dropped.
Words that are not learner words (regional variants, headings) stay in the checklist; assign-<level>.tsv gives them station 0.
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC, CACHE = ROOT / 'data/src', ROOT / 'data/cache'
FORMS = CACHE / 'kaikki-forms.json'
# level, PDF name, Wortgruppen pages, alphabetical pages
LISTS = [('A1', 'A1_SD1_Wortliste_02', (6, 8), (9, 27)), ('A2', 'Goethe-Zertifikat_A2_Wortliste', (5, 7), (8, 31)),
         ('B1', 'Goethe-Zertifikat_B1_Wortliste', (8, 15), (16, 103))]
POS = {'noun': 'n', 'verb': 'v', 'adj': 'adj', 'adv': 'adv', 'prep': 'prep', 'postp': 'prep', 'conj': 'conj', 'pron': 'pron',
       'num': 'num', 'article': 'art', 'det': 'art', 'phrase': 'phrase', 'intj': 'other', 'particle': 'other', 'name': 'name',
       'contraction': 'other', 'prep_phrase': 'phrase'}
INFLECTION = {'plural', 'genitive', 'dative', 'accusative', 'nominative', 'first-person', 'second-person', 'third-person', 'past',
              'present', 'preterite', 'subjunctive-i', 'subjunctive-ii', 'comparative', 'superlative', 'imperative'}
RANK = {'lemma': 0, 'alt': 1, 'derived': 2, 'part': 3, 'infl': 4}
ART_OF = {'m': 'der', 'f': 'die', 'n': 'das'}
ARTICLE = re.compile(r'^(der|die|das)(?:\s*/\s*(?:der|die|das))*\s+([A-ZÄÖÜ][\wäöüßÄÖÜ-]*)(\s*\((?:Pl|pl)\.\))?')
WORD = re.compile(r"^[a-zäöüß][\wäöüßÄÖÜ'-]*")
# Countries and languages are kept; other names in the lists are people and towns from the example sentences.
COUNTRIES = {'Deutschland', 'Europa', 'Österreich', 'Schweiz', 'Finnland', 'Mexiko', 'Luxemburg', 'Griechenland', 'Türkei',
             'Ukraine', 'Indien', 'China', 'Deutsch', 'Englisch', 'Latein', 'Chinesisch', 'Türkisch', 'Ukrainisch'}
# Stem entries whose lemma the course spells this way (the rest: the stem itself, stem + er, stem + e, whichever is a lemma).
STEMS = {'all': ('alle', 'art'), 'welch': ('welcher', 'art'), 'nächst': ('nächste', 'adj'), 'einig': ('einige', 'art'),
         'manch': ('manche', 'art'), 'dies': ('dieser', 'pron')}
HEADINGS = {'Farben', 'Länder', 'Ländernamen', 'Nationalitäten', 'Berufe', 'Familienmitglieder', 'Familienstand', 'Himmelsrichtungen',
            'Währungen', 'Maße', 'Gewichte', 'Schulfächer', 'Zeitangaben', 'Feiertage', 'Jahreszeiten', 'Monate', 'Tageszeiten', 'Zahlen',
            'Uhrzeit', 'Wochentage', 'Zeitmaße', 'Abkürzungen', 'Anweisungssprache', 'Datum', 'Monatsnamen', 'Bruchzahlen', 'Schulnoten',
            'Anglizismen', 'Bildungseinrichtungen', 'Begriffe', 'Kontinente', 'Sprachen', 'Staatsangehörigkeiten', 'Tiere'}
SKIP_LINE = re.compile(r'enthält|übergeordneten|Angabe|[Ww]ortgruppen|WORTLISTE|WORTSCHATZ|Seite|Zertifikat|ZERTIFIKAT|VS_0|_Wortliste|^\d+(\.\d+)+\s')
JUNK = {'o', 'wusch', 'icht', 'det', 'Ös', 'Fr', 'Bundes', 'nen', 'e', 'Sg', 'Pl', 'usw', 'ca', 'etc', 'vgl', 'bzw', 'Nord', 'Süd', 'Ost',
        'West', 'Last', 'Express', 'Player', 'Kreuzen'}
# Hidden by the PDF layout (the A1 word-group pages print them as figures) but on the A1 list.
EXTRA = {'A1': [('der', 'März', 'n'), ('', 'hundert', 'num'), ('', 'tausend', 'num'), ('', 'Indien', 'name'), ('', 'Deutsch', 'name'),
                ('', 'Englisch', 'name'), ('', 'schön', 'adj')]}


def forms_index():
    """word → [[pos, kind, gender, plural]] for every Wiktionary entry; kind is lemma, alt (abbreviation, spelling),
    derived (agent noun, feminine form …), part (participle) or infl (an inflected form)."""
    if FORMS.exists():
        return json.loads(FORMS.read_text(encoding='utf-8'))
    idx = {}
    with (CACHE / 'kaikki-german.jsonl').open(encoding='utf-8') as f:
        for line in f:
            e = json.loads(line)
            p, senses = POS.get(e.get('pos')), [s for s in e.get('senses', []) if s.get('glosses')]
            if not p or not senses:
                continue
            kinds = []
            for s in senses:
                t = set(s.get('tags', []))
                if not ({'form-of', 'alt-of'} & t or s.get('form_of') or s.get('alt_of')):
                    kinds.append('lemma')
                elif {'alt-of', 'abbreviation', 'initialism'} & t:
                    kinds.append('alt')
                elif 'participle' in t:
                    kinds.append('part')
                elif INFLECTION & t:
                    kinds.append('infl')
                else:
                    kinds.append('derived')
            tags = [t for s in senses for t in s.get('tags', [])]
            g = ''.join(dict.fromkeys(x[0] for x in tags if x in ('masculine', 'feminine', 'neuter')))
            pl = next((x['form'] for x in e.get('forms', []) if 'source' not in x and x.get('tags') == ['plural']), '')
            idx.setdefault(e['word'], []).append([p, min(kinds, key=RANK.get), g, pl])
    FORMS.write_text(json.dumps(idx, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    return idx


def entries(idx, w, kinds=('lemma', 'alt', 'derived'), pos=None):
    return [e for e in idx.get(w, []) if e[1] in kinds and (pos is None or e[0] == pos)]


def stem_lemma(idx, s):
    """(lemma, pos): all → alle, dies → dieser, letzt → letzte, dein → dein."""
    w = next((c for c in (s, s + 'er', s + 'e') if entries(idx, c, ('lemma',))), None)
    return STEMS.get(s) or (w and (w, entries(idx, w, ('lemma',))[0][0]))


def gender_article(e):
    return ART_OF.get(e[2][:1], '')


def alphabetical(lines, idx):
    """[(article, word, pos)] from the alphabetical pages, in list order."""
    out = []
    for raw in lines:
        line = re.sub(r'\s+', ' ', raw).strip()
        line = re.sub(r'^\(sich\)\s*', '', line)
        m = ARTICLE.match(line)
        if m:
            w = m[2]
            if w.endswith('-'):
                continue                                    # a broken compound: der Anruf-/beantworter
            if m[3]:
                out.append(('pl', w, 'n'))                  # die Kenntnisse (Pl.)
            elif entries(idx, w, pos='n'):
                out.append((m[1], w, 'n'))
            continue
        m = WORD.match(line)
        if not m:
            c = re.match(r'[A-ZÄÖÜ][a-zäöüß]+', line)       # capitalised without an article: interjections only (Hallo)
            ps = {e[0] for e in entries(idx, c[0])} if c else set()
            if ps and not ps & {'n', 'art', 'pron', 'conj', 'adv', 'prep', 'v', 'adj', 'name'}:
                out.append(('', c[0], sorted(ps)[0]))
            continue
        tok, rest = m[0].strip("'"), line[m.end():].strip()
        parts = line.split()
        if len(parts) <= 3 and line.endswith(('.', '?', '!')) and (len(parts) == 1 or not parts[1][:1].isupper()):
            continue                                        # the tail of an example (not 'herzlich Herzlichen Glückwunsch!')
        if tok.endswith('-'):
            w = stem_lemma(idx, tok[:-1])
            if w:
                out.append(('', *w))
            continue
        ok = entries(idx, tok, ('lemma', 'alt'))
        if len(tok) < 2:
            continue
        if ok and not rest.startswith('-'):
            out.append(('', tok, ok[0][0]))
        elif entries(idx, tok, ('part',)) and rest[:1].isupper():
            out.append(('', tok, 'adj'))                    # a participle headword: geboren Ich bin in … geboren.
    return out


def word_groups(lines, idx):
    """[(article, word, pos)] from the Wortgruppen pages: every word Wiktionary knows, headings and figures aside."""
    out = []
    for raw in lines:
        line = re.sub(r'\s+', ' ', raw).strip()
        if not line or SKIP_LINE.search(line):
            continue
        for m in re.finditer(r'(?:\b(der|die|das)\s+)?([A-Za-zÄÖÜäöüß]+)', line):
            art, w = m[1], m[2]
            if len(w) < 2 or w in HEADINGS or w in JUNK or w in ('der', 'die', 'das', 'ein', 'eine'):
                continue
            if w.endswith('er') and re.search(rf'{w[:-1]}', line):
                continue                                    # ein Deutscher, eine Deutsche: the -e form is the headword
            if w[0].isupper():
                ns = entries(idx, w, pos='n')
                if ns and (art or gender_article(ns[0])):          # a noun whose gender nobody gives (OG, UG) is left out
                    out.append((art or gender_article(ns[0]), w, 'n'))
                elif w in COUNTRIES:
                    out.append(('', w, 'name'))
            elif entries(idx, w, ('lemma',)):
                out.append(('', w, entries(idx, w, ('lemma',))[0][0]))
    return out


def pages(level, name):
    path = CACHE / 'goethe' / f'{level}-plain.txt'
    if not path.exists():                                   # pdftotext ships with Git for Windows (mingw64/bin)
        text = subprocess.run(['pdftotext', str(CACHE / 'goethe' / f'{name}.pdf'), '-'], capture_output=True, text=True,
                              encoding='utf-8', check=True).stdout
        path.write_text(''.join(f'@@PAGE {i}\n{p}' for i, p in enumerate(text.split('\f'), 1)), encoding='utf-8')
    out = {}
    for chunk in re.split(r'^@@PAGE ', path.read_text(encoding='utf-8'), flags=re.M)[1:]:
        n, _, body = chunk.partition('\n')
        out[int(n)] = body.split('\n')
    return out


def main():
    idx = forms_index()
    seen = set()
    for lv, name, (g0, g1), (a0, a1) in LISTS:
        p = pages(lv, name)
        words = EXTRA.get(lv, []) + [x for n in range(g0, g1 + 1) for x in word_groups(p.get(n, []), idx)] \
            + [x for n in range(a0, a1 + 1) for x in alphabetical(p.get(n, []), idx)]
        new = []
        for art, w, pos in words:
            if w in JUNK or (w, pos) in seen or (pos == 'name' and w not in COUNTRIES):
                continue
            seen.add((w, pos))
            new.append((art, w, pos))
        new.sort(key=lambda x: (x[1].lower(), x[1]))
        path = SRC / f'goethe-{lv}.tsv'
        path.write_text('article\tword\tpos\n' + ''.join(f'{a}\t{w}\t{p}\n' for a, w, p in new), encoding='utf-8', newline='\n')
        print(f'{lv}: {len(words)} headword lines, {len(new)} new words → {path.relative_to(ROOT)}')


def test():
    idx = {'Tisch': [['n', 'lemma', 'm', 'Tische']], 'abfahren': [['v', 'lemma', '', '']], 'fährt': [['v', 'infl', '', '']],
           'Hallo': [['other', 'lemma', '', '']], 'Frau': [['n', 'lemma', 'f', 'Frauen']], 'machen': [['v', 'lemma', '', '']],
           'Lehrer': [['n', 'derived', 'm', 'Lehrer']], 'Lehrerin': [['n', 'derived', 'f', 'Lehrerinnen']], 'dieser': [['pron', 'lemma', '', '']],
           'geboren': [['v', 'part', '', '']], 'Minuten': [['n', 'infl', '', '']], 'Minute': [['n', 'lemma', 'f', 'Minuten']],
           'SMS': [['n', 'lemma', 'f', '']], 'herzlich': [['adj', 'lemma', '', '']], 'Kenntnisse': [['n', 'infl', '', '']]}
    got = alphabetical(['der Tisch, -e Der Tisch ist neu.', 'abfahren, fährt ab, Wir fahren um zwölf ab.', 'fährt ab,',
                        'Hallo Hallo, wie geht es?', 'Frau Müller geht nach Hause.', 'machen.', 'der Lehrer, – Unsere Lehrerin heißt …',
                        'dies- Ich nehme lieber diesen Kuchen.', 'geboren Ich bin in Zagreb geboren.', 'herzlich Herzlichen Glückwunsch!',
                        'die Kenntnisse (Pl.) Deine Deutschkenntnisse sind gut.'], idx)
    assert got == [('der', 'Tisch', 'n'), ('', 'abfahren', 'v'), ('', 'Hallo', 'other'), ('der', 'Lehrer', 'n'), ('', 'dieser', 'pron'),
                   ('', 'geboren', 'adj'), ('', 'herzlich', 'adj'), ('pl', 'Kenntnisse', 'n')], got
    got = word_groups(['Berufe', 'Lehrer, - / Lehrerin, -nen', 'die Minute, -n', 'Minuten', 'SMS', 'Zeitmaße'], idx)
    assert got == [('der', 'Lehrer', 'n'), ('die', 'Lehrerin', 'n'), ('die', 'Minute', 'n'), ('die', 'SMS', 'n')], got
    print('ok')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    test() if '--test' in sys.argv else main()
