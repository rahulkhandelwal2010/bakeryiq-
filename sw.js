// Chabua Bakery — Service Worker
// Strategy: Network-first for HTML (always get latest updates)
//           Cache-first for assets (fonts, icons — rarely change)
//           Never cache Supabase API calls

const CACHE = 'chabua-v4';

// Install — skip waiting so new SW activates immediately
self.addEventListener('install', e => {
  self.skipWaiting();
});

// Activate — delete ALL old caches immediately
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // 1. Never intercept Supabase — always go to network
  if(url.hostname.includes('supabase.co')){
    e.respondWith(fetch(e.request));
    return;
  }

  // 2. HTML pages — network first, cache fallback (ensures latest version always loads)
  if(e.request.destination === 'document' ||
     url.pathname.endsWith('.html') ||
     url.pathname.endsWith('/')){
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // 3. Everything else — cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if(cached) return cached;
      return fetch(e.request).then(res => {
        if(res.ok){
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
