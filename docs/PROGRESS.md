# Progress

Keep this file current: tick a phase when its acceptance checks pass, and note its commit.

## Decisions (filled in during Phase 0)
- Textbook: none. Use the built-in syllabus (12 stations per level, `docs/03-content.md`).
- Materials location: none. The learner has no books or audio. Content is original, enriched from open data
  (Wiktionary via kaikki.org, CC BY-SA), with the Goethe A1/A2/B1 word lists used only as a coverage checklist.
  The app must be enough on its own to pass: full word-list coverage, every exam part in its real format and timing,
  many practice papers. Link the official Übungssätze; never copy them.
- Exam board and dates: Goethe-Zertifikat A1 → A2 → B1; no dates booked yet.
- Design tokens: agreed 2026-10-28 (`docs/design/hero-mockup.html`, `hero-light.png`, `hero-dark.png`).
  - Station board: navy enamel `#0E2452` (dark theme `#17336F` with a `#4565AC` rim on a graphite `#0F1216` page).
  - Gender: der `#1D5BD6`, die `#C62F28`, das `#16804A`, plural `#636978` (dark: `#7EA8FF`, `#FF7A70`, `#55CF8A`, `#A9AEBC`).
  - Lines: A1 amber `#F2A20C`, A2 teal `#12A3B4`, B1 violet `#8A5CF5`.
  - Type: Barlow Semi Condensed (boards; Bahnschrift offline), Atkinson Hyperlegible Next (body, 17 px).
  - Spacing 4/8/12/16/24/32/48; 6 px sign radius; pills only for badges.
- Devices: laptop only (user, 2026-10-28): no mobile UI or features; check screens at 1366 px and 1500 px, light and
  dark, instead of phone widths. Desktop install/offline (manifest + service worker) stays.
- Welcome line on home: "Liebe Sneka, willkommen!" (Dear Sneka, welcome!), chosen by the user 2026-10-28.
- GitHub remote: `origin` = https://github.com/Sujan14500/pathtogermany, PUBLIC by the user's explicit choice
  (2026-10-28, overriding the private-repo rule). Commit and push straight to main at phase ends; no branches, no PRs,
  no force-push.

## Phases
- [x] Phase 0: confirm and plan
- [x] Phase 1: shell, store, router, single-file build
- [x] Phase 2: words and flashcards (now 3,365 words: A1 954, A2 747, B1 1,664; fba91d7)
- [x] Phase 3: grammar and trainers (109 points, 436 form-choice questions; verbs and cases trainers)
- [x] Phase 4: reading (75b1956, dede229, 57621d9). 24 station texts per level in the Goethe Lesen formats, plus
  exam-only pools (A1 15, A2 20, B1 29) for papers. Reader: tap a sentence for English, glossary highlighting, evidence
  lighting, read-aloud, words per minute, L11–L13. Verified 2026-10-28: text messages (A1), a blog post (B1) and a
  newspaper article (A2 mock) screenshot with questions answered; every station has texts; the known-word meter
  shows each text's share.
- [x] Phase 5: listening (57621d9; exam pools 6a3f3fe, ddaf657, 55d6c0a). Station items A1 48, A2 48, B1 42, exam-only
  A1 63, A2 52, B1 36. Multi-voice playback, slower speed, play limits as in the exam, transcript with English and the
  answer lines, shadowing (L14), hear it again faster (L13). Verified: answering and the transcript after checking;
  playback order and voices only on the user's machine (headless Chrome speaks nothing).
- [x] Phase 6: writing and speaking (0fc50a1). 36 + 36 tasks, every exam part at each level. Writing: content points
  that tick as they appear, word meter, phrases to insert, honest hints (no AI), drafts, model answer, self-score in
  the Goethe criteria. Speaking: prepare and speak timers, MediaRecorder, transcript where the browser has
  speech-to-text (not Brave), voice partner, model answer with shadowing. Verified: a full writing task (text typed,
  hints, model, self-score saved) and the no-microphone speaking path.
- [x] Phase 7: picture scenes (12e7ed8; scenes 57621d9, e86ffa6, 21fa70c). 10 scenes, 20–31 labelled words each;
  Explore, Find it, Name it (typed or chosen), show all names, pause, weather toggle; flashcards show the word's thing
  in its scene. Verified: gallery, station Pictures tabs, Find and Name in light and dark.
- [x] Phase 8: practice tests and mock exams (3d0052b; formats checked against Goethe's documents 80b1c09).
  Seeded practice papers for six modules per level (A1 54, A2 49, B1 46), mocks full and short in the real module
  structure and timing, scored the Goethe way (A1 overall, A2 written + Sprechen, B1 every module), result stamp,
  wrong answers explained with links back, Goethe's Übungssätze linked. Verified: a mock sat through to its result
  (A1 short), the B1 self-scoring step, a practice paper result, a station test passed and its revisit stop on the
  plan the next day (clock moved on a day), and the next revisit getting new questions.
- [x] Phase 9: polish (ac58d61, 15b40ec, and the final QA pass). Pronunciation page, drifting words, settings and
  backup, tips, PWA files, README sources. Final QA pass (2026-10-28): every page type at 1366 and 1500 px in light
  and dark; a full study day driven by keyboard and clicks from a fresh profile (cards → Arrived → next stop) and
  mid-course (reviews, typed production cards, revisit stops); smoke over 458 routes at both widths with 0 errors.

## Learning science (docs/07-learning-science.md): all done
- L1 new cards among reviews: `spreadNew` (00-core.js) · L2 typed production cards: `checkAnswer`, `diffChars`, `Typed`
  (15-study.js) · L3 Cover the English: `WordsTab` (10-words.js) · L4 say it aloud: `Study` card line ·
  L5 sleep on it: `Arrived` · L6 minutes for today: `todayPlan` (80-home.js) · L7 Guess first: `GuessFirst`
  (20-grammar.js) · L8 tricky words and hooks: `HookBox` (15-study.js) · L9 this week: `Week` · L10 study plan:
  `Settings` and the line under the welcome (80-home.js).
- L11 known words in a text: `knownShare` (40-reading.js) · L12 predict first: `Reader` · L13 read again against the
  clock: `Reader`; hear it again faster: `ListenItem` (45-listening.js) · L14 shadowing: `Shadow` (45-listening.js),
  used in transcripts and the Speak model answers (55-speaking.js).
- L15 revisit stops: `revisitDue`, `revisitStops` · L16 cumulative station tests: `stationPaper` · L17 spaced mocks:
  `mockStops`, `weakStations` (all 85-tests.js) · L18 tips: `Tips` (60-learn.js), every tip linked to its feature.

## Status at the end of 2026-10-28 (resume here)
- All phases done. The app is feature-complete and content-complete: 3,365 words; 109 grammar points with 436
  form-choice and 360 vocabulary questions; reading 72 station texts + 64 exam-only; listening 138 station items +
  151 exam-only; 36 writing and 36 speaking tasks; 10 picture scenes; 12 pronunciation sounds.
- Checks at the end of the QA pass: `build_data.py`, `--test` ok, `check_content.py` ALL OK, `app/test.html` ok,
  `shot.py --smoke` 458 routes (every station tab, every practice paper, every mock) 0 errors at 1366 and 1500 px.
- Not tested: real microphone, speech recognition and German voices in Brave and Edge; the user should try them
  (Settings → Test the voice; a Speak task; Pronunciation → Record yourself).
- Known content issue: data/src/scenes-2.json draws hands with `cx="L-19"` and the like (6 circles: stadt Fußgänger,
  park Boot and one park figure); the console logs an SVG attribute error and the hand dot sits at 0. Fix the numbers.
- Next: the user studies; fix what they find. Push when asked.

## Notes for the next session
- Front end: app/src/*.js and app/styles/*.css are the source; scripts/bundle.py joins them into app/main.js,
  app/style.css and app/WegNachDeutschland.html (never edit those three). Pages register in `PAGES`, station tabs in
  `TAB_VIEWS` (00-core.js). Shared helpers live in 00-core.js (`shuffle` with an optional seeded rng, `mmss`, `gapped`).
- Screenshots and smoke tests: `scripts/shot.py` (see README). In Git Bash set `MSYS_NO_PATHCONV=1`, or the
  route `/` turns into a Windows path. Headless Chrome follows the Windows dark theme unless told otherwise;
  shot.py forces light unless `--dark`. Under `--virtual-time-budget`, rAF and scroll events are very slow,
  so the router restores scroll with `setTimeout`, and probes dispatch `scroll` themselves. `--eval` can call the
  app's globals (`commit`, `D`, `S`, `queue`, `stationPaper`); give `window.confirm` a stub first, or a "Hand in
  anyway?" box hangs headless Chrome. The smoke reads the paper counts from 85-tests.js and the data.
- Station numbers run 1–36 across the levels (A1 1–12, A2 13–24, B1 25–36); URLs use them.
- Part progress: words = learned recognition cards; grammar = points studied (`S.practice["g:<id>"]`, which also puts
  the point into the SRS as a sentence-building card); other parts keep `S.practice["<station>/<part>"]` (0…1) and
  count as done at 60%. The plan's next stop skips Words once its cards have started (the cards bring them in).
- Word pipeline: `scripts/goethe_lists.py` (headword checklist from the Goethe PDFs in data/cache; it keeps form-of
  headwords such as Lehrerin and der Erwachsene, abbreviations and plural-only nouns, and reads the Wortgruppen pages
  too) → `data/src/assign-<lv>.tsv` (station per word) → `data/src/words-<lv>-*.tsv` (validated by
  `scripts/check_content.py`) → `build_data.py` (dedupe keeping the earliest station, IPA and checks from Wiktionary).
  Words sit at the station of their first use, so the texts are about 90% known for a learner at that station.
  3,365 words: A1 954, A2 747, B1 1,664. The build lists 113 differences from Wiktionary in data/cache/word-check.tsv
  (the earlier 46 were reviewed: homographs and accepted variants; the rest not re-reviewed).
- `python scripts/build_data.py --verb-fixture` writes app/test-verbs.json (Wiktionary tables); test.html checks the
  conjugation helpers against it (59 verbs, all forms right).
- Other sessions work in this repo too. Stage only your own paths.
