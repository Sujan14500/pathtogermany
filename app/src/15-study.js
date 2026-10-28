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
