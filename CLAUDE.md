# Path to Germany (Weg nach Deutschland)

A private German study app that takes one learner from **A1 to B1** and prepares them for the
**Goethe-Zertifikat A1, A2 and B1** exams, with every module: Lesen, Hören, Schreiben, Sprechen.
Everything is taught **through English**: meanings, explanations, hints and feedback are in English.

Read these before doing anything, in this order:
1. `docs/01-product.md`: what the app does, feature by feature
2. `docs/02-architecture.md`: how it is built (no build step, opens from one HTML file)
3. `docs/03-content.md`: where words, grammar and texts come from, schemas, validators, copyright
4. `docs/04-design.md`: the visual identity, layout and motion
5. `docs/05-build-plan.md`: the phases, each with its acceptance checks
6. `docs/06-lessons-learned.md`: pitfalls already hit on the sister project; avoid them
7. `docs/PROGRESS.md`: which phases are done (you keep this file up to date)

When the user says **"start building"** (or pastes `prompts/01-start.md`), begin at Phase 0 of
`docs/05-build-plan.md`. When they say **"continue"**, pick up the first unfinished phase in `docs/PROGRESS.md`.

## The learner

- Learns best from interactive, animated, visual material, not plain lists. Animation must teach
  (show what changes, what goes where), and stay subtle elsewhere.
- Pictures are drawn SVG scenes and graphics. **Never use emoji as pictures.**
- Desktop first: Windows 11, wide screen, **Brave** browser (Edge as a fallback). The app must also have no
  horizontal scroll on a phone.
- Opens the app by **double-clicking one HTML file**. No server, no install, no Python needed to study.
- Wants guidance, not a menu: the home page always says what to do next and shows the route.
- Dislikes text-heavy pages and generic UI. Calls out anything that looks cheap. Verify every screen visually.

## Hard rules

- **Git:** commit straight to `main`. Never create a branch or a pull request unless asked.
  - Commit after each working feature or phase.
  - Push only when the user asks. The GitHub repo must stay private; confirm it with
    `curl -s -o /dev/null -w "%{http_code}" https://api.github.com/repos/<owner>/<repo>`, where 404 means private.
- **Copyright:** take only lists from textbooks (chapter titles, word lists, grammar point names, the audio
  track map).
  - Write every passage, dialogue, example sentence, exam task and question originally.
  - Never copy exam papers, official Übungssätze or third-party test sites into the app, even if asked.
    Explain why, and link to them instead.
- **Privacy:** book PDFs go in `materials/` and audio in `app/audio/`, both gitignored and never committed.
  - Never open personal documents that may sit in a shared materials folder (certificates, IDs, payslips,
    exam vouchers, results).
  - If a Google Drive folder is shared publicly so you can read it, remind the user to set it back to Restricted.
- **No build step:** static HTML, CSS and ES-module JS.
  - Vendored Preact + htm and ts-fsrs. System **Node is v14**: don't upgrade it, and don't add npm tooling.
  - Python (Anaconda, `python`) is fine for the data pipeline.
- **Verify, don't assume:** after every UI change, take headless-Chrome screenshots and look at them.
  Chrome is at `C:\Program Files\Google\Chrome\Application\chrome.exe`; use a fresh `--user-data-dir` each run.
  Fix what you see. Aim for zero console errors.
  - Keep `python scripts/build_data.py --test` and `app/test.html` passing.
- **Report honestly:** say what you tested and what you didn't. If something fails, show the output.

## Sister project: reuse its patterns

`C:\Users\sujan.sd\SujanPersonal\projects\pathtojapan` is a finished app of the same kind (Japanese, N5→N3).
Read it for proven patterns and copy what fits, adapting it to German. Don't copy its Japanese content.
- `app/vendor/htm-preact-3.1.1.js`, `app/vendor/ts-fsrs-5.4.2.js`: copy these as they are.
- `scripts/bundle.py`: the single-file build that makes the app open from `file://`.
- `scripts/render-pages.ps1`: renders scanned PDF pages to PNG with the Windows PDF API.
- `app/main.js`:
  - the store, FSRS queue and export/import
  - the hash router with per-entry scroll restore
  - the top bar, home hero and route map
  - the picture-scene engine (`SCENES`, `SceneArt`, `Scene`)
  - mock and practice tests (seeded papers, Sitting/Result)
  - multi-voice speech (`speakLines`, `cast`) and no-voice detection
  - the conjugation trainer
- `app/style.css`: tokens, dark mode, motion, reduced motion.
