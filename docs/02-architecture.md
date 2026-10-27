# 02 · Architecture: how it is built

## Constraints (non-negotiable)

- **No build step:** static `app/index.html`, `app/style.css`, `app/main.js` (an ES module), and vendored
  libraries in `app/vendor/`.
  - Copy `htm-preact-3.1.1.js` and `ts-fsrs-5.4.2.js` from `..\pathtojapan\app\vendor\`.
  - Keep the `.js` extension: Python's http.server serves `.mjs` as text/plain.
- **Node is v14:** don't upgrade it, and don't use npm build tools. Node can still run small self-check
  scripts. Python (Anaconda) runs the data pipeline.
- **Opens from a file:** browsers block ES modules and `fetch()` on `file://`, so the real deliverable is
  **`app/WegNachDeutschland.html`**, produced by `scripts/bundle.py`:
  - inline the CSS
  - turn each vendor module's trailing `export { … }` into an object
  - rewrite `main.js`'s `import { … } from './vendor/x.js'` into `const { … } = __vendorN`
  - inline all `app/data/*.json` as `window.__DATA`
  - drop the manifest link
  - escape `</script`

  `main.js` reads `window.__DATA[name]` if present, else fetches `data/<name>.json`. The file sits in `app/`,
  so `audio/…` paths still resolve. Copy and adapt `..\pathtojapan\scripts\bundle.py`.
- **Served version (optional):** `python -m http.server 8000 -d app`, with `manifest.webmanifest` and `sw.js`
  for a PWA.
  - The service worker is stale-while-revalidate, skips audio and range requests, and falls back to the
    network on CacheStorage errors.
  - Register it only when `location.protocol` starts with `http`.

## Files

```
app/
  index.html  style.css  main.js  test.html  sw.js  manifest.webmanifest  icons/
  vendor/htm-preact-3.1.1.js  vendor/ts-fsrs-5.4.2.js
  data/*.json                   (generated, committed)
  WegNachDeutschland.html       (generated, committed: the file the learner opens)
  audio/                        (book audio, gitignored)
data/
  src/                          (hand-made and agent-written sources, committed)
  cache/                        (downloaded dictionaries, gitignored)
scripts/
  build_data.py                 (builds app/data, then calls bundle(); --test runs self-checks)
  bundle.py
  render-pages.ps1              (copy from ../pathtojapan/scripts: renders PDF pages to PNG)
  check_content.py              (validator for agent-written content, by file-name prefix)
materials/                      (book PDFs, gitignored)
docs/  prompts/  README.md  .gitignore
```

`.gitignore`: `materials/`, `app/audio/`, `data/cache/`, `__pycache__/`, `node_modules/`, temporary
screenshot harness files.

## Front end

- **Preact + htm:** `html\`…\`` templates and function components. No JSX and no bundler.
- **Store:** one JSON blob in localStorage (key `pathtogermany:v1`) with `{ cards, log, lesson, newPerDay,
  autoplay, newToday, tests, practice, drafts, settings }`.
  - `commit(fn)` mutates, saves and notifies; `useStore()` re-renders.
  - On a save failure, alert the user to export.
  - Export and import include a confirm step.
- **FSRS:** `fsrs({ enable_fuzz: true })`.
  - Queue order: due reviews, then new cards up to the current stop (capped by newPerDay), then learning cards
    due within 20 minutes.
  - Grades Again/Hard/Good/Easy, with the interval preview on each button.
- **Router:** everything is a hash route.
  - `useHash()` listens to `hashchange` and sets `history.scrollRestoration = 'manual'`.
  - It saves `scrollY` into `history.state` (debounced, on scroll) and restores it when an entry with saved
    state comes back (Back/Forward).
  - A new entry starts at the top, except a new tab of the same page, which keeps the place.
  - Navigate with `location.hash = …`. Every test, paper and tab has its own address. Copy this from the
    sister project's `useHash`.
- **Speech (de-DE):**
  - Pick voices explicitly: female (Katja, Hedda; Edge's natural "Katja Online"), male (Stefan; Edge's
    "Conrad Online").
  - `speakLines([[who, text], …])` queues utterances with a voice per speaker (A, B, narrator). With one voice
    only, use pitch.
  - **No-voice detection:** if voices are listed but none is German, or an utterance hasn't started after 2.5 s
    (Brave can list zero voices), show a note.

    > No German voice: Windows Settings → Time & language → Speech → Add voices → German (Deutsch), then quit
    > the browser fully and reopen. Or use Edge.
  - The user's Windows may lack a German voice. Installing it needs admin rights:
    `Add-WindowsCapability -Online -Name "Language.TextToSpeech~~~de-DE~0.0.1.0"`. Offer it; don't run it
    silently.
- **Speech recognition:** `webkitSpeechRecognition` with `lang = 'de-DE'` in Chrome and Edge. Feature-detect it,
  and fall back to record-and-play-back with `MediaRecorder`. Never send audio anywhere else.
- **Seeded tests:** papers are generated from question pools with a seeded RNG (mulberry32), so test k is
  stable. Mock papers use a random seed.
- **Rendering German with help:** a `Gloss` component wraps known words, so hovering or tapping one shows
  meaning, article and plural. Exam-style screens hide help where help would give the answer away.
- **Accessibility:**
  - real buttons and links
  - keyboard shortcuts in the trainers (1–4, Space, Enter)
  - visible focus, `lang="de"` on German text
  - aria-labels on SVG scene objects
  - reduced motion respected everywhere

## Data flow

`data/src/*` → `scripts/build_data.py` → `app/data/*.json` → `scripts/bundle.py` →
`app/WegNachDeutschland.html`.

Planned outputs:
- `words.json`
- `grammar.json`
- `verbs.json`: principal parts, auxiliary, stem changes, prefix type
- `syllabus.json`: levels, stations, titles, themes
- `reading.json`
- `listening.json`
- `writing.json`
- `speaking.json`
- `drills.json`: form-choice, paraphrase, usage and other question banks
- `scenes`: kept in code, like the sister project
- `audio.json`: book audio track map, if provided

Every item has a stable id (hash of its source key) so progress survives rebuilds.

## Testing

- `python scripts/build_data.py --test`: assert-based self-checks for the parsers and helpers.
- `app/test.html`: imports helpers from `main.js` (for example conjugation, case endings, the word-boundary
  matcher, the seeded RNG) and prints `ok`.
- **Visual check:** headless Chrome screenshots.
  - Run `chrome.exe --headless=new --disable-gpu --user-data-dir=<fresh temp dir> --window-size=1500,1000
    --virtual-time-budget=8000 --screenshot=<png> <url>`.
  - For interactions, use a temporary `app/_shot.html` that loads the app in an iframe and clicks things.
    Delete it before committing.
  - Capture console errors via `contentWindow.addEventListener('error', …)`.
- **Smoke test before each commit:** open every route (all tests at every level, both mock papers, every
  station tab) and confirm there are no errors.
