// Nota dalam bentuk PDF (lebar struk 80 mm), hitam-putih, dengan watermark logo toko.
// Pustaka jsPDF dimuat dari CDN saat pertama kali dibutuhkan.
import { notaRows } from './nota.js';
import { getBrand, loadBrand } from './brand.js';
import { APP_NAME } from './config.js';

const JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
let loading = null;
export function preloadPdf() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  if (!loading) loading = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = JSPDF_URL; s.async = true;
    s.onload = () => res(window.jspdf); s.onerror = () => { loading = null; rej(new Error('Pustaka PDF gagal dimuat, periksa koneksi internet')); };
    document.head.appendChild(s);
  });
  return loading;
}

// Logo diubah ke PNG hitam-putih (tanpa warna) + ukuran aslinya. Tepi kosong di sekeliling logo dipangkas
// supaya logo pas di tengah nota dan proporsinya tidak berubah.
async function logoPng() {
  let b = getBrand(); if (b.logo === undefined) b = await loadBrand();
  if (!b.logo) return null;
  return new Promise(res => {
    const img = new Image();
    img.onload = () => {
      try {
        const w = img.naturalWidth || 300, h = img.naturalHeight || 300;
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0, w, h);
        const im = g.getImageData(0, 0, w, h), d = im.data;
        let x0 = w, y0 = h, x1 = -1, y1 = -1;
        for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) {
          const v = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
          d[i] = d[i + 1] = d[i + 2] = v;
          // piksel berisi = tidak transparan dan bukan putih polos
          if (d[i + 3] > 16 && v < 246) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        g.putImageData(im, 0, 0);
        if (x1 < x0 || y1 < y0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; }
        const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
        const o = document.createElement('canvas'); o.width = cw; o.height = ch;
        o.getContext('2d').drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
        res({ url: o.toDataURL('image/png'), w: cw, h: ch });
      } catch (e) { res(null); }
    };
    img.onerror = () => res(null);
    img.src = b.logo;
  });
}
// Ukuran gambar agar muat di kotak maxW x maxH tanpa mengubah perbandingan sisinya
function muat(logo, maxW, maxH) { const k = Math.min(maxW / logo.w, maxH / logo.h); return { w: logo.w * k, h: logo.h * k }; }

const W = 80, M = 5, LH = 4.3;   // lebar kertas, margin, tinggi baris (mm)

function layout(pdf, rows, logo, draw) {
  let y = M + 2;
  if (logo) { const { w, h } = muat(logo, 36, 16); if (draw) pdf.addImage(logo.url, 'PNG', (W - w) / 2, y, w, h); y += h + 5; }
  for (const r of rows) {
    if (r.type === 'title') { if (draw) { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.text(r.l, W / 2, y + 1, { align: 'center' }); } y += LH + 1.5; continue; }
    if (r.type === 'sub') { if (draw) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(r.l, W / 2, y, { align: 'center' }); } y += LH; continue; }
    if (r.type === 'line') { if (draw) { pdf.setLineDashPattern([0.8, 0.8], 0); pdf.setDrawColor(150); pdf.line(M, y - 1.4, W - M, y - 1.4); pdf.setLineDashPattern([], 0); } y += 2.6; continue; }
    if (r.type === 'head') { if (draw) { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.text(r.l, M, y); } y += LH; continue; }
    if (r.type === 'center') { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(r.small ? 7 : 8.5); const ls = pdf.splitTextToSize(r.l, W - 2 * M); if (draw) pdf.text(ls, W / 2, y, { align: 'center' }); y += ls.length * (r.small ? 3.4 : LH) + (r.small ? 0.8 : 0); continue; }
    if (r.type === 'item') {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); const ls = pdf.splitTextToSize(r.l, W - 2 * M);
      if (draw) pdf.text(ls, M, y); y += ls.length * LH;
      if (draw) { pdf.setFontSize(8); pdf.text('   ' + r.sub, M, y); pdf.text(r.r, W - M, y, { align: 'right' }); } y += LH; continue;
    }
    // lr
    pdf.setFont('helvetica', r.bold ? 'bold' : 'normal'); pdf.setFontSize(r.bold ? 10.5 : 8.5);
    const rw = pdf.getTextWidth(String(r.r)) + 3, ls = pdf.splitTextToSize(String(r.l), W - 2 * M - rw);
    if (draw) { pdf.text(ls, M, y); pdf.text(String(r.r), W - M, y, { align: 'right' }); }
    y += ls.length * LH + (r.bold ? 1 : 0);
  }
  return y + M;
}

export async function notaPdfBlob(t) {
  const lib = await preloadPdf(), logo = await logoPng(), rows = notaRows(t);
  const probe = new lib.jsPDF({ unit: 'mm', format: [W, 200] });
  const H = Math.max(110, layout(probe, rows, logo, false));
  const pdf = new lib.jsPDF({ unit: 'mm', format: [W, H] });
  pdf.setProperties({ title: `Nota ${t.no}`, author: APP_NAME });
  // Watermark tanpa warna: logo abu-abu besar transparan di tengah (atau nama toko miring bila belum ada logo)
  pdf.saveGraphicsState();
  pdf.setGState(new pdf.GState({ opacity: 0.08 }));
  if (logo) { const { w, h } = muat(logo, W - 16, H * 0.55); pdf.addImage(logo.url, 'PNG', (W - w) / 2, (H - h) / 2, w, h); }
  else { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(26); pdf.setTextColor(60); pdf.text(APP_NAME.toUpperCase(), W / 2, H / 2, { align: 'center', angle: 35 }); }
  pdf.restoreGraphicsState();
  pdf.setTextColor(25);
  layout(pdf, rows, logo, true);
  return pdf.output('blob');
}

export function saveBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
