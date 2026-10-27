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
- GitHub remote: _none yet (ask before creating; it must be private)_

## Phases
- [x] Phase 0: confirm and plan
- [x] Phase 1: shell, store, router, single-file build
- [ ] Phase 2: words and flashcards
- [ ] Phase 3: grammar and trainers
- [ ] Phase 4: reading
- [ ] Phase 5: listening
- [ ] Phase 6: writing and speaking
- [ ] Phase 7: picture scenes
- [ ] Phase 8: practice tests and mock exams
- [ ] Phase 9: polish

## Notes for the next session
- Screenshots and smoke tests: `scripts/shot.py` (see README). In Git Bash set `MSYS_NO_PATHCONV=1`, or the
  route `/` turns into a Windows path. Headless Chrome follows the Windows dark theme unless told otherwise;
  shot.py forces light unless `--dark`. Under `--virtual-time-budget`, rAF and scroll events are very slow,
  so the router restores scroll with `setTimeout`, and probes dispatch `scroll` themselves.
- Station numbers run 1–36 across the levels (A1 1–12, A2 13–24, B1 25–36); URLs use them.
- Part progress lives in `S.practice["<station>/<part>"]` (0…1). Phase 2 adds word cards to it.
