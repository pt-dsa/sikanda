// ---------------------------------------------------------------------------
// SIKANDA — Firebase Authentication (Google Sign-In)
// ---------------------------------------------------------------------------
// Login aplikasi memakai akun Google. Setelah berhasil, kita memperoleh
// `idToken` (JWT Firebase) yang DIVERIFIKASI DI BACKEND (Code.gs) via Identity
// Toolkit accounts:lookup. Backend lalu mencocokkan email ke sheet `app_access`
// untuk menentukan peran. Frontend TIDAK memutuskan keamanan tulis sendiri.
//
// Catatan: nilai konfigurasi di bawah adalah konfigurasi web PUBLIK Firebase
// (apiKey web BUKAN rahasia — ia hanya pengenal proyek). Pengamanan nyata ada
// pada daftar `app_access` + verifikasi token di backend + Authorized Domains.
// ---------------------------------------------------------------------------
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyD6TphBtHCEIBDN0UHB_8D2JpFZ09wmsr4",
  authDomain: "gen-lang-client-0289452762.firebaseapp.com",
  projectId: "gen-lang-client-0289452762",
  appId: "1:306036717201:web:1cb6472aaed9e942823130",
  storageBucket: "gen-lang-client-0289452762.firebasestorage.app",
  messagingSenderId: "306036717201",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

export interface GoogleSignInResult {
  email: string;
  name: string;
  idToken: string;
}

/** Buka popup Google Sign-In → kembalikan email, nama, dan idToken segar. */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const cred = await signInWithPopup(auth, provider);
  const u = cred.user;
  const idToken = await u.getIdToken();
  return {
    email: String(u.email || "").toLowerCase().trim(),
    name: String(u.displayName || u.email || "").trim(),
    idToken,
  };
}

/**
 * Ambil idToken SEGAR dari sesi Firebase yang sedang berjalan (dipakai tiap
 * operasi tulis). Mengembalikan null bila tidak ada sesi Firebase (mis. mode
 * pengembangan tanpa Google — jalur fallback secret transisi yang menangani).
 */
export async function getFirebaseIdToken(): Promise<string | null> {
  const u = auth.currentUser;
  if (!u) return null;
  try {
    return await u.getIdToken();
  } catch {
    return null;
  }
}

export async function firebaseSignOut(): Promise<void> {
  try {
    await signOut(auth);
  } catch {
    /* abaikan */
  }
}

/** Pantau perubahan sesi Firebase. cb(true) bila ada user, cb(false) bila tidak. */
export function onFirebaseAuth(cb: (signedIn: boolean) => void): () => void {
  return onAuthStateChanged(auth, (u) => cb(!!u));
}
