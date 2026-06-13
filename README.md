# Harmony of the Gospels

A beautiful, installable reader that walks through **211 events in the life of Christ**, showing all the parallel Matthew / Mark / Luke / John passages side by side. Switch translations, mark events as read, and pick up exactly where you left off — on any device.

- **Live site:** _(added after deploy)_
- Scripture text fetched live from [bible-api.com](https://bible-api.com); already-read passages are cached for offline use.

## Features
- 📖 211-event harmony with grouped sections and a searchable table of contents
- ✅ Mark events read — progress bar + per-event ticks
- 🔖 Remembers your place automatically (and your chosen translation)
- ☁️ **Cross-device sync** via Google sign-in (optional — see below)
- 📲 Installable PWA, works offline once visited
- 🌗 Light "parchment" / dark "vellum" themes
- ⌨️ Keyboard: `←` / `→` to navigate, `M` to mark read

---

## Enable cross-device sync (one-time, ~5 minutes)

Without this, progress still saves — but only per-device. To make your place follow you between phone and laptop:

1. Go to <https://console.firebase.google.com> → **Add project** (any name, e.g. `harmony-gospels`). You can disable Analytics.
2. In the project, click the **`</>` (Web)** icon to "Add app". Give it a nickname, **don't** check Hosting. Firebase shows you a `firebaseConfig` object — keep that tab open.
3. **Authentication** → Get started → **Sign-in method** → enable **Google** → Save.
4. **Firestore Database** → Create database → **Production mode** → pick a location → Enable.
5. Firestore → **Rules** tab → paste the rules below → **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /progress/{uid} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```

6. Open **`firebase-config.js`** in this repo and paste in the values from step 2
   (`apiKey`, `authDomain`, `projectId`, `appId`). Commit + push.
7. Firebase → **Authentication → Settings → Authorized domains** → add your GitHub
   Pages domain (e.g. `yourname.github.io`). `localhost` is already allowed.

Done. Tap the ⟳ sync icon in the app → **Sign in with Google** on each device.

> The keys in `firebase-config.js` are **safe to commit** — Firebase web config is public by design; the security rules above are what protect your data.

---

## Run locally
Because the app uses ES modules + a service worker, open it through a local server (not `file://`):

```bash
# from the repo folder
python -m http.server 8000
# then visit http://localhost:8000
```

## Deploy (GitHub Pages)
Push to GitHub and enable **Settings → Pages → Branch: `main` / root**. The included
`.nojekyll` file makes Pages serve everything as-is.

## Credits
Reading-plan harmony based on a classic chronological Gospel outline. Built as a static site — HTML, CSS, vanilla JS.
