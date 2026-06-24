import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { spreadsheetService } from "@/services/spreadsheetService";
import { DashboardMetrics } from "@/types";
import { formatNumber, formatCurrency } from "@/lib/utils";
import { Users, UserCheck, UserX, AlertTriangle, Clock, Calendar, CarFront, Wrench, Package, ArrowRightLeft, ShieldCheck, Wallet, Banknote, Archive, Settings } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from "recharts";
import { motion } from "motion/react";

export default function Dashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setErrorMsg(null);
        const data = await spreadsheetService.getDashboardMetrics();
        setMetrics(data);
      } catch (err: any) {
        console.error(err);
        setErrorMsg(err.message || "Gagal memuat data dari Spreadsheet.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-end">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-6 flex items-center space-x-4">
                <Skeleton className="w-12 h-12 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="bg-red-50 text-red-600 p-6 rounded-xl max-w-md text-center border border-red-200">
          <ShieldCheck size={48} className="mx-auto mb-4 text-red-500 opacity-50" />
          <h2 className="text-lg font-bold mb-2">Terjadi Kesalahan</h2>
          <p className="text-sm">{errorMsg}</p>
          <p className="text-xs mt-4 text-red-400">Silakan periksa Spreadsheet ID dan pastikan URL dibagikan ke publik ("Anyone with the link can view").</p>
        </div>
      </div>
    );
  }

  if (!metrics) return null;

  const KpiCard = ({ title, value, icon: Icon, colorClass, subtitle }: any) => (
    <Card>
      <CardContent className="p-6 flex items-center gap-4">
        <div className={`p-4 rounded-2xl ${colorClass}`}>
          <Icon size={24} />
        </div>
        <div>
          <p className="text-[16px] font-bold text-gray-500 dark:text-gray-400">{title}</p>
          <h4 className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">
            {typeof value === 'number' && title.includes("Pagu") ? formatCurrency(value) : 
             typeof value === 'number' && title.includes("Realisasi") ? formatCurrency(value) :
             formatNumber(value)}
          </h4>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );

  const pieData = [
    { name: "Kendaraan", value: metrics.totalKendaraan, color: "#0B57D0" },
    { name: "Alat & Mesin", value: metrics.totalAlatMesin, color: "#34A853" },
    { name: "Inventaris", value: metrics.totalInventaris, color: "#FBBC04" },
  ];

  const barData = [
    { name: "Anggaran", Pagu: metrics.totalPagu, Realisasi: metrics.totalRealisasi }
  ];

  const formattedLastUpdated = metrics?.lastUpdated
    ? new Intl.DateTimeFormat("id-ID", {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit"
      }).format(new Date(metrics.lastUpdated))
    : "Data real-time";

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-4">
        <motion.div variants={itemVariants}>
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">Dashboard SIKANDA</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Sistem Informasi Kepegawaian dan Pengelolaan Aset Daerah</p>
        </motion.div>
        <motion.div variants={itemVariants} className="flex items-center gap-2 text-sm text-gray-500 bg-white/60 dark:bg-gray-800/60 px-3 py-1.5 rounded-full border border-gray-100 dark:border-gray-700">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Terakhir sinkronisasi: {formattedLastUpdated}
        </motion.div>
      </div>

      {/* HR Metrics - Priority 1 */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 border-b border-gray-200 dark:border-gray-800 pb-2">Metrik Kepegawaian Utama</h2>
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KpiCard title="Total Pegawai/ASN" value={metrics.totalPegawai} icon={Users} colorClass="bg-blue-100/50 text-blue-600" />
          <KpiCard title="Pegawai Aktif" value={metrics.pegawaiAktif} icon={UserCheck} colorClass="bg-green-100/50 text-green-600" />
          <KpiCard title="Pegawai Pensiun" value={metrics.pegawaiPensiun} icon={UserX} colorClass="bg-gray-100/50 text-gray-600" />
        </motion.div>
      </div>

      {/* Buku Penjagaan Cerdas / Alerts */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 mt-6 border-b border-gray-200 dark:border-gray-800 pb-2">Metrik Buku Penjagaan</h2>
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700/50 p-5 rounded-2xl flex items-start gap-4 transition-all hover:shadow-md">
            <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-800/50 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="font-bold text-yellow-800 dark:text-yellow-400">KGB (6 Bulan)</h3>
              <p className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1">{metrics.peringatanKGB} <span className="text-sm font-normal text-gray-600 dark:text-gray-400">Pegawai</span></p>
              <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-1">Jadwal Kenaikan Gaji Berkala terdekat</p>
            </div>
          </div>
          
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 p-5 rounded-2xl flex items-start gap-4 transition-all hover:shadow-md">
            <div className="p-3 rounded-full bg-blue-100 dark:bg-blue-800/50 text-blue-600 dark:text-blue-400">
              <Calendar size={24} />
            </div>
            <div>
              <h3 className="font-bold text-blue-800 dark:text-blue-400">Kenaikan Pangkat</h3>
              <p className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1">{metrics.peringatanPangkat} <span className="text-sm font-normal text-gray-600 dark:text-gray-400">Pegawai</span></p>
              <p className="text-xs text-blue-700 dark:text-blue-500 mt-1">Jadwal usulan Kenaikan Pangkat terdekat</p>
            </div>
          </div>

          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 p-5 rounded-2xl flex items-start gap-4 transition-all hover:shadow-md">
            <div className="p-3 rounded-full bg-red-100 dark:bg-red-800/50 text-red-600 dark:text-red-400">
              <Clock size={24} />
            </div>
            <div>
              <h3 className="font-bold text-red-800 dark:text-red-400">Pensiun (6 Bulan)</h3>
              <p className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-1">{metrics.peringatanPensiun} <span className="text-sm font-normal text-gray-600 dark:text-gray-400">Pegawai</span></p>
              <p className="text-xs text-red-700 dark:text-red-500 mt-1">Siapkan penarikan tanggungan aset/mutasi</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Asset Metrics - Secondary now */}
      <div>
        <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 mb-4 mt-6 border-b border-gray-200 dark:border-gray-800 pb-2">Metrik Aset dan Penganggaran</h2>
        <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Jumlah Total Aset" value={metrics.totalAset} icon={Package} colorClass="bg-purple-100/50 text-purple-600" />
          <KpiCard title="Kendaraan" value={metrics.totalKendaraan} icon={CarFront} colorClass="bg-indigo-100/50 text-indigo-600" />
          <KpiCard title="Alat & Mesin" value={metrics.totalAlatMesin} icon={Wrench} colorClass="bg-emerald-100/50 text-emerald-600" />
          <KpiCard title="Inventaris" value={metrics.totalInventaris} icon={Archive} colorClass="bg-orange-100/50 text-orange-600" />
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
        <motion.div variants={itemVariants} className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          <KpiCard title="Total Pagu" value={metrics.totalPagu} icon={Wallet} colorClass="bg-slate-100/50 text-slate-600" />
          <KpiCard title="Total Realisasi" value={metrics.totalRealisasi} icon={Banknote} colorClass="bg-teal-100/50 text-teal-600" subtitle={`${metrics.persenRealisasi.toFixed(1)}% terserap`} />
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Pagu dan Realisasi Anggaran</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E3E3E3" />
                  <XAxis type="number" tickFormatter={(val) => {
                    if (val >= 1000000000) {
                      return `Rp ${(val / 1000000000).toFixed(1).replace('.', ',')} M`;
                    }
                    return `Rp ${(val / 1000000).toFixed(0)} Jt`;
                  }} tickMargin={10} />
                  <YAxis dataKey="name" type="category" hide />
                  <Tooltip formatter={(val: number) => formatCurrency(val)} cursor={false} />
                  <Bar dataKey="Pagu" fill="#0B57D0" radius={[0, 4, 4, 0]} barSize={32} />
                  <Bar dataKey="Realisasi" fill="#16A34A" radius={[0, 4, 4, 0]} barSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={itemVariants}>
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Distribusi Tanggungan Aset</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center flex-1 pb-6">
              <div className="w-48 h-48 relative mb-6">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={85}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip cursor={false} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Total Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatNumber(metrics.totalAset)}</span>
                  <span className="text-xs text-gray-500 font-medium">Total Aset</span>
                </div>
              </div>
              
              {/* Legend underneath */}
              <div className="grid grid-cols-2 gap-4 w-full">
                {pieData.map((item) => (
                  <div key={item.name} className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }}></div>
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400 truncate">{item.name}</span>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 pl-5">{formatNumber(item.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}
