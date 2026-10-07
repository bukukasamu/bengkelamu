// Menu Kasir Sparepart: cari/scan part, keranjang, simpan penjualan + potong stok.
import { $, esc, rp, stamp, toast, errMsg } from './util.js';
import { S, st, part, emptyCart, namaPetugas, views, refreshers, actions, inputHandlers, fkeys } from './state.js';
import { db, doc, runTransaction, serverTimestamp } from './firebase.js';
import { counterRef, nextNumber } from './numbering.js';
import { showNota } from './nota.js';
import { emptyPay, payFields, payTotals, payStatus, payRecord, registerPay } from './payment.js';
import { dipesan } from './wo-common.js';

// Stok yang bisa dijual di konter = stok fisik dikurangi part yang sudah diorder untuk servis yang belum dibayar
const tersedia = p => p.stok - dipesan(p.kode);

export function searchParts(q, n = 8) {
  q = q.trim().toLowerCase();
  if (!q) return S.parts.slice(0, n);
  const exact = part(q.toUpperCase());               // hasil scan barcode = kode persis
  const words = q.split(/\s+/);
  const hits = S.parts.filter(p => { const s = (p.kode + ' ' + p.nama + ' ' + (p.cocok || '') + ' ' + (p.pengganti || '')).toLowerCase(); return words.every(w => s.includes(w)); });
  return (exact ? [exact, ...hits.filter(p => p !== exact)] : hits).slice(0, n);
}

function renderKasir() {
  const c = st.cart;
  $('#view').innerHTML = `<div class="grid g-kasir">
   <div class="panel"><h3>Cari part</h3>
    <label class="f" for="k-q">Scan barcode / ketik kode, nama, atau tipe motor<input id="k-q" placeholder="mis. brake pad, 2DP, YML-SM08" autocomplete="off"></label>
    <div class="results" id="k-res"></div>
    <p class="small muted" style="margin:0">Tekan Enter untuk menambahkan hasil teratas, seperti saat scan barcode.</p>
   </div>
   <div class="panel"><div class="row spread"><h3>Penjualan sparepart</h3><span class="small muted">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
    <div class="form"><label class="f wide" for="k-pel">Pelanggan / bengkel<input id="k-pel" placeholder="Umum" value="${esc(c.pelanggan)}"></label></div>
    <div id="k-cart"></div>
    <div class="form"><label class="f" for="k-dis">Diskon (Rp)<input id="k-dis" class="num" type="number" min="0" step="1000" value="${c.diskon || ''}"></label></div>
    ${payFields('k', c.pay)}
    <div id="k-tot"></div>
    <div class="row" style="justify-content:flex-end"><button class="btn" data-act="cart-clear" type="button">Kosongkan</button><button class="btn pri" data-act="cart-save" type="button">Simpan &amp; Cetak Nota [F2]</button></div>
   </div></div>`;
  renderKRes(); renderCart();
}

function renderKRes() {
  if (!$('#k-res')) return;
  const r = searchParts($('#k-q') ? $('#k-q').value : '');
  $('#k-res').innerHTML = r.length ? r.map(p => `<button class="res" type="button" data-act="add" data-k="${esc(p.kode)}"><span><span class="nm">${esc(p.nama)}</span><br><span class="sub"><span class="mono">${esc(p.kode)}</span>${p.cocok ? ' · ' + esc(p.cocok) : ''}${p.rak ? ' · rak ' + esc(p.rak) : ''}</span></span><span style="text-align:right"><span class="num">${rp(p.jual)}</span><br><span class="pill ${tersedia(p) <= 0 ? 'p-bad' : p.stok <= p.min ? 'p-warn' : 'p-good'}">stok ${p.stok}</span>${dipesan(p.kode) ? `<br><span class="small muted">${dipesan(p.kode)} dipesan servis</span>` : ''}</span></button>`).join('')
    : `<div class="empty">${S.parts.length ? 'Part tidak ditemukan.' : 'Belum ada data part. Import dulu di menu Stok Part.'}</div>`;
}

const cartTotal = () => { const sub = st.cart.items.reduce((a, x) => a + x.qty * (part(x.kode)?.jual || 0), 0); return { sub, total: Math.max(0, sub - (st.cart.diskon || 0)) }; };

function renderCart() {
  if (!$('#k-cart')) return;
  const items = st.cart.items;
  $('#k-cart').innerHTML = items.length ? `<div class="tw"><table><thead><tr><th>Part</th><th>Qty</th><th class="r">Harga</th><th class="r">Jumlah</th><th></th></tr></thead><tbody>${items.map(x => { const p = part(x.kode); return `<tr><td>${esc(p.nama)}<br><span class="small muted mono">${esc(p.kode)}</span></td><td><span class="qty"><button type="button" data-act="dec" data-k="${esc(p.kode)}" aria-label="Kurangi">−</button><span class="num" style="min-width:22px;text-align:center">${x.qty}</span><button type="button" data-act="inc" data-k="${esc(p.kode)}" aria-label="Tambah">+</button></span></td><td class="r num">${rp(p.jual)}</td><td class="r num">${rp(p.jual * x.qty)}</td><td><button class="btn sm ghost" type="button" data-act="rm" data-k="${esc(p.kode)}" aria-label="Hapus">✕</button></td></tr>`; }).join('')}</tbody></table></div>`
    : '<div class="empty" style="border:1px dashed var(--line);border-radius:6px">Keranjang kosong. Pilih part di sebelah kiri.</div>';
  renderKTot();
}

function renderKTot() {
  if (!$('#k-tot')) return;
  const c = st.cart, { sub, total } = cartTotal();
  $('#k-tot').innerHTML = `<div class="totals"><span class="muted">Subtotal</span><span class="num">${rp(sub)}</span><span class="muted">Diskon</span><span class="num">${c.diskon ? '−' + rp(c.diskon) : rp(0)}</span><span style="font-weight:600">Total</span><span class="big num">${rp(total)}</span>${payTotals(c.pay, total)}</div>`;
}

function addToCart(k) {
  const p = part(k), it = st.cart.items.find(x => x.kode === k), q = (it ? it.qty : 0) + 1;
  if (q > tersedia(p)) { toast(dipesan(k) ? `Stok ${p.nama} ${p.stok}, ${dipesan(k)} sudah dipesan servis. Sisa bisa dijual: ${Math.max(0, tersedia(p))}` : 'Stok ' + p.nama + ' tinggal ' + p.stok); return; }
  it ? it.qty++ : st.cart.items.push({ kode: k, qty: 1 }); renderCart();
}

async function saveSale() {
  if (st.saving) return;
  const c = st.cart;
  if (!c.items.length) { toast('Keranjang masih kosong'); return; }
  const chk = payStatus(c.pay, cartTotal().total);
  if (chk.err) { toast(chk.err); return; }
  st.saving = true;
  try {
    const diskon = c.diskon || 0;
    const t = await runTransaction(db, async tx => {
      const cs = await tx.get(counterRef());
      const refs = c.items.map(x => doc(db, 'parts', x.kode));
      const ps = await Promise.all(refs.map(r => tx.get(r)));
      const items = c.items.map((x, i) => {
        if (!ps[i].exists()) throw new Error('Part ' + x.kode + ' sudah dihapus');
        const p = ps[i].data();
        if (p.stok < x.qty) throw new Error('Stok ' + p.nama + ' tinggal ' + p.stok);
        return { kode: p.kode, nama: p.nama, qty: x.qty, harga: p.jual, beli: p.beli || 0 };
      });
      const total = Math.max(0, items.reduce((a, x) => a + x.qty * x.harga, 0) - diskon);
      const pay = payStatus(c.pay, total); if (pay.err) throw new Error(pay.err);
      const { no, counter } = nextNumber(cs, 'PJ');
      const trx = { no, tgl: stamp(new Date()), jenis: 'PART', pelanggan: c.pelanggan.trim() || 'Umum', nopol: '', items, jasa: [], diskon, total, ...payRecord(c.pay, total), kasir: namaPetugas() };
      tx.set(counterRef(), counter);
      items.forEach((x, i) => tx.update(refs[i], { stok: ps[i].data().stok - x.qty }));
      tx.set(doc(db, 'trx', no), { ...trx, dibuat: serverTimestamp() });
      return trx;
    });
    st.lastNota = t; st.cart = emptyCart(); renderKasir(); showNota(t);
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

registerPay('k', { get: () => st.cart.pay, total: () => cartTotal().total, onChange: renderKTot });
views.kasir = renderKasir;
refreshers.kasir = () => { st.cart.items = st.cart.items.filter(x => part(x.kode)); renderKRes(); renderCart(); };
fkeys.kasir = { baru: 'cart-clear', simpan: 'cart-save' };
Object.assign(actions, {
  'add': el => addToCart(el.dataset.k),
  'inc': el => addToCart(el.dataset.k),
  'dec': el => { const it = st.cart.items.find(x => x.kode === el.dataset.k); it.qty--; if (!it.qty) st.cart.items = st.cart.items.filter(x => x !== it); renderCart(); },
  'rm': el => { st.cart.items = st.cart.items.filter(x => x.kode !== el.dataset.k); renderCart(); },
  'cart-clear': () => { st.cart = emptyCart(); renderKasir(); },
  'cart-save': saveSale
});
inputHandlers.push(e => {
  const t = e.target;
  if (t.id === 'k-q') renderKRes();
  if (t.id === 'k-pel') st.cart.pelanggan = t.value;
  if (t.id === 'k-dis') { st.cart.diskon = +t.value || 0; renderKTot(); }
});
// Enter di kolom cari = tambah hasil teratas (dipanggil dari main.js)
export function onSearchEnter(input) {
  const r = searchParts(input.value);
  if (r.length) { addToCart(r[0].kode); input.value = ''; renderKRes(); }
}
