# Aceh Mandiri Utama POS · versi 2.3.1

Aplikasi web sparepart dan bengkel Yamaha untuk Aceh Mandiri Utama.
Data tersimpan di **Cloud Firestore** (realtime, dipakai beberapa komputer sekaligus), login memakai **Firebase Authentication**.

## Fitur baru 2.3.0

- **Alamat bertingkat**: Provinsi (default Aceh) → Kabupaten/Kota → Kecamatan → Kelurahan/Gampong + alamat jalan, di Registrasi dan Master Data → Pemilik & Kendaraan. Data wilayah resmi seluruh Indonesia ada di folder `wilayah/` (sumber: paket idn-area-data, lisensi MIT). Master kendaraan bisa **difilter per wilayah**, menampilkan **jumlah konsumen per wilayah**, dan **export Excel**.
- **Catatan waktu servis**: setiap perubahan status dicatat jamnya. Terlihat di Registrasi & Pembayaran (alur waktu), dan di **Performa Mekanik**: rata-rata/tercepat/terlama lama dikerjakan per mekanik, per tipe motor, dan semua mekanik. Waktu Ditunda tidak dihitung sebagai waktu kerja.
- **Nota PDF + watermark logo**: di jendela nota ada *Unduh PDF* dan *Kirim PDF via WA*. Di HP/tablet yang mendukung, PDF langsung dibagikan ke WhatsApp. Di komputer, PDF diunduh lalu WhatsApp terbuka berisi pesan + link cek servis; lampirkan PDF yang barusan diunduh (WhatsApp Web tidak mengizinkan lampiran otomatis).
- **Beranda bisa diklik**: Omzet hari ini (daftar nota), Part terjual (item part hari ini + stok kini), Motor masuk, Stok menipis.
- **Sinkron cek servis** (Master Data → Pemilik & Kendaraan, admin): membangun ulang data halaman cek servis dari work order & nota yang sudah ada, misalnya servis yang dicatat sebelum versi 2.3.0.
- **Halaman cek servis konsumen**: `cek.html` (link juga ada di halaman login dan di pesan WA). Konsumen memasukkan no. polisi + no. HP untuk melihat status servis (Diterima → Dikerjakan → Selesai → Diambil), estimasi biaya, dan riwayat servis + unduh nota PDF.

## Tampilan & kebiasaan input

- Halaman login dua sisi: **kiri logo toko**, **kanan form login**. Logo diganti oleh super admin di **Master Data → Logo** (tab ini hanya muncul untuk super admin).
- Tombol **Super admin** kecil di pojok kanan atas halaman login.
- Animasi loading dua roda gigi saat aplikasi dibuka dan saat memuat data.
- **Semua isian teks otomatis huruf kapital** (nopol, nama, keluhan, supplier, dll). Email, PIN, angka, dan tanggal tidak diubah.
- **No. HP konsumen** punya tombol **WA** untuk langsung chat WhatsApp (registrasi, order sparepart, pembayaran, master kendaraan). Di pembayaran ada tombol *Kabari konsumen* berisi pesan motor selesai + total biaya.

## Login

- **Super admin** (`cashflow.amu@gmail.com`): tombol *Masuk sebagai super admin* → email + kata sandi. Selalu punya akses penuh, tidak perlu dokumen di koleksi `staff`.
- **Petugas lain & mekanik**: pilih nama → ketik **PIN 6 angka** (masuk otomatis setelah angka ke-6).
- Setiap petugas bisa **Ganti PIN** sendiri (tombol di bawah sidebar).
- Admin menambah petugas di **Master Data → Petugas & PIN**, mekanik di **Master Data → Mekanik** (kolom Login PIN). Lupa PIN → admin klik **Reset PIN**.

Di belakang layar setiap petugas punya akun Firebase dengan email buatan (`…@petugas.amu-pos.id`) dan kata sandi = PIN. Karena Firebase tidak mengizinkan admin mengganti kata sandi orang lain dari aplikasi web, Reset PIN membuat akun baru dan memindahkan hak aksesnya; akun lama otomatis tidak bisa dipakai.

## Alur kerja per peran

| Peran | Menu | Tugas |
|---|---|---|
| **Registrasi** | Registrasi Servis, Master Data (pemilik & kendaraan) | Motor masuk: konsumen, kendaraan, keluhan, jenis servis (Reguler / **KSB** / **KSG ke-1..4**), jasa, pilih **mekanik yang kosong** |
| **Sparepart** | Order Sparepart, Stok Part, Pembelian Stok | Order sparepart untuk motor yang diregistrasi; catat pembelian dari supplier |
| **Mekanik** | Performa Mekanik | Lihat pekerjaan saat ini, jumlah motor, nilai jasa, komisi, estimasi gaji |
| **Kasir** | Pembayaran & Status Servis, Penjualan Sparepart, Laporan | Terima laporan mekanik (selesai / lanjut lama), biaya lain, diskon, pembayaran cash/transfer/campur, cetak nota |
| **Admin** | Semua menu | Termasuk Master Data lengkap |

**Mekanik hanya mengerjakan 1 motor.** Status WO:
- **Antri**: belum ada mekanik.
- **Dikerjakan**: mekanik dipilih di registrasi; mekanik ini tidak bisa dipilih untuk motor lain.
- Mekanik **melapor ke kasir**; kasir menandai **Selesai** (siap dibayar) atau **Lanjut lama / Ditunda** (mis. tunggu part, dengan alasan). Keduanya membuat mekanik **kosong** lagi.
- Motor Ditunda dilanjutkan dari Registrasi → pilih mekanik kosong → *Lanjutkan dikerjakan*.
- **Lunas**: sudah dibayar.

**Stok dipotong saat kasir menerima pembayaran.** Part yang sudah diorder untuk servis yang belum dibayar dihitung "dipesan servis": tidak bisa dijual di konter atau diorder ke motor lain melebihi sisa stok.

**KSG:** jasa gratis untuk konsumen; nilai klaim ke main dealer diambil dari **Master Data → Tarif KSG** (per tipe motor dan KSG ke-1..4). Sparepart dan biaya lain tetap ditagih.
**KSB:** servis berkala berbayar; nomor kartu dicatat di WO dan nota.

**Pembayaran:** cash, transfer, atau campur. Rekening tujuan dari **Master Data → Rekening**. Kembalian hanya dari cash, jadi transfer tidak boleh melebihi total. Laporan menampilkan uang masuk cash (setelah kembalian) dan transfer per rekening.

## Pembelian stok

Menu **Pembelian Stok** → *Invoice baru*: tanggal invoice, no. invoice, supplier, status bayar (lunas / belum lunas + jatuh tempo), total di invoice, lalu daftar barang (part, qty, harga beli).

1. **Simpan draft** bisa dilakukan kapan saja.
2. **Preview & terima barang** menampilkan semua barang, total pembelian, selisih dengan total invoice, stok sebelum → sesudah, dan harga beli rata-rata baru. Barang baru masuk stok setelah dicentang "sudah dicek fisik".
3. Invoice belum lunas tampil sebagai **hutang ke supplier** (merah jika lewat jatuh tempo). Tandai lunas kapan pun.

Harga beli part diperbarui dengan rata-rata tertimbang (stok lama × harga lama + qty baru × harga baru).

## Struktur folder

```
index.html            halaman utama (sidebar + konten)
cek.html              halaman cek servis untuk konsumen (tanpa login)
wilayah/              data wilayah Indonesia (index.json + 1 file per provinsi, mis. 11.json = Aceh)
style.css             tampilan
firestore.rules       aturan keamanan per peran (tempel di Firebase Console)
js/
  main.js             titik masuk: login & peran, sidebar, sinkron data, shortcut F1/F2/F8
  config.js           nama aplikasi, VERSI, peran & menu per peran, data awal
  firebase-config.js  konfigurasi project bengkel-amu
  firebase.js         inisialisasi Firebase + pembuatan akun petugas
  akun.js             login PIN: tambah petugas, reset PIN, ganti PIN sendiri
  payment.js          pembayaran cash / transfer / campur
  brand.js            logo toko + animasi loading roda gigi
  wilayah.js          alamat bertingkat provinsi/kab/kec/kelurahan
  nota-pdf.js         nota PDF dengan watermark logo
  cek.js              halaman cek servis konsumen (cek.html)
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

## Update ke versi 2.3.0

1. Upload semua file baru ke GitHub (`index.html`, `style.css`, `firestore.rules`, folder `js`). Pastikan `js/servis.js` sudah terhapus.
2. **Wajib:** Firebase Console → Firestore → Rules → tempel `firestore.rules` yang baru → *Publish*.
3. Pastikan Authentication → Sign-in method → **Email/Password** aktif (dipakai juga untuk akun PIN).
4. Masuk sebagai super admin, lalu isi **Master Data**: Rekening, Tarif KSG, Mekanik (+ PIN), Petugas & PIN.

## Setup Firebase (project baru)

1. Firestore Database → *Create database* → lokasi `asia-southeast2 (Jakarta)` → mode *production*.
2. Firestore → Rules → tempel `firestore.rules` → *Publish*.
3. Authentication → Sign-in method → aktifkan **Email/Password**.
4. Buat akun super admin `cashflow.amu@gmail.com` di Authentication → Users (tidak perlu dokumen `staff`).
5. Authentication → Settings → Authorized domains → tambah `USERNAME.github.io`.
6. Petugas lain ditambahkan dari aplikasi (Master Data → Petugas & PIN / Mekanik).

## Import data part dari Excel

**Stok Part → Import Excel**. Format dikenali otomatis: ekspor stok DMS Yamaha (`Parts`, `On Hand Qty`, `Average Cost`, `Retail Price`, `Product Category`, `Superseding Parts`, `ABC Category`) atau template toko (`kode, nama, kategori, cocok, rak, harga_beli, harga_jual, stok, stok_min`). Import ulang hanya menulis part yang berubah.

## Laporan penjualan

Periode: hari ini, 7 hari, bulan ini, bulan lalu, atau pilih tanggal. Klik kotak angka (part, jasa, klaim KSG), part terlaris, mekanik, atau kasir untuk menyaring daftar transaksi; klik transaksi untuk melihat nota. Hasil saringan bisa di-export ke Excel.

## Menyesuaikan

- Nama aplikasi & nomor versi: `js/config.js` (`APP_NAME`, `APP_VERSION`).
- Menu per peran: `MENUS` di `js/config.js`.
- Jasa, harga, tarif KSG, mekanik, gaji, komisi, rekening, tipe motor, petugas: langsung di aplikasi (Master Data).
- Email super admin: `SUPER_ADMIN` di `js/config.js` **dan** fungsi `isSuper()` di `firestore.rules`.

## Kuota paket gratis (Spark)

50.000 baca dan 20.000 tulis per hari. Cache lokal browser sudah aktif. Jika muncul "Kuota harian Firebase habis", pertimbangkan paket Blaze dan pasang batas anggaran di Google Cloud Billing.

## Keamanan

Halaman cek servis membaca dokumen `pantau/{kunci}`, dengan kunci = SHA-256 dari nopol + nomor HP. Dokumen hanya bisa dibuka bila tahu keduanya dan tidak bisa didaftar/ditelusuri (lihat `firestore.rules`). Isinya ringkasan servis kendaraan itu saja.

`apiKey` di `js/firebase-config.js` memang publik; data dilindungi `firestore.rules` (akses per peran) + koleksi `staff`.

Daftar nama petugas di layar login (`publik/login`) dan logo (`publik/brand`, hanya bisa diubah super admin) bisa dibaca tanpa login supaya nama bisa dipilih. PIN 6 angka dilindungi pembatasan percobaan dari Firebase (muncul "Terlalu banyak percobaan salah" setelah beberapa kali salah). Supaya lebih aman, batasi API key ke domain GitHub Pages Anda di Google Cloud Console → Credentials.
