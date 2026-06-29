import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { X, Save, AlertTriangle, RefreshCw, Camera, Upload, User } from "lucide-react";
import { Pegawai } from "@/types";
import { apiService, fileToBase64 } from "@/services/apiService";
import { spreadsheetService } from "@/services/spreadsheetService";
import { toInputDate, parseAnyDate } from "@/lib/utils";
import { canEditField, type AppUser } from "@/lib/rbac";

const DATE_FIELDS: (keyof Pegawai)[] = ["tgl_lahir", "tgl_mulai_golongan", "tgl_mulai_jabatan"];

// Kelas styling dipusatkan di scope MODUL (konstanta — tak perlu dioper via props).
const inputCls =
  "w-full px-3 py-2 text-sm bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none read-only:opacity-60";
const labelCls = "block text-xs font-bold text-gray-700 dark:text-gray-300 mb-1";

function computeUsia(tglLahir?: string): string {
  const d = parseAnyDate(tglLahir);
  if (!d) return "";
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age >= 0 && age < 120 ? `${age} tahun` : "";
}

// -------------------------------------------------------------------------
// PERBAIKAN BUG FOKUS (§5):
// `Field` & `SectionTitle` DIDEFINISIKAN DI SCOPE MODUL (bukan di dalam body
// PegawaiFormModal). Bila didefinisikan di dalam komponen, tiap setFormData →
// re-render → identitas fungsi BARU → React menganggapnya tipe komponen berbeda
// → unmount/mount <input> → FOKUS HILANG tiap karakter. Dengan di-hoist ke modul,
// identitas komponen stabil → fokus dipertahankan.
// Data dinamis (formData, handleChange, isEdit) dioper lewat PROPS.
// Catatan: props memakai pola mandiri + index signature `[key: string]: any`
// agar aman terhadap @types/react yang tidak terpasang (§3a).
// -------------------------------------------------------------------------
interface FieldProps {
  label: string;
  name: keyof Pegawai;
  type?: string;
  required?: boolean;
  placeholder?: string;
  colSpan?: boolean;
  formData: Partial<Pegawai>;
  handleChange: (e: any) => void;
  isEdit: boolean;
  user?: AppUser | null;
  rowNip?: string;
  [key: string]: any;
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  placeholder = "",
  colSpan = false,
  formData,
  handleChange,
  isEdit,
  user,
  rowNip = "",
}: FieldProps) {
  // Kunci field bila peran tidak boleh mengubahnya (admin/pimpinan: bebas;
  // pegawai: hanya field profil miliknya). NIP juga read-only saat edit.
  const locked = !canEditField(user, rowNip, name as string);
  return (
    <div className={colSpan ? "md:col-span-2" : ""}>
      <label className={labelCls}>
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      <input
        type={type}
        name={name as string}
        required={required}
        value={(formData as any)[name] ?? ""}
        onChange={handleChange}
        readOnly={locked || (name === "nip" && isEdit)}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  );
}

function SectionTitle({ children }: { children: any }) {
  return (
    <div className="md:col-span-2 mt-2 mb-1">
      <h3 className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 border-b border-gray-100 dark:border-gray-800 pb-1">
        {children}
      </h3>
    </div>
  );
}

export function PegawaiFormModal({
  isOpen,
  onClose,
  initialData,
  onSuccess,
  user,
}: {
  isOpen: boolean;
  onClose: () => void;
  initialData?: Pegawai | null;
  onSuccess: () => void;
  user?: AppUser | null;
}) {
  const [formData, setFormData] = useState<Partial<Pegawai>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setPhotoFile(null);
    if (initialData) {
      const seeded: Partial<Pegawai> = { ...initialData };
      DATE_FIELDS.forEach((f) => {
        const v = (initialData as any)[f];
        if (v) (seeded as any)[f] = toInputDate(v); // ke format <input type=date>
      });
      setFormData(seeded);
      setPhotoPreview(initialData.foto || "");
    } else {
      setFormData({ status: "ASN" });
      setPhotoPreview("");
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Berkas harus berupa gambar.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg("Ukuran foto maksimal 5 MB.");
      return;
    }
    setErrorMsg(null);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!formData.nip) {
      setErrorMsg("NIP wajib diisi.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<Pegawai> = { ...formData };
      const usia = computeUsia(formData.tgl_lahir);
      if (usia) payload.usia = usia;

      // 1) Simpan data pegawai (create/update) lewat backend (aman multi-user).
      await apiService.savePegawai(payload, !initialData);

      // 2) Bila ada foto baru → unggah ke Drive (backend menulis URL ke kolom FOTO).
      if (photoFile) {
        const { base64, mimeType, fileName } = await fileToBase64(photoFile);
        await apiService.uploadFoto({ nip: String(formData.nip), base64, mimeType, fileName });
      }

      spreadsheetService.clearCache();
      onSuccess();
    } catch (error: any) {
      setErrorMsg(error?.message || "Terjadi kesalahan saat menyimpan data.");
    } finally {
      setIsSaving(false);
    }
  };

  const isEdit = !!initialData;

  // Penguncian field per-peran. admin/pimpinan: semua terbuka (kecuali NIP saat edit).
  // pegawai: hanya field profil miliknya yang boleh diubah (EDITABLE_FIELDS_OWN).
  // NIP baris diambil dari data awal (untuk pegawai = baris sendiri).
  const rowNip = String((initialData as any)?.nip ?? formData.nip ?? "");
  const isLocked = (name: string): boolean => !canEditField(user, rowNip, name);
  const canFoto = canEditField(user, rowNip, "foto");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-800"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
          <h2 className="font-bold text-lg text-gray-900 dark:text-white">
            {isEdit ? "Edit Data Pegawai" : "Tambah Data Pegawai"}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 flex-1">
          {errorMsg && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm flex items-start gap-2 border border-red-200">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form id="pegawai-form" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* FOTO */}
            <div className="md:col-span-2 flex items-center gap-4">
              <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 flex items-center justify-center shrink-0">
                {photoPreview ? (
                  <img src={photoPreview} alt="Foto" className="w-full h-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                ) : (
                  <User size={32} className="text-gray-400" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <span className={labelCls}>Foto Pegawai</span>
                <div className="flex gap-2">
                  <button type="button" disabled={!canFoto} onClick={() => galleryRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Upload size={14} /> Galeri
                  </button>
                  <button type="button" disabled={!canFoto} onClick={() => cameraRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed">
                    <Camera size={14} /> Kamera
                  </button>
                </div>
                <input ref={galleryRef} type="file" accept="image/*" onChange={handlePhotoSelect} className="hidden" />
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} className="hidden" />
                <p className="text-[10px] text-gray-400">JPG/PNG, maks 5 MB. Disimpan ke Google Drive.</p>
              </div>
            </div>

            <SectionTitle>Identitas & Status</SectionTitle>
            <Field label="NIP" name="nip" required placeholder="18 digit NIP" formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />
            <Field label="Nama Lengkap" name="nama" required placeholder="Nama lengkap & gelar" formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />
            <div>
              <label className={labelCls}>Status <span className="text-red-500">*</span></label>
              <select name="status" required value={formData.status || "ASN"} onChange={handleChange} disabled={isLocked("status")} className={inputCls}>
                <option value="ASN">ASN</option>
                <option value="PPPK">PPPK</option>
                <option value="HONORER">HONORER</option>
                <option value="PENSIUN">PENSIUN</option>
              </select>
            </div>
            <Field label="Tanggal Lahir" name="tgl_lahir" type="date" formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />

            <SectionTitle>Kepangkatan & Jabatan</SectionTitle>
            <Field label="Golongan" name="golongan" placeholder="Contoh: III/c" formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />
            <Field label="TMT Golongan (dasar KGB & Pangkat)" name="tgl_mulai_golongan" type="date" formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />
            <Field label="Jabatan" name="jabatan" placeholder="Nama jabatan" colSpan formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />
            <Field label="TMT Jabatan" name="tgl_mulai_jabatan" type="date" formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />
            <Field label="Masa Kerja (Tahun)" name="masa_kerja_tahun" type="number" formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />
            <Field label="Masa Kerja (Bulan)" name="masa_kerja_bulan" type="number" formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />

            <SectionTitle>Pendidikan</SectionTitle>
            <Field label="Tingkat" name="tingkat" placeholder="Contoh: STRATA I" formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />
            <Field label="Pendidikan (Jurusan)" name="pendidikan_jurusan" placeholder="Contoh: S-1 Sistem Informasi" formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />
            <Field label="Universitas / Sekolah" name="universitas" formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />
            <Field label="Tahun Lulus" name="tahun_lulus" placeholder="Contoh: 2010" formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />

            <SectionTitle>Diklat</SectionTitle>
            <Field label="Riwayat Diklat" name="riwayat_diklat" formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />
            <Field label="Tahun Diklat" name="tahun_diklat" placeholder="Contoh: 2022" formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />

            <SectionTitle>Kontak</SectionTitle>
            <Field label="Kontak (No. HP)" name="kontak" placeholder="08xxxxxxxxxx" formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />
            <Field label="Email (untuk notifikasi)" name="email" type="email" placeholder="nama@email.go.id" formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />

            <SectionTitle>Mutasi & Keterangan</SectionTitle>
            <Field label="Catatan Mutasi (Masuk)" name="catatan_mutasi_masuk" formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />
            <Field label="Catatan Mutasi (Keluar)" name="catatan_mutasi_keluar" formData={formData} handleChange={handleChange} isEdit={isEdit} user={user} rowNip={rowNip} />
            <div className="md:col-span-2">
              <label className={labelCls}>Keterangan</label>
              <textarea name="keterangan" rows={2} value={formData.keterangan || ""} onChange={handleChange} readOnly={isLocked("keterangan")} className={inputCls} placeholder="Tambahkan keterangan jika ada" />
            </div>
          </form>
        </div>

        <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={isSaving} className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50">
            Batal
          </button>
          <button type="submit" form="pegawai-form" disabled={isSaving} className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-sm">
            {isSaving ? (<><RefreshCw size={16} className="animate-spin" /> Menyimpan...</>) : (<><Save size={16} /> Simpan Data</>)}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
