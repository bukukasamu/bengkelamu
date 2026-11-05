// Service worker PWA Aceh Mandiri Utama.
// - Halaman HTML diambil dari internet dulu (maks. 2,5 detik), lalu salinan terakhir bila sinyal lambat/putus.
// - File aplikasi (JS/CSS/JSON/ikon) memakai pola "cache dulu, perbarui di belakang" (stale-while-revalidate):
//   aplikasi langsung terbuka dari salinan di perangkat (tanpa menunggu puluhan file dari internet satu per satu),
//   sementara versi terbaru diunduh diam-diam dan dipakai pada pembukaan berikutnya. (5.19.0: penyebab utama loading lama)
// - Pustaka dari CDN (Firebase, PDF, Excel, QR, font) bernomor versi tetap, jadi disimpan sekali lalu dipakai ulang.
// - Data Firestore & login TIDAK lewat sini (ditangani Firebase sendiri).
// Ganti VERSI setiap ada update besar supaya salinan lama dibersihkan.
const VERSI = 'amu-5.20.0';
const INTI = [
  './',
  'index.html',
  'pos.html',
  'layar.html',
  'absen.html',
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
  'js/absen-layar.js',
  'js/konsumen-daftar.js',
  'js/konsumen.js',
  'js/konsumen-data.js',
  'js/cek-stok.js',
  'js/thr.js',
  'js/tema.js',
  'js/pengingat.js',
  'js/panduan.js',
  'js/km-oli.js',
  'js/absensi.js',
  'js/akun.js',
  'js/angka.js',
  'js/antrian.js',
  'js/backup.js',
  'js/bayar.js',
  'js/beranda.js',
  'js/brand.js',
  'js/cabang.js',
  'js/chat.js',
  'js/presence.js',
  'js/pdf-kit.js',
  'js/mobile-nav.js',
  'js/absen-pdf.js',
  'js/memo.js',
  'js/cari-kendaraan.js',
  'js/cari-pilihan.js',
  'js/cek.js',
  'js/config.js',
  'js/data-trx.js',
  'js/excel-parser.js',
  'js/firebase-config.js',
  'js/firebase.js',
  'js/hapus-semua.js',
  'js/import-excel.js',
  'js/keluar.js',
  'js/insight.js',
  'js/kasir.js',
  'js/keuangan.js',
  'js/konsumen-pdf.js',
  'js/kontrol.js',
  'js/laporan-pdf.js',
  'js/laporan.js',
  'js/layar.js',
  'js/log-konsumen.js',
  'js/main.js',
  'js/master.js',
  'js/mekanik.js',
  'js/migrasi.js',
  'js/nota-pdf.js',
  'js/nota.js',
  'js/numbering.js',
  'js/opname.js',
  'js/order.js',
  'js/otorisasi.js',
  'js/payment.js',
  'js/pembelian.js',
  'js/penghasilan.js',
  'js/persetujuan.js',
  'js/pwa.js',
  'js/qr.js',
  'js/registrasi.js',
  'js/riwayat-ui.js',
  'js/riwayat.js',
  'js/seed.js',
  'js/slip-pdf.js',
  'js/state.js',
  'js/stats.js',
  'js/stok.js',
  'js/util.js',
  'js/wilayah.js',
  'js/wo-common.js'
];
const CDN = ['www.gstatic.com', 'cdnjs.cloudflare.com', 'cdn.sheetjs.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSI).then(c => Promise.all(INTI.map(u => c.add(new Request(u, { cache: 'reload' })).catch(() => null)))).then(() => self.skipWaiting()));
});
self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting();
  // Tombol "Update aplikasi": kosongkan salinan supaya semua file diambil ulang dari internet
  if (e.data?.type === 'CLEAR_CACHE') e.waitUntil(caches.keys().then(ks => Promise.all(ks.map(k => caches.delete(k)))).then(() => e.ports?.[0]?.postMessage('ok')));
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
    const t = setTimeout(() => dariCache().then(r => { if (r && !selesai) { selesai = true; resolve(r); } }), 2500);
    fetch(req).then(res => {
      clearTimeout(t);
      if (res && res.ok) { const salin = res.clone(); caches.open(VERSI).then(c => c.put(req, salin)); if (!selesai) { selesai = true; resolve(res); } return; }
      if (req.mode === 'navigate') { dariCache().then(r => { if (!selesai) { selesai = true; resolve(r || res); } }); return; }
      if (!selesai) { selesai = true; resolve(res); }
    }).catch(() => {
      clearTimeout(t);
      dariCache().then(r => { if (!selesai) { selesai = true; resolve(r || new Response('Tidak ada koneksi internet', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })); } });
    });
  });
}
// Cache dulu + perbarui di belakang. Pembaruan selesai walau halaman sudah memakai salinan lama (waitUntil).
function cacheLaluPerbarui(e) {
  const req = e.request;
  const ambil = fetch(req).then(res => {
    if (res && res.ok) { const salin = res.clone(); caches.open(VERSI).then(c => c.put(req, salin)); }
    return res;
  });
  return caches.match(req, { ignoreSearch: true }).then(r => {
    if (r) { e.waitUntil(ambil.catch(() => null)); return r; }
    return ambil.catch(() => new Response('', { status: 504 }));
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
  if (url.origin === self.location.origin) {
    // sw.js & halaman HTML selalu dicek ke internet dulu; file lain langsung dari salinan
    if (req.mode === 'navigate' || /\.html$|\/sw\.js$|\/$/.test(url.pathname)) e.respondWith(jaringanDulu(req));
    else e.respondWith(cacheLaluPerbarui(e));
    return;
  }
  if (CDN.includes(url.hostname)) e.respondWith(cacheDulu(req));
});
