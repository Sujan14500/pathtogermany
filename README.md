# Path to Germany (Weg nach Deutschland)

A private German study app from A1 to B1 for the Goethe-Zertifikat, taught through English. It isn't built yet:
this folder holds the brief that a Claude Code session builds it from.

## How to start

1. Open this folder in VS Code.
2. In the Claude chat, paste the contents of `prompts/01-start.md` (or just say "start building").
3. In later sessions, paste `prompts/02-continue.md` (or say "continue").
4. When you have textbook PDFs or audio, paste `prompts/03-materials-added.md` with the folder path filled in.

## What's here

| File | What it is |
|---|---|
| `CLAUDE.md` | Standing rules Claude Code reads in every session here |
| `docs/01-product.md` | Every feature and page |
| `docs/02-architecture.md` | How it's built: no build step, one HTML file, router, speech |
| `docs/03-content.md` | Sources, syllabus, grammar by level, exam structure, schemas, validators, copyright |
| `docs/04-design.md` | Visual identity, layout, motion |
| `docs/05-build-plan.md` | Phases 0–9 with acceptance checks |
| `docs/06-lessons-learned.md` | Pitfalls from the Japanese sister app |
| `docs/PROGRESS.md` | Phase checklist the builder keeps current |
| `prompts/` | Messages to paste into the chat |

Once built, the app opens by double-clicking `app/WegNachDeutschland.html`.
