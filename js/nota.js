// Nota penjualan / servis: isi nota (dipakai layar, printer, dan PDF), cetak, unduh PDF, kirim via WhatsApp.
import { $, esc, toast, modal, waLink, waNumber, publicUrl } from './util.js';
import { S, st, actions, inputHandlers } from './state.js';
import { APP_NAME, APP_SUB } from './config.js';
import { cabangById, cabangOf, multiCabang } from './cabang.js';

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
export function showNota(t) {
  if (!t) { toast('Belum ada nota untuk dicetak'); return; }
  current = t;
  import('./nota-pdf.js').then(m => m.preloadPdf()).catch(() => {});   // siapkan pembuat PDF lebih awal
  modal(`<div class="row spread"><h2>Nota ${esc(t.no)}</h2><span class="pill p-good">Tersimpan</span></div>
   <div class="nota" id="nota-text">${esc(notaText(t))}</div>
   <label class="f" for="nota-hp"><span class="f-wa">No. WhatsApp konsumen<span class="small muted" id="nota-hp-ok"></span></span><input id="nota-hp" inputmode="tel" value="${esc(t.hp || '')}" placeholder="mis. 0812 xxxx xxxx"></label>
   <div class="row" style="justify-content:flex-end"><button class="btn" data-act="print" type="button">Cetak</button><button class="btn" data-act="nota-pdf" type="button">Unduh PDF</button><button class="btn wa-solid" data-act="nota-wa" type="button">Kirim PDF via WA</button><button class="btn pri" data-close="1" type="button">Tutup</button></div>`);
  checkHp();
}
const checkHp = () => { const ok = $('#nota-hp-ok'); if (ok) ok.textContent = waNumber($('#nota-hp')?.value) ? '✓ nomor valid' : ''; };

function printNota() {
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) { toast('Pop-up diblokir browser. Izinkan pop-up untuk mencetak.'); return; }
  w.document.write('<pre style="font:12px/1.4 monospace;margin:0">' + $('#nota-text').innerHTML + '</pre>');
  w.document.close(); w.focus(); w.print(); w.close();
}

async function downloadPdf() {
  try { const { notaPdfBlob, saveBlob } = await import('./nota-pdf.js'); saveBlob(await notaPdfBlob(current), `Nota-${current.no}.pdf`); }
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
    const blob = await notaPdfBlob(current), file = new File([blob], `Nota-${current.no}.pdf`, { type: 'application/pdf' });
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
actions['nota'] = el => showNota((st.lap.list || S.trx).find(t => t.no === el.dataset.no) || S.trx.find(t => t.no === el.dataset.no));
inputHandlers.push(e => { if (e.target.id === 'nota-hp') checkHp(); });
