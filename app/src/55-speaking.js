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
  const groups = rubricGroups('speak', t.level, [], t.part)
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
