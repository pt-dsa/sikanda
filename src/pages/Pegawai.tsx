import React, { useEffect, useState, useMemo, useContext } from "react";
import { useSearchParams } from "react-router-dom";
import { spreadsheetService } from "@/services/spreadsheetService";
import { apiService } from "@/services/apiService";
import { AuthContext } from "@/components/layout/AppShell";
import { can, canEditPegawaiRow } from "@/lib/rbac";
import { Pegawai } from "@/types";
import { Card, CardContent } from "@/components/ui/Card";
import {
  Search, Info, Briefcase, UserCircle, Calendar, AlertTriangle,
  Package, ZoomIn, ImageOff, Phone, GraduationCap, Clock,
  CheckCircle2, CircleDot, Car, Wrench, Archive, ChevronDown, RefreshCw, Plus, Edit2, X, Save, Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { LoadingState } from "@/components/ui/LoadingState";
import { PegawaiFormModal } from "@/components/ui/PegawaiFormModal";
import { formatDate } from "@/lib/utils";
import {
  PegawaiDetailModal, PegawaiAvatar, MatchBadge, KGBStatus, PensiunStatus,
} from "@/components/ui/PegawaiDetailModal";
import { AssetDetailModal } from "@/components/ui/AssetDetailModal";

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function PegawaiPage() {
  const { user } = useContext(AuthContext);
  const [data, setData] = useState<Pegawai[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterGolongan, setFilterGolongan] = useState("all");
  const [filterMatch, setFilterMatch] = useState<"all" | "exact" | "fuzzy" | "none">("all");
  const [filterIncomplete, setFilterIncomplete] = useState(false);
  const [selectedPegawai, setSelectedPegawai] = useState<Pegawai | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingPegawai, setEditingPegawai] = useState<Pegawai | null>(null);

  async function handleDelete(p: Pegawai) {
    const ok = window.confirm(
      `Nonaktifkan pegawai "${p.nama}" (NIP ${p.nip})?\n\nData tidak dihapus permanen — hanya disembunyikan dari daftar aktif (soft delete) dan tetap tersimpan untuk audit.`
    );
    if (!ok) return;
    try {
      await apiService.deletePegawai(String(p.nip));
      spreadsheetService.clearCache();
      setSelectedPegawai(null);
      await load(true);
    } catch (err: any) {
      alert(err?.message || "Gagal menonaktifkan pegawai.");
    }
  }

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
      setData(result);
      setLastSync(spreadsheetService.getLastUpdated());
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal memuat data pegawai.");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Deep-link dari Dashboard (KPI ASN/PPPK → /pegawai?status=ASN) dan filter aset.
  const [searchParams] = useSearchParams();
  useEffect(() => {
    const s = (searchParams.get("status") || "").toUpperCase();
    if (s === "ASN" || s === "PPPK") setFilterStatus(s);
    const m = (searchParams.get("match") || "").toLowerCase();
    if (m === "exact" || m === "fuzzy" || m === "none") setFilterMatch(m as any);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Golongan level options for filter
  const golonganLevels = useMemo(() => {
    const levels = new Set(data.map((p) => (p.golongan || "").split("/")[0]).filter(Boolean));
    return Array.from(levels).sort();
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter((p) => {
      const search = searchTerm.toLowerCase();
      const matchSearch =
        !search ||
        p.nama.toLowerCase().includes(search) ||
        p.nip.includes(search) ||
        (p.unit_kerja || "").toLowerCase().includes(search) ||
        (p.jabatan || "").toLowerCase().includes(search) ||
        (p.golongan || "").toLowerCase().includes(search);

      const matchStatus = filterStatus === "all" || p.status === filterStatus;
      // PERBAIKAN QA: bandingkan LEVEL golongan secara EKSAK (mis. "III/d" → "III"),
      // bukan startsWith. "III/d".startsWith("II") === true sehingga filter "II"
      // keliru ikut menarik semua golongan III. Level diambil identik dgn opsi dropdown.
      const matchGolongan =
        filterGolongan === "all" ||
        (p.golongan || "").split("/")[0].trim() === filterGolongan;

      const matchMatch = filterMatch === "all" || p.match_quality === filterMatch;

      const matchIncomplete = filterIncomplete ? p.is_incomplete : true;

      return matchSearch && matchStatus && matchGolongan && matchMatch && matchIncomplete;
    });
  }, [data, searchTerm, filterStatus, filterGolongan, filterMatch, filterIncomplete]);

  // Match summary stats
  const matchStats = useMemo(() => {
    const withAssets = data.filter((p) => (p.assets?.length || 0) > 0).length;
    const exact = data.filter((p) => p.match_quality === "exact").length;
    const fuzzy = data.filter((p) => p.match_quality === "fuzzy").length;
    const none = data.filter((p) => p.match_quality === "none").length;
    return { withAssets, exact, fuzzy, none };
  }, [data]);

  if (loading) return <LoadingState />;

  if (errorMsg) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="bg-red-50 text-red-600 p-6 rounded-xl max-w-md text-center border border-red-200">
          <AlertTriangle size={40} className="mx-auto mb-3 opacity-50" />
          <h2 className="font-bold mb-2">Gagal Memuat Data Pegawai</h2>
          <p className="text-sm">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 md:h-full md:flex md:flex-col md:overflow-hidden">

      {/* Page header */}
      <div className="md:shrink-0 flex flex-col md:flex-row md:justify-between md:items-start gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data ASN / PPPK</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Kelola profil, jabatan, dan tanggungan aset · {data.length} pegawai
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
              placeholder="Cari NIP, Nama, Jabatan..."
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
          {can(user?.role, "pegawai.create") && (
            <button
              onClick={() => {
                setEditingPegawai(null);
                setIsFormModalOpen(true);
              }}
              className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors shadow-sm shrink-0"
            >
              <Plus size={16} />
              Tambah Pegawai
            </button>
          )}
        </div>
      </div>

      {/* Match analysis banner — kartu klikable → filter berdasarkan kualitas match aset */}
      <div className="md:shrink-0 grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { key: "all" as const, label: "Total Pegawai", val: data.length, color: "text-gray-800 dark:text-gray-200", bg: "bg-gray-100 dark:bg-gray-800" },
          { key: "exact" as const, label: "Aset Terverifikasi", val: matchStats.exact, color: "text-green-700 dark:text-green-400", bg: "bg-green-50 dark:bg-green-900/20" },
          { key: "fuzzy" as const, label: "Aset Fuzzy Match", val: matchStats.fuzzy, color: "text-yellow-700 dark:text-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-900/20" },
          { key: "none" as const, label: "Tanpa Aset", val: matchStats.none, color: "text-gray-500", bg: "bg-gray-50 dark:bg-gray-800/30" },
        ].map((s) => {
          const active = filterMatch === s.key;
          return (
            <button
              key={s.label}
              onClick={() => setFilterMatch(s.key)}
              aria-pressed={active}
              className={`${s.bg} text-left rounded-3xl neu-raised p-4 border transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                active ? "border-blue-500 ring-2 ring-blue-500/40" : "border-white/40 dark:border-white/5"
              }`}
            >
              <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              <p className={`text-xl font-bold ${s.color}`}>{s.val}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <Card className="md:shrink-0">
        <CardContent className="p-3 flex flex-wrap items-center gap-3">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-full neuglass-pressed text-gray-900 dark:text-gray-100 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Semua Status</option>
            <option value="ASN">ASN</option>
            <option value="PPPK">PPPK</option>
            <option value="">Status Kosong</option>
          </select>
          <select
            value={filterGolongan}
            onChange={(e) => setFilterGolongan(e.target.value)}
            className="rounded-full neuglass-pressed text-gray-900 dark:text-gray-100 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="all">Semua Golongan</option>
            {golonganLevels.map((l) => (
              <option key={l} value={l}>Golongan {l}</option>
            ))}
          </select>
          <button
            onClick={() => setFilterIncomplete(!filterIncomplete)}
            className={`text-sm px-4 py-2 flex items-center gap-1.5 rounded-full transition-colors ${
              filterIncomplete
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                : "neuglass-pressed text-gray-700 dark:text-gray-300 hover:text-amber-700 dark:hover:text-amber-400"
            }`}
          >
            <AlertTriangle size={14} />
            Data Tidak Lengkap
          </button>
          {(filterStatus !== "all" || filterGolongan !== "all" || filterMatch !== "all" || filterIncomplete || searchTerm) && (
            <button
              onClick={() => { setFilterStatus("all"); setFilterGolongan("all"); setFilterMatch("all"); setFilterIncomplete(false); setSearchTerm(""); }}
              className="text-sm px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors"
            >
              Reset Filter
            </button>
          )}
          <span className="text-sm text-gray-400 self-center ml-auto">
            Menampilkan {filteredData.length} dari {data.length} pegawai
          </span>
        </CardContent>
      </Card>

      {/* Table — Desktop */}
      <div className="hidden md:flex md:flex-col md:flex-1 md:min-h-0 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-auto md:flex-1 md:min-h-0">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                <th className="p-4 font-medium">Profil</th>
                <th className="p-4 font-medium">NIP</th>
                <th className="p-4 font-medium">Golongan</th>
                <th className="p-4 font-medium">Jabatan & Unit Kerja</th>
                <th className="p-4 font-medium">Status</th>
                <th className="p-4 font-medium">KGB Berikutnya</th>
                <th className="p-4 font-medium">Aset</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredData.map((pegawai, index) => (
                <motion.tr
                  key={pegawai.nip || index}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.02, 0.4) }}
                  className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors ${
                    pegawai.is_incomplete ? "bg-amber-50/30 dark:bg-amber-900/10" : ""
                  }`}
                  onClick={() => setSelectedPegawai(pegawai)}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <PegawaiAvatar foto={pegawai.foto} nama={pegawai.nama} size="sm" />
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight max-w-[180px] truncate">
                          {pegawai.nama}
                        </span>
                        {pegawai.is_incomplete && (
                          <span 
                            title="Data profil belum lengkap (NIP, Jabatan, Golongan, atau Status kosong)"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-[10px] font-bold border border-amber-200 dark:border-amber-800/50"
                          >
                            <AlertTriangle size={10} />
                            Tidak Lengkap
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 font-mono text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {pegawai.nip}
                  </td>
                  <td className="p-4">
                    <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{pegawai.golongan}</span>
                  </td>
                  <td className="p-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1 max-w-[200px]">
                      {pegawai.jabatan}
                    </div>
                    {pegawai.unit_kerja && (
                      <div className="text-xs text-gray-500 line-clamp-1 mt-0.5">{pegawai.unit_kerja}</div>
                    )}
                  </td>
                  <td className="p-4">
                    <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded-full ${
                      pegawai.status === "ASN"
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"
                        : pegawai.status === "PPPK"
                          ? "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                    }`}>
                      {pegawai.status || "-"}
                    </span>
                  </td>
                  <td className="p-4">
                    <KGBStatus tglKgb={pegawai.tgl_kgb} />
                  </td>
                  <td className="p-4">
                    {(pegawai.assets?.length || 0) > 0 ? (
                      <div className="flex items-center gap-1">
                        <div className={`flex items-center gap-1 text-sm font-bold ${
                          pegawai.match_quality === "exact"
                            ? "text-green-600 dark:text-green-400"
                            : "text-yellow-600 dark:text-yellow-400"
                        }`}>
                          <Package size={13} />
                          <span>{pegawai.assets?.length}</span>
                        </div>
                        <MatchBadge quality={pegawai.match_quality} />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filteredData.length === 0 && (
            <div className="p-10 text-center text-gray-500">
              <Search size={32} className="mx-auto mb-3 opacity-30" />
              <p>Tidak ada pegawai yang sesuai dengan filter.</p>
            </div>
          )}
        </div>
      </div>

      {/* Cards — Mobile */}
      <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
        {filteredData.map((pegawai, index) => (
          <motion.div
            key={pegawai.nip || index}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index * 0.04, 0.4) }}
            whileHover={{ scale: 1.01 }}
            className="cursor-pointer"
            onClick={() => setSelectedPegawai(pegawai)}
          >
            <Card className="overflow-hidden hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <PegawaiAvatar foto={pegawai.foto} nama={pegawai.nama} size="md" />
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="font-bold text-gray-900 dark:text-white leading-tight text-sm truncate">
                        {pegawai.nama}
                      </h3>
                      {pegawai.is_incomplete && (
                        <span 
                          title="Data profil belum lengkap (NIP, Jabatan, Golongan, atau Status kosong)"
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 text-[10px] font-bold border border-amber-200 dark:border-amber-800/50"
                        >
                          <AlertTriangle size={10} />
                          Tidak Lengkap
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-gray-500 mt-0.5">{pegawai.nip}</p>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full ${
                        pegawai.status === "ASN"
                          ? "bg-blue-100 text-blue-700"
                          : pegawai.status === "PPPK"
                            ? "bg-purple-100 text-purple-700"
                            : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                      }`}>
                        {pegawai.status || "-"}
                      </span>
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-gray-100 text-gray-700">
                        {pegawai.golongan || "-"}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <Briefcase size={11} className="shrink-0" />
                    <span className="truncate">{pegawai.jabatan}</span>
                  </div>
                  {pegawai.unit_kerja && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <UserCircle size={11} className="shrink-0" />
                      <span className="truncate">{pegawai.unit_kerja}</span>
                    </div>
                  )}
                  {(pegawai.assets?.length || 0) > 0 && (
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mt-1">
                      <Package size={11} className="shrink-0" />
                      <span>{pegawai.assets?.length} Aset</span>
                      <MatchBadge quality={pegawai.match_quality} />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {filteredData.length === 0 && (
          <div className="col-span-full p-10 text-center text-gray-500">
            Tidak ada data yang sesuai.
          </div>
        )}
      </div>

      {/* Profile 360° Modal */}
      <AnimatePresence>
        {selectedPegawai && (
          <PegawaiDetailModal
            pegawai={selectedPegawai}
            onClose={() => setSelectedPegawai(null)}
            onSelectAsset={(a) => { setSelectedAsset(a); }}
            onEdit={
              canEditPegawaiRow(user, selectedPegawai.nip)
                ? () => {
                    setSelectedPegawai(null);
                    setEditingPegawai(selectedPegawai);
                    setIsFormModalOpen(true);
                  }
                : undefined
            }
            onDelete={
              can(user?.role, "pegawai.delete")
                ? () => handleDelete(selectedPegawai)
                : undefined
            }
          />
        )}
      </AnimatePresence>

      {/* Asset Detail Modal — komponen bersama (foto, peta, zoom internal) */}
      <AssetDetailModal
        asset={selectedAsset}
        isOpen={!!selectedAsset}
        onClose={() => setSelectedAsset(null)}
      />


      {/* Form Modal */}
      <AnimatePresence>
        {isFormModalOpen && (
          <PegawaiFormModal
            isOpen={isFormModalOpen}
            initialData={editingPegawai}
            user={user}
            onClose={() => setIsFormModalOpen(false)}
            onSuccess={() => {
              setIsFormModalOpen(false);
              load(true);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
