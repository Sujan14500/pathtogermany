// Path to Germany: German from A1 to B1 for the Goethe-Zertifikat, taught through English.
// No bundler: app/src/*.js are joined in name order into one ES module, app/main.js, with vendored Preact + htm.
// This fragment holds what every feature shares; scripts/bundle.py joins them and makes the single-file version.
import { html, render, useState, useEffect, useLayoutEffect, useMemo, useRef } from './vendor/htm-preact-3.1.1.js'
import { fsrs, createEmptyCard, Rating, State } from './vendor/ts-fsrs-5.4.2.js'

const KEY = 'pathtogermany:v1'
const today = () => new Date().toLocaleDateString('en-CA')
const endOfToday = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d }
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
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
  const vN = deVoices().find(v => v !== vA && v !== vB) ?? vA
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
    if (one || (who === 'N' && vN === vA)) u.pitch = who === 'B' ? .7 : who === 'N' ? 1 : 1.25
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
