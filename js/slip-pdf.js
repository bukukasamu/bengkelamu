// Slip gaji / THR / bonus karyawan dalam PDF (A5 tegak) — 5.19.2: desain modern bergradasi sesuai tema.
// Kepala pita gradasi + logo, kartu identitas, rincian pendapatan & potongan, kotak penghasilan bersih bergradasi,
// catatan, tanda tangan, dan kaki halaman.
import { preloadPdf, logoPng } from './nota-pdf.js';
import { APP_NAME } from './config.js';
import { palet, penulis, kepala, kakiSemua, judulBagian, gradasi, tandaTangan } from './pdf-kit.js';

const W = 148, H = 210, M = 11, rp = x => 'Rp ' + Math.round(x || 0).toLocaleString('id-ID');

export async function slipPdfBlob(d) {
  const lib = await preloadPdf(), logo = await logoPng(true), P = palet();
  const pdf = new lib.jsPDF({ unit: 'mm', format: 'a5' }), t = penulis(pdf);
  pdf.setProperties({ title: `${d.judul || 'Slip gaji'} ${d.nama} ${d.periode}`, author: APP_NAME });
  let y = kepala(pdf, { W, M, h: 28, judul: d.judul || 'Slip gaji', kanan: [d.periode], logo, cabang: d.cabang });

  // Kartu identitas karyawan
  const ident = d.ident || [['Nama', d.nama], ['Jabatan', d.peran], ['Nota pribadi', String(d.nota)]];
  const ih = 6 + Math.ceil(ident.length / 2) * 8.6;
  pdf.setFillColor(...P.soft); pdf.roundedRect(M, y, W - 2 * M, ih, 2.5, 2.5, 'F');
  const kw = (W - 2 * M) / 2;
  ident.forEach(([l, v], i) => { const cx = M + 4 + (i % 2) * kw, cy = y + 6.5 + Math.floor(i / 2) * 8.6; t(String(l).toUpperCase(), cx, cy, { size: 6, bold: true, gray: 115 }); t(v ?? '–', cx, cy + 4, { size: 8.6, bold: true, color: P.ink, maxW: kw - 6 }); });
  y += ih + 7;

  const baris = (l, v, k, o = {}) => {
    pdf.setFont('helvetica', o.bold ? 'bold' : 'normal'); pdf.setFontSize(8.3);
    const ls = pdf.splitTextToSize(String(l), W - 2 * M - 36);
    pdf.setTextColor(...(o.bold ? P.ink : [45, 50, 60])); pdf.text(ls, M + 2, y);
    if (o.warna) pdf.setTextColor(...o.warna); pdf.text(String(v), W - M - 2, y, { align: 'right' });
    y += ls.length * 3.7; if (k) { t(k, M + 2, y - 0.4, { size: 6.4, gray: 125, maxW: W - 2 * M - 36 }); y += 3.3; }
    if (!o.bold) { pdf.setDrawColor(238); pdf.setLineWidth(0.15); pdf.line(M + 2, y - 1.4, W - M - 2, y - 1.4); }
    y += 2;
  };
  const total = (l, v, warna) => { pdf.setFillColor(248, 249, 252); pdf.roundedRect(M, y - 4, W - 2 * M, 6.6, 1.6, 1.6, 'F'); baris(l, v, '', { bold: true, warna }); y += 2.5; };

  y = judulBagian(pdf, 'Pendapatan', M, y) + 0.5;
  d.pendapatan.forEach(([l, v, k]) => baris(l, rp(v), k));
  total('Total pendapatan', rp(d.totalPendapatan), [23, 138, 80]);

  y = judulBagian(pdf, 'Potongan', M, y) + 0.5;
  if (d.potongan.length) d.potongan.forEach(([l, v]) => baris(l, '-' + rp(v), '', { warna: [194, 53, 42] })); else baris('Tidak ada potongan', '-');
  total('Total potongan', '-' + rp(d.totalPotongan), [194, 53, 42]);

  // Kotak penghasilan bersih bergradasi
  y += 1;
  gradasi(pdf, M, y, W - 2 * M, 15, P.g, 3);
  t(d.labelBersih || 'PENGHASILAN BERSIH', M + 5, y + 6.3, { bold: true, size: 7.2, color: [225, 233, 255] });
  t('Diterima karyawan', M + 5, y + 10.6, { size: 6.5, color: [205, 218, 255] });
  t(rp(d.bersih), W - M - 5, y + 9.6, { bold: true, size: 14, color: [255, 255, 255], align: 'right' });
  y += 21;
  t(d.catatan || 'Dihitung otomatis dari penjualan pribadi. Jumlah final ditetapkan manajemen.', M, y, { size: 6.8, gray: 110, maxW: W - 2 * M }); y += 7;

  if (y + 31 > H - 13) { pdf.addPage(); y = 20; }
  tandaTangan(pdf, { x: M, y, w: W - 2 * M, kiri: ['Diterima oleh,', d.nama], kanan: ['Disetujui,', 'Manajemen'] });
  kakiSemua(pdf, { W, H, M });
  return pdf.output('blob');
}
