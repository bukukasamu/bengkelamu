// 5.19.2 — Perangkat desain PDF bersama: kepala bergradasi, kartu, judul bagian, tabel modern, kaki halaman.
// Warna mengikuti tema aplikasi (Master Data → Tema Tampilan); tema Gelap/Kaca memakai biru agar tetap cerah saat dicetak.
// Gradasi dibuat dari pita-pita tipis berwarna peralihan (didukung semua pembaca PDF & printer).
import { getBrand } from './brand.js';
import { APP_NAME, APP_SUB, COPYRIGHT } from './config.js';

const PALET = {
  biru: { g: [[10, 36, 112], [29, 90, 216], [106, 61, 240]], ac: [29, 90, 216], soft: [236, 242, 255], ink: [19, 34, 61] },
  klasik: { g: [[9, 27, 69], [23, 71, 166], [58, 111, 208]], ac: [23, 71, 166], soft: [234, 240, 250], ink: [19, 33, 58] },
  tosca: { g: [[5, 60, 54], [11, 132, 120], [17, 163, 154]], ac: [11, 132, 120], soft: [227, 246, 242], ink: [15, 46, 43] },
  ungu: { g: [[35, 17, 94], [103, 57, 204], [181, 60, 196]], ac: [103, 57, 204], soft: [242, 236, 255], ink: [33, 26, 59] },
  merah: { g: [[79, 11, 16], [184, 40, 43], [226, 85, 43]], ac: [184, 40, 43], soft: [253, 236, 234], ink: [43, 23, 22] }
};
export function palet() {
  let t = getBrand()?.tema; if (!t) { try { t = localStorage.getItem('amu-tema'); } catch (e) {} }
  return PALET[{ klasik: 'klasik', tosca: 'tosca', ungu: 'ungu', merah: 'merah' }[t] || 'biru'];
}
const campur = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k));
export const tglCetak = () => new Date().toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// Pembungkus teks: o = { size, bold, color:[r,g,b] | gray, align, maxW }
export function penulis(pdf) {
  return (s, x, y, o = {}) => {
    pdf.setFont('helvetica', o.bold ? 'bold' : 'normal'); pdf.setFontSize(o.size || 9);
    if (o.color) pdf.setTextColor(...o.color); else pdf.setTextColor(o.gray ?? 30);
    let t = String(s ?? ''); if (o.maxW) t = pdf.splitTextToSize(t, o.maxW);
    pdf.text(t, x, y, o.align ? { align: o.align } : undefined);
  };
}
// Gradasi mendatar (kiri → kanan) melalui beberapa warna; r = jari-jari sudut membulat (opsional)
export function gradasi(pdf, x, y, w, h, warna, r = 0, langkah = 0) {
  langkah = langkah || Math.max(90, Math.ceil(w / (r ? 0.25 : 2)));
  const lw = w / langkah;
  for (let i = 0; i < langkah; i++) {
    const k = i / (langkah - 1), seg = Math.min(warna.length - 2, Math.floor(k * (warna.length - 1))), kk = k * (warna.length - 1) - seg;
    pdf.setFillColor(...campur(warna[seg], warna[seg + 1], kk));
    const sx = x + i * lw; let dy = 0;
    if (r) { const d = Math.min(sx + lw / 2 - x, x + w - (sx + lw / 2)); if (d < r) dy = r - Math.sqrt(Math.max(0, r * r - (r - Math.max(0, d)) ** 2)); }
    pdf.rect(sx, y + dy, lw + 0.15, h - 2 * dy, 'F');
  }
}
// Lingkaran transparan sebagai hiasan di kepala dokumen
function hiasan(pdf, x, y, r, op = 0.1) {
  pdf.saveGraphicsState(); pdf.setGState(new pdf.GState({ opacity: op })); pdf.setFillColor(255, 255, 255); pdf.circle(x, y, r, 'F'); pdf.restoreGraphicsState();
}

// Kepala dokumen: pita gradasi selebar halaman + logo di plat putih + nama toko + judul dokumen di kanan.
// o = { W, M, h, judul, sub, kanan: [baris...], logo, cabang }
export function kepala(pdf, o) {
  const P = palet(), t = penulis(pdf), { W, M } = o, h = o.h || 30;
  gradasi(pdf, 0, 0, W, h, P.g);
  hiasan(pdf, W - 18, -6, 26, 0.08); hiasan(pdf, W * 0.62, h + 8, 18, 0.06);
  let x0 = M;
  if (o.logo) {
    const box = h - 12, k = Math.min((box - 4) / o.logo.w, (box - 4) / o.logo.h), lw = o.logo.w * k, lh = o.logo.h * k;
    pdf.setFillColor(255, 255, 255); pdf.roundedRect(M, 6, box, box, 3, 3, 'F');
    pdf.addImage(o.logo.url, 'PNG', M + (box - lw) / 2, 6 + (box - lh) / 2, lw, lh); x0 = M + box + 4;
  }
  const kecil = W < 160;
  t(APP_NAME.toUpperCase(), x0, h / 2 - 0.5, { bold: true, size: kecil ? 10 : 13, color: [255, 255, 255] });
  t(o.cabang ? 'Cabang ' + o.cabang : APP_SUB, x0, h / 2 + 4.3, { size: kecil ? 6.8 : 8, color: [220, 230, 255] });
  t(String(o.judul || '').toUpperCase(), W - M, h / 2 - 0.5, { bold: true, size: kecil ? 10.5 : 13, color: [255, 255, 255], align: 'right' });
  (o.kanan || []).filter(Boolean).forEach((s, i) => t(s, W - M, h / 2 + 4.3 + i * 4, { size: kecil ? 7.2 : 8.5, color: [228, 236, 255], align: 'right' }));
  return h + 7;
}
// Kepala ringkas untuk halaman lanjutan
export function kepalaRingkas(pdf, o) {
  const P = palet(), t = penulis(pdf), { W, M } = o;
  gradasi(pdf, 0, 0, W, 9, P.g);
  t(APP_NAME.toUpperCase(), M, 6, { bold: true, size: 7.5, color: [255, 255, 255] });
  t(String(o.judul || '').toUpperCase(), W - M, 6, { bold: true, size: 7.5, color: [255, 255, 255], align: 'right' });
  return 15;
}
// Kaki semua halaman: garis tipis berwarna + tanggal cetak + nomor halaman
export function kakiSemua(pdf, o) {
  const P = palet(), t = penulis(pdf), { W, H, M } = o, n = pdf.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    pdf.setPage(i); pdf.setDrawColor(...P.ac); pdf.setLineWidth(0.35); pdf.line(M, H - 11, M + 14, H - 11);
    pdf.setDrawColor(225); pdf.setLineWidth(0.2); pdf.line(M + 15, H - 11, W - M, H - 11);
    t(`Dicetak ${tglCetak()}${o.oleh ? ' oleh ' + o.oleh : ''}${o.catatan ? ' · ' + o.catatan : ''} · ${COPYRIGHT}`, M, H - 6.5, { size: 6.5, gray: 130, maxW: W - 2 * M - 22 });
    if (n > 1 || o.halaman) t(`Halaman ${i} / ${n}`, W - M, H - 6.5, { size: 6.5, gray: 130, align: 'right' });
  }
}
// Judul bagian: batang warna kecil + teks kapital berwarna aksen
export function judulBagian(pdf, s, x, y) {
  const P = palet(), t = penulis(pdf);
  pdf.setFillColor(...P.ac); pdf.roundedRect(x, y - 3.2, 1.6, 4.2, 0.8, 0.8, 'F');
  t(String(s).toUpperCase(), x + 3.6, y, { bold: true, size: 8.5, color: P.ac });
  return y + 5;
}
// Kartu ringkasan: putih, garis tepi halus, garis warna di atas
export function kartu(pdf, x, y, w, h, { lbl, val, sub, warna, i = 0 }) {
  const P = palet(), t = penulis(pdf), aksen = [P.g[1], P.g[2], [15, 143, 135], [230, 120, 30]][i % 4];
  pdf.setFillColor(...P.soft); pdf.roundedRect(x, y, w, h, 2.2, 2.2, 'F');
  pdf.setFillColor(...aksen); pdf.roundedRect(x, y, w, 1.4, 0.7, 0.7, 'F');
  t(String(lbl).toUpperCase(), x + 3, y + 5.8, { size: 6.3, bold: true, gray: 105 });
  t(val, x + 3, y + 11.4, { size: 10.5, bold: true, color: warna || P.ink });
  if (sub) t(sub, x + 3, y + h - 2.4, { size: 6.3, gray: 120, maxW: w - 5 });
}
// Tabel modern. kolom = [[judul, lebar, 'r'?], ...]; baris = [[...]]; baris.total = [...] (opsional)
// Mengembalikan y akhir; ganti halaman otomatis lewat cb.halBaru() yang mengembalikan y baru.
export function tabel(pdf, { x, y, kolom, baris, H, M, halBaru, ukuran = 7.8, maks = 2, pad = 2.8 }) {
  const P = palet(), t = penulis(pdf), lebar = kolom.reduce((a, k) => a + k[1], 0);
  const kepalaT = () => {
    pdf.setFillColor(...P.soft); pdf.roundedRect(x, y, lebar, 7, 1.6, 1.6, 'F');
    let cx = x; kolom.forEach(([j, w, a]) => { t(j.toUpperCase(), a === 'r' ? cx + w - 2.2 : cx + 2.2, y + 4.7, { bold: true, size: 6.6, color: P.ac, align: a === 'r' ? 'right' : undefined }); cx += w; });
    y += 7.6;
  };
  kepalaT();
  baris.forEach((r, i) => {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(ukuran);
    const sel = r.map((v, k) => pdf.splitTextToSize(String(v ?? ''), kolom[k][1] - 4.4).slice(0, maks));
    const h = Math.max(...sel.map(s => s.length)) * (ukuran * 0.42) + pad;
    if (y + h > H - M - 8) { y = halBaru(); kepalaT(); }
    if (i % 2) { pdf.setFillColor(249, 250, 252); pdf.rect(x, y, lebar, h, 'F'); }
    let cx = x; sel.forEach((s, k) => { const [, w, a] = kolom[k]; pdf.setTextColor(35); pdf.text(s, a === 'r' ? cx + w - 2.2 : cx + 2.2, y + ukuran * 0.42 + pad / 2 - 0.5, a === 'r' ? { align: 'right' } : undefined); cx += w; });
    pdf.setDrawColor(236); pdf.setLineWidth(0.15); pdf.line(x, y + h, x + lebar, y + h);
    y += h;
  });
  if (baris.total) {
    if (y + 8 > H - M - 8) { y = halBaru(); }
    pdf.setDrawColor(...P.ac); pdf.setLineWidth(0.35); pdf.line(x, y, x + lebar, y);
    let cx = x; baris.total.forEach((v, k) => { const [, w, a] = kolom[k]; t(v, a === 'r' ? cx + w - 2.2 : cx + 2.2, y + 4.8, { bold: true, size: ukuran, color: P.ink, align: a === 'r' ? 'right' : undefined }); cx += w; });
    y += 7.5;
  }
  return y;
}
// Kotak tanda tangan berdampingan
export function tandaTangan(pdf, { x, y, w, kiri, kanan }) {
  const t = penulis(pdf), kol = w / 2;
  [[kiri, x], [kanan, x + kol]].forEach(([d, cx]) => {
    t(d[0], cx + kol / 2, y, { size: 8, gray: 90, align: 'center' });
    pdf.setDrawColor(170); pdf.setLineWidth(0.25); pdf.line(cx + 10, y + 20, cx + kol - 10, y + 20);
    t(d[1] || '________________', cx + kol / 2, y + 24.5, { size: 8.5, bold: true, align: 'center' });
    if (d[2]) t(d[2], cx + kol / 2, y + 28.5, { size: 7, gray: 120, align: 'center' });
  });
  return y + 32;
}
// Lencana kecil berwarna (mis. status DITERIMA)
export function lencana(pdf, s, x, y, warna, align = 'left') {
  const t = penulis(pdf); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.2);
  const w = pdf.getTextWidth(s) + 6, sx = align === 'right' ? x - w : x;
  pdf.setFillColor(...warna.map(v => Math.round(v + (255 - v) * 0.85))); pdf.roundedRect(sx, y - 3.8, w, 5.4, 2.7, 2.7, 'F');
  t(s, sx + 3, y, { size: 7.2, bold: true, color: warna });
  return w;
}
