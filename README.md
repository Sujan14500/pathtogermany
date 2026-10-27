# Path to Germany (Weg nach Deutschland)

A private German study app from A1 to B1 for the Goethe-Zertifikat, taught through English.

## Open it

Double-click **`app/WegNachDeutschland.html`**. No server, no install. Brave or Edge on Windows work best.

Progress is saved in the browser. Export a backup from *Settings and backup* at the bottom of the home page.

## Build it (only when changing content or code)

```
python scripts/build_data.py          # data/src → app/data/*.json → app/WegNachDeutschland.html
python scripts/build_data.py --test   # self-checks
python scripts/shot.py OUT.png /station/4/grammar [--w 400] [--dark]   # screenshot, prints console errors
python scripts/shot.py --smoke [--w 400]                               # open every route, report errors
```

`app/test.html` checks the helpers in `main.js`: serve the folder (`python -m http.server -d app`) and open
`/test.html`; it prints `ok`.

## Working with Claude Code

1. Open this folder in VS Code.
2. Say "continue" (or paste `prompts/02-continue.md`) to pick up the next phase in `docs/PROGRESS.md`.
3. If you get textbook PDFs or audio later, paste `prompts/03-materials-added.md` with the folder path filled in.

| File | What it is |
|---|---|
| `CLAUDE.md` | Standing rules Claude Code reads in every session here |
| `docs/01-product.md` … `06-lessons-learned.md` | Features, architecture, content, design, build plan, pitfalls |
| `docs/PROGRESS.md` | Decisions and the phase checklist |
| `docs/design/` | The agreed design tokens and the home hero mock-up |
