// ---- reading: the station's texts in the Goethe Lesen formats ----

const sentences = t => t.blocks.flatMap(b => b.s.map((p, k) => ({ id: `${b.id}.${k}`, de: p[0], en: p[1] })))
const textWords = t => sentences(t).reduce((a, s) => a + s.de.split(/\s+/).length, 0)
const TEXT_TYPE = { sms: 'Text messages', email: 'Email', postcard: 'Postcard', ad: 'Small ads', ads: 'Small ads', web: 'Web pages',
  sign: 'Signs', notice: 'Notices', article: 'Newspaper article', directory: 'Directory board', blog: 'Blog post',
  comments: 'Reader comments', rules: 'House rules', terms: 'Terms and conditions', instructions: 'Instructions' }

// ---- known words in a text (L11) ----
// Forms the rules in wordForms miss: articles, contractions, irregular verbs, pronoun cases, comparatives, Konjunktiv II.
const tokens = s => s.match(/\p{L}+(?:-\p{L}+)*/gu) ?? []
const MORE_FORMS = {
  der: 'die den dem des denen dessen deren', jeder: 'jede jeden jedem jedes', welcher: 'welche welchen welchem welches',
  dieser: 'diese diesen diesem dieses', wer: 'wen wem wessen', in: 'im ins', an: 'am ans', zu: 'zum zur', von: 'vom', bei: 'beim',
  für: 'fürs', sein: 'bin bist sind seid wäre wären wärst seine seinen seinem seiner seines', haben: 'habe hast habt hätte hätten hättest',
  werden: 'werde wirst werdet würde würden würdest würdet', können: 'kannst könnte könntest könnten könntet', müssen: 'musst',
  dürfen: 'darfst', wollen: 'willst', mögen: 'magst', wissen: 'weißt', er: 'ihm', sie: 'ihnen', gut: 'besser best',
  viel: 'mehr meist', gern: 'lieber liebsten', groß: 'größer größt', alt: 'älter ältest', jung: 'jünger jüngst', lang: 'länger längst',
  kurz: 'kürzer', warm: 'wärmer', kalt: 'kälter', hoch: 'höher hoh', nah: 'näher nächst', teuer: 'teurer teuerst',
}
// Place names the English spells differently (Köln → Cologne) are names, like the ones spelled the same.
const PLACES = new Set(['köln', 'münchen', 'wien', 'prag', 'rom', 'zürich', 'genf', 'brüssel', 'warschau', 'moskau', 'lissabon',
  'mailand', 'venedig', 'neapel', 'florenz', 'athen', 'kopenhagen', 'nürnberg', 'hannover', 'braunschweig'])
export function buildForms(words) {   // lower-case form → course word, the earliest station's first
  const ix = new Map()
  for (const w of words) {
    const more = MORE_FORMS[w.w]?.split(' ') ?? []
    const forms = [...wordForms(w), ...more, ...(w.p === 'adj' ? more.flatMap(f => ['e', 'en', 'er', 'es', 'em'].map(e => f + e)) : []),
      ...(w.p === 'v' ? [w.w.replace(/^sich /, '').replace(/e?n$/, '')] : []),            // the stem: imperatives (Komm! Ruf an!)
      ...(w.p !== 'n' && w.p !== 'v' && /e$/.test(w.w) ? ['m', 'n', 'r', 's'].map(e => w.w + e) : []),   // alle → alles, allem
      ...(w.a === 'der' ? ['in', 'innen'].map(e => w.w.replace(/e$/, '') + e) : [])]     // Freund → Freundin, Kollege → Kollegin
    for (const f of forms) if (f.length > 1 && !ix.has(f.toLowerCase())) ix.set(f.toLowerCase(), w)
  }
  return ix
}
let formIndex = null
const courseForms = () => formIndex || (formIndex = buildForms(D.words))
// A word the course doesn't teach counts as known when it splits fully into known course words: hyphen parts
// (Zahnarzt-Notdienst), or two or three parts of 3+ letters with an optional linking s/n/en/e (Kinder|zimmer,
// Öffnung|s|zeiten, Freitag|abend). known(part) decides for each part.
const linkless = h => [h, h.endsWith('s') && h.slice(0, -1), h.endsWith('en') && h.slice(0, -2), h.endsWith('n') && h.slice(0, -1),
  h + 'e', h.endsWith('e') && h.slice(0, -1)].filter(x => x && x.length >= 3)
function compoundKnown(t, known, depth = 0) {
  if (t.includes('-')) return t.split('-').every(p => p && (known(p) || PLACES.has(p) || compoundKnown(p, known, depth + 1)))
  if (depth > 2) return false
  for (let i = 3; i <= t.length - 3; i++) {
    const tail = t.slice(i)
    if ((known(tail) || (depth < 2 && compoundKnown(tail, known, depth + 1))) && linkless(t.slice(0, i)).some(known)) return true
  }
  return false
}
// The share of a text's words the learner knows; isKnown(word) decides. Names, numbers and addresses (no course word, and
// the same in the English, or a place name) don't count. Glossed words count only if the learner knows them.
export function knownShare(t, isKnown, ix = courseForms()) {
  const known = f => { const w = ix.get(f); return !!w && isKnown(w) }
  let all = 0, yes = 0
  const unknown = new Map()   // lower-case token → its course word, or null if the course doesn't teach it
  for (const b of t.blocks) for (const [de, en] of b.s) {
    const same = new Set(tokens(en))
    for (const tok of tokens(de)) {
      const low = tok.toLowerCase(), w = ix.get(low)
      if (!w && (same.has(tok) || PLACES.has(low))) continue
      all++
      if (w ? isKnown(w) : compoundKnown(low, known)) yes++
      else unknown.set(low, w ?? null)
    }
  }
  return { share: all ? yes / all : 1, unknown }
}
// ---- end of known words ----

// A part's progress on the station: the mean best score over the station's texts (or recordings).
const saveBest = (key, id, n, list, p) => commit(x => {
  x.practice[`${key}:${id}`] = Math.max(x.practice[`${key}:${id}`] ?? 0, p)
  x.practice[`${n}/${key === 'r' ? 'read' : 'listen'}`] = list.reduce((a, y) => a + (x.practice[`${key}:${y.id}`] ?? 0), 0) / list.length
})

// One question in an exam format: richtig/falsch, ja/nein, a/b/c or a letter from the texts (x: none fits).
function ExamQuestion({ q, k, pick, onPick, done, onShow, where = 'text' }) {
  const right = done && pick === q.a
  const letter = j => (q.format === 'abc' ? 'abc'[j] : null)
  return html`<li class=${`eq${done ? (right ? ' right' : ' wrong') : ''}`}>
    <p class="eq-q"><span class="eq-n">${k + 1}</span><span lang="de">${q.q}</span></p>
    <div class=${`eq-opts ${q.format}`}>${q.opts.map((o, j) => html`<button type="button" lang="de" disabled=${done} aria-pressed=${pick === j}
      class=${`${pick === j ? 'on' : ''}${done && j === q.a ? ' answer' : ''}`} onClick=${() => onPick(j)}>
      ${letter(j) ? html`<b class="eq-l">${letter(j)}</b>` : ''}${q.format === 'match' && o === 'x' ? html`x <small>none fits</small>` : o}</button>`)}</div>
    ${done ? html`<p class="eq-why">${right ? html`<b>Right.</b> ` : html`<b>The answer is ${letter(q.a) ? `${letter(q.a)}: ` : ''}<span lang="de">${q.opts[q.a]}</span>${/[.!?…]$/.test(q.opts[q.a]) ? '' : '.'}</b> `}${q.why}
      ${q.ev?.length ? html` <button type="button" class="linkish" onClick=${() => onShow(q.ev)}>Show it in the ${where}</button>` : ''}</p>` : ''}
  </li>`
}

// Messages (texts, emails, postcards): a greeting that follows a message body starts the next message.
const MESSAGE = { sms: 'SMS', email: 'E-Mail', postcard: 'Postkarte' }
function messages(blocks) {
  const out = []
  blocks.forEach((b, k) => {
    if (!out.length || (b.t === 'h' && blocks[k + 1] && blocks[k + 1].t !== 'h' && out[out.length - 1].some(x => x.t !== 'h'))) out.push([])
    out[out.length - 1].push(b)
  })
  return out
}
const Stamp = () => html`<svg class="pc-stamp" viewBox="0 0 44 52" aria-hidden="true"><rect x="2" y="2" width="40" height="48" rx="2" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="3 2" />
  <circle cx="22" cy="20" r="8" fill="var(--line)" /><path d="M8 42 L18 30 L25 37 L30 32 L37 42 Z" fill="currentColor" opacity=".5" /></svg>`
const Envelope = () => html`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="2.5" y="5" width="19" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
  <path d="M3 6l9 7 9-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /></svg>`
const Phone = () => html`<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><rect x="6" y="2" width="12" height="20" rx="3" fill="none" stroke="currentColor" stroke-width="2" />
  <path d="M10 18.5h4" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>`

// The reader. Help (tap a sentence for English, the glossary, known words) is off in exam mode (tests).
function Reader({ t, exam, onDone, onNext }) {
  useStore()
  const [guess, setGuess] = useState(exam || S.practice[`r:${t.id}`] !== undefined ? -1 : null)   // L12: predict first
  const [open, setOpen] = useState(new Set())
  const [gloss, setGloss] = useState(null)
  const [picks, setPicks] = useState({})
  const [done, setDone] = useState(false)
  const [lit, setLit] = useState(new Set())
  const [speakingAt, setSpeakingAt] = useState(null)
  const [marks, setMarks] = useState(false)
  const [time, setTime] = useState({ start: null, first: null, againStart: null, again: null })
  const [, tick] = useState(0)
  const ref = useRef()
  useEffect(() => () => stopSpeech(), [])
  useEffect(() => { if (guess !== null) setTime(x => ({ ...x, start: x.start ?? Date.now() })) }, [guess])
  useEffect(() => {   // the clock of the timed re-read
    if (!time.againStart || time.again) return
    const id = setInterval(() => tick(k => k + 1), 1000)
    return () => clearInterval(id)
  }, [time.againStart, time.again])
  const words = textWords(t)
  const wpm = ms => Math.round(words / (Math.max(ms, 1000) / 60000))
  const FAST = 400   // ponytail: above this it was skimmed, not read; a learner reads about 100–250 words a minute
  const qs = t.questions ?? []   // tests pass the text alone and ask the questions themselves
  const all = qs.every((_, k) => picks[k] !== undefined)
  const score = qs.filter((q, k) => picks[k] === q.a).length
  const pick = (k, j) => {
    if (time.first === null) setTime(x => ({ ...x, first: Date.now() - x.start }))   // reading time: up to the first answer
    setPicks(p => ({ ...p, [k]: j }))
  }
  const check = () => {
    setDone(true)
    if (!exam) saveBest('r', t.id, t.n, D.readingBy[t.n], score / qs.length)
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
  const againGo = () => { setTime(x => ({ ...x, againStart: Date.now(), again: null })); ref.current?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' }) }
  const knows = exam ? null : knownShare(t, w => known(w.id))
  const target = exam ? null : knownShare(t, w => w.n <= t.n).share   // once this station's words are learned
  const glossRe = gloss && new RegExp(`(?<!\\p{L})(${esc(gloss)}\\p{L}*)`, 'giu')

  // One sentence: tap it for the English. Shows glossary and not-yet-learned marks.
  const sentence = (x, cls = '') => {
    const body = (glossRe ? x.de.split(glossRe) : [x.de]).map((p, k) => (k % 2 ? html`<mark class="gl">${p}</mark>`
      : marks ? p.split(/(\p{L}+(?:-\p{L}+)*)/u).map((w, j) => (j % 2 && knows.unknown.has(w.toLowerCase()) ? html`<u class=${knows.unknown.get(w.toLowerCase()) ? 'unk' : 'unk new'}>${w}</u>` : w)) : p))
    const toggle = () => setOpen(o => { const n = new Set(o); n.has(x.id) ? n.delete(x.id) : n.add(x.id); return n })
    return html`<span class=${`sent${cls}${lit.has(x.id) ? ' lit' : ''}${speakingAt === x.id ? ' now' : ''}${open.has(x.id) ? ' open' : ''}`}
      onClick=${exam ? null : toggle}><span lang="de">${body}</span>${open.has(x.id) ? html`<small class="sent-en">${x.en}</small>` : ''} </span>`
  }
  const ss = b => b.s.map((p, k) => ({ id: `${b.id}.${k}`, de: p[0], en: p[1] }))
  const block = (b, msg) => {
    const xs = ss(b)
    if (b.t === 'h') return msg ? html`<p class="rb-greet">${xs.map(x => sentence(x))}</p>` : html`<h3 class="rb-h">${xs.map(x => sentence(x))}</h3>`
    if (b.t === 'list') return html`<ul class="rb-list">${xs.map(x => {
      const at = x.de.indexOf(': ')   // a directory row: "4. Stock: Tische und Stühle"
      return html`<li>${at > 0 && at < 16 ? html`<b class="rb-floor" lang="de">${x.de.slice(0, at)}</b>${sentence({ ...x, de: x.de.slice(at + 2) })}` : sentence(x)}</li>`
    })}</ul>`
    if (b.t === 'ad' || b.t === 'sign' || b.t === 'comment') {
      return html`<div class=${`rb-${b.t}`}>${b.t === 'comment' ? html`<p class="rb-who"><span class="rb-av" aria-hidden="true">${b.label?.[0]}</span><span lang="de">${b.label}</span></p>`
        : b.label ? html`<span class="rb-label">${b.label}</span>` : ''}<p>${xs.map(x => sentence(x))}</p></div>`
    }
    // a message body: a closing without a full stop ("Viele Grüße, Lena") goes on its own line
    return html`<p class="rb-p">${xs.map((x, k) => sentence(x, msg && k === xs.length - 1 && k && !/[.!?…:“"]$/.test(x.de.trim()) ? ' rb-close' : ''))}</p>`
  }
  // consecutive ads, signs or comments sit together in a grid
  const body = () => {
    if (MESSAGE[t.type]) {
      return messages(t.blocks).map((m, k) => html`<div class=${`msg msg-${t.type}${k % 2 ? ' alt' : ''}`}>
        <p class="msg-head">${t.type === 'sms' ? html`<${Phone} />` : t.type === 'email' ? html`<${Envelope} />` : ''}<span lang="de">${MESSAGE[t.type]}</span></p>
        ${t.type === 'postcard' ? html`<${Stamp} />` : ''}${m.map(b => block(b, true))}</div>`)
    }
    const out = []
    for (const b of t.blocks) {
      const last = out[out.length - 1]
      if (['ad', 'sign', 'comment'].includes(b.t)) {
        if (last?.kind === b.t) last.items.push(b)
        else out.push({ kind: b.t, items: [b] })
      } else out.push({ kind: null, items: [b] })
    }
    return out.map(g => (g.kind ? html`<div class=${`rb-group rg-${g.kind}`}>${g.items.map(b => block(b))}</div>` : block(g.items[0])))
  }

  const predict = guess === null || guess >= 0 ? html`<section class=${`predict${guess === null ? '' : ' done'}`} aria-label="Predict first">
    <div class="predict-q">
      <span class="lb">Before you read</span>
      <p>${guess === null ? html`<b lang="de">${t.title}</b> · ${TEXT_TYPE[t.type] ?? t.type}. ` : ''}${t.predict.q}</p>
    </div>
    <div class="guess-opts">${t.predict.opts.map((o, j) => html`<button type="button" disabled=${guess !== null} onClick=${() => setGuess(j)}
      class=${guess === null ? '' : j === t.predict.a ? 'right' : j === guess ? 'wrong' : 'dim'}>${o}</button>`)}</div>
    ${guess === null ? html`<p class="quiet">Guess first: a guess, even a wrong one, gets your mind ready for the text.</p>`
      : html`<p class="predict-after"><b>${guess === t.predict.a ? 'Your guess was right.' : 'Not this time.'}</b> Read on and see.</p>`}
  </section>` : ''
  if (guess === null) return predict

  const p = done ? score / qs.length : 0
  const timing = time.againStart && !time.again
  return html`<div class=${`read-wrap${exam ? ' exam' : ''}`}>${predict}<div class=${`reader${exam ? ' exam' : ''}${qs.length ? '' : ' solo'}${timing ? ' timed' : ''}`} ref=${ref}>
    <article class="r-text">
      <header class="r-head">
        <span class="lb">Lesen ${t.part}</span><span class="r-type">${TEXT_TYPE[t.type] ?? t.type} · ${words} words</span>
        ${timing ? html`<span class="r-clock" role="timer">${mmss((Date.now() - time.againStart) / 1000)}</span>
          <button type="button" class="btn" onClick=${() => setTime(x => ({ ...x, again: Date.now() - x.againStart }))}>Done reading</button>` : ''}
        ${exam ? '' : html`<button type="button" class=${`r-aloud${speakingAt !== null ? ' on' : ''}`} onClick=${readAloud}><${Speaker} /> ${speakingAt !== null ? 'Stop' : 'Read it to me'}</button>`}
      </header>
      ${t.intro ? html`<p class="r-intro">${t.intro}</p>` : ''}
      <div class=${`r-body t-${t.type}`}>${body()}</div>
      ${exam ? '' : html`<footer class="r-help">
        <div class="r-known">
          <span class="kmeter" style=${`--k:${knows.share};--t:${target}`} aria-hidden="true"><i></i><b></b></span>
          <p><b>You know ${pct(knows.share)} of the words here.</b> ${target > knows.share + .005 ? html`With this station's words learned: ${pct(target)}.` : ''}
          ${knows.unknown.size ? html` <button type="button" class="linkish" onClick=${() => setMarks(m => !m)}>${marks ? 'Hide the marks' : `Mark the ${plural(knows.unknown.size, 'word')} not learned yet`}</button>` : ''}</p>
        </div>
        ${t.glossary?.length ? html`<div class="r-gloss"><b>Glossary</b>${t.glossary.map(g => html`<button type="button" class=${gloss === g.w ? 'on' : ''} aria-pressed=${gloss === g.w}
          onClick=${() => setGloss(gloss === g.w ? null : g.w)}><span lang="de">${g.w}</span> <small>${g.en}</small></button>`)}</div>` : ''}
        <p class="quiet r-tip">Tap a sentence to see it in English.</p>
      </footer>`}
    </article>
    ${qs.length ? html`<section class="r-qs" aria-label="Questions">
      <h3>${plural(qs.length, 'question')}</h3>
      <ol class="eqs">${qs.map((q, k) => html`<${ExamQuestion} q=${q} k=${k} pick=${picks[k]} done=${done} onShow=${show} onPick=${j => pick(k, j)} />`)}</ol>
      ${!done ? html`<button type="button" class="btn" disabled=${!all} onClick=${check}>${all ? 'Check my answers' : `Answer all ${qs.length} questions`}</button>`
        : html`<div class="r-result">
          <span class=${`stamp ${p >= .6 ? 'pass' : 'fail'}`}>${p >= .6 ? 'Bestanden' : 'Noch nicht'}</span>
          <p><b>${score} of ${qs.length}</b> right.${!exam && time.first && wpm(time.first) <= FAST ? ` You read at about ${wpm(time.first)} words per minute.` : ''}</p>
          ${exam ? '' : html`<div class="r-again">${timing ? html`<p class="quiet">Reading against the clock: press Done reading at the top when you reach the end.</p>`
              : time.again ? html`<p>${wpm(time.again) > FAST ? 'That was very fast. Read every word, then press Done reading.'
                : html`Second read: <b>${wpm(time.again)} words per minute</b>${wpm(time.first) <= FAST ? ` (first: ${wpm(time.first)})` : ''}. ${wpm(time.again) > wpm(time.first) ? 'Faster: that is fluency growing.' : 'Read it once more tomorrow: it gets faster.'}`}</p>`
              : html`<button type="button" onClick=${againGo}>Read it again against the clock</button>`}
            ${onNext ? html`<button type="button" class="btn" onClick=${onNext}>Next text <${Arrow} /></button>` : ''}</div>`}
        </div>`}
    </section>` : ''}
  </div></div>`
}

// Tiles to pick one of the station's texts or recordings: its exam part, a title and the best score so far.
function Picks({ items, i, setI, label, part, title, sub, keyOf }) {
  return html`<div class="text-picks" role="tablist" aria-label=${label}>${items.map((x, k) => {
    const best = S.practice[`${keyOf}:${x.id}`]
    return html`<button type="button" role="tab" aria-selected=${k === i} class=${k === i ? 'on' : ''} onClick=${() => { stopSpeech(); setI(k) }}>
      <span class="tp-top"><span class="lb">${part} ${x.part}</span>${best !== undefined ? html`<span class=${`tp-best${best >= .6 ? ' pass' : ''}`}>best ${pct(best)}</span>` : ''}</span>
      <b>${title(x)}</b><small>${sub(x)}</small></button>`
  })}</div>`
}

function ReadTab({ data, n }) {
  useStore()
  const ts = data.readingBy[n] ?? []
  const [i, setI] = useState(0)
  if (!ts.length) return html`<p class="soon">This station's reading texts are being written now: Goethe Lesen formats, with tap-to-translate.</p>`
  const k = Math.min(i, ts.length - 1), t = ts[k]
  const next = k + 1 < ts.length ? () => { setI(k + 1); scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' }) } : null
  return html`<div class="read-tab">
    <${Picks} items=${ts} i=${k} setI=${setI} label="Texts" part="Lesen" keyOf="r" title=${x => html`<span lang="de">${x.title}</span>`}
      sub=${x => `${TEXT_TYPE[x.type] ?? x.type} · ${plural(x.questions.length, 'question')}`} />
    <${Reader} key=${t.id} t=${t} onNext=${next} />
  </div>`
}
TAB_VIEWS.read = ReadTab
