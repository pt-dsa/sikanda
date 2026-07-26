# Roadmap dan Checklist Revisi SIKANDA

## 1\. Aturan Ketat SIKANDA

1. Setiap Seluruh Perubahan harus terupdate di local E:\\sikanda  
2. Setiap Seluruh Perubahan harus terupdate(push repository) github [https://github.com/pt-dsa/sikanda-app/actions](https://github.com/pt-dsa/sikanda-app/actions)  
3. Setiap Seluruh Perubahan harus terupdate di localhost.  
4. SIKANDA harus responsif pada semua device (mobile first).  
5. Setiap perubahan pada SIKANDA harus terupdate juga pada PWA.  
6. SIKANDA harus tetap memenuhi unsur Keamanan tingkat tinggi.  
7. SIKANDA harus lulus security testing.  
8. Seluruh teks Judul, Tittle,subtittle, Judul Header Tabel dan keterangan lainya dibuat tebal (bold).  
9. Judul Menu pada Panel SIKANDA seluruhnya dibuat tebal (bold).

## 2\. Revisi Menu Dashboard

- [ ] seluruh teks Judul, Tittle,subtittle dan keterangan lainya harus cetak tebal (bold). jangan ada yang terlewat seperti teks : Aparatur Sipil Negara, Pegawai memenuhi 9 kriteria dan yang lainnya.  
- [ ] Pastikan seluruh teks tidak ada yang tampil terpotong.lihat Card “pegawai dengan inventaris” teks keterangan detail nya terpotong.

## 3\. Revisi Menu Data ASN / PPPK

- [ ] Judul pada Header Tabel Pegawai belum terlihat Tebal (Bold). ganti jenis font seperti font pada judul Card.  
- [ ] pada fitur “hapus permanen” di menu peringatan, nama pegawai dibuat tebal (bold).

## 4\. Revisi Menu Buku Penjagaan

- [ ] Judul pada Header Tabel belum terlihat Tebal (Bold). ganti jenis font seperti font pada judul Card.  
- [ ] Tampilan tabel dibuat lebih proporsional sehingga terlihat lebih rapih.

## 5\. Revisi Menu Data Kendaraan

- [ ] Judul pada Header Tabel belum terlihat Tebal (Bold). ganti jenis font seperti font pada judul Card.  
- [ ] pada detail kendaraan dan Edit Kendaraan, belum tampil minimap menampilkan peta lokasi kendaraan. yang tampil sekarang hayang koordinat saja.

## 6\. Revisi Menu Inventaris

- [ ] Judul pada Header Tabel belum terlihat Tebal (Bold). ganti jenis font seperti font pada judul Card. atur posisi setiap kolom sehingga rapih dan proporsional.  
- [ ] Tambahkan “Pengguna” pada kolom di tabel.  
- [ ] pada detail Inventaris dan Edit Inventaris, belum tampil minimap menampilkan peta lokasi kendaraan. yang tampil sekarang hayang koordinat saja.  
- [ ] perbaiki URL link, dari “/alat-mesin” menjadi “/inventaris”. rubah juga pada URL link menu “Alat & Mesin”. (link url terturkar).

## 7\. Revisi Menu Rekap Laporan

- [ ] watermark logo SIKANDA terlihat terpotong-potong oleh border dari tabel hasil “Cetak Halaman” perbaiki dan rubah menjadi proporsional dan rapih.

## 8\. Revisi Menu Kelola Akun

- [ ] Tabel data pegawai, urutan seharusnya Nama Pegawai \- NIP \- Status Pegawai (ASN,PPPK dan yang lainnya) \- Jabatan \- Email \- Peran \- Status (siap registrasi dan yang lainnya) \- Aksi.  
- [ ] Judul pada Header Tabel belum terlihat tebal Tebal (Bold). ganti font seperti judul menu “Kelola akun”.  
- [ ] atur setiap kolom tabel menjadi proporsional dan rapih.

## 9\. Revisi Menu Data Cleansing

- [ ] Seluruh Data Cleansing dibuat dalam bentuk Tabel header tebal yang dapat di scroll dan clickable.  
- [ ] Bagian “Kondisi Aset Belum Diisi”, “Cleansing Pegawai” dan “Cleansing Nama Pengguna Aset” seharusnya muncul modal popup CRUD yang relevan dengan setiap case cleansing, tetapi menu tetap di Data Cleansing tidak berpindah ke menu Data Kendaraan. ini penting agar Administrator dan Pimpinan tidak perlu bolak-balik berpindah menu.   
- [ ] Tambahkan fitur pencairan pada setiap kategori cleansing.

