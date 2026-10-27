// ---- verb forms: generated from the infinitive and the three key forms (fährt, fuhr, ist gefahren) ----

export const PERSONS = ['ich', 'du', 'er/sie/es', 'wir', 'ihr', 'sie/Sie']
const IRREGULAR = {
  sein: [['bin', 'bist', 'ist', 'sind', 'seid', 'sind'], ['war', 'warst', 'war', 'waren', 'wart', 'waren']],
  haben: [['habe', 'hast', 'hat', 'haben', 'habt', 'haben']],
  werden: [['werde', 'wirst', 'wird', 'werden', 'werdet', 'werden'], ['wurde', 'wurdest', 'wurde', 'wurden', 'wurdet', 'wurden']],
  wissen: [['weiß', 'weißt', 'weiß', 'wissen', 'wisst', 'wissen']],
  können: [['kann', 'kannst', 'kann', 'können', 'könnt', 'können']], müssen: [['muss', 'musst', 'muss', 'müssen', 'müsst', 'müssen']],
  wollen: [['will', 'willst', 'will', 'wollen', 'wollt', 'wollen']], dürfen: [['darf', 'darfst', 'darf', 'dürfen', 'dürft', 'dürfen']],
  sollen: [['soll', 'sollst', 'soll', 'sollen', 'sollt', 'sollen']], mögen: [['mag', 'magst', 'mag', 'mögen', 'mögt', 'mögen']],
  möchten: [['möchte', 'möchtest', 'möchte', 'möchten', 'möchtet', 'möchten']],
}
const KONJ2 = { sein: 'wäre', haben: 'hätte', werden: 'würde', können: 'könnte', müssen: 'müsste', dürfen: 'dürfte', wollen: 'wollte',
  sollen: 'sollte', mögen: 'möchte', wissen: 'wüsste', gehen: 'ginge', kommen: 'käme', geben: 'gäbe', bleiben: 'bliebe', lassen: 'ließe' }
const needsE = stem => /([td]|[^lrhmnaeiouäöü][mn])$/.test(stem)   // arbeit-et, öffn-et, but lern-t, wohn-t, komm-t

// The parts of a verb: prefix (separable), reflexive, infinitive core, present stems, and the key forms.
export function verbParts(w) {
  const reflexive = w.w.startsWith('sich ')
  const inf = w.w.replace(/^sich /, '')
  const [pres = '', past = '', perf = ''] = (w.f ?? '').split(', ').map(x => x.replace(' sich', ''))
  const presBits = pres.split(' '), pastBits = past.split(' ')
  const prefix = presBits.length > 1 ? presBits[presBits.length - 1] : ''
  const core = prefix && inf.startsWith(prefix) ? inf.slice(prefix.length) : inf
  const stem = core.replace(/(e?n)$/, '').replace(/el$/, 'el')
  const [aux, pp] = perf.includes(' ') ? [perf.split(' ')[0].split('/')[0], perf.split(' ').pop()] : ['hat', perf]
  return { inf, core, stem, prefix, reflexive, p3: presBits[0], past: pastBits[0], aux: aux === 'ist' ? 'sein' : 'haben', pp }
}

// Six present-tense forms, without the separable prefix (it goes to the end of the sentence).
export function present(w) {
  const v = verbParts(w)
  if (IRREGULAR[v.core]) return IRREGULAR[v.core][0]
  const { stem, p3 } = v
  const changed = p3.replace(/e?t$/, '')                      // fährt → fähr, liest → lies, arbeitet → arbeit
  const duStem = changed !== stem ? changed : stem
  const du = /[sßzx]$/.test(duStem) ? `${duStem}t` : needsE(stem) && duStem === stem ? `${stem}est` : `${duStem}st`
  const ihr = needsE(stem) ? `${stem}et` : `${stem}t`
  const wir = v.core.endsWith('eln') || v.core.endsWith('ern') ? v.core : `${stem}en`
  const ich = v.core.endsWith('eln') ? `${stem.slice(0, -2)}le` : `${stem}e`
  return [ich, du, p3, wir, ihr, wir]
}

export function preterite(w) {
  const v = verbParts(w)
  if (IRREGULAR[v.core]?.[1]) return IRREGULAR[v.core][1]
  const p = v.past
  if (/te$/.test(p)) return [p, `${p}st`, p, `${p}n`, `${p}t`, `${p}n`]
  const st = /[sßz]$/.test(p) ? `${p}est` : /[td]$/.test(p) ? `${p}est` : `${p}st`
  return [p, st, p, `${p}en`, /[td]$/.test(p) ? `${p}et` : `${p}t`, `${p}en`]
}

export function imperative(w) {
  const v = verbParts(w)
  if (v.core === 'sein') return ['sei', 'seid', 'seien Sie']
  const pres = present(w)
  const eToI = /i/.test(pres[2]) && /e/.test(v.stem) && !/ie/.test(v.stem) && pres[2] !== `${v.stem}t`   // nimmt, gibt, liest
  // e → i verbs take the changed stem (nimm! lies! iss!); werden keeps its own: werde!
  const du = v.core === 'werden' ? 'werde' : eToI ? pres[2].replace(/t$/, '') : needsE(v.stem) ? `${v.stem}e` : v.stem
  const sep = v.prefix ? ` ${v.prefix}` : ''
  const sich = v.reflexive ? [' dich', ' euch', ' sich'] : ['', '', '']
  return [`${du}${sich[0]}${sep}!`, `${pres[4]}${sich[1]}${sep}!`, `${pres[3]} Sie${sich[2]}${sep}!`]
}

// A sentence-ready form: "steht … auf", "hat … gemacht", "ist … gefahren".
export function perfect(w, i) {
  const v = verbParts(w)
  return `${present({ w: v.aux, f: '' })[i]} ${v.pp}`
}

// Wrong options a learner really produces, for a given right answer.
export function verbMistakes(w, tense, i) {
  const v = verbParts(w)
  const out = new Set()
  if (tense === 'perfect') {
    const other = v.aux === 'sein' ? 'haben' : 'sein'
    out.add(`${present({ w: other, f: '' })[i]} ${v.pp}`)                                  // wrong auxiliary
    if (/en$/.test(v.pp)) out.add(`${present({ w: v.aux, f: '' })[i]} ${v.pp.replace(/en$/, 't')}`)   // gefahrt
    else if (/t$/.test(v.pp)) out.add(`${present({ w: v.aux, f: '' })[i]} ${v.pp.replace(/t$/, 'en')}`)
    if (v.prefix) out.add(`${present({ w: v.aux, f: '' })[i]} ge${v.prefix}${v.pp.slice(v.prefix.length + 2)}`)   // geaufstanden
    else if (!v.pp.startsWith('ge')) out.add(`${present({ w: v.aux, f: '' })[i]} ge${v.pp}`)                      // gebesucht
    else out.add(`${present({ w: v.aux, f: '' })[i]} ${v.pp.slice(2)}`)                                           // fahren without ge-
  }
  if (tense === 'present') {
    const pres = present(w)
    const regular = [`${v.stem}e`, `${v.stem}st`, `${v.stem}t`, `${v.stem}en`, `${v.stem}t`, `${v.stem}en`]
    if (regular[i] !== pres[i]) out.add(regular[i])                       // the missed stem change: er fahrt
    pres.forEach((f, k) => { if (f !== pres[i]) out.add(f) })            // another person's ending
  }
  if (tense === 'preterite') {
    const pt = preterite(w)
    if (!/te$/.test(v.past)) out.add([`${v.stem}te`, `${v.stem}test`, `${v.stem}te`, `${v.stem}ten`, `${v.stem}tet`, `${v.stem}ten`][i])   // fahrte
    pt.forEach(f => { if (f !== pt[i]) out.add(f) })
  }
  out.delete(tense === 'perfect' ? perfect(w, i) : tense === 'present' ? present(w)[i] : preterite(w)[i])
  return [...out]
}

export function konj2(w) {
  const v = verbParts(w)
  const base = KONJ2[v.core]
  if (!base) return ['würde', 'würdest', 'würde', 'würden', 'würdet', 'würden'].map(f => `${f} … ${v.inf}`)
  const st = base.replace(/e$/, '')
  return v.core === 'sein' ? ['wäre', 'wärst', 'wäre', 'wären', 'wärt', 'wären'] : [base, `${st}est`, base, `${st}en`, `${st}et`, `${st}en`]
}
const passive = (w, i) => `${present({ w: 'werden', f: '' })[i]} … ${verbParts(w).pp}`

// What the trainer asks, and from which station it is taught (forms unlock as the route reaches them).
const VERB_TENSES = [
  { id: 'present', name: 'Präsens', en: 'present', from: 1, forms: w => present(w) },
  { id: 'imperative', name: 'Imperativ', en: 'command', from: 9 },
  { id: 'perfect', name: 'Perfekt', en: 'past (spoken)', from: 11, forms: w => PERSONS.map((_, i) => perfect(w, i)) },
  { id: 'preterite', name: 'Präteritum', en: 'past (written)', from: 27, forms: w => preterite(w) },
  { id: 'konj2', name: 'Konjunktiv II', en: 'would / could', from: 23, forms: w => konj2(w) },
  { id: 'passive', name: 'Passiv', en: 'passive', from: 26, forms: w => PERSONS.map((_, i) => passive(w, i)) },
]
const ENDINGS = ['est', 'st', 'et', 'en', 'te', 't', 'e', 'n']
const splitEnd = f => { const e = ENDINGS.find(x => f.endsWith(x) && f.length - x.length >= 2) ?? ''; return [f.slice(0, f.length - e.length), e] }

// One question: a person and a verb; the options are the right form and real mistakes.
function verbQuestion(w, tense) {
  const v = verbParts(w)
  const sep = v.prefix ? ` … ${v.prefix}` : ''
  if (tense === 'imperative') {
    const k = Math.floor(Math.random() * 3)
    const right = imperative(w)[k]
    const pres = present(w)
    const wrong = k === 0 ? [`${pres[1]}${sep}!`, `${pres[2]}${sep}!`, `${v.stem}e${sep}!`, `${v.stem}${sep}!`]
      : k === 1 ? [`${pres[1]}${sep}!`, `${pres[3]}${sep}!`, `${pres[4]} ihr${sep}!`] : [`Sie ${pres[3]}${sep}!`, `${pres[3]}${sep}!`, `${pres[4]} Sie${sep}!`]
    const opts = shuffle([right, ...shuffle([...new Set(wrong)].filter(x => x !== right)).slice(0, 3)])
    return { who: ['du', 'ihr', 'Sie'][k], right, opts, a: opts.indexOf(right) }
  }
  const t = VERB_TENSES.find(x => x.id === tense)
  const i = Math.floor(Math.random() * 6)
  const forms = t.forms(w)
  const right = forms[i] + (tense === 'present' || tense === 'preterite' ? sep : '')
  let wrong = tense === 'konj2' ? [forms[i].replace('ü', 'u').replace('ä', 'a').replace('ö', 'o'), ...forms.filter(f => f !== forms[i])]
    : tense === 'passive' ? [`${present({ w: 'sein', f: '' })[i]} … ${v.pp}`, `${present({ w: 'haben', f: '' })[i]} … ${v.pp}`, ...forms.filter(f => f !== forms[i])]
    : verbMistakes(w, tense, i).map(f => f + (tense === 'present' || tense === 'preterite' ? sep : ''))
  wrong = [...new Set(wrong)].filter(f => f !== right)
  const opts = shuffle([right, ...shuffle(wrong).slice(0, 3)])
  return { who: PERSONS[i].split('/')[0], i, right, opts, a: opts.indexOf(right) }
}

function VerbTable({ w, tense }) {
  const t = VERB_TENSES.find(x => x.id === tense)
  if (tense === 'imperative') {
    return html`<table class="vtable" lang="de"><tbody>${['du', 'ihr', 'Sie'].map((p, k) => html`<tr><th>${p}</th><td>${imperative(w)[k]}</td></tr>`)}</tbody></table>`
  }
  const sep = verbParts(w).prefix
  return html`<table class="vtable" lang="de"><tbody>${t.forms(w).map((f, i) => {
    const [stem, end] = tense === 'present' || tense === 'preterite' ? splitEnd(f) : [f, '']
    return html`<tr><th>${PERSONS[i]}</th><td>${stem}<b class="vend">${end}</b>${sep && (tense === 'present' || tense === 'preterite') ? html` <i>… ${sep}</i>` : ''}</td></tr>`
  })}</tbody></table>`
}

function VerbsTrainer({ data }) {
  const s = useStore()
  const verbs = useMemo(() => {
    const ok = data.words.filter(w => w.p === 'v' && w.f && !/\//.test(w.f.replace('hat/ist', '')))
    const mine = ok.filter(w => w.n <= s.lesson)
    return mine.length >= 20 ? mine : ok.slice(0, 40)
  }, [data, s.lesson])
  const open = VERB_TENSES.filter(t => t.from <= Math.max(s.lesson, 1))
  const [on, setOn] = useState(() => open.map(t => t.id))
  const [round, setRound] = useState(0)
  const [picked, setPicked] = useState(null)
  const [table, setTable] = useState(false)
  const [score, setScore] = useState({ right: 0, total: 0 })
  const tenses = on.filter(id => open.some(t => t.id === id))
  const q = useMemo(() => {
    const w = verbs[Math.floor(Math.random() * verbs.length)]
    const tense = tenses[Math.floor(Math.random() * tenses.length)] ?? 'present'
    return w && { w, tense, ...verbQuestion(w, tense) }
  }, [round, verbs, tenses.join()])
  const choose = k => {
    if (picked !== null || !q) return
    setPicked(k)
    setScore(x => ({ right: x.right + (k === q.a), total: x.total + 1 }))
    speak(`${q.tense === 'imperative' ? '' : `${q.who} `}${q.right.replace(/…/g, '')}`)
  }
  const next = () => { setPicked(null); setTable(false); setRound(r => r + 1) }
  useEffect(() => {
    const onKey = e => {
      if (/^[1-4]$/.test(e.key) && q && +e.key <= q.opts.length) choose(+e.key - 1)
      else if ((e.key === 'Enter' || e.key === ' ') && picked !== null && !e.target.closest?.('button, a')) { e.preventDefault(); next() }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })
  const toggle = id => setOn(xs => (xs.includes(id) ? (xs.length > 1 ? xs.filter(x => x !== id) : xs) : [...xs, id]))
  if (!q) return html`<main class="page"><header class="masthead"><h1>Verb forms</h1><p>The verbs are being written now.</p></header></main>`
  const t = VERB_TENSES.find(x => x.id === q.tense)
  const v = verbParts(q.w)
  const [inStem, inEnd] = splitEnd(v.core)
  const [outStem, outEnd] = q.tense === 'present' || q.tense === 'preterite' ? splitEnd(q.right.replace(/ … .*$/, '')) : [q.right, '']
  return html`<main class="page trainer">
    <header class="masthead"><h1>Verb forms</h1>
      <p>Pick the right form. The wrong options are the mistakes learners really make: the wrong helper verb, a missed vowel change, a split prefix in the wrong place.</p></header>
    <div class="modes" role="group" aria-label="Forms to practise">
      ${VERB_TENSES.map(x => {
        const locked = x.from > s.lesson
        return html`<button type="button" disabled=${locked} class=${tenses.includes(x.id) && !locked ? 'on' : ''} aria-pressed=${tenses.includes(x.id)}
          onClick=${() => toggle(x.id)} title=${locked ? `Taught at ${data.stations[x.from].level} station ${data.stations[x.from].k}` : x.en}>
          ${x.name}${locked ? html` <small>from ${data.stations[x.from].level}·${data.stations[x.from].k}</small>` : ''}</button>`
      })}
      <span class="score">${score.right} of ${score.total} right</span>
    </div>
    <article key=${round} class=${`drill verb${picked === null ? '' : picked === q.a ? ' right' : ' wrong'}`}>
      <p class="v-tense">${t.name} <span class="quiet">· ${t.en}</span></p>
      <p class="v-ask" lang="de"><span class="v-who">${q.tense === 'imperative' ? `(${q.who})` : q.who}</span>
        <span class="v-blank">${picked === null ? '___' : q.right}</span></p>
      <p class="v-inf"><span lang="de">${q.w.w}</span> · ${q.w.en}</p>
      <ol class="drill-opts verbs">${q.opts.map((o, k) => html`<li><button type="button" disabled=${picked !== null} onClick=${() => choose(k)}
        class=${picked === null ? '' : k === q.a ? 'right' : k === picked ? 'wrong' : 'dim'}><kbd>${k + 1}</kbd><span lang="de">${o}</span></button></li>`)}</ol>
      ${picked !== null ? html`<div class="drill-why">
        ${q.tense === 'present' || q.tense === 'preterite' ? html`<p class="v-morph" lang="de" aria-label=${`${v.core} becomes ${q.right}`}>
          <span class="v-stem">${inStem}</span><span class="v-old">${inEnd}</span><span class="v-arrow">→</span>
          <span class="v-stem">${outStem}</span><span class="v-new">${outEnd}</span></p>` : ''}
        <p>${picked === q.a ? html`<b>Right.</b> ` : html`<b>It's <span lang="de">${q.who} ${q.right}</span>.</b> `}
          ${q.tense === 'perfect' ? html`<span lang="de">${v.core}</span> takes <b lang="de">${v.aux}</b>${v.aux === 'sein' ? ' (a change of place or state)' : ''}; Partizip II <b lang="de">${v.pp}</b>.` : ''}</p>
        <div class="after">
          <button type="button" onClick=${() => setTable(x => !x)} aria-expanded=${table}>${table ? 'Hide' : 'Show'} the full table</button>
          <button type="button" class="btn" onClick=${next}>Next verb <kbd>Enter</kbd></button>
        </div>
        ${table ? html`<${VerbTable} w=${q.w} tense=${q.tense} />` : ''}
      </div>` : ''}
    </article>
  </main>`
}
PAGES.verbs = VerbsTrainer

// ---- cases and endings ----

const CASES = ['Nominativ', 'Akkusativ', 'Dativ', 'Genitiv']
const GENDERS = [['der', 'masculine'], ['die', 'feminine'], ['das', 'neuter'], ['pl', 'plural']]
const CASE_SETS = {
  'der, die, das': [['der', 'die', 'das', 'die'], ['den', 'die', 'das', 'die'], ['dem', 'der', 'dem', 'den'], ['des', 'der', 'des', 'der']],
  'ein, kein': [['ein', 'eine', 'ein', 'keine'], ['einen', 'eine', 'ein', 'keine'], ['einem', 'einer', 'einem', 'keinen'], ['eines', 'einer', 'eines', 'keiner']],
  'mein, dein …': [['mein', 'meine', 'mein', 'meine'], ['meinen', 'meine', 'mein', 'meine'], ['meinem', 'meiner', 'meinem', 'meinen'], ['meines', 'meiner', 'meines', 'meiner']],
}
const PRONOUNS = [['ich', 'mich', 'mir'], ['du', 'dich', 'dir'], ['er', 'ihn', 'ihm'], ['sie', 'sie', 'ihr'], ['es', 'es', 'ihm'],
  ['wir', 'uns', 'uns'], ['ihr', 'euch', 'euch'], ['sie', 'sie', 'ihnen'], ['Sie', 'Sie', 'Ihnen']]
// adjective endings by case × gender: weak (after der/die/das), mixed (after ein/kein/mein), strong (no article)
export const ADJ = {
  weak: [['e', 'e', 'e', 'en'], ['en', 'e', 'e', 'en'], ['en', 'en', 'en', 'en'], ['en', 'en', 'en', 'en']],
  mixed: [['er', 'e', 'es', 'en'], ['en', 'e', 'es', 'en'], ['en', 'en', 'en', 'en'], ['en', 'en', 'en', 'en']],
  strong: [['er', 'e', 'es', 'e'], ['en', 'e', 'es', 'e'], ['em', 'er', 'em', 'en'], ['en', 'er', 'en', 'er']],
}
const ADJ_NOUNS = [['Kaffee', 'Kaffees'], ['Suppe', 'Suppe'], ['Brot', 'Brotes'], ['Äpfel', 'Äpfel']]   // nominative, genitive
export function adjPhrase(kind, c, g) {
  const art = kind === 'weak' ? CASE_SETS['der, die, das'][c][g] : kind === 'mixed' ? CASE_SETS['ein, kein'][c][g] : ''
  const [noun, gen] = ADJ_NOUNS[g]
  const n = c === 3 ? gen : c === 2 && g === 3 ? 'Äpfeln' : noun
  return [art, `frisch${ADJ[kind][c][g]}`, n].filter(Boolean).join(' ')
}

function CaseTable() {
  const [set, setSet] = useState('der, die, das')
  const [row, setRow] = useState(null)
  const pron = set === 'pronouns'
  const rows = pron ? PRONOUNS : CASE_SETS[set]
  return html`<section class="cases-sec" aria-labelledby="ct-h">
    <h2 id="ct-h">The case table</h2>
    <p class="quiet">Highlighted forms change from the Nominativ: the masculine is the one that changes most (der → den → dem → des).</p>
    <div class="modes" role="group" aria-label="Words in the table">${[...Object.keys(CASE_SETS), 'pronouns'].map(k => html`<button type="button"
      class=${set === k ? 'on' : ''} aria-pressed=${set === k} onClick=${() => { setSet(k); setRow(null) }}>${k}</button>`)}</div>
    <table key=${set} class=${`ctable${pron ? ' pron' : ''}`} lang="de">
      <thead><tr><th></th>${pron ? ['Nominativ', 'Akkusativ', 'Dativ'].map(c => html`<th>${c}</th>`)
        : GENDERS.map(([a, en]) => html`<th class=${`g-${a}`}><span class="art">${a === 'pl' ? 'die' : a}</span><small>${en}</small></th>`)}</tr></thead>
      <tbody>${pron ? rows.map(r => html`<tr>${r.map((f, k) => (k ? html`<td class=${f !== r[0] ? 'chg' : ''}>${f}</td>` : html`<th>${f}</th>`))}<td class="pad"></td></tr>`)
        : rows.map((r, c) => html`<tr class=${row === c ? 'on' : ''} onClick=${() => setRow(row === c ? null : c)}><th>${CASES[c]}</th>
          ${r.map((f, g) => html`<td class=${`g-${GENDERS[g][0]}${f !== rows[0][g] ? ' chg' : ''}`}>${f}</td>`)}</tr>`)}</tbody>
    </table>
  </section>`
}

// Wo? (where something is: dative) or Wohin? (where something goes: accusative), with the nine two-way prepositions.
const SPOTS = { in: [0, 4, 'im', 'in den'], auf: [0, -55, 'auf dem', 'auf den'], unter: [0, 92, 'unter dem', 'unter den'],
  neben: [150, 18, 'neben dem', 'neben den'], vor: [-30, 70, 'vor dem', 'vor den'], hinter: [40, -40, 'hinter dem', 'hinter den'],
  über: [0, -150, 'über dem', 'über den'], an: [-108, 18, 'am', 'an den'] }
function TwoWay() {
  const [prep, setPrep] = useState('in')
  const [mode, setMode] = useState('wo')
  const [x, y, dat, acc] = SPOTS[prep]
  const say = mode === 'wo' ? `Der Ball liegt ${dat} Karton.` : `Ich lege den Ball ${acc} Karton.`
  return html`<section class="cases-sec" aria-labelledby="tw-h">
    <h2 id="tw-h">Wo? or Wohin?</h2>
    <p class="quiet">The same nine prepositions take the Dativ when something <b>is</b> somewhere, and the Akkusativ when it <b>moves</b> there.</p>
    <div class="modes" role="group" aria-label="Question">
      <button type="button" class=${mode === 'wo' ? 'on' : ''} aria-pressed=${mode === 'wo'} onClick=${() => setMode('wo')}>Wo? → Dativ</button>
      <button type="button" class=${mode === 'wohin' ? 'on' : ''} aria-pressed=${mode === 'wohin'} onClick=${() => setMode('wohin')}>Wohin? → Akkusativ</button>
    </div>
    <div class="tw">
      <svg class="tw-scene" viewBox="-260 -200 520 320" role="img" aria-label=${say}>
        <path d="M-250 110 H250" stroke="var(--rule)" stroke-width="4" />
        <g class=${`tw-box${prep === 'in' ? ' open' : ''}`}><rect x="-70" y="-30" width="140" height="100" rx="4" fill="#B98852" /><path d="M-70 -30 H70" stroke="#8A5F33" stroke-width="6" />
          <text x="0" y="60" text-anchor="middle" class="tw-label">der Karton</text></g>
        <g key=${prep + mode} class=${`tw-ball ${mode}`} style=${`--x:${x}px;--y:${y}px`}>
          <circle r="22" fill="var(--die)" /><path d="M-14 -8 a18 18 0 0 1 20 -10" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7" />
        </g>
        ${mode === 'wohin' ? html`<path key=${`arrow${prep}`} class="tw-arrow" d=${`M-210 -150 Q${x / 2 - 120} ${Math.min(y, 0) - 120} ${x} ${y - 30}`} />` : ''}
      </svg>
      <div class="tw-side">
        <div class="tw-preps" role="group" aria-label="Preposition">${Object.keys(SPOTS).map(p => html`<button type="button" lang="de"
          class=${prep === p ? 'on' : ''} aria-pressed=${prep === p} onClick=${() => setPrep(p)}>${p}</button>`)}</div>
        <p class="tw-say" lang="de">${say} <${SayButton} text=${say} /></p>
        <p class="quiet">${mode === 'wo' ? html`Wo liegt der Ball? It is already there: <b lang="de">${dat} Karton</b> (Dativ).`
          : html`Wohin lege ich den Ball? It moves there: <b lang="de">${acc} Karton</b> (Akkusativ).`}
          ${' '}Also zwischen: <span lang="de">zwischen dem Karton und der Tasche</span>.</p>
      </div>
    </div>
  </section>`
}

// Adjective endings: three questions decide the ending; the path taken lights up.
function AdjEndings() {
  const [kind, setKind] = useState('weak')
  const [c, setC] = useState(0)
  const [g, setG] = useState(0)
  const phrase = adjPhrase(kind, c, g)
  const node = (k, label, sub) => html`<button type="button" class=${`ad-node${kind === k ? ' on' : ''}`} aria-pressed=${kind === k} onClick=${() => setKind(k)}>
    <b>${label}</b><small>${sub}</small></button>`
  return html`<section class="cases-sec" aria-labelledby="ad-h">
    <h2 id="ad-h">Adjective endings</h2>
    <p class="quiet">Ask: what stands before the adjective? The article already shows the gender and case, the adjective only adds -e or -en. Without one, the adjective has to show it itself.</p>
    <div class="ad">
      <div class="ad-tree">
        <p class="ad-q">What comes before the adjective?</p>
        <div class="ad-row">${node('weak', 'der, die, das, dieser …', 'weak: -e or -en')}${node('mixed', 'ein, kein, mein …', 'mixed')}${node('strong', 'nothing', 'strong: like der/die/das')}</div>
      </div>
      <div class="ad-pick">
        <div class="modes" role="group" aria-label="Case">${CASES.map((x, k) => html`<button type="button" class=${c === k ? 'on' : ''} aria-pressed=${c === k} onClick=${() => setC(k)}>${x}</button>`)}</div>
        <div class="modes" role="group" aria-label="Gender">${GENDERS.map(([a, en], k) => html`<button type="button" class=${`g-${a}${g === k ? ' on' : ''}`} aria-pressed=${g === k} onClick=${() => setG(k)}>${en}</button>`)}</div>
        <p class=${`ad-out g-${GENDERS[g][0]}`} key=${phrase} lang="de">${phrase.split(' ').map(w => (w.startsWith('frisch') ? html`frisch<b class="ad-end">${w.slice(6)}</b> ` : `${w} `))}</p>
        <table class="ctable small" lang="de"><thead><tr><th></th>${GENDERS.map(([a]) => html`<th class=${`g-${a}`}><span class="art">${a === 'pl' ? 'pl.' : a}</span></th>`)}</tr></thead>
          <tbody>${ADJ[kind].map((r, ci) => html`<tr class=${ci === c ? 'on' : ''}><th>${CASES[ci].slice(0, 3)}</th>${r.map((e, gi) => html`<td class=${ci === c && gi === g ? 'hit' : ''}>-${e}</td>`)}</tr>`)}</tbody></table>
      </div>
    </div>
  </section>`
}

const CASE_GRAMMAR = /accusative|dative|two-way|stellen|acc-pronouns|possessive|adj-|genitive|n-declension|local-preps|articles/
const PREPS = [[['durch', 'für', 'gegen', 'ohne', 'um'], 1], [['aus', 'bei', 'mit', 'nach', 'seit', 'von', 'zu'], 2]]
function casePhraseQuestion(nouns) {
  const w = nouns[Math.floor(Math.random() * nouns.length)]
  const [list, c] = PREPS[Math.floor(Math.random() * 2)]
  const p = list[Math.floor(Math.random() * list.length)]
  const g = { der: 0, die: 1, das: 2 }[w.a]
  const right = CASE_SETS['der, die, das'][c][g]
  const opts = shuffle([...new Set([right, ...CASE_SETS['der, die, das'].map(r => r[g])])]).slice(0, 4)
  if (!opts.includes(right)) opts[0] = right
  const o = shuffle(opts)
  return { q: html`<span lang="de">${p} <span class="gap"></span> ${w.w}</span> <span class="quiet">(<${Word} w=${w} />)</span>`, opts: o, a: o.indexOf(right),
    why: html`<b lang="de">${p}</b> always takes the ${CASES[c]}: <span lang="de">${p} ${right} ${w.w}</span>.`, say: `${p} ${right} ${w.w}` }
}

function CasesPage({ data }) {
  const s = useStore()
  const [quiz, setQuiz] = useState(null)
  const start = () => {
    const nouns = data.words.filter(w => w.p === 'n' && ['der', 'die', 'das'].includes(w.a) && w.n <= Math.max(s.lesson, 12))
    const gqs = data.grammar.filter(g => CASE_GRAMMAR.test(g.id) && g.n <= Math.max(s.lesson, 12)).flatMap(g => data.gq[g.id] ?? [])
    const gen = nouns.length ? Array.from({ length: 6 }, () => casePhraseQuestion(nouns)) : []
    setQuiz(shuffle([...gen, ...gqQuiz(gqs).slice(0, 10 - gen.length)]))
  }
  return html`<main class="page cases">
    <header class="masthead"><h1>Cases and endings</h1>
      <p>German shows a noun's job in the sentence with its article: <span lang="de">der</span> Mann does something, you see <span lang="de">den</span> Mann,
        you give <span lang="de">dem</span> Mann something. English does this only with pronouns: he, him.</p></header>
    <${CaseTable} />
    <${TwoWay} />
    <${AdjEndings} />
    <section class="cases-sec" aria-labelledby="cq-h">
      <h2 id="cq-h">Practice</h2>
      ${quiz ? html`<div class="quiz-box"><${Quiz} key=${quiz} qs=${quiz} again=${start} /></div>`
        : html`<button type="button" class="btn" onClick=${start}>Ten questions on cases <${Arrow} /></button>`}
    </section>
  </main>`
}
PAGES.cases = CasesPage

// ---- der/die/das trainer: a noun appears, tap its article; the ending rule is taught after each answer ----

// der/die/das from the ending, most reliable rules first. Taught after every answer in the gender trainer.
const GENDER_RULES = [
  [/(chen|lein)$/, 'das', '-chen and -lein (small things) are always das'],
  [/(ung|heit|keit|schaft|ion|tät)$/, 'die', '-ung, -heit, -keit, -schaft, -ion and -tät are always die'],
  [/(ling|ismus)$/, 'der', '-ling and -ismus are always der'],
  [/^(Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Frühling|Sommer|Herbst|Winter|Norden|Süden|Osten|Westen|Regen|Schnee|Wind|Nebel)$/,
    'der', 'days, months, seasons, compass points and weather are der'],
  [/(ment|um)$/, 'das', '-ment and -um are usually das'],
  [/(ist|or|ig|ich|eur|ant|ent)$/, 'der', '-ist, -or, -ig, -ich, -eur, -ant and -ent are usually der'],
  [/(ik|ur|enz|anz|ei|ie|age|ade)$/, 'die', '-ik, -ur, -enz, -anz, -ei, -ie and -age are usually die'],
  [/in$/, 'die', '-in for women and female animals is die (die Lehrerin)'],
  [/o$/, 'das', 'short foreign words in -o are usually das (das Auto, das Kino)'],
  [/e$/, 'die', 'most nouns ending in -e are die'],
]
export function genderRule(w, verbs = new Set()) {
  if (/en$/.test(w.w) && verbs.has(w.w.toLowerCase())) return { art: 'das', text: 'verbs used as nouns are das (das Essen)' }
  const r = GENDER_RULES.find(([re]) => re.test(w.w))
  return r && { art: r[1], text: r[2] }
}

// Plurals: the patterns German uses, so the wrong options are mistakes a learner really makes.
export const umlaut = s => s.replace(/(Au|au|A|a|O|o|U|u)([^aeiouäöüAEIOUÄÖÜ]*(?:e[rln])?)$/,
  (_, v, rest) => ({ Au: 'Äu', au: 'äu', A: 'Ä', a: 'ä', O: 'Ö', o: 'ö', U: 'Ü', u: 'ü' })[v] + rest)
function pluralChoices(w) {
  const x = w.w, u = umlaut(x), soft = /(e|e[rln])$/.test(x)
  const c = new Set([/e$/.test(x) || /e[rl]$/.test(x) ? `${x}n` : /en$/.test(x) ? '' : `${x}en`,
    !soft && `${x}e`, !soft && u !== x && `${u}e`, !soft && `${u}er`, `${x}s`, /e[rln]$/.test(x) && x,
    /e[rln]$/.test(x) && u !== x && u].filter(Boolean))
  c.delete(w.pl)
  return shuffle([w.pl, ...shuffle([...c]).slice(0, 3)])
}
export function pluralPattern(sg, pl) {
  const u = umlaut(sg) !== sg && pl.startsWith(umlaut(sg)) && !pl.startsWith(sg) ? 'umlaut + ' : ''
  const end = pl.slice((u ? umlaut(sg) : sg).length)
  return pl === sg ? 'no change' : u && !end ? 'umlaut only' : `${u}-${end}`
}

function GenderTrainer({ data }) {
  useStore()
  const [mode, setMode] = useState('gender')
  const nouns = useMemo(() => {
    const all = data.words.filter(w => w.p === 'n' && (mode === 'gender' ? w.a !== 'pl' : w.pl && w.pl !== '-'))
    const mine = all.filter(w => w.n <= S.lesson)
    return shuffle(mine.length >= 30 ? mine : all.slice(0, Math.max(60, mine.length)))
  }, [data, mode])
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState(null)
  const [score, setScore] = useState({ right: 0, total: 0, streak: 0 })
  const w = nouns[i % Math.max(nouns.length, 1)]
  const choices = useMemo(() => (w && mode === 'plural' ? pluralChoices(w) : ['der', 'die', 'das']), [w, mode])
  const correct = w && (mode === 'gender' ? w.a : w.pl)
  const choose = k => {
    if (picked !== null || !w) return
    setPicked(k)
    const ok = choices[k] === correct
    setScore(x => ({ right: x.right + ok, total: x.total + 1, streak: ok ? x.streak + 1 : 0 }))
    speak(mode === 'gender' ? said(w) : `die ${w.pl}`)
  }
  const next = () => { setPicked(null); setI(x => x + 1) }
  useEffect(() => {
    const onKey = e => {
      if (/^[1-4]$/.test(e.key) && +e.key <= choices.length) choose(+e.key - 1)
      else if ((e.key === 'Enter' || e.key === ' ') && picked !== null && !e.target.closest?.('button, a')) { e.preventDefault(); next() }
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })
  const switchTo = m => { setMode(m); setI(0); setPicked(null) }
  if (!w) return html`<main class="page"><header class="masthead"><h1>der, die, das</h1><p>The nouns are being written now.</p></header></main>`
  const rule = mode === 'gender' && genderRule(w, data.verbSet)
  const ok = picked !== null && choices[picked] === correct
  return html`<main class="page trainer">
    <header class="masthead"><h1>${mode === 'gender' ? 'der, die, das' : 'Plurals'}</h1>
      <p>${mode === 'gender' ? 'Tap the article. After each answer you see the ending rule that decides it, or that the noun is one to learn by heart.'
        : 'Pick the plural. German has a handful of plural patterns; the ending of the noun and its gender predict most of them.'}</p></header>
    <div class="modes" role="group" aria-label="Drill">
      <button type="button" class=${mode === 'gender' ? 'on' : ''} aria-pressed=${mode === 'gender'} onClick=${() => switchTo('gender')}>Gender</button>
      <button type="button" class=${mode === 'plural' ? 'on' : ''} aria-pressed=${mode === 'plural'} onClick=${() => switchTo('plural')}>Plural</button>
      <span class="score">${score.right} of ${score.total} right${score.streak > 2 ? html` · <b>${score.streak} in a row</b>` : ''}</span>
    </div>
    <article key=${w.id + mode} class=${`drill${picked === null ? '' : ok ? ' right' : ' wrong'}${picked !== null && mode === 'gender' ? ` g-${w.a}` : ''}`}>
      <p class="drill-word" lang="de">${mode === 'gender'
        ? html`<span class="drill-art">${picked === null ? '___' : ART[w.a]}</span> ${w.w}`
        : html`<${Word} w=${w} /> → die <span class="drill-art">${picked === null ? '___' : w.pl}</span>`}</p>
      <p class="drill-en">${w.en}</p>
      <ol class=${`drill-opts ${mode}`}>${choices.map((c, k) => html`<li><button type="button" disabled=${picked !== null} onClick=${() => choose(k)}
        class=${`${mode === 'gender' ? `g-${c}` : ''}${picked === null ? '' : c === correct ? ' right' : k === picked ? ' wrong' : ' dim'}`}>
        <kbd>${k + 1}</kbd><span lang="de">${c}</span></button></li>`)}</ol>
      ${picked !== null ? html`<div class="drill-why">
        <p>${ok ? html`<b>Right.</b> ` : html`<b>It's <span lang="de">${mode === 'gender' ? said(w) : `die ${w.pl}`}</span>.</b> `}
          ${mode === 'gender'
            ? rule ? rule.art === w.a ? html`Rule: ${rule.text}.` : html`An exception: ${rule.text}, but <span lang="de">${said(w)}</span> is not. Learn it by heart.`
              : 'No ending rule here: learn it together with its article.'
            : html`Pattern: <b>${pluralPattern(w.w, w.pl)}</b>.`}</p>
        <${Example} w=${w} />
        <button type="button" class="btn" onClick=${next}>Next word <kbd>Enter</kbd></button>
      </div>` : ''}
    </article>
  </main>`
}
PAGES.gender = GenderTrainer
