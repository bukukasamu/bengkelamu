// Nota penjualan / servis: tampilan dan cetak.
import { $, esc, toast, modal } from './util.js';
import { S, st, actions } from './state.js';
import { APP_NAME, APP_SUB } from './config.js';

export function notaText(t) {
  const W = 38, line = '-'.repeat(W);
  const lr = (l, r) => { l = String(l); r = String(r); const sp = W - l.length - r.length; return sp > 0 ? l + ' '.repeat(sp) + r : l.slice(0, W - r.length - 1) + ' ' + r; };
  const n = x => Math.round(x).toLocaleString('id-ID');
  const c = s => ' '.repeat(Math.max(0, Math.floor((W - s.length) / 2))) + s;
  const o = [c(APP_NAME.toUpperCase()), c(APP_SUB), line,
    lr('No', t.no), lr('Tanggal', t.tgl), lr('Pelanggan', (t.pelanggan || 'Umum').slice(0, 22))];
  if (t.nopol) o.push(lr('Nopol', t.nopol));
  if (t.jenisServis && t.jenisServis !== 'Reguler') o.push(lr('Servis', t.jenisServis + (t.ksgKe ? ' ke-' + t.ksgKe : '') + (t.noKartu ? ' #' + t.noKartu : '')));
  if (t.mekanik) o.push(lr('Mekanik', t.mekanik));
  if (t.kasir) o.push(lr('Kasir', String(t.kasir).slice(0, 26)));
  o.push(line);
  t.items.forEach(x => { o.push(x.nama.slice(0, W)); o.push(lr('  ' + x.qty + ' x ' + n(x.harga), n(x.qty * x.harga))); });
  if ((t.jasa || []).length) { o.push('JASA:'); t.jasa.forEach(j => o.push(lr('  ' + j.nama, t.jenisServis === 'KSG' ? 'GRATIS' : n(j.harga)))); }
  if ((t.biaya || []).length) { o.push('BIAYA LAIN:'); t.biaya.forEach(b => o.push(lr('  ' + b.ket, n(b.jumlah)))); }
  o.push(line, lr('Subtotal', n(t.total + (t.diskon || 0))));
  if (t.diskon) o.push(lr('Diskon', '-' + n(t.diskon)));
  o.push(lr('TOTAL', n(t.total)));
  if (t.cash != null) {   // nota v2.1: cash / transfer / campur
    if (t.cash) o.push(lr('Cash', n(t.cash)));
    if (t.transfer) { o.push(lr('Transfer', n(t.transfer))); if (t.rekening) o.push('  ' + t.rekening.slice(0, W - 2)); if (t.refTransfer) o.push('  Ref: ' + t.refTransfer); }
    o.push(lr('Kembali', n(t.kembali || 0)), line);
  } else o.push(lr('Bayar', n(t.bayar)), lr('Kembali', n(t.bayar - t.total)), line);
  if (t.jenisServis === 'KSG') o.push(c('Jasa servis KSG gratis'));
  o.push(c('Terima kasih'), c('Barang yang sudah dibeli'), c('tidak dapat dikembalikan'));
  return o.join('\n');
}

export function showNota(t) {
  if (!t) { toast('Belum ada nota untuk dicetak'); return; }
  modal('<div class="row spread"><h2>Nota ' + esc(t.no) + '</h2><span class="pill p-good">Tersimpan</span></div><div class="nota" id="nota-text">' + esc(notaText(t)) + '</div><div class="row" style="justify-content:flex-end"><button class="btn" data-act="print" type="button">Cetak</button><button class="btn pri" data-close="1" type="button">Tutup</button></div>');
}

function printNota() {
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) { toast('Pop-up diblokir browser. Izinkan pop-up untuk mencetak.'); return; }
  w.document.write('<pre style="font:12px/1.4 monospace;margin:0">' + $('#nota-text').innerHTML + '</pre>');
  w.document.close(); w.focus(); w.print(); w.close();
}

actions['print'] = printNota;
actions['nota'] = el => showNota((st.lap.list || S.trx).find(t => t.no === el.dataset.no) || S.trx.find(t => t.no === el.dataset.no));
