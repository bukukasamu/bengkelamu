// Pusat Bantuan Aplikasi AMU Service.
// Panduan disaring berdasarkan peran, tetapi admin/super admin dapat melihat seluruh topik.
import { $, esc } from './util.js';
import { st, views, refreshers, actions } from './state.js';

const P = {
  umum: { judul: 'Umum — semua pengguna', ringkas: 'Cara masuk, memahami tampilan, keamanan akun, tombol cepat, dan aturan dasar penggunaan.', bagian: [
    ['Cara masuk sebagai petugas', '<b>1.</b> Buka <b>www.amuservice.id/pos</b>. <b>2.</b> Pilih nama Anda. <b>3.</b> Masukkan PIN 6 angka. <b>4.</b> Tekan <b>Masuk</b>. Jangan memakai akun orang lain karena setiap registrasi, perubahan, pembayaran, stok, dan persetujuan dicatat atas nama akun yang sedang masuk.'],
    ['Cara masuk sebagai super admin', 'Super admin masuk memakai email dan kata sandi. Tindakan sensitif seperti membatalkan nota, menghapus data, mengubah data penting, atau menyetujui stok opname dapat meminta kata sandi lagi.'],
    ['Memahami tampilan aplikasi', 'Menu di sisi kiri adalah modul yang boleh dibuka oleh peran Anda. <b>Beranda</b> berisi ringkasan. Angka merah berarti ada pekerjaan yang perlu ditindaklanjuti. Tombol <b>?</b> atau menu <b>Panduan Penggunaan</b> membuka halaman bantuan ini.'],
    ['Pencarian panduan', 'Ketik kata seperti <b>BAST</b>, <b>KSG</b>, <b>transfer</b>, <b>stok</b>, <b>nota</b>, <b>PIN</b>, atau <b>absensi</b> di kotak pencarian. Hasil akan menampilkan topik dan langkah yang mengandung kata tersebut. Hapus kata pencarian untuk melihat seluruh panduan yang tersedia bagi Anda.'],
    ['Tombol cepat keyboard', '<kbd>F1</kbd> membuat data baru, <kbd>F2</kbd> menyimpan atau mengirim, <kbd>F3</kbd> memfokuskan pencarian, <kbd>F8</kbd> membuka/cetak nota terakhir, dan <kbd>Esc</kbd> menutup dialog. Di HP, gunakan tombol yang tampil di layar.'],
    ['Konfirmasi tindakan penting', 'Baca dialog sebelum menyetujui. Konfirmasi digunakan untuk pembayaran, status selesai, tunda, transfer, penerimaan barang, stok opname, penghapusan, pembatalan nota, dan keluar akun. Jika ragu, tekan <b>Batal</b>.'],
    ['Menyimpan pekerjaan', 'Jika tombol masih bertuliskan <b>Simpan</b> atau berwarna kuning, perubahan belum masuk database. Tekan tombol simpan dan tunggu pesan berhasil. Jangan menutup halaman saat indikator masih menyimpan. Jika muncul pesan gagal, catat nomor dokumen dan laporkan ke admin.'],
    ['Keluar dan tombol kembali', 'Gunakan tombol <b>Keluar</b> di aplikasi. Tombol kembali HP/browser dapat menampilkan pilihan kembali ke menu, keluar, atau batal. Bila ada formulir yang belum disimpan, simpan dulu atau batalkan dengan sadar.'],
    ['Absensi saya', 'Buka <b>Absensi Saya → Scan QR</b>, arahkan kamera ke QR di layar absensi bengkel, lalu ikuti instruksi selfie. QR berubah berkala dan biasanya hanya dapat dipakai di lokasi bengkel. Tekan <b>Datang</b> saat mulai kerja dan <b>Pulang</b> saat selesai. Jika ganti HP, minta admin/super admin mereset perangkat.'],
    ['Penghasilan saya', 'Menu <b>Penghasilan Saya</b> hanya menampilkan data Anda: gaji pokok, komisi/insentif, potongan, slip, THR, dan bonus yang sudah diterbitkan. Jika angka tidak sesuai, jangan mengubah sendiri; sampaikan periode dan bagian yang salah kepada admin.'],
    ['Cek servis konsumen', 'Konsumen dapat membuka <b>www.amuservice.id</b> memakai nomor polisi dan nomor HP yang terdaftar. Pastikan nomor HP benar agar link cek servis dan pengingat WhatsApp tidak salah penerima.'],
    ['Aturan keamanan data', 'Jangan membagikan PIN, kata sandi, data NIK, atau screenshot transaksi ke pihak yang tidak berkepentingan. Jangan menghapus atau mengubah data untuk memperbaiki kesalahan tanpa mengikuti alur koreksi. Semua perubahan penting dapat masuk log aktivitas.']
  ]},
  registrasi: { judul: 'Registrasi Servis', ringkas: 'Menerima motor, mencatat konsumen/kendaraan, membuat antrean, mengatur mekanik, BAST, dan menerima laporan selesai/tunda.', bagian: [
    ['Alur kerja singkat', '<b>Motor datang → cari data lama → isi konsumen/kendaraan → pilih KSB/KSG → pilih mekanik → simpan → nomor antrean tampil → mekanik bekerja → mekanik melapor ke Register → Register menekan Selesai/Tunda → BAST dan pembayaran diproses.</b>'],
    ['Membuat pendaftaran baru', 'Buka <b>Registrasi Servis → + Motor masuk</b> atau tekan <kbd>F1</kbd>. Isi data sesuai KTP dan STNK. Nomor polisi wajib diisi. Pilih tipe motor, isi KM, keluhan, jenis layanan, dan mekanik bila sudah tersedia. Tekan <kbd>F2</kbd> untuk menyimpan dan membuat nomor antrean.'],
    ['Mencari data konsumen lama', 'Tekan <kbd>F3</kbd> atau gunakan kotak <b>Pernah servis di sini?</b>. Cari dengan sebagian nomor polisi, nama, nomor HP, NIK, nomor rangka, atau nomor mesin. Klik <b>Pakai data</b> jika konsumen dan motor sama. Klik <b>Pakai konsumen</b> atau <b>Konsumen saja</b> jika konsumennya sama tetapi motornya berbeda. Periksa kembali semua data sebelum menyimpan.'],
    ['Data konsumen yang wajib diperiksa', 'Nama harus sesuai KTP. Isi NIK 16 angka bila tersedia, nomor HP/WA, tempat/tanggal lahir, jenis kelamin, pekerjaan, alamat, RT/RW, provinsi, kabupaten/kota, kecamatan, dan kelurahan. Salah nomor HP dapat membuat konsumen tidak menerima notifikasi atau membuka riwayat yang salah.'],
    ['Data kendaraan yang wajib diperiksa', 'Periksa nomor polisi, nama pemilik di STNK, tipe, tahun, warna, nomor rangka, nomor mesin, dan KM. Jika nama STNK sama dengan konsumen, biarkan pilihan <b>sama dengan konsumen</b>. Jika berbeda, hilangkan centang dan isi nama STNK.'],
    ['KM kendaraan', 'Aplikasi menampilkan KM terakhir. KM baru tidak boleh lebih kecil. Jika speedometer diganti atau di-reset, admin harus menyimpan dengan catatan alasan. Jangan menurunkan KM hanya agar pengingat servis berubah.'],
    ['Pilihan KSB dan KSG', 'Untuk pendaftaran baru, pilih <b>KSB</b> atau <b>KSG</b>. KSB adalah kartu service berkala. KSG adalah kartu service gratis dan wajib memilih <b>KSG ke-1, ke-2, ke-3, atau ke-4</b> serta nomor kupon/buku servis bila tersedia. Data WO lama Reguler tetap dapat dibuka untuk menjaga riwayat.'],
    ['Aturan KSG', 'Setelah memilih KSG, checklist jasa standar tidak ditampilkan dan jasa KSG otomatis dianggap gratis. Nilai klaim diambil dari <b>Master Data → Tarif KSG</b> sesuai tipe motor dan KSG ke-berapa. Part serta biaya/jasa tambahan yang memang bukan bagian KSG tetap terlihat dan dapat ditagihkan sesuai kebijakan bengkel.'],
    ['Rincian jasa dan part', 'Bagian <b>Jasa servis/Jasa lainnya</b> menunjukkan jasa yang dipilih. Bagian <b>Rincian part</b> menampilkan kode, nama, jumlah, stok, dan nilai part yang sudah di-order untuk motor tersebut. Jika part belum terlihat, pastikan bagian Sparepart sudah menyimpan order dengan nomor WO yang benar.'],
    ['BAST kendaraan', 'Pada Register KSB/KSG tersedia bagian <b>BAST kendaraan</b>. Isi estimasi selesai/pengambilan secara manual, tanggal, jam, dan keterangan. Kode BAST otomatis menjadi <b>KSB</b> atau <b>KSG1–KSG4</b> dan muncul di pojok kanan atas. Tekan <b>Preview BAST</b>, lalu <b>Print / Simpan PDF</b>. BAST dibawa konsumen saat mengambil kendaraan.'],
    ['Memilih mekanik', 'Pilih mekanik yang berstatus kosong. Mekanik yang sedang mengerjakan motor lain tidak dapat dipilih. Jika belum ada mekanik, simpan tanpa mekanik sehingga statusnya <b>Antri</b>. Saat mekanik kosong, buka motor antri, pilih mekanik, lalu tekan <b>Simpan perubahan</b>.'],
    ['Status motor', '<b>Antri</b> berarti menunggu mekanik. <b>Dikerjakan</b> berarti ada mekanik yang menangani. <b>Ditunda</b> berarti pekerjaan berhenti sementara dan mekanik kembali kosong. <b>Selesai</b> berarti laporan mekanik sudah diterima Register dan menunggu pembayaran. <b>Lunas</b> berarti pembayaran selesai.'],
    ['Menerima laporan mekanik', 'Mekanik melapor kepada Register, bukan Kasir. Pada motor berstatus Dikerjakan, Register memilih <b>Motor selesai</b> jika pengerjaan selesai atau mengisi alasan lalu memilih <b>Lanjut lama (tunda)</b>. Alasan tunda wajib, misalnya <i>tunggu part</i> atau <i>konsumen ambil besok</i>. Kedua pilihan membuat mekanik kosong. Motor selesai memicu pemanggilan nomor antrean di layar TV.'],
    ['Melanjutkan motor yang ditunda', 'Buka tab <b>Ditunda</b>, pilih motor, pilih mekanik yang kosong, lalu tekan <b>Lanjutkan dikerjakan</b>. Mekanik boleh sama atau berbeda. Aplikasi menyimpan waktu kerja masing-masing mekanik dan alasan tunda.'],
    ['Nomor cepat saat ramai', 'Jika antrean panjang, gunakan <b>Nomor cepat (cukup nopol)</b>. Nomor antrean langsung dibuat, tetapi motor diberi tanda <b>Data belum lengkap</b>. Lengkapi data sebelum pembayaran atau sebelum pekerjaan membutuhkan informasi teknis.'],
    ['Motor terdaftar dua kali', 'Satu nomor polisi hanya boleh mempunyai satu servis aktif. Jika muncul peringatan, jangan membuat pendaftaran kedua. Tekan <b>Buka servis</b> untuk memperbaiki WO yang sudah ada.'],
    ['Ganti plat atau pemilik', 'Jika kendaraan berganti nomor polisi, gunakan alur <b>Ganti nomor polisi</b> agar riwayat tetap tersambung. Jika motor sudah menjadi milik orang lain, pilih <b>Ganti pemilik</b> dan isi alasan setelah memeriksa STNK. Jika orang lain hanya mengantar, pilih <b>Hanya mengantar</b> agar pemilik tetap benar.'],
    ['Pengingat ganti oli', 'Buka <b>Pengingat Servis</b>. Tab <b>Perlu diingatkan</b> berisi motor yang sudah mencapai batas KM atau hari. Gunakan <b>WA ingatkan</b>. Jika konsumen sudah ganti oli di tempat lain, catat tanggal dan KM pada <b>Ganti di luar</b>. Gunakan <b>Tunda 14 hari</b> bila belum ingin diingatkan atau <b>Stop</b> bila motor sudah dijual/pindah.']
  ]},
  kasir: { judul: 'Kasir', ringkas: 'Menerima pembayaran servis atau penjualan part, mencetak nota, mengelola kas, dan memantau klaim.', bagian: [
    ['Batas tugas Kasir', 'Kasir berfokus pada <b>klik bayar</b>: cash atau transfer. Tambahan biaya, jasa, part, diskon, jenis layanan, dan finalisasi pekerjaan dilakukan di Register sesuai alur bengkel. Kasir tidak menekan Selesai/Tunda untuk laporan mekanik.'],
    ['Membayar servis', 'Buka <b>Pembayaran & Status Servis</b>, pilih motor berstatus <b>Selesai</b>, periksa nama konsumen, nomor polisi, rincian jasa, part, biaya lain, diskon, total, dan jenis KSG/KSB. Pilih <b>Cash</b> atau <b>Transfer</b>, pilih rekening bila transfer, masukkan nominal, tekan <kbd>F2</kbd>, periksa dialog konfirmasi, lalu setujui.'],
    ['KSG saat pembayaran', 'Untuk KSG, jasa standar gratis untuk konsumen. Part dan biaya/jasa tambahan tetap masuk sesuai data Register. Periksa nilai total sebelum menerima uang. Jika jasa KSG masih muncul sebagai tagihan, hentikan pembayaran dan minta Register memperbaiki jenis servisnya.'],
    ['Nota pembayaran', 'Setelah pembayaran berhasil, nota dapat dicetak, diunduh PDF, atau dikirim melalui WhatsApp. Periksa nomor nota, nama, nomor polisi, total, metode bayar, dan link cek servis sebelum menyerahkan nota.'],
    ['Pembayaran cash', 'Hitung uang yang diterima, masukkan nominal sebenarnya, dan periksa kembalian. Jangan memasukkan nominal pas jika konsumen memberikan uang lebih. Uang cash setelah kembalian masuk perhitungan kas harian.'],
    ['Pembayaran transfer', 'Pastikan transfer benar-benar masuk ke rekening bengkel, pilih rekening yang sesuai, lalu simpan bukti bila prosedur cabang mewajibkan. Jangan menerima berdasarkan screenshot tanpa memeriksa mutasi atau konfirmasi yang sah.'],
    ['Penjualan part langsung', 'Buka <b>Penjualan Sparepart</b>, cari/scan part, masukkan jumlah, periksa harga dan stok, isi nama pelanggan bila ada, pilih metode bayar, lalu simpan. Stok berkurang setelah transaksi berhasil.'],
    ['Kesalahan sebelum pembayaran', 'Jangan membayar WO yang salah. Kembali ke Register untuk memperbaiki data, jasa, part, biaya, atau jenis layanan. Setelah diperbaiki, muat ulang daftar pembayaran dan periksa total lagi.'],
    ['Pembatalan nota', 'Nota yang sudah dibayar tidak diedit langsung. Buka nota, pilih <b>Ajukan pembatalan</b>, tulis alasan rinci, lalu kirim untuk persetujuan super admin. Jangan membuat nota pengganti sebelum status pembatalan jelas.'],
    ['Kas harian', 'Pagi hari buka <b>Kas & Pengeluaran → Buka kas</b> dan isi uang awal. Catat setiap pengeluaran pada saat terjadi. Sore hari hitung uang fisik, cocokkan dengan sistem, isi selisih dan catatan jika ada, lalu tekan <b>Tutup kas</b>.'],
    ['Klaim KSG', 'Buka <b>Klaim KSG</b>, pilih periode, periksa WO/nota KSG, centang dokumen yang diajukan, lalu kirim pengajuan. Saat pembayaran dari main dealer diterima, catat tanggal dan nominal pembayaran klaim.']
  ]},
  mekanik: { judul: 'Mekanik', ringkas: 'Melihat pekerjaan, mengerjakan kendaraan, meminta part, dan melaporkan selesai atau tunda kepada Register.', bagian: [
    ['Melihat pekerjaan', 'Buka <b>Performa Mekanik</b> dan lihat bagian pekerjaan saat ini. Motor yang diberikan Register akan muncul bersama nomor polisi, tipe, keluhan, dan rincian yang tersedia. Satu mekanik menangani satu motor berstatus Dikerjakan.'],
    ['Memeriksa pekerjaan sebelum mulai', 'Cocokkan nomor polisi dengan motor fisik, baca keluhan, cek KM dan kondisi awal, lalu pastikan part yang dibutuhkan sudah diminta. Jika data kendaraan salah, jangan mengubah sembarangan; laporkan kepada Register.'],
    ['Meminta sparepart', 'Sampaikan kode/nama part dan jumlah kepada bagian Sparepart. Bagian Sparepart membuat order pada WO yang benar. Jika part tidak tersedia, minta Register menerima laporan tunda dengan alasan yang jelas.'],
    ['Laporan selesai', 'Jika motor selesai dikerjakan, lapor kepada Register secara langsung atau melalui prosedur internal bengkel. Register yang menekan <b>Motor selesai</b>. Setelah laporan diterima, status berubah Selesai, nomor antrean dipanggil di TV, dan Anda dapat menerima pekerjaan lain.'],
    ['Laporan tunda', 'Jika pekerjaan belum bisa dilanjutkan, lapor kepada Register beserta alasan spesifik: menunggu part, menunggu persetujuan, menunggu konsumen, atau alasan teknis. Register wajib mengisi alasan dan menekan <b>Lanjut lama (tunda)</b>.'],
    ['Melanjutkan pekerjaan', 'Jika motor ditunda lalu part atau persetujuan sudah tersedia, minta Register membuka tab Ditunda dan memilih mekanik yang akan melanjutkan. Jangan mengerjakan WO yang statusnya masih Ditunda tanpa pengaktifan kembali.'],
    ['Performa dan penghasilan', 'Menu Performa Mekanik menampilkan pekerjaan selesai, nilai jasa, dan waktu kerja. Menu Penghasilan Saya menampilkan gaji/insentif yang diterbitkan. Tunda tidak dihitung sebagai waktu kerja aktif.'],
    ['Absensi', 'Gunakan Absensi Saya untuk scan QR datang dan pulang. Pastikan status berhasil tersimpan sebelum meninggalkan layar. Jika QR gagal, laporkan waktu kejadian kepada admin, jangan meminjam akun mekanik lain.']
  ]},
  sparepart: { judul: 'Sparepart', ringkas: 'Order untuk WO, pembelian supplier, stok cabang, transfer, permintaan barang, dan stok opname.', bagian: [
    ['Order part untuk servis', 'Buka <b>Order Sparepart</b>, pilih motor/WO di daftar kiri, tulis permintaan mekanik, cari kode atau nama part, isi jumlah, lalu tambah. Perhatikan kolom ready karena part yang sudah dipesan WO lain tidak dihitung sebagai stok bebas.'],
    ['Menyimpan order', 'Setelah semua item benar, tekan <b>Simpan order</b> atau <kbd>F2</kbd>. Tunggu indikator berubah menjadi <b>✓ Tersimpan</b>. Part belum dipotong dari stok saat order; stok dipotong ketika pembayaran servis diterima.'],
    ['Rincian part di Register', 'Setelah order tersimpan, Register dapat melihat kode, nama, jumlah, stok, dan nilai part pada bagian <b>Rincian part</b>. Jika salah WO, hapus dari order yang benar lalu simpan ulang.'],
    ['Stok Part', 'Buka <b>Stok Part</b> untuk mencari kode/nama, melihat stok, harga beli, harga jual, kategori, stok menipis, dan kartu stok. Gunakan filter agar tidak perlu memuat semua data saat mencari.'],
    ['Menambah part baru', 'Di Stok Part pilih <b>Part baru</b>, isi kode unik, nama, kategori, harga beli, harga jual, dan stok awal bila diizinkan. Simpan dan tunggu pesan berhasil. Jika salah ketik, ubah data; penghapusan part hanya untuk super admin dengan verifikasi password dan masuk log aktivitas.'],
    ['Pembelian supplier', 'Buka <b>Pembelian Stok → Invoice baru</b>. Isi tanggal, nomor invoice, supplier, status pembayaran, jatuh tempo, serta item dan harga beli. Simpan draft. Saat barang datang, buka <b>Preview & terima barang</b>, cocokkan fisik, lalu masukkan ke stok.'],
    ['Transfer antar cabang', 'Di <b>Stok Part → Transfer</b>, pilih cabang tujuan, tambahkan part dan jumlah, periksa, lalu kirim. Pengirim membuat BAST dari riwayat transfer; penerima memeriksa fisik kemudian menekan <b>Terima</b>.'],
    ['BAST transfer stok', 'Buka riwayat transfer, tekan <b>BAST</b>, periksa nomor transfer, cabang asal/tujuan, item, jumlah, pengirim, penerima, catatan, dan status. Tekan <b>Print / Simpan PDF</b> atau <b>Unduh PDF</b>. BAST dapat dipakai sebagai dokumen serah terima internal.'],
    ['Permintaan antar cabang', 'Jika stok cabang sendiri kurang, gunakan <b>Cek Stok → Minta kirim</b>. Cabang pemilik membuka <b>Permintaan masuk</b>, lalu memilih Kirim atau Tolak dengan alasan. Setelah barang tiba, cabang peminta wajib menekan <b>Terima</b>.'],
    ['Stok opname', 'Buka <b>Stok Opname → Mulai opname</b>, hitung fisik per kode, isi jumlah sebenarnya, dan ajukan. Super admin memeriksa selisih lalu menyetujui atau menolak. Jangan mengubah stok manual untuk menutupi selisih.'],
    ['Export data stok', 'Gunakan <b>Export Excel</b> untuk analisis. File dapat berisi semua cabang, total per cabang, dan sheet masing-masing cabang. Filter Excel berdasarkan kolom cabang atau kategori.']
  ]},
  admin: { judul: 'Admin / Kepala Cabang', ringkas: 'Mengawasi operasional, memperbaiki data sesuai izin, memeriksa laporan, dan membantu semua bagian.', bagian: [
    ['Rutinitas awal hari', 'Buka Beranda, periksa motor aktif, mekanik kosong/sibuk, stok menipis, permintaan transfer, kas, dan notifikasi persetujuan. Pastikan layar TV serta perangkat absensi aktif.'],
    ['Rutinitas akhir hari', 'Pastikan semua motor memiliki status yang benar, order part tersimpan, motor selesai sudah dilaporkan Register, pembayaran tidak tertinggal, kas ditutup, dan permintaan transfer ditindaklanjuti.'],
    ['Membantu Register', 'Admin dapat membuka Registrasi, mencari WO, memeriksa data konsumen/kendaraan, memperbaiki data, mengatur tipe/mekanik, menerima laporan Selesai/Tunda, dan mencetak BAST. Untuk KM lebih kecil, wajib menulis catatan alasan.'],
    ['Membatalkan pendaftaran', 'Gunakan hanya untuk pendaftaran ganda atau salah daftar yang belum dibayar. Periksa nomor WO, nomor antrean, part yang sudah dipesan, dan alasan. Konfirmasi penghapusan karena data servis, layar, dan cek konsumen ikut terpengaruh.'],
    ['Konsumen dan kendaraan', 'Gunakan menu <b>Konsumen & Kendaraan</b> untuk mencari, memperbaiki, menggabungkan data konsumen ganda, memindahkan motor ke pemilik yang benar, melihat log perubahan, dan mencetak daftar konsumen. Selalu tulis alasan untuk koreksi kepemilikan.'],
    ['Persetujuan perangkat layar absensi', 'Jika ada perangkat baru, cocokkan kode yang tampil di perangkat dengan permintaan di menu <b>Persetujuan</b>. Setujui hanya perangkat milik cabang. Cabut perangkat yang hilang atau tidak dikenal.'],
    ['Master Data yang dikelola admin', 'Admin biasanya mengatur tipe motor dan layar TV. Harga jasa, tarif KSG, rekening, mekanik, petugas, insentif, cabang, logo, tema, dan hak akses dapat dibatasi untuk super admin sesuai konfigurasi.'],
    ['Laporan dan Insight', 'Gunakan Laporan Penjualan untuk memeriksa omzet, nota, metode pembayaran, part terlaris, laba part, kasir, mekanik, dan cabang. Insight Konsumen membantu menemukan konsumen yang lama tidak datang.'],
    ['Backup dan perubahan versi', 'Sebelum perubahan besar, pastikan backup tersedia. Setelah rilis aplikasi baru, minta pengguna memperbarui halaman dengan bersih bila tampilan lama masih tersimpan. Jangan menghapus data Firebase untuk memperbaiki masalah tampilan.']
  ]},
  super: { judul: 'Super Admin / Pemilik', ringkas: 'Keamanan, master data, persetujuan, cabang, payroll, backup, dan audit.', bagian: [
    ['Keamanan akun utama', 'Gunakan email dan password super admin hanya untuk pemilik/penanggung jawab. Jangan menyimpan password di komputer kasir. Setelah selesai, keluar akun. Tindakan sensitif harus dilakukan sendiri dan tidak didelegasikan dengan membagikan password.'],
    ['Master jasa dan harga', 'Buka <b>Master Data → Jasa Servis</b>. Tambahkan, ubah, aktifkan/nonaktifkan, atau hapus jasa sesuai kebijakan. Perubahan harga baru berlaku pada transaksi berikutnya; data lama menyimpan rincian harga saat transaksi.'],
    ['Master Tarif KSG', 'Buka <b>Master Data → Tarif KSG</b>. Isi nilai klaim per tipe motor untuk KSG ke-1 sampai ke-4. Kosongkan jika tidak ada klaim. Pastikan tipe motor dan tarif sesuai dokumen main dealer karena nilai ini masuk laporan klaim dan penghasilan mekanik.'],
    ['Mekanik dan petugas', 'Atur nama, peran, cabang, akun PIN, dan reset PIN. Jangan menggunakan nama yang sama untuk dua orang. Saat petugas keluar, nonaktifkan aksesnya dan jangan hanya mengganti nama akun lama tanpa mempertimbangkan histori.'],
    ['Rekening dan cabang', 'Isi rekening transfer yang benar dan data cabang, termasuk nama, alamat, nomor telepon/WA, serta pengaturan layar. Data cabang dipakai pada nota, laporan, transfer, dan komunikasi konsumen.'],
    ['Hak akses menu', 'Buka <b>Master Data → Hak Akses Menu</b>. Centang hanya menu yang diperlukan tiap peran. Jangan menghapus akses Panduan karena panduan harus selalu dapat dibuka. Uji dengan akun peran terkait setelah menyimpan.'],
    ['Persetujuan pembatalan nota', 'Periksa nota, konsumen, total, metode bayar, alasan, dan dampak stok. Setujui hanya jika alasan sah. Jika menolak, pastikan kasir memahami koreksi yang harus dilakukan.'],
    ['Persetujuan stok opname', 'Bandingkan hasil fisik, selisih, nilai rupiah, riwayat kartu stok, pembelian, transfer, dan transaksi. Setujui hanya setelah penyebab selisih dipahami. Persetujuan akan menyesuaikan stok.'],
    ['Absensi dan payroll', 'Menu Absensi Karyawan untuk rekap dan koreksi manual dengan catatan. Menu Penghasilan Karyawan untuk gaji, insentif, potongan, slip, dan penguncian periode. Setelah periode dikunci, koreksi harus terdokumentasi.'],
    ['THR dan bonus', 'Buat periode THR/bonus, atur persen dan tambahan, periksa masa kerja/pro-rata, tinjau per karyawan, lalu <b>Kunci & terbitkan</b>. Setelah terbit, slip muncul pada Penghasilan Saya dan total masuk pengeluaran sesuai alur.'],
    ['Backup data', 'Buat backup JSON secara berkala dan simpan di lokasi aman yang tidak dapat diakses semua petugas. Uji bahwa file dapat dibaca. Pemulihan data adalah tindakan besar; lakukan hanya setelah memastikan file, periode, dan dampak pemulihan.'],
    ['Log aktivitas dan penghapusan part', 'Penghapusan part memerlukan verifikasi password super admin dan dicatat pada log aktivitas. Sebelum menghapus, pastikan part tidak dipakai WO, nota, pembelian, atau laporan. Lebih aman menonaktifkan data daripada menghapus jika masih memiliki histori.']
  ]},
  troubleshooting: { judul: 'Masalah umum & solusi', ringkas: 'Langkah pemeriksaan sebelum meminta bantuan admin atau dukungan teknis.', bagian: [
    ['Aplikasi loading terus', 'Periksa koneksi internet, muat ulang sekali, lalu tunggu beberapa detik. Jika hanya /pos yang loading, buka dengan alamat resmi <b>www.amuservice.id/pos</b>, bukan file lama/bookmark lama. Jika masih gagal, catat jam, akun/peran, perangkat, dan screenshot error; jangan menghapus data browser sebelum data offline penting dipastikan tersinkron.'],
    ['Data tidak muncul setelah disimpan', 'Pastikan pesan berhasil muncul, periksa cabang aktif, hapus filter pencarian, dan muat ulang. Jika part/WO dibuat di cabang lain, gunakan filter atau pindah cabang sesuai hak akses. Jangan menyimpan berulang-ulang karena dapat membuat data ganda.'],
    ['Gagal memuat data atau query/index', 'Catat teks error lengkap dan URL yang tampil. Jangan menekan link indeks Firebase tanpa arahan super admin/developer. Sampaikan menu, peran, cabang, dan waktu kejadian agar query dapat diperbaiki dengan aman.'],
    ['Part baru tidak terlihat', 'Pastikan kode part unik, simpan sampai pesan berhasil, cek filter kategori/cabang, lalu refresh. Jika part tersimpan tetapi tidak bisa dipakai di order, periksa apakah statusnya aktif dan stok cabang sudah benar.'],
    ['Nomor antrean tidak tampil di TV', 'Pastikan layar TV membuka alamat layar yang benar, perangkat sudah disetujui, internet aktif, cabang layar sesuai, dan Register menekan Selesai. Refresh layar TV hanya setelah memastikan status WO sudah tersimpan.'],
    ['Tidak bisa memilih mekanik', 'Mekanik mungkin sedang berstatus Dikerjakan pada motor lain, tidak aktif, berada di cabang berbeda, atau data belum termuat. Periksa daftar Performa Mekanik dan pilih mekanik yang kosong.'],
    ['Total pembayaran salah', 'Jangan lanjut bayar. Kembali ke Register dan periksa jenis KSB/KSG, KSG ke-berapa, jasa, part, biaya lainnya, diskon, dan status. Setelah diperbaiki, buka ulang halaman pembayaran.'],
    ['BAST tidak bisa dicetak', 'Lengkapi data konsumen, nomor polisi, tipe, jenis layanan, estimasi, tanggal, dan jam. Izinkan pop-up browser untuk domain aplikasi, kemudian tekan Preview BAST lagi. Pada dialog cetak pilih printer atau <b>Save as PDF</b>.'],
    ['QR absensi gagal', 'Pastikan kamera diizinkan, QR belum kedaluwarsa, perangkat berada di lokasi, dan akun memakai HP yang terdaftar. Jika ganti HP atau kamera rusak, minta admin mereset perangkat.'],
    ['Pembayaran transfer belum masuk', 'Jangan menganggap screenshot sebagai bukti final. Periksa rekening dan mutasi. Jika sudah terlanjur salah, jangan membuat nota kedua; catat nomor nota dan ajukan koreksi sesuai prosedur.'],
    ['Kapan meminta bantuan?', 'Minta bantuan admin jika berkaitan dengan data konsumen, status WO, stok, kas, atau akses. Minta bantuan super admin jika berkaitan dengan password utama, pembatalan nota, penghapusan, persetujuan stok opname, hak akses, atau backup. Sertakan nomor WO/nota, cabang, waktu, langkah terakhir, dan pesan error.']
  ]}
};

let pilih = null;
let queryCari = '';
const bolehLihat = () => st.petugas?.super ? Object.keys(P) : st.role === 'admin' ? ['umum', 'registrasi', 'kasir', 'mekanik', 'sparepart', 'admin', 'troubleshooting'] : [st.role, 'umum', 'troubleshooting'];
const bersih = x => String(x || '').replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').toLowerCase();

function render() {
  const daftar = [...new Set(bolehLihat())].filter(k => P[k]);
  if (!pilih || !daftar.includes(pilih)) pilih = st.petugas?.super ? 'umum' : (daftar.includes(st.role) ? st.role : 'umum');
  const p = P[pilih];
  const q = queryCari.trim().toLowerCase();
  const bagian = p.bagian.filter(([j, isi]) => !q || bersih(j + ' ' + isi).includes(q));
  const hasilSemua = q ? daftar.flatMap(k => P[k].bagian.filter(([j, isi]) => bersih(j + ' ' + isi).includes(q)).map(x => ({ k, x }))) : [];
  const body = q ? (hasilSemua.length ? hasilSemua.map(({ k, x }) => `<li><b>${esc(P[k].judul)} — ${esc(x[0])}</b><div>${x[1]}</div></li>`).join('') : '<li><div class="empty">Tidak ada hasil. Coba kata yang lebih pendek seperti <b>stok</b>, <b>part</b>, <b>KSG</b>, <b>BAST</b>, atau <b>nota</b>.</div></li>') : bagian.map(([j, isi]) => `<li><b>${esc(j)}</b><div>${isi}</div></li>`).join('');
  $('#view').innerHTML = `<div class="panel panduan">
    <div class="row spread no-print"><div><h2 style="margin:0">Pusat Bantuan</h2><div class="small muted">Panduan untuk: <b>${esc(p.judul)}</b> · ${q ? hasilSemua.length + ' hasil pencarian' : p.bagian.length + ' topik'}</div></div><button class="btn sm" type="button" data-act="pd-cetak">🖨 Cetak</button></div>
    <div class="cari-box no-print" style="margin-top:12px"><label class="f" for="pd-q">Cari panduan <span class="small muted">contoh: BAST, KSG, transfer, pembayaran, absensi, loading</span><span class="row" style="gap:6px"><input id="pd-q" value="${esc(queryCari)}" placeholder="Ketik kata atau masalah yang dicari..." autocomplete="off" style="flex:1"><button class="btn" type="button" data-act="pd-clear" ${queryCari ? '' : 'disabled'}>Bersihkan</button></span></label></div>
    <div class="seg no-print" role="group" aria-label="Pilih topik panduan">${daftar.map(k => `<button type="button" data-act="pd-pilih" data-k="${k}" aria-pressed="${k === pilih}">${esc(P[k].judul.split(' —')[0].split(' /')[0])}</button>`).join('')}</div>
    ${q ? `<div class="note no-print" style="margin-top:10px">Menampilkan semua hasil yang dapat dilihat oleh peran Anda. Klik <button class="link-btn" type="button" data-act="pd-clear">Bersihkan</button> untuk kembali ke topik <b>${esc(p.judul)}</b>.</div>` : `<h2>${esc(p.judul)}</h2><p class="muted" style="margin:0 0 12px">${esc(p.ringkas)}</p>`}
    <ol class="pd-list">${body}</ol>
    <div class="note no-print" style="margin-top:16px"><b>Jika masih bingung:</b> cari kata kunci di atas. Jika tetap tidak menemukan jawaban, siapkan nomor WO/nota, cabang, akun/peran, waktu kejadian, langkah terakhir, dan pesan error sebelum menghubungi admin.</div>
  </div>`;
  if (q) setTimeout(() => { const el = $('#pd-q'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 0);
}

views.panduan = render;
refreshers.panduan = () => {};
Object.assign(actions, {
  'pd-pilih': el => { pilih = el.dataset.k; queryCari = ''; render(); },
  'pd-clear': () => { queryCari = ''; render(); },
  'pd-cetak': () => window.print()
});

export const PANDUAN = P;

// Pencarian memakai input global agar hasil berubah saat mengetik tanpa tombol tambahan.
document.addEventListener('input', e => {
  if (e.target.id !== 'pd-q') return;
  queryCari = e.target.value;
  render();
});
