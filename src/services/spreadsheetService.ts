import Papa from "papaparse";
import { normalizeData, parseMoneyString } from "@/lib/utils";
import { nextCycleDate, pensionDate, withinMonths } from "@/lib/penjagaan";
import type { DashboardMetrics, DistribusiItem } from "@/types";

const SPREADSHEET_ID = "19EllcHpSDAANnoXcTCYI8LIR9TE7b_e_Cst0KMgveO0";
const CACHE_EXPIRY = 5 * 1000; // 5 seconds cache to avoid CDN/Storage staleness

// ---------------------------------------------------------------------------
// Core fetch — FIXED: detect GViz API error response (not just HTML pages)
// ---------------------------------------------------------------------------
async function fetchFromSheet(sheetName: string, retries = 3, delay = 1000): Promise<any[]> {
  const url = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(sheetName)}&_t=${Date.now()}`;
  const cacheKey = `sheet_v5_${sheetName}`;

  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Date.now() - parsed.timestamp < CACHE_EXPIRY) return parsed.data;
    }

    const response = await fetch(url);
    if (!response.ok) {
      if (response.status === 429 && retries > 0) {
        console.warn(`[SIKANDA] ⚠️ 429 Terlalu banyak permintaan (Sheet: ${sheetName}). Mencoba lagi dalam ${delay}ms... (${retries} percobaan tersisa)`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return fetchFromSheet(sheetName, retries - 1, delay * 2);
      }
      throw new Error(`HTTP ${response.status}: Gagal terhubung ke Spreadsheet.`);
    }

    const text = await response.text();
    const t = text.trim();

    // ── CRITICAL FIX ──────────────────────────────────────────────────────────
    // Google Sheets GViz API mengembalikan respons JS (bukan HTML) ketika sheet
    // tidak ditemukan. Contoh: `google.visualization.Query.setResponse({...error...})`
    // Cek ini HARUS dilakukan sebelum PapaParse dipanggil.
    // ─────────────────────────────────────────────────────────────────────────
    if (
      t.startsWith("google.visualization") ||
      t.startsWith("<!DOCTYPE") ||
      t.toLowerCase().startsWith("<html") ||
      t.includes('"status":"error"')
    ) {
      throw new Error(
        `Sheet "${sheetName}" tidak ditemukan di Spreadsheet.\n` +
        `Pastikan: (1) tab sheet bernama persis "${sheetName}" (huruf kecil/kapital harus sama), ` +
        `(2) Spreadsheet sudah di-share ke "Anyone with the link → Viewer".`
      );
    }

    if (!t) {
      throw new Error(`Sheet "${sheetName}" mengembalikan data kosong.`);
    }

    return new Promise((resolve, reject) => {
      Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const normalized = normalizeData(results.data as any[]);
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify({ timestamp: Date.now(), data: normalized }));
            sessionStorage.setItem("sheet_last_updated", new Date().toISOString());
          } catch { /* sessionStorage full */ }
          resolve(normalized);
        },
        error: (err) => reject(new Error(`Gagal parsing CSV sheet "${sheetName}": ${err.message}`)),
      });
    });
  } catch (error) {
    console.warn(`[SIKANDA] ❌ Sheet "${sheetName}":`, (error as Error).message);
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Date helpers — perhitungan siklus & window memakai modul bersama
// @/lib/penjagaan (sumber tunggal; keluaran lokal "YYYY-MM-DD" agar = backend).
// ---------------------------------------------------------------------------
function isWithinMonths(dateStr: string, months: number): boolean {
  return withinMonths(dateStr, months);
}

// ---------------------------------------------------------------------------
// Name-matching helpers
// ---------------------------------------------------------------------------
function exactKey(name: string): string {
  return String(name || "").toUpperCase().trim().replace(/\s+/g, " ");
}
function fuzzyKey(name: string): string {
  return exactKey(String(name || "").split(",")[0]);
}
function buildLookupMaps(assets: any[]) {
  const byExact = new Map<string, any[]>();
  const byFuzzy = new Map<string, any[]>();
  for (const a of assets) {
    const holder = a.pengguna || a.holder_name || "";
    if (!holder || holder === "-") continue;
    const ek = exactKey(holder);
    const fk = fuzzyKey(holder);
    if (!byExact.has(ek)) byExact.set(ek, []);
    byExact.get(ek)!.push(a);
    if (!byFuzzy.has(fk)) byFuzzy.set(fk, []);
    byFuzzy.get(fk)!.push(a);
  }
  return { byExact, byFuzzy };
}
function matchAssets(nama: string, byExact: Map<string, any[]>, byFuzzy: Map<string, any[]>) {
  const ek = exactKey(nama);
  if (byExact.has(ek)) return { items: byExact.get(ek)!, via: "exact" as const };
  const fk = fuzzyKey(nama);
  if (byFuzzy.has(fk)) return { items: byFuzzy.get(fk)!, via: "fuzzy" as const };
  return { items: [] as any[], via: "none" as const };
}

// ---------------------------------------------------------------------------
// Photo URL — Google Drive share → direct URL
// ---------------------------------------------------------------------------
function convertGDriveUrl(rawUrl: string): string {
  const url = String(rawUrl || "").trim();
  if (url) {
    // https://drive.google.com/file/d/<id>/view  →  direct view
    const m = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400`;
    // https://drive.google.com/uc?...&id=<id>
    const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (m2) return `https://drive.google.com/thumbnail?id=${m2[1]}&sz=w400`;
    if (url.startsWith("http")) return url;
  }
  // Tidak ada foto asli → kembalikan kosong (UI memakai avatar inisial, bukan foto palsu).
  return "";
}

// ---------------------------------------------------------------------------
// Unit kerja extraction (fallback when no vehicle match)
// ---------------------------------------------------------------------------
function extractUnitKerja(jabatan: string): string {
  if (!jabatan) return "";
  const j = jabatan.toUpperCase().trim();
  if (j.includes("KEPALA DINAS")) return "DINAS CIPTA KARYA DAN TATA RUANG";
  if (j.includes("SEKRETARIS DINAS")) return "SEKRETARIAT DINAS";
  if (j.includes("KEPALA BIDANG")) return `BIDANG ${jabatan.replace(/kepala bidang\s*/i, "").trim().toUpperCase()}`;
  if (j.includes("KEPALA UPTD")) return `UPTD ${jabatan.replace(/kepala uptd\s*/i, "").trim().toUpperCase()}`;
  if (j.includes("KEPALA SUB BAGIAN")) return "SUB BAGIAN";
  if (j.includes("UPTD")) return "UPTD";
  if (j.includes("BIDANG")) {
    const m = j.match(/BIDANG\s+([A-Z\s]+?)(?:\s+AHLI|\s+MUDA|\s+PERTAMA|$)/);
    return m ? `BIDANG ${m[1].trim()}` : "BIDANG";
  }
  return "";
}

// ---------------------------------------------------------------------------
// SDM distribution builders
// ---------------------------------------------------------------------------
function buildGolonganDistribusi(list: any[]): DistribusiItem[] {
  const counts: Record<string, number> = {};
  for (const p of list) {
    const level = String(p.golongan || "").split("/")[0].trim();
    if (level) counts[level] = (counts[level] || 0) + 1;
  }
  const ORDER = ["I", "II", "III", "IV"];
  return Object.entries(counts)
    .sort(([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b))
    .map(([name, value]) => ({ name, value }));
}

function buildPendidikanDistribusi(list: any[]): DistribusiItem[] {
  const LABEL: Record<string, string> = {
    "STRATA II": "S-2", "STRATA I": "S-1",
    "DIPLOMA IV": "D-IV", "DIPLOMA III": "D-III",
    "SEKOLAH LANJUTAN TINGKAT ATAS": "SLTA",
  };
  const counts: Record<string, number> = {};
  for (const p of list) {
    const raw = String(p.tingkat || "").trim().toUpperCase();
    const label = LABEL[raw] || (raw || "Lainnya");
    counts[label] = (counts[label] || 0) + 1;
  }
  const ORDER = ["S-2", "S-1", "D-IV", "D-III", "SLTA", "Lainnya"];
  return Object.entries(counts)
    .sort(([a], [b]) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99))
    .map(([name, value]) => ({ name, value }));
}

function buildMasaKerjaDistribusi(list: any[]): DistribusiItem[] {
  const b = { "0–5 Thn": 0, "5–10 Thn": 0, "10–20 Thn": 0, "20+ Thn": 0 };
  for (const p of list) {
    const y = Number(p.masa_kerja_tahun) || 0;
    if (y < 5) b["0–5 Thn"]++;
    else if (y < 10) b["5–10 Thn"]++;
    else if (y < 20) b["10–20 Thn"]++;
    else b["20+ Thn"]++;
  }
  return Object.entries(b).map(([name, value]) => ({ name, value }));
}

// ---------------------------------------------------------------------------
// Main service object
// ---------------------------------------------------------------------------
export const spreadsheetService = {
  clearCache() {
    Object.keys(sessionStorage).forEach((key) => {
      if (key.startsWith("sheet_v5_")) {
        sessionStorage.removeItem(key);
      }
    });
  },

  getLastUpdated() {
    return sessionStorage.getItem("sheet_last_updated");
  },

  async getSystemSettings(): Promise<{ bup: number }> {
    try {
      const rows = await fetchFromSheet("system_config");
      const bupRow = rows.find((r: any) =>
        ["bup_usia", "bup"].includes(String(r.config_key || "").toLowerCase())
      );
      const bup = bupRow ? parseInt(String(bupRow.config_value || "58")) : 58;
      return { bup: isNaN(bup) ? 58 : bup };
    } catch {
      return { bup: 58 };
    }
  },

  async getVehicles() {
    const data = await fetchFromSheet("assets_vehicle");
    return data.map((item: any) => {
      let no_polisi = item.plate_number || item.no_polisi || item.asset_code;
      let foto = item.photo_legacy || item.foto || item.photo;
      if (no_polisi === "B 6590 WAQ" || no_polisi === "B 6590 MAQ")
        foto = "Kendaraan_Images/B 6590 WAQ.jpg";
      else if (no_polisi === "B 6924 NQA.")
        foto = "Kendaraan_Images/B 6924 NQA..jpg";
      return {
        asset_id: item.asset_id,
        kode_barang: no_polisi || item.kode_barang,
        no_polisi,
        merk: item.brand || item.merk || "-",
        tipe: item.vehicle_type || item.tipe || "-",
        tahun: item.purchase_year || item.tahun || "-",
        jenis_kendaraan: item.asset_category || item.jenis_kendaraan || item.nama_aset,
        pengguna: item.holder_name || item.pengguna || "-",
        unit_kerja: item.usage || item.unit_kerja || "-",
        kondisi: (item.kondisi || item.condition || "BAIK").toUpperCase(),
        kapasitas_mesin: item.engine_capacity_cc ? `${item.engine_capacity_cc} CC` : item.cc || "-",
        no_bpkb: item.bpkb_number || item.no_bpkb || "-",
        no_rangka: item.chassis_number || item.no_rangka || "-",
        no_mesin: item.engine_number || item.no_mesin || "-",
        harga_pembelian: item.acquisition_price ? `Rp ${new Intl.NumberFormat("id-ID").format(item.acquisition_price)}` : "-",
        km_kendaraan: item.current_km ? `${new Intl.NumberFormat("id-ID").format(item.current_km)} KM` : "-",
        latitude: item.lat || item.latitude,
        longitude: item.lng || item.longitude,
        foto,
        qr_url: item.qr_legacy_url || item.qr_url,
      };
    });
  },

  async getEquipment() {
    const data = await fetchFromSheet("assets_equipment");
    return data.map((item: any) => ({
      ...item,
      asset_id: item.asset_id,
      kode_barang: item.asset_code || item.kode_barang,
      nama_aset: item.asset_name || item.nama_aset || "-",
      merk: item.brand || item.merk || "-",
      jenis: item.asset_category || item.jenis || "-",
      jumlah: item.quantity || item.jumlah || 1,
      satuan: item.unit || item.satuan || "Unit",
      tahun: item.purchase_year || item.tahun || "-",
      pengguna: item.holder_name || item.pengguna || "-",
      penanggung_jawab: item.person_in_charge || item.holder_name || "-",
      kondisi: (item.condition || item.kondisi || "BAIK").toUpperCase(),
      harga_pembelian: item.acquisition_price ? `Rp ${new Intl.NumberFormat("id-ID").format(item.acquisition_price)}` : "-",
      latitude: item.lat || item.latitude,
      longitude: item.lng || item.longitude,
      foto: item.photo_legacy || item.foto,
      qr_url: item.qr_legacy_url || item.qr_url,
    }));
  },

  async getInventory() {
    const data = await fetchFromSheet("assets_inventory");
    return data.map((item: any) => ({
      ...item,
      asset_id: item.asset_id,
      kode_barang: item.asset_code || item.kode_barang,
      nama_aset: item.asset_name || item.nama_aset || item.nama_barang || "-",
      merk: item.brand || item.merk || "-",
      jumlah: parseInt(item.quantity || item.jumlah || "1"),
      satuan: item.unit || item.satuan || "Unit",
      tahun: item.purchase_year || item.tahun || "-",
      lokasi_ruangan: item.room_location || item.lokasi_ruangan || "-",
      pengguna: item.holder_name || item.pengguna || "-",
      penanggung_jawab: item.person_in_charge || item.holder_name || "-",
      kondisi: (item.condition || item.kondisi || "BAIK").toUpperCase(),
      harga_pembelian: item.acquisition_price ? `Rp ${new Intl.NumberFormat("id-ID").format(item.acquisition_price)}` : "-",
      latitude: item.lat || item.latitude,
      longitude: item.lng || item.longitude,
      foto: item.photo_1_legacy || item.foto,
      qr_url: item.qr_legacy_url || item.qr_url,
    }));
  },

  async getBudgets() {
    const data = await fetchFromSheet("vehicle_budget");
    return data.map((item: any) => {
      const ps = parseMoneyString(item.service_budget || item.pagu_service);
      const pc = parseMoneyString(item.sparepart_budget || item.pagu_suku_cadang);
      const rs = parseMoneyString(item.service_realization || item.realisasi_service);
      const rc = parseMoneyString(item.sparepart_realization || item.realisasi_suku_cadang);
      const tp = parseMoneyString(item.total_budget || item.total_pagu) || ps + pc;
      const tr = parseMoneyString(item.total_realization || item.total_realisasi) || rs + rc;
      return {
        ...item,
        no_polisi: item.plate_number || item.no_polisi,
        tahun_anggaran: item.year || item.tahun || item.tahun_anggaran,
        total_pagu: tp, total_realisasi: tr,
        sisa_anggaran: parseMoneyString(item.total_remaining) || tp - tr,
        persentase_realisasi: tp > 0 ? (tr / tp) * 100 : 0,
      };
    });
  },

  async getMaintenance() {
    const data = await fetchFromSheet("vehicle_maintenance");
    return data.map((item: any) => ({ ...item, biaya: parseMoneyString(item.total_cost) || parseMoneyString(item.biaya) }));
  },

  async getEquipmentMaintenance() {
    const data = await fetchFromSheet("equipment_maintenance");
    return data.map((item: any) => ({ ...item, biaya: parseMoneyString(item.maintenance_cost) || parseMoneyString(item.biaya) }));
  },

  async getLoans() { return fetchFromSheet("loans"); },
  async getLocations() { return fetchFromSheet("asset_locations"); },

  async getMaintenanceForecast() {
    const [vehicles, equipment] = await Promise.all([this.getMaintenance(), this.getEquipmentMaintenance()]);
    const allRecords = [...vehicles, ...equipment];
    const grouped: Record<string, { total: number; count: number }> = {};
    let totalCost = 0;
    allRecords.forEach((r) => {
      const dateStr = r.request_date || r.tanggal || "";
      const cost = r.biaya || 0;
      if (dateStr && cost > 0) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
          const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
          if (!grouped[ym]) grouped[ym] = { total: 0, count: 0 };
          grouped[ym].total += cost;
          totalCost += cost;
        }
      }
    });
    const months = Object.keys(grouped).length;
    const avg = months > 0 ? totalCost / months : 0;
    const today = new Date();
    const forecast = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(today.getFullYear(), today.getMonth() + i + 1, 1);
      // Proyeksi deterministik berbasis rata-rata historis nyata (tanpa noise acak).
      return { name: d.toLocaleString("id-ID", { month: "short", year: "numeric" }), PredictedCost: Math.round(avg) };
    });
    return { avgMonthlyCost: avg, sixMonthTotal: avg * 6, forecastData: forecast };
  },

  // ---------------------------------------------------------------------------
  // getPegawai — with GViz fix + robust column detection
  // ---------------------------------------------------------------------------
  async getPegawai() {
    try {
      const [rawPegawai, vehicles, equipment, inventory, settings] = await Promise.all([
        fetchFromSheet("pegawai"),
        this.getVehicles(),
        this.getEquipment(),
        this.getInventory(),
        this.getSystemSettings(),
      ]);

      // Debug: log what columns are detected in sheet pegawai
      if (rawPegawai.length > 0) {
        const cols = Object.keys(rawPegawai[0]);
        console.log("[SIKANDA] ✅ Sheet 'pegawai' ditemukan.", rawPegawai.length, "baris. Kolom:", cols);
      } else {
        console.warn("[SIKANDA] ⚠️ Sheet 'pegawai' ditemukan tapi kosong (0 baris data).");
        return [];
      }

      const bup = settings.bup;
      const vMaps = buildLookupMaps(vehicles);
      const eMaps = buildLookupMaps(equipment);
      const iMaps = buildLookupMaps(inventory);

      return rawPegawai.map((item: any) => {
        // ── ROBUST: coba beberapa varian nama kolom ──
        const nama = String(
          item.nama_pegawai ||   // "NAMA PEGAWAI" → normalizeKey
          item.nama ||           // fallback: "NAMA"
          item.nama_lengkap ||   // fallback: "NAMA LENGKAP"
          ""
        ).trim();

        if (!nama) return null; // skip baris kosong

        // Soft delete: lewati baris yang dinonaktifkan (is_active=FALSE).
        const aktifRaw = String(item.is_active ?? "").trim().toUpperCase();
        if (aktifRaw === "FALSE" || aktifRaw === "0" || aktifRaw === "TIDAK") return null;

        // Pertahanan terhadap data uji yang sengaja ditandai.
        if (String(item.keterangan || "").trim().toUpperCase() === "DATA DUMMY") return null;

        const nip = String(
          item.nip ||
          item.nomer_induk_pegawai ||
          ""
        ).trim();

        const vMatch = matchAssets(nama, vMaps.byExact, vMaps.byFuzzy);
        const eMatch = matchAssets(nama, eMaps.byExact, eMaps.byFuzzy);
        const iMatch = matchAssets(nama, iMaps.byExact, iMaps.byFuzzy);

        const allAssets = [...vMatch.items, ...eMatch.items, ...iMatch.items];
        const RANK = { exact: 2, fuzzy: 1, none: 0 };
        const bestQ = [vMatch.via, eMatch.via, iMatch.via].reduce(
          (b, c) => (RANK[c] > RANK[b] ? c : b), "none" as "exact" | "fuzzy" | "none"
        );

        let unit_kerja = "";
        if (vMatch.items.length > 0)
          unit_kerja = String(vMatch.items[0].unit_kerja || "").replace("-", "").trim();
        if (!unit_kerja)
          unit_kerja = extractUnitKerja(String(item.jabatan || ""));

        const tglMulaiGolongan = String(item.terhitung_mulai_tanggal_golongan || "").trim();
        const tglLahir = String(item.tanggal_lahir || "").trim();
        const foto = convertGDriveUrl(String(item.foto || "").trim());
        
        const jabatanRaw = String(item.jabatan || "").trim();
        const golonganRaw = String(item.golongan || "").trim();
        const statusRaw = String(item.status || "").trim().toUpperCase();
        const isIncomplete = !nip || !jabatanRaw || !golonganRaw || !statusRaw;

        return {
          nip,
          nama,
          jabatan: jabatanRaw,
          unit_kerja,
          golongan: golonganRaw,
          status: statusRaw,
          tgl_lahir: tglLahir,
          tgl_mulai_golongan: tglMulaiGolongan,
          tgl_mulai_jabatan: String(item.terhitung_mulai_tanggal_jabatan || "").trim(),
          tgl_kgb: nextCycleDate(tglMulaiGolongan, 2),
          tgl_pangkat: nextCycleDate(tglMulaiGolongan, 4),
          tgl_pensiun: pensionDate(tglLahir, bup),
          masa_kerja_tahun: parseInt(String(item.masa_kerja_tahun || "0")) || 0,
          masa_kerja_bulan: parseInt(String(item.masa_kerja_bulan || "0")) || 0,
          tingkat: String(item.tingkat || "").trim(),
          pendidikan_jurusan: String(item.pendidikan_jurusan || "").trim(),
          universitas: String(item.universitas || "").trim(),
          tahun_lulus: String(item.tahun_lulus || "").trim(),
          riwayat_diklat: String(item.riwayat_diklat || "").trim(),
          tahun_diklat: String(item.tahun_diklat || "").trim(),
          usia: String(item.usia || "").trim(),
          kontak: String(item.kontak || "").trim(),
          email: String(item.email || "").trim(),
          keterangan: String(item.keterangan || "").trim(),
          catatan_mutasi_masuk: String(item.catatan_mutasi_masuk || "").trim(),
          catatan_mutasi_keluar: String(item.catatan_mutasi_keluar || "").trim(),
          foto,
          assets: allAssets,
          assets_kendaraan: vMatch.items,
          assets_alat_mesin: eMatch.items,
          assets_inventaris: iMatch.items,
          match_quality: bestQ,
          is_incomplete: isIncomplete,
        };
      }).filter(Boolean);

    } catch (error: any) {
      // Propagate error — biarkan halaman Pegawai/Dashboard tampilkan pesan
      console.error("[SIKANDA] ❌ getPegawai error:", error?.message);
      throw error;
    }
  },

  // ---------------------------------------------------------------------------
  // getDashboardMetrics — robust: isolasi error pegawai dari error aset
  // ---------------------------------------------------------------------------
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    // Jalankan semua fetch paralel; isolasi error per grup
    const [
      pegawaiResult,
      vehiclesResult,
      equipmentResult,
      inventoryResult,
      loansResult,
      maintenanceResult,
      budgetsResult,
      forecastResult,
    ] = await Promise.allSettled([
      this.getPegawai(),
      this.getVehicles(),
      this.getEquipment(),
      this.getInventory(),
      this.getLoans(),
      this.getMaintenance(),
      this.getBudgets(),
      this.getMaintenanceForecast(),
    ]);

    // Ambil nilai; jika gagal, log warning dan gunakan array/default kosong
    const safeArray = (r: PromiseSettledResult<any[]>) => r.status === "fulfilled" ? r.value : [];
    const safeForecast = (r: PromiseSettledResult<any>) =>
      r.status === "fulfilled" ? r.value : { avgMonthlyCost: 0, sixMonthTotal: 0, forecastData: [] };

    // Jika getPegawai gagal, lempar error agar Dashboard menampilkan pesan setup
    if (pegawaiResult.status === "rejected") {
      throw pegawaiResult.reason;
    }

    const pegawai = pegawaiResult.value;
    const vehicles = safeArray(vehiclesResult);
    const equipment = safeArray(equipmentResult);
    const inventory = safeArray(inventoryResult);
    const loans = safeArray(loansResult);
    const maintenance = safeArray(maintenanceResult);
    const budgets = safeArray(budgetsResult);
    const forecast = safeForecast(forecastResult);

    const totalPagu = budgets.reduce((s: number, b: any) => s + parseMoneyString(b.total_pagu), 0);
    const totalRealisasi = budgets.reduce((s: number, b: any) => s + parseMoneyString(b.total_realisasi), 0);

    const currentYear = new Date().getFullYear();
    const trendYears = Array.from({ length: 5 }, (_, i) => String(currentYear - 4 + i));
    const trendsMap: Record<string, any> = {};
    trendYears.forEach((y) => { trendsMap[y] = { name: y, Vehicles: 0, Equipment: 0, Inventory: 0 }; });
    const addTrend = (items: any[], type: "Vehicles" | "Equipment" | "Inventory") =>
      items.forEach((item) => { const y = String(item.purchase_year || item.tahun || "").substring(0, 4); if (trendsMap[y]) trendsMap[y][type]++; });
    addTrend(vehicles, "Vehicles");
    addTrend(equipment, "Equipment");
    addTrend(inventory, "Inventory");

    const pegawaiASN = pegawai.filter((p: any) => p.status === "ASN").length;
    const pegawaiPPPK = pegawai.filter((p: any) => p.status === "PPPK").length;

    let peringatanKGB = 0, peringatanPangkat = 0, peringatanPensiun = 0;
    pegawai.forEach((p: any) => {
      if (isWithinMonths(p.tgl_kgb, 6)) peringatanKGB++;
      if (isWithinMonths(p.tgl_pangkat, 6)) peringatanPangkat++;
      if (isWithinMonths(p.tgl_pensiun, 6)) peringatanPensiun++;
    });

    return {
      totalPegawai: pegawai.length,
      pegawaiAktif: pegawai.length,
      pegawaiPensiun: 0,
      pegawaiASN,
      pegawaiPPPK,
      peringatanKGB,
      peringatanPangkat,
      peringatanPensiun,
      distribusiGolongan: buildGolonganDistribusi(pegawai),
      distribusiPendidikan: buildPendidikanDistribusi(pegawai),
      distribusiMasaKerja: buildMasaKerjaDistribusi(pegawai),
      totalKendaraan: vehicles.length,
      totalAlatMesin: equipment.length,
      totalInventaris: inventory.length,
      totalAset: vehicles.length + equipment.length + inventory.length,
      totalPeminjaman: loans.length,
      totalPemeliharaan: maintenance.length,
      totalPagu,
      totalRealisasi,
      persenRealisasi: totalPagu > 0 ? (totalRealisasi / totalPagu) * 100 : 0,
      lastUpdated: this.getLastUpdated(),
      assetTrends: trendYears.map((y) => trendsMap[y]),
      maintenanceForecast: forecast,
    };
  },
};
