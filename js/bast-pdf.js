// BAST transfer stok antar cabang dalam PDF (A4) — 5.19.2: desain modern bergradasi.
import { preloadPdf, logoPng } from './nota-pdf.js';
import { palet, penulis, kepala, kakiSemua, judulBagian, tabel, tandaTangan, lencana, kepalaRingkas } from './pdf-kit.js';

const rp = x => Math.round(x || 0).toLocaleString('id-ID');
export async function unduhBastPdf(tr) {
  const lib = await preloadPdf(), logo = await logoPng(true), P = palet();
  const pdf = new lib.jsPDF({ unit: 'mm', format: 'a4' }), t = penulis(pdf);
  const W = 210, H = 297, M = 16, b = tr.items || [{ kode: tr.kode, nama: tr.nama, qty: tr.qty }];
  const total = b.reduce((a, x) => a + (+x.qty || 0), 0), diterima = tr.status === 'diterima' || !tr.status;
  pdf.setProperties({ title: 'BAST ' + (tr.no || 'transfer') });
  let y = kepala(pdf, { W, M, h: 32, judul: 'BAST transfer stok', kanan: [tr.no || tr.id || '–', 'Berita acara serah terima barang'], logo });

  // Kartu info: tanggal & status, rute cabang
  const kw = (W - 2 * M - 5) / 2;
  pdf.setFillColor(...P.soft); pdf.roundedRect(M, y, kw, 20, 2.5, 2.5, 'F'); pdf.roundedRect(M + kw + 5, y, kw, 20, 2.5, 2.5, 'F');
  t('TANGGAL TRANSFER', M + 4, y + 6, { size: 6.4, bold: true, gray: 110 }); t(tr.tgl || '–', M + 4, y + 12, { size: 10, bold: true, color: P.ink });
  lencana(pdf, diterima ? 'DITERIMA' : 'DIKIRIM', M + 4, y + 17.2, diterima ? [23, 138, 80] : [190, 110, 10]);
  t('RUTE CABANG', M + kw + 9, y + 6, { size: 6.4, bold: true, gray: 110 });
  t(`${tr.dari || '–'}  »  ${tr.ke || '–'}`, M + kw + 9, y + 12, { size: 10, bold: true, color: P.ink, maxW: kw - 10 });
  t(`${b.length} jenis part · ${rp(total)} pcs`, M + kw + 9, y + 17, { size: 7.5, gray: 100 });
  y += 28;

  y = judulBagian(pdf, 'Rincian barang', M, y);
  const rows = b.map((it, i) => [i + 1, it.kode || '', it.nama || '', rp(it.qty) + ' pcs']); rows.total = ['', '', 'Total', rp(total) + ' pcs'];
  y = tabel(pdf, { x: M, y, kolom: [['No', 12], ['Kode', 40], ['Nama part', W - 2 * M - 87], ['Jumlah', 35, 'r']], baris: rows, H, M, halBaru: () => { pdf.addPage(); return kepalaRingkas(pdf, { W, M, judul: 'BAST ' + (tr.no || '') }); } }) + 6;
  if (tr.catatan) { t('Catatan: ' + tr.catatan, M, y, { size: 8.5, maxW: W - 2 * M }); y += 8; }
  t(diterima ? 'Barang telah diterima dan diperiksa oleh cabang tujuan.' : 'Barang telah dikirim dan menunggu pemeriksaan cabang tujuan.', M, y, { size: 9 }); y += 16;
  if (y > H - 60) { pdf.addPage(); y = 24; }
  tandaTangan(pdf, { x: M, y, w: W - 2 * M, kiri: ['Yang menyerahkan,', tr.pengirim, 'Cabang ' + (tr.dari || '–')], kanan: ['Yang menerima,', tr.penerima, 'Cabang ' + (tr.ke || '–')] });
  kakiSemua(pdf, { W, H, M });
  pdf.save(`BAST-${tr.no || 'transfer'}.pdf`);
}
