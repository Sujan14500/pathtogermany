// ---- writing: the station's Schreiben task, in the format of its Goethe part ----
// The task card, its content points ticking off as they show up in the text, a live word count, phrases to insert,
// simple honest hints (no AI), a draft saved as you type, then the model answer and a self-score in the Goethe
// criteria. Progress: S.practice['<station>/write'] keeps the best self-score (for a form, the share of fields right).

// What each Schreiben part is (docs/08-exam-formats.md): its name, icon and the exam's length target.
const WRITE_KIND = {
  A1: { 'Teil 1': ['Formular', 'form', '5 fields'], 'Teil 2': ['Kurze Nachricht', 'note', 'about 30 words'] },
  A2: { 'Teil 1': ['SMS', 'note', '20–30 words'], 'Teil 2': ['E-Mail', 'mail', '30–40 words'] },
  B1: { 'Teil 1': ['Persönliche E-Mail', 'mail', 'about 80 words'], 'Teil 2': ['Forumsbeitrag', 'forum', 'about 80 words'],
    'Teil 3': ['Halbformelle E-Mail', 'mail', 'about 40 words'] },
}
const TASK_ICON = {
  form: html`<rect x="8" y="6" width="24" height="30" rx="2" /><path d="M15 3h10v6H15zM13 17h3M19 17h8M13 23h3M19 23h8M13 29h3M19 29h8" />`,
  note: html`<path d="M7 8h26a3 3 0 0 1 3 3v13a3 3 0 0 1-3 3H17l-7 6v-6H7a3 3 0 0 1-3-3V11a3 3 0 0 1 3-3z" /><path d="M11 15h18M11 20h11" />`,
  mail: html`<rect x="4" y="9" width="32" height="22" rx="3" /><path d="M5 11l15 11 15-11" />`,
  forum: html`<path d="M4 6h20a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H12l-5 4v-4H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" /><path d="M30 13h5a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2v4l-5-4H18a2 2 0 0 1-2-2v-1" />`,
  speak: html`<rect x="15" y="4" width="10" height="19" rx="5" /><path d="M9 18a11 11 0 0 0 22 0M20 29v6M14 35h12" />`,
}
const TaskIcon = ({ kind }) => html`<svg class="w-icon" viewBox="0 0 40 40" aria-hidden="true">${TASK_ICON[kind]}</svg>`

// The exam sheet's head: module and part, what kind of text, the level, and the target.
const TaskHead = ({ t, kind, mod, name, extra }) => html`<header class="w-head">
  <${TaskIcon} kind=${kind} />
  <p class="w-mod"><b>${mod} ${t.part}</b><span lang="de">${name}</span></p>
  ${extra ? html`<span class="w-extra">${extra}</span>` : ''}<span class="lb">${t.level}</span>
</header>`

// The German instruction (a forum opinion „…“ – Name drawn as a post), then the English.
const TaskText = ({ t }) => html`<div class="w-de" lang="de">${t.task_de.split('\n').map(l => {
  const q = l.match(/^„(.+)“\s*–\s*(.+)$/)
  return q ? html`<figure class="w-post"><span class="w-post-av" aria-hidden="true">${q[2][0]}</span><figcaption>${q[2]}</figcaption><blockquote>${q[1]}</blockquote></figure>`
    : html`<p>${l}</p>`
})}</div><p class="w-en">${t.task_en}</p>`

// A draft per task in S.drafts[id]; typing saves at most every 600 ms, a click at once, and leaving saves too.
// set(patch) takes the changed fields, or a function of the latest draft (for quick clicks between renders).
function useDraft(id) {
  const [d, setD] = useState(() => ({ ...(S.drafts[id] ?? {}) }))
  const latest = useRef(d), timer = useRef(null)
  const save = () => { clearTimeout(timer.current); timer.current = null; commit(s => { s.drafts[id] = latest.current }) }
  const set = (patch, now) => {
    latest.current = { ...latest.current, ...(typeof patch === 'function' ? patch(latest.current) : patch) }
    setD(latest.current)
    clearTimeout(timer.current)
    timer.current = setTimeout(save, now ? 0 : 600)
  }
  useEffect(() => () => { if (timer.current) save() }, [])
  return [d, set]
}

// ---- the hints: simple checks a teacher would make first. They can't judge content; they say so. ----

export const countWords = s => (s.match(/[\p{L}\p{N}]+(?:[-'’.:][\p{L}\p{N}]+)*/gu) ?? []).length   // E-Mail, z.B., 18:00: one word each
const GREETING_RE = /^\s*(liebe[rs]?|hallo|hi|sehr geehrte[rs]?|guten (tag|morgen|abend)|moin|servus)(?!\p{L})/iu
// A closing near the end, maybe followed by a name of up to three words.
const CLOSING_RE = /(grüße|grüßen|gruß|tschüss|ciao|besserung|bis (bald|später|dann|morgen|gleich|nächste\p{L}*|\p{L}+tag)|danke(schön)?|vielen dank)(?!\p{L})[^\p{L}]*(\p{L}+[^\p{L}]*){0,3}$/iu
const sentencesOf = s => s.split(/(?<=\D[.!?])\s+|\n+/).map(x => x.trim()).filter(Boolean)

// du-forms, and Sie-forms not at a sentence start (there "Sie" may mean she or they).
function registerOf(s) {
  const du = (s.match(/(?<!\p{L})(du|dich|dir|dein|deine|deinen|deinem|deiner|deines|euch|euer|eure)(?!\p{L})/giu) ?? []).length
  const sie = (s.match(/(?<=\p{Ll}[,;]?\s+)(Sie|Ihnen|Ihr|Ihre|Ihren|Ihrem|Ihrer|Ihres)(?!\p{L})/gu) ?? []).length + (/sehr geehrte/i.test(s) ? 1 : 0)
  return { du, sie }
}

// A time or place word first, then the subject: "Heute ich gehe" (the verb belongs in position 2).
const V2_ADV = 'heute|morgen|gestern|jetzt|dann|danach|später|zuerst|leider|vielleicht|deshalb|darum|trotzdem|außerdem|natürlich|hier|dort|'
  + 'abends|morgens|mittags|nachmittags|vormittags|manchmal|bald|endlich|zum glück|am \\p{L}+|im \\p{L}+|um [\\p{L}\\d.:]+(?:\\s+uhr)?|'
  + '(?:in|nach|vor) (?:der |dem |den |die |das )?\\p{L}+|nächste[nrs]? \\p{L}+|letzte[nrs]? \\p{L}+|jede[nrs]? \\p{L}+'
const V2_WRONG = new RegExp(`(?:^|(?<!\\p{L})(?:und|aber|oder|denn)\\s+)(${V2_ADV}),?\\s+(ich|du|er|sie|es|wir|ihr|man)\\s+(\\p{L}+)`, 'giu')
const NOT_VERB = new Set('und oder aber auch nicht noch schon sehr gern gerne immer oft wirklich heute morgen jetzt dann'.split(' '))
// After weil, dass, wenn … the finite verb goes to the end: "weil ich bin müde" → "weil ich müde bin". Only common
// verbs are checked, so a hit is nearly always right (ponytail: a word list, not a parser).
const SUB_WRONG = /(?<!\p{L})(weil|dass|wenn|obwohl|ob|als|bevor|nachdem|damit|falls)\s+(ich|du|er|sie|es|wir|ihr|man)\s+(\p{L}+)((?:\s+[^\s,.!?;:]+)+)/giu
const FINITE = new Set(('bin bist ist sind seid war warst waren habe hast hat haben habt hatte hattest hatten kann kannst können könnt konnte '
  + 'konnten muss musst müssen müsst musste mussten will willst wollen wollt wollte möchte möchtest möchten soll sollst sollen darf '
  + 'darfst dürfen werde wirst wird werden würde würdest würden gehe gehst geht gehen komme kommst kommt kommen').split(' '))
const LONG = { A1: 18, A2: 22, B1: 30 }

// The course's nouns by their lower-case spelling, for "nouns take a capital": only words that aren't also something
// else in lower case (essen, morgen, leid).
let nounIx = null
function nounIndex() {
  if (nounIx || !D) return nounIx ?? new Map()
  const other = new Set(D.words.filter(w => w.p !== 'n').flatMap(w => wordForms(w)).map(f => f.toLowerCase()))
  'weg mal recht leid schuld angst dank klasse spitze ernst morgen abend'.split(' ').forEach(x => other.add(x))
  nounIx = new Map()
  for (const w of D.words) {
    if (w.p !== 'n') continue
    for (const f of [w.w, ...(w.pl && w.pl !== '-' ? [w.pl] : [])]) {
      const l = f.toLowerCase()
      if (f.length > 2 && f[0] !== l[0] && !/\s/.test(f) && !other.has(l)) nounIx.set(l, f)
    }
  }
  return nounIx
}

export function writingHints(text, t, nouns = new Map()) {
  const out = [], n = countWords(text)
  if (!n) return out
  const lo = t.words?.[0] || 0, hi = t.words?.[1] || 0
  const example = re => t.phrases?.find(p => re.test(p[0]))?.[0]
  if (n >= 3 && GREETING_RE.test(t.model) && !GREETING_RE.test(text)) out.push({ k: 'frame', en: 'Start with a greeting.', de: example(GREETING_RE) ?? 'Liebe …,' })
  if (n >= lo * .6 && CLOSING_RE.test(t.model) && !CLOSING_RE.test(text.trim())) out.push({ k: 'frame', en: 'End with a closing and your name.', de: example(CLOSING_RE) ?? 'Viele Grüße' })
  const want = registerOf(t.model), mine = registerOf(text)
  const reg = want.sie > want.du ? 'Sie' : want.du ? 'du' : null
  if (mine.du && mine.sie) out.push({ k: 'reg', en: `You use both du and Sie. Stay with ${reg ?? 'one of them'} all the way through.` })
  else if (reg === 'du' && mine.sie) out.push({ k: 'reg', en: 'You say du to this reader: du, dir, dein, not Sie, Ihnen, Ihr.' })
  else if (reg === 'Sie' && mine.du) out.push({ k: 'reg', en: 'This reader gets the polite Sie: Sie, Ihnen, Ihr, not du, dir, dein.' })
  const ss = sentencesOf(text)
  let v2 = 0, vEnd = 0
  for (const s0 of ss) {
    const s = s0.replace(/^[^,]*,\s*/, g => (GREETING_RE.test(g) ? '' : g))   // "Lieber Felix, heute ich …": the clause after the greeting
    for (const m of s.matchAll(V2_WRONG)) {
      if (v2++ >= 2) break
      const ok = !NOT_VERB.has(m[3].toLowerCase())
      out.push({ k: 'order', en: `After “${m[1]}” at the start, the verb comes next (position 2).`, de: `${m[1]} ${m[2]} ${m[3]} → ${ok ? `${m[1]} ${m[3]} ${m[2]}` : `${m[1]} [verb] ${m[2]}`}` })
    }
    for (const m of s.matchAll(SUB_WRONG)) {
      if (!FINITE.has(m[3].toLowerCase())) continue
      const rest = m[4].trim().split(/\s+/)
      const cut = rest.findIndex(w => /^(und|oder|aber|sondern|denn)$/i.test(w))
      const mid = cut < 0 ? rest : rest.slice(0, cut)
      if (!mid.length || vEnd++ >= 2) continue
      out.push({ k: 'order', en: `After “${m[1]}” the verb goes to the end.`, de: `${m[1]} ${m[2]} ${m[3]} ${mid.join(' ')} → ${m[1]} ${m[2]} ${mid.join(' ')} ${m[3]}` })
    }
  }
  const low = [...new Set((text.match(/\p{L}+/gu) ?? []).filter(w => w === w.toLowerCase() && nouns.has(w)))]
  if (low.length) out.push({ k: 'caps', en: 'Nouns start with a capital letter.', de: low.slice(0, 4).map(w => `${w} → ${nouns.get(w)}`).join(', ') })
  const long = ss.map(countWords).find(c => c > (LONG[t.level] ?? 25))
  if (long) out.push({ k: 'long', en: `One sentence has ${long} words. Split it: short sentences hold fewer mistakes.` })
  const has = re => re.test(text)
  if (t.level === 'A2' && n >= 30 && !has(/(?<!\p{L})(und|aber|oder|denn|weil|dass|deshalb|trotzdem|wenn|dann|als)(?!\p{L})/iu)) {
    out.push({ k: 'link', en: 'Link your ideas: und, aber, denn, weil, deshalb.' })
  } else if (t.level === 'B1' && n >= 60) {   // the 80-word parts; a 40-word semi-formal email can be plain
    if (!has(/(?<!\p{L})(weil|dass|wenn|obwohl|als|ob|damit|nachdem|bevor|während|falls)(?!\p{L})/iu)) out.push({ k: 'link', en: 'No weil, dass, wenn or obwohl yet. B1 rewards linked sentences.' })
    else if (ss.length >= 4 && n / ss.length < 6) out.push({ k: 'link', en: 'Your sentences are all short. Join some with weil, dass, deshalb or obwohl.' })
  }
  if (hi && n > hi * 1.25) out.push({ k: 'long', en: `${n} words, well over ${hi}. The exam gives no points for extra length.` })
  return out
}

// Is a content point in the text? A guess from the point's key words (stems, so wohnen finds wohne), plus a few
// ideas that hide behind other words (a reason → weil, denn; a suggestion → wollen wir …). A point that asks for a
// question needs a "?". Names from the English task (Jonas, Lena) don't count as key words.
const PSTOP = new Set(('sie ihr ihre ihren ihrem ihrer ihnen sich wo wer was wann wie warum wen wem wohin woher welche welcher welches jetzt '
  + 'ist sind der die das den dem des ein eine einen einem einer und oder zu zum zur mit für von vor bei nach auf an am im in um aus frage fragen '
  + 'bitte bitten sagen nennen machen beschreiben begründen erklären schlagen stellen kurz etwas nicht es man ich wir du soll sollen können kann '
  + 'möchte hat haben wird sein noch auch über dort hier diese dieser dieses gibt kommen gehen').split(' '))
const CONCEPTS = [
  [/grund|warum/i, /(?<!\p{L})(weil|denn|deshalb|darum|grund|krank|arzt|termin|fieber|muss)|schmerz/iu],
  [/vorschlag|schlagen|lade|treffen/i, /(?<!\p{L})(wollen wir|sollen wir|können wir|könnten wir|lass uns|wie wäre|(hast|hättest|haben|hätten) (du|sie) lust|vorschlag|schlage|treffen wir|kommst du|kommen sie|willst du|möchtest du|man sollte)/iu],
  [/entschuldig/i, /(?<!\p{L})(leid|entschuldig|sorry|verzeih)/iu],
  [/dank/i, /(?<!\p{L})dank/iu],
  [/meinung/i, /(?<!\p{L})(meinung|finde|denke|glaube|stimme|verstehe)/iu],
  [/vorteil|nachteil/i, /(?<!\p{L})(vorteil|nachteil|positiv|negativ|praktisch|problem|chance|einerseits|andererseits)/iu],
  [/beispiel|erfahrung|ihrem leben|umfeld/i, /(?<!\p{L})(beispiel|z\. ?b\.|als ich|ich habe|bei uns|bei mir|in meine[mr]|meine? (firma|familie|freund|stadt|schule))/iu],
  [/problem|passiert/i, /(?<!\p{L})(problem|kaputt|funktioniert nicht|geht nicht|leider|verpasst)/iu],
  [/(?<!\p{L})wann(?!\p{L})|termin|zeit/iu, /(\d{1,2}(:\d\d)?\s*uhr|um \d|um (halb|viertel)|(?<!\p{L})(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|wochenende|morgen|übermorgen|heute|abend|nächste))/iu],
  [/was sie haben/i, /schmerz|krank|fieber|erkält|husten|grippe|(?<!\p{L})weh(?!\p{L})/iu],
  [/regen/i, /regn|regen/iu],
  [/früher|gemacht/i, /(?<!\p{L})(ge\p{L}{3,}(t|en)|war|waren|hatte|früher)(?!\p{L})/iu],
  [/stellen sie sich|vorstellen/i, /(?<!\p{L})(ich heiße|ich bin|mein name)/iu],
  [/gibt es/i, /(?<!\p{L})gibt(?!\p{L})/iu],
  [/bitten sie|hilfe/i, /(?<!\p{L})(kannst du|können sie|könntest du|könnten sie|bitte|hilf|helf)/iu],
  [/preis|kost/i, /(?<!\p{L})(kost|preis|euro|teuer|billig)|€/iu],
  [/(?<!\p{L})gut(?!\p{L})/iu, /(?<!\p{L})(besser|gesund|gesünder|fit|energie|spaß|gut)/iu],
  [/informier/i, /(?<!\p{L})(lese|höre|sehe|schaue|nachrichten|zeitung|handy|internet|radio|fernseh)/iu],
]
// What in the text looks like the point (a word, or a phrase like "um elf"), or null. Shown beside the tick, so the
// learner can see why it was ticked and judge it (ponytail: key words, not understanding; "Wann …" ticks on any time).
export function pointEvidence(text, point, names = '') {
  if (/^(Frage|Fragen Sie)/.test(point) && !text.includes('?')) return null
  const toks = text.match(/\p{L}+/gu) ?? []
  const skip = new Set((names.match(/\p{Lu}\p{L}+/gu) ?? []).map(x => x.toLowerCase()))
  const keys = (point.match(/\p{L}+/gu) ?? []).map(w => w.toLowerCase()).filter(w => w.length >= 4 && !PSTOP.has(w) && !skip.has(w))
  for (const k of keys) { const st = k.slice(0, Math.max(4, k.length - 2)), hit = toks.find(x => x.toLowerCase().includes(st)); if (hit) return hit }
  for (const [p, re] of CONCEPTS) { const m = p.test(point) && text.match(re); if (m) return m[0].trim() }
  return null
}
export const pointFound = (text, point, names) => pointEvidence(text, point, names) !== null

// ---- self-scoring in the Goethe criteria ----

// Each criterion: its German name, what it means, which of a task's rubric lines belong to it (the last one takes the
// rest), and its own line when the task has none for it. Speaking tasks have no rubric lines, so they use these.
const CRITERIA = {
  write: {
    A1: [{ de: 'Erfüllung der Aufgabenstellung', en: 'the three points', re: /point|answered/i, line: 'All three points are answered' },
      { de: 'Kommunikative Gestaltung', en: 'right for the reader', re: /greet|clos|forms? for|du and|du with|Sie and|throughout|polite|friendly|formal/i, line: 'A greeting, a closing, and du or Sie as fits the reader' },
      { de: 'Sprache', en: 'words and forms', line: 'The verb in position 2; nouns with capital letters' }],
    A2: [{ de: 'Erfüllung der Aufgabenstellung', en: 'the three points', re: /point|answered/i, line: 'All three points are answered' },
      { de: 'Kommunikative Gestaltung', en: 'right for the reader, ideas linked', re: /greet|clos|forms? for|du and|du with|Sie and|throughout|polite|friendly|formal|frame|connector/i, line: 'A greeting and closing that fit the reader' },
      { de: 'Formale Richtigkeit', en: 'correct forms', line: 'The verb in position 2, and at the end after weil and dass' }],
    B1: [{ de: 'Erfüllung', en: 'points, text type, register, length', re: /^(?!.*(link|connector)).*(point|words|react|opinion|greet|clos|Sie\b|Sie-|throughout|polite|friendly|short)/i, line: 'All three points, in the right register' },
      { de: 'Kohärenz', en: 'ideas linked into one text', re: /link|connector/i, line: 'Ideas are linked: weil, deshalb, aber, außerdem' },
      { de: 'Wortschatz', en: 'range and fit of the words', re: /vocabulary|word choice/i, line: 'Words fit the topic, without the same ones again and again' },
      { de: 'Strukturen', en: 'grammar range and accuracy', line: 'Varied sentences; few errors that hinder understanding' }],
  },
  speak: {
    A1: [{ de: 'Aufgabenerfüllung', en: 'the task', line: ['I used every card', 'My questions and answers fit the cards', 'A listener would understand every word'] }],
    A2: [{ de: 'Aufgabenerfüllung', en: 'the task', line: ['I covered every card or prompt', 'I reacted to what my partner said'] },
      { de: 'Wortschatz und Strukturen', en: 'words and grammar', line: ['I found the words I needed, or said it another way', 'The verb in position 2, and at the end after weil'] },
      { de: 'Aussprache', en: 'pronunciation', line: ['Clear sounds: ü, ö, ch, r'] }],
    B1: [{ de: 'Erfüllung', en: 'the task', line: ['I covered every point on the cards or slides'] },
      { de: 'Kohärenz', en: 'linked, easy to follow', line: ['My ideas were linked: zuerst, dann, deshalb, außerdem'] },
      { de: 'Wortschatz', en: 'range of words', line: ['When a word was missing, I said it another way'] },
      { de: 'Strukturen', en: 'grammar', line: ['Verb second; verb at the end after weil and dass'] },
      { de: 'Aussprache', en: 'pronunciation and melody', line: ['Clear sounds and a natural melody'] }],
  },
}
function rubricGroups(mod, level, lines = []) {
  const cs = CRITERIA[mod][level]
  const groups = cs.map(c => ({ de: c.de, en: c.en, lines: [] }))
  for (const l of lines) { const i = cs.findIndex(c => c.re?.test(l)); groups[i < 0 ? cs.length - 1 : i].lines.push(l) }
  groups.forEach((g, i) => { if (!g.lines.length) g.lines.push(...[].concat(cs[i].line)) })
  return groups
}
const rubricKeys = groups => groups.flatMap((g, gi) => g.lines.map((_, li) => `${gi}.${li}`))
const rubricScore = (groups, v = {}) => { const ks = rubricKeys(groups); return ks.every(k => v[k] !== undefined) ? ks.reduce((a, k) => a + v[k], 0) / ks.length : null }
const RATES = [[1, 'Yes'], [.5, 'Partly'], [0, 'Not yet']]

function SelfScore({ groups, value = {}, onRate }) {
  const score = rubricScore(groups, value)
  const left = rubricKeys(groups).filter(k => value[k] === undefined).length
  return html`<section class="w-rubric" aria-label="Score yourself">
    <h3>Score yourself</h3>
    <p class="quiet">In the Goethe criteria. Be strict: in the exam an examiner scores this part.</p>
    ${groups.map((g, gi) => html`<div class="w-crit">
      <p class="w-crit-h"><b lang="de">${g.de}</b> <span>${g.en}</span></p>
      <ul>${g.lines.map((l, li) => {
        const k = `${gi}.${li}`
        return html`<li><span>${l}</span><span class="w-seg" role="group" aria-label=${l}>${RATES.map(([x, label]) => html`<button type="button"
          aria-pressed=${value[k] === x} class=${value[k] === x ? `on r${x * 2}` : ''} onClick=${() => onRate(k, x)}>${label}</button>`)}</span></li>`
      })}</ul>
    </div>`)}
    <div class="w-total">${score === null ? html`<span class="quiet">${plural(left, 'line')} to rate.</span>`
      : html`<span class=${`stamp ${score >= .6 ? 'pass' : 'fail'}`}>${score >= .6 ? 'Bestanden' : 'Noch nicht'}</span>
        <p><b>${pct(score)}</b> by your own count. 60% passes.</p>`}</div>
  </section>`
}
// Rating a line saves it in the draft; once every line is rated, the station keeps the best score.
const rateIn = (set, groups, key) => (k, x) => set(d => {
  const v = { ...(d.rubric ?? {}), [k]: x }, sc = rubricScore(groups, v)
  if (sc !== null) commit(s => { s.practice[key] = Math.max(s.practice[key] ?? 0, sc) })
  return { rubric: v }
}, true)

// ---- the writing task ----

function WordMeter({ n, lo, hi }) {
  const max = hi * 1.4, st = n < lo ? 'under' : n <= hi * 1.25 ? 'ok' : 'over'
  return html`<div class=${`w-meter ${st}`}>
    <div class="w-track" aria-hidden="true"><span class="w-zone" style=${`left:${lo / max * 100}%;width:${(hi - lo) / max * 100}%`}></span>
      <i style=${`width:${Math.min(n, max) / max * 100}%`}></i></div>
    <p><b>${n}</b> ${n === 1 ? 'word' : 'words'} <span class="quiet">· aim for ${lo}–${hi}</span> ${st === 'under' ? html`<span class="quiet">· ${lo - n} to go</span>`
      : st === 'ok' ? html`<span class="w-ok">· in range</span>` : html`<span class="w-over">· longer than needed</span>`}</p>
  </div>`
}

const isFrame = de => GREETING_RE.test(de) || CLOSING_RE.test(de)
function WriteTask({ t, n }) {
  const [d, set] = useDraft(t.id)
  const [en, setEn] = useState(false)
  const ta = useRef()
  const text = d.text ?? ''
  const count = countWords(text)
  const [lo, hi] = t.words
  const need = Math.ceil(lo * .6)
  const auto = useMemo(() => t.points.map(p => pointEvidence(text, p, t.task_en)), [text])
  const ticked = t.points.map((_, i) => d.ticks?.[i] ?? auto[i] !== null)
  const hints = useMemo(() => writingHints(text, t, nounIndex()), [text])
  const missing = count >= need ? t.points.map((p, i) => [p, i]).filter(([, i]) => !ticked[i]) : []
  const all = [...missing.map(([p, i]) => ({ k: 'point', en: `Point ${i + 1} may be missing (none of its key words are in your text). Tick it if you wrote it another way.`, de: p })), ...hints]
  const groups = rubricGroups('write', t.level, t.rubric)
  // A phrase goes in at the cursor; its first … is selected, so typing fills the gap. Greetings and closings get their own line.
  const insert = de => {
    const el = ta.current, a = el.selectionStart ?? text.length, b = el.selectionEnd ?? a
    const before = text.slice(0, a), after = text.slice(b)
    const ins = (CLOSING_RE.test(de) && before && !/\n$/.test(before) ? '\n' : before && !/\s$/.test(before) ? ' ' : '') + de + (isFrame(de) ? '\n' : ' ')
    set({ text: before + ins + after })
    const gap = ins.indexOf('…'), at = before.length + (gap < 0 ? ins.length : gap)
    setTimeout(() => { el.focus(); el.setSelectionRange(at, gap < 0 ? at : at + 1) })
  }
  const done = () => {
    set({ done: true }, true)
    setTimeout(() => document.querySelector('.w-after')?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' }), 60)
  }
  const kind = WRITE_KIND[t.level][t.part]
  return html`<div class="w-task">
    <div class="w-main">
      <article class="w-card">
        <${TaskHead} t=${t} kind=${kind[1]} mod="Schreiben" name=${kind[0]} extra=${kind[2]} />
        <${TaskText} t=${t} />
        <ol class="w-points" aria-label="Content points">${t.points.map((p, i) => html`<li class=${ticked[i] ? 'on' : ''}>
          <button type="button" role="checkbox" aria-checked=${ticked[i]} onClick=${() => set({ ticks: { ...(d.ticks ?? {}), [i]: !ticked[i] } }, true)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M7 12.5l3.2 3.2L17 9" /></svg>
            <span lang="de">${p}</span>${ticked[i] && d.ticks?.[i] === undefined ? html`<small>found <q lang="de">${auto[i]}</q></small>` : ''}</button></li>`)}</ol>
      </article>
      <section class="w-editor">
        <textarea ref=${ta} lang="de" spellcheck="true" aria-label="Your text" rows=${lo > 60 ? 11 : 8} value=${text}
          placeholder=${t.phrases.find(p => GREETING_RE.test(p[0]))?.[0] ?? 'Schreiben Sie hier …'} onInput=${e => set({ text: e.target.value })}></textarea>
        <${WordMeter} n=${count} lo=${lo} hi=${hi} />
        <div class="w-actions">
          ${d.done ? html`<span class="quiet">Saved as you type. The model answer and your self-score are below.</span>`
            : html`<button type="button" class="btn" disabled=${count < need} onClick=${done}>${count < need ? `Write at least ${need} words first` : html`I'm done: show the model answer <${Arrow} />`}</button>
              <span class="quiet">${text ? 'Saved as you type.' : ''}</span>`}
          ${text ? html`<button type="button" class="linkish" onClick=${() => { if (confirm('Clear your text and start this task again?')) set({ text: '', ticks: {}, done: false, rubric: {} }, true) }}>Start again</button>` : ''}
        </div>
      </section>
    </div>
    <aside class="w-side">
      <section class="w-box w-hints">
        <h3>Hints <small>simple checks, no AI</small></h3>
        ${!count ? html`<p class="quiet">Start writing: hints appear here as you type.</p>`
          : all.length ? html`<ul>${all.map(h => html`<li key=${h.en + h.de} class=${`w-h-${h.k}`}><span>${h.en}</span>${h.de ? html`<span class="w-hint-de" lang="de">${h.de}</span>` : ''}</li>`)}</ul>`
          : html`<p class="w-hint-none">These checks found nothing. They can't see everything, so compare with the model when you're done.</p>`}
      </section>
      <section class="w-box w-phrases">
        <h3>Useful phrases <small>click to insert</small></h3>
        <ul>${t.phrases.map(([de, e]) => html`<li><button type="button" onClick=${() => insert(de)}>
          <b lang="de">${de}</b><small>${e}</small><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 6v12M6 12h12" /></svg></button></li>`)}</ul>
      </section>
    </aside>
  </div>
    ${d.done ? html`<section class="w-after" aria-label="Model answer and self-score">
      <article class="w-model">
        <header><h3>Model answer</h3><${SayButton} text=${t.model} label="the model answer" />
          <label class="check"><input type="checkbox" checked=${en} onChange=${e => setEn(e.target.checked)} /> English</label></header>
        <p class="w-model-de" lang="de">${t.model}</p>
        ${en ? html`<p class="w-model-en">${t.model_en}</p>` : ''}
        <p class="quiet">${countWords(t.model)} words; yours has ${count}. Yours can be different and still score full marks.</p>
      </article>
      <${SelfScore} groups=${groups} value=${d.rubric} onRate=${rateIn(set, groups, `${n}/write`)} />
    </section>` : ''}`
}

// A1 Teil 1: read a short text about someone and fill in a form for them.
// Case, spacing, € and the English-keyboard spellings (Koeln for Köln) don't count as mistakes.
const normField = s => (s ?? '').toLowerCase().replace(/€|euro/g, '').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^\p{L}\p{N}]/gu, '')
function FormTask({ t, n }) {
  const [d, set] = useDraft(t.id)
  const fs = t.form.fields
  const rightIn = x => fs.map(([, a], i) => normField(x.fields?.[i]) === normField(a) || !!x.same?.[i])
  const right = rightIn(d)
  const vals = d.fields ?? fs.map(() => '')
  // Checking, and "mine means the same", score the form; the station keeps the best share of fields right.
  const score = patch => set(x => {
    const y = { ...x, ...patch }, r = rightIn(y).filter(Boolean).length / fs.length
    commit(s => { s.practice[`${n}/write`] = Math.max(s.practice[`${n}/write`] ?? 0, r) })
    return patch
  }, true)
  const type = (i, v) => set(x => {
    const f = [...(x.fields ?? fs.map(() => ''))], sm = { ...x.same }
    f[i] = v; delete sm[i]
    return { fields: f, same: sm, checked: false }
  })
  return html`<div class="w-form">
    <article class="w-card">
      <${TaskHead} t=${t} kind="form" mod="Schreiben" name="Formular" extra="5 fields" />
      <${TaskText} t=${t} />
      <div class="w-source"><p lang="de">${t.form.text_de}</p><${SayButton} text=${t.form.text_de} label="the text" /></div>
    </article>
    <form class="w-formcard" onSubmit=${e => { e.preventDefault(); score({ checked: true }) }}>
      <p class="w-form-h" lang="de">Anmeldung</p>
      ${fs.map(([label, ans], i) => html`<label class=${`w-ff${d.checked ? (right[i] ? ' right' : ' wrong') : ''}`}>
        <span lang="de">${label}</span>
        <input lang="de" spellcheck="false" autocomplete="off" value=${vals[i]} onInput=${e => type(i, e.target.value)} />
        ${d.checked && !right[i] ? html`<small>The text says <b lang="de">${ans}</b>. <button type="button" class="linkish"
          onClick=${() => score({ same: { ...d.same, [i]: true } })}>Mine means the same</button></small>` : ''}
      </label>`)}
      <div class="w-form-foot"><button class="btn" type="submit">Check the form</button>
        ${d.checked ? html`<p><b>${right.filter(Boolean).length} of ${fs.length}</b> right. ${right.every(Boolean) ? 'Every field, as in the exam.' : 'Read the text again for the others.'}</p>` : ''}</div>
    </form>
  </div>`
}

// The other tasks of the same part and level, one per station, for more practice of one exam format.
function MoreTasks({ items, t, tab, mod }) {
  const more = items.filter(x => x.level === t.level && x.part === t.part && x.id !== t.id)
  return more.length ? html`<nav class="w-more" aria-label=${`More ${mod} ${t.part} tasks`}><span class="quiet">More ${mod} ${t.part} at ${t.level}:</span>
    ${more.map(x => html`<a href=${`#/station/${x.n}/${tab}`} lang="de">${D.stations[x.n].de}</a>`)}</nav>` : ''
}

function WriteTab({ data, n }) {
  useStore()
  const t = data.writingBy[n]?.[0]
  if (!t) return html`<p class="soon">This station's writing task is being written now: a Goethe Schreiben task with a checklist, word count and model answer.</p>`
  const Task = t.form ? FormTask : WriteTask
  return html`<${Task} key=${t.id} t=${t} n=${n} /><${MoreTasks} items=${data.writing} t=${t} tab="write" mod="Schreiben" />`
}
TAB_VIEWS.write = WriteTab
