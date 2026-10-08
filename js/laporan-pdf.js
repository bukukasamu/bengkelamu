// Laporan penjualan dalam PDF (A4 tegak): ringkasan, per cabang, part terlaris, per mekanik & kasir, daftar transaksi.
// Hitam-putih supaya hemat tinta; logo toko abu-abu di kepala laporan.
import { preloadPdf, logoPng, muat } from './nota-pdf.js';
import { APP_NAME, APP_SUB } from './config.js';

const W = 210, H = 297, M = 14, n = x => Math.round(x || 0).toLocaleString('id-ID'), rp = x => 'Rp ' + n(x);

export async function laporanPdfBlob(d) {
  const lib = await preloadPdf(), logo = await logoPng();
  const pdf = new lib.jsPDF({ unit: 'mm', format: 'a4' });
  pdf.setProperties({ title: d.judul, author: APP_NAME });
  let y = M;
  const baruHal = () => { pdf.addPage(); y = M; };
  const cukup = h => { if (y + h > H - M - 6) baruHal(); };
  const teks = (s, x, yy, o = {}) => { pdf.setFont('helvetica', o.bold ? 'bold' : 'normal'); pdf.setFontSize(o.size || 9); pdf.setTextColor(o.gray ?? 25); pdf.text(String(s), x, yy, o.align ? { align: o.align } : undefined); };

  // Kepala laporan
  let x0 = M;
  if (logo) { const { w, h } = muat(logo, 26, 16); pdf.addImage(logo.url, 'PNG', M, y, w, h); x0 = M + w + 5; }
  teks(APP_NAME.toUpperCase(), x0, y + 5, { bold: true, size: 13 });
  teks(APP_SUB, x0, y + 10, { size: 8.5, gray: 90 });
  teks('LAPORAN PENJUALAN', W - M, y + 5, { bold: true, size: 12, align: 'right' });
  teks(d.periode, W - M, y + 10, { size: 9, align: 'right' });
  teks(d.cabang, W - M, y + 14.5, { size: 8.5, gray: 90, align: 'right' });
  y += 19; pdf.setDrawColor(60); pdf.setLineWidth(0.4); pdf.line(M, y, W - M, y); y += 6;
  if (d.filter) { teks('Filter: ' + d.filter, M, y, { size: 8.5, gray: 70 }); y += 5; }

  // Kotak ringkasan 4 x 2
  const kotak = d.ringkasan, kw = (W - 2 * M - 3 * 3) / 4, kh = 15;
  kotak.forEach(([lbl, val, sub], i) => {
    const cx = M + (i % 4) * (kw + 3), cy = y + Math.floor(i / 4) * (kh + 3);
    pdf.setDrawColor(190); pdf.setLineWidth(0.25); pdf.roundedRect(cx, cy, kw, kh, 1.5, 1.5);
    teks(lbl.toUpperCase(), cx + 3, cy + 4.5, { size: 6.5, gray: 100, bold: true });
    teks(val, cx + 3, cy + 9.8, { size: 10.5, bold: true });
    if (sub) teks(sub, cx + 3, cy + 13.2, { size: 6.5, gray: 110 });
  });
  y += Math.ceil(kotak.length / 4) * (kh + 3) + 4;

  // Tabel umum: kolom = [judul, lebar(mm), 'r' untuk rata kanan]
  function tabel(judul, kolom, baris) {
    if (!baris.length) return;
    cukup(18);
    teks(judul.toUpperCase(), M, y, { bold: true, size: 9.5 }); y += 3;
    const kepala = () => {
      pdf.setFillColor(235); pdf.rect(M, y, W - 2 * M, 6, 'F');
      let x = M; kolom.forEach(([j, w, a]) => { teks(j, a === 'r' ? x + w - 2 : x + 2, y + 4.2, { bold: true, size: 7.5, align: a === 'r' ? 'right' : undefined }); x += w; });
      y += 6;
    };
    kepala();
    baris.forEach((r, i) => {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8);
      const sel = r.map((v, k) => pdf.splitTextToSize(String(v ?? ''), kolom[k][1] - 4).slice(0, 2));
      const h = Math.max(...sel.map(s => s.length)) * 3.6 + 2.2;
      if (y + h > H - M - 6) { baruHal(); kepala(); }
      if (i % 2) { pdf.setFillColor(248); pdf.rect(M, y, W - 2 * M, h, 'F'); }
      let x = M; sel.forEach((s, k) => { const [, w, a] = kolom[k]; pdf.setTextColor(25); pdf.text(s, a === 'r' ? x + w - 2 : x + 2, y + 3.9, a === 'r' ? { align: 'right' } : undefined); x += w; });
      y += h;
    });
    if (baris.total) { pdf.setDrawColor(120); pdf.line(M, y, W - 2 * M + M, y); let x = M; baris.total.forEach((v, k) => { const [, w, a] = kolom[k]; teks(v, a === 'r' ? x + w - 2 : x + 2, y + 4.2, { bold: true, size: 8, align: a === 'r' ? 'right' : undefined }); x += w; }); y += 6; }
    y += 5;
  }
  const lebar = W - 2 * M;   // 182 mm
  tabel('Omzet per cabang', [['Cabang', lebar - 70], ['Nota', 25, 'r'], ['Total', 45, 'r']], d.perCabang.map(([nm, v]) => [nm, n(v.n), rp(v.total)]));
  tabel('Uang masuk', [['Keterangan', lebar - 45], ['Jumlah', 45, 'r']], d.uangMasuk);
  tabel('Part terlaris', [['Part', lebar - 70], ['Qty', 25, 'r'], ['Nilai', 45, 'r']], d.top.map(([, v]) => [v.nama, n(v.qty), rp(v.nilai)]));
  tabel('Per mekanik', [['Mekanik', lebar - 70], ['Motor', 25, 'r'], ['Total', 45, 'r']], d.mekanik.map(([m, v]) => [m, n(v.n), rp(v.total)]));
  tabel('Per kasir', [['Kasir', lebar - 70], ['Nota', 25, 'r'], ['Total', 45, 'r']], d.kasir.map(([m, v]) => [m, n(v.n), rp(v.total)]));
  const trx = d.list.map(t => [t.no, t.tgl.slice(5, 16).replace('-', '/'), t.jenis === 'SERVIS' ? 'Servis ' + (t.jenisServis || '') : 'Part', [t.pelanggan || 'Umum', t.nopol].filter(Boolean).join(' / '), t.kasir || '', rp(t.total)]);
  trx.total = ['', '', '', d.list.length + ' nota', '', rp(d.list.reduce((a, t) => a + t.total, 0))];
  tabel('Daftar transaksi', [['No. nota', 36], ['Waktu', 22], ['Jenis', 24], ['Pelanggan / nopol', 50], ['Kasir', 22], ['Total', 28, 'r']], trx);

  // Nomor halaman
  const total = pdf.getNumberOfPages(), dicetak = 'Dicetak ' + new Date().toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  for (let i = 1; i <= total; i++) { pdf.setPage(i); teks(dicetak + ' - Copyright SRISP 2026', M, H - 8, { size: 7, gray: 120 }); teks(`Halaman ${i} / ${total}`, W - M, H - 8, { size: 7, gray: 120, align: 'right' }); }
  return pdf.output('blob');
}
