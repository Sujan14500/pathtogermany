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
