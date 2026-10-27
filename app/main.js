// Path to Germany: German from A1 to B1 for the Goethe-Zertifikat, taught through English.
// No build step: one ES module with vendored Preact + htm. scripts/bundle.py makes the single-file version.
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
  cards: {}, log: [], lesson: 1, newPerDay: 15, autoplay: true, newToday: { date: today(), n: 0 },
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
  return [...due.sort(byDue), ...news.slice(0, newLeft()), ...ahead.sort(byDue)]
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
  const cards = D.words.length ? [{ part: 'cards', label: 'Cards', href: '#/study', p: q.length ? 0 : 1, state: q.length ? 'todo' : 'done', note: q.length ? `${q.length} today` : 'done' }] : []
  return [...cards, ...PARTS.map(part => {
    const p = partDone(st.n, part)
    return { part, label: TAB_NAME[part], href: `#/station/${st.n}/${part}`, p, state: p >= 1 ? 'done' : p > 0 ? 'part' : 'todo' }
  })]
}

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
  const go = id => document.getElementById(`g-${id}`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
  return html`<div class="grammar-tab">
    <nav class="g-index" aria-label="Grammar points">${gs.map((g, i) => html`<button type="button" onClick=${() => go(g.id)}>
      <span class="g-num">${i + 1}</span>${g.title}${S.practice[`g:${g.id}`] ? html` <span class="g-tick" aria-label="studied">✓</span>` : ''}</button>`)}</nav>
    <p class="quiet g-howto">Build each sentence or answer its questions, and the point joins your daily cards for review.</p>
    ${gs.map((g, i) => html`<${GrammarPoint} key=${g.id} data=${data} g=${g} i=${i} />`)}
  </div>`
}

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

// ---- station tab: words ----

function WordsTab({ data, n }) {
  useStore()
  const ws = data.wordsBy[n] ?? []
  const [open, setOpen] = useState(null)
  const [quiz, setQuiz] = useState(null)
  const pool = useMemo(() => data.words.filter(w => w.n <= Math.max(n, 12)), [data, n])
  const start = () => setQuiz(wordQuestions(ws, pool))
  if (!ws.length) return html`<p class="soon">This station's words are being written now: each noun with its article and plural, audio and a quick quiz.</p>`
  const learned = ws.filter(w => known(w.id)).length
  return html`<div class="words-tab">
    <div class="words-head">
      <p><b>${ws.length} words</b> · ${learned} learned as cards. Tap a word for its example. New cards for this station come in${' '}
        <a href="#/study">today's cards</a> once it is your current stop.</p>
      <button type="button" class="btn" onClick=${start}>Test yourself <${Arrow} /></button>
    </div>
    ${quiz ? html`<section class="quiz-box" aria-label="Test yourself"><${Quiz} key=${quiz} qs=${quiz} again=${start} /></section>` : ''}
    <ul class="wlist">${ws.map(w => html`<li key=${w.id} class=${`${status(w)}${open === w.id ? ' open' : ''}`}>
      <${SayButton} text=${said(w)} />
      <button type="button" class="wrow" aria-expanded=${open === w.id} onClick=${() => setOpen(open === w.id ? null : w.id)}>
        <span class="wde"><${Word} w=${w} /><small lang="de">${formsNote(w)}</small></span>
        <span class="wen">${w.en}</span>
      </button>
      ${open === w.id ? html`<div class="wmore">${w.ipa ? html`<p class="ipa">${w.ipa}</p>` : ''}<${Example} w=${w} /></div>` : ''}
    </li>`)}</ul>
  </div>`
}

// ---- study session: each card is a station sign ----

function Study({ data }) {
  const s = useStore()
  const [revealed, setRevealed] = useState(false)
  const [leaving, setLeaving] = useState(0)
  const [done, setDone] = useState(0)
  const [prev, setPrev] = useState(null)
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
      setPrev(c); setDone(d => d + 1); setRevealed(false); setLeaving(0)
    }, reducedMotion() ? 0 : 240)
  }
  useEffect(() => {
    const onKey = e => {
      const onControl = e.target.closest?.('button, a, input, select, textarea, summary')
      if ((e.key === ' ' || e.key === 'Enter') && !onControl) { e.preventDefault(); revealed ? rate(Rating.Good) : reveal() }
      else if (/^[1-4]$/.test(e.key)) rate(+e.key)
      else if (e.key === 's' && c) sayIt()
      else if (e.key === 'Escape') location.hash = '#/'
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  if (!c) return html`<${Arrived} data=${data} done=${done} />`
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
        <span class="card-kind">${c.kind === 'g' ? 'Build it in German' : c.kind === 'r' ? 'What does it mean?' : w.p === 'n' ? 'Say it in German, with article and plural' : 'Say it in German'}</span>
        ${!s.cards[c.id] ? html`<span class="new-tag">New</span>` : ''}
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
              <p class="card-forms" lang="de">${formsNote(w)}</p><${Example} w=${w} />` : ''}</div>`}
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

// ---- der/die/das trainer: a noun appears, tap its article; the ending rule is taught after each answer ----

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

function Settings() {
  const s = useStore()
  const [, bump] = useState(0)
  useEffect(() => {   // the voice list arrives asynchronously
    if (!('speechSynthesis' in window)) return
    const f = () => bump(n => n + 1)
    speechSynthesis.addEventListener('voiceschanged', f)
    return () => speechSynthesis.removeEventListener('voiceschanged', f)
  }, [])
  const voices = deVoices()
  const set = (k, v) => commit(x => { x.settings = { ...x.settings, [k]: v } })
  return html`<details class="settings">
    <summary>Settings and backup</summary>
    <label>New cards per day
      <input type="number" min="0" max="200" value=${s.newPerDay}
        onChange=${e => commit(x => { x.newPerDay = Math.max(0, Math.min(200, +e.target.value || 0)) })} />
    </label>
    <label class="check"><input type="checkbox" checked=${s.autoplay} onChange=${e => commit(x => { x.autoplay = e.target.checked })} />
      Say each word aloud when its card turns over</label>
    <label>German voice
      <select value=${s.settings.voice ?? ''} onChange=${e => set('voice', e.target.value || undefined)}>
        <option value="">Automatic (best available)</option>
        ${voices.map(v => html`<option value=${v.name}>${v.name}</option>`)}
      </select>
    </label>
    <label>Speed
      <select value=${String(s.settings.rate ?? 0.95)} onChange=${e => set('rate', +e.target.value)}>
        <option value="0.7">Slow</option><option value="0.85">A little slower</option><option value="0.95">Normal</option><option value="1.1">Fast</option>
      </select>
      <button type="button" onClick=${() => speak('Hallo Sneka! Willkommen in Deutschland.')}><${Speaker} /> Test the voice</button>
    </label>
    ${voices.length ? '' : html`<div class="voice-help">
      <p><b>This browser has no German voice yet.</b> Add one in Windows: Settings → Time &amp; language → Speech → Add voices →
        German (Deutsch). Then quit the browser completely (Brave keeps running in the background: right-click its tray icon → Exit)
        and open it again. Microsoft Edge has German voices built in.</p>
      <p>Or install it from an administrator PowerShell (Start → type PowerShell → Run as administrator):</p>
      <p class="cmd"><code>${VOICE_CMD}</code> <button type="button" onClick=${() => navigator.clipboard?.writeText(VOICE_CMD)}>Copy</button></p>
    </div>`}
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
      ${t === 'words' ? html`<${WordsTab} data=${data} n=${n} />` : t === 'grammar' && data.grammarBy[n].length ? html`<${GrammarTab} data=${data} n=${n} />` : html`
        ${t === 'grammar' ? html`<ol class="glist">${st.grammar.map(([id, title]) => html`<li key=${id}>${title}</li>`)}</ol>` : ''}
        <p class="soon">${SOON[t]} <span class="quiet">Being written now.</span></p>`}
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

function prepare(levels, words, grammar, drills) {
  const stations = [null]                // stations[n], n = 1…36 across the levels
  levels.forEach(lv => stations.push(...lv.stations))
  words.sort((a, b) => a.n - b.n)        // stable: a station's words keep their written order
  const by = xs => { const out = stations.map(() => []); xs.forEach(x => out[x.n]?.push(x)); return out }
  const verbSet = new Set(words.filter(w => w.p === 'v').map(w => w.w))
  const gq = {}
  drills.gq.forEach(q => (gq[q.g] ??= []).push(q))
  D = { levels, level: Object.fromEntries(levels.map(lv => [lv.level, lv])), stations, words, wordsBy: by(words), verbSet,
    grammar, grammarBy: by(grammar), gq }
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
    Promise.all([getJson('syllabus'), getJson('words', []), getJson('grammar', []), getJson('drills', { gq: [] })])
      .then(args => setData(prepare(...args))).catch(e => setError(e.message))
    navigator.storage?.persist?.()
  }, [])
  if (error) return html`<main class="empty"><p>The lessons didn't load (${error}). Run <code>python scripts/build_data.py</code>,
    then open <code>app/WegNachDeutschland.html</code>.</p></main>`
  if (!data) return html`<main class="empty"><p>Loading…</p></main>`
  const { page, arg, sub } = route(hash)
  const view = page === 'station' ? html`<${Station} data=${data} n=${Number(arg)} tab=${sub} />`
    : page === 'practice' ? html`<${PracticeHub} />`
    : page === 'study' ? html`<${Study} data=${data} />`
    : page === 'tests' ? html`<${Soon} title="Practice tests" text="Numbered tests per level and module: Lesen, Hören, Schreiben, Sprechen, Wortschatz, Grammatik." />`
    : page === 'mock' ? html`<${Soon} title="Mock exam" text="A timed paper per level in the real Goethe structure, scored the Goethe way." />`
    : page === 'pictures' ? html`<${Soon} title="Picture scenes" text="Drawn scenes where every object is a word with its article." />`
    : page === 'verbs' ? html`<${VerbsTrainer} data=${data} />`
    : page === 'gender' ? html`<${GenderTrainer} data=${data} />`
    : page === 'cases' ? html`<${CasesPage} data=${data} />`
    : page === 'sounds' ? html`<${Soon} title="Pronunciation" text="A sound guide for ü, ö, ä, ch and r, and minimal-pair listening." />`
    : page === 'tips' ? html`<${Soon} title="Tips" text="How to learn faster, and how to sit the exam." />`
    : html`<${Home} data=${data} />`
  return html`<${TopBar} data=${data} page=${page} />${view}<${LeaveExport} />`
}

render(html`<${App} />`, document.getElementById('app'))
