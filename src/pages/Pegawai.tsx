import React, { useEffect, useState } from "react";
import { spreadsheetService } from "@/services/spreadsheetService";
import { Pegawai } from "@/types";
import { Card, CardContent } from "@/components/ui/Card";
import { Search, Info, Briefcase, UserCircle, Calendar, AlertTriangle, Package, ZoomIn, ImageOff } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Skeleton } from "@/components/ui/Skeleton";
import { DetailModal } from "@/components/ui/DetailModal";

export default function PegawaiPage() {
  const [data, setData] = useState<Pegawai[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPegawai, setSelectedPegawai] = useState<Pegawai | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<any | null>(null);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const result = await spreadsheetService.getPegawai();
        setData(result);
      } catch (error) {
        console.error("Gagal memuat data pegawai:", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredData = data.filter(p => 
    p.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.nip.includes(searchTerm) ||
    p.unit_kerja.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Pegawai / ASN</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Kelola profil, jabatan, dan tanggungan aset</p>
        </div>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Cari NIP, Nama, Unit Kerja..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white/50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="flex gap-4">
                  <Skeleton className="w-16 h-16 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="w-full">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                    <th className="p-4 font-medium">Profil</th>
                    <th className="p-4 font-medium">NIP</th>
                    <th className="p-4 font-medium">Jabatan & Unit Kerja</th>
                    <th className="p-4 font-medium">Status</th>
                    <th className="p-4 font-medium">Aset</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredData.map((pegawai, index) => (
                    <motion.tr 
                      key={`desktop-${pegawai.nip}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.02, 0.5) }}
                      className="hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer transition-colors"
                      onClick={() => setSelectedPegawai(pegawai)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <img src={pegawai.foto} alt={pegawai.nama} className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700" />
                          <span className="font-semibold text-gray-900 dark:text-gray-100">{pegawai.nama}</span>
                        </div>
                      </td>
                      <td className="p-4 font-mono text-sm text-gray-600 dark:text-gray-400">{pegawai.nip}</td>
                      <td className="p-4">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1">{pegawai.jabatan}</div>
                        <div className="text-xs text-gray-500 line-clamp-1">{pegawai.unit_kerja}</div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold rounded-full ${pegawai.status.toLowerCase() === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {pegawai.status}
                        </span>
                      </td>
                      <td className="p-4">
                        {pegawai.assets && pegawai.assets.length > 0 ? (
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                            <Package size={14} />
                            <span>{pegawai.assets.length}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-400">-</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              {filteredData.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  Tidak ada data pegawai yang sesuai.
                </div>
              )}
            </div>
          </div>

          {/* Mobile Card List View */}
          <div className="md:hidden grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredData.map((pegawai, index) => (
              <motion.div 
                key={`mobile-${pegawai.nip}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.5) }}
                whileHover={{ scale: 1.02 }}
                className="cursor-pointer"
                onClick={() => setSelectedPegawai(pegawai)}
              >
                <Card className="h-full overflow-hidden hover:shadow-md transition-all">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-4">
                      <img src={pegawai.foto} alt={pegawai.nama} className="w-14 h-14 rounded-full object-cover border-2 border-gray-100 dark:border-gray-800" />
                      <div className="flex-1 overflow-hidden">
                        <h3 className="font-bold text-gray-900 dark:text-white leading-tight truncate">{pegawai.nama}</h3>
                        <p className="text-xs font-mono text-gray-500 mt-0.5 truncate">{pegawai.nip}</p>
                        <span className={`inline-block mt-2 px-2 py-0.5 text-[10px] font-bold rounded-full ${pegawai.status.toLowerCase() === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {pegawai.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <Briefcase size={14} className="shrink-0" />
                        <span className="truncate">{pegawai.jabatan}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                        <UserCircle size={14} className="shrink-0" />
                        <span className="truncate">{pegawai.unit_kerja}</span>
                      </div>
                      {pegawai.assets && pegawai.assets.length > 0 && (
                        <div className="flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 mt-2">
                          <Package size={14} className="shrink-0" />
                          <span>{pegawai.assets.length} Tanggungan Aset</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            {filteredData.length === 0 && (
              <div className="p-8 text-center text-gray-500 col-span-1 sm:col-span-2">
                Tidak ada data pegawai yang sesuai.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 360 Degree Profile Modal */}
      <AnimatePresence>
        {selectedPegawai && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="flex justify-between items-center p-6 border-b border-gray-100 dark:border-gray-800">
                <h2 className="text-xl font-bold">Profil Pegawai 360°</h2>
                <button onClick={() => setSelectedPegawai(null)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                  &times;
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6">
                <div className="flex flex-col md:flex-row gap-8">
                  {/* Sidebar Info */}
                  <div className="w-full md:w-1/3 space-y-6">
                    <div className="text-center">
                      <img src={selectedPegawai.foto} alt={selectedPegawai.nama} className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-white dark:border-gray-800 shadow-lg" />
                      <h3 className="text-xl font-bold mt-4">{selectedPegawai.nama}</h3>
                      <p className="text-gray-500 font-mono">{selectedPegawai.nip}</p>
                      <span className={`inline-block mt-2 px-3 py-1 text-xs font-bold rounded-full ${selectedPegawai.status.toLowerCase() === 'aktif' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {selectedPegawai.status}
                      </span>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl space-y-3 text-sm">
                      <div>
                        <p className="text-gray-500 mb-1">Jabatan</p>
                        <p className="font-semibold">{selectedPegawai.jabatan}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Unit Kerja</p>
                        <p className="font-semibold">{selectedPegawai.unit_kerja}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 mb-1">Golongan / Ruang</p>
                        <p className="font-semibold">{selectedPegawai.golongan}</p>
                      </div>
                    </div>
                  </div>

                  {/* Main Content Tabs (Simulated) */}
                  <div className="w-full md:w-2/3 space-y-6">
                    {/* Biodata/SK Section */}
                    <div>
                      <h4 className="flex items-center gap-2 font-bold text-lg mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                        <UserCircle className="text-blue-500" size={20} />
                        Informasi Lengkap (Biodata/SK)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                        <div className="flex flex-col border-b border-gray-100 dark:border-gray-800/50 pb-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Nomor Induk Pegawai (NIP)</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">{selectedPegawai.nip}</span>
                        </div>
                        <div className="flex flex-col border-b border-gray-100 dark:border-gray-800/50 pb-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Nama Lengkap</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">{selectedPegawai.nama}</span>
                        </div>
                        <div className="flex flex-col border-b border-gray-100 dark:border-gray-800/50 pb-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Status Pegawai</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">{selectedPegawai.status}</span>
                        </div>
                        <div className="flex flex-col border-b border-gray-100 dark:border-gray-800/50 pb-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tanggal Lahir</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">{selectedPegawai.tgl_lahir}</span>
                        </div>
                        <div className="flex flex-col border-b border-gray-100 dark:border-gray-800/50 pb-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Unit Kerja / Dinas</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">{selectedPegawai.unit_kerja}</span>
                        </div>
                        <div className="flex flex-col border-b border-gray-100 dark:border-gray-800/50 pb-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Jabatan</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">{selectedPegawai.jabatan}</span>
                        </div>
                        <div className="flex flex-col border-b border-gray-100 dark:border-gray-800/50 pb-2">
                          <span className="text-xs text-gray-500 dark:text-gray-400 mb-1">Golongan / Ruang</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-gray-100 break-words">{selectedPegawai.golongan}</span>
                        </div>
                      </div>
                    </div>

                    {/* Buku Penjagaan Section */}
                    <div>
                      <h4 className="flex items-center gap-2 font-bold text-lg mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                        <AlertTriangle className="text-yellow-500" size={20} />
                        Buku Penjagaan Cerdas
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-4 border border-blue-100 bg-blue-50/50 dark:border-blue-900/50 dark:bg-blue-900/20 rounded-xl">
                          <p className="text-sm text-blue-600 dark:text-blue-400 font-semibold mb-1">Jadwal KGB Terdekat</p>
                          <p className="text-lg font-bold">{selectedPegawai.tgl_kgb}</p>
                        </div>
                        <div className="p-4 border border-purple-100 bg-purple-50/50 dark:border-purple-900/50 dark:bg-purple-900/20 rounded-xl">
                          <p className="text-sm text-purple-600 dark:text-purple-400 font-semibold mb-1">Usulan Pangkat Terdekat</p>
                          <p className="text-lg font-bold">{selectedPegawai.tgl_pangkat}</p>
                        </div>
                      </div>
                    </div>

                    {/* Tanggungan Aset Section */}
                    <div>
                      <h4 className="flex items-center gap-2 font-bold text-lg mb-3 pb-2 border-b border-gray-100 dark:border-gray-800">
                        <Package className="text-indigo-500" size={20} />
                        Tanggungan Aset / Fasilitas
                      </h4>
                      {selectedPegawai.assets && selectedPegawai.assets.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {selectedPegawai.assets.map((asset, idx) => (
                            <div 
                              key={idx} 
                              className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm flex flex-col cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                              onClick={() => setSelectedAsset(asset)}
                            >
                              {asset.foto ? (
                                <img src={asset.foto.startsWith('http') ? asset.foto : `https://www.appsheet.com/template/gettablefileurl?appName=SIMOSDA-845158139&tableName=Kendaraan&fileName=${encodeURIComponent(asset.foto)}`} alt={asset.merk} className="w-full h-32 object-cover" />
                              ) : (
                                <div className="w-full h-32 bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-400">
                                  <Package size={32} />
                                </div>
                              )}
                              <div className="p-4 flex-1 flex flex-col justify-between">
                                <div>
                                  <div className="flex justify-between items-start mb-1">
                                    <h5 className="font-bold text-gray-900 dark:text-gray-100">{asset.no_polisi || asset.kode_barang}</h5>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${asset.kondisi === 'BAIK' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{asset.kondisi}</span>
                                  </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">{asset.merk} {asset.tipe}</p>
                                  <p className="text-xs text-gray-500 mt-2 line-clamp-1">{asset.jenis_kendaraan}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-gray-50 dark:bg-gray-800/30 border border-gray-100 dark:border-gray-800 rounded-xl p-6 text-center">
                          <Info className="mx-auto text-gray-400 mb-2" size={24} />
                          <p className="text-sm text-gray-500">Tidak ada data aset atau fasilitas yang tercatat untuk {selectedPegawai.nama}.</p>
                        </div>
                      )}
                      
                      {selectedPegawai.status.toLowerCase() === 'pensiun' && selectedPegawai.assets && selectedPegawai.assets.length > 0 && (
                         <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm font-bold flex items-center justify-center gap-2">
                           <AlertTriangle size={16} />
                           Peringatan: Pegawai Pensiun. Segera lakukan penarikan {selectedPegawai.assets.length} aset.
                         </div>
                      )}
                    </div>

                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <DetailModal 
        isOpen={!!selectedAsset} 
        onClose={() => setSelectedAsset(null)} 
        title="Detail Aset / Kendaraan" 
        data={selectedAsset ? {
          "Asset ID": selectedAsset.asset_id,
          "Kode Barang": selectedAsset.kode_barang,
          "Nomor Polisi": selectedAsset.no_polisi,
          "Merk": selectedAsset.merk,
          "Tipe": selectedAsset.tipe,
          "Kondisi": selectedAsset.kondisi,
          "Jenis Kendaraan": selectedAsset.jenis_kendaraan,
          "Tahun Pembelian": selectedAsset.tahun,
          "Pengguna": selectedAsset.pengguna,
          "Unit Kerja": selectedAsset.unit_kerja,
          "Kapasitas Mesin": selectedAsset.kapasitas_mesin,
          "No. BPKB": selectedAsset.no_bpkb,
          "No. Rangka": selectedAsset.no_rangka,
          "No. Mesin": selectedAsset.no_mesin,
          "Harga Pembelian": selectedAsset.harga_pembelian,
          "KM Kendaraan": selectedAsset.km_kendaraan,
        } : null} 
      >
        {selectedAsset && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-800 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Foto Kendaraan</span>
              <div className="w-full aspect-video bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden flex items-center justify-center relative group">
                {selectedAsset.foto ? (
                  <>
                    <img 
                      src={selectedAsset.foto.includes("Kendaraan_Images") 
                        ? `https://www.appsheet.com/template/gettablefileurl?appName=SIMOSDA-845158139&tableName=Kendaraan&fileName=${encodeURIComponent(selectedAsset.foto)}` 
                        : selectedAsset.foto} 
                      alt="Foto" 
                      className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity bg-white"
                      onClick={(e) => setZoomedImage(e.currentTarget.src)}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://placehold.co/600x400/e2e8f0/64748b?text=Image+Not+Found`;
                        (e.target as HTMLImageElement).onerror = null;
                      }}
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                      <ZoomIn className="text-white drop-shadow-md" size={32} />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-gray-400">
                    <ImageOff size={24} className="mb-2" />
                    <span className="text-xs">Tidak ada foto</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Lokasi Terakhir</span>
              <div className="w-full aspect-video bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden relative group">
                {selectedAsset.latitude && selectedAsset.longitude ? (
                  (() => {
                    const lat = String(selectedAsset.latitude).replace(',', '.').trim();
                    const lng = String(selectedAsset.longitude).replace(',', '.').trim();
                    return (
                      <>
                        <iframe 
                          width="100%" 
                          height="100%" 
                          frameBorder="0" 
                          style={{ border: 0 }}
                          src={`https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`} 
                          allowFullScreen 
                          title="Lokasi"
                          loading="lazy"
                        />
                        <a 
                          href={`https://maps.google.com/?q=${lat},${lng}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-gray-800/90 text-blue-600 dark:text-blue-400 text-xs font-semibold px-3 py-1.5 rounded-full shadow-md backdrop-blur-sm"
                        >
                          Buka di Maps
                        </a>
                      </>
                    );
                  })()
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-4 text-center">
                    <AlertTriangle size={24} className="mb-2 opacity-50" />
                    <span className="text-xs">Titik koordinat tidak tersedia</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </DetailModal>

      {/* Image Zoom Modal */}
      {zoomedImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4" onClick={() => setZoomedImage(null)}>
          <img src={zoomedImage} alt="Zoomed" className="max-w-full max-h-full object-contain" />
        </div>
      )}
    </div>
  );
}
