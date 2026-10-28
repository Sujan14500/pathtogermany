// Generated from app/src/*.js by scripts/build_data.py — edit those files
// ==== src/00-core.js ====
// Path to Germany: German from A1 to B1 for the Goethe-Zertifikat, taught through English.
// No bundler: app/src/*.js are joined in name order into one ES module, app/main.js, with vendored Preact + htm.
// This fragment holds what every feature shares; scripts/bundle.py joins them and makes the single-file version.
import { html, render, useState, useEffect, useLayoutEffect, useMemo, useRef } from './vendor/htm-preact-3.1.1.js'
import { fsrs, createEmptyCard, Rating, State } from './vendor/ts-fsrs-5.4.2.js'

const KEY = 'pathtogermany:v1'
const today = () => new Date().toLocaleDateString('en-CA')
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d }
const reducedMotion = () => S.settings.motion === 'reduce' || matchMedia('(prefers-reduced-motion: reduce)').matches   // Settings can force it
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const pct = p => `${Math.round(p * 100)}%`
const shuffle = xs => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
let D = null   // the loaded data (prepare()), set once at start

// ---- progress: one JSON blob in localStorage, backed up by export/import ----

const fresh = () => ({
  cards: {}, log: [], lesson: 1, newPerDay: 15, autoplay: true, newToday: { date: today(), n: 0 }, hooks: {},
  tests: {}, practice: {}, drafts: {}, settings: {},
})
function load() {
  try { return { ...fresh(), ...JSON.parse(localStorage.getItem(KEY)) } } catch { return fresh() }
}
let S = load()
const listeners = new Set()
function commit(change) {
  S.unexported = true   // cleared by exportProgress; while set, closing the tab asks for an export
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
  commit(s => { s.unexported = false })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S)], { type: 'application/json' }))
  a.download = `pathtogermany-progress-${today()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// Closing the tab with unexported progress. Browsers allow only their own "Leave site?" box, with no buttons of
// ours in it; if the learner stays, the timer runs and LeaveExport offers the export.
addEventListener('beforeunload', e => {
  if (!S.unexported) return
  e.preventDefault(); e.returnValue = ''
  setTimeout(() => document.getElementById('leave-export')?.showModal(), 400)
})
const LeaveExport = () => html`<dialog id="leave-export" class="leave" aria-labelledby="leave-h">
  <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true"><rect x="10" y="4" width="28" height="36" rx="3" fill="#fff" />
    <path d="M24 14v16M17 23l7 7 7-7" fill="none" stroke="var(--board)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
    <rect x="6" y="40" width="36" height="4" rx="2" fill="var(--a1)" /></svg>
  <h2 id="leave-h">Take your progress with you</h2>
  <p>One file with every card, test and setting. Next time, in any browser: Settings and backup → Import progress.</p>
  <form method="dialog"><button class="btn big" onClick=${exportProgress}>Export all data</button></form>
</dialog>`

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

// ---- flashcards (FSRS) ----

const scheduler = fsrs({ enable_fuzz: true })
const MIN = 60000
const LEARN_AHEAD = 20 * MIN
const GRADES = [[Rating.Again, 'Again'], [Rating.Hard, 'Hard'], [Rating.Good, 'Good'], [Rating.Easy, 'Easy']]
const newLeft = () => (S.newToday.date === today() ? Math.max(0, S.newPerDay - S.newToday.n) : S.newPerDay)
const known = id => S.cards[id]?.state === State.Review
const status = w => (!S.cards[w.id] ? 'new' : known(w.id) ? 'known' : 'learning')

// The cards: a word gives two, recognition (German → English) and, once that is learned, production (English →
// German, with article and plural). A grammar point gives one, a sentence to build, once it was studied on its
// station page (S.practice["g:<id>"]). Order: due reviews, then new cards up to the daily limit (studied grammar
// first, then the two word kinds alternating, words in station order up to the current stop), then learning cards
// due within 20 minutes.
function queue() {
  const now = Date.now(), eod = +endOfToday()
  const due = [], ahead = [], fresh = { g: [], r: [], p: [] }
  const cards = [...D.words.flatMap(w => [{ w, id: w.id, kind: 'r' }, { w, id: `${w.id}p`, kind: 'p' }]),
    ...D.grammar.map(g => ({ g, id: `g:${g.id}`, kind: 'g' }))]
  for (const c of cards) {
    const s = S.cards[c.id]
    if (!s) {
      if (c.kind === 'g' ? S.practice[c.id] : c.kind === 'r' ? c.w.n <= S.lesson : known(c.w.id)) fresh[c.kind].push(c)
      continue
    }
    const t = +new Date(s.due)
    if (t <= now || (s.state === State.Review && t <= eod)) due.push(c)
    else if (s.state !== State.Review && t - now <= LEARN_AHEAD) ahead.push(c)
  }
  const byDue = (a, b) => new Date(S.cards[a.id].due) - new Date(S.cards[b.id].due)
  const news = [...fresh.g]
  for (let i = 0; i < Math.max(fresh.r.length, fresh.p.length); i++) news.push(...[fresh.p[i], fresh.r[i]].filter(Boolean))
  return [...spreadNew(due.sort(byDue), news.slice(0, newLeft())), ...ahead.sort(byDue)]
}

// New cards spread among the reviews (a review first, as a warm-up), not left for the end when attention is low.
export function spreadNew(reviews, news) {
  const every = Math.max(1, Math.floor(reviews.length / Math.max(news.length, 1)))
  const out = []
  let r = 0, k = 0
  while (r < reviews.length || k < news.length) {
    for (let i = 0; i < every && r < reviews.length; i++) out.push(reviews[r++])
    if (k < news.length) out.push(news[k++])
  }
  return out
}

function answer(card, grade) {
  const now = new Date()
  const isNew = !S.cards[card.id]
  const { card: next } = scheduler.next(S.cards[card.id] ?? createEmptyCard(now), now, grade)
  commit(s => {
    s.cards[card.id] = next
    s.log.push([card.id, grade, now.getTime()])
    if (isNew) {
      if (s.newToday.date !== today()) s.newToday = { date: today(), n: 0 }
      s.newToday.n++
    }
  })
}

export function fmtInterval(ms) {
  const m = Math.round(ms / MIN)
  if (m < 60) return `${Math.max(1, m)}m`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.round(h / 24)
  if (d < 31) return `${d}d`
  return d < 365 ? `${Math.round(d / 30)}mo` : `${(d / 365).toFixed(1)}y`
}

// ---- speech (de-DE) ----

// Edge brings natural online German voices (Katja, Conrad) and Chrome a Google one; Brave and other browsers only
// have what Windows has installed, and an English Windows has none. Speaker A is female, B male, N either.
const deVoices = () => ('speechSynthesis' in window ? speechSynthesis.getVoices() : []).filter(v => /^de([-_]|$)/i.test(v.lang))
if ('speechSynthesis' in window) speechSynthesis.getVoices()   // starts the async voice list loading
const FEMALE = /katja|hedda|amala|seraphina|vicky|petra|anna|marlene|helena|female|frau/i
const MALE = /conrad|stefan|killian|florian|kasper|markus|yannick|hans|male|mann/i
function voiceFor(who) {
  const vs = deVoices()
  const chosen = vs.find(v => v.name === S.settings.voice)
  if (chosen && who !== 'B') return chosen
  const rank = v => (/natural|online|neural/i.test(v.name) ? 0 : /google/i.test(v.name) ? 1 : 2) + (/^de-DE/i.test(v.lang) ? 0 : .5)
  const sex = vs.filter(v => (who === 'B' ? MALE : FEMALE).test(v.name))
  return [...(sex.length ? sex : vs)].sort((a, b) => rank(a) - rank(b))[0] ?? null
}

let speaking = null   // the latest utterance; an earlier one cut off by a new tap isn't a failure
function speak(text, who = 'A') {
  if (!('speechSynthesis' in window)) return noVoice()
  if (speechSynthesis.getVoices().length && !deVoices().length) return noVoice()   // an empty list may still be loading
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'de-DE'
  u.voice = voiceFor(who)
  u.rate = S.settings.rate ?? 0.95
  let started = false
  u.onstart = () => { started = true }
  u.onerror = e => { if (e.error !== 'interrupted' && e.error !== 'canceled') noVoice() }
  speaking = u
  speechSynthesis.cancel()
  speechSynthesis.speak(u)
  setTimeout(() => { if (speaking === u && !started) noVoice() }, 2500)   // Brave can list no voices and never start
}

let voiceNoted = false   // say it once per visit; Settings keeps the full instructions
function noVoice() {
  if (voiceNoted) return
  voiceNoted = true
  const p = document.createElement('p')
  p.className = 'voice-note'
  p.setAttribute('role', 'status')
  p.innerHTML = '<b>No German voice in this browser.</b> Windows Settings → Time &amp; language → Speech → Add voices → '
    + 'German (Deutsch), then quit the browser fully and reopen it. Or open the app in Microsoft Edge. '
    + '<a href="#/" data-settings>More in Settings</a>'
  p.onclick = e => {
    p.remove()
    if (e.target.dataset.settings !== undefined) setTimeout(() => { const d = document.querySelector('.settings'); if (d) { d.open = true; d.scrollIntoView() } }, 100)
  }
  document.body.append(p)
  setTimeout(() => p.remove(), 20000)
}

// ---- many voices: lines spoken in turn, A a woman, B a man, N an announcer ----

// With only one German voice installed, pitch tells the speakers apart.
let lineQueue = null
function speakLines(lines, { rate, onLine, onEnd } = {}) {
  if (!('speechSynthesis' in window)) return noVoice()
  if (speechSynthesis.getVoices().length && !deVoices().length) return noVoice()
  speechSynthesis.cancel()
  const token = {}
  lineQueue = token
  const vA = voiceFor('A'), vB = voiceFor('B')
  const natural = v => /natural|online|neural/i.test(v.name)
  const vN = deVoices().filter(v => v !== vA && v !== vB).sort((a, b) => natural(b) - natural(a))[0] ?? vA
  const one = !vA || !vB || vA === vB
  let i = 0, started = false
  const next = () => {
    if (lineQueue !== token) return
    if (i >= lines.length) { lineQueue = null; onLine?.(-1); onEnd?.(); return }
    const [who, text] = lines[i]
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'de-DE'
    u.voice = who === 'B' ? vB : who === 'N' ? vN : vA
    u.rate = rate ?? S.settings.rate ?? 0.95
    if (one) u.pitch = who === 'B' ? .7 : who === 'N' ? 1 : 1.25
    else if (who === 'N' && vN === vA) u.pitch = .85   // the announcer shares the woman's voice: lower it
    token.u = u   // Chrome drops the events of an utterance nothing refers to, and the queue would stall
    u.onstart = () => { started = true; onLine?.(i) }
    u.onend = () => { i++; setTimeout(next, who === lines[i]?.[0] ? 150 : 420) }
    u.onerror = e => { if (e.error !== 'interrupted' && e.error !== 'canceled') noVoice() }
    speechSynthesis.speak(u)
  }
  next()
  setTimeout(() => { if (lineQueue === token && !started) noVoice() }, 2500)
}
const stopSpeech = () => { lineQueue = null; if ('speechSynthesis' in window) speechSynthesis.cancel(); }

// ---- registries: each feature fragment adds itself, so it needs no edits elsewhere ----

// PAGES: route name ('#/<name>/…') → component({ data, arg, sub, sub2, hash }); the router (99-app.js)
// falls back to its own pages. TAB_VIEWS: station tab id (see TABS) → component({ data, n }); the station
// page (90-station.js) falls back to "being written now". Register at a fragment's top level:
// PAGES.pictures = PicturesPage, TAB_VIEWS.listen = ListenTab.
const PAGES = {}
const TAB_VIEWS = {}

// ---- stations and how far each one is done ----

const TABS = [['words', 'Words'], ['grammar', 'Grammar'], ['read', 'Read'], ['listen', 'Listen'], ['write', 'Write'],
  ['speak', 'Speak'], ['pictures', 'Pictures'], ['test', 'Test']]
const TAB_NAME = Object.fromEntries(TABS)
const PARTS = ['words', 'grammar', 'read', 'listen', 'write', 'speak', 'test']   // a station's parts in study order

// 0…1 per part: words count learned cards, grammar the points studied; the other parts keep their best result in
// S.practice["<station>/<part>"].
function partDone(n, part) {
  const ws = part === 'words' && D?.wordsBy[n], gs = part === 'grammar' && D?.grammarBy[n]
  if (ws?.length) return ws.filter(w => known(w.id)).length / ws.length
  if (gs?.length) return gs.filter(g => S.practice[`g:${g.id}`]).length / gs.length
  return S.practice[`${n}/${part}`] ?? 0
}
const stationDone = n => PARTS.reduce((a, p) => a + partDone(n, p), 0) / PARTS.length
const levelDone = lv => lv.stations.reduce((a, st) => a + stationDone(st.n), 0) / lv.stations.length
const here = data => data.stations[S.lesson] ?? data.stations[1]

// ---- words: the gender colour goes wherever a noun appears ----

const ART = { der: 'der', die: 'die', das: 'das', pl: 'die' }
const POS_NAME = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', prep: 'preposition', conj: 'conjunction', pron: 'pronoun',
  num: 'number', art: 'article', phrase: 'phrase', other: 'word', name: 'name' }
const said = w => (w.a ? `${ART[w.a]} ${w.w}` : w.w)                      // what the voice says
const formsNote = w => (w.p === 'n' ? (w.a === 'pl' ? 'plural only' : w.pl === '-' ? 'no plural' : w.pl ? `die ${w.pl}` : '') : w.f ?? '')

const Word = ({ w }) => html`<span class=${`word${w.a ? ` g-${w.a}` : ''}`} lang="de">${w.a ? html`<b class="art">${ART[w.a]}</b> ` : ''}${w.w}</span>`

const Speaker = () => html`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
  <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
  <path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
</svg>`
const SayButton = ({ text, label }) => html`<button class="say" type="button" aria-label=${`Play ${label ?? text}`}
  onClick=${e => { e.stopPropagation(); speak(text) }}><${Speaker} /></button>`

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
// The forms a word can take in a sentence: noun cases and plural, verb persons and tenses, adjective endings.
function wordForms(w) {
  const x = w.w.replace(/^sich /, '')
  if (w.p === 'n') return [x, `${x}s`, `${x}es`, `${x}e`, `${x}n`, `${x}en`, ...(w.pl && w.pl !== '-' ? [w.pl, `${w.pl}n`] : [])]
  if (w.p === 'v') {
    const [pres = '', past = '', perf = ''] = (w.f ?? '').split(', ')
    const p3 = pres.split(' ')[0], pt = past.split(' ')[0]
    const prefix = pres.includes(' ') ? pres.split(' ').pop() : ''              // "steht auf" → separable "auf"
    const core = prefix && x.startsWith(prefix) ? x.slice(prefix.length) : x
    const stem = core.replace(/e?n$/, '')
    return [x, core, ...['e', 'st', 't', 'et', 'est', 'en'].map(e => stem + e), p3, p3.replace(/t$/, 'st'), pt, `${pt}st`, `${pt}en`,
      `${pt}n`, perf.split(' ').pop()].filter(f => f && f.length > 1)
  }
  return [x, ...['e', 'en', 'er', 'es', 'em'].map(e => x + e)]
}
// Where a word appears in a sentence, on word boundaries: "Haus" isn't found in "Krankenhaus", "um" not in "Umwelt".
export function findWord(s, w) {
  const forms = [...new Set(wordForms(w))].sort((a, b) => b.length - a.length).map(esc)
  const m = new RegExp(`(?<!\\p{L})(${forms.join('|')})(?!\\p{L})`, 'u').exec(s)
  return m ? [m.index, m.index + m[0].length] : null
}

function Example({ w }) {
  const at = findWord(w.de, w)
  return html`<p class="ex"><span lang="de">${at ? html`${w.de.slice(0, at[0])}<mark class=${w.a ? `g-${w.a}` : ''}>${w.de.slice(at[0], at[1])}</mark>${w.de.slice(at[1])}` : w.de}</span>
    <${SayButton} text=${w.de} label="the example" /><small>${w.ee}</small></p>`
}

// ---- a short quiz: one question at a time, the answer explained right away ----

function Quiz({ qs, onDone, again }) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState(null)
  const [right, setRight] = useState(0)
  const q = qs[i]
  const choose = k => {
    if (picked !== null || !q) return
    setPicked(k)
    if (k === q.a) setRight(r => r + 1)
    if (q.say) speak(q.say)
  }
  const next = () => {
    if (picked === null) return
    if (i + 1 === qs.length) onDone?.((right) / qs.length)
    setI(i + 1); setPicked(null)
  }
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest?.('input, textarea, select')) return
      if (/^[1-4]$/.test(e.key) && q && +e.key <= q.opts.length) choose(+e.key - 1)
      else if ((e.key === 'Enter' || e.key === ' ') && picked !== null && !e.target.closest?.('button, a')) { e.preventDefault(); next() }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })
  if (!q) {
    const p = right / qs.length
    return html`<div class="quiz-end">
      <span class=${`stamp ${p >= .6 ? 'pass' : 'fail'}`}>${p >= .6 ? 'Bestanden' : 'Noch nicht'}</span>
      <p><b>${right} of ${qs.length}</b> right (${pct(p)}). ${p >= .6 ? 'Passed: 60% is the pass mark.' : 'Below 60%. Review the words and try again.'}</p>
      ${again ? html`<button type="button" onClick=${again}>Another round</button>` : ''}
    </div>`
  }
  return html`<div class="quiz">
    <p class="quiz-count">Question ${i + 1} of ${qs.length}</p>
    <p class="quiz-q">${q.q}</p>
    <ol class="opts">${q.opts.map((o, k) => html`<li><button type="button" onClick=${() => choose(k)} disabled=${picked !== null}
      class=${picked === null ? '' : k === q.a ? 'right' : k === picked ? 'wrong' : 'dim'}><kbd>${k + 1}</kbd><span>${o}</span></button></li>`)}</ol>
    ${picked !== null ? html`<div class=${`why ${picked === q.a ? 'right' : 'wrong'}`}>
      <p><b>${picked === q.a ? 'Right.' : 'Not quite.'}</b> ${q.why}</p>
      <button type="button" class="btn" onClick=${next}>${i + 1 === qs.length ? 'See the result' : 'Next question'} <${Arrow} /></button>
    </div>` : ''}
  </div>`
}

// ---- small drawn pieces ----

const Train = () => html`<svg class="train" viewBox="0 0 40 20" aria-hidden="true">
  <path d="M2 16V7a4 4 0 0 1 4-4h20c6 0 11 5 12 11v2z" fill="var(--ink)" />
  <path d="M8 6h6v4H8zM17 6h6v4h-6z" fill="var(--panel)" /><path d="M27 6c3 .5 6 2.5 7.5 5H27z" fill="var(--panel)" />
  <path d="M2 13h36" stroke="var(--line)" stroke-width="2" />
</svg>`

const Arrow = () => html`<svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>`

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

// ==== src/05-backdrop.js ====
// ---- the look: theme and motion from Settings, and the drifting words behind the page ----

// Settings can override Windows' theme and motion choice. Rather than copy every dark or reduced-motion rule, each
// stylesheet's (prefers-color-scheme: dark) and (prefers-reduced-motion: reduce) block is switched on ('all'), off
// ('not all') or back to its own query, so every fragment's rules follow. reducedMotion() (00-core.js) reads it too.
const LOOK_MEDIA = new Map()   // CSSMediaRule → its own query
function applyLook() {
  const { theme, motion } = S.settings
  const root = document.documentElement
  root.classList.add('look-switch')   // switch at once: no colour transitions (99-motion.css makes every property one)
  const force = [['prefers-color-scheme: dark', theme === 'dark' ? 'all' : theme === 'light' ? 'not all' : null],
    ['prefers-reduced-motion: reduce', motion === 'reduce' ? 'all' : null]]
  for (const sheet of document.styleSheets) {
    let rules
    try { rules = sheet.cssRules } catch { continue }   // a cross-origin sheet (Google Fonts) can't be read
    for (const r of rules) {
      if (!(r instanceof CSSMediaRule)) continue
      if (!LOOK_MEDIA.has(r)) LOOK_MEDIA.set(r, r.media.mediaText)
      const own = LOOK_MEDIA.get(r), f = force.find(([q]) => own.includes(q))
      if (f) r.media.mediaText = f[1] ?? own
    }
  }
  root.style.colorScheme = theme === 'dark' || theme === 'light' ? theme : ''
  getComputedStyle(root).color   // apply the new styles before transitions come back
  root.classList.remove('look-switch')
}
applyLook()

// Behind the calmer pages, German nouns drift slowly upward with their article in its gender colour, and the English
// surfaces halfway up: an idle moment becomes a quiet recall check. The words are the learner's own learned cards,
// topped up from the current station. Hidden from screen readers; paused under reduced motion; off in Settings.
const BACKDROP_PAGES = new Set(['', 'practice'])   // pages of panels; elsewhere text sits on the bare page
function Backdrop({ data, page }) {
  const s = useStore()
  const day = today()
  const ws = useMemo(() => {
    const seed = [...day].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, s.lesson)
    const mix = xs => xs.map(w => [(parseInt(w.id.slice(1), 16) ^ seed) >>> 0, w]).sort((a, b) => a[0] - b[0]).map(x => x[1])
    const mine = mix(data.words.filter(w => w.a && known(w.id)))
    const station = mix((data.wordsBy[s.lesson] ?? []).filter(w => w.a && !known(w.id)))
    return [...mine.slice(0, 10), ...station, ...mine.slice(10)].slice(0, 14)
  }, [data, s.lesson, day])
  if (!BACKDROP_PAGES.has(page) || s.settings.backdrop === false || !ws.length) return null
  return html`<div class="backdrop" aria-hidden="true">${ws.map((w, i) => {
    const r = (parseInt(w.id.slice(1, 5), 16) % 1000) / 1000   // steady per word, so a re-render doesn't reshuffle
    const dur = 44 + r * 26
    return html`<span key=${w.id} class=${`g-${w.a}`} style=${`--x:${((i * .618 + r * .07) % 1) * 92 + 2}%;--size:${1.5 + r * 1.2}rem;--dur:${dur}s;--delay:${-(i / ws.length) * dur}s`}>
      <b lang="de"><i>${ART[w.a]}</i> ${w.w}</b><small>${w.en.split(/[,;(]/)[0].trim()}</small>
    </span>`
  })}</div>`
}

// ==== src/10-words.js ====
// ---- station tab: words ----

// Ten questions on a station's words: meaning both ways, der/die/das, and the word that fills a gap.
function wordQuestions(ws, pool) {
  const others = (w, key) => shuffle(pool.filter(x => x !== w && x.p === w.p && x[key] !== w[key]))
  const opts = (right, wrong) => { const o = shuffle([right, ...wrong.slice(0, 3)]); return { opts: o, a: o.indexOf(right) } }
  const make = w => {
    const kinds = ['meaning', 'reverse']
    if (w.a && w.a !== 'pl') kinds.push('article', 'article')
    const at = findWord(w.de, w)
    if (at && w.de.slice(at[0], at[1]) === w.w) kinds.push('gap', 'gap')
    const kind = shuffle(kinds)[0]
    if (kind === 'article') {
      return { q: html`Which article? <span class="word" lang="de">${w.w}</span>`, opts: ['der', 'die', 'das'], a: ['der', 'die', 'das'].indexOf(w.a),
        why: html`<${Word} w=${w} />: ${w.en}.`, say: said(w) }
    }
    if (kind === 'gap') {
      const o = opts(w.w, [...new Set(others(w, 'w').map(x => x.w))])
      return { q: html`<span lang="de">${w.de.slice(0, at[0])}<span class="gap"></span>${w.de.slice(at[1])}</span>`, ...o,
        why: html`<span lang="de">${w.de}</span> (${w.ee})`, say: w.de }
    }
    if (kind === 'reverse') {
      const o = opts(said(w), [...new Set(others(w, 'w').map(said))])
      return { q: html`Which word means <b>${w.en}</b>?`, ...o, why: html`<${Word} w=${w} />: ${w.en}.`, say: said(w) }
    }
    const o = opts(w.en, [...new Set(others(w, 'en').map(x => x.en))])
    return { q: html`What does <${Word} w=${w} /> mean?`, ...o, why: html`<${Word} w=${w} /> means ${w.en}.`, say: said(w) }
  }
  return shuffle(ws).slice(0, 10).map(make).filter(q => q.opts.length >= 2)
}

function WordsTab({ data, n }) {
  useStore()
  const ws = data.wordsBy[n] ?? []
  const [open, setOpen] = useState(null)
  const [quiz, setQuiz] = useState(null)
  const pool = useMemo(() => data.words.filter(w => w.n <= Math.max(n, 12)), [data, n])
  const start = () => setQuiz(wordQuestions(ws, pool))
  if (!ws.length) return html`<p class="soon">This station's words are being written now: each noun with its article and plural, audio and a quick quiz.</p>`
  const learned = ws.filter(w => known(w.id)).length
  const cover = S.settings.cover
  return html`<div class="words-tab">
    <div class="words-head">
      <p><b>${ws.length} words</b> · ${learned} learned as cards. Tap a word for its example. New cards for this station come in${' '}
        <a href="#/study">today's cards</a> once it is your current stop.</p>
      <div class="words-tools">
        <${SceneLink} n=${n} />
        <button type="button" class=${`toggle${cover ? ' on' : ''}`} aria-pressed=${!!cover} title="Try to recall each meaning first, then tap the word to check"
          onClick=${() => commit(x => { x.settings = { ...x.settings, cover: !cover } })}><span class="toggle-knob"></span>Cover the English</button>
        <button type="button" class="btn" onClick=${start}>Test yourself <${Arrow} /></button>
      </div>
    </div>
    ${quiz ? html`<section class="quiz-box" aria-label="Test yourself"><${Quiz} key=${quiz} qs=${quiz} again=${start} /></section>` : ''}
    <ul class=${`wlist${cover ? ' cover' : ''}`}>${ws.map(w => html`<li key=${w.id} class=${`${status(w)}${open === w.id ? ' open' : ''}`}>
      <${SayButton} text=${said(w)} />
      <button type="button" class="wrow" aria-expanded=${open === w.id} onClick=${() => setOpen(open === w.id ? null : w.id)}>
        <span class="wde"><${Word} w=${w} /><small lang="de">${formsNote(w)}</small></span>
        <span class="wen">${w.en}</span>
      </button>
      ${open === w.id ? html`<div class="wmore">${w.ipa ? html`<p class="ipa">${w.ipa}</p>` : ''}<${Example} w=${w} /></div>` : ''}
    </li>`)}</ul>
  </div>`
}
TAB_VIEWS.words = WordsTab

// ==== src/15-study.js ====
// ---- typed answers: lenient about capitals and umlaut spellings, strict about the article ----

const fold = t => t.normalize('NFC').trim().replace(/\s+/g, ' ')
const loose = t => fold(t).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/^sich /, '')
function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  }
  return d[a.length][b.length]
}
// Order matters: another word with the same English counts before the article is judged ("der Wagen" for das Auto).
export function checkAnswer(typed, w, words = []) {
  const t = fold(typed), want = said(w)
  if (t === want) return { verdict: 'right', notes: [] }
  const other = words.find(x => x !== w && x.en === w.en && loose(said(x)) === loose(t))
  if (other) return { verdict: 'close', notes: [`Also right; this card wants ${want}.`] }
  if (w.a && w.a !== 'pl') {
    const [first, ...rest] = t.split(' ')
    const hasArt = ['der', 'die', 'das'].includes(first.toLowerCase())
    const body = hasArt ? rest.join(' ') : t
    const near = loose(body) === loose(w.w) || (w.w.length >= 5 && lev(loose(body), loose(w.w)) === 1)
    if (near && (!hasArt || first.toLowerCase() !== ART[w.a])) return { verdict: 'wrong', notes: [`The article belongs to the word: ${want}.`] }
  }
  if (loose(t) === loose(want)) {
    const notes = []
    const bare = x => x.replace(/^sich /i, '')
    if (/^sich /.test(want) && !/^sich /i.test(t)) notes.push(`It is reflexive: ${want}.`)
    if (/[äöü]/i.test(want) && /(ae|oe|ue)/i.test(bare(t)) && !/(ae|oe|ue)/i.test(bare(want))) notes.push(`ae, oe and ue stand in for ä, ö and ü: ${want}.`)
    if (/ß/.test(want) && /ss/.test(t) && !/ss/.test(want)) notes.push(`ss stands in for ß: ${want}.`)
    const caps = x => bare(x).split(' ').map(p => p[0] === p[0]?.toUpperCase())
    if (caps(t).join() !== caps(want).join()) notes.push(w.p === 'n' ? `Nouns start with a capital: ${want}.` : `Mind the capitals: ${want}.`)
    return { verdict: 'close', notes }
  }
  if (w.w.replace(/^sich /, '').length >= 5 && lev(loose(t), loose(want)) === 1) return { verdict: 'typo', notes: [] }
  return { verdict: 'wrong', notes: [] }
}

// Letter diff of what was typed against the answer: [[char, 'same' | 'miss' (left out) | 'extra' (typed in)]].
export function diffChars(a, b) {
  const L = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  }
  const out = []
  let i = 0, j = 0
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) { out.push([a[i], 'same']); i++; j++ }
    else if (j < b.length && (i === a.length || L[i][j + 1] >= L[i + 1][j])) out.push([b[j++], 'miss'])
    else out.push([a[i++], 'extra'])
  }
  return out
}

// A word missed four times or more gets a memory hook of the learner's own, shown on both its cards.
function HookBox({ w }) {
  const s = useStore()
  const [text, setText] = useState(s.hooks?.[w.id] ?? '')
  const save = () => commit(x => { x.hooks = { ...x.hooks, [w.id]: text.trim() || undefined } })
  const hint = w.p === 'n' ? 'Picture it in its gender: der things frozen in blue ice, die things on fire, das things overgrown with green leaves. Then link the sound to the meaning.'
    : 'Link the sound to the meaning with a picture or a story of your own.'
  return html`<div class="hook" onClick=${e => e.stopPropagation()}>
    <label for="hook-in">Your memory hook</label>
    <textarea id="hook-in" rows="2" placeholder=${hint} value=${text} onInput=${e => setText(e.target.value)} onBlur=${save}></textarea>
  </div>`
}

// ---- study session: each card is a station sign ----

function Study({ data }) {
  const s = useStore()
  const [revealed, setRevealed] = useState(false)
  const [leaving, setLeaving] = useState(0)
  const [done, setDone] = useState(0)
  const [prev, setPrev] = useState(null)
  const [typed, setTyped] = useState('')
  const [check, setCheck] = useState(null)       // checkAnswer() of a typed production card
  const q = queue()
  const c = q[0]
  // a grammar card rotates through its point's examples, one per review
  const ex = c?.kind === 'g' && c.g.examples[(s.cards[c.id]?.reps ?? 0) % c.g.examples.length]
  const sayIt = () => speak(ex ? sentence(ex) : said(c.w))

  const reveal = () => {
    if (!c || revealed) return
    setRevealed(true)
    if (s.autoplay && !ex) sayIt()
  }
  const rate = grade => {
    if (!revealed || leaving) return
    setLeaving(grade)
    setTimeout(() => {
      answer(c, grade)
      setPrev(c); setDone(d => d + 1); setRevealed(false); setLeaving(0); setTyped(''); setCheck(null)
    }, reducedMotion() ? 0 : 240)
  }
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest?.('input, textarea, select')) return     // typing an answer or a memory hook
      const onControl = e.target.closest?.('button, a, summary')
      if ((e.key === ' ' || e.key === 'Enter') && !onControl) { e.preventDefault(); revealed ? rate(Rating.Good) : reveal() }
      else if (/^[1-4]$/.test(e.key)) rate(+e.key)
      else if (e.key === 's' && c) sayIt()
      else if (e.key === 'Escape') location.hash = '#/'
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  // the grade a typed answer suggests gets the focus, so a second Enter accepts it
  const suggest = (check && { wrong: Rating.Again, typo: Rating.Hard }[check.verdict]) || Rating.Good
  useEffect(() => { if (revealed && check) document.querySelector(`.grades .g${suggest}`)?.focus() }, [revealed, check])

  if (!c) return html`<${Arrived} data=${data} done=${done} />`
  const submit = e => { e.preventDefault(); if (typed.trim()) setCheck(checkAnswer(typed, c.w, data.words)); reveal() }
  const tricky = s.cards[c.id]?.lapses >= 4
  const hook = c.w && s.hooks?.[c.w.id]
  const total = done + q.length
  const now = new Date()
  const preview = revealed ? scheduler.repeat(s.cards[c.id] ?? createEmptyCard(now), now) : null
  const st = data.stations[(c.w ?? c.g).n]
  const w = c.w
  return html`<main class=${`study l${st.level}`}>
    <header class="trip">
      <a class="back" href="#/">Stop</a>
      <div class="track" role="progressbar" aria-label="Session progress" aria-valuemin="0" aria-valuemax=${total} aria-valuenow=${done}>
        <span class="rail"></span><span class="ride" style=${`--p:${total ? done / total : 0}`}><${Train} /></span>
      </div>
      <span class="count">${q.length} left</span>
    </header>
    <article key=${c.id} class=${`card${revealed ? ' open' : ''}${leaving ? ` leave g${leaving}` : ''}`} onClick=${reveal} aria-live="polite">
      <div class="card-top">
        <span class="lb">${st.level} · ${st.k}</span>
        <span class="card-kind">${c.kind === 'g' ? 'Build it in German' : c.kind === 'r' ? 'Say the German aloud. What does it mean?'
          : w.p === 'n' ? 'Say it in German, out loud, with article and plural' : 'Say it in German, out loud'}</span>
        ${!s.cards[c.id] ? html`<span class="new-tag">New</span>` : tricky ? html`<span class="new-tag tricky">Tricky word</span>` : ''}
      </div>
      ${c.kind === 'g'
        ? html`<p class="card-gtitle">${c.g.title}</p>
            <div class="card-back card-g" onClick=${e => e.stopPropagation()}><${Builder} key=${c.id} ex=${ex} onDone=${reveal} />
              ${revealed ? html`<p class="g-pattern" lang="de">${c.g.pattern}</p>` : ''}</div>`
        : c.kind === 'r'
        ? html`<h2 class="card-term"><${Word} w=${w} /></h2>
            <p class="card-forms" lang="de">${formsNote(w)}</p>
            <div class="card-back">${revealed ? html`<p class="card-en">${w.en}</p><p class="card-meta">${POS_NAME[w.p]}${w.ipa ? html` · <span class="ipa">${w.ipa}</span>` : ''}</p><${Example} w=${w} />` : ''}</div>`
        : html`<h2 class="card-term en">${w.en}</h2>
            <p class="card-forms">${POS_NAME[w.p]}</p>
            <div class="card-back">${revealed ? html`<p class="card-de"><${Word} w=${w} /> <${SayButton} text=${said(w)} /></p>
              ${check ? html`<p class=${`typed ${check.verdict}`}><span class="typed-v">${{ right: 'Right', close: 'Right', typo: 'Nearly: one letter off', wrong: 'Not quite' }[check.verdict]}</span>
                ${check.verdict !== 'right' ? html`<span lang="de" class="typed-diff">${diffChars(typed.trim(), said(w)).map(([ch, k]) => (k === 'same' ? ch : k === 'miss' ? html`<u>${ch}</u>` : html`<s>${ch}</s>`))}</span>` : ''}
                ${check.notes.length ? html`<small>${check.notes.join(' ')}</small>` : ''}</p>` : ''}
              <p class="card-forms" lang="de">${formsNote(w)}</p><${Example} w=${w} />`
              : html`<form class="type-it" onSubmit=${submit} onClick=${e => e.stopPropagation()}>
                  <input lang="de" autocomplete="off" autocapitalize="off" spellcheck="false" value=${typed} onInput=${e => setTyped(e.target.value)}
                    placeholder=${w.a && w.a !== 'pl' ? 'der/die/das + word' : 'Type the German'} aria-label="Your answer in German" />
                  <button type="submit" class="btn">Check <kbd>Enter</kbd></button>
                </form>`}</div>`}
      ${revealed && c.w ? html`<${ScenePic} key=${c.id} w=${c.w} />` : ''}
      ${revealed && c.w && (tricky || hook) ? html`<${HookBox} w=${c.w} />` : ''}
      <div class="band card-band">
        <span>${prev ? html`← <span lang="de">${prev.w ? said(prev.w) : prev.g.title}</span>` : ''}</span>
        <span lang="de">${st.de}</span>
      </div>
    </article>
    ${revealed
      ? html`<div class="grades" role="group" aria-label="How well did you know it?">
          ${GRADES.map(([g, label]) => html`<button type="button" class=${`g${g}`} onClick=${() => rate(g)}>
            ${label}<small>${fmtInterval(preview[g].card.due - now)}</small><kbd>${g}</kbd></button>`)}
        </div>`
      : html`<button type="button" class="show" onClick=${reveal}>Show the answer <kbd>Space</kbd></button>`}
  </main>`
}

function Arrived({ data, done }) {
  const s = useStore()
  const nextDue = Object.values(s.cards).map(c => +new Date(c.due)).filter(t => t > Date.now()).sort((a, b) => a - b)[0]
  const unseen = data.words.some(w => !s.cards[w.id] && w.n <= s.lesson)
  const st = here(data)
  const next = data.stations[st.n + 1]
  return html`<main class=${`study arrived l${st.level}`}>
    <article class="card open">
      <h2 class="card-term" lang="de">Angekommen!</h2>
      <p class="card-en">${done ? `Done for now: ${plural(done, 'card')} studied.` : data.words.length ? 'Nothing to study right now.' : 'The word cards are being written now.'}
        ${done ? html`<br /><span class="quiet">Sleep on it: what you learn today is easier tomorrow.</span>` : ''}
        ${nextDue ? ` Next review in ${fmtInterval(nextDue - Date.now())}.` : ''}</p>
      <div class="band card-band"><span></span><span lang="de">${st.de}</span></div>
    </article>
    <div class="after">
      ${unseen ? html`<button type="button" onClick=${() => commit(x => { x.newToday = { date: today(), n: (x.newToday.date === today() ? x.newToday.n : 0) - 10 } })}>Learn 10 more new words</button>`
        : next ? html`<button type="button" onClick=${() => commit(x => { x.lesson = next.n })}>Move on to <span lang="de">${next.de}</span></button>` : ''}
      <a class="btn" href=${`#/station/${st.n}/grammar`}>Go on with the station <${Arrow} /></a>
    </div>
  </main>`
}
PAGES.study = Study

// ==== src/20-grammar.js ====
// ---- grammar: the pattern, a plain explanation, English beside it, aligned examples and a sentence builder ----

const sentence = ex => ex.de.join(' ')
const english = ex => ex.en.map(([, t]) => t).join(' ')

// German chunks over their English, joined by lines, so word-order differences can be seen. Pointing at a chunk
// lights its links. The lines are measured after layout and redrawn when fonts arrive or the window changes.
function Aligned({ ex }) {
  const ref = useRef()
  const [lines, setLines] = useState([])
  const [hot, setHot] = useState(null)
  useLayoutEffect(() => {
    const draw = () => {
      const el = ref.current
      if (!el) return
      const box = el.getBoundingClientRect()
      const rect = sel => [...el.querySelectorAll(sel)].map(e => e.getBoundingClientRect())
      const de = rect('.al-de > span'), en = rect('.al-en > span')
      // lines across wrapped rows would cross the text: then pointing at a chunk is the link
      const wraps = rs => new Set(rs.map(r => Math.round(r.top))).size > 1
      if (wraps(de) || wraps(en)) return setLines(null)
      setLines(ex.en.flatMap(([ks], j) => ks.map(k => ({ k, j,
        x1: de[k].left + de[k].width / 2 - box.left, y1: de[k].bottom - box.top + 2,
        x2: en[j].left + en[j].width / 2 - box.left, y2: en[j].top - box.top - 2 }))))
    }
    draw()
    document.fonts?.ready.then(draw)
    addEventListener('resize', draw)
    return () => removeEventListener('resize', draw)
  }, [ex])
  const lit = (k, j) => hot && (hot[0] === 'de' ? hot[1] === k : hot[1] === j)
  return html`<div class=${`aligned${lines ? '' : ' wrapped'}`} ref=${ref} onMouseLeave=${() => setHot(null)}>
    <svg class="al-lines" aria-hidden="true">${(lines ?? []).map(l => html`<path class=${lit(l.k, l.j) ? 'lit' : ''}
      d=${`M${l.x1} ${l.y1} C${l.x1} ${(l.y1 + l.y2) / 2} ${l.x2} ${(l.y1 + l.y2) / 2} ${l.x2} ${l.y2}`} />`)}</svg>
    <p class="al-de" lang="de">${ex.de.map((c, k) => html`<span class=${`${ex.v.includes(k) ? 'v' : ''}${hot?.[0] === 'de' && hot[1] === k ? ' lit' : ''}`}
      onMouseEnter=${() => setHot(['de', k])} onClick=${() => setHot(['de', k])}>${c}</span>`)}</p>
    <p class="al-en">${ex.en.map(([ks, t], j) => html`<span class=${`${ks.length ? '' : 'none'}${hot?.[0] === 'en' && hot[1] === j ? ' lit' : ''}`}
      onMouseEnter=${() => setHot(['en', j])} onClick=${() => setHot(['en', j])}>${t}</span>`)}</p>
  </div>`
}

// Animate elements marked data-k from where they were to where they are now (FLIP). Call the returned
// function just before the state change that moves them.
function useFlip(ref) {
  const before = useRef(null)
  useLayoutEffect(() => {
    const was = before.current
    before.current = null
    if (!was || reducedMotion() || !ref.current) return
    ref.current.querySelectorAll('[data-k]').forEach(el => {
      const r = was.get(el.dataset.k)
      if (!r) return
      const now = el.getBoundingClientRect()
      const dx = r.left - now.left, dy = r.top - now.top
      if (dx || dy) el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 420, easing: 'cubic-bezier(.2, .8, .2, 1)' })
    })
  })
  return () => { before.current = new Map([...ref.current.querySelectorAll('[data-k]')].map(el => [el.dataset.k, el.getBoundingClientRect()])) }
}

// Tap the German chunks in order. A wrong order shows where it goes wrong, and "Show me" moves every chunk,
// the verb in its colour, to its place.
function Builder({ ex, onDone }) {
  const ref = useRef()
  const flip = useFlip(ref)
  const pool = useMemo(() => {
    let o = shuffle(ex.de.map((_, k) => k))
    if (o.every((k, i) => k === i) && o.length > 1) o = [...o.slice(1), o[0]]
    return o
  }, [ex])
  const [placed, setPlaced] = useState([])
  const [state, setState] = useState('build')
  const full = placed.length === ex.de.length
  const right = full && placed.every((k, i) => k === i)
  useEffect(() => {
    if (!full || state !== 'build') return
    setState(right ? 'right' : 'wrong')
    if (right) { speak(sentence(ex)); onDone?.() }
  }, [full])
  const tap = k => { if (state !== 'build') return; flip(); setPlaced(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k])) }
  const reset = () => { flip(); setPlaced([]); setState('build') }
  const show = () => { flip(); setPlaced(ex.de.map((_, k) => k)); setState('shown') }
  const verbAt = ex.v[0], verbPlaced = placed.indexOf(verbAt)
  const hint = state === 'wrong' && (verbPlaced !== verbAt
    ? `Look at the verb (${ex.de[verbAt]}): it belongs ${verbAt === ex.de.length - 1 ? 'at the end' : `in position ${verbAt + 1}`}.`
    : 'The verb is in place; check the order of the other parts.')
  return html`<div class=${`builder ${state}`} ref=${ref}>
    <p class="b-target">${english(ex)}</p>
    <div class="b-answer" lang="de" aria-label="Your sentence">${placed.length ? placed.map((k, i) => html`<button type="button" data-k=${k} onClick=${() => tap(k)}
        class=${`chunk${ex.v.includes(k) ? ' v' : ''}${state === 'wrong' && k !== i ? ' off' : ''}`}>${ex.de[k]}</button>`)
      : html`<span class="b-empty">Tap the parts below in the right order</span>`}</div>
    <div class="b-pool" lang="de">${pool.filter(k => !placed.includes(k)).map(k => html`<button type="button" data-k=${k} class="chunk" onClick=${() => tap(k)}>${ex.de[k]}</button>`)}</div>
    ${state === 'right' ? html`<p class="b-msg right"><b>Richtig!</b> <${SayButton} text=${sentence(ex)} label="the sentence" /></p>` : ''}
    ${state === 'wrong' ? html`<p class="b-msg wrong">${hint} <button type="button" onClick=${reset}>Try again</button> <button type="button" onClick=${show}>Show me</button></p>` : ''}
    ${state === 'shown' ? html`<p class="b-msg">The verb${ex.v.length > 1 ? ' parts' : ''} in colour. <button type="button" onClick=${reset}>Build it again</button></p>` : ''}
  </div>`
}

const gqQuiz = qs => shuffle(qs).map(q => ({
  q: html`<span lang="de">${q.q.split('___').map((p, i) => html`${i ? html`<span class="gap"></span>` : ''}${p}`)}</span>`,
  opts: q.opts, a: q.a, why: html`${q.why} <span class="quiet">(${q.en})</span>`, say: q.q.replace('___', q.opts[q.a]),
}))

// Before the explanation: one question to guess. Getting it wrong first makes the rule stick when it comes.
function GuessFirst({ q }) {
  const [picked, setPicked] = useState(null)
  return html`<section class="guess" aria-label="Guess first">
    <h3>Guess first</h3><p class="quiet">A wrong guess is fine: it makes the explanation stick.</p>
    <p class="quiz-q" lang="de">${q.q.split('___').map((part, k) => html`${k ? html`<span class="gap"></span>` : ''}${part}`)}</p>
    <div class="guess-opts">${q.opts.map((o, k) => html`<button type="button" lang="de" disabled=${picked !== null} onClick=${() => setPicked(k)}
      class=${picked === null ? '' : k === q.a ? 'right' : k === picked ? 'wrong' : 'dim'}>${o}</button>`)}</div>
    ${picked !== null ? html`<p class="guess-after">${picked === q.a ? html`<b>Right.</b>` : html`<b>Not this one.</b>`} Read on to see why.</p>` : ''}
  </section>`
}

function GrammarPoint({ data, g, i }) {
  useStore()
  const [quiz, setQuiz] = useState(null)
  const seen = S.practice[`g:${g.id}`]
  const learn = () => { if (!seen) commit(x => { x.practice[`g:${g.id}`] = 1 }) }
  const build = g.examples.find(ex => ex.de.length >= 3) ?? g.examples[0]
  const qs = data.gq[g.id] ?? []
  return html`<article class="gpoint" id=${`g-${g.id}`}>
    <header class="g-head"><span class="g-num">${i + 1}</span><h2>${g.title}</h2>
      ${seen ? html`<span class="g-seen">In your cards</span>` : ''}</header>
    ${!seen && qs.length ? html`<${GuessFirst} q=${qs[0]} />` : ''}
    <p class="g-pattern" lang="de">${g.pattern}</p>
    <div class="g-body">
      <div class="g-text">
        <p class="g-explain">${g.explain}</p>
        ${g.compare_en ? html`<p class="g-compare"><span class="g-en">In English</span>${g.compare_en}</p>` : ''}
        ${g.table ? html`<table class="g-table" lang="de"><thead><tr>${g.table[0].map(c => html`<th>${c}</th>`)}</tr></thead>
          <tbody>${g.table.slice(1).map(r => html`<tr>${r.map((c, k) => (k ? html`<td>${c}</td>` : html`<th>${c}</th>`))}</tr>`)}</tbody></table>` : ''}
      </div>
      <div class="g-examples">${g.examples.map(ex => html`<div class="g-ex"><${Aligned} ex=${ex} /><${SayButton} text=${sentence(ex)} label="the example" /></div>`)}</div>
    </div>
    <section class="g-practice">
      <h3>Build it</h3>
      <${Builder} ex=${build} onDone=${learn} />
      ${qs.length ? html`<h3>Check yourself</h3>
        ${quiz ? html`<${Quiz} key=${quiz} qs=${quiz} onDone=${learn} again=${() => setQuiz(gqQuiz(qs))} />`
          : html`<button type="button" class="btn" onClick=${() => setQuiz(gqQuiz(qs))}>${plural(qs.length, 'question')} on this point <${Arrow} /></button>`}` : ''}
    </section>
  </article>`
}

function GrammarTab({ data, n }) {
  const gs = data.grammarBy[n]
  if (!gs.length) return html`<ol class="glist">${data.stations[n].grammar.map(([id, title]) => html`<li key=${id}>${title}</li>`)}</ol>
    <p class="soon">${SOON.grammar} <span class="quiet">Being written now.</span></p>`
  const go = id => document.getElementById(`g-${id}`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
  return html`<div class="grammar-tab">
    <nav class="g-index" aria-label="Grammar points">${gs.map((g, i) => html`<button type="button" onClick=${() => go(g.id)}>
      <span class="g-num">${i + 1}</span>${g.title}${S.practice[`g:${g.id}`] ? html` <span class="g-tick" aria-label="studied">✓</span>` : ''}</button>`)}</nav>
    <p class="quiet g-howto">Build each sentence or answer its questions, and the point joins your daily cards for review.</p>
    ${gs.map((g, i) => html`<${GrammarPoint} key=${g.id} data=${data} g=${g} i=${i} />`)}
  </div>`
}
TAB_VIEWS.grammar = GrammarTab

// ==== src/30-trainers.js ====
// ---- verb forms: generated from the infinitive and the three key forms (fährt, fuhr, ist gefahren) ----

export const PERSONS = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie']
const IRREGULAR = {
  sein: [['bin', 'bist', 'ist', 'sind', 'seid', 'sind'], ['war', 'warst', 'war', 'waren', 'wart', 'waren']],
  haben: [['habe', 'hast', 'hat', 'haben', 'habt', 'haben']],
  werden: [['werde', 'wirst', 'wird', 'werden', 'werdet', 'werden'], ['wurde', 'wurdest', 'wurde', 'wurden', 'wurdet', 'wurden']],
  wissen: [['weiß', 'weißt', 'weiß', 'wissen', 'wisst', 'wissen']],
  können: [['kann', 'kannst', 'kann', 'können', 'könnt', 'können']], müssen: [['muss', 'musst', 'muss', 'müssen', 'müsst', 'müssen']],
  wollen: [['will', 'willst', 'will', 'wollen', 'wollt', 'wollen']], dürfen: [['darf', 'darfst', 'darf', 'dürfen', 'dürft', 'dürfen']],
  sollen: [['soll', 'sollst', 'soll', 'sollen', 'sollt', 'sollen']], mögen: [['mag', 'magst', 'mag', 'mögen', 'mögt', 'mögen']],
  möchten: [['möchte', 'möchtest', 'möchte', 'möchten', 'möchtet', 'möchten']],
}
const KONJ2 = { sein: 'wäre', haben: 'hätte', werden: 'würde', können: 'könnte', müssen: 'müsste', dürfen: 'dürfte', wollen: 'wollte',
  sollen: 'sollte', mögen: 'möchte', wissen: 'wüsste', gehen: 'ginge', kommen: 'käme', geben: 'gäbe', bleiben: 'bliebe', lassen: 'ließe' }
const needsE = stem => /([td]|[^lrhmnaeiouäöü][mn])$/.test(stem)   // arbeit-et, öffn-et, but lern-t, wohn-t, komm-t

// The parts of a verb: prefix (separable), reflexive, infinitive core, present stems, and the key forms.
export function verbParts(w) {
  const reflexive = w.w.startsWith('sich ')
  const inf = w.w.replace(/^sich /, '')
  const [pres = '', past = '', perf = ''] = (w.f ?? '').split(', ').map(x => x.replace(' sich', ''))
  const presBits = pres.split(' '), pastBits = past.split(' ')
  const prefix = presBits.length > 1 ? presBits[presBits.length - 1] : ''
  const core = prefix && inf.startsWith(prefix) ? inf.slice(prefix.length) : inf
  const stem = core.replace(/(e?n)$/, '').replace(/el$/, 'el')
  const [aux, pp] = perf.includes(' ') ? [perf.split(' ')[0].split('/')[0], perf.split(' ').pop()] : ['hat', perf]
  return { inf, core, stem, prefix, reflexive, p3: presBits[0], past: pastBits[0], aux: aux === 'ist' ? 'sein' : 'haben', pp }
}

// Six present-tense forms, without the separable prefix (it goes to the end of the sentence).
export function present(w) {
  const v = verbParts(w)
  if (IRREGULAR[v.core]) return IRREGULAR[v.core][0]
  const { stem, p3 } = v
  const changed = p3.replace(/e?t$/, '')                      // fährt → fähr, liest → lies, arbeitet → arbeit
  const duStem = changed !== stem ? changed : stem
  const du = /[sßzx]$/.test(duStem) ? `${duStem}t` : needsE(stem) && duStem === stem ? `${stem}est` : `${duStem}st`
  const ihr = needsE(stem) ? `${stem}et` : `${stem}t`
  const wir = v.core.endsWith('eln') || v.core.endsWith('ern') ? v.core : `${stem}en`
  const ich = v.core.endsWith('eln') ? `${stem.slice(0, -2)}le` : `${stem}e`
  return [ich, du, p3, wir, ihr, wir]
}

export function preterite(w) {
  const v = verbParts(w)
  if (IRREGULAR[v.core]?.[1]) return IRREGULAR[v.core][1]
  const p = v.past
  if (/te$/.test(p)) return [p, `${p}st`, p, `${p}n`, `${p}t`, `${p}n`]
  const st = /[sßz]$/.test(p) ? `${p}est` : /[td]$/.test(p) ? `${p}est` : `${p}st`
  return [p, st, p, `${p}en`, /[td]$/.test(p) ? `${p}et` : `${p}t`, `${p}en`]
}

export function imperative(w) {
  const v = verbParts(w)
  if (v.core === 'sein') return ['sei', 'seid', 'seien Sie']
  const pres = present(w)
  const eToI = /i/.test(pres[2]) && /e/.test(v.stem) && !/ie/.test(v.stem) && pres[2] !== `${v.stem}t`   // nimmt, gibt, liest
  // e → i verbs take the changed stem (nimm! lies! iss!); werden keeps its own: werde!
  const du = v.core === 'werden' ? 'werde' : eToI ? pres[2].replace(/t$/, '') : needsE(v.stem) ? `${v.stem}e` : v.stem
  const sep = v.prefix ? ` ${v.prefix}` : ''
  const sich = v.reflexive ? [' dich', ' euch', ' sich'] : ['', '', '']
  return [`${du}${sich[0]}${sep}!`, `${pres[4]}${sich[1]}${sep}!`, `${pres[3]} Sie${sich[2]}${sep}!`]
}

// A sentence-ready form: "steht … auf", "hat … gemacht", "ist … gefahren".
export function perfect(w, i) {
  const v = verbParts(w)
  return `${present({ w: v.aux, f: '' })[i]} ${v.pp}`
}

// Wrong options a learner really produces, for a given right answer.
export function verbMistakes(w, tense, i) {
  const v = verbParts(w)
  const out = new Set()
  if (tense === 'perfect') {
    const other = v.aux === 'sein' ? 'haben' : 'sein'
    out.add(`${present({ w: other, f: '' })[i]} ${v.pp}`)                                  // wrong auxiliary
    if (/en$/.test(v.pp)) out.add(`${present({ w: v.aux, f: '' })[i]} ${v.pp.replace(/en$/, 't')}`)   // gefahrt
    else if (/t$/.test(v.pp)) out.add(`${present({ w: v.aux, f: '' })[i]} ${v.pp.replace(/t$/, 'en')}`)
    if (v.prefix) out.add(`${present({ w: v.aux, f: '' })[i]} ge${v.prefix}${v.pp.slice(v.prefix.length + 2)}`)   // geaufstanden
    else if (!v.pp.startsWith('ge')) out.add(`${present({ w: v.aux, f: '' })[i]} ge${v.pp}`)                      // gebesucht
    else out.add(`${present({ w: v.aux, f: '' })[i]} ${v.pp.slice(2)}`)                                           // fahren without ge-
  }
  if (tense === 'present') {
    const pres = present(w)
    const regular = [`${v.stem}e`, `${v.stem}st`, `${v.stem}t`, `${v.stem}en`, `${v.stem}t`, `${v.stem}en`]
    if (regular[i] !== pres[i]) out.add(regular[i])                       // the missed stem change: er fahrt
    pres.forEach((f, k) => { if (f !== pres[i]) out.add(f) })            // another person's ending
  }
  if (tense === 'preterite') {
    const pt = preterite(w)
    if (!/te$/.test(v.past)) out.add([`${v.stem}te`, `${v.stem}test`, `${v.stem}te`, `${v.stem}ten`, `${v.stem}tet`, `${v.stem}ten`][i])   // fahrte
    pt.forEach(f => { if (f !== pt[i]) out.add(f) })
  }
  out.delete(tense === 'perfect' ? perfect(w, i) : tense === 'present' ? present(w)[i] : preterite(w)[i])
  return [...out]
}

export function konj2(w) {
  const v = verbParts(w)
  const base = KONJ2[v.core]
  if (!base) return ['würde', 'würdest', 'würde', 'würden', 'würdet', 'würden'].map(f => `${f} … ${v.inf}`)
  const st = base.replace(/e$/, '')
  return v.core === 'sein' ? ['wäre', 'wärst', 'wäre', 'wären', 'wärt', 'wären'] : [base, `${st}est`, base, `${st}en`, `${st}et`, `${st}en`]
}
const passive = (w, i) => `${present({ w: 'werden', f: '' })[i]} … ${verbParts(w).pp}`

// What the trainer asks, and from which station it is taught (forms unlock as the route reaches them).
const VERB_TENSES = [
  { id: 'present', name: 'Präsens', en: 'present', from: 1, forms: w => present(w) },
  { id: 'imperative', name: 'Imperativ', en: 'command', from: 9 },
  { id: 'perfect', name: 'Perfekt', en: 'past (spoken)', from: 11, forms: w => PERSONS.map((_, i) => perfect(w, i)) },
  { id: 'preterite', name: 'Präteritum', en: 'past (written)', from: 27, forms: w => preterite(w) },
  { id: 'konj2', name: 'Konjunktiv II', en: 'would / could', from: 23, forms: w => konj2(w) },
  { id: 'passive', name: 'Passiv', en: 'passive', from: 26, forms: w => PERSONS.map((_, i) => passive(w, i)) },
]
const ENDINGS = ['est', 'st', 'et', 'en', 'te', 't', 'e', 'n']
const splitEnd = f => { const e = ENDINGS.find(x => f.endsWith(x) && f.length - x.length >= 2) ?? ''; return [f.slice(0, f.length - e.length), e] }

// One question: a person and a verb; the options are the right form and real mistakes.
function verbQuestion(w, tense) {
  const v = verbParts(w)
  const sep = v.prefix ? ` … ${v.prefix}` : ''
  if (tense === 'imperative') {
    const k = Math.floor(Math.random() * 3)
    const right = imperative(w)[k]
    const pres = present(w)
    const wrong = k === 0 ? [`${pres[1]}${sep}!`, `${pres[2]}${sep}!`, `${v.stem}e${sep}!`, `${v.stem}${sep}!`]
      : k === 1 ? [`${pres[1]}${sep}!`, `${pres[3]}${sep}!`, `${pres[4]} ihr${sep}!`] : [`Sie ${pres[3]}${sep}!`, `${pres[3]}${sep}!`, `${pres[4]} Sie${sep}!`]
    const opts = shuffle([right, ...shuffle([...new Set(wrong)].filter(x => x !== right)).slice(0, 3)])
    return { who: ['du', 'ihr', 'Sie'][k], right, opts, a: opts.indexOf(right) }
  }
  const t = VERB_TENSES.find(x => x.id === tense)
  const i = Math.floor(Math.random() * 6)
  const forms = t.forms(w)
  const right = forms[i] + (tense === 'present' || tense === 'preterite' ? sep : '')
  let wrong = tense === 'konj2' ? [forms[i].replace('ü', 'u').replace('ä', 'a').replace('ö', 'o'), ...forms.filter(f => f !== forms[i])]
    : tense === 'passive' ? [`${present({ w: 'sein', f: '' })[i]} … ${v.pp}`, `${present({ w: 'haben', f: '' })[i]} … ${v.pp}`, ...forms.filter(f => f !== forms[i])]
    : verbMistakes(w, tense, i).map(f => f + (tense === 'present' || tense === 'preterite' ? sep : ''))
  wrong = [...new Set(wrong)].filter(f => f !== right)
  const opts = shuffle([right, ...shuffle(wrong).slice(0, 3)])
  return { who: PERSONS[i].split('/')[0], i, right, opts, a: opts.indexOf(right) }
}

function VerbTable({ w, tense }) {
  const t = VERB_TENSES.find(x => x.id === tense)
  if (tense === 'imperative') {
    return html`<table class="vtable" lang="de"><tbody>${['du', 'ihr', 'Sie'].map((p, k) => html`<tr><th>${p}</th><td>${imperative(w)[k]}</td></tr>`)}</tbody></table>`
  }
  const sep = verbParts(w).prefix
  return html`<table class="vtable" lang="de"><tbody>${t.forms(w).map((f, i) => {
    const [stem, end] = tense === 'present' || tense === 'preterite' ? splitEnd(f) : [f, '']
    return html`<tr><th>${PERSONS[i]}</th><td>${stem}<b class="vend">${end}</b>${sep && (tense === 'present' || tense === 'preterite') ? html` <i>… ${sep}</i>` : ''}</td></tr>`
  })}</tbody></table>`
}

function VerbsTrainer({ data }) {
  const s = useStore()
  const verbs = useMemo(() => {
    const ok = data.words.filter(w => w.p === 'v' && w.f && !/\//.test(w.f.replace('hat/ist', '')))
    const mine = ok.filter(w => w.n <= s.lesson)
    return mine.length >= 20 ? mine : ok.slice(0, 40)
  }, [data, s.lesson])
  const open = VERB_TENSES.filter(t => t.from <= Math.max(s.lesson, 1))
  const [on, setOn] = useState(() => open.map(t => t.id))
  const [round, setRound] = useState(0)
  const [picked, setPicked] = useState(null)
  const [table, setTable] = useState(false)
  const [score, setScore] = useState({ right: 0, total: 0 })
  const tenses = on.filter(id => open.some(t => t.id === id))
  const q = useMemo(() => {
    const w = verbs[Math.floor(Math.random() * verbs.length)]
    const tense = tenses[Math.floor(Math.random() * tenses.length)] ?? 'present'
    return w && { w, tense, ...verbQuestion(w, tense) }
  }, [round, verbs, tenses.join()])
  const choose = k => {
    if (picked !== null || !q) return
    setPicked(k)
    setScore(x => ({ right: x.right + (k === q.a), total: x.total + 1 }))
    speak(`${q.tense === 'imperative' ? '' : `${q.who} `}${q.right.replace(/…/g, '')}`)
  }
  const next = () => { setPicked(null); setTable(false); setRound(r => r + 1) }
  useEffect(() => {
    const onKey = e => {
      if (/^[1-4]$/.test(e.key) && q && +e.key <= q.opts.length) choose(+e.key - 1)
      else if ((e.key === 'Enter' || e.key === ' ') && picked !== null && !e.target.closest?.('button, a')) { e.preventDefault(); next() }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })
  const toggle = id => setOn(xs => (xs.includes(id) ? (xs.length > 1 ? xs.filter(x => x !== id) : xs) : [...xs, id]))
  if (!q) return html`<main class="page"><header class="masthead"><h1>Verb forms</h1><p>The verbs are being written now.</p></header></main>`
  const t = VERB_TENSES.find(x => x.id === q.tense)
  const v = verbParts(q.w)
  const [inStem, inEnd] = splitEnd(v.core)
  const [outStem, outEnd] = q.tense === 'present' || q.tense === 'preterite' ? splitEnd(q.right.replace(/ … .*$/, '')) : [q.right, '']
  return html`<main class="page trainer">
    <header class="masthead"><h1>Verb forms</h1>
      <p>Pick the right form. The wrong options are the mistakes learners really make: the wrong helper verb, a missed vowel change, a split prefix in the wrong place.</p></header>
    <div class="modes" role="group" aria-label="Forms to practise">
      ${VERB_TENSES.map(x => {
        const locked = x.from > s.lesson
        return html`<button type="button" disabled=${locked} class=${tenses.includes(x.id) && !locked ? 'on' : ''} aria-pressed=${tenses.includes(x.id)}
          onClick=${() => toggle(x.id)} title=${locked ? `Taught at ${data.stations[x.from].level} station ${data.stations[x.from].k}` : x.en}>
          ${x.name}${locked ? html` <small>from ${data.stations[x.from].level}·${data.stations[x.from].k}</small>` : ''}</button>`
      })}
      <span class="score">${score.right} of ${score.total} right</span>
    </div>
    <article key=${round} class=${`drill verb${picked === null ? '' : picked === q.a ? ' right' : ' wrong'}`}>
      <p class="v-tense">${t.name} <span class="quiet">· ${t.en}</span></p>
      <p class="v-ask" lang="de"><span class="v-who">${q.tense === 'imperative' ? `(${q.who})` : q.who}</span>
        <span class="v-blank">${picked === null ? '___' : q.right}</span></p>
      <p class="v-inf"><span lang="de">${q.w.w}</span> · ${q.w.en}</p>
      <ol class="drill-opts verbs">${q.opts.map((o, k) => html`<li><button type="button" disabled=${picked !== null} onClick=${() => choose(k)}
        class=${picked === null ? '' : k === q.a ? 'right' : k === picked ? 'wrong' : 'dim'}><kbd>${k + 1}</kbd><span lang="de">${o}</span></button></li>`)}</ol>
      ${picked !== null ? html`<div class="drill-why">
        ${q.tense === 'present' || q.tense === 'preterite' ? html`<p class="v-morph" lang="de" aria-label=${`${v.core} becomes ${q.right}`}>
          <span class="v-stem">${inStem}</span><span class="v-old">${inEnd}</span><span class="v-arrow">→</span>
          <span class="v-stem">${outStem}</span><span class="v-new">${outEnd}</span></p>` : ''}
        <p>${picked === q.a ? html`<b>Right.</b> ` : html`<b>It's <span lang="de">${q.who} ${q.right}</span>.</b> `}
          ${q.tense === 'perfect' ? html`<span lang="de">${v.core}</span> takes <b lang="de">${v.aux}</b>${v.aux === 'sein' ? ' (a change of place or state)' : ''}; Partizip II <b lang="de">${v.pp}</b>.` : ''}</p>
        <div class="after">
          <button type="button" onClick=${() => setTable(x => !x)} aria-expanded=${table}>${table ? 'Hide' : 'Show'} the full table</button>
          <button type="button" class="btn" onClick=${next}>Next verb <kbd>Enter</kbd></button>
        </div>
        ${table ? html`<${VerbTable} w=${q.w} tense=${q.tense} />` : ''}
      </div>` : ''}
    </article>
  </main>`
}
PAGES.verbs = VerbsTrainer

// ---- cases and endings ----

const CASES = ['Nominativ', 'Akkusativ', 'Dativ', 'Genitiv']
const GENDERS = [['der', 'masculine'], ['die', 'feminine'], ['das', 'neuter'], ['pl', 'plural']]
const CASE_SETS = {
  'der, die, das': [['der', 'die', 'das', 'die'], ['den', 'die', 'das', 'die'], ['dem', 'der', 'dem', 'den'], ['des', 'der', 'des', 'der']],
  'ein, kein': [['ein', 'eine', 'ein', 'keine'], ['einen', 'eine', 'ein', 'keine'], ['einem', 'einer', 'einem', 'keinen'], ['eines', 'einer', 'eines', 'keiner']],
  'mein, dein …': [['mein', 'meine', 'mein', 'meine'], ['meinen', 'meine', 'mein', 'meine'], ['meinem', 'meiner', 'meinem', 'meinen'], ['meines', 'meiner', 'meines', 'meiner']],
}
const PRONOUNS = [['ich', 'mich', 'mir'], ['du', 'dich', 'dir'], ['er', 'ihn', 'ihm'], ['sie', 'sie', 'ihr'], ['es', 'es', 'ihm'],
  ['wir', 'uns', 'uns'], ['ihr', 'euch', 'euch'], ['sie', 'sie', 'ihnen'], ['Sie', 'Sie', 'Ihnen']]
// adjective endings by case × gender: weak (after der/die/das), mixed (after ein/kein/mein), strong (no article)
export const ADJ = {
  weak: [['e', 'e', 'e', 'en'], ['en', 'e', 'e', 'en'], ['en', 'en', 'en', 'en'], ['en', 'en', 'en', 'en']],
  mixed: [['er', 'e', 'es', 'en'], ['en', 'e', 'es', 'en'], ['en', 'en', 'en', 'en'], ['en', 'en', 'en', 'en']],
  strong: [['er', 'e', 'es', 'e'], ['en', 'e', 'es', 'e'], ['em', 'er', 'em', 'en'], ['en', 'er', 'en', 'er']],
}
const ADJ_NOUNS = [['Kaffee', 'Kaffees'], ['Suppe', 'Suppe'], ['Brot', 'Brotes'], ['Äpfel', 'Äpfel']]   // nominative, genitive
export function adjPhrase(kind, c, g) {
  const art = kind === 'weak' ? CASE_SETS['der, die, das'][c][g] : kind === 'mixed' ? CASE_SETS['ein, kein'][c][g] : ''
  const [noun, gen] = ADJ_NOUNS[g]
  const n = c === 3 ? gen : c === 2 && g === 3 ? 'Äpfeln' : noun
  return [art, `frisch${ADJ[kind][c][g]}`, n].filter(Boolean).join(' ')
}

function CaseTable() {
  const [set, setSet] = useState('der, die, das')
  const [row, setRow] = useState(null)
  const pron = set === 'pronouns'
  const rows = pron ? PRONOUNS : CASE_SETS[set]
  return html`<section class="cases-sec" aria-labelledby="ct-h">
    <h2 id="ct-h">The case table</h2>
    <p class="quiet">Highlighted forms change from the Nominativ: the masculine is the one that changes most (der → den → dem → des).</p>
    <div class="modes" role="group" aria-label="Words in the table">${[...Object.keys(CASE_SETS), 'pronouns'].map(k => html`<button type="button"
      class=${set === k ? 'on' : ''} aria-pressed=${set === k} onClick=${() => { setSet(k); setRow(null) }}>${k}</button>`)}</div>
    <table key=${set} class=${`ctable${pron ? ' pron' : ''}`} lang="de">
      <thead><tr><th></th>${pron ? ['Nominativ', 'Akkusativ', 'Dativ'].map(c => html`<th>${c}</th>`)
        : GENDERS.map(([a, en]) => html`<th class=${`g-${a}`}><span class="art">${a === 'pl' ? 'die' : a}</span><small>${en}</small></th>`)}</tr></thead>
      <tbody>${pron ? rows.map(r => html`<tr>${r.map((f, k) => (k ? html`<td class=${f !== r[0] ? 'chg' : ''}>${f}</td>` : html`<th>${f}</th>`))}<td class="pad"></td></tr>`)
        : rows.map((r, c) => html`<tr class=${row === c ? 'on' : ''} onClick=${() => setRow(row === c ? null : c)}><th>${CASES[c]}</th>
          ${r.map((f, g) => html`<td class=${`g-${GENDERS[g][0]}${f !== rows[0][g] ? ' chg' : ''}`}>${f}</td>`)}</tr>`)}</tbody>
    </table>
  </section>`
}

// Wo? (where something is: dative) or Wohin? (where something goes: accusative), with the nine two-way prepositions.
const SPOTS = { in: [0, 4, 'im', 'in den'], auf: [0, -55, 'auf dem', 'auf den'], unter: [0, 92, 'unter dem', 'unter den'],
  neben: [150, 18, 'neben dem', 'neben den'], vor: [-30, 70, 'vor dem', 'vor den'], hinter: [40, -40, 'hinter dem', 'hinter den'],
  über: [0, -150, 'über dem', 'über den'], an: [-108, 18, 'am', 'an den'] }
function TwoWay() {
  const [prep, setPrep] = useState('in')
  const [mode, setMode] = useState('wo')
  const [x, y, dat, acc] = SPOTS[prep]
  const say = mode === 'wo' ? `Der Ball liegt ${dat} Karton.` : `Ich lege den Ball ${acc} Karton.`
  return html`<section class="cases-sec" aria-labelledby="tw-h">
    <h2 id="tw-h">Wo? or Wohin?</h2>
    <p class="quiet">The same nine prepositions take the Dativ when something <b>is</b> somewhere, and the Akkusativ when it <b>moves</b> there.</p>
    <div class="modes" role="group" aria-label="Question">
      <button type="button" class=${mode === 'wo' ? 'on' : ''} aria-pressed=${mode === 'wo'} onClick=${() => setMode('wo')}>Wo? → Dativ</button>
      <button type="button" class=${mode === 'wohin' ? 'on' : ''} aria-pressed=${mode === 'wohin'} onClick=${() => setMode('wohin')}>Wohin? → Akkusativ</button>
    </div>
    <div class="tw">
      <svg class="tw-scene" viewBox="-260 -200 520 320" role="img" aria-label=${say}>
        <path d="M-250 110 H250" stroke="var(--rule)" stroke-width="4" />
        <g class=${`tw-box${prep === 'in' ? ' open' : ''}`}><rect x="-70" y="-30" width="140" height="100" rx="4" fill="#B98852" /><path d="M-70 -30 H70" stroke="#8A5F33" stroke-width="6" />
          <text x="0" y="60" text-anchor="middle" class="tw-label">der Karton</text></g>
        <g key=${prep + mode} class=${`tw-ball ${mode}`} style=${`--x:${x}px;--y:${y}px`}>
          <circle r="22" fill="var(--die)" /><path d="M-14 -8 a18 18 0 0 1 20 -10" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7" />
        </g>
        ${mode === 'wohin' ? html`<path key=${`arrow${prep}`} class="tw-arrow" d=${`M-210 -150 Q${x / 2 - 120} ${Math.min(y, 0) - 120} ${x} ${y - 30}`} />` : ''}
      </svg>
      <div class="tw-side">
        <div class="tw-preps" role="group" aria-label="Preposition">${Object.keys(SPOTS).map(p => html`<button type="button" lang="de"
          class=${prep === p ? 'on' : ''} aria-pressed=${prep === p} onClick=${() => setPrep(p)}>${p}</button>`)}</div>
        <p class="tw-say" lang="de">${say} <${SayButton} text=${say} /></p>
        <p class="quiet">${mode === 'wo' ? html`Wo liegt der Ball? It is already there: <b lang="de">${dat} Karton</b> (Dativ).`
          : html`Wohin lege ich den Ball? It moves there: <b lang="de">${acc} Karton</b> (Akkusativ).`}
          ${' '}Also zwischen: <span lang="de">zwischen dem Karton und der Tasche</span>.</p>
      </div>
    </div>
  </section>`
}

// Adjective endings: three questions decide the ending; the path taken lights up.
function AdjEndings() {
  const [kind, setKind] = useState('weak')
  const [c, setC] = useState(0)
  const [g, setG] = useState(0)
  const phrase = adjPhrase(kind, c, g)
  const node = (k, label, sub) => html`<button type="button" class=${`ad-node${kind === k ? ' on' : ''}`} aria-pressed=${kind === k} onClick=${() => setKind(k)}>
    <b>${label}</b><small>${sub}</small></button>`
  return html`<section class="cases-sec" aria-labelledby="ad-h">
    <h2 id="ad-h">Adjective endings</h2>
    <p class="quiet">Ask: what stands before the adjective? The article already shows the gender and case, the adjective only adds -e or -en. Without one, the adjective has to show it itself.</p>
    <div class="ad">
      <div class="ad-tree">
        <p class="ad-q">What comes before the adjective?</p>
        <div class="ad-row">${node('weak', 'der, die, das, dieser …', 'weak: -e or -en')}${node('mixed', 'ein, kein, mein …', 'mixed')}${node('strong', 'nothing', 'strong: like der/die/das')}</div>
      </div>
      <div class="ad-pick">
        <div class="modes" role="group" aria-label="Case">${CASES.map((x, k) => html`<button type="button" class=${c === k ? 'on' : ''} aria-pressed=${c === k} onClick=${() => setC(k)}>${x}</button>`)}</div>
        <div class="modes" role="group" aria-label="Gender">${GENDERS.map(([a, en], k) => html`<button type="button" class=${`g-${a}${g === k ? ' on' : ''}`} aria-pressed=${g === k} onClick=${() => setG(k)}>${en}</button>`)}</div>
        <p class=${`ad-out g-${GENDERS[g][0]}`} key=${phrase} lang="de">${phrase.split(' ').map(w => (w.startsWith('frisch') ? html`frisch<b class="ad-end">${w.slice(6)}</b> ` : `${w} `))}</p>
        <table class="ctable small" lang="de"><thead><tr><th></th>${GENDERS.map(([a]) => html`<th class=${`g-${a}`}><span class="art">${a === 'pl' ? 'pl.' : a}</span></th>`)}</tr></thead>
          <tbody>${ADJ[kind].map((r, ci) => html`<tr class=${ci === c ? 'on' : ''}><th>${CASES[ci].slice(0, 3)}</th>${r.map((e, gi) => html`<td class=${ci === c && gi === g ? 'hit' : ''}>-${e}</td>`)}</tr>`)}</tbody></table>
      </div>
    </div>
  </section>`
}

const CASE_GRAMMAR = /accusative|dative|two-way|stellen|acc-pronouns|possessive|adj-|genitive|n-declension|local-preps|articles/
const PREPS = [[['durch', 'für', 'gegen', 'ohne', 'um'], 1], [['aus', 'bei', 'mit', 'nach', 'seit', 'von', 'zu'], 2]]
function casePhraseQuestion(nouns) {
  const w = nouns[Math.floor(Math.random() * nouns.length)]
  const [list, c] = PREPS[Math.floor(Math.random() * 2)]
  const p = list[Math.floor(Math.random() * list.length)]
  const g = { der: 0, die: 1, das: 2 }[w.a]
  const right = CASE_SETS['der, die, das'][c][g]
  const opts = shuffle([...new Set([right, ...CASE_SETS['der, die, das'].map(r => r[g])])]).slice(0, 4)
  if (!opts.includes(right)) opts[0] = right
  const o = shuffle(opts)
  return { q: html`<span lang="de">${p} <span class="gap"></span> ${w.w}</span> <span class="quiet">(<${Word} w=${w} />)</span>`, opts: o, a: o.indexOf(right),
    why: html`<b lang="de">${p}</b> always takes the ${CASES[c]}: <span lang="de">${p} ${right} ${w.w}</span>.`, say: `${p} ${right} ${w.w}` }
}

function CasesPage({ data }) {
  const s = useStore()
  const [quiz, setQuiz] = useState(null)
  const start = () => {
    const nouns = data.words.filter(w => w.p === 'n' && ['der', 'die', 'das'].includes(w.a) && w.n <= Math.max(s.lesson, 12))
    const gqs = data.grammar.filter(g => CASE_GRAMMAR.test(g.id) && g.n <= Math.max(s.lesson, 12)).flatMap(g => data.gq[g.id] ?? [])
    const gen = nouns.length ? Array.from({ length: 6 }, () => casePhraseQuestion(nouns)) : []
    setQuiz(shuffle([...gen, ...gqQuiz(gqs).slice(0, 10 - gen.length)]))
  }
  return html`<main class="page cases">
    <header class="masthead"><h1>Cases and endings</h1>
      <p>German shows a noun's job in the sentence with its article: <span lang="de">der</span> Mann does something, you see <span lang="de">den</span> Mann,
        you give <span lang="de">dem</span> Mann something. English does this only with pronouns: he, him.</p></header>
    <${CaseTable} />
    <${TwoWay} />
    <${AdjEndings} />
    <section class="cases-sec" aria-labelledby="cq-h">
      <h2 id="cq-h">Practice</h2>
      ${quiz ? html`<div class="quiz-box"><${Quiz} key=${quiz} qs=${quiz} again=${start} /></div>`
        : html`<button type="button" class="btn" onClick=${start}>Ten questions on cases <${Arrow} /></button>`}
    </section>
  </main>`
}
PAGES.cases = CasesPage

// ---- der/die/das trainer: a noun appears, tap its article; the ending rule is taught after each answer ----

// der/die/das from the ending, most reliable rules first. Taught after every answer in the gender trainer.
const GENDER_RULES = [
  [/(chen|lein)$/, 'das', '-chen and -lein (small things) are always das'],
  [/(ung|heit|keit|schaft|ion|tät)$/, 'die', '-ung, -heit, -keit, -schaft, -ion and -tät are always die'],
  [/(ling|ismus)$/, 'der', '-ling and -ismus are always der'],
  [/^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Frühling|Sommer|Herbst|Winter|Norden|Süden|Osten|Westen|Regen|Schnee|Wind|Nebel)$/,
    'der', 'days, months, seasons, compass points and weather are der'],
  [/(ment|um)$/, 'das', '-ment and -um are usually das'],
  [/(ist|or|ig|ich|eur|ant|ent)$/, 'der', '-ist, -or, -ig, -ich, -eur, -ant and -ent are usually der'],
  [/(ik|ur|enz|anz|ei|ie|age|ade)$/, 'die', '-ik, -ur, -enz, -anz, -ei, -ie and -age are usually die'],
  [/in$/, 'die', '-in for women and female animals is die (die Lehrerin)'],
  [/o$/, 'das', 'short foreign words in -o are usually das (das Auto, das Kino)'],
  [/e$/, 'die', 'most nouns ending in -e are die'],
]
export function genderRule(w, verbs = new Set()) {
  if (/en$/.test(w.w) && verbs.has(w.w.toLowerCase())) return { art: 'das', text: 'verbs used as nouns are das (das Essen)' }
  const r = GENDER_RULES.find(([re]) => re.test(w.w))
  return r && { art: r[1], text: r[2] }
}

// Plurals: the patterns German uses, so the wrong options are mistakes a learner really makes.
export const umlaut = s => s.replace(/(Au|au|A|a|O|o|U|u)([^aeiouäöüAEIOUÄÖÜ]*(?:e[rln])?)$/,
  (_, v, rest) => ({ Au: 'Äu', au: 'äu', A: 'Ä', a: 'ä', O: 'Ö', o: 'ö', U: 'Ü', u: 'ü' })[v] + rest)
function pluralChoices(w) {
  const x = w.w, u = umlaut(x), soft = /(e|e[rln])$/.test(x)
  const c = new Set([/e$/.test(x) || /e[rl]$/.test(x) ? `${x}n` : /en$/.test(x) ? '' : `${x}en`,
    !soft && `${x}e`, !soft && u !== x && `${u}e`, !soft && `${u}er`, `${x}s`, /e[rln]$/.test(x) && x,
    /e[rln]$/.test(x) && u !== x && u].filter(Boolean))
  c.delete(w.pl)
  return shuffle([w.pl, ...shuffle([...c]).slice(0, 3)])
}
export function pluralPattern(sg, pl) {
  const u = umlaut(sg) !== sg && pl.startsWith(umlaut(sg)) && !pl.startsWith(sg) ? 'umlaut + ' : ''
  const end = pl.slice((u ? umlaut(sg) : sg).length)
  return pl === sg ? 'no change' : u && !end ? 'umlaut only' : `${u}-${end}`
}

function GenderTrainer({ data }) {
  useStore()
  const [mode, setMode] = useState('gender')
  const nouns = useMemo(() => {
    const all = data.words.filter(w => w.p === 'n' && (mode === 'gender' ? w.a !== 'pl' : w.pl && w.pl !== '-'))
    const mine = all.filter(w => w.n <= S.lesson)
    return shuffle(mine.length >= 30 ? mine : all.slice(0, Math.max(60, mine.length)))
  }, [data, mode])
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState(null)
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 })
  const w = nouns[i % Math.max(nouns.length, 1)]
  const choices = useMemo(() => (w && mode === 'plural' ? pluralChoices(w) : ['der', 'die', 'das']), [w, mode])
  const correct = w && (mode === 'gender' ? w.a : w.pl)
  const choose = k => {
    if (picked !== null || !w) return
    setPicked(k)
    const ok = choices[k] === correct
    setScore(x => ({ right: x.right + ok, total: x.total + 1, streak: ok ? x.streak + 1 : 0 }))
    speak(mode === 'gender' ? said(w) : `die ${w.pl}`)
  }
  const next = () => { setPicked(null); setI(x => x + 1) }
  useEffect(() => {
    const onKey = e => {
      if (/^[1-4]$/.test(e.key) && +e.key <= choices.length) choose(+e.key - 1)
      else if ((e.key === 'Enter' || e.key === ' ') && picked !== null && !e.target.closest?.('button, a')) { e.preventDefault(); next() }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })
  const switchTo = m => { setMode(m); setI(0); setPicked(null) }
  if (!w) return html`<main class="page"><header class="masthead"><h1>der, die, das</h1><p>The nouns are being written now.</p></header></main>`
  const rule = mode === 'gender' && genderRule(w, data.verbSet)
  const ok = picked !== null && choices[picked] === correct
  return html`<main class="page trainer">
    <header class="masthead"><h1>${mode === 'gender' ? 'der, die, das' : 'Plurals'}</h1>
      <p>${mode === 'gender' ? 'Tap the article. After each answer you see the ending rule that decides it, or that the noun is one to learn by heart.'
        : 'Pick the plural. German has a handful of plural patterns; the ending of the noun and its gender predict most of them.'}</p></header>
    <div class="modes" role="group" aria-label="Drill">
      <button type="button" class=${mode === 'gender' ? 'on' : ''} aria-pressed=${mode === 'gender'} onClick=${() => switchTo('gender')}>Gender</button>
      <button type="button" class=${mode === 'plural' ? 'on' : ''} aria-pressed=${mode === 'plural'} onClick=${() => switchTo('plural')}>Plural</button>
      <span class="score">${score.right} of ${score.total} right${score.streak > 2 ? html` · <b>${score.streak} in a row</b>` : ''}</span>
    </div>
    <article key=${w.id + mode} class=${`drill${picked === null ? '' : ok ? ' right' : ' wrong'}${picked !== null && mode === 'gender' ? ` g-${w.a}` : ''}`}>
      <p class="drill-word" lang="de">${mode === 'gender'
        ? html`<span class="drill-art">${picked === null ? '___' : ART[w.a]}</span> ${w.w}`
        : html`<${Word} w=${w} /> → die <span class="drill-art">${picked === null ? '___' : w.pl}</span>`}</p>
      <p class="drill-en">${w.en}</p>
      <ol class=${`drill-opts ${mode}`}>${choices.map((c, k) => html`<li><button type="button" disabled=${picked !== null} onClick=${() => choose(k)}
        class=${`${mode === 'gender' ? `g-${c}` : ''}${picked === null ? '' : c === correct ? ' right' : k === picked ? ' wrong' : ' dim'}`}>
        <kbd>${k + 1}</kbd><span lang="de">${c}</span></button></li>`)}</ol>
      ${picked !== null ? html`<div class="drill-why">
        <p>${ok ? html`<b>Right.</b> ` : html`<b>It's <span lang="de">${mode === 'gender' ? said(w) : `die ${w.pl}`}</span>.</b> `}
          ${mode === 'gender'
            ? rule ? rule.art === w.a ? html`Rule: ${rule.text}.` : html`An exception: ${rule.text}, but <span lang="de">${said(w)}</span> is not. Learn it by heart.`
              : 'No ending rule here: learn it together with its article.'
            : html`Pattern: <b>${pluralPattern(w.w, w.pl)}</b>.`}</p>
        <${Example} w=${w} />
        <button type="button" class="btn" onClick=${next}>Next word <kbd>Enter</kbd></button>
      </div>` : ''}
    </article>
  </main>`
}
PAGES.gender = GenderTrainer

// ==== src/40-reading.js ====
// ---- reading: the station's texts in the Goethe Lesen formats ----

const sentences = t => t.blocks.flatMap(b => b.s.map((p, k) => ({ id: `${b.id}.${k}`, de: p[0], en: p[1] })))
const textWords = t => sentences(t).reduce((a, s) => a + s.de.split(/\s+/).length, 0)
const TEXT_TYPE = { sms: 'Text messages', email: 'Email', postcard: 'Postcard', ad: 'Small ads', ads: 'Small ads', web: 'Web pages',
  sign: 'Signs', notice: 'Notices', article: 'Newspaper article', directory: 'Directory board', blog: 'Blog post',
  comments: 'Reader comments', rules: 'House rules', terms: 'Terms and conditions', instructions: 'Instructions' }

// ---- known words in a text (L11) ----
// Forms the rules in wordForms miss: articles, contractions, irregular verbs, pronoun cases, comparatives.
const tokens = s => s.match(/\p{L}+(?:-\p{L}+)*/gu) ?? []
const MORE_FORMS = {
  der: 'die den dem des', jeder: 'jede jeden jedem jedes', in: 'im ins', an: 'am ans', zu: 'zum zur', von: 'vom', bei: 'beim',
  sein: 'bin bist sind seid wäre wären seine seinen seinem seiner seines', haben: 'habe hast habt hätte hätten',
  werden: 'werde wirst werdet würde würden', können: 'kannst', müssen: 'musst', dürfen: 'darfst', wollen: 'willst', mögen: 'magst',
  wissen: 'weißt', er: 'ihm', sie: 'ihnen', gut: 'besser best', viel: 'mehr meist', gern: 'lieber', groß: 'größer größt',
  alt: 'älter ältest', jung: 'jünger jüngst', lang: 'länger längst', kurz: 'kürzer', warm: 'wärmer', kalt: 'kälter', hoch: 'höher hoh',
  nah: 'näher nächst',
}
let formIndex = null   // lower-case form → course word, the earliest station's first
function courseForms() {
  if (formIndex) return formIndex
  formIndex = new Map()
  for (const w of D.words) {
    const more = MORE_FORMS[w.w]?.split(' ') ?? []
    const forms = [...wordForms(w), ...more, ...(w.p === 'adj' ? more.flatMap(f => ['e', 'en', 'er', 'es', 'em'].map(e => f + e)) : []),
      ...(w.p === 'v' ? [w.w.replace(/^sich /, '').replace(/e?n$/, '')] : []),            // the stem: imperatives (Komm! Ruf an!)
      ...(w.p !== 'n' && w.p !== 'v' && /e$/.test(w.w) ? ['m', 'n', 'r', 's'].map(e => w.w + e) : []),   // alle → alles, allem
      ...(w.a === 'der' ? ['in', 'innen'].map(e => w.w.replace(/e$/, '') + e) : [])]     // Freund → Freundin, Kollege → Kollegin
    for (const f of forms) if (f.length > 1 && !formIndex.has(f.toLowerCase())) formIndex.set(f.toLowerCase(), w)
  }
  return formIndex
}
// The share of a text's words the learner knows; isKnown(word) decides. Names, numbers and addresses (no course word,
// and the same in the English) don't count.
function knownShare(t, isKnown) {
  const ix = courseForms()
  let all = 0, yes = 0
  const unknown = new Map()   // lower-case token → its course word, or null if the course doesn't teach it
  for (const b of t.blocks) for (const [de, en] of b.s) {
    const same = new Set(tokens(en))
    for (const tok of tokens(de)) {
      const w = ix.get(tok.toLowerCase())
      if (!w && same.has(tok)) continue
      all++
      if (w && isKnown(w)) yes++
      else unknown.set(tok.toLowerCase(), w ?? null)
    }
  }
  return { share: all ? yes / all : 1, unknown }
}
// ---- end of known words ----

// A part's progress on the station: the mean best score over the station's texts (or recordings).
const saveBest = (key, id, n, list, p) => commit(x => {
  x.practice[`${key}:${id}`] = Math.max(x.practice[`${key}:${id}`] ?? 0, p)
  x.practice[`${n}/${key === 'r' ? 'read' : 'listen'}`] = list.reduce((a, y) => a + (x.practice[`${key}:${y.id}`] ?? 0), 0) / list.length
})

// One question in an exam format: richtig/falsch, ja/nein, a/b/c or a letter from the texts (x: none fits).
function ExamQuestion({ q, k, pick, onPick, done, onShow, where = 'text' }) {
  const right = done && pick === q.a
  const letter = j => (q.format === 'abc' ? 'abc'[j] : null)
  return html`<li class=${`eq${done ? (right ? ' right' : ' wrong') : ''}`}>
    <p class="eq-q"><span class="eq-n">${k + 1}</span><span lang="de">${q.q}</span></p>
    <div class=${`eq-opts ${q.format}`}>${q.opts.map((o, j) => html`<button type="button" lang="de" disabled=${done} aria-pressed=${pick === j}
      class=${`${pick === j ? 'on' : ''}${done && j === q.a ? ' answer' : ''}`} onClick=${() => onPick(j)}>
      ${letter(j) ? html`<b class="eq-l">${letter(j)}</b>` : ''}${q.format === 'match' && o === 'x' ? html`x <small>none fits</small>` : o}</button>`)}</div>
    ${done ? html`<p class="eq-why">${right ? html`<b>Right.</b> ` : html`<b>The answer is ${letter(q.a) ? `${letter(q.a)}: ` : ''}<span lang="de">${q.opts[q.a]}</span>${/[.!?…]$/.test(q.opts[q.a]) ? '' : '.'}</b> `}${q.why}
      ${q.ev?.length ? html` <button type="button" class="linkish" onClick=${() => onShow(q.ev)}>Show it in the ${where}</button>` : ''}</p>` : ''}
  </li>`
}

// Messages (texts, emails, postcards): a greeting that follows a message body starts the next message.
const MESSAGE = { sms: 'SMS', email: 'E-Mail', postcard: 'Postkarte' }
function messages(blocks) {
  const out = []
  blocks.forEach((b, k) => {
    if (!out.length || (b.t === 'h' && blocks[k + 1] && blocks[k + 1].t !== 'h' && out[out.length - 1].some(x => x.t !== 'h'))) out.push([])
    out[out.length - 1].push(b)
  })
  return out
}
const Stamp = () => html`<svg class="pc-stamp" viewBox="0 0 44 52" aria-hidden="true"><rect x="2" y="2" width="40" height="48" rx="2" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2" />
  <circle cx="22" cy="20" r="8" fill="var(--line)" /><path d="M8 42 L18 30 L25 37 L30 32 L37 42 Z" fill="currentColor" opacity=".5" /></svg>`
const Envelope = () => html`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
  <path d="M3 6l9 7 9-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /></svg>`
const Phone = () => html`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="2" />
  <path d="M10 18.5h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>`

// The reader. Help (tap a sentence for English, the glossary, known words) is off in exam mode (tests).
function Reader({ t, exam, onDone, onNext }) {
  useStore()
  const [guess, setGuess] = useState(exam || S.practice[`r:${t.id}`] !== undefined ? -1 : null)   // L12: predict first
  const [open, setOpen] = useState(new Set())
  const [gloss, setGloss] = useState(null)
  const [picks, setPicks] = useState({})
  const [done, setDone] = useState(false)
  const [lit, setLit] = useState(new Set())
  const [speakingAt, setSpeakingAt] = useState(null)
  const [marks, setMarks] = useState(false)
  const [time, setTime] = useState({ start: null, first: null, againStart: null, again: null })
  const [, tick] = useState(0)
  const ref = useRef()
  useEffect(() => () => stopSpeech(), [])
  useEffect(() => { if (guess !== null) setTime(x => ({ ...x, start: x.start ?? Date.now() })) }, [guess])
  useEffect(() => {   // the clock of the timed re-read
    if (!time.againStart || time.again) return
    const id = setInterval(() => tick(k => k + 1), 1000)
    return () => clearInterval(id)
  }, [time.againStart, time.again])
  const words = textWords(t)
  const wpm = ms => Math.round(words / (Math.max(ms, 1000) / 60000))
  const FAST = 400   // ponytail: above this it was skimmed, not read; a learner reads about 100–250 words a minute
  const qs = t.questions ?? []   // tests pass the text alone and ask the questions themselves
  const all = qs.every((_, k) => picks[k] !== undefined)
  const score = qs.filter((q, k) => picks[k] === q.a).length
  const pick = (k, j) => {
    if (time.first === null) setTime(x => ({ ...x, first: Date.now() - x.start }))   // reading time: up to the first answer
    setPicks(p => ({ ...p, [k]: j }))
  }
  const check = () => {
    setDone(true)
    if (!exam) saveBest('r', t.id, t.n, D.readingBy[t.n], score / qs.length)
    onDone?.(score, qs.length)
  }
  const show = ev => {
    setLit(new Set(ev))
    setTimeout(() => ref.current?.querySelector('.sent.lit')?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' }), 50)
  }
  const readAloud = () => {
    if (speakingAt !== null) { stopSpeech(); setSpeakingAt(null); return }
    const ss = sentences(t)
    speakLines(ss.map(x => ['N', x.de]), { onLine: i => setSpeakingAt(i < 0 ? null : ss[i].id) })
  }
  const againGo = () => { setTime(x => ({ ...x, againStart: Date.now(), again: null })); ref.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' }) }
  const knows = exam ? null : knownShare(t, w => known(w.id))
  const target = exam ? null : knownShare(t, w => w.n <= t.n).share   // once this station's words are learned
  const glossRe = gloss && new RegExp(`(?<!\\p{L})(${esc(gloss)}\\p{L}*)`, 'giu')

  // One sentence: tap it for the English. Shows glossary and not-yet-learned marks.
  const sentence = (x, cls = '') => {
    const body = (glossRe ? x.de.split(glossRe) : [x.de]).map((p, k) => (k % 2 ? html`<mark class="gl">${p}</mark>`
      : marks ? p.split(/(\p{L}+(?:-\p{L}+)*)/u).map((w, j) => (j % 2 && knows.unknown.has(w.toLowerCase()) ? html`<u class=${knows.unknown.get(w.toLowerCase()) ? 'unk' : 'unk new'}>${w}</u>` : w)) : p))
    const toggle = () => setOpen(o => { const n = new Set(o); n.has(x.id) ? n.delete(x.id) : n.add(x.id); return n })
    return html`<span class=${`sent${cls}${lit.has(x.id) ? ' lit' : ''}${speakingAt === x.id ? ' now' : ''}${open.has(x.id) ? ' open' : ''}`}
      onClick=${exam ? null : toggle}><span lang="de">${body}</span>${open.has(x.id) ? html`<small class="sent-en">${x.en}</small>` : ''} </span>`
  }
  const ss = b => b.s.map((p, k) => ({ id: `${b.id}.${k}`, de: p[0], en: p[1] }))
  const block = (b, msg) => {
    const xs = ss(b)
    if (b.t === 'h') return msg ? html`<p class="rb-greet">${xs.map(x => sentence(x))}</p>` : html`<h3 class="rb-h">${xs.map(x => sentence(x))}</h3>`
    if (b.t === 'list') return html`<ul class="rb-list">${xs.map(x => {
      const at = x.de.indexOf(': ')   // a directory row: "4. Stock: Tische und Stühle"
      return html`<li>${at > 0 && at < 16 ? html`<b class="rb-floor" lang="de">${x.de.slice(0, at)}</b>${sentence({ ...x, de: x.de.slice(at + 2) })}` : sentence(x)}</li>`
    })}</ul>`
    if (b.t === 'ad' || b.t === 'sign' || b.t === 'comment') {
      return html`<div class=${`rb-${b.t}`}>${b.t === 'comment' ? html`<p class="rb-who"><span class="rb-av" aria-hidden="true">${b.label?.[0]}</span><span lang="de">${b.label}</span></p>`
        : b.label ? html`<span class="rb-label">${b.label}</span>` : ''}<p>${xs.map(x => sentence(x))}</p></div>`
    }
    // a message body: a closing without a full stop ("Viele Grüße, Lena") goes on its own line
    return html`<p class="rb-p">${xs.map((x, k) => sentence(x, msg && k === xs.length - 1 && k && !/[.!?…:“"]$/.test(x.de.trim()) ? ' rb-close' : ''))}</p>`
  }
  // consecutive ads, signs or comments sit together in a grid
  const body = () => {
    if (MESSAGE[t.type]) {
      return messages(t.blocks).map((m, k) => html`<div class=${`msg msg-${t.type}${k % 2 ? ' alt' : ''}`}>
        <p class="msg-head">${t.type === 'sms' ? html`<${Phone} />` : t.type === 'email' ? html`<${Envelope} />` : ''}<span lang="de">${MESSAGE[t.type]}</span></p>
        ${t.type === 'postcard' ? html`<${Stamp} />` : ''}${m.map(b => block(b, true))}</div>`)
    }
    const out = []
    for (const b of t.blocks) {
      const last = out[out.length - 1]
      if (['ad', 'sign', 'comment'].includes(b.t)) {
        if (last?.kind === b.t) last.items.push(b)
        else out.push({ kind: b.t, items: [b] })
      } else out.push({ kind: null, items: [b] })
    }
    return out.map(g => (g.kind ? html`<div class=${`rb-group rg-${g.kind}`}>${g.items.map(b => block(b))}</div>` : block(g.items[0])))
  }

  const predict = guess === null || guess >= 0 ? html`<section class=${`predict${guess === null ? '' : ' done'}`} aria-label="Predict first">
    <div class="predict-q">
      <span class="lb">Before you read</span>
      <p>${guess === null ? html`<b lang="de">${t.title}</b> · ${TEXT_TYPE[t.type] ?? t.type}. ` : ''}${t.predict.q}</p>
    </div>
    <div class="guess-opts">${t.predict.opts.map((o, j) => html`<button type="button" disabled=${guess !== null} onClick=${() => setGuess(j)}
      class=${guess === null ? '' : j === t.predict.a ? 'right' : j === guess ? 'wrong' : 'dim'}>${o}</button>`)}</div>
    ${guess === null ? html`<p class="quiet">Guess first: a guess, even a wrong one, gets your mind ready for the text.</p>`
      : html`<p class="predict-after"><b>${guess === t.predict.a ? 'Your guess was right.' : 'Not this time.'}</b> Read on and see.</p>`}
  </section>` : ''
  if (guess === null) return predict

  const p = done ? score / qs.length : 0
  const timing = time.againStart && !time.again
  return html`<div class=${`read-wrap${exam ? ' exam' : ''}`}>${predict}<div class=${`reader${exam ? ' exam' : ''}${qs.length ? '' : ' solo'}${timing ? ' timed' : ''}`} ref=${ref}>
    <article class="r-text">
      <header class="r-head">
        <span class="lb">Lesen ${t.part}</span><span class="r-type">${TEXT_TYPE[t.type] ?? t.type} · ${words} words</span>
        ${timing ? html`<span class="r-clock" role="timer">${fmtClock(Date.now() - time.againStart)}</span>
          <button type="button" class="btn" onClick=${() => setTime(x => ({ ...x, again: Date.now() - x.againStart }))}>Done reading</button>` : ''}
        ${exam ? '' : html`<button type="button" class=${`r-aloud${speakingAt !== null ? ' on' : ''}`} onClick=${readAloud}><${Speaker} /> ${speakingAt !== null ? 'Stop' : 'Read it to me'}</button>`}
      </header>
      ${t.intro ? html`<p class="r-intro">${t.intro}</p>` : ''}
      <div class=${`r-body t-${t.type}`}>${body()}</div>
      ${exam ? '' : html`<footer class="r-help">
        <div class="r-known">
          <span class="kmeter" style=${`--k:${knows.share};--t:${target}`} aria-hidden="true"><i></i><b></b></span>
          <p><b>You know ${pct(knows.share)} of the words here.</b> ${target > knows.share + .005 ? html`With this station's words learned: ${pct(target)}.` : ''}
          ${knows.unknown.size ? html` <button type="button" class="linkish" onClick=${() => setMarks(m => !m)}>${marks ? 'Hide the marks' : `Mark the ${plural(knows.unknown.size, 'word')} not learned yet`}</button>` : ''}</p>
        </div>
        ${t.glossary?.length ? html`<div class="r-gloss"><b>Glossary</b>${t.glossary.map(g => html`<button type="button" class=${gloss === g.w ? 'on' : ''} aria-pressed=${gloss === g.w}
          onClick=${() => setGloss(gloss === g.w ? null : g.w)}><span lang="de">${g.w}</span> <small>${g.en}</small></button>`)}</div>` : ''}
        <p class="quiet r-tip">Tap a sentence to see it in English.</p>
      </footer>`}
    </article>
    ${qs.length ? html`<section class="r-qs" aria-label="Questions">
      <h3>${plural(qs.length, 'question')}</h3>
      <ol class="eqs">${qs.map((q, k) => html`<${ExamQuestion} q=${q} k=${k} pick=${picks[k]} done=${done} onShow=${show} onPick=${j => pick(k, j)} />`)}</ol>
      ${!done ? html`<button type="button" class="btn" disabled=${!all} onClick=${check}>${all ? 'Check my answers' : `Answer all ${qs.length} questions`}</button>`
        : html`<div class="r-result">
          <span class=${`stamp ${p >= .6 ? 'pass' : 'fail'}`}>${p >= .6 ? 'Bestanden' : 'Noch nicht'}</span>
          <p><b>${score} of ${qs.length}</b> right.${!exam && time.first && wpm(time.first) <= FAST ? ` You read at about ${wpm(time.first)} words per minute.` : ''}</p>
          ${exam ? '' : html`<div class="r-again">${timing ? html`<p class="quiet">Reading against the clock: press Done reading at the top when you reach the end.</p>`
              : time.again ? html`<p>${wpm(time.again) > FAST ? 'That was very fast. Read every word, then press Done reading.'
                : html`Second read: <b>${wpm(time.again)} words per minute</b>${wpm(time.first) <= FAST ? ` (first: ${wpm(time.first)})` : ''}. ${wpm(time.again) > wpm(time.first) ? 'Faster: that is fluency growing.' : 'Read it once more tomorrow: it gets faster.'}`}</p>`
              : html`<button type="button" onClick=${againGo}>Read it again against the clock</button>`}
            ${onNext ? html`<button type="button" class="btn" onClick=${onNext}>Next text <${Arrow} /></button>` : ''}</div>`}
        </div>`}
    </section>` : ''}
  </div></div>`
}
const fmtClock = ms => { const s = Math.floor(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

// Tiles to pick one of the station's texts or recordings: its exam part, a title and the best score so far.
function Picks({ items, i, setI, label, part, title, sub, keyOf }) {
  return html`<div class="text-picks" role="tablist" aria-label=${label}>${items.map((x, k) => {
    const best = S.practice[`${keyOf}:${x.id}`]
    return html`<button type="button" role="tab" aria-selected=${k === i} class=${k === i ? 'on' : ''} onClick=${() => { stopSpeech(); setI(k) }}>
      <span class="tp-top"><span class="lb">${part} ${x.part}</span>${best !== undefined ? html`<span class=${`tp-best${best >= .6 ? ' pass' : ''}`}>best ${pct(best)}</span>` : ''}</span>
      <b>${title(x)}</b><small>${sub(x)}</small></button>`
  })}</div>`
}

function ReadTab({ data, n }) {
  useStore()
  const ts = data.readingBy[n] ?? []
  const [i, setI] = useState(0)
  if (!ts.length) return html`<p class="soon">This station's reading texts are being written now: Goethe Lesen formats, with tap-to-translate.</p>`
  const k = Math.min(i, ts.length - 1), t = ts[k]
  const next = k + 1 < ts.length ? () => { setI(k + 1); scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }) } : null
  return html`<div class="read-tab">
    <${Picks} items=${ts} i=${k} setI=${setI} label="Texts" part="Lesen" keyOf="r" title=${x => html`<span lang="de">${x.title}</span>`}
      sub=${x => `${TEXT_TYPE[x.type] ?? x.type} · ${plural(x.questions.length, 'question')}`} />
    <${Reader} key=${t.id} t=${t} onNext=${next} />
  </div>`
}
TAB_VIEWS.read = ReadTab

// ==== src/45-listening.js ====
// ---- recording: MediaRecorder, and the browser's German speech recognition where it has one ----

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
// Records the microphone; where SpeechRecognition (de-DE) exists, also writes down what it heard. Audio never leaves
// the browser.
function useRecorder() {
  const [st, setSt] = useState({ state: 'idle', url: null, heard: '', error: null })
  const rec = useRef(null)
  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setSt(x => ({ ...x, state: 'idle', error: 'This browser cannot record. Use Chrome or Edge on this laptop.' }))
      return false
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream), chunks = []
      mr.ondataavailable = e => chunks.push(e.data)
      mr.onstop = () => {
        stream.getTracks().forEach(tr => tr.stop())
        setSt(x => ({ ...x, state: 'done', url: URL.createObjectURL(new Blob(chunks, { type: mr.mimeType })) }))
      }
      let sr = null
      if (SpeechRec) {
        try {
          sr = new SpeechRec()
          sr.lang = 'de-DE'; sr.interimResults = true; sr.continuous = true
          sr.onresult = e => setSt(x => ({ ...x, heard: [...e.results].map(r => r[0].transcript).join(' ') }))
          sr.onerror = () => {}
          sr.start()
        } catch { sr = null }
      }
      rec.current = { mr, sr }
      mr.start()
      setSt({ state: 'rec', url: null, heard: '', error: null })
      return true
    } catch (e) {
      setSt(x => ({ ...x, state: 'idle', error: e.name === 'NotAllowedError' ? 'The microphone is blocked. Allow it in the address bar (the lock icon), then try again.'
        : e.name === 'NotFoundError' ? 'No microphone found. Plug in a headset or check Windows sound settings.' : `Recording failed (${e.message}).` }))
      return false
    }
  }
  const stop = () => { const r = rec.current; if (!r) return; try { r.sr?.stop() } catch {} if (r.mr.state !== 'inactive') r.mr.stop(); rec.current = null }
  useEffect(() => () => stop(), [])
  return { ...st, start, stop }
}

// Words of the target the recogniser heard, for a quick "did it come out right" check.
const heardWords = (target, heard) => {
  const h = new Set(tokens(heard.toLowerCase()))
  return tokens(target).map(w => [w, h.has(w.toLowerCase())])
}

// Shadowing (L14): hear a line, say it straight after, then hear the voice and yourself back to back.
function Shadow({ who, de }) {
  const r = useRecorder()
  const [phase, setPhase] = useState('ready')
  const [err, setErr] = useState(null)
  const audio = useRef()
  const go = () => {
    if (!deVoices().length) { setErr('No German voice to copy: see the note at the top.'); return }
    setErr(null)
    setPhase('listen')
    speakLines([[who, de]], { onEnd: async () => {
      if (!(await r.start())) { setPhase('ready'); return }
      setPhase('say')
      setTimeout(() => { r.stop(); setPhase('compare') }, 1500 + tokens(de).length * 650)
    } })
  }
  useEffect(() => {
    if (phase !== 'compare' || !r.url) return
    speakLines([[who, de]], { onEnd: () => audio.current?.play() })
  }, [phase, r.url])
  return html`<span class="shadow">
    <button type="button" class=${`mini${phase === 'say' ? ' rec' : ''}`} onClick=${go} disabled=${phase === 'say'}
      title="Hear the line, say it straight after, then hear both">
      ${phase === 'listen' ? 'Listen…' : phase === 'say' ? html`<span class="rec-dot"></span> Say it now` : html`<${Mic} /> Shadow`}</button>
    ${r.url ? html`<audio ref=${audio} src=${r.url} controls class="mini-audio"></audio>` : ''}
    ${r.heard ? html`<span class="heard" lang="de">${heardWords(de, r.heard).map(([w, ok]) => html`<span class=${ok ? 'ok' : 'miss'}>${w}</span> `)}</span>` : ''}
    ${r.error || err ? html`<span class="rec-err">${r.error || err}</span>` : ''}
  </span>`
}
const Mic = () => html`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" />
  <path d="M6 11a6 6 0 0 0 12 0M12 17v4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>`

// ---- listening: the station's recordings in the Goethe Hören formats, read by German voices ----

// What each Hören part is (docs/08-exam-formats.md), for the pick tiles.
const HEAR_KIND = {
  A1: { 'Teil 1': 'Short dialogue', 'Teil 2': 'Announcement', 'Teil 3': 'Phone message' },
  A2: { 'Teil 1': 'On the radio', 'Teil 2': 'Conversation', 'Teil 3': 'Short dialogue', 'Teil 4': 'Radio interview' },
  B1: { 'Teil 1': 'Short recording', 'Teil 2': 'Talk or guided tour', 'Teil 3': 'Conversation', 'Teil 4': 'Radio discussion' },
}
// Speaker A is a woman, B a man, N an announcer (or the host, when others speak too).
const whoName = (who, it) => (who === 'A' ? 'Woman' : who === 'B' ? 'Man' : it.lines.some(l => l.who !== 'N') ? 'Host' : 'Announcer')
const Person = ({ who }) => (who === 'N'
  ? html`<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="22" y="30" width="4" height="16" rx="1" fill="currentColor" />
    <path d="M6 15h7l13-9v28l-13-9H6z" fill="currentColor" /><path d="M31 13a9 9 0 0 1 0 14M36 8a16 16 0 0 1 0 24" class="arc" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>`
  : html`<svg viewBox="0 0 48 48" aria-hidden="true">
    ${who === 'A' ? html`<path d="M14.5 30C12 22 13.5 9 24 9s12 13 9.5 21c-2.5 1.5-5 1-6.5-1h-6c-1.5 2-4 2.5-6.5 1z" fill="currentColor" />` : ''}
    <rect x="21" y="24" width="6" height="9" class="face" /><circle cx="24" cy="19" r="8.5" class="face" />
    ${who === 'A' ? html`<path d="M15.6 19.5C15.5 13 19 10 24 10s8.8 3.5 8.5 9c-3.5-1.5-7.5-4-9.5-6.5-1.5 3-4 5.5-7.4 7z" fill="currentColor" />`
      : html`<path d="M15.5 18.5c-.5-7 3.5-10.5 8.5-10.5s9 3.5 8.5 10.5c-2-3.5-5-4.5-8.5-4.5s-6.5 1-8.5 4.5z" fill="currentColor" />`}
    <path d="M7 47c1-10 7.5-15 17-15s16 5 17 15z" fill="currentColor" />
    ${who === 'B' ? html`<path d="M20 32.5l4 5 4-5" fill="none" class="collar" stroke-width="2.5" stroke-linejoin="round" />` : ''}</svg>`)
const PlayIcon = ({ on }) => html`<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">${on
  ? html`<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />` : html`<path d="M8 5.5v13l11-6.5z" fill="currentColor" />`}</svg>`

// The German voices the browser has; null while its list is still loading (Brave may list none and never say so).
function useGermanVoices() {
  const has = () => 'speechSynthesis' in window && speechSynthesis.getVoices().length > 0
  const [n, setN] = useState(() => (!('speechSynthesis' in window) ? 0 : has() ? deVoices().length : null))
  useEffect(() => {
    if (!('speechSynthesis' in window)) return
    const f = () => setN(deVoices().length)
    speechSynthesis.addEventListener('voiceschanged', f)
    const t = setTimeout(f, 1500)
    return () => { speechSynthesis.removeEventListener('voiceschanged', f); clearTimeout(t) }
  }, [])
  return n
}
const NoVoice = () => html`<div class="no-voice" role="status">
  <p><b>No German voice in this browser, so the recordings can't play.</b> Read the transcript instead, and add a voice:</p>
  <ol><li>Windows Settings → Time & language → Speech → Add voices → German (Deutsch).</li>
    <li>Quit the browser fully (every window) and open the app again.</li></ol>
  <p class="quiet">Or open the app in Microsoft Edge, which has natural German voices built in.</p>
</div>`

function ListenItem({ it, exam, onDone, onNext }) {
  const voices = useGermanVoices()
  const [plays, setPlays] = useState(0)
  const [at, setAt] = useState(null)
  const [slow, setSlow] = useState(false)
  const [picks, setPicks] = useState({})
  const [done, setDone] = useState(false)
  const [lit, setLit] = useState(new Set())
  const ref = useRef()
  useEffect(() => () => stopSpeech(), [])
  const mute = voices === 0
  const limit = it.once ? 1 : 2
  const play = rate => {
    if (at !== null) { stopSpeech(); setAt(null); return }
    setPlays(p => p + 1)
    speakLines(it.lines.map(l => [l.who, l.de]), { rate: rate ?? (slow ? .7 : undefined), onLine: i => setAt(i < 0 ? null : i) })
  }
  const sayLine = l => { setAt(null); speakLines([[l.who, l.de]]) }
  const qs = it.questions ?? []   // tests pass the recording alone and ask the questions themselves
  const all = qs.every((_, k) => picks[k] !== undefined)
  const score = qs.filter((q, k) => picks[k] === q.a).length
  const check = () => {
    setDone(true); stopSpeech(); setAt(null)
    if (!exam) saveBest('h', it.id, it.n, D.listeningBy[it.n], score / qs.length)
    onDone?.(score, qs.length)
  }
  const show = ev => {
    setLit(new Set(ev))
    setTimeout(() => ref.current?.querySelector('.tl.lit')?.scrollIntoView({ block: 'center', behavior: reducedMotion() ? 'auto' : 'smooth' }), 50)
  }
  const speakers = [...new Set(it.lines.map(l => l.who))].sort()
  const evidence = new Set(qs.flatMap(q => q.ev ?? []))
  const total = it.lines.reduce((a, l) => a + l.de.length, 0)
  const p = done ? score / qs.length : 0
  return html`<div class=${`listen${exam ? ' exam' : ''}${qs.length ? '' : ' solo'}`} ref=${ref}>
    <div class="l-main">
      <section class=${`l-stage${at !== null ? ' playing' : ''}`} aria-label="Recording">
        <p class="l-setup"><span class="lb">Hören ${it.part}</span><span>${it.setup}</span></p>
        <div class="l-cast">${speakers.map(w => html`<figure class=${`person p-${w}${at !== null && it.lines[at]?.who === w ? ' talking' : ''}`}>
          <${Person} who=${w} /><figcaption>${whoName(w, it)}</figcaption></figure>`)}</div>
        <ol class="l-track" aria-label="Who speaks when">${it.lines.map((l, i) => html`<li class=${`p-${l.who}${at === i ? ' now' : at !== null && i < at ? ' past' : ''}`}
          style=${`flex-grow:${l.de.length / total}`} title=${whoName(l.who, it)}></li>`)}</ol>
        ${mute ? html`<${NoVoice} />` : html`<div class="l-controls">
          <button type="button" class=${`l-play${at !== null ? ' on' : ''}`} onClick=${() => play()} disabled=${exam && plays >= limit && at === null}
            aria-label=${at !== null ? 'Stop' : 'Play the recording'}><${PlayIcon} on=${at !== null} /></button>
          <div class="l-info">
            <b>${at !== null ? `Playing: line ${at + 1} of ${it.lines.length}` : plays ? 'Play it again' : 'Play the recording'}</b>
            <span class="l-plays">${exam ? `${plays} of ${limit} plays` : html`${[...Array(limit)].map((_, k) => html`<i class=${k < plays ? 'on' : ''}></i>`)}
              The exam plays it ${it.once ? 'once' : 'twice'}${plays > limit ? `; you've heard it ${plays} times` : ''}.`}</span>
          </div>
          ${exam ? '' : html`<div class="seg" role="group" aria-label="Speed">
            <button type="button" aria-pressed=${slow} class=${slow ? 'on' : ''} onClick=${() => setSlow(true)}>Slower</button>
            <button type="button" aria-pressed=${!slow} class=${slow ? '' : 'on'} onClick=${() => setSlow(false)}>Normal</button></div>`}
        </div>`}
        ${mute && !done && !exam ? html`<ol class="l-read">${it.lines.map(l => html`<li><span class=${`who p-${l.who}`}>${whoName(l.who, it)}</span> <span lang="de">${l.de}</span></li>`)}</ol>` : ''}
      </section>
      ${done && !exam ? html`<section class="transcript" aria-label="Transcript">
        <h3>What was said</h3>
        <ol>${it.lines.map((l, i) => html`<li class=${`tl${evidence.has(i) ? ' ev' : ''}${lit.has(i) ? ' lit' : ''}${at === i ? ' now' : ''}`}>
          <span class=${`who p-${l.who}`}>${whoName(l.who, it)}</span>
          <div class="tl-text"><span class="t-de" lang="de">${l.de}</span><small class="t-en">${l.en}</small></div>
          <div class="tl-do">${mute ? '' : html`<button type="button" class="say" aria-label="Play this line" onClick=${() => sayLine(l)}><${Speaker} /></button><${Shadow} who=${l.who} de=${l.de} />`}</div>
        </li>`)}</ol>
        <p class="quiet tl-key"><span class="ev-key"></span> The lines with the answers. Shadow a line: hear it, say it straight after, then hear both.</p>
      </section>` : ''}
    </div>
    ${qs.length ? html`<section class="r-qs l-qs" aria-label="Questions">
      <h3>${plural(qs.length, 'question')}</h3>
      <ol class="eqs">${qs.map((q, k) => html`<${ExamQuestion} q=${q} k=${k} pick=${picks[k]} done=${done} onShow=${show} where="transcript"
        onPick=${j => setPicks(x => ({ ...x, [k]: j }))} />`)}</ol>
      ${!done ? html`<button type="button" class="btn" disabled=${!all || (!plays && !mute)} onClick=${check}>${!plays && !mute ? 'Listen first' : all ? 'Check my answers' : `Answer ${qs.length > 1 ? `all ${qs.length} questions` : 'the question'}`}</button>`
        : html`<div class="r-result">
          ${qs.length > 2 ? html`<span class=${`stamp ${p >= .6 ? 'pass' : 'fail'}`}>${p >= .6 ? 'Bestanden' : 'Noch nicht'}</span>` : ''}
          <p><b>${score} of ${qs.length}</b> right. ${exam ? '' : 'The transcript is under the recording.'}</p>
          ${exam ? '' : html`<div class="r-again">${mute ? '' : html`<button type="button" onClick=${() => play(1.1)}>${at !== null ? 'Stop' : 'Hear it again, faster'}</button>`}
            ${onNext ? html`<button type="button" class="btn" onClick=${onNext}>Next recording <${Arrow} /></button>` : ''}</div>`}
        </div>`}
    </section>` : ''}
  </div>`
}

function ListenTab({ data, n }) {
  useStore()
  const items = data.listeningBy[n] ?? []
  const [i, setI] = useState(0)
  if (!items.length) return html`<p class="soon">This station's recordings are being written now: Goethe Hören formats, read by German voices.</p>`
  const k = Math.min(i, items.length - 1), it = items[k]
  const next = k + 1 < items.length ? () => { stopSpeech(); setI(k + 1); scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }) } : null
  return html`<div class="listen-tab">
    <${Picks} items=${items} i=${k} setI=${setI} label="Recordings" part="Hören" keyOf="h" title=${x => x.setup.split(/[:.]\s/)[0]}
      sub=${x => `${HEAR_KIND[x.level]?.[x.part] ?? 'Recording'} · ${plural(x.questions.length, 'question')}`} />
    <${ListenItem} key=${it.id} it=${it} onNext=${next} />
  </div>`
}
TAB_VIEWS.listen = ListenTab

// ==== src/50-writing.js ====
// ---- writing: the station's Schreiben task, in the format of its Goethe part ----
// The task card, its content points ticking off as they show up in the text, a live word count, phrases to insert,
// simple honest hints (no AI), a draft saved as you type, then the model answer and a self-score in the Goethe
// criteria. Progress: S.practice['<station>/write'] keeps the best self-score (for a form, the share of fields right).

// What each Schreiben part is (docs/08-exam-formats.md): its name, icon and the exam's length target.
const WRITE_KIND = {
  A1: { 'Teil 1': ['Formular', 'form', '5 fields'], 'Teil 2': ['Kurze Nachricht', 'note', 'about 30 words'] },
  A2: { 'Teil 1': ['SMS', 'note', '20–30 words'], 'Teil 2': ['E-Mail', 'mail', '30–40 words'] },
  B1: { 'Teil 1': ['Persönliche E-Mail', 'mail', 'about 80 words'], 'Teil 2': ['Forumsbeitrag', 'forum', 'about 80 words'],
    'Teil 3': ['Halbformelle E-Mail', 'mail', 'about 40 words'] },
}
const TASK_ICON = {
  form: html`<rect x="8" y="6" width="24" height="30" rx="2" /><path d="M15 3h10v6H15zM13 17h3M19 17h8M13 23h3M19 23h8M13 29h3M19 29h8" />`,
  note: html`<path d="M7 8h26a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H17l-7 6v-6H7a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3z" /><path d="M11 15h18M11 20h11" />`,
  mail: html`<rect x="4" y="9" width="32" height="22" rx="3" /><path d="M5 11l15 11 15-11" />`,
  forum: html`<path d="M4 6h20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H12l-5 4v-4H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" /><path d="M30 13h5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2v4l-5-4H18a2 2 0 0 1-2-2v-1" />`,
  speak: html`<rect x="15" y="4" width="10" height="19" rx="5" /><path d="M9 18a11 11 0 0 0 22 0M20 29v6M14 35h12" />`,
}
const TaskIcon = ({ kind }) => html`<svg class="w-icon" viewBox="0 0 40 40" aria-hidden="true">${TASK_ICON[kind]}</svg>`

// The exam sheet's head: module and part, what kind of text, the level, and the target.
const TaskHead = ({ t, kind, mod, name, extra }) => html`<header class="w-head">
  <${TaskIcon} kind=${kind} />
  <p class="w-mod"><b>${mod} ${t.part}</b><span lang="de">${name}</span></p>
  ${extra ? html`<span class="w-extra">${extra}</span>` : ''}<span class="lb">${t.level}</span>
</header>`

// The German instruction (a forum opinion „…“ – Name drawn as a post), then the English.
const TaskText = ({ t }) => html`<div class="w-de" lang="de">${t.task_de.split('\n').map(l => {
  const q = l.match(/^„(.+)“\s*–\s*(.+)$/)
  return q ? html`<figure class="w-post"><span class="w-post-av" aria-hidden="true">${q[2][0]}</span><figcaption>${q[2]}</figcaption><blockquote>${q[1]}</blockquote></figure>`
    : html`<p>${l}</p>`
})}</div><p class="w-en">${t.task_en}</p>`

// A draft per task in S.drafts[id]; typing saves at most every 600 ms, a click at once, and leaving saves too.
// set(patch) takes the changed fields, or a function of the latest draft (for quick clicks between renders).
function useDraft(id) {
  const [d, setD] = useState(() => ({ ...(S.drafts[id] ?? {}) }))
  const latest = useRef(d), timer = useRef(null)
  const save = () => { clearTimeout(timer.current); timer.current = null; commit(s => { s.drafts[id] = latest.current }) }
  const set = (patch, now) => {
    latest.current = { ...latest.current, ...(typeof patch === 'function' ? patch(latest.current) : patch) }
    setD(latest.current)
    clearTimeout(timer.current)
    timer.current = setTimeout(save, now ? 0 : 600)
  }
  useEffect(() => () => { if (timer.current) save() }, [])
  return [d, set]
}

// ---- the hints: simple checks a teacher would make first. They can't judge content; they say so. ----

export const countWords = s => (s.match(/[\p{L}\p{N}]+(?:[-'’.:][\p{L}\p{N}]+)*/gu) ?? []).length   // E-Mail, z.B., 18:00: one word each
const GREETING_RE = /^\s*(liebe[rs]?|hallo|hi|sehr geehrte[rs]?|guten (tag|morgen|abend)|moin|servus)(?!\p{L})/iu
// A closing near the end, maybe followed by a name of up to three words.
const CLOSING_RE = /(grüße|grüßen|gruß|tschüss|ciao|besserung|bis (bald|später|dann|morgen|gleich|nächste\p{L}*|\p{L}+tag)|danke(schön)?|vielen dank)(?!\p{L})[^\p{L}]*(\p{L}+[^\p{L}]*){0,3}$/iu
const sentencesOf = s => s.split(/(?<=\D[.!?])\s+|\n+/).map(x => x.trim()).filter(Boolean)

// du-forms, and Sie-forms not at a sentence start (there "Sie" may mean she or they).
function registerOf(s) {
  const du = (s.match(/(?<!\p{L})(du|dich|dir|dein|deine|deinen|deinem|deiner|deines|euch|euer|eure)(?!\p{L})/giu) ?? []).length
  const sie = (s.match(/(?<=\p{Ll}[,;]?\s+)(Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)(?!\p{L})/gu) ?? []).length + (/sehr geehrte/i.test(s) ? 1 : 0)
  return { du, sie }
}

// A time or place word first, then the subject: "Heute ich gehe" (the verb belongs in position 2).
const V2_ADV = 'heute|morgen|gestern|jetzt|dann|danach|später|zuerst|leider|vielleicht|deshalb|darum|trotzdem|außerdem|natürlich|hier|dort|'
  + 'abends|morgens|mittags|nachmittags|vormittags|manchmal|bald|endlich|zum glück|am \\p{L}+|im \\p{L}+|um [\\p{L}\\d.:]+(?:\\s+uhr)?|'
  + '(?:in|nach|vor) (?:der |dem |den |die |das )?\\p{L}+|nächste[nrs]? \\p{L}+|letzte[nrs]? \\p{L}+|jede[nrs]? \\p{L}+'
const V2_WRONG = new RegExp(`(?:^|(?<!\\p{L})(?:und|aber|oder|denn)\\s+)(${V2_ADV}),?\\s+(ich|du|er|sie|es|wir|ihr|man)\\s+(\\p{L}+)`, 'giu')
const NOT_VERB = new Set('und oder aber auch nicht noch schon sehr gern gerne immer oft wirklich heute morgen jetzt dann'.split(' '))
// After weil, dass, wenn … the finite verb goes to the end: "weil ich bin müde" → "weil ich müde bin". Only common
// verbs are checked, so a hit is nearly always right (ponytail: a word list, not a parser).
const SUB_WRONG = /(?<!\p{L})(weil|dass|wenn|obwohl|ob|als|bevor|nachdem|damit|falls)\s+(ich|du|er|sie|es|wir|ihr|man)\s+(\p{L}+)((?:\s+[^\s,.!?;:]+)+)/giu
const FINITE = new Set(('bin bist ist sind seid war warst waren habe hast hat haben habt hatte hattest hatten kann kannst können könnt konnte '
  + 'konnten muss musst müssen müsst musste mussten will willst wollen wollt wollte möchte möchtest möchten soll sollst sollen darf '
  + 'darfst dürfen werde wirst wird werden würde würdest würden gehe gehst geht gehen komme kommst kommt kommen').split(' '))
const LONG = { A1: 18, A2: 22, B1: 30 }

// The course's nouns by their lower-case spelling, for "nouns take a capital": only words that aren't also something
// else in lower case (essen, morgen, leid).
let nounIx = null
function nounIndex() {
  if (nounIx || !D) return nounIx ?? new Map()
  const other = new Set(D.words.filter(w => w.p !== 'n').flatMap(w => wordForms(w)).map(f => f.toLowerCase()))
  'weg mal recht leid schuld angst dank klasse spitze ernst morgen abend'.split(' ').forEach(x => other.add(x))
  nounIx = new Map()
  for (const w of D.words) {
    if (w.p !== 'n') continue
    for (const f of [w.w, ...(w.pl && w.pl !== '-' ? [w.pl] : [])]) {
      const l = f.toLowerCase()
      if (f.length > 2 && f[0] !== l[0] && !/\s/.test(f) && !other.has(l)) nounIx.set(l, f)
    }
  }
  return nounIx
}

export function writingHints(text, t, nouns = new Map()) {
  const out = [], n = countWords(text)
  if (!n) return out
  const lo = t.words?.[0] || 0, hi = t.words?.[1] || 0
  const example = re => t.phrases?.find(p => re.test(p[0]))?.[0]
  if (n >= 3 && GREETING_RE.test(t.model) && !GREETING_RE.test(text)) out.push({ k: 'frame', en: 'Start with a greeting.', de: example(GREETING_RE) ?? 'Liebe …,' })
  if (n >= lo * .6 && CLOSING_RE.test(t.model) && !CLOSING_RE.test(text.trim())) out.push({ k: 'frame', en: 'End with a closing and your name.', de: example(CLOSING_RE) ?? 'Viele Grüße' })
  const want = registerOf(t.model), mine = registerOf(text)
  const reg = want.sie > want.du ? 'Sie' : want.du ? 'du' : null
  if (mine.du && mine.sie) out.push({ k: 'reg', en: `You use both du and Sie. Stay with ${reg ?? 'one of them'} all the way through.` })
  else if (reg === 'du' && mine.sie) out.push({ k: 'reg', en: 'You say du to this reader: du, dir, dein, not Sie, Ihnen, Ihr.' })
  else if (reg === 'Sie' && mine.du) out.push({ k: 'reg', en: 'This reader gets the polite Sie: Sie, Ihnen, Ihr, not du, dir, dein.' })
  const ss = sentencesOf(text)
  let v2 = 0, vEnd = 0
  for (const s0 of ss) {
    const s = s0.replace(/^[^,]*,\s*/, g => (GREETING_RE.test(g) ? '' : g))   // "Lieber Felix, heute ich …": the clause after the greeting
    for (const m of s.matchAll(V2_WRONG)) {
      if (v2++ >= 2) break
      const ok = !NOT_VERB.has(m[3].toLowerCase())
      out.push({ k: 'order', en: `After “${m[1]}” at the start, the verb comes next (position 2).`, de: `${m[1]} ${m[2]} ${m[3]} → ${ok ? `${m[1]} ${m[3]} ${m[2]}` : `${m[1]} [verb] ${m[2]}`}` })
    }
    for (const m of s.matchAll(SUB_WRONG)) {
      if (!FINITE.has(m[3].toLowerCase())) continue
      const rest = m[4].trim().split(/\s+/)
      const cut = rest.findIndex(w => /^(und|oder|aber|sondern|denn)$/i.test(w))
      const mid = cut < 0 ? rest : rest.slice(0, cut)
      if (!mid.length || vEnd++ >= 2) continue
      out.push({ k: 'order', en: `After “${m[1]}” the verb goes to the end.`, de: `${m[1]} ${m[2]} ${m[3]} ${mid.join(' ')} → ${m[1]} ${m[2]} ${mid.join(' ')} ${m[3]}` })
    }
  }
  const low = [...new Set((text.match(/\p{L}+/gu) ?? []).filter(w => w === w.toLowerCase() && nouns.has(w)))]
  if (low.length) out.push({ k: 'caps', en: 'Nouns start with a capital letter.', de: low.slice(0, 4).map(w => `${w} → ${nouns.get(w)}`).join(', ') })
  const long = ss.map(countWords).find(c => c > (LONG[t.level] ?? 25))
  if (long) out.push({ k: 'long', en: `One sentence has ${long} words. Split it: short sentences hold fewer mistakes.` })
  const has = re => re.test(text)
  if (t.level === 'A2' && n >= 30 && !has(/(?<!\p{L})(und|aber|oder|denn|weil|dass|deshalb|trotzdem|wenn|dann|als)(?!\p{L})/iu)) {
    out.push({ k: 'link', en: 'Link your ideas: und, aber, denn, weil, deshalb.' })
  } else if (t.level === 'B1' && n >= 60) {   // the 80-word parts; a 40-word semi-formal email can be plain
    if (!has(/(?<!\p{L})(weil|dass|wenn|obwohl|als|ob|damit|nachdem|bevor|während|falls)(?!\p{L})/iu)) out.push({ k: 'link', en: 'No weil, dass, wenn or obwohl yet. B1 rewards linked sentences.' })
    else if (ss.length >= 4 && n / ss.length < 6) out.push({ k: 'link', en: 'Your sentences are all short. Join some with weil, dass, deshalb or obwohl.' })
  }
  if (hi && n > hi * 1.25) out.push({ k: 'long', en: `${n} words, well over ${hi}. The exam gives no points for extra length.` })
  return out
}

// Is a content point in the text? A guess from the point's key words (stems, so wohnen finds wohne), plus a few
// ideas that hide behind other words (a reason → weil, denn; a suggestion → wollen wir …). A point that asks for a
// question needs a "?". Names from the English task (Jonas, Lena) don't count as key words.
const PSTOP = new Set(('sie ihr ihre ihren ihrem ihrer ihnen sich wo wer was wann wie warum wen wem wohin woher welche welcher welches jetzt '
  + 'ist sind der die das den dem des ein eine einen einem einer und oder zu zum zur mit für von vor bei nach auf an am im in um aus frage fragen '
  + 'bitte bitten sagen nennen machen beschreiben begründen erklären schlagen stellen kurz etwas nicht es man ich wir du soll sollen können kann '
  + 'möchte hat haben wird sein noch auch über dort hier diese dieser dieses gibt kommen gehen').split(' '))
const CONCEPTS = [
  [/grund|warum/i, /(?<!\p{L})(weil|denn|deshalb|darum|grund|krank|arzt|termin|fieber|muss)|schmerz/iu],
  [/vorschlag|schlagen|lade|treffen/i, /(?<!\p{L})(wollen wir|sollen wir|können wir|könnten wir|lass uns|wie wäre|(hast|hättest|haben|hätten) (du|sie) lust|vorschlag|schlage|treffen wir|kommst du|kommen sie|willst du|möchtest du|man sollte)/iu],
  [/entschuldig/i, /(?<!\p{L})(leid|entschuldig|sorry|verzeih)/iu],
  [/dank/i, /(?<!\p{L})dank/iu],
  [/meinung/i, /(?<!\p{L})(meinung|finde|denke|glaube|stimme|verstehe)/iu],
  [/vorteil|nachteil/i, /(?<!\p{L})(vorteil|nachteil|positiv|negativ|praktisch|problem|chance|einerseits|andererseits)/iu],
  [/beispiel|erfahrung|ihrem leben|umfeld/i, /(?<!\p{L})(beispiel|z\. ?b\.|als ich|ich habe|bei uns|bei mir|in meine[mr]|meine? (firma|familie|freund|stadt|schule))/iu],
  [/problem|passiert/i, /(?<!\p{L})(problem|kaputt|funktioniert nicht|geht nicht|leider|verpasst)/iu],
  [/(?<!\p{L})wann(?!\p{L})|termin|zeit/iu, /(\d{1,2}(:\d\d)?\s*uhr|um \d|um (halb|viertel)|(?<!\p{L})(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|wochenende|morgen|übermorgen|heute|abend|nächste))/iu],
  [/was sie haben/i, /schmerz|krank|fieber|erkält|husten|grippe|(?<!\p{L})weh(?!\p{L})/iu],
  [/regen/i, /regn|regen/iu],
  [/früher|gemacht/i, /(?<!\p{L})(ge\p{L}{3,}(t|en)|war|waren|hatte|früher)(?!\p{L})/iu],
  [/stellen sie sich|vorstellen/i, /(?<!\p{L})(ich heiße|ich bin|mein name)/iu],
  [/gibt es/i, /(?<!\p{L})gibt(?!\p{L})/iu],
  [/bitten sie|hilfe/i, /(?<!\p{L})(kannst du|können sie|könntest du|könnten sie|bitte|hilf|helf)/iu],
  [/preis|kost/i, /(?<!\p{L})(kost|preis|euro|teuer|billig)|€/iu],
  [/(?<!\p{L})gut(?!\p{L})/iu, /(?<!\p{L})(besser|gesund|gesünder|fit|energie|spaß|gut)/iu],
  [/informier/i, /(?<!\p{L})(lese|höre|sehe|schaue|nachrichten|zeitung|handy|internet|radio|fernseh)/iu],
]
// What in the text looks like the point (a word, or a phrase like "um elf"), or null. Shown beside the tick, so the
// learner can see why it was ticked and judge it (ponytail: key words, not understanding; "Wann …" ticks on any time).
export function pointEvidence(text, point, names = '') {
  if (/^(Frage|Fragen Sie)/.test(point) && !text.includes('?')) return null
  const toks = text.match(/\p{L}+/gu) ?? []
  const skip = new Set((names.match(/\p{Lu}\p{L}+/gu) ?? []).map(x => x.toLowerCase()))
  const keys = (point.match(/\p{L}+/gu) ?? []).map(w => w.toLowerCase()).filter(w => w.length >= 4 && !PSTOP.has(w) && !skip.has(w))
  for (const k of keys) { const st = k.slice(0, Math.max(4, k.length - 2)), hit = toks.find(x => x.toLowerCase().includes(st)); if (hit) return hit }
  for (const [p, re] of CONCEPTS) { const m = p.test(point) && text.match(re); if (m) return m[0].trim() }
  return null
}
export const pointFound = (text, point, names) => pointEvidence(text, point, names) !== null

// ---- self-scoring in the Goethe criteria ----

// Each criterion: its German name, what it means, which of a task's rubric lines belong to it (the last one takes the
// rest), and its own line when the task has none for it. Speaking tasks have no rubric lines, so they use these.
const CRITERIA = {
  write: {
    A1: [{ de: 'Erfüllung der Aufgabenstellung', en: 'the three points', re: /point|answered/i, line: 'All three points are answered' },
      { de: 'Kommunikative Gestaltung', en: 'right for the reader', re: /greet|clos|forms? for|du and|du with|Sie and|throughout|polite|friendly|formal/i, line: 'A greeting, a closing, and du or Sie as fits the reader' },
      { de: 'Sprache', en: 'words and forms', line: 'The verb in position 2; nouns with capital letters' }],
    A2: [{ de: 'Erfüllung der Aufgabenstellung', en: 'the three points', re: /point|answered/i, line: 'All three points are answered' },
      { de: 'Kommunikative Gestaltung', en: 'right for the reader, ideas linked', re: /greet|clos|forms? for|du and|du with|Sie and|throughout|polite|friendly|formal|frame|connector/i, line: 'A greeting and closing that fit the reader' },
      { de: 'Formale Richtigkeit', en: 'correct forms', line: 'The verb in position 2, and at the end after weil and dass' }],
    B1: [{ de: 'Erfüllung', en: 'points, text type, register, length', re: /^(?!.*(link|connector)).*(point|words|react|opinion|greet|clos|Sie\b|Sie-|throughout|polite|friendly|short)/i, line: 'All three points, in the right register' },
      { de: 'Kohärenz', en: 'ideas linked into one text', re: /link|connector/i, line: 'Ideas are linked: weil, deshalb, aber, außerdem' },
      { de: 'Wortschatz', en: 'range and fit of the words', re: /vocabulary|word choice/i, line: 'Words fit the topic, without the same ones again and again' },
      { de: 'Strukturen', en: 'grammar range and accuracy', line: 'Varied sentences; few errors that hinder understanding' }],
  },
  speak: {
    A1: [{ de: 'Aufgabenerfüllung', en: 'the task', line: ['I used every card', 'My questions and answers fit the cards', 'A listener would understand every word'] }],
    A2: [{ de: 'Aufgabenerfüllung', en: 'the task', line: ['I covered every card or prompt', 'I reacted to what my partner said'] },
      { de: 'Wortschatz und Strukturen', en: 'words and grammar', line: ['I found the words I needed, or said it another way', 'The verb in position 2, and at the end after weil'] },
      { de: 'Aussprache', en: 'pronunciation', line: ['Clear sounds: ü, ö, ch, r'] }],
    B1: [{ de: 'Erfüllung', en: 'the task', line: ['I covered every point on the cards or slides'] },
      { de: 'Kohärenz', en: 'linked, easy to follow', line: ['My ideas were linked: zuerst, dann, deshalb, außerdem'] },
      { de: 'Wortschatz', en: 'range of words', line: ['When a word was missing, I said it another way'] },
      { de: 'Strukturen', en: 'grammar', line: ['Verb second; verb at the end after weil and dass'] },
      { de: 'Aussprache', en: 'pronunciation and melody', line: ['Clear sounds and a natural melody'] }],
  },
}
function rubricGroups(mod, level, lines = []) {
  const cs = CRITERIA[mod][level]
  const groups = cs.map(c => ({ de: c.de, en: c.en, lines: [] }))
  for (const l of lines) { const i = cs.findIndex(c => c.re?.test(l)); groups[i < 0 ? cs.length - 1 : i].lines.push(l) }
  groups.forEach((g, i) => { if (!g.lines.length) g.lines.push(...[].concat(cs[i].line)) })
  return groups
}
const rubricKeys = groups => groups.flatMap((g, gi) => g.lines.map((_, li) => `${gi}.${li}`))
const rubricScore = (groups, v = {}) => { const ks = rubricKeys(groups); return ks.every(k => v[k] !== undefined) ? ks.reduce((a, k) => a + v[k], 0) / ks.length : null }
const RATES = [[1, 'Yes'], [.5, 'Partly'], [0, 'Not yet']]

function SelfScore({ groups, value = {}, onRate }) {
  const score = rubricScore(groups, value)
  const left = rubricKeys(groups).filter(k => value[k] === undefined).length
  return html`<section class="w-rubric" aria-label="Score yourself">
    <h3>Score yourself</h3>
    <p class="quiet">In the Goethe criteria. Be strict: in the exam an examiner scores this part.</p>
    ${groups.map((g, gi) => html`<div class="w-crit">
      <p class="w-crit-h"><b lang="de">${g.de}</b> <span>${g.en}</span></p>
      <ul>${g.lines.map((l, li) => {
        const k = `${gi}.${li}`
        return html`<li><span>${l}</span><span class="w-seg" role="group" aria-label=${l}>${RATES.map(([x, label]) => html`<button type="button"
          aria-pressed=${value[k] === x} class=${value[k] === x ? `on r${x * 2}` : ''} onClick=${() => onRate(k, x)}>${label}</button>`)}</span></li>`
      })}</ul>
    </div>`)}
    <div class="w-total">${score === null ? html`<span class="quiet">${plural(left, 'line')} to rate.</span>`
      : html`<span class=${`stamp ${score >= .6 ? 'pass' : 'fail'}`}>${score >= .6 ? 'Bestanden' : 'Noch nicht'}</span>
        <p><b>${pct(score)}</b> by your own count. 60% passes.</p>`}</div>
  </section>`
}
// Rating a line saves it in the draft; once every line is rated, the station keeps the best score.
const rateIn = (set, groups, key) => (k, x) => set(d => {
  const v = { ...(d.rubric ?? {}), [k]: x }, sc = rubricScore(groups, v)
  if (sc !== null) commit(s => { s.practice[key] = Math.max(s.practice[key] ?? 0, sc) })
  return { rubric: v }
}, true)

// ---- the writing task ----

function WordMeter({ n, lo, hi }) {
  const max = hi * 1.4, st = n < lo ? 'under' : n <= hi * 1.25 ? 'ok' : 'over'
  return html`<div class=${`w-meter ${st}`}>
    <div class="w-track" aria-hidden="true"><span class="w-zone" style=${`left:${lo / max * 100}%;width:${(hi - lo) / max * 100}%`}></span>
      <i style=${`width:${Math.min(n, max) / max * 100}%`}></i></div>
    <p><b>${n}</b> ${n === 1 ? 'word' : 'words'} <span class="quiet">· aim for ${lo}–${hi}</span> ${st === 'under' ? html`<span class="quiet">· ${lo - n} to go</span>`
      : st === 'ok' ? html`<span class="w-ok">· in range</span>` : html`<span class="w-over">· longer than needed</span>`}</p>
  </div>`
}

const isFrame = de => GREETING_RE.test(de) || CLOSING_RE.test(de)
function WriteTask({ t, n }) {
  const [d, set] = useDraft(t.id)
  const [en, setEn] = useState(false)
  const ta = useRef()
  const text = d.text ?? ''
  const count = countWords(text)
  const [lo, hi] = t.words
  const need = Math.ceil(lo * .6)
  const auto = useMemo(() => t.points.map(p => pointEvidence(text, p, t.task_en)), [text])
  const ticked = t.points.map((_, i) => d.ticks?.[i] ?? auto[i] !== null)
  const hints = useMemo(() => writingHints(text, t, nounIndex()), [text])
  const missing = count >= need ? t.points.map((p, i) => [p, i]).filter(([, i]) => !ticked[i]) : []
  const all = [...missing.map(([p, i]) => ({ k: 'point', en: `Point ${i + 1} may be missing (none of its key words are in your text). Tick it if you wrote it another way.`, de: p })), ...hints]
  const groups = rubricGroups('write', t.level, t.rubric)
  // A phrase goes in at the cursor; its first … is selected, so typing fills the gap. Greetings and closings get their own line.
  const insert = de => {
    const el = ta.current, a = el.selectionStart ?? text.length, b = el.selectionEnd ?? a
    const before = text.slice(0, a), after = text.slice(b)
    const ins = (CLOSING_RE.test(de) && before && !/\n$/.test(before) ? '\n' : before && !/\s$/.test(before) ? ' ' : '') + de + (isFrame(de) ? '\n' : ' ')
    set({ text: before + ins + after })
    const gap = ins.indexOf('…'), at = before.length + (gap < 0 ? ins.length : gap)
    setTimeout(() => { el.focus(); el.setSelectionRange(at, gap < 0 ? at : at + 1) })
  }
  const done = () => {
    set({ done: true }, true)
    setTimeout(() => document.querySelector('.w-after')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }), 60)
  }
  const kind = WRITE_KIND[t.level][t.part]
  return html`<div class="w-task">
    <div class="w-main">
      <article class="w-card">
        <${TaskHead} t=${t} kind=${kind[1]} mod="Schreiben" name=${kind[0]} extra=${kind[2]} />
        <${TaskText} t=${t} />
        <ol class="w-points" aria-label="Content points">${t.points.map((p, i) => html`<li class=${ticked[i] ? 'on' : ''}>
          <button type="button" role="checkbox" aria-checked=${ticked[i]} onClick=${() => set({ ticks: { ...(d.ticks ?? {}), [i]: !ticked[i] } }, true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M7 12.5l3.2 3.2L17 9" /></svg>
            <span lang="de">${p}</span>${ticked[i] && d.ticks?.[i] === undefined ? html`<small>found <q lang="de">${auto[i]}</q></small>` : ''}</button></li>`)}</ol>
      </article>
      <section class="w-editor">
        <textarea ref=${ta} lang="de" spellcheck="true" aria-label="Your text" rows=${lo > 60 ? 11 : 8} value=${text}
          placeholder=${t.phrases.find(p => GREETING_RE.test(p[0]))?.[0] ?? 'Schreiben Sie hier …'} onInput=${e => set({ text: e.target.value })}></textarea>
        <${WordMeter} n=${count} lo=${lo} hi=${hi} />
        <div class="w-actions">
          ${d.done ? html`<span class="quiet">Saved as you type. The model answer and your self-score are below.</span>`
            : html`<button type="button" class="btn" disabled=${count < need} onClick=${done}>${count < need ? `Write at least ${need} words first` : html`I'm done: show the model answer <${Arrow} />`}</button>
              <span class="quiet">${text ? 'Saved as you type.' : ''}</span>`}
          ${text ? html`<button type="button" class="linkish" onClick=${() => { if (confirm('Clear your text and start this task again?')) set({ text: '', ticks: {}, done: false, rubric: {} }, true) }}>Start again</button>` : ''}
        </div>
      </section>
    </div>
    <aside class="w-side">
      <section class="w-box w-hints">
        <h3>Hints <small>simple checks, no AI</small></h3>
        ${!count ? html`<p class="quiet">Start writing: hints appear here as you type.</p>`
          : all.length ? html`<ul>${all.map(h => html`<li key=${h.en + h.de} class=${`w-h-${h.k}`}><span>${h.en}</span>${h.de ? html`<span class="w-hint-de" lang="de">${h.de}</span>` : ''}</li>`)}</ul>`
          : html`<p class="w-hint-none">These checks found nothing. They can't see everything, so compare with the model when you're done.</p>`}
      </section>
      <section class="w-box w-phrases">
        <h3>Useful phrases <small>click to insert</small></h3>
        <ul>${t.phrases.map(([de, e]) => html`<li><button type="button" onClick=${() => insert(de)}>
          <b lang="de">${de}</b><small>${e}</small><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg></button></li>`)}</ul>
      </section>
    </aside>
  </div>
    ${d.done ? html`<section class="w-after" aria-label="Model answer and self-score">
      <article class="w-model">
        <header><h3>Model answer</h3><${SayButton} text=${t.model} label="the model answer" />
          <label class="check"><input type="checkbox" checked=${en} onChange=${e => setEn(e.target.checked)} /> English</label></header>
        <p class="w-model-de" lang="de">${t.model}</p>
        ${en ? html`<p class="w-model-en">${t.model_en}</p>` : ''}
        <p class="quiet">${countWords(t.model)} words; yours has ${count}. Yours can be different and still score full marks.</p>
      </article>
      <${SelfScore} groups=${groups} value=${d.rubric} onRate=${rateIn(set, groups, `${n}/write`)} />
    </section>` : ''}`
}

// A1 Teil 1: read a short text about someone and fill in a form for them.
// Case, spacing, € and the English-keyboard spellings (Koeln for Köln) don't count as mistakes.
const normField = s => (s ?? '').toLowerCase().replace(/€|euro/g, '').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^\p{L}\p{N}]/gu, '')
function FormTask({ t, n }) {
  const [d, set] = useDraft(t.id)
  const fs = t.form.fields
  const rightIn = x => fs.map(([, a], i) => normField(x.fields?.[i]) === normField(a) || !!x.same?.[i])
  const right = rightIn(d)
  const vals = d.fields ?? fs.map(() => '')
  // Checking, and "mine means the same", score the form; the station keeps the best share of fields right.
  const score = patch => set(x => {
    const y = { ...x, ...patch }, r = rightIn(y).filter(Boolean).length / fs.length
    commit(s => { s.practice[`${n}/write`] = Math.max(s.practice[`${n}/write`] ?? 0, r) })
    return patch
  }, true)
  const type = (i, v) => set(x => {
    const f = [...(x.fields ?? fs.map(() => ''))], sm = { ...x.same }
    f[i] = v; delete sm[i]
    return { fields: f, same: sm, checked: false }
  })
  return html`<div class="w-form">
    <article class="w-card">
      <${TaskHead} t=${t} kind="form" mod="Schreiben" name="Formular" extra="5 fields" />
      <${TaskText} t=${t} />
      <div class="w-source"><p lang="de">${t.form.text_de}</p><${SayButton} text=${t.form.text_de} label="the text" /></div>
    </article>
    <form class="w-formcard" onSubmit=${e => { e.preventDefault(); score({ checked: true }) }}>
      <p class="w-form-h" lang="de">Anmeldung</p>
      ${fs.map(([label, ans], i) => html`<label class=${`w-ff${d.checked ? (right[i] ? ' right' : ' wrong') : ''}`}>
        <span lang="de">${label}</span>
        <input lang="de" spellcheck="false" autocomplete="off" value=${vals[i]} onInput=${e => type(i, e.target.value)} />
        ${d.checked && !right[i] ? html`<small>The text says <b lang="de">${ans}</b>. <button type="button" class="linkish"
          onClick=${() => score({ same: { ...d.same, [i]: true } })}>Mine means the same</button></small>` : ''}
      </label>`)}
      <div class="w-form-foot"><button class="btn" type="submit">Check the form</button>
        ${d.checked ? html`<p><b>${right.filter(Boolean).length} of ${fs.length}</b> right. ${right.every(Boolean) ? 'Every field, as in the exam.' : 'Read the text again for the others.'}</p>` : ''}</div>
    </form>
  </div>`
}

// The other tasks of the same part and level, one per station, for more practice of one exam format.
function MoreTasks({ items, t, tab, mod }) {
  const more = items.filter(x => x.level === t.level && x.part === t.part && x.id !== t.id)
  return more.length ? html`<nav class="w-more" aria-label=${`More ${mod} ${t.part} tasks`}><span class="quiet">More ${mod} ${t.part} at ${t.level}:</span>
    ${more.map(x => html`<a href=${`#/station/${x.n}/${tab}`} lang="de">${D.stations[x.n].de}</a>`)}</nav>` : ''
}

function WriteTab({ data, n }) {
  useStore()
  const t = data.writingBy[n]?.[0]
  if (!t) return html`<p class="soon">This station's writing task is being written now: a Goethe Schreiben task with a checklist, word count and model answer.</p>`
  const Task = t.form ? FormTask : WriteTask
  return html`<${Task} key=${t.id} t=${t} n=${n} /><${MoreTasks} items=${data.writing} t=${t} tab="write" mod="Schreiben" />`
}
TAB_VIEWS.write = WriteTab

// ==== src/55-speaking.js ====
// ---- speaking: the station's Sprechen task with timers, a recording, a voice partner and a model answer ----
// Read the task and its cards → prepare (timer) → speak (timer; recorded where the browser can; the partner's lines are
// read by a German voice on request) → listen back, see a transcript where the browser has speech recognition, then
// the model answer with shadowing per line (L14) and a self-score. Progress: S.practice['<station>/speak'].

const SPEAK_KIND = {
  A1: { 'Teil 1': 'Sich vorstellen', 'Teil 2': 'Fragen und antworten', 'Teil 3': 'Bitten und reagieren' },
  A2: { 'Teil 1': 'Fragen zur Person', 'Teil 2': 'Über sich sprechen', 'Teil 3': 'Etwas zusammen planen' },
  B1: { 'Teil 1': 'Gemeinsam etwas planen', 'Teil 2': 'Ein Thema präsentieren', 'Teil 3': 'Über eine Präsentation sprechen' },
}
const mmss = s => { const c = Math.max(0, Math.ceil(s)); return `${Math.floor(c / 60)}:${String(c % 60).padStart(2, '0')}` }
// Brave lists webkitSpeechRecognition but has no speech service behind it, so it never hears anything.
const transcriptNote = () => (navigator.brave ? 'Brave has no speech-to-text, so there is no transcript here; the recording works. For a transcript, open this file in Microsoft Edge.'
  : SpeechRec ? null : 'This browser has no German speech-to-text, so there is no transcript; the recording works.')
// Which phrases came out in the transcript: most of a phrase's own words (not its … gaps) were heard.
const phrasesHeard = (phrases, heard) => {
  const h = new Set(tokens(heard.toLowerCase()))
  return new Set(phrases.map(([de], i) => { const ws = tokens(de.toLowerCase()); return ws.length && ws.filter(w => h.has(w)).length / ws.length >= .6 ? i : -1 }).filter(i => i >= 0))
}
const SayLine = ({ who, de }) => html`<button class="say" type="button" aria-label="Play this line" onClick=${e => { e.stopPropagation(); speakLines([[who, de]]) }}><${Speaker} /></button>`

// A ring that empties as the time runs out; it calls onEnd once at zero.
function Countdown({ secs, kind, label, onEnd }) {
  const [left, setLeft] = useState(secs)
  useEffect(() => {
    const end = Date.now() + secs * 1000
    const id = setInterval(() => {
      const l = (end - Date.now()) / 1000
      setLeft(Math.max(0, l))
      if (l <= 0) { clearInterval(id); onEnd?.() }
    }, 200)
    return () => clearInterval(id)
  }, [])
  return html`<div class=${`sp-count k-${kind}`} role="timer" aria-label=${`${label}: ${mmss(secs)}`}>
    <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="sp-ring-track" cx="60" cy="60" r="52" />
      <circle class="sp-ring-fill" cx="60" cy="60" r="52" pathLength="1" style=${`stroke-dashoffset:${1 - left / secs}`} /></svg>
    <b>${mmss(left)}</b><small>${label}</small>
  </div>`
}

// The partner (or examiner): one line at a time in a man's voice; the words show only on request, as in the exam.
function VoicePartner({ lines, label }) {
  const [k, setK] = useState(0)
  const [talking, setTalking] = useState(false)
  const [show, setShow] = useState(false)
  useEffect(() => () => stopSpeech(), [])
  if (!lines?.length) return ''
  const say = i => {
    const de = lines[i][0]
    setTalking(true)
    speakLines([['B', de]], { onEnd: () => setTalking(false) })
    setTimeout(() => setTalking(false), 2500 + tokens(de).length * 600)   // in case the voice never starts
    setK(x => Math.max(x, i + 1))
  }
  return html`<div class="sp-partner">
    <figure class=${`person p-B${talking ? ' talking' : ''}`}><${Person} who="B" /><figcaption>${label}</figcaption></figure>
    <div class="sp-p-body">
      <p class="sp-p-count">${k ? `${k} of ${lines.length} lines said` : `${plural(lines.length, 'line')} to say, one at a time`}</p>
      <div class="sp-p-btns">
        ${k < lines.length ? html`<button type="button" class="btn" onClick=${() => say(k)}>${k ? 'Next line' : `Hear your ${label.toLowerCase()}`}</button>`
          : html`<span class="quiet">That was everything.</span>`}
        ${k ? html`<button type="button" onClick=${() => say(k - 1)}>Again</button>` : ''}
        <label class="check"><input type="checkbox" checked=${show} onChange=${e => setShow(e.target.checked)} /> Show the words</label>
      </div>
      ${show && k ? html`<ol class="sp-p-lines">${lines.slice(0, k).map(([de, e]) => html`<li><span lang="de">${de}</span><small>${e}</small></li>`)}</ol>` : ''}
    </div>
  </div>`
}

// The exam cards as the part shows them: word cards, a topic card with four prompts, a diary, or slides.
const cardParts = c => { const a = c.match(/^(.+?):\s+(.+)$/), b = c.match(/^(.+?)\s+–\s+(.+)$/); return a ? [a[1], a[2], ''] : b ? ['', b[1], b[2]] : ['', c, ''] }
function SpeakCards({ t }) {
  const c = t.cards
  const topic = (t.task_de.match(/„([^“]+)“/) ?? c[0].match(/„([^“]+)“/) ?? [])[1]
  if (t.level === 'A2' && t.part === 'Teil 3') {
    const day = t.task_de.match(/Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag/)?.[0]
    return html`<div class="sp-diary" lang="de"><p class="sp-diary-h">Ihr Kalender${day ? html` · <b>${day}</b>` : ''}</p>
      <ul>${c.map(x => { const m = x.match(/^(.*?\d[\d:.–-]*(?:\s*Uhr)?):?\s+(.+)$/) ?? x.match(/^([^:]+):\s+(.+)$/) ?? [x, '', x]; return html`<li><b>${m[1]}</b><span>${m[2]}</span></li>` })}</ul></div>`
  }
  const slides = c.map(x => x.match(/^Folie (\d+):\s*(.+)$/)).filter(Boolean).map(m => [m[1], m[2]])
  if (slides.length) {
    const head = c.find(x => /^Thema/.test(x)), task = c.find(x => /^Ihre Aufgabe/.test(x))
    const all = head ? [['1', head.split(':')[0]], ...slides] : slides
    return html`<ol class="sp-slides" lang="de">${all.map(([k, txt]) => html`<li class=${k === '1' ? 'sp-title' : ''}><span class="sp-slide-n">Folie ${k}</span>
      ${k === '1' && topic ? html`<b>${topic}</b>` : ''}<span>${txt}</span></li>`)}</ol>
      ${task ? html`<p class="sp-slide-task" lang="de">${task}</p>` : ''}`
  }
  if (t.level === 'A2' && t.part === 'Teil 2') {
    return html`<div class="sp-topic" lang="de"><b>${c[0]}</b>${c.slice(1, 5).map((x, i) => html`<span class=${`sp-tc${i}`}>${x}</span>`)}</div>`
  }
  const label = t.level === 'A1' && t.part === 'Teil 3' ? 'Bildkarte' : t.level === 'A1' && t.part === 'Teil 2' ? t.task_de.match(/Thema:\s*([^.]+)/)?.[0] : ''
  return html`<ul class="sp-cards" lang="de">${c.map(x => {
    const [small, big, sub] = cardParts(x)
    return html`<li class="sp-card">${small || label ? html`<small>${small || label}</small>` : ''}<b class=${Math.max(...big.split(' ').map(w => w.length)) > 11 ? 'sp-long' : ''}>${big}</b>${sub ? html`<span>${sub}</span>` : ''}</li>`
  })}</ul>`
}

// The model answer: hear it all with the line lit up, or line by line; shadow your own lines.
function SpeakModel({ t, them }) {
  const [at, setAt] = useState(null)
  const [en, setEn] = useState(true)
  useEffect(() => () => stopSpeech(), [])
  const play = () => {
    if (at !== null) { stopSpeech(); setAt(null); return }
    speakLines(t.model.map(([who, de]) => [who, de]), { onLine: i => setAt(i < 0 ? null : i) })
  }
  return html`<article class="sp-model">
    <header><h3>Model answer</h3>
      <button type="button" onClick=${play}><${Speaker} /> ${at !== null ? 'Stop' : 'Play it all'}</button>
      <label class="check"><input type="checkbox" checked=${en} onChange=${e => setEn(e.target.checked)} /> English</label></header>
    <p class="quiet">Shadow your lines: hear one, say it straight after, then hear the two back to back.</p>
    <ol>${t.model.map(([who, de, e], i) => html`<li class=${`${who === 'A' ? 'me' : 'them'}${at === i ? ' now' : ''}`}>
      <span class="sp-who">${who === 'A' ? 'You' : them}</span>
      <div class="sp-line"><p><span lang="de">${de}</span><${SayLine} who=${who} de=${de} /></p>
        ${en ? html`<small>${e}</small>` : ''}${who === 'A' ? html`<${Shadow} who="A" de=${de} />` : ''}</div>
    </li>`)}</ol>
  </article>`
}

function SpeakTask({ t, n }) {
  const r = useRecorder()
  const [phase, setPhase] = useState('ready')   // ready → prep → speak → done
  const [peek, setPeek] = useState(false)
  const [d, set] = useDraft(t.id)
  useEffect(() => () => stopSpeech(), [])
  useEffect(() => { if (phase === 'done' && r.state === 'rec') r.stop() }, [phase, r.state])   // a slow permission prompt
  const speakNow = () => { stopSpeech(); setPhase('speak'); if (canRecord()) r.start() }
  const finish = () => { r.stop(); stopSpeech(); setPhase('done') }
  const them = t.level === 'A1' && t.part === 'Teil 1' ? 'Examiner' : 'Partner'
  const note = transcriptNote()
  const used = phase === 'done' && r.heard ? phrasesHeard(t.phrases, r.heard) : null
  const groups = rubricGroups('speak', t.level)
  const stage = {
    ready: html`<div class="sp-times"><span><b>${mmss(t.prep_s)}</b> to prepare</span><span><b>${mmss(t.speak_s)}</b> to speak</span></div>
      <div class="sp-body">
        <div class="sp-btns"><button type="button" class="btn big" onClick=${() => setPhase('prep')}>Start preparing <${Arrow} /></button>
          <button type="button" onClick=${speakNow}>Skip to speaking</button></div>
        <p class="sp-note">${canRecord() ? 'Your microphone records you while you speak. The recording stays in this browser.'
          : 'This browser cannot record here, so the timer runs without a recording.'}
          ${note ?? ' Edge and Chrome also write down what they hear, using their online speech service.'}</p>
        ${peek ? '' : html`<button type="button" class="linkish" onClick=${() => setPeek(true)}>See the model answer first</button>`}
      </div>`,
    prep: html`<${Countdown} key="prep" secs=${t.prep_s} kind="prep" label="Prepare" onEnd=${speakNow} />
      <div class="sp-body"><p>Plan something for every card. The phrases on the right help.</p>
        <div class="sp-btns"><button type="button" class="btn big" onClick=${speakNow}>Start speaking now <${Arrow} /></button></div></div>`,
    speak: html`<${Countdown} key="speak" secs=${t.speak_s} kind="rec" label="Speak" onEnd=${finish} />
      <div class="sp-body">
        <p class="sp-rec">${r.state === 'rec' ? html`<span class="rec-dot"></span> Recording. Speak now.`
          : r.error ? html`<span class="rec-err">${r.error} Speak anyway: the timer runs.</span>`
          : canRecord() ? 'Waiting for the microphone. If the browser asks, allow it.' : 'No recording in this browser. Speak anyway: the timer runs.'}</p>
        ${r.heard ? html`<p class="sp-live" lang="de">${r.heard}</p>` : ''}
        <div class="sp-btns"><button type="button" class="btn" onClick=${finish}>I'm done</button></div>
      </div>`,
    done: html`<div class="sp-body sp-wide">
        <h3>Your recording</h3>
        ${r.url ? html`<audio controls src=${r.url}></audio>` : html`<p class="quiet">${r.error || (canRecord() ? 'Nothing was recorded.' : 'This browser cannot record here.')}</p>`}
        ${r.heard ? html`<p class="sp-heard"><b>What the browser heard</b> <span lang="de">${r.heard}</span></p>`
          : r.url ? html`<p class="quiet">${note ?? 'No transcript came back: speech-to-text needs an internet connection.'}</p>` : ''}
        <div class="sp-btns"><button type="button" onClick=${() => { stopSpeech(); setPhase('ready') }}>Try again</button></div>
      </div>`,
  }[phase]
  return html`<div class="sp-task">
    <div class="sp-main">
      <article class="w-card">
        <${TaskHead} t=${t} kind="speak" mod="Sprechen" name=${SPEAK_KIND[t.level][t.part]} />
        <${TaskText} t=${t} />
        <${SpeakCards} t=${t} />
      </article>
      <section class=${`sp-stage sp-st-${phase}`} aria-label="Prepare and speak">${stage}
        ${phase === 'prep' || phase === 'speak' ? html`<${VoicePartner} lines=${t.partner} label=${them} />` : ''}</section>
    </div>
    <aside class="sp-side">
      <section class="w-box w-phrases">
        <h3>Useful phrases <small>${used ? `${used.size} of ${t.phrases.length} heard` : 'tap to hear'}</small></h3>
        <ul>${t.phrases.map(([de, e], i) => html`<li class=${`sp-ph${used?.has(i) ? ' is-used' : ''}`}><${SayLine} who="A" de=${de} />
          <span><b lang="de">${de}</b><small>${e}</small></span></li>`)}</ul>
      </section>
    </aside>
  </div>
    ${phase === 'done' || peek ? html`<section class="sp-after" aria-label="Model answer and self-score">
      <${SpeakModel} t=${t} them=${them} />
      ${phase === 'done' ? html`<${SelfScore} groups=${groups} value=${d.rubric} onRate=${rateIn(set, groups, `${n}/speak`)} />`
        : html`<p class="soon">Your self-score comes after you've spoken.</p>`}
    </section>` : ''}`
}

function SpeakTab({ data, n }) {
  useStore()
  const t = data.speakingBy[n]?.[0]
  if (!t) return html`<p class="soon">This station's speaking task is being written now: a Goethe Sprechen task with timers, recording and a model answer.</p>`
  return html`<${SpeakTask} key=${t.id} t=${t} n=${n} /><${MoreTasks} items=${data.speaking} t=${t} tab="speak" mod="Sprechen" />`
}
TAB_VIEWS.speak = SpeakTab

// ==== src/60-learn.js ====
// ---- how you learn here: the research behind the app (docs/07-learning-science.md), each tip linked to its feature ----

const TIP_ICONS = {
  test: html`<rect x="9" y="6" width="30" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="3" />
    <path d="M19 19a5 5 0 1 1 7 4.6c-1.4.7-2 1.6-2 3.4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" /><circle cx="24" cy="33" r="2" fill="currentColor" />`,
  often: html`<rect x="6" y="10" width="36" height="32" rx="4" fill="none" stroke="currentColor" stroke-width="3" /><path d="M6 18H42M15 6v8M33 6v8" stroke="currentColor" stroke-width="3" />
    ${[14, 24, 34].map(x => html`<circle cx=${x} cy="30" r="3" fill="currentColor" />`)}`,
  aloud: html`<path d="M8 19v10h7l9 7V12l-9 7H8z" fill="currentColor" /><path d="M30 17a9 9 0 0 1 0 14M35 12a16 16 0 0 1 0 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />`,
  sleep: html`<path d="M30 8a16 16 0 1 0 10 26A13 13 0 0 1 30 8z" fill="currentColor" /><path d="M33 12h7l-7 8h7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" />`,
  twice: html`<circle cx="15" cy="24" r="9" fill="currentColor" /><circle cx="35" cy="24" r="9" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="4 3" />`,
  mix: html`<path d="M6 14h9c6 0 9 20 15 20h10M6 34h9c6 0 9-20 15-20h10" fill="none" stroke="currentColor" stroke-width="3" />
    <path d="M36 9l5 5-5 5M36 29l5 5-5 5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`,
  guess: html`<path d="M8 10h32a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H22l-8 7v-7H8a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3z" fill="none" stroke="currentColor" stroke-width="3" />
    <path d="M20 18a4 4 0 1 1 5.5 3.7c-1 .5-1.5 1.2-1.5 2.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /><circle cx="24" cy="29" r="1.8" fill="currentColor" />`,
  hook: html`<path d="M24 5v24a8 8 0 1 1-16 0" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" /><path d="M8 29l-3-6" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" />
    <circle cx="24" cy="5" r="3" fill="currentColor" />`,
}
// Each tip: what to do, why (one or two sentences), the evidence, and where the app does it.
// A "here" entry is [label, href] when it's built, or [label, null, 'with Reading'] for what comes in a later phase.
function tipsFor(s) {
  const st = `#/station/${s.lesson}`
  return [
    { icon: 'test', title: "Test, don't reread", says: 'Pulling a word out of memory makes it stronger; reading it again barely does. So every step here ends in a question, a typed answer or something you say.',
      ev: 'Retrieval practice: Karpicke & Roediger 2008; Dunlosky et al. 2013 (strong evidence).',
      here: [["Today's cards", '#/study'], ['Cover the English in a word list', `${st}/words`], ['Test yourself on a station', `${st}/words`],
        ['Known words in a text: how much of it you already know', null, 'with Reading']] },
    { icon: 'often', title: 'Little and often', says: 'Spread your study over the days. Each card comes back just before you would forget it, so fifteen minutes a day beats two hours on a Sunday.',
      ev: 'Spacing: Cepeda et al. 2008 (strong). The cards use FSRS, aiming at 90% recall.',
      here: [["Today's cards, with the minutes they take", '#/study'], ['Revisit stops: a passed station test returns after 1, 7 and 21 days', null, 'with the tests'],
        ['Station tests that mix in the six stations before', null, 'with the tests'], ['Mock exams spaced at least three days apart', null, 'with the tests']] },
    { icon: 'aloud', title: 'Say it aloud', says: 'Words you say out loud stick better than words you read silently. Every card asks you to say it, and the voice says it back.',
      ev: 'The production effect: MacLeod et al. 2010; Fawcett 2013. Shadowing helps most at lower levels (Hamada).',
      here: [["Today's cards", '#/study'], ['Shadowing: hear a line, record yourself straight after', null, 'with Listening'],
        ['Read it again against the clock; hear it again, faster', null, 'with Reading and Listening']] },
    { icon: 'sleep', title: 'Sleep on it', says: 'Sleep between two sessions halves the work of relearning. Do your cards in the evening and again the next morning.',
      ev: 'Mazza et al. 2016.', here: [["Today's cards", '#/study']] },
    { icon: 'twice', title: 'Never miss twice', says: 'A habit takes about two months to form, and one missed day does not break it; two in a row might. Decide when and where you study, in one sentence.',
      ev: 'Habits: Lally et al. 2010. If-then plans: Gollwitzer & Sheeran 2006 (d = 0.65).',
      here: [['Your week on the home page', '#/'], ['Your study plan (Settings)', '#/']] },
    { icon: 'mix', title: 'Mix it up', says: 'Once you have met things one at a time, mix them: new words among old ones, all verb forms in one drill. Telling similar things apart is what the exam asks.',
      ev: 'Interleaving: Brunmair & Richter 2019 (g = 0.42).',
      here: [['New cards among the reviews', '#/study'], ['Verb forms', '#/verbs'], ['der, die, das', '#/gender'], ['Cases and endings', '#/cases']] },
    { icon: 'guess', title: 'Guess first', says: 'A guess before the lesson, even a wrong one, makes the lesson stick. Each grammar point starts with one question.',
      ev: 'Pretesting: Kornell, Hays & Bjork 2009; Richland, Kornell & Kao 2009.',
      here: [['The grammar of your station', `${st}/grammar`], ['Predict first: what a text will be about', null, 'with Reading']] },
    { icon: 'hook', title: 'Hooks for tricky words only', says: 'Most words stick through repetition. For the few that keep slipping, make a picture: der words frozen in blue ice, die words on fire, das words overgrown with leaves.',
      ev: 'The keyword method: Atkinson & Raugh 1975; mixed evidence on its own, so only for words missed four times.',
      here: [['Tricky words get a memory hook in your cards', '#/study']] },
    { icon: 'test', title: 'The exam day', says: 'Know the format before the day: sit at least two full mock exams under time. Read the questions before the text, answer every question (a wrong answer costs nothing), and tick off every point of a writing task.',
      ev: 'Goethe-Zertifikat: 60% passes; at B1 each module is passed on its own.',
      here: [['Practice tests in every module', null, 'with the tests'], ['Timed mock exams', null, 'with the tests']] },
  ]
}

function Tips({ arg }) {
  const s = useStore()
  const tips = tipsFor(s)
  const i = Math.min(Math.max(Number(arg) || 0, 0), tips.length - 1)
  const t = tips[i]
  const go = t.here.find(([, href]) => href)
  const open = (e, href) => { if (href === '#/' && /Settings/.test(e.currentTarget.textContent)) { e.preventDefault(); location.hash = '#/'; setTimeout(openSettings, 300) } }
  return html`<main class="page tips">
    <header class="masthead"><h1>How you learn here</h1>
      <p>Nine findings from memory research, and where this app puts each one to work.</p></header>
    <nav class="tip-line" aria-label="Tips">
      <ol>${tips.map((x, k) => html`<li class=${k === i ? 'on' : k < i ? 'past' : ''}><a href=${`#/tips/${k}`} aria-current=${k === i ? 'step' : null}>
        <span class="tdot">${k + 1}</span><span class="tname">${x.title}</span></a></li>`)}</ol>
    </nav>
    <article class="tip" key=${i}>
      <svg class="tip-icon" viewBox="0 0 48 48" width="56" height="56" aria-hidden="true">${TIP_ICONS[t.icon]}</svg>
      <div class="tip-body">
        <h2>${t.title}</h2>
        <p class="tip-says">${t.says}</p>
        <h3>In this app</h3>
        <ul class="tip-here">${t.here.map(([label, href, when]) => html`<li class=${href ? '' : 'later'}>
          ${href ? html`<a href=${href} onClick=${e => open(e, href)}>${label}</a>` : html`<span>${label}</span> <small>${when}</small>`}</li>`)}</ul>
        <p class="tip-ev">${t.ev}</p>
        <div class="after">
          ${go ? html`<a class="btn" href=${go[1]} onClick=${e => open(e, go[1])}>Try it now <${Arrow} /></a>` : ''}
          ${i > 0 ? html`<a class="button" href=${`#/tips/${i - 1}`}>← Previous</a>` : ''}
          ${i < tips.length - 1 ? html`<a class="button" href=${`#/tips/${i + 1}`}>Next: ${tips[i + 1].title} →</a>` : ''}
        </div>
      </div>
    </article>
  </main>`
}
PAGES.tips = Tips

// ==== src/70-pictures.js ====
// ---- picture scenes: drawn scenes where every labelled thing is a word (data/src/scenes-*.json) ----

// A scene is a 1000 × 620 picture: sky colour, background markup (back) and objects. An object's svg is drawn in its
// own coordinates and placed at `at`; w + a name its course word (no w: scenery). tag is its name board's bottom
// centre and pin a point on the thing that a leader line runs to, both in the object's coordinates. Movers:
// mv [from, to, seconds, delay] with move drive or pass (sideways) or fall (down). only: sun, rain or snow, the
// weather it shows in (every object, labelled or not). Small motion inside an svg comes from classes (wave, sway, wag,
// spin, bounce, blink, flash, steam, swim, drip, flutter, flow), styled in 70-pictures.css.
const SCENE_W = 1000, SCENE_H = 620
const boardText = o => `${o.a ? ART[o.a] : ''} ${o.w}`.trim()
// a name board's box in picture coordinates; letters × 11 + 22 is the validator's estimate (scripts/check_content.py)
function boardBox(o, [dx, dy] = [0, 0]) {
  const wd = boardText(o).length * 11 + 22, x = o.at[0] + o.tag[0] + dx, y = o.at[1] + o.tag[1] + dy
  return [x - wd / 2, y - 30, x + wd / 2, y]
}
const boxesMeet = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]
const sameWeather = (a, b) => !a.only || !b.only || a.only === b.only

// Where a mover waits when nothing moves (reduced motion, thumbnails, flashcards): where its loop starts, slid into
// the picture and, in 40 px steps, clear of the boards already placed. Parts with the same path (a train and its
// carriage) wait together.
function placeMovers(objs) {
  const placed = objs.filter(o => o.w && !o.mv).map(o => [o, boardBox(o)])
  const groups = {}
  for (const o of objs) if (o.mv) (groups[`${o.mv}|${o.move}|${o.at}`] ??= []).push(o)
  for (const g of Object.values(groups)) {
    const [from, to, dur, delay = 0] = g[0].mv
    const p = ((-delay % dur) + dur) % dur / dur
    const down = g[0].move === 'fall'
    const off = d => (down ? [0, d] : [d, 0])
    let lo = Math.min(from, to), hi = Math.max(from, to)
    for (const o of g.filter(x => x.w)) {   // keep the boards inside the picture
      const b = boardBox(o)
      lo = Math.max(lo, down ? 4 - b[1] : 4 - b[0]); hi = Math.min(hi, down ? SCENE_H - 4 - b[3] : SCENE_W - 4 - b[2])
    }
    const clamp = d => Math.min(Math.max(d, lo), Math.max(lo, hi))
    const start = clamp(from + (to - from) * (g[0].move === 'pass' ? Math.min(p / .45, 1) : p))
    let rest = start
    for (let k = 0; k < 40; k++) {
      const d = clamp(start + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 40)
      if (g.every(o => !o.w || !placed.some(([x, b]) => sameWeather(o, x) && boxesMeet(boardBox(o, off(d)), b)))) { rest = d; break }
    }
    for (const o of g) { o.rest = off(rest); if (o.w) placed.push([o, boardBox(o, o.rest)]) }
  }
}

// The scenes, prepared once: each labelled object with its course word, the level of its first station, the weathers
// it can show; pictureOf: word id → the scene and object that draw it (a scene of the word's own station first).
let SCN = null
function scenes() {
  if (SCN?.src === D.scenes) return SCN
  const byKey = {}
  for (const w of D.words) byKey[`${w.a ?? ''}|${w.w}`] ??= w
  const list = D.scenes.map(sc => {
    const objs = sc.objs.map((o, i) => ({ ...o, i, at: o.at ?? [0, 0], tag: o.tag ?? [0, 0],
      word: !o.w ? null : byKey[`${o.a ?? ''}|${o.w}`] ?? { id: `${sc.id}/${i}`, w: o.w, a: o.a || undefined, p: o.a ? 'n' : 'other', en: '', missing: true } }))
    placeMovers(objs)
    const n = Math.min(...sc.stations)
    return { ...sc, objs, live: objs.filter(o => o.word), n, level: D.stations[n]?.level ?? 'A1',
      weathers: ['sun', 'rain', 'snow'].filter(x => objs.some(o => o.only === x)) }
  }).sort((a, b) => a.n - b.n)
  const pictureOf = {}
  for (const sc of list) for (const o of sc.live) {
    const had = pictureOf[o.word.id]
    if (!had || (!had.sc.stations.includes(o.word.n) && sc.stations.includes(o.word.n))) pictureOf[o.word.id] = { sc, o }
  }
  SCN = { src: D.scenes, list, byId: Object.fromEntries(list.map(s => [s.id, s])), pictureOf }
  return SCN
}
const scenesFor = n => scenes().list.filter(sc => sc.stations.includes(n))

// Name board: the word with its article in the gender colour, its bottom centre at tag. Drawn at the validator's
// width first; SceneArt then fits it to the real text. The leader line starts under the board's middle.
function Tag({ o }) {
  const [x, y] = o.tag, wd = boardText(o).length * 11 + 22
  return html`<g class=${`sc-tag g-${o.a || 'x'}`}>
    ${o.pin ? html`<path class="sc-lead" d=${`M${x} ${y - 15} L${o.pin[0]} ${o.pin[1]}`} /><circle class="sc-pin" cx=${o.pin[0]} cy=${o.pin[1]} r="4" />` : ''}
    <rect x=${x - wd / 2} y=${y - 30} width=${wd} height="30" rx="6" />
    <text x=${x} y=${y - 9} lang="de">${o.a ? html`<tspan class="art">${ART[o.a]} </tspan>` : ''}${o.w}</text>
  </g>`
}

// The picture. Every board is drawn from the start in a top layer and only shown or hidden, so a moving thing's board
// keeps step with it; pointing at a moving thing holds it and its board still (hold). frozen: nothing moves and
// movers wait at their rest place (also under reduced motion). ring: the object to circle (a question's target).
function SceneArt({ sc, cls = () => '', tagOn = () => false, onTap, onHover, frozen, weather = sc.weathers[0], ring, held, viewBox }) {
  const [hold, setHold] = useState(null)
  const ref = useRef()
  const still = frozen || reducedMotion()
  useLayoutEffect(() => {
    const fit = () => ref.current?.querySelectorAll('.sc-tag').forEach(g => {
      const t = g.querySelector('text'), r = g.querySelector('rect'), len = t.getComputedTextLength()
      if (len) { r.setAttribute('width', len + 24); r.setAttribute('x', +t.getAttribute('x') - (len + 24) / 2) }
    })
    fit()
    document.fonts?.ready.then(fit)
  }, [sc])
  useLayoutEffect(() => {   // the ring sits inside the target's own mover, so it travels with it
    const r = ref.current?.querySelector('.sc-ring'), look = r?.previousElementSibling
    if (!look) return
    const b = look.getBBox()
    Object.entries({ x: b.x - 8, y: b.y - 8, width: b.width + 16, height: b.height + 16 }).forEach(([k, v]) => r.setAttribute(k, v))
  })
  const off = o => o.only && o.only !== weather
  const place = o => `translate(${o.at[0]} ${o.at[1]})`
  const mover = (o, body) => {
    if (!o.mv) return body
    if (still) return html`<g transform=${`translate(${o.rest[0]} ${o.rest[1]})`}>${body}</g>`
    const [from, to, dur, delay = 0] = o.mv
    return html`<g class=${`sc-move ${o.move}`}
      style=${`--from:${from}px;--to:${to}px;--dur:${dur}s;--delay:${delay}s;--turn:${to < from ? 'reverse' : 'normal'}`}>${body}</g>`
  }
  const act = o => (onTap && o.word && !off(o) ? {
    onClick: () => onTap(o),
    onPointerEnter: () => { setHold(o.i); onHover?.(o) }, onPointerLeave: () => { setHold(null); onHover?.(null) },
    onFocus: () => { setHold(o.i); onHover?.(o) }, onBlur: () => { setHold(null); onHover?.(null) },
    onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(o) } },
  } : {})
  // A click that hits no labelled thing goes to the smallest one whose box holds it: thin things (rain, wind) count
  // when clicked between their strokes.
  const near = e => {
    if (!onTap || e.target.closest('.live, .sc-tags.on')) return
    const hit = sc.live.filter(o => !off(o)).map(o => [o, ref.current.querySelector(`.sc-obj[data-i="${o.i}"] .sc-look`)?.getBoundingClientRect()])
      .filter(([, r]) => r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)
      .sort((a, b) => a[1].width * a[1].height - b[1].width * b[1].height)[0]
    if (hit) onTap(hit[0])
  }
  return html`<svg ref=${ref} class=${`scene-art${still ? ' frozen' : ''}`} viewBox=${viewBox ?? `0 0 ${SCENE_W} ${SCENE_H}`}
      data-scene=${sc.id} role=${onTap ? 'group' : 'img'} aria-label=${`${sc.en}: picture`} onClick=${near}>
    <rect width=${SCENE_W} height=${SCENE_H} fill=${sc.sky} />
    <g dangerouslySetInnerHTML=${{ __html: sc.back }} />
    ${sc.objs.map(o => {
      const live = onTap && o.word && !off(o)
      return html`<g key=${o.i} class=${`sc-obj${live ? ' live' : ''}${hold === o.i || held === o.i ? ' hold' : ''}${off(o) ? ' off' : ''} ${o.word ? cls(o) : ''}`}
          transform=${place(o)} data-i=${o.i} data-only=${o.only}
          ...${live ? { tabindex: 0, role: 'button', 'aria-label': boardText(o) } : {}} ...${act(o)}>
        ${mover(o, html`<g class="sc-look" dangerouslySetInnerHTML=${{ __html: o.svg }} />${ring === o.i ? html`<rect class="sc-ring" rx="10" />` : ''}`)}
      </g>`
    })}
    <rect class="sc-night" width=${SCENE_W} height=${SCENE_H} />
    ${sc.live.map(o => html`<g key=${o.i} class=${`sc-tags${tagOn(o) && !off(o) ? ' on' : ''}${hold === o.i || held === o.i ? ' hold' : ''}${off(o) ? ' off' : ''}${o.mv ? ' mv' : ''}`}
        transform=${place(o)} data-i=${o.i} data-only=${o.only} data-missing=${o.word.missing ? '' : null} aria-hidden="true" ...${act(o)}>
      ${mover(o, html`<${Tag} o=${o} />`)}
    </g>`)}
  </svg>`
}

const WEATHER = {
  sun: ['Sun', html`<circle cx="12" cy="12" r="4.5" fill="currentColor" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" />`],
  rain: ['Rain', html`<path d="M6.5 14a4.5 4.5 0 0 1 .6-9 5.5 5.5 0 0 1 10.4 1.6A3.7 3.7 0 0 1 17.5 14z" fill="currentColor" /><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />`],
  snow: ['Snow', html`<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" />`],
}
const askLine = w => (w.p === 'n' ? `${w.a === 'pl' ? 'Wo sind' : 'Wo ist'} ${said(w)}?` : said(w))
function nameOptions(o, sc) {
  const w = o.word, opts = new Set([said(w)])
  if (w.a && w.a !== 'pl') opts.add(`${shuffle(['der', 'die', 'das'].filter(a => a !== w.a))[0]} ${w.w}`)   // the gender is part of the word
  for (const x of shuffle(sc.live)) if (opts.size < 4) opts.add(said(x.word))
  return shuffle([...opts])
}

// One scene with its three ways in. Explore: point at a thing to see its name, linger or click to hear it. Find: hear
// "Wo ist der Bus?" and click it. Name: a thing is circled; type (or choose) its name with der, die or das.
// focus (a station's word ids) narrows Find and Name to that station's words when the picture has four or more.
function Scene({ sc, focus }) {
  const [mode, setMode] = useState('look')
  const [all, setAll] = useState(true)
  const [paused, setPaused] = useState(false)
  const [weather, setWeather] = useState(sc.weathers[0])
  const [sel, setSel] = useState(null)
  const [hover, setHover] = useState(null)
  const [q, setQ] = useState(null)              // { o, got: null | 'right' | 'wrong' | index clicked, check, opts }
  const [score, setScore] = useState([0, 0])
  const [typed, setTyped] = useState('')
  const [choose, setChoose] = useState(false)
  const order = useRef([]), dwell = useRef(), input = useRef(), next = useRef()
  const shown = o => !o.only || o.only === weather
  useEffect(() => () => clearTimeout(dwell.current), [])
  useEffect(() => { if (q?.got === null) input.current?.focus({ preventScroll: true }); else next.current?.focus({ preventScroll: true }) }, [q, choose])

  const ask = (m, wx = weather) => {
    if (!order.current.length) {
      const vs = sc.live.filter(o => !o.only || o.only === wx)
      const mine = focus ? vs.filter(o => focus.has(o.word.id)) : []
      order.current = shuffle(mine.length >= 4 ? mine : vs)
    }
    const o = order.current.pop()
    if (!o) return setQ(null)
    setQ({ o, got: null, opts: m === 'name' ? nameOptions(o, sc) : null }); setTyped('')
    if (m === 'find') speak(askLine(o.word))
  }
  const go = (m, wx = weather) => {
    clearTimeout(dwell.current)
    setMode(m); setSel(null); setScore([0, 0]); order.current = []
    if (m === 'look') setQ(null); else ask(m, wx)
  }
  const pickWeather = wx => { setWeather(wx); setSel(null); if (mode !== 'look') go(mode, wx) }
  const onHover = o => {
    clearTimeout(dwell.current)
    setHover(o ? o.i : null)
    if (o && mode === 'look' && o.i !== sel) dwell.current = setTimeout(() => { setSel(o.i); speak(said(o.word)) }, 700)
  }
  const tap = o => {
    clearTimeout(dwell.current)
    if (mode === 'look') { setSel(o.i); speak(said(o.word)); return }
    if (mode !== 'find' || !q || q.got !== null) return
    const right = o.i === q.o.i || o.word.id === q.o.word.id
    setQ({ ...q, got: right ? 'right' : o.i })
    setScore(([a, b]) => [a + right, b + 1])
    speak(said(right ? q.o.word : o.word))
  }
  const check = text => {
    if (!q || q.got !== null || !text.trim()) return
    const c = checkAnswer(text, q.o.word, D.words)
    const right = c.verdict !== 'wrong'
    setQ({ ...q, got: right ? 'right' : 'wrong', check: c, typed: text })
    setScore(([a, b]) => [a + right, b + 1])
    speak(said(q.o.word))
  }

  const cls = o => (mode === 'look' ? (sel === o.i || hover === o.i ? 'sel' : '')
    : !q || (q.o.i !== o.i && q.got !== o.i) ? ''
    : q.o.i === o.i ? (q.got === null ? (mode === 'name' ? 'ask' : '') : q.got === 'right' ? 'good' : 'show') : 'bad')
  const tagOn = o => (mode === 'look' ? all || o.i === hover || o.i === sel : q?.got != null && (o.i === q.o.i || o.i === q.got))
  const picked = mode === 'look' && sc.objs[hover ?? sel]
  const w = q?.o.word
  const first = w => w.en.split(';')[0]
  return html`<div class="scene">
    <div class=${`scene-stage${paused ? ' paused' : ''}`}>
      <${SceneArt} sc=${sc} cls=${cls} tagOn=${tagOn} onTap=${tap} onHover=${onHover} weather=${weather} held=${mode === 'look' ? hover : null}
        ring=${q && (mode === 'name' || q.got !== null) ? q.o.i : undefined} />
    </div>
    <aside class="scene-panel">
      <div class="scene-tools">
        <div class="modes" role="tablist" aria-label="How to practise">
          ${[['look', 'Explore'], ['find', 'Find it'], ['name', 'Name it']].map(([id, en]) => html`<button type="button" role="tab"
            aria-selected=${mode === id} class=${mode === id ? 'on' : ''} onClick=${() => go(id)}>${en}</button>`)}
        </div>
        ${sc.weathers.length > 1 ? html`<div class="scene-wx" role="group" aria-label="Weather">${sc.weathers.map(x => html`<button type="button"
          class=${weather === x ? 'on' : ''} aria-pressed=${weather === x} onClick=${() => pickWeather(x)}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${WEATHER[x][1]}</svg>${WEATHER[x][0]}</button>`)}</div>` : ''}
        <div class="scene-tog">
          ${mode === 'look' ? html`<button type="button" class=${`toggle show-all${all ? ' on' : ''}`} aria-pressed=${all} onClick=${() => setAll(!all)}>
            <span class="toggle-knob"></span>Show all names</button>` : ''}
          ${!reducedMotion() ? html`<button type="button" class=${`toggle${paused ? ' on' : ''}`} aria-pressed=${paused} onClick=${() => setPaused(!paused)}>
            <span class="toggle-knob"></span>Pause the motion</button>` : ''}
        </div>
      </div>
      <div class="scene-body" aria-live="polite">
        ${mode === 'look' && html`${picked ? html`<div class="scene-word" key=${picked.i}>
            <p class="scene-big"><${Word} w=${picked.word} /><${SayButton} text=${said(picked.word)} /></p>
            <p class="scene-en">${picked.word.en}</p>
            ${picked.word.p === 'n' && formsNote(picked.word) ? html`<p class="scene-pl">${formsNote(picked.word).startsWith('die ')
              ? html`Plural <b lang="de">${formsNote(picked.word)}</b>` : formsNote(picked.word)}</p>` : ''}
            ${D.stations[picked.word.n] ? html`<${StationChip} n=${picked.word.n} tab="words" />` : ''}
          </div>`
          : html`<div class="scene-hint"><b>${sc.live.filter(shown).length} words</b>
            <p>Point at a thing, or at a word below. Stay on it, or click, to hear it.</p></div>`}
          <div class="scene-bank" onPointerLeave=${() => setHover(null)}>${sc.live.filter(shown).map(o => html`<button type="button" key=${o.i}
            class=${o.i === (hover ?? sel) ? 'on' : ''} onPointerEnter=${() => setHover(o.i)} onFocus=${() => setHover(o.i)} onBlur=${() => setHover(null)}
            onClick=${() => tap(o)}><${Word} w=${o.word} /></button>`)}</div>`}
        ${mode === 'find' && q && html`<div class="scene-q">
          <p class="scene-k">${score[0]} of ${score[1]} right</p>
          <p class="scene-prompt" lang="de">${w.p === 'n' ? html`${w.a === 'pl' ? 'Wo sind' : 'Wo ist'} <${Word} w=${w} />?` : html`<${Word} w=${w} />`}</p>
          <button type="button" class="scene-again" onClick=${() => speak(askLine(w))}><${Speaker} /> Hear it again</button>
          ${q.got === null ? html`<p class="quiet">Click it in the picture.</p>`
            : q.got === 'right' ? html`<p class="scene-yes"><b>Ja, genau!</b> <${Word} w=${w} /> · ${first(w)}</p>`
            : html`<p class="scene-no">That is <${Word} w=${sc.objs[q.got].word} />. <${Word} w=${w} /> (${first(w)}) is circled now.</p>`}
          ${q.got !== null ? html`<button type="button" class="btn" ref=${next} onClick=${() => ask('find')}>Next word <${Arrow} /></button>` : ''}
        </div>`}
        ${mode === 'name' && q && html`<div class="scene-q">
          <p class="scene-k">${score[0]} of ${score[1]} right</p>
          <p class="scene-prompt" lang="de">Wie heißt das?</p>
          ${q.got === null ? html`<p class="quiet">The circled thing, with der, die or das.</p>
            ${choose ? html`<div class="scene-opts">${q.opts.map(t => html`<button type="button" lang="de" onClick=${() => check(t)}>${t}</button>`)}</div>`
              : html`<form class="scene-type" onSubmit=${e => { e.preventDefault(); check(typed) }}>
                  <input ref=${input} lang="de" autocomplete="off" autocapitalize="off" spellcheck="false" value=${typed}
                    onInput=${e => setTyped(e.target.value)} placeholder=${w.a && w.a !== 'pl' ? 'der/die/das + word' : 'Type the German'} aria-label="Its name in German" />
                  <button type="submit" class="btn">Check</button>
                </form>`}
            <button type="button" class="scene-swap" onClick=${() => setChoose(!choose)}>${choose ? 'Type it instead' : 'Choose from four instead'}</button>`
          : html`<p class=${`typed ${q.check.verdict}`}><span class="typed-v">${{ right: 'Right', close: 'Right', typo: 'Nearly: one letter off', wrong: 'Not quite' }[q.check.verdict]}</span>
              ${q.check.verdict !== 'right' ? html`<span lang="de" class="typed-diff">${diffChars(q.typed.trim(), said(w)).map(([ch, k]) => (k === 'same' ? ch : k === 'miss' ? html`<u>${ch}</u>` : html`<s>${ch}</s>`))}</span>` : ''}
              ${q.check.notes.length ? html`<small>${q.check.notes.join(' ')}</small>` : ''}</p>
            <p class="scene-big"><${Word} w=${w} /><${SayButton} text=${said(w)} /></p>
            <p class="scene-en">${w.en}</p>
            <button type="button" class="btn" ref=${next} onClick=${() => ask('name')}>Next <${Arrow} /></button>`}
        </div>`}
      </div>
    </aside>
  </div>`
}

// A flashcard's picture: the word's thing circled in its scene, cropped around it and its board, holding still.
function ScenePic({ w }) {
  const pic = w && scenes().pictureOf[w.id]
  const ref = useRef()
  const [box, setBox] = useState(null)
  useLayoutEffect(() => {
    const look = pic && ref.current?.querySelector(`.sc-obj[data-i="${pic.o.i}"] .sc-look`)
    if (!look) return
    const b = look.getBBox(), { o } = pic, [rx, ry] = o.rest ?? [0, 0]
    const t = boardBox(o, [rx, ry])
    const x0 = Math.min(o.at[0] + rx + b.x, t[0]), y0 = Math.min(o.at[1] + ry + b.y, t[1])
    const x1 = Math.max(o.at[0] + rx + b.x + b.width, t[2]), y1 = Math.max(o.at[1] + ry + b.y + b.height, t[3])
    let wd = x1 - x0 + 80, ht = y1 - y0 + 60
    if (wd / ht < 16 / 9) wd = ht * 16 / 9; else ht = wd * 9 / 16
    if (ht > SCENE_H) { ht = SCENE_H; wd = ht * 16 / 9 }
    const inside = (v, size, max) => Math.min(Math.max(v, 0), Math.max(0, max - size))   // the crop stays in the picture
    setBox(`${inside((x0 + x1 - wd) / 2, wd, SCENE_W)} ${inside((y0 + y1 - ht) / 2, ht, SCENE_H)} ${wd} ${ht}`)
  }, [pic])
  if (!pic) return ''
  return html`<div class="scene-pic" ref=${ref} title=${`In the picture: ${pic.sc.de}`}>
    <${SceneArt} sc=${pic.sc} cls=${x => (x.i === pic.o.i ? 'sel' : '')} tagOn=${x => x.i === pic.o.i} weather=${pic.o.only} frozen viewBox=${box} />
  </div>`
}

// A small thumbnail link to the station's picture, for its Words tab.
function SceneLink({ n }) {
  const sc = scenesFor(n)[0]
  if (!sc) return ''
  return html`<a class="scene-link" href=${`#/station/${n}/pictures`}>
    <span class="scene-link-art"><${SceneArt} sc=${sc} frozen /></span>
    <span>See them in a picture<small lang="de">${sc.de}</small></span>
  </a>`
}

const StationChip = ({ n, tab = 'pictures' }) => {
  const st = D.stations[n]
  return st ? html`<a class=${`scene-chip l${st.level}`} href=${`#/station/${n}/${tab}`} title=${`Station ${st.k} of ${st.level}`}>
    <span class="lb">${st.level}</span> ${st.k} <span lang="de">${st.de}</span></a>` : ''
}

function PicturesPage({ arg }) {
  const { list, byId } = scenes()
  const sc = arg && byId[decodeURIComponent(arg)]
  if (sc) {
    return html`<main class=${`pictures l${sc.level}`}>
      <a class="back" href="#/pictures">← All picture scenes</a>
      <header class="scene-head"><h1 lang="de">${sc.de}</h1><span class="scene-head-en">${sc.en}</span>
        <span class="scene-chips">${sc.stations.map(n => html`<${StationChip} n=${n} />`)}</span></header>
      <${Scene} key=${sc.id} sc=${sc} />
    </main>`
  }
  return html`<main class="pictures">
    <header class="masthead"><h1>Picture scenes</h1>
      <p>Drawn scenes where every labelled thing is a word with its article. Explore them, find things by name, or name them.</p></header>
    ${arg ? html`<p class="soon">There is no picture called "${arg}". Here are all of them.</p>` : ''}
    ${!list.length ? html`<p class="soon">The pictures are being drawn now.</p>` : ''}
    ${D.levels.map(lv => {
      const mine = list.filter(s => s.level === lv.level)
      return mine.length ? html`<section class=${`scene-level l${lv.level}`} aria-label=${lv.level}>
        <h2><span class="lb big">${lv.level}</span> ${lv.title}</h2>
        <div class="scene-cards">${mine.map(s => html`<a class="scene-card" href=${`#/pictures/${s.id}`}>
          <${SceneArt} sc=${s} frozen />
          <span class="scene-card-t"><b lang="de">${s.de}</b> ${s.en}</span>
          <small>${s.live.length} words · ${s.stations.map(n => D.stations[n] && `${D.stations[n].level} ${D.stations[n].k}`).filter(Boolean).join(', ')}</small>
        </a>`)}</div>
      </section>` : ''
    })}
  </main>`
}
PAGES.pictures = PicturesPage

function PicturesTab({ data, n }) {
  const mine = scenesFor(n)
  const [i, setI] = useState(0)
  const focus = useMemo(() => new Set((data.wordsBy[n] ?? []).map(w => w.id)), [data, n])
  if (!mine.length) {
    return html`<p class="soon">This station has no picture scene of its own. <a href="#/pictures">See all picture scenes</a></p>`
  }
  const sc = mine[Math.min(i, mine.length - 1)]
  return html`<div class="pictures-tab">
    ${mine.length > 1 ? html`<div class="modes" role="tablist" aria-label="Pictures">${mine.map((s, j) => html`<button type="button" role="tab"
      aria-selected=${s === sc} class=${s === sc ? 'on' : ''} onClick=${() => setI(j)} lang="de">${s.de}</button>`)}</div>` : ''}
    <${Scene} key=${sc.id} sc=${sc} focus=${focus} />
  </div>`
}
TAB_VIEWS.pictures = PicturesTab

// ==== src/75-sounds.js ====
// ---- pronunciation: a drawn mouth for each sound, minimal pairs for the ear, and your own voice to compare ----

// Each sound is taught as the steps the mouth moves through, usually the nearest English sound first and then the
// German one, so the drawing shows exactly what changes. lips: spread | round | open | neutral; tongue: a TONGUE
// shape; jaw 0…1; air: where the air hisses (front, back, tip); voice: the throat buzzes; hold: vowel length 0…1.
// focus names the parts that change, drawn in the line colour. say: a word that has the sound, read on a tap.
const SOUND_STEPS = {
  ue: { focus: ['lips'], steps: [
    { k: 'ee', en: 1, lips: 'spread', tongue: 'front', jaw: .15, voice: 1, note: "English 'ee', as in 'see': the lips are spread." },
    { k: 'ü', lips: 'round', tongue: 'front', jaw: .15, voice: 1, say: 'Tür', note: 'ü: the tongue stays exactly where it was. Only the lips round and push forward.' }] },
  oe: { focus: ['lips'], steps: [
    { k: 'e', lips: 'spread', tongue: 'mid', jaw: .25, voice: 1, say: 'See', note: "German long e, as in See: the lips are spread." },
    { k: 'ö', lips: 'round', tongue: 'mid', jaw: .25, voice: 1, say: 'schön', note: "ö: the same tongue, with the lips rounded as for 'oh'." }] },
  ae: { focus: ['jaw'], steps: [
    { k: 'e', lips: 'spread', tongue: 'front', jaw: .15, voice: 1, say: 'See', note: 'German long e, as in See: the mouth is almost closed.' },
    { k: 'ä', lips: 'neutral', tongue: 'mid', jaw: .5, voice: 1, say: 'Käse', note: "ä: drop the jaw a little and relax the lips: the 'e' of 'bed'." }] },
  ich: { focus: ['tongue', 'air'], steps: [
    { k: 'ee', en: 1, lips: 'spread', tongue: 'front', jaw: .15, voice: 1, note: "Say 'ee': the middle of the tongue rises toward the roof of the mouth." },
    { k: 'ch', lips: 'spread', tongue: 'ich', jaw: .15, air: 'front', say: 'ich', note: 'ich: lift it a little closer, switch your voice off and blow: a hiss in the narrow gap.' }] },
  ach: { focus: ['tongue', 'air'], steps: [
    { k: 'k', en: 1, lips: 'neutral', tongue: 'k', jaw: .3, note: "'k': the back of the tongue touches the soft palate and stops the air." },
    { k: 'ch', lips: 'neutral', tongue: 'back', jaw: .3, air: 'back', say: 'acht', note: "ach: lower it just a little and let the air rasp through, as in Scottish 'loch'." }] },
  r: { focus: ['tongue'], steps: [
    { k: 'r', en: 1, lips: 'neutral', tongue: 'curl', jaw: .25, voice: 1, note: 'English r: the tongue tip curls up and back.' },
    { k: 'r', lips: 'neutral', tongue: 'uvular', jaw: .25, voice: 1, air: 'back', say: 'rot', note: 'German r: the tip stays down; the back of the tongue rises to the uvula, a soft gargle.' }] },
  z: { focus: ['tongue', 'air'], steps: [
    { k: 't', lips: 'spread', tongue: 't', jaw: .15, note: 'First a t: the tongue tip presses on the ridge behind the top teeth.' },
    { k: 's', lips: 'spread', tongue: 'tip', jaw: .15, air: 'tip', say: 'zehn', note: "Then let go straight into a sharp s. Together: ts, as at the end of 'cats'." }] },
  s: { focus: ['voice'], steps: [
    { k: 'ß', lips: 'spread', tongue: 'tip', jaw: .15, air: 'tip', say: 'heißen', note: 'ß, ss and s at the end of a word: a hiss. The throat is silent.' },
    { k: 's', lips: 'spread', tongue: 'tip', jaw: .15, air: 'tip', voice: 1, say: 'Sonne', note: "s before a vowel: the same hiss with your voice on. It buzzes like the English 'z'." }] },
  sch: { focus: ['lips', 'tongue'], steps: [
    { k: 's', lips: 'spread', tongue: 'tip', jaw: .15, air: 'tip', note: 's: the lips spread, the tongue tip at the ridge.' },
    { k: 'sch', lips: 'round', tongue: 'sch', jaw: .15, air: 'tip', say: 'Schule', note: "sch: the tongue slides a little back and the lips push forward: 'sh'." }] },
  'ei-ie': { focus: ['jaw', 'tongue'], steps: [
    { k: 'ie', lips: 'spread', tongue: 'front', jaw: .15, voice: 1, say: 'vier', note: "ie: one long 'ee'. The mouth holds still." },
    { k: 'ei', lips: 'open', tongue: 'low', jaw: .65, voice: 1, note: "ei starts wide open, on 'a' …" },
    { k: 'ei', lips: 'spread', tongue: 'front', jaw: .2, voice: 1, say: 'drei', note: "… and glides up toward 'ee': it sounds like 'eye'." }] },
  eu: { focus: ['tongue'], steps: [
    { k: 'eu', lips: 'round', tongue: 'back', jaw: .45, voice: 1, note: "eu starts on an open 'o', with the lips rounded …" },
    { k: 'eu', lips: 'round', tongue: 'front', jaw: .15, voice: 1, say: 'neu', note: "… and glides toward ü, the lips still round: 'oy', as in 'boy'." }] },
  'long-short': { focus: ['time'], steps: [
    { k: 'Staat', lips: 'open', tongue: 'low', jaw: .6, voice: 1, hold: 1, say: 'Staat', note: 'Long: hold the vowel, about twice as long.' },
    { k: 'Stadt', lips: 'open', tongue: 'low', jaw: .6, voice: 1, hold: .4, say: 'Stadt', note: 'Short: quick, cut off by the next consonant.' }] },
}
// The big letters on each sound's stop, and the letters that make the sound in its example words (first match).
const SOUND_CHIP = { ue: 'ü', oe: 'ö', ae: 'ä', ich: 'ch', ach: 'ch', r: 'r', z: 'z', s: 's ß', sch: 'sch', 'ei-ie': 'ei ie', eu: 'eu', 'long-short': 'a aa' }
const SOUND_MARK = { ue: /ü/i, oe: /ö/i, ae: /ä/i, ich: /ch/i, ach: /ch/i, r: /r/i, z: /tz|z/i, s: /ß|ss|s(?=[aeiouäöü])/i,
  sch: /sch|s(?=[pt])/i, 'ei-ie': /ei|ai|ie/i, eu: /eu|äu/i, 'long-short': /[aeiouäöü]+h?/i }

// ---- the mouth, seen from the side (facing left), with a front view of the lips ----

// Tongue shapes as [peak x, peak y, tip x, tip y], with the jaw closed; the jaw then lowers the whole tongue.
const TONGUE = { front: [112, 95, 62, 132], ich: [110, 89, 62, 132], mid: [124, 104, 62, 133], back: [170, 99, 64, 136],
  k: [172, 85, 64, 136], uvular: [182, 98, 66, 138], tip: [118, 108, 68, 108], t: [118, 106, 66, 104], sch: [110, 101, 76, 106],
  curl: [140, 114, 90, 99], low: [138, 122, 62, 136] }
const tonguePath = ([px, py, tx, ty]) =>
  `M206 214C206 ${py + 40} ${px + 40} ${py - 2} ${px} ${py}C${px - 30} ${py} ${tx + 18} ${ty - 10} ${tx} ${ty}C${tx - 6} ${ty + 6} ${tx - 2} ${ty + 14} ${tx + 8} ${ty + 16}C100 172 160 200 206 214Z`
// Lips: the side view's shift of the upper and lower lip, and the front view's outer and inner ellipse.
const LIPS = { spread: { up: [3, 0], lo: [3, 0], f: [31, 10, 25, 3] }, round: { up: [-8, 2], lo: [-8, -3], f: [17, 15, 6, 6] },
  open: { up: [1, -2], lo: [1, 1], f: [26, 19, 19, 12] }, neutral: { up: [0, 0], lo: [0, 0], f: [25, 12, 18, 5] } }
const AIR = { front: 'M216 196C214 140 170 96 112 94S70 118 20 116', back: 'M216 196C214 150 200 106 172 102S80 124 20 118',
  tip: 'M216 196C214 140 150 112 96 108S74 106 20 114' }
const MOUTH = {
  head: 'M70 0H320V250H230L226 104C224 96 218 90 210 90C204 90 200 96 199 104C200 112 195 117 192 111C190 99 182 84 160 80C130 76 90 82 68 100L62 104L52 119L44 104C40 100 36 98 30 96C22 94 14 90 14 84C14 78 20 74 24 70C38 56 54 40 62 24Z',
  jaw: 'M50 127L56 128C80 148 120 168 200 204L208 214V280H118V228C96 224 66 222 52 212C40 204 34 192 36 182C38 172 44 164 43 157C42 151 35 148 34 141C33 134 40 128 50 127Z',
  toothUp: 'M58 103L64 104L61 122C59 124 56 123 55 121Z', toothLo: 'M56 141L61 141L62 127C60 125 57 125 56 127Z',
  lipUp: 'M54 108C46 103 37 102 33 108C30 114 34 121 44 122L55 121Z', lipLo: 'M55 127H44C35 127 31 133 33 139C36 146 47 146 55 139Z',
  chin: 'M118 228C96 224 66 222 52 212C40 204 34 192 36 182C38 172 44 164 43 157C42 151 35 148 34 141',
  palate: 'M64 104C88 82 128 76 160 80C182 84 190 99 192 111', cavity: 'M44 100L232 66V250H206L200 204L56 128L48 128Z',
}
function SoundMouth({ st, focus }) {
  const L = LIPS[st.lips] ?? LIPS.neutral
  const tp = tonguePath(TONGUE[st.tongue] ?? TONGUE.mid)
  const [orx, ory, irx, iry] = L.f
  const hot = part => (focus.includes(part) ? ' hot' : '')
  const move = ([x, y]) => `transform:translate(${x}px,${y}px)`
  return html`<svg class="mouth" viewBox="0 0 320 250" role="img" aria-label=${`Mouth from the side: ${st.note}`}>
    <path class="m-cavity" d=${MOUTH.cavity} />
    <g class="m-jaw" style=${`transform:translateY(${(st.jaw ?? .2) * 30}px)`}>
      <path class="m-skin" d=${MOUTH.jaw} />
      ${focus.includes('jaw') ? html`<path class="m-chin hot" d=${MOUTH.chin} />` : ''}
      <path class=${`m-tongue${hot('tongue')}`} d=${tp} style=${`d:path('${tp}')`} />
      <text class="m-in" x="118" y="166">tongue</text>
      <path class="m-tooth" d=${MOUTH.toothLo} />
      <path class=${`m-lip${hot('lips')}`} d=${MOUTH.lipLo} style=${move(L.lo)} />
    </g>
    <path class="m-skin" d=${MOUTH.head} />
    <path class="m-palate" d=${MOUTH.palate} />
    <path class="m-tooth" d=${MOUTH.toothUp} />
    <path class=${`m-lip${hot('lips')}`} d=${MOUTH.lipUp} style=${move(L.up)} />
    ${st.air ? html`<path key=${st.air} class=${`m-air${hot('air')}`} d=${AIR[st.air]} />` : ''}
    <g class=${`m-voice${st.voice ? ' on' : ''}${hot('voice')}`}><path d="M210 236l6-5 6 5 6-5" /><path d="M210 226l6-5 6 5 6-5" /></g>
    <g class="m-labels">
      <text x="92" y="68">roof of the mouth</text>
      <text x="240" y="121">soft palate</text><path d="M238 118L201 108" />
      <text x="240" y="229">${st.voice ? 'voice: buzz' : 'voice: off'}</text><path d="M238 226L229 229" />
      <text x="4" y="160">lips</text><path d="M14 152L28 136" />
    </g>
    <g class="m-front" transform="translate(278 46)">
      <circle r="34" />
      <ellipse class=${`m-lipf${hot('lips')}`} rx=${orx} ry=${ory} style=${`rx:${orx}px;ry:${ory}px`} />
      <ellipse class="m-hole" rx=${irx} ry=${iry} style=${`rx:${irx}px;ry:${iry}px`} />
      <text y="48">lips from the front</text>
    </g>
  </svg>`
}

// Steps one after another, on a loop until the learner picks one (no loop under reduced motion).
function SoundDiagram({ s }) {
  const def = SOUND_STEPS[s.id] ?? { focus: [], steps: [{ k: s.sound, ...s.mouth, voice: 1, note: s.how }] }
  const steps = def.steps
  const [at, setAt] = useState(steps.length - 1)
  const [auto, setAuto] = useState(() => steps.length > 1 && !reducedMotion())
  useEffect(() => {
    if (!auto) return
    const t = setInterval(() => setAt(i => (i + 1) % steps.length), 2200)
    return () => clearInterval(t)
  }, [auto])
  const st = steps[at]
  const pick = i => { setAuto(false); setAt(i); if (steps[i].say) speak(steps[i].say) }
  return html`<section class="snd-diagram" aria-label="How the mouth moves">
    <${SoundMouth} st=${st} focus=${def.focus} />
    ${def.focus.includes('time') ? html`<div class="snd-time" aria-hidden="true">${steps.map((x, i) => html`<p class=${i === at ? 'on' : ''}>
      <b lang="de">${x.k}</b><span><i key=${`${at}-${i}`} style=${`--hold:${x.hold}`}></i></span></p>`)}</div>` : ''}
    <div class="snd-steps" role="group" aria-label="Steps">
      ${steps.map((x, i) => html`${i ? html`<span class="snd-to" aria-hidden="true">→</span>` : ''}<button type="button" aria-pressed=${i === at}
        class=${`${i === at ? 'on' : ''}${x.en ? ' en' : ''}`} onClick=${() => pick(i)}><b lang=${x.en ? 'en' : 'de'}>${x.k}</b><small>${x.en ? 'English' : 'German'}</small></button>`)}
      ${steps.length > 1 ? html`<button type="button" class="snd-auto" onClick=${() => setAuto(a => !a)} aria-pressed=${auto}>
        ${auto ? html`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" /></svg> Pause`
          : html`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg> Play the change`}</button>` : ''}
    </div>
    <p class="snd-cap" key=${at}>${st.note}${st.say ? html` <${SayButton} text=${st.say} />` : ''}</p>
  </section>`
}

const SoundWord = ({ w, mark }) => {
  const m = mark?.exec(w)
  return html`<span lang="de">${m ? html`${w.slice(0, m.index)}<mark>${m[0]}</mark>${w.slice(m.index + m[0].length)}` : w}</span>`
}

// ---- hear one word of a pair and pick which it was ----

function SoundPairs({ s }) {
  const [round, setRound] = useState(() => shuffle(s.pairs))
  const [k, setK] = useState(0)
  const [target, setTarget] = useState(() => Math.round(Math.random()))
  const [picked, setPicked] = useState(null)
  const [heard, setHeard] = useState(false)
  const [right, setRight] = useState(0)
  const p = round[k]
  const best = S.practice[`sound:${s.id}`]
  const play = (t = target) => { speak(p ? p[t] : ''); setHeard(true) }
  const choose = j => {
    if (picked !== null || !heard) return
    setPicked(j)
    const ok = j === target
    if (ok) setRight(r => r + 1)
    if (k + 1 === round.length) commit(x => { x.practice[`sound:${s.id}`] = Math.max(x.practice[`sound:${s.id}`] ?? 0, (right + ok) / round.length) })
  }
  const next = () => {
    if (picked === null) return
    const t = Math.round(Math.random())
    setK(k + 1); setPicked(null); setTarget(t)
    if (round[k + 1]) { speak(round[k + 1][t]); setHeard(true) } else setHeard(false)
  }
  const again = () => { setRound(shuffle(s.pairs)); setK(0); setRight(0); setPicked(null); setHeard(false) }
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest?.('input, textarea, select') || e.ctrlKey || e.altKey || e.metaKey) return
      if ((e.key === '1' || e.key === '2') && p) choose(+e.key - 1)
      else if (e.key.toLowerCase() === 'r' && p) play()
      else if (e.key === 'Enter' && picked !== null && !e.target.closest?.('button, a')) next()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })
  return html`<section class="snd-drill snd-pairs" aria-labelledby="snd-pairs-h">
    <header><h2 id="snd-pairs-h">Which one did you hear?</h2>
      <span class="snd-score">${p ? html`Pair <b>${k + 1}</b> of ${round.length} · <b>${right}</b> right` : ''}${best !== undefined ? html` · best ${pct(best)}` : ''}</span></header>
    ${!p ? html`<div class="quiz-end">
        <span class=${`stamp ${right / round.length >= .6 ? 'pass' : 'fail'}`}>${right / round.length >= .6 ? 'Gut gehört' : 'Noch nicht'}</span>
        <p><b>${right} of ${round.length}</b> right. ${right === round.length ? 'Your ear tells these apart.' : 'Listen to the pairs you missed side by side, then try another round.'}</p>
        <button type="button" class="btn" onClick=${again}>Another round <${Arrow} /></button></div>`
      : html`<button type="button" class="snd-play" onClick=${() => play()} aria-label="Play the word">
          <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
            <path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
          <span>${heard ? 'Hear it again' : 'Play the word'}</span><kbd>R</kbd></button>
        <ol class="snd-opts">${[0, 1].map(j => html`<li><button type="button" disabled=${!heard || picked !== null} onClick=${() => choose(j)}
          class=${picked === null ? '' : j === target ? 'right' : j === picked ? 'wrong' : 'dim'}>
          <kbd>${j + 1}</kbd><b lang="de">${p[j]}</b><small>${p[j + 2]}</small></button></li>`)}</ol>
        ${picked !== null ? html`<div class=${`why ${picked === target ? 'right' : 'wrong'}`}>
          <p><b>${picked === target ? 'Right.' : 'Not quite.'}</b> It was <b lang="de">${p[target]}</b> (${p[target + 2]}).
            <button type="button" class="snd-mini" onClick=${() => speakLines([['A', p[0]], ['A', p[1]], ['A', p[0]], ['A', p[1]]])}>Hear both</button></p>
          <button type="button" class="btn" onClick=${next}>${k + 1 === round.length ? 'See the result' : 'Next pair'} <${Arrow} /></button>
        </div>` : html`<p class="quiet snd-hint">${heard ? 'Pick the word you heard: 1 or 2.' : 'Play the word first. The voice says one of these two.'}</p>`}`}
  </section>`
}

// ---- say a word of a pair, then hear the voice and yourself back to back ----

const canRecord = () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder)
const sameWord = (a, b) => a.localeCompare(b, 'de', { sensitivity: 'accent' }) === 0   // schön ≠ schon, Schön = schön
const canRecognise = () => !!SpeechRec && !navigator.brave   // Brave has the API but it never hears anything
function SoundSayWord({ word, other }) {
  const r = useRecorder()
  const audio = useRef()
  const timer = useRef()
  const rec = async () => {
    if (r.state === 'rec') { clearTimeout(timer.current); r.stop(); return }
    if (await r.start()) timer.current = setTimeout(r.stop, 2800)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  const compare = () => speakLines([['A', word]], { onEnd: () => audio.current?.play() })
  const heard = r.heard.match(/[\p{L}ß]+/gu) ?? []
  const verdict = !heard.length ? null : heard.some(h => sameWord(h, word)) ? 'ok' : heard.some(h => sameWord(h, other)) ? 'other' : 'unclear'
  return html`<div class="snd-rec">
    <div class="snd-rec-row">
      <button type="button" class="snd-mini" onClick=${() => speak(word)}><${Speaker} /> Hear it</button>
      <button type="button" class=${`snd-mic${r.state === 'rec' ? ' on' : ''}`} onClick=${rec} disabled=${!canRecord()}
        aria-label=${r.state === 'rec' ? 'Stop recording' : `Record yourself saying ${word}`}>
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">${r.state === 'rec' ? html`<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />`
          : html`<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4M8.5 21h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />`}</svg>
        <span>${r.state === 'rec' ? 'Stop' : r.url ? 'Record again' : 'Record yourself'}</span></button>
      <button type="button" class="snd-mini" onClick=${compare} disabled=${!r.url}>Voice, then you</button>
    </div>
    ${r.url ? html`<audio ref=${audio} src=${r.url} controls class="snd-audio"></audio>` : ''}
    ${verdict ? html`<p class=${`snd-verdict ${verdict}`}>The browser heard <b lang="de">${r.heard.trim()}</b>.
      ${verdict === 'ok' ? ' Clear: that is the word you meant.' : verdict === 'other' ? html` That is the other word of the pair: watch the mouth drawing and try again.` : ' Not quite either word: try again, a little slower.'}</p>`
      : r.url && r.state !== 'rec' ? html`<p class="quiet snd-hint">${canRecognise() ? 'Nothing was written down this time: speak a little louder and closer.'
        : "This browser doesn't write down what it hears (Edge and Chrome do), so listen to both and judge yourself."}</p>` : ''}
    ${r.error ? html`<p class="snd-verdict other" role="alert">${r.error}</p>` : ''}
  </div>`
}

function SoundSay({ s }) {
  const [k, setK] = useState(0)
  const [side, setSide] = useState(0)
  const p = s.pairs[k]
  const go = d => { setK((k + d + s.pairs.length) % s.pairs.length); setSide(0) }
  return html`<section class="snd-drill snd-say" aria-labelledby="snd-say-h">
    <header><h2 id="snd-say-h">Say it yourself</h2><span class="snd-score">Pair <b>${k + 1}</b> of ${s.pairs.length}</span></header>
    <div class="snd-pick">
      <button type="button" class="snd-mini" onClick=${() => go(-1)} aria-label="Previous pair">←</button>
      <div class="snd-pair" role="radiogroup" aria-label="The word to say">${[0, 1].map(j => html`<button type="button" role="radio" aria-checked=${side === j}
        class=${side === j ? 'on' : ''} onClick=${() => setSide(j)}><b lang="de">${p[j]}</b><small>${p[j + 2]}</small></button>`)}</div>
      <button type="button" class="snd-mini" onClick=${() => go(1)} aria-label="Next pair">→</button>
    </div>
    ${canRecord() ? '' : html`<p class="snd-verdict other">This browser can't record here. Hear the word and say it aloud anyway: saying it is what counts.</p>`}
    <${SoundSayWord} key=${`${s.id}-${k}-${side}`} word=${p[side]} other=${p[1 - side]} />
    <p class="quiet snd-hint">Your recording stays in this browser; nothing is sent anywhere.</p>
  </section>`
}

// ---- the page: the twelve sounds as stops on a line ----

function SoundsPage({ data, arg }) {
  useStore()
  const sounds = data.sounds ?? []
  const s = sounds.find(x => x.id === arg) ?? sounds[0]
  useEffect(() => () => stopSpeech(), [])
  if (!s) return html`<main class="sounds"><header class="masthead"><h1>Pronunciation</h1><p>The sound guide is being written now.</p></header></main>`
  const mark = SOUND_MARK[s.id]
  return html`<main class="sounds">
    <header class="masthead"><h1>Pronunciation</h1><p>The sounds English speakers find hardest. Watch what the mouth does, hear the words, then test your ear and your voice.</p></header>
    <nav class="snd-line" aria-label="Sounds"><ol>${sounds.map(x => {
      const best = S.practice[`sound:${x.id}`]
      return html`<li class=${x === s ? 'on' : best !== undefined ? 'tried' : ''}><a href=${`#/sounds/${x.id}`} aria-current=${x === s ? 'page' : null} title=${x.title}>
        <b lang="de">${SOUND_CHIP[x.id] ?? x.sound}</b><small lang="de">${x.examples[0][0]}</small>${best !== undefined ? html`<span class="pbar"><i style=${`--p:${best}`}></i></span>` : ''}</a></li>`
    })}</ol></nav>
    <div class="snd-main" key=${s.id}>
      <${SoundDiagram} s=${s} />
      <section class="snd-info" aria-labelledby="snd-h">
        <p class="snd-ipa"><span class="lb">${sounds.indexOf(s) + 1} of ${sounds.length}</span> <span>${s.ipa}</span></p>
        <h2 id="snd-h">${s.title}</h2>
        <p class="snd-how">${s.how}</p>
        <p class="snd-en"><b>For English speakers</b>${s.en_compare}</p>
        <h3>Hear the words</h3>
        <ul class="snd-words">${s.examples.map(([w, en]) => html`<li><button type="button" onClick=${() => speak(w)} aria-label=${`Play ${w}`}>
          <${Speaker} /><b><${SoundWord} w=${w} mark=${mark} /></b><small>${en}</small></button></li>`)}</ul>
      </section>
    </div>
    <div class="snd-drills" key=${`d-${s.id}`}>
      <${SoundPairs} s=${s} />
      <${SoundSay} s=${s} />
    </div>
  </main>`
}
PAGES.sounds = SoundsPage

// ==== src/80-home.js ====
// ---- home: what to do next, the practice tiles, the route, the top bar and settings ----

// What to do at a part, said once for the plan rail and once for the next-step sentence.
const STEP = {
  cards: [(st, q) => {
    const reviews = q.filter(c => S.cards[c.id]).length, fresh = q.length - reviews
    return reviews ? html`Start with the <b>${plural(reviews, 'review')}</b> due today${fresh ? html`, then learn <b>${plural(fresh, 'new card')}</b>` : ''}.`
      : html`Learn <b>${plural(fresh, 'new word')}</b> from <span lang="de">${st.de}</span>${st.k > 1 || st.level !== 'A1' ? ' and earlier stations.' : /[.!?]$/.test(st.de) ? '' : '.'}`
  }, "Start today's cards"],
  words: [() => 'Look through the words of this station, each noun with its article, plural and sound, and test yourself.', 'Open the words'],
  grammar: [st => html`Now the grammar, starting with <b>${st.grammar[0][1]}</b>.`, 'Open the grammar'],
  read: [() => 'Read a short text and answer questions in the Lesen format.', 'Start reading'],
  listen: [() => 'Listen to everyday dialogues and announcements, as in the Hören module.', 'Start listening'],
  write: [() => 'Write a short exam task and check it against the rubric.', 'Start writing'],
  speak: [() => 'Speak an exam task out loud, with a timer and a recording.', 'Start speaking'],
  test: [() => 'Take the station test. 60% passes.', 'Take the test'],
}

// Today at this stop: the day's cards first, then each part of the station in order.
function todayPlan(st, q) {
  const cards = D.words.length ? [{ part: 'cards', label: 'Cards', href: '#/study', p: q.length ? 0 : 1, state: q.length ? 'todo' : 'done', note: q.length ? `${q.length} · about ${Math.max(1, Math.round(q.length * 10 / 60))} min` : 'done' }] : []
  return [...cards, ...revisitStops(), ...PARTS.map(part => {   // revisit stops (L15) and spaced mocks (L17): 85-tests.js
    const p = partDone(st.n, part)
    return { part, label: TAB_NAME[part], href: `#/station/${st.n}/${part}`, p, state: p >= 1 ? 'done' : p > 0 ? 'part' : 'todo' }
  }), ...mockStops(st)]
}

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
  { href: '#/tips/0', en: 'How you learn here', hint: 'The research behind the app, in nine tips', icon: 'tip' },
]
const Tiles = () => html`<ul class="tiles">${TOOLS.map(t => html`<li>
  <a class="tile" href=${t.href}><svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">${ICONS[t.icon]}</svg>
    <b>${t.en}</b><small>${t.hint}</small></a></li>`)}</ul>`

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
  const due = queue().length
  const links = [['', 'Today'], ['study', 'Cards', due], ['practice', 'Practice'], ['tests', 'Tests'], ['mock', 'Mock exam'], ['pictures', 'Pictures']]
  const on = p => (p === '' ? !page : page === p)
  return html`<header class=${`topbar l${st.level}`}>
    <a class="brand" href="#/"><${Mark} /><span class="brand-name"><b lang="de">Weg nach Deutschland</b><small>Path to Germany</small></span></a>
    <nav class="topnav" aria-label="Main"><ul>${links.map(([p, label, n]) => html`<li>
      <a href=${`#/${p}`} class=${on(p) ? 'on' : ''} aria-current=${on(p) ? 'page' : null}>${label}${n ? html` <b class="count" aria-label=${`${n} due`}>${n}</b>` : ''}</a></li>`)}</ul></nav>
    <a class="tb-stop" href=${`#/station/${s.lesson}`} title="Your current stop"><span class="lb">${st.level}</span>
      <span><span class="tb-stop-k">${String(st.k).padStart(2, '0')}</span> <span lang="de">${st.de}</span></span></a>
  </header>`
}

function Home({ data }) {
  const s = useStore()
  const [picked, setPicked] = useState(null)
  const st = here(data)
  const lv = data.level[st.level]
  const q = queue()
  const plan = todayPlan(st, q)
  const step = plan.find(p => p.state !== 'done')
  const next = data.stations[st.n + 1]
  const pick = n => {
    setPicked(n === picked ? null : n)
    setTimeout(() => document.querySelector('.scard')?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' }), 50)
  }
  return html`<main class="home">
    <p class="welcome"><span lang="de">Liebe Sneka, willkommen!</span><small>Dear Sneka, welcome!</small></p>
    <p class="plan-line">${s.settings.plan ? html`<b>Your plan:</b> ${s.settings.plan}`
      : html`<a href="#/" onClick=${e => { e.preventDefault(); openSettings() }}>Plan when and where you study (one sentence)</a>`}</p>
    <section class=${`hero l${st.level}`} aria-label="Today">
      <${Board} data=${data} n=${st.n} home />
      <div class="go">
        <${Ring} p=${levelDone(lv)} label=${`of ${lv.level} done`} />
        <div class="go-text">
          ${step ? html`<p class="next-text">${STEP[step.part][0](st, q)}</p>
              <a class="btn big" href=${step.href}>${STEP[step.part][1]} <${Arrow} /></a>`
            : next ? html`<p class="next-text">Every part of <span lang="de">${st.de}</span> is done. Move on to the next station.</p>
              <button type="button" class="btn big" onClick=${() => commit(x => { x.lesson = next.n })}>Move on to <span lang="de">${next.de}</span> <${Arrow} /></button>`
            : html`<p class="next-text">Every station is done. Take the B1 mock exam until it passes every time.</p>
              <a class="btn big" href="#/mock/B1/full">Take the B1 mock exam <${Arrow} /></a>`}
          <p class="quiet">${plural(lv.stations.filter(x => stationDone(x.n) >= 1).length, 'station')} of ${lv.stations.length} done on the ${lv.level} line</p>
          <${Week} />
        </div>
      </div>
      <ol class="plan" aria-label="Today's plan at this station">${plan.map(p => html`<li class=${`${p.state}${p === step ? ' now' : ''}`}>
        <a href=${p.href}><span class="pdot" style=${`--p:${p.p}`}></span><b>${p.label}</b><small>${p.note && p.state !== 'done' ? p.note : p.state === 'done' ? 'done' : p.state === 'part' ? pct(p.p) : p === step ? 'next' : ''}</small></a>
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

// Installing a German voice needs an administrator PowerShell; the app offers the command and never runs it.
const VOICE_CMD = 'Add-WindowsCapability -Online -Name "Language.TextToSpeech~~~de-DE~0.0.1.0"'

// The last seven days as dots, filled on days with any answer. No streak count: missing one day is fine, two is a habit lost.
const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
function Week() {
  const s = useStore()
  const studied = new Set(s.log.map(([, , t]) => new Date(t).toLocaleDateString('en-CA')))
  const days = Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() - 6 + k); return d })
  const on = d => studied.has(d.toLocaleDateString('en-CA'))
  const lapsed = !on(days[6]) && !on(days[5])
  return html`<div class="week" aria-label="This week">
    <ol>${days.map(d => html`<li class=${on(d) ? 'on' : ''}><span class="wk-dot"></span><small lang="de">${DAYS[d.getDay()]}</small></li>`)}</ol>
    ${lapsed ? html`<p class="quiet">Never miss twice: five minutes of cards today keeps the habit.</p>` : ''}
  </div>`
}
const openSettings = () => { const d = document.querySelector('.settings'); if (d) { d.open = true; d.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' }); d.querySelector('input')?.focus() } }

// Settings: four groups (daily study, voice, look, progress) behind one summary line on the home page.
const SetChoice = ({ name, value, opts, onPick }) => html`<div class="set-seg" role="radiogroup" aria-label=${name}>${opts.map(([v, label, sw]) => html`
  <label class=${value === v ? 'on' : ''}><input type="radio" name=${name} checked=${value === v} onChange=${() => onPick(v)} />${sw ? html`<i class=${`set-sw ${sw}`} aria-hidden="true"></i>` : ''}${label}</label>`)}</div>`
const SetIcon = ({ d }) => html`<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d=${d} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>`
const SET_ICONS = {
  day: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5M8 14h3',
  voice: 'M4 9v6h4l5 4V5L8 9H4zM16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12',
  look: 'M12 3a9 9 0 1 0 0 18zM12 3a9 9 0 0 1 0 18',
  save: 'M12 4v11M7 10l5 5 5-5M4 19h16',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6',
}
const SET_RATES = [[0.7, 'Slow'], [0.85, 'Slower'], [0.95, 'Normal'], [1.1, 'Fast']]
const SET_THEMES = [[undefined, 'Windows', 'sys'], ['light', 'Light', 'light'], ['dark', 'Dark', 'dark']]
function Settings() {
  const s = useStore()
  const [, bump] = useState(0)
  const [wipe, setWipe] = useState(false)
  useEffect(() => {   // the voice list arrives asynchronously
    if (!('speechSynthesis' in window)) return
    const f = () => bump(n => n + 1)
    speechSynthesis.addEventListener('voiceschanged', f)
    return () => speechSynthesis.removeEventListener('voiceschanged', f)
  }, [])
  useEffect(() => applyLook(), [s.settings.theme, s.settings.motion])   // also after an import or a reset
  const voices = deVoices()
  const set = (k, v) => commit(x => { x.settings = { ...x.settings, [k]: v } })
  const perDay = n => commit(x => { x.newPerDay = Math.max(0, Math.min(100, Math.round(n) || 0)) })
  const learned = D.words.filter(w => known(w.id)).length
  const reset = () => { commit(x => { for (const k of Object.keys(x)) delete x[k]; Object.assign(x, fresh()); x.unexported = false }); setWipe(false) }
  const rate = s.settings.rate ?? 0.95
  return html`<details class="settings">
    <summary>
      <span class="set-badge"><${SetIcon} d=${SET_ICONS.sliders} /></span>
      <span class="set-title"><b>Settings and backup</b>
        <small>${[`${s.newPerDay} new cards a day`, `${SET_RATES.find(r => r[0] === rate)?.[1].toLowerCase() ?? 'normal'} speech`,
          `${SET_THEMES.find(t => t[0] === s.settings.theme)?.[1] ?? 'Windows'} theme`, s.unexported === false ? 'backed up' : 'not backed up yet'].join(' · ')}</small></span>
      <svg class="set-chev" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </summary>
    <div class="set-grid">
      <section class="set-card" aria-labelledby="set-day">
        <h3 id="set-day"><${SetIcon} d=${SET_ICONS.day} /> Daily study</h3>
        <label class="set-field"><span>My study plan</span>
          <input type="text" value=${s.settings.plan ?? ''} placeholder="After breakfast, at my desk, I open today's cards."
            onChange=${e => set('plan', e.target.value.trim() || undefined)} />
          <small>One sentence: when and where. Today shows it under the welcome.</small></label>
        <div class="set-field"><span id="set-new">New cards per day</span>
          <div class="set-step" role="group" aria-labelledby="set-new">
            <button type="button" aria-label="Fewer" onClick=${() => perDay(s.newPerDay - 5)}>−</button>
            <input type="number" min="0" max="100" value=${s.newPerDay} aria-labelledby="set-new" onChange=${e => perDay(+e.target.value)} />
            <button type="button" aria-label="More" onClick=${() => perDay(s.newPerDay + 5)}>+</button>
          </div>
          <small>Each new card comes back as reviews over the next weeks, so more new cards means more reviews later. 10 to 20 is a steady pace.</small></div>
      </section>

      <section class="set-card" aria-labelledby="set-voice">
        <h3 id="set-voice"><${SetIcon} d=${SET_ICONS.voice} /> Voice</h3>
        <label class="set-field"><span>German voice</span>
          <select value=${s.settings.voice ?? ''} onChange=${e => set('voice', e.target.value || undefined)} disabled=${!voices.length}>
            <option value="">${voices.length ? 'Automatic (best available)' : 'No German voice found'}</option>
            ${voices.map(v => html`<option value=${v.name}>${v.name}</option>`)}
          </select></label>
        <div class="set-field"><span>Speed</span>
          <${SetChoice} name="Speed" value=${rate} opts=${SET_RATES} onPick=${v => set('rate', v)} /></div>
        <div class="set-row">
          <button type="button" onClick=${() => speak('Hallo Sneka! Willkommen in Deutschland.')}><${Speaker} /> Test the voice</button>
          <label class="set-switch"><input type="checkbox" checked=${s.autoplay} onChange=${e => commit(x => { x.autoplay = e.target.checked })} />
            Read each word aloud when its card turns over</label>
        </div>
        ${voices.length ? '' : html`<div class="set-help">
          <p><b>This browser has no German voice yet.</b> In Windows: Settings → Time &amp; language → Speech → Add voices → German (Deutsch).
            Then quit the browser completely (Brave keeps running in the background: right-click its tray icon → Exit) and reopen it.
            Microsoft Edge has German voices built in.</p>
          <p>Or, from an administrator PowerShell (Start → type PowerShell → Run as administrator):</p>
          <p class="set-cmd"><code>${VOICE_CMD}</code> <button type="button" onClick=${() => navigator.clipboard?.writeText(VOICE_CMD)}>Copy</button></p>
        </div>`}
      </section>

      <section class="set-card" aria-labelledby="set-look">
        <h3 id="set-look"><${SetIcon} d=${SET_ICONS.look} /> Look</h3>
        <div class="set-field"><span>Theme</span>
          <${SetChoice} name="Theme" value=${s.settings.theme} opts=${SET_THEMES} onPick=${v => set('theme', v)} /></div>
        <div class="set-field"><span>Motion</span>
          <${SetChoice} name="Motion" value=${s.settings.motion} opts=${[[undefined, 'As Windows says'], ['reduce', 'Reduce motion']]} onPick=${v => set('motion', v)} />
          <small>Reduced motion keeps every picture and the drifting words still.</small></div>
        <label class="set-switch"><input type="checkbox" checked=${s.settings.backdrop !== false} onChange=${e => set('backdrop', e.target.checked ? undefined : false)} />
          Drifting words behind Today and Practice</label>
      </section>

      <section class="set-card" aria-labelledby="set-save">
        <h3 id="set-save"><${SetIcon} d=${SET_ICONS.save} /> Your progress</h3>
        <dl class="set-stats">
          <div><dt>Words learned</dt><dd>${learned}</dd></div>
          <div><dt>Cards started</dt><dd>${Object.keys(s.cards).length}</dd></div>
          <div><dt>Answers given</dt><dd>${s.log.length}</dd></div>
        </dl>
        <p class="set-note">Progress lives in this browser only. The double-clicked file and a served copy (http://) keep separate progress.
          Now and then, export a backup and import it wherever you study.</p>
        <div class="set-row">
          <button type="button" class="btn" onClick=${exportProgress}>Export progress</button>
          <label class="button">Import progress<input type="file" accept="application/json,.json" hidden
            onChange=${e => { const f = e.target.files[0]; e.target.value = ''; if (f) importProgress(f) }} /></label>
          ${wipe ? '' : html`<button type="button" class="set-danger-link" onClick=${() => setWipe(true)}>Reset all progress…</button>`}
        </div>
        ${wipe ? html`<div class="set-wipe" role="alert">
          <p><b>Delete all progress in this browser?</b> ${plural(Object.keys(s.cards).length, 'card')}, every test result, draft and setting. This can't be undone.</p>
          <div class="set-row">
            <button type="button" onClick=${exportProgress}>Export a backup first</button>
            <button type="button" class="set-danger" onClick=${reset}>Delete everything</button>
            <button type="button" onClick=${() => setWipe(false)}>Keep it</button>
          </div>
        </div>` : ''}
      </section>
    </div>
  </details>`
}

const PracticeHub = () => html`<main class="page">
  <header class="masthead"><h1>Practice</h1><p>Everything beyond the daily stations: exam papers, pictures and trainers.</p></header>
  <${Tiles} />
</main>`
PAGES.practice = PracticeHub

// ==== src/85-tests.js ====
// ---- tests: station tests, xmNumber practice tests and mock exams in the Goethe formats ----
// A paper is { key, kind: 'station' | 'practice' | 'mock', level, title, mods: [{ m, min, max, parts: [{ teil, en, items }] }] }.
// An item is a text (read), a recording (listen), one question (q) or a task (write, speak) worth pts raw points. Every
// question gets a paper-wide id, the key of its answer. Texts and recordings marked "pool": "exam" never show on a station
// tab (prepare() leaves them out), so practice tests and mocks can use them unseen.

// mulberry32: the same seed gives the same paper, so practice test k is always the same test.
export function seededRandom(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const xmShuffle = (xs, r) => { const a = [...xs]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }
const strHash = s => [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0, 2166136261)   // FNV-1a
const xmAddDays = (d, k) => { const x = new Date(`${d}T12:00`); x.setDate(x.getDate() + k); return x.toLocaleDateString('en-CA') }
const xmDate = d => new Date(`${d}T12:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
const tClock = ms => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` }

// The Goethe papers (docs/08-exam-formats.md, timings from docs/03-content.md). Per module: minutes [full, short], and per
// part [Teil, items in a full paper, items in a short one, raw points]. Lesen and Hören items are texts or recordings and
// every question is a point; Schreiben and Sprechen have one task per part, worth the part's raw points. A1 and A2 turn each
// module into 25 points and pass at 60 of 100 overall; B1 turns each into 100 and needs 60 in every module.
// ponytail: B1 Sprechen's 16 points for pronunciation are spread over its three parts (28 + 40 + 16, scaled to 100).
const EXAMS = {
  A1: { name: 'Start Deutsch 1', each: false, mods: [
    ['Hören', [20, 10], [['Teil 1', 6, 3], ['Teil 2', 4, 2], ['Teil 3', 5, 3]]],
    ['Lesen', [25, 15], [['Teil 1', 1, 1], ['Teil 2', 1, 1], ['Teil 3', 1, 0]]],
    ['Schreiben', [20, 10], [['Teil 1', 1, 0, 5], ['Teil 2', 1, 1, 10]]],
    ['Sprechen', [15, 5], [['Teil 1', 1, 1, 3], ['Teil 2', 1, 0, 6], ['Teil 3', 1, 0, 6]]]] },
  A2: { name: 'Goethe-Zertifikat A2', each: false, mods: [
    ['Lesen', [30, 15], [['Teil 1', 1, 1], ['Teil 2', 1, 0], ['Teil 3', 1, 0], ['Teil 4', 1, 1]]],
    ['Hören', [30, 15], [['Teil 1', 5, 3], ['Teil 2', 1, 0], ['Teil 3', 5, 2], ['Teil 4', 1, 1]]],
    ['Schreiben', [30, 15], [['Teil 1', 1, 0, 10], ['Teil 2', 1, 1, 10]]],
    ['Sprechen', [15, 5], [['Teil 1', 1, 0, 4], ['Teil 2', 1, 1, 8], ['Teil 3', 1, 0, 8]]]] },
  B1: { name: 'Goethe-Zertifikat B1', each: true, mods: [
    ['Lesen', [65, 30], [['Teil 1', 1, 1], ['Teil 2', 2, 1], ['Teil 3', 1, 0], ['Teil 4', 1, 1], ['Teil 5', 1, 0]]],
    ['Hören', [40, 20], [['Teil 1', 5, 3], ['Teil 2', 1, 1], ['Teil 3', 1, 0], ['Teil 4', 1, 0]]],
    ['Schreiben', [60, 25], [['Teil 1', 1, 1, 40], ['Teil 2', 1, 0, 40], ['Teil 3', 1, 0, 20]]],
    ['Sprechen', [15, 6], [['Teil 1', 1, 0, 28], ['Teil 2', 1, 1, 40], ['Teil 3', 1, 0, 16]]]] },
}
const PART_EN = {
  A1: { Hören: ['Short everyday conversations. Choose a, b or c.', 'Announcements, played once. Richtig or falsch?', 'Messages on an answering machine. Choose a, b or c.'],
    Lesen: ['Two short messages. Richtig or falsch?', 'Ads and web pages, two per situation. Where do you find the information?', 'Signs and notices. Richtig or falsch?'],
    Schreiben: ['Fill in a form for someone else, from the text.', 'Write a short message (about 30 words) covering all three points.'],
    Sprechen: ['Introduce yourself, then spell a word and say a number.', 'A topic and word cards: ask a question with your card, answer your partner’s.', 'Picture cards: make a request and react to one.'] },
  A2: { Lesen: ['A short newspaper article. Choose a, b or c.', 'An information board. Where do you go? Choose a, b or c.', 'An email or letter. Choose a, b or c.', 'Six ads, five people. Which ad fits each person?'],
    Hören: ['Short radio items, played once. Choose a, b or c.', 'One longer conversation. Match each person or day to a choice.', 'Short everyday conversations. Choose a, b or c.', 'A radio interview. Did the guest say it? Ja or nein.'],
    Schreiben: ['A text message (20–30 words) covering all three points.', 'An email (30–40 words) covering all three points.'],
    Sprechen: ['Question cards: ask your partner about their life, answer their questions.', 'Talk about yourself on the topic card, with its four prompts.', 'Plan something together: find a time in the two diaries.'] },
  B1: { Lesen: ['A blog post. Richtig or falsch?', 'Two newspaper articles. Choose a, b or c.', 'Ads and situations. Which ad fits? One situation has none (x).', 'Readers’ comments. Is the writer for it? Ja or nein.', 'Rules or instructions. Choose a, b or c.'],
    Hören: ['Five short texts. Richtig or falsch, then a, b or c.', 'A talk or guided tour, played once. Choose a, b or c.', 'A conversation, played once. Richtig or falsch?', 'A radio discussion. Who says it?'],
    Schreiben: ['A personal email (about 80 words) covering all three points.', 'A forum post giving your opinion (about 80 words).', 'A short semi-formal email (about 40 words).'],
    Sprechen: ['Plan something together: what, when, where, who brings what.', 'A presentation on a topic, guided by five slides.', 'React to your partner’s presentation: feedback and a question.'] },
}
const TEST_MODS = [['lesen', 'Lesen', 'Reading'], ['hoeren', 'Hören', 'Listening'], ['schreiben', 'Schreiben', 'Writing'],
  ['sprechen', 'Sprechen', 'Speaking'], ['wortschatz', 'Wortschatz', 'Vocabulary'], ['grammatik', 'Grammatik', 'Grammar']]
const MOD_OF = Object.fromEntries(TEST_MODS.map(([id, de]) => [de, id]))
const QSIZE = { A1: 12, A2: 15, B1: 15 }   // questions in a Wortschatz or Grammatik practice test
const LEVELS_ = ['A1', 'A2', 'B1']
// Official practice papers can't be copied into the app; these open Goethe's own pages.
const GOETHE_LINKS = [
  ['A1', 'Start Deutsch 1', 'https://goethe.de/en/spr/kup/prf/prf/sd1/ueb.html'],
  ['A2', 'Goethe-Zertifikat A2', 'https://www.goethe.de/ins/de/en/prf/prf/gzsd2/ub2.html'],
  ['B1', 'Goethe-Zertifikat B1', 'https://www.goethe.de/ins/de/en/prf/prf/gzb1/ueb.html'],
  ['B1', 'B1 online exam training', 'https://www.goethe.de/en/spr/prf/ueb/pb1.html'],
]

// ---- building papers ----

const XM_SOURCE = { Lesen: () => D.reading, Hören: () => D.listening, Schreiben: () => D.writing, Sprechen: () => D.speaking }
const partPool = (lv, m, teil) => XM_SOURCE[m]().filter(x => x.level === lv && x.part === teil)
const isExamItem = x => x.pool === 'exam'
const wasSeen = x => !!(S.tests.seen?.[x.id] || S.practice[`r:${x.id}`] !== undefined || S.practice[`h:${x.id}`] !== undefined)
let gpMap = null
const gpoint = id => (gpMap ??= new Map(D.grammar.map(g => [g.id, g]))).get(id)

function xmItem(m, x, pts) {
  // the reader and the player show the text or recording; the paper asks the questions itself, so all are handed in at once
  if (m === 'Lesen' || m === 'Hören') return { kind: m === 'Lesen' ? 'read' : 'listen', x, n: x.n, bare: { ...x, questions: [] }, qs: x.questions.map(q => ({ ...q })) }
  return { kind: m === 'Schreiben' ? 'write' : 'speak', x, n: x.n, pts }
}

// A vocabulary (vq) or grammar (gq) question as one exam question with four options.
const xmGap = s => s.split('___').map((p, i) => html`${i ? html`<span class="gap"></span>` : ''}${p}`)
const VQ_ASK = { context: 'Which word fits the gap?', synonym: 'Which means the same as the underlined part?', usage: 'In which sentence is the word used correctly?' }
function xmSingle(x) {
  const n = x.n ?? gpoint(x.g)?.n
  const at = x.u ? x.q.indexOf(x.u) : -1
  const body = x.g || x.type === 'context' ? xmGap(x.q) : at >= 0 ? html`${x.q.slice(0, at)}<u>${x.u}</u>${x.q.slice(at + x.u.length)}` : html`<b>${x.q}</b>`
  return { kind: 'q', x, n, qs: [{ q: html`<small class="xm-ask" lang="en">${x.g ? 'Which form fits the gap?' : VQ_ASK[x.type]}</small>${body}`,
    format: 'abcd', opts: x.opts, a: x.a, why: x.g ? html`${x.why} <i class="xm-en">${x.en}</i>` : x.why }] }
}

// One module of the exam: pick(pool, count) chooses the texts, recordings or tasks of each part.
function examModule(lv, [m, min, parts], short, pick) {
  return { m, min: min[short ? 1 : 0], max: EXAMS[lv].each ? 100 : 25, parts: parts.map(([teil, full, few, pts], i) => ({
    teil, en: PART_EN[lv][m][i], items: pick(partPool(lv, m, teil), short ? few : full, teil).map(x => xmItem(m, x, pts)),
  })).filter(p => p.items.length) }
}
function xmNumber(paper) {
  let id = 0
  for (const md of paper.mods) for (const p of md.parts) for (const it of p.items) for (const q of it.qs ?? []) q.id = id++
  paper.count = id
  return paper
}

// Mocks: unseen exam items first, then unseen station items, then the rest; random within each tier.
const xmFreshFirst = (pool, c) => shuffle(pool).sort((a, b) => (isExamItem(a) ? 0 : 1) + (wasSeen(a) ? 2 : 0) - (isExamItem(b) ? 0 : 1) - (wasSeen(b) ? 2 : 0)).slice(0, c)
function mockPaper(lv, size) {
  return xmNumber({ key: `mock/${lv}/${size}`, kind: 'mock', level: lv, size, title: `${EXAMS[lv].name} · ${size === 'full' ? 'full' : 'short'} mock exam`,
    mods: EXAMS[lv].mods.map(spec => examModule(lv, spec, size === 'short', xmFreshFirst)) })
}

// Practice tests: a fixed order per part (exam items first), paper k takes the k-th window of it.
function practiceOrder(pool, salt) {
  const r = seededRandom(strHash(salt))
  return [...xmShuffle(pool.filter(isExamItem), r), ...xmShuffle(pool.filter(x => !isExamItem(x)), r)]
}
const xmWindow = (order, c, k) => [...new Set(Array.from({ length: Math.min(c, order.length) }, (_, j) => order[((k - 1) * c + j) % order.length]))]
const xmBanks = {}
function xmBank(lv, mod) {   // the level's vocabulary or grammar questions, in a fixed order
  const xs = mod === 'wortschatz' ? D.vq.filter(q => q.level === lv)
    : D.grammar.filter(g => D.stations[g.n]?.level === lv).flatMap(g => (D.gq[g.id] ?? []).map(q => ({ ...q, n: g.n })))
  return (xmBanks[lv + mod] ??= xmShuffle(xs, seededRandom(strHash(lv + mod))))
}
const skillSpec = (lv, mod) => EXAMS[lv].mods.find(x => MOD_OF[x[0]] === mod)
function paperCount(lv, mod) {
  if (mod === 'wortschatz' || mod === 'grammatik') return Math.max(1, Math.floor(xmBank(lv, mod).length / QSIZE[lv]))
  const [m, , parts] = skillSpec(lv, mod)
  return Math.max(1, ...parts.map(([teil, c]) => Math.ceil(partPool(lv, m, teil).length / c)))
}
function practicePaper(lv, mod, k) {
  const [, de, en] = TEST_MODS.find(x => x[0] === mod)
  const base = { key: `${lv}/${mod}/${k}`, kind: 'practice', level: lv, title: `${lv} ${de} · Test ${k}` }
  if (mod === 'wortschatz' || mod === 'grammatik') {
    const items = xmBank(lv, mod).slice((k - 1) * QSIZE[lv], k * QSIZE[lv]).map(xmSingle)
    return xmNumber({ ...base, mods: [{ m: de, min: items.length, parts: [{ teil: de, en: mod === 'wortschatz' ? `${en}: the word that fits, the same meaning, the right use.` : `${en}: the form that fits the gap.`, items }] }] })
  }
  return xmNumber({ ...base, mods: [examModule(lv, skillSpec(lv, mod), false, (pool, c, teil) => xmWindow(practiceOrder(pool, lv + mod + teil), c, k))] })
}

// Station test (L16): words, grammar and a recording from this station, and about a third from the six stations before.
function stationPaper(n, seed) {
  const r = seededRandom(seed)
  const take = (xs, c) => xmShuffle(xs, r).slice(0, c)
  const vq = k => D.vq.filter(q => q.n === k)
  const gq = k => (D.grammarBy[k] ?? []).flatMap(g => (D.gq[g.id] ?? []).map(q => ({ ...q, n: k })))
  const before = Array.from({ length: Math.min(6, n - 1) }, (_, i) => n - 1 - i)
  const back = take(before.flatMap(k => [...vq(k), ...gq(k)]), 4)
  const own = [...take(vq(n), back.length ? 3 : 5), ...take(gq(n), back.length ? 3 : 5)]
  const hear = take((D.listeningBy[n] ?? []).filter(x => x.questions.length <= 2), 1)
  const st = D.stations[n]
  return xmNumber({ key: `station/${n}`, kind: 'station', level: st.level, title: `Station test · ${st.de}`, mods: [{ m: 'Station test', min: 0, parts: [
    { teil: 'Wörter und Grammatik', en: 'Choose the right answer. Some questions come from earlier stations.', items: xmShuffle([...own, ...back], r).map(xmSingle) },
    { teil: 'Hören', en: 'Listen, then answer. You can play it twice.', items: hear.map(x => xmItem('Hören', x)) },
  ].filter(p => p.items.length) }] })
}

// ---- scoring: points per part, turned into the module score the Goethe way ----

function xmGrade(paper, ans, self) {
  const mods = paper.mods.map(md => {
    let raw = 0, of = 0
    for (const p of md.parts) for (const it of p.items) {
      if (it.qs) { of += it.qs.length; raw += it.qs.filter(q => ans[q.id] === q.a).length }
      else { of += it.pts; raw += it.pts * (self[it.x.id] ?? 0) }
    }
    const max = md.max ?? of
    return { m: md.m, raw, of, max, pts: of ? Math.round(raw / of * max) : 0 }
  })
  const pts = mods.reduce((a, x) => a + x.pts, 0), max = mods.reduce((a, x) => a + x.max, 0)
  const each = paper.kind === 'mock' && EXAMS[paper.level].each
  return { mods, pts, max, self, p: max ? pts / max : 0, each, pass: each ? mods.every(x => x.pts >= .6 * x.max) : pts >= .6 * max }
}
// The stations behind the wrong answers, most mistakes first (L17).
function weakStations(paper, ans) {
  const count = {}
  for (const md of paper.mods) for (const p of md.parts) for (const it of p.items) for (const q of it.qs ?? []) if (ans[q.id] !== q.a && it.n) count[it.n] = (count[it.n] ?? 0) + 1
  return Object.entries(count).sort((a, b) => b[1] - a[1]).map(([n, c]) => [+n, c])
}

function saveResult(paper, r, ans) {
  commit(s => {
    const seen = { ...s.tests.seen }
    for (const md of paper.mods) for (const p of md.parts) for (const it of p.items) if (it.bare) seen[it.x.id] = today()
    s.tests = { ...s.tests, seen }
    if (paper.kind === 'mock') {
      s.tests.mocks = [...(s.tests.mocks ?? []), { d: today(), lv: paper.level, size: paper.size, pts: r.pts, max: r.max, pass: r.pass,
        mods: r.mods.map(x => [x.m, x.pts, x.max]), weak: weakStations(paper, ans).slice(0, 5).map(([n]) => n) }].slice(-40)
    } else if (paper.kind === 'practice') {
      const prev = s.tests[paper.key]
      s.tests[paper.key] = { best: Math.max(prev?.best ?? 0, r.p), last: r.p, d: today(), tries: (prev?.tries ?? 0) + 1 }
    } else {
      const n = +paper.key.split('/')[1], key = `station/${n}`
      const t = { best: 0, revisits: [], ...s.tests[key] }
      const due = revisitDue(t)
      if (due && due <= today()) t.revisits = [...t.revisits, { d: today(), pass: r.pass }]
      t.best = Math.max(t.best, r.p)
      if (r.pass && !t.first) t.first = today()
      t.passed = !!t.first
      s.tests[key] = t
      s.practice[`${n}/test`] = t.passed ? 1 : t.best
    }
  })
}

// ---- revisit stops (L15) and spaced mocks (L17) on the plan rail ----

const REVISIT_DAYS = [1, 7, 21]
// When the next revisit of a passed station test is due: 1, 7 and 21 days after the first pass, a failed one the next day.
export function revisitDue(t) {
  const ok = t?.first ? t.revisits.filter(x => x.pass).length : 3
  if (ok >= 3) return null
  const due = xmAddDays(t.first, REVISIT_DAYS[ok]), last = t.revisits.at(-1)
  return last && xmAddDays(last.d, 1) > due ? xmAddDays(last.d, 1) : due
}
function revisitStops() {
  const now = today()
  return D.stations.slice(1).filter(st => { const due = revisitDue(S.tests[`station/${st.n}`]); return due && due <= now })
    .map(st => ({ part: 'revisit', n: st.n, label: 'Revisit', href: `#/station/${st.n}/test`, p: 0, state: 'todo', note: st.de }))
}
const lastMock = lv => (S.tests.mocks ?? []).filter(x => x.lv === lv).at(-1)
// From the middle of a level on, a mock every three days or more: short until the level's last station, then full.
function mockStops(st) {
  if (st.k < 6) return []
  const last = lastMock(st.level), size = st.k === 12 ? 'full' : 'short'
  if (last?.d === today()) return [{ part: 'mock', label: 'Mock exam', href: '#/mock', p: 1, state: 'done' }]
  if (last && xmAddDays(last.d, 3) > today()) return []
  return [{ part: 'mock', label: 'Mock exam', href: `#/mock/${st.level}/${size}`, p: 0, state: 'todo', note: `${size} paper` }]
}
const mockMinutes = (lv, size) => EXAMS[lv].mods.reduce((a, [, min]) => a + min[size === 'short' ? 1 : 0], 0)
STEP.revisit = [() => {
  const stop = revisitStops()[0], t = S.tests[`station/${stop.n}`], ok = t.revisits.filter(x => x.pass).length
  return html`Revisit <b lang="de">${D.stations[stop.n].de}</b>: a fresh version of its station test, ${['a day', 'a week', 'three weeks'][ok]} after you passed it. Recalling it just before it fades makes it stick.`
}, 'Take the revisit test']
STEP.mock = [st => {
  const size = st.k === 12 ? 'full' : 'short'
  return html`Time for a ${size} <b>${st.level} mock exam</b>: about ${mockMinutes(st.level, size)} minutes in the real format, scored like Goethe.`
}, 'Start the mock exam']

// ---- sitting a paper: one module at a time, each with its own clock; then self-scoring, then the result ----

function useXmTick(on) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => { if (!on) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [on])
  return on ? now : Date.now()
}

const xmTasks = paper => paper.mods.flatMap(md => md.parts.flatMap(p => p.items.filter(it => it.pts !== undefined).map(it => ({ md, p, it }))))

function XmSitting({ paper, onDone, after }) {
  const [ans, setAns] = useState({})
  const [work, setWork] = useState({})        // task id → text, form fields or a recording URL
  const [mod, setMod] = useState(0)
  const timed = m => (m.m === 'Sprechen' ? 0 : m.min)   // Sprechen runs on each task's own clocks
  const [ends, setEnds] = useState(() => (timed(paper.mods[0]) ? Date.now() + timed(paper.mods[0]) * MIN : 0))
  const [phase, setPhase] = useState('sit')   // sit → score (writing and speaking, self-scored) → result
  const [result, setResult] = useState(null)
  const now = useXmTick(phase === 'sit' && !!ends)
  const md = paper.mods[mod]
  const left = ends ? Math.max(0, ends - now) : null
  const qsOf = m => m.parts.flatMap(p => p.items.flatMap(it => it.qs ?? []))
  const finish = self => {
    const r = xmGrade(paper, ans, self)
    saveResult(paper, r, ans)
    onDone?.(r)
    setResult(r); setPhase('result'); scrollTo(0, 0)
  }
  const next = () => {
    stopSpeech()
    if (mod + 1 < paper.mods.length) {
      setMod(mod + 1); setEnds(timed(paper.mods[mod + 1]) ? Date.now() + timed(paper.mods[mod + 1]) * MIN : 0); scrollTo(0, 0)
    } else if (paper.kind === 'mock' && xmTasks(paper).length) { setPhase('score'); scrollTo(0, 0) }
    else finish(Object.fromEntries(xmTasks(paper).map(({ it }) => [it.x.id, draftShare(it)])))
  }
  useEffect(() => { if (phase === 'sit' && left === 0) next() }, [left === 0])   // time is up: the module is collected
  const handIn = () => {
    const miss = qsOf(md).filter(q => ans[q.id] === undefined).length
    const unrated = paper.kind === 'practice' ? md.parts.flatMap(p => p.items).filter(it => it.pts !== undefined && !draftRated(it)).length : 0
    const warn = [miss && `${plural(miss, 'question')} not answered yet`, unrated && `${plural(unrated, 'task')} not scored yet (finish it, then rate it in its self-score)`].filter(Boolean).join(', ')
    if (!warn || confirm(`${warn}. Hand in anyway?`)) next()
  }
  if (phase === 'score') return html`<${XmScore} paper=${paper} work=${work} onDone=${finish} />`
  if (phase === 'result') return html`<${XmResult} paper=${paper} r=${result} ans=${ans} after=${after} />`
  const qs = qsOf(md), done = qs.filter(q => ans[q.id] !== undefined).length
  const last = mod + 1 === paper.mods.length
  return html`<div class=${`xm-sit l${paper.level}`}>
    <div class="xm-bar" role="region" aria-label="Exam bar">
      <span class="lb">${paper.level}</span><b class="xm-bar-title">${paper.title}</b>
      ${paper.mods.length > 1 ? html`<ol class="xm-steps" aria-label="Modules">${paper.mods.map((x, i) => html`<li class=${i < mod ? 'past' : i === mod ? 'on' : ''}
        aria-current=${i === mod ? 'step' : null}><span class="xm-stepdot"></span><span lang="de">${x.m}</span></li>`)}</ol>` : html`<span class="xm-steps"></span>`}
      ${qs.length ? html`<span class="xm-done">${done} of ${qs.length} answered</span>` : ''}
      ${left !== null ? html`<span class=${`xm-clock${left < 5 * MIN ? ' low' : ''}`} role="timer" aria-label="Time left in this module">${tClock(left)}</span>` : ''}
      <button type="button" class="btn" onClick=${handIn}>${last ? 'Hand in' : html`Hand in <span lang="de">${md.m}</span>`} <${Arrow} /></button>
    </div>
    <header class="xm-modhead"><h2 lang="de">${md.m}</h2>${md.min ? html`<p class="quiet">${`${md.min} minutes${paper.kind === 'mock' ? ', as in the exam' : ''}.${md.m === 'Hören'
      ? ' Each recording plays as often as the exam allows.' : md.m === 'Sprechen' ? ' Each task has its own clock to prepare and to speak.' : ''}${md.m === 'Schreiben' || md.m === 'Sprechen'
      ? (paper.kind === 'mock' ? ' You score this part yourself afterwards, in the Goethe criteria.' : ' Finish each task, then rate it in its self-score: that is its score here.') : ''}`}</p>` : ''}</header>
    ${md.parts.map(p => html`<section class=${`xm-part${p.items[0].kind === 'q' ? ' singles' : ''}`} key=${`${mod}${p.teil}`}>
      <header class="xm-parthead"><span class="xm-teil" lang="de">${p.teil}</span><p>${p.en}</p></header>
      ${p.items.map(it => html`<${XmItem} key=${it.x.id ?? it.qs[0].id} it=${it} ans=${ans} practice=${paper.kind === 'practice'} pick=${(id, j) => setAns(a => ({ ...a, [id]: j }))}
        work=${work[it.x.id]} setWork=${v => setWork(w => ({ ...w, [it.x.id]: v }))} />`)}
    </section>`)}
    <p class="xm-handin"><button type="button" class="btn big" onClick=${handIn}>${last ? 'Hand in the paper' : html`Hand in <span lang="de">${md.m}</span> and go on`} <${Arrow} /></button></p>
  </div>`
}

const XmQs = ({ it, ans, pick }) => html`<ol class="eqs xm-qs">${it.qs.map(q => html`<${ExamQuestion} key=${q.id} q=${q} k=${q.id}
  pick=${ans[q.id]} done=${false} onPick=${j => pick(q.id, j)} onShow=${() => {}} />`)}</ol>`

function XmItem({ it, ans, pick, work, setWork, practice }) {
  if (it.kind === 'read') return html`<div class="xm-read"><div class="xm-text"><${Reader} t=${it.bare} exam /></div>
    <aside class="xm-side"><h3>${plural(it.qs.length, 'question')}</h3><${XmQs} it=${it} ans=${ans} pick=${pick} /></aside></div>`
  if (it.kind === 'listen') return html`<div class="xm-listen"><${ListenItem} it=${it.bare} exam />
    <aside class="xm-side">${it.qs.length > 1 ? html`<h3>${plural(it.qs.length, 'question')}</h3>` : ''}<${XmQs} it=${it} ans=${ans} pick=${pick} /></aside></div>`
  if (it.kind === 'q') return html`<${XmQs} it=${it} ans=${ans} pick=${pick} />`
  if (practice) { const Task = it.kind === 'speak' ? SpeakTask : it.x.form ? FormTask : WriteTask; return html`<${Task} t=${it.x} n=${it.x.n} />` }
  return it.kind === 'write' ? html`<${XmWrite} t=${it.x} value=${work} onChange=${setWork} />` : html`<${XmSpeak} t=${it.x} onRec=${setWork} />`
}

// ---- Schreiben and Sprechen. Practice tests use the station's own task screens (50-writing.js, 55-speaking.js), which
// save the text and the self-score in S.drafts[id]. Mocks show the bare exam sheet (no hints, phrases or model, and not
// the station's saved draft), then a scoring step with the same self-score in the Goethe criteria. ----

const xmGroups = (kind, t) => rubricGroups(kind === 'write' ? 'write' : 'speak', t.level, kind === 'write' ? t.rubric : undefined)
const rateShare = (groups, v = {}) => { const ks = rubricKeys(groups); return ks.reduce((a, k) => a + (v[k] ?? 0), 0) / ks.length }   // unrated lines count 0
const formShare = (t, fields = [], same = {}) => t.form.fields.filter(([, a], i) => normField(fields[i]) === normField(a) || same[i]).length / t.form.fields.length
const draftShare = it => { const d = S.drafts[it.x.id] ?? {}; return it.x.form ? formShare(it.x, d.fields, d.same) : rateShare(xmGroups(it.kind, it.x), d.rubric) }
const draftRated = it => { const d = S.drafts[it.x.id] ?? {}; return it.x.form ? !!d.checked : rubricScore(xmGroups(it.kind, it.x), d.rubric) !== null }
const themOf = t => (t.level === 'A1' && t.part === 'Teil 1' ? 'Examiner' : 'Partner')

function XmWrite({ t, value, onChange }) {
  const kind = WRITE_KIND[t.level][t.part]
  const head = html`<${TaskHead} t=${t} kind=${kind[1]} mod="Schreiben" name=${kind[0]} extra=${kind[2]} /><${TaskText} t=${t} />`
  if (t.form) {
    const v = value ?? []
    return html`<div class="w-form"><article class="w-card">${head}<div class="w-source"><p lang="de">${t.form.text_de}</p></div></article>
      <div class="w-formcard"><p class="w-form-h" lang="de">Anmeldung</p>${t.form.fields.map(([label], i) => html`<label class="w-ff"><span lang="de">${label}</span>
        <input lang="de" spellcheck="false" autocomplete="off" value=${v[i] ?? ''} onInput=${e => { const f = [...v]; f[i] = e.target.value; onChange(f) }} /></label>`)}</div></div>`
  }
  const v = value ?? ''
  return html`<div class="xm-write"><article class="w-card">${head}<ol class="xm-points" lang="de">${t.points.map(p => html`<li>${p}</li>`)}</ol></article>
    <section class="xm-sheet"><textarea lang="de" spellcheck="false" rows=${t.words[1] > 60 ? 12 : 8} aria-label="Your text" value=${v} placeholder="Schreiben Sie hier."
      onInput=${e => onChange(e.target.value)}></textarea><${WordMeter} n=${countWords(v)} lo=${t.words[0]} hi=${t.words[1]} /></section></div>`
}

function XmSpeak({ t, onRec }) {
  const r = useRecorder()
  const [phase, setPhase] = useState('ready')   // ready → prep → speak → done, each with the task's own clock
  useEffect(() => { if (r.url) onRec(r.url) }, [r.url])
  useEffect(() => () => stopSpeech(), [])
  const speakNow = () => { stopSpeech(); setPhase('speak'); r.start() }
  const finish = () => { r.stop(); stopSpeech(); setPhase('done') }
  return html`<div class="xm-speak"><article class="w-card"><${TaskHead} t=${t} kind="speak" mod="Sprechen" name=${SPEAK_KIND[t.level][t.part]} />
      <${TaskText} t=${t} /><${SpeakCards} t=${t} /></article>
    <section class=${`sp-stage sp-st-${phase}`} aria-label="Prepare and speak">
      ${phase === 'ready' ? html`<div class="sp-times"><span><b>${mmss(t.prep_s)}</b> to prepare</span><span><b>${mmss(t.speak_s)}</b> to speak</span></div>
          <div class="sp-body"><div class="sp-btns"><button type="button" class="btn" onClick=${() => setPhase('prep')}>Start preparing <${Arrow} /></button>
            <button type="button" onClick=${speakNow}>Skip to speaking</button></div><p class="sp-note">Your microphone records you while you speak; you score it afterwards.</p></div>`
        : phase === 'prep' ? html`<${Countdown} key="prep" secs=${t.prep_s} kind="prep" label="Prepare" onEnd=${speakNow} />
          <div class="sp-body"><button type="button" class="btn" onClick=${speakNow}>Start speaking now <${Arrow} /></button></div>`
        : phase === 'speak' ? html`<${Countdown} key="speak" secs=${t.speak_s} kind="rec" label="Speak" onEnd=${finish} />
          <div class="sp-body"><p class="sp-rec">${r.state === 'rec' ? html`<span class="rec-dot"></span> Recording. Speak now.` : r.error ? html`<span class="rec-err">${r.error} Speak anyway: the timer runs.</span>` : 'Waiting for the microphone.'}</p>
            <button type="button" class="btn" onClick=${finish}>I'm done</button></div>`
        : html`<div class="sp-body sp-wide">${r.url ? html`<audio controls src=${r.url}></audio>` : html`<p class="quiet">${r.error || 'Nothing was recorded. You can still score what you said.'}</p>`}
          <button type="button" onClick=${() => setPhase('ready')}>Try again</button></div>`}
      ${phase === 'prep' || phase === 'speak' ? html`<${VoicePartner} lines=${t.partner} label=${themOf(t)} />` : ''}
    </section></div>`
}

const XM_WHO = { A: 'Woman', B: 'Man', N: 'Announcer' }

function XmScore({ paper, work, onDone }) {
  const tasks = xmTasks(paper)
  const [rates, setRates] = useState({})   // task id → { line key: 1, .5 or 0 }
  const [same, setSame] = useState({})     // form id → { field index: true } where "mine means the same"
  const share = it => (it.x.form ? formShare(it.x, work[it.x.id], same[it.x.id]) : rateShare(xmGroups(it.kind, it.x), rates[it.x.id]))
  const left = tasks.filter(({ it }) => !it.x.form && rubricScore(xmGroups(it.kind, it.x), rates[it.x.id]) === null).length
  return html`<div class=${`xm-score l${paper.level}`}>
    <header class="masthead"><h1>Score your writing and speaking</h1>
      <p>An examiner marks these parts in fixed criteria. Put your answer beside the model, then rate each line. Be strict: it is your exam.</p></header>
    ${tasks.map(({ md, p, it }) => {
      const t = it.x, w = work[t.id]
      return html`<section class="xm-scorecard">
        <header class="xm-parthead"><span class="xm-teil" lang="de">${md.m} ${p.teil}</span><b class="xm-pts">${Math.round(share(it) * it.pts)} of ${it.pts} points</b></header>
        <p class="xm-task-en">${t.task_en}</p>
        ${t.form ? html`<ul class="xm-fields">${t.form.fields.map(([label, right], i) => {
            const ok = normField(w?.[i]) === normField(right)
            return html`<li class=${ok || same[t.id]?.[i] ? 'ok' : 'no'}><span lang="de">${label}: <b>${right}</b></span>
              <small>${w?.[i] ? html`you wrote <span lang="de">${w[i]}</span>` : 'left empty'}</small>
              ${!ok && w?.[i] ? html`<label class="check"><input type="checkbox" checked=${!!same[t.id]?.[i]} onChange=${e => setSame(s => ({ ...s, [t.id]: { ...s[t.id], [i]: e.target.checked } }))} /> Mine means the same</label>` : ''}</li>`
          })}</ul>`
        : html`${it.kind === 'speak' ? html`<div class="xm-rec"><h3>Your recording</h3>${w ? html`<audio controls src=${w}></audio>` : html`<p class="quiet">Not recorded. Say it aloud now, then score what you said.</p>`}</div>
            <${SpeakModel} t=${t} them=${themOf(t)} />`
          : html`<div class="xm-compare">
            <div><h3>Your answer</h3>${w ? html`<p class="xm-mine" lang="de">${w}</p><p class="xm-count">${plural(countWords(w), 'word')} · the task asks for ${t.words[0]}–${t.words[1]}</p>` : html`<p class="quiet">Nothing written.</p>`}</div>
            <div><h3>A model answer</h3><p class="xm-mine" lang="de">${t.model}</p>${t.model_en ? html`<details class="xm-whole"><summary>In English</summary><p class="xm-mine quiet">${t.model_en}</p></details>` : ''}</div>
          </div>`}
          <${SelfScore} groups=${xmGroups(it.kind, t)} value=${rates[t.id]} onRate=${(k, x) => setRates(r => ({ ...r, [t.id]: { ...r[t.id], [k]: x } }))} />`}
      </section>`
    })}
    <p class="xm-handin">${left ? html`<span class="quiet">${plural(left, 'task')} not fully rated: an unrated line counts as 0.</span>` : ''}
      <button type="button" class="btn big" onClick=${() => onDone(Object.fromEntries(tasks.map(({ it }) => [it.x.id, share(it)])))}>See my result <${Arrow} /></button></p>
  </div>`
}

// ---- the result: a stamp, the module scores, what to revise, then the wrong answers explained ----

function XmResult({ paper, r, ans, after }) {
  const mock = paper.kind === 'mock'
  const weak = weakStations(paper, ans).slice(0, 3)
  const low = r.mods.filter(x => x.pts < .6 * x.max)
  const tasks = xmTasks(paper), scaled = r.mods.some(x => x.max !== x.of), unit = mock || tasks.length || scaled ? 'points' : 'right'
  const rows = r.mods.length > 1 ? r.mods.map(x => [x.m, x.pts, x.max])   // modules, or a practice paper's tasks
    : tasks.map(({ p, it }) => [p.teil, Math.round((r.self[it.x.id] ?? 0) * it.pts), it.pts])
  const verdict = mock && r.each ? (r.pass ? 'Every module is at 60 or more: that passes the B1 exam.' : html`B1 needs 60 in every module, and ${low.map(x => html`<span lang="de">${x.m}</span>`).reduce((a, b) => html`${a} and ${b}`)} ${low.length > 1 ? 'are' : 'is'} below it.`)
    : mock ? (r.pass ? '60 or more of 100: that passes.' : `${Math.ceil(.6 * r.max) - r.pts} more points would pass (60 of 100).`)
    : r.pass ? 'Passed: 60% is the pass mark.' : `${Math.ceil(.6 * r.max) - r.pts} more ${unit} would pass (60%).`
  const due = paper.kind === 'station' && revisitDue(S.tests[paper.key])   // saved before the result shows
  return html`<div class=${`xm-result-page l${paper.level}`}>
    <section class="xm-result">
      <div class="xm-stampbox"><span class=${`stamp xm-stamp ${r.pass ? 'pass' : 'fail'}`}>${r.pass ? 'Bestanden' : 'Noch nicht'}</span></div>
      <div class="xm-result-main">
        <p class="xm-result-kind"><span class="lb">${paper.level}</span> ${paper.title}</p>
        <h1>${r.each ? html`${r.mods.length - low.length} <small>of ${r.mods.length} modules at 60 or more</small>`
          : html`${r.pts} <small>of ${r.max} ${unit}</small>`}</h1>
        <p class="xm-verdict">${verdict}</p>
        ${!mock && scaled && !tasks.length ? html`<p class="quiet">${r.mods[0].raw} of ${r.mods[0].of} answers right; the exam turns that into ${r.pts} of ${r.max} points.</p>` : ''}
        ${due ? html`<p class="xm-due">It comes back on <b>${xmDate(due)}</b> as a revisit stop on your plan, with new questions.</p>` : ''}
        ${rows.length ? html`<ul class="xm-modscores">${rows.map(([name, pts, max]) => html`<li class=${pts < .6 * max ? 'low' : ''}>
          <b lang="de">${name}</b><span class="xm-meter" style=${`--p:${pts / max}`} aria-hidden="true"><i></i></span><span>${pts} of ${max}</span></li>`)}</ul>` : ''}
        ${tasks.length ? html`<p class="quiet">Schreiben and Sprechen are your own scores against the rubric.</p>` : ''}
      </div>
    </section>
    ${mock ? html`<section class="xm-next" aria-label="What next">
      <div><h2>Revise next</h2>${weak.length ? html`<ul class="xm-weak">${weak.map(([n, c]) => html`<li><a href=${`#/station/${n}`}><span class="lb">${D.stations[n].level} · ${D.stations[n].k}</span>
        <span lang="de">${D.stations[n].de}</span></a> <small>${plural(c, 'mistake')}</small></li>`)}</ul>` : html`<p>No wrong answers in Lesen and Hören. Keep the stations ticking over.</p>`}</div>
      <div><h2>Next mock</h2><p>On <b>${xmDate(xmAddDays(today(), 3))}</b> or later. A gap of three days or more between mocks lets the revision settle; it will appear on your plan.</p></div>
    </section>` : ''}
    <div class="xm-after">${after}</div>
    ${paper.count ? html`<${XmReview} paper=${paper} ans=${ans} />` : ''}
  </div>`
}

function XmReview({ paper, ans }) {
  const [shown, setShown] = useState({})
  const wrong = it => (it.qs ?? []).filter(q => ans[q.id] !== q.a)
  const rows = paper.mods.flatMap(md => md.parts.flatMap(p => p.items.filter(it => wrong(it).length).map(it => ({ md, p, it }))))
  const total = rows.reduce((a, x) => a + wrong(x.it).length, 0)
  const quote = it => {
    const ev = shown[it.x.id ?? it.qs[0].id]
    if (!ev) return ''
    const lines = it.kind === 'read' ? it.x.blocks.flatMap(b => b.s.map((s, k) => [`${b.id}.${k}`, s[0], s[1]])).filter(([id]) => ev.includes(id))
      : it.x.lines.map((l, i) => [i, l.de, l.en]).filter(([i]) => ev.includes(i))
    return html`<blockquote class="xm-ev">${lines.map(([, de, en]) => html`<p><span lang="de">${de}</span><small>${en}</small></p>`)}</blockquote>`
  }
  if (!rows.length) return html`<section class="xm-review"><h2>Every answer was right</h2></section>`
  return html`<section class="xm-review"><h2>${plural(total, 'mistake')}, explained</h2>
    ${rows.map(({ md, p, it }) => {
      const st = D.stations[it.n]
      const [tab, what] = it.kind === 'read' ? ['read', 'reading'] : it.kind === 'listen' ? ['listen', 'listening'] : it.x.g ? ['grammar', gpoint(it.x.g)?.title] : ['words', html`the word <span lang="de">${it.x.w}</span>`]
      return html`<article class="xm-rev">
        <header><span class="xm-teil" lang="de">${md.m === 'Station test' ? '' : `${md.m} `}${p.teil}</span>
          ${it.kind === 'read' ? html`<b lang="de">${it.x.title}</b>` : it.kind === 'listen' ? html`<span>${it.x.setup}</span>` : ''}
          ${st ? html`<a class="xm-study" href=${`#/station/${it.n}/${tab}`}>Study ${what} at <span lang="de">${st.de}</span> <${Arrow} /></a>` : ''}</header>
        <ol class="eqs">${wrong(it).map(q => html`<${ExamQuestion} key=${q.id} q=${q} k=${q.id} pick=${ans[q.id]} done=${true} onPick=${() => {}}
          where=${it.kind === 'listen' ? 'recording' : 'text'} onShow=${ev => setShown(s => ({ ...s, [it.x.id ?? it.qs[0].id]: ev }))} />`)}</ol>
        ${quote(it)}
        ${it.kind === 'read' ? html`<details class="xm-whole"><summary>The whole text</summary><${Reader} t=${it.bare} exam /></details>` : ''}
        ${it.kind === 'listen' ? html`<details class="xm-whole"><summary>What was said</summary><ol class="xm-model">${it.x.lines.map(l => html`<li><b>${XM_WHO[l.who]}</b>
          <span lang="de">${l.de}</span><small>${l.en}</small></li>`)}</ol></details>` : ''}
      </article>`
    })}
  </section>`
}

// ---- station test tab ----

function StationTest({ n }) {
  const s = useStore()
  const rec = s.tests[`station/${n}`]
  const due = revisitDue(rec)
  const revisit = !!due && due <= today()
  const seed = n * 100 + (rec?.revisits.length ?? 0)
  const paper = useMemo(() => stationPaper(n, seed), [n, seed])
  const [run, setRun] = useState(null)
  const st = D.stations[n]
  if (run?.n === n) {   // kept while the result shows, though the result moves the seed on
    return html`<${XmSitting} key=${run.key} paper=${run.paper} after=${html`<button type="button" class="btn" onClick=${() => setRun(null)}>Back to the station test</button>
      <a class="button" href=${`#/station/${n}/words`}>Revise the words</a>`} />`
  }
  if (!paper.count) return html`<p class="soon">This station's questions are being written now. The station test mixes its words, grammar and a recording.</p>`
  const ok = rec?.revisits.filter(x => x.pass).length ?? 0
  const own = paper.mods[0].parts.flatMap(p => p.items).filter(it => it.n === n).reduce((a, it) => a + it.qs.length, 0)
  const stops = REVISIT_DAYS.map((d, i) => {
    if (!rec?.first) return { d, cls: 'locked', note: 'after a pass' }
    const passedAt = rec.revisits.filter(x => x.pass)[i]
    if (passedAt) return { d, cls: 'done', note: `passed ${xmDate(passedAt.d).replace(/^\w+ /, '')}` }
    if (i === ok) return { d, cls: revisit ? 'due' : 'next', note: revisit ? 'due today' : xmDate(due) }
    return { d, cls: 'later', note: xmDate(xmAddDays(rec.first, d)) }
  })
  return html`<div class=${`xm-station l${st.level}`}>
    <section class="xm-ticket">
      <p class="xm-ticket-top"><span class="lb">${revisit ? 'Revisit' : 'Station test'}</span>${rec?.first ? html`<span class="xm-passed">Passed · best ${pct(rec.best)}</span>` : rec ? html`<span class="quiet">Best so far ${pct(rec.best)}</span>` : ''}</p>
      <h2>${revisit ? html`A fresh version of <span lang="de">${st.de}</span>` : html`Test yourself on <span lang="de">${st.de}</span>`}</h2>
      <ul class="xm-facts">
        <li><b>${paper.count}</b><small>questions in exam formats</small></li>
        <li><b>${own}</b><small>from this station</small></li>
        <li><b>${paper.count - own}</b><small>from the six before</small></li>
        <li><b>60%</b><small>passes</small></li>
      </ul>
      <p class="quiet">Words, grammar and a recording. Mixing in earlier stations makes all of them stick.</p>
      <button type="button" class="btn big" onClick=${() => { setRun({ n, key: `${n}/${seed}`, paper }); scrollTo(0, 0) }}>${revisit ? 'Take the revisit test' : rec ? 'Take it again' : 'Start the test'} <${Arrow} /></button>
    </section>
    <section class="xm-revisits" aria-labelledby="rv-h">
      <h3 id="rv-h">Come back to it</h3>
      <p class="quiet">After a pass, this test returns 1, 7 and 21 days later as a stop on your plan, each time with new questions.</p>
      <ol class="xm-rail">${stops.map(x => html`<li class=${x.cls}><span class="xm-raildot"></span><b>Day ${x.d}</b><small>${x.note}</small></li>`)}</ol>
    </section>
  </div>`
}
TAB_VIEWS.test = StationTest

// ---- practice tests: #/tests, #/tests/<level>, #/tests/<level>/<module>/<k> ----

const MOD_ICON = {
  lesen: html`<path d="M24 13C18 8.5 10 8.5 4 10.5v28c6-2 14-2 20 2.5 6-4.5 14-4.5 20-2.5v-28c-6-2-14-2-20 2.5z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" />
    <path d="M24 13v28" stroke="currentColor" stroke-width="2.5" /><path d="M9 18h9M9 24h9M9 30h7M30 18h9M30 24h9" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity=".6" />`,
  hoeren: html`<path d="M8 31v-6a16 16 0 0 1 32 0v6" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" />
    <rect x="5" y="27" width="10" height="15" rx="3" fill="currentColor" /><rect x="33" y="27" width="10" height="15" rx="3" fill="currentColor" />`,
  schreiben: html`<path d="M12 36l2-8L34 8l6 6-20 20z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" />
    <path d="M30 12l6 6" stroke="currentColor" stroke-width="3" /><path d="M5 43h38" stroke="currentColor" stroke-width="3" stroke-linecap="round" />`,
  sprechen: html`<path d="M7 8h34a3 3 0 0 1 3 3v19a3 3 0 0 1-3 3H21l-9 8v-8H7a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3z" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" />
    <path d="M15 17v7M21 14v13M27 16v9M33 18v5" stroke="currentColor" stroke-width="3" stroke-linecap="round" />`,
  wortschatz: html`<rect x="4" y="13" width="24" height="30" rx="3" fill="none" stroke="currentColor" stroke-width="3" />
    <rect x="18" y="5" width="25" height="30" rx="3" fill="currentColor" /><text x="30.5" y="26" text-anchor="middle" class="icon-t inv" style="font-size:16px">Aa</text>`,
  grammatik: html`<rect x="3" y="24" width="12" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="3" />
    <rect x="18" y="24" width="12" height="13" rx="2" fill="currentColor" /><rect x="33" y="24" width="12" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="3" />
    <path d="M39 20C37 10 26 9 24.5 18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" /><path d="M21 15l3.5 4.5 4-4" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />`,
}
const ModIcon = ({ id }) => html`<svg class="xm-icon" viewBox="0 0 48 48" width="44" height="44" aria-hidden="true">${MOD_ICON[id]}</svg>`

const LevelSwitch = ({ lv, href }) => html`<nav class="xm-levels" aria-label="Level">${LEVELS_.map(x => html`<a class=${`l${x}${x === lv ? ' on' : ''}`}
  href=${href(x)} aria-current=${x === lv ? 'page' : null}><span class="lb">${x}</span><span>${EXAMS[x].name}</span></a>`)}</nav>`

const MorePractice = () => html`<section class="xm-more" aria-labelledby="more-h">
  <h2 id="more-h">More practice</h2>
  <p class="quiet">Goethe-Institut's own practice papers (Übungssätze), with audio. They open on goethe.de in a new tab: the app links to them and never copies them.</p>
  <ul>${GOETHE_LINKS.map(([lv, label, href]) => html`<li class=${`l${lv}`}><a href=${href} target="_blank" rel="noopener"><span class="lb">${lv}</span> ${label} <span aria-hidden="true">↗</span></a></li>`)}</ul>
</section>`

function TestsPage({ data, arg, sub, sub2 }) {
  const s = useStore()
  const lv = LEVELS_.includes(arg) ? arg : here(data).level
  const k = Number(sub2)
  if (LEVELS_.includes(arg) && TEST_MODS.some(x => x[0] === sub) && k >= 1 && k <= paperCount(lv, sub)) return html`<${PracticeRun} key=${`${lv}/${sub}/${k}`} lv=${lv} mod=${sub} k=${k} />`
  return html`<main class=${`page xm-hub l${lv}`}>
    <header class="masthead"><h1>Practice tests</h1><p>Numbered papers for each module, in the exam's own formats. The same number is always the same paper, so retake one until it passes (60%).</p></header>
    <${LevelSwitch} lv=${lv} href=${x => `#/tests/${x}`} />
    <ul class="xm-mods">${TEST_MODS.map(([id, de, en]) => {
      const count = paperCount(lv, id)
      const res = Array.from({ length: count }, (_, i) => s.tests[`${lv}/${id}/${i + 1}`])
      const passed = res.filter(x => x?.best >= .6).length, best = Math.max(0, ...res.map(x => x?.best ?? 0))
      return html`<li class="xm-mod">
        <header><${ModIcon} id=${id} /><div><h2 lang="de">${de}</h2><small>${en}</small></div>
          <span class="xm-modstat">${passed ? html`<b>${passed}</b> of ${count} passed` : plural(count, 'paper')}${best ? html`<small>best ${pct(best)}</small>` : ''}</span></header>
        <ol class="xm-nums">${res.map((x, i) => html`<li><a href=${`#/tests/${lv}/${id}/${i + 1}`} class=${x ? (x.best >= .6 ? 'pass' : 'tried') : ''}
          aria-label=${`${de} test ${i + 1}${x ? `, best ${pct(x.best)}` : ''}`}><b>${i + 1}</b>${x ? html`<small>${pct(x.best)}</small>` : ''}</a></li>`)}</ol>
      </li>`
    })}</ul>
    <a class="xm-tomock" href="#/mock"><svg viewBox="0 0 48 48" width="40" height="40" aria-hidden="true">${ICONS.stamp}</svg>
      <span><b>Mock exams</b><small>The whole ${EXAMS[lv].name}, timed and scored like Goethe</small></span><${Arrow} /></a>
    <${MorePractice} />
  </main>`
}
PAGES.tests = TestsPage

function PracticeRun({ lv, mod, k }) {
  const [paper] = useState(() => practicePaper(lv, mod, k))
  const next = k < paperCount(lv, mod) ? `#/tests/${lv}/${mod}/${k + 1}` : null
  return html`<main class="page xm-run">
    <${XmSitting} paper=${paper} after=${html`<a class="button" href=${`#/tests/${lv}`}>All ${lv} tests</a>${next ? html`<a class="btn" href=${next}>Test ${k + 1} <${Arrow} /></a>` : ''}`} />
  </main>`
}

// ---- mock exams: #/mock and #/mock/<level>/<full|short> ----

function MockPage({ data, arg, sub }) {
  const s = useStore()
  if (LEVELS_.includes(arg) && (sub === 'full' || sub === 'short')) return html`<${MockRun} key=${arg + sub} lv=${arg} size=${sub} />`
  const mine = here(data).level
  return html`<main class="page xm-mocks">
    <header class="masthead"><h1>Mock exams</h1><p>The whole exam in its real modules, parts and timing, scored the Goethe way. Each mock draws texts you haven't met yet where it can.
      The full paper is the real length; the short one keeps every module at about half.</p></header>
    <div class="xm-exams">${LEVELS_.map(lv => {
      const E = EXAMS[lv], past = (s.tests.mocks ?? []).filter(x => x.lv === lv), last = past.at(-1)
      const from = last && xmAddDays(last.d, 3) > today() ? xmAddDays(last.d, 3) : null
      return html`<section class=${`xm-exam l${lv}${lv === mine ? ' mine' : ''}`} aria-label=${E.name}>
        <div class="xm-exam-board">
          <p class="xm-exam-top"><span class="lb big">${lv}</span>${lv === mine ? html`<span class="xm-yours">Your level now</span>` : ''}</p>
          <h2 lang="de">${E.name}</h2>
          <ol class="xm-exam-mods">${E.mods.map(([m, min, parts]) => html`<li><b lang="de">${m}</b><small>${plural(parts.length, 'part')} · ${min[0]} min</small></li>`)}</ol>
          <p class="xm-rule">${E.each ? 'Pass: 60 of 100 in every module' : 'Pass: 60 of 100 overall'}</p>
        </div>
        <div class="xm-exam-go">
          <a class="btn big" href=${`#/mock/${lv}/full`}>Full paper <small>${mockMinutes(lv, 'full')} min</small></a>
          <a class="button" href=${`#/mock/${lv}/short`}>Short paper <small>${mockMinutes(lv, 'short')} min</small></a>
          ${past.length ? html`<ol class="xm-history" aria-label="Your mocks">${past.slice(-6).map(x => html`<li class=${x.pass ? 'pass' : 'fail'} title=${`${x.d}, ${x.size}`}>
            <b>${x.pts}</b><small>${x.d.slice(5).replace('-', '/')}</small></li>`)}</ol>` : html`<p class="quiet">Not taken yet.</p>`}
          ${from ? html`<p class="quiet">Next mock from ${xmDate(from)}.</p>` : ''}
        </div>
      </section>`
    })}</div>
    <p class="quiet xm-note">Hören uses the browser's German voices. Schreiben and Sprechen are scored by you against the rubric, with a model answer beside yours.</p>
    <${MorePractice} />
  </main>`
}
PAGES.mock = MockPage

function MockRun({ lv, size }) {
  const [paper] = useState(() => mockPaper(lv, size))
  return html`<main class="page xm-run">
    <${XmSitting} paper=${paper} after=${html`<a class="button" href="#/mock">All mock exams</a><a class="btn" href=${`#/tests/${lv}`}>Practice tests <${Arrow} /></a>`} />
  </main>`
}

// ==== src/90-station.js ====
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
  const View = TAB_VIEWS[t]   // registered by the tab's own fragment
  return html`<main class=${`station l${st.level}`}>
    <${Board} data=${data} n=${n} />
    <div class="station-bar">
      <nav class="tabs" aria-label="Station parts">${TABS.map(([id, label]) => html`<a href=${`#/station/${n}/${id}`}
        class=${id === t ? 'on' : ''} aria-current=${id === t ? 'page' : null}>${label}</a>`)}</nav>
      ${n === s.lesson ? html`<span class="you">Your current stop</span>`
        : html`<button type="button" onClick=${() => commit(x => { x.lesson = n })}>Make this my current stop</button>`}
    </div>
    <section class="tab-body" aria-label=${TAB_NAME[t]}>
      ${View ? html`<${View} data=${data} n=${n} />` : html`<p class="soon">${SOON[t]} <span class="quiet">Being written now.</span></p>`}
    </section>
  </main>`
}

function Soon({ title, text }) {
  return html`<main class="page"><header class="masthead"><h1>${title}</h1><p>${text}</p></header>
    <p class="soon">Being built now. <a href="#/">Back to today</a></p></main>`
}

// ==== src/99-app.js ====
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
