// BakeryIQ Service Worker
// Caches the app shell for offline use
// Data always syncs to Supabase when online

const CACHE = 'bakeryiq-v1';
const SHELL = [
  '/bakeryiq-/',
  '/bakeryiq-/index.html',
  '/bakeryiq-/manifest.json',
  '/bakeryiq-/icon.svg',
  'https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=DM+Sans:wght@300;400;500;600;700&display=swap'
];

// Install: cache the app shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      // Cache core files, ignore font failures (network dependent)
      return Promise.allSettled(SHELL.map(url => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - Supabase API calls: network first, no cache (always need fresh data)
// - App shell (HTML, manifest, icon): cache first, then network
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never cache Supabase API calls
  if (url.hostname.includes('supabase.co')) {
    e.respondWith(
      fetch(e.request).catch(() =>
        new Response(JSON.stringify({error: 'offline'}),
          {status: 503, headers: {'Content-Type': 'application/json'}})
      )
    );
    return;
  }

  // For everything else: cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(response => {
        // Cache successful GET responses for the app shell
        if (e.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => {
        // If offline and not cached, return the main app
        if (e.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
