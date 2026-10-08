// Versi aplikasi (PWA): bisa dipasang di HP dan PC seperti aplikasi biasa, ikon di layar utama, tanpa bilah browser.
// Tombol "Pasang aplikasi" muncul bila browser mengizinkan; di iPhone/iPad diberi petunjuk "Tambah ke Layar Utama".
let tawaran = null;
const tombol = new Set();
const cocok = q => !!window.matchMedia?.(q)?.matches;
export const terpasang = () => cocok('(display-mode: standalone)') || cocok('(display-mode: fullscreen)') || window.navigator?.standalone === true;
const iOS = () => { const n = window.navigator || {}; return /iphone|ipad|ipod/i.test(n.userAgent || '') || (n.platform === 'MacIntel' && n.maxTouchPoints > 1); };

function perbarui() { tombol.forEach(b => { b.hidden = terpasang() || !(tawaran || iOS()); }); }

// petunjuk(teks) dipanggil bila perlu menampilkan cara memasang manual (iPhone/iPad, atau browser tanpa dukungan)
export function pasangTombol(btn, petunjuk) {
  if (!btn) return;
  tombol.add(btn); perbarui();
  btn.addEventListener('click', async () => {
    if (tawaran) { tawaran.prompt(); const r = await tawaran.userChoice.catch(() => null); if (r?.outcome === 'accepted') tawaran = null; perbarui(); return; }
    petunjuk?.(iOS()
      ? 'Di iPhone/iPad: buka halaman ini di Safari, ketuk tombol Bagikan (kotak dengan panah ke atas), lalu pilih "Tambah ke Layar Utama".'
      : 'Buka menu browser (⋮) lalu pilih "Instal aplikasi" atau "Tambahkan ke layar utama".');
  });
}

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); tawaran = e; perbarui(); });
window.addEventListener('appinstalled', () => { tawaran = null; perbarui(); });

if (window.navigator && 'serviceWorker' in window.navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(e => console.warn('Service worker gagal', e)));
}
