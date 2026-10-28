// ---- pronunciation: a drawn mouth for each sound, minimal pairs for the ear, and your own voice to compare ----

// Each sound is taught as the steps the mouth moves through, usually the nearest English sound first and then the
// German one, so the drawing shows exactly what changes. lips: spread | round | open | neutral; tongue: a TONGUE
// shape; jaw 0…1; air: where the air hisses (front, back, tip); voice: the throat buzzes; hold: vowel length 0…1.
// focus names the parts that change, drawn in the line colour. say: a word that has the sound, read on a tap.
const SOUND_STEPS = {
  ue: { focus: ['lips'], steps: [
    { k: 'ee', en: 1, lips: 'spread', tongue: 'front', jaw: .15, voice: 1, note: "English 'ee', as in 'see': the lips are spread." },
    { k: 'ü', lips: 'round', tongue: 'front', jaw: .15, voice: 1, say: 'Tür', note: 'ü: the tongue stays exactly where it was. Only the lips round and push forward.' }] },
  oe: { focus: ['lips'], steps: [
    { k: 'e', lips: 'spread', tongue: 'mid', jaw: .25, voice: 1, say: 'See', note: "German long e, as in See: the lips are spread." },
    { k: 'ö', lips: 'round', tongue: 'mid', jaw: .25, voice: 1, say: 'schön', note: "ö: the same tongue, with the lips rounded as for 'oh'." }] },
  ae: { focus: ['jaw'], steps: [
    { k: 'e', lips: 'spread', tongue: 'front', jaw: .15, voice: 1, say: 'See', note: 'German long e, as in See: the mouth is almost closed.' },
    { k: 'ä', lips: 'neutral', tongue: 'mid', jaw: .5, voice: 1, say: 'Käse', note: "ä: drop the jaw a little and relax the lips: the 'e' of 'bed'." }] },
  ich: { focus: ['tongue', 'air'], steps: [
    { k: 'ee', en: 1, lips: 'spread', tongue: 'front', jaw: .15, voice: 1, note: "Say 'ee': the middle of the tongue rises toward the roof of the mouth." },
    { k: 'ch', lips: 'spread', tongue: 'ich', jaw: .15, air: 'front', say: 'ich', note: 'ich: lift it a little closer, switch your voice off and blow: a hiss in the narrow gap.' }] },
  ach: { focus: ['tongue', 'air'], steps: [
    { k: 'k', en: 1, lips: 'neutral', tongue: 'k', jaw: .3, note: "'k': the back of the tongue touches the soft palate and stops the air." },
    { k: 'ch', lips: 'neutral', tongue: 'back', jaw: .3, air: 'back', say: 'acht', note: "ach: lower it just a little and let the air rasp through, as in Scottish 'loch'." }] },
  r: { focus: ['tongue'], steps: [
    { k: 'r', en: 1, lips: 'neutral', tongue: 'curl', jaw: .25, voice: 1, note: 'English r: the tongue tip curls up and back.' },
    { k: 'r', lips: 'neutral', tongue: 'uvular', jaw: .25, voice: 1, air: 'back', say: 'rot', note: 'German r: the tip stays down; the back of the tongue rises to the uvula, a soft gargle.' }] },
  z: { focus: ['tongue', 'air'], steps: [
    { k: 't', lips: 'spread', tongue: 't', jaw: .15, note: 'First a t: the tongue tip presses on the ridge behind the top teeth.' },
    { k: 's', lips: 'spread', tongue: 'tip', jaw: .15, air: 'tip', say: 'zehn', note: "Then let go straight into a sharp s. Together: ts, as at the end of 'cats'." }] },
  s: { focus: ['voice'], steps: [
    { k: 'ß', lips: 'spread', tongue: 'tip', jaw: .15, air: 'tip', say: 'heißen', note: 'ß, ss and s at the end of a word: a hiss. The throat is silent.' },
    { k: 's', lips: 'spread', tongue: 'tip', jaw: .15, air: 'tip', voice: 1, say: 'Sonne', note: "s before a vowel: the same hiss with your voice on. It buzzes like the English 'z'." }] },
  sch: { focus: ['lips', 'tongue'], steps: [
    { k: 's', lips: 'spread', tongue: 'tip', jaw: .15, air: 'tip', note: 's: the lips spread, the tongue tip at the ridge.' },
    { k: 'sch', lips: 'round', tongue: 'sch', jaw: .15, air: 'tip', say: 'Schule', note: "sch: the tongue slides a little back and the lips push forward: 'sh'." }] },
  'ei-ie': { focus: ['jaw', 'tongue'], steps: [
    { k: 'ie', lips: 'spread', tongue: 'front', jaw: .15, voice: 1, say: 'vier', note: "ie: one long 'ee'. The mouth holds still." },
    { k: 'ei', lips: 'open', tongue: 'low', jaw: .65, voice: 1, note: "ei starts wide open, on 'a' …" },
    { k: 'ei', lips: 'spread', tongue: 'front', jaw: .2, voice: 1, say: 'drei', note: "… and glides up toward 'ee': it sounds like 'eye'." }] },
  eu: { focus: ['tongue'], steps: [
    { k: 'eu', lips: 'round', tongue: 'back', jaw: .45, voice: 1, note: "eu starts on an open 'o', with the lips rounded …" },
    { k: 'eu', lips: 'round', tongue: 'front', jaw: .15, voice: 1, say: 'neu', note: "… and glides toward ü, the lips still round: 'oy', as in 'boy'." }] },
  'long-short': { focus: ['time'], steps: [
    { k: 'Staat', lips: 'open', tongue: 'low', jaw: .6, voice: 1, hold: 1, say: 'Staat', note: 'Long: hold the vowel, about twice as long.' },
    { k: 'Stadt', lips: 'open', tongue: 'low', jaw: .6, voice: 1, hold: .4, say: 'Stadt', note: 'Short: quick, cut off by the next consonant.' }] },
}
// The big letters on each sound's stop, and the letters that make the sound in its example words (first match).
const SOUND_CHIP = { ue: 'ü', oe: 'ö', ae: 'ä', ich: 'ch', ach: 'ch', r: 'r', z: 'z', s: 's ß', sch: 'sch', 'ei-ie': 'ei ie', eu: 'eu', 'long-short': 'a aa' }
const SOUND_MARK = { ue: /ü/i, oe: /ö/i, ae: /ä/i, ich: /ch/i, ach: /ch/i, r: /r/i, z: /tz|z/i, s: /ß|ss|s(?=[aeiouäöü])/i,
  sch: /sch|s(?=[pt])/i, 'ei-ie': /ei|ai|ie/i, eu: /eu|äu/i, 'long-short': /[aeiouäöü]+h?/i }

// ---- the mouth, seen from the side (facing left), with a front view of the lips ----

// Tongue shapes as [peak x, peak y, tip x, tip y], with the jaw closed; the jaw then lowers the whole tongue.
const TONGUE = { front: [112, 95, 62, 132], ich: [110, 89, 62, 132], mid: [124, 104, 62, 133], back: [170, 99, 64, 136],
  k: [172, 85, 64, 136], uvular: [182, 98, 66, 138], tip: [118, 108, 68, 108], t: [118, 106, 66, 104], sch: [110, 101, 76, 106],
  curl: [140, 114, 90, 99], low: [138, 122, 62, 136] }
const tonguePath = ([px, py, tx, ty]) =>
  `M206 214C206 ${py + 40} ${px + 40} ${py - 2} ${px} ${py}C${px - 30} ${py} ${tx + 18} ${ty - 10} ${tx} ${ty}C${tx - 6} ${ty + 6} ${tx - 2} ${ty + 14} ${tx + 8} ${ty + 16}C100 172 160 200 206 214Z`
// Lips: the side view's shift of the upper and lower lip, and the front view's outer and inner ellipse.
const LIPS = { spread: { up: [3, 0], lo: [3, 0], f: [31, 10, 25, 3] }, round: { up: [-8, 2], lo: [-8, -3], f: [17, 15, 6, 6] },
  open: { up: [1, -2], lo: [1, 1], f: [26, 19, 19, 12] }, neutral: { up: [0, 0], lo: [0, 0], f: [25, 12, 18, 5] } }
const AIR = { front: 'M216 196C214 140 170 96 112 94S70 118 20 116', back: 'M216 196C214 150 200 106 172 102S80 124 20 118',
  tip: 'M216 196C214 140 150 112 96 108S74 106 20 114' }
const MOUTH = {
  head: 'M70 0H320V250H230L226 104C224 96 218 90 210 90C204 90 200 96 199 104C200 112 195 117 192 111C190 99 182 84 160 80C130 76 90 82 68 100L62 104L52 119L44 104C40 100 36 98 30 96C22 94 14 90 14 84C14 78 20 74 24 70C38 56 54 40 62 24Z',
  jaw: 'M50 127L56 128C80 148 120 168 200 204L208 214V280H118V228C96 224 66 222 52 212C40 204 34 192 36 182C38 172 44 164 43 157C42 151 35 148 34 141C33 134 40 128 50 127Z',
  toothUp: 'M58 103L64 104L61 122C59 124 56 123 55 121Z', toothLo: 'M56 141L61 141L62 127C60 125 57 125 56 127Z',
  lipUp: 'M54 108C46 103 37 102 33 108C30 114 34 121 44 122L55 121Z', lipLo: 'M55 127H44C35 127 31 133 33 139C36 146 47 146 55 139Z',
  chin: 'M118 228C96 224 66 222 52 212C40 204 34 192 36 182C38 172 44 164 43 157C42 151 35 148 34 141',
  palate: 'M64 104C88 82 128 76 160 80C182 84 190 99 192 111', cavity: 'M44 100L232 66V250H206L200 204L56 128L48 128Z',
}
function SoundMouth({ st, focus }) {
  const L = LIPS[st.lips] ?? LIPS.neutral
  const tp = tonguePath(TONGUE[st.tongue] ?? TONGUE.mid)
  const [orx, ory, irx, iry] = L.f
  const hot = part => (focus.includes(part) ? ' hot' : '')
  const move = ([x, y]) => `transform:translate(${x}px,${y}px)`
  return html`<svg class="mouth" viewBox="0 0 320 250" role="img" aria-label=${`Mouth from the side: ${st.note}`}>
    <path class="m-cavity" d=${MOUTH.cavity} />
    <g class="m-jaw" style=${`transform:translateY(${(st.jaw ?? .2) * 30}px)`}>
      <path class="m-skin" d=${MOUTH.jaw} />
      ${focus.includes('jaw') ? html`<path class="m-chin hot" d=${MOUTH.chin} />` : ''}
      <path class=${`m-tongue${hot('tongue')}`} d=${tp} style=${`d:path('${tp}')`} />
      <text class="m-in" x="118" y="166">tongue</text>
      <path class="m-tooth" d=${MOUTH.toothLo} />
      <path class=${`m-lip${hot('lips')}`} d=${MOUTH.lipLo} style=${move(L.lo)} />
    </g>
    <path class="m-skin" d=${MOUTH.head} />
    <path class="m-palate" d=${MOUTH.palate} />
    <path class="m-tooth" d=${MOUTH.toothUp} />
    <path class=${`m-lip${hot('lips')}`} d=${MOUTH.lipUp} style=${move(L.up)} />
    ${st.air ? html`<path key=${st.air} class=${`m-air${hot('air')}`} d=${AIR[st.air]} />` : ''}
    <g class=${`m-voice${st.voice ? ' on' : ''}${hot('voice')}`}><path d="M210 236l6-5 6 5 6-5" /><path d="M210 226l6-5 6 5 6-5" /></g>
    <g class="m-labels">
      <text x="92" y="68">roof of the mouth</text>
      <text x="240" y="121">soft palate</text><path d="M238 118L201 108" />
      <text x="240" y="229">${st.voice ? 'voice: buzz' : 'voice: off'}</text><path d="M238 226L229 229" />
      <text x="4" y="160">lips</text><path d="M14 152L28 136" />
    </g>
    <g class="m-front" transform="translate(278 46)">
      <circle r="34" />
      <ellipse class=${`m-lipf${hot('lips')}`} rx=${orx} ry=${ory} style=${`rx:${orx}px;ry:${ory}px`} />
      <ellipse class="m-hole" rx=${irx} ry=${iry} style=${`rx:${irx}px;ry:${iry}px`} />
      <text y="48">lips from the front</text>
    </g>
  </svg>`
}

// Steps one after another, on a loop until the learner picks one (no loop under reduced motion).
function SoundDiagram({ s }) {
  const def = SOUND_STEPS[s.id] ?? { focus: [], steps: [{ k: s.sound, ...s.mouth, voice: 1, note: s.how }] }
  const steps = def.steps
  const [at, setAt] = useState(steps.length - 1)
  const [auto, setAuto] = useState(() => steps.length > 1 && !reducedMotion())
  useEffect(() => {
    if (!auto) return
    const t = setInterval(() => setAt(i => (i + 1) % steps.length), 2200)
    return () => clearInterval(t)
  }, [auto])
  const st = steps[at]
  const pick = i => { setAuto(false); setAt(i); if (steps[i].say) speak(steps[i].say) }
  return html`<section class="snd-diagram" aria-label="How the mouth moves">
    <${SoundMouth} st=${st} focus=${def.focus} />
    ${def.focus.includes('time') ? html`<div class="snd-time" aria-hidden="true">${steps.map((x, i) => html`<p class=${i === at ? 'on' : ''}>
      <b lang="de">${x.k}</b><span><i key=${`${at}-${i}`} style=${`--hold:${x.hold}`}></i></span></p>`)}</div>` : ''}
    <div class="snd-steps" role="group" aria-label="Steps">
      ${steps.map((x, i) => html`${i ? html`<span class="snd-to" aria-hidden="true">→</span>` : ''}<button type="button" aria-pressed=${i === at}
        class=${`${i === at ? 'on' : ''}${x.en ? ' en' : ''}`} onClick=${() => pick(i)}><b lang=${x.en ? 'en' : 'de'}>${x.k}</b><small>${x.en ? 'English' : 'German'}</small></button>`)}
      ${steps.length > 1 ? html`<button type="button" class="snd-auto" onClick=${() => setAuto(a => !a)} aria-pressed=${auto}>
        ${auto ? html`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M7 5h3v14H7zM14 5h3v14h-3z" fill="currentColor" /></svg> Pause`
          : html`<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M8 5l11 7-11 7z" fill="currentColor" /></svg> Play the change`}</button>` : ''}
    </div>
    <p class="snd-cap" key=${at}>${st.note}${st.say ? html` <${SayButton} text=${st.say} />` : ''}</p>
  </section>`
}

const SoundWord = ({ w, mark }) => {
  const m = mark?.exec(w)
  return html`<span lang="de">${m ? html`${w.slice(0, m.index)}<mark>${m[0]}</mark>${w.slice(m.index + m[0].length)}` : w}</span>`
}

// ---- hear one word of a pair and pick which it was ----

function SoundPairs({ s }) {
  const [round, setRound] = useState(() => shuffle(s.pairs))
  const [k, setK] = useState(0)
  const [target, setTarget] = useState(() => Math.round(Math.random()))
  const [picked, setPicked] = useState(null)
  const [heard, setHeard] = useState(false)
  const [right, setRight] = useState(0)
  const p = round[k]
  const best = S.practice[`sound:${s.id}`]
  const play = (t = target) => { speak(p ? p[t] : ''); setHeard(true) }
  const choose = j => {
    if (picked !== null || !heard) return
    setPicked(j)
    const ok = j === target
    if (ok) setRight(r => r + 1)
    if (k + 1 === round.length) commit(x => { x.practice[`sound:${s.id}`] = Math.max(x.practice[`sound:${s.id}`] ?? 0, (right + ok) / round.length) })
  }
  const next = () => {
    if (picked === null) return
    const t = Math.round(Math.random())
    setK(k + 1); setPicked(null); setTarget(t)
    if (round[k + 1]) { speak(round[k + 1][t]); setHeard(true) } else setHeard(false)
  }
  const again = () => { setRound(shuffle(s.pairs)); setK(0); setRight(0); setPicked(null); setHeard(false) }
  useEffect(() => {
    const onKey = e => {
      if (e.target.closest?.('input, textarea, select') || e.ctrlKey || e.altKey || e.metaKey) return
      if ((e.key === '1' || e.key === '2') && p) choose(+e.key - 1)
      else if (e.key.toLowerCase() === 'r' && p) play()
      else if (e.key === 'Enter' && picked !== null && !e.target.closest?.('button, a')) next()
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })
  return html`<section class="snd-drill snd-pairs" aria-labelledby="snd-pairs-h">
    <header><h2 id="snd-pairs-h">Which one did you hear?</h2>
      <span class="snd-score">${p ? html`Pair <b>${k + 1}</b> of ${round.length} · <b>${right}</b> right` : ''}${best !== undefined ? html` · best ${pct(best)}` : ''}</span></header>
    ${!p ? html`<div class="quiz-end">
        <span class=${`stamp ${right / round.length >= .6 ? 'pass' : 'fail'}`}>${right / round.length >= .6 ? 'Gut gehört' : 'Noch nicht'}</span>
        <p><b>${right} of ${round.length}</b> right. ${right === round.length ? 'Your ear tells these apart.' : 'Listen to the pairs you missed side by side, then try another round.'}</p>
        <button type="button" class="btn" onClick=${again}>Another round <${Arrow} /></button></div>`
      : html`<button type="button" class="snd-play" onClick=${() => play()} aria-label="Play the word">
          <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
            <path d="M16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
          <span>${heard ? 'Hear it again' : 'Play the word'}</span><kbd>R</kbd></button>
        <ol class="snd-opts">${[0, 1].map(j => html`<li><button type="button" disabled=${!heard || picked !== null} onClick=${() => choose(j)}
          class=${picked === null ? '' : j === target ? 'right' : j === picked ? 'wrong' : 'dim'}>
          <kbd>${j + 1}</kbd><b lang="de">${p[j]}</b><small>${p[j + 2]}</small></button></li>`)}</ol>
        ${picked !== null ? html`<div class=${`why ${picked === target ? 'right' : 'wrong'}`}>
          <p><b>${picked === target ? 'Right.' : 'Not quite.'}</b> It was <b lang="de">${p[target]}</b> (${p[target + 2]}).
            <button type="button" class="snd-mini" onClick=${() => speakLines([['A', p[0]], ['A', p[1]], ['A', p[0]], ['A', p[1]]])}>Hear both</button></p>
          <button type="button" class="btn" onClick=${next}>${k + 1 === round.length ? 'See the result' : 'Next pair'} <${Arrow} /></button>
        </div>` : html`<p class="quiet snd-hint">${heard ? 'Pick the word you heard: 1 or 2.' : 'Play the word first. The voice says one of these two.'}</p>`}`}
  </section>`
}

// ---- say a word of a pair, then hear the voice and yourself back to back ----

const sameWord = (a, b) => a.localeCompare(b, 'de', { sensitivity: 'accent' }) === 0   // schön ≠ schon, Schön = schön
const canRecognise = () => !!SpeechRec && !navigator.brave   // Brave has the API but it never hears anything
function SoundSayWord({ word, other }) {
  const r = useRecorder()
  const audio = useRef()
  const timer = useRef()
  const rec = async () => {
    if (r.state === 'rec') { clearTimeout(timer.current); r.stop(); return }
    if (await r.start()) timer.current = setTimeout(r.stop, 2800)
  }
  useEffect(() => () => clearTimeout(timer.current), [])
  const compare = () => speakLines([['A', word]], { onEnd: () => audio.current?.play() })
  const heard = r.heard.match(/[\p{L}ß]+/gu) ?? []
  const verdict = !heard.length ? null : heard.some(h => sameWord(h, word)) ? 'ok' : heard.some(h => sameWord(h, other)) ? 'other' : 'unclear'
  return html`<div class="snd-rec">
    <div class="snd-rec-row">
      <button type="button" class="snd-mini" onClick=${() => speak(word)}><${Speaker} /> Hear it</button>
      <button type="button" class=${`snd-mic${r.state === 'rec' ? ' on' : ''}`} onClick=${rec} disabled=${!canRecord()}
        aria-label=${r.state === 'rec' ? 'Stop recording' : `Record yourself saying ${word}`}>
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">${r.state === 'rec' ? html`<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />`
          : html`<rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" /><path d="M6 11a6 6 0 0 0 12 0M12 17v4M8.5 21h7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />`}</svg>
        <span>${r.state === 'rec' ? 'Stop' : r.url ? 'Record again' : 'Record yourself'}</span></button>
      <button type="button" class="snd-mini" onClick=${compare} disabled=${!r.url}>Voice, then you</button>
    </div>
    ${r.url ? html`<audio ref=${audio} src=${r.url} controls class="snd-audio"></audio>` : ''}
    ${verdict ? html`<p class=${`snd-verdict ${verdict}`}>The browser heard <b lang="de">${r.heard.trim()}</b>.
      ${verdict === 'ok' ? ' Clear: that is the word you meant.' : verdict === 'other' ? html` That is the other word of the pair: watch the mouth drawing and try again.` : ' Not quite either word: try again, a little slower.'}</p>`
      : r.url && r.state !== 'rec' ? html`<p class="quiet snd-hint">${canRecognise() ? 'Nothing was written down this time: speak a little louder and closer.'
        : "This browser doesn't write down what it hears (Edge and Chrome do), so listen to both and judge yourself."}</p>` : ''}
    ${r.error ? html`<p class="snd-verdict other" role="alert">${r.error}</p>` : ''}
  </div>`
}

function SoundSay({ s }) {
  const [k, setK] = useState(0)
  const [side, setSide] = useState(0)
  const p = s.pairs[k]
  const go = d => { setK((k + d + s.pairs.length) % s.pairs.length); setSide(0) }
  return html`<section class="snd-drill snd-say" aria-labelledby="snd-say-h">
    <header><h2 id="snd-say-h">Say it yourself</h2><span class="snd-score">Pair <b>${k + 1}</b> of ${s.pairs.length}</span></header>
    <div class="snd-pick">
      <button type="button" class="snd-mini" onClick=${() => go(-1)} aria-label="Previous pair">←</button>
      <div class="snd-pair" role="radiogroup" aria-label="The word to say">${[0, 1].map(j => html`<button type="button" role="radio" aria-checked=${side === j}
        class=${side === j ? 'on' : ''} onClick=${() => setSide(j)}><b lang="de">${p[j]}</b><small>${p[j + 2]}</small></button>`)}</div>
      <button type="button" class="snd-mini" onClick=${() => go(1)} aria-label="Next pair">→</button>
    </div>
    ${canRecord() ? '' : html`<p class="snd-verdict other">This browser can't record here. Hear the word and say it aloud anyway: saying it is what counts.</p>`}
    <${SoundSayWord} key=${`${s.id}-${k}-${side}`} word=${p[side]} other=${p[1 - side]} />
    <p class="quiet snd-hint">Your recording stays in this browser; nothing is sent anywhere.</p>
  </section>`
}

// ---- the page: the twelve sounds as stops on a line ----

function SoundsPage({ data, arg }) {
  useStore()
  const sounds = data.sounds ?? []
  const s = sounds.find(x => x.id === arg) ?? sounds[0]
  useEffect(() => () => stopSpeech(), [])
  if (!s) return html`<main class="sounds"><header class="masthead"><h1>Pronunciation</h1><p>The sound guide is being written now.</p></header></main>`
  const mark = SOUND_MARK[s.id]
  return html`<main class="sounds">
    <header class="masthead"><h1>Pronunciation</h1><p>The sounds English speakers find hardest. Watch what the mouth does, hear the words, then test your ear and your voice.</p></header>
    <nav class="snd-line" aria-label="Sounds"><ol>${sounds.map(x => {
      const best = S.practice[`sound:${x.id}`]
      return html`<li class=${x === s ? 'on' : best !== undefined ? 'tried' : ''}><a href=${`#/sounds/${x.id}`} aria-current=${x === s ? 'page' : null} title=${x.title}>
        <b lang="de">${SOUND_CHIP[x.id] ?? x.sound}</b><small lang="de">${x.examples[0][0]}</small>${best !== undefined ? html`<span class="pbar"><i style=${`--p:${best}`}></i></span>` : ''}</a></li>`
    })}</ol></nav>
    <div class="snd-main" key=${s.id}>
      <${SoundDiagram} s=${s} />
      <section class="snd-info" aria-labelledby="snd-h">
        <p class="snd-ipa"><span class="lb">${sounds.indexOf(s) + 1} of ${sounds.length}</span> <span>${s.ipa}</span></p>
        <h2 id="snd-h">${s.title}</h2>
        <p class="snd-how">${s.how}</p>
        <p class="snd-en"><b>For English speakers</b>${s.en_compare}</p>
        <h3>Hear the words</h3>
        <ul class="snd-words">${s.examples.map(([w, en]) => html`<li><button type="button" onClick=${() => speak(w)} aria-label=${`Play ${w}`}>
          <${Speaker} /><b><${SoundWord} w=${w} mark=${mark} /></b><small>${en}</small></button></li>`)}</ul>
      </section>
    </div>
    <div class="snd-drills" key=${`d-${s.id}`}>
      <${SoundPairs} s=${s} />
      <${SoundSay} s=${s} />
    </div>
  </main>`
}
PAGES.sounds = SoundsPage
