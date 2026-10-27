# 03 · Content: sources, syllabus, schemas, validators

## Ask first (Phase 0)

1. **Textbook:** which series the learner uses (for example *Menschen*, *Netzwerk neu*, *Schritte
   international Neu*, *Studio 21*), or none.
   - With a textbook, its chapters are the stations and its word lists come from the book.
   - Without one, use the built-in syllabus below.
2. **Materials:** where the PDFs and audio are (a local folder or a Google Drive link).
   - For a Drive link, the folder must be shared "anyone with the link" for you to fetch it.
   - Remind the user to restrict it afterwards.
   - Never open personal documents in it.
3. **Exam board:** Goethe (default), telc or ÖSD, and the target exam dates.

## Copyright

- **From textbooks:** take only lists (chapter titles, word lists, grammar point names, audio track numbers).
  Everything else is written originally.
- **From exams:** the official Goethe Übungssätze and third-party test sites are copyrighted. Link to them and
  don't copy them. The app's own tests follow the same formats with original content.
- **Open data, with the licence named in the README:**
  - **Wiktionary via kaikki.org** (CC BY-SA): the German entries from English Wiktionary give English
    glosses, gender, plural, inflection tables, IPA and verb principal parts. Download the German JSONL once
    to `data/cache/`.
  - **Tatoeba** (CC BY 2.0 FR), optional: German–English sentence pairs for extra examples; keep the
    sentence ids for attribution.
  - The **Goethe-Institut word lists** (Wortliste A1, A2, B1) define what each level expects. Use them only as
    a checklist of which words each level needs, and don't redistribute the PDFs.
- **Filter dictionary senses:** drop senses tagged vulgar, offensive, derogatory, archaic or obsolete, plus
  glosses matching a crude-word regex. Check every word shown at A1 by hand.

## Built-in syllabus (when there is no textbook)

12 stations per level. Each station has a theme, about 40–70 words, 3–6 grammar points, and one text of each
skill.

- **A1:**
  - Hallo! (greetings, numbers, alphabet)
  - Ich und du (origin, languages, sein)
  - Familie
  - Essen und Trinken
  - Wohnen
  - Mein Tag (time, separable verbs)
  - Freizeit (modals können/wollen)
  - Einkaufen (accusative, prices)
  - In der Stadt (directions, imperative)
  - Gesundheit (body, müssen/dürfen)
  - Reisen (Perfekt)
  - Feste und Wetter
- **A2:**
  - Kennenlernen (Perfekt review)
  - Wohnen und Umziehen (Wechselpräpositionen)
  - Arbeit (weil, dass)
  - Freizeit und Vereine (reflexive verbs)
  - Einkaufen und Kleidung (adjective endings)
  - Gesundheit (wenn, Konjunktiv II for advice)
  - Reisen und Verkehr (Präteritum sein/haben/modals)
  - Medien (indirect questions, ob)
  - Feste (dative verbs)
  - Schule und Lernen (comparison)
  - Dienstleistungen (polite requests, würde/könnte)
  - Natur und Umwelt (zu + infinitive)
- **B1:**
  - Zusammenleben (relative clauses)
  - Arbeitswelt (passive)
  - Bildung (Präteritum)
  - Gesundheit und Sport (Konjunktiv II, unreal conditions)
  - Medien und Kommunikation (obwohl, trotzdem)
  - Konsum (genitive, wegen/trotz/während)
  - Reisen und Mobilität (Plusquamperfekt, nachdem/bevor)
  - Umwelt (um…zu, damit)
  - Kultur (two-part connectors: sowohl…als auch, weder…noch, je…desto)
  - Politik und Gesellschaft (n-declension, Futur I)
  - Zukunft und Wünsche (als/wenn, während)
  - Prüfungstraining

Grammar points by level (every one must have at least one example and one form-choice question):

- **A1:**
  - personal pronouns; sein and haben
  - present tense of regular verbs and of stem-changing verbs
  - W-questions and yes/no questions; V2 word order and inversion
  - definite and indefinite articles; kein vs nicht; noun plurals
  - accusative (articles and pronouns); possessive articles (nominative and accusative)
  - modal verbs (können, müssen, wollen, dürfen, möchten) with the verb-final infinitive
  - separable verbs; imperative (du, ihr, Sie)
  - Perfekt with haben and sein, and regular and irregular Partizip II
  - prepositions of time (am, um, im, von…bis); dative after mit, bei, zu, nach, von, aus (basic)
  - es gibt
- **A2:**
  - dative articles and pronouns; verbs with dative (helfen, gefallen, gehören)
  - two-way prepositions with stellen/stehen, legen/liegen, hängen
  - reflexive verbs; subordinate clauses with weil, dass, wenn, ob; indirect questions
  - comparative and superlative; adjective endings after der/ein/no article
  - Präteritum of sein, haben and modals
  - Konjunktiv II for politeness and advice (würde, könnte, sollte, hätte gern)
  - zu + infinitive; verbs with prepositions (warten auf, sich freuen auf/über)
  - deshalb/trotzdem as adverbs
  - werden as a full verb
- **B1:**
  - Präteritum of all verbs; Plusquamperfekt
  - passive in the present and the Präteritum, and with modals
  - relative clauses (including with prepositions)
  - Konjunktiv II for wishes, unreal conditions and the past
  - genitive and genitive prepositions
  - infinitive with zu; um…zu and damit; obwohl and trotzdem
  - als/wenn; nachdem, bevor, während, seit, bis
  - two-part connectors; n-declension; Futur I
  - Partizip I/II as adjectives (recognition)
  - indirect speech (recognition)

## Goethe exam structure (verify against the official Übungssätze before building tests)

| Exam | Lesen | Hören | Schreiben | Sprechen | Passing |
|---|---|---|---|---|---|
| A1 (Start Deutsch 1) | 3 parts, ~25 min | 3 parts, ~20 min | 2 parts (form, short message), ~20 min | 3 parts (introduce, ask/answer on topic cards, requests), ~15 min | 60% overall |
| A2 | 4 parts, ~30 min | 4 parts, ~30 min | 2 parts, ~30 min | 3 parts, ~15 min | 60% overall |
| B1 | 5 parts, 65 min | 4 parts, 40 min | 3 parts, 60 min | 3 parts, 15 min | 60% in each module (modular) |

Model the app's question formats on these parts: richtig/falsch, a/b/c, matching texts to people or headings,
and information in ads. Keep the timings and the part order.

## Content made by agents: schemas and validators

Write `scripts/check_content.py` first. It detects the content kind from the file-name prefix, prints
`ALL OK` or a list of problems, and checks:
- the file is UTF-8 with LF line endings
- required fields are present and non-empty
- English text is present where expected
- ids are unique, and evidence ids exist
- the answer index is in range and options are unique
- word references match `words.json`
- grammar ids match `grammar.json`

Content kinds (one JSON array per file, `data/src/<kind>-<level><part>.json`):
- `words-*.tsv`: lemma, pos, article (der/die/das/pl), plural ('-' = none in use), forms (verbs: 'fährt, fuhr, ist
  gefahren'), english, example_de, example_en, station (1–12 in the level). See `scripts/check_content.py`.
- `grammar-*.json`: `{id, pattern, explain, compare_en, table?, examples:[{de:[chunks], en:[[[chunkNums], text]…], v:[verb
  chunks]}]}`; station and title come from syllabus.json.
- `reading-*.json`: `{station, type, title, blocks:[{t:'h'|'p'|'list'|'table', id, de, en}], glossary:[{w, en}],
  questions:[{q, format:'rf'|'abc'|'match', opts, a, ev:[ids], why}]}`.
- `listen-*.json`: `{station, format, setup, lines:[{who:'A'|'B'|'N', de, en}], q, opts, a, why}`.
- `writing-*.json`: `{station, level, part, task, points:[…], words:[min, max], phrases:[…], model, rubric:[…]}`.
- `speaking-*.json`: `{station, level, part, task, cards:[…], phrases:[…], model, partner_lines:[…]}`.
- `gq-*.json`: `{g, q (one '___' blank), opts:[4], a, why, en}`, one per grammar point at least.
- `vq-*.json`: `{type:'synonym'|'usage'|'context', w, q, u, opts, a, why}`.

How to brief a writing agent: give it the schema, its input files (the station's words and grammar, as
plain text), the station range, topic boundaries so parallel agents don't overlap, length targets, and these
rules:
- all original
- the level's vocabulary only
- answer positions varied
- natural German, checked by the agent

Every agent must run the validator until it prints `ALL OK`, and report counts plus anything it was unsure
about. Run the validator yourself on every file before building on it.

Use original characters across the texts: for example Lena and Jonas, Frau Yilmaz (a neighbour), Herr Weber
(a teacher), Priya (a newcomer from India), Malte (a colleague). Never use a textbook's named characters.
