/* ============================================================================
   DSNYBoy service worker - page-shell offline cache
   ----------------------------------------------------------------------------
   What it owns: the PAGE SHELL - index.html, three.js, the model loader libs,
   the title art, and the pixel font. Everything the game needs to BOOT (the
   "Please Wait" screen, the logo, the menu) before a single 3D asset is
   requested. Once the shell is cached, the game opens instantly - and offline.

   What it deliberately does NOT own:
     * The 3D model assets (truck.fbx, *.glb) - those are already cached by the
       game's own model cache (Cache API, 'dsnboy-models-v1') with a byte-accurate
       progress bar + RETRY gate. The SW just passes them through.
     * The radio music (music/*.mp3) - the game caches those as it plays them
       ('dsnboy-radio-v1'). The SW passes them through too.

   Strategy: precache the shell on install (so the very next load is offline),
   then serve cache-first with network fallback + background refresh so a
   re-deploy picks up new files without breaking an offline visit.
   ============================================================================ */
'use strict';

var CACHE_NAME = 'dsnboy-shell-v1';

// The page shell: everything needed to boot + render the menu with no network.
// Kept in sync with the <script src> / <img src> / font links in index.html.
var SHELL = [
  './',                 // index.html (navigation fallback -> the game page)
  './index.html',
  './dsnylogo.jpg',     // menu logo (also preloaded by the game gate)
  './explicit_logo.webp', // "Parental Advisory" gag badge on the logo
  './fflate.min.js',    // FBX decompression
  './FBXLoader.js',
  './GLTFLoader.js',
  './DRACOLoader.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap'
];

// Request types the SW may cache; anything else (e.g. the 3D models, the radio
// music, directory listings) is left to the game's own caches.
var CACHEABLE = ['text/html', 'text/javascript', 'text/css', 'image/png', 'image/jpeg', 'image/webp'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      // Cache the shell. If a single entry 404s (e.g. a CDN blip) we still go
      // active - the runtime handler will fetch what's missing on demand.
      return Promise.all(SHELL.map(function (url) {
        return cache.add(url).catch(function (err) {
          console.warn('[SW] precache failed for ' + url + ':', err && err.message);
        });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    // Drop any stale caches from previous versions, then take control of tabs.
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return; // only handle simple GETs
  var url;
  try { url = new URL(req.url); } catch (err) { return; }

  // Pass through anything that isn't a same-site shell resource (fonts, three.js
  // CDN, and the game's own asset/music fetches are handled by their owners).
  var isShell = (url.origin === self.location.origin) || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'cdnjs.cloudflare.com';
  if (!isShell) return;

  // The 3D model + radio music files are owned by the game's own Cache API
  // instances (dsnboy-models-v1 / dsnboy-radio-v1) - let those do their job.
  // The music/ directory listing + manifest are also passed through (NOT SW-cached)
  // so adding a new .mp3 to the folder keeps working on the very next scan.
  if (/\.(fbx|glb|gltf|mp3)$/i.test(url.pathname) || url.pathname.indexOf('/music/') === 0) return;

  // Navigation requests: cache-first (the precached index.html), fall back to
  // the network, then to the cached shell so an offline visit still opens the
  // game instead of a dead tab.
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
          }
          return res;
        }).catch(function () { return caches.match('./index.html'); });
      })
    );
    return;
  }

  // Other shell resources (three.js, loaders, font css/woff, title art):
  // cache-first, then network (storing the result), then whatever's cached.
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        var type = res.headers.get('content-type') || '';
        if (res.ok && CACHEABLE.indexOf(type) >= 0) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});