// 5.20.0 — Laporan absensi pribadi dalam PDF (A4 tegak), desain modern bergradasi sesuai tema.
// d = { nama, peran, cabang, periode, jamKerja, rekap:[[lbl,val,sub]], baris:[[tanggal, masuk, pulang, durasi, keterangan]], catatan }
import { preloadPdf, logoPng } from './nota-pdf.js';
import { APP_NAME } from './config.js';
import { palet, penulis, kepala, kepalaRingkas, kakiSemua, judulBagian, kartu, tabel, tandaTangan } from './pdf-kit.js';

export async function absenPdfBlob(d) {
  const lib = await preloadPdf(), logo = await logoPng(true), P = palet();
  const W = 210, H = 297, M = 14, pdf = new lib.jsPDF({ unit: 'mm', format: 'a4' }), t = penulis(pdf);
  pdf.setProperties({ title: `Absensi ${d.nama} ${d.periode}`, author: APP_NAME });
  let y = kepala(pdf, { W, M, h: 30, judul: 'Laporan absensi', kanan: [d.periode], logo, cabang: d.cabang });
  // identitas
  const id = [['Nama', d.nama], ['Jabatan', d.peran], ['Jam kerja', d.jamKerja]], kw = (W - 2 * M) / 3;
  pdf.setFillColor(...P.soft); pdf.roundedRect(M, y, W - 2 * M, 15, 2.5, 2.5, 'F');
  id.forEach(([l, v], i) => { t(l.toUpperCase(), M + 4 + i * kw, y + 6, { size: 6.3, bold: true, gray: 110 }); t(v || '–', M + 4 + i * kw, y + 11, { size: 9.5, bold: true, color: P.ink, maxW: kw - 6 }); });
  y += 21;
  // rekap
  const n = d.rekap.length, cw = (W - 2 * M - (n - 1) * 3) / n;
  d.rekap.forEach(([lbl, val, sub], i) => kartu(pdf, M + i * (cw + 3), y, cw, 17, { lbl, val, sub, i }));
  y += 22;
  y = judulBagian(pdf, 'Rincian harian', M, y);
  const lebar = W - 2 * M;
  y = tabel(pdf, { x: M, y, kolom: [['Tanggal', 42], ['Masuk', 22], ['Pulang', 22], ['Durasi', 24], ['Keterangan', lebar - 110]], baris: d.baris.length ? d.baris : [['Belum ada absensi pada periode ini', '', '', '', '']], H, M, ukuran: 7.2, pad: 1.7, halBaru: () => { pdf.addPage(); return kepalaRingkas(pdf, { W, M, judul: 'Absensi ' + d.nama + ' · ' + d.periode }); } }) + 6;
  if (d.catatan) { t(d.catatan, M, y, { size: 7.2, gray: 100, maxW: lebar }); y += 7; }
  if (y + 27 > H - 13) { pdf.addPage(); y = 24; }
  tandaTangan(pdf, { x: M, y, w: lebar, kiri: ['Karyawan,', d.nama], kanan: ['Mengetahui,', 'Manajemen'] });
  kakiSemua(pdf, { W, H, M, halaman: true });
  return pdf.output('blob');
}
