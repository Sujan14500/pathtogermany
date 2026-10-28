// ---- picture scenes: drawn scenes where every labelled thing is a word (data/src/scenes-*.json) ----

// A scene is a 1000 × 620 picture: sky colour, background markup (back) and objects. An object's svg is drawn in its
// own coordinates and placed at `at`; w + a name its course word (no w: scenery). tag is its name board's bottom
// centre and pin a point on the thing that a leader line runs to, both in the object's coordinates. Movers:
// mv [from, to, seconds, delay] with move drive or pass (sideways) or fall (down). only: sun, rain or snow, the
// weather it shows in (every object, labelled or not). Small motion inside an svg comes from classes (wave, sway, wag,
// spin, bounce, blink, flash, steam, swim, drip, flutter, flow), styled in 70-pictures.css.
const SCENE_W = 1000, SCENE_H = 620
const boardText = o => `${o.a ? ART[o.a] : ''} ${o.w}`.trim()
// a name board's box in picture coordinates; letters × 11 + 22 is the validator's estimate (scripts/check_content.py)
function boardBox(o, [dx, dy] = [0, 0]) {
  const wd = boardText(o).length * 11 + 22, x = o.at[0] + o.tag[0] + dx, y = o.at[1] + o.tag[1] + dy
  return [x - wd / 2, y - 30, x + wd / 2, y]
}
const boxesMeet = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]
const sameWeather = (a, b) => !a.only || !b.only || a.only === b.only

// Where a mover waits when nothing moves (reduced motion, thumbnails, flashcards): where its loop starts, slid into
// the picture and, in 40 px steps, clear of the boards already placed. Parts with the same path (a train and its
// carriage) wait together.
function placeMovers(objs) {
  const placed = objs.filter(o => o.w && !o.mv).map(o => [o, boardBox(o)])
  const groups = {}
  for (const o of objs) if (o.mv) (groups[`${o.mv}|${o.move}|${o.at}`] ??= []).push(o)
  for (const g of Object.values(groups)) {
    const [from, to, dur, delay = 0] = g[0].mv
    const p = ((-delay % dur) + dur) % dur / dur
    const down = g[0].move === 'fall'
    const off = d => (down ? [0, d] : [d, 0])
    let lo = Math.min(from, to), hi = Math.max(from, to)
    for (const o of g.filter(x => x.w)) {   // keep the boards inside the picture
      const b = boardBox(o)
      lo = Math.max(lo, down ? 4 - b[1] : 4 - b[0]); hi = Math.min(hi, down ? SCENE_H - 4 - b[3] : SCENE_W - 4 - b[2])
    }
    const clamp = d => Math.min(Math.max(d, lo), Math.max(lo, hi))
    const start = clamp(from + (to - from) * (g[0].move === 'pass' ? Math.min(p / .45, 1) : p))
    let rest = start
    for (let k = 0; k < 40; k++) {
      const d = clamp(start + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 40)
      if (g.every(o => !o.w || !placed.some(([x, b]) => sameWeather(o, x) && boxesMeet(boardBox(o, off(d)), b)))) { rest = d; break }
    }
    for (const o of g) { o.rest = off(rest); if (o.w) placed.push([o, boardBox(o, o.rest)]) }
  }
}

// The scenes, prepared once: each labelled object with its course word, the level of its first station, the weathers
// it can show; pictureOf: word id → the scene and object that draw it (a scene of the word's own station first).
let SCN = null
function scenes() {
  if (SCN?.src === D.scenes) return SCN
  const byKey = {}
  for (const w of D.words) byKey[`${w.a ?? ''}|${w.w}`] ??= w
  const list = D.scenes.map(sc => {
    const objs = sc.objs.map((o, i) => ({ ...o, i, at: o.at ?? [0, 0], tag: o.tag ?? [0, 0],
      word: !o.w ? null : byKey[`${o.a ?? ''}|${o.w}`] ?? { id: `${sc.id}/${i}`, w: o.w, a: o.a || undefined, p: o.a ? 'n' : 'other', en: '', missing: true } }))
    placeMovers(objs)
    const n = Math.min(...sc.stations)
    return { ...sc, objs, live: objs.filter(o => o.word), n, level: D.stations[n]?.level ?? 'A1',
      weathers: ['sun', 'rain', 'snow'].filter(x => objs.some(o => o.only === x)) }
  }).sort((a, b) => a.n - b.n)
  const pictureOf = {}
  for (const sc of list) for (const o of sc.live) {
    const had = pictureOf[o.word.id]
    if (!had || (!had.sc.stations.includes(o.word.n) && sc.stations.includes(o.word.n))) pictureOf[o.word.id] = { sc, o }
  }
  SCN = { src: D.scenes, list, byId: Object.fromEntries(list.map(s => [s.id, s])), pictureOf }
  return SCN
}
const scenesFor = n => scenes().list.filter(sc => sc.stations.includes(n))

// Name board: the word with its article in the gender colour, its bottom centre at tag. Drawn at the validator's
// width first; SceneArt then fits it to the real text. The leader line starts under the board's middle.
function Tag({ o }) {
  const [x, y] = o.tag, wd = boardText(o).length * 11 + 22
  return html`<g class=${`sc-tag g-${o.a || 'x'}`}>
    ${o.pin ? html`<path class="sc-lead" d=${`M${x} ${y - 15} L${o.pin[0]} ${o.pin[1]}`} /><circle class="sc-pin" cx=${o.pin[0]} cy=${o.pin[1]} r="4" />` : ''}
    <rect x=${x - wd / 2} y=${y - 30} width=${wd} height="30" rx="6" />
    <text x=${x} y=${y - 9} lang="de">${o.a ? html`<tspan class="art">${ART[o.a]} </tspan>` : ''}${o.w}</text>
  </g>`
}

// The picture. Every board is drawn from the start in a top layer and only shown or hidden, so a moving thing's board
// keeps step with it; pointing at a moving thing holds it and its board still (hold). frozen: nothing moves and
// movers wait at their rest place (also under reduced motion). ring: the object to circle (a question's target).
function SceneArt({ sc, cls = () => '', tagOn = () => false, onTap, onHover, frozen, weather = sc.weathers[0], ring, held, viewBox }) {
  const [hold, setHold] = useState(null)
  const ref = useRef()
  const still = frozen || reducedMotion()
  useLayoutEffect(() => {
    const fit = () => ref.current?.querySelectorAll('.sc-tag').forEach(g => {
      const t = g.querySelector('text'), r = g.querySelector('rect'), len = t.getComputedTextLength()
      if (len) { r.setAttribute('width', len + 24); r.setAttribute('x', +t.getAttribute('x') - (len + 24) / 2) }
    })
    fit()
    document.fonts?.ready.then(fit)
  }, [sc])
  useLayoutEffect(() => {   // the ring sits inside the target's own mover, so it travels with it
    const r = ref.current?.querySelector('.sc-ring'), look = r?.previousElementSibling
    if (!look) return
    const b = look.getBBox()
    Object.entries({ x: b.x - 8, y: b.y - 8, width: b.width + 16, height: b.height + 16 }).forEach(([k, v]) => r.setAttribute(k, v))
  })
  const off = o => o.only && o.only !== weather
  const place = o => `translate(${o.at[0]} ${o.at[1]})`
  const mover = (o, body) => {
    if (!o.mv) return body
    if (still) return html`<g transform=${`translate(${o.rest[0]} ${o.rest[1]})`}>${body}</g>`
    const [from, to, dur, delay = 0] = o.mv
    return html`<g class=${`sc-move ${o.move}`}
      style=${`--from:${from}px;--to:${to}px;--dur:${dur}s;--delay:${delay}s;--turn:${to < from ? 'reverse' : 'normal'}`}>${body}</g>`
  }
  const act = o => (onTap && o.word && !off(o) ? {
    onClick: () => onTap(o),
    onPointerEnter: () => { setHold(o.i); onHover?.(o) }, onPointerLeave: () => { setHold(null); onHover?.(null) },
    onFocus: () => { setHold(o.i); onHover?.(o) }, onBlur: () => { setHold(null); onHover?.(null) },
    onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(o) } },
  } : {})
  // A click that hits no labelled thing goes to the smallest one whose box holds it: thin things (rain, wind) count
  // when clicked between their strokes.
  const near = e => {
    if (!onTap || e.target.closest('.live, .sc-tags.on')) return
    const hit = sc.live.filter(o => !off(o)).map(o => [o, ref.current.querySelector(`.sc-obj[data-i="${o.i}"] .sc-look`)?.getBoundingClientRect()])
      .filter(([, r]) => r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)
      .sort((a, b) => a[1].width * a[1].height - b[1].width * b[1].height)[0]
    if (hit) onTap(hit[0])
  }
  return html`<svg ref=${ref} class=${`scene-art${still ? ' frozen' : ''}`} viewBox=${viewBox ?? `0 0 ${SCENE_W} ${SCENE_H}`}
      data-scene=${sc.id} role=${onTap ? 'group' : 'img'} aria-label=${`${sc.en}: picture`} onClick=${near}>
    <rect width=${SCENE_W} height=${SCENE_H} fill=${sc.sky} />
    <g dangerouslySetInnerHTML=${{ __html: sc.back }} />
    ${sc.objs.map(o => {
      const live = onTap && o.word && !off(o)
      return html`<g key=${o.i} class=${`sc-obj${live ? ' live' : ''}${hold === o.i || held === o.i ? ' hold' : ''}${off(o) ? ' off' : ''} ${o.word ? cls(o) : ''}`}
          transform=${place(o)} data-i=${o.i} data-only=${o.only}
          ...${live ? { tabindex: 0, role: 'button', 'aria-label': boardText(o) } : {}} ...${act(o)}>
        ${mover(o, html`<g class="sc-look" dangerouslySetInnerHTML=${{ __html: o.svg }} />${ring === o.i ? html`<rect class="sc-ring" rx="10" />` : ''}`)}
      </g>`
    })}
    <rect class="sc-night" width=${SCENE_W} height=${SCENE_H} />
    ${sc.live.map(o => html`<g key=${o.i} class=${`sc-tags${tagOn(o) && !off(o) ? ' on' : ''}${hold === o.i || held === o.i ? ' hold' : ''}${off(o) ? ' off' : ''}${o.mv ? ' mv' : ''}`}
        transform=${place(o)} data-i=${o.i} data-only=${o.only} data-missing=${o.word.missing ? '' : null} aria-hidden="true" ...${act(o)}>
      ${mover(o, html`<${Tag} o=${o} />`)}
    </g>`)}
  </svg>`
}

const WEATHER = {
  sun: ['Sun', html`<circle cx="12" cy="12" r="4.5" fill="currentColor" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" />`],
  rain: ['Rain', html`<path d="M6.5 14a4.5 4.5 0 0 1 .6-9 5.5 5.5 0 0 1 10.4 1.6A3.7 3.7 0 0 1 17.5 14z" fill="currentColor" /><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />`],
  snow: ['Snow', html`<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9.5 3.5 12 6l2.5-2.5M9.5 20.5 12 18l2.5 2.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" />`],
}
const askLine = w => (w.p === 'n' ? `${w.a === 'pl' ? 'Wo sind' : 'Wo ist'} ${said(w)}?` : said(w))
function nameOptions(o, sc) {
  const w = o.word, opts = new Set([said(w)])
  if (w.a && w.a !== 'pl') opts.add(`${shuffle(['der', 'die', 'das'].filter(a => a !== w.a))[0]} ${w.w}`)   // the gender is part of the word
  for (const x of shuffle(sc.live)) if (opts.size < 4) opts.add(said(x.word))
  return shuffle([...opts])
}

// One scene with its three ways in. Explore: point at a thing to see its name, linger or click to hear it. Find: hear
// "Wo ist der Bus?" and click it. Name: a thing is circled; type (or choose) its name with der, die or das.
// focus (a station's word ids) narrows Find and Name to that station's words when the picture has four or more.
function Scene({ sc, focus }) {
  const [mode, setMode] = useState('look')
  const [all, setAll] = useState(true)
  const [paused, setPaused] = useState(false)
  const [weather, setWeather] = useState(sc.weathers[0])
  const [sel, setSel] = useState(null)
  const [hover, setHover] = useState(null)
  const [q, setQ] = useState(null)              // { o, got: null | 'right' | 'wrong' | index clicked, check, opts }
  const [score, setScore] = useState([0, 0])
  const [typed, setTyped] = useState('')
  const [choose, setChoose] = useState(false)
  const order = useRef([]), dwell = useRef(), input = useRef(), next = useRef()
  const shown = o => !o.only || o.only === weather
  useEffect(() => () => clearTimeout(dwell.current), [])
  useEffect(() => { if (q?.got === null) input.current?.focus({ preventScroll: true }); else next.current?.focus({ preventScroll: true }) }, [q, choose])

  const ask = (m, wx = weather) => {
    if (!order.current.length) {
      const vs = sc.live.filter(o => !o.only || o.only === wx)
      const mine = focus ? vs.filter(o => focus.has(o.word.id)) : []
      order.current = shuffle(mine.length >= 4 ? mine : vs)
    }
    const o = order.current.pop()
    if (!o) return setQ(null)
    setQ({ o, got: null, opts: m === 'name' ? nameOptions(o, sc) : null }); setTyped('')
    if (m === 'find') speak(askLine(o.word))
  }
  const go = (m, wx = weather) => {
    clearTimeout(dwell.current)
    setMode(m); setSel(null); setScore([0, 0]); order.current = []
    if (m === 'look') setQ(null); else ask(m, wx)
  }
  const pickWeather = wx => { setWeather(wx); setSel(null); if (mode !== 'look') go(mode, wx) }
  const onHover = o => {
    clearTimeout(dwell.current)
    setHover(o ? o.i : null)
    if (o && mode === 'look' && o.i !== sel) dwell.current = setTimeout(() => { setSel(o.i); speak(said(o.word)) }, 700)
  }
  const tap = o => {
    clearTimeout(dwell.current)
    if (mode === 'look') { setSel(o.i); speak(said(o.word)); return }
    if (mode !== 'find' || !q || q.got !== null) return
    const right = o.i === q.o.i || o.word.id === q.o.word.id
    setQ({ ...q, got: right ? 'right' : o.i })
    setScore(([a, b]) => [a + right, b + 1])
    speak(said(right ? q.o.word : o.word))
  }
  const check = text => {
    if (!q || q.got !== null || !text.trim()) return
    const c = checkAnswer(text, q.o.word, D.words)
    const right = c.verdict !== 'wrong'
    setQ({ ...q, got: right ? 'right' : 'wrong', check: c, typed: text })
    setScore(([a, b]) => [a + right, b + 1])
    speak(said(q.o.word))
  }

  const cls = o => (mode === 'look' ? (sel === o.i || hover === o.i ? 'sel' : '')
    : !q || (q.o.i !== o.i && q.got !== o.i) ? ''
    : q.o.i === o.i ? (q.got === null ? (mode === 'name' ? 'ask' : '') : q.got === 'right' ? 'good' : 'show') : 'bad')
  const tagOn = o => (mode === 'look' ? all || o.i === hover || o.i === sel : q?.got != null && (o.i === q.o.i || o.i === q.got))
  const picked = mode === 'look' && sc.objs[hover ?? sel]
  const w = q?.o.word
  const first = w => w.en.split(';')[0]
  return html`<div class="scene">
    <div class=${`scene-stage${paused ? ' paused' : ''}`}>
      <${SceneArt} sc=${sc} cls=${cls} tagOn=${tagOn} onTap=${tap} onHover=${onHover} weather=${weather} held=${mode === 'look' ? hover : null}
        ring=${q && (mode === 'name' || q.got !== null) ? q.o.i : undefined} />
    </div>
    <aside class="scene-panel">
      <div class="scene-tools">
        <div class="modes" role="tablist" aria-label="How to practise">
          ${[['look', 'Explore'], ['find', 'Find it'], ['name', 'Name it']].map(([id, en]) => html`<button type="button" role="tab"
            aria-selected=${mode === id} class=${mode === id ? 'on' : ''} onClick=${() => go(id)}>${en}</button>`)}
        </div>
        ${sc.weathers.length > 1 ? html`<div class="scene-wx" role="group" aria-label="Weather">${sc.weathers.map(x => html`<button type="button"
          class=${weather === x ? 'on' : ''} aria-pressed=${weather === x} onClick=${() => pickWeather(x)}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${WEATHER[x][1]}</svg>${WEATHER[x][0]}</button>`)}</div>` : ''}
        <div class="scene-tog">
          ${mode === 'look' ? html`<button type="button" class=${`toggle show-all${all ? ' on' : ''}`} aria-pressed=${all} onClick=${() => setAll(!all)}>
            <span class="toggle-knob"></span>Show all names</button>` : ''}
          ${!reducedMotion() ? html`<button type="button" class=${`toggle${paused ? ' on' : ''}`} aria-pressed=${paused} onClick=${() => setPaused(!paused)}>
            <span class="toggle-knob"></span>Pause the motion</button>` : ''}
        </div>
      </div>
      <div class="scene-body" aria-live="polite">
        ${mode === 'look' && html`${picked ? html`<div class="scene-word" key=${picked.i}>
            <p class="scene-big"><${Word} w=${picked.word} /><${SayButton} text=${said(picked.word)} /></p>
            <p class="scene-en">${picked.word.en}</p>
            ${picked.word.p === 'n' && formsNote(picked.word) ? html`<p class="scene-pl">${formsNote(picked.word).startsWith('die ')
              ? html`Plural <b lang="de">${formsNote(picked.word)}</b>` : formsNote(picked.word)}</p>` : ''}
            ${D.stations[picked.word.n] ? html`<${StationChip} n=${picked.word.n} tab="words" />` : ''}
          </div>`
          : html`<div class="scene-hint"><b>${sc.live.filter(shown).length} words</b>
            <p>Point at a thing, or at a word below. Stay on it, or click, to hear it.</p></div>`}
          <div class="scene-bank" onPointerLeave=${() => setHover(null)}>${sc.live.filter(shown).map(o => html`<button type="button" key=${o.i}
            class=${o.i === (hover ?? sel) ? 'on' : ''} onPointerEnter=${() => setHover(o.i)} onFocus=${() => setHover(o.i)} onBlur=${() => setHover(null)}
            onClick=${() => tap(o)}><${Word} w=${o.word} /></button>`)}</div>`}
        ${mode === 'find' && q && html`<div class="scene-q">
          <p class="scene-k">${score[0]} of ${score[1]} right</p>
          <p class="scene-prompt" lang="de">${w.p === 'n' ? html`${w.a === 'pl' ? 'Wo sind' : 'Wo ist'} <${Word} w=${w} />?` : html`<${Word} w=${w} />`}</p>
          <button type="button" class="scene-again" onClick=${() => speak(askLine(w))}><${Speaker} /> Hear it again</button>
          ${q.got === null ? html`<p class="quiet">Click it in the picture.</p>`
            : q.got === 'right' ? html`<p class="scene-yes"><b>Ja, genau!</b> <${Word} w=${w} /> · ${first(w)}</p>`
            : html`<p class="scene-no">That is <${Word} w=${sc.objs[q.got].word} />. <${Word} w=${w} /> (${first(w)}) is circled now.</p>`}
          ${q.got !== null ? html`<button type="button" class="btn" ref=${next} onClick=${() => ask('find')}>Next word <${Arrow} /></button>` : ''}
        </div>`}
        ${mode === 'name' && q && html`<div class="scene-q">
          <p class="scene-k">${score[0]} of ${score[1]} right</p>
          <p class="scene-prompt" lang="de">Wie heißt das?</p>
          ${q.got === null ? html`<p class="quiet">The circled thing, with der, die or das.</p>
            ${choose ? html`<div class="scene-opts">${q.opts.map(t => html`<button type="button" lang="de" onClick=${() => check(t)}>${t}</button>`)}</div>`
              : html`<form class="scene-type" onSubmit=${e => { e.preventDefault(); check(typed) }}>
                  <input ref=${input} lang="de" autocomplete="off" autocapitalize="off" spellcheck="false" value=${typed}
                    onInput=${e => setTyped(e.target.value)} placeholder=${w.a && w.a !== 'pl' ? 'der/die/das + word' : 'Type the German'} aria-label="Its name in German" />
                  <button type="submit" class="btn">Check</button>
                </form>`}
            <button type="button" class="scene-swap" onClick=${() => setChoose(!choose)}>${choose ? 'Type it instead' : 'Choose from four instead'}</button>`
          : html`<${Typed} check=${q.check} typed=${q.typed} w=${w} />
            <p class="scene-big"><${Word} w=${w} /><${SayButton} text=${said(w)} /></p>
            <p class="scene-en">${w.en}</p>
            <button type="button" class="btn" ref=${next} onClick=${() => ask('name')}>Next <${Arrow} /></button>`}
        </div>`}
      </div>
    </aside>
  </div>`
}

// A flashcard's picture: the word's thing circled in its scene, cropped around it and its board, holding still.
function ScenePic({ w }) {
  const pic = w && scenes().pictureOf[w.id]
  const ref = useRef()
  const [box, setBox] = useState(null)
  useLayoutEffect(() => {
    const look = pic && ref.current?.querySelector(`.sc-obj[data-i="${pic.o.i}"] .sc-look`)
    if (!look) return
    const b = look.getBBox(), { o } = pic, [rx, ry] = o.rest ?? [0, 0]
    const t = boardBox(o, [rx, ry])
    const x0 = Math.min(o.at[0] + rx + b.x, t[0]), y0 = Math.min(o.at[1] + ry + b.y, t[1])
    const x1 = Math.max(o.at[0] + rx + b.x + b.width, t[2]), y1 = Math.max(o.at[1] + ry + b.y + b.height, t[3])
    let wd = x1 - x0 + 80, ht = y1 - y0 + 60
    if (wd / ht < 16 / 9) wd = ht * 16 / 9; else ht = wd * 9 / 16
    if (ht > SCENE_H) { ht = SCENE_H; wd = ht * 16 / 9 }
    const inside = (v, size, max) => Math.min(Math.max(v, 0), Math.max(0, max - size))   // the crop stays in the picture
    setBox(`${inside((x0 + x1 - wd) / 2, wd, SCENE_W)} ${inside((y0 + y1 - ht) / 2, ht, SCENE_H)} ${wd} ${ht}`)
  }, [pic])
  if (!pic) return ''
  return html`<div class="scene-pic" ref=${ref} title=${`In the picture: ${pic.sc.de}`}>
    <${SceneArt} sc=${pic.sc} cls=${x => (x.i === pic.o.i ? 'sel' : '')} tagOn=${x => x.i === pic.o.i} weather=${pic.o.only} frozen viewBox=${box} />
  </div>`
}

// A small thumbnail link to the station's picture, for its Words tab.
function SceneLink({ n }) {
  const sc = scenesFor(n)[0]
  if (!sc) return ''
  return html`<a class="scene-link" href=${`#/station/${n}/pictures`}>
    <span class="scene-link-art"><${SceneArt} sc=${sc} frozen /></span>
    <span>See them in a picture<small lang="de">${sc.de}</small></span>
  </a>`
}

const StationChip = ({ n, tab = 'pictures' }) => {
  const st = D.stations[n]
  return st ? html`<a class=${`scene-chip l${st.level}`} href=${`#/station/${n}/${tab}`} title=${`Station ${st.k} of ${st.level}`}>
    <span class="lb">${st.level}</span> ${st.k} <span lang="de">${st.de}</span></a>` : ''
}

function PicturesPage({ arg }) {
  const { list, byId } = scenes()
  const sc = arg && byId[decodeURIComponent(arg)]
  if (sc) {
    return html`<main class=${`pictures l${sc.level}`}>
      <a class="back" href="#/pictures">← All picture scenes</a>
      <header class="scene-head"><h1 lang="de">${sc.de}</h1><span class="scene-head-en">${sc.en}</span>
        <span class="scene-chips">${sc.stations.map(n => html`<${StationChip} n=${n} />`)}</span></header>
      <${Scene} key=${sc.id} sc=${sc} />
    </main>`
  }
  return html`<main class="pictures">
    <header class="masthead"><h1>Picture scenes</h1>
      <p>Drawn scenes where every labelled thing is a word with its article. Explore them, find things by name, or name them.</p></header>
    ${arg ? html`<p class="soon">There is no picture called "${arg}". Here are all of them.</p>` : ''}
    ${!list.length ? html`<p class="soon">The pictures are being drawn now.</p>` : ''}
    ${D.levels.map(lv => {
      const mine = list.filter(s => s.level === lv.level)
      return mine.length ? html`<section class=${`scene-level l${lv.level}`} aria-label=${lv.level}>
        <h2><span class="lb big">${lv.level}</span> ${lv.title}</h2>
        <div class="scene-cards">${mine.map(s => html`<a class="scene-card" href=${`#/pictures/${s.id}`}>
          <${SceneArt} sc=${s} frozen />
          <span class="scene-card-t"><b lang="de">${s.de}</b> ${s.en}</span>
          <small>${s.live.length} words · ${s.stations.map(n => D.stations[n] && `${D.stations[n].level} ${D.stations[n].k}`).filter(Boolean).join(', ')}</small>
        </a>`)}</div>
      </section>` : ''
    })}
  </main>`
}
PAGES.pictures = PicturesPage

function PicturesTab({ data, n }) {
  const mine = scenesFor(n)
  const [i, setI] = useState(0)
  const focus = useMemo(() => new Set((data.wordsBy[n] ?? []).map(w => w.id)), [data, n])
  if (!mine.length) {
    return html`<p class="soon">This station has no picture scene of its own. <a href="#/pictures">See all picture scenes</a></p>`
  }
  const sc = mine[Math.min(i, mine.length - 1)]
  return html`<div class="pictures-tab">
    ${mine.length > 1 ? html`<div class="modes" role="tablist" aria-label="Pictures">${mine.map((s, j) => html`<button type="button" role="tab"
      aria-selected=${s === sc} class=${s === sc ? 'on' : ''} onClick=${() => setI(j)} lang="de">${s.de}</button>`)}</div>` : ''}
    <${Scene} key=${sc.id} sc=${sc} focus=${focus} />
  </div>`
}
TAB_VIEWS.pictures = PicturesTab
