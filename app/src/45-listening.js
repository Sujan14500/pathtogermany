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
  const audio = useRef()
  const go = () => {
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
    <button type="button" class="mini" onClick=${go} disabled=${phase === 'listen' || phase === 'say'}>
      ${phase === 'listen' ? 'Listen…' : phase === 'say' ? html`<span class="rec-dot"></span> Say it now` : 'Shadow'}</button>
    ${r.url ? html`<audio ref=${audio} src=${r.url} controls class="mini-audio"></audio>` : ''}
    ${r.heard ? html`<span class="heard" lang="de">${heardWords(de, r.heard).map(([w, ok]) => html`<span class=${ok ? 'ok' : 'miss'}>${w}</span> `)}</span>` : ''}
    ${r.error ? html`<span class="rec-err">${r.error}</span>` : ''}
  </span>`
}

// ---- listening: the station's recordings in the Goethe Hören formats, read by German voices ----

const WHO = { A: 'Woman', B: 'Man', N: 'Announcer' }
function ListenItem({ it, exam, onDone }) {
  const [plays, setPlays] = useState(0)
  const [at, setAt] = useState(null)
  const [slow, setSlow] = useState(false)
  const [picks, setPicks] = useState({})
  const [done, setDone] = useState(false)
  const [lit, setLit] = useState(new Set())
  useEffect(() => () => stopSpeech(), [])
  const limit = it.once ? 1 : 2
  const play = rate => {
    if (at !== null) { stopSpeech(); setAt(null); return }
    setPlays(p => p + 1)
    speakLines(it.lines.map(l => [l.who, l.de]), { rate: rate ?? (slow ? .75 : undefined), onLine: i => setAt(i < 0 ? null : i) })
  }
  const qs = it.questions
  const all = qs.every((_, k) => picks[k] !== undefined)
  const score = qs.filter((q, k) => picks[k] === q.a).length
  const check = () => { setDone(true); stopSpeech(); setAt(null); if (!exam) commit(x => { x.practice[`h:${it.id}`] = Math.max(x.practice[`h:${it.id}`] ?? 0, score / qs.length) }); onDone?.(score, qs.length) }
  const speakers = [...new Set(it.lines.map(l => l.who))]
  return html`<div class=${`listen${exam ? ' exam' : ''}`}>
    <div class="l-stage">
      <p class="l-setup"><span class="lb">Hören ${it.part}</span> ${it.setup}</p>
      <div class="l-people" aria-hidden="true">${speakers.map(w => html`<span class=${`person p-${w}${at !== null && it.lines[at]?.who === w ? ' talking' : ''}`}>
        <svg viewBox="0 0 40 40" width="44" height="44"><circle cx="20" cy="14" r="8" fill="currentColor" /><path d="M5 38c1-9 7-14 15-14s14 5 15 14z" fill="currentColor" /></svg>
        <small>${WHO[w]}</small></span>`)}
        <span class=${`wave${at !== null ? ' on' : ''}`}>${[1, 2, 3, 4, 5].map(k => html`<i style=${`--k:${k}`}></i>`)}</span>
      </div>
      <div class="l-controls">
        <button type="button" class="btn big" onClick=${() => play()} disabled=${exam && plays >= limit && at === null}>
          ${at !== null ? 'Stop' : plays ? 'Play again' : 'Play'}</button>
        <span class="quiet">${exam ? `${plays} of ${limit} plays` : `Played ${plural(plays, 'time')}; the exam plays it ${it.once ? 'once' : 'twice'}.`}</span>
        ${exam ? '' : html`<label class="check"><input type="checkbox" checked=${slow} onChange=${e => setSlow(e.target.checked)} /> Slower</label>`}
      </div>
    </div>
    <section class="l-qs">
      <ol class="eqs">${qs.map((q, k) => html`<${ExamQuestion} q=${q} k=${k} pick=${picks[k]} done=${done} onShow=${ev => setLit(new Set(ev))}
        onPick=${j => setPicks(p => ({ ...p, [k]: j }))} />`)}</ol>
      ${!done ? html`<button type="button" class="btn" disabled=${!all || !plays} onClick=${check}>${!plays ? 'Listen first' : all ? 'Check my answers' : 'Answer every question'}</button>`
        : html`<div class="r-result"><p><b>${score} of ${qs.length}</b> right.</p>
          ${exam ? '' : html`<button type="button" onClick=${() => play(1.1)}>Hear it again, faster</button>`}</div>`}
    </section>
    ${done && !exam ? html`<section class="transcript" aria-label="Transcript">
      <h3>What was said</h3>
      <ol>${it.lines.map((l, i) => html`<li class=${`${lit.has(i) || qs.some(q => q.ev?.includes(i)) ? 'ev' : ''}${at === i ? ' now' : ''}`}>
        <span class=${`who p-${l.who}`}>${WHO[l.who]}</span>
        <span class="t-de" lang="de">${l.de}</span><${SayButton} text=${l.de} label="this line" />
        <small class="t-en">${l.en}</small><${Shadow} who=${l.who} de=${l.de} />
      </li>`)}</ol>
    </section>` : ''}
  </div>`
}

function ListenTab({ data, n }) {
  useStore()
  const items = data.listeningBy[n] ?? []
  const [i, setI] = useState(0)
  if (!items.length) return html`<p class="soon">This station's recordings are being written now: Goethe Hören formats, read by German voices.</p>`
  const it = items[Math.min(i, items.length - 1)]
  return html`<div class="listen-tab">
    <div class="text-picks" role="tablist" aria-label="Recordings">${items.map((x, k) => {
      const best = S.practice[`h:${x.id}`]
      return html`<button type="button" role="tab" aria-selected=${k === i} class=${k === i ? 'on' : ''} onClick=${() => { stopSpeech(); setI(k) }}>
        <span class="lb">Hören ${x.part}</span><b>${x.setup.split(':')[0]}</b><small>${best !== undefined ? `best ${pct(best)}` : x.once ? 'played once' : 'played twice'}</small></button>`
    })}</div>
    <${ListenItem} key=${it.id} it=${it} />
  </div>`
}
TAB_VIEWS.listen = ListenTab
