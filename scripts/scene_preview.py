"""Render one picture scene (data/src/scenes-*.json) to a PNG, with every name board shown, to check the drawing.

usage:  python scripts/scene_preview.py data/src/scenes-1.json stadt out.png [--weather rain]
Moving things are drawn at their start position. Uses headless Chrome; the temporary HTML goes next to the PNG.
"""
import html
import json
import subprocess
import sys
import tempfile
from pathlib import Path

CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
COLOUR = {'der': '#1D5BD6', 'die': '#C62F28', 'das': '#16804A', 'pl': '#636978'}


def render(scene, weather=None):
    parts = [f'<rect width="1000" height="620" fill="{scene["sky"]}"/>', scene['back']]
    labels = []
    for o in scene['objs']:
        if o.get('only') and weather and o['only'] != weather:
            continue
        x, y = o.get('at', [0, 0])
        if o.get('mv'):
            x += o['mv'][0] if o.get('move') in ('drive', 'pass') else 0
            y += o['mv'][0] if o.get('move') == 'fall' else 0
        parts.append(f'<g transform="translate({x} {y})">{o["svg"]}</g>')
        if o.get('w'):
            art = o.get('a') or ''
            text = f'{"die" if art == "pl" else art} {o["w"]}'.strip()
            w = len(text) * 11 + 22
            tx, ty = x + o['tag'][0], y + o['tag'][1]
            lead = ''
            if o.get('pin'):
                px, py = x + o['pin'][0], y + o['pin'][1]
                lead = f'<path d="M{tx} {ty - 15} L{px} {py}" stroke="#333" stroke-width="1.5"/><circle cx="{px}" cy="{py}" r="4" fill="#333"/>'
            labels.append(f'{lead}<rect x="{tx - w / 2}" y="{ty - 30}" width="{w}" height="30" rx="6" fill="#fff" stroke="#999"/>'
                          f'<text x="{tx}" y="{ty - 10}" text-anchor="middle" font="600 17px sans-serif" font-family="Segoe UI" font-size="17" font-weight="700">'
                          f'<tspan fill="{COLOUR.get(art, "#333")}">{html.escape(art if art != "pl" else "die")}</tspan> {html.escape(o["w"])}</text>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 620" width="1000" height="620">{"".join(parts)}{"".join(labels)}</svg>'


def main(src, scene_id, out, weather=None):
    scenes = json.loads(Path(src).read_text(encoding='utf-8'))
    scene = next(s for s in scenes if s['id'] == scene_id)
    out = Path(out).resolve()
    page = out.with_suffix('.html')
    page.write_text(f'<!doctype html><meta charset="utf-8"><body style="margin:0">{render(scene, weather)}</body>', encoding='utf-8')
    subprocess.run([CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', f'--user-data-dir={tempfile.mkdtemp()}',
                    '--window-size=1000,620', f'--screenshot={out}', page.as_uri()], capture_output=True, timeout=120)
    print(out)


if __name__ == '__main__':
    a = sys.argv[1:]
    weather = a[a.index('--weather') + 1] if '--weather' in a else None
    main(*a[:3], weather=weather)
