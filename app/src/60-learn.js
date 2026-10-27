// ---- how you learn here: the research behind the app (docs/07-learning-science.md), each tip linked to its feature ----

const TIP_ICONS = {
  test: html`<rect x="9" y="6" width="30" height="36" rx="4" fill="none" stroke="currentColor" stroke-width="3" />
    <path d="M19 19a5 5 0 1 1 7 4.6c-1.4.7-2 1.6-2 3.4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" /><circle cx="24" cy="33" r="2" fill="currentColor" />`,
  often: html`<rect x="6" y="10" width="36" height="32" rx="4" fill="none" stroke="currentColor" stroke-width="3" /><path d="M6 18H42M15 6v8M33 6v8" stroke="currentColor" stroke-width="3" />
    ${[14, 24, 34].map(x => html`<circle cx=${x} cy="30" r="3" fill="currentColor" />`)}`,
  aloud: html`<path d="M8 19v10h7l9 7V12l-9 7H8z" fill="currentColor" /><path d="M30 17a9 9 0 0 1 0 14M35 12a16 16 0 0 1 0 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" />`,
  sleep: html`<path d="M30 8a16 16 0 1 0 10 26A13 13 0 0 1 30 8z" fill="currentColor" /><path d="M33 12h7l-7 8h7" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round" />`,
  twice: html`<circle cx="15" cy="24" r="9" fill="currentColor" /><circle cx="35" cy="24" r="9" fill="none" stroke="currentColor" stroke-width="3" stroke-dasharray="4 3" />`,
  mix: html`<path d="M6 14h9c6 0 9 20 15 20h10M6 34h9c6 0 9-20 15-20h10" fill="none" stroke="currentColor" stroke-width="3" />
    <path d="M36 9l5 5-5 5M36 29l5 5-5 5" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />`,
  guess: html`<path d="M8 10h32a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H22l-8 7v-7H8a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3z" fill="none" stroke="currentColor" stroke-width="3" />
    <path d="M20 18a4 4 0 1 1 5.5 3.7c-1 .5-1.5 1.2-1.5 2.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" /><circle cx="24" cy="29" r="1.8" fill="currentColor" />`,
  hook: html`<path d="M24 5v24a8 8 0 1 1-16 0" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" /><path d="M8 29l-3-6" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" />
    <circle cx="24" cy="5" r="3" fill="currentColor" />`,
}
// Each tip: what to do, why (one or two sentences), the evidence, and where the app does it.
// A "here" entry is [label, href] when it's built, or [label, null, 'with Reading'] for what comes in a later phase.
function tipsFor(s) {
  const st = `#/station/${s.lesson}`
  return [
    { icon: 'test', title: "Test, don't reread", says: 'Pulling a word out of memory makes it stronger; reading it again barely does. So every step here ends in a question, a typed answer or something you say.',
      ev: 'Retrieval practice: Karpicke & Roediger 2008; Dunlosky et al. 2013 (strong evidence).',
      here: [["Today's cards", '#/study'], ['Cover the English in a word list', `${st}/words`], ['Test yourself on a station', `${st}/words`],
        ['Known words in a text: how much of it you already know', null, 'with Reading']] },
    { icon: 'often', title: 'Little and often', says: 'Spread your study over the days. Each card comes back just before you would forget it, so fifteen minutes a day beats two hours on a Sunday.',
      ev: 'Spacing: Cepeda et al. 2008 (strong). The cards use FSRS, aiming at 90% recall.',
      here: [["Today's cards, with the minutes they take", '#/study'], ['Revisit stops: a passed station test returns after 1, 7 and 21 days', null, 'with the tests'],
        ['Station tests that mix in the six stations before', null, 'with the tests'], ['Mock exams spaced at least three days apart', null, 'with the tests']] },
    { icon: 'aloud', title: 'Say it aloud', says: 'Words you say out loud stick better than words you read silently. Every card asks you to say it, and the voice says it back.',
      ev: 'The production effect: MacLeod et al. 2010; Fawcett 2013. Shadowing helps most at lower levels (Hamada).',
      here: [["Today's cards", '#/study'], ['Shadowing: hear a line, record yourself straight after', null, 'with Listening'],
        ['Read it again against the clock; hear it again, faster', null, 'with Reading and Listening']] },
    { icon: 'sleep', title: 'Sleep on it', says: 'Sleep between two sessions halves the work of relearning. Do your cards in the evening and again the next morning.',
      ev: 'Mazza et al. 2016.', here: [["Today's cards", '#/study']] },
    { icon: 'twice', title: 'Never miss twice', says: 'A habit takes about two months to form, and one missed day does not break it; two in a row might. Decide when and where you study, in one sentence.',
      ev: 'Habits: Lally et al. 2010. If-then plans: Gollwitzer & Sheeran 2006 (d = 0.65).',
      here: [['Your week on the home page', '#/'], ['Your study plan (Settings)', '#/']] },
    { icon: 'mix', title: 'Mix it up', says: 'Once you have met things one at a time, mix them: new words among old ones, all verb forms in one drill. Telling similar things apart is what the exam asks.',
      ev: 'Interleaving: Brunmair & Richter 2019 (g = 0.42).',
      here: [['New cards among the reviews', '#/study'], ['Verb forms', '#/verbs'], ['der, die, das', '#/gender'], ['Cases and endings', '#/cases']] },
    { icon: 'guess', title: 'Guess first', says: 'A guess before the lesson, even a wrong one, makes the lesson stick. Each grammar point starts with one question.',
      ev: 'Pretesting: Kornell, Hays & Bjork 2009; Richland, Kornell & Kao 2009.',
      here: [['The grammar of your station', `${st}/grammar`], ['Predict first: what a text will be about', null, 'with Reading']] },
    { icon: 'hook', title: 'Hooks for tricky words only', says: 'Most words stick through repetition. For the few that keep slipping, make a picture: der words frozen in blue ice, die words on fire, das words overgrown with leaves.',
      ev: 'The keyword method: Atkinson & Raugh 1975; mixed evidence on its own, so only for words missed four times.',
      here: [['Tricky words get a memory hook in your cards', '#/study']] },
    { icon: 'test', title: 'The exam day', says: 'Know the format before the day: sit at least two full mock exams under time. Read the questions before the text, answer every question (a wrong answer costs nothing), and tick off every point of a writing task.',
      ev: 'Goethe-Zertifikat: 60% passes; at B1 each module is passed on its own.',
      here: [['Practice tests in every module', null, 'with the tests'], ['Timed mock exams', null, 'with the tests']] },
  ]
}

function Tips({ arg }) {
  const s = useStore()
  const tips = tipsFor(s)
  const i = Math.min(Math.max(Number(arg) || 0, 0), tips.length - 1)
  const t = tips[i]
  const go = t.here.find(([, href]) => href)
  const open = (e, href) => { if (href === '#/' && /Settings/.test(e.currentTarget.textContent)) { e.preventDefault(); location.hash = '#/'; setTimeout(openSettings, 300) } }
  return html`<main class="page tips">
    <header class="masthead"><h1>How you learn here</h1>
      <p>Nine findings from memory research, and where this app puts each one to work.</p></header>
    <nav class="tip-line" aria-label="Tips">
      <ol>${tips.map((x, k) => html`<li class=${k === i ? 'on' : k < i ? 'past' : ''}><a href=${`#/tips/${k}`} aria-current=${k === i ? 'step' : null}>
        <span class="tdot">${k + 1}</span><span class="tname">${x.title}</span></a></li>`)}</ol>
    </nav>
    <article class="tip" key=${i}>
      <svg class="tip-icon" viewBox="0 0 48 48" width="56" height="56" aria-hidden="true">${TIP_ICONS[t.icon]}</svg>
      <div class="tip-body">
        <h2>${t.title}</h2>
        <p class="tip-says">${t.says}</p>
        <h3>In this app</h3>
        <ul class="tip-here">${t.here.map(([label, href, when]) => html`<li class=${href ? '' : 'later'}>
          ${href ? html`<a href=${href} onClick=${e => open(e, href)}>${label}</a>` : html`<span>${label}</span> <small>${when}</small>`}</li>`)}</ul>
        <p class="tip-ev">${t.ev}</p>
        <div class="after">
          ${go ? html`<a class="btn" href=${go[1]} onClick=${e => open(e, go[1])}>Try it now <${Arrow} /></a>` : ''}
          ${i > 0 ? html`<a class="button" href=${`#/tips/${i - 1}`}>← Previous</a>` : ''}
          ${i < tips.length - 1 ? html`<a class="button" href=${`#/tips/${i + 1}`}>Next: ${tips[i + 1].title} →</a>` : ''}
        </div>
      </div>
    </article>
  </main>`
}
PAGES.tips = Tips
