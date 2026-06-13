/* =====================================================================
   FIREBASE CONFIG  —  cross-device sync
   ---------------------------------------------------------------------
   The app works perfectly WITHOUT this (your progress saves on each
   device locally). With it, your place + read events sync across phone
   and laptop after you "Sign in with Google".

   These keys are SAFE to commit publicly — Firebase web config is not a
   secret; access is governed by the Firestore security rules (README).
   ===================================================================== */

export const firebaseConfig = {
  apiKey: "AIzaSyA-2mRDdKK3ieD_m8twkcyQswpvyALFlG0",
  authDomain: "harmony-7c716.firebaseapp.com",
  projectId: "harmony-7c716",
  storageBucket: "harmony-7c716.firebasestorage.app",
  messagingSenderId: "95477620431",
  appId: "1:95477620431:web:87b68972397fb9166fe1ba",
  measurementId: "G-X255NY4TWL",
};

// Leave this as-is. The app auto-detects whether the config is real.
export const cloudEnabled = !Object.values(firebaseConfig).some(
  (v) => typeof v === "string" && v.startsWith("PASTE_")
);
