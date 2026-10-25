import { preloadPdf, logoPng, muat } from './nota-pdf.js';
import { APP_NAME, COPYRIGHT } from './config.js';
const rp = x => Math.round(x || 0).toLocaleString('id-ID');
const namaCabang = id => id || '–';
export async function unduhBastPdf(t) {
  const lib = await preloadPdf(), logo = await logoPng();
  const pdf = new lib.jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210, H = 297, M = 16, b = t.items || [{ kode: t.kode, nama: t.nama, qty: t.qty }];
  const total = b.reduce((a, x) => a + (+x.qty || 0), 0);
  const text = (v, x, y, o={}) => { pdf.setFont('helvetica', o.bold ? 'bold' : 'normal'); pdf.setFontSize(o.size || 9); pdf.setTextColor(o.gray ?? 30); pdf.text(String(v ?? ''), x, y, o.align ? {align:o.align} : undefined); };
  let y = M, x = M;
  if (logo) { const q = muat(logo, 18, 12); pdf.addImage(logo.url, 'PNG', M, y, q.w, q.h); x = M + q.w + 4; }
  text(APP_NAME.toUpperCase(), x, y + 5, {bold:true,size:12}); text('DOKUMEN TRANSFER STOK', x, y + 10, {size:8,gray:100});
  text('BAST TRANSFER STOK', W-M, y+5, {bold:true,size:12,align:'right'}); text(t.no || t.id || '–', W-M, y+10, {size:9,align:'right'}); y += 18; pdf.setDrawColor(50); pdf.line(M,y,W-M,y); y += 8;
  text(`Tanggal transfer: ${t.tgl || '–'}`, M, y, {size:9}); text(`Status: ${t.status === 'diterima' || !t.status ? 'DITERIMA' : 'DIKIRIM'}`, W-M, y, {size:9,bold:true,align:'right'}); y += 6;
  text(`Dari: ${namaCabang(t.dari)}`, M, y, {size:9}); text(`Ke: ${namaCabang(t.ke)}`, W-M, y, {size:9,align:'right'}); y += 9;
  const cols=[M,M+12,M+42,W-M-38,W-M]; pdf.setFillColor(235); pdf.rect(M,y-4,W-2*M,7,'F'); ['No','Kode','Nama Part','Jumlah',''].forEach((v,i)=>text(v,cols[i]+2,y,{bold:true,size:8})); y+=6;
  b.forEach((it,i)=>{ pdf.setDrawColor(160); pdf.line(M,y-4,W-M,y-4); text(i+1,cols[0]+2,y,{size:8}); text(it.kode||'',cols[1]+2,y,{size:8}); text(it.nama||'',cols[2]+2,y,{size:8}); text(rp(it.qty)+' pcs',cols[3]+2,y,{size:8,align:'right'}); y+=6; });
  pdf.setDrawColor(50); pdf.line(M,y-4,W-M,y-4); text('Total',cols[2]+2,y,{bold:true,size:8}); text(rp(total)+' pcs',cols[3]+2,y,{bold:true,size:8,align:'right'}); y+=10;
  if (t.catatan) { text('Catatan: '+t.catatan,M,y,{size:8}); y+=7; }
  const diterima = t.status === 'diterima' || !t.status; text(diterima ? 'Barang telah diterima dan diperiksa oleh cabang tujuan.' : 'Barang telah dikirim dan menunggu pemeriksaan cabang tujuan.',M,y,{size:9}); y+=22;
  const mid=W/2; text('Yang menyerahkan,',mid/2,y,{size:9,align:'center'}); text('Yang menerima,',mid+mid/2,y,{size:9,align:'center'}); y+=25; pdf.setDrawColor(100); pdf.line(M+12,y,mid-12,y); pdf.line(mid+12,y,W-M-12,y); y+=5; text(t.pengirim||'________________',mid/2,y,{size:8,align:'center'}); text(t.penerima||'________________',mid+mid/2,y,{size:8,align:'center'}); y+=4; text('Cabang '+namaCabang(t.dari),mid/2,y,{size:7,gray:100,align:'center'}); text('Cabang '+namaCabang(t.ke),mid+mid/2,y,{size:7,gray:100,align:'center'});
  text('Dicetak '+new Date().toLocaleString('id-ID')+' - '+COPYRIGHT,M,H-10,{size:7,gray:120});
  pdf.save(`BAST-${t.no || 'transfer'}.pdf`);
}
