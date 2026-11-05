# Panduan Penggunaan AMU Service · versi 5.20.0

Aceh Mandiri Utama — Sparepart & Bengkel Yamaha. Dokumen ini sama dengan menu **Panduan Penggunaan** di dalam aplikasi (www.amuservice.id/pos). Di aplikasi, setiap pengguna hanya melihat topik untuk perannya; dokumen ini memuat seluruh topik.

## Daftar isi

1. Apa yang baru — versi 5.20.0
2. Umum — semua pengguna
3. Tampilan, navigasi & kecepatan
4. Fungsi setiap menu
5. Chat Internal & Status Online
6. Registrasi Servis
7. Kasir
8. Mekanik
9. Service Advisor
10. Sparepart, harga master, dan Import Excel
11. Sales
12. Admin / Kepala Cabang
13. Super Admin / Pemilik
14. Masalah umum & solusi

---

## 1. Apa yang baru — versi 5.20.0

_Ringkasan lengkap perubahan 5.19.0–5.20.0: tampilan HP gaya aplikasi dengan menu bawah, KSG 12 kolom, PDF absensi pribadi, tampilan modern bergradasi, PDF modern, Chat gaya messenger dengan status Online/Sibuk/Offline, dan loading yang jauh lebih ringan. Baca bagian ini dulu setelah aplikasi diperbarui._

### 1.1 Baru di 5.20.0 — menu bawah di HP (gaya aplikasi)

Di HP (layar 900 piksel ke bawah) bilah kiri diganti **bilah menu di bawah layar** seperti aplikasi pada umumnya. Bilah bawah berisi 4 menu utama sesuai peran Anda (contoh Kasir: Beranda, Bayar, Jual Part, Cek Stok; Mekanik: Mekanik, Cek Stok, Absensi, Gaji; Admin: Beranda, Registrasi, Bayar, Jual Part) dan tombol **Menu** di paling kanan. Ketuk **Menu** untuk membuka lembar dari bawah yang berisi: kartu profil (nama, peran, tombol status Online/Sibuk/Offline), **seluruh menu** yang boleh Anda buka dalam bentuk ikon berkelompok (Utama, Komunikasi, Bengkel, Sparepart, Kasir, Keuangan, Pengaturan, Karyawan, Bantuan), serta tombol **Ganti PIN**, **Pasang aplikasi**, **Update aplikasi**, **Mode gelap/terang**, dan **Keluar**. Tutup lembar dengan mengetuk area gelap, menggeser lembar ke bawah, atau tombol Kembali HP. Angka kuning di ikon menandakan ada hal yang perlu ditindaklanjuti (angka di tombol Menu = jumlah untuk menu yang tidak tampil di bilah bawah). Menu yang sedang dibuka disorot berwarna.

### 1.2 Baru di 5.20.0 — layar HP tidak bergoyang

Tampilan HP kini terkunci seperti aplikasi: halaman tidak bisa digeser ke samping, tidak memantul saat ditarik di ujung atas/bawah, tidak bisa dicubit untuk zoom, dan tidak membesar sendiri saat mengetik di kotak isian. Jendela dialog (konfirmasi, rincian, pratinjau) muncul dari bawah layar selebar HP. Tombol cepat di bawah judul hanya tampil bila berguna (mis. Cetak Nota Terakhir hanya di Bayar, Jual Part, dan Laporan). Di menu dengan daftar + rincian (Pembayaran, Order Sparepart), setelah memilih motor layar otomatis bergulir ke rincian. Tabel lebar tetap dapat digeser ke samping di dalam kotaknya.

### 1.3 Baru di 5.20.0 — Tarif KSG 12 kolom

**Master Data → Tarif KSG** sekarang memiliki **12 kolom (KSG 1 s.d. KSG 12)** per tipe motor yang dapat diisi sendiri sesuai buku servis/ketentuan main dealer. Kolom yang dikosongkan berarti tidak ada klaim. Kolom tipe motor tetap terlihat saat tabel digeser ke samping. Di **Registrasi Servis**, pilihan **KSG ke-** kini 1 sampai 12; bila tipe motor sudah punya tarif, nomor yang belum diisi tarifnya ditandai _(tanpa tarif)_. Tarif lama KSG 1–4 tidak berubah.

### 1.4 Baru di 5.20.0 — cetak absensi pribadi (PDF / pratinjau)

Semua karyawan dapat mencetak absensinya sendiri. Buka **Absensi Saya**, pilih bulan dengan tombol ‹ ›, lalu tekan **👁 Pratinjau** untuk melihat laporan di layar, atau **⬇ PDF absensi** untuk mengunduh PDF (dari pratinjau juga ada tombol **Unduh PDF**). Isi laporan: identitas (nama, jabatan, cabang, jam kerja), ringkasan (hari hadir & uang hadir, terlambat & potongan, tanpa scan pulang, pulang cepat, izin/sakit/alpa), rincian harian (tanggal, jam masuk, jam pulang, durasi kerja, keterangan), aturan uang hadir, dan kolom tanda tangan karyawan & manajemen. Super Admin dapat membuat laporan yang sama untuk setiap karyawan dari **Absensi Karyawan → Rekap bulanan** (tombol 👁 dan PDF di setiap baris).

### 1.5 Baru di 5.19.2 — dokumen PDF modern

Semua dokumen PDF kini memakai desain baru yang seragam: pita kepala bergradasi sesuai tema dengan logo toko di plat putih, judul dokumen dan periode di kanan atas, kartu informasi berwarna lembut, judul bagian dengan garis warna, tabel dengan kepala berwarna dan baris belang tipis, serta kaki halaman berisi tanggal cetak dan nomor halaman. Berlaku untuk: **Slip gaji** dan **slip THR/bonus** (kotak **Penghasilan bersih** bergradasi, total pendapatan hijau, potongan merah), **Laporan penjualan PDF** (kartu ringkasan berwarna, halaman lanjutan memakai kepala ringkas), **BAST transfer stok PDF** (kartu tanggal + lencana status DITERIMA/DIKIRIM, rute cabang), **Data konsumen & kendaraan PDF**, serta **Nota PDF** (pita warna tipis atas-bawah, total dalam kotak lembut). Tampilan cetak **BAST kendaraan masuk** dan **BAST transfer stok** (Print / Simpan PDF) juga diperbarui. Warna dokumen mengikuti tema di Master Data → Tema Tampilan (tema Gelap/Kaca memakai biru agar terang saat dicetak).

### 1.6 Baru di 5.19.2 — tampilan HP lebih rapi

Di HP: ukuran huruf tidak lagi membesar sendiri; bilah atas selalu satu baris (judul panjang dipotong dengan tanda …, pilihan cabang ringkas, tombol status dan foto profil tidak keluar layar); halaman tidak bisa bergeser ke samping; tab (mis. Master Data, Registrasi) dan pilihan periode (Laporan) tampil satu baris yang dapat **digeser ke samping**; tombol cepat (Baru, Simpan, Cetak) satu baris yang dapat digeser; tabel yang berisi isian (mis. Petugas & PIN) dapat digeser di dalam kotaknya tanpa memotong isian; jarak dan ukuran kartu disesuaikan; dialog muncul dari bawah layar. Foto petugas di Master Data → Petugas & PIN kini berupa lingkaran yang tinggal diketuk (tombol "Choose File" disembunyikan).

### 1.7 Perbaikan 5.19.1 — browser lama (Windows 7)

Pada komputer Windows 7 (Chrome versi 109 ke bawah) tampilan 5.19.0 sempat bermasalah: sisi kiri halaman login putih sehingga nama toko tidak terbaca, tombol **Masuk** tidak terlihat, dan bilah kiri/atas tidak bergradasi. Penyebabnya fungsi warna baru yang belum dikenal browser lama. Versi 5.19.1 memakai cara pewarnaan yang didukung browser lama maupun baru, tanpa mengubah fungsi apa pun. Jika masih melihat tampilan putih, tekan **Update aplikasi** sekali. Disarankan tetap memperbarui browser/perangkat bila memungkinkan, karena Chrome di Windows 7 sudah tidak mendapat pembaruan keamanan.

### 1.8 Cara memastikan sudah memakai versi terbaru

Lihat tulisan kecil **versi 5.20.0** di bagian bawah bilah kiri (atau di halaman login sisi kiri bawah). Jika masih tertulis versi lama, tekan **Update aplikasi** di bilah kiri bawah (atau di layar login). Tombol ini sekarang mengosongkan salinan aplikasi lama di perangkat, mengambil versi terbaru, lalu memuat ulang halaman secara otomatis dalam ±3 detik. Data transaksi tidak ikut terhapus.

### 1.9 Ringkasan perubahan

**1. Tampilan baru "Aurora":** bilah kiri dan bilah atas memakai gradasi warna yang menyambung dari kiri ke kanan, kartu dan tombol lebih bulat, huruf Plus Jakarta Sans yang lebih mudah dibaca, ikon di setiap menu, dan kartu sapaan bergradasi di Beranda. **2. Chat Internal baru:** tampilan dua kolom seperti aplikasi pesan, status **Online (live) / Sibuk / Offline** setiap petugas, penanda pesan belum dibaca per percakapan, pemisah tanggal, Enter untuk kirim, dan bisa chat pribadi dengan Super Admin. **3. Loading lebih ringan:** aplikasi dibuka dari salinan di perangkat, data dimuat bersamaan, dan menu yang dibuka ulang tidak mengunduh data yang sama berkali-kali.

### 1.10 Tombol status di bilah atas

Di kanan atas sekarang ada tombol bulat bertuliskan **Online** dengan titik hijau. Klik untuk memilih **Online** (siap membalas), **Sibuk** (sedang melayani konsumen/tidak bisa membalas cepat), atau **Offline** (tampil offline untuk petugas lain). Titik kecil di foto profil Anda ikut berubah warna. Lihat topik **Chat & Status** untuk penjelasan lengkap.

### 1.11 Kartu sapaan di Beranda

Bagian paling atas Beranda menampilkan salam sesuai jam (pagi/siang/sore/malam), nama Anda, tanggal lengkap, ringkasan hari ini (omzet dan jumlah motor di bengkel, bila peran Anda boleh melihatnya), serta maksimal empat tombol pintas: **Motor masuk**, **Jual part**, **Pembayaran**, **Cek stok**, atau **Chat**. Tombol pintas hanya muncul untuk menu yang memang boleh Anda buka.

### 1.12 Apa yang lebih cepat

**Membuka aplikasi:** file aplikasi tidak lagi diunduh satu per satu dari internet setiap kali dibuka; versi baru diunduh diam-diam di belakang layar. **Setelah login:** data cabang, hak akses, dan data petugas dibaca bersamaan. Aplikasi terbuka paling lama ±3,5 detik walau sinyal lemah; data yang belum datang akan langsung mengisi layar begitu tiba. **Menu yang sering dibuka:** daftar petugas dan data nota periode lama (Laporan, Performa Mekanik, Klaim KSG, Penghasilan) disimpan sementara 60 detik, sehingga berpindah menu lalu kembali terasa instan. **Chat:** pesan sudah terunduh sejak login, jadi Chat langsung tampil tanpa loading.

### 1.13 Apakah ada yang berubah pada cara kerja transaksi?

Tidak. Registrasi, order part, pembayaran, stok, kas, retur, absensi, penghasilan, dan laporan bekerja sama seperti sebelumnya. Perubahan hanya pada tampilan, Chat, dan cara data dimuat. Semua tombol, menu, dan hak akses tetap di tempat yang sama.

### 1.14 Yang perlu dilakukan Super Admin setelah update

**1.** Publish ulang **firestore.rules** (berisi aturan baru koleksi `presence` untuk status Online/Sibuk/Offline). Tanpa ini aplikasi tetap jalan, tetapi semua petugas akan terlihat Offline. **2.** Deploy **firestore.indexes.json** (dua index baru untuk koleksi `chat`) supaya pesan selalu diambil dari yang terbaru. Tanpa index, Chat otomatis memakai cara lama sehingga tetap berfungsi. **3.** Minta semua perangkat menekan **Update aplikasi** sekali.

---

## 2. Umum — semua pengguna

_Cara masuk, memahami tampilan, keamanan akun, tombol cepat, dan aturan dasar penggunaan._

### 2.1 Cara masuk sebagai petugas

**1.** Buka **www.amuservice.id/pos**. **2.** Pilih nama Anda. **3.** Masukkan PIN 6 angka. **4.** Tekan **Masuk**. Jangan memakai akun orang lain karena setiap registrasi, perubahan, pembayaran, stok, dan persetujuan dicatat atas nama akun yang sedang masuk.

### 2.2 Cara masuk sebagai super admin

Super admin masuk memakai email dan kata sandi. Tindakan sensitif seperti membatalkan nota, menghapus data, mengubah data penting, atau menyetujui stok opname dapat meminta kata sandi lagi.

### 2.3 Memahami tampilan aplikasi

Menu di bilah kiri (bergradasi warna, lengkap dengan ikon) adalah modul yang boleh dibuka oleh peran Anda. Bilah atas melanjutkan gradasi tersebut dan berisi judul halaman, cabang, tombol status Online/Sibuk/Offline, foto profil, dan jam. **Beranda** berisi kartu sapaan dan ringkasan. Angka bulat kuning di samping menu atau angka merah di kotak berarti ada pekerjaan yang perlu ditindaklanjuti. Menu **Panduan Penggunaan** membuka halaman bantuan ini. Penjelasan lengkap ada di topik **Tampilan** dan **Fungsi setiap menu**.

### 2.4 Pencarian panduan

Ketik kata seperti **BAST**, **KSG**, **transfer**, **stok**, **nota**, **PIN**, atau **absensi** di kotak pencarian. Hasil akan menampilkan topik dan langkah yang mengandung kata tersebut. Hapus kata pencarian untuk melihat seluruh panduan yang tersedia bagi Anda.

### 2.5 Tombol cepat keyboard

`F1` membuat data baru, `F2` menyimpan atau mengirim, `F3` memfokuskan pencarian, `F8` membuka/cetak nota terakhir, dan `Esc` menutup dialog. Di HP, gunakan tombol yang tampil di layar.

### 2.6 Konfirmasi tindakan penting

Baca dialog sebelum menyetujui. Konfirmasi digunakan untuk pembayaran, status selesai, tunda, transfer, penerimaan barang, stok opname, penghapusan, pembatalan nota, dan keluar akun. Jika ragu, tekan **Batal**.

### 2.7 Menyimpan pekerjaan

Jika tombol masih bertuliskan **Simpan** atau berwarna kuning, perubahan belum masuk database. Tekan tombol simpan dan tunggu pesan berhasil. Jangan menutup halaman saat indikator masih menyimpan. Jika muncul pesan gagal, catat nomor dokumen dan laporkan ke admin.

### 2.8 Keluar dan tombol kembali

Gunakan tombol **Keluar** di aplikasi. Tombol kembali HP/browser dapat menampilkan pilihan kembali ke menu, keluar, atau batal. Bila ada formulir yang belum disimpan, simpan dulu atau batalkan dengan sadar.

### 2.9 Absensi saya

Buka **Absensi Saya**, tekan **📷 Scan QR absen masuk**, arahkan kamera ke QR di layar absensi bengkel, lalu ikuti instruksi selfie. QR berubah berkala dan biasanya hanya dapat dipakai di lokasi bengkel. Saat selesai bekerja, tombol yang sama menjadi **Scan QR absen pulang**; jangan lupa scan pulang karena dapat memengaruhi uang hadir. Jika ganti HP, minta admin/super admin mereset perangkat.

### 2.10 Penghasilan saya

Menu **Penghasilan Saya** hanya menampilkan data Anda: gaji pokok, insentif sparepart/jasa/biaya lain, uang hadir, rincian BPJS dan potongan absensi, slip, THR, dan bonus yang sudah diterbitkan. Jika angka tidak sesuai, jangan mengubah sendiri; sampaikan periode dan bagian yang salah kepada admin.

### 2.11 Cek servis konsumen

Konsumen dapat membuka **www.amuservice.id** memakai nomor polisi dan nomor HP yang terdaftar. Pastikan nomor HP benar agar link cek servis dan pengingat WhatsApp tidak salah penerima.

### 2.12 Aturan keamanan data

Jangan membagikan PIN, kata sandi, data NIK, atau screenshot transaksi ke pihak yang tidak berkepentingan. Jangan menghapus atau mengubah data untuk memperbaiki kesalahan tanpa mengikuti alur koreksi. Semua perubahan penting dapat masuk log aktivitas.

---

## 3. Tampilan, navigasi & kecepatan

_Penjelasan lengkap bagian-bagian layar 5.19.0, cara berpindah menu, tema dan mode gelap, foto profil, cabang, memasang aplikasi, memperbarui aplikasi, serta cara kerja loading data._

### 3.1 Bagian-bagian layar

**Bilah kiri (sidebar)**: nama toko, daftar menu yang dikelompokkan (Utama, Komunikasi, Bengkel, Sparepart, Kasir, Keuangan, Pengaturan, Akun Saya, Bantuan), lalu bagian bawah berisi nama dan peran Anda, tombol **Ganti PIN**, **Keluar**, **Pasang aplikasi**, **Update aplikasi**, **Mode gelap/terang**, dan nomor versi. **Bilah atas**: tombol menu (☰), judul halaman, pilihan cabang (admin) atau nama cabang, tombol status, foto profil, serta jam. **Bilah tombol cepat**: tombol F1/F2/F3/F8 yang hanya muncul bila berguna di halaman itu. **Area kerja**: isi menu yang sedang dibuka.

### 3.2 Gradasi warna bilah kiri dan atas

Bilah kiri berwarna gradasi dari atas ke bawah, dan bilah atas melanjutkan warna tersebut dari kiri ke kanan sehingga keduanya tampak menyatu. Warna gradasi mengikuti tema yang dipilih Super Admin (Biru Segar, Biru Klasik, Hijau Tosca, Ungu, Merah Marun, Gelap, atau Kaca). Kartu sapaan Beranda, gelembung chat Anda, tombol utama, dan garis warna di atas kartu ringkasan memakai warna yang sama.

### 3.3 Ikon menu dan menu aktif

Setiap menu memiliki ikon garis agar mudah dikenali. Menu yang sedang dibuka tampil sebagai kartu putih terang di bilah kiri. Angka bulat kuning di samping menu (mis. Persetujuan, Chat, Cek Stok) menandakan ada hal yang perlu ditindaklanjuti.

### 3.4 Menyembunyikan dan membuka menu

Di PC/laptop, tekan tombol **☰** di kiri atas untuk menyembunyikan bilah kiri agar area kerja lebih lebar; tekan lagi untuk menampilkan. Pilihan ini diingat di perangkat. Di HP tidak ada bilah kiri; gunakan **bilah menu bawah** dan tombol **Menu** (lihat Memakai aplikasi di HP).

### 3.5 Mode gelap dan tema

Tombol **☾ Mode gelap** / **☀ Mode terang** di bilah kiri bawah (dan di layar login) mengganti tampilan di perangkat Anda saja. Tema warna untuk semua perangkat dipilih Super Admin di **Master Data → Tema Tampilan**. Tema **Otomatis** mengikuti mode gelap/terang HP atau PC. Tema **Kaca** paling berat untuk PC/HP lama; pilih tema lain bila perangkat terasa lambat.

### 3.6 Foto profil

Klik foto/inisial Anda di kanan atas, pilih foto dari galeri atau kamera. Foto diperkecil otomatis lalu disimpan. Titik kecil di sudut foto menunjukkan status Anda (hijau Online, oranye Sibuk, abu-abu Offline).

### 3.7 Berpindah cabang (admin)

Admin dan Super Admin melihat pilihan **Cabang** di bilah atas bila ada lebih dari satu cabang. Memilih cabang lain mengganti data yang tampil (stok, WO, nota, pembelian) dan mengosongkan draf yang belum disimpan milik cabang sebelumnya. Petugas lain hanya melihat nama cabangnya sendiri.

### 3.8 Memasang aplikasi di HP / PC

Tekan **Pasang aplikasi** (bilah kiri bawah atau layar login) bila tombolnya muncul. Di iPhone/iPad: buka di Safari, ketuk tombol Bagikan, pilih **Tambah ke Layar Utama**. Setelah terpasang, aplikasi terbuka tanpa bilah alamat browser dan lebih cepat dibuka.

### 3.9 Memperbarui aplikasi

Versi baru biasanya terpasang otomatis pada pembukaan berikutnya. Jika setelah pengumuman update tampilan masih lama, tekan **Update aplikasi**. Aplikasi mengosongkan salinan lama di perangkat, mengambil versi terbaru, lalu memuat ulang sendiri (paling lama ±3 detik). Login dan data tidak hilang.

### 3.10 Cara kerja loading 5.19.0

**File aplikasi** dibuka dari salinan di perangkat (instan) dan diperbarui di belakang layar. **Halaman utama** tetap dicek ke internet dulu maksimal 2,5 detik agar update terdeteksi. **Data** (nota hari ini, WO, part, pengaturan) dipantau realtime: aplikasi terbuka setelah data siap atau paling lama ±3,5 detik, sisanya langsung mengisi layar ketika datang. **Master jasa & mekanik** ditampilkan dari salinan di perangkat dulu, lalu diperbarui dari server. **Data periode lama** dan **daftar petugas** disimpan sementara 60 detik di memori; perubahan nota hari ini membersihkan simpanan nota secara otomatis.

### 3.11 Animasi loading

Animasi roda gigi hanya muncul bila data benar-benar perlu ditunggu (lebih dari ±0,2 detik). Jika data sudah ada di perangkat, layar langsung tampil tanpa berkedip. Bila roda gigi berputar lebih dari 15 detik, lihat topik **Aplikasi loading terus** di Masalah umum & solusi.

### 3.12 Memakai aplikasi di HP

Di HP, menu ada di **bilah bawah layar**: 4 menu utama sesuai peran dan tombol **Menu** untuk semua menu lain, profil, status, Ganti PIN, Update aplikasi, Mode gelap, dan Keluar. Bilah atas berisi judul halaman (dipotong dengan … bila panjang), pilihan cabang ringkas (admin), tombol status, dan foto profil. Deretan tab dan tombol periode yang tidak muat dapat **digeser ke kiri/kanan**; tabel lebar digeser di dalam kotaknya. Dialog muncul dari bawah layar. Tombol Kembali HP menutup lembar Menu yang terbuka. Agar terasa seperti aplikasi penuh, pasang ke layar utama lewat **Menu → Pasang aplikasi** (Android) atau Safari → Bagikan → Tambah ke Layar Utama (iPhone).

### 3.13 Tips agar aplikasi tetap ringan

Tutup tab aplikasi yang ganda (cukup satu tab /pos per perangkat). Pasang aplikasi ke layar utama. Gunakan tema selain Kaca di perangkat lama. Pada Laporan, pilih rentang tanggal secukupnya (harian/bulanan) daripada rentang sangat panjang. Di Stok Part, gunakan pencarian/filter daripada menggulir ribuan baris. Tekan Update aplikasi hanya bila diminta atau bila tampilan tidak berubah setelah pengumuman update.

---

## 4. Fungsi setiap menu

_Daftar lengkap seluruh menu aplikasi: kegunaan, peran yang biasanya dapat membuka, dan fungsi utama di dalamnya. Menu yang tampil pada akun Anda dapat dibatasi Super Admin melalui Hak Akses Menu._

### 4.1 Beranda

**Peran bawaan:** Admin, Registrasi, Sparepart, Kasir, Service Advisor. **Fungsi:** kartu sapaan dan tombol pintas; kotak ringkasan **Omzet hari ini**, **Part terjual**, **Motor masuk bengkel**, **Stok menipis** (kotak yang tampil per peran diatur Super Admin); grafik omzet 7 hari (klik batang untuk melihat nota hari itu); **Status mekanik**; **Antrian bengkel** (klik motor untuk membuka pembayaran atau riwayat); **Perlu dipesan ulang**. Klik setiap kotak untuk melihat rinciannya.

### 4.2 Persetujuan

**Peran:** Admin/Super Admin. **Fungsi:** daftar hal yang menunggu keputusan: **Pembatalan nota**, **Stok opname**, dan **Aktivasi layar QR absen**. Tombol **Periksa**, **Setujui**, **Tolak**, atau **Cabut**. Angka di menu menunjukkan jumlah yang menunggu.

### 4.3 Chat Internal

**Peran:** sesuai centang Hak Akses Menu (Super Admin selalu). **Fungsi:** ruang Umum, chat pribadi lintas cabang, status Online/Sibuk/Offline, penanda belum dibaca, notifikasi suara, transkrip Excel (Super Admin). Lihat topik **Chat & Status**.

### 4.4 Registrasi Servis

**Peran:** Admin, Registrasi. **Fungsi:** menerima motor masuk, mencari data konsumen lama, data KTP/STNK, KM, keluhan, pilihan KSB/KSG, mekanik, nomor antrean, nomor cepat saat ramai, rincian jasa/part/biaya lainnya, BAST kendaraan, menerima laporan selesai/tunda dari mekanik, membatalkan pendaftaran.

### 4.5 Konsumen & Kendaraan

**Peran:** Admin, Registrasi. **Fungsi:** daftar konsumen dan motornya, **+ Konsumen baru**, **Tambah motor**, ubah data, tandai **Perlu dicek**, **Gabungkan** konsumen ganda, **Pindahkan** motor ke pemilik lain, hapus data pribadi atas permintaan, serta **Daftar & Cetak** berdasarkan periode.

### 4.6 Riwayat Kendaraan

**Peran:** Admin, Registrasi, Kasir, Sparepart, Service Advisor. **Fungsi:** cari nomor polisi untuk melihat data kendaraan, pemilik, servis yang sedang berjalan, dan seluruh riwayat servis; klik baris untuk rincian jasa, part, dan biaya. Plat yang sudah berganti otomatis diarahkan ke plat baru.

### 4.7 Pengingat Servis

**Peran:** Admin, Registrasi, Kasir. **Fungsi:** daftar jadwal ganti oli berikutnya, tombol **WA ingatkan**, **Tunda 14 hari**, **Ganti di luar**, **Stop**/**Aktifkan lagi**, pengaturan jangka pengingat, dan **Bangun jadwal dari nota lama**.

### 4.8 Order Sparepart

**Peran:** Admin, Sparepart. **Fungsi:** memasukkan part yang dipakai untuk WO servis, memeriksa stok, menyimpan order agar muncul di Register dan Pembayaran.

### 4.9 Pembayaran & Status Servis

**Peran:** Admin, Kasir. **Fungsi:** daftar motor di bengkel, membuka WO berstatus Selesai, memeriksa total jasa/part/biaya/KSG, menerima cash/transfer, mencetak nota.

### 4.10 Performa Mekanik

**Peran:** Admin, Mekanik, Service Advisor. **Fungsi:** pekerjaan saat ini, motor selesai per periode, waktu servis, rata-rata waktu per tipe motor, rincian nilai pekerjaan, target dan pencapaian insentif.

### 4.11 Cek Stok

**Peran:** Admin, Registrasi, Kasir, Sparepart, Mekanik. **Fungsi:** mencari stok part di cabang sendiri dan cabang lain, **Minta kirim** dari cabang lain, melihat **Permintaan masuk** (Kirim/Tolak) dan menerima kiriman di Stok Part.

### 4.12 Penjualan Sparepart

**Peran:** Admin, Kasir. **Fungsi:** menjual part langsung atau membayar **Pesanan Part Pribadi** dari Sparepart, scan barcode/ketik kode, cash/transfer, cetak nota, serta pengajuan **Retur setelah pembayaran**.

### 4.13 Pesanan Part Pribadi

**Peran:** Admin, Sparepart. **Fungsi:** membuat pesanan part atas nama pemesan dan nomor HP, harga/diskon/Add Price per item, mencetak pesanan untuk cek konsumen, membatalkan sebelum bayar dengan alasan. Pembayaran tetap di menu Penjualan Sparepart milik Kasir.

### 4.14 Stok Part

**Peran:** Admin, Sparepart. **Fungsi:** daftar part dengan pencarian, filter kategori/stok menipis, urut kolom, ubah harga beli/jual/Add Price/minimum, tambah part, Import Excel, kartu stok (mutasi), transfer antar cabang dan BAST transfer, export data.

### 4.15 Stok Opname

**Peran:** Admin, Sparepart. **Fungsi:** **+ Mulai opname**, menghitung fisik per part, **Ajukan ke super admin**; Super Admin dapat **Setujui & sesuaikan stok** atau **Tolak**.

### 4.16 Pembelian Stok

**Peran:** Admin, Sparepart. **Fungsi:** mencatat pembelian dari supplier, menambah stok, harga beli, dan riwayat pembelian per cabang.

### 4.17 Laporan Penjualan

**Peran:** Admin, Kasir, Service Advisor. **Fungsi:** pilihan **Harian, Mingguan, Bulanan, Tahunan, Custom**; kotak Total omzet, Penjualan part, Jasa servis, Klaim KSG (klik untuk menyaring); omzet per cabang; part terlaris; daftar nota (buka nota untuk **Ajukan pembatalan**/retur sesuai hak akses); **Unduh laporan Excel** atau **PDF**.

### 4.18 Kas & Pengeluaran

**Peran:** Admin, Kasir. **Fungsi:** tab **Kas harian** (uang laci awal, cash masuk, setor/tarik bank, saldo laci yang diharapkan, **Tutup kas** dan modal besok) dan tab **Pengeluaran** (pengeluaran tunai/transfer).

### 4.19 Klaim KSG

**Peran:** Admin, Kasir. **Fungsi:** daftar servis KSG per bulan, nilai klaim ke main dealer, pencatatan pembayaran klaim.

### 4.20 Insight Konsumen

**Peran:** Admin. **Fungsi:** konsumen terbaik, kunjungan servis per hari/bulan, jenis servis, tipe motor, jenis kelamin, usia, wilayah (kabupaten/kecamatan), daftar perlu diingatkan servis, unduh Excel.

### 4.21 Backup Data

**Peran:** Super Admin. **Fungsi:** **⬇ Backup sekarang** (file seluruh koleksi) dan **Pulihkan dari backup** untuk data terpilih. Lakukan minimal seminggu sekali.

### 4.22 Master Data

**Peran:** Admin (sebagian tab khusus Super Admin). **Tab:** Jasa Servis, Tarif KSG, Mekanik, Rekening, Tipe Motor, Petugas & PIN, Layar TV, Cabang, Insentif & Potongan, Logo, Tema Tampilan, Hak Akses Menu, Riwayat Perubahan Konsumen, Log Aktivitas.

### 4.23 Absensi Saya / Absensi Karyawan

**Petugas:** tombol **Scan QR absen masuk/pulang**, selfie, riwayat absensi per bulan, **👁 Pratinjau** dan **⬇ PDF absensi** pribadi. **Super Admin (Absensi Karyawan):** tab Harian, Rekap bulanan (dengan pratinjau/PDF per karyawan), Layar QR, HP terdaftar, dan Pengaturan.

### 4.24 Penghasilan Saya / Penghasilan Karyawan

**Petugas:** gaji pokok, insentif, uang hadir, potongan, slip gaji PDF, THR & bonus milik sendiri. **Super Admin:** rekap seluruh karyawan, **Kunci bulan** untuk menerbitkan slip, unduh Excel, THR & Bonus karyawan.

### 4.25 Panduan Penggunaan

**Peran:** semua (tidak dapat dimatikan). **Fungsi:** pusat bantuan ini, pencarian kata kunci lintas topik, dan tombol **Cetak**.

---

## 5. Chat Internal & Status Online

_Cara memakai Chat Internal 5.19.0: ruang Umum, chat pribadi (termasuk dengan Super Admin), status Online/Sibuk/Offline, penanda belum dibaca, notifikasi suara, mode pantau dan transkrip Super Admin._

### 5.1 Siapa yang bisa membuka Chat?

Chat Internal muncul di menu kiri bagian **Komunikasi** hanya bila Super Admin mencentang **Chat Internal** untuk peran Anda di **Master Data → Hak Akses Menu**. Super Admin selalu dapat membuka Chat. Jika menu Chat tidak terlihat, minta Super Admin memberi akses lalu tekan **Update aplikasi** atau muat ulang halaman.

### 5.2 Mengenal layar Chat

Layar Chat terbagi dua. **Kolom kiri** berisi judul **Chat** dan jumlah petugas yang sedang online, kotak **Cari petugas atau cabang**, lalu daftar percakapan: **Umum · semua petugas** di paling atas, kelompok **Percakapan** (petugas yang pernah Anda ajak chat, urut dari pesan terbaru), dan kelompok **Petugas** (yang belum pernah diajak chat, urut dari yang online). **Kolom kanan** menampilkan isi percakapan yang dipilih, dengan kepala berisi nama, status, peran, dan cabang lawan bicara. Di HP, daftar dan isi percakapan tampil bergantian: ketuk nama untuk membuka, ketuk tombol **‹** di kiri atas untuk kembali ke daftar.

### 5.3 Ruang Umum

Klik **Umum · semua petugas**. Pesan di sini terlihat oleh semua petugas yang memiliki akses Chat di semua cabang. Gunakan untuk pengumuman, koordinasi stok, atau informasi motor selesai. Kepala percakapan menampilkan jumlah petugas online dan foto inisial beberapa petugas yang sedang online.

### 5.4 Chat pribadi

Klik nama petugas di kolom kiri. Pesan pribadi hanya dapat dibaca oleh Anda dan petugas tersebut (Super Admin dapat membaca untuk audit). Chat pribadi bisa antarpetugas satu cabang maupun lintas cabang. Mulai 5.19.0 tersedia juga kontak **Super Admin** sehingga petugas dapat bertanya langsung kepada pemilik.

### 5.5 Mengirim pesan

Ketik di kotak **Tulis pesan…** di bawah. Tekan `Enter` atau tombol kirim bulat untuk mengirim. Tekan `Shift`+`Enter` untuk membuat baris baru. Kotak tulisan membesar otomatis untuk pesan panjang (maksimal 2.000 karakter). Huruf ditulis apa adanya (tidak diubah menjadi kapital). Jika muncul pesan _gagal dikirim_, teks Anda dikembalikan ke kotak tulisan sehingga dapat dikirim ulang.

### 5.6 Membaca percakapan

Pesan Anda tampil di kanan dengan gelembung bergradasi. Pesan orang lain tampil di kiri dengan inisial, nama, peran, dan cabang pengirim. Pesan berurutan dari orang yang sama dalam 5 menit digabung agar rapi. Pemisah **Hari ini**, **Kemarin**, atau tanggal lengkap memudahkan mencari pesan lama. Jam kirim tampil di pojok gelembung; arahkan kursor ke jam untuk melihat tanggal dan jam lengkap.

### 5.7 Status Online, Sibuk, Offline

Setiap petugas memiliki titik status: **hijau = Online** (aplikasi sedang terbuka dan siap membalas; di kepala percakapan tertulis **Online · live** dengan titik berkedip), **oranye = Sibuk** (sedang melayani, balasan mungkin lambat), **abu-abu = Offline** (aplikasi tidak dibuka, atau petugas memilih tampil offline). Untuk petugas offline ditampilkan keterangan seperti _aktif 12 menit lalu_.

### 5.8 Mengganti status Anda

Klik tombol status di kanan atas (bertuliskan Online/Sibuk/Offline). Pilih status yang sesuai. Pilihan Anda diingat di perangkat ini dan dikirim ke server, sehingga petugas lain langsung melihatnya saat membuka Chat. Di HP, tombol status hanya menampilkan titik warna untuk menghemat tempat.

### 5.9 Bagaimana status dihitung otomatis

Selama aplikasi terbuka dan layarnya terlihat, perangkat mengirim tanda aktif kecil setiap 2,5 menit memakai jam server (jam HP yang salah tidak memengaruhi). Jika tidak ada tanda aktif lebih dari **6 menit** (misalnya aplikasi ditutup, HP terkunci, atau tab disembunyikan), status Anda otomatis menjadi **Offline**. Saat Anda menekan **Keluar** atau menutup halaman, status langsung diubah ke Offline. Ketika aplikasi dibuka lagi, status kembali sesuai pilihan terakhir Anda.

### 5.10 Penanda belum dibaca

Angka bulat di samping menu **Chat Internal** (bilah kiri) adalah total pesan belum dibaca dari ruang Umum dan chat pribadi Anda. Di dalam Chat, setiap percakapan memiliki angka sendiri, nama dan cuplikan pesannya tampil tebal. Pesan dianggap dibaca ketika percakapan tersebut dibuka. Penanda baca disimpan per perangkat; membuka Chat di HP tidak menghapus angka di PC.

### 5.11 Notifikasi suara

Centang **Bunyi notifikasi pesan baru** di bawah kolom kiri untuk mendengar bunyi pendek setiap ada pesan masuk dari orang lain (ruang Umum atau chat pribadi Anda), walau Anda sedang membuka menu lain. Hilangkan centang untuk mematikan. Pengaturan ini berlaku per perangkat dan diingat walau aplikasi ditutup.

### 5.12 Mencari petugas

Ketik nama, peran, atau nama cabang di kotak **Cari petugas atau cabang**. Daftar langsung tersaring. Hapus tulisan untuk melihat semua kembali.

### 5.13 Aturan penggunaan chat

Pesan adalah **log permanen**: tidak dapat diedit atau dihapus oleh siapa pun, termasuk Super Admin. Tulis dengan sopan dan jelas. Jangan mengirim PIN, kata sandi, NIK lengkap, atau data pribadi konsumen yang tidak perlu. Untuk keputusan resmi (pembatalan nota, retur, perubahan stok) tetap gunakan menu dan alur persetujuan aplikasi; chat hanya untuk koordinasi.

### 5.14 Mode pantau Super Admin

Super Admin melihat kelompok tambahan **Pantau percakapan petugas** berisi chat pribadi antarpetugas lain (judul _Nama A ↔ Nama B_, ikon mata). Percakapan ini hanya dapat dibaca; kotak tulisan diganti keterangan **Mode pantau**. Pesan pantauan tidak dihitung sebagai belum dibaca.

### 5.15 Transkrip Excel (Super Admin)

Tombol **⬇ Excel** di kolom kiri atas hanya tampil untuk Super Admin. File berisi kolom Waktu, Ruang, Lawan, Pengirim, Peran, Cabang, dan Pesan, lengkap dengan garis kotak dan filter, diurutkan dari pesan terlama. Maksimal 5.000 pesan terakhir per unduhan.

### 5.16 Berapa banyak pesan yang ditampilkan?

Agar tetap ringan, Chat memuat 300 pesan Umum terbaru dan 500 pesan pribadi terbaru (Super Admin: 600). Pesan yang lebih lama tetap tersimpan permanen di database dan ikut terunduh dalam transkrip Excel Super Admin.

---

## 6. Registrasi Servis

_Menerima motor, mencatat konsumen/kendaraan, membuat antrean, mengatur mekanik, BAST, dan menerima laporan selesai/tunda._

### 6.1 Alur kerja singkat

**Motor datang → cari data lama → isi konsumen/kendaraan → pilih KSB/KSG → pilih mekanik → simpan → nomor antrean tampil → mekanik bekerja → mekanik melapor ke Register → Register menekan Selesai/Tunda → BAST dan pembayaran diproses.**

### 6.2 Membuat pendaftaran baru

Buka **Registrasi Servis → + Motor masuk** atau tekan `F1`. Isi data sesuai KTP dan STNK. Nomor polisi wajib diisi. Pilih tipe motor, isi KM, keluhan, jenis layanan, dan mekanik bila sudah tersedia. Tekan `F2` untuk menyimpan dan membuat nomor antrean.

### 6.3 Mencari data konsumen lama

Tekan `F3` atau gunakan kotak **Pernah servis di sini?**. Cari dengan sebagian nomor polisi, nama, nomor HP, NIK, nomor rangka, atau nomor mesin. Klik **Pakai data** jika konsumen dan motor sama. Klik **Pakai konsumen** atau **Konsumen saja** jika konsumennya sama tetapi motornya berbeda. Periksa kembali semua data sebelum menyimpan.

### 6.4 Data konsumen yang wajib diperiksa

Nama harus sesuai KTP. Isi NIK 16 angka bila tersedia, nomor HP/WA, tempat/tanggal lahir, jenis kelamin, pekerjaan, alamat, RT/RW, provinsi, kabupaten/kota, kecamatan, dan kelurahan. Salah nomor HP dapat membuat konsumen tidak menerima notifikasi atau membuka riwayat yang salah.

### 6.5 Data kendaraan yang wajib diperiksa

Periksa nomor polisi, nama pemilik di STNK, tipe, tahun, warna, nomor rangka, nomor mesin, dan KM. Jika nama STNK sama dengan konsumen, biarkan pilihan **sama dengan konsumen**. Jika berbeda, hilangkan centang dan isi nama STNK.

### 6.6 KM kendaraan

Aplikasi menampilkan KM terakhir. KM baru tidak boleh lebih kecil. Jika speedometer diganti atau di-reset, admin harus menyimpan dengan catatan alasan. Jangan menurunkan KM hanya agar pengingat servis berubah.

### 6.7 Pilihan KSB dan KSG

Untuk pendaftaran baru, pilih **KSB** atau **KSG**. KSB adalah kartu service berkala. KSG adalah kartu service gratis dan wajib memilih **KSG ke-1 sampai ke-12** (sesuai kolom Tarif KSG di Master Data) serta nomor kupon/buku servis bila tersedia. Data WO lama Reguler tetap dapat dibuka untuk menjaga riwayat.

### 6.8 Aturan KSG

Setelah memilih KSG, checklist jasa standar tidak ditampilkan dan jasa KSG otomatis dianggap gratis. Nilai klaim diambil dari **Master Data → Tarif KSG** sesuai tipe motor dan KSG ke-berapa. Part serta biaya/jasa tambahan yang memang bukan bagian KSG tetap terlihat dan dapat ditagihkan sesuai kebijakan bengkel.

### 6.9 Rincian jasa dan part

Bagian **Jasa servis/Jasa lainnya** menunjukkan jasa yang dipilih. Bagian **Rincian part** menampilkan kode, nama, jumlah, stok, dan nilai part yang sudah di-order untuk motor tersebut. Jika part belum terlihat, pastikan bagian Sparepart sudah menyimpan order dengan nomor WO yang benar.

### 6.10 BAST kendaraan

Pada Register KSB/KSG tersedia bagian **BAST kendaraan**. Isi estimasi selesai/pengambilan secara manual, tanggal, jam, dan keterangan. Kode BAST otomatis menjadi **KSB** atau **KSG1–KSG4** dan muncul di pojok kanan atas. Tekan **Preview BAST**, lalu **Print / Simpan PDF**. BAST dibawa konsumen saat mengambil kendaraan.

### 6.11 Memilih mekanik

Pilih mekanik yang berstatus kosong. Mekanik yang sedang mengerjakan motor lain tidak dapat dipilih. Jika belum ada mekanik, simpan tanpa mekanik sehingga statusnya **Antri**. Saat mekanik kosong, buka motor antri, pilih mekanik, lalu tekan **Simpan perubahan**.

### 6.12 Status motor

**Antri** berarti menunggu mekanik. **Dikerjakan** berarti ada mekanik yang menangani. **Ditunda** berarti pekerjaan berhenti sementara dan mekanik kembali kosong. **Selesai** berarti laporan mekanik sudah diterima Register dan menunggu pembayaran. **Lunas** berarti pembayaran selesai.

### 6.13 Menerima laporan mekanik

Mekanik melapor kepada Register, bukan Kasir. Pada motor berstatus Dikerjakan, Register memilih **Motor selesai** jika pengerjaan selesai atau mengisi alasan lalu memilih **Lanjut lama (tunda)**. Alasan tunda wajib, misalnya _tunggu part_ atau _konsumen ambil besok_. Kedua pilihan membuat mekanik kosong. Motor selesai memicu pemanggilan nomor antrean di layar TV.

### 6.14 Melanjutkan motor yang ditunda

Buka tab **Ditunda**, pilih motor, pilih mekanik yang kosong, lalu tekan **Lanjutkan dikerjakan**. Mekanik boleh sama atau berbeda. Aplikasi menyimpan waktu kerja masing-masing mekanik dan alasan tunda.

### 6.15 Nomor cepat saat ramai

Jika antrean panjang, gunakan **Nomor cepat (cukup nopol)**. Nomor antrean langsung dibuat, tetapi motor diberi tanda **Data belum lengkap**. Lengkapi data sebelum pembayaran atau sebelum pekerjaan membutuhkan informasi teknis.

### 6.16 Motor terdaftar dua kali

Satu nomor polisi hanya boleh mempunyai satu servis aktif. Jika muncul peringatan, jangan membuat pendaftaran kedua. Tekan **Buka servis** untuk memperbaiki WO yang sudah ada.

### 6.17 Ganti plat atau pemilik

Jika kendaraan berganti nomor polisi, gunakan alur **Ganti nomor polisi** agar riwayat tetap tersambung. Jika motor sudah menjadi milik orang lain, pilih **Ganti pemilik** dan isi alasan setelah memeriksa STNK. Jika orang lain hanya mengantar, pilih **Hanya mengantar** agar pemilik tetap benar.

### 6.18 Pengingat ganti oli

Buka **Pengingat Servis**. Tab **Perlu diingatkan** berisi motor yang sudah mencapai batas KM atau hari. Gunakan **WA ingatkan**. Jika konsumen sudah ganti oli di tempat lain, catat tanggal dan KM pada **Ganti di luar**. Gunakan **Tunda 14 hari** bila belum ingin diingatkan atau **Stop** bila motor sudah dijual/pindah.

---

## 7. Kasir

_Menerima pembayaran servis atau penjualan part, mencetak nota, mengelola kas, dan memantau klaim._

### 7.1 Batas tugas Kasir

Kasir berfokus pada **klik bayar**: cash atau transfer. Tambahan biaya, jasa, part, diskon, jenis layanan, dan finalisasi pekerjaan dilakukan di Register sesuai alur bengkel. Kasir tidak menekan Selesai/Tunda untuk laporan mekanik.

### 7.2 Membayar servis

Buka **Pembayaran & Status Servis**, pilih motor berstatus **Selesai**, periksa nama konsumen, nomor polisi, rincian jasa, part, biaya lain, diskon, total, dan jenis KSG/KSB. Pilih **Cash** atau **Transfer**, pilih rekening bila transfer, masukkan nominal, tekan `F2`, periksa dialog konfirmasi, lalu setujui.

### 7.3 KSG saat pembayaran

Untuk KSG, jasa standar gratis untuk konsumen. Part dan biaya/jasa tambahan tetap masuk sesuai data Register. Periksa nilai total sebelum menerima uang. Jika jasa KSG masih muncul sebagai tagihan, hentikan pembayaran dan minta Register memperbaiki jenis servisnya.

### 7.4 Nota pembayaran

Setelah pembayaran berhasil, nota dapat dicetak, diunduh PDF, atau dikirim melalui WhatsApp. Periksa nomor nota, nama, nomor polisi, total, metode bayar, dan link cek servis sebelum menyerahkan nota.

### 7.5 Pembayaran cash

Hitung uang yang diterima, masukkan nominal sebenarnya, dan periksa kembalian. Jangan memasukkan nominal pas jika konsumen memberikan uang lebih. Uang cash setelah kembalian masuk perhitungan kas harian.

### 7.6 Pembayaran transfer

Pastikan transfer benar-benar masuk ke rekening bengkel, pilih rekening yang sesuai, lalu simpan bukti bila prosedur cabang mewajibkan. Jangan menerima berdasarkan screenshot tanpa memeriksa mutasi atau konfirmasi yang sah.

### 7.7 Pesanan part pribadi dari Sparepart

Bagian Sparepart membuka menu khusus **Pesanan Part Pribadi** (bukan Penjualan Sparepart milik Kasir). Menu ini hanya untuk input pesanan dan cetak cek; tidak menampilkan pilihan cash/transfer dan tidak dapat memproses pembayaran. Isi **Nama pemesan**, mengisi **Nama pemesan** dan **Nomor HP**, mencari part, memasukkan jumlah, lalu memeriksa harga dan stok. Tekan **Simpan pesanan & cetak cek**. Lembar cetak diberikan kepada konsumen untuk memeriksa nama part, jumlah, harga, dan total. Pesanan belum dibayar pada tahap ini; pembayaran dilakukan di menu Kasir.

### 7.8 Pemeriksaan pesanan di Kasir

Kasir membuka menu khusus **Penjualan Sparepart**. Hanya menu ini yang menampilkan pembayaran. Kasir melihat bagian **Pesanan dari Sparepart** dan melihat bagian **Pesanan dari Sparepart**. Pilih **Periksa & bayar**, cocokkan barang fisik dengan lembar yang sudah dicek konsumen, lalu terima pembayaran cash atau transfer. Jika ada kesalahan, jangan bayar; tekan **Tidak sesuai**, isi alasan, dan pesanan kembali ke Sparepart untuk diperbaiki.

### 7.9 Peringatan barang part pribadi

Gunakan bahasa yang jelas kepada konsumen: **Harap periksa kembali barang pesanan, nama part, jumlah, dan harganya. Setelah pembayaran dilakukan, barang yang sudah dibeli tidak dapat dikembalikan atau ditukar.** Jangan melanjutkan pembayaran sebelum konsumen menyatakan pesanannya sesuai.

### 7.10 Kesalahan sebelum pembayaran

Jangan membayar WO yang salah. Kembali ke Register untuk memperbaiki data, jasa, part, biaya, atau jenis layanan. Setelah diperbaiki, muat ulang daftar pembayaran dan periksa total lagi.

### 7.11 Pembatalan nota

Nota yang sudah dibayar tidak diedit langsung. Buka nota, pilih **Ajukan pembatalan**, tulis alasan rinci, lalu kirim untuk persetujuan super admin. Jangan membuat nota pengganti sebelum status pembatalan jelas.

### 7.12 Kas harian dan pembelian

Pagi hari buka **Kas & Pengeluaran → Buka kas** dan isi uang awal. Setiap pembayaran servis dan part pribadi otomatis masuk ke transaksi kas: bagian **cash** menambah uang laci setelah memperhitungkan kembalian, sedangkan **transfer** langsung masuk rekening yang dipilih dan tidak menambah laci.

### 7.13 Setor dan tarik uang bank

Saat menyetor uang laci ke bank, gunakan **Setor ke bank** atau isi setoran saat **Tutup kas**. Sistem mencatat uang laci berkurang dan mutasi bank bertambah. Jika mengambil uang dari bank untuk laci, gunakan **Tarik dari bank**; sistem mencatat bank berkurang dan laci bertambah. Periksa tanggal, jumlah, dan keterangan sebelum menyimpan.

### 7.14 Pengeluaran

Buka tab **Pengeluaran**, isi tanggal, kategori, keterangan, nominal, dan sumber dana. Pilih **Tunai** jika uang diambil dari laci; pilih **Transfer / rekening** jika dibayar dari bank. Pengeluaran tunai mengurangi uang yang seharusnya ada di laci, sedangkan pengeluaran transfer tidak melewati laci.

### 7.15 Klaim KSG

Buka **Klaim KSG**, pilih periode, periksa WO/nota KSG, centang dokumen yang diajukan, lalu kirim pengajuan. Saat pembayaran dari main dealer diterima, tekan **Tandai dibayar**, isi tanggal dan jumlah diterima. Sistem menandai nota dan otomatis mencatat penerimaan klaim sebagai **mutasi masuk bank**, bukan uang laci.

---

## 8. Mekanik

_Melihat pekerjaan, mengerjakan kendaraan, meminta part, dan melaporkan selesai atau tunda kepada Register._

### 8.1 Melihat pekerjaan

Buka **Performa Mekanik** dan lihat bagian pekerjaan saat ini. Motor yang diberikan Register akan muncul bersama nomor polisi, tipe, keluhan, dan rincian yang tersedia. Satu mekanik menangani satu motor berstatus Dikerjakan.

### 8.2 Memeriksa pekerjaan sebelum mulai

Cocokkan nomor polisi dengan motor fisik, baca keluhan, cek KM dan kondisi awal, lalu pastikan part yang dibutuhkan sudah diminta. Jika data kendaraan salah, jangan mengubah sembarangan; laporkan kepada Register.

### 8.3 Meminta sparepart

Sampaikan kode/nama part dan jumlah kepada bagian Sparepart. Bagian Sparepart membuat order pada WO yang benar. Jika part tidak tersedia, minta Register menerima laporan tunda dengan alasan yang jelas.

### 8.4 Laporan selesai

Jika motor selesai dikerjakan, lapor kepada Register secara langsung atau melalui prosedur internal bengkel. Register yang menekan **Motor selesai**. Setelah laporan diterima, status berubah Selesai, nomor antrean dipanggil di TV, dan Anda dapat menerima pekerjaan lain.

### 8.5 Laporan tunda

Jika pekerjaan belum bisa dilanjutkan, lapor kepada Register beserta alasan spesifik: menunggu part, menunggu persetujuan, menunggu konsumen, atau alasan teknis. Register wajib mengisi alasan dan menekan **Lanjut lama (tunda)**.

### 8.6 Melanjutkan pekerjaan

Jika motor ditunda lalu part atau persetujuan sudah tersedia, minta Register membuka tab Ditunda dan memilih mekanik yang akan melanjutkan. Jangan mengerjakan WO yang statusnya masih Ditunda tanpa pengaktifan kembali.

### 8.7 Performa dan penghasilan

Menu Performa Mekanik menampilkan pekerjaan selesai, nilai jasa, dan waktu kerja. Menu Penghasilan Saya menampilkan gaji/insentif yang diterbitkan. Tunda tidak dihitung sebagai waktu kerja aktif.

### 8.8 Absensi

Gunakan Absensi Saya untuk scan QR datang dan pulang. Pastikan status berhasil tersimpan sebelum meninggalkan layar. Jika QR gagal, laporkan waktu kejadian kepada admin, jangan meminjam akun mekanik lain.

---

## 9. Service Advisor

_Panduan peran Service Advisor (pimpinan/head mekanik): memantau bengkel, performa mekanik, laporan, dan insentif per kategori._

### 9.1 Tugas utama

Service Advisor memimpin dan mengawasi mekanik: memastikan antrean bergerak, kualitas pekerjaan, ketepatan waktu, dan membantu Register/Kasir bila ada kendala teknis. Halaman pertama setelah login adalah **Performa Mekanik**.

### 9.2 Menu yang tersedia

Bawaan: **Beranda** (omzet, part terjual, motor & status mekanik), **Riwayat Kendaraan**, **Performa Mekanik**, **Laporan Penjualan**, **Absensi Saya**, **Penghasilan Saya**, dan **Panduan**. Chat tampil bila diberi akses oleh Super Admin.

### 9.3 Memantau bengkel dari Beranda

Lihat **Status mekanik** (siapa sedang mengerjakan motor apa) dan **Antrian bengkel**. Klik motor untuk membuka riwayatnya. Bila motor antri terlalu lama, koordinasikan dengan Register untuk memilih mekanik yang kosong.

### 9.4 Performa Mekanik

Pilih periode lalu mekanik. Periksa pekerjaan saat ini, jumlah motor selesai, waktu servis, rata-rata waktu per tipe motor, rincian nilai pekerjaan, dan target. Gunakan data ini untuk pembinaan, bukan untuk mengubah transaksi.

### 9.5 Insentif Service Advisor

Sejak 5.12.0 insentif SA dipisah menjadi tiga item: **Sparepart**, **Jasa servis**, dan **Biaya lain**, masing-masing dapat memiliki persentase dan target sendiri yang diatur Super Admin di **Master Data → Insentif & Potongan**. Basisnya adalah transaksi servis mekanik di cabang yang Anda pegang, per kategori. Rinciannya terlihat di **Penghasilan Saya**.

### 9.6 Laporan

Buka **Laporan Penjualan** untuk melihat omzet per periode. Klik kotak Penjualan part, Jasa servis, atau Klaim KSG untuk menyaring. SA tidak dapat membatalkan nota; laporkan kesalahan nota kepada Kasir/Admin.

---

## 10. Sparepart, harga master, dan Import Excel

_Order untuk WO, pembelian supplier, stok cabang, transfer, permintaan barang, dan stok opname._

### 10.1 Add Price master

Add Price diatur per part pada **Stok Part** oleh **Sparepart Pusat** atau **Super Admin**. Harga final = harga jual dasar + Add Price. Kasir hanya melihat harga dan menerima pembayaran; Kasir, Register, dan Sparepart Cabang tidak dapat mengubahnya. Perubahan berlaku untuk transaksi baru di semua cabang, sedangkan transaksi lama tetap memakai harga yang tersimpan.

### 10.2 Import Excel

Import Excel hanya tersedia untuk Sparepart Pusat dan Super Admin. File dibaca berdasarkan seluruh baris yang memiliki kode part. Harga dasar dan stok dapat diperbarui sesuai pilihan import, tetapi persentase Add Price master tidak ditimpa oleh kolom Excel. Periksa jumlah part baru, diperbarui, dan tidak berubah sebelum menekan Import.

### 10.3 File Excel terbaca sedikit

Jika aplikasi membaca hanya 1 part, periksa file asli: beberapa file export memang hanya menyimpan satu baris data walaupun tampilan spreadsheet menampilkan banyak baris kosong/format. Simpan ulang sebagai XLSX/CSV yang benar-benar berisi seluruh baris, lalu ulangi preview. Jangan menekan Import bila jumlah preview tidak wajar.

### 10.4 Order part untuk servis

Buka **Order Sparepart**, pilih motor/WO di daftar kiri, tulis permintaan mekanik, cari kode atau nama part, isi jumlah, lalu tambah. Perhatikan kolom ready karena part yang sudah dipesan WO lain tidak dihitung sebagai stok bebas.

### 10.5 Menyimpan order

Setelah semua item benar, tekan **Simpan order** atau `F2`. Tunggu indikator berubah menjadi **✓ Tersimpan**. Part belum dipotong dari stok saat order; stok dipotong ketika pembayaran servis diterima.

### 10.6 Rincian part di Register

Setelah order tersimpan, Register dapat melihat kode, nama, jumlah, stok, dan nilai part pada bagian **Rincian part**. Jika salah WO, hapus dari order yang benar lalu simpan ulang.

### 10.7 Stok Part

Buka **Stok Part** untuk mencari kode/nama, melihat stok, harga beli, harga jual, kategori, stok menipis, dan kartu stok. Gunakan filter agar tidak perlu memuat semua data saat mencari.

### 10.8 Menambah part baru

Di Stok Part pilih **Part baru**, isi kode unik, nama, kategori, harga beli, harga jual, dan stok awal bila diizinkan. Simpan dan tunggu pesan berhasil. Jika salah ketik, ubah data; penghapusan part hanya untuk super admin dengan verifikasi password dan masuk log aktivitas.

### 10.9 Pembelian supplier

Buka **Pembelian Stok → Invoice baru**. Isi tanggal, nomor invoice, supplier, status pembayaran, jatuh tempo, serta item dan harga beli. Simpan draft. Saat barang datang, buka **Preview & terima barang**, cocokkan fisik, lalu masukkan ke stok.

### 10.10 Transfer antar cabang

Di **Stok Part → Transfer**, pilih cabang tujuan, tambahkan part dan jumlah, periksa, lalu kirim. Pengirim membuat BAST dari riwayat transfer; penerima memeriksa fisik kemudian menekan **Terima**.

### 10.11 BAST transfer stok

Buka riwayat transfer, tekan **BAST**, periksa nomor transfer, cabang asal/tujuan, item, jumlah, pengirim, penerima, catatan, dan status. Tekan **Print / Simpan PDF** atau **Unduh PDF**. BAST dapat dipakai sebagai dokumen serah terima internal.

### 10.12 Permintaan antar cabang

Jika stok cabang sendiri kurang, gunakan **Cek Stok → Minta kirim**. Cabang pemilik membuka **Permintaan masuk**, lalu memilih Kirim atau Tolak dengan alasan. Setelah barang tiba, cabang peminta wajib menekan **Terima**.

### 10.13 Stok opname

Buka **Stok Opname → Mulai opname**, hitung fisik per kode, isi jumlah sebenarnya, dan ajukan. Super admin memeriksa selisih lalu menyetujui atau menolak. Jangan mengubah stok manual untuk menutupi selisih.

### 10.14 Export data stok

Gunakan **Export Excel** untuk analisis. File dapat berisi semua cabang, total per cabang, dan sheet masing-masing cabang. Filter Excel berdasarkan kolom cabang atau kategori.

---

## 11. Sales

_Panduan peran Sales: absensi, penghasilan (uang hadir & potongan), dan chat bila diberi akses._

### 11.1 Menu yang tersedia

Peran Sales secara bawaan hanya membuka **Absensi Saya**, **Penghasilan Saya**, dan **Panduan**. Halaman pertama setelah login adalah Absensi. Chat Internal dan menu lain tampil hanya bila Super Admin memberikannya di Hak Akses Menu.

### 11.2 Absensi

Saat tiba, buka **Absensi Saya** lalu tekan **📷 Scan QR absen masuk**; arahkan kamera ke QR di layar absensi cabang dan ikuti instruksi selfie. Saat pulang, tombol yang sama berubah menjadi **Scan QR absen pulang**. Bila diatur Super Admin, tanpa scan pulang uang hadir hari itu tidak dihitung. Izinkan kamera dan lokasi. Jika ganti HP, minta admin mereset perangkat.

### 11.3 Penghasilan

Sales menerima uang hadir dan potongan absensi sesuai aturan Super Admin; tidak ada insentif penjualan bawaan. Buka **Penghasilan Saya** untuk melihat rincian dan slip yang sudah diterbitkan.

### 11.4 Koordinasi

Bila diberi akses Chat, gunakan ruang Umum untuk informasi bersama dan chat pribadi untuk koordinasi dengan admin atau Super Admin. Atur status **Sibuk** saat sedang bertemu pelanggan.

---

## 12. Admin / Kepala Cabang

_Mengawasi operasional, memperbaiki data sesuai izin, memeriksa laporan, dan membantu semua bagian._

### 12.1 Rutinitas awal hari

Buka Beranda, periksa motor aktif, mekanik kosong/sibuk, stok menipis, permintaan transfer, kas, dan notifikasi persetujuan. Pastikan layar TV serta perangkat absensi aktif.

### 12.2 Rutinitas akhir hari

Pastikan semua motor memiliki status yang benar, order part tersimpan, motor selesai sudah dilaporkan Register, pembayaran tidak tertinggal, kas ditutup, dan permintaan transfer ditindaklanjuti.

### 12.3 Membantu Register

Admin dapat membuka Registrasi, mencari WO, memeriksa data konsumen/kendaraan, memperbaiki data, mengatur tipe/mekanik, menerima laporan Selesai/Tunda, dan mencetak BAST. Untuk KM lebih kecil, wajib menulis catatan alasan.

### 12.4 Membatalkan pendaftaran

Gunakan hanya untuk pendaftaran ganda atau salah daftar yang belum dibayar. Periksa nomor WO, nomor antrean, part yang sudah dipesan, dan alasan. Konfirmasi penghapusan karena data servis, layar, dan cek konsumen ikut terpengaruh.

### 12.5 Konsumen dan kendaraan

Gunakan menu **Konsumen & Kendaraan** untuk mencari, memperbaiki, menggabungkan data konsumen ganda, memindahkan motor ke pemilik yang benar, melihat log perubahan, dan mencetak daftar konsumen. Selalu tulis alasan untuk koreksi kepemilikan.

### 12.6 Persetujuan perangkat layar absensi

Jika ada perangkat baru, cocokkan kode yang tampil di perangkat dengan permintaan di menu **Persetujuan**. Setujui hanya perangkat milik cabang. Cabut perangkat yang hilang atau tidak dikenal.

### 12.7 Master Data yang dikelola admin

Admin biasanya mengatur tipe motor dan layar TV. Harga jasa, tarif KSG, rekening, mekanik, petugas, insentif, cabang, logo, tema, dan hak akses dapat dibatasi untuk super admin sesuai konfigurasi.

### 12.8 Laporan dan Insight

Gunakan Laporan Penjualan untuk memeriksa omzet, nota, metode pembayaran, part terlaris, laba part, kasir, mekanik, dan cabang. Insight Konsumen membantu menemukan konsumen yang lama tidak datang.

### 12.9 Backup dan perubahan versi

Sebelum perubahan besar, pastikan backup tersedia. Setelah rilis aplikasi baru, minta pengguna menekan **Update aplikasi** (bilah kiri bawah) bila tampilan lama masih terlihat; tombol ini mengosongkan salinan aplikasi di perangkat lalu memuat versi baru tanpa menghapus data. Jangan menghapus data Firebase untuk memperbaiki masalah tampilan.

---

## 13. Super Admin / Pemilik

_Keamanan, master data, persetujuan, cabang, payroll, backup, dan audit._

### 13.1 Keamanan akun utama

Gunakan email dan password super admin hanya untuk pemilik/penanggung jawab. Jangan menyimpan password di komputer kasir. Setelah selesai, keluar akun. Tindakan sensitif harus dilakukan sendiri dan tidak didelegasikan dengan membagikan password.

### 13.2 Master jasa dan harga

Buka **Master Data → Jasa Servis**. Tambahkan, ubah, aktifkan/nonaktifkan, atau hapus jasa sesuai kebijakan. Perubahan harga baru berlaku pada transaksi berikutnya; data lama menyimpan rincian harga saat transaksi.

### 13.3 Master Tarif KSG

Buka **Master Data → Tarif KSG**. Isi nilai klaim per tipe motor untuk **KSG ke-1 sampai ke-12** (12 kolom, geser tabel ke samping untuk kolom berikutnya). Kosongkan kolom yang tidak ada klaimnya; kolom kosong di akhir tidak disimpan. Tekan **Simpan tarif KSG** atau F2. Pastikan tipe motor dan tarif sesuai dokumen main dealer karena nilai ini masuk laporan klaim dan penghasilan mekanik.

### 13.4 Mekanik dan petugas

Atur nama, peran, cabang, akun PIN, dan reset PIN. Jangan menggunakan nama yang sama untuk dua orang. Saat petugas keluar, nonaktifkan aksesnya dan jangan hanya mengganti nama akun lama tanpa mempertimbangkan histori.

### 13.5 Rekening dan cabang

Isi rekening transfer yang benar dan data cabang, termasuk nama, alamat, nomor telepon/WA, serta pengaturan layar. Data cabang dipakai pada nota, laporan, transfer, dan komunikasi konsumen.

### 13.6 Hak akses menu

Buka **Master Data → Hak Akses Menu**. Centang hanya menu yang diperlukan tiap peran. **Chat Internal** harus dicentang per peran agar muncul (bawaan tidak aktif). Kotak ringkasan Beranda per peran juga diatur di sini. Panduan selalu dapat dibuka dan tidak dapat dimatikan. Perubahan langsung berlaku di perangkat yang sedang login tanpa perlu keluar-masuk. Uji dengan akun peran terkait setelah menyimpan.

### 13.7 Publish aturan & index versi 5.19.0

Setelah update ke 5.19.0: **1.** Firebase Console → Firestore → Rules: tempel isi **firestore.rules** terbaru lalu Publish (menambah koleksi `presence` untuk status Online/Sibuk/Offline; setiap petugas hanya boleh menulis status miliknya dan wajib memakai jam server). **2.** Deploy **firestore.indexes.json** (index `chat`: ruang + tgl menurun, dan participantEmails + ruang + tgl menurun) melalui Firebase CLI `firebase deploy --only firestore:indexes` atau buat manual di Console → Indexes. Tunggu status index **Enabled**. Tanpa langkah 1, semua petugas tampil Offline; tanpa langkah 2, Chat tetap jalan memakai cara lama.

### 13.8 Biaya baca/tulis status online

Setiap perangkat yang membuka aplikasi menulis 1 dokumen status setiap 2,5 menit selama layar terlihat (±190 tulis per petugas per 8 jam kerja). Status orang lain hanya dibaca saat menu Chat sedang dibuka, sehingga beban baca tetap kecil. Jika kuota Firebase gratis mendekati batas, minta petugas menutup tab aplikasi yang tidak dipakai.

### 13.9 Persetujuan pembatalan nota

Periksa nota, konsumen, total, metode bayar, alasan, dan dampak stok. Setujui hanya jika alasan sah. Jika menolak, pastikan kasir memahami koreksi yang harus dilakukan.

### 13.10 Persetujuan stok opname

Bandingkan hasil fisik, selisih, nilai rupiah, riwayat kartu stok, pembelian, transfer, dan transaksi. Setujui hanya setelah penyebab selisih dipahami. Persetujuan akan menyesuaikan stok.

### 13.11 Absensi dan payroll

Menu Absensi Karyawan untuk rekap dan koreksi manual dengan catatan. Menu Penghasilan Karyawan untuk gaji, insentif, potongan, slip, dan penguncian periode. Setelah periode dikunci, koreksi harus terdokumentasi.

### 13.12 THR dan bonus

Buat periode THR/bonus, atur persen dan tambahan, periksa masa kerja/pro-rata, tinjau per karyawan, lalu **Kunci & terbitkan**. Setelah terbit, slip muncul pada Penghasilan Saya dan total masuk pengeluaran sesuai alur.

### 13.13 Backup data

Buat backup JSON secara berkala dan simpan di lokasi aman yang tidak dapat diakses semua petugas. Uji bahwa file dapat dibaca. Pemulihan data adalah tindakan besar; lakukan hanya setelah memastikan file, periode, dan dampak pemulihan.

### 13.14 Log aktivitas dan penghapusan part

Penghapusan part memerlukan verifikasi password super admin dan dicatat pada log aktivitas. Sebelum menghapus, pastikan part tidak dipakai WO, nota, pembelian, atau laporan. Lebih aman menonaktifkan data daripada menghapus jika masih memiliki histori.

---

## 14. Masalah umum & solusi

_Langkah pemeriksaan sebelum meminta bantuan admin atau dukungan teknis._

### 14.1 Aplikasi loading terus

Sejak 5.19.0 aplikasi terbuka paling lama ±3,5 detik setelah login walau sebagian data belum datang; data menyusul otomatis. Jika roda gigi tetap berputar lebih dari 15 detik: tekan **Update aplikasi** di layar login atau bilah kiri (mengosongkan salinan lama dan memuat ulang). Periksa koneksi internet, muat ulang sekali, lalu tunggu beberapa detik. Jika hanya /pos yang loading, buka dengan alamat resmi **www.amuservice.id/pos**, bukan file lama/bookmark lama. Jika masih gagal, catat jam, akun/peran, perangkat, dan screenshot error; jangan menghapus data browser sebelum data offline penting dipastikan tersinkron.

### 14.2 Data tidak muncul setelah disimpan

Pastikan pesan berhasil muncul, periksa cabang aktif, hapus filter pencarian, dan muat ulang. Jika part/WO dibuat di cabang lain, gunakan filter atau pindah cabang sesuai hak akses. Jangan menyimpan berulang-ulang karena dapat membuat data ganda.

### 14.3 Menu tertentu lama terbuka

Menu yang mengambil data periode lama (Laporan rentang panjang, Insight, Penghasilan, Klaim KSG, Performa Mekanik periode lalu) memang membaca data dari server pada pembukaan pertama. Pembukaan berikutnya dalam 60 detik memakai simpanan sementara sehingga instan. Pilih rentang tanggal secukupnya. Di Insight, tombol **Muat seluruh database kendaraan** memang berat; gunakan hanya bila perlu.

### 14.4 Tampilan belum berubah setelah update

Tekan **Update aplikasi** sekali dan tunggu halaman memuat ulang sendiri. Jika aplikasi dipasang di HP, tutup aplikasi sepenuhnya lalu buka lagi. Pastikan nomor versi di bilah kiri bawah (atau di bawah lembar Menu di HP) sudah **5.20.0**.

### 14.5 Semua petugas tampil Offline di Chat

Status Online membutuhkan aturan Firestore terbaru. Minta Super Admin publish ulang **firestore.rules** versi 5.19.0. Pastikan juga petugas lain sedang membuka aplikasi (status Offline otomatis bila tidak ada aktivitas lebih dari 6 menit) dan tidak memilih **Offline** di tombol status.

### 14.6 Menu Chat tidak muncul atau pesan tidak tampil

Menu Chat hanya tampil bila peran Anda dicentang di **Master Data → Hak Akses Menu**. Jika menu ada tetapi pesan kosong, periksa koneksi internet lalu tekan Update aplikasi. Pesan yang gagal dikirim akan dikembalikan ke kotak tulisan sehingga bisa dikirim ulang.

### 14.7 Tidak ada bunyi saat pesan masuk

Pastikan **Bunyi notifikasi pesan baru** di Chat dicentang dan volume perangkat tidak senyap. Browser kadang menahan suara sampai Anda menyentuh/klik halaman sekali setelah dibuka. Bunyi hanya untuk pesan dari orang lain di ruang Umum atau chat pribadi Anda.

### 14.8 Gagal memuat data atau query/index

Catat teks error lengkap dan URL yang tampil. Jangan menekan link indeks Firebase tanpa arahan super admin/developer. Sampaikan menu, peran, cabang, dan waktu kejadian agar query dapat diperbaiki dengan aman.

### 14.9 Membatalkan pesanan sebelum bayar

Jika konsumen batal sebelum membayar, bagian Sparepart membuka menu **Pesanan Part Pribadi**, memilih pesanan, lalu menekan **Batal beli**. Alasan wajib diisi. Status berubah menjadi dibatalkan; tidak dibuat nota penjualan, tidak ada pengurangan kas, dan tidak ada pemotongan stok penjualan. Lembar cetak lama harus disimpan atau diberi tanda batal agar tidak dipakai ke Kasir.

### 14.10 Retur setelah pembayaran

Jika barang sudah dibayar tetapi kemudian terbukti memang harus diretur, buka nota part di Kasir/Laporan lalu tekan **Ajukan retur**. Isi alasan, terima dan periksa barang, lalu kirim pengajuan. Nota asli tidak dihapus. Pengajuan menunggu pemeriksaan dan persetujuan super admin.

### 14.11 Persetujuan retur dan pengembalian dana

Super admin memeriksa barang, nota, jumlah, alasan, dan bukti. Setelah yakin, pilih **Setujui & kembalikan dana**, isi catatan, dan konfirmasi password. Sistem mengembalikan stok, mencatat mutasi stok retur, mencatat pengurangan dana dari cash/bank sesuai metode pembayaran asli, menandai nota sebagai retur, dan mengeluarkan nota tersebut dari laporan omzet.

### 14.12 Jika retur ditolak atau belum disetujui

Selama belum disetujui, stok dan kas/bank belum berubah. Jangan mengembalikan uang secara manual tanpa persetujuan karena saldo kas dan laporan akan berbeda. Simpan catatan pemeriksaan dan komunikasi dengan konsumen.

### 14.13 Pesanan part tidak muncul di Kasir

Pastikan bagian Sparepart sudah menekan **Simpan pesanan & cetak cek** sampai ada pesan berhasil, cabang kedua perangkat sama, dan koneksi internet aktif. Kasir dapat menekan menu lain lalu kembali ke menu pesanan untuk memuat ulang. Jangan membuat pesanan kedua sebelum status pesanan pertama diperiksa.

### 14.14 Pesanan part dikembalikan

Jika Kasir menemukan perbedaan, Kasir menekan **Tidak sesuai** dan wajib menulis alasan. Bagian Sparepart membuka pesanan berstatus **Dikembalikan ke Sparepart**, memperbaiki item/jumlah, lalu menyimpan dan mencetak lembar cek baru.

### 14.15 Kas atau bank tidak sesuai

Periksa metode pembayaran pada nota, rekening transfer, kembalian, mutasi setor/tarik, dan pengeluaran pada tanggal yang sama. Jangan mencatat penerimaan penjualan sebagai pengeluaran. Jika kas sudah ditutup, jangan mengubah catatan; minta super admin membuka ulang sesuai prosedur.

### 14.16 Part baru tidak terlihat

Pastikan kode part unik, simpan sampai pesan berhasil, cek filter kategori/cabang, lalu refresh. Jika part tersimpan tetapi tidak bisa dipakai di order, periksa apakah statusnya aktif dan stok cabang sudah benar.

### 14.17 Nomor antrean tidak tampil di TV

Pastikan layar TV membuka alamat layar yang benar, perangkat sudah disetujui, internet aktif, cabang layar sesuai, dan Register menekan Selesai. Refresh layar TV hanya setelah memastikan status WO sudah tersimpan.

### 14.18 Tidak bisa memilih mekanik

Mekanik mungkin sedang berstatus Dikerjakan pada motor lain, tidak aktif, berada di cabang berbeda, atau data belum termuat. Periksa daftar Performa Mekanik dan pilih mekanik yang kosong.

### 14.19 Total pembayaran salah

Jangan lanjut bayar. Kembali ke Register dan periksa jenis KSB/KSG, KSG ke-berapa, jasa, part, biaya lainnya, diskon, dan status. Setelah diperbaiki, buka ulang halaman pembayaran.

### 14.20 BAST tidak bisa dicetak

Lengkapi data konsumen, nomor polisi, tipe, jenis layanan, estimasi, tanggal, dan jam. Izinkan pop-up browser untuk domain aplikasi, kemudian tekan Preview BAST lagi. Pada dialog cetak pilih printer atau **Save as PDF**.

### 14.21 QR absensi gagal

Pastikan kamera diizinkan, QR belum kedaluwarsa, perangkat berada di lokasi, dan akun memakai HP yang terdaftar. Jika ganti HP atau kamera rusak, minta admin mereset perangkat.

### 14.22 Pembayaran transfer belum masuk

Jangan menganggap screenshot sebagai bukti final. Periksa rekening dan mutasi. Jika sudah terlanjur salah, jangan membuat nota kedua; catat nomor nota dan ajukan koreksi sesuai prosedur.

### 14.23 Kapan meminta bantuan?

Minta bantuan admin jika berkaitan dengan data konsumen, status WO, stok, kas, atau akses. Minta bantuan super admin jika berkaitan dengan password utama, pembatalan nota, penghapusan, persetujuan stok opname, hak akses, atau backup. Sertakan nomor WO/nota, cabang, waktu, langkah terakhir, dan pesan error.

---

Copyright SRISP 2026
