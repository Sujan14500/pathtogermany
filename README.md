# Path to Germany (Weg nach Deutschland)

A German study app that takes one learner from **A1 to B1** and prepares her for the **Goethe-Zertifikat A1, A2 and
B1**, in every module: Lesen, Hören, Schreiben, Sprechen. Everything is taught **through English**.

The course is a transit route: three lines (A1, A2, B1), twelve stations each. A station holds its words (every noun with
its article in the gender colour), grammar, a reading text, listening items, a writing and a speaking task, picture
scenes and a station test. Around the route: spaced-repetition flashcards (FSRS), trainers for verb forms, der/die/das
and cases, a pronunciation guide with minimal pairs, numbered practice tests and timed mock exams in the Goethe format.
The home page always says what to do next.

## Open it

Double-click **`app/WegNachDeutschland.html`**. No server and no install. Use **Brave** or **Microsoft Edge** on Windows;
Edge has natural German voices built in. It works offline too: the fonts then fall back to Windows fonts, and speech
uses the voices installed in Windows (Edge's natural voices need the internet).

- **Progress** is saved in the browser. Back it up from *Settings and backup* at the bottom of the home page
  (Export progress), and import it in any other browser. The double-clicked file and a served copy keep separate
  progress.
- **No German voice?** Windows Settings → Time & language → Speech → Add voices → German (Deutsch), then quit the
  browser fully and reopen it. Settings shows an administrator PowerShell command that does the same.
- **Optional served version** (installable, works offline): `python -m http.server 8000 -d app`, then open
  http://localhost:8000.

## Build it (only when changing content or code)

The front end is written as fragments: `app/src/*.js` and `app/styles/*.css`, joined in name order into `app/main.js` and
`app/style.css`. Never edit those two or `app/WegNachDeutschland.html` by hand: they are generated.

```
python scripts/build_data.py          # data/src → app/data/*.json → app/main.js, app/style.css → app/WegNachDeutschland.html
python scripts/build_data.py --test   # self-checks of the pipeline
python scripts/check_content.py data/src/<file> …   # validate written content; prints ALL OK or the problems
```

Python (Anaconda) runs the pipeline; the app itself needs no build tools, only a browser. `app/test.html` checks the
helpers in `main.js`: serve the folder (`python -m http.server -d app`), open `/test.html`, and it prints `ok`.

### Scripts

| Script | What it does |
|---|---|
| `scripts/build_data.py` | Builds `app/data/*.json` from `data/src/`, checks words against Wiktionary, then runs `bundle.py`. `--test` runs the self-checks; `--verb-fixture` writes `app/test-verbs.json` (Wiktionary conjugations) for `test.html` |
| `scripts/bundle.py` | Joins the fragments and inlines CSS, vendor modules and data into the single file that opens from disk |
| `scripts/check_content.py` | Validator for written content (words, grammar questions, reading, listening, writing, speaking, scenes, sounds), by file-name prefix |
| `scripts/goethe_lists.py` | Extracts the headword checklist (`data/src/goethe-<level>.tsv`) from the Goethe word-list PDFs in `data/cache/goethe/` |
| `scripts/shot.py` | Headless-Chrome screenshot of any route, printing console errors: `python scripts/shot.py OUT.png /sounds --w 1366 [--dark] [--click CSS] [--eval JS]`. `--smoke` opens every route and reports errors and sideways overflow. In Git Bash, `export MSYS_NO_PATHCONV=1` first |
| `scripts/scene_preview.py`, `scripts/scene_probe.py` | Render a picture scene to PNG with all name boards; measure every scene's labels for overlaps |
| `scripts/render-pages.ps1` | Renders scanned PDF pages to PNG with the Windows PDF API (for transcribing book lists, if a textbook is added) |

## Sources and licences

All passages, dialogues, example sentences, exam-style tasks, questions, model answers, picture scenes, mouth diagrams and
explanations are written for this app. Nothing is copied from textbooks, official exam papers (Übungssätze) or test
websites; the app links to the official Goethe-Institut practice material instead.

| Source | Used for | Licence |
|---|---|---|
| [Wiktionary](https://en.wiktionary.org/), German entries of the English edition, via [kaikki.org](https://kaikki.org/dictionary/German/) (Tatu Ylonen, *Wiktextract*) | The IPA shown with each word in `app/data/words.json`; checking every word's article, plural and verb forms; the Wiktionary conjugation tables in `app/test-verbs.json` used by the tests. The dump itself (`data/cache/`) is not committed | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) (and GFDL). The Wiktionary-derived parts of the data are shared under the same licence |
| [Goethe-Institut](https://www.goethe.de/) word lists for Goethe-Zertifikat A1 (Start Deutsch 1), A2 and B1 | Only as a coverage checklist: `data/src/goethe-<level>.tsv` keeps the headwords (article, word, part of speech) so every expected word gets a station. The PDFs and their example sentences are not redistributed (they stay in the gitignored `data/cache/goethe/`) | © Goethe-Institut; not redistributed |
| [Preact](https://preactjs.com/) 10 and [htm](https://github.com/developit/htm) 3.1.1, vendored as the standalone build `app/vendor/htm-preact-3.1.1.js` | UI components and templates without a build step | Preact: [MIT](https://github.com/preactjs/preact/blob/main/LICENSE). htm: [Apache-2.0](https://github.com/developit/htm/blob/master/LICENSE) |
| [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) 5.4.2, vendored as `app/vendor/ts-fsrs-5.4.2.js` | Flashcard scheduling (the FSRS algorithm) | [MIT](https://github.com/open-spaced-repetition/ts-fsrs/blob/main/LICENSE) |
| [Barlow Semi Condensed](https://fonts.google.com/specimen/Barlow+Semi+Condensed) (Jeremy Tribby) and [Atkinson Hyperlegible Next](https://fonts.google.com/specimen/Atkinson+Hyperlegible+Next) (Braille Institute), loaded from Google Fonts | Station boards and headings; body text | [SIL Open Font License 1.1](https://openfontlicense.org/) |
| German speech | Read aloud by the browser's own speech synthesis (Windows or Edge voices); no audio files are shipped | — |

The learning-science features rest on published research, cited in `docs/07-learning-science.md`.

## Working with Claude Code

1. Open this folder in VS Code.
2. Say "continue" (or paste `prompts/02-continue.md`) to pick up the next phase in `docs/PROGRESS.md`.
3. If you get textbook PDFs or audio later, paste `prompts/03-materials-added.md` with the folder path filled in. Book PDFs
   go in `materials/` and audio in `app/audio/`; both are gitignored and never committed.

| File | What it is |
|---|---|
| `CLAUDE.md` | Standing rules Claude Code reads in every session here |
| `docs/01-product.md` … `08-exam-formats.md` | Features, architecture, content, design, build plan, pitfalls, learning science, exam formats |
| `docs/PROGRESS.md` | Decisions and the phase checklist |
| `docs/design/` | The agreed design tokens and the home hero mock-up |
