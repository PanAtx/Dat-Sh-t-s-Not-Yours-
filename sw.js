/* ============================================================================
   DSNYBoy service worker - page-shell offline cache
   ----------------------------------------------------------------------------
   What it owns: the PAGE SHELL - index.html, three.js, the model loader libs,
   the title art, and the pixel + comic fonts. Everything the game needs to BOOT (the
   "Please Wait" screen, the logo, the menu) before a single 3D asset is
   requested. Once the shell is cached, the game opens instantly - and offline.

   What it owns, as the OFFLINE BACKUP COPY (v1.0.591 - THE MODEL NET):
     * The 3D model assets (*.glb) - the game caches those in its OWN model cache
       ('dsnboy-models-v1') with a byte-accurate progress bar + RETRY gate, and that
       cache stays the primary owner. They are ALSO precached in this shell and served
       cache-first, so a model-cache eviction with no network left still gets the real
       truck / litter basket / shovel bytes (see MODELS + the model rule in the fetch
       handler). The per-asset ?v=N keys the game caches under are matched with
       ignoreSearch, so the plain-url fetches the loaders make always find them.

   What it deliberately does NOT own:
     * The radio music (music/*.mp3) - the game caches those as it plays them
       ('dsnboy-radio-v2' / 'dsnboy-radio-lo-v1') and owns the whole rotation, pulled by
       the skippable full-rotation download. The SW passes them through too.

   Strategy: precache the shell on install (so the very next load is offline),
   then serve cache-first with network fallback + background refresh so a
   re-deploy picks up new files without breaking an offline visit.
   ============================================================================ */
'use strict';

// The shell cache is VERSIONED by APP_VERSION (kept in lockstep by
// scripts/bump-version.js + the pre-commit hook). A new version -> a new cache
// name -> every installed client re-fetches the shell on its next load (a forced
// PWA update), while the game's model + radio caches keep their STABLE names and
// survive untouched (no re-download of the 3D assets or the ~185MB of music).
var CACHE_NAME = 'dsnboy-shell-v1.0.595';
var APP_VERSION = '1.0.595';

// THE MODEL NET (the offline backup set for the 3D world). The game owns the models in its
// own byte-verified cache (dsnboy-models-v1, with the "Getting Assets" progress gate and a
// per-asset ?v= version), and that cache is the PRIMARY owner. Browser storage is
// best-effort: a phone under pressure can evict it even under the persist lease, and today
// the worker's only way back to those bytes is the network — which is exactly the case a
// real sanitation crew hits (a basement break room, a yard, a dead-end street with no
// signal). So every model is ALSO precached here in the versioned shell and served
// cache-first by the fetch handler below: an evicted model cache offline now gets the real
// GLB bytes and can never fall back to the procedural box truck. Cost is ~9MB of duplicated
// bytes, and the whole set is rewritten by every deploy (the cache name carries APP_VERSION).
var MODELS = [
  './nyc_truck-compressed.glb',
  './bec-compressed.glb',
  './red_bull_energy_drink_can-compressed.glb',
  './nyc_can-compressed.glb',
  './litterReduced2.glb',
  './car-compressed.glb',
  './coffee_shop_cup-compressed.glb',
  './shovelcompressed.glb'
];

// The page shell: everything needed to boot + render the menu with no network.
// Kept in sync with the <script src> / <img src> / font links in index.html.
var SHELL = [
  './',                 // index.html (navigation fallback -> the game page)
  './index.html',
  './dsnylogo3.jpg',    // menu logo (also preloaded by the game gate)
  './explicit_logo.webp', // "Parental Advisory" gag badge on the logo
  './mmongo.jpg', // "Rated M for Mongo" gag badge on the logo
  './atxlogo.png',    // TRAINER MENU logo (#trainer-logo): a plain <img>, so it has to be
                      // precached here to paint with the network off
  './kestgak.png',    // the "kestgak" truck decal, pulled by THREE.TextureLoader by URL
  './chalkoutline.png', // Staten Island chalk crime-scene outline decal (white chalk star-pose, transparent bg)
  './manifest.json',    // PWA manifest (official title for "Add to Home Screen")
  './dsnyicon.png',     // PWA/app icon (replaces the old icon-*.png / apple-touch-icon set)
  './icon-192.png',     // the rest of the PWA icon set (the <link rel=icon> tags + manifest.json):
  './icon-512.png',     // an installed app that can't fetch its own icons looks broken on the
  './icon-1024.png',    // home screen, so they belong in the shell offline
  './icon-maskable-512.png',
  './icon-maskable-1024.png',
  './music/manifest.json', // radio track list (needed OFFLINE so the station can
                           // discover which tracks are in the radio cache)
  './music/lo/manifest.json', // THE LO TIER's track list (the same 31 names at 48 kbps): the
                              // station discovers its playlist from a manifest, so the folder the
                              // player chose has to answer OFFLINE too. The .mp3 files themselves
                              // stay owned by the game's per-tier radio caches (dsnboy-radio-v2 /
                              // dsnboy-radio-lo-v1); the LIST belongs to the shell.
  // Draco decoder (local copy of the gstatic.com CDN build) - litterReduced2.glb
  // is Draco-compressed, so the decoder must be available OFFLINE. The DRACOLoader
  // pulls these in the MAIN THREAD via XHR (FileLoader) and hands the wasm binary
  // to the Web Worker over postMessage, so precaching them here is enough for
  // offline decoding. The old CDN path hung forever on iOS with the radios off.
  './draco/draco_decoder.wasm',
  './draco/draco_wasm_wrapper.js',
  './draco/draco_decoder.js',
  './GLTFLoader.js',
  './DRACOLoader.js',
  // The three.js the page loads, AND the local copy it falls back to: index.html pulls the
  // cdnjs build and, if THREE is missing (a shell-cache miss on the CDN, a CDN blip), injects
  // ./three_r128.min.js instead - see the "OFFLINE SAFETY NET" script in the page head. Both
  // belong in the shell so a game with no network still has a THREE.
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  './three_r128.min.js'
  // NOTE: the two Google Fonts stylesheets used to be plain entries here. The CSS alone is
  // useless offline - it only NAMES the font binaries on fonts.gstatic.com - so they moved to
  // FONT_CSS / precacheFonts() below, which stores the CSS AND every font file it references.
].concat(MODELS); // THE MODEL NET: every 3D model ships in the shell too (see MODELS above)

// The Google Fonts stylesheets the page links (the arcade HUD font + the comic bubble font).
var FONT_CSS = [
  'https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap',
  'https://fonts.googleapis.com/css2?family=Bangers&display=swap'
];

// Request types the SW may cache; anything else (e.g. the 3D models, the radio
// music, directory listings) is left to the game's own caches.
// The font/ types are the offline typography fix: without them the runtime handler served the
// woff2 binaries from the network and THREW THEM AWAY, so an offline visit lost the arcade +
// comic faces and fell back to the generic system font.
var CACHEABLE = ['text/html', 'text/javascript', 'text/css', 'image/png', 'image/jpeg', 'image/webp', 'font/woff2', 'font/woff', 'application/font-woff', 'application/font-woff2'];

// ---- precacheFonts: store both stylesheets AND every gstatic font binary they name. The
//      stylesheet is served cache-first by the fetch handler; the binaries it points at are
//      stored under their own URLs, so an offline page paints the real fonts with no network.
function precacheFonts(cache) {
  return Promise.all(FONT_CSS.map(function (cssUrl) {
    return fetchTimeout(cssUrl, 30000).then(function (res) {
      if (!res || !res.ok) return null;
      var copy = res.clone();
      return copy.text().then(function (css) {
        return cache.put(cssUrl, res).then(function () {
          var urls = [], m;
          var re = /url\((?:'|")?(https:\/\/fonts\.gstatic\.com\/[^)'"]+)(?:'|")?\)/gi;
          while ((m = re.exec(css))) { if (urls.indexOf(m[1]) < 0) urls.push(m[1]); }
          return Promise.all(urls.map(function (u) {
            return fetchTimeout(u, 30000).then(function (r2) {
              if (r2 && r2.ok) return cache.put(u, r2);
            }).catch(function (err) {
              console.warn('[SW] font precache skipped ' + u + ':', err && err.message);
            });
          }));
        });
      });
    }).catch(function (err) {
      console.warn('[SW] font CSS precache skipped ' + cssUrl + ':', err && err.message);
    });
  }));
}

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
      // Cache the shell. Each entry is fetched with a hard timeout (fetchTimeout)
      // instead of a bare cache.add(): a single stalled request (a hung CDN, a
      // flaky 2.5MB logo, a wedged font) must NOT block the install forever - a
      // hung fetch in a Promise.all never resolves, the SW never activates, and
      // Android Chrome's "Installing..." prompt spins indefinitely. A URL that
      // times out is simply skipped here; the runtime fetch handler retries it
      // on demand, so the app still installs and works online.
      return Promise.all(SHELL.map(function (url) {
        return fetchTimeout(url, 60000).then(function (res) {
          if (res && res.ok) return cache.put(url, res);
        }).catch(function (err) {
          console.warn('[SW] precache skipped ' + url + ':', err && err.message);
        });
      })).
        // Then the webfonts: the two stylesheets AND every font binary they reference, so the
        // arcade + comic type renders on an offline visit (the CSS alone can never do it).
        then(function () { return precacheFonts(cache); });
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    // Drop only STALE SHELL caches (older dsnboy-shell-v* versions). The game's
    // own model + radio caches (dsnboy-models-v1 / dsnboy-radio-v2) must survive
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
  // instances (dsnboy-models-v1 / dsnboy-radio-v2) - let those do their job.
  // The music/ directory listing is also passed through (NOT SW-cached) so adding
  // a new .mp3 to the folder keeps working on the very next scan.
  // EXCEPTION: music/manifest.json (the track LIST) IS precached above and served
  // cache-first here - offline the station needs it to know which tracks to play
  // from the radio cache. The .mp3 files themselves stay owned by the game cache.
  // NOTE: use indexOf(...) !== -1 (not === 0) so this also matches when the site
  // is served from a GitHub Pages subdirectory (e.g. /DSNYBoy/music/manifest.json).
  if (/\.(fbx|glb|gltf|mp3)$/i.test(url.pathname) || url.pathname.indexOf('/music/') !== -1) {
    if (url.pathname.indexOf('/music/manifest.json') !== -1) {
      var MANIFEST_KEY = url.pathname.indexOf('/music/lo/manifest.json') !== -1 ? './music/lo/manifest.json' : './music/manifest.json';
      e.respondWith(
        caches.match(MANIFEST_KEY).then(function (hit) {
          if (hit) return hit;
          return fetchTimeout(req).catch(function () { return caches.match(MANIFEST_KEY); });
        })
      );
      return;
    }
    // THE MODEL NET: the .glb / .gltf / .fbx bytes are ALSO precached in this shell (see
    // MODELS above) as the offline backup for the game's own model cache. Serve them
    // cache-first: the fetch()s the game makes for models (the "Getting Assets" gate, the
    // GLTF loaders and the Draco-decoded litter basket) are answered from the shell when
    // dsnboy-models-v1 is empty — an evicted cache on a phone with no signal now gets the
    // real truck instead of the procedural box truck. ignoreSearch is what makes this land:
    // the game's cache keys carry a per-asset ?v=N version, while the network fetches stay
    // on the plain url this shell precached. An online miss still goes to the network (with
    // the usual timeout) and fills the shell in, so a first visit keeps streaming real bytes
    // through the progress bar. The MP3s stay pass-through: the game's radio caches own the
    // whole ~185MB music rotation (a shell copy of that would be a quota risk, and the
    // rotation is downloaded track-by-track with its own skippable progress UI).
    if (/\.(fbx|glb|gltf)$/i.test(url.pathname)) {
      e.respondWith(
        caches.match(req, { ignoreSearch: true }).then(function (hit) {
          if (hit) return hit;
          return fetchTimeout(req)
            .then(function (res) {
              if (res && res.ok) {
                var copy = res.clone();
                caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
              }
              return res;
            })
            .catch(function () {
              return caches.match(req, { ignoreSearch: true });
            });
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

  // Navigation requests (index.html): THE PAINT LAW (v1.0.563) - STALE-WHILE-REVALIDATE.
  // The page is ~2.8 MB; the old NETWORK-FIRST rule made every launch on a phone wait for the
  // whole download before it painted a single pixel - even when the shell sat complete in this
  // very cache. So: answer from the cache IMMEDIATELY when it is there, and revalidate in the
  // background so the NEXT launch is the newest file. Deployed updates are not delayed by this:
  // the cache name carries APP_VERSION, so a new version installs an EMPTY cache, the first
  // launch after a deploy has no hit and goes to the network, and the version's own reloads
  // paint instantly from cache. Offline keeps working exactly as before (a miss falls through
  // to the network, and the network's failure falls back to ./index.html).
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.match(req).then(function (hit) {
        var revalidate = fetchTimeout(req)
          .then(function (res) {
            if (res && res.ok) {
              var copy = res.clone();
              caches.open(CACHE_NAME).then(function (c) { c.put(req, copy); });
            }
            return res;
          })
          .catch(function () { return null; });
        if (hit) return hit; // paint NOW; the fresh bytes land in the cache behind the game
        return revalidate.then(function (res) {
          return res || caches.match('./index.html');
        });
      })
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