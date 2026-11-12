// Laporan penjualan dalam PDF (A4 tegak) — 5.19.2: desain modern.
// Kepala bergradasi + logo, kartu ringkasan berwarna, tabel per cabang / uang masuk / part terlaris / mekanik / kasir,
// daftar transaksi, kepala ringkas di halaman lanjutan, dan nomor halaman.
import { preloadPdf, logoPng } from './nota-pdf.js';
import { APP_NAME } from './config.js';
import { penulis, kepala, kepalaRingkas, kakiSemua, judulBagian, kartu, tabel } from './pdf-kit.js';

const W = 210, H = 297, M = 14, n = x => Math.round(x || 0).toLocaleString('id-ID'), rp = x => 'Rp ' + n(x);

export async function laporanPdfBlob(d) {
  const lib = await preloadPdf(), logo = await logoPng(true);
  const pdf = new lib.jsPDF({ unit: 'mm', format: 'a4' }), t = penulis(pdf);
  pdf.setProperties({ title: d.judul, author: APP_NAME });
  let y = kepala(pdf, { W, M, h: 32, judul: 'Laporan penjualan', kanan: [d.periode, d.cabang], logo });
  const halBaru = () => { pdf.addPage(); return kepalaRingkas(pdf, { W, M, judul: 'Laporan penjualan · ' + d.periode }); };
  const cukup = h => { if (y + h > H - M - 10) y = halBaru(); };
  if (d.filter) { t('Filter: ' + d.filter, M, y, { size: 8, gray: 90 }); y += 6; }

  // Kartu ringkasan 4 per baris
  const kw = (W - 2 * M - 3 * 4) / 4, kh = 17;
  d.ringkasan.forEach(([lbl, val, sub], i) => kartu(pdf, M + (i % 4) * (kw + 4), y + Math.floor(i / 4) * (kh + 4), kw, kh, { lbl, val, sub, i }));
  y += Math.ceil(d.ringkasan.length / 4) * (kh + 4) + 5;

  const lebar = W - 2 * M;
  const bagian = (judul, kolom, baris) => { if (!baris.length) return; cukup(24); y = judulBagian(pdf, judul, M, y); y = tabel(pdf, { x: M, y, kolom, baris, H, M, halBaru }) + 7; };
  bagian('Omzet per cabang', [['Cabang', lebar - 70], ['Nota', 25, 'r'], ['Total', 45, 'r']], d.perCabang.map(([nm, v]) => [nm, n(v.n), rp(v.total)]));
  bagian('Uang masuk', [['Keterangan', lebar - 45], ['Jumlah', 45, 'r']], d.uangMasuk);
  bagian('Part terlaris', [['Part', lebar - 70], ['Qty', 25, 'r'], ['Nilai', 45, 'r']], d.top.map(([, v]) => [v.nama, n(v.qty), rp(v.nilai)]));
  bagian('Per mekanik', [['Mekanik', lebar - 70], ['Motor', 25, 'r'], ['Total', 45, 'r']], d.mekanik.map(([m, v]) => [m, n(v.n), rp(v.total)]));
  bagian('Per kasir', [['Kasir', lebar - 70], ['Nota', 25, 'r'], ['Total', 45, 'r']], d.kasir.map(([m, v]) => [m, n(v.n), rp(v.total)]));
  const trx = d.list.map(x => [x.no, x.tgl.slice(5, 16).replace('-', '/'), x.jenis === 'SERVIS' ? 'Servis ' + (x.jenisServis || '') : 'Part', [x.pelanggan || 'Umum', x.nopol].filter(Boolean).join(' / '), x.kasir || '', rp(x.total)]);
  trx.total = ['', '', '', d.list.length + ' nota', '', rp(d.list.reduce((a, x) => a + x.total, 0))];
  bagian('Daftar transaksi', [['No. nota', 36], ['Waktu', 22], ['Jenis', 24], ['Pelanggan / nopol', 50], ['Kasir', 22], ['Total', 28, 'r']], trx);

  kakiSemua(pdf, { W, H, M, halaman: true });
  return pdf.output('blob');
}
