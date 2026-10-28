// ---- home: what to do next, the practice tiles, the route, the top bar and settings ----

// What to do at a part, said once for the plan rail and once for the next-step sentence.
const STEP = {
  cards: [(st, q) => {
    const reviews = q.filter(c => S.cards[c.id]).length, fresh = q.length - reviews
    return reviews ? html`Start with the <b>${plural(reviews, 'review')}</b> due today${fresh ? html`, then learn <b>${plural(fresh, 'new card')}</b>` : ''}.`
      : html`Learn <b>${plural(fresh, 'new word')}</b> from <span lang="de">${st.de}</span>${st.k > 1 || st.level !== 'A1' ? ' and earlier stations.' : /[.!?]$/.test(st.de) ? '' : '.'}`
  }, "Start today's cards"],
  words: [() => 'Look through the words of this station, each noun with its article, plural and sound, and test yourself.', 'Open the words'],
  grammar: [st => html`Now the grammar, starting with <b>${st.grammar[0][1]}</b>.`, 'Open the grammar'],
  read: [() => 'Read a short text and answer questions in the Lesen format.', 'Start reading'],
  listen: [() => 'Listen to everyday dialogues and announcements, as in the Hören module.', 'Start listening'],
  write: [() => 'Write a short exam task and check it against the rubric.', 'Start writing'],
  speak: [() => 'Speak an exam task out loud, with a timer and a recording.', 'Start speaking'],
  test: [() => 'Take the station test. 60% passes.', 'Take the test'],
}

// Today at this stop: the day's cards first, then each part of the station in order.
function todayPlan(st, q) {
  const cards = D.words.length ? [{ part: 'cards', label: 'Cards', href: '#/study', p: q.length ? 0 : 1, state: q.length ? 'todo' : 'done', note: q.length ? `${q.length} · about ${Math.max(1, Math.round(q.length * 10 / 60))} min` : 'done' }] : []
  return [...cards, ...revisitStops(), ...PARTS.map(part => {   // revisit stops (L15) and spaced mocks (L17): 85-tests.js
    const p = partDone(st.n, part)
    const begun = p > 0 || (part === 'words' && D.wordsBy[st.n].some(w => S.cards[w.id]))
    return { part, label: TAB_NAME[part], href: `#/station/${st.n}/${part}`, p, state: p >= 1 ? 'done' : begun ? 'part' : 'todo' }
  }), ...mockStops(st)]
}
// The next stop: the first one not done. Words under way don't hold the day up: the cards bring them in, a few a day.
const nextStep = plan => plan.find(p => p.state !== 'done' && !(p.part === 'words' && p.state === 'part'))

const Mark = () => html`<svg class="mark" viewBox="0 0 40 40" aria-hidden="true">
  <rect width="40" height="40" rx="6" fill="var(--board)" />
  <path d="M8 28 L16 20 H24 L32 12" fill="none" stroke="var(--a1)" stroke-width="4" stroke-linecap="round" />
  <circle cx="8" cy="28" r="3.5" fill="#fff" /><circle cx="20" cy="20" r="3.5" fill="#fff" /><circle cx="32" cy="12" r="3.5" fill="#fff" />
</svg>`

// Progress as a ring, the way a line's completion is drawn.
const Ring = ({ p, label }) => html`<svg class="ring" viewBox="0 0 120 120" role="img" aria-label=${`${pct(p)} ${label}`}>
  <circle cx="60" cy="60" r="50" class="ring-track" />${p > 0 ? html`<circle cx="60" cy="60" r="50" class="ring-fill" style=${`--p:${p}`} pathLength="1" />` : ''}
  <text x="60" y="64" class="ring-n">${pct(p)}</text><text x="60" y="84" class="ring-l">${label}</text>
</svg>`

// Practice tile icons (48 × 48, drawn in the tile's colour; the gender one uses the gender code itself).
const ICONS = {
  sheet: html`<rect x="9" y="5" width="30" height="38" rx="4" fill="none" stroke="currentColor" stroke-width="3" />
    ${[14, 22, 30].map((y, i) => html`<circle cx="17" cy=${y} r="3.2" fill=${i === 1 ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="2" /><path d=${`M24 ${y} H33`} stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />`)}`,
  stamp: html`<g transform="rotate(-12 24 24)"><circle cx="24" cy="24" r="18" fill="none" stroke="currentColor" stroke-width="3" />
    <circle cx="24" cy="24" r="13.5" fill="none" stroke="currentColor" stroke-width="1.5" /><path d="M16.5 24.5l5 5 10-11" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" /></g>`,
  scene: html`<circle cx="34" cy="13" r="6" fill="currentColor" /><path d="M3 40 Q16 24 26 34 T45 30 V44 H3 Z" fill="currentColor" opacity=".55" />
    <rect x="13" y="22" width="4" height="12" fill="currentColor" /><circle cx="15" cy="20" r="7" fill="currentColor" />`,
  verb: html`<rect x="2" y="13" width="19" height="22" rx="4" fill="none" stroke="currentColor" stroke-width="3" />
    <text x="11.5" y="29" text-anchor="middle" class="icon-t">en</text>
    <path d="M23 24 H28 M25.5 20.5 L29 24 L25.5 27.5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
    <rect x="31" y="13" width="15" height="22" rx="4" fill="currentColor" /><text x="38.5" y="29" text-anchor="middle" class="icon-t inv">t</text>`,
  gender: html`<rect x="4" y="8" width="40" height="8" rx="4" fill="var(--der)" /><rect x="4" y="20" width="30" height="8" rx="4" fill="var(--die)" />
    <rect x="4" y="32" width="36" height="8" rx="4" fill="var(--das)" />`,
  cases: html`${[[5, 5], [26, 5], [5, 26], [26, 26]].map(([x, y], i) => html`<rect x=${x} y=${y} width="17" height="17" rx="3"
    fill=${i === 2 ? 'currentColor' : 'none'} stroke="currentColor" stroke-width="3" />`)}`,
  sounds: html`<text x="17" y="36" text-anchor="middle" class="icon-t big">ü</text>
    <path d="M33 16a12 12 0 0 1 0 17M38.5 11a19 19 0 0 1 0 27" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />`,
  tip: html`<path d="M24 6 a12 12 0 0 1 7 21.7 V33 H17 V27.7 A12 12 0 0 1 24 6 Z" fill="none" stroke="currentColor" stroke-width="3" />
    <path d="M18 38 H30 M20 43 H28" stroke="currentColor" stroke-width="3" stroke-linecap="round" />`,
}
const TOOLS = [
  { href: '#/tests', en: 'Practice tests', hint: 'Numbered tests for every exam module', icon: 'sheet' },
  { href: '#/mock', en: 'Mock exam', hint: 'A timed paper, scored like Goethe', icon: 'stamp' },
  { href: '#/pictures', en: 'Picture scenes', hint: 'Tap, find and name things', icon: 'scene' },
  { href: '#/verbs', en: 'Verb forms', hint: 'Präsens to Perfekt, with real mistakes', icon: 'verb' },
  { href: '#/gender', en: 'der, die, das', hint: 'Genders and plurals by their endings', icon: 'gender' },
  { href: '#/cases', en: 'Cases and endings', hint: 'den, dem, des and adjective endings', icon: 'cases' },
  { href: '#/sounds', en: 'Pronunciation', hint: 'ü, ö, ch and r, with minimal pairs', icon: 'sounds' },
  { href: '#/tips/0', en: 'How you learn here', hint: 'The research behind the app, in nine tips', icon: 'tip' },
]
const Tiles = () => html`<ul class="tiles">${TOOLS.map(t => html`<li>
  <a class="tile" href=${t.href}><svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">${ICONS[t.icon]}</svg>
    <b>${t.en}</b><small>${t.hint}</small></a></li>`)}</ul>`

// ---- the route: three lines (A1, A2, B1), twelve stations each, split into two halves ----

function RouteMap({ data, picked, onPick }) {
  const s = useStore()
  return html`<section class="route" aria-labelledby="route-h">
    <div class="route-head">
      <h2 id="route-h">Your route</h2>
      <ul class="legend" aria-label="Station key">
        <li><span class="rdot key done"></span> Done</li><li><span class="rdot key started"></span> Started</li>
        <li><span class="rdot key"></span> Not started</li><li><${Train} /> You are here</li>
      </ul>
    </div>
    ${data.levels.map(lv => {
      const on = here(data).level === lv.level
      const halves = [lv.stations.slice(0, 6), lv.stations.slice(6)]
      const pickedHere = lv.stations.find(st => st.n === picked)
      return html`<div class=${`rline l${lv.level}${on ? ' current' : ''}`}>
        <header class="rline-head">
          <span class="lb big">${lv.level}</span>
          <div class="rline-title"><h3>${lv.title}</h3><p>${on ? html`<b>You are on this line.</b> ` : ''}${pct(levelDone(lv))} done</p></div>
          <span class="pbar"><i style=${`--p:${levelDone(lv)}`}></i></span>
        </header>
        <div class="halves">${halves.map((half, h) => html`<div class="half">
          <span class="half-name">${lv.level}.${h + 1}</span>
          <ol class="rstations">${half.map(st => {
            const p = stationDone(st.n)
            const where = st.n === s.lesson ? ' at' : st.n < s.lesson ? ' passed' : ''
            return html`<li key=${st.n} class=${`rstn${p >= 1 ? ' done' : p > 0 ? ' started' : ''}${where}${picked === st.n ? ' picked' : ''}`} style=${`--p:${p}`}>
              ${st.n === s.lesson ? html`<${Train} />` : ''}
              <button type="button" onClick=${() => onPick(st.n)} aria-pressed=${picked === st.n}
                aria-label=${`Station ${st.k}, ${st.de} (${st.en}), ${pct(p)} done`}>
                <span class="rdot"></span><span class="rnum">${st.k}</span><span class="rname" lang="de">${st.de}</span>
              </button>
            </li>`
          })}</ol>
        </div>`)}</div>
        ${pickedHere ? html`<${StationCard} data=${data} n=${picked} onClose=${() => onPick(picked)} />` : ''}
      </div>`
    })}
  </section>`
}

// What a station holds, part by part, with a way into each.
function StationCard({ data, n, onClose }) {
  const s = useStore()
  const st = data.stations[n]
  return html`<section class=${`scard l${st.level}`} aria-label=${`${st.de} details`}>
    <div class="scard-head">
      <span class="lb">${st.level} · ${st.k}</span>
      <div class="scard-title"><h3 lang="de">${st.de}</h3><p>${st.en}: ${st.can}.</p></div>
      <div class="scard-actions">
        ${n === s.lesson ? html`<span class="you">Your current stop</span>`
          : html`<button type="button" onClick=${() => commit(x => { x.lesson = n })}>Make this my current stop</button>`}
        <a class="btn" href=${`#/station/${n}`}>Open station <${Arrow} /></a>
        <button type="button" class="close" onClick=${onClose} aria-label="Close">×</button>
      </div>
    </div>
    <ul class="scard-parts">${PARTS.map(part => html`<li>
      <a href=${`#/station/${n}/${part}`}>${TAB_NAME[part]}</a>
      <span class="pbar"><i style=${`--p:${partDone(n, part)}`}></i></span>
    </li>`)}</ul>
    <p class="scard-grammar"><b>Grammar:</b> ${st.grammar.map(([, t]) => t).join(' · ')}</p>
  </section>`
}

// ---- top bar and home ----

function TopBar({ data, page }) {
  const s = useStore()
  const st = here(data)
  const due = queue().length
  const links = [['', 'Today'], ['study', 'Cards', due], ['practice', 'Practice'], ['tests', 'Tests'], ['mock', 'Mock exam'], ['pictures', 'Pictures']]
  const on = p => (p === '' ? !page : page === p)
  return html`<header class=${`topbar l${st.level}`}>
    <a class="brand" href="#/"><${Mark} /><span class="brand-name"><b lang="de">Weg nach Deutschland</b><small>Path to Germany</small></span></a>
    <nav class="topnav" aria-label="Main"><ul>${links.map(([p, label, n]) => html`<li>
      <a href=${`#/${p}`} class=${on(p) ? 'on' : ''} aria-current=${on(p) ? 'page' : null}>${label}${n ? html` <b class="count" aria-label=${`${n} due`}>${n}</b>` : ''}</a></li>`)}</ul></nav>
    <a class="tb-stop" href=${`#/station/${s.lesson}`} title="Your current stop"><span class="lb">${st.level}</span>
      <span><span class="tb-stop-k">${String(st.k).padStart(2, '0')}</span> <span lang="de">${st.de}</span></span></a>
  </header>`
}

function Home({ data }) {
  const s = useStore()
  const [picked, setPicked] = useState(null)
  const st = here(data)
  const lv = data.level[st.level]
  const q = queue()
  const plan = todayPlan(st, q)
  const step = nextStep(plan)
  const next = data.stations[st.n + 1]
  const pick = n => {
    setPicked(n === picked ? null : n)
    setTimeout(() => document.querySelector('.scard')?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' }), 50)
  }
  return html`<main class=${`home l${st.level}`}>
    <p class="welcome"><span lang="de">Liebe Sneka, willkommen!</span><small>Dear Sneka, welcome!</small></p>
    <p class="plan-line">${s.settings.plan ? html`<b>Your plan:</b> ${s.settings.plan}`
      : html`<a href="#/" onClick=${e => { e.preventDefault(); openSettings() }}>Plan when and where you study (one sentence)</a>`}</p>
    <section class=${`hero l${st.level}`} aria-label="Today">
      <${Board} data=${data} n=${st.n} home />
      <div class="go">
        <${Ring} p=${levelDone(lv)} label=${`of ${lv.level} done`} />
        <div class="go-text">
          ${step ? html`<p class="next-text">${STEP[step.part][0](st, q)}</p>
              <a class="btn big" href=${step.href}>${STEP[step.part][1]} <${Arrow} /></a>`
            : next ? html`<p class="next-text">You have been through every part of <span lang="de">${st.de}</span>. Move on: its words keep coming back in your cards.</p>
              <button type="button" class="btn big" onClick=${() => commit(x => { x.lesson = next.n })}>Move on to <span lang="de">${next.de}</span> <${Arrow} /></button>`
            : html`<p class="next-text">Every station is done. Take the B1 mock exam until it passes every time.</p>
              <a class="btn big" href="#/mock/B1/full">Take the B1 mock exam <${Arrow} /></a>`}
          <p class="quiet">${plural(lv.stations.filter(x => stationDone(x.n) >= 1).length, 'station')} of ${lv.stations.length} done on the ${lv.level} line</p>
          <${Week} />
        </div>
      </div>
      <ol class="plan" aria-label="Today's plan at this station">${plan.map(p => html`<li class=${`${p.state}${p === step ? ' now' : ''}`}>
        <a href=${p.href}><span class="pdot" style=${`--p:${p.p}`}></span><b>${p.label}</b><small>${p.note && p.state !== 'done' ? p.note : p.state === 'done' ? 'done' : p.state === 'part' ? pct(p.p) : p === step ? 'next' : ''}</small></a>
      </li>`)}</ol>
    </section>

    <section class="practice" aria-labelledby="practice-h">
      <h2 id="practice-h">Practice</h2>
      <${Tiles} />
    </section>

    <${RouteMap} data=${data} picked=${picked} onPick=${pick} />
    <${Settings} />
  </main>`
}

// Installing a German voice needs an administrator PowerShell; the app offers the command and never runs it.
const VOICE_CMD = 'Add-WindowsCapability -Online -Name "Language.TextToSpeech~~~de-DE~0.0.1.0"'

// The last seven days as dots, filled on days with any answer. No streak count: missing one day is fine, two is a habit lost.
const DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
function Week() {
  const s = useStore()
  const studied = new Set(s.log.map(([, , t]) => new Date(t).toLocaleDateString('en-CA')))
  const days = Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() - 6 + k); return d })
  const on = d => studied.has(d.toLocaleDateString('en-CA'))
  const lapsed = s.log.length > 0 && !on(days[6]) && !on(days[5])   // not for a first day
  return html`<div class="week" aria-label="This week">
    <ol>${days.map(d => html`<li class=${on(d) ? 'on' : ''}><span class="wk-dot"></span><small lang="de">${DAYS[d.getDay()]}</small></li>`)}</ol>
    ${lapsed ? html`<p class="quiet">Never miss twice: five minutes of cards today keeps the habit.</p>` : ''}
  </div>`
}
const openSettings = () => { const d = document.querySelector('.settings'); if (d) { d.open = true; d.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth' }); d.querySelector('input')?.focus() } }

// Settings: four groups (daily study, voice, look, progress) behind one summary line on the home page.
const SetChoice = ({ name, value, opts, onPick }) => html`<div class="set-seg" role="radiogroup" aria-label=${name}>${opts.map(([v, label, sw]) => html`
  <label class=${value === v ? 'on' : ''}><input type="radio" name=${name} checked=${value === v} onChange=${() => onPick(v)} />${sw ? html`<i class=${`set-sw ${sw}`} aria-hidden="true"></i>` : ''}${label}</label>`)}</div>`
const SetIcon = ({ d }) => html`<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d=${d} fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>`
const SET_ICONS = {
  day: 'M4 6h16v14H4zM4 10h16M8 3v5M16 3v5M8 14h3',
  voice: 'M4 9v6h4l5 4V5L8 9H4zM16 8.5a4.5 4.5 0 0 1 0 7M18.5 6a8 8 0 0 1 0 12',
  look: 'M12 3a9 9 0 1 0 0 18zM12 3a9 9 0 0 1 0 18',
  save: 'M12 4v11M7 10l5 5 5-5M4 19h16',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M15 4v6M9 14v6',
}
const SET_RATES = [[0.7, 'Slow'], [0.85, 'Slower'], [0.95, 'Normal'], [1.1, 'Fast']]
const SET_THEMES = [[undefined, 'Windows', 'sys'], ['light', 'Light', 'light'], ['dark', 'Dark', 'dark']]
function Settings() {
  const s = useStore()
  const [, bump] = useState(0)
  const [wipe, setWipe] = useState(false)
  useEffect(() => {   // the voice list arrives asynchronously
    if (!('speechSynthesis' in window)) return
    const f = () => bump(n => n + 1)
    speechSynthesis.addEventListener('voiceschanged', f)
    return () => speechSynthesis.removeEventListener('voiceschanged', f)
  }, [])
  useEffect(() => applyLook(), [s.settings.theme, s.settings.motion])   // also after an import or a reset
  const voices = deVoices()
  const set = (k, v) => commit(x => { x.settings = { ...x.settings, [k]: v } })
  const perDay = n => commit(x => { x.newPerDay = Math.max(0, Math.min(100, Math.round(n) || 0)) })
  const learned = D.words.filter(w => known(w.id)).length
  const reset = () => { commit(x => { for (const k of Object.keys(x)) delete x[k]; Object.assign(x, fresh()); x.unexported = false }); setWipe(false) }
  const rate = s.settings.rate ?? 0.95
  return html`<details class="settings">
    <summary>
      <span class="set-badge"><${SetIcon} d=${SET_ICONS.sliders} /></span>
      <span class="set-title"><b>Settings and backup</b>
        <small>${[`${s.newPerDay} new cards a day`, `${SET_RATES.find(r => r[0] === rate)?.[1].toLowerCase() ?? 'normal'} speech`,
          `${SET_THEMES.find(t => t[0] === s.settings.theme)?.[1] ?? 'Windows'} theme`, s.unexported === false ? 'backed up' : 'not backed up yet'].join(' · ')}</small></span>
      <svg class="set-chev" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
    </summary>
    <div class="set-grid">
      <section class="set-card" aria-labelledby="set-day">
        <h3 id="set-day"><${SetIcon} d=${SET_ICONS.day} /> Daily study</h3>
        <label class="set-field"><span>My study plan</span>
          <input type="text" value=${s.settings.plan ?? ''} placeholder="After breakfast, at my desk, I open today's cards."
            onChange=${e => set('plan', e.target.value.trim() || undefined)} />
          <small>One sentence: when and where. Today shows it under the welcome.</small></label>
        <div class="set-field"><span id="set-new">New cards per day</span>
          <div class="set-step" role="group" aria-labelledby="set-new">
            <button type="button" aria-label="Fewer" onClick=${() => perDay(s.newPerDay - 5)}>−</button>
            <input type="number" min="0" max="100" value=${s.newPerDay} aria-labelledby="set-new" onChange=${e => perDay(+e.target.value)} />
            <button type="button" aria-label="More" onClick=${() => perDay(s.newPerDay + 5)}>+</button>
          </div>
          <small>Each new card comes back as reviews over the next weeks, so more new cards means more reviews later. 10 to 20 is a steady pace.</small></div>
      </section>

      <section class="set-card" aria-labelledby="set-voice">
        <h3 id="set-voice"><${SetIcon} d=${SET_ICONS.voice} /> Voice</h3>
        <label class="set-field"><span>German voice</span>
          <select value=${s.settings.voice ?? ''} onChange=${e => set('voice', e.target.value || undefined)} disabled=${!voices.length}>
            <option value="">${voices.length ? 'Automatic (best available)' : 'No German voice found'}</option>
            ${voices.map(v => html`<option value=${v.name}>${v.name}</option>`)}
          </select></label>
        <div class="set-field"><span>Speed</span>
          <${SetChoice} name="Speed" value=${rate} opts=${SET_RATES} onPick=${v => set('rate', v)} /></div>
        <div class="set-row">
          <button type="button" onClick=${() => speak('Hallo Sneka! Willkommen in Deutschland.')}><${Speaker} /> Test the voice</button>
          <label class="set-switch"><input type="checkbox" checked=${s.autoplay} onChange=${e => commit(x => { x.autoplay = e.target.checked })} />
            Read each word aloud when its card turns over</label>
        </div>
        ${voices.length ? '' : html`<div class="set-help">
          <p><b>This browser has no German voice yet.</b> In Windows: Settings → Time &amp; language → Speech → Add voices → German (Deutsch).
            Then quit the browser completely (Brave keeps running in the background: right-click its tray icon → Exit) and reopen it.
            Microsoft Edge has German voices built in.</p>
          <p>Or, from an administrator PowerShell (Start → type PowerShell → Run as administrator):</p>
          <p class="set-cmd"><code>${VOICE_CMD}</code> <button type="button" onClick=${() => navigator.clipboard?.writeText(VOICE_CMD)}>Copy</button></p>
        </div>`}
      </section>

      <section class="set-card" aria-labelledby="set-look">
        <h3 id="set-look"><${SetIcon} d=${SET_ICONS.look} /> Look</h3>
        <div class="set-field"><span>Theme</span>
          <${SetChoice} name="Theme" value=${s.settings.theme} opts=${SET_THEMES} onPick=${v => set('theme', v)} /></div>
        <div class="set-field"><span>Motion</span>
          <${SetChoice} name="Motion" value=${s.settings.motion} opts=${[[undefined, 'As Windows says'], ['reduce', 'Reduce motion']]} onPick=${v => set('motion', v)} />
          <small>Reduced motion keeps every picture and the drifting words still.</small></div>
        <label class="set-switch"><input type="checkbox" checked=${s.settings.backdrop !== false} onChange=${e => set('backdrop', e.target.checked ? undefined : false)} />
          Drifting words behind Today and Practice</label>
      </section>

      <section class="set-card" aria-labelledby="set-save">
        <h3 id="set-save"><${SetIcon} d=${SET_ICONS.save} /> Your progress</h3>
        <dl class="set-stats">
          <div><dt>Words learned</dt><dd>${learned}</dd></div>
          <div><dt>Cards started</dt><dd>${Object.keys(s.cards).length}</dd></div>
          <div><dt>Answers given</dt><dd>${s.log.length}</dd></div>
        </dl>
        <p class="set-note">Progress lives in this browser only. The double-clicked file and a served copy (http://) keep separate progress.
          Now and then, export a backup and import it wherever you study.</p>
        <div class="set-row">
          <button type="button" class="btn" onClick=${exportProgress}>Export progress</button>
          <label class="button">Import progress<input type="file" accept="application/json,.json" hidden
            onChange=${e => { const f = e.target.files[0]; e.target.value = ''; if (f) importProgress(f) }} /></label>
          ${wipe ? '' : html`<button type="button" class="set-danger-link" onClick=${() => setWipe(true)}>Reset all progress…</button>`}
        </div>
        ${wipe ? html`<div class="set-wipe" role="alert">
          <p><b>Delete all progress in this browser?</b> ${plural(Object.keys(s.cards).length, 'card')}, every test result, draft and setting. This can't be undone.</p>
          <div class="set-row">
            <button type="button" onClick=${exportProgress}>Export a backup first</button>
            <button type="button" class="set-danger" onClick=${reset}>Delete everything</button>
            <button type="button" onClick=${() => setWipe(false)}>Keep it</button>
          </div>
        </div>` : ''}
      </section>
    </div>
  </details>`
}

const PracticeHub = () => html`<main class="page">
  <header class="masthead"><h1>Practice</h1><p>Everything beyond the daily stations: exam papers, pictures and trainers.</p></header>
  <${Tiles} />
</main>`
PAGES.practice = PracticeHub
