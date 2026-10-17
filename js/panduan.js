// Menu Panduan Penggunaan: cara kerja aplikasi per peran (alur kerja tiap petugas berbeda).
// Petugas melihat panduan perannya + panduan umum; admin & super admin bisa membuka semua.
import { $, esc } from './util.js';
import { st, views, refreshers, actions } from './state.js';

// Format isi: [judul langkah, isi (HTML sederhana)]. <kbd> untuk tombol keyboard.
const P = {
  umum: { judul: 'Umum (semua petugas)', ringkas: 'Masuk, tombol cepat, absensi, dan aturan dasar.', bagian: [
    ['Masuk aplikasi', 'Buka <b>www.amuservice.id/pos</b> → pilih nama → ketik <b>PIN 6 angka</b>. Ganti PIN sendiri lewat tombol <b>Ganti PIN</b> di bawah menu. Jangan berikan PIN ke orang lain: semua pekerjaan tercatat atas nama Anda.'],
    ['Tombol cepat keyboard', '<kbd>F1</kbd> data baru · <kbd>F2</kbd> simpan · <kbd>F3</kbd> langsung ke kotak pencarian · <kbd>F8</kbd> cetak nota terakhir · <kbd>Esc</kbd> menutup jendela. Tombol yang sama juga ada di bawah judul halaman.'],
    ['Kotak konfirmasi', 'Setiap tindakan penting (setujui, selesai, tunda, bayar, transfer, tutup kas, hapus) menampilkan kotak konfirmasi. Baca isinya dulu. Tombol yang aktif pertama kali adalah <b>Batal</b>, jadi tekan Enter tanpa sengaja tidak menyetujui apa pun.'],
    ['Tombol Kembali &amp; Keluar', 'Tombol <b>Kembali</b> (browser atau HP) tidak langsung keluar: muncul pilihan <b>Kembali ke menu sebelumnya</b>, <b>Keluar dari aplikasi</b>, atau <b>Batal</b>. Bila ada jendela terbuka, ditanya dulu sebelum ditutup. Menutup tab / memuat ulang halaman memunculkan peringatan browser, dan tombol <b>Keluar</b> akun juga minta konfirmasi.'],
    ['Nomor urut', 'Daftar (stok part, konsumen, motor di bengkel, laporan, dll.) diberi nomor urut di kolom paling kiri, mengikuti urutan yang sedang tampil.'],
    ['Absensi', 'Datang & pulang: menu <b>Absensi Saya</b> → <b>Scan QR</b> di layar absen bengkel → selfie. QR berganti setiap beberapa detik, jadi harus di bengkel. Satu akun hanya bisa absen dari HP yang terdaftar (minta super admin reset bila ganti HP).'],
    ['Penghasilan Saya', 'Melihat gaji pokok, insentif, target, potongan, slip gaji bulanan, serta THR &amp; bonus (tab THR &amp; Bonus, slip bisa diunduh PDF) milik Anda sendiri. Karyawan lain tidak bisa melihatnya.'],
    ['Cek servis konsumen', 'Konsumen bisa memantau servis & riwayat motornya di <b>www.amuservice.id</b> dengan nomor polisi + nomor HP yang terdaftar. Link-nya ikut terkirim di WA nota dan pengingat.']
  ] },
  registrasi: { judul: 'Registrasi Servis', ringkas: 'Menerima motor, memberi nomor antrian, mengatur mekanik, dan mengingatkan konsumen.', bagian: [
    ['1. Motor datang', 'Menu <b>Registrasi Servis</b> → <kbd>F1</kbd> (+ Motor masuk). Kursor langsung di <b>NIK</b>. Tanyakan dulu: <i>pernah servis di sini?</i> Bila ya, tekan <kbd>F3</kbd> → ketik nopol / nama / no. HP (boleh sebagian) → <b>Pakai data</b>. Motor lain milik konsumen yang sama: <b>Konsumen saja</b>.'],
    ['2. Isi data', '<b>Data konsumen</b> sesuai KTP, <b>data kendaraan</b> sesuai STNK, <b>KM saat ini</b>, keluhan, jenis servis (Reguler / KSB / KSG ke-1..4 + nomor kupon), dan jasa. Data lama yang diubah tercatat otomatis (siapa & kapan).'],
    ['3. Kilometer', 'Di samping kolom KM tertulis <b>KM terakhir</b> motor itu. KM baru <b>tidak boleh lebih kecil</b>; aplikasi menolak menyimpan. Bila speedometer memang diganti/direset, minta <b>admin</b> menyimpan (admin wajib menulis keterangan).'],
    ['4. Pilih mekanik', 'Pilih mekanik yang <b>kosong</b> (yang sedang mengerjakan motor lain tidak bisa dipilih). Belum ada yang kosong? Biarkan kosong → status <b>Antri</b>.'],
    ['5. Daftarkan', '<kbd>F2</kbd> → nomor antrian keluar (bisa dicetak / dikirim WA). Status: <b>Antri</b> (belum ada mekanik) → <b>Dikerjakan</b> → <b>Selesai</b> (dilaporkan ke kasir) → <b>Lunas</b>.'],
    ['6. Saat ramai: nomor cepat', 'Tombol <b>Nomor cepat (cukup nopol)</b> langsung memberi nomor antrian. Motor bertanda <b>Data belum lengkap</b>; lengkapi datanya sebelum dibayar (kasir tidak bisa menerima pembayaran sebelum lengkap).'],
    ['7. Memantau antrian', 'Tab <b>Aktif / Hari ini / Ditunda / Semua</b> di kiri. Registrasi yang memantau: begitu ada mekanik kosong, buka motor <b>Antri</b> paling awal → pilih mekanik → <kbd>F2</kbd>.'],
    ['8. Motor ditunda', 'Kasir menandai <b>Lanjut lama (tunda)</b> dengan alasan (mis. tunggu part). Alasannya terlihat di tab <b>Ditunda</b> dan oleh konsumen. Untuk melanjutkan: buka motornya → pilih mekanik kosong (boleh sama atau mekanik lain) → <b>▶ Lanjutkan dikerjakan</b> → konfirmasi. Lama kerja tiap mekanik tercatat terpisah.'],
    ['9. Satu motor, satu pendaftaran', 'Motor yang masih di bengkel (Antri/Dikerjakan/Ditunda/Selesai) <b>tidak bisa didaftarkan lagi</b>. Saat nopol diketik muncul peringatan → tekan <b>Buka servis</b> untuk membuka pendaftaran yang ada.'],
    ['10. Pengingat ganti oli', 'Setiap hari buka <b>Pengingat Servis</b> → tab <b>Perlu diingatkan</b> → <b>WA ingatkan</b> (pesan sudah terisi). Konsumen bilang sudah ganti oli di bengkel lain → <b>Ganti di luar</b> (isi tanggal & KM). Minta diingatkan nanti → <b>Tunda 14 hari</b>. Motor dijual/pindah → <b>Stop</b>. Saat registrasi, jadwal oli motor juga tampil di formulir.'],
    ['11. Database konsumen', 'Satu konsumen bisa punya banyak motor. Konsumen dikenali dari <b>no. HP</b> (dan NIK bila diisi), bukan dari nama. Konsumen baru tanpa motor: <b>Konsumen & Kendaraan → Konsumen → + Konsumen baru</b>; motornya ditambahkan saat servis atau lewat <b>+ Tambah motor</b>. Saat registrasi: <kbd>F3</kbd> → cari nama/HP/NIK → <b>Pakai konsumen</b> → cukup isi data motor.'],
    ['12. Motor milik orang lain', 'Bila nopol tercatat milik orang lain, aplikasi bertanya saat simpan: <b>Ganti pemilik</b> (motor dijual — wajib cek STNK & tulis alasan; riwayat servis tetap ikut motor, data pemilik lama disembunyikan dari pemilik baru) atau <b>Hanya mengantar</b> (pemilik tetap, pengantar dicatat di servis ini).'],
    ['13. No. HP / NIK sudah terdaftar', 'No. HP milik konsumen lain → <b>Pakai data</b> (orang yang sama) atau <b>Orang lain, nomor sama</b> (mis. suami/istri). NIK yang sama selalu orang yang sama.'],
    ['14. Ganti plat & no. rangka', 'Nopol baru tetapi no. rangka/mesin sudah tercatat → pilih <b>Ganti nomor polisi</b> supaya riwayat bersambung. No. rangka/mesin berbeda dengan data nopol itu → periksa STNK fisik dulu.'],
    ['15. Data & riwayat konsumen', '<b>Konsumen & Kendaraan</b> untuk memperbaiki data (salah no. HP, alamat). <b>Riwayat Kendaraan</b> untuk melihat semua servis motor dalam bentuk tabel; klik baris untuk rincian & nota.']
  ] },
  sparepart: { judul: 'Sparepart', ringkas: 'Order part untuk servis, stok, pembelian, transfer, dan stok opname.', bagian: [
    ['1. Order sparepart servis', 'Menu <b>Order Sparepart</b> → pilih motor di kiri → tulis <b>permintaan mekanik</b> → cari part → jumlah → <b>Tambah</b>. Stok yang sudah dipesan servis lain otomatis dikurangi dari jumlah yang bisa diorder.'],
    ['2. Simpan order', 'Tombol <b>kuning "Simpan order"</b> = ada perubahan yang belum disimpan → tekan <kbd>F2</kbd> → muncul kotak <b>Order sparepart tersimpan</b> dan tombol berubah <b>hijau "✓ Tersimpan"</b>. Stok baru berkurang saat kasir menerima pembayaran.'],
    ['3. Stok part', 'Kolom <b>Ready</b> = stok dikurangi part yang sudah dipesan servis. Kolom <b>Cabang lain</b> bisa diklik untuk rincian per cabang. Menu <b>Stok Part</b>: cari part, <b>⚲ Filter</b> kategori / stok menipis, nilai stok (harga beli, harga jual, proyeksi laba). Buka part → <b>Kartu stok</b> untuk melihat riwayat keluar-masuk. <b>Export Excel</b> berisi sheet <b>Semua cabang</b> (saring kolom Cabang dengan tombol panah di judul kolom), <b>Total per cabang</b>, dan satu sheet per cabang.'],
    ['4. Pembelian dari supplier', 'Menu <b>Pembelian Stok</b> → <kbd>F1</kbd> invoice baru → tanggal, no. invoice, supplier, status bayar (lunas / belum + jatuh tempo), barang & harga beli → <b>Simpan draft</b>. Setelah barang datang: <b>Preview & terima barang</b> → cek fisik → centang → <b>Masukkan ke stok</b>. Hutang supplier ditandai lunas saat dibayar.'],
    ['5. Transfer antar cabang', 'Kirim: Stok Part → Transfer → pilih cabang tujuan & part → konfirmasi (stok cabang ini berkurang). Terima: cek fisik barang dulu → <b>Terima</b> → konfirmasi (stok bertambah).'],
    ['7. Permintaan barang antar cabang', 'Stok kurang? Di <b>Cek Stok</b> (atau saat order/jual stok tidak cukup) tekan <b>Minta kirim</b> pada cabang yang punya. Cabang pemilik barang melihat <b>Permintaan masuk</b> (angka merah di menu) → <b>Kirim</b> atau <b>Tolak</b> dengan alasan. Setelah barang sampai, cabang peminta menekan <b>Terima</b> di Stok Part.'],
    ['6. Stok opname', 'Menu <b>Stok Opname</b> → buat → isi jumlah fisik tiap part (tersimpan otomatis) → <b>Ajukan</b>. Stok baru disesuaikan setelah disetujui super admin.']
  ] },
  kasir: { judul: 'Kasir', ringkas: 'Status servis dari mekanik, pembayaran, penjualan part, kas harian, klaim KSG.', bagian: [
    ['1. Laporan mekanik', 'Menu <b>Pembayaran & Status Servis</b>. Mekanik melapor ke kasir: <b>Motor selesai</b> → nomor antrian otomatis dipanggil di layar TV; atau <b>Lanjut lama (tunda)</b> → <b>alasan wajib diisi</b> (mis. tunggu part, konsumen ambil besok). Keduanya membuat mekanik kosong lagi.'],
    ['2. Terima pembayaran servis', 'Pilih motor <b>Selesai</b> → periksa jasa & sparepart → tambah <b>biaya lain</b> / diskon bila ada → isi <b>cash / transfer</b> (pilih rekening) → <kbd>F2</kbd> → periksa total & kembalian di kotak konfirmasi → nota keluar (cetak / PDF / WA). Stok part terpotong dan jadwal ganti oli dihitung otomatis.'],
    ['Cek stok', 'Menu <b>Cek Stok</b>: ketik part → stok, sudah dipesan servis, <b>ready</b>, dan stok cabang lain. Stok kurang saat menjual → muncul pilihan <b>Minta kirim</b> dari cabang lain.'],
    ['3. Penjualan sparepart langsung', 'Menu <b>Penjualan Sparepart</b> → <kbd>F3</kbd> cari/scan part → keranjang → nama pelanggan (opsional) → pembayaran → <kbd>F2</kbd> → konfirmasi → nota.'],
    ['4. Salah nota', 'Buka nota → <b>Ajukan pembatalan</b> + alasan. Nota baru batal setelah disetujui super admin (stok kembali, servis bisa dibayar ulang). Nota tidak bisa diubah langsung.'],
    ['5. Kas harian', 'Pagi: <b>Kas & Pengeluaran</b> → <b>Buka kas</b> (uang awal di laci). Pengeluaran dicatat saat terjadi. Sore: hitung uang fisik → <b>Tutup kas</b> (selisih wajib diberi catatan) → setoran. Kas yang sudah ditutup hanya bisa dibuka ulang super admin.'],
    ['6. Klaim KSG', 'Menu <b>Klaim KSG</b>: centang nota KSG bulan itu → <b>Ajukan</b> ke main dealer. Saat uang klaim diterima → <b>Dibayar</b> (jumlah & tanggal).'],
    ['7. Pengingat servis', 'Kasir juga bisa membuka <b>Pengingat Servis</b> untuk mengirim WA pengingat ganti oli (lihat panduan Registrasi no. 10).']
  ] },
  mekanik: { judul: 'Mekanik', ringkas: 'Mengerjakan motor yang diberikan registrasi, melapor ke kasir, melihat performa & penghasilan.', bagian: [
    ['1. Menerima motor', 'Registrasi memilihkan motor untuk Anda. Satu mekanik mengerjakan <b>satu motor</b> sampai dilaporkan selesai atau ditunda. Lihat motor Anda di <b>Performa Mekanik → Pekerjaan saat ini</b>.'],
    ['2. Butuh sparepart', 'Sampaikan kebutuhan part ke bagian sparepart; mereka mengisi <b>Order Sparepart</b> untuk motor Anda.'],
    ['3. Selesai atau ditunda', 'Lapor ke <b>kasir</b>: motor <b>selesai</b>, atau harus <b>ditunda</b> (sebutkan alasannya: tunggu part, perlu izin konsumen, dll.). Setelah itu Anda kosong dan bisa menerima motor berikutnya. Motor yang ditunda bisa dilanjutkan oleh Anda atau mekanik lain; waktu kerja masing-masing tercatat.'],
    ['4. Performa', '<b>Performa Mekanik</b>: jumlah motor selesai, nilai jasa, rata-rata lama mengerjakan (waktu ditunda tidak dihitung), per tipe motor. Nilai jasa dihitung untuk mekanik yang menyelesaikan (tercantum di nota).'],
    ['5. Penghasilan & absensi', '<b>Penghasilan Saya</b> untuk gaji, komisi/insentif, slip, serta THR &amp; bonus (tab <b>THR &amp; Bonus</b>). <b>Absensi Saya</b> untuk scan QR datang & pulang.']
  ] },
  admin: { judul: 'Admin / Kepala Cabang', ringkas: 'Semua pekerjaan operasional + beberapa izin khusus.', bagian: [
    ['1. Beranda', 'Ringkasan hari ini: omzet, part terjual, motor masuk & status mekanik, stok menipis. Admin bisa membuka semua menu operasional (registrasi, order, kasir, stok, laporan).'],
    ['Daftar & cetak konsumen', 'Konsumen & Kendaraan → Konsumen → <b>🖨 Daftar &amp; Cetak</b>: pilih <b>yang servis</b> / <b>yang didaftarkan</b> pada periode (hari ini, bulan ini, bulan lalu, pilih tanggal) atau <b>semua</b>, cabang, kecamatan, punya/belum punya motor, bentuk per konsumen atau per motor → <b>Tampilkan</b> → Excel, PDF, atau Print. Admin hanya cabang yang sedang dibuka; super admin semua cabang & kolom NIK.'],
    ['Konsumen ganda & salah sambung', '<b>Gabungkan dengan…</b> (di data konsumen) bila satu orang tercatat dua kali — pilih isian yang benar per kolom, semua motor pindah. <b>Pindahkan</b> (di daftar motor konsumen) bila motor tersambung ke orang yang salah (koreksi, wajib alasan). Daftar <b>⚑ Perlu dicek</b> berisi data yang kemungkinan ganda.'],
    ['2. Izin khusus admin', '<b>KM lebih kecil</b> dari KM terakhir (speedometer diganti): simpan dari Registrasi dan tulis keterangannya. <b>Batalkan pendaftaran</b> ganda/salah daftar yang belum dibayar (tombol di Registrasi). Mengubah status servis manual.'],
    ['3. Persetujuan layar absen', 'Perangkat layar absen cabang baru meminta aktivasi → <b>Persetujuan</b> → cocokkan <b>kode di layar</b> → Setujui.'],
    ['4. Master Data', 'Admin mengatur <b>Tipe Motor</b> dan <b>Layar TV</b>. Data lain (harga jasa, mekanik, petugas & PIN, rekening, insentif) khusus super admin.'],
    ['5. Laporan & Insight', '<b>Laporan Penjualan</b> per periode (bisa Excel), penjualan part dalam rupiah, laba part. <b>Insight Konsumen</b> untuk konsumen yang lama tidak datang.']
  ] },
  super: { judul: 'Super Admin (pemilik)', ringkas: 'Pengaturan, persetujuan, keamanan data, gaji.', bagian: [
    ['1. Masuk', 'Masuk dengan <b>email + kata sandi</b> super admin. Tindakan penting meminta kata sandi lagi.'],
    ['2. Persetujuan', 'Menu <b>Persetujuan</b>: pembatalan nota (catatan + kata sandi), stok opname (periksa selisih → setujui/tolak), layar absen.'],
    ['3. Master Data', 'Jasa & harga, Tarif KSG, Mekanik, Petugas & PIN, Rekening, Cabang (isi <b>No. telp/WA</b> cabang supaya konsumen bisa booking dari halaman cek servis), Insentif & Potongan, Logo, <b>Tema Tampilan</b> (pilihan warna, termasuk Gelap & Kaca), <b>Hak Akses Menu</b> (menu & kotak Beranda per peran), Riwayat Perubahan Konsumen.'],
    ['Database konsumen', 'Setelah update ke versi 5, buka <b>Konsumen & Kendaraan → Konsumen</b> → <b>Bentuk database konsumen</b> (sekali). <b>Hapus data pribadi</b> konsumen atas permintaannya ada di data konsumen (riwayat servis & nota tetap ada).'],
    ['4. Pengingat ganti oli', '<b>Pengingat Servis</b> → atur interval (bawaan 2.000 km / 60 hari). Setelah update pertama kali tekan <b>Bangun jadwal dari nota lama</b> sekali.'],
    ['5. Karyawan', '<b>Absensi Karyawan</b> (rekap, ubah manual dengan catatan, reset HP), <b>Penghasilan Karyawan</b> (rekap, slip, kunci bulan).'],
    ['6. THR & bonus', '<b>Penghasilan Karyawan → THR &amp; Bonus</b> → <b>+ THR / Bonus baru</b>. Jumlah = <b>gaji pokok × persen</b> (atur untuk semua, lalu ubah per orang bila perlu) + tambahan Rp. Untuk THR isi tanggal hari raya & tanggal mulai kerja: masa kerja di bawah 12 bulan dihitung proporsional, dan kolom <b>Min. aturan</b> memberi tanda bila di bawah batas minimal. <b>Kunci &amp; terbitkan</b> → slip muncul di Penghasilan Saya tiap karyawan, total tercatat sebagai pengeluaran.'],
    ['7. Data', '<b>Backup Data</b> seminggu sekali (file JSON, bisa dipulihkan). Hapus semua data hanya dengan peringatan, ketik kalimat konfirmasi, dan kata sandi.']
  ] }
};

let pilih = null;
const bolehLihat = () => st.petugas?.super ? Object.keys(P) : st.role === 'admin' ? ['admin', 'registrasi', 'sparepart', 'kasir', 'mekanik', 'umum'] : [st.role, 'umum'];

function render() {
  const daftar = bolehLihat();
  if (!pilih || !daftar.includes(pilih)) pilih = st.petugas?.super ? 'super' : st.role;
  const p = P[pilih];
  $('#view').innerHTML = `<div class="panel panduan">
    <div class="row spread no-print"><div class="seg" role="group" aria-label="Pilih panduan">${daftar.map(k => `<button type="button" data-act="pd-pilih" data-k="${k}" aria-pressed="${k === pilih}">${esc(P[k].judul.split(' (')[0])}</button>`).join('')}</div><button class="btn sm" type="button" data-act="pd-cetak">🖨 Cetak</button></div>
    <h2>Panduan ${esc(p.judul)}</h2><p class="muted" style="margin:0">${esc(p.ringkas)}</p>
    <ol class="pd-list">${p.bagian.map(([j, isi]) => `<li><b>${esc(j.replace(/^\d+\.\s*/, ''))}</b><div>${isi}</div></li>`).join('')}</ol>
    ${pilih !== 'umum' ? `<p class="small muted no-print" style="margin:0">Lihat juga panduan <button class="link-btn" type="button" data-act="pd-pilih" data-k="umum">Umum</button> (masuk, tombol cepat, absensi).</p>` : ''}
  </div>`;
}
views.panduan = render;
refreshers.panduan = () => {};
Object.assign(actions, {
  'pd-pilih': el => { pilih = el.dataset.k; render(); },
  'pd-cetak': () => window.print()
});
export const PANDUAN = P;
