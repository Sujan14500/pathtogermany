# 08 · Exam formats: the Goethe parts the app's content and tests follow

The app's texts, recordings and tasks are original; only the *format* follows the Goethe-Zertifikat. Each piece
of content names its part (`part: "Teil 2"`), so practice tests and mock exams can assemble a paper in the real
order. Every fact below was checked in October 2026 against Goethe's own documents (see Sources at the end): the
Durchführungsbestimmungen in force since 1 September 2025 and the current Modellsätze. The Übungssätze are linked in
the app, never copied.

| Level | Lesen | Hören | Schreiben | Sprechen | Pass |
|---|---|---|---|---|---|
| A1 (Start Deutsch 1) | 3 parts, 15 items, 25 min | 3 parts, 15 items, about 20 min | 2 parts, 20 min | 3 parts, 15 min, group of up to 4, no preparation | 60 of 100 overall |
| A2 | 4 parts, 20 items, 30 min | 4 parts, 20 items, about 30 min | 2 parts, 30 min | 3 parts, 15 min in pairs, no preparation | 60 of 100, with at least 45 of 75 written and 15 of 25 in Sprechen |
| B1 | 5 parts, 30 items, 65 min | 4 parts, 30 items, about 40 min | 3 parts, 60 min | 3 parts, 15 min in pairs, after 15 min preparation | 60 of 100 in each module (modular) |

The written exam order is Hören, Lesen, Schreiben at A1 and Lesen, Hören, Schreiben at A2 and B1; the app's mocks
keep it.

## Scoring

- **A1:** Hören and Lesen 1 point per item (15 each). Schreiben Teil 1 = 5 (one per form field), Teil 2 = 10.
  Sprechen Teil 1 = 3, Teil 2 = 6, Teil 3 = 6. Each module's 15 raw points × 1.66 = 25; the four add up to 100.
  Pass: 60 overall, every module taken; there is no minimum per module.
- **A2:** Hören and Lesen 1 point per item (20 each) × 1.25 = 25. Schreiben Teil 1 = 10, Teil 2 = 10 (5 for
  Aufgabenerfüllung + 5 for Sprache each), 20 × 1.25 = 25. Sprechen Teil 1 = 4, Teil 2 = 8, Teil 3 = 8, plus 5 for
  Aussprache over the whole test = 25. Pass: 60 of 100 **and** at least 45 of the 75 written points (Lesen + Hören +
  Schreiben) **and** at least 15 of the 25 Sprechen points; otherwise the whole exam fails.
- **B1:** Lesen and Hören 30 items × 3.33 = 100. Schreiben Teil 1 = 40, Teil 2 = 40, Teil 3 = 20 (100). Sprechen
  Teil 1 = 28, Teil 2 = 40, Teil 3 = 16, plus 16 for Aussprache over all three parts (100). Each module passes on its
  own at 60.

In the app (`EXAMS` in `app/src/85-tests.js`) every part's self-score includes a pronunciation line, so Aussprache is
spread over the parts by scaling: A2 4 + 8 + 8 → 25, B1 28 + 40 + 16 → 100.

## Lesen (reading)

Question formats: `rf` (richtig/falsch), `jn` (ja/nein), `abc` (three options), `match` (choose the ad/text by its
label; `x` = none fits, which the paper marks as X at A2 and 0 at B1). Goethe gives no word counts for reading
texts; the ranges below are the app's targets, with the Modellsatz length where it was measured.

- **A1 Teil 1** · two short personal texts (note, email), 40–90 words each · 5 × `rf`.
- **A1 Teil 2** · ten small ads or web snippets, two per situation · 5 × `match` with two options (a/b): "Where do
  you find the information?".
- **A1 Teil 3** · five signs, notices or short announcements · 5 × `rf`.
- **A2 Teil 1** · a short newspaper article, 120–200 words (Modellsatz: about 180) · 5 × `abc`.
- **A2 Teil 2** · an information board or programme (department store, town hall, school) · 5 × `abc` ("Where do
  you go?").
- **A2 Teil 3** · an email or letter, 150–260 words (Modellsatz: about 255) · 5 × `abc`.
- **A2 Teil 4** · 6 short ads (a–f), 6 people (one is the example) · 5 × `match`; for one person no ad fits (`x`).
  The app's A2 Teil 4 texts (station and exam pool) all have one `x` item, with a near-miss ad as the trap.
- **B1 Teil 1** · a blog or diary entry, 250–350 words (Modellsatz: about 340) · 6 × `rf`. 10 min.
- **B1 Teil 2** · two press articles of about 200–300 words · 3 × `abc` each. 20 min.
- **B1 Teil 3** · 10 short ads (a–j), 7 situations · 7 × `match`, one situation has no fitting ad (`x`). 10 min.
- **B1 Teil 4** · 7 reader comments on one question (40–80 words each) · 7 × `jn` ("Is the writer for …?"). 15 min.
- **B1 Teil 5** · house rules, terms or instructions, 150–250 words · 4 × `abc`. 10 min.

## Hören (listening)

How often each part is played (`once` in the listening files; `scripts/check_content.py` enforces it). Voices: `A`
(a woman), `B` (a man), `N` (an announcer or narrator).

| Level | Teil 1 | Teil 2 | Teil 3 | Teil 4 |
|---|---|---|---|---|
| A1 | twice | **once** | twice | |
| A2 | twice | **once** | **once** | twice |
| B1 | twice | **once** | **once** | twice |

- **A1 Teil 1** · 6 short everyday conversations · 1 × `abc` each.
- **A1 Teil 2** · 4 public announcements (station, shop, airport) · 1 × `rf` each.
- **A1 Teil 3** · 5 phone messages (answering machine) · 1 × `abc` each.
- **A2 Teil 1** · 5 short texts: radio, answering machine, announcements · 1 × `abc` each.
- **A2 Teil 2** · one longer conversation; 5 people or days to match to a picture or choice (a–i, each used once) ·
  5 × `match`.
- **A2 Teil 3** · 5 short everyday conversations · 1 × `abc` each.
- **A2 Teil 4** · a radio interview · 5 × `jn` ("Did the guest say …?").
- **B1 Teil 1** · 5 short texts (messages, announcements, radio) · 2 questions each: `rf` then `abc`.
- **B1 Teil 2** · a guided tour or talk · 5 × `abc`.
- **B1 Teil 3** · a conversation between two people · 7 × `rf`.
- **B1 Teil 4** · a radio discussion with a host and two guests · 8 × `match` (who says it: host, guest 1, guest 2).

## Schreiben (writing)

- **A1 Teil 1** · fill in a form (5 missing details) from a short text about another person.
- **A1 Teil 2** · a short message (about 30 words) covering 3 given points, with a fitting greeting and closing.
- **A2 Teil 1** · a text message (20–30 words) to a friend, covering 3 points.
- **A2 Teil 2** · a semi-formal email (30–40 words), e.g. to a boss, teacher or neighbour (Sie), covering 3 points.
- **B1 Teil 1** · a personal email (about 80 words) covering 3 points. 20 min.
- **B1 Teil 2** · a forum or guest-book post giving your opinion (about 80 words). 25 min.
- **B1 Teil 3** · a short semi-formal email (about 40 words), e.g. apologising or asking for something. 15 min.

Assessment criteria (the self-score groups in `app/src/50-writing.js`):

- **A1 Teil 2:** Erfüllung der Aufgabenstellung (3 points per content point, fully if it is answered and
  understandable) · Kommunikative Gestaltung des Textes (1 point: fits the text type, e.g. greeting).
- **A2:** Aufgabenerfüllung (Sprachfunktion, Register) · Sprache (Kohärenz, Wortschatz, Strukturen: range and
  control).
- **B1:** Erfüllung · Kohärenz · Wortschatz · Strukturen.

## Sprechen (speaking)

- **A1 Teil 1** · introduce yourself from keywords (Name, Alter, Land, Wohnort, Sprachen, Beruf, Hobby), then spell
  a word and say a number. About 5 min for the group.
- **A1 Teil 2** · two topics, word cards: ask a question with your card, answer the next person's. About 5 min.
- **A1 Teil 3** · picture cards, two rounds: make a request and react to one. About 5 min.
- **A2 Teil 1** · four question cards each: ask your partner about their life and answer theirs. About 3 min.
- **A2 Teil 2** · talk about yourself on a topic card with four prompts, then answer the examiner's question or two.
  About 3 min per person.
- **A2 Teil 3** · plan something together (two diaries, find a time). About 5 min.
- **B1 Teil 1** · plan something together from 4 guiding points (what, when, where, who brings what). 2–3 min.
- **B1 Teil 2** · a presentation on a topic, guided by 5 slides (the topic, your experience, the situation in your
  country, pros and cons with your opinion, a closing). 3–4 min per person.
- **B1 Teil 3** · react to the partner's presentation: give feedback and ask a question; answer theirs and the
  examiner's. 1–2 min per person.

Preparation: none at A1 and A2; at B1, 15 minutes before the test (for Teil 1 and Teil 2). The app's mock exams
follow this; the station tasks keep a short preparation timer as practice.

Assessment criteria (the self-score groups in `app/src/50-writing.js`, `CRITERIA.speak`):

- **A1:** one criterion per task, Erfüllung der Aufgabenstellung und sprachliche Realisierung (full points, half, or 0).
- **A2:** Aufgabenerfüllung (Sprachfunktion, Interaktion, Register) and Sprache (Wortschatz, Strukturen) per part;
  Aussprache once for the whole test.
- **B1 Teil 1:** Erfüllung · Interaktion · Wortschatz · Strukturen. **Teil 2:** Erfüllung · Kohärenz · Wortschatz ·
  Strukturen. **Teil 3:** Erfüllung. Aussprache once over all three parts.

Writing and speaking in the app's mock exams are self-scored against these criteria; the app says so.

## Sources

Read on 28 October 2026. Format facts only; no exam content was copied.

- A1 Durchführungsbestimmungen (Stand 1 Sept 2025): timings, group test without preparation, points per part, × 1.66,
  pass at 60. https://www.goethe.de/pro/relaunch/prf/de/Durchfuehrungsbestimmungen_A1_Start_Deutsch_1.pdf
- A1 Modellsatz (8th ed., Feb 2024): play counts, part instructions, Bewertung Schreiben and Sprechen.
  https://www.goethe.de/pro/relaunch/prf/materialien/A1_sd1/sd_1_modellsatz.pdf
- A1 Prüfungsziele, Testbeschreibung: Hören Teil 1 and 3 twice, Teil 2 once; Lesen and Schreiben part descriptions.
  https://www.goethe.de/pro/relaunch/prf/en/Pruefungsziele_Testbeschreibung_A1_SD1.pdf
- A2 Durchführungsbestimmungen (Stand 1 Sept 2025): 20 + 20 items × 1.25, Schreiben 20 × 1.25, Sprechen 25, pass
  rule 60 / 45 written / 15 oral, no preparation, part timings.
  https://www.goethe.de/pro/relaunch/prf/ca/Durchfuehrungsbestimmungen_A2.pdf
- A2 Modellsatz Erwachsene (Vs5.1): parts and items, play counts, Lesen Teil 4 with one "no ad" item, word counts
  for Schreiben, Bewertungskriterien and grading sheets for Schreiben and Sprechen (points per criterion).
  https://www.goethe.de/pro/relaunch/prf/materialien/A2/A2_Modellsatz_Erwachsene.pdf
- B1 Durchführungsbestimmungen (Stand 1 Sept 2025): timings, 15 min preparation, 30 items × 3.33, module pass at 60.
  https://www.goethe.de/pro/relaunch/prf/de/Durchfuehrungsbestimmungen_B1.pdf
- B1 Modellsatz Erwachsene: parts and items, minutes per part, play counts, Bewertungskriterien per task.
  https://www.goethe.de/pro/relaunch/prf/materialien/B1/b1_modellsatz_erwachsene.pdf
- B1 online Modellsatz (Goethe): points per criterion, Schreiben 40/40/20 and Sprechen 28/40/16 + 16 Aussprache.
  https://bfu.goethe.de/b1_mod/schreiben.php and https://bfu.goethe.de/b1_mod/sprechen.php (this page names the
  4-point criterion of Teil 2 "Interaktion"; the printed Modellsatz names it Kohärenz, which the app follows).
