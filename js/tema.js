// Tema warna tampilan. Dipilih super admin di Master Data → Tema Tampilan, disimpan di publik/brand.tema
// (berlaku untuk semua perangkat, termasuk halaman login & cek servis konsumen). Disalin ke localStorage supaya
// tema langsung terpasang saat halaman dibuka (tanpa kedip warna lama).
export const TEMA = [
  { id: 'otomatis', nama: 'Otomatis', ket: 'Biru segar, ikut mode gelap HP/PC', sb: '#103a8c', bg: '#f2f6fc', ac: '#1d5ad8', pn: '#ffffff' },
  { id: 'segar', nama: 'Biru Segar', ket: 'Navy-biru terang (selalu terang)', sb: '#103a8c', bg: '#f2f6fc', ac: '#1d5ad8', pn: '#ffffff' },
  { id: 'klasik', nama: 'Biru Klasik', ket: 'Warna versi lama, lebih kalem', sb: '#0e2b63', bg: '#e9eef5', ac: '#1747a6', pn: '#ffffff' },
  { id: 'tosca', nama: 'Hijau Tosca', ket: 'Sejuk dan bersih', sb: '#0b5f58', bg: '#eef8f6', ac: '#0b8478', pn: '#ffffff' },
  { id: 'ungu', nama: 'Ungu', ket: 'Modern dan lembut', sb: '#40258f', bg: '#f5f3fc', ac: '#6739cc', pn: '#ffffff' },
  { id: 'merah', nama: 'Merah Marun', ket: 'Tegas, nuansa racing', sb: '#8f1d22', bg: '#fbf4f3', ac: '#b8282b', pn: '#ffffff' },
  { id: 'gelap', nama: 'Gelap', ket: 'Nyaman di ruangan redup / malam', sb: '#091a3d', bg: '#0c1320', ac: '#78a2ff', pn: '#141e2f' },
  { id: 'kaca', nama: 'Kaca (glass)', ket: 'Panel transparan berkilau. Lebih berat di PC/HP lama', sb: 'rgba(18,44,120,.75)', bg: 'linear-gradient(135deg,#9cc2ff,#c9b6ff 55%,#9fe6dd)', ac: '#2457e0', pn: 'rgba(255,255,255,.65)' }
];
const KUNCI = 'amu-tema';
export const temaAktif = () => document.documentElement.dataset.tema || 'otomatis';

export function terapkanTema(id, simpan = true) {
  const t = TEMA.find(x => x.id === id) ? id : 'otomatis', h = document.documentElement;
  if (t === 'otomatis') { delete h.dataset.tema; delete h.dataset.theme; }
  else { h.dataset.tema = t; h.dataset.theme = t === 'gelap' ? 'dark' : 'light'; }
  const m = document.querySelector('meta[name="theme-color"]'), info = TEMA.find(x => x.id === t);
  if (m && info && !info.sb.startsWith('rgba')) m.setAttribute('content', info.sb);
  if (simpan) { try { localStorage.setItem(KUNCI, t); } catch (e) { /* abaikan */ } }
}
// Dipanggil paling awal (sebelum data dimuat): pakai tema terakhir yang tersimpan di perangkat ini
export function temaAwal() { if (document.body?.classList.contains('tv-body') || document.body?.classList.contains('ab-body')) return; let t = null; try { t = localStorage.getItem(KUNCI); } catch (e) {} if (t) terapkanTema(t, false); }
temaAwal();

// Gambar kecil contoh tema (sidebar, kartu, tombol)
export const contohTema = t => `<span class="tema-mini" style="background:${t.bg}"><span class="s" style="background:${t.sb}"><i></i><i></i><i></i></span><span class="m"><b style="background:${t.pn};box-shadow:0 1px 3px rgba(0,0,0,.12)"></b><b style="background:${t.pn};box-shadow:0 1px 3px rgba(0,0,0,.12)"></b><u style="background:${t.ac}"></u></span></span>`;
