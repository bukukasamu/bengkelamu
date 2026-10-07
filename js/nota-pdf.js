// Nota dalam bentuk PDF (lebar struk 80 mm) dengan watermark logo toko.
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

// Logo diubah ke PNG + ukuran aslinya (jsPDF butuh PNG/JPEG)
async function logoPng() {
  let b = getBrand(); if (b.logo === undefined) b = await loadBrand();
  if (!b.logo) return null;
  return new Promise(res => {
    const img = new Image();
    img.onload = () => { const c = document.createElement('canvas'); c.width = img.naturalWidth || 300; c.height = img.naturalHeight || 300; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res({ url: c.toDataURL('image/png'), w: c.width, h: c.height }); };
    img.onerror = () => res(null);
    img.src = b.logo;
  });
}

const W = 80, M = 5, LH = 4.3;   // lebar kertas, margin, tinggi baris (mm)

function layout(pdf, rows, logo, draw) {
  let y = M + 2;
  if (logo) { const h = 14, w = Math.min(30, h * logo.w / logo.h); if (draw) pdf.addImage(logo.url, 'PNG', (W - w) / 2, y, w, h); y += h + 3; }
  for (const r of rows) {
    if (r.type === 'title') { if (draw) { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.text(r.l, W / 2, y + 1, { align: 'center' }); } y += LH + 1.5; continue; }
    if (r.type === 'sub') { if (draw) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(r.l, W / 2, y, { align: 'center' }); } y += LH; continue; }
    if (r.type === 'line') { if (draw) { pdf.setLineDashPattern([0.8, 0.8], 0); pdf.setDrawColor(150); pdf.line(M, y - 1.4, W - M, y - 1.4); pdf.setLineDashPattern([], 0); } y += 2.6; continue; }
    if (r.type === 'head') { if (draw) { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.5); pdf.text(r.l, M, y); } y += LH; continue; }
    if (r.type === 'center') { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(r.small ? 7 : 8.5); const ls = pdf.splitTextToSize(r.l, W - 2 * M); if (draw) pdf.text(ls, W / 2, y, { align: 'center' }); y += ls.length * (r.small ? 3.4 : LH); continue; }
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
  // Watermark: logo besar transparan di tengah (atau nama toko miring bila belum ada logo)
  pdf.saveGraphicsState();
  pdf.setGState(new pdf.GState({ opacity: 0.08 }));
  if (logo) { const w = W - 16, h = Math.min(H * 0.6, w * logo.h / logo.w), ww = h * logo.w / logo.h; pdf.addImage(logo.url, 'PNG', (W - ww) / 2, (H - h) / 2, ww, h); }
  else { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(26); pdf.setTextColor(14, 43, 99); pdf.text(APP_NAME.toUpperCase(), W / 2, H / 2, { align: 'center', angle: 35 }); }
  pdf.restoreGraphicsState();
  pdf.setTextColor(20, 30, 50);
  layout(pdf, rows, logo, true);
  return pdf.output('blob');
}

export function saveBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
