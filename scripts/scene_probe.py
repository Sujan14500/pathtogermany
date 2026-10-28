"""Measure every picture scene's name boards in the browser, and screenshot the scenes.

usage:  python scripts/scene_probe.py [OUTDIR] [--w 1366]
        python scripts/scene_probe.py --self-test   adds a doubled and a stray board, checks the probe finds both
Opens #/pictures, where every scene is a still thumbnail (moving things at their rest place, as under reduced motion),
and measures each name board with the real font. Reports, per scene: boards that overlap (within one weather; moving
things only at rest), boards outside the picture, text wider than its board, a board covering most of another labelled
thing, labels that aren't course words, and fewer than 15 words. With OUTDIR it also saves every scene page, all names
shown, in light and dark: OUTDIR/<id>-light.png and <id>-dark.png (a weather scene: <id>-rain-dark.png …). Run scripts/build_data.py first. Exit code 1 on
any problem.
"""
import contextlib
import io
import json
import sys
import urllib.parse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from shot import run  # noqa: E402

PROBE = r'''(() => {
  const out = {}
  const meet = (a, b, m = 1) => Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > m && Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > m
  const together = (a, b) => !a.only || !b.only || a.only === b.only
  for (const svg of document.querySelectorAll('.scene-art[data-scene]')) {
    const id = svg.dataset.scene
    if (out[id]) continue
    const s = svg.getBoundingClientRect(), k = s.width / 1000
    const box = el => { const r = el.getBoundingClientRect(); return { x0: (r.left - s.left) / k, y0: (r.top - s.top) / k, x1: (r.right - s.left) / k, y1: (r.bottom - s.top) / k } }
    const problems = [], boards = []
    for (const g of svg.querySelectorAll('.sc-tags')) {
      const text = g.querySelector('text'), word = text.textContent.trim()
      const b = { ...box(g.querySelector('rect')), i: g.dataset.i, only: g.dataset.only || '', word }
      const t = box(text)
      if ('missing' in g.dataset) problems.push(`${word}: not a course word (lemma and article as in data/src/words-*.tsv)`)
      if (t.x1 - t.x0 > b.x1 - b.x0 - 2) problems.push(`${word}: the text is wider than its board`)
      if (b.x0 < -0.5 || b.y0 < -0.5 || b.x1 > 1000.5 || b.y1 > 620.5) problems.push(`${word}: the board sticks out of the picture (${Math.round(b.x0)}, ${Math.round(b.y0)} to ${Math.round(b.x1)}, ${Math.round(b.y1)})`)
      const look = svg.querySelector(`.sc-obj[data-i="${b.i}"] .sc-look`)
      b.thing = look && box(look)
      b.moves = g.classList.contains('mv')
      boards.push(b)
    }
    if (boards.length < 15) problems.push(`only ${boards.length} labelled words, needs 15 or more`)
    boards.forEach((a, n) => boards.slice(n + 1).forEach(b => {
      if (together(a, b) && meet(a, b)) problems.push(`${a.word} and ${b.word}: the boards overlap${a.moves || b.moves ? ' (a moving thing at rest)' : ''}`)
    }))
    for (const a of boards) for (const b of boards) {
      const t = b.thing
      if (a === b || !t || !together(a, b)) continue
      const area = (t.x1 - t.x0) * (t.y1 - t.y0)
      const cover = Math.max(0, Math.min(a.x1, t.x1) - Math.max(a.x0, t.x0)) * Math.max(0, Math.min(a.y1, t.y1) - Math.max(a.y0, t.y0))
      if (area > 0 && cover / area > 0.4) problems.push(`${a.word}: its board covers ${Math.round(cover / area * 100)}% of ${b.word}`)
    }
    const weathers = ['sun', 'rain', 'snow'].filter(x => svg.querySelector(`[data-only="${x}"]`))
    out[id] = { words: boards.length, problems, weathers }
  }
  return encodeURIComponent(JSON.stringify(out))
})()'''


# for --self-test: the first scene gets a copy of one still board on top of it and another far outside the picture
BREAK = """(() => {
  const svg = document.querySelector('.scene-art[data-scene]'), a = svg.querySelector('.sc-tags:not(.mv)')
  svg.append(a.cloneNode(true))
  const far = a.cloneNode(true)
  far.setAttribute('transform', 'translate(2000 0)')
  svg.append(far)
})(), """


def probe(w, js=PROBE):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        errors = run(None, '/pictures', w=w, probe=js)
    line = next((x for x in buf.getvalue().splitlines() if x.startswith('"')), '""')
    return json.loads(urllib.parse.unquote(line.strip('"')) or '{}'), errors


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    a = sys.argv[1:]
    w = int(a.pop(a.index('--w') + 1)) if '--w' in a else 1366
    a = [x for x in a if x != '--w']
    if '--self-test' in a:
        found, _ = probe(w, BREAK + PROBE)
        ps = next(iter(found.values()))['problems']
        assert any('overlap' in p for p in ps) and any('sticks out' in p for p in ps), ps
        sys.exit(print('scene_probe self-test: ok'))
    found, errors = probe(w)
    bad = len(errors)
    for sid, r in found.items():
        print(f'{sid}: {r["words"]} words, {len(r["problems"]) or "no"} problems')
        for p in r['problems']:
            print(f'  {p}')
        bad += len(r['problems'])
    print('\n'.join(errors))
    if not found:
        print('no scenes measured (is the bundle built?)')
        bad += 1
    if a:
        out = Path(a[0])
        out.mkdir(parents=True, exist_ok=True)
        for sid, r in found.items():
            for k, wx in enumerate(r['weathers'] or ['']):   # a weather scene: one shot per weather, picked in the panel
                for theme in ('light', 'dark'):
                    png = out / f'{sid}{"-" + wx if wx else ""}-{theme}.png'
                    errs = run(png, f'/pictures/{sid}', w=w, h=900, dark=theme == 'dark', clicks=[f'.scene-wx button:nth-child({k + 1})'] if k else [])
                    print(f'{png}: {len(errs)} errors', *errs, sep='\n  ' if errs else '')
                    bad += len(errs)
    sys.exit(1 if bad else 0)
