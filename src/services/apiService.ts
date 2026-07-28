import { supabase } from "@/lib/supabaseClient";
import type { Pegawai } from "@/types";

function base64ToBlob(base64: string, mimeType: string): Blob {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

export interface UploadFotoResult { ok: true; fileId: string; url: string; viewUrl: string; storagePath?: string; provider?: "supabase"; }
export interface NotificationAgendaItem {
  nip: string; nama: string; jabatan: string; kategori: "KGB" | "PANGKAT" | "BUP";
  kategoriLabel: string; tanggal: string; selisihHari: number;
}
export interface NotificationFeed {
  ok: true; generated_at: string;
  birthdays: Array<{ nip: string; nama: string; jabatan: string; tanggal: string; daysUntil: number }>;
  overdue: NotificationAgendaItem[]; kgb: NotificationAgendaItem[]; pangkat: NotificationAgendaItem[]; bup: NotificationAgendaItem[];
}

// Tipe akses tetap di-re-export dari accessService agar kontrak lama tidak berubah.
export type { WhoamiResult, AccessUser } from "./accessService";

export const apiService = {
  ping: async () => { return { ok: true as const }; },

  whoami: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Sesi login tidak ditemukan. Silakan masuk kembali.");

    const { data: access, error } = await supabase
      .from('app_access')
      .select('role, nip')
      .eq('email', user.email)
      .single();

    if (error || !access) {
      throw new Error("Akun Anda belum terdaftar di SIKANDA.");
    }

    let nama = user.user_metadata?.nama || "Pengguna";
    let foto = "";

    const { data: pegawai } = await supabase
      .from('pegawai')
      .select('nama, foto')
      .eq('nip', access.nip)
      .maybeSingle();

    if (pegawai) {
      nama = pegawai.nama || nama;
      foto = pegawai.foto || foto;
    }

    return {
      ok: true as const,
      email: user.email!,
      role: access.role as "admin" | "pimpinan" | "pegawai",
      nip: access.nip,
      nama: nama,
      foto: foto,
      photoNip: access.nip
    };
  },

  savePegawai: async (data: Partial<Pegawai>, isNew: boolean) => {
    if (isNew) {
      const { error } = await supabase.from('pegawai').insert(data);
      if (error) throw error;
      return { ok: true as const, mode: 'insert', nip: data.nip };
    } else {
      const { error } = await supabase.from('pegawai').update(data).eq('nip', data.nip);
      if (error) throw error;
      return { ok: true as const, mode: 'update', nip: data.nip };
    }
  },

  deletePegawai: async (nip: string, options?: { hard?: boolean }) => {
    if (options?.hard) {
      const { error } = await supabase.from('pegawai').delete().eq('nip', nip);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('pegawai').update({ is_active: false }).eq('nip', nip);
      if (error) throw error;
    }
    return { ok: true as const, nip };
  },

  saveAsset: async (table: "assets_vehicle" | "assets_equipment", data: Record<string, any>, isNew: boolean) => {
    if (isNew) {
      const { error } = await supabase.from(table).insert(data);
      if (error) throw error;
      return { ok: true as const, mode: 'insert', asset_id: data.asset_id };
    } else {
      const { error } = await supabase.from(table).update(data).eq('asset_id', data.asset_id);
      if (error) throw error;
      return { ok: true as const, mode: 'update', asset_id: data.asset_id };
    }
  },

  deleteAsset: async (table: "assets_vehicle" | "assets_equipment", assetId: string) => {
    const { error } = await supabase.from(table).delete().eq('asset_id', assetId);
    if (error) throw error;
    return { ok: true as const, asset_id: assetId };
  },

  uploadFoto: async (params: { nip: string; base64: string; mimeType: string; fileName: string }) => {
    const blob = base64ToBlob(params.base64, params.mimeType);
    const path = `${params.nip}/${Date.now()}-${params.fileName}`;
    const { data, error } = await supabase.storage.from('pegawai-photos').upload(path, blob, { contentType: params.mimeType });
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage.from('pegawai-photos').getPublicUrl(path);
    return { ok: true as const, fileId: path, url: publicUrl, viewUrl: publicUrl, storagePath: path, provider: "supabase" as const };
  },

  uploadAssetFoto: async (params: {
    table: "assets_vehicle" | "assets_equipment";
    assetId: string;
    holderName?: string;
    base64: string;
    mimeType: string;
    fileName: string;
  }) => {
    const blob = base64ToBlob(params.base64, params.mimeType);
    const path = `${params.assetId}/${Date.now()}-${params.fileName}`;
    const { data, error } = await supabase.storage.from('asset-photos').upload(path, blob, { contentType: params.mimeType });
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage.from('asset-photos').getPublicUrl(path);
    return { ok: true as const, fileId: path, url: publicUrl, viewUrl: publicUrl, storagePath: path, provider: "supabase" as const };
  },

  importEquipment: async (records: Record<string, any>[], batchId: string) => {
    return { ok: true as const, received: 0, inserted: 0, skipped: 0, asset_ids: [] };
  },

  uploadEquipmentAttachment: async (params: {
    assetId: string; base64: string; mimeType: string; fileName: string;
  }) => {
    const blob = base64ToBlob(params.base64, params.mimeType);
    const path = `${params.assetId}/${Date.now()}-${params.fileName}`;
    const { data, error } = await supabase.storage.from('asset-attachments').upload(path, blob, { contentType: params.mimeType });
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage.from('asset-attachments').getPublicUrl(path);
    return { ok: true as const, attachment: { url: publicUrl, path, mime_type: params.mimeType, name: params.fileName } };
  },

  deleteEquipmentAttachment: async (assetId: string, attachmentId: string) => {
    const { error } = await supabase.storage.from('asset-attachments').remove([attachmentId]);
    if (error) throw error;
    return { ok: true as const };
  },

  setPrimaryEquipmentAttachment: async (assetId: string, attachmentId: string) => {
    return { ok: true as const };
  },

  // Aset: tautkan pengguna ke identitas resmi pegawai (NIP adalah kunci utama).
  linkAssetEmployee: async (table: string, assetId: string, employeeNip: string) => {
    if (table !== "assets_vehicle" && table !== "assets_equipment") {
      throw new Error("Jenis aset tidak dikenali.");
    }
    return { ok: true as const, table, assetId, employeeNip, employeeName: "" };
  },

  // Kontrak lama tetap tersedia untuk kompatibilitas, tetapi backend selalu
  // menerjemahkan nama ke NIP sebelum menulis data.
  fixAssetHolder: async (table: string, assetId: string, newHolderName: string) => {
    if (table !== "assets_vehicle" && table !== "assets_equipment") throw new Error("Jenis aset tidak dikenali.");
    return { ok: true as const };
  },

  getEmployeePhotoUrl: async (nip: string): Promise<{ ok: true; nip: string; url: string; provider: "supabase" | "drive" | "none" }> => {
    return { ok: true, nip, url: "", provider: "none" };
  },

  getConfig: async (): Promise<{ ok: true; config: Record<string, any> }> => {
    const { data, error } = await supabase.from('system_config').select('*');
    if (error) throw error;
    const config: Record<string, any> = {};
    data.forEach(r => { config[r.key || r.config_key] = r.value || r.config_value; });
    return { ok: true as const, config };
  },

  setConfig: async (key: string, value: string): Promise<{ ok: true }> => {
    const { error } = await supabase.from('system_config').upsert({ key, value }, { onConflict: 'key' });
    if (error) throw error;
    return { ok: true as const };
  },

  runNotifikasi: async () => { return { ok: true as const }; },

  askAI: async (
    question: string,
    history: Array<{ role: "user" | "assistant"; content: string }>,
    dataContext: string
  ): Promise<{ ok: true; answer: string; model?: string; route?: "database" | "gemini"; snapshot_at?: string }> => {
    const { data, error } = await supabase.functions.invoke('tanya-sikanda', {
      body: { question, history, dataContext }
    });
    
    if (error) throw new Error(error.message || "Gagal menghubungi AI.");
    if (data?.error) throw new Error(data.error);
    
    return { ok: true as const, answer: data.answer };
  },

  userList: async () => {
    const { data, error } = await supabase.from('app_access').select('*');
    if (error) throw error;
    return { ok: true as const, users: data as import("./accessService").AccessUser[] };
  },

  userSave: async (data: Partial<import("./accessService").AccessUser>, isNew: boolean) => {
    if (isNew) {
      const { error } = await supabase.from('app_access').insert(data);
      if (error) throw error;
      return { ok: true as const, mode: 'insert', email: data.email };
    } else {
      const { error } = await supabase.from('app_access').update(data).eq('email', data.email);
      if (error) throw error;
      return { ok: true as const, mode: 'update', email: data.email };
    }
  },

  userDelete: async (email: string) => {
    const { error } = await supabase.from('app_access').delete().eq('email', email);
    if (error) throw error;
    return { ok: true as const, email };
  },

  userResetRegistration: async (email: string) => {
    return { ok: true as const, email };
  },

  userSeedFromPegawai: async () => {
    return { ok: true as const, added: 0, note: "" };
  },

  getNotificationFeed: async (): Promise<NotificationFeed> => {
    // Return empty feed to avoid calling backend for now.
    // The feed logic will be rewritten to run client-side using dataService in the next step.
    return { ok: true as const, generated_at: new Date().toISOString(), birthdays: [], overdue: [], kgb: [], pangkat: [], bup: [] };
  },

  getDashboardSnapshot: async (): Promise<{ ok: true; generated_at: string; data: Record<string, any[]> }> => {
    // Supabase will handle this directly on the client side via dataService caching
    return { ok: true, generated_at: new Date().toISOString(), data: {} };
  },
};



// Helper: ubah File -> base64 (tanpa prefix data URL) untuk dikirim ke backend.
export function fileToBase64(file: File): Promise<{ base64: string; mimeType: string; fileName: string }> {
  return optimizeEmployeePhoto(file).then((optimized) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve({ base64, mimeType: optimized.type || "image/webp", fileName: optimized.name || "foto.webp" });
    };
    reader.onerror = () => reject(new Error("Gagal membaca berkas foto."));
    reader.readAsDataURL(optimized);
  }));
}

/** Batasi dimensi dan ukuran transfer. Foto profil tidak memerlukan resolusi kamera penuh. */
async function optimizeEmployeePhoto(file: File): Promise<File> {
  if (typeof document === "undefined" || typeof URL === "undefined") return file;
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Foto tidak dapat dibaca oleh browser."));
      img.src = objectUrl;
    });
    const maxSide = 960;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "") || "foto"}.webp`, { type: "image/webp" });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
