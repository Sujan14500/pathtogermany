// Path to Germany: German from A1 to B1 for the Goethe-Zertifikat, taught through English.
// No build step: one ES module with vendored Preact + htm. scripts/bundle.py makes the single-file version.
import { html, render, useState, useEffect } from './vendor/htm-preact-3.1.1.js'

const KEY = 'pathtogermany:v1'
const today = () => new Date().toLocaleDateString('en-CA')
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const pct = p => `${Math.round(p * 100)}%`

// ---- progress: one JSON blob in localStorage, backed up by export/import ----

const fresh = () => ({
  cards: {}, log: [], lesson: 1, newPerDay: 15, autoplay: true, newToday: { date: today(), n: 0 },
  tests: {}, practice: {}, drafts: {}, settings: {},
})
function load() {
  try { return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY)) } } catch { return fresh() }
}
let S = load()
const listeners = new Set()
function commit(change) {
  change(S)
  try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (e) {
    alert(`Progress wasn't saved (${e.message}). Export a backup from Settings before closing this tab.`)
  }
  listeners.forEach(f => f())
}
function useStore() {
  const [, bump] = useState(0)
  useEffect(() => { const f = () => bump(n => n + 1); listeners.add(f); return () => listeners.delete(f) }, [])
  return S
}

function exportProgress() {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }))
  a.download = `pathtogermany-progress-${today()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

async function importProgress(file) {
  try {
    const data = JSON.parse(await file.text())
    if (!data || typeof data.cards !== 'object' || !Array.isArray(data.log)) throw new Error("this isn't a Path to Germany backup")
    const ok = confirm(`Replace your current progress (${Object.keys(S.cards).length} cards) with this backup (${Object.keys(data.cards).length} cards)?`)
    if (ok) commit(s => { for (const k of Object.keys(s)) delete s[k]; Object.assign(s, fresh(), data) })
  } catch (e) {
    alert(`Import failed: ${e.message}`)
  }
}

// ---- stations and how far each one is done ----

const TABS = [['words', 'Words'], ['grammar', 'Grammar'], ['read', 'Read'], ['listen', 'Listen'], ['write', 'Write'],
  ['speak', 'Speak'], ['pictures', 'Pictures'], ['test', 'Test']]
const TAB_NAME = Object.fromEntries(TABS)
const PARTS = ['words', 'grammar', 'read', 'listen', 'write', 'speak', 'test']   // a station's parts in study order

// 0…1 per part: each part keeps its best result in S.practice under "<station>/<part>".
const partDone = (n, part) => S.practice[`${n}/${part}`] ?? 0
const stationDone = n => PARTS.reduce((a, p) => a + partDone(n, p), 0) / PARTS.length
const levelDone = lv => lv.stations.reduce((a, st) => a + stationDone(st.n), 0) / lv.stations.length
const here = data => data.stations[S.lesson] ?? data.stations[1]

// What to do at a part, said once for the plan rail and once for the next-step sentence.
const STEP = {
  words: [() => 'Start with the words of this station, each noun with its article, plural and sound.', 'Open the words'],
  grammar: [st => html`Now the grammar, starting with <b>${st.grammar[0][1]}</b>.`, 'Open the grammar'],
  read: [() => 'Read a short text and answer questions in the Lesen format.', 'Start reading'],
  listen: [() => 'Listen to everyday dialogues and announcements, as in the Hören module.', 'Start listening'],
  write: [() => 'Write a short exam task and check it against the rubric.', 'Start writing'],
  speak: [() => 'Speak an exam task out loud, with a timer and a recording.', 'Start speaking'],
  test: [() => 'Take the station test. 60% passes.', 'Take the test'],
}

function todayPlan(st) {
  return PARTS.map(part => {
    const p = partDone(st.n, part)
    return { part, label: TAB_NAME[part], href: `#/station/${st.n}/${part}`, p, state: p >= 1 ? 'done' : p > 0 ? 'part' : 'todo' }
  })
}

// ---- small drawn pieces ----

const Train = () => html`<svg class="train" viewBox="0 0 40 20" aria-hidden="true">
  <path d="M2 16V7a4 4 0 0 1 4-4h20c6 0 11 5 12 11v2z" fill="var(--ink)" />
  <path d="M8 6h6v4H8zM17 6h6v4h-6z" fill="var(--panel)" /><path d="M27 6c3 .5 6 2.5 7.5 5H27z" fill="var(--panel)" />
  <path d="M2 13h36" stroke="var(--line)" stroke-width="2" />
</svg>`

const Arrow = () => html`<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>`

const Mark = () => html`<svg class="mark" viewBox="0 0 40 40" aria-hidden="true">
  <rect width="40" height="40" rx="6" fill="var(--board)" />
  <path d="M8 28 L16 20 H24 L32 12" fill="none" stroke="var(--a1)" stroke-width="4" stroke-linecap="round" />
  <circle cx="8" cy="28" r="3.5" fill="#fff" /><circle cx="20" cy="20" r="3.5" fill="#fff" /><circle cx="32" cy="12" r="3.5" fill="#fff" />
</svg>`

// Progress as a ring, the way a line's completion is drawn.
const Ring = ({ p, label }) => html`<svg class="ring" viewBox="0 0 120 120" role="img" aria-label=${`${pct(p)} ${label}`}>
  <circle cx="60" cy="60" r="50" class="ring-track" />${p > 0 ? html`<circle cx="60" cy="60" r="50" class="ring-fill" style=${`--p:${p}`} pathLength="1" />` : ''}
  <text x="60" y="64" class="ring-n">${pct(p)}</text><text x="60" y="84" class="ring-l">${label}</text>
</svg>`

// Practice tile icons (48 × 48, drawn in the tile's colour; the gender one uses the gender code itself).
const ICONS = {
  sheet: html`<rect x="9" y="5" width="30" height="38" rx="4" fill="none" stroke="currentColor" stroke-width="3" />
    ${[14, 22, 30].map((y, i) => html`<circle cx="17" cy=${y} r="3.2" fill=${i === 1 ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" /><path d=${`M24 ${y} H33`} stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />`)}`,
  stamp: html`<g transform="rotate(-12 24 24)"><circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-width="3" />
    <circle cx="24" cy="24" r="13.5" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M16.5 24.5l5 5 10-11" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" /></g>`,
  scene: html`<circle cx="34" cy="13" r="6" fill="currentColor" /><path d="M3 40 Q16 24 26 34 T45 30 V44 H3 Z" fill="currentColor" opacity=".55" />
    <rect x="13" y="22" width="4" height="12" fill="currentColor" /><circle cx="15" cy="20" r="7" fill="currentColor" />`,
  verb: html`<rect x="2" y="13" width="19" height="22" rx="4" fill="none" stroke="currentColor" stroke-width="3" />
    <text x="11.5" y="29" text-anchor="middle" class="icon-t">en</text>
    <path d="M23 24 H28 M25.5 20.5 L29 24 L25.5 27.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
    <rect x="31" y="13" width="15" height="22" rx="4" fill="currentColor" /><text x="38.5" y="29" text-anchor="middle" class="icon-t inv">t</text>`,
  gender: html`<rect x="4" y="8" width="40" height="8" rx="4" fill="var(--der)" /><rect x="4" y="20" width="30" height="8" rx="4" fill="var(--die)" />
    <rect x="4" y="32" width="36" height="8" rx="4" fill="var(--das)" />`,
  cases: html`${[[5, 5], [26, 5], [5, 26], [26, 26]].map(([x, y], i) => html`<rect x=${x} y=${y} width="17" height="17" rx="3"
    fill=${i === 2 ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="3" />`)}`,
  sounds: html`<text x="17" y="36" text-anchor="middle" class="icon-t big">ü</text>
    <path d="M33 16a12 12 0 0 1 0 17M38.5 11a19 19 0 0 1 0 27" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />`,
  tip: html`<path d="M24 6 a12 12 0 0 1 7 21.7 V33 H17 V27.7 A12 12 0 0 1 24 6 Z" fill="none" stroke="currentColor" stroke-width="3" />
    <path d="M18 38 H30 M20 43 H28" stroke="currentColor" stroke-width="3" stroke-linecap="round" />`,
}
const TOOLS = [
  { href: '#/tests', en: 'Practice tests', hint: 'Numbered tests for every exam module', icon: 'sheet' },
  { href: '#/mock', en: 'Mock exam', hint: 'A timed paper, scored like Goethe', icon: 'stamp' },
  { href: '#/pictures', en: 'Picture scenes', hint: 'Tap, find and name things', icon: 'scene' },
  { href: '#/verbs', en: 'Verb forms', hint: 'Präsens to Perfekt, with real mistakes', icon: 'verb' },
  { href: '#/gender', en: 'der, die, das', hint: 'Genders and plurals by their endings', icon: 'gender' },
  { href: '#/cases', en: 'Cases and endings', hint: 'den, dem, des and adjective endings', icon: 'cases' },
  { href: '#/sounds', en: 'Pronunciation', hint: 'ü, ö, ch and r, with minimal pairs', icon: 'sounds' },
  { href: '#/tips/0', en: 'Tips', hint: 'Learn faster, pass the exam', icon: 'tip' },
]
const Tiles = () => html`<ul class="tiles">${TOOLS.map(t => html`<li>
  <a class="tile" href=${t.href}><svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">${ICONS[t.icon]}</svg>
    <b>${t.en}</b><small>${t.hint}</small></a></li>`)}</ul>`

// ---- the station name board: the chapter's name, big, on the line's coloured band ----

function Board({ data, n, home }) {
  const st = data.stations[n]
  const lv = data.level[st.level]
  const prev = data.stations[n - 1], next = data.stations[n + 1]
  const name = html`<span lang="de">${st.de}</span>`
  return html`<section class=${`board l${st.level}`} aria-label=${`Station ${st.k} of ${st.level}: ${st.en}`}>
    <div class="board-body">
      <div class="board-top">
        <span class="gleis" aria-hidden="true">${st.k}</span><span class="gleis-l">Station<b>${st.k} of ${lv.stations.length}</b></span>
        <span class="lb">${st.level}</span>
      </div>
      <div>
        <h1 class="board-name">${home ? html`<a href=${`#/station/${n}`}>${name}</a>` : name}</h1>
        <p class="board-sub">${st.en} · ${st.can}</p>
      </div>
    </div>
    <nav class="band" aria-label="Neighbouring stations">
      ${prev ? html`<a class="band-prev" href=${`#/station/${prev.n}`}>← <span lang="de">${prev.de}</span></a>` : html`<span></span>`}
      <ol class="band-dots">${lv.stations.map(x => html`<li class=${x.n === n ? 'on' : x.n < n ? 'past' : ''}>
        <a href=${`#/station/${x.n}`} aria-label=${`Station ${x.k}: ${x.de}`} title=${x.de}></a></li>`)}</ol>
      ${next ? html`<a class="band-next" href=${`#/station/${next.n}`}><span lang="de">${next.de}</span> →</a>` : html`<span></span>`}
    </nav>
  </section>`
}

// ---- the route: three lines (A1, A2, B1), twelve stations each, split into two halves ----

function RouteMap({ data, picked, onPick }) {
  const s = useStore()
  return html`<section class="route" aria-labelledby="route-h">
    <div class="route-head">
      <h2 id="route-h">Your route</h2>
      <ul class="legend" aria-label="Station key">
        <li><span class="rdot key done"></span> Done</li><li><span class="rdot key started"></span> Started</li>
        <li><span class="rdot key"></span> Not started</li><li><${Train} /> You are here</li>
      </ul>
    </div>
    ${data.levels.map(lv => {
      const on = here(data).level === lv.level
      const halves = [lv.stations.slice(0, 6), lv.stations.slice(6)]
      const pickedHere = lv.stations.find(st => st.n === picked)
      return html`<div class=${`rline l${lv.level}${on ? ' current' : ''}`}>
        <header class="rline-head">
          <span class="lb big">${lv.level}</span>
          <div class="rline-title"><h3>${lv.title}</h3><p>${on ? html`<b>You are on this line.</b> ` : ''}${pct(levelDone(lv))} done</p></div>
          <span class="pbar"><i style=${`--p:${levelDone(lv)}`}></i></span>
        </header>
        <div class="halves">${halves.map((half, h) => html`<div class="half">
          <span class="half-name">${lv.level}.${h + 1}</span>
          <ol class="rstations">${half.map(st => {
            const p = stationDone(st.n)
            const where = st.n === s.lesson ? ' at' : st.n < s.lesson ? ' passed' : ''
            return html`<li key=${st.n} class=${`rstn${p >= 1 ? ' done' : p > 0 ? ' started' : ''}${where}${picked === st.n ? ' picked' : ''}`} style=${`--p:${p}`}>
              ${st.n === s.lesson ? html`<${Train} />` : ''}
              <button type="button" onClick=${() => onPick(st.n)} aria-pressed=${picked === st.n}
                aria-label=${`Station ${st.k}, ${st.de} (${st.en}), ${pct(p)} done`}>
                <span class="rdot"></span><span class="rnum">${st.k}</span><span class="rname" lang="de">${st.de}</span>
              </button>
            </li>`
          })}</ol>
        </div>`)}</div>
        ${pickedHere ? html`<${StationCard} data=${data} n=${picked} onClose=${() => onPick(picked)} />` : ''}
      </div>`
    })}
  </section>`
}

// What a station holds, part by part, with a way into each.
function StationCard({ data, n, onClose }) {
  const s = useStore()
  const st = data.stations[n]
  return html`<section class=${`scard l${st.level}`} aria-label=${`${st.de} details`}>
    <div class="scard-head">
      <span class="lb">${st.level} · ${st.k}</span>
      <div class="scard-title"><h3 lang="de">${st.de}</h3><p>${st.en}: ${st.can}.</p></div>
      <div class="scard-actions">
        ${n === s.lesson ? html`<span class="you">Your current stop</span>`
          : html`<button type="button" onClick=${() => commit(x => { x.lesson = n })}>Make this my current stop</button>`}
        <a class="btn" href=${`#/station/${n}`}>Open station <${Arrow} /></a>
        <button type="button" class="close" onClick=${onClose} aria-label="Close">×</button>
      </div>
    </div>
    <ul class="scard-parts">${PARTS.map(part => html`<li>
      <a href=${`#/station/${n}/${part}`}>${TAB_NAME[part]}</a>
      <span class="pbar"><i style=${`--p:${partDone(n, part)}`}></i></span>
    </li>`)}</ul>
    <p class="scard-grammar"><b>Grammar:</b> ${st.grammar.map(([, t]) => t).join(' · ')}</p>
  </section>`
}

// ---- top bar and home ----

function TopBar({ data, page }) {
  const s = useStore()
  const st = here(data)
  const links = [['', 'Today'], ['study', 'Cards'], ['practice', 'Practice'], ['tests', 'Tests'], ['mock', 'Mock exam'], ['pictures', 'Pictures']]
  const on = p => (p === '' ? !page : page === p)
  return html`<header class=${`topbar l${st.level}`}>
    <a class="brand" href="#/"><${Mark} /><span class="brand-name"><b lang="de">Weg nach Deutschland</b><small>Path to Germany</small></span></a>
    <nav class="topnav" aria-label="Main"><ul>${links.map(([p, label]) => html`<li>
      <a href=${`#/${p}`} class=${on(p) ? 'on' : ''} aria-current=${on(p) ? 'page' : null}>${label}</a></li>`)}</ul></nav>
    <a class="tb-stop" href=${`#/station/${s.lesson}`} title="Your current stop"><span class="lb">${st.level}</span>
      <span><span class="tb-stop-k">${String(st.k).padStart(2, '0')}</span> <span lang="de">${st.de}</span></span></a>
  </header>`
}

function Home({ data }) {
  const s = useStore()
  const [picked, setPicked] = useState(null)
  const st = here(data)
  const lv = data.level[st.level]
  const plan = todayPlan(st)
  const step = plan.find(p => p.state !== 'done')
  const next = data.stations[st.n + 1]
  const pick = n => {
    setPicked(n === picked ? null : n)
    setTimeout(() => document.querySelector('.scard')?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' }), 50)
  }
  return html`<main class="home">
    <p class="welcome"><span lang="de">Liebe Sneka, willkommen!</span><small>Dear Sneka, welcome!</small></p>
    <section class=${`hero l${st.level}`} aria-label="Today">
      <${Board} data=${data} n=${st.n} home />
      <div class="go">
        <${Ring} p=${levelDone(lv)} label=${`of ${lv.level} done`} />
        <div class="go-text">
          ${step ? html`<p class="next-text">${STEP[step.part][0](st)}</p>
              <a class="btn big" href=${step.href}>${STEP[step.part][1]} <${Arrow} /></a>`
            : next ? html`<p class="next-text">Every part of <span lang="de">${st.de}</span> is done. Move on to the next station.</p>
              <button type="button" class="btn big" onClick=${() => commit(x => { x.lesson = next.n })}>Move on to <span lang="de">${next.de}</span> <${Arrow} /></button>`
            : html`<p class="next-text">Every station is done. Take the B1 mock exam until it passes every time.</p>
              <a class="btn big" href="#/mock/B1/full">Take the B1 mock exam <${Arrow} /></a>`}
          <p class="quiet">${plural(lv.stations.filter(x => stationDone(x.n) >= 1).length, 'station')} of ${lv.stations.length} done on the ${lv.level} line</p>
        </div>
      </div>
      <ol class="plan" aria-label="Today's plan at this station">${plan.map(p => html`<li class=${`${p.state}${p === step ? ' now' : ''}`}>
        <a href=${p.href}><span class="pdot" style=${`--p:${p.p}`}></span><b>${p.label}</b><small>${p.state === 'done' ? 'done' : p.state === 'part' ? pct(p.p) : p === step ? 'next' : ''}</small></a>
      </li>`)}</ol>
    </section>

    <section class="practice" aria-labelledby="practice-h">
      <h2 id="practice-h">Practice</h2>
      <${Tiles} />
    </section>

    <${RouteMap} data=${data} picked=${picked} onPick=${pick} />
    <${Settings} />
  </main>`
}

function Settings() {
  const s = useStore()
  return html`<details class="settings">
    <summary>Settings and backup</summary>
    <label>New cards per day
      <input type="number" min="0" max="200" value=${s.newPerDay}
        onChange=${e => commit(x => { x.newPerDay = Math.max(0, Math.min(200, +e.target.value || 0)) })} />
    </label>
    <label class="check"><input type="checkbox" checked=${s.autoplay} onChange=${e => commit(x => { x.autoplay = e.target.checked })} />
      Say each word aloud when its card turns over</label>
    <p>Progress is kept in this browser only. The double-clicked file and a served copy (http://) keep separate progress,
      so export a backup now and then and import it wherever you study.</p>
    <div class="settings-row">
      <button type="button" onClick=${exportProgress}>Export progress</button>
      <label class="button">Import progress<input type="file" accept="application/json,.json" hidden
        onChange=${e => { const f = e.target.files[0]; e.target.value = ''; if (f) importProgress(f) }} /></label>
    </div>
  </details>`
}

// ---- station page: one tab per part, each tab its own address ----

const SOON = {
  words: "This station's words, each noun with its article and plural, audio and a quick quiz.",
  grammar: 'Each point with a plain-English explanation, examples lined up with English, and a sentence builder.',
  read: 'An original text in the Goethe Lesen format, with tap-to-translate and exam questions.',
  listen: 'Dialogues and announcements read by German voices, with Hören-style questions.',
  write: 'An exam writing task with a checklist, word count, useful phrases and a model answer.',
  speak: 'An exam speaking task with timers, recording and a model answer.',
  pictures: 'A drawn scene where every object is a word of this station.',
  test: 'A short station test in exam formats. 60% passes.',
}

function Station({ data, n, tab }) {
  const s = useStore()
  const st = data.stations[n]
  if (!st) return html`<main class="empty"><p>There is no station ${n}. <a href="#/">Back to today</a></p></main>`
  const t = TAB_NAME[tab] ? tab : 'words'
  return html`<main class=${`station l${st.level}`}>
    <${Board} data=${data} n=${n} />
    <div class="station-bar">
      <nav class="tabs" aria-label="Station parts">${TABS.map(([id, label]) => html`<a href=${`#/station/${n}/${id}`}
        class=${id === t ? 'on' : ''} aria-current=${id === t ? 'page' : null}>${label}</a>`)}</nav>
      ${n === s.lesson ? html`<span class="you">Your current stop</span>`
        : html`<button type="button" onClick=${() => commit(x => { x.lesson = n })}>Make this my current stop</button>`}
    </div>
    <section class="tab-body" aria-label=${TAB_NAME[t]}>
      ${t === 'grammar' ? html`<ol class="glist">${st.grammar.map(([id, title]) => html`<li key=${id}>${title}</li>`)}</ol>` : ''}
      <p class="soon">${SOON[t]} <span class="quiet">Being written now.</span></p>
    </section>
  </main>`
}

function Soon({ title, text }) {
  return html`<main class="page"><header class="masthead"><h1>${title}</h1><p>${text}</p></header>
    <p class="soon">Being built now. <a href="#/">Back to today</a></p></main>`
}

const PracticeHub = () => html`<main class="page">
  <header class="masthead"><h1>Practice</h1><p>Everything beyond the daily stations: exam papers, pictures and trainers.</p></header>
  <${Tiles} />
</main>`

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

function prepare(levels) {
  const stations = [null]                // stations[n], n = 1…36 across the levels
  levels.forEach(lv => stations.push(...lv.stations))
  return { levels, level: Object.fromEntries(levels.map(lv => [lv.level, lv])), stations }
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
    getJson('syllabus').then(sy => setData(prepare(sy))).catch(e => setError(e.message))
    navigator.storage?.persist?.()
  }, [])
  if (error) return html`<main class="empty"><p>The lessons didn't load (${error}). Run <code>python scripts/build_data.py</code>,
    then open <code>app/WegNachDeutschland.html</code>.</p></main>`
  if (!data) return html`<main class="empty"><p>Loading…</p></main>`
  const { page, arg, sub } = route(hash)
  const view = page === 'station' ? html`<${Station} data=${data} n=${Number(arg)} tab=${sub} />`
    : page === 'practice' ? html`<${PracticeHub} />`
    : page === 'study' ? html`<${Soon} title="Cards" text="Flashcards for the words up to your current stop, scheduled so you review them just before you'd forget." />`
    : page === 'tests' ? html`<${Soon} title="Practice tests" text="Numbered tests per level and module: Lesen, Hören, Schreiben, Sprechen, Wortschatz, Grammatik." />`
    : page === 'mock' ? html`<${Soon} title="Mock exam" text="A timed paper per level in the real Goethe structure, scored the Goethe way." />`
    : page === 'pictures' ? html`<${Soon} title="Picture scenes" text="Drawn scenes where every object is a word with its article." />`
    : page === 'verbs' ? html`<${Soon} title="Verb forms" text="Präsens, Perfekt, Präteritum, Imperativ and Konjunktiv II, with real learner mistakes as options." />`
    : page === 'gender' ? html`<${Soon} title="der, die, das" text="A fast gender drill that teaches the ending rules as you go." />`
    : page === 'cases' ? html`<${Soon} title="Cases and endings" text="The case table, prepositions and adjective endings." />`
    : page === 'sounds' ? html`<${Soon} title="Pronunciation" text="A sound guide for ü, ö, ä, ch and r, and minimal-pair listening." />`
    : page === 'tips' ? html`<${Soon} title="Tips" text="How to learn faster, and how to sit the exam." />`
    : html`<${Home} data=${data} />`
  return html`<${TopBar} data=${data} page=${page} />${view}`
}

render(html`<${App} />`, document.getElementById('app'))
