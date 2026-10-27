"""Bundle the app into one HTML file that opens straight from disk (no server).

usage:  python scripts/bundle.py      (build_data.py also runs it at the end)
writes: app/WegNachDeutschland.html

Browsers refuse ES module files and fetch() on file:// pages, so the vendored modules become plain
scripts, main.js's imports become references to them, and the JSON data is inlined as window.__DATA.
The file sits in app/ so relative paths such as audio/… still resolve.
"""
import json
import re
import sys
from pathlib import Path

APP = Path(__file__).resolve().parent.parent / 'app'


def module_to_object(src):
    """`…code… export{a as h,b};` → `(() => { …code…; return {h: a, b: b} })()`"""
    m = re.search(r'export\s*\{([^}]*)\}\s*;?\s*(//[^\n]*)?\s*$', src)
    if not m:
        raise ValueError('expected one trailing export { … } statement')
    pairs = []
    for item in m[1].split(','):
        item = item.strip()
        if item:
            local, _, public = item.partition(' as ')
            pairs.append(f'{(public or local).strip()}: {local.strip()}')
    body = src[:m.start()]
    if re.search(r'^\s*(import|export)\b', body, re.M):
        raise ValueError('module has other import/export statements')
    return '(() => {\n' + body + '\nreturn {' + ', '.join(pairs) + '}\n})()'


def main_script(src, names):
    """Replace `import { a, b } from './vendor/x.js'` with `const { a, b } = <global for x>` and drop `export`."""
    def imp(m):
        return f'const {{{m[1]}}} = {names[m[2]]}'
    src = re.sub(r"^import\s*\{([^}]*)\}\s*from\s*'\./vendor/([^']+)'", imp, src, flags=re.M)
    src = re.sub(r'^export\s+(?=function|const|async)', '', src, flags=re.M)
    if re.search(r'^\s*(import|export)\b', src, re.M):
        raise ValueError('main.js has an import/export the bundler does not understand')
    return src


def safe(js):
    return js.replace('</script', '<\\/script')


def bundle():
    html = (APP / 'index.html').read_text(encoding='utf-8')
    vendors = sorted(p.name for p in (APP / 'vendor').glob('*.js'))
    names = {v: f'__vendor{i}' for i, v in enumerate(vendors)}
    parts = [f'const {names[v]} = {module_to_object((APP / "vendor" / v).read_text(encoding="utf-8"))};' for v in vendors]
    data = {p.stem: json.loads(p.read_text(encoding='utf-8')) for p in sorted((APP / 'data').glob('*.json'))}
    parts.insert(0, 'window.__DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';')
    parts.append(main_script((APP / 'main.js').read_text(encoding='utf-8'), names))
    css = (APP / 'style.css').read_text(encoding='utf-8')

    html = html.replace('<link rel="stylesheet" href="style.css">', f'<style>\n{css}\n</style>')
    html = re.sub(r'<link rel="manifest"[^>]*>\n?', '', html)     # no install/offline worker from a file
    html = html.replace('<script type="module" src="main.js"></script>',
                        '<script>\n' + safe('\n'.join(parts)) + '\n</script>')
    if 'src="main.js"' in html or 'href="style.css"' in html:
        raise ValueError('index.html changed shape; update bundle.py')
    out = APP / 'WegNachDeutschland.html'
    out.write_text(html, encoding='utf-8', newline='\n')
    return out


if __name__ == '__main__':
    out = bundle()
    print(f'{out.relative_to(APP.parent)}: {out.stat().st_size // 1024} KB')
    sys.exit(0)
