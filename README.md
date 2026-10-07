# Aceh Mandiri Utama POS · versi 2.0.0

Aplikasi web sparepart dan bengkel Yamaha untuk Aceh Mandiri Utama.
Data tersimpan di **Cloud Firestore** (realtime, dipakai beberapa komputer sekaligus), login memakai **Firebase Authentication**.

## Alur kerja per peran

| Peran | Menu | Tugas |
|---|---|---|
| **Registrasi** | Registrasi Servis, Master Data (pemilik & kendaraan) | Motor masuk: data konsumen & kendaraan, keluhan, jenis servis (Reguler / **KSB** / **KSG ke-1..4**), jasa, pilih mekanik yang kosong |
| **Sparepart** | Order Sparepart, Stok Part, Pembelian Stok | Isi order sparepart untuk motor yang sudah diregistrasi sesuai permintaan mekanik; catat pembelian dari supplier |
| **Mekanik** | Performa Mekanik | Mulai / tandai selesai pekerjaan; lihat jumlah motor, nilai jasa, komisi, estimasi gaji |
| **Kasir** | Pembayaran Servis, Penjualan Sparepart, Laporan | Cek jasa + sparepart, tambah biaya lain, diskon, terima pembayaran, cetak nota; jual part langsung |
| **Admin / Pemilik** | Semua menu | Termasuk Master Data: jasa & harga, mekanik (gaji, komisi), tipe motor, petugas login |

Status work order: **Antri** (registrasi) → **Dikerjakan** → **Selesai** (mekanik) → **Lunas** (kasir). Stok sparepart dipotong saat kasir menerima pembayaran.

**KSG (Kartu Service Gratis):** jasa tidak ditagih ke konsumen; nilainya tercatat sebagai *klaim KSG* (laporan & nilai jasa mekanik). Sparepart dan biaya lain tetap ditagih.
**KSB (Kartu Service Berkala):** servis berkala berbayar, nomor kartu dicatat di WO dan nota.

## Pembelian stok

Menu **Pembelian Stok** → *Invoice baru*: tanggal invoice, no. invoice, supplier, status bayar (lunas / belum lunas + jatuh tempo), total di invoice, lalu daftar barang (part, qty, harga beli).

1. **Simpan draft** bisa dilakukan kapan saja.
2. **Preview & terima barang** menampilkan semua barang, total pembelian, selisih dengan total invoice, stok sebelum → sesudah, dan harga beli rata-rata baru. Barang baru masuk stok setelah dicentang "sudah dicek fisik".
3. Invoice belum lunas tampil sebagai **hutang ke supplier** (merah jika lewat jatuh tempo). Tandai lunas kapan pun.

Harga beli part diperbarui dengan rata-rata tertimbang (stok lama × harga lama + qty baru × harga baru).

## Struktur folder

```
index.html            halaman utama (sidebar + konten)
style.css             tampilan
firestore.rules       aturan keamanan per peran (tempel di Firebase Console)
js/
  main.js             titik masuk: login & peran, sidebar, sinkron data, shortcut F1/F2/F8
  config.js           nama aplikasi, VERSI, peran & menu per peran, data awal
  firebase-config.js  konfigurasi project bengkel-amu
  firebase.js         inisialisasi Firebase + pembuatan akun petugas
  state.js            data bersama & navigasi
  util.js             format rupiah/tanggal, toast, modal
  numbering.js        nomor nota PJ/SV, pembelian PB, work order WO
  stats.js            perhitungan omzet, klaim KSG, laba
  wo-common.js        fungsi bersama work order
  nota.js             tampilan & cetak nota
  beranda.js          Beranda
  registrasi.js       Registrasi Servis
  order.js            Order Sparepart
  bayar.js            Pembayaran Servis
  mekanik.js          Performa Mekanik
  kasir.js            Penjualan Sparepart
  stok.js             Stok Part
  pembelian.js        Pembelian Stok
  laporan.js          Laporan Penjualan
  master.js           Master Data
  import-excel.js     import/export Excel
  excel-parser.js     pembaca kolom Excel (DMS Yamaha / template)
  seed.js             20 part contoh
```

## Update dari versi 1.x

1. Di repository GitHub, **hapus `js/servis.js`** (sudah diganti registrasi/order/bayar/mekanik).
2. Upload semua file baru (`index.html`, `style.css`, `firestore.rules`, folder `js`).
3. **Wajib:** Firebase Console → Firestore → Rules → tempel isi `firestore.rules` yang baru → *Publish*.
4. Login sebagai admin. Data awal jasa, mekanik, dan tipe motor dibuat otomatis; ubah di **Master Data**.
5. Tambah petugas lain di **Master Data → Petugas Login** (akun login dibuat otomatis). Untuk peran Mekanik, data mekaniknya ikut terhubung lewat email.

Data lama (nota, work order) tetap terbaca.

## Setup Firebase (project baru)

1. Firestore Database → *Create database* → lokasi `asia-southeast2 (Jakarta)` → mode *production*.
2. Firestore → Rules → tempel `firestore.rules` → *Publish*.
3. Authentication → Sign-in method → aktifkan **Email/Password**.
4. Buat akun admin pertama di Authentication → Users.
5. Firestore → koleksi `staff` → Document ID = email admin → field `nama` dan `peran` = `admin`.
6. Authentication → Settings → Authorized domains → tambah `USERNAME.github.io`.

## Import data part dari Excel

**Stok Part → Import Excel**. Format dikenali otomatis: ekspor stok DMS Yamaha (`Parts`, `On Hand Qty`, `Average Cost`, `Retail Price`, `Product Category`, `Superseding Parts`, `ABC Category`) atau template toko (`kode, nama, kategori, cocok, rak, harga_beli, harga_jual, stok, stok_min`). Import ulang hanya menulis part yang berubah.

## Laporan penjualan

Periode: hari ini, 7 hari, bulan ini, bulan lalu, atau pilih tanggal. Klik kotak angka (part, jasa, klaim KSG), part terlaris, mekanik, atau kasir untuk menyaring daftar transaksi; klik transaksi untuk melihat nota. Hasil saringan bisa di-export ke Excel.

## Menyesuaikan

- Nama aplikasi & nomor versi: `js/config.js` (`APP_NAME`, `APP_VERSION`).
- Menu per peran: `MENUS` di `js/config.js`.
- Jasa, harga, mekanik, gaji, komisi, tipe motor: langsung di aplikasi (Master Data).

## Kuota paket gratis (Spark)

50.000 baca dan 20.000 tulis per hari. Cache lokal browser sudah aktif. Jika muncul "Kuota harian Firebase habis", pertimbangkan paket Blaze dan pasang batas anggaran di Google Cloud Billing.

## Keamanan

`apiKey` di `js/firebase-config.js` memang publik; data dilindungi `firestore.rules` (akses per peran) + koleksi `staff`.
