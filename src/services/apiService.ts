import { APPS_SCRIPT_URL, APPS_SCRIPT_SECRET, isBackendConfigured } from "@/appsScriptConfig";
import { getFirebaseIdToken } from "@/lib/firebase";
import type { Pegawai } from "@/types";

// ---------------------------------------------------------------------------
// Klien untuk backend Apps Script.
// Catatan CORS: Apps Script Web App tidak menangani preflight OPTIONS. Karena itu
// body dikirim sebagai text/plain (request "sederhana") agar tidak memicu preflight.
//
// AUTENTIKASI (Tahap 3):
//   - Utama  : `idToken` Firebase (diverifikasi di backend, lalu peran dicek di
//              sheet app_access). Inilah gerbang keamanan sebenarnya.
//   - Fallback transisi: `secret` lama (SHARED_SECRET) - hanya berfungsi selama
//              ALLOW_LEGACY_SECRET=true di Code.gs. Dipakai mode pengembangan
//              (login Admin DEV) agar CRUD tetap teruji sebelum secret dicabut.
// ---------------------------------------------------------------------------
async function buildAuth(explicit?: Record<string, any>): Promise<Record<string, any>> {
  if (explicit) return explicit;
  try {
    const idToken = await getFirebaseIdToken();
    if (idToken) return { idToken };
  } catch {
    /* lanjut ke fallback */
  }
  return { secret: APPS_SCRIPT_SECRET };
}

async function callBackend<T = any>(
  payload: Record<string, any>,
  explicitAuth?: Record<string, any>
): Promise<T> {
  if (!isBackendConfigured()) {
    throw new Error(
      "Backend belum dikonfigurasi. Isi APPS_SCRIPT_URL di src/appsScriptConfig.ts " +
      "setelah men-deploy Apps Script (lihat apps-script/README_DEPLOY.md)."
    );
  }

  const auth = await buildAuth(explicitAuth);

  let res: Response;
  try {
    res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...payload, ...auth }),
      redirect: "follow",
    });
  } catch (e: any) {
    throw new Error("Tidak dapat menghubungi server SIKANDA. Periksa koneksi internet. (" + (e?.message || e) + ")");
  }

  let json: any;
  try {
    json = await res.json();
  } catch {
    throw new Error("Respons server tidak valid. Pastikan Web App di-deploy dengan akses 'Anyone'.");
  }

  if (!json || json.ok !== true) {
    throw new Error((json && json.error) || "Operasi gagal di server.");
  }
  return json as T;
}

export interface UploadFotoResult { ok: true; fileId: string; url: string; viewUrl: string; }

export interface WhoamiResult {
  ok: true;
  email: string;
  role: "admin" | "pimpinan" | "pegawai";
  nip: string;
  nama: string;
}

export interface AccessUser {
  email: string;
  role: "admin" | "pimpinan" | "pegawai";
  nip: string;
  nama: string;
  is_active: boolean;
}

export const apiService = {
  ping: () => callBackend({ action: "ping" }),

  // --- Identitas / sesi ---
  // whoami dipanggil saat login dengan idToken EKSPLISIT (sebelum sesi global siap).
  whoami: (idToken: string) =>
    callBackend<WhoamiResult>({ action: "whoami" }, { idToken }),

  // --- Pegawai ---
  savePegawai: (data: Partial<Pegawai>, isNew: boolean) =>
    callBackend({ action: "pegawai_save", data, isNew }),

  deletePegawai: (nip: string) =>
    callBackend({ action: "pegawai_delete", nip }),

  uploadFoto: (params: { nip: string; base64: string; mimeType: string; fileName: string }) =>
    callBackend<UploadFotoResult>({ action: "upload_foto", ...params }),

  // --- Konfigurasi ---
  getConfig: () => callBackend<{ ok: true; config: Record<string, any> }>({ action: "get_config" }),

  setConfig: (key: string, value: string) =>
    callBackend({ action: "set_config", key, value }),

  runNotifikasi: () => callBackend({ action: "notifikasi_run" }),

  // --- Kelola Akun (admin saja, ditegakkan di backend) ---
  userList: () => callBackend<{ ok: true; users: AccessUser[] }>({ action: "user_list" }),

  userSave: (data: Partial<AccessUser>, isNew: boolean) =>
    callBackend({ action: "user_save", data, isNew }),

  userDelete: (email: string) =>
    callBackend({ action: "user_delete", email }),

  userSeedFromPegawai: () =>
    callBackend<{ ok: true; added: number; note: string }>({ action: "user_seed_from_pegawai" }),
};

// Helper: ubah File -> base64 (tanpa prefix data URL) untuk dikirim ke backend.
export function fileToBase64(file: File): Promise<{ base64: string; mimeType: string; fileName: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve({ base64, mimeType: file.type || "image/jpeg", fileName: file.name || "foto.jpg" });
    };
    reader.onerror = () => reject(new Error("Gagal membaca berkas foto."));
    reader.readAsDataURL(file);
  });
}
