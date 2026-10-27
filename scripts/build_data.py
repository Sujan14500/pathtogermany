"""Build app/data/*.json from data/src, then bundle app/WegNachDeutschland.html.

usage:  python scripts/build_data.py          build the JSON and the bundle
        python scripts/build_data.py --test   run the self-checks

Inputs:  data/src/syllabus.json    levels → stations (German and English title, can-do line, grammar points)
Writes:  app/data/syllabus.json, app/WegNachDeutschland.html (via bundle.py)
"""
import json
import sys
from pathlib import Path

from bundle import bundle

ROOT = Path(__file__).resolve().parent.parent
SRC, OUT = ROOT / 'data/src', ROOT / 'app/data'
STATIONS_PER_LEVEL = 12


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
    print('ok')


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    test() if '--test' in sys.argv else main()
