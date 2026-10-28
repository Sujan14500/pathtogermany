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
