/* =====================================================================
   FIREBASE CONFIG  —  cross-device sync
   ---------------------------------------------------------------------
   The app works perfectly WITHOUT this (your progress saves on each
   device locally). To turn on "continue anywhere" sync across your
   phone + laptop, do the one-time setup in README.md, then paste the
   config object Firebase gives you below, replacing the placeholders.

   These keys are SAFE to commit publicly — Firebase web config is not a
   secret; access is governed by the security rules in README.md.
   ===================================================================== */

export const firebaseConfig = {
  apiKey:            "PASTE_API_KEY",
  authDomain:        "PASTE_PROJECT.firebaseapp.com",
  projectId:         "PASTE_PROJECT",
  appId:             "PASTE_APP_ID",
};

// Leave this as-is. The app auto-detects whether the config is real.
export const cloudEnabled = !Object.values(firebaseConfig).some(
  (v) => typeof v === "string" && v.startsWith("PASTE_")
);
