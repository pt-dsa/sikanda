export interface Asset {
  id?: string | number;
  asset_id?: string;
  kode_barang?: string;
  nama_aset?: string; // normalized from nama_barang
  merk?: string;
  tahun?: string | number;
  pengguna?: string;
  penanggung_jawab?: string;
  lokasi?: string;
  kondisi?: string;
  foto?: string;
  latitude?: number | string;
  longitude?: number | string;
}

export interface Vehicle extends Asset {
  no_polisi: string;
  tipe?: string;
  jenis_kendaraan?: string;
  km_kendaraan?: string | number;
}

export interface Equipment extends Asset {
  jenis?: string;
  jumlah?: number;
  satuan?: string;
}

export interface Inventory extends Asset {
  jenis?: string;
  jumlah?: number;
  satuan?: string;
  lokasi_ruangan?: string;
}

export interface Budget {
  id?: string;
  tahun_anggaran?: string;
  no_polisi?: string;
  asset_id?: string;
  jenis_kendaraan?: string;
  pagu_service?: number;
  pagu_suku_cadang?: number;
  realisasi_service?: number;
  realisasi_suku_cadang?: number;
  total_pagu?: number;
  total_realisasi?: number;
  sisa_anggaran?: number;
  persentase_realisasi?: number;
}

export interface Maintenance {
  id?: string;
  tanggal?: string;
  no_polisi?: string;
  asset_id?: string;
  nama_barang?: string;
  pemohon?: string;
  jenis_service?: string;
  uraian?: string;
  biaya?: number;
  bengkel?: string;
  vendor?: string;
  status?: string;
  approval?: string;
  spk?: string;
  foto?: string;
  dokumen?: string;
}

export interface Loan {
  id?: string;
  tanggal_pengajuan?: string;
  peminjam?: string;
  bidang?: string;
  asset_type?: string;
  asset_id?: string;
  nama_aset?: string;
  tanggal_pinjam?: string;
  tanggal_kembali?: string;
  keperluan?: string;
  status?: string;
  approval?: string;
  catatan?: string;
}

export interface Pegawai {
  nip: string;
  nama: string;
  jabatan: string;
  unit_kerja: string;
  golongan: string;
  status: string;
  tgl_lahir: string;
  tgl_kgb: string;
  tgl_pangkat: string;
  foto?: string;
  assets?: any[];
}

export interface DashboardMetrics {
  totalPegawai: number;
  pegawaiAktif: number;
  pegawaiPensiun: number;
  peringatanKGB: number;
  peringatanPangkat: number;
  peringatanPensiun: number;
  totalAset: number;
  totalKendaraan: number;
  totalAlatMesin: number;
  totalInventaris: number;
  totalPeminjaman: number;
  totalPemeliharaan: number;
  totalPagu: number;
  totalRealisasi: number;
  persenRealisasi: number;
  lastUpdated?: string | null;
  assetTrends?: { name: string; Vehicles: number; Equipment: number; Inventory: number }[];
  maintenanceForecast?: {
    avgMonthlyCost: number;
    sixMonthTotal: number;
    forecastData: { name: string; PredictedCost: number }[];
  };
}
