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

// The shell cache is VERSIONED by APP_VERSION (kept in lockstep by
// scripts/bump-version.js + the pre-commit hook). A new version -> a new cache
// name -> every installed client re-fetches the shell on its next load (a forced
// PWA update), while the game's model + radio caches keep their STABLE names and
// survive untouched (no re-download of the 3D assets or the ~150MB of music).
var CACHE_NAME = 'dsnboy-shell-v1.0.23';
var APP_VERSION = '1.0.17';

// The page shell: everything needed to boot + render the menu with no network.
// Kept in sync with the <script src> / <img src> / font links in index.html.
var SHELL = [
  './',                 // index.html (navigation fallback -> the game page)
  './index.html',
  './dsnylogo.jpg',     // menu logo (also preloaded by the game gate)
  './explicit_logo.webp', // "Parental Advisory" gag badge on the logo
  './manifest.json',    // PWA manifest (official title for "Add to Home Screen")
  './music/manifest.json', // radio track list (needed OFFLINE so the station can
                           // discover which tracks are in the radio cache)
  // Draco decoder (local copy of the gstatic.com CDN build) - litterReduced2.glb
  // is Draco-compressed, so the decoder must be available OFFLINE. The DRACOLoader
  // pulls these in the MAIN THREAD via XHR (FileLoader) and hands the wasm binary
  // to the Web Worker over postMessage, so precaching them here is enough for
  // offline decoding. The old CDN path hung forever on iOS with the radios off.
  './draco/draco_decoder.wasm',
  './draco/draco_wasm_wrapper.js',
  './draco/draco_decoder.js',
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

// iOS Safari can hang a network fetch() INDEFINITELY when the radios are off
// (wifi + cellular disabled) instead of failing fast - this is the root cause of
// the app getting stuck on the "PLEASE WAIT / getting assets" screen. Every
// network fetch in the SW goes through this helper so a hung request is aborted
// after `ms` and the caller falls back to whatever is cached. A request that is
// already served from the cache never reaches the network, so cached loads stay
// instant.
function fetchTimeout(req, ms) {
  var timeout = (typeof ms === 'number' && ms > 0) ? ms : 15000;
  var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  var t = null;
  if (ctrl) t = setTimeout(function () { ctrl.abort(); }, timeout);
  return fetch(req, ctrl ? { signal: ctrl.signal } : {}).then(function (res) {
    if (t) clearTimeout(t);
    return res;
  }, function (err) {
    if (t) clearTimeout(t);
    throw err;
  });
}

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
    // Drop only STALE SHELL caches (older dsnboy-shell-v* versions). The game's
    // own model + radio caches (dsnboy-models-v1 / dsnboy-radio-v1) must survive
    // every SW (re)activation - wiping them would force a full re-download of
    // the 3D assets and the music on every deploy.
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf('dsnboy-shell-v') === 0 && k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
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
  // The music/ directory listing is also passed through (NOT SW-cached) so adding
  // a new .mp3 to the folder keeps working on the very next scan.
  // EXCEPTION: music/manifest.json (the track LIST) IS precached above and served
  // cache-first here - offline the station needs it to know which tracks to play
  // from the radio cache. The .mp3 files themselves stay owned by the game cache.
  // NOTE: use indexOf(...) !== -1 (not === 0) so this also matches when the site
  // is served from a GitHub Pages subdirectory (e.g. /DSNYBoy/music/manifest.json).
  if (/\.(fbx|glb|gltf|mp3)$/i.test(url.pathname) || url.pathname.indexOf('/music/') !== -1) {
    if (url.pathname.indexOf('/music/manifest.json') !== -1) {
      e.respondWith(
        caches.match('./music/manifest.json').then(function (hit) {
          if (hit) return hit;
          return fetchTimeout(req).catch(function () { return caches.match('./music/manifest.json'); });
        })
      );
      return;
    }
    return;
  }

  // Draco decoder files (./draco/*.wasm|js): precached above, served cache-first
  // so the litter basket's Draco-compressed GLB can decode OFFLINE. These are NOT
  // in CACHEABLE (wasm/js from a local path) so they need their own rule; a
  // network fetch (timeout-guarded) is the fallback so a fresh first visit still
  // works, and a cache hit is always preferred once precached. indexOf(...) !== -1
  // keeps this correct under a GitHub Pages subdirectory (e.g. /DSNYBoy/draco/).
  if (url.pathname.indexOf('/draco/') !== -1) {
    e.respondWith(
      caches.match(req).then(function (hit) {
        if (hit) return hit;
        return fetchTimeout(req).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
          }
          return res;
        }).catch(function () { return caches.match(req); });
      })
    );
    return;
  }

  // Navigation requests (including index.html): NETWORK-FIRST so we always get
  // the latest version on reload. Fall back to cache only if offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetchTimeout(req).then(function (res) {
        if (res && res.ok) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return caches.match(req).then(function (hit) { return hit || caches.match('./index.html'); }); })
    );
    return;
  }

  // Other shell resources (three.js, loaders, font css/woff, title art):
  // cache-first, then network (with a timeout so iOS offline can't hang it,
  // storing the result), then whatever's cached.
  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetchTimeout(req).then(function (res) {
        var type = res.headers.get('content-type') || '';
        if (res.ok && CACHEABLE.indexOf(type) >= 0) {
          var copy = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () { return caches.match(req); });
    })
  );
});