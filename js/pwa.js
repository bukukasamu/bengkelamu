// Versi aplikasi (PWA): bisa dipasang di HP dan PC seperti aplikasi biasa, ikon di layar utama, tanpa bilah browser.
// Tombol "Pasang aplikasi" muncul bila browser mengizinkan; di iPhone/iPad diberi petunjuk "Tambah ke Layar Utama".
let tawaran = null;
let swReg = null;
let updateReloading = false;
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

export async function updateAplikasi(btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Memeriksa versi…'; }
  try {
    if (!('serviceWorker' in navigator)) { location.reload(); return; }
    swReg = swReg || await navigator.serviceWorker.getRegistration('./') || await navigator.serviceWorker.getRegistration();
    if (!swReg) { location.reload(); return; }
    const reload = () => { if (!updateReloading) { updateReloading = true; location.reload(); } };
    navigator.serviceWorker.addEventListener('controllerchange', reload, { once: true });
    if (swReg.waiting) { swReg.waiting.postMessage({ type: 'SKIP_WAITING' }); return; }
    await swReg.update();
    if (swReg.waiting) swReg.waiting.postMessage({ type: 'SKIP_WAITING' });
    else { if (btn) { btn.disabled = false; btn.textContent = '✓ Versi terbaru'; setTimeout(() => { btn.textContent = 'Update aplikasi'; }, 3000); } window.dispatchEvent(new CustomEvent('amu-update-ok')); }
  } catch (e) { console.warn('Update aplikasi gagal', e); if (btn) { btn.disabled = false; btn.textContent = 'Update aplikasi'; } window.dispatchEvent(new CustomEvent('amu-update-fail')); }
}

if (window.navigator && 'serviceWorker' in window.navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(e => console.warn('Service worker gagal', e)));
}
