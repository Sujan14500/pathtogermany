# 07 · Learning science: what the research says, and where the app uses it

The app already rests on spaced repetition (FSRS), retrieval (cards and quizzes), the gender colour code and drawn
pictures. This file adds the rest of what memory research recommends, says how strong each finding is, and specs
the feature that carries it (L1, L2, …), with where it hooks into `app/main.js` and its priority. Everything here
adds to `docs/01-product.md`; nothing in it replaces an earlier feature.

Evidence: **strong** = many studies and reviews agree; **moderate** = reliable but smaller or narrower;
**mixed** = use only where it is cheap and can't hurt.

## Findings

Dunlosky et al. (2013) rated ten study techniques. Only two got "high utility": **practice testing** and
**distributed practice**. Rereading, highlighting and summarising rated low. So the app's rule is: **every screen
ends in a retrieval task, and everything comes back later.**

| # | Principle | Evidence | In the app | Status |
|---|---|---|---|---|
| 1 | **Retrieval practice**: recalling beats rereading | strong (Dunlosky 2013; Karpicke & Roediger 2008) | Cards ask before they show; every station tab ends in a quiz. Word lists get **Cover the English**. | exists; L3 |
| 2 | **Spacing**: gaps between reviews; a gap too short hurts more than one too long | strong (Cepeda et al. 2008) | FSRS at its default 90% target retention. Passed station tests come back as **revisit stops**. | exists; L15 |
| 3 | **Successive relearning**: get it right once in a session, then relearn it on spaced days | strong (Rawson & Dunlosky 2011, 2013) | A card marked Again returns in the same session (FSRS learning steps + 20-minute learn-ahead); a word counts as learned only in review state. | exists |
| 4 | **Interleaving**: mix similar kinds of item instead of blocking them | moderate, best for telling similar things apart (Brunmair & Richter 2019, g = 0.42; Nakata & Suzuki 2019 for L2 grammar) | Production and recognition cards alternate; trainers shuffle. Add: new cards spread **among** the reviews; station tests that mix in earlier stations. | exists; L1, L16 |
| 5 | **Pretesting**: a guess before the lesson, even a wrong one, makes the lesson stick | moderate (Kornell, Hays & Bjork 2009; Richland, Kornell & Kao 2009) | **Guess first** on each new grammar point; a prediction question before each reading text. | L7, L12 |
| 6 | **Productive recall**: producing the word builds spelling and use better than picking it | moderate (Nakata 2016) | Production cards: **type the German** with its article, checked forgivingly. | L2 |
| 7 | **Production effect**: saying a word aloud makes it more memorable than reading it silently | moderate (MacLeod et al. 2010; Fawcett 2013) | Cards prompt "say it out loud first"; **shadowing** in listening and speaking. | L4, L14 |
| 8 | **Explanatory feedback**, right away; confident mistakes, once corrected, are remembered best | strong (hypercorrection: Butterfield & Metcalfe 2001) | Quizzes explain every answer. Typed answers show what differed, letter by letter. | exists; L2 |
| 9 | **Memory hooks** for the few words that won't stick | mixed alone (keyword method: Atkinson & Raugh 1975; review by Goñi-Artola & González 2017), so use it narrowly | **Tricky words**: after 4 lapses a card asks for a hook in your own words. | L8 |
| 10 | **Dual coding**: a word with a picture is remembered better than the word alone | moderate, mostly for concrete words (picture superiority) | Drawn scenes; cards for scene words show the object in its scene (already in Phase 7). | planned |
| 11 | **Gender colour** works best tied to the spoken article | mixed for colour alone | Colour is never alone: the article is written and spoken with every noun, and ending rules follow each answer. L8 adds a gender picture for tricky nouns. | exists; L8 |
| 12 | **Comprehensible input**: a text is readable without help at about 95–98% known words | moderate (Hu & Nation 2000; Schmitt et al. 2011 found a curve, not a cliff) | The reader shows how many of the text's words you know, from your cards. | L11 |
| 13 | **Four strands**: about equal time on input, output, deliberate study and fluency | framework (Nation 2007) | The daily plan covers study (cards, grammar), input (read, listen) and output (write, speak). Add fluency: a known text against the clock, a dialogue re-heard faster. | L13 |
| 14 | **Sleep consolidates**: sleeping between two sessions halved the relearning needed | moderate (Mazza et al. 2016) | End-of-session note; a tip on evening learning and morning review. | L5, L18 |
| 15 | **Habits form from steady cues**: about 66 days on average, and one missed day doesn't break it | moderate (Lally et al. 2010) | **This week** as seven dots on Home, and "never miss twice" instead of a streak that resets to zero. | L9 |
| 16 | **If-then plans** ("After breakfast, at my desk, I open my cards") raise follow-through | strong (Gollwitzer & Sheeran 2006, d = 0.65) | **My study plan**: one sentence in Settings, shown on Home. | L10 |
| 17 | **Short, known-length sessions** keep effort high | practice | The Cards stop says roughly how many minutes today's cards take. | L6 |

## Spec for the builder

Hook names are functions and components in `app/main.js`. Each item keeps what exists and adds to it.

### P1: fold into Phase 2–3 now (cheap, high value)

**L1 · New cards among the reviews** (`queue()`)
- Today the queue is `[...due, ...news, ...ahead]`, so new words come last, when attention is lowest. Spread
  them instead: one new card after every `max(1, floor(due / new))` reviews, starting with a review as warm-up;
  leftover new cards follow, then `ahead`. Keep the existing production/recognition alternation inside `news`.
- `STEP.cards` counts reviews and new cards from the queue, so its sentence stays right.
- Check: with 30 due and 10 new, no two new cards are adjacent and the first card is a review.

**L2 · Type the German on production cards** (`Study`; new export `checkAnswer(typed, w, words)`)
- On a production card (`kind 'p'`), show an input (`lang="de"`, `autocomplete="off"`, `spellcheck="false"`)
  with the placeholder "der/die/das + word" for nouns. Enter checks it and reveals the card. "Show the answer"
  stays, for when the learner only wants to say it aloud.
- `checkAnswer` returns `{ verdict, notes }`. Compare after NFC, trimming and collapsing spaces:
  - `right`: matches `said(w)` exactly.
  - `wrong` with a note, for a noun with a missing or different article: the article is the thing to learn
    ("The article belongs to the word: der Tisch").
  - `close` (counts as right, with a note): only capitals differ, umlauts typed as ae/oe/ue, ß typed as ss,
    or `sich` left out; or the learner typed another word with the same English (`words`), with the note
    "Also right; this card wants …".
  - `typo`: one letter off (Levenshtein 1) in a word of 5+ letters.
  - `wrong` otherwise.
- Feedback: show the typed answer under the right one, with missing letters underlined and extra ones struck
  through (a small LCS diff), then the usual card back.
- Suggest the grade by focusing its button: `wrong` → Again, `typo` → Hard, `right`/`close` → Good. A second
  Enter accepts it; 1–4 still override. While the input has focus, keys must type into it: today `Study`'s key
  handler checks `onControl` only for Space and Enter, so 1–4 and `s` would grade or speak. Guard those too.
- Asserts for `app/test.html`, with `w = { w: 'Tisch', p: 'n', a: 'der' }`: `'der Tisch'` right; `'Der tisch'`
  close; `'die Tisch'` wrong; `'Tisch'` wrong; `'der Tish'` typo. `'das Maedchen'` close for Mädchen;
  `'die Strasse'` close for Straße; `'freuen'` close for `sich freuen`; `'aufstehen'` right.

**L3 · Cover the English** (`WordsTab`)
- A toggle in the words header, "Cover the English", saved in `S.settings.cover`. While on, the English in rows
  that aren't open is blurred (`.wlist.cover > li:not(.open) .wen { filter: blur(5px) }`). Tapping a row
  already opens it, which uncovers that row. Try first, then look.

**L4 · Say it out loud** (`Study`, the `card-kind` line)
- Recognition: "Say the German aloud. What does it mean?" Production: "Say it in German, out loud" (+ "with
  article and plural" for nouns). Copy only.

**L5 · Sleep on it** (`Arrived`)
- After a session (`done > 0`) add one line: "Sleep on it: what you learn today is easier tomorrow."

**L6 · Minutes for today** (`todayPlan()`, the Cards note)
- `${q.length} today` → `${q.length} · about ${max(1, round(q.length * 10 / 60))} min` (10 s a card; calibrate
  from `S.log` later if it's off).

**L7 · Guess first** (`GrammarPoint`)
- While the point isn't studied (`!S.practice['g:<id>']`) and it has form-choice questions, show the first one
  above `.g-body` under the heading "Guess first", with the line "A wrong guess is fine: it makes the
  explanation stick."
- One question, no score and no stamp. After the pick, mark right or wrong and say "Read on to see why."
  It doesn't mark the point studied; the questions in "Check yourself" afterwards include it again.

### P2: Phase 2 if there's time, else Phase 9

**L8 · Tricky words and memory hooks** (`Study`, `fresh()`)
- A card with `lapses >= 4` (FSRS card field) is tricky: a "Tricky word" tag on the card, and on the back an
  input "Your memory hook", saved in `S.hooks[w.id]` (shared by the word's two cards; add `hooks: {}` to
  `fresh()`). Show a saved hook on every later reveal of either card.
- Placeholder for nouns, so the colour code becomes a picture: "Picture it in its gender: der things frozen in
  blue ice, die things on fire, das things overgrown with green leaves. Then link the sound to the meaning."
  For other words: "Link the sound to the meaning with a picture or a story of your own."

**L9 · This week** (`Home`, in `.go-text` under the stations line)
- Seven dots for the last seven days (labels Mo Di Mi Do Fr Sa So, `lang="de"`), filled when `S.log` has an
  answer that day. No streak number.
- If neither today nor yesterday has any: "Never miss twice: five minutes of cards today keeps the habit."

**L10 · My study plan** (`Settings`, `Home`)
- One text field in Settings, `S.settings.plan`, placeholder "After breakfast, at my desk, I open today's cards."
- Home shows it under the welcome line in small type. When empty, a quiet link there: "Plan when and where you
  study (one sentence)", which opens Settings.

### With their phase

- **L11 · Known words in a text** (Phase 4, reader): run `findWord` for each word of the text's station and
  earlier ones; show "You know 96% of the words here" from words in review state, and a button that marks the
  ones not learned yet. Texts should land at 90%+ for the station's own learner.
- **L12 · Predict first** (Phase 4): before a text opens, one a/b/c question on what it will be about, from its
  title and type. Same rules as L7.
- **L13 · Fluency** (Phases 4–5): after a text's questions, "Read it again against the clock" shows words per
  minute against the first read. A listening item, once answered, offers "Hear it again, faster" at rate 1.1.
- **L14 · Shadowing** (Phase 5, also Speak): per line, hear it, then record yourself straight after
  (MediaRecorder), and play the two back to back. Where `webkitSpeechRecognition` exists, mark the words it
  heard. Off without a mic, with a clear message.
- **L15 · Revisit stops** (Phase 8): store a station test pass as `S.tests['station/<n>'] = { best, passed,
  revisits: [] }`. A revisit is due 1, 7 and 21 days after the first pass. Due revisits appear on the plan rail
  right after Cards as "Revisit <station>", and open a new seeded station test (seed from `n` and
  `revisits.length`). A failed revisit comes back the next day.
- **L16 · Cumulative station tests** (Phase 8): about a third of a station test's questions come from the six
  stations before it.
- **L17 · Spaced mock exams** (Phase 8): the result page names the stations of the wrong answers to revise, and
  suggests the next mock no sooner than three days later.
- **L18 · Tips** (Phase 9): the tips line follows these findings, each tip linking to its feature: test, don't
  reread; little and often; say it aloud; sleep on it; never miss twice; mix it up; guess first; hooks only for
  tricky words; the exam day.

## What the app avoids

- **Rereading and highlighting as study**: low utility (Dunlosky 2013). The reader lets you tap for English, but
  each text ends with questions.
- **Cramming before a mock exam**: spacing beats massing (L17).
- **Raising the target retention**: above 90% the review load climbs steeply for little gain, so FSRS stays at
  its default 0.9.
- **"Learning styles" matching**: no evidence that teaching to a preferred style helps (Pashler et al. 2008).
  The app is visual and animated because pictures plus words help *everyone* (dual coding), and because the
  learner enjoys it.
- **Guilt mechanics**: no streak that drops to zero, no lost hearts. A missed day shows as a gap, then the next
  day's plan.

## Rules for every new feature

1. It ends in a retrieval task (a question, a typed answer, a spoken answer), never in reading only.
2. What was learned comes back later: through FSRS cards, a revisit stop or a cumulative test.
3. Feedback says why, straight after the answer.
4. Similar items are mixed, once each one has been met on its own.
5. Help is available on everything except what is being tested (`docs/06-lessons-learned.md`).

## Sources

- Dunlosky et al. 2013, *Improving students' learning with effective learning techniques*, Psychological Science
  in the Public Interest 14(1): [APS summary](https://www.psychologicalscience.org/news/releases/which-study-strategies-make-the-grade.html)
- Karpicke & Roediger 2008, *The critical importance of retrieval for learning*, Science 319:
  [supporting material](https://learninglab.psych.purdue.edu/downloads/2008/2008_Karpicke_Roediger_ScienceSupportingMaterial.pdf)
- Cepeda, Vul, Rohrer, Wixted & Pashler 2008, *Spacing effects in learning: a temporal ridgeline of optimal
  retention*: [PDF](https://www.evullab.org/pdf/CepedaVulRohrerWixtedPashler-PS-2008.pdf)
- Rawson & Dunlosky, successive relearning: [retrievalpractice.org summary](https://www.retrievalpractice.org/archive/2018/successive-relearning),
  [Kent State lab publications](https://www.kent.edu/psychology/comprehension-memory-lab/rawsons-comprehension-memory-lab-publications)
- Brunmair & Richter 2019, *Similarity matters: a meta-analysis of interleaved learning*:
  [PDF](https://www.psychologie.uni-wuerzburg.de/fileadmin/06020400/2019/Brunmair_Richter_in_press__2019_META-ANALYSIS_OF_INTERLEAVED_LEARNING.pdf)
- Nakata & Suzuki 2019, mixed grammar practice, Modern Language Journal 103(3), doi:10.1111/modl.12581
- Kornell, Hays & Bjork 2009, *Unsuccessful retrieval attempts enhance subsequent learning*:
  [Bjork lab](https://sites.lifesci.ucla.edu/psych-bjorklab/wp-content/uploads/sites/13/2016/07/Hays_Kornell_RBjork_inpress.pdf)
- Nakata 2016, recall vs recognition formats for L2 words, IRAL: [De Gruyter](https://www.degruyterbrill.com/document/doi/10.1515/iral-2015-0022/html?lang=en)
- MacLeod et al. 2010 and later, the production effect: [Waterloo lab papers](https://uwaterloo.ca/memory-attention-cognition-lab/sites/default/files/uploads/files/forrin-macleod-2016-cjep.pdf)
- Butterfield & Metcalfe 2001, the hypercorrection effect: [review, PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC4084803)
- Keyword method, systematic review (Goñi-Artola & González 2017): [PDF](https://revistas.udc.gal/index.php/reipe/article/download/reipe.2017.0.01.2685/pdf/9948)
- Hu & Nation 2000 and replications, text coverage: [Schmitt, Jiang & Grabe 2011](https://www.lextutor.ca/cover/papers/schmitt_etal_2011.pdf)
- Nation, the four strands: [Nation 2007 (PDF)](https://cunningham.acer.edu.au/inted/eaconf95/nation2.pdf)
- Mazza et al. 2016, sleep between sessions: [summary](https://neurosciencenews.com/learning-memory-sleep-4877/)
- Lally et al. 2010, habit formation; Gollwitzer & Sheeran 2006, implementation intentions:
  [BPS Research Digest](https://bps.org.uk/research-digest/seven-ways-be-good-1-learn-healthier-habits)
- Picture superiority in L2 word learning: [Bilingualism: Language and Cognition](https://resolve.cambridge.org/core/journals/bilingualism-language-and-cognition/article/impact-of-orthography-versus-images-on-foreign-language-learning-evidence-from-behavioral-and-neural-markers/3BCD137A3C88327937628A9894234D32)
- Shadowing (Hamada and others; modest, best for lower levels): [JALT](https://jalt-publications.org/sites/default/files/pdf-article/36.1-art1.pdf)
