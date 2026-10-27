# 04 · Design: look, layout, motion

## Direction

The identity comes from German transit: **Deutsche Bahn, S-Bahn and U-Bahn signage**, station name boards,
platform numbers and line maps. It is a route the learner rides from A1 to B1.

- Each level is a line with its own colour, a line badge (A1, A2, B1) and numbered stations.
- The current chapter is a big **station name board**:
  - the chapter name, large
  - the previous and next stations on the coloured band below it
  - a small platform-number badge for the chapter number
- The current stop is marked with a small train on the route map.

Propose concrete tokens in Phase 0 (4–6 named colours, type scale, spacing) and show a screenshot before
building further. Avoid these defaults:
- a cream background with a terracotta accent
- near-black with a single neon accent
- identical rounded cards everywhere
- all-caps eyebrow labels
- emoji

## Colour

- **Gender colours** (used everywhere a noun appears, and the learner learns them as a code): der = blue,
  die = red, das = green, plural = grey or purple. Pick tones that pass contrast in both themes. Never use
  colour alone: the article text is always shown too.
- **Line colours** for A1, A2 and B1, distinct from the gender colours (for example amber/orange, teal,
  violet). Test them side by side.
- **Two themes:** a light "platform" and a dark "night platform". Boards must stand clearly apart from the page
  in dark mode: no flat navy-on-navy.

## Type

- A clear sans for Latin text with true umlaut and ß support, and a slightly condensed display face for station
  boards in the spirit of DIN. Use free fonts from Google Fonts, for example *Barlow* / *Barlow Semi Condensed*,
  *IBM Plex Sans*, or *Atkinson Hyperlegible* for body text.
- German nouns are capitalised; never apply text-transform to German words.

## Layout

- **Desktop first:** max content width about 1480 px, with two-column layouts at ≥1100 px.
  - Lesson word lists in two columns.
  - The question panel beside a picture scene.
  - The reader with its questions beside the text.
- **Phone:** one column, no horizontal page scroll, 16 px gutters. The top bar scrolls sideways only on phones.
- **Top bar (sticky)** on every page:
  - the brand mark
  - the nav: Today, Cards (with a badge), Practice, Tests, Mock exam, Pictures
  - the current stop on the right

  Other sticky elements (the exam timer bar, the scene question panel) sit below it.
- **Home, top to bottom:**
  1. A hero split into two: the station board on the left; on the right a progress ring, one sentence saying the
     next step, and one big action button.
  2. Today's plan as a rail of stops underneath.
  3. Practice tiles in a single row of drawn icons, each with a one-line hint and no paragraphs.
  4. The route map: lines with stations, each clickable to show a station card with its parts and progress.

## Motion (purposeful, and only where it teaches)

- **Sentence builder:** chunks fly into slots, and the verb visibly moves to position 2 or to the end.
- **Conjugation:** the old ending slides off and the new one slides on.
- **Cases:** the changed article cell pulses.
- **Two-way prepositions:** a ball moves *into* a box (Akk) or sits *in* it (Dat).
- **Scenes:** the tram and cars move, a person waves, steam rises, leaves fall.
  - Pointing at a moving thing holds it still, together with its name board.
  - Name boards live in a top layer, created at the same time as their objects so they stay in step.
- **Results:** a stamp lands on the result page.
- **Background:** the station's words drift up slowly.
- Everything is off or static under `prefers-reduced-motion`.

## Copy

- Plain English, sentence case, verbs that say what happens ("Start today's cards", "Hand in", "Next word").
- German examples are short and natural. Explanations are short; show instead of tell.
- An empty state says what to do next.

## Quality bar

- Visible keyboard focus.
- Contrast that passes in both themes.
- No overlapping labels.
- Nothing clipped: watch overflow on rows with badges.
- Every screen checked in a screenshot at 1500 px and at about 400 px wide.
