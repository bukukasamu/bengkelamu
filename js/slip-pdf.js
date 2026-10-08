// Slip gaji karyawan dalam PDF (A5 tegak), hitam-putih dengan logo toko.
import { preloadPdf, logoPng, muat } from './nota-pdf.js';
import { APP_NAME, APP_SUB, COPYRIGHT } from './config.js';

const W = 148, H = 210, M = 12, rp = x => 'Rp ' + Math.round(x || 0).toLocaleString('id-ID');

export async function slipPdfBlob(d) {
  const lib = await preloadPdf(), logo = await logoPng();
  const pdf = new lib.jsPDF({ unit: 'mm', format: 'a5' });
  pdf.setProperties({ title: `Slip gaji ${d.nama} ${d.periode}`, author: APP_NAME });
  const t = (s, x, y, o = {}) => { pdf.setFont('helvetica', o.bold ? 'bold' : 'normal'); pdf.setFontSize(o.size || 9); pdf.setTextColor(o.gray ?? 25); pdf.text(String(s), x, y, o.align ? { align: o.align } : undefined); };
  let y = M, x0 = M;
  if (logo) { const { w, h } = muat(logo, 20, 13); pdf.addImage(logo.url, 'PNG', M, y, w, h); x0 = M + w + 4; }
  t(APP_NAME.toUpperCase(), x0, y + 5, { bold: true, size: 11 });
  t(d.cabang ? 'Cabang ' + d.cabang : APP_SUB, x0, y + 9.5, { size: 7.5, gray: 90 });
  t('SLIP GAJI', W - M, y + 5, { bold: true, size: 11, align: 'right' });
  t(d.periode, W - M, y + 9.5, { size: 8.5, align: 'right' });
  y += 16; pdf.setDrawColor(60); pdf.setLineWidth(0.4); pdf.line(M, y, W - M, y); y += 6;
  [['Nama', d.nama], ['Jabatan', d.peran], ['Nota pribadi', String(d.nota)]].forEach(([l, v]) => { t(l, M, y, { size: 8.5, gray: 90 }); t(': ' + v, M + 26, y, { size: 8.5, bold: true }); y += 4.6; });
  y += 2;
  const judul = s => { pdf.setFillColor(235); pdf.rect(M, y - 3.6, W - 2 * M, 5.4, 'F'); t(s, M + 2, y, { bold: true, size: 8 }); y += 6; };
  const baris = (l, v, k, bold) => {
    pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(8.5);
    const ls = pdf.splitTextToSize(l, W - 2 * M - 34); pdf.setTextColor(25); pdf.text(ls, M + 2, y); pdf.text(v, W - M - 2, y, { align: 'right' });
    y += ls.length * 3.8; if (k) { t(k, M + 2, y - 0.6, { size: 6.8, gray: 110 }); y += 3.4; } y += 1.2;
  };
  judul('PENDAPATAN');
  d.pendapatan.forEach(([l, v, k]) => baris(l, rp(v), k));
  pdf.setDrawColor(160); pdf.line(M, y - 2.4, W - M, y - 2.4); baris('Total pendapatan', rp(d.totalPendapatan), '', true); y += 2;
  judul('POTONGAN');
  if (d.potongan.length) d.potongan.forEach(([l, v]) => baris(l, '-' + rp(v))); else baris('Tidak ada', '-');
  pdf.line(M, y - 2.4, W - M, y - 2.4); baris('Total potongan', '-' + rp(d.totalPotongan), '', true); y += 2;
  pdf.setDrawColor(40); pdf.setLineWidth(0.5); pdf.rect(M, y - 4, W - 2 * M, 8);
  t('PENGHASILAN BERSIH', M + 3, y + 1.2, { bold: true, size: 9.5 }); t(rp(d.bersih), W - M - 3, y + 1.2, { bold: true, size: 11, align: 'right' }); y += 10;
  t('Dihitung otomatis dari penjualan pribadi. Jumlah final ditetapkan pemilik.', M, y, { size: 7, gray: 100 }); y += 12;
  const kol = (W - 2 * M) / 2;
  t('Diterima oleh,', M + kol / 2, y, { size: 8, align: 'center' }); t('Disetujui,', M + kol * 1.5, y, { size: 8, align: 'center' }); y += 18;
  pdf.setDrawColor(120); pdf.setLineWidth(0.3); pdf.line(M + 8, y, M + kol - 8, y); pdf.line(M + kol + 8, y, W - M - 8, y); y += 4;
  t(d.nama, M + kol / 2, y, { size: 8, align: 'center' }); t('Pemilik', M + kol * 1.5, y, { size: 8, align: 'center' });
  t('Dicetak ' + new Date().toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + ' - ' + COPYRIGHT, M, H - 7, { size: 6.5, gray: 130 });
  return pdf.output('blob');
}
