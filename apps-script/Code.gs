/**************************************************************************************************
 * SIKANDA — BACKEND GOOGLE APPS SCRIPT
 * Sistem Informasi Kepegawaian dan Pengelolaan Aset Daerah
 * --------------------------------------------------------------------------------------------
 * Fungsi backend ini menjadi satu-satunya jalur TULIS ke Spreadsheet. Tujuannya:
 *   1. Aman multi-user      → LockService memberi kunci (mutex) agar submit bersamaan tidak bentrok.
 *   2. Anti kehilangan data → saat update, sel yang tidak diedit DIPERTAHANKAN (tidak dikosongkan).
 *   3. Upload foto gratis   → foto disimpan ke Google Drive, URL dicatat ke sheet + 'attachments'.
 *   4. Notifikasi otomatis  → trigger harian mengirim email Buku Penjagaan (KGB / Pangkat / BUP).
 *
 * CARA PASANG ada di apps-script/README_DEPLOY.md
 **************************************************************************************************/

// ====== KONFIGURASI (WAJIB DISESUAIKAN) =========================================================
var SPREADSHEET_ID = '19EllcHpSDAANnoXcTCYI8LIR9TE7b_e_Cst0KMgveO0';

// Token rahasia bersama frontend. GANTI menjadi string acak panjang Anda sendiri,
// dan salin nilai yang SAMA ke src/appsScriptConfig.ts (field SECRET).
var SHARED_SECRET = 'GANTI_DENGAN_TOKEN_RAHASIA_ANDA';

// Nama folder Drive untuk menyimpan foto pegawai (otomatis dibuat bila belum ada).
var DRIVE_FOLDER_NAME = 'SIKANDA_Foto_Pegawai';

var SHEET_PEGAWAI = 'pegawai';
var SHEET_CONFIG = 'system_config';
var SHEET_ATTACH = 'attachments';

// ====== AUTENTIKASI & RBAC (TAHAP 3) ===========================================================
// Sheet gerbang akses (DIBUAT OTOMATIS bila belum ada). TIDAK menyentuh sheet
// lama users/roles/menus (artefak migrasi SIMOSDA). Kolom:
//   email | role | nip | nama | is_active | created_by | created_at | last_login
var SHEET_ACCESS = 'app_access';

// API key web Firebase (publik) — dipakai memverifikasi idToken via Identity Toolkit.
// Samakan dengan konfigurasi di src/lib/firebase.ts.
var FIREBASE_API_KEY = 'AIzaSyD6TphBtHCEIBDN0UHB_8D2JpFZ09wmsr4';

// Email admin pertama (BOOTSTRAP). WAJIB DIISI Dwi agar admin pasti bisa masuk
// pertama kali walau sheet app_access masih kosong. Contoh: 'nama@gmail.com'.
var BOOTSTRAP_ADMIN_EMAIL = '';

// JENDELA TRANSISI: bila true, backend masih menerima `secret` lama SELAIN idToken.
// Setelah jalur Google Sign-In terbukti, ubah ke false dan hapus SECRET dari
// src/appsScriptConfig.ts agar lubang ditutup (baca publik tetap via GViz = Tahap 3-Lanjut).
var ALLOW_LEGACY_SECRET = true;

// Field profil yang BOLEH diubah pegawai pada BARIS MILIKNYA (cermin rbac.ts).
var EDITABLE_OWN = ['foto', 'kontak', 'email', 'tingkat', 'pendidikan_jurusan',
                    'universitas', 'tahun_lulus', 'riwayat_diklat', 'tahun_diklat'];

// ====== ROUTER HTTP =============================================================================
function doGet(e) {
  // Health-check sederhana.
  return _json({ ok: true, service: 'SIKANDA', time: new Date().toISOString() });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return _json({ ok: false, error: 'Body bukan JSON yang valid.' });
  }

  // --- AUTENTIKASI (idToken Firebase, atau secret lama saat transisi) ---
  var actor;
  try {
    actor = authenticate_(body); // { email, role, nip, nama }  atau throw
  } catch (err) {
    return _json({ ok: false, error: String(err && err.message ? err.message : err) });
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return _json({ ok: false, error: 'Server sibuk, silakan coba lagi sebentar.' });
  }

  try {
    switch (body.action) {
      case 'ping':
        return _json({ ok: true, pong: true, who: actor.email, role: actor.role });

      case 'whoami':
        return _json({ ok: true, email: actor.email, role: actor.role, nip: actor.nip || '', nama: actor.nama || '' });

      // --- Pegawai ---
      case 'pegawai_save':
        return _json(savePegawai_(guardPegawaiSave_(actor, body), !!body.isNew));
      case 'pegawai_delete':
        requireManage_(actor);
        return _json(deletePegawai_(String(body.nip || '')));
      case 'upload_foto':
        guardUploadFoto_(actor, body);
        return _json(uploadFoto_(body));

      // --- Konfigurasi ---
      case 'get_config':
        return _json({ ok: true, config: getConfig_() });
      case 'set_config':
        requireManage_(actor);
        return _json(setConfig_(String(body.key || ''), String(body.value || '')));
      case 'notifikasi_run':
        requireManage_(actor);
        return _json(kirimNotifikasiBukuPenjagaan());

      // --- Kelola Akun (admin saja) ---
      case 'user_list':
        requireAdmin_(actor);
        return _json(userList_());
      case 'user_save':
        requireAdmin_(actor);
        return _json(userSave_(actor, body.data || {}, !!body.isNew));
      case 'user_delete':
        requireAdmin_(actor);
        return _json(userDelete_(String(body.email || '')));
      case 'user_seed_from_pegawai':
        requireAdmin_(actor);
        return _json(userSeedFromPegawai_(actor));

      default:
        return _json({ ok: false, error: 'Action tidak dikenal: ' + body.action });
    }
  } catch (err) {
    return _json({ ok: false, error: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

// ====== AUTENTIKASI: idToken Firebase / secret transisi =========================================
function authenticate_(body) {
  // 1) Jalur utama: idToken Firebase.
  if (body.idToken) {
    var info = verifyFirebaseToken_(String(body.idToken));
    if (!info || !info.email) throw new Error('Token tidak valid atau kedaluwarsa. Silakan masuk ulang.');
    if (info.email_verified === false) throw new Error('Email Google Anda belum terverifikasi.');
    return resolveAccess_(String(info.email).toLowerCase().trim());
  }
  // 2) Jalur transisi: secret lama → diperlakukan sebagai admin (sementara).
  if (ALLOW_LEGACY_SECRET && body.secret && body.secret === SHARED_SECRET) {
    return { email: '(legacy-secret)', role: 'admin', nip: '', nama: 'Akses Secret (transisi)' };
  }
  throw new Error('Autentikasi gagal: idToken/secret tidak valid.');
}

// Verifikasi idToken via Identity Toolkit accounts:lookup (tanpa kripto manual).
// Google menolak token tak valid/kedaluwarsa dengan kode non-200.
function verifyFirebaseToken_(idToken) {
  var url = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(FIREBASE_API_KEY);
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify({ idToken: idToken }),
    muteHttpExceptions: true
  });
  if (resp.getResponseCode() !== 200) return null;
  var data;
  try { data = JSON.parse(resp.getContentText()); } catch (e) { return null; }
  if (!data || !data.users || !data.users.length) return null;
  var u = data.users[0];
  return { email: u.email, email_verified: (u.emailVerified === true) };
}

// Cocokkan email → peran via sheet app_access (+ BOOTSTRAP_ADMIN_EMAIL).
function resolveAccess_(email) {
  email = String(email).toLowerCase().trim();
  if (BOOTSTRAP_ADMIN_EMAIL && email === String(BOOTSTRAP_ADMIN_EMAIL).toLowerCase().trim()) {
    return { email: email, role: 'admin', nip: '', nama: 'Bootstrap Admin' };
  }
  var sheet = ensureAccessSheet_();
  var values = sheet.getDataRange().getValues();
  var h = values[0].map(_normKey);
  var cEmail = h.indexOf('email'), cRole = h.indexOf('role'), cNip = h.indexOf('nip'),
      cNama = h.indexOf('nama'), cActive = h.indexOf('is_active'), cLast = h.indexOf('last_login');
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][cEmail] || '').toLowerCase().trim() === email) {
      var active = String(values[r][cActive]).toUpperCase() !== 'FALSE';
      if (!active) throw new Error('Akun Anda dinonaktifkan. Hubungi admin.');
      var role = String(values[r][cRole] || 'pegawai').toLowerCase().trim();
      if (['admin', 'pimpinan', 'pegawai'].indexOf(role) === -1) role = 'pegawai';
      if (cLast !== -1) sheet.getRange(r + 1, cLast + 1).setValue(new Date());
      return { email: email, role: role, nip: String(values[r][cNip] || '').trim(), nama: String(values[r][cNama] || '').trim() };
    }
  }
  throw new Error('Akun belum terdaftar. Hubungi admin untuk didaftarkan terlebih dahulu.');
}

// Buat sheet app_access bila belum ada; pastikan kolom NIP berformat TEKS.
function ensureAccessSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_ACCESS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_ACCESS);
    sheet.appendRow(['email', 'role', 'nip', 'nama', 'is_active', 'created_by', 'created_at', 'last_login']);
  }
  // Kolom NIP = kolom ke-3 (urutan header tetap). Paksa teks agar 18 digit tak rusak.
  try { sheet.getRange(1, 3, sheet.getMaxRows(), 1).setNumberFormat('@'); } catch (e) {}
  return sheet;
}

// --- Guard peran ---
function isManager_(a) { return a && (a.role === 'admin' || a.role === 'pimpinan'); }
function requireManage_(a) { if (!isManager_(a)) throw new Error('Akses ditolak: butuh peran admin/pimpinan.'); }
function requireAdmin_(a) { if (!a || a.role !== 'admin') throw new Error('Akses ditolak: khusus admin.'); }

// Penegakan simpan pegawai: admin/pimpinan bebas; pegawai hanya baris sendiri &
// field terbatas (field terlarang DIBUANG di server — pertahanan berlapis).
function guardPegawaiSave_(actor, body) {
  var data = body && body.data ? body.data : {};
  if (isManager_(actor)) return data;
  if (actor.role === 'pegawai') {
    if (body.isNew) throw new Error('Pegawai tidak boleh menambah data baru.');
    var targetNip = String(data.nip || '').trim();
    var ownNip = String(actor.nip || '').trim();
    if (!ownNip || targetNip !== ownNip) throw new Error('Anda hanya boleh mengubah data diri sendiri.');
    var clean = { nip: ownNip };
    for (var i = 0; i < EDITABLE_OWN.length; i++) {
      var f = EDITABLE_OWN[i];
      if (Object.prototype.hasOwnProperty.call(data, f)) clean[f] = data[f];
    }
    return clean;
  }
  throw new Error('Akses ditolak.');
}

// Upload foto: pegawai hanya untuk NIP sendiri; admin/pimpinan bebas.
function guardUploadFoto_(actor, body) {
  if (isManager_(actor)) return;
  if (actor.role === 'pegawai') {
    if (String(body.nip || '').trim() !== String(actor.nip || '').trim())
      throw new Error('Anda hanya boleh mengubah foto diri sendiri.');
    return;
  }
  throw new Error('Akses ditolak.');
}

// ====== KELOLA AKUN (app_access) ===============================================================
function userList_() {
  var sheet = ensureAccessSheet_();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return { ok: true, users: [] };
  var h = values[0].map(_normKey);
  var cEmail = h.indexOf('email'), cRole = h.indexOf('role'), cNip = h.indexOf('nip'),
      cNama = h.indexOf('nama'), cActive = h.indexOf('is_active');
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var email = String(values[r][cEmail] || '').toLowerCase().trim();
    var nip   = cNip   !== -1 ? String(values[r][cNip]  || '').trim() : '';
    // Sertakan baris bila ada email ATAU ada NIP (pegawai tanpa email masih perlu ditampilkan
    // di Kelola Akun agar admin bisa melengkapi emailnya lalu mengaktifkan).
    if (!email && !nip) continue;
    out.push({
      email: email,
      role: String(values[r][cRole] || 'pegawai').toLowerCase().trim(),
      nip: nip,
      nama: cNama !== -1 ? String(values[r][cNama] || '').trim() : '',
      is_active: String(values[r][cActive]).toUpperCase() !== 'FALSE'
    });
  }
  return { ok: true, users: out };
}

function userSave_(actor, data, isNew) {
  var email = String(data.email || '').toLowerCase().trim();
  var nip   = String(data.nip   || '').trim();
  var role  = String(data.role  || 'pegawai').toLowerCase().trim();

  // Validasi email wajib ada kecuali saat create oleh seed (tidak mungkin terjadi dari UI).
  if (!email || email.indexOf('@') === -1) throw new Error('Email Google yang valid wajib diisi.');
  if (['admin', 'pimpinan', 'pegawai'].indexOf(role) === -1) throw new Error('Peran tidak valid.');
  if (role === 'pegawai' && !nip) throw new Error('NIP wajib diisi untuk peran pegawai.');

  var sheet = ensureAccessSheet_();
  var values = sheet.getDataRange().getValues();
  var h = values[0].map(_normKey);
  var cEmail = h.indexOf('email'), cNip2 = h.indexOf('nip');
  var activeStr = (data.is_active === false) ? 'FALSE' : 'TRUE';

  // Cari baris yang cocok: utamakan kecocokan email, lalu NIP (untuk baris tanpa email dari seed).
  var rowIndex = -1;
  for (var r = 1; r < values.length; r++) {
    var rowEmail = String(values[r][cEmail] || '').toLowerCase().trim();
    if (rowEmail && rowEmail === email) { rowIndex = r; break; }
  }
  if (rowIndex === -1 && nip && cNip2 !== -1) {
    for (var r2 = 1; r2 < values.length; r2++) {
      if (String(values[r2][cNip2] || '').trim() === nip) { rowIndex = r2; break; }
    }
  }

  if (rowIndex === -1) {
    // Baris baru (Tambah Akun manual dari UI).
    var row = [];
    for (var i = 0; i < values[0].length; i++) row.push('');
    setCell_(row, h, 'email', email);
    setCell_(row, h, 'role', role);
    setCell_(row, h, 'nip', nip);
    setCell_(row, h, 'nama', String(data.nama || ''));
    setCell_(row, h, 'is_active', activeStr);
    setCell_(row, h, 'created_by', actor.email);
    setCell_(row, h, 'created_at', new Date());
    sheet.appendRow(row);
    var last = sheet.getLastRow();
    if (cNip2 !== -1) sheet.getRange(last, cNip2 + 1).setNumberFormat('@').setValue(nip);
    return { ok: true, mode: 'create', email: email };
  }

  // Update baris yang ada (termasuk melengkapi email pada baris hasil seed).
  setCellAt_(sheet, h, rowIndex, 'email', email);
  setCellAt_(sheet, h, rowIndex, 'role', role);
  if (cNip2 !== -1) sheet.getRange(rowIndex + 1, cNip2 + 1).setNumberFormat('@').setValue(nip);
  setCellAt_(sheet, h, rowIndex, 'nama', String(data.nama || ''));
  if (data.is_active !== undefined) setCellAt_(sheet, h, rowIndex, 'is_active', activeStr);
  return { ok: true, mode: 'update', email: email };
}

function userDelete_(email) {
  email = String(email).toLowerCase().trim();
  if (!email) throw new Error('Email wajib diisi.');
  var sheet = ensureAccessSheet_();
  var values = sheet.getDataRange().getValues();
  var h = values[0].map(_normKey);
  var cEmail = h.indexOf('email'), cActive = h.indexOf('is_active');
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][cEmail] || '').toLowerCase().trim() === email) {
      sheet.getRange(r + 1, cActive + 1).setValue('FALSE');
      return { ok: true, email: email };
    }
  }
  throw new Error('Akun tidak ditemukan.');
}

// Tarik pegawai aktif ber-NIP dari sheet pegawai → buat baris akun peran 'pegawai'.
// Email dari kolom EMAIL pegawai bila ada & bukan placeholder; bila kosong →
// akun dibuat is_active=FALSE agar admin lengkapi email lalu aktifkan.
function userSeedFromPegawai_(actor) {
  var pe = _sheet(SHEET_PEGAWAI);
  var pv = pe.getDataRange().getValues();
  var ph = pv[0].map(_normKey);
  var cNip = ph.indexOf('nip'), cNama = ph.indexOf('nama_pegawai'),
      cEmailP = ph.indexOf('email'), cActiveP = ph.indexOf('is_active');

  var sheet = ensureAccessSheet_();
  var av = sheet.getDataRange().getValues();
  var ah = av[0].map(_normKey);
  var cEmailA = ah.indexOf('email'), cNipA = ah.indexOf('nip');

  var existNip = {}, existEmail = {};
  for (var r = 1; r < av.length; r++) {
    var en = String(av[r][cNipA] || '').trim(); if (en) existNip[en] = 1;
    var ee = String(av[r][cEmailA] || '').toLowerCase().trim(); if (ee) existEmail[ee] = 1;
  }

  var rows = [], added = 0;
  for (var i = 1; i < pv.length; i++) {
    var nip = String(pv[i][cNip] || '').trim();
    if (!nip) continue;
    if (cActiveP !== -1 && String(pv[i][cActiveP]).toUpperCase() === 'FALSE') continue;
    if (existNip[nip]) continue;

    var nama = String(pv[i][cNama] || '').trim();
    var emailP = cEmailP !== -1 ? String(pv[i][cEmailP] || '').toLowerCase().trim() : '';
    if (emailP === 'simosdatangsel@gmail.com') emailP = ''; // placeholder generik → abaikan
    if (emailP && existEmail[emailP]) emailP = '';          // email sudah dipakai → kosongkan

    var row = [];
    for (var k = 0; k < av[0].length; k++) row.push('');
    setCell_(row, ah, 'email', emailP);
    setCell_(row, ah, 'role', 'pegawai');
    setCell_(row, ah, 'nip', nip);
    setCell_(row, ah, 'nama', nama);
    setCell_(row, ah, 'is_active', emailP ? 'TRUE' : 'FALSE');
    setCell_(row, ah, 'created_by', actor.email);
    setCell_(row, ah, 'created_at', new Date());
    rows.push(row);
    existNip[nip] = 1; if (emailP) existEmail[emailP] = 1;
    added++;
  }

  if (rows.length) {
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, av[0].length).setValues(rows);
    if (cNipA !== -1) sheet.getRange(startRow, cNipA + 1, rows.length, 1).setNumberFormat('@');
  }
  return { ok: true, added: added, note: 'Baris pegawai tanpa email dibuat NONAKTIF — lengkapi email lalu aktifkan.' };
}

function setCell_(row, h, key, val) { var c = h.indexOf(key); if (c !== -1) row[c] = val; }
function setCellAt_(sheet, h, rowIndex, key, val) { var c = h.indexOf(key); if (c !== -1) sheet.getRange(rowIndex + 1, c + 1).setValue(val); }

// ====== PEGAWAI: SIMPAN (CREATE / UPDATE) ======================================================
// Pemetaan: key dari frontend  →  nama kolom (sudah dinormalkan) di sheet 'pegawai'.
var FIELD_MAP = {
  nama: 'nama_pegawai',
  nip: 'nip',
  golongan: 'golongan',
  tgl_mulai_golongan: 'terhitung_mulai_tanggal_golongan',
  jabatan: 'jabatan',
  tgl_mulai_jabatan: 'terhitung_mulai_tanggal_jabatan',
  masa_kerja_tahun: 'masa_kerja_tahun',
  masa_kerja_bulan: 'masa_kerja_bulan',
  riwayat_diklat: 'riwayat_diklat',
  tahun_diklat: 'tahun_diklat',
  pendidikan_jurusan: 'pendidikan_jurusan',
  tahun_lulus: 'tahun_lulus',
  tingkat: 'tingkat',
  universitas: 'universitas',
  tgl_lahir: 'tanggal_lahir',
  usia: 'usia',
  status: 'status',
  catatan_mutasi_masuk: 'catatan_mutasi_masuk',
  catatan_mutasi_keluar: 'catatan_mutasi_keluar',
  kontak: 'kontak',
  foto: 'foto',
  email: 'email',
  keterangan: 'keterangan'
};

// Kolom yang isinya tanggal → disimpan dalam format Indonesia "DD-MM-YYYY".
var DATE_KEYS = { tgl_mulai_golongan: 1, tgl_mulai_jabatan: 1, tgl_lahir: 1 };

function savePegawai_(data, isNew) {
  if (!data || !data.nip) throw new Error('NIP wajib diisi.');
  var sheet = _sheet(SHEET_PEGAWAI);
  var values = sheet.getDataRange().getValues();
  var header = values[0];
  var headerNorm = header.map(_normKey);

  var nipCol = headerNorm.indexOf('nip');
  if (nipCol === -1) throw new Error('Kolom NIP tidak ditemukan di sheet pegawai.');

  var targetNip = String(data.nip).trim();

  if (isNew) {
    // Cegah duplikat NIP.
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][nipCol]).trim() === targetNip) {
        throw new Error('NIP ' + targetNip + ' sudah terdaftar.');
      }
    }
    var newRow = [];
    for (var c = 0; c < header.length; c++) newRow.push('');
    _applyFields(newRow, headerNorm, data);
    sheet.appendRow(newRow);
    _forceTextRow(sheet, sheet.getLastRow(), header.length);
    return { ok: true, mode: 'create', nip: targetNip };
  }

  // UPDATE: cari baris by NIP, lalu pertahankan sel yang tidak diedit.
  var rowIndex = -1;
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][nipCol]).trim() === targetNip) { rowIndex = r; break; }
  }
  if (rowIndex === -1) throw new Error('Pegawai dengan NIP ' + targetNip + ' tidak ditemukan.');

  var rowData = values[rowIndex].slice(); // salin isi lama → kolom tak-terpetakan tetap utuh
  _applyFields(rowData, headerNorm, data);
  sheet.getRange(rowIndex + 1, 1, 1, header.length).setValues([rowData]);
  _forceTextRow(sheet, rowIndex + 1, header.length);
  return { ok: true, mode: 'update', nip: targetNip };
}

function _applyFields(row, headerNorm, data) {
  for (var key in FIELD_MAP) {
    if (!Object.prototype.hasOwnProperty.call(data, key)) continue;
    var col = headerNorm.indexOf(FIELD_MAP[key]);
    if (col === -1) continue; // kolom tidak ada di sheet → lewati, jangan paksakan
    var val = data[key];
    if (val === undefined || val === null) val = '';
    if (DATE_KEYS[key] && val !== '') val = toStorageDate_(val);
    row[col] = val;
  }
}

// Paksa baris menjadi format TEKS agar NIP 18 digit & tanggal tidak diubah Sheets.
function _forceTextRow(sheet, rowNum, ncol) {
  sheet.getRange(rowNum, 1, 1, ncol).setNumberFormat('@');
}

// ====== PEGAWAI: SOFT DELETE ====================================================================
function deletePegawai_(nip) {
  if (!nip) throw new Error('NIP wajib diisi.');
  var sheet = _sheet(SHEET_PEGAWAI);
  var values = sheet.getDataRange().getValues();
  var header = values[0];
  var headerNorm = header.map(_normKey);
  var nipCol = headerNorm.indexOf('nip');

  var activeCol = headerNorm.indexOf('is_active');
  if (activeCol === -1) {
    // Buat kolom is_active bila belum ada; baris lama dianggap TRUE.
    activeCol = header.length;
    sheet.getRange(1, activeCol + 1).setValue('is_active');
    if (values.length > 1) {
      var fill = [];
      for (var k = 1; k < values.length; k++) fill.push(['TRUE']);
      sheet.getRange(2, activeCol + 1, fill.length, 1).setValues(fill);
    }
  }

  var target = String(nip).trim();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][nipCol]).trim() === target) {
      sheet.getRange(r + 1, activeCol + 1).setValue('FALSE');
      return { ok: true, nip: target };
    }
  }
  throw new Error('Pegawai dengan NIP ' + target + ' tidak ditemukan.');
}

// ====== UPLOAD FOTO → GOOGLE DRIVE ==============================================================
function uploadFoto_(body) {
  var nip = String(body.nip || '').trim();
  var base64 = String(body.base64 || '');
  var mimeType = String(body.mimeType || 'image/jpeg');
  var fileName = String(body.fileName || ('foto_' + nip + '.jpg'));
  if (!base64) throw new Error('Data foto kosong.');

  var folder = _getFolder(DRIVE_FOLDER_NAME);
  var bytes = Utilities.base64Decode(base64);
  var blob = Utilities.newBlob(bytes, mimeType, fileName);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var fileId = file.getId();
  var viewUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w400';

  // Tulis URL ke kolom FOTO pegawai (bila NIP diberikan).
  if (nip) {
    try { _setPegawaiFoto(nip, file.getUrl()); } catch (e) {}
    try { _appendAttachment(nip, file, mimeType); } catch (e) {}
  }
  return { ok: true, fileId: fileId, url: file.getUrl(), viewUrl: viewUrl };
}

function _setPegawaiFoto(nip, url) {
  var sheet = _sheet(SHEET_PEGAWAI);
  var values = sheet.getDataRange().getValues();
  var headerNorm = values[0].map(_normKey);
  var nipCol = headerNorm.indexOf('nip');
  var fotoCol = headerNorm.indexOf('foto');
  if (fotoCol === -1) return;
  var target = String(nip).trim();
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][nipCol]).trim() === target) {
      sheet.getRange(r + 1, fotoCol + 1).setValue(url);
      return;
    }
  }
}

function _appendAttachment(nip, file, mimeType) {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_ATTACH);
  if (!sheet) return;
  var headerNorm = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(_normKey);
  var row = [];
  for (var i = 0; i < headerNorm.length; i++) row.push('');
  var put = function (key, val) { var c = headerNorm.indexOf(key); if (c !== -1) row[c] = val; };
  put('attachment_id', 'ATT-' + new Date().getTime());
  put('module_name', 'pegawai');
  put('record_id', nip);
  put('field_name', 'foto');
  put('file_name', file.getName());
  put('mime_type', mimeType);
  put('drive_file_id', file.getId());
  put('file_url', file.getUrl());
  sheet.appendRow(row);
}

// ====== SYSTEM CONFIG ===========================================================================
function getConfig_() {
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_CONFIG);
  var out = {};
  if (!sheet) return out;
  var values = sheet.getDataRange().getValues();
  var headerNorm = values[0].map(_normKey);
  var kCol = headerNorm.indexOf('config_key');
  var vCol = headerNorm.indexOf('config_value');
  for (var r = 1; r < values.length; r++) {
    var key = String(values[r][kCol] || '').trim();
    if (key) out[key] = values[r][vCol];
  }
  return out;
}

function setConfig_(key, value) {
  if (!key) throw new Error('config_key wajib diisi.');
  var sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_CONFIG);
  if (!sheet) throw new Error('Sheet system_config tidak ditemukan.');
  var values = sheet.getDataRange().getValues();
  var headerNorm = values[0].map(_normKey);
  var kCol = headerNorm.indexOf('config_key');
  var vCol = headerNorm.indexOf('config_value');
  var uCol = headerNorm.indexOf('updated_at');
  for (var r = 1; r < values.length; r++) {
    if (String(values[r][kCol]).trim() === key) {
      sheet.getRange(r + 1, vCol + 1).setValue(value);
      if (uCol !== -1) sheet.getRange(r + 1, uCol + 1).setValue(new Date());
      return { ok: true, key: key, value: value, mode: 'update' };
    }
  }
  // belum ada → tambah baris baru
  var row = [];
  for (var i = 0; i < values[0].length; i++) row.push('');
  row[kCol] = key; row[vCol] = value;
  if (uCol !== -1) row[uCol] = new Date();
  sheet.appendRow(row);
  return { ok: true, key: key, value: value, mode: 'create' };
}

function _getInt(cfg, key, def) {
  var v = parseInt(cfg[key], 10);
  return isNaN(v) ? def : v;
}

// ====== NOTIFIKASI BUKU PENJAGAAN (EMAIL OTOMATIS) =============================================
// Pasang sebagai TIME-DRIVEN TRIGGER harian (lihat README_DEPLOY.md).
function kirimNotifikasiBukuPenjagaan() {
  var cfg = getConfig_();
  var bup = _getInt(cfg, 'BUP_USIA', 58);
  var windowHari = _getInt(cfg, 'NOTIF_WINDOW_HARI', 180);
  var adminEmail = String(cfg['NOTIF_ADMIN_EMAIL'] || Session.getActiveUser().getEmail() || '').trim();

  var sheet = _sheet(SHEET_PEGAWAI);
  var values = sheet.getDataRange().getValues();
  var headerNorm = values[0].map(_normKey);
  var col = function (k) { return headerNorm.indexOf(k); };

  var cNama = col('nama_pegawai'), cNip = col('nip'), cGol = col('golongan'),
      cTmtGol = col('terhitung_mulai_tanggal_golongan'), cLahir = col('tanggal_lahir'),
      cStatus = col('status'), cEmail = col('email'), cAktif = col('is_active');

  var today = new Date(); today.setHours(0, 0, 0, 0);
  var batas = new Date(today.getTime() + windowHari * 24 * 3600 * 1000);

  var rekap = []; // untuk admin
  var personal = {}; // email → daftar event

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var nama = String(row[cNama] || '').trim();
    if (!nama) continue;
    if (cAktif !== -1 && String(row[cAktif]).toUpperCase() === 'FALSE') continue;
    if (cStatus !== -1 && String(row[cStatus]).toUpperCase() === 'PENSIUN') continue;

    var nip = String(row[cNip] || '').trim();
    var gol = cGol !== -1 ? String(row[cGol] || '').trim() : '';
    var tmtGol = cTmtGol !== -1 ? row[cTmtGol] : '';
    var lahir = cLahir !== -1 ? row[cLahir] : '';
    var email = cEmail !== -1 ? String(row[cEmail] || '').trim() : '';

    var events = [];
    var kgb = nextCycleDate_(tmtGol, 2);
    if (kgb && kgb >= today && kgb <= batas) events.push({ jenis: 'KGB (Kenaikan Gaji Berkala)', tanggal: kgb });

    var pangkat = nextCycleDate_(tmtGol, 4);
    if (pangkat && pangkat >= today && pangkat <= batas) events.push({ jenis: 'Kenaikan Pangkat', tanggal: pangkat });

    var pensiun = pensionDate_(lahir, bup);
    if (pensiun && pensiun >= today && pensiun <= batas) events.push({ jenis: 'Batas Usia Pensiun (BUP)', tanggal: pensiun });

    if (events.length === 0) continue;

    for (var i = 0; i < events.length; i++) {
      rekap.push({ nama: nama, nip: nip, gol: gol, jenis: events[i].jenis, tanggal: events[i].tanggal });
    }
    if (email && /@/.test(email)) {
      if (!personal[email]) personal[email] = { nama: nama, events: [] };
      personal[email].events = personal[email].events.concat(events);
    }
  }

  var terkirim = 0;

  // --- Pola B: email personal ke tiap pegawai ---
  for (var em in personal) {
    var p = personal[em];
    var rows = p.events.map(function (ev) {
      return '<tr><td style="padding:6px 10px;border:1px solid #e2e8f0">' + ev.jenis +
             '</td><td style="padding:6px 10px;border:1px solid #e2e8f0">' + fmtIndo_(ev.tanggal) + '</td></tr>';
    }).join('');
    var html =
      '<div style="font-family:Arial,sans-serif;color:#1e293b">' +
      '<h2 style="color:#0B57D0">SIKANDA — Pengingat Buku Penjagaan</h2>' +
      '<p>Yth. <b>' + p.nama + '</b>,</p>' +
      '<p>Berikut agenda kepegawaian Anda yang mendekati jatuh tempo:</p>' +
      '<table style="border-collapse:collapse;font-size:14px"><tr>' +
      '<th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left">Agenda</th>' +
      '<th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left">Perkiraan Tanggal</th></tr>' +
      rows + '</table>' +
      '<p style="margin-top:14px;font-size:12px;color:#64748b">Email otomatis dari SIKANDA. Mohon koordinasi dengan bagian kepegawaian untuk proses lebih lanjut.</p></div>';
    try {
      MailApp.sendEmail({ to: em, subject: 'SIKANDA — Pengingat Buku Penjagaan', htmlBody: html });
      terkirim++;
    } catch (e) {}
  }

  // --- Pola A: rekap ke admin ---
  if (adminEmail && rekap.length > 0) {
    rekap.sort(function (a, b) { return a.tanggal - b.tanggal; });
    var rows2 = rekap.map(function (it) {
      return '<tr><td style="padding:6px 10px;border:1px solid #e2e8f0">' + it.nama +
             '</td><td style="padding:6px 10px;border:1px solid #e2e8f0">' + it.nip +
             '</td><td style="padding:6px 10px;border:1px solid #e2e8f0">' + it.gol +
             '</td><td style="padding:6px 10px;border:1px solid #e2e8f0">' + it.jenis +
             '</td><td style="padding:6px 10px;border:1px solid #e2e8f0">' + fmtIndo_(it.tanggal) + '</td></tr>';
    }).join('');
    var htmlA =
      '<div style="font-family:Arial,sans-serif;color:#1e293b">' +
      '<h2 style="color:#0B57D0">SIKANDA — Rekap Buku Penjagaan</h2>' +
      '<p>Berikut ' + rekap.length + ' agenda kepegawaian yang mendekati jatuh tempo (' + windowHari + ' hari ke depan):</p>' +
      '<table style="border-collapse:collapse;font-size:13px"><tr>' +
      '<th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left">Nama</th>' +
      '<th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left">NIP</th>' +
      '<th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left">Gol</th>' +
      '<th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left">Agenda</th>' +
      '<th style="padding:6px 10px;border:1px solid #e2e8f0;background:#f1f5f9;text-align:left">Tanggal</th></tr>' +
      rows2 + '</table></div>';
    try {
      MailApp.sendEmail({ to: adminEmail, subject: 'SIKANDA — Rekap Buku Penjagaan (' + rekap.length + ' agenda)', htmlBody: htmlA });
      terkirim++;
    } catch (e) {}
  }

  return { ok: true, agenda: rekap.length, email_terkirim: terkirim };
}

// ====== HELPER TANGGAL (sinkron dengan src/lib/utils.ts) =======================================
var MONTHS_MAP_ = {
  JANUARI: 0, JANUARY: 0, JAN: 0, FEBRUARI: 1, FEBRUARY: 1, FEB: 1, PEBRUARI: 1,
  MARET: 2, MARCH: 2, MAR: 2, APRIL: 3, APR: 3, MEI: 4, MAY: 4, JUNI: 5, JUNE: 5, JUN: 5,
  JULI: 6, JULY: 6, JUL: 6, AGUSTUS: 7, AUGUST: 7, AGU: 7, AUG: 7, SEPTEMBER: 8, SEP: 8, SEPT: 8,
  OKTOBER: 9, OCTOBER: 9, OKT: 9, OCT: 9, NOVEMBER: 10, NOV: 10, NOPEMBER: 10,
  DESEMBER: 11, DECEMBER: 11, DES: 11, DEC: 11
};
var MONTHS_ID_ = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

function _mkDate(y, m, d) {
  if (isNaN(y) || isNaN(m) || isNaN(d) || y < 1900 || y > 2200 || m < 0 || m > 11 || d < 1 || d > 31) return null;
  var dt = new Date(y, m, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m || dt.getDate() !== d) return null;
  return dt;
}

function parseAnyDate_(input) {
  if (input === null || input === undefined || input === '') return null;
  if (Object.prototype.toString.call(input) === '[object Date]') return isNaN(input.getTime()) ? null : input;
  var raw = String(input).trim();
  if (!raw) return null;

  var parts = raw.toUpperCase().split(/[\s,]+/).filter(function (x) { return x; });
  if (parts.length >= 3 && MONTHS_MAP_[parts[1]] !== undefined) {
    var d1 = _mkDate(parseInt(parts[parts.length - 1], 10), MONTHS_MAP_[parts[1]], parseInt(parts[0], 10));
    if (d1) return d1;
  }
  var m = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) { var d2 = _mkDate(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10)); if (d2) return d2; }
  m = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (m) {
    var day = parseInt(m[1], 10), mon = parseInt(m[2], 10), year = parseInt(m[3], 10);
    if (m[3].length === 2) year += year >= 70 ? 1900 : 2000;
    if (mon > 12 && day <= 12) { var t = day; day = mon; mon = t; }
    var d3 = _mkDate(year, mon - 1, day); if (d3) return d3;
  }
  return null;
}

function toStorageDate_(input) {
  var d = parseAnyDate_(input);
  if (!d) return '';
  return ('0' + d.getDate()).slice(-2) + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + d.getFullYear();
}

function fmtIndo_(d) {
  if (!d) return '-';
  return d.getDate() + ' ' + MONTHS_ID_[d.getMonth()] + ' ' + d.getFullYear();
}

// Tanggal siklus berikutnya (KGB=2thn, Pangkat=4thn) dari TMT golongan, relatif hari ini.
function nextCycleDate_(startInput, cycleYears) {
  var start = parseAnyDate_(startInput);
  if (!start) return null;
  var today = new Date(); today.setHours(0, 0, 0, 0);
  var year = start.getFullYear(), month = start.getMonth(), day = start.getDate();
  if (today.getFullYear() > year) {
    year += Math.floor((today.getFullYear() - year) / cycleYears) * cycleYears;
  }
  var cand = new Date(year, month, day); cand.setHours(0, 0, 0, 0);
  while (cand < today) { year += cycleYears; cand = new Date(year, month, day); cand.setHours(0, 0, 0, 0); }
  return cand;
}

function pensionDate_(lahirInput, bup) {
  var b = parseAnyDate_(lahirInput);
  if (!b) return null;
  return new Date(b.getFullYear() + bup, b.getMonth(), b.getDate());
}

// ====== UTIL UMUM ===============================================================================
function _sheet(name) {
  var s = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!s) throw new Error('Sheet "' + name + '" tidak ditemukan.');
  return s;
}

function _normKey(key) {
  return String(key == null ? '' : key).toLowerCase().trim()
    .replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

function _getFolder(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
