// ---- app shell ----

// '#/station/4/grammar' → { page: 'station', arg: '4', sub: 'grammar' }; '' or '#/' → home.
export function route(hash) {
  const [, page = '', arg, sub, sub2] = (hash || '#/').slice(1).split('/')
  return { page, arg, sub, sub2 }
}

// Every page lives in the URL hash, so it has its own address and Back/Forward move between pages.
// Each history entry keeps its scroll position (history.state.y): Back returns to where you were, a new page
// starts at the top, and a new tab of the same page (another station tab) keeps the place.
function useHash() {
  const [hash, setHash] = useState(location.hash || '#/')
  useEffect(() => {
    history.scrollRestoration = 'manual'
    let t, prev = location.hash || '#/'
    const page = h => h.split('/').slice(0, 3).join('/')
    const save = () => { clearTimeout(t); t = setTimeout(() => history.replaceState({ y: scrollY }, ''), 150) }
    const go = () => {
      clearTimeout(t)
      const h = location.hash || '#/'
      const y = history.state?.y ?? (page(h) === page(prev) ? scrollY : 0)
      prev = h
      setHash(h)
      setTimeout(() => { scrollTo(0, y); history.replaceState({ y }, '') })   // after Preact's (microtask) re-render
    }
    addEventListener('scroll', save, { passive: true })
    addEventListener('hashchange', go)
    return () => { removeEventListener('scroll', save); removeEventListener('hashchange', go) }
  }, [])
  return hash
}

function prepare(levels, words, grammar, drills, reading, listening, writing, speaking, scenes, sounds) {
  const stations = [null]                // stations[n], n = 1…36 across the levels
  levels.forEach(lv => stations.push(...lv.stations))
  words.sort((a, b) => a.n - b.n)        // stable: a station's words keep their written order
  const by = xs => { const out = stations.map(() => []); xs.forEach(x => out[x.n]?.push(x)); return out }
  const study = xs => xs.filter(x => x.pool !== 'exam')   // "pool": "exam" items are kept for tests and mocks (85-tests.js)
  const verbSet = new Set(words.filter(w => w.p === 'v').map(w => w.w))
  const gq = {}
  drills.gq.forEach(q => (gq[q.g] ??= []).push(q))
  D = { levels, level: Object.fromEntries(levels.map(lv => [lv.level, lv])), stations, words, wordsBy: by(words), verbSet,
    grammar, grammarBy: by(grammar), gq, vq: drills.vq ?? [], reading, readingBy: by(study(reading)), listening, listeningBy: by(study(listening)),
    writing, writingBy: by(writing), speaking, speakingBy: by(speaking), scenes, sounds }
  return D
}

// WegNachDeutschland.html (scripts/bundle.py) carries the data inline as window.__DATA, so it opens from a file.
const getJson = (name, fallback) => window.__DATA ? Promise.resolve(window.__DATA[name] ?? fallback) : fetch(`data/${name}.json`).then(r => {
  if (r.ok) return r.json()
  if (fallback !== undefined) return fallback
  throw new Error(`data/${name}.json: HTTP ${r.status}`)
}, e => { if (fallback !== undefined) return fallback; throw e })

function App() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const hash = useHash()
  useEffect(() => {
    Promise.all([getJson('syllabus'), getJson('words', []), getJson('grammar', []), getJson('drills', { gq: [], vq: [] }), getJson('reading', []),
      getJson('listening', []), getJson('writing', []), getJson('speaking', []), getJson('scenes', []), getJson('sounds', [])])
      .then(args => setData(prepare(...args))).catch(e => setError(e.message))
    navigator.storage?.persist?.()
  }, [])
  if (error) return html`<main class="empty"><p>The lessons didn't load (${error}). Run <code>python scripts/build_data.py</code>,
    then open <code>app/WegNachDeutschland.html</code>.</p></main>`
  if (!data) return html`<main class="empty"><p>Loading…</p></main>`
  const { page, arg, sub, sub2 } = route(hash)
  const Page = Object.hasOwn(PAGES, page) && PAGES[page]   // PAGES (00-core.js) is filled in by each page's own fragment
  const view = Page ? html`<${Page} data=${data} arg=${arg} sub=${sub} sub2=${sub2} hash=${hash} />`
    : page === 'station' ? html`<${Station} data=${data} n=${Number(arg)} tab=${sub} />`
    : page === 'tests' ? html`<${Soon} title="Practice tests" text="Numbered tests per level and module: Lesen, Hören, Schreiben, Sprechen, Wortschatz, Grammatik." />`
    : page === 'mock' ? html`<${Soon} title="Mock exam" text="A timed paper per level in the real Goethe structure, scored the Goethe way." />`
    : page === 'pictures' ? html`<${Soon} title="Picture scenes" text="Drawn scenes where every object is a word with its article." />`
    : page === 'sounds' ? html`<${Soon} title="Pronunciation" text="A sound guide for ü, ö, ä, ch and r, and minimal-pair listening." />`
    : html`<${Home} data=${data} />`
  return html`<${Backdrop} data=${data} page=${page} /><${TopBar} data=${data} page=${page} />${view}<${LeaveExport} />`
}

render(html`<${App} />`, document.getElementById('app'))
// Offline use and "install" when served over http(s); a file:// page can't have a service worker.
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js')
