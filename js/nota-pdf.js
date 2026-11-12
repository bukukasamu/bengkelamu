// Nota dalam bentuk PDF dengan pilihan struk 80 mm atau A4 portrait/landscape.
// Pustaka jsPDF dimuat dari CDN saat pertama kali dibutuhkan.
import { notaRows } from './nota.js';
import { getBrand, loadBrand } from './brand.js';
import { APP_NAME } from './config.js';
import { palet, gradasi } from './pdf-kit.js';

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

export async function logoPng(warna = false) {
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
          if (!warna) d[i] = d[i + 1] = d[i + 2] = v;
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
    img.onerror = () => res(null); img.src = b.logo;
  });
}
export function muat(logo, maxW, maxH) { const k = Math.min(maxW / logo.w, maxH / logo.h); return { w: logo.w * k, h: logo.h * k }; }

const PRESET = {
  struk: { w: 80, margin: 5, line: 4.3, title: 12, body: 8.5, small: 7 },
  portrait: { w: 210, margin: 14, line: 6.4, title: 18, body: 12, small: 9 },
  landscape: { w: 297, margin: 16, line: 6.8, title: 19, body: 12.5, small: 9.5 }
};
const textScale = ukuran => ukuran === 'besar' ? 1.25 : ukuran === 'sangat-besar' ? 1.5 : 1;

function layout(pdf, rows, logo, draw, preset, ukuran) {
  const P = palet(), sc = textScale(ukuran), M = preset.margin, W = preset.w;
  const LH = preset.line * sc, body = preset.body * sc, small = preset.small * sc;
  let y = M + 5;
  if (logo) { const { w, h } = muat(logo, Math.min(58, W - 2 * M), 22 * sc); if (draw) pdf.addImage(logo.url, 'PNG', (W - w) / 2, y, w, h); y += h + 6; }
  for (const r of rows) {
    if (r.type === 'title') { if (draw) { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(preset.title * sc); pdf.setTextColor(...P.ink); pdf.text(r.l, W / 2, y + 1, { align: 'center' }); pdf.setTextColor(25); } y += LH + 2; continue; }
    if (r.type === 'sub') { if (draw) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8 * sc); pdf.text(r.l, W / 2, y, { align: 'center' }); } y += LH; continue; }
    if (r.type === 'line') { if (draw) { pdf.setLineDashPattern([0.8, 0.8], 0); pdf.setDrawColor(150); pdf.line(M, y - 1.4, W - M, y - 1.4); pdf.setLineDashPattern([], 0); } y += 3.2; continue; }
    if (r.type === 'head') { if (draw) { pdf.setFont('helvetica', 'bold'); pdf.setFontSize((preset.body - 1) * sc); pdf.setTextColor(...P.ac); pdf.text(r.l, M, y); pdf.setTextColor(25); } y += LH; continue; }
    if (r.type === 'center') { pdf.setFont('helvetica', 'normal'); pdf.setFontSize((r.small ? small : 8.5 * sc)); const ls = pdf.splitTextToSize(r.l, W - 2 * M); if (draw) pdf.text(ls, W / 2, y, { align: 'center' }); y += ls.length * (r.small ? 4.5 * sc : LH); continue; }
    if (r.type === 'item') {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(body); const ls = pdf.splitTextToSize(r.l, W - 2 * M);
      if (draw) pdf.text(ls, M, y); y += ls.length * LH;
      if (draw) { pdf.setFontSize((preset.body - 0.5) * sc); pdf.text('   ' + r.sub, M, y); pdf.text(r.r, W - M, y, { align: 'right' }); } y += LH; continue;
    }
    pdf.setFont('helvetica', r.bold ? 'bold' : 'normal'); pdf.setFontSize((r.bold ? 10.5 : preset.body) * sc);
    const rw = pdf.getTextWidth(String(r.r)) + 5, ls = pdf.splitTextToSize(String(r.l), W - 2 * M - rw);
    if (draw && r.bold) { pdf.setFillColor(...P.soft); pdf.roundedRect(M - 2, y - 5.2, W - 2 * M + 4, ls.length * LH + 3, 1.6, 1.6, 'F'); pdf.setTextColor(...P.ink); }
    if (draw) { pdf.text(ls, M, y); pdf.text(String(r.r), W - M, y, { align: 'right' }); pdf.setTextColor(25); }
    y += ls.length * LH + (r.bold ? 2 : 0);
  }
  return y + M;
}

export async function notaPdfBlob(t, options = {}) {
  const lib = await preloadPdf(), logo = await logoPng(), rows = notaRows(t);
  const mode = options.orientasi === 'landscape' ? 'landscape' : options.orientasi === 'portrait' ? 'portrait' : 'struk';
  const preset = PRESET[mode], ukuran = options.ukuran || 'normal';
  const probe = new lib.jsPDF({ unit: 'mm', format: mode === 'struk' ? [preset.w, 200] : 'a4', orientation: mode === 'landscape' ? 'landscape' : 'portrait' });
  const estimated = layout(probe, rows, logo, false, preset, ukuran);
  const format = mode === 'struk' ? [preset.w, Math.max(110, estimated)] : 'a4';
  const pdf = new lib.jsPDF({ unit: 'mm', format, orientation: mode === 'landscape' ? 'landscape' : 'portrait' });
  const W = preset.w, H = mode === 'struk' ? Math.max(110, estimated) : pdf.internal.pageSize.getHeight();
  pdf.setProperties({ title: `Nota ${t.no}`, author: APP_NAME });
  pdf.saveGraphicsState(); pdf.setGState(new pdf.GState({ opacity: 0.08 }));
  if (logo) { const { w, h } = muat(logo, W - (mode === 'struk' ? 16 : 40), H * 0.45); pdf.addImage(logo.url, 'PNG', (W - w) / 2, (H - h) / 2, w, h); }
  else { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(mode === 'struk' ? 26 : 42); pdf.setTextColor(60); pdf.text(APP_NAME.toUpperCase(), W / 2, H / 2, { align: 'center', angle: 35 }); }
  pdf.restoreGraphicsState(); pdf.setTextColor(25);
  if (mode === 'struk') { gradasi(pdf, 0, 0, W, 2.6, palet().g, 0, 40); gradasi(pdf, 0, H - 1.6, W, 1.6, palet().g, 0, 40); }
  layout(pdf, rows, logo, true, preset, ukuran);
  return pdf.output('blob');
}

export function saveBlob(blob, name) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
