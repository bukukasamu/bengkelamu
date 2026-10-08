# Aceh Mandiri Utama POS · versi 4.1.1

Copyright SRISP 2026

Aplikasi web sparepart dan bengkel Yamaha untuk Aceh Mandiri Utama.
Data tersimpan di **Cloud Firestore** (realtime, dipakai beberapa komputer sekaligus), login memakai **Firebase Authentication**.

## Fitur baru 4.1.1 — layar QR absen tanpa kata sandi

**Update:** upload semua file, **publish ulang `firestore.rules`**, lalu **sekali saja** di Firebase Console → **Authentication → Sign-in method → Anonymous → Enable** (identitas perangkat layar QR).

Satu cabang = **satu perangkat layar QR**. Perangkat lain yang membuka link ditolak ("sudah aktif di perangkat lain").
1. Di TV/tablet cabang buka **www.amuservice.id/absen** → pilih cabang → **Minta aktivasi layar ini** → layar menampilkan **kode 4 angka**.
2. **Super admin atau admin** membuka menu **Persetujuan** di HP/komputernya (di mana saja), mencocokkan kode, lalu **Setujui**. Admin hanya melihat permintaan layar ini, bukan persetujuan lain.
3. Selesai. Setiap kali perangkat itu dinyalakan, QR langsung tampil tanpa login. Lokasi bengkel otomatis diambil dari perangkat ini.
- **Jam QR aktif** bawaan 07.00–18.00 (di luar jam itu QR tidak tampil), bisa diubah super admin per cabang di **Absensi Karyawan → Layar QR**. Di sana juga terlihat kapan layar terakhir menyala.
- **Ganti perangkat** (rusak/hilang/data browser terhapus): super admin menekan **Cabut** (kata sandi), lalu perangkat baru meminta aktivasi lagi.
- Perangkat layar memakai identitas anonim tersendiri: **tidak bisa membuka data apa pun** (konsumen, nota, gaji, bahkan daftar absen); hanya bisa memperbarui kode QR cabangnya. Tidak bercampur dengan login petugas walau di perangkat yang sama dibuka aplikasi petugas.

## Fitur baru 4.1.0 — absensi scan QR + selfie

**Cara pakai karyawan:** (sudah login di HP-nya) buka **Absensi Saya → Scan QR**, atau scan QR dengan aplikasi Kamera HP lalu ketuk link-nya → **selfie** (kamera depan, tidak bisa dari galeri) → tercatat. Scan pertama = masuk, scan berikutnya = pulang.

**Pengamanan**
- Kode QR hanya berlaku ±45 detik dan dicek oleh database (bukan oleh HP), jadi foto QR yang dikirim lewat WA cepat kedaluwarsa.
- Jam absen memakai **jam server** (WIB); mengubah jam HP tidak berpengaruh.
- **Satu karyawan = satu HP**: HP pertama yang dipakai absen menjadi HP terdaftar. Absen dari HP lain ditolak; ganti HP → super admin **Reset HP** (menu Absensi Karyawan → HP terdaftar).
- **Selfie** di setiap scan + **lokasi** GPS (wajib aktif). Super admin melihat foto per hari; scan yang jauh dari bengkel ditandai 📍 merah.
- Super admin bisa mengubah status per hari (hadir manual / izin / sakit / tidak hadir) dengan catatan + kata sandi, misalnya bila HP karyawan rusak.

**Aturan (Absensi Karyawan → Pengaturan, super admin + kata sandi)**
Bawaan: jam 08.00–17.00, toleransi 5 menit, wajib scan pulang, **uang hadir Rp 10.000/hari**, **potongan Rp 5.000 per terlambat**, hari kerja Senin–Sabtu, radius 150 m, foto disimpan 90 hari. Bisa diubah, termasuk jam khusus per cabang dan potongan pulang cepat.

**Ke gaji:** uang hadir & potongan terlambat otomatis masuk **Penghasilan** dan **slip gaji** (hari tanpa scan pulang tidak dapat uang hadir bila "wajib scan pulang" aktif). Ikut terkunci saat bulan dikunci.

**Penyimpanan:** selfie dikecilkan ±5–20 KB dan disimpan di Firestore (tanpa Firebase Storage, tetap paket gratis); foto lebih lama dari batas hari dihapus otomatis saat super admin membuka menu Absensi. Layar QR menulis 1 data setiap 15 detik hanya selama jam aktif & layar menyala (±2.400 tulis per 10 jam, jatah gratis 20.000/hari). Foto tidak ikut file backup; data absen ikut.

## Fitur baru 4.0.0 — kontrol, keamanan data, dan keuangan

### ⚠️ Urutan update ke 4.0.0 (wajib berurutan)
1. Upload **semua** file ke GitHub (banyak file baru di `js/`).
2. Buka aplikasi, **login sebagai super admin** (`cashflow.amu@gmail.com`). Di Beranda muncul kotak **"Pembaruan data versi 4 diperlukan"** → klik **Perbarui data sekarang** → masukkan kata sandi. Tunggu sampai selesai.
3. **Baru setelah itu** publish `firestore.rules` versi 4 di Firebase Console → Firestore → Rules → Publish. (Kalau rules dipublish duluan, karyawan tidak bisa membaca nota lama sampai langkah 2 dijalankan.)
4. Langsung lakukan **Backup Data** pertama (menu Pengaturan → Backup Data).
5. Super admin: cek **Master Data → Insentif & Gaji**. Gaji pokok sudah dipindah ke tempat privat; pastikan angkanya benar.

Firestore akan meminta beberapa **indeks satu kolom** yang dibuat otomatis (tidak perlu apa-apa). Bila ada pesan "requires an index" dengan link, cukup klik link itu sekali.

### Otorisasi super admin (kata sandi)
Tindakan penting **wajib memasukkan ulang kata sandi super admin**: import Excel, ubah gaji/insentif, kunci/buka bulan gaji, setujui pembatalan nota & stok opname, hapus pengeluaran, buka ulang kas yang sudah ditutup, pulihkan backup.
- **Import Excel** hanya untuk super admin. User Sparepart tidak lagi punya tombol import, tetapi tetap bisa menambah part baru satu per satu, pembelian stok, opname, dan transfer.
- Stok di form part tidak bisa diketik langsung (hanya saat part baru = stok awal). Perubahan stok selalu lewat pembelian, penjualan, opname, transfer, atau pembatalan, dan semuanya tercatat di **Kartu stok**.

### Pembatalan nota (persetujuan super admin)
- Kasir/admin membuka nota → **Ajukan pembatalan** + alasan. Nota tetap dihitung sampai disetujui.
- Super admin melihat badge di menu **Persetujuan** → Setujui (catatan + kata sandi) atau Tolak (catatan).
- Bila disetujui: stok part kembali, WO servis kembali ke status *Selesai* (bisa dibayar ulang dengan benar), nota diberi cap **DIBATALKAN** dan tidak masuk laporan/penghasilan. Nota tidak pernah dihapus.

### Stok opname, kartu stok, transfer kirim/terima
- **Stok Opname** (menu Sparepart): mulai opname → isi stok fisik per part (tersimpan otomatis) → **Ajukan**. Super admin memeriksa di Persetujuan lalu menyetujui; yang diterapkan adalah **selisihnya**, jadi penjualan selama penghitungan tetap aman.
- **Kartu stok** di form part: riwayat masuk/keluar per cabang (penjualan, servis, pembelian, transfer, opname, batal).
- **Transfer stok dua langkah**: cabang asal **mengirim** (bisa beberapa part sekaligus, stok asal langsung berkurang), cabang tujuan menekan **Terima** saat barang datang (stok tujuan bertambah).

### Gaji & insentif privat, kunci bulanan
- Gaji pokok & komisi disimpan di koleksi privat `gaji/`: **hanya karyawan ybs. dan super admin** yang bisa membaca (dikunci di database, bukan hanya tampilan). Admin biasa tidak bisa melihat atau mengubah gaji, insentif, maupun aturan insentif.
- **Kunci bulan** (super admin, kata sandi): slip semua karyawan disimpan sebagai angka final. Mengubah aturan sesudahnya tidak mengubah bulan yang dikunci. Membuka kunci juga perlu kata sandi.
- **Dasar perhitungan per peran bisa diatur**: penjualan sebagai kasir, servis sebagai mekanik, registrasi, order part, atau omzet cabang.

### Data dikunci per cabang
Karyawan (selain admin/pemilik) hanya bisa membaca **nota, WO, pembelian, mutasi, opname, kas, pengeluaran, dan klaim cabangnya sendiri** — dikunci oleh `firestore.rules`. Riwayat servis konsumen lintas cabang tetap bisa dilihat dari ringkasan riwayat (tanpa membuka data cabang lain). Data KTP/kendaraan tetap bersama.

### Kas & Pengeluaran (menu Keuangan, admin & kasir)
- **Kas harian**: *Buka kas* dengan uang awal (otomatis disarankan dari sisa kemarin) → penjualan cash & pengeluaran tunai terhitung otomatis → *Tutup kas*: isi uang fisik, setoran/diambil pemilik, catatan wajib bila ada selisih. Kas yang sudah ditutup terkunci (hanya super admin bisa membuka ulang). Rekap kas sebulan di bawahnya.
- **Pengeluaran**: listrik, sewa, konsumsi, BBM, perlengkapan, dll. — tunai (mengurangi laci) atau transfer. Per kategori + Excel. Hanya super admin yang bisa menghapus.

### Laba bersih (Laporan Penjualan)
Laba kotor − pengeluaran operasional − **gaji & insentif** (dari slip bulan yang sudah dikunci; hanya terlihat oleh super admin, untuk laporan bulanan/tahunan). Ikut di Excel & PDF.

### Klaim KSG (menu Keuangan)
Daftar nota servis KSG per bulan → pilih → **Ajukan klaim** (nomor KL-…, no. surat ke main dealer) → saat dana masuk **Tandai dibayar** dengan jumlah diterima (selisih terlihat).

### Insight Konsumen per bulan
Insight sekarang hanya membaca **bulan yang dipilih** (bisa diperluas 3/6/12 bulan), kendaraan yang servis di periode itu, kendaraan baru terdaftar, dan maks. 300 kendaraan yang lama tidak servis. Seluruh database kendaraan hanya dibaca bila tombol **Muat seluruh database kendaraan** ditekan. Data kendaraan kini menyimpan tanggal terdaftar (`dibuat`) dan `servisTerakhir`.

### Backup Data (super admin)
- **Backup sekarang** mengunduh satu file `.json` berisi seluruh data. Simpan di **dua tempat** (Google Drive + flashdisk/laptop). Beranda super admin mengingatkan bila backup terakhir > 7 hari.
- **Pulihkan**: pilih file, centang data yang dikembalikan, ketik PULIHKAN + kata sandi. Data dengan ID sama ditimpa; data lain tidak dihapus.
- File berisi data pribadi (KTP, HP, gaji) — jangan dibagikan.

### Koleksi Firestore baru
`gaji`, `slip`, `penghasilan`, `penghasilanBulan`, `mutasi`, `transfer`, `opname`, `kas`, `pengeluaran`, `klaim`. File JS baru: `otorisasi.js`, `kontrol.js`, `opname.js`, `persetujuan.js`, `data-trx.js`, `migrasi.js`, `keuangan.js`, `backup.js`.

## Fitur baru 3.4.0

**Tampilan per peran**
- Tombol cepat F1/F2/F8 hanya muncul di halaman yang memakainya (F8 hanya untuk kasir & admin). **Mekanik** tidak melihat bar tombol sama sekali.
- Halaman mekanik tidak lagi menampilkan gaji/komisi atau nota kasir; ada pintasan ke *Penghasilan Saya*.
- Menu penghasilan dipisah dari laporan toko: karyawan melihat **Akun Saya → Penghasilan Saya**; admin melihat **Karyawan → Penghasilan Karyawan**.

**Penghasilan & insentif**
- **Pola per orang**: setiap item insentif/potongan bisa berlaku per peran **atau khusus karyawan tertentu** (dicentang namanya), jadi tiap PIC boleh beda pola.
- **Insight target** di setiap item (bulan berjalan): kekurangan untuk tingkat berikutnya, **kebutuhan per hari** untuk sisa hari, rata-rata harian saat ini, **perkiraan akhir bulan** dengan laju sekarang, dan potensi insentif. Di atas ada ringkasan target yang masih bisa dikejar.
- **Slip gaji**: tombol *Slip gaji (PDF)* membuka **pratinjau** slip, lalu *Unduh PDF* (A5, logo, tanda tangan). Karyawan untuk dirinya; admin untuk karyawan yang dipilih di rekap.

**Laporan Penjualan: Harian / Mingguan / Bulanan / Tahunan / Custom**
- Tombol ‹ › untuk mundur/maju periode, atau pilih tanggal; *Hari ini* untuk kembali.
- **Rincian per hari** (mingguan, bulanan, custom) atau **per bulan** (tahunan) dengan grafik batang; klik barisnya untuk membuka laporan hari/bulan itu. Excel & PDF mengikuti periode yang dibuka.

**Insight Konsumen** (Keuangan → Insight Konsumen, admin)
- Kendaraan terdaftar, kendaraan servis 12 bulan & rata-rata kunjungan, konsumen baru bulan ini, persentase yang kembali servis.
- Grafik kunjungan & konsumen baru 12 bulan; sebaran tipe motor, jenis servis (Reguler/KSB/KSG), kabupaten/kota & kecamatan, usia & jenis kelamin (dari data KTP).
- **Konsumen terbaik** (klik → riwayat motor) dan **Perlu diingatkan servis** (tidak servis ≥ 2/3/4/6 bulan) dengan tombol **WA “Ingatkan”** berisi pesan servis berkala + link riwayat.
- Bisa disaring per cabang dan **⬇ Excel** (database konsumen + daftar perlu diingatkan).

Update: upload semua file (baru: `js/insight.js`, `js/slip-pdf.js`). `firestore.rules` sama dengan 3.0.0.

## Fitur baru 3.3.0 — penghasilan karyawan (insentif & potongan)

**Pengaturan (super admin): Master Data → Insentif & Potongan**
- **Item insentif** (bisa ditambah sebanyak perlu): nama, *dihitung dari* (penjualan sparepart / jasa servis termasuk klaim KSG / biaya lain / total nota), **peran** yang mendapat, dan **tingkat target** bulanan. Contoh: penjualan ≥ Rp 7.000.000 → 2%, ≥ Rp 10.000.000 → 3%. Tingkat tertinggi yang tercapai dipakai, persennya dikalikan **seluruh** penjualan (8 jt × 2% = 160.000).
- **Item potongan** (BPJS, kasbon, dll.): nominal tetap per bulan + peran yang dipotong.
- **Gaji pokok** setiap karyawan (petugas & mekanik) di tabel yang sama.
- Saat pertama dibuka terisi contoh (insentif sparepart & jasa 7 jt → 2%, BPJS) yang baru berlaku setelah *Simpan aturan*.

**Penjualan pribadi** yang dihitung:
| Peran | Dari nota |
|---|---|
| Mekanik | servis yang dia kerjakan |
| Kasir & admin | nota yang pembayarannya dia terima (servis & penjualan part) |
| Registrasi | servis yang dia daftarkan |
| Sparepart | servis yang order sparepart-nya dia input |

Nota yang dibuat sebelum versi 3.3 dicocokkan lewat nama petugas.

**Menu Penghasilan** (semua peran): karyawan melihat penghasilannya sendiri per bulan — gaji pokok, tiap insentif (nilai penjualan pribadi, target yang tercapai, *kurang berapa lagi* untuk tingkat berikutnya), potongan, dan **penghasilan bersih**. Admin/pemilik melihat **rekap semua karyawan** (klik nama untuk rincian) dan bisa **⬇ Excel** (sheet penghasilan + sheet aturan). Komisi % mekanik di tab Mekanik tetap ikut dihitung bila diisi.

Update: upload semua file (baru: `js/penghasilan.js`). `firestore.rules` sama dengan 3.0.0.

## Fitur baru 3.2.0 — laporan Excel & PDF, dashboard bisa diklik

- **Laporan Penjualan → ⬇ Excel** berisi beberapa sheet: *Ringkasan* (periode, cabang, omzet, part, jasa, klaim KSG, diskon, laba, uang masuk), *Transaksi*, *Item sparepart* (per item + laba), *Part terlaris*, *Per mekanik*, dan *Per cabang* (bila multi cabang).
- **Laporan Penjualan → ⬇ PDF** (A4, hitam-putih, logo toko): kotak ringkasan, omzet per cabang, uang masuk, part terlaris, per mekanik, per kasir, dan daftar transaksi lengkap dengan nomor halaman. Mengikuti periode, cabang (atau *Semua cabang*), dan filter yang sedang dipilih.
- **Beranda bisa diklik di semua bagian**:
  - kotak *Omzet hari ini* → daftar nota → klik untuk membuka nota;
  - **batang grafik 7 hari** → daftar nota pada hari itu;
  - kotak *Motor masuk* / baris **Antrian bengkel** → langsung membuka motor itu di Pembayaran (motor yang sudah lunas → Riwayat Kendaraan);
  - **Status mekanik** → Performa Mekanik orang tersebut;
  - baris **Perlu dipesan ulang** → membuka data part di Stok Part.

Update: upload semua file (baru: `js/laporan-pdf.js`). `firestore.rules` sama dengan 3.0.0.

## Fitur baru 3.1.0 — tracking & riwayat kendaraan

- **Halaman konsumen (www.amuservice.id)**: riwayat servis tampil sebagai kartu yang bisa dibuka, berisi tanggal, cabang, kilometer, **mekanik**, **keluhan**, jam masuk & selesai, lama dikerjakan, rincian jasa, sparepart, biaya lain, diskon, total, dan cara bayar. Di atasnya ada ringkasan: berapa kali servis, servis terakhir, KM terakhir, total biaya.
- **Nota dipratinjau dulu**: tombol *Lihat nota* membuka nota berbentuk struk di layar. PDF baru dibuat saat menekan **Unduh PDF** (atau **Bagikan** di HP yang mendukung).
- **Menu baru “Riwayat Kendaraan”** (admin, registrasi, kasir, sparepart): cari dengan sebagian nopol / nama / no. HP / NIK / no. rangka / no. mesin → data pemilik (KTP) & kendaraan (STNK), **tracking servis yang sedang berjalan** (tahap, jam, mekanik, keluhan, estimasi), dan **seluruh riwayat servis dari semua cabang** dengan nota. Ada tombol kirim link cek servis ke WA konsumen.
- Tombol **Riwayat motor** di Registrasi, Order Sparepart, dan Pembayaran langsung membuka riwayat motor yang sedang dipilih.
- Keluhan konsumen kini ikut tersimpan di nota servis (untuk servis yang dibayar mulai versi ini).

Update: upload semua file (baru: `js/riwayat.js`, `js/riwayat-ui.js`, `js/cari-kendaraan.js`). `firestore.rules` sama dengan 3.0.0.

## Fitur baru 3.0.0 — multi cabang

Data yang sudah ada otomatis menjadi **cabang utama** (kode `UTM`). Cabang baru ditambah di **Master Data → Cabang**.

| Dipisah per cabang | Dipakai bersama semua cabang |
|---|---|
| Stok part (bisa **transfer** antar cabang) | Master part, harga jual & beli |
| Nomor WO, nota, pembelian, **antrian** (mis. `WO-LSK-0001`, `SV-LSK-261008-001`) | Jasa & harga, tarif KSG, tipe motor |
| Work order, transaksi, pembelian stok | Rekening transfer |
| Mekanik dan petugas | Data konsumen, kendaraan, riwayat servis, halaman cek servis |
| Layar TV + teks berjalan (`/layar?c=LSK`) | Logo |

- **Karyawan terikat 1 cabang**: saat login, nama dikelompokkan per cabang (mis. *LHOKSEUMAWE · Kasir*). Setelah masuk hanya melihat data cabangnya; nama cabang tampil di kanan atas.
- **Admin/pemilik & super admin** memilih cabang di kanan atas (pilihan diingat di perangkat). Semua menu mengikuti cabang yang dipilih.
- **Transfer stok**: Stok Part → *Transfer stok* (muncul bila ada ≥ 2 cabang). Stok langsung berpindah dan dicatat (tanggal, part, jumlah, dari → ke, petugas). Kolom *Cabang lain* di tabel stok menunjukkan stok di cabang lain.
- **Pembelian stok** menambah stok cabang tempat pembelian dibuat. **Import Excel**: kolom stok = stok cabang yang sedang dibuka.
- **Laporan**: admin bisa memilih *Semua cabang* → total gabungan + tabel **Omzet per cabang** (bisa diklik untuk menyaring). Export Excel memuat kolom cabang.
- **Nota** mencetak nama cabang, alamat, dan telepon cabang. Halaman cek servis menampilkan cabang tempat servis.
- **Layar TV per cabang**: cabang utama `www.amuservice.id/layar`, cabang lain `www.amuservice.id/layar?c=KODE` (alamatnya tertera di Master Data → Layar TV saat cabang itu dipilih).
- Pencarian data lama di Registrasi mencari konsumen dari **semua cabang**.

### Update ke 3.0.0
1. Upload semua file (baru: `js/cabang.js`).
2. **Wajib:** publish ulang `firestore.rules` (aturan baru: daftar cabang, penghitung nomor per cabang, layar per cabang, transfer stok).
3. Admin: Master Data → **Cabang** → ganti nama cabang utama (mis. BANDA ACEH) dan isi alamat/telepon untuk nota → **Tambah cabang** (kode 2–4 huruf, mis. `LSK`; kode tidak bisa diubah, cabang tidak dihapus tetapi bisa dinonaktifkan).
4. Pilih cabang baru di kanan atas, lalu: tambah **mekanik** (tab Mekanik), tambah **petugas** dengan cabang tersebut (tab Petugas & PIN), isi stok lewat **Transfer stok** atau **Pembelian stok**, isi teks berjalan layar TV.
5. Petugas lama otomatis tercatat di cabang utama; untuk memindah, ubah kolom *Cabang* di tab Petugas & PIN (berlaku saat petugas login ulang).

Catatan: aturan database membatasi peran (kasir, sparepart, dll.), tetapi belum memisah hak baca per cabang — petugas yang paham teknis bisa membaca data cabang lain lewat database. Untuk pemakaian sehari-hari, aplikasi hanya menampilkan data cabangnya sendiri.

## Fitur baru 2.8.0 — halaman utama untuk konsumen

- **www.amuservice.id langsung membuka cek servis konsumen** (`index.html`): masukkan no. polisi + no. HP, lalu tetap masuk di HP itu. Tidak ada tombol login petugas di halaman konsumen.
- **Aplikasi petugas pindah ke www.amuservice.id/pos** (`pos.html`). Alamat `/petugas`, `/login`, `/kasir`, `/admin` juga diarahkan ke sana.
- Link WA dan QR code sekarang lebih pendek: `www.amuservice.id/?nopol=BL1234NN`; di layar TV tertulis cukup `www.amuservice.id`.
- Link lama tetap jalan: `cek.html?nopol=…` dan `/cek` dialihkan ke halaman utama.

### Update ke 2.8.0
1. Upload semua file. **Penting:** `index.html` sekarang berisi halaman konsumen, `pos.html` (baru) berisi aplikasi petugas, dan `cek.html` hanya pengalih untuk link lama.
2. Petugas: buka `www.amuservice.id/pos`, simpan sebagai bookmark/pasang aplikasi dari sana. Aplikasi petugas yang sudah terpasang sebelumnya dihapus lalu dipasang ulang dari `/pos`.
3. `firestore.rules` tidak berubah.

## Domain www.amuservice.id (versi 2.7.0)

Alamat setelah domain aktif:

| Untuk | Alamat |
|---|---|
| Konsumen cek servis (halaman utama) | `https://www.amuservice.id` |
| Petugas (login PIN / super admin) | `https://www.amuservice.id/pos` |
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
index.html            halaman utama = cek servis konsumen (tanpa login)
pos.html              aplikasi petugas (login PIN, sidebar + konten)
cek.html              pengalih alamat lama ke halaman utama
layar.html            layar TV antrian ruang tunggu (tanpa login)
sw.js                 service worker PWA (harus sejajar index.html & pos.html)
*.webmanifest         data aplikasi PWA: petugas, cek servis, layar TV
CNAME                 nama domain untuk GitHub Pages (www.amuservice.id)
404.html              alamat pendek /pos & /layar + halaman tidak ditemukan
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
  cabang.js           daftar cabang, stok per cabang, kode nomor per cabang
  riwayat.js          menu Riwayat Kendaraan (petugas)
  riwayat-ui.js       tampilan tracking & kartu riwayat (konsumen & petugas)
  cari-kendaraan.js   pencarian kendaraan dengan sebagian data
  laporan-pdf.js      laporan penjualan dalam PDF (A4)
  penghasilan.js      menu Penghasilan: gaji, insentif, potongan, insight target
  slip-pdf.js         slip gaji PDF (A5)
  insight.js          menu Insight Konsumen
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

Sejak 4.0.0: admin tidak bisa mengubah akunnya sendiri, nota tidak bisa diubah isinya, stok hanya bisa diubah untuk cabang sendiri, dan gaji/slip hanya terbaca oleh karyawan ybs. + super admin. Batas yang tersisa: siapa pun yang boleh **membuat/mereset PIN** karyawan (admin) secara teknis bisa masuk sebagai karyawan itu. Bila ingin benar-benar tertutup, serahkan reset PIN hanya ke super admin.

`apiKey` di `js/firebase-config.js` memang publik; data dilindungi `firestore.rules` (akses per peran) + koleksi `staff`.

Daftar nama petugas di layar login (`publik/login`) dan logo (`publik/brand`, hanya bisa diubah super admin) bisa dibaca tanpa login supaya nama bisa dipilih. PIN 6 angka dilindungi pembatasan percobaan dari Firebase (muncul "Terlalu banyak percobaan salah" setelah beberapa kali salah). Supaya lebih aman, batasi API key ke domain GitHub Pages Anda di Google Cloud Console → Credentials.
