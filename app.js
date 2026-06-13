import { readingPlan } from "./data.js";
import { firebaseConfig, cloudEnabled } from "./firebase-config.js";

/* ============================================================
   ELEMENTS
   ============================================================ */
const $ = (id) => document.getElementById(id);
const els = {
  group: $("group"), label: $("label"), num: $("numBadge"),
  refSummary: $("refSummary"), position: $("position"),
  status: $("status"), passages: $("passages"),
  version: $("versionSelect"),
  prev: $("prevBtn"), next: $("nextBtn"),
  jumpForm: $("jumpForm"), jumpInput: $("jumpInput"),
  openOnline: $("openOnlineBtn"),
  readToggle: $("readToggle"),
  noteArea: $("noteArea"), notesStatus: $("notesStatus"),
  progressFill: $("progressFill"), footProgress: $("footProgress"),
  themeBtn: $("themeBtn"),
  tocBtn: $("tocBtn"), drawer: $("drawer"), drawerClose: $("drawerClose"),
  scrim: $("scrim"), tocList: $("tocList"), tocSearch: $("tocSearch"),
  drawerProgress: $("drawerProgress"),
  syncBtn: $("syncBtn"), syncDot: $("syncDot"),
  syncSheet: $("syncSheet"), syncScrim: $("syncScrim"),
  syncSheetClose: $("syncSheetClose"), googleBtn: $("googleBtn"),
  syncStatus: $("syncStatus"), syncHint: $("syncHint"), syncBody: $("syncBody"),
  toast: $("toast"),
};

/* ============================================================
   STATE  (persisted)
   ============================================================ */
const LS = {
  index: "hog:index", version: "hog:version",
  completed: "hog:completed", theme: "hog:theme", updated: "hog:updated",
  notes: "hog:notes",
};
const TOTAL = readingPlan.length;

const state = {
  index: clampIndex(parseInt(localStorage.getItem(LS.index) ?? "0", 10) || 0),
  version: localStorage.getItem(LS.version) || "kjv",
  completed: new Set(JSON.parse(localStorage.getItem(LS.completed) || "[]")),
  notes: JSON.parse(localStorage.getItem(LS.notes) || "{}"),
  updated: parseInt(localStorage.getItem(LS.updated) ?? "0", 10) || 0,
};

function clampIndex(i) { return Math.min(Math.max(0, i || 0), TOTAL - 1); }
function current() { return readingPlan[state.index]; }

/* hash deep-link (#read-16) overrides saved place */
(function applyHash() {
  const m = (location.hash || "").match(/read-(\d+)/);
  if (m) { const n = parseInt(m[1], 10); if (n >= 1 && n <= TOTAL) state.index = n - 1; }
})();

function saveLocal(touch = true) {
  if (touch) state.updated = Date.now();
  localStorage.setItem(LS.index, String(state.index));
  localStorage.setItem(LS.version, state.version);
  localStorage.setItem(LS.completed, JSON.stringify([...state.completed]));
  localStorage.setItem(LS.notes, JSON.stringify(state.notes));
  localStorage.setItem(LS.updated, String(state.updated));
  if (touch) schedulePush();
}

/* ============================================================
   THEME
   ============================================================ */
(function initTheme() {
  const saved = localStorage.getItem(LS.theme);
  if (saved) document.body.dataset.theme = saved;
})();
els.themeBtn.addEventListener("click", () => {
  const resolved = resolvedDark() ? "dark" : "light";
  const next = resolved === "dark" ? "light" : "dark";
  document.body.dataset.theme = next;
  localStorage.setItem(LS.theme, next);
});
function resolvedDark() {
  const t = document.body.dataset.theme;
  if (t === "dark") return true;
  if (t === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/* ============================================================
   RENDER — meta / header
   ============================================================ */
function renderMeta() {
  const item = current();
  els.group.textContent = item.group || "";
  els.num.textContent = `№ ${state.index + 1}`;
  els.label.textContent = item.label;
  els.refSummary.textContent = item.ref;
  els.position.textContent = `Reading ${state.index + 1} of ${TOTAL}`;
  els.prev.disabled = state.index === 0;
  els.next.disabled = state.index === TOTAL - 1;
  els.version.value = state.version;

  const isRead = state.completed.has(item.id);
  els.readToggle.setAttribute("aria-pressed", String(isRead));
  els.readToggle.querySelector(".readtoggle__label").textContent = isRead ? "Read" : "Mark as read";

  // load this event's note (without firing the input/save handler)
  els.noteArea.value = state.notes[item.id] || "";
  els.notesStatus.textContent = ""; els.notesStatus.classList.remove("is-saved");

  renderProgress();
  document.title = `${state.index + 1}. ${item.label} · Harmony of the Gospels`;
}

function renderProgress() {
  const done = state.completed.size;
  const pct = Math.round((done / TOTAL) * 100);
  els.progressFill.style.width = pct + "%";
  els.footProgress.textContent = `${done} of ${TOTAL} read · ${pct}%`;
  if (els.drawerProgress) els.drawerProgress.textContent = `${done} of ${TOTAL} events read · ${pct}% complete`;
}

/* ============================================================
   PASSAGES — fetch (with offline cache) + render
   ============================================================ */
function apiUrl(ref, translation) {
  return `https://bible-api.com/${encodeURIComponent(ref.trim())}?translation=${translation}`;
}
function cacheKey(ref, translation) { return `hog:psg:${translation}:${ref.trim()}`; }

async function fetchPassage(ref, translation) {
  const ck = cacheKey(ref, translation);
  const hit = localStorage.getItem(ck);
  if (hit) { try { return JSON.parse(hit); } catch {} }
  const res = await fetch(apiUrl(ref, translation));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  try { localStorage.setItem(ck, JSON.stringify(data)); } catch {}
  return data;
}

let loadToken = 0;
async function loadPassages() {
  const item = current();
  const translation = state.version;
  const refs = item.ref.split(";").map((r) => r.trim()).filter(Boolean);
  const token = ++loadToken;

  // skeletons
  els.passages.innerHTML = refs.map(skeletonCard).join("");
  els.status.textContent = "";
  els.status.classList.remove("error");

  const results = await Promise.allSettled(
    refs.map((ref) => fetchPassage(ref, translation))
  );
  if (token !== loadToken) return; // superseded by a newer navigation

  els.passages.innerHTML = "";
  let firstCard = true, anyOk = false;
  results.forEach((r, i) => {
    const ref = refs[i];
    const card = document.createElement("article");
    card.className = "passage-card";
    card.style.animationDelay = (i * 70) + "ms";
    if (r.status === "fulfilled" && Array.isArray(r.value.verses) && r.value.verses.length) {
      anyOk = true;
      card.innerHTML = renderCard(r.value, ref, firstCard);
      firstCard = false;
    } else {
      card.innerHTML = `<div class="passage-ref">${escapeHtml(ref)}</div>
        <div class="passage-text" style="color:var(--oxblood)">Couldn’t load this passage. ${navigator.onLine ? "Try Reload or another translation." : "You appear to be offline."}</div>`;
    }
    els.passages.appendChild(card);
  });

  if (!anyOk) {
    els.status.textContent = navigator.onLine
      ? "Couldn’t reach the Bible service. Please try again."
      : "Offline — only passages you’ve already opened are available.";
    els.status.classList.add("error");
  }
}

function renderCard(data, ref, withDropCap) {
  const head = `<div class="passage-ref">${escapeHtml(data.reference || ref)}</div>`;
  const verses = data.verses.map((v, idx) => {
    const text = (v.text || "").trim();
    if (withDropCap && idx === 0 && text) {
      const first = text[0];
      const rest = text.slice(1);
      return `<span class="verse"><span class="v">${v.chapter}:${v.verse}</span><span class="vfirst">${escapeHtml(first)}</span>${escapeHtml(rest)} </span>`;
    }
    return `<span class="verse"><span class="v">${v.chapter}:${v.verse}</span>${escapeHtml(text)} </span>`;
  }).join("");
  return head + `<div class="passage-text">${verses}</div>`;
}

function skeletonCard() {
  return `<article class="passage-card is-loading">
    <div class="sk sk-ref"></div>
    <div class="sk sk-line"></div><div class="sk sk-line s2"></div>
    <div class="sk sk-line s3"></div><div class="sk sk-line s2"></div>
    <div class="sk sk-line"></div><div class="sk sk-line s3"></div>
  </article>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

/* ============================================================
   NAVIGATION
   ============================================================ */
function goTo(index, { scroll = false } = {}) {
  index = clampIndex(index);
  if (index === state.index && els.passages.children.length) { return; }
  state.index = index;
  saveLocal();
  history.replaceState(null, "", `#read-${index + 1}`);
  renderMeta();
  loadPassages();
  highlightToc();
  if (scroll) document.getElementById("top").scrollIntoView({ behavior: "smooth", block: "start" });
}

els.prev.addEventListener("click", () => goTo(state.index - 1, { scroll: true }));
els.next.addEventListener("click", () => goTo(state.index + 1, { scroll: true }));
els.jumpForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const n = parseInt(els.jumpInput.value, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= TOTAL) { goTo(n - 1, { scroll: true }); els.jumpInput.value = ""; }
  else toast(`Enter a number from 1 to ${TOTAL}`);
});
els.version.addEventListener("change", () => { state.version = els.version.value; saveLocal(); loadPassages(); });
els.openOnline.addEventListener("click", () => {
  window.open(`https://www.biblegateway.com/passage/?search=${encodeURIComponent(current().ref)}`, "_blank", "noopener");
});
els.readToggle.addEventListener("click", () => {
  const id = current().id;
  if (state.completed.has(id)) state.completed.delete(id);
  else { state.completed.add(id); toast("Marked as read"); }
  saveLocal();
  renderMeta();
  updateTocItem(id);
});

/* notes — debounced auto-save */
let noteT;
els.noteArea.addEventListener("input", () => {
  const id = current().id;
  els.notesStatus.textContent = "Saving…"; els.notesStatus.classList.remove("is-saved");
  clearTimeout(noteT);
  noteT = setTimeout(() => {
    const text = els.noteArea.value;
    if (text.trim()) state.notes[id] = text;
    else delete state.notes[id];
    saveLocal();
    els.notesStatus.textContent = "Saved"; els.notesStatus.classList.add("is-saved");
    updateTocItem(id);
  }, 600);
});

/* keyboard */
document.addEventListener("keydown", (e) => {
  if (/input|select|textarea/i.test(e.target.tagName)) return;
  if (e.key === "ArrowRight") { els.next.click(); }
  else if (e.key === "ArrowLeft") { els.prev.click(); }
  else if (e.key === "m" || e.key === "M") { els.readToggle.click(); }
});

/* ============================================================
   TABLE OF CONTENTS DRAWER
   ============================================================ */
function buildToc() {
  let html = "", lastGroup = null;
  readingPlan.forEach((item, i) => {
    if (item.group !== lastGroup) { html += `<div class="toc-group">${escapeHtml(item.group)}</div>`; lastGroup = item.group; }
    html += `<button class="toc-item" data-i="${i}" data-id="${item.id}">
      <span class="toc-item__n">${i + 1}</span>
      <span class="toc-item__label">${escapeHtml(item.label)}</span>
      <span class="toc-item__note" aria-hidden="true" title="Has a note"></span>
      <span class="toc-item__dot" aria-hidden="true"></span>
    </button>`;
  });
  els.tocList.innerHTML = html;
  els.tocList.querySelectorAll(".toc-item").forEach((btn) => {
    btn.addEventListener("click", () => { goTo(parseInt(btn.dataset.i, 10), { scroll: true }); closeDrawer(); });
  });
  highlightToc();
}
function highlightToc() {
  els.tocList.querySelectorAll(".toc-item").forEach((btn) => {
    const i = parseInt(btn.dataset.i, 10);
    const id = parseInt(btn.dataset.id, 10);
    btn.classList.toggle("is-current", i === state.index);
    btn.classList.toggle("is-read", state.completed.has(id));
    btn.classList.toggle("is-noted", !!(state.notes[id] && state.notes[id].trim()));
  });
  const cur = els.tocList.querySelector(".toc-item.is-current");
  if (cur) cur.scrollIntoView({ block: "center" });
}
function updateTocItem(id) {
  const btn = els.tocList.querySelector(`.toc-item[data-id="${id}"]`);
  if (!btn) return;
  btn.classList.toggle("is-read", state.completed.has(id));
  btn.classList.toggle("is-noted", !!(state.notes[id] && state.notes[id].trim()));
}
els.tocSearch.addEventListener("input", () => {
  const q = els.tocSearch.value.trim().toLowerCase();
  let visibleGroup = null;
  els.tocList.querySelectorAll(".toc-item").forEach((btn) => {
    const hit = !q || btn.querySelector(".toc-item__label").textContent.toLowerCase().includes(q);
    btn.style.display = hit ? "" : "none";
  });
  els.tocList.querySelectorAll(".toc-group").forEach((g) => {
    // hide group header if all following items until next header are hidden
    let n = g.nextElementSibling, any = false;
    while (n && !n.classList.contains("toc-group")) { if (n.style.display !== "none") any = true; n = n.nextElementSibling; }
    g.style.display = any ? "" : "none";
  });
});

function openDrawer() { els.drawer.classList.add("is-open"); els.drawer.setAttribute("aria-hidden", "false"); els.tocBtn.setAttribute("aria-expanded", "true"); showScrim(els.scrim, closeDrawer); highlightToc(); }
function closeDrawer() { els.drawer.classList.remove("is-open"); els.drawer.setAttribute("aria-hidden", "true"); els.tocBtn.setAttribute("aria-expanded", "false"); hideScrim(els.scrim); }
els.tocBtn.addEventListener("click", openDrawer);
els.drawerClose.addEventListener("click", closeDrawer);

function showScrim(el, onClick) { el.hidden = false; el._cb = onClick; el.addEventListener("click", onClick); }
function hideScrim(el) { el.hidden = true; if (el._cb) el.removeEventListener("click", el._cb); }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeDrawer(); closeSync(); } });

/* ============================================================
   TOAST
   ============================================================ */
let toastT;
function toast(msg) {
  els.toast.textContent = msg; els.toast.hidden = false;
  requestAnimationFrame(() => els.toast.classList.add("is-show"));
  clearTimeout(toastT);
  toastT = setTimeout(() => { els.toast.classList.remove("is-show"); setTimeout(() => (els.toast.hidden = true), 320); }, 2200);
}

/* ============================================================
   CLOUD SYNC (Firebase) — optional, lazy
   ============================================================ */
let fb = null;          // { auth, db, doc fns }
let user = null;
let unsub = null;
let pushT = null;

function schedulePush() {
  if (!user || !fb) return;
  clearTimeout(pushT);
  pushT = setTimeout(pushCloud, 700);
}
async function pushCloud() {
  if (!user || !fb) return;
  try {
    await fb.setDoc(fb.ref(fb.db, "progress", user.uid), {
      index: state.index, version: state.version,
      completed: [...state.completed], notes: state.notes, updated: state.updated,
    }, { merge: true });
  } catch (e) { console.warn("push failed", e); }
}
function mergeRemote(data) {
  if (!data) return;
  let changed = false, localChanged = false, notesChanged = false;
  const remoteNewer = (data.updated || 0) > state.updated;

  // union completed (never lose a read mark)
  const before = state.completed.size;
  (data.completed || []).forEach((id) => state.completed.add(id));
  if (state.completed.size !== before) { changed = true; if (!remoteNewer) localChanged = true; }

  // merge notes: newer side wins on conflicts, keep both sides' unique keys
  if (data.notes && typeof data.notes === "object") {
    const merged = remoteNewer ? { ...state.notes, ...data.notes } : { ...data.notes, ...state.notes };
    if (JSON.stringify(merged) !== JSON.stringify(state.notes)) { state.notes = merged; notesChanged = true; changed = true; }
    if (!remoteNewer && JSON.stringify(merged) !== JSON.stringify(data.notes)) localChanged = true;
  }

  // newest writer wins for place + version
  if (remoteNewer) {
    if (typeof data.index === "number" && data.index !== state.index) { state.index = clampIndex(data.index); changed = true; }
    if (data.version && data.version !== state.version) { state.version = data.version; changed = true; }
    state.updated = data.updated;
  }

  if (changed) saveLocal(false);
  if (remoteNewer) { renderMeta(); loadPassages(); highlightToc(); }
  else if (notesChanged) {
    // refresh current note (unless user is mid-edit) + TOC markers
    if (document.activeElement !== els.noteArea) els.noteArea.value = state.notes[current().id] || "";
    highlightToc();
  }
  if (localChanged) schedulePush();
}

async function initFirebase() {
  if (fb) return fb;
  const [{ initializeApp }, auth, fs] = await Promise.all([
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js"),
    import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
  ]);
  const app = initializeApp(firebaseConfig);
  fb = {
    auth: auth.getAuth(app), db: fs.getFirestore(app),
    provider: new auth.GoogleAuthProvider(),
    signInPopup: auth.signInWithPopup, signInRedirect: auth.signInWithRedirect,
    redirectResult: auth.getRedirectResult, onAuth: auth.onAuthStateChanged, signOut: auth.signOut,
    ref: fs.doc, getDoc: fs.getDoc, setDoc: fs.setDoc, onSnapshot: fs.onSnapshot,
  };
  return fb;
}

async function startCloud() {
  await initFirebase();
  try { await fb.redirectResult(fb.auth); } catch {}
  fb.onAuth(fb.auth, async (u) => {
    user = u;
    if (u) {
      els.syncBtn.classList.add("is-on"); els.syncDot.hidden = false;
      setSyncUI(true, u);
      // one-time pull + live subscribe
      try {
        const snap = await fb.getDoc(fb.ref(fb.db, "progress", u.uid));
        if (snap.exists()) mergeRemote(snap.data());
        else pushCloud();
      } catch (e) { console.warn(e); }
      if (unsub) unsub();
      unsub = fb.onSnapshot(fb.ref(fb.db, "progress", u.uid), (s) => { if (s.exists()) mergeRemote(s.data()); });
    } else {
      els.syncBtn.classList.remove("is-on"); els.syncDot.hidden = true;
      if (unsub) { unsub(); unsub = null; }
      setSyncUI(false);
    }
  });
}

async function signIn() {
  els.googleBtn.disabled = true; setStatus("Opening Google sign-in…");
  try {
    await initFirebase();
    try { await fb.signInPopup(fb.auth, fb.provider); }
    catch (e) {
      if (e && /popup/i.test(e.code || e.message || "")) { await fb.signInRedirect(fb.auth, fb.provider); return; }
      throw e;
    }
    setStatus("Signed in — your progress now syncs.", "ok");
    setTimeout(closeSync, 1100);
  } catch (e) {
    console.error(e); setStatus(humanAuthError(e), "err");
  } finally { els.googleBtn.disabled = false; }
}
function humanAuthError(e) {
  const c = (e && (e.code || e.message)) || "";
  if (/unauthorized-domain/i.test(c)) return "This site’s domain isn’t authorised in Firebase yet (Auth → Settings → Authorized domains).";
  if (/popup-closed|cancelled|canceled/i.test(c)) return "Sign-in cancelled.";
  if (/configuration-not-found|api-key/i.test(c)) return "Firebase isn’t configured correctly — check firebase-config.js.";
  return "Sign-in failed. " + c;
}
function setStatus(msg, kind) { els.syncStatus.textContent = msg || ""; els.syncStatus.className = "sheet__status" + (kind ? " " + kind : ""); }

function setSyncUI(signedIn, u) {
  if (!cloudEnabled) return;
  if (signedIn) {
    els.syncBody.textContent = `Signed in as ${u?.email || "your Google account"}. Your place and read events stay in step across every device.`;
    els.googleBtn.style.display = "none";
    els.syncHint.innerHTML = `<button id="signOutBtn" class="linkbtn">Sign out of sync</button>`;
    const so = $("signOutBtn");
    if (so) so.addEventListener("click", async () => { try { await fb.signOut(fb.auth); toast("Signed out"); closeSync(); } catch {} });
  } else {
    els.googleBtn.style.display = "";
    els.syncHint.textContent = "";
  }
}

/* sync sheet open/close */
function openSync() {
  els.syncSheet.classList.add("is-open"); els.syncSheet.setAttribute("aria-hidden", "false");
  showScrim(els.syncScrim, closeSync);
  if (!cloudEnabled) {
    els.syncBody.textContent = "Cross-device sync isn’t switched on yet. Right now your progress is saved safely on this device.";
    els.googleBtn.style.display = "none";
    els.syncHint.innerHTML = "To enable “continue anywhere”, add your Firebase keys to <code>firebase-config.js</code> (see README). Until then, everything still works — just per-device.";
  }
}
function closeSync() { els.syncSheet.classList.remove("is-open"); els.syncSheet.setAttribute("aria-hidden", "true"); hideScrim(els.syncScrim); }
els.syncBtn.addEventListener("click", openSync);
els.syncSheetClose.addEventListener("click", closeSync);
els.googleBtn.addEventListener("click", signIn);

/* online/offline feedback */
window.addEventListener("online", () => { if (els.status.classList.contains("error")) loadPassages(); });

/* ============================================================
   BOOT
   ============================================================ */
buildToc();
renderMeta();
loadPassages();
if (cloudEnabled) startCloud();
