// ---- reading: the station's texts in the Goethe Lesen formats ----

const PART_NAME = { Lesen: 'Lesen', Hören: 'Hören' }
const sentences = t => t.blocks.flatMap(b => b.s.map((p, k) => ({ id: `${b.id}.${k}`, de: p[0], en: p[1] })))
const textWords = t => sentences(t).reduce((a, s) => a + s.de.split(/\s+/).length, 0)
const tokens = s => s.match(/[\p{L}ß]+/gu) ?? []

// Course words by their forms, to say how much of a text the learner already knows (L11).
let formIndex = null
function knownShare(t) {
  if (!formIndex) {
    formIndex = new Map()
    for (const w of D.words) for (const f of wordForms(w)) if (!formIndex.has(f.toLowerCase())) formIndex.set(f.toLowerCase(), w)
  }
  let all = 0, known_ = 0
  const unknown = new Set()
  for (const s of sentences(t)) {
    for (const tok of tokens(s.de)) {
      all++
      const w = formIndex.get(tok.toLowerCase())
      if (w && known(w.id)) known_++
      else if (w) unknown.add(tok.toLowerCase())
    }
  }
  return { share: all ? known_ / all : 0, unknown }
}

// One question in an exam format: richtig/falsch, ja/nein, a/b/c or a letter from the texts.
function ExamQuestion({ q, k, pick, onPick, done, onShow }) {
  const right = done && pick === q.a
  return html`<li class=${`eq${done ? (right ? ' right' : ' wrong') : ''}`}>
    <p class="eq-q"><span class="eq-n">${k + 1}</span><span lang="de">${q.q}</span></p>
    <div class=${`eq-opts ${q.format}`}>${q.opts.map((o, j) => html`<button type="button" lang="de" disabled=${done} aria-pressed=${pick === j}
      class=${`${pick === j ? 'on' : ''}${done && j === q.a ? ' answer' : ''}`} onClick=${() => onPick(j)}>
      ${q.format === 'abc' ? html`<b>${'abc'[j]}</b> ` : ''}${o}</button>`)}</div>
    ${done ? html`<p class="eq-why">${right ? html`<b>Right.</b> ` : html`<b>The answer is ${q.format === 'abc' ? `${'abc'[q.a]}: ` : ''}<span lang="de">${q.opts[q.a]}</span>.</b> `}${q.why}
      ${q.ev?.length ? html` <button type="button" class="linkish" onClick=${() => onShow(q.ev)}>Show it in the text</button>` : ''}</p>` : ''}
  </li>`
}

// The reader. Help (tap a sentence for English, the glossary, known words) is off in exam mode (tests).
function Reader({ t, exam, onDone }) {
  const s = useStore()
  const [predicted, setPredicted] = useState(exam || S.practice[`r:${t.id}`] !== undefined ? 'skip' : null)
  const [open, setOpen] = useState(new Set())
  const [gloss, setGloss] = useState(null)
  const [picks, setPicks] = useState({})
  const [done, setDone] = useState(false)
  const [lit, setLit] = useState(new Set())
  const [speakingAt, setSpeakingAt] = useState(null)
  const [marks, setMarks] = useState(false)
  const [timing, setTiming] = useState({ start: null, first: null, again: null, againStart: null })
  const ref = useRef()
  useEffect(() => () => stopSpeech(), [])
  useEffect(() => { if (predicted && !timing.start) setTiming(x => ({ ...x, start: Date.now() })) }, [predicted])
  const words = textWords(t)
  const wpm = ms => Math.round(words / (ms / 60000))
  const qs = t.questions
  const all = qs.every((_, k) => picks[k] !== undefined)
  const score = qs.filter((q, k) => picks[k] === q.a).length
  const check = () => {
    setDone(true)
    const first = timing.first ?? Date.now() - timing.start
    setTiming(x => ({ ...x, first }))
    if (!exam) commit(x => { x.practice[`r:${t.id}`] = Math.max(x.practice[`r:${t.id}`] ?? 0, score / qs.length) })
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
  const known = useMemo(() => (exam ? null : knownShare(t)), [t, exam, s.cards])
  const glossRe = gloss && new RegExp(`(?<!\\p{L})(${esc(gloss)}\\p{L}*)`, 'giu')
  const Sentence = ({ x }) => {
    const parts = glossRe ? x.de.split(glossRe) : [x.de]
    const body = parts.map((p, k) => (k % 2 ? html`<mark class="gl">${p}</mark>` : marks ? p.split(/([\p{L}ß]+)/u).map((w, j) => (j % 2 && known.unknown.has(w.toLowerCase()) ? html`<u class="unk">${w}</u>` : w)) : p))
    return html`<span class=${`sent${lit.has(x.id) ? ' lit' : ''}${speakingAt === x.id ? ' now' : ''}${open.has(x.id) ? ' open' : ''}`}
      onClick=${exam ? null : () => setOpen(o => { const n = new Set(o); n.has(x.id) ? n.delete(x.id) : n.add(x.id); return n })}>
      <span lang="de">${body}</span>${open.has(x.id) ? html`<small class="sent-en">${x.en}</small>` : ''} </span>`
  }
  const block = b => {
    const ss = b.s.map((p, k) => ({ id: `${b.id}.${k}`, de: p[0], en: p[1] }))
    const inner = ss.map(x => html`<${Sentence} x=${x} />`)
    return b.t === 'h' ? html`<h3 class="rb-h">${inner}</h3>`
      : b.t === 'ad' || b.t === 'sign' || b.t === 'comment' ? html`<div class=${`rb-${b.t}`}>${b.label ? html`<span class="rb-label">${b.label}</span>` : ''}<p>${inner}</p></div>`
      : b.t === 'list' ? html`<ul class="rb-list">${ss.map(x => html`<li><${Sentence} x=${x} /></li>`)}</ul>`
      : html`<p class="rb-p">${inner}</p>`
  }
  if (!predicted) {
    return html`<section class="guess predict" aria-label="Predict first">
      <h3>Before you read: ${t.title}</h3><p class="quiet">${t.intro} Guess first: it gets your mind ready for the text.</p>
      <p class="quiz-q">${t.predict.q}</p>
      <div class="guess-opts">${t.predict.opts.map((o, j) => html`<button type="button" onClick=${() => setPredicted(j === t.predict.a ? 'right' : 'wrong')}>${o}</button>`)}</div>
    </section>`
  }
  return html`<div class=${`reader${exam ? ' exam' : ''}`} ref=${ref}>
    <article class="r-text">
      <header class="r-head">
        <span class="lb">Lesen ${t.part}</span><span class="r-type">${t.type}</span>
        ${predicted === 'right' || predicted === 'wrong' ? html`<span class="quiet">${predicted === 'right' ? 'Your guess was right.' : 'Now read and see what it is about.'}</span>` : ''}
        ${exam ? '' : html`<button type="button" class="r-aloud" onClick=${readAloud}><${Speaker} /> ${speakingAt !== null ? 'Stop' : 'Read it to me'}</button>`}
      </header>
      ${t.intro ? html`<p class="r-intro">${t.intro}</p>` : ''}
      <div class="r-body">${t.blocks.map(block)}</div>
      ${exam ? '' : html`<footer class="r-help">
        ${known ? html`<p class="r-known"><b>You know ${pct(known.share)} of the words here.</b>${known.unknown.size ? html` <button type="button" class="linkish" onClick=${() => setMarks(m => !m)}>${marks ? 'Hide the marks' : `Mark the ${plural(known.unknown.size, 'word')} not learned yet`}</button>` : ''}</p>` : ''}
        ${t.glossary?.length ? html`<div class="r-gloss"><b>Glossary</b>${t.glossary.map(g => html`<button type="button" class=${gloss === g.w ? 'on' : ''}
          onClick=${() => setGloss(gloss === g.w ? null : g.w)}><span lang="de">${g.w}</span> <small>${g.en}</small></button>`)}</div>` : ''}
        <p class="quiet">Tap a sentence to see it in English.</p>
      </footer>`}
    </article>
    <section class="r-qs" aria-label="Questions">
      <h3>${qs.length} questions</h3>
      <ol class="eqs">${qs.map((q, k) => html`<${ExamQuestion} q=${q} k=${k} pick=${picks[k]} done=${done} onShow=${show}
        onPick=${j => setPicks(p => ({ ...p, [k]: j }))} />`)}</ol>
      ${!done ? html`<button type="button" class="btn" disabled=${!all} onClick=${check}>${all ? 'Check my answers' : `Answer all ${qs.length} questions`}</button>`
        : html`<div class="r-result">
          <span class=${`stamp ${score / qs.length >= .6 ? 'pass' : 'fail'}`}>${score / qs.length >= .6 ? 'Bestanden' : 'Noch nicht'}</span>
          <p><b>${score} of ${qs.length}</b> right.${!exam && timing.first ? ` You read at about ${wpm(timing.first)} words per minute.` : ''}</p>
          ${!exam ? html`<p class="r-again">${timing.againStart && !timing.again ? html`<button type="button" class="btn" onClick=${() => setTiming(x => ({ ...x, again: Date.now() - x.againStart }))}>Done reading <${Arrow} /></button>`
            : timing.again ? html`Second read: <b>${wpm(timing.again)} words per minute</b> (first: ${wpm(timing.first)}). ${wpm(timing.again) > wpm(timing.first) ? 'Faster: that is fluency growing.' : ''}`
            : html`<button type="button" onClick=${() => { setTiming(x => ({ ...x, againStart: Date.now() })); ref.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' }) }}>Read it again against the clock</button>`}</p>` : ''}
        </div>`}
    </section>
  </div>`
}

function ReadTab({ data, n }) {
  useStore()
  const ts = data.readingBy[n] ?? []
  const [i, setI] = useState(0)
  if (!ts.length) return html`<p class="soon">This station's reading texts are being written now: Goethe Lesen formats, with tap-to-translate.</p>`
  const t = ts[Math.min(i, ts.length - 1)]
  return html`<div class="read-tab">
    <div class="text-picks" role="tablist" aria-label="Texts">${ts.map((x, k) => {
      const best = S.practice[`r:${x.id}`]
      return html`<button type="button" role="tab" aria-selected=${k === i} class=${k === i ? 'on' : ''} onClick=${() => setI(k)}>
        <span class="lb">Lesen ${x.part}</span><b lang="de">${x.title}</b><small>${best !== undefined ? `best ${pct(best)}` : x.type}</small></button>`
    })}</div>
    <${Reader} key=${t.id} t=${t} />
  </div>`
}
TAB_VIEWS.read = ReadTab
