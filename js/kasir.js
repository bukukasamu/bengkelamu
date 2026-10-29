// Menu Penjualan / Pesanan Sparepart.
// Sparepart membuat pesanan pribadi dan mencetak lembar cross-check; Kasir memeriksa lalu menerima pembayaran.
import { $, esc, rp, stamp, toast, errMsg, konfirmasi, modal, closeModal } from './util.js';
import { S, st, part, emptyCart, namaPetugas, idPetugas, views, refreshers, actions, inputHandlers, fkeys, isRole } from './state.js';
import { db, doc, runTransaction, serverTimestamp, collection, addDoc, getDocs, query, where, updateDoc } from './firebase.js';
import { counterRef, nextNumber } from './numbering.js';
import { cabAktif, stokOf, stokField } from './cabang.js';
import { catatMutasi, dataMutasi } from './kontrol.js';
import { showNota } from './nota.js';
import { emptyPay, payFields, payTotals, payStatus, payRecord, registerPay } from './payment.js';
import { dipesan } from './wo-common.js';
import { tawarkanCabangLain } from './cek-stok.js';

const bagianSparepart = () => isRole('sparepart') && !isRole('admin');
const tersedia = p => p.stok - dipesan(p.kode);
const orderLabel = s => ({ menunggu_pembayaran: '<span class="pill p-warn">Menunggu Kasir</span>', dikembalikan: '<span class="pill p-bad">Dikembalikan ke Sparepart</span>', dibayar: '<span class="pill p-good">Sudah dibayar</span>' }[s] || `<span class="pill">${esc(s || '–')}</span>`);

export function searchParts(q, n = 8) {
  q = q.trim().toLowerCase();
  if (!q) return S.parts.slice(0, n);
  const exact = part(q.toUpperCase());
  const words = q.split(/\s+/);
  const hits = S.parts.filter(p => { const s = (p.kode + ' ' + p.nama + ' ' + (p.cocok || '') + ' ' + (p.pengganti || '')).toLowerCase(); return words.every(w => s.includes(w)); });
  return (exact ? [exact, ...hits.filter(p => p !== exact)] : hits).slice(0, n);
}

let pesananList = [];
async function muatPesanan() {
  try {
    const s = await getDocs(query(collection(db, 'pesananPart'), where('cabang', '==', cabAktif())));
    pesananList = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => ['menunggu_pembayaran', 'dikembalikan'].includes(x.status)).sort((a, b) => String(b.dibuat || '').localeCompare(String(a.dibuat || '')));
  } catch (e) { pesananList = []; console.warn('Pesanan part', e); }
  renderPesanan();
}
function renderPesanan() {
  const el = $('#k-pesanan'); if (!el) return;
  if (bagianSparepart()) {
    el.innerHTML = pesananList.length ? `<div class="tw"><table><thead><tr><th>Pesanan</th><th>Konsumen</th><th>Barang</th><th>Status</th><th></th></tr></thead><tbody>${pesananList.map(o => `<tr><td class="mono small">${esc(o.kode || o.id.slice(-6).toUpperCase())}</td><td>${esc(o.nama)}<br><span class="small muted">${esc(o.hp)}</span></td><td>${(o.items || []).reduce((a, x) => a + x.qty, 0)} pcs</td><td>${orderLabel(o.status)}${o.catatanKasir ? `<br><span class="small diff-bad">${esc(o.catatanKasir)}</span>` : ''}</td><td><button class="btn sm" type="button" data-act="pp-buka" data-id="${esc(o.id)}">Buka</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="small muted">Belum ada pesanan pribadi yang dikembalikan atau menunggu pembayaran.</div>';
  } else {
    el.innerHTML = pesananList.length ? `<div class="panel" style="margin:0"><h3>Pesanan dari Sparepart — periksa sebelum bayar</h3><div class="tw"><table><thead><tr><th>Pesanan</th><th>Konsumen</th><th>Barang</th><th>Total</th><th></th></tr></thead><tbody>${pesananList.map(o => `<tr><td class="mono small">${esc(o.kode || o.id.slice(-6).toUpperCase())}</td><td>${esc(o.nama)}<br><span class="small muted">${esc(o.hp)}</span></td><td>${(o.items || []).map(x => esc(x.nama || x.kode) + ' ×' + x.qty).join('<br>')}</td><td class="r num">${rp(o.total || 0)}</td><td><button class="btn sm pri" type="button" data-act="pp-pilih" data-id="${esc(o.id)}">Periksa &amp; bayar</button><br><button class="btn sm ghost" type="button" data-act="pp-kembali" data-id="${esc(o.id)}">Tidak sesuai</button></td></tr>`).join('')}</tbody></table></div></div>` : '<div class="small muted">Belum ada pesanan pribadi dari Sparepart.</div>';
  }
}
function printPesanan(o) {
  const x = window.open('', '_blank'); if (!x) { toast('Izinkan pop-up untuk mencetak pesanan'); return; }
  const rows = (o.items || []).map((i, n) => `<tr><td>${n + 1}</td><td>${esc(i.nama || i.kode)}<br><small>${esc(i.kode || '')}</small></td><td>${i.qty}</td><td style="text-align:right">${rp(i.harga)}</td><td style="text-align:right">${rp(i.qty * i.harga)}</td></tr>`).join('');
  x.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Pesanan ${esc(o.kode || '')}</title><style>body{font:13px Arial;max-width:760px;margin:24px auto;color:#222}h1{font-size:20px;border-bottom:2px solid #222;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:14px}th,td{border:1px solid #555;padding:7px;text-align:left}th{background:#eee}.note{margin-top:18px;padding:10px;border:1px solid #555;font-weight:bold}small{color:#666}@media print{@page{size:A4;margin:14mm}}</style></head><body><h1>FORM PESANAN SPAREPART</h1><p><b>No. pesanan:</b> ${esc(o.kode || '')}<br><b>Nama pemesan:</b> ${esc(o.nama)}<br><b>No. HP:</b> ${esc(o.hp)}<br><b>Tanggal:</b> ${esc(o.dibuat || '')}</p><table><thead><tr><th>No.</th><th>Part</th><th>Qty</th><th>Harga</th><th>Jumlah</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><th colspan="4" style="text-align:right">Total</th><th style="text-align:right">${rp(o.total || 0)}</th></tr></tfoot></table><div class="note">Harap periksa kembali barang pesanan, nama part, jumlah, dan harganya. Setelah pembayaran dilakukan, barang yang sudah dibeli tidak dapat dikembalikan atau ditukar.</div><p style="margin-top:35px;text-align:center">Tanda tangan konsumen: ____________________</p><script>window.onload=()=>{window.focus();window.print()}<\/script></body></html>`);
  x.document.close();
}

function renderKasir() {
  const c = st.cart, spare = bagianSparepart();
  $('#view').innerHTML = `<div class="grid g-kasir">
   <div class="panel"><h3>${spare ? 'Input pesanan konsumen' : 'Cari part / pesanan'}</h3>
    <label class="f" for="k-q">Scan barcode / ketik kode, nama, atau tipe motor<input id="k-q" placeholder="mis. brake pad, 2DP, YML-SM08" autocomplete="off"></label>
    <div class="results" id="k-res"></div><p class="small muted" style="margin:0">Tekan Enter untuk menambahkan hasil teratas, seperti saat scan barcode.</p>
    ${spare ? '<div id="k-pesanan" style="margin-top:12px"></div>' : '<div id="k-pesanan" style="margin-top:12px"></div>'}
   </div>
   <div class="panel"><div class="row spread"><h3>${spare ? 'Pesanan part pribadi' : 'Penjualan sparepart / pembayaran pesanan'}</h3><span class="small muted">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
    <div class="form"><label class="f wide" for="k-pel">Nama pemesan / pelanggan<input id="k-pel" placeholder="Nama konsumen" value="${esc(c.pelanggan || '')}"></label><label class="f" for="k-hp">Nomor HP<input id="k-hp" inputmode="tel" placeholder="08xxxxxxxxxx" value="${esc(c.hp || '')}"></label></div>
    ${spare ? '<div class="note small">Setelah barang dan jumlah benar, simpan pesanan lalu cetak lembar ini untuk cross-check konsumen. Pesanan baru dibayar di menu Kasir setelah konsumen menyatakan sesuai.</div>' : ''}
    <div id="k-cart"></div>
    <div class="form"><label class="f" for="k-dis">Diskon (Rp)<input id="k-dis" class="num" type="number" min="0" step="1000" value="${c.diskon || ''}" ${spare ? 'disabled' : ''}></label></div>
    ${spare ? '' : payFields('k', c.pay)}
    <div id="k-tot"></div>
    <div class="row" style="justify-content:flex-end"><button class="btn" data-act="cart-clear" type="button">Kosongkan</button><button class="btn pri" data-act="cart-save" type="button">${spare ? 'Simpan pesanan &amp; cetak cek [F2]' : 'Terima pembayaran &amp; cetak nota [F2]'}</button></div>
   </div></div>`;
  renderKRes(); renderCart(); renderPesanan(); muatPesanan();
}
function renderKRes() { if (!$('#k-res')) return; const r = searchParts($('#k-q') ? $('#k-q').value : ''); $('#k-res').innerHTML = r.length ? r.map(p => `<button class="res" type="button" data-act="add" data-k="${esc(p.kode)}"><span><span class="nm">${esc(p.nama)}</span><br><span class="sub"><span class="mono">${esc(p.kode)}</span>${p.cocok ? ' · ' + esc(p.cocok) : ''}</span></span><span style="text-align:right"><span class="num">${rp(p.jual)}</span><br><span class="pill ${tersedia(p) <= 0 ? 'p-bad' : p.stok <= p.min ? 'p-warn' : 'p-good'}">stok ${p.stok}</span></span></button>`).join('') : `<div class="empty">${S.parts.length ? 'Part tidak ditemukan.' : 'Belum ada data part.'}</div>`; }
const cartTotal = () => { const sub = st.cart.items.reduce((a, x) => a + x.qty * (part(x.kode)?.jual || 0), 0); return { sub, total: Math.max(0, sub - (st.cart.diskon || 0)) }; };
function renderCart() { if (!$('#k-cart')) return; const items = st.cart.items; $('#k-cart').innerHTML = items.length ? `<div class="tw"><table class="bernomor"><thead><tr><th>Part</th><th>Qty</th><th class="r">Harga</th><th class="r">Jumlah</th><th></th></tr></thead><tbody>${items.map(x => { const p = part(x.kode); return `<tr><td>${esc(p.nama)}<br><span class="small muted mono">${esc(p.kode)}</span></td><td><span class="qty"><button type="button" data-act="dec" data-k="${esc(p.kode)}">−</button><span class="num" style="min-width:22px;text-align:center">${x.qty}</span><button type="button" data-act="inc" data-k="${esc(p.kode)}">+</button></span></td><td class="r num">${rp(p.jual)}</td><td class="r num">${rp(p.jual * x.qty)}</td><td><button class="btn sm ghost" type="button" data-act="rm" data-k="${esc(p.kode)}">✕</button></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty" style="border:1px dashed var(--line);border-radius:6px">Keranjang kosong. Pilih part di sebelah kiri.</div>'; renderKTot(); }
function renderKTot() { if (!$('#k-tot')) return; const c = st.cart, { sub, total } = cartTotal(); $('#k-tot').innerHTML = `<div class="totals"><span class="muted">Subtotal</span><span class="num">${rp(sub)}</span><span class="muted">Diskon</span><span class="num">${c.diskon ? '−' + rp(c.diskon) : rp(0)}</span><span style="font-weight:600">Total</span><span class="big num">${rp(total)}</span>${bagianSparepart() ? '' : payTotals(c.pay, total)}</div>`; }
function addToCart(k) { const p = part(k), it = st.cart.items.find(x => x.kode === k), q = (it ? it.qty : 0) + 1; if (q > tersedia(p)) { tawarkanCabangLain(p, 'Stok ' + p.nama + ' tidak cukup untuk pesanan ini.'); return; } it ? it.qty++ : st.cart.items.push({ kode: k, qty: 1 }); renderCart(); }
function pilihPesanan(o) { st.cart.items = (o.items || []).map(x => ({ kode: x.kode, qty: x.qty })); st.cart.pelanggan = o.nama || ''; st.cart.hp = o.hp || ''; st.cart.pesananId = o.id; st.cart.diskon = 0; if (!bagianSparepart()) st.cart.pay = emptyPay(); renderKasir(); }
async function simpanPesanan() {
  const c = st.cart, { total } = cartTotal(); if (!c.items.length) return toast('Keranjang masih kosong'); if (!c.pelanggan.trim()) return toast('Nama pemesan wajib diisi'); if (!c.hp.trim()) return toast('Nomor HP pemesan wajib diisi');
  const items = c.items.map(x => { const p = part(x.kode); return { kode: x.kode, nama: p?.nama || x.kode, qty: x.qty, harga: p?.jual || 0 }; }); const o = { cabang: cabAktif(), kode: c.pesananId ? (pesananList.find(x => x.id === c.pesananId)?.kode || '') : 'PP-' + stamp(new Date()).replace(/[^0-9]/g, '').slice(2, 14), nama: c.pelanggan.trim(), hp: c.hp.trim(), items, total, status: 'menunggu_pembayaran', dibuat: stamp(new Date()), dibuatOleh: namaPetugas(), dibuatId: idPetugas(), ...(c.pesananId ? { catatanKasir: '' } : {}) };
  try { const ref = c.pesananId ? (await updateDoc(doc(db, 'pesananPart', c.pesananId), o), { id: c.pesananId }) : await addDoc(collection(db, 'pesananPart'), o); closeModal(); st.cart = emptyCart(); renderKasir(); printPesanan({ ...o, id: ref.id || ref }); toast('Pesanan disimpan. Berikan lembar cek kepada konsumen.'); } catch (e) { toast(errMsg(e)); }
}
async function kembalikanPesanan(o) { modal(`<h3>Kembalikan pesanan ke Sparepart</h3><p class="small">${esc(o.nama)} · ${esc(o.kode || o.id)}</p><label class="f" for="pp-cat">Catatan ketidaksesuaian<textarea id="pp-cat" placeholder="Mis. jumlah salah / part tidak sesuai" data-autofocus></textarea></label><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Batal</button><button class="btn warn" type="button" data-act="pp-kembali-ok" data-id="${esc(o.id)}">Kembalikan</button></div>`); }
async function kembaliOk(el) { const cat = $('#pp-cat')?.value.trim(); if (!cat) return toast('Isi alasan ketidaksesuaian'); try { await updateDoc(doc(db, 'pesananPart', el.dataset.id), { status: 'dikembalikan', catatanKasir: cat, dikembalikan: stamp(new Date()), dikembalikanOleh: namaPetugas() }); closeModal(); toast('Pesanan dikembalikan ke Sparepart'); muatPesanan(); } catch (e) { toast(errMsg(e)); } }
async function saveSale() {
  if (bagianSparepart()) return simpanPesanan(); if (st.saving) return; const c = st.cart; if (!c.items.length) return toast('Keranjang masih kosong'); const chk = payStatus(c.pay, cartTotal().total); if (chk.err) return toast(chk.err); const qty = c.items.reduce((a, x) => a + x.qty, 0); if (!(await konfirmasi('Terima pembayaran sparepart?', `${qty} pcs · total <b>${rp(cartTotal().total)}</b>${chk.kembali ? ' · kembali <b>' + rp(chk.kembali) + '</b>' : ''}.<br>Pastikan barang, jumlah, nama, dan harga sudah sesuai. Setelah bayar barang tidak dapat dikembalikan.`, { ya: 'Ya, simpan & cetak nota' }))) return; st.saving = true;
  try { const diskon = c.diskon || 0; const t = await runTransaction(db, async tx => { const cab = cabAktif(), cs = await tx.get(counterRef(cab)), refs = c.items.map(x => doc(db, 'parts', x.kode)), ps = await Promise.all(refs.map(r => tx.get(r))); const items = c.items.map((x, i) => { if (!ps[i].exists()) throw new Error('Part ' + x.kode + ' sudah dihapus'); const p = ps[i].data(); if (stokOf(p, cab) < x.qty) throw new Error('Stok ' + p.nama + ' tinggal ' + stokOf(p, cab)); return { kode: p.kode, nama: p.nama, qty: x.qty, harga: p.jual, beli: p.beli || 0 }; }); const total = Math.max(0, items.reduce((a, x) => a + x.qty * x.harga, 0) - diskon), pay = payStatus(c.pay, total); if (pay.err) throw new Error(pay.err); const { no, counter } = nextNumber(cs, 'PJ', cab), trx = { no, cabang: cab, tgl: stamp(new Date()), jenis: 'PART', pelanggan: c.pelanggan.trim() || 'Umum', hp: c.hp.trim() || '', nopol: '', items, jasa: [], diskon, total, ...payRecord(c.pay, total), kasir: namaPetugas(), kasirId: idPetugas(), pesananPartId: c.pesananId || '' }; tx.set(counterRef(cab), counter); items.forEach((x, i) => { tx.update(refs[i], { [stokField(cab)]: stokOf(ps[i].data(), cab) - x.qty }); catatMutasi(tx, dataMutasi(cab, x.kode, x.nama, -x.qty, 'jual', no)); }); tx.set(doc(db, 'trx', no), { ...trx, bulan: trx.tgl.slice(0, 7), dibuat: serverTimestamp() }); if (c.pesananId) tx.update(doc(db, 'pesananPart', c.pesananId), { status: 'dibayar', trx: no, dibayar: trx.tgl, dibayarOleh: namaPetugas() }); return trx; }); st.lastNota = t; st.cart = emptyCart(); renderKasir(); showNota(t); } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}
registerPay('k', { get: () => st.cart.pay, total: () => cartTotal().total, onChange: renderKTot });
views.kasir = renderKasir; refreshers.kasir = () => { st.cart.items = st.cart.items.filter(x => part(x.kode)); renderKRes(); renderCart(); renderPesanan(); }; fkeys.kasir = { baru: 'cart-clear', simpan: 'cart-save', cari: 'k-fokus' };
Object.assign(actions, { 'add': el => addToCart(el.dataset.k), 'inc': el => addToCart(el.dataset.k), 'dec': el => { const it = st.cart.items.find(x => x.kode === el.dataset.k); it.qty--; if (!it.qty) st.cart.items = st.cart.items.filter(x => x !== it); renderCart(); }, 'rm': el => { st.cart.items = st.cart.items.filter(x => x.kode !== el.dataset.k); renderCart(); }, 'cart-clear': async () => { if (st.cart.items.length && !(await konfirmasi('Kosongkan keranjang?', 'Semua item akan dihapus.', { ya: 'Ya, kosongkan', bahaya: true }))) return; st.cart = emptyCart(); renderKasir(); }, 'cart-save': saveSale, 'k-fokus': () => { const q = $('#k-q'); if (q) { q.focus(); q.select(); } }, 'pp-pilih': el => { const o = pesananList.find(x => x.id === el.dataset.id); if (o) pilihPesanan(o); }, 'pp-buka': el => { const o = pesananList.find(x => x.id === el.dataset.id); if (o) pilihPesanan(o); }, 'pp-kembali': el => { const o = pesananList.find(x => x.id === el.dataset.id); if (o) kembalikanPesanan(o); }, 'pp-kembali-ok': kembaliOk });
inputHandlers.push(e => { const t = e.target; if (t.id === 'k-q') renderKRes(); if (t.id === 'k-pel') st.cart.pelanggan = t.value; if (t.id === 'k-hp') st.cart.hp = t.value; if (t.id === 'k-dis') { st.cart.diskon = +t.value || 0; renderKTot(); } });
export function onSearchEnter(input) { const r = searchParts(input.value); if (r.length) { addToCart(r[0].kode); input.value = ''; renderKRes(); } }
