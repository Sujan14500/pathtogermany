// ---- the look: theme and motion from Settings, and the drifting words behind the page ----

// Settings can override Windows' theme and motion choice. Rather than copy every dark or reduced-motion rule, each
// stylesheet's (prefers-color-scheme: dark) and (prefers-reduced-motion: reduce) block is switched on ('all'), off
// ('not all') or back to its own query, so every fragment's rules follow. reducedMotion() (00-core.js) reads it too.
const LOOK_MEDIA = new Map()   // CSSMediaRule → its own query
function applyLook() {
  const { theme, motion } = S.settings
  const root = document.documentElement
  root.classList.add('look-switch')   // switch at once: no colour transitions (99-motion.css makes every property one)
  const force = [['prefers-color-scheme: dark', theme === 'dark' ? 'all' : theme === 'light' ? 'not all' : null],
    ['prefers-reduced-motion: reduce', motion === 'reduce' ? 'all' : null]]
  for (const sheet of document.styleSheets) {
    let rules
    try { rules = sheet.cssRules } catch { continue }   // a cross-origin sheet (Google Fonts) can't be read
    for (const r of rules) {
      if (!(r instanceof CSSMediaRule)) continue
      if (!LOOK_MEDIA.has(r)) LOOK_MEDIA.set(r, r.media.mediaText)
      const own = LOOK_MEDIA.get(r), f = force.find(([q]) => own.includes(q))
      if (f) r.media.mediaText = f[1] ?? own
    }
  }
  root.style.colorScheme = theme === 'dark' || theme === 'light' ? theme : ''
  getComputedStyle(root).color   // apply the new styles before transitions come back
  root.classList.remove('look-switch')
}
applyLook()

// Behind the calmer pages, German nouns drift slowly upward with their article in its gender colour, and the English
// surfaces halfway up: an idle moment becomes a quiet recall check. The words are the learner's own learned cards,
// topped up from the current station. Hidden from screen readers; paused under reduced motion; off in Settings.
const BACKDROP_PAGES = new Set(['', 'practice'])   // pages of panels; elsewhere text sits on the bare page
function Backdrop({ data, page }) {
  const s = useStore()
  const day = today()
  const ws = useMemo(() => {
    const seed = [...day].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, s.lesson)
    const mix = xs => xs.map(w => [(parseInt(w.id.slice(1), 16) ^ seed) >>> 0, w]).sort((a, b) => a[0] - b[0]).map(x => x[1])
    const mine = mix(data.words.filter(w => w.a && known(w.id)))
    const station = mix((data.wordsBy[s.lesson] ?? []).filter(w => w.a && !known(w.id)))
    return [...mine.slice(0, 10), ...station, ...mine.slice(10)].slice(0, 14)
  }, [data, s.lesson, day])
  if (!BACKDROP_PAGES.has(page) || s.settings.backdrop === false || !ws.length) return null
  return html`<div class="backdrop" aria-hidden="true">${ws.map((w, i) => {
    const r = (parseInt(w.id.slice(1, 5), 16) % 1000) / 1000   // steady per word, so a re-render doesn't reshuffle
    const dur = 44 + r * 26
    return html`<span key=${w.id} class=${`g-${w.a}`} style=${`--x:${((i * .618 + r * .07) % 1) * 92 + 2}%;--size:${1.5 + r * 1.2}rem;--dur:${dur}s;--delay:${-(i / ws.length) * dur}s`}>
      <b lang="de"><i>${ART[w.a]}</i> ${w.w}</b><small>${w.en.split(/[,;(]/)[0].trim()}</small>
    </span>`
  })}</div>`
}
