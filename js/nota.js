// Nota penjualan / servis: isi nota (dipakai layar, printer, dan PDF), cetak, unduh PDF, kirim via WhatsApp.
import { $, esc, toast, modal, closeModal, waLink, waNumber, publicUrl, stamp, rp } from './util.js';
import { S, st, actions, inputHandlers } from './state.js';
import { APP_NAME, APP_SUB } from './config.js';
import { cabangById, cabangOf, multiCabang } from './cabang.js';
import { batalHTML, tombolBatal } from './kontrol.js';
import { db, collection, addDoc } from './firebase.js';

const n = x => Math.round(x || 0).toLocaleString('id-ID');

// Baris-baris nota. type: 'title' | 'sub' | 'lr' (kiri-kanan) | 'item' | 'line' | 'center' | 'head'
export function notaRows(t) {
  const cb = cabangById(cabangOf(t)), infoCabang = cb ? [multiCabang() ? 'Cabang ' + cb.nama : '', cb.alamat, cb.telp ? 'Telp/WA ' + cb.telp : ''].filter(Boolean).join(' | ') : '';
  const r = [{ type: 'title', l: APP_NAME.toUpperCase() }, { type: 'sub', l: APP_SUB }, ...(infoCabang ? [{ type: 'center', small: true, l: infoCabang }] : []), { type: 'line' },
    { type: 'lr', l: 'No', r: t.no }, { type: 'lr', l: 'Tanggal', r: t.tgl }, { type: 'lr', l: 'Pelanggan', r: (t.pelanggan || 'Umum').slice(0, 26) }];
  if (t.nopol) r.push({ type: 'lr', l: 'Nopol', r: t.nopol + (t.tipe ? ' · ' + t.tipe : '') });
  if (t.km) r.push({ type: 'lr', l: 'Kilometer', r: t.km });
  if (t.jenisServis && t.jenisServis !== 'Reguler') r.push({ type: 'lr', l: 'Servis', r: t.jenisServis + (t.ksgKe ? ' ke-' + t.ksgKe : '') + (t.noKartu ? ' #' + t.noKartu : '') });
  if (t.mekanik) r.push({ type: 'lr', l: 'Mekanik', r: t.mekanik });
  if (t.kasir) r.push({ type: 'lr', l: 'Kasir', r: String(t.kasir).slice(0, 26) });
  r.push({ type: 'line' });
  if (t.items.length) { r.push({ type: 'head', l: 'SPAREPART' }); t.items.forEach(x => r.push({ type: 'item', l: x.nama, sub: x.qty + ' x ' + n(x.harga), r: n(x.qty * x.harga) })); }
  if ((t.jasa || []).length) { r.push({ type: 'head', l: 'JASA' }); t.jasa.forEach(j => r.push({ type: 'lr', l: '  ' + j.nama, r: t.jenisServis === 'KSG' ? 'GRATIS' : n(j.harga) })); }
  if ((t.biaya || []).length) { r.push({ type: 'head', l: 'BIAYA LAIN' }); t.biaya.forEach(b => r.push({ type: 'lr', l: '  ' + b.ket, r: n(b.jumlah) })); }
  r.push({ type: 'line' }, { type: 'lr', l: 'Subtotal', r: n(t.total + (t.diskon || 0)) });
  if (t.diskon) r.push({ type: 'lr', l: 'Diskon', r: '-' + n(t.diskon) });
  r.push({ type: 'lr', l: 'TOTAL', r: n(t.total), bold: true });
  if (t.cash != null) {
    if (t.cash) r.push({ type: 'lr', l: 'Cash', r: n(t.cash) });
    if (t.transfer) { r.push({ type: 'lr', l: 'Transfer', r: n(t.transfer) }); if (t.rekening) r.push({ type: 'center', l: t.rekening, small: true }); if (t.refTransfer) r.push({ type: 'center', l: 'Ref: ' + t.refTransfer, small: true }); }
    r.push({ type: 'lr', l: 'Kembali', r: n(t.kembali) });
  } else r.push({ type: 'lr', l: 'Bayar', r: n(t.bayar) }, { type: 'lr', l: 'Kembali', r: n(t.bayar - t.total) });
  r.push({ type: 'line' });
  if (t.jenisServis === 'KSG') r.push({ type: 'center', l: 'Jasa servis KSG gratis' });
  r.push({ type: 'center', l: 'Terima kasih' }, { type: 'center', l: 'Barang yang sudah dibeli tidak dapat dikembalikan', small: true });
  return r;
}

// Pratinjau nota berbentuk struk (HTML) — dipakai di halaman cek servis sebelum PDF diunduh
export function notaHTML(t) {
  return `<div class="struk">${notaRows(t).map(x => {
    if (x.type === 'title') return `<div class="s-title">${esc(x.l)}</div>`;
    if (x.type === 'sub') return `<div class="s-sub">${esc(x.l)}</div>`;
    if (x.type === 'line') return '<hr>';
    if (x.type === 'head') return `<div class="s-head">${esc(x.l)}</div>`;
    if (x.type === 'center') return `<div class="s-center${x.small ? ' small' : ''}">${esc(x.l)}</div>`;
    if (x.type === 'item') return `<div class="s-item"><div>${esc(x.l)}</div><div class="s-lr"><span class="muted">${esc(x.sub)}</span><span>${esc(x.r)}</span></div></div>`;
    return `<div class="s-lr${x.bold ? ' s-total' : ''}"><span>${esc(String(x.l).trim())}</span><span>${esc(x.r)}</span></div>`;
  }).join('')}</div>`;
}

// Versi teks 38 kolom untuk layar & printer struk
export function notaText(t) {
  const W = 38, line = '-'.repeat(W);
  const lr = (l, r) => { l = String(l); r = String(r); const sp = W - l.length - r.length; return sp > 0 ? l + ' '.repeat(sp) + r : l.slice(0, W - r.length - 1) + ' ' + r; };
  const c = s => ' '.repeat(Math.max(0, Math.floor((W - s.length) / 2))) + s;
  return notaRows(t).flatMap(x => x.type === 'line' ? [line] : x.type === 'lr' ? [lr(x.l, x.r)] : x.type === 'item' ? [x.l.slice(0, W), lr('  ' + x.sub, x.r)] : x.type === 'head' ? [x.l + ':'] : [c(x.l.slice(0, W))]).join('\n');
}

// Link halaman cek servis konsumen (nopol sudah terisi)
export const cekLink = nopol => publicUrl('cek', { nopol: nopol ? String(nopol).replace(/\s+/g, '') : '' });
const waText = t => `Halo ${t.pelanggan && t.pelanggan !== 'Umum' ? t.pelanggan : 'Bapak/Ibu'}, terima kasih telah ${t.jenis === 'SERVIS' ? 'servis' : 'berbelanja'} di ${APP_NAME}. Berikut nota ${t.no}, total Rp ${n(t.total)}.` + (t.nopol ? `\nCek status & riwayat servis ${t.nopol}: ${cekLink(t.nopol)}` : '');

let current = null;
let notaPrintOptions = { orientasi: 'struk', ukuran: 'normal' };
const opsiNota = () => ({ orientasi: $('#nota-orientasi')?.value || notaPrintOptions.orientasi, ukuran: $('#nota-ukuran')?.value || notaPrintOptions.ukuran });
const labelOrientasi = o => o === 'landscape' ? 'Folio 11 × 9½ inci Landscape' : o === 'portrait' ? 'Folio 9½ × 11 inci Portrait' : 'Struk 75 mm';
function tombolRetur(t) {
  if (!t || t.jenis !== 'PART' || t.batal?.status === 'disetujui' || !(st.petugas?.super || st.role === 'kasir' || st.role === 'admin')) return '';
  return `<button class="btn ghost" type="button" data-act="retur-ajukan" data-no="${esc(t.no)}">Ajukan retur</button>`;
}
export function showNota(t) {
  if (!t) { toast('Belum ada nota untuk dicetak'); return; }
  current = t;
  import('./nota-pdf.js').then(m => m.preloadPdf()).catch(() => {});   // siapkan pembuat PDF lebih awal
  modal(`<div class="row spread"><h2>Nota ${esc(t.no)}</h2>${t.batal?.status === 'disetujui' ? '<span class="pill p-bad">Dibatalkan</span>' : '<span class="pill p-good">Tersimpan</span>'}</div>
   ${batalHTML(t)}${t.retur?.status === 'diajukan' ? `<div class="note small">Retur diajukan: ${esc(t.retur.alasan || '')}. Menunggu persetujuan.</div>` : ''}${t.retur?.status === 'disetujui' ? `<div class="note small batal-on"><b>RETUR DISETUJUI</b> · ${esc(t.retur.catatanSuper || t.retur.alasan || '')}</div>` : ''}
   <div class="nota" id="nota-text">${esc(notaText(t))}</div>
   <label class="f" for="nota-hp"><span class="f-wa">No. WhatsApp konsumen<span class="small muted" id="nota-hp-ok"></span></span><input id="nota-hp" inputmode="tel" value="${esc(t.hp || '')}" placeholder="mis. 0812 xxxx xxxx"></label>
   <div class="form" style="margin-top:12px"><label class="f" for="nota-orientasi">Format cetak<select id="nota-orientasi"><option value="struk">Struk 75 mm</option><option value="portrait">Folio 9½ × 11 inci Portrait</option><option value="landscape">Folio 11 × 9½ inci Landscape</option></select></label><label class="f" for="nota-ukuran">Ukuran tulisan<select id="nota-ukuran"><option value="normal">Normal</option><option value="besar">Besar</option><option value="sangat-besar">Sangat besar</option></select></label></div>
   <p class="small muted" style="margin:4px 0 0">Ukuran folio mengikuti kertas 9½ × 11 inci pada contoh. Struk mengikuti roll 75 mm dan panjangnya otomatis mengikuti isi nota.</p>
   <div class="row" style="justify-content:flex-end">${tombolBatal(t)}${tombolRetur(t)}<button class="btn" data-act="print" type="button">Cetak</button><button class="btn" data-act="nota-pdf" type="button">Unduh PDF</button><button class="btn wa-solid" data-act="nota-wa" type="button">Kirim PDF via WA</button><button class="btn pri" data-close="1" type="button">Tutup</button></div>`);
  $('#nota-orientasi').value = notaPrintOptions.orientasi;
  $('#nota-ukuran').value = notaPrintOptions.ukuran;
  checkHp();
}
async function ajukanRetur(el) {
  const t = S.trx.find(x => x.no === el.dataset.no) || st.lastNota;
  if (!t || t.jenis !== 'PART') return toast('Retur hanya tersedia untuk penjualan part');
  const returned = (t.retur?.status === 'disetujui' ? (t.retur.items || []) : []).reduce((m, x) => (m[x.kode] = (m[x.kode] || 0) + (+x.qty || 0), m), {}), rows = (t.items || []).map((x, i) => { const available = Math.max(0, (+x.qty || 0) - (returned[x.kode] || 0)); return `<tr><td><input type="checkbox" id="rt-c-${i}" data-rt-item="1" data-idx="${i}" data-kode="${esc(x.kode)}" data-nama="${esc(x.nama || x.kode)}" data-harga="${+x.harga || 0}" ${available ? '' : 'disabled'}></td><td>${esc(x.nama || x.kode)}<br><span class="small muted mono">${esc(x.kode)}</span></td><td>${x.qty}</td><td><input class="num" type="number" min="1" max="${available}" value="1" data-rt-qty="${i}" disabled></td><td class="r num">${rp(x.harga || 0)}${available < x.qty ? `<br><span class="small muted">tersisa ${available}</span>` : ''}</td></tr>`; }).join('');
  modal(`<h3>Ajukan retur sebagian — nota ${esc(t.no)}</h3><p class="small">Centang hanya part yang bermasalah dan isi jumlah yang diretur. Barang harus diterima dan diperiksa sebelum pengembalian dana disetujui.</p><div class="tw"><table><thead><tr><th></th><th>Part</th><th>Terjual</th><th>Retur</th><th>Harga/unit</th></tr></thead><tbody>${rows}</tbody></table></div><label class="f" for="rt-alasan">Alasan retur (wajib)<textarea id="rt-alasan" rows="3" data-autofocus placeholder="mis. satu brake pad cacat / salah part dari pihak bengkel"></textarea></label><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Batal</button><button class="btn pri" type="button" data-act="retur-kirim" data-no="${esc(t.no)}">Kirim pengajuan retur</button></div>`);
  document.querySelectorAll('[data-rt-item]').forEach(c => c.addEventListener('change', () => { const q = document.querySelector(`[data-rt-qty="${c.dataset.idx}"]`); if (q) q.disabled = !c.checked; }));
}
async function kirimRetur(el) {
  const t = S.trx.find(x => x.no === el.dataset.no) || st.lastNota, alasan = $('#rt-alasan')?.value.trim();
  const items = [...document.querySelectorAll('[data-rt-item]:checked')].map(c => { const i = c.closest('tr'), q = +i.querySelector('[data-rt-qty]')?.value || 0; return { kode: c.dataset.kode, nama: c.dataset.nama, qty: q, harga: +c.dataset.harga || 0 }; }).filter(x => x.qty > 0);
  if (!items.length) return toast('Pilih minimal satu part untuk retur');
  if (!alasan || alasan.length < 5) return toast('Isi alasan retur dengan jelas');
  const total = items.reduce((a, x) => a + x.qty * x.harga, 0), paid = (+t.bayar || +t.total || 0), cashRefund = t.transfer ? Math.round(total * ((+t.cash || 0) / Math.max(1, paid))) : total;
  try { await addDoc(collection(db, 'returPart'), { no: t.no, cabang: cabangOf(t), trx: t.no, pelanggan: t.pelanggan || 'Umum', hp: t.hp || '', items, total, cash: cashRefund, transfer: Math.max(0, total - cashRefund), metode: t.metode || 'Cash', alasan, status: 'diajukan', diajukanOleh: st.petugas?.nama || st.petugas?.email || '', tgl: stamp(new Date()) }); closeModal(); toast('Pengajuan retur sebagian ' + t.no + ' terkirim. Menunggu pemeriksaan dan persetujuan.'); }
  catch (e) { toast(e.message || 'Pengajuan retur gagal'); }
}
const checkHp = () => { const ok = $('#nota-hp-ok'); if (ok) ok.textContent = waNumber($('#nota-hp')?.value) ? '✓ nomor valid' : ''; };

function printNota() {
  const options = opsiNota(); notaPrintOptions = options;
  const w = window.open('', '_blank', 'width=860,height=760');
  if (!w) { toast('Pop-up diblokir browser. Izinkan pop-up untuk mencetak.'); return; }
  const wide = options.orientasi === 'landscape', large = options.ukuran === 'besar' ? 1.25 : options.ukuran === 'sangat-besar' ? 1.5 : 1;
  const width = options.orientasi === 'struk' ? '75mm' : wide ? '279.4mm' : '241.3mm';
  const content = notaHTML(current);
  const page = options.orientasi === 'struk' ? '75mm auto' : wide ? '11in 9.5in' : '9.5in 11in';
  const margin = options.orientasi === 'struk' ? '0' : '12mm';
  const pad = options.orientasi === 'struk' ? '3mm 3mm 2mm' : '0';
  const printScript = options.orientasi === 'struk' ? `<script>(function(){function cetak(){var pxPerMm=96/25.4,h=Math.ceil(document.body.scrollHeight/pxPerMm)+4;h=Math.max(35,h);var s=document.createElement('style');s.textContent='@page{size:75mm '+h+'mm;margin:0}';document.head.appendChild(s);setTimeout(function(){window.print();setTimeout(function(){window.close()},500)},120)}if(document.fonts&&document.fonts.ready){document.fonts.ready.then(cetak)}else{setTimeout(cetak,120)}})();<\/script>` : '';
  w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Nota ${esc(current.no)}</title><style>@page{size:${page};margin:${margin}}*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Arial,sans-serif;width:${options.orientasi === 'struk' ? '75mm' : 'auto'};max-width:100%;padding:${pad};color:#111;font-size:${12 * large}px;line-height:1.4}.struk{width:100%;max-width:100%;overflow:hidden}.s-title{text-align:center;font-weight:700;font-size:${18 * large}px;margin-bottom:3px}.s-sub,.s-center{text-align:center;overflow-wrap:anywhere;word-break:break-word}.s-center.small{font-size:${10 * large}px;color:#555}.s-head{font-weight:700;margin-top:8px}.s-lr{display:grid;grid-template-columns:minmax(0,42%) minmax(0,58%);gap:0;min-width:0;width:100%}.s-lr>span{min-width:0;overflow-wrap:anywhere;word-break:break-word}.s-lr>span:last-child{text-align:right}.s-item{margin:6px 0;overflow-wrap:anywhere;word-break:break-word}.s-total{font-weight:700;font-size:${14 * large}px}.s-center{margin-top:5px}hr{border:0;border-top:1px dashed #555;margin:7px 0}.muted{color:#555}@media print{html,body{width:${options.orientasi === 'struk' ? '75mm' : 'auto'};max-width:100%;height:auto}body{margin:0;padding:${pad}}}</style></head><body>${content}</body></html>${printScript}`);
  w.document.close(); w.focus(); if (!printScript) setTimeout(() => { w.print(); w.close(); }, 250);
}

async function downloadPdf() {
  try { const options = notaPrintOptions = opsiNota(); const { notaPdfBlob, saveBlob } = await import('./nota-pdf.js'); saveBlob(await notaPdfBlob(current, options), `Nota-${current.no}-${labelOrientasi(options.orientasi).replace(/\s+/g, '-')}.pdf`); }
  catch (e) { toast('PDF gagal dibuat: ' + e.message); }
}
// HP/tablet yang mendukung berbagi file: PDF langsung dikirim lewat menu bagikan → WhatsApp.
// Komputer: PDF diunduh, lalu WhatsApp dibuka dengan pesan + link cek servis; lampirkan PDF yang barusan diunduh.
async function sendWa() {
  const hp = $('#nota-hp')?.value || '';
  if (!waNumber(hp)) { toast('Isi nomor WhatsApp konsumen yang valid'); $('#nota-hp')?.focus(); return; }
  const text = waText(current);
  try {
    const { notaPdfBlob, saveBlob } = await import('./nota-pdf.js');
    const options = notaPrintOptions = opsiNota();
    const blob = await notaPdfBlob(current, options), file = new File([blob], `Nota-${current.no}.pdf`, { type: 'application/pdf' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    saveBlob(blob, `Nota-${current.no}.pdf`);
    window.open(waLink(hp, text), '_blank', 'noopener');
    toast('PDF diunduh. Di WhatsApp, lampirkan file Nota-' + current.no + '.pdf');
  } catch (e) { toast('Gagal: ' + e.message); }
}

actions['print'] = printNota;
actions['nota-pdf'] = downloadPdf;
actions['nota-wa'] = sendWa;
actions['retur-ajukan'] = ajukanRetur;
actions['retur-kirim'] = kirimRetur;
actions['nota'] = el => showNota((st.lap.list || S.trx).find(t => t.no === el.dataset.no) || S.trx.find(t => t.no === el.dataset.no));
inputHandlers.push(e => { if (e.target.id === 'nota-hp') checkHp(); });
