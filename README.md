# Aceh Mitra Utama POS

Aplikasi web kasir sparepart dan bengkel Yamaha untuk Aceh Mitra Utama.
Data tersimpan di **Cloud Firestore** (realtime, bisa dipakai beberapa kasir sekaligus) dan login petugas memakai **Firebase Authentication**.

Fitur: Beranda (omzet, antrian, stok menipis), Kasir Sparepart, Servis Bengkel (work order), Stok Part (import/export Excel, barang masuk), Laporan. Shortcut F1 Baru, F2 Simpan, F8 Cetak Nota.

## Struktur folder

```
index.html            halaman utama
style.css             tampilan
firestore.rules       aturan keamanan database (tempel di Firebase Console)
js/
  main.js             titik masuk: login, sinkron data, navigasi, shortcut F1/F2/F8
  firebase-config.js  konfigurasi project bengkel-amu
  firebase.js         inisialisasi Firebase (versi SDK diatur di sini)
  state.js            data bersama + pengaturan toko (jasa, mekanik, tipe motor)
  util.js             format rupiah/tanggal, toast, modal
  numbering.js        penomoran nota PJ/SV dan work order WO
  stats.js            perhitungan omzet & laba
  nota.js             tampilan & cetak nota
  beranda.js          menu Beranda
  kasir.js            menu Kasir Sparepart
  servis.js           menu Servis Bengkel
  stok.js             menu Stok Part
  laporan.js          menu Laporan
  import-excel.js     import/export Excel (tampilan)
  excel-parser.js     pembaca kolom Excel (DMS Yamaha / template)
  seed.js             20 part contoh
```

**Saat update dari versi sebelumnya:** hapus `app.js` dan `firebase-config.js` lama di root repository, lalu upload semua file di atas (termasuk folder `js`).

## Setup Firebase (sekali saja)

1. **Firestore**: Firebase Console → Firestore Database → *Create database* → lokasi `asia-southeast2 (Jakarta)` → mode *production*.
2. **Rules**: Firestore → tab *Rules* → tempel isi `firestore.rules` → *Publish*.
3. **Login**: Authentication → Sign-in method → aktifkan **Email/Password**.
4. **Akun petugas**: Authentication → Users → *Add user*.
5. **Daftarkan petugas**: Firestore → koleksi `staff` → Document ID = **email petugas persis** → field `nama` (string) dan `peran` (string: `admin`/`kasir`).
6. **Domain**: Authentication → Settings → Authorized domains → tambah `USERNAME.github.io`.

## Import data part dari Excel

Menu **Stok Part → Import Excel**, pilih file. Dua format dikenali otomatis:

- **Ekspor stok DMS Yamaha** (seperti `Data_parts.xlsx`): kolom `Parts` → kode, kolom tanpa judul di sebelahnya → nama, `On Hand Qty` → stok, `Average Cost` → harga beli, `Retail Price` → harga jual, `Product Category` → kategori, `Superseding Parts` → part pengganti, `ABC Category` → kelas ABC. Baris "Total:" otomatis dilewati.
- **Template toko** (tombol *Unduh template*): `kode, nama, kategori, cocok, rak, harga_beli, harga_jual, stok, stok_min`.

Sebelum disimpan muncul pratinjau: jumlah part baru, part lama yang berubah, dan yang tidak berubah. Untuk part yang sudah ada, pilih **perbarui** (stok, harga, nama, kategori ditimpa dari file; rak, cocok untuk, dan stok minimum yang sudah diatur tetap) atau **hanya tambah part baru**. Part yang tidak berubah tidak ditulis ulang, jadi import ulang file DMS setiap hari tetap hemat.

Stok minimum part baru dari DMS diisi otomatis dari kelas ABC (A=2, B=1, lainnya 0) dan bisa diubah per part.

**Export Excel** mengunduh seluruh stok dalam format template (bisa diedit lalu di-import kembali).

## Deploy ke GitHub Pages

Upload semua file ke repository (branch `main`, root) → Settings → Pages → *Deploy from a branch* → `main` / `(root)`.
Jangan buka `index.html` dengan klik dua kali (`file://`); modul JavaScript hanya jalan lewat alamat web. Untuk coba di komputer: `npx serve .`.

## Kuota paket gratis (Spark)

Batas harian: 50.000 baca dan 20.000 tulis dokumen.
- Import pertama 2.500 part ≈ 2.500 tulis. Import ulang hanya menulis part yang berubah.
- Setiap kali aplikasi dibuka, daftar part dibaca dari server. Cache lokal browser sudah diaktifkan supaya pembukaan berikutnya lebih hemat, tapi kalau toko memakai banyak komputer yang sering di-refresh dan muncul pesan "Kuota harian Firebase habis", pertimbangkan paket Blaze (bayar sesuai pemakaian di atas kuota gratis; hitung perkiraannya di halaman harga Firebase dan pasang batas anggaran di Google Cloud Billing).

## Struktur data Firestore

- `parts/{kode}`: kode, nama, kategori, cocok, rak, beli, jual, stok, min, pengganti, abc
- `trx/{no}`: nota penjualan (`PJ-yymmdd-001`) dan servis (`SV-yymmdd-001`)
- `wo/{no}`: work order bengkel (`WO-0001`)
- `masuk/{auto}`: riwayat barang masuk
- `imports/{auto}`: riwayat import Excel
- `meta/counter`: penomoran otomatis
- `staff/{email}`: petugas yang boleh login

## Menyesuaikan

Daftar jasa + harga, nama mekanik, tipe motor, dan kategori ada di bagian atas `js/state.js`.

## Keamanan

`apiKey` di `js/firebase-config.js` memang boleh terlihat publik; yang melindungi data adalah `firestore.rules` + koleksi `staff`.
