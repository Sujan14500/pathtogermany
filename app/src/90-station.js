// ---- station page: one tab per part, each tab its own address ----

const SOON = {
  words: "This station's words, each noun with its article and plural, audio and a quick quiz.",
  grammar: 'Each point with a plain-English explanation, examples lined up with English, and a sentence builder.',
  read: 'An original text in the Goethe Lesen format, with tap-to-translate and exam questions.',
  listen: 'Dialogues and announcements read by German voices, with Hören-style questions.',
  write: 'An exam writing task with a checklist, word count, useful phrases and a model answer.',
  speak: 'An exam speaking task with timers, recording and a model answer.',
  pictures: 'A drawn scene where every object is a word of this station.',
  test: 'A short station test in exam formats. 60% passes.',
}

function Station({ data, n, tab }) {
  const s = useStore()
  const st = data.stations[n]
  if (!st) return html`<main class="empty"><p>There is no station ${n}. <a href="#/">Back to today</a></p></main>`
  const t = TAB_NAME[tab] ? tab : 'words'
  const View = TAB_VIEWS[t]   // registered by the tab's own fragment
  return html`<main class=${`station l${st.level}`}>
    <${Board} data=${data} n=${n} />
    <div class="station-bar">
      <nav class="tabs" aria-label="Station parts">${TABS.map(([id, label]) => html`<a href=${`#/station/${n}/${id}`}
        class=${id === t ? 'on' : ''} aria-current=${id === t ? 'page' : null}>${label}</a>`)}</nav>
      ${n === s.lesson ? html`<span class="you">Your current stop</span>`
        : html`<button type="button" onClick=${() => commit(x => { x.lesson = n })}>Make this my current stop</button>`}
    </div>
    <section class="tab-body" aria-label=${TAB_NAME[t]}>
      ${View ? html`<${View} data=${data} n=${n} />` : html`<p class="soon">${SOON[t]} <span class="quiet">Being written now.</span></p>`}
    </section>
  </main>`
}

function Soon({ title, text }) {
  return html`<main class="page"><header class="masthead"><h1>${title}</h1><p>${text}</p></header>
    <p class="soon">Being built now. <a href="#/">Back to today</a></p></main>`
}
