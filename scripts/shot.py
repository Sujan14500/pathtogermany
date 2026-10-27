"""Screenshot the bundled app in headless Chrome and print its console errors.

usage:  python scripts/shot.py OUT.png [ROUTE] [--w 1500] [--h 1000] [--dark|--light] [--click CSS]… [--eval JS]
        python scripts/shot.py --smoke [--w 400] [ROUTE …]  open each route (default: all) in turn; print errors
                                                            per route, a missing <main> and sideways overflow
ROUTE is the part after '#', e.g. /station/4/grammar. The app runs in an iframe of app/_shot.html (deleted
afterwards), so phone widths below Chrome's 500 px window minimum work and clicks can be scripted.
--eval runs JS in the app's window after the clicks and prints its JSON result.
Exit code 1 when anything was logged as an error.
"""
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

CHROME = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
APP = Path(__file__).resolve().parent.parent / 'app'
HARNESS = '''<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;background:#777}iframe{display:block;border:0;width:%(w)dpx;height:%(h)dpx}</style>
<iframe id="f" src="WegNachDeutschland.html#%(route)s"></iframe>
<script>
const f = document.getElementById('f'), clicks = %(clicks)s, routes = %(routes)s, probe = %(probe)s
let i = 0, k = 0
const click = () => {
  if (i >= clicks.length) return probe && console.log('shot: eval ' + JSON.stringify(f.contentWindow.eval(probe)))
  const sel = clicks[i++], el = f.contentDocument.querySelector(sel)
  if (el) el.click(); else console.error('shot: nothing matches ' + sel)
  setTimeout(click, 700)
}
const visit = () => {
  const d = f.contentDocument, el = d.documentElement
  if (k && !d.querySelector('main')) console.log('shot: console.error no <main>')
  if (k && el.scrollWidth > el.clientWidth) console.log(`shot: console.error page is ${el.scrollWidth}px wide in ${el.clientWidth}px`)
  if (k >= routes.length) return console.log('shot: done')
  console.log('shot: route ' + routes[k])
  f.contentWindow.location.hash = routes[k++]
  setTimeout(visit, 350)
}
f.onload = () => {   // console.error and log share a log level, so tag errors (earlier ones still show as Uncaught)
  const w = f.contentWindow, ce = w.console.error
  w.console.error = (...a) => { console.log('shot: console.error ' + a.join(' ')); ce.apply(w.console, a) }
  setTimeout(routes.length ? visit : click, 900)
}
</script>'''


def all_routes():
    """Every page the app has, so the smoke test opens each one."""
    levels = json.loads((APP / 'data/syllabus.json').read_text(encoding='utf-8'))
    n = sum(len(lv['stations']) for lv in levels)
    tabs = ['words', 'grammar', 'read', 'listen', 'write', 'speak', 'pictures', 'test']
    pages = ['/', '/study', '/practice', '/tests', '/mock', '/pictures', '/verbs', '/gender', '/cases', '/sounds', '/tips/0', '/station/99']
    return pages + [f'/station/{i}/{t}' for i in range(1, n + 1) for t in tabs]


def run(out, route='/', w=1500, h=1000, dark=False, clicks=(), routes=(), probe=''):
    harness = APP / '_shot.html'
    harness.write_text(HARNESS % dict(w=w, h=h, route=route, clicks=json.dumps(list(clicks)), routes=json.dumps(list(routes)), probe=json.dumps(probe)),
                       encoding='utf-8')
    budget = 2500 + 700 * len(clicks) + 350 * len(routes) + (10000 if probe else 0)   # probes may wait on timers
    args = [CHROME, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--allow-file-access-from-files',
            f'--user-data-dir={tempfile.mkdtemp(prefix="shot-")}', f'--window-size={max(w, 500)},{h}',
            f'--virtual-time-budget={budget}', '--enable-logging=stderr', '--v=0']
    # the Windows theme leaks into headless Chrome, so pick the scheme explicitly (Blink: 0 dark, 1 light)
    args.append(f'--blink-settings=preferredColorScheme={0 if dark else 1}')
    args += [f'--screenshot={Path(out).resolve()}' if out else '--dump-dom', harness.as_uri()]
    try:
        p = subprocess.run(args, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=180)
    finally:
        harness.unlink(missing_ok=True)
    errors, current, seen = [], route, set()
    for line in p.stderr.splitlines():
        m = re.search(r'CONSOLE[:(]\d+\)?\] "(.*)", source: (\S*)', line)
        if not m:
            continue
        msg = m[1]
        if msg.startswith('shot: route '):
            current = msg[12:]
            seen.add(current)
        elif msg.startswith('shot: eval '):
            print(msg[11:].encode().decode('unicode_escape'))
        elif msg.startswith(('Uncaught', 'shot: nothing', 'shot: console.error')):
            errors.append(f'{current}: {msg}')
    if routes and len(seen) < len(set(routes)):
        errors.append(f'only {len(seen)} of {len(set(routes))} routes were opened (raise the time budget)')
    return errors


if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    a = sys.argv[1:]
    opt = lambda name, default: (a.pop(a.index(name) + 1), a.remove(name))[0] if name in a else default
    if '--smoke' in a:
        a.remove('--smoke')
        w = int(opt('--w', 1500))
        a = a or all_routes()
        errs = run(None, w=w, routes=a)
        print(f'{len(a)} routes, {len(errs)} errors')
    else:
        w, h, dark = int(opt('--w', 1500)), int(opt('--h', 1000)), '--dark' in a
        clicks = []
        while '--click' in a:
            clicks.append(opt('--click', None))
        probe = opt('--eval', '')
        a = [x for x in a if x not in ('--dark', '--light')]
        errs = run(a[0], a[1] if len(a) > 1 else '/', w, h, dark, clicks, probe=probe)
        print(f'{a[0]}: {len(errs)} errors')
    print('\n'.join(errs))
    sys.exit(1 if errs else 0)
