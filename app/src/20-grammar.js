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
  q: html`<span lang="de">${gapped(q.q)}</span>`,
  opts: q.opts, a: q.a, why: html`${q.why} <span class="quiet">(${q.en})</span>`, say: q.q.replace('___', q.opts[q.a]),
}))

// Before the explanation: one question to guess. Getting it wrong first makes the rule stick when it comes.
function GuessFirst({ q }) {
  const [picked, setPicked] = useState(null)
  return html`<section class="guess" aria-label="Guess first">
    <h3>Guess first</h3><p class="quiet">A wrong guess is fine: it makes the explanation stick.</p>
    <p class="quiz-q" lang="de">${gapped(q.q)}</p>
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
  const go = id => document.getElementById(`g-${id}`)?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
  return html`<div class="grammar-tab">
    <nav class="g-index" aria-label="Grammar points">${gs.map((g, i) => html`<button type="button" onClick=${() => go(g.id)}>
      <span class="g-num">${i + 1}</span>${g.title}${S.practice[`g:${g.id}`] ? html` <span class="g-tick" aria-label="studied">✓</span>` : ''}</button>`)}</nav>
    <p class="quiet g-howto">Build each sentence or answer its questions, and the point joins your daily cards for review.</p>
    ${gs.map((g, i) => html`<${GrammarPoint} key=${g.id} data=${data} g=${g} i=${i} />`)}
  </div>`
}
TAB_VIEWS.grammar = GrammarTab
