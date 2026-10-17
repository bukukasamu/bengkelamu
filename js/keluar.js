// Kotak dialog saat menekan tombol Kembali (browser / HP) dan saat keluar.
// - Kembali: bila ada jendela terbuka → ditanya dulu sebelum ditutup; bila tidak → pilih
//   "Kembali ke <menu sebelumnya>" atau "Keluar dari aplikasi" (atau Batal).
// - Menutup tab / memuat ulang halaman saat sudah masuk → peringatan bawaan browser.
// - Tombol "Keluar" (akun) → konfirmasi dulu.
import { $, konfirmasi, pilihan, closeModal, toast } from './util.js';
import { st, go, viewSebelum, menuLabel } from './state.js';
import { MENUS } from './config.js';

let aktif = false, bebas = false, sibuk = false;
const masuk = () => !!st.petugas && !!st.view;
const namaMenu = v => { const m = MENUS.find(x => x.id === v); return m ? menuLabel(m) : v; };

// Dipanggil setelah petugas masuk: pasang satu "langkah" riwayat penahan supaya tombol Kembali bisa dicegat.
export function pasangPenjaga() {
  if (aktif) return;
  aktif = true;
  try { history.replaceState({ amu: 0 }, ''); history.pushState({ amu: 1 }, ''); } catch (e) { /* abaikan */ }
}
// Untuk muat ulang/keluar yang disengaja oleh aplikasi (tanpa peringatan browser)
export function izinkanKeluar() { bebas = true; }

window.addEventListener('popstate', async () => {
  if (!aktif || bebas) return;
  if (!masuk()) return;
  try { history.pushState({ amu: 1 }, ''); } catch (e) { /* abaikan */ }
  if (sibuk || document.getElementById('kf-root')) return;   // kotak dialog sedang tampil
  sibuk = true;
  try {
    if (document.body.classList.contains('sb-open')) { document.body.classList.remove('sb-open'); const b = $('#sb-backdrop'); if (b) b.hidden = true; return; }
    if ($('#modal-root')?.innerHTML) {
      if (await konfirmasi('Tutup jendela ini?', 'Isian yang belum disimpan di jendela ini akan hilang.', { ya: 'Ya, tutup' })) closeModal();
      return;
    }
    const prev = viewSebelum[viewSebelum.length - 1];
    const opsi = [];
    if (prev) opsi.push({ v: 'kembali', label: 'Kembali ke ' + namaMenu(prev), kelas: 'pri' });
    opsi.push({ v: 'keluar', label: 'Keluar dari aplikasi', kelas: 'danger' });
    const r = await pilihan(prev ? 'Kembali atau keluar?' : 'Keluar dari aplikasi?', `Anda sedang di menu <b>${namaMenu(st.view)}</b>. Isian yang belum disimpan akan hilang bila keluar.`, opsi);
    if (r === 'kembali') { viewSebelum.pop(); go(prev, { kembali: true }); }
    else if (r === 'keluar') keluarAplikasi();
  } finally { sibuk = false; }
});

function keluarAplikasi() {
  bebas = true;
  history.go(-2);
  // Bila tidak ada halaman sebelumnya (tab baru / aplikasi terpasang di sebagian HP), coba tutup jendela
  setTimeout(() => {
    try { window.close(); } catch (e) { /* abaikan */ }
    setTimeout(() => { bebas = false; try { history.pushState({ amu: 1 }, ''); } catch (e) {} toast('Tutup tab atau jendela browser untuk keluar.'); }, 300);
  }, 500);
}

window.addEventListener('beforeunload', e => {
  if (bebas || !masuk()) return;
  e.preventDefault(); e.returnValue = '';   // browser menampilkan kotak "Tinggalkan situs?"
});

// Tombol Keluar (akun)
export async function konfirmasiLogout() {
  return konfirmasi('Keluar dari akun?', `Anda masuk sebagai <b>${String(st.petugas?.nama || '').replace(/[<>&]/g, '')}</b>. Isian yang belum disimpan akan hilang. Untuk masuk lagi perlu ${st.petugas?.super ? 'email &amp; kata sandi' : 'PIN'}.`, { ya: 'Ya, keluar', bahaya: true });
}
