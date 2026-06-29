# Panduan Deploy Backend SIKANDA (Google Apps Script) — Tahap 3 (RBAC + Login Google)

Backend ini adalah **satu-satunya jalur tulis** ke Spreadsheet. Mulai Tahap 3 ia juga menjadi
**gerbang autentikasi & otorisasi**: setiap permintaan tulis diverifikasi identitasnya (idToken
Google) lalu dicocokkan perannya (admin / pimpinan / pegawai) sebelum dieksekusi.

Yang ditangani backend: CRUD pegawai aman multi-user + **penegakan peran**, upload foto ke Drive,
soft delete, setting BUP, email Buku Penjagaan otomatis, serta **kelola akun** (sheet `app_access`).

> Estimasi waktu: ~15 menit. Bagian **A–C** & **G** dilakukan **sekali**; sisanya hanya saat ada update.

---

## A. Pasang Script

1. Buka Google Spreadsheet database SIKANDA (yang berisi sheet `pegawai`).
2. Menu **Extensions → Apps Script**.
3. Hapus isi `Code.gs` bawaan, lalu **tempel seluruh isi** `apps-script/Code.gs` dari paket ini.
4. Di bagian atas file, sesuaikan **4 konstanta**:
   - `SPREADSHEET_ID` — pastikan sama dengan ID spreadsheet Anda (sudah diisi default).
   - `SHARED_SECRET` — string acak panjang buatan Anda (dipakai jendela transisi, lihat §G).
   - `FIREBASE_API_KEY` — **sudah terisi** (API key web publik, sama dengan `src/lib/firebase.ts`). Ubah hanya bila Anda berganti project Firebase.
   - `BOOTSTRAP_ADMIN_EMAIL` — **WAJIB DIISI** email Google Anda, mis. `nama@gmail.com`. Email ini **selalu** dianggap admin sehingga Anda pasti bisa masuk pertama kali walau sheet `app_access` masih kosong.
5. Klik **Save**.

## B. Deploy sebagai Web App

1. **Deploy → New deployment** → ikon gerigi → **Web app**.
2. Isi: **Description** `SIKANDA Backend v3` · **Execute as** **Me** · **Who has access** **Anyone**.
3. **Deploy** → **Authorize access** → pilih akun → "Advanced" → "Go to project (unsafe)" → **Allow**.
   *(Peringatan "unsafe" wajar — ini script milik Anda sendiri.)*
4. **Salin Web app URL** (berakhiran `/exec`).

## C. Sambungkan ke Frontend

Buka `src/appsScriptConfig.ts` lalu isi:

```ts
export const APPS_SCRIPT_URL: string = "https://script.google.com/macros/s/XXXX/exec"; // URL dari §B4
export const APPS_SCRIPT_SECRET: string = "sikanda_8f3k9x..."; // SAMA dengan SHARED_SECRET (jendela transisi)
```

> `APPS_SCRIPT_SECRET` masih dipakai **sementara** selama jendela transisi (§G). Setelah login Google
> terbukti jalan, kosongkan nilainya dan matikan `ALLOW_LEGACY_SECRET` di backend.

---

## D. Setup Firebase (Login Google) — **inti Tahap 3**

Backend memverifikasi idToken lewat Identity Toolkit memakai `FIREBASE_API_KEY`. Agar tombol
**"Masuk dengan Google"** di frontend berhasil, daftarkan domain aplikasi Anda di Firebase:

1. Buka **Firebase Console** → project Anda (`gen-lang-client-0289452762`).
2. **Build → Authentication → Sign-in method** → aktifkan **Google** sebagai provider (bila belum).
3. Tab **Settings → Authorized domains** → **Add domain**, tambahkan:
   - `localhost` (untuk uji lokal `npm run dev` — biasanya sudah ada).
   - Domain GitHub Pages Anda, mis. `username.github.io` (tanpa `https://`, tanpa path).
4. Simpan. Tanpa langkah ini, popup Google akan ditolak dengan error `auth/unauthorized-domain`.

> Catatan: konfigurasi Firebase di `src/lib/firebase.ts` bersifat **publik** (memang dirancang
> demikian oleh Google). Keamanan tidak bergantung pada kerahasiaannya, melainkan pada verifikasi
> idToken di server + daftar `app_access`.

## E. Sheet `app_access` (daftar siapa boleh masuk)

**Tidak perlu dibuat manual** — backend otomatis membuat sheet `app_access` beserta header saat
pertama kali diakses. Kolomnya:

| email | role | nip | nama | is_active | created_by | created_at | last_login |
|-------|------|-----|------|-----------|------------|------------|------------|

Cara mengisi (pilih salah satu, atau gabungan):
- **Lewat aplikasi (disarankan):** masuk sebagai admin (lewat `BOOTSTRAP_ADMIN_EMAIL`) → menu
  **Kelola Akun** → **Tambah Akun** atau **Tarik dari sheet pegawai**.
- **Manual di spreadsheet:** isi baris langsung. `role` = `admin` / `pimpinan` / `pegawai`.
  Untuk peran `pegawai`, **`nip` wajib** (penghubung ke baris miliknya di sheet `pegawai`).

**Tombol "Tarik dari sheet pegawai"** membuat 1 akun peran `pegawai` untuk tiap pegawai aktif
ber-NIP. Bila kolom `EMAIL` pegawai terisi (bukan placeholder `simosdatangsel@gmail.com`), email
dipakai & akun langsung **aktif**; bila kosong, akun dibuat **NONAKTIF** agar Anda lengkapi
emailnya lalu aktifkan dari menu Kelola Akun.

## F. Aktifkan Notifikasi Email Otomatis

1. Di sheet **`system_config`** tambahkan baris (kolom `config_key` | `config_value`):
   - `BUP_USIA` | `58` → batas usia pensiun (diubah Administrator kapan saja).
   - `NOTIF_ADMIN_EMAIL` | `kepegawaian@email.go.id` → penerima rekap (Pola A).
   - `NOTIF_WINDOW_HARI` | `180` → ambang peringatan (hari ke depan).
2. Editor Apps Script → ikon **jam (Triggers)** → **Add Trigger**:
   Function `kirimNotifikasiBukuPenjagaan` · Time-driven · Day timer · pilih jam (mis. 7–8am) · **Save**.

> Uji cepat: pilih fungsi `kirimNotifikasiBukuPenjagaan` → **Run** → cek kotak masuk.

---

## G. Menutup Jendela Transisi (setelah login Google terbukti jalan)

Saat ini `ALLOW_LEGACY_SECRET = true`, sehingga backend menerima **idToken Google** *atau*
**secret lama**. Ini sengaja, agar migrasi mulus. Setelah Anda berhasil:
masuk dengan Google sebagai admin, menambah ≥1 akun, dan menulis data — **tutup lubangnya**:

1. `apps-script/Code.gs`: ubah `var ALLOW_LEGACY_SECRET = true;` → `false`, lalu **redeploy** (§I).
2. `src/appsScriptConfig.ts`: kosongkan `APPS_SCRIPT_SECRET` (string kosong `""`).

Sejak titik ini, **hanya** akun Google terdaftar di `app_access` yang bisa menulis.

## H. Higiene & Keamanan Data (penting, sekali saja)

1. **Kolom NIP** di `pegawai` & `app_access`: Format → Number → **Plain text** (cegah 18 digit jadi notasi ilmiah). Backend juga memaksa format teks untuk `app_access`.
2. Isi kolom **EMAIL** pegawai agar notifikasi personal (Pola B) & seed akun berjalan.
3. **Sheet legacy `users` / `roles` / `menus`** (artefak migrasi SIMOSDA) **tidak dipakai** SIKANDA.
   Sheet `users` memuat *hash sandi 158 orang* dan **terbaca publik** lewat Visualization API.
   **Sangat disarankan**: hapus ketiga sheet itu, atau minimal hapus sheet `users`. (Tindakan ini
   Anda lakukan manual di spreadsheet — kode SIKANDA tidak pernah menyentuhnya.)

## I. Bila Nanti `Code.gs` Diperbarui

**Deploy → Manage deployments → (Edit/pensil) → Version: New version → Deploy.**
URL `/exec` tetap sama, jadi `appsScriptConfig.ts` tidak perlu diubah.

---

### Catatan keamanan (jujur & ringkas)
- **Lapis tulis (sudah kuat di Tahap 3):** identitas diverifikasi via idToken Google di server +
  otorisasi peran via `app_access`. Secret lama hanya transisi (§G) dan sebaiknya segera dicabut.
- **Lapis baca (masih terbuka — Tahap 3-Lanjut):** pembacaan data masih lewat Google Visualization
  API publik. Artinya isi sheet yang dibagikan "anyone with link" masih dapat dibaca tanpa login.
  Penutupan jalur baca (proxy baca lewat backend) direncanakan sebagai **tahap terpisah**; untuk
  itu **hapus sheet `users` legacy** adalah mitigasi paling mendesak saat ini.
