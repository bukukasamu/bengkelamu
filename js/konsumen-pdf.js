// Daftar konsumen & kendaraan dalam PDF (A4 mendatar), mengikuti filter yang sedang aktif di Master Data.
import { preloadPdf, logoPng, muat } from './nota-pdf.js';
import { APP_NAME, APP_SUB, COPYRIGHT } from './config.js';

const W = 297, H = 210, M = 10;
const tglID = t => t ? new Date(String(t).slice(0, 10) + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '–';

export async function konsumenPdfBlob(list, opt = {}) {
  const lib = await preloadPdf(), logo = await logoPng();
  const pdf = new lib.jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  pdf.setProperties({ title: 'Data konsumen & kendaraan', author: APP_NAME });
  const teks = (s, x, y, o = {}) => { pdf.setFont('helvetica', o.bold ? 'bold' : 'normal'); pdf.setFontSize(o.size || 8); pdf.setTextColor(o.gray ?? 25); pdf.text(String(s), x, y, o.align ? { align: o.align } : undefined); };
  // Kolom: [judul, lebar mm, isi(k) -> baris teks]
  const KOL = [
    ['No', 9, (k, i) => [String(i + 1)]],
    ['No. polisi', 24, k => [k.nopol || '']],
    ['Konsumen', 46, k => [k.nama || '–', k.hp ? 'HP ' + k.hp : '', k.namaStnk && k.namaStnk !== k.nama ? 'STNK: ' + k.namaStnk : ''].filter(Boolean)],
    ['Kendaraan', 40, k => [[k.tipe, k.tahun].filter(Boolean).join(' / ') || '–', k.warna || ''].filter(Boolean)],
    ['Alamat', 82, k => [[k.alamat, k.rtrw ? 'RT/RW ' + k.rtrw : ''].filter(Boolean).join(', '), [k.kelurahan, k.kecamatan].filter(Boolean).join(', '), [k.kabupaten, k.provinsi].filter(Boolean).join(', ')].filter(Boolean)],
    ['No. rangka / mesin', 50, k => [k.noRangka ? 'R: ' + k.noRangka : '', k.noMesin ? 'M: ' + k.noMesin : ''].filter(Boolean)],
    ['Servis terakhir', 26, k => [tglID(k.servisTerakhir), k.kmTerakhir || k.km ? Number(k.kmTerakhir || k.km).toLocaleString('id-ID') + ' km' : ''].filter(Boolean)]
  ];
  let y = M, hal = 1;
  const kepala = (pertama) => {
    y = M;
    if (pertama) {
      let x0 = M;
      if (logo) { const { w, h } = muat(logo, 24, 14); pdf.addImage(logo.url, 'PNG', M, y, w, h); x0 = M + w + 4; }
      teks(APP_NAME.toUpperCase(), x0, y + 5, { bold: true, size: 12 });
      teks(APP_SUB, x0, y + 9.5, { size: 8, gray: 90 });
      teks('DATA KONSUMEN & KENDARAAN', W - M, y + 5, { bold: true, size: 11, align: 'right' });
      teks(`${list.length.toLocaleString('id-ID')} kendaraan${opt.filter ? ' | ' + opt.filter : ''}`, W - M, y + 9.5, { size: 8, gray: 70, align: 'right' });
      y += 15; pdf.setDrawColor(60); pdf.setLineWidth(0.4); pdf.line(M, y, W - M, y); y += 4;
    }
    // judul kolom
    pdf.setFillColor(221, 230, 244); pdf.setDrawColor(150); pdf.setLineWidth(0.2);
    let x = M; KOL.forEach(([j, w]) => { pdf.setFillColor(221, 230, 244); pdf.setDrawColor(150); pdf.rect(x, y, w, 7, 'FD'); teks(j, x + 1.5, y + 4.7, { bold: true, size: 7.5 }); x += w; });
    y += 7;
  };
  const kaki = () => {
    teks(`Dicetak ${new Date().toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}${opt.oleh ? ' oleh ' + opt.oleh : ''} | Rahasia: berisi data pribadi konsumen | ${COPYRIGHT}`, M, H - 5, { size: 6.5, gray: 120 });
    teks('Hal. ' + hal, W - M, H - 5, { size: 6.5, gray: 120, align: 'right' });
  };
  kepala(true);
  list.forEach((k, i) => {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5);
    const sel = KOL.map(([, w, f]) => f(k, i).flatMap(t => pdf.splitTextToSize(String(t), w - 3)));
    const tinggi = Math.max(6, ...sel.map(l => l.length * 3.4 + 2.4));
    if (y + tinggi > H - M - 6) { kaki(); pdf.addPage(); hal++; kepala(false); }
    let x = M;
    sel.forEach((baris, c) => {
      const w = KOL[c][1]; pdf.setDrawColor(170); pdf.setLineWidth(0.15); pdf.rect(x, y, w, tinggi);
      baris.forEach((t, b) => teks(t, x + 1.5, y + 3.8 + b * 3.4, { size: 7.5, bold: c === 1 && b === 0, gray: b > 0 && c !== 4 ? 80 : 25 }));
      x += w;
    });
    y += tinggi;
  });
  kaki();
  return pdf.output('blob');
}
