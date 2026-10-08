# Aceh Mandiri Utama POS · versi 2.7.0

Aplikasi web sparepart dan bengkel Yamaha untuk Aceh Mandiri Utama.
Data tersimpan di **Cloud Firestore** (realtime, dipakai beberapa komputer sekaligus), login memakai **Firebase Authentication**.

## Domain www.amuservice.id (versi 2.7.0)

Alamat setelah domain aktif:

| Untuk | Alamat |
|---|---|
| Petugas (login PIN / super admin) | `https://www.amuservice.id` |
| Konsumen cek servis | `https://www.amuservice.id/cek` |
| Layar TV antrian | `https://www.amuservice.id/layar` |

Yang berubah di aplikasi: file `CNAME` (berisi `www.amuservice.id`), alamat pendek `/cek` dan `/layar` (lewat `404.html`), link WA & QR code memakai alamat pendek saat dibuka dari domain, gambar pratinjau link untuk WhatsApp (`icons/og-cek.jpg`), `robots.txt` + `sitemap.xml` (hanya halaman cek servis yang boleh muncul di Google; halaman petugas dan layar TV tidak).

### Langkah 1 — GitHub
1. Upload semua file versi 2.7.0, termasuk file baru **`CNAME`**, **`404.html`**, **`robots.txt`**, **`sitemap.xml`**, `icons/og-cek.jpg`.
2. Repository `bengkelamu` → **Settings → Pages** → *Custom domain*: isi `www.amuservice.id` → **Save**.
3. Tunggu pemeriksaan DNS berhasil (setelah langkah 2 di DomaiNesia), lalu centang **Enforce HTTPS** (sertifikat bisa butuh sampai 24 jam).

### Langkah 2 — DNS di DomaiNesia
Member area → **Domain** → amuservice.id → **Kelola DNS** (DNS Management). Hapus dulu record bawaan untuk `@` dan `www` (parkir/redirect DomaiNesia), lalu tambahkan:

| Tipe | Nama/Host | Isi/Nilai |
|---|---|---|
| CNAME | `www` | `bukukasamu.github.io` |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| AAAA (opsional) | `@` | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |

Record A untuk `@` membuat `amuservice.id` (tanpa www) otomatis diarahkan ke `www.amuservice.id`. CNAME `www` diisi **tanpa** nama repository. Perubahan DNS biasanya aktif dalam beberapa menit sampai beberapa jam.

Disarankan (keamanan): GitHub → foto profil → **Settings → Pages → Add a domain** → `amuservice.id`, lalu tambahkan record **TXT** yang diminta GitHub di DomaiNesia. Ini mencegah orang lain memakai domain Anda di GitHub.

### Langkah 3 — Firebase
1. Firebase Console → **Authentication → Settings → Authorized domains** → *Add domain*: `www.amuservice.id` dan `amuservice.id`.
2. Bila API key pernah dibatasi di Google Cloud Console (*Credentials → API key → Website restrictions*), tambahkan `https://www.amuservice.id/*` dan `https://amuservice.id/*`. Bila tidak dibatasi, lewati.

### Setelah pindah domain
- Alamat lama `bukukasamu.github.io/bengkelamu` otomatis dialihkan GitHub ke `www.amuservice.id`, jadi link lama di WA tetap jalan.
- Bagi browser, domain baru adalah situs baru: petugas **login sekali lagi**, konsumen memasukkan nopol + HP sekali lagi, dan aplikasi yang sudah dipasang (PWA) dari alamat lama **dihapus lalu dipasang ulang** dari `www.amuservice.id`.
- Cetak ulang QR/tiket yang memakai alamat lama bila ada.

## Fitur baru 2.6.0

- **Cari data lama cukup sebagian**: di Registrasi, kotak *Pernah servis di sini?* menerima potongan data. Contoh: `BL123` menemukan BL1234NN; `RAHMAT` menemukan nama; `0812 600` menemukan nomor HP; awal no. rangka/mesin/NIK juga bisa. Untuk motor yang tercatat di daftar servis, potongan di tengah (mis. `1234` atau `NN`) juga ketemu.
- **Angka bertitik ribuan** di semua kolom angka (harga, diskon, biaya, cash/transfer, gaji, stok, kilometer): ketik `1000000` tampil `1.000.000`. Komisi persen tetap boleh desimal.
- **Versi aplikasi (PWA) untuk HP dan PC**: aplikasi bisa dipasang seperti aplikasi biasa — ikon di layar utama/desktop, terbuka tanpa bilah browser, dan tetap bisa dibuka saat sinyal putus (data tersimpan setelah internet kembali; pembayaran & nomor baru tetap butuh internet). Ada tiga aplikasi: **AMU POS** (petugas), **Cek Servis AMU** (konsumen), **Layar AMU** (TV).

## Update ke versi 2.6.0

1. Upload ke GitHub: `index.html`, `cek.html`, `layar.html`, `style.css`, seluruh folder `js` (baru: `angka.js`, `pwa.js`), dan file/folder baru **`sw.js`**, **`manifest.webmanifest`**, **`cek.webmanifest`**, **`layar.webmanifest`**, folder **`icons`**. `sw.js` harus di folder yang sama dengan `index.html`.
2. `firestore.rules` sama dengan 2.5.0 (tidak perlu publish lagi bila 2.5.0 sudah dipublish).
3. Admin: buka **Master Data → Pemilik & Kendaraan** sekali. Data kendaraan lama otomatis dilengkapi kolom pencariannya sehingga bisa dicari dengan sebagian no. HP.
4. Mulai versi ini pembaruan langsung terpakai saat aplikasi dibuka dengan internet (tidak perlu Ctrl+Shift+R lagi).

### Memasang aplikasi

- **Android (Chrome)**: buka situs → tombol **Pasang aplikasi** (di bawah form login atau di bawah menu samping), atau menu ⋮ → *Instal aplikasi*.
- **iPhone/iPad (Safari)**: tombol Bagikan → *Tambah ke Layar Utama*.
- **PC (Chrome/Edge)**: ikon pasang di ujung kanan bilah alamat, atau tombol **Pasang aplikasi**.
- Konsumen: di halaman cek servis ada tombol **Pasang di HP**.
- Ikon aplikasi ada di folder `icons/` (roda gigi + AMU). Ganti dengan logo toko bila mau, dengan ukuran yang sama (192×192 dan 512×512 px; versi *maskable* beri ruang kosong ±10% di tepi).

## Fitur baru 2.5.0

- **Nomor antrian harian** (001, 002, … mulai lagi dari 001 setiap hari). Nomor keluar otomatis saat motor didaftarkan di Registrasi Servis, berurutan sesuai kedatangan, dan tidak pernah kembar walau dua petugas menyimpan bersamaan. Setelah disimpan muncul jendela nomor besar dengan tombol **Kirim nomor via WA** (berisi nomor + link cek servis) dan **Cetak tiket** (struk 58 mm dengan QR code cek servis).
- **Nomor cepat (cukup nopol)**: saat ramai, cukup isi nomor polisi lalu tekan *Nomor cepat* — nomor antrian langsung keluar. Motor ditandai **Data belum lengkap**; datanya dilengkapi sesudahnya. Mekanik baru bisa dipilih dan pembayaran baru bisa diterima setelah data lengkap.
- **Layar TV ruang tunggu** (`layar.html`, tanpa login): nomor yang **dipanggil**, motor **sedang dikerjakan** (dengan nama mekanik), **menunggu**, dan **siap diambil**, teks berjalan, jam, dan **QR code** ke halaman cek servis. Nomor polisi tampil penuh; nama konsumen, no. HP, dan biaya tidak ditampilkan. Daftar yang panjang bergeser sendiri per halaman.
- **Panggilan bersuara**: saat kasir menandai motor **Selesai**, layar menampilkan nomor besar, berbunyi bel, lalu mengucapkan dua kali, mis. *"Nomor antrian dua belas. B L, 4 5 2 1, A B. Silakan ke kasir."* Di menu Pembayaran ada tombol **Panggil ulang di layar**.
- **Master Data → Layar TV** (admin): ubah teks berjalan (jam buka, promo, info KSG), buka layar, dan petunjuk pemasangan.
- Nomor antrian juga tampil di daftar motor, Pembayaran, dan halaman cek servis konsumen. Nomor WO (kartu kerja per motor) tetap ada untuk catatan internal.

## Update ke versi 2.5.0

1. Upload ke GitHub: `index.html`, `cek.html`, **`layar.html` (baru)**, `style.css`, dan seluruh isi folder `js` (ada file baru `antrian.js`, `layar.js`, `qr.js`).
2. **Wajib:** Firebase Console → Firestore → Rules → tempel `firestore.rules` yang baru → *Publish* (ada aturan baru `publik/layar` untuk layar TV).
3. Tekan Ctrl+Shift+R sampai versi di kiri bawah menunjukkan **2.5.0**. Nomor antrian mulai dari 001 untuk motor yang didaftarkan setelah update.
4. Isi teks berjalan di Master Data → Layar TV, lalu buka `https://www.amuservice.id/layar` di TV.

### Memasang layar TV

- Perangkat: Smart TV dengan browser, Android TV box, atau laptop/PC mini yang disambung HDMI. Disarankan Chrome.
- Setelah halaman terbuka, **klik layar sekali** (atau tekan OK di remote) supaya suara dan layar penuh aktif — aturan browser melarang suara sebelum ada klik. Klik dua kali kapan saja untuk kembali ke layar penuh.
- Supaya tidak perlu klik setiap TV dinyalakan (PC/laptop): buat shortcut Chrome dengan tambahan `--kiosk --autoplay-policy=no-user-gesture-required https://www.amuservice.id/layar`.
- Suara memakai pembaca teks Bahasa Indonesia bawaan perangkat (di Android: Google Text-to-Speech, bahasa Indonesia). Jika tidak ada, layar hanya berbunyi bel; keterangan suaranya terlihat di layar pembuka.
- Titik hijau di samping jam = tersambung; merah berkedip = internet putus (layar tersambung lagi sendiri).

## Fitur baru 2.4.0

- **Registrasi dipisah tiga bagian**: (1) **Data konsumen sesuai KTP** — NIK, nama lengkap, tempat & tanggal lahir, jenis kelamin, pekerjaan, no. HP/WA, alamat (provinsi → kabupaten/kota → kecamatan → kelurahan/gampong, jalan, RT/RW); (2) **Data kendaraan sesuai STNK** — no. polisi, **nama pemilik di STNK** (centang *sama dengan konsumen* bila sama), tipe, tahun, warna, no. rangka, no. mesin, kilometer; (3) **Servis**. Yang wajib hanya nama, no. polisi, dan tipe motor; kolom lain boleh dikosongkan dan dilengkapi belakangan.
- **Cari data lama dengan satu data saja**: di atas form registrasi ada kotak *Pernah servis di sini?* — ketik salah satu dari no. polisi, no. rangka, no. mesin, NIK, atau no. HP lalu Enter. Tombol **Pakai data** mengisi konsumen + kendaraan; **Konsumen saja** untuk konsumen lama yang membawa motor lain. Semua isian tetap bisa diubah sebelum disimpan.
- **Konsumen luar Aceh**: pilih provinsinya di kolom Provinsi (38 provinsi tersedia, default Aceh). Plat luar daerah (BK, B, BM, dll.) diketik biasa.
- **Halaman cek servis konsumen tetap masuk**: cukup sekali memasukkan no. polisi + no. HP; perangkat itu tetap masuk sampai konsumen menekan **Keluar**. Status servis ter-update sendiri tanpa perlu muat ulang. Konsumen dengan beberapa motor bisa menambah **+ Kendaraan lain** dan berpindah antar motor. Yang disimpan di HP konsumen hanya kode acak dan no. polisi, bukan nomor HP.
- **Nota PDF hitam-putih**: logo di kepala nota dan watermark dibuat tanpa warna (abu-abu), tepi kosong logo dipangkas, dan perbandingan sisi logo dijaga (tidak gepeng) untuk logo persegi maupun melebar.
- **Tampilan HP potret & PC**: di HP menu samping jadi laci (tombol ☰), tombol cepat jadi satu baris, kolom isian lebih besar (tidak zoom sendiri di iPhone), tabel lebar digeser ke samping, jendela dialog naik dari bawah. Di PC tampilan dua kolom seperti sebelumnya, dan melebar di monitor besar.

## Update ke versi 2.4.0

1. Upload ke GitHub: `index.html`, `cek.html`, `style.css`, dan seluruh isi folder `js`. Folder `wilayah` dan `firestore.rules` **tidak berubah** dari 2.3 (tidak perlu publish rules lagi).
2. Buka aplikasi, tekan Ctrl+Shift+R (atau tutup-buka tab) sampai versi di kiri bawah menunjukkan **2.4.0**.
3. Data kendaraan lama tetap terpakai. Kolom baru (NIK, tempat/tanggal lahir, nama STNK, dll.) kosong dan terisi saat kendaraan itu servis lagi atau diedit di Master Data → Pemilik & Kendaraan.
4. Pencarian dengan no. HP untuk data lama: buka kendaraan di Master Data lalu simpan sekali, atau cukup registrasikan servis berikutnya; setelah itu no. HP-nya bisa dicari.

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
layar.html            layar TV antrian ruang tunggu (tanpa login)
sw.js                 service worker PWA (harus sejajar index.html)
*.webmanifest         data aplikasi PWA: petugas, cek servis, layar TV
CNAME                 nama domain untuk GitHub Pages (www.amuservice.id)
404.html              alamat pendek /cek & /layar + halaman tidak ditemukan
robots.txt, sitemap.xml  aturan mesin pencari
icons/                ikon aplikasi PWA
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
  layar.js            layar TV ruang tunggu (layar.html): antrian + suara panggilan
  antrian.js          jendela nomor antrian, kirim WA, cetak tiket
  qr.js               pembuat QR code (dimuat dari CDN)
  angka.js            kolom angka bertitik ribuan
  pwa.js              pasang aplikasi (PWA) + daftar service worker
  state.js            data bersama & navigasi
  util.js             format rupiah/tanggal, toast, modal
  numbering.js        nomor nota PJ/SV, pembelian PB, work order WO, antrian harian
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
