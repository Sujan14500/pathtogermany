# 06 · Lessons learned (from the Japanese sister app). Don't repeat these.

## Environment
- **`file://` pages can't load ES modules or `fetch()` JSON.** Ship the single bundled HTML. A service worker
  registered on `file://` throws, so register it only over http(s).
- **Python's http.server serves `.mjs` as `text/plain`.** Name vendor modules `.js`.
- **Windows Git Bash heredocs can collapse backslashes**, which silently broke a regex. Write code containing
  backslashes (regexes, escapes) with the file editing tool, not through a shell heredoc or a Python
  string inside one.
- **PowerShell `-ExecutionPolicy Bypass` was refused** by the permission check. Run local scripts directly
  instead: `& .\scripts\render-pages.ps1 …`.
- **The console is cp1252.** Set `PYTHONIOENCODING=utf-8` or `sys.stdout.reconfigure(encoding='utf-8')` when
  printing non-ASCII.
- **Headless Chrome caches CSS between runs.** Use a fresh `--user-data-dir` every time. It won't render
  below about 500 px wide, so use an iframe harness for phone-width screenshots.
- **Headless Chrome has no speech voices.** Test the no-voice path there, and real voices in the user's browser.

## Speech
- **The user's Windows had no Japanese voice, so every speaker button was silent in Brave.** Expect the same
  for German.
  - Detect it and explain the fix in the UI.
  - Installing the voice needs admin rights. Offer the elevated `Add-WindowsCapability` command, and say that
    the browser must be fully quit (Brave keeps running in the background) and reopened.
- **Brave can report zero voices.** Treat "the utterance didn't start within 2.5 s" as no voice.

## CSS and layout
- **Generic class names clashed.** The comic speech-bubble `.bubble` styled the exam's answer-number circles.
  Namespace component classes.
- **Descendant selectors leak into nested components.** `.mondai h3` turned the reader's title into a
  one-column grid. Use child selectors (`>`).
- **`overflow-x: auto` on the nav list clipped the notification badge vertically.** Allow vertical overflow,
  or only scroll sideways on phones.
- **Sticky bars collided with the sticky top bar.** Offset them by the top bar's height.
- **A utility class (`.row`) was assumed to exist but had no styles.** Check that every class has CSS.
- **Text over a background animation needs real contrast.** Keep the background faint and the boards opaque.

## SVG scenes
- **Labels drawn inside each object were covered by later objects.** Draw all name boards in a top layer.
- **Labels of moving things must move in step.** Create every label at the same time as the scene and only
  show or hide them; don't mount a label later, or its animation restarts out of sync.
- **Pause on hover through JS state** that both the object and its label read. A CSS `:hover` on one doesn't
  reach the other.
- **Crowded labels in close-ups:** put them outside the figure, with leader lines to pins.

## Generated questions
- **Substring matching broke questions:** 月 inside 月曜日. For German, "Haus" inside "Krankenhaus", or "um"
  inside "Umwelt". Match on word boundaries.
- **Distractor generators produced nonsense** (an extra vowel at the end of a word). Constrain the rules and look
  at a sample of 30 generated questions.
- **Give help on everything except what is being tested.** The learner wanted readings on all kanji words; for
  German, show meanings and articles everywhere except where they are the answer.
- **Number tests deterministically (seeded)** so "Test 7" is always the same, and save the best score per test.

## Content and process
- **Agent-written content:** always give agents a schema, input files, topic boundaries and a validator. Run
  the validator yourself after them.
- **Stay original when the learner pushes:** they asked to copy a test website's material and "previous exams".
  Explain copyright, link to the official samples instead, and build original tests in the same formats.
- **The learner asked for "pictures" and rejected emoji.** Use drawn SVG scenes.
- **The learner called the first home page "pathetic":** a wall of text cards with empty space. They responded
  well to a strong hero, one clear action, a plan rail and icon tiles.
- **"Each test page should have its own URL; back navigation should work."** Build the router like that from
  day one.
- **Git:** the learner was annoyed by an unrequested feature branch. Work on `main` only.
