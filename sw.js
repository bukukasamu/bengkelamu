// Service worker PWA Aceh Mandiri Utama.
// - File aplikasi (HTML/CSS/JS) diambil dari internet dulu supaya versi baru langsung terpakai; bila sinyal putus
//   atau lambat (> 4 detik) dipakai salinan terakhir, jadi aplikasi tetap terbuka.
// - Pustaka dari CDN (Firebase, PDF, Excel, QR, font) bernomor versi tetap, jadi disimpan sekali lalu dipakai ulang.
// - Data Firestore & login TIDAK lewat sini (ditangani Firebase sendiri).
// Ganti VERSI setiap ada update besar supaya salinan lama dibersihkan.
const VERSI = 'amu-3.1.0';
const INTI = [
  './',
  'index.html',
  'pos.html',
  'layar.html',
  'style.css',
  'manifest.webmanifest',
  'cek.webmanifest',
  'layar.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-48.png',
  '404.html',
  'wilayah/index.json',
  'wilayah/11.json',
  'js/akun.js',
  'js/angka.js',
  'js/antrian.js',
  'js/bayar.js',
  'js/beranda.js',
  'js/brand.js',
  'js/cabang.js',
  'js/cari-kendaraan.js',
  'js/cek.js',
  'js/config.js',
  'js/excel-parser.js',
  'js/firebase-config.js',
  'js/firebase.js',
  'js/import-excel.js',
  'js/kasir.js',
  'js/laporan.js',
  'js/layar.js',
  'js/main.js',
  'js/master.js',
  'js/mekanik.js',
  'js/nota-pdf.js',
  'js/nota.js',
  'js/numbering.js',
  'js/order.js',
  'js/payment.js',
  'js/pembelian.js',
  'js/pwa.js',
  'js/qr.js',
  'js/registrasi.js',
  'js/riwayat-ui.js',
  'js/riwayat.js',
  'js/seed.js',
  'js/state.js',
  'js/stats.js',
  'js/stok.js',
  'js/util.js',
  'js/wilayah.js',
  'js/wo-common.js'
];
const CDN = ['www.gstatic.com', 'cdnjs.cloudflare.com', 'cdn.sheetjs.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSI).then(c => Promise.all(INTI.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSI).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Alamat pendek (www.amuservice.id/pos, /layar) saat offline diarahkan ke file halamannya; lainnya ke cek servis
function halamanUntuk(url) {
  const akhir = new URL(url).pathname.replace(/\/+$/, '').split('/').pop().toLowerCase();
  return { pos: 'pos.html', 'pos.html': 'pos.html', petugas: 'pos.html', layar: 'layar.html', 'layar.html': 'layar.html', tv: 'layar.html', antrian: 'layar.html' }[akhir] || 'index.html';
}
function jaringanDulu(req) {
  return new Promise(resolve => {
    let selesai = false;
    const dariCache = () => caches.match(req, { ignoreSearch: req.mode === 'navigate' }).then(r => r || (req.mode === 'navigate' ? caches.match(halamanUntuk(req.url)) : null));
    const t = setTimeout(() => dariCache().then(r => { if (r && !selesai) { selesai = true; resolve(r); } }), 4000);
    fetch(req).then(res => {
      clearTimeout(t);
      if (res && res.ok) { const salin = res.clone(); caches.open(VERSI).then(c => c.put(req, salin)); }
      if (!selesai) { selesai = true; resolve(res); }
    }).catch(() => {
      clearTimeout(t);
      dariCache().then(r => { if (!selesai) { selesai = true; resolve(r || new Response('Tidak ada koneksi internet', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })); } });
    });
  });
}
function cacheDulu(req) {
  return caches.match(req).then(r => r || fetch(req).then(res => {
    if (res && (res.ok || res.type === 'opaque')) { const salin = res.clone(); caches.open(VERSI).then(c => c.put(req, salin)); }
    return res;
  }));
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) { e.respondWith(jaringanDulu(req)); return; }
  if (CDN.includes(url.hostname)) e.respondWith(cacheDulu(req));
});
