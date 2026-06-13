/* Service worker — app-shell offline cache.
   Bump CACHE when you change app shell files. */
const CACHE = "hog-v6";
const SHELL = [
  "./", "./index.html", "./styles.css", "./app.js", "./data.js",
  "./firebase-config.js", "./manifest.webmanifest",
  "./icons/icon.svg", "./icons/icon-192.png", "./icons/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache Bible API or Firebase/Google traffic — always go to network.
  if (/bible-api\.com|firebaseio|googleapis|gstatic|firebaseapp|identitytoolkit/.test(url.host)) return;

  // App shell + same-origin: cache-first, then network; fall back to cache.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("./index.html")))
    );
    return;
  }

  // Google Fonts: stale-while-revalidate.
  if (/fonts\.(googleapis|gstatic)\.com/.test(url.host)) {
    e.respondWith(
      caches.open(CACHE).then((c) => c.match(req).then((hit) => {
        const net = fetch(req).then((res) => { c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      }))
    );
  }
});
