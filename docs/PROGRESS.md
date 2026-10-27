# Progress

Keep this file current: tick a phase when its acceptance checks pass, and note its commit.

## Decisions (filled in during Phase 0)
- Textbook: none. Use the built-in syllabus (12 stations per level, `docs/03-content.md`).
- Materials location: none. The learner has no books or audio. Content is original, enriched from open data
  (Wiktionary via kaikki.org, CC BY-SA; Tatoeba, CC BY), with the Goethe A1/A2/B1 word lists used only as a
  coverage checklist. The app must be enough on its own to pass: full word-list coverage, every exam part in
  its real format and timing, many practice papers. Link the official Übungssätze; never copy them.
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
- [x] Phase 2: words and flashcards (3,163 words: A1 779, A2 588, B1 1,796)
- [x] Phase 3: grammar and trainers (109 points, 436 form-choice questions; verbs and cases trainers)
- [ ] Phase 4: reading
- [ ] Phase 5: listening
- [ ] Phase 6: writing and speaking
- [ ] Phase 7: picture scenes
- [ ] Phase 8: practice tests and mock exams
- [ ] Phase 9: polish

## Learning science (docs/07-learning-science.md)
- Done: L1 new cards spread among reviews (`spreadNew`) · L2 typed production cards (`checkAnswer`, `diffChars`,
  suggested grade, no shortcuts while typing) · L3 Cover the English · L4 say it aloud · L5 sleep on it ·
  L6 minutes for today · L7 Guess first · L8 tricky words and memory hooks · L9 this week · L10 study plan ·
  L18 tips, built early as the in-app page "How you learn here" (`#/tips/<i>`), which also lists the deferred items
  with the phase that brings them.
- Deferred: L11 known words in a text, L12 predict first, L13 fluency re-read → Phase 4 (reading);
  L13 hear it again faster, L14 shadowing → Phase 5 (and L14 for the Speak model answers in Phase 6);
  L15 revisit stops, L16 cumulative station tests, L17 spaced mock exams → Phase 8.

## Status at the end of 2026-10-28 (resume here)
- Content done and validated: 3,163 words; 109 grammar points + 436 form-choice questions; 360 vocabulary questions
  (vq, 120 per level); reading A1 24 + A2 24 + B1 24; listening A1 48 + A2 48 + B1 42; writing 36 and
  speaking 36 tasks (12 per level); 12 pronunciation sounds; picture scenes 2 of 10 (scenes-2 and scenes-3 hold one
  each; scenes-1 has nothing saved).
- Code: Phases 0–3 done. Reader (Phase 4: tap-to-translate, glossary, evidence, read-aloud, wpm, L11–L13) and
  listening (Phase 5: multi-voice playback, transcript, shadowing L14) are written in app/main.js and pass the
  smoke test, but have not been screenshot-reviewed with real texts yet; the Listen tab is not routed yet.
- Stopped midway by the user (redo first tomorrow):
  - Code restructure: app/src/*.js and app/styles/*.css are now the source. scripts/bundle.py joins them into
    app/main.js and app/style.css, so edit the fragments, not main.js. The split is in, and the bundle passes the
    300-route smoke with 0 errors. Still to do: the PAGES/TAB_VIEWS registries, plus the agent's last planned edits
    (core header comment, Station, GrammarTab, Tips, router).
  - Picture scenes: 8 of 10 still to draw (body, clothes, classroom, town, park, kitchen, flat, supermarket/weather;
    check scenes-2/3 for which exist).
  - German proofreaders (A1+A2 and B1, words and grammar) were stopped before they saved any edits; rerun both.
- Briefs are in this session's history. docs/08-exam-formats.md and scripts/check_content.py define every format.
- Next (orchestrated, one Agent call per message): after the restructure, five feature builders in parallel —
  (1) reading + listening finish (Phases 4–5), (2) writing + speaking (Phase 6), (3) picture scenes engine + pages
  (Phase 7, with scripts/scene_preview.py), (4) practice tests, mock exams, station tests, L15–L17 (Phase 8),
  (5) pronunciation page, drifting-word background, settings, README sources and licences (Phase 9). Then a
  continuity pass over character facts (Priya: Mumbai vs Pune, her job), a full QA pass at 1366/1500 px light and
  dark, and the final push.

## Notes for the next session
- Screenshots and smoke tests: `scripts/shot.py` (see README). In Git Bash set `MSYS_NO_PATHCONV=1`, or the
  route `/` turns into a Windows path. Headless Chrome follows the Windows dark theme unless told otherwise;
  shot.py forces light unless `--dark`. Under `--virtual-time-budget`, rAF and scroll events are very slow,
  so the router restores scroll with `setTimeout`, and probes dispatch `scroll` themselves.
- Station numbers run 1–36 across the levels (A1 1–12, A2 13–24, B1 25–36); URLs use them.
- Part progress: words = learned recognition cards; grammar = points studied (`S.practice["g:<id>"]`, which also puts
  the point into the SRS as a sentence-building card); other parts keep `S.practice["<station>/<part>"]` (0…1).
- Word pipeline: `scripts/goethe_lists.py` (headword checklist from the Goethe PDFs in data/cache) →
  `data/src/assign-<lv>.tsv` (station per word, agents) → `data/src/words-<lv>-*.tsv` (agents, validated by
  `scripts/check_content.py`) → `build_data.py` (dedupe keeping the earliest station, IPA and checks from
  Wiktionary; disagreements in data/cache/word-check.tsv, all 46 reviewed: homographs and accepted variants).
- `python scripts/build_data.py --verb-fixture` writes app/test-verbs.json (Wiktionary tables); test.html checks the
  conjugation helpers against it (59 verbs, all forms right).
- Content in progress (2026-10-28, orchestrated background agents; formats in docs/08-exam-formats.md, validators in
  scripts/check_content.py): reading-<lv>-1.json (24 texts/level), listen-<lv>-1.json (42–48 items/level),
  writing-/speaking-<lv>-1.json (12 + 12 tasks/level), scenes-1/2/3.json (10 picture scenes, preview with
  scripts/scene_preview.py), sounds.json (12 sounds, minimal pairs), vq-<lv>-1.json (120 vocab questions/level),
  app/manifest.webmanifest + app/sw.js + PNG icons. If a file is missing after a restart, its agent died: relaunch it with
  the same brief (one Agent call per message: batched launches get cancelled).
- Other sessions work in this repo too (learning-science spec in docs/07-learning-science.md, export-on-close).
  Stage only your own paths.
