// ---------------------------------------------------------------------------
// KONFIGURASI BACKEND APPS SCRIPT (SIKANDA)
// ---------------------------------------------------------------------------
// Setelah men-deploy apps-script/Code.gs sebagai Web App, salin URL "/exec"-nya
// ke APPS_SCRIPT_URL di bawah, dan salin token rahasia yang SAMA dengan
// SHARED_SECRET di Code.gs ke field SECRET.
//
// Selama URL masih kosong, semua operasi tulis akan menampilkan pesan jelas
// (tidak crash) bahwa backend belum dikonfigurasi.
// ---------------------------------------------------------------------------
export const APPS_SCRIPT_URL: string = "https://script.google.com/macros/s/AKfycbzznFSh0F40tXH96jxLG5r2_MXtsI0Yk8LYnePF59UJI4ohxGq6JSwlWwYwHImEChUjuA/exec";
export const APPS_SCRIPT_SECRET: string = "sikandatangsel-7f3a9c2e8b14d6";

export const isBackendConfigured = (): boolean =>
  !!APPS_SCRIPT_URL && APPS_SCRIPT_URL.startsWith("https://");
