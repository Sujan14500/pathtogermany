// ---- station page: one tab per part, each tab its own address ----

function Station({ data, n, tab }) {
  const s = useStore()
  const st = data.stations[n]
  if (!st) return html`<main class="empty"><p>There is no station ${n}. <a href="#/">Back to today</a></p></main>`
  const t = TAB_NAME[tab] ? tab : 'words'
  const View = TAB_VIEWS[t]   // registered by the tab's own fragment
  // the part after this one (Pictures only where the station has a scene); after the test, back to today's plan
  const order = TABS.filter(([id]) => id !== 'pictures' || scenesFor(n).length)
  const next = order[order.findIndex(([id]) => id === t) + 1]
  return html`<main class=${`station l${st.level}`}>
    <${Board} data=${data} n=${n} />
    <div class="station-bar">
      <nav class="tabs" aria-label="Station parts">${TABS.map(([id, label]) => html`<a href=${`#/station/${n}/${id}`}
        class=${id === t ? 'on' : ''} aria-current=${id === t ? 'page' : null}>${label}</a>`)}</nav>
      ${n === s.lesson ? html`<span class="you">Your current stop</span>`
        : html`<button type="button" onClick=${() => commit(x => { x.lesson = n })}>Make this my current stop</button>`}
    </div>
    <section class="tab-body" aria-label=${TAB_NAME[t]}><${View} data=${data} n=${n} /></section>
    <nav class="tab-next" aria-label="Next part">${next
      ? html`<a class="button" href=${`#/station/${n}/${next[0]}`}>Next: ${next[1]} <${Arrow} /></a>`
      : html`<a class="button" href="#/">Back to today's plan <${Arrow} /></a>`}</nav>
  </main>`
}
