// ---- recording: MediaRecorder, and the browser's German speech recognition where it has one ----

const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
const canRecord = () => !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder)
// Records the microphone; where SpeechRecognition (de-DE) exists, also writes down what it heard. Audio never leaves
// the browser.
function useRecorder() {
  const [st, setSt] = useState({ state: 'idle', url: null, heard: '', error: null })
  const rec = useRef(null)
  const start = async () => {
    if (!canRecord()) {
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
