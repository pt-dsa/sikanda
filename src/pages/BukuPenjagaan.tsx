import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import Papa from "papaparse";
import { spreadsheetService } from "@/services/spreadsheetService";
import { useToast } from "@/components/ui/Toast";
import { LoadingState } from "@/components/ui/LoadingState";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { PegawaiDetailModal } from "@/components/ui/PegawaiDetailModal";
import { AssetDetailModal } from "@/components/ui/AssetDetailModal";
import { formatDate } from "@/lib/utils";
import {
  buildPenjagaanEvents,
  bucketMeta,
  sisaWaktuLabel,
  diffDays,
  withinMonths,
  type PenjagaanEvent,
  type KategoriPenjagaan,
} from "@/lib/penjagaan";
import type { Pegawai } from "@/types";
import {
  CalendarCheck, Search, RefreshCw, Download, AlertTriangle,
  TrendingUp, CalendarClock, Clock, Mail,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

type RentangFilter = "le3" | "le6" | "le12" | "terlambat" | "semua";

const KATEGORI_LABEL: Record<KategoriPenjagaan, string> = {
  KGB: "KGB (Kenaikan Gaji Berkala)",
  PANGKAT: "Kenaikan Pangkat",
  BUP: "Pensiun / BUP",
};

// Window notifikasi email backend (system_config: NOTIF_WINDOW_HARI). Hanya untuk
// transparansi badge — filter UI tetap berbasis bulan kalender.
const EMAIL_WINDOW_HARI = 180;

export default function BukuPenjagaan() {
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [data, setData] = useState<Pegawai[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterKategori, setFilterKategori] = useState<"all" | KategoriPenjagaan>("all");
  const [filterRentang, setFilterRentang] = useState<RentangFilter>("le6");
  const [filterBidang, setFilterBidang] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Item e — modal profil 360° bersama. Klik baris/kartu → pegawai yang NIP-nya
  // COCOK PERSIS (string). Edit/Hapus disembunyikan (callback tidak disuplai).
  const [selectedPegawai, setSelectedPegawai] = useState<Pegawai | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);

  // Deep-link dari Dashboard (?kategori=KGB&rentang=le6)
  useEffect(() => {
    const k = (searchParams.get("kategori") || "").toUpperCase();
    if (k === "KGB" || k === "PANGKAT" || k === "BUP") setFilterKategori(k as KategoriPenjagaan);
    const r = (searchParams.get("rentang") || "") as RentangFilter;
    if (["le3", "le6", "le12", "terlambat", "semua"].includes(r)) setFilterRentang(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load(force = false) {
    if (force) {
      setIsRefreshing(true);
      spreadsheetService.clearCache();
    } else {
      setLoading(true);
    }
    setErrorMsg(null);
    try {
      const result = await spreadsheetService.getPegawai();
      setData(result as Pegawai[]);
      setLastSync(spreadsheetService.getLastUpdated());
    } catch (err: any) {
      setErrorMsg(err?.message || "Gagal memuat data pegawai.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => { load(); }, []);

  // Bangun seluruh agenda dari data NYATA
  const events = useMemo(() => buildPenjagaanEvents(data), [data]);

  // Peta NIP → objek Pegawai penuh (untuk modal 360°). NIP string, cocokkan
  // PERSIS (sudah di-trim sama seperti buildPenjagaanEvents). Aturan A: jangan
  // menampilkan profil pegawai yang salah.
  const pegawaiByNip = useMemo(() => {
    const m = new Map<string, Pegawai>();
    for (const p of data) {
      const key = String(p.nip || "").trim();
      if (key) m.set(key, p);
    }
    return m;
  }, [data]);

  function openProfil(nip: string) {
    const key = String(nip || "").trim();
    if (!key) return; // NIP kosong → tidak bisa dipetakan dgn aman, jangan buka
    const p = pegawaiByNip.get(key);
    if (p) setSelectedPegawai(p);
  }

  // Opsi bidang (unit_kerja) untuk filter
  const bidangOptions = useMemo(() => {
    const set = new Set<string>();
    events.forEach((e) => set.add(e.bidang));
    return Array.from(set).sort((a, b) => a.localeCompare(b, "id"));
  }, [events]);

  // Ringkasan ≤6 bulan ke depan — dihitung dari tanggal MAJU (tgl_kgb/pangkat/pensiun)
  // PERSIS seperti Dashboard & lonceng (helper withinMonths yang sama). + kartu Terlambat.
  const summary = useMemo(() => {
    let kgb = 0, pangkat = 0, pensiun = 0;
    for (const p of data) {
      if (String(p.status || "").toUpperCase() === "PENSIUN") continue;
      if (withinMonths(String(p.tgl_kgb || ""), 6)) kgb++;
      if (withinMonths(String(p.tgl_pangkat || ""), 6)) pangkat++;
      if (withinMonths(String(p.tgl_pensiun || ""), 6)) pensiun++;
    }
    const terlambat = events.filter((e) => e.isOverdue).length;
    return { kgb, pangkat, pensiun, terlambat };
  }, [data, events]);

  // Agenda terfilter + terurut (terlewat & paling dekat di atas)
  const filteredEvents = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const inRentang = (e: PenjagaanEvent) => {
      switch (filterRentang) {
        case "le3": return e.selisihHari >= 0 && e.selisihHari <= 90;
        case "le6": return e.selisihHari >= 0 && e.selisihHari <= 182;
        case "le12": return e.selisihHari >= 0 && e.selisihHari <= 365;
        case "terlambat": return e.selisihHari < 0;
        case "semua": return true;
      }
    };
    return events
      .filter((e) => {
        if (filterKategori !== "all" && e.kategori !== filterKategori) return false;
        if (filterBidang !== "all" && e.bidang !== filterBidang) return false;
        if (filterStatus !== "all" && e.status !== filterStatus) return false;
        if (!inRentang(e)) return false;
        if (q && !(`${e.nama} ${e.nip} ${e.jabatan} ${e.bidang}`.toLowerCase().includes(q))) return false;
        return true;
      })
      .sort((a, b) => a.selisihHari - b.selisihHari);
  }, [events, searchTerm, filterKategori, filterRentang, filterBidang, filterStatus]);

  const hasActiveFilter =
    filterKategori !== "all" || filterRentang !== "le6" ||
    filterBidang !== "all" || filterStatus !== "all" || !!searchTerm;

  function resetFilters() {
    setFilterKategori("all");
    setFilterRentang("le6");
    setFilterBidang("all");
    setFilterStatus("all");
    setSearchTerm("");
  }

  function exportCSV() {
    if (filteredEvents.length === 0) {
      toast.warning("Ekspor Kosong", "Tidak ada agenda pada filter saat ini.");
      return;
    }
    const rows = filteredEvents.map((e) => ({
      "NAMA PEGAWAI": e.nama,
      "NIP": `'${e.nip}`, // jaga NIP sebagai teks di Excel (cegah notasi ilmiah)
      "GOLONGAN": e.golongan,
      "JABATAN": e.jabatan,
      "BIDANG": e.bidang,
      "STATUS": e.status,
      "KATEGORI": KATEGORI_LABEL[e.kategori],
      "TANGGAL JATUH TEMPO": formatDate(e.tanggal),
      "SISA WAKTU": sisaWaktuLabel(e),
      "INDIKATOR": bucketMeta(e.bucket).label,
    }));
    const now = new Date();
    const yyyymmdd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const filename = `SIKANDA_BukuPenjagaan_${yyyymmdd}.csv`;
    const csv = Papa.unparse(rows);
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Ekspor Berhasil", `${filteredEvents.length} baris diunduh sebagai ${filename}`);
  }

  if (loading) return <LoadingState />;

  if (errorMsg) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center text-red-500 max-w-md">
          <AlertTriangle size={40} className="mx-auto mb-3 opacity-50" />
          <h2 className="font-bold mb-2">Gagal Memuat Buku Penjagaan</h2>
          <p className="text-sm">{errorMsg}</p>
        </div>
      </div>
    );
  }

  const summaryCards = [
    { key: "kgb", label: "KGB ≤ 6 bln", val: summary.kgb, icon: TrendingUp, color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/20", kategori: "KGB" as const },
    { key: "pangkat", label: "Kenaikan Pangkat ≤ 6 bln", val: summary.pangkat, icon: CalendarClock, color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/20", kategori: "PANGKAT" as const },
    { key: "pensiun", label: "Pensiun/BUP ≤ 6 bln", val: summary.pensiun, icon: Clock, color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-900/20", kategori: "BUP" as const },
    { key: "terlambat", label: "Terlambat (Lewat Tenggat)", val: summary.terlambat, icon: AlertTriangle, color: "text-red-700 dark:text-red-400", bg: "bg-red-50 dark:bg-red-900/20", kategori: null },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-5 md:h-full md:flex md:flex-col md:overflow-hidden"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 md:shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <CalendarCheck className="text-blue-600" size={26} />
            Buku Penjagaan
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Pemantauan tenggat KGB, Kenaikan Pangkat, dan Pensiun (BUP) · {events.length} agenda
          </p>
          {lastSync && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Terakhir sinkronisasi: {new Date(lastSync).toLocaleString("id-ID")}
            </p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Cari NIP, Nama, Jabatan, Bidang..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => load(true)}
            disabled={isRefreshing}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-sm"
          >
            <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
            {isRefreshing ? "Menyinkronkan..." : "Sinkronisasi"}
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm shrink-0"
          >
            <Download size={16} />
            Ekspor CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:shrink-0">
        {summaryCards.map((s) => (
          <button
            key={s.key}
            onClick={() => {
              if (s.kategori) { setFilterKategori(s.kategori); setFilterRentang("le6"); }
              else { setFilterKategori("all"); setFilterRentang("terlambat"); }
            }}
            className={`${s.bg} text-left rounded-3xl neu-raised p-4 border border-white/40 dark:border-white/5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl`}
          >
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500 dark:text-gray-400 pr-2">{s.label}</p>
              <s.icon size={16} className={s.color} />
            </div>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.val}</p>
          </button>
        ))}
      </div>

      {/* Legend + email window badge */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400 md:shrink-0">
        <span className="font-semibold text-gray-600 dark:text-gray-300">Indikator:</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Terlambat / ≤ 3 bln</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> ≤ 6 bln</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> ≤ 12 bln</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> &gt; 12 bln</span>
        <span className="inline-flex items-center gap-1.5 ml-auto px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
          <Mail size={12} /> Window email otomatis = {EMAIL_WINDOW_HARI} hari
        </span>
      </div>

      {/* Filters */}
      <Card className="md:shrink-0">
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
        <select
          value={filterKategori}
          onChange={(e) => setFilterKategori(e.target.value as any)}
          className="rounded-full neuglass-pressed text-gray-900 dark:text-gray-100 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="all">Semua Kategori</option>
          <option value="KGB">KGB</option>
          <option value="PANGKAT">Kenaikan Pangkat</option>
          <option value="BUP">Pensiun / BUP</option>
        </select>
        <select
          value={filterRentang}
          onChange={(e) => setFilterRentang(e.target.value as RentangFilter)}
          className="rounded-full neuglass-pressed text-gray-900 dark:text-gray-100 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="le3">≤ 3 bulan</option>
          <option value="le6">≤ 6 bulan</option>
          <option value="le12">≤ 12 bulan</option>
          <option value="terlambat">Terlambat</option>
          <option value="semua">Semua waktu</option>
        </select>
        <select
          value={filterBidang}
          onChange={(e) => setFilterBidang(e.target.value)}
          className="rounded-full neuglass-pressed text-gray-900 dark:text-gray-100 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none max-w-[220px]"
        >
          <option value="all">Semua Bidang</option>
          {bidangOptions.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-full neuglass-pressed text-gray-900 dark:text-gray-100 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
        >
          <option value="all">Semua Status</option>
          <option value="ASN">ASN</option>
          <option value="PPPK">PPPK</option>
        </select>
        {hasActiveFilter && (
          <button
            onClick={resetFilters}
            className="rounded-full neuglass-pressed px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
          >
            Reset Filter
          </button>
        )}
        <span className="text-sm text-gray-400 self-center ml-auto">
          Menampilkan {filteredEvents.length} agenda
        </span>
        </CardContent>
      </Card>

      {/* Table — Desktop */}
      <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-auto md:flex-1 md:min-h-0">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100 dark:bg-gray-800 text-xs uppercase tracking-wider text-gray-500 dark:text-gray-400">
                <th className="px-4 py-3 font-semibold">Pegawai</th>
                <th className="px-4 py-3 font-semibold">Gol.</th>
                <th className="px-4 py-3 font-semibold">Jabatan &amp; Bidang</th>
                <th className="px-4 py-3 font-semibold">Kategori</th>
                <th className="px-4 py-3 font-semibold">Jatuh Tempo</th>
                <th className="px-4 py-3 font-semibold">Sisa Waktu</th>
                <th className="px-4 py-3 font-semibold">Indikator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/50">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-400 text-sm">
                    Tidak ada agenda yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((e, i) => {
                  const meta = bucketMeta(e.bucket);
                  return (
                    <tr
                      key={`${e.nip}-${e.kategori}-${i}`}
                      onClick={() => openProfil(e.nip)}
                      className={`transition-colors ${e.nip ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30" : "hover:bg-gray-50 dark:hover:bg-gray-700/30"}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-gray-100">{e.nama || "-"}</div>
                        <div className="text-xs text-gray-400 font-mono">{e.nip || "-"}</div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap">{e.golongan || "-"}</td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-gray-800 dark:text-gray-200 line-clamp-1">{e.jabatan || "-"}</div>
                        <div className="text-xs text-gray-400 uppercase line-clamp-1">{e.bidang}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{KATEGORI_LABEL[e.kategori]}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-800 dark:text-gray-200 whitespace-nowrap">{formatDate(e.tanggal)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-sm font-medium ${e.selisihHari < 0 ? "text-red-600 dark:text-red-400" : "text-gray-700 dark:text-gray-300"}`}>
                          {e.overdueLabel && e.selisihHari < 0 ? sisaWaktuLabel(e) : sisaWaktuLabel(e)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                          <Badge variant={meta.badge}>{e.isOverdue && e.kategori === "BUP" ? "Lewat BUP" : meta.label}</Badge>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cards — Mobile */}
      <div className="md:hidden space-y-3">
        {filteredEvents.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-10">Tidak ada agenda yang cocok dengan filter.</div>
        ) : (
          filteredEvents.map((e, i) => {
            const meta = bucketMeta(e.bucket);
            return (
              <div
                key={`${e.nip}-${e.kategori}-${i}`}
                onClick={() => openProfil(e.nip)}
                className={`bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm ${e.nip ? "cursor-pointer active:bg-gray-50 dark:active:bg-gray-700/30" : ""}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-gray-100 truncate">{e.nama || "-"}</div>
                    <div className="text-xs text-gray-400 font-mono">{e.nip || "-"}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`} />
                    <Badge variant={meta.badge}>{e.isOverdue && e.kategori === "BUP" ? "Lewat BUP" : meta.label}</Badge>
                  </div>
                </div>
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{e.jabatan || "-"} · {e.bidang}</div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-[11px] text-gray-400">Kategori</div>
                    <div className="text-gray-800 dark:text-gray-200">{KATEGORI_LABEL[e.kategori]}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400">Golongan</div>
                    <div className="text-gray-800 dark:text-gray-200">{e.golongan || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400">Jatuh Tempo</div>
                    <div className="text-gray-800 dark:text-gray-200">{formatDate(e.tanggal)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-gray-400">Sisa Waktu</div>
                    <div className={e.selisihHari < 0 ? "text-red-600 dark:text-red-400 font-medium" : "text-gray-800 dark:text-gray-200"}>
                      {sisaWaktuLabel(e)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Item e — Modal profil 360° BERSAMA. Edit/Hapus TIDAK disuplai → tersembunyi. */}
      <AnimatePresence>
        {selectedPegawai && (
          <PegawaiDetailModal
            pegawai={selectedPegawai}
            onClose={() => setSelectedPegawai(null)}
            onSelectAsset={(a) => setSelectedAsset(a)}
          />
        )}
      </AnimatePresence>

      {/* Detail aset bersama (foto, peta, zoom internal) */}
      <AssetDetailModal
        asset={selectedAsset}
        isOpen={!!selectedAsset}
        onClose={() => setSelectedAsset(null)}
      />
    </motion.div>
  );
}
