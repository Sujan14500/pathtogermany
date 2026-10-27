# 05 · Build plan: phases with acceptance checks

Work phase by phase. At the end of each phase:
1. Build with `python scripts/build_data.py`, which also builds the bundle.
2. Run the self-checks: `--test` and `app/test.html`.
3. Take screenshots and fix what you see.
4. Smoke-test every route, aiming for zero console errors.
5. Update `docs/PROGRESS.md`.
6. Commit to `main`.
7. Give the user a short report: what's new, what was tested, what's next, and anything they need to provide.

Push only when the user asks.

Use parallel background subagents for bulk original content (texts, dialogues, questions, model answers).
Brief them per `docs/03-content.md`, and give each a validator to pass. Build the code while they write.

## Phase 0: confirm and plan
- Read all of `docs/` and skim the sister project at `..\pathtojapan`.
- Ask the questions in `docs/03-content.md` ("Ask first"): textbook, materials, exam board and dates. Use the
  AskUserQuestion tool with sensible defaults.
- Propose the design tokens (colours, type, spacing) as a short plan with one mock-up screenshot of the home
  hero, then get a yes.
- `git init` on `main`, add `.gitignore`, and copy the vendor files and `render-pages.ps1` from the sister
  project.
- **Done when:** the answers are recorded in `docs/PROGRESS.md` and the tokens are agreed.

## Phase 1: shell, store, router, single-file build
- `index.html`, `style.css` with tokens and both themes, and `main.js` with: store, export/import, hash router
  with scroll restore, top bar, home (hero, plan rail, tiles, route map from `syllabus.json`), and the station
  page with tabs as URLs.
- `scripts/build_data.py` (syllabus only for now) and `scripts/bundle.py` → `app/WegNachDeutschland.html`.
- `app/test.html`, and a README ("double-click app/WegNachDeutschland.html").
- **Done when:**
  - the bundle opens from `file://` with no errors
  - Back and Forward work between home, a station and its tabs
  - screenshots at 1500 px and 400 px look right

## Phase 2: words and flashcards
- Word lists: from the textbook (render pages with `render-pages.ps1` and transcribe), or the built-in
  syllabus with the Goethe level lists as a checklist.
- Enrich from Wiktionary (kaikki.org): article, plural, IPA, glosses, verb principal parts. Filter crude
  senses, and override wrong glosses with a hand-checked TSV.
- FSRS study page: cards with gender colours, plurals, audio, and recognition plus production cards.
- Speech: de-DE voice picking, the no-voice note, and a voice/rate setting.
- Gender trainer (`#/gender`) with ending rules.
- **Done when:**
  - every A1 word has an article (for nouns), an English meaning and an example
  - a 15-card session works by keyboard
  - the no-voice note appears when no German voice is present

## Phase 3: grammar and trainers
- Grammar points per station (from `docs/03-content.md`), with explanations, comparisons with English,
  aligned examples with connector lines, and a sentence builder with an animated verb position.
- Verb-forms trainer (`#/verbs`), generated with real-mistake distractors and a table view.
  - Put the conjugation helpers in `main.js`, with asserts in `test.html`: stem changes, separable prefixes,
    haben/sein, irregular Partizip II from data.
- Cases and endings (`#/cases`): the case table, preposition drills, the two-way preposition animation, and the
  adjective-ending decision diagram.
- Form-choice questions (`gq-*.json`), one or more per grammar point, written by agents and validated.
- **Done when:**
  - every grammar point renders with examples and a quiz
  - the trainers show no wrong forms on a sample of 50 verbs, checked against Wiktionary tables

## Phase 4: reading
- One original text per station in Goethe Lesen formats (agents, validated).
- The reader with tap-to-translate, glossary highlighting, evidence highlighting, read-aloud and reading speed.
- **Done when:** every station has a text and questions, and there are 3 screenshots of different text types.

## Phase 5: listening
- Original items per station in Goethe Hören formats (agents, validated).
- Multi-voice speech playback, a transcript with English after answering, and a slower speed.
- A book-audio player if the user provides the audio.
- **Done when:** every level has at least 40 listening items across all its formats, and playback order and
  voices are correct.

## Phase 6: writing and speaking
- Writing tasks per level part, with a checklist, word count, Redemittel, heuristic hints, saved drafts, a model
  answer and a rubric.
- Speaking tasks with timers, MediaRecorder record and playback, a SpeechRecognition transcript where
  available, a TTS partner and model answers.
- **Done when:** every exam part at each level has at least 4 tasks, and recording works in Brave and Edge, or
  degrades with a clear message.

## Phase 7: picture scenes
- Port the scene engine from the sister project, then draw the scenes listed in `docs/01-product.md`.
- Labels show coloured articles. Modes: Explore, Find, Name. Movers hold still on hover. Each scene appears in
  a station's Pictures tab, and flashcards for its words show the picture.
- **Done when:** each scene has at least 15 labelled words, its labels never overlap or hide, and a screenshot
  of each scene is reviewed.

## Phase 8: practice tests and mock exams
- Numbered seeded practice tests per level and module (`#/tests/<level>/<module>/<k>`), with best scores saved
  and 60% to pass.
- Mock exams per level, in the module structure and timing of `docs/03-content.md`, full and short, scored the
  Goethe way. Afterwards: a result stamp, then a review of the wrong answers with explanations and links back.
- A "More practice" section linking the official Goethe Übungssätze.
- **Done when:**
  - every module and level opens a test
  - the full mock papers have the real part counts
  - the smoke test passes over all routes

## Phase 9: polish
- Tips page, pronunciation guide and minimal pairs, the drifting-words background, PWA files, settings.
- Final pass on contrast, focus, reduced motion and phone width. Update the README with sources and licences.
- **Done when:** the user can study a full day, from cards to a station test, without hitting a rough edge.
