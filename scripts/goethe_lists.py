"""Extract the headword checklist from the Goethe-Zertifikat word lists → data/src/goethe-<level>.tsv

usage:  python scripts/goethe_lists.py
input:  data/cache/goethe/*.pdf  (download from goethe.de, see docs/03-content.md; never committed)

Only the headwords are kept (article, word, part of speech), as a checklist of what each level expects.
The PDFs' example sentences are copyrighted and never enter the app. A line's first word counts as a
headword only if Wiktionary (data/cache/kaikki-index.json) knows it as a lemma, which drops verb-form lines
(fährt ab, hat abgefahren), page furniture and most example-sentence fragments.
Each level's file lists only the words new at that level.
"""
import re
import sys
from pathlib import Path

import pypdf

from build_data import CACHE, SRC, kaikki_index

LISTS = [('A1', 'A1_SD1_Wortliste_02', 6, 27), ('A2', 'Goethe-Zertifikat_A2_Wortliste', 5, 31),
         ('B1', 'Goethe-Zertifikat_B1_Wortliste', 8, 103)]
ARTICLE = re.compile(r'^(der|die|das)(?:/(?:der|die|das))*\s+([A-ZÄÖÜ][\wäöüßÄÖÜ-]*)')
WORD = re.compile(r"^[\wäöüßÄÖÜ'-]+")
# Names in the lists are mostly people and towns from the example sentences; keep countries and languages.
PLACES = {'Deutsch', 'Deutschland', 'Europa', 'Österreich', 'Schweiz', 'Finnland', 'Mexiko', 'Luxemburg', 'Latein', 'China',
          'Chinesisch', 'Griechenland', 'Türkisch', 'Ukrainisch', 'Indien', 'Englisch'}
JUNK = {'o', 'wusch'}
# Hidden by the PDF layout (the word-group pages) but on the A1 list.
EXTRA = {'A1': [('der', 'März', 'n'), ('', 'hundert', 'num'), ('', 'tausend', 'num'), ('', 'Indien', 'name'),
                ('', 'Englisch', 'name'), ('', 'schön', 'adj')]}


def headwords(lines, idx):
    """[(article, word, pos)] in list order; article is '' for non-nouns."""
    out = []
    for raw in lines:
        line = re.sub(r'\s+', ' ', raw.replace('\t', ' ')).strip()
        line = re.sub(r'^\(sich\)\s*', '', line)
        m = ARTICLE.match(line)
        if m:
            art, w = m[1], m[2].rstrip('-')
            if any(e['p'] == 'n' for e in idx.get(w, [])):
                out.append((art, w, 'n'))
            continue
        m = WORD.match(line)
        if not m:
            continue
        w = m[0].strip("-'")
        rest = line[m.end():].strip()
        if len(line.split()) <= 3 and line.endswith(('.', '?', '!')) and w[:1].islower():
            continue                                    # the tail of an example sentence
        poss = [e['p'] for e in idx.get(w, [])]
        if w[:1].isupper():                             # capitalised without article: names, interjections only
            if poss and not set(poss) & {'n', 'art', 'pron', 'conj', 'adv', 'prep', 'v', 'adj'}:
                out.append(('', w, poss[0]))
            continue
        if poss and rest[:1] not in ('-',):
            out.append(('', w, next((p for p in poss if p != 'name'), poss[0])))
    return out


def extract(pdf, first, last):
    r = pypdf.PdfReader(pdf)
    return [l for p in r.pages[first - 1:last] for l in p.extract_text().split('\n')]


def main():
    idx = kaikki_index()
    seen = set()
    for lv, name, first, last in LISTS:
        words = EXTRA.get(lv, []) + headwords(extract(CACHE / 'goethe' / f'{name}.pdf', first, last), idx)
        new = []
        for art, w, pos in words:
            if (pos == 'name' and w not in PLACES) or w in JUNK:
                continue
            if (w, pos) not in seen:
                seen.add((w, pos))
                new.append((art, w, pos))
        new.sort(key=lambda x: (x[1].lower(), x[1]))
        path = SRC / f'goethe-{lv}.tsv'
        path.write_text('article\tword\tpos\n' + ''.join(f'{a}\t{w}\t{p}\n' for a, w, p in new), encoding='utf-8', newline='\n')
        print(f'{lv}: {len(words)} headword lines, {len(new)} new words → {path.relative_to(SRC.parent.parent)}')


def test():
    idx = {'Tisch': [{'p': 'n'}], 'abfahren': [{'p': 'v'}], 'Hallo': [{'p': 'other'}], 'Frau': [{'p': 'n'}], 'machen': [{'p': 'v'}]}
    got = headwords(['der Tisch, -e Der Tisch ist neu.', 'abfahren, fährt ab, Wir fahren um zwölf ab.', 'fährt ab,',
                     'Hallo Hallo, wie geht es?', 'Frau Müller geht nach Hause.', 'machen.'], idx)
    assert got == [('der', 'Tisch', 'n'), ('', 'abfahren', 'v'), ('', 'Hallo', 'other')], got
    print('ok')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    test() if '--test' in sys.argv else main()
