// Offline support: the shell is cached on install and served cache-first, refreshed in the
// background (stale-while-revalidate), so a reload after an update shows it.
// Audio is left to the network: media elements fetch byte ranges, which a plain cache can't answer.
const CACHE = 'pathtogermany-v1'
const SHELL = [
  './', 'index.html', 'style.css', 'main.js', 'manifest.webmanifest',
  'vendor/htm-preact-3.1.1.js', 'vendor/ts-fsrs-5.4.2.js',
  'icons/icon.svg', 'icons/icon-192.png',
  'data/syllabus.json', 'data/words.json', 'data/grammar.json', 'data/drills.json',
  'data/reading.json', 'data/listening.json', 'data/writing.json', 'data/speaking.json',
  'data/scenes.json', 'data/sounds.json',
]

self.addEventListener('install', e => {
  // One by one, failures ignored: a data file that doesn't exist yet must not block install.
  e.waitUntil(caches.open(CACHE)
    .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
    .then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()))
})

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET' || req.headers.has('range') || new URL(req.url).pathname.includes('/audio/')) return
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(req, { ignoreSearch: true })
    const fresh = fetch(req)
      .then(res => { if (res.ok) cache.put(req, res.clone()).catch(() => {}); return res })
      .catch(() => cached || Response.error())
    return cached || fresh
  }).catch(() => fetch(req)))   // storage unavailable (private mode, quota): behave like no service worker
})
