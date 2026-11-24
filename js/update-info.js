// 5.31.0 — Jendela "Apa yang baru" yang muncul SEKALI per perangkat setiap kali versi aplikasi naik.
// Disimpan di localStorage (amu-info-update = nomor versi terakhir yang sudah dibaca).
import { $, esc, modal, closeModal } from './util.js';
import { st, actions, go, can } from './state.js';
import { APP_VERSION } from './config.js';

const KUNCI = 'amu-info-update';
const sudahDibaca = () => { try { return localStorage.getItem(KUNCI) === APP_VERSION; } catch (e) { return true; } };
const tandai = () => { try { localStorage.setItem(KUNCI, APP_VERSION); } catch (e) { /* abaikan */ } };

function isi() {
  const stok = can('stok') || can('pembelian') || can('riwayatStok');
  const li = [];
  if (stok) {
    li.push('<b>Menu baru "Riwayat Stok"</b> (grup Sparepart): semua barang masuk &amp; keluar cabang dalam satu halaman, lengkap dengan <b>tanggal dan hari</b>, nomor PB/TF, dan petugas. Ada ringkasan per part, riwayat transfer lengkap, dan tombol <b>⬇ Excel</b>.');
    li.push('Setiap barang masuk kini diberi label asal: <span class="pill p-warn">Input sendiri</span> (Pembelian / terima PO / stok awal) atau <span class="pill p-info">Dari transfer</span> (kiriman cabang lain yang ditekan Terima). Label juga tampil di <b>Kartu stok</b> dan kolom baru <b>Asal masuk</b> di Stok Part.');
    li.push('<span class="pill p-bad">⚠ dobel?</span> otomatis menandai part yang punya Input sendiri <b>dan</b> Dari transfer dengan jumlah sama dalam ±14 hari — tanda barang kiriman yang dicatat lagi di Pembelian.');
    li.push('<b>Pencegahan dobel:</b> saat mencatat Pembelian atau terima PO, aplikasi memperingatkan bila part yang sama sedang/baru dikirim dari cabang lain. Kiriman yang belum diterima tampil di Stok Part, Pembelian, dan Riwayat Stok, dengan angka di menu.');
    li.push('<b>Kalau ada yang salah input</b>, ikuti topik baru <b>Salah input ✏️</b> di Panduan: alur per kasus (pembelian, transfer, PO, stok awal, stok dobel, selisih, nota), siapa yang melakukan, dan kapan perlu persetujuan Super Admin.');
    li.push('<b>Koreksi tanpa hapus data:</b> pembelian yang sudah masuk stok bisa <b>Ajukan pembatalan</b> (disetujui Super Admin → stok &amp; hutang dikoreksi). Transfer yang masih dikirim bisa <b>Tolak</b> (penerima) atau <b>Batalkan kirim</b> (pengirim); transfer yang sudah diterima bisa diajukan pembatalan.');
  }
  li.push('<b>Nota part kini mencantumkan kode part</b> di bawah nama part (layar, cetak struk/folio, PDF, dan WhatsApp).');
  return li;
}

const stokBoleh = () => can('stok') || can('pembelian') || can('riwayatStok');
export function tampilkanInfoUpdate(coba = 0) {
  if (!st.petugas || sudahDibaca()) return;
  // tunggu bila sedang ada jendela lain (mis. pengingat absen)
  if ($('#modal-root')?.innerHTML.trim()) { if (coba < 20) setTimeout(() => tampilkanInfoUpdate(coba + 1), 3000); return; }
  modal(`<div class="upd-pop"><div class="row spread"><div><span class="upd-ver">Versi ${esc(APP_VERSION)}</span><h2>Aplikasi sudah diperbarui ✨</h2></div><button class="btn sm ghost" type="button" data-act="upd-ok" aria-label="Tutup">✕</button></div>
    <p class="small muted" style="margin:0">Berikut perubahan penting. Jendela ini hanya muncul sekali di perangkat ini.</p>
    <ul>${isi().map(x => `<li>${x}</li>`).join('')}</ul>
    ${can('stok') || can('pembelian') ? '<div class="note small"><b>Ingat:</b> barang kiriman dari cabang lain cukup ditekan <b>Terima</b> di Stok Part. <b>Pembelian Stok hanya untuk barang dari supplier.</b></div>' : ''}
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn" type="button" data-act="upd-panduan">Baca tata cara lengkap</button>${stokBoleh() ? '<button class="btn" type="button" data-act="go-panduan-koreksi">Alur kalau salah input</button>' : ''}${can('riwayatStok') ? '<button class="btn" type="button" data-act="upd-riwayat">Buka Riwayat Stok</button>' : ''}<button class="btn pri" type="button" data-act="upd-ok">Mengerti</button></div></div>`, 'wide');
  tandai();   // dianggap dibaca begitu tampil, supaya tidak muncul lagi walau ditutup dengan Esc
}

Object.assign(actions, {
  'upd-ok': () => closeModal(),
  'upd-panduan': async () => { closeModal(); const m = await import('./panduan.js'); m.bukaTopik('baru'); go('panduan'); },
  'upd-riwayat': () => { closeModal(); go('riwayatStok'); },
  // Dipakai juga dari Riwayat Stok, Pembelian, dan Kartu stok
  'go-panduan-koreksi': async () => { closeModal(); const m = await import('./panduan.js'); m.bukaTopik('koreksi'); go('panduan'); }
});
