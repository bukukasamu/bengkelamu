// Daftar konsumen & kendaraan dalam PDF (A4 mendatar), mengikuti filter yang sedang aktif di Master Data.
// 5.19.2: kepala bergradasi, judul kolom berwarna aksen, baris belang tipis, kaki halaman seragam.
import { preloadPdf, logoPng } from './nota-pdf.js';
import { APP_NAME } from './config.js';
import { palet, kepala as kepalaPita, kepalaRingkas, kakiSemua } from './pdf-kit.js';

const W = 297, H = 210, M = 10;
const tglID = t => t ? new Date(String(t).slice(0, 10) + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '–';

export async function konsumenPdfBlob(list, opt = {}) {
  const lib = await preloadPdf(), logo = await logoPng(true), P = palet();
  const pdf = new lib.jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  pdf.setProperties({ title: opt.judul || 'Data konsumen & kendaraan', author: APP_NAME });
  const teks = (s, x, y, o = {}) => { pdf.setFont('helvetica', o.bold ? 'bold' : 'normal'); pdf.setFontSize(o.size || 8); if (o.size === 6.6) pdf.setTextColor(...P.ac); else pdf.setTextColor(o.gray ?? 25); pdf.text(String(s), x, y, o.align ? { align: o.align } : undefined); };
  // Kolom: [judul, lebar mm, isi(k) -> baris teks]
  const KOL = opt.kolom || [
    ['No', 9, (k, i) => [String(i + 1)]],
    ['No. polisi', 24, k => [k.nopol || '']],
    ['Konsumen', 46, k => [k.nama || '–', k.hp ? 'HP ' + k.hp : '', k.namaStnk && k.namaStnk !== k.nama ? 'STNK: ' + k.namaStnk : ''].filter(Boolean)],
    ['Kendaraan', 40, k => [[k.tipe, k.tahun].filter(Boolean).join(' / ') || '–', k.warna || ''].filter(Boolean)],
    ['Alamat', 82, k => [[k.alamat, k.rtrw ? 'RT/RW ' + k.rtrw : ''].filter(Boolean).join(', '), [k.kelurahan, k.kecamatan].filter(Boolean).join(', '), [k.kabupaten, k.provinsi].filter(Boolean).join(', ')].filter(Boolean)],
    ['No. rangka / mesin', 50, k => [k.noRangka ? 'R: ' + k.noRangka : '', k.noMesin ? 'M: ' + k.noMesin : ''].filter(Boolean)],
    ['Servis terakhir', 26, k => [tglID(k.servisTerakhir), k.kmTerakhir || k.km ? Number(k.kmTerakhir || k.km).toLocaleString('id-ID') + ' km' : ''].filter(Boolean)]
  ];
  let y = M;
  const judul = opt.judul || 'Data konsumen & kendaraan';
  const kepala = (pertama) => {
    y = pertama ? kepalaPita(pdf, { W, M, h: 26, judul, kanan: [`${list.length.toLocaleString('id-ID')} ${opt.satuan || 'kendaraan'}${opt.filter ? ' · ' + opt.filter : ''}`], logo }) - 2 : kepalaRingkas(pdf, { W, M, judul });
    // judul kolom
    const lebar = KOL.reduce((a, k) => a + k[1], 0);
    pdf.setFillColor(...P.soft); pdf.roundedRect(M, y, lebar, 7, 1.5, 1.5, 'F');
    let x = M; KOL.forEach(([j, w]) => { teks(j.toUpperCase(), x + 1.8, y + 4.7, { bold: true, size: 6.6 }); x += w; });
    pdf.setTextColor(25); y += 7.6;
  };
  kepala(true);
  list.forEach((k, i) => {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5);
    const sel = KOL.map(([, w, f]) => f(k, i).flatMap(t => pdf.splitTextToSize(String(t), w - 3)));
    const tinggi = Math.max(6, ...sel.map(l => l.length * 3.4 + 2.4));
    if (y + tinggi > H - M - 8) { pdf.addPage(); kepala(false); }
    let x = M;
    sel.forEach((baris, c) => {
      const w = KOL[c][1]; if (c === 0) { if (i % 2) { pdf.setFillColor(249, 250, 252); pdf.rect(M, y, KOL.reduce((a, k) => a + k[1], 0), tinggi, 'F'); } pdf.setDrawColor(232); pdf.setLineWidth(0.15); pdf.line(M, y + tinggi, M + KOL.reduce((a, k) => a + k[1], 0), y + tinggi); }
      baris.forEach((t, b) => teks(t, x + 1.5, y + 3.8 + b * 3.4, { size: 7.5, bold: c === (opt.kolomTebal ?? 1) && b === 0, gray: b > 0 && c !== (opt.kolomAlamat ?? 4) ? 80 : 25 }));
      x += w;
    });
    y += tinggi;
  });
  kakiSemua(pdf, { W, H, M, oleh: opt.oleh, catatan: 'Rahasia: berisi data pribadi konsumen', halaman: true });
  return pdf.output('blob');
}
