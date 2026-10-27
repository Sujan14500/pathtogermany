# 01 · Product: what the app does

## Goal

Take the learner from zero (A1) to passing **Goethe-Zertifikat B1**, passing the A1 (Start Deutsch 1) and A2
exams along the way. The learner studies every day in short sessions. The app always shows the next step and
makes every skill the exam tests practisable: Lesen, Hören, Schreiben, Sprechen, plus the vocabulary and
grammar under them.

## Structure: a route with lines and stations

- **Lines:** A1, A2, B1, each with its own line colour. Each line has two halves (A1.1/A1.2, A2.1/A2.2,
  B1.1/B1.2), shown as one line split visually.
- **Stations:** one per textbook chapter (Lektion). If no textbook is chosen, use the built-in syllabus in
  `docs/03-content.md`: 12 chapters per level, organised by Goethe themes.
- **What a station holds:** its words, its grammar points, one reading text, listening items, a writing task, a
  speaking task, a picture scene where one fits, and a station test.
- **Current stop:** the learner sets it; new flashcards come from stations up to it.

## Pages (each has its own URL hash, and Back and Forward work)

| Page | Hash | Purpose |
|---|---|---|
| Today (home) | `#/` | Station sign for the current stop; progress ring for the level; one "next step" button; today's plan as a mini route (Cards → Words → Grammar → Read → Listen → Write → Speak → Test); drawn practice tiles; full route map |
| Cards | `#/study` | FSRS flashcard session (due reviews first, then today's new cards) |
| Station | `#/station/<n>/<tab>` | Tabs: Words, Grammar, Read, Listen, Write, Speak, Pictures, Test. Each tab is its own URL |
| Practice hub | `#/practice` | Tiles for all trainers |
| Practice tests | `#/tests/<level>` and `#/tests/<level>/<module>/<k>` | Numbered tests per level and module |
| Mock exam | `#/mock/<level>/<full\|short>` | Timed, exam-format paper, scored like Goethe |
| Verb forms | `#/verbs` | Conjugation trainer |
| Der/die/das | `#/gender` | Gender trainer |
| Cases and endings | `#/cases` | Case and adjective-ending trainer, with a visual case table |
| Pronunciation | `#/sounds` | Minimal-pair listening and sound guide |
| Pictures | `#/pictures` and `#/pictures/<scene>` | Drawn interactive scenes |
| Tips | `#/tips/<i>` | How to learn faster, and exam strategy |

A top bar on every page links Today, Cards (with the due count), Practice, Tests, Mock exam and Pictures, and
shows the current stop.

## Features in detail

### Words (Wortschatz)
- Every noun is shown with its article, colour-coded by gender, and its plural, e.g. *der Tisch, die Tische*.
  Use the same colours everywhere in the app.
- Card fields: German, IPA (from Wiktionary), English meaning, one example sentence (German + English),
  audio (TTS) and lesson.
- Recognition cards (German → English) and production cards (English → German with article and plural).
  Production comes after recognition is learned.
- Verbs show the key forms: *fahren, fährt, fuhr, ist gefahren*.
- FSRS scheduling (ts-fsrs) with four grades and keyboard shortcuts. A new-cards-per-day setting.
- On a station's Words tab: the list with audio, the station's picture scene if there is one, and a short
  "Test yourself" quiz in Goethe vocabulary formats.

### Gender trainer (der/die/das)
- Fast drill: a noun appears and you tap der, die or das. Ending rules are taught as you go: *-ung, -heit, -keit,
  -schaft, -ion → die*; *-chen, -lein, -ment, -um → das*; *-er (for people), -ling, -ismus → der*;
  plus exceptions.
- After a miss, show the rule that applies, or say it's an exception to learn.
- Plural-forming drill (-e, -en, -er, -s, umlaut, no change).

### Grammar
- Each grammar point has:
  - a one-line pattern
  - a plain-English explanation
  - a comparison with English where it helps (word order, false friends, *you* → du/ihr/Sie, case shown in
    English pronouns he/him, who/whom)
  - 2–4 aligned German↔English examples, with chunk-to-chunk lines showing how the word order differs
  - a sentence builder: tap the German chunks in order; it checks V2 and verb-final positions and animates
    the verb moving into place
- Grammar points by level are listed in `docs/03-content.md`.
- Every grammar point has at least one form-choice question (pick the form that fits the blank), used in
  station quizzes and tests.

### Verb forms trainer
- Generated from verb data:
  - Präsens, including stem-changing verbs (e→i, e→ie, a→ä), separable and inseparable prefixes, and modals
  - Perfekt: haben or sein, plus Partizip II
  - Präteritum
  - Imperativ (du, ihr, Sie)
  - Konjunktiv II (würde, hätte, wäre, könnte) for A2/B1
  - Passiv for B1
- Multiple choice, where the wrong options are real learner mistakes: the wrong auxiliary, *gefahrt* for
  *gefahren*, a missed stem change, a wrongly split prefix.
- After answering, animate the ending sliding off and the new one sliding on, and offer a full conjugation table.
- Filters: verbs up to the current stop, and which forms to practise. Forms unlock as the syllabus reaches them.

### Cases and endings
- A visual case table (Nominativ, Akkusativ, Dativ, Genitiv) × (masculine, feminine, neuter, plural) for
  articles, kein- and possessive words, and pronouns. The cells that change are highlighted
  (der→den only in the masculine accusative).
- Drills: choose the article or ending in a sentence. Prepositions with fixed cases (durch, für, gegen, ohne,
  um → Akk; aus, bei, mit, nach, seit, von, zu → Dat). Two-way prepositions (Wo? → Dat, Wohin? → Akk),
  shown with an animated "into" or "inside" picture.
- Adjective endings (weak, mixed, strong) with a decision diagram that lights up the path taken.

### Pronunciation
- A sound guide with animated mouth diagrams for ü, ö, ä, ch (ich/ach), r, z, s, sch/sp/st, ei/ie and eu.
- Minimal-pair listening: hear one word, pick it (Bühne/Biene, schön/schon, Kirche/Kirsche).

### Reading (Lesen)
- One original text per station in Goethe text types:
  - A1: notes, signs, short e-mails, small ads
  - A2: e-mails, announcements, adverts, short articles
  - B1: blog and forum posts, newspaper articles, letters, opinions
- Question formats follow the module: richtig/falsch, a/b/c, matching (texts ↔ people or headings), and
  finding information in ads or tables.
- Reader:
  - tap a sentence to show the English
  - glossary, where tapping a word highlights it in the text
  - after answering, the evidence sentence lights up
  - read aloud, and reading speed shown afterwards

### Listening (Hören)
- Original dialogues, announcements and phone messages in Goethe Hören formats per level: richtig/falsch,
  a/b/c, and matching.
- Read aloud with speech synthesis: separate voices for speaker A, speaker B and the announcer, or pitch
  differences if only one German voice exists. Slower speed option. Repeat once, as the exam does.
- After answering: a transcript with English per line, and why the answer is right.
- A book audio player if the user adds the textbook audio: speed, back 5 s, repeat, a track list per station.

### Writing (Schreiben)
- Exam tasks:
  - A1: fill in a form, write a short message
  - A2: a short message or e-mail
  - B1: a personal e-mail, a forum post with your opinion, a semi-formal e-mail
- Task screen:
  - the task with its required points as a checklist
  - a textarea with `lang="de"` and `spellcheck` on
  - a live word count against the target
  - useful phrases (Redemittel) for openings, reasons, opinions and closings
  - a self-check rubric matching the exam criteria
  - an original model answer revealed afterwards
- Light automatic hints, no AI service: nouns not capitalised, a missing greeting or closing, the verb not in
  second position in a simple main clause (heuristic), and Sie/du mixed. Saved drafts per task.

### Speaking (Sprechen)
- Exam tasks:
  - A1: introduce yourself; ask and answer with topic cards; requests with picture cards
  - A2: questions about everyday life; talk about yourself; plan something together
  - B1: plan something together; a presentation (5 slides); answer questions about it
- Task screen:
  - prompts and Redemittel
  - a preparation timer and a speaking timer
  - record and play back (MediaRecorder)
  - a live transcript where SpeechRecognition (de-DE) exists, compared against the target phrases
  - a partner role played by TTS for dialogue tasks
  - model answers

### Picture scenes
- Hand-drawn SVG scenes. Every object in them is a vocabulary word, labelled with its coloured article.
- At least: Körper (body and face), in der Stadt (town with moving tram, bus, cars, bike, traffic light),
  Küche und Tisch, im Park, Wohnung (rooms and furniture), Kleidung, Schule/Klassenzimmer, Wetter (with a
  sun, rain and snow toggle), Supermarkt, Bahnhof.
- Modes:
  - Explore: tap to hear it and see the word with its article, plural and English
  - Find: hear a word, tap it
  - Name: a thing glows, pick the right word with the right article
  - Show all names
  - Pause the motion
- Each scene appears on stations that teach its words. Flashcards for those words show the object glowing in
  its scene.

### Practice tests and mock exam
- **Practice tests:** numbered, seeded tests per level and module (Lesen, Hören, Schreiben, Sprechen,
  Wortschatz, Grammatik), the same questions every time.
  - Best score saved; 60% passes.
  - Counts per level are roughly A1: 15 per module, A2: 20, B1: 20, more where the question banks allow.
- **Mock exam:** per level, in the real module structure and timing (see `docs/03-content.md`; verify against
  the official Übungssätze).
  - Full and short versions.
  - Scored per module the Goethe way.
  - Afterwards: a result stamp ("Bestanden" / "Noch nicht"), then a review of the wrong answers with
    explanations and a link back to the station.
- Writing and speaking in mock exams are self-scored against the rubric (the app explains this).
- A "More practice" section links the official Goethe Übungssätze pages for A1, A2 and B1 (don't copy them).

### Tips
- Short, useful tips in English, as stations on a mini line: daily habit, words and genders, grammar, reading,
  listening, writing, speaking, the exam day. Each tip links into the feature it's about.

### Background
- Behind every page, the current station's words drift slowly upward in their gender colour, and their English
  meaning surfaces halfway as a quiet recall prompt. Off under reduced motion.

## Settings and backup
- New cards per day, autoplay audio, voice choice and speech rate.
- Export and import progress (JSON). Progress lives in localStorage, so the file version and a served version
  keep separate progress; say so in the UI.
