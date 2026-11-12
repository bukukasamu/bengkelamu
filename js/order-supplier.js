// Purchase Order supplier: daftar belanja sebelum barang datang. Dibuat dan diterima oleh Sparepart; disetujui Super Admin.
// Satu PO dapat berisi item dari beberapa supplier. Penerimaan membuat Pembelian Stok dan menambah stok.
import { $, esc, rp, dkey, stamp, clone, toast, modal, closeModal, errMsg, konfirmasi, waLink, waNumber } from './util.js';
import { S, st, part, views, refreshers, actions, inputHandlers, changeHandlers, fkeys, partPicker, pickedKode, namaPetugas, idPetugas } from './state.js';
import { db, doc, collection, query, where, getDocs, runTransaction, setDoc, updateDoc } from './firebase.js';
import { counterRef, nextNumber } from './numbering.js';
import { cabAktif, stokOf, stokField, stokTotal } from './cabang.js';
import { catatMutasi, dataMutasi } from './kontrol.js';

const ACTIVE = ['menunggu_persetujuan', 'Dipesan', 'Datang sebagian'];
const blank = () => ({ no: null, cabang: cabAktif(), tgl: dkey(new Date()), catatan: '', status: 'Draf', items: [] });
const totalOf = items => items.reduce((a, x) => a + (+x.qty || 0) * (+x.harga || 0), 0);
const qtyOf = items => items.reduce((a, x) => a + (+x.qty || 0), 0);
const statusLabel = s => ({ Draf: 'Draf', menunggu_persetujuan: 'Menunggu persetujuan', Dipesan: 'Dipesan', 'Datang sebagian': 'Datang sebagian', Selesai: 'Selesai', Dibatalkan: 'Dibatalkan' }[s] || s);
const statusClass = s => s === 'Selesai' ? 'p-good' : s === 'Dibatalkan' ? 'p-bad' : s === 'Dipesan' ? 'p-info' : 'p-warn';
const pill = s => `<span class="pill ${statusClass(s)}">${esc(statusLabel(s))}</span>`;
const suppliers = () => [...new Set(S.orderSupplier.flatMap(o => (o.items || []).map(x => x.supplier)).filter(Boolean))].sort();
const orderedMap = () => {
  const m = {};
  S.orderSupplier.filter(o => ACTIVE.includes(o.status) && o.cabang === cabAktif()).forEach(o => (o.items || []).forEach(x => { m[x.kode] = (m[x.kode] || 0) + Math.max(0, (+x.qty || 0) - (+x.datang || 0)); }));
  return m;
};
const groups = items => [...new Set(items.map(x => x.supplier || 'Supplier belum ditentukan'))];

function renderList() {
  const el = $('#po-list'); if (!el) return;
  const list = [...S.orderSupplier].filter(o => st.poFilter === 'semua' || o.status === st.poFilter).sort((a, b) => String(b.tgl || '').localeCompare(String(a.tgl || '')));
  el.innerHTML = list.map(o => `<button class="wo" type="button" data-act="po-open" data-no="${esc(o.no)}" aria-current="${o.no === st.poDraft?.no}">
    <span class="row spread"><b class="mono">${esc(o.no || 'PO baru')}</b>${pill(o.status)}</span>
    <span class="small">${esc(groups(o.items || []).join(', '))}</span>
    <span class="row spread small"><span class="muted">${(o.items || []).length} jenis · ${qtyOf(o.items || [])} pcs</span><span class="num">${rp(totalOf(o.items || []))}</span></span>
  </button>`).join('') || '<div class="empty">Belum ada order ke supplier.</div>';
}

function renderPage() {
  $('#view').innerHTML = `<div class="grid"><div class="tiles">
    <button class="tile click" type="button" data-act="po-new"><span class="lbl">Order supplier baru</span><span class="val">+</span><span class="sub">Buat daftar belanja</span></button>
    <button class="tile click" type="button" data-act="po-low"><span class="lbl">Stok menipis</span><span class="val">${S.parts.filter(p => p.min > 0 && p.stok <= p.min).length}</span><span class="sub">Isi otomatis dengan saran qty</span></button>
    <div class="tile"><span class="lbl">Sedang dipesan</span><span class="val">${S.orderSupplier.filter(o => ACTIVE.includes(o.status)).length}</span><span class="sub">Dipesan / sebagian datang</span></div>
  </div><div class="grid g-servis"><div class="panel"><div class="row spread"><h3>Daftar order supplier</h3><button class="btn pri" type="button" data-act="po-new">+ Order baru</button></div><div class="seg" role="group" aria-label="Saring order">${[['semua','Semua'],['Draf','Draf'],['menunggu_persetujuan','Menunggu'],['Dipesan','Dipesan'],['Datang sebagian','Sebagian'],['Selesai','Selesai']].map(([v,l]) => `<button type="button" data-act="po-filter" data-f="${esc(v)}" aria-pressed="${st.poFilter === v}">${l}</button>`).join('')}</div><div class="wolist" id="po-list"></div></div><div class="panel" id="po-form"></div></div></div>`;
  renderList(); renderForm();
}

function renderForm() {
  const el = $('#po-form'); if (!el) return;
  if (!st.poDraft) st.poDraft = blank();
  const p = st.poDraft, locked = !['Draf', 'menunggu_persetujuan'].includes(p.status), editable = p.status === 'Draf';
  el.innerHTML = `<div class="row spread"><h2>${p.no ? esc(p.no) : 'Order ke Supplier baru'}</h2>${pill(p.status)}</div>
   <div class="note small">Satu order dapat berisi beberapa supplier. Setelah diajukan, order masuk ke <b>Persetujuan</b> dan baru boleh dikirim setelah disetujui Super Admin.</div>
   <div class="form"><label class="f" for="po-tgl">Tanggal order<input id="po-tgl" type="date" data-po="tgl" value="${esc(p.tgl)}" ${locked ? 'disabled' : ''}></label><label class="f wide" for="po-cat">Catatan order<input id="po-cat" data-po="catatan" value="${esc(p.catatan || '')}" placeholder="mis. kebutuhan servis bulan ini" ${locked ? 'disabled' : ''}></label></div>
   ${editable ? `<h3>Tambah item</h3><div class="row" style="align-items:end">${partPicker('po-pcari','Cari part atau kode')}<label class="f" style="min-width:92px" for="po-q">Qty<input id="po-q" type="number" min="1" value="1" class="num"></label><label class="f" style="min-width:130px" for="po-h">Perkiraan harga<input id="po-h" type="number" min="0" value="0" class="num"></label><button class="btn" type="button" data-act="po-add">Tambah</button></div><div class="row"><label class="f" style="min-width:170px" for="po-sup">Supplier item<input id="po-sup" list="dl-po-sup" placeholder="Nama supplier"><datalist id="dl-po-sup">${suppliers().map(s => `<option value="${esc(s)}">`).join('')}</datalist></label><label class="f wide" for="po-custom">Part belum ada di master <input id="po-custom" placeholder="Kode|Nama part|Kategori, contoh: BN-90-90-14|Ban luar 90/90-14|Ban"></label><button class="btn sm ghost" type="button" data-act="po-low">Isi dari stok menipis</button></div>` : ''}
   <div id="po-items"></div><div id="po-total"></div>
   <div class="row" style="justify-content:flex-end">${p.status === 'Draf' && p.no ? '<button class="btn ghost" type="button" data-act="po-delete">Hapus draft</button>' : ''}${p.status === 'Draf' ? '<button class="btn" type="button" data-act="po-save">Simpan draft</button><button class="btn pri" type="button" data-act="po-submit">Ajukan persetujuan</button>' : ''}${p.status === 'menunggu_persetujuan' ? '<span class="small muted">Menunggu keputusan Super Admin.</span>' : ''}${['Dipesan','Datang sebagian'].includes(p.status) ? '<button class="btn" type="button" data-act="po-wa">WhatsApp supplier</button><button class="btn" type="button" data-act="po-print">Cetak / PDF PO</button><button class="btn pri" type="button" data-act="po-receive">Terima barang datang</button>' : ''}</div>`;
  renderItems();
}

function renderItems() {
  const el = $('#po-items'); if (!el) return;
  const p = st.poDraft, locked = !['Draf'].includes(p.status);
  el.innerHTML = p.items.length ? `<h3>Daftar belanja</h3><div class="tw"><table class="bernomor"><thead><tr><th>Supplier</th><th>Part</th><th class="r">Order</th><th class="r">Datang</th><th class="r">Perkiraan harga</th><th class="r">Jumlah</th>${locked ? '' : '<th></th>'}</tr></thead><tbody>${p.items.map((x, i) => `<tr><td>${locked ? esc(x.supplier || '–') : `<input class="inline-input" data-pi="${i}" data-pf="supplier" value="${esc(x.supplier || '')}" placeholder="Supplier">`}</td><td>${esc(x.nama)}<br><span class="small muted mono">${esc(x.kode)}${x.kategori ? ' · ' + esc(x.kategori) : ''}</span></td><td class="r">${locked ? `<span class="num">${x.qty}</span>` : `<input class="inline-input num" type="number" min="1" data-pi="${i}" data-pf="qty" value="${x.qty}" style="width:70px">`}</td><td class="r num">${x.datang || 0}${x.datang ? `<div class="small muted">sisa ${Math.max(0, x.qty - x.datang)}</div>` : ''}</td><td class="r">${locked ? rp(x.harga) : `<input class="inline-input num" type="number" min="0" data-pi="${i}" data-pf="harga" value="${x.harga || 0}" style="width:110px">`}</td><td class="r num">${rp((+x.qty || 0) * (+x.harga || 0))}</td>${locked ? '' : `<td><button class="btn sm ghost" type="button" data-act="po-rm" data-i="${i}">✕</button></td>`}</tr>`).join('')}</tbody></table></div>` : '<div class="empty" style="border:1px dashed var(--line);border-radius:6px">Belum ada item. Tambahkan part atau isi dari stok menipis.</div>';
  const total = totalOf(p.items); $('#po-total').innerHTML = `<div class="totals"><span class="muted">${p.items.length} jenis · ${qtyOf(p.items)} pcs</span><span style="font-weight:600">Perkiraan total</span><span class="big num">${rp(total)}</span></div>`;
}

function addItem(item) {
  const p = st.poDraft, existing = p.items.find(x => x.kode === item.kode && (x.supplier || '') === (item.supplier || ''));
  if (existing) existing.qty += item.qty; else p.items.push(item);
  renderItems();
}
function addLow() {
  if (!st.poDraft || st.poDraft.status !== 'Draf') return toast('Hanya draft yang bisa diubah');
  const ord = orderedMap(), low = S.parts.filter(p => p.min > 0 && p.stok <= p.min);
  low.forEach(p => { const target = Math.max(1, p.min * 2), q = Math.max(0, target - p.stok - (ord[p.kode] || 0)); if (q) addItem({ kode: p.kode, nama: p.nama, kategori: p.kategori || '', qty: q, datang: 0, harga: p.beli || 0, supplier: '' }); });
  toast(low.length ? `${low.length} part stok menipis dimasukkan. Isi supplier tiap item.` : 'Tidak ada part di bawah stok minimum'); renderItems();
}
function addManual() {
  const raw = ($('#po-custom')?.value || '').trim(), bits = raw.split('|').map(x => x.trim()), sup = ($('#po-sup')?.value || '').trim();
  if (bits.length < 2 || !bits[0] || !bits[1]) return toast('Untuk part baru, isi Kode|Nama part|Kategori');
  addItem({ kode: bits[0].toUpperCase(), nama: bits[1], kategori: bits[2] || '', qty: Math.max(1, +$('#po-q').value || 1), datang: 0, harga: Math.max(0, +$('#po-h').value || 0), supplier: sup }); $('#po-custom').value = ''; $('#po-pcari').value = ''; renderItems();
}
function addFromPicker() {
  const kode = pickedKode('po-pcari'), pt = part(kode), sup = ($('#po-sup')?.value || '').trim();
  if (!pt) return $('#po-custom')?.value ? addManual() : toast('Pilih part dari daftar atau isi Kode|Nama part|Kategori');
  addItem({ kode: pt.kode, nama: pt.nama, kategori: pt.kategori || '', qty: Math.max(1, +$('#po-q').value || 1), datang: 0, harga: Math.max(0, +$('#po-h').value || pt.beli || 0), supplier: sup }); $('#po-pcari').value = ''; $('#po-q').value = 1; $('#po-h').value = 0; renderItems();
}
function validate(p) { if (!p.items.length) return 'Tambahkan minimal satu item'; if (p.items.some(x => !String(x.supplier || '').trim())) return 'Isi supplier pada setiap item'; if (p.items.some(x => !(+x.qty > 0))) return 'Qty order harus lebih dari 0'; return ''; }
async function saveDraft(submit = false) {
  if (st.saving) return false; const p = st.poDraft, err = validate(p); if (err) { toast(err); return false; }
  st.saving = true;
  try {
    const data = { ...clone(p), items: p.items.map(x => ({ ...x, qty: +x.qty || 0, datang: +x.datang || 0, harga: +x.harga || 0, supplier: String(x.supplier || '').trim() })), status: submit ? 'menunggu_persetujuan' : 'Draf', total: totalOf(p.items), dibuatOleh: p.dibuatOleh || namaPetugas(), dibuatId: p.dibuatId || idPetugas(), diubah: stamp(new Date()) };
    if (!p.no) {
      const no = await runTransaction(db, async tx => { const cs = await tx.get(counterRef()); const n = nextNumber(cs, 'PO'); tx.set(counterRef(), n.counter); tx.set(doc(db, 'orderSupplier', n.no), { ...data, no: n.no, cabang: cabAktif(), dibuat: stamp(new Date()) }); return n.no; }); p.no = no;
    } else await setDoc(doc(db, 'orderSupplier', p.no), data, { merge: true });
    Object.assign(p, data); toast(submit ? `PO ${p.no} diajukan ke Persetujuan` : `Draft ${p.no} disimpan`); renderPage(); return true;
  } catch (e) { toast(errMsg(e)); return false; } finally { st.saving = false; }
}
function poRows(o, supplier = '') { return (o.items || []).filter(x => !supplier || x.supplier === supplier).map((x, i) => `<tr><td>${i + 1}</td><td><b>${esc(x.nama)}</b><br><small>${esc(x.kode)}</small></td><td>${x.qty - (x.datang || 0)}</td><td style="text-align:right">${rp(x.harga)}</td><td style="text-align:right">${rp((x.qty - (x.datang || 0)) * x.harga)}</td></tr>`).join(''); }
function printPO() {
  const o = st.poDraft, w = window.open('', '_blank', 'width=960,height=760'); if (!w) return toast('Izinkan pop-up untuk mencetak PO');
  const sections = groups(o.items).map(s => `<h2>${esc(s)}</h2><table><thead><tr><th>No</th><th>Part</th><th>Qty sisa</th><th>Harga perkiraan</th><th>Jumlah</th></tr></thead><tbody>${poRows(o, s)}</tbody></table>`).join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(o.no)}</title><style>@page{size:A4 portrait;margin:14mm}body{font:13px Arial;color:#17213b;max-width:820px;margin:auto}.head{padding:24px;color:white;background:linear-gradient(110deg,#09245f,#2162d8 60%,#7442db);border-radius:16px;margin-bottom:22px}.head h1{margin:0;font-size:25px}.meta{display:flex;justify-content:space-between;gap:20px}.card{background:#f1f5ff;border-radius:12px;padding:12px;margin:12px 0}table{width:100%;border-collapse:collapse;margin:8px 0 22px}th,td{border-bottom:1px solid #dbe1ef;padding:8px;text-align:left}th{font-size:11px;text-transform:uppercase;color:#315ab2;background:#edf2ff}td:nth-child(n+3),th:nth-child(n+3){text-align:right}.foot{margin-top:28px;color:#69738a;font-size:11px}</style></head><body><div class="head"><div class="meta"><div><div style="font-size:11px;letter-spacing:.12em;opacity:.8">PURCHASE ORDER</div><h1>${esc(o.no)}</h1><div>Daftar order sparepart ke supplier</div></div><div style="text-align:right">${esc(o.tgl)}<br>${pill(o.status).replace('class="pill','style="background:#fff;color:#173b85;padding:5px 9px;border-radius:10px"')}</div></div></div><div class="card"><b>Catatan:</b> ${esc(o.catatan || '–')}<br><b>Total item:</b> ${qtyOf(o.items)} pcs · <b>Perkiraan nilai:</b> ${rp(totalOf(o.items))}</div>${sections}<div class="foot">Dokumen ini adalah daftar pesanan sebelum barang datang. Harga dan jumlah akhir mengikuti invoice supplier.</div></body></html>`); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 250);
}
function waPO() {
  const o = st.poDraft, sup = groups(o.items)[0];
  modal(`<h3>WhatsApp supplier</h3><p class="small">Pilih supplier yang akan dikirimi daftar. Masukkan nomor WhatsApp supplier bila ada.</p><label class="f" for="po-wa-sup">Supplier<select id="po-wa-sup">${groups(o.items).map(s => `<option>${esc(s)}</option>`).join('')}</select></label><label class="f" for="po-wa-hp">Nomor WhatsApp supplier<input id="po-wa-hp" inputmode="tel" placeholder="08xxxxxxxxxx" data-autofocus></label><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Batal</button><button class="btn wa-solid" type="button" data-act="po-wa-go">Buka WhatsApp</button></div>`);
  $('#po-wa-sup').value = sup;
}
function waGo() {
  const hp = waNumber($('#po-wa-hp')?.value), sup = $('#po-wa-sup')?.value, o = st.poDraft; if (!hp) return toast('Isi nomor WhatsApp supplier yang valid');
  const text = `Halo ${sup}, kami ingin memesan barang berikut dari ${o.no}:\n\n` + (o.items || []).filter(x => x.supplier === sup).map((x, i) => `${i + 1}. ${x.nama} (${x.kode}) — ${x.qty - (x.datang || 0)} pcs`).join('\n') + `\n\nMohon konfirmasi ketersediaan dan harga. Terima kasih.`; window.open(waLink(hp, text), '_blank', 'noopener'); closeModal();
}
async function submit() { if (!(await konfirmasi('Ajukan PO ke Persetujuan?', `PO berisi ${st.poDraft.items.length} jenis barang dari ${groups(st.poDraft.items).length} supplier. Setelah diajukan, item tidak dapat diubah sampai dikembalikan ke draft.`, { ya: 'Ajukan ke Super Admin' }))) return; await saveDraft(true); }
function receiveOpen() {
  const o = st.poDraft, remaining = o.items.filter(x => (+x.qty || 0) > (+x.datang || 0)); if (!remaining.length) return toast('Semua item sudah datang');
  modal(`<h3>Terima barang dari PO ${esc(o.no)}</h3><p class="small muted">Centang barang yang benar-benar datang. Jumlah dan harga invoice boleh berbeda dari pesanan. Item yang tidak datang tetap tersimpan sebagai sisa.</p><div class="tw"><table><thead><tr><th></th><th>Supplier</th><th>Part</th><th>Qty datang</th><th>Harga invoice</th></tr></thead><tbody>${remaining.map((x, i) => `<tr><td><input type="checkbox" data-rec="${i}"></td><td>${esc(x.supplier)}</td><td>${esc(x.nama)}<br><span class="small muted mono">${esc(x.kode)}</span></td><td><input class="num" type="number" min="0" max="${x.qty - (x.datang || 0)}" value="${x.qty - (x.datang || 0)}" data-rq="${i}" style="width:80px"></td><td><input class="num" type="number" min="0" value="${x.harga || 0}" data-rh="${i}" style="width:110px"></td></tr>`).join('')}</tbody></table></div><label class="f" for="po-inv">Nomor invoice supplier<input id="po-inv" placeholder="Boleh diisi setelah barang datang" data-autofocus></label><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Batal</button><button class="btn pri" type="button" data-act="po-receive-go">Buat pembelian &amp; tambah stok</button></div>`, 'wide');
}
async function receiveGo() {
  const o = st.poDraft, remaining = o.items.filter(x => (+x.qty || 0) > (+x.datang || 0));
  const chosen = remaining.map((x, i) => ({ ...x, _i: i, masuk: document.querySelector(`[data-rec="${i}"]`)?.checked, q: Math.min(x.qty - (x.datang || 0), Math.max(0, +document.querySelector(`[data-rq="${i}"]`)?.value || 0)), h: Math.max(0, +document.querySelector(`[data-rh="${i}"]`)?.value || 0) })).filter(x => x.masuk && x.q > 0);
  if (!chosen.length) return toast('Centang minimal satu barang dan isi jumlah datang');
  if (new Set(chosen.map(x => x.supplier)).size > 1) return toast('Terima barang per supplier agar nomor invoice dan Pembelian Stok tidak tercampur');
  const noInv = ($('#po-inv')?.value || '').trim(); if (!noInv) return toast('Isi nomor invoice supplier');
  if (!(await konfirmasi('Terima barang dan tambah stok?', `${chosen.length} jenis barang akan dibuatkan Pembelian Stok. Part baru di PO akan dibuat otomatis di master dengan harga jual 0; silakan lengkapi harga jualnya nanti.`, { ya: 'Ya, tambah ke stok' }))) return;
  st.saving = true;
  try {
    await runTransaction(db, async tx => {
      const poRef = doc(db, 'orderSupplier', o.no), poSnap = await tx.get(poRef); if (!poSnap.exists()) throw new Error('PO tidak ditemukan');
      const curPo = poSnap.data(), cs = await tx.get(counterRef()), pb = nextNumber(cs, 'PB'), refs = chosen.map(x => doc(db, 'parts', x.kode)), snaps = await Promise.all(refs.map(r => tx.get(r))), cab = cabAktif();
      const purchaseItems = chosen.map((x, i) => {
        const s = snaps[i]; if (!s.exists()) { tx.set(refs[i], { kode: x.kode, nama: x.nama, kategori: x.kategori || '', cocok: '', rak: '', beli: x.h, jual: 0, addPrice: 0, min: 0, stok: cab === 'UTM' ? x.q : 0, ...(cab === 'UTM' ? {} : { stokC: { [cab]: x.q } }) }); catatMutasi(tx, dataMutasi(cab, x.kode, x.nama, x.q, 'beli', pb.no, x.supplier + ' ' + noInv)); return { kode: x.kode, nama: x.nama, qty: x.q, harga: x.h }; }
        const cur = s.data(), s0 = Math.max(0, stokTotal(cur)), beli = s0 + x.q ? Math.round((s0 * (+cur.beli || 0) + x.q * x.h) / (s0 + x.q)) : x.h;
        tx.update(refs[i], { [stokField(cab)]: stokOf(cur, cab) + x.q, beli }); catatMutasi(tx, dataMutasi(cab, x.kode, cur.nama || x.nama, x.q, 'beli', pb.no, x.supplier + ' ' + noInv)); return { kode: cur.kode || x.kode, nama: cur.nama || x.nama, qty: x.q, harga: x.h };
      });
      tx.set(counterRef(), pb.counter); tx.set(doc(db, 'pembelian', pb.no), { no: pb.no, cabang: cab, bulan: dkey(new Date()).slice(0, 7), input: stamp(new Date()), dibuatOleh: namaPetugas(), tglInvoice: dkey(new Date()), noInvoice: noInv, supplier: [...new Set(chosen.map(x => x.supplier))].join(', '), statusBayar: 'Belum lunas', jatuhTempo: '', totalInvoice: totalOf(purchaseItems), catatan: 'Diterima dari ' + o.no, items: purchaseItems, total: totalOf(purchaseItems), status: 'Diterima', tglTerima: stamp(new Date()), diterimaOleh: namaPetugas(), po: o.no });
      const updates = (curPo.items || []).map(x => { const got = chosen.filter(y => y.kode === x.kode && y.supplier === x.supplier).reduce((a, y) => a + y.q, 0); return { ...x, datang: Math.min(+x.qty || 0, (+x.datang || 0) + got) }; });
      const status = updates.every(x => (+x.datang || 0) >= (+x.qty || 0)) ? 'Selesai' : 'Datang sebagian'; tx.update(poRef, { items: updates, total: totalOf(updates), status, terakhirDatang: stamp(new Date()), terakhirDiterimaOleh: namaPetugas() });
    });
    Object.assign(o, (await getDocs(query(collection(db, 'orderSupplier'), where('cabang', '==', cabAktif())))).docs.map(d => d.data()).find(x => x.no === o.no) || {}); closeModal(); toast(`Barang dari ${o.no} masuk ke Pembelian Stok dan stok bertambah`); renderPage();
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

views.orderSupplier = renderPage; refreshers.orderSupplier = renderList; fkeys.orderSupplier = { baru: 'po-new', simpan: 'po-save' };
Object.assign(actions, {
  'po-new': () => { st.poDraft = blank(); renderPage(); }, 'po-open': el => { const o = S.orderSupplier.find(x => x.no === el.dataset.no); if (o) { st.poDraft = clone(o); renderPage(); } },
  'po-filter': el => { st.poFilter = el.dataset.f; renderPage(); }, 'po-low': addLow, 'po-add': addFromPicker, 'po-rm': el => { st.poDraft.items.splice(+el.dataset.i, 1); renderItems(); }, 'po-save': () => saveDraft(false), 'po-submit': submit, 'po-print': printPO, 'po-wa': waPO, 'po-wa-go': waGo, 'po-receive': receiveOpen, 'po-receive-go': receiveGo,
  'po-delete': async () => { if (st.poDraft?.no && await konfirmasi('Hapus draft PO?', 'Daftar belanja ini akan dihapus.', { ya: 'Hapus', bahaya: true })) { await import('./firebase.js').then(({ deleteDoc }) => deleteDoc(doc(db, 'orderSupplier', st.poDraft.no))); st.poDraft = blank(); renderPage(); } }
});
inputHandlers.push(e => { const t = e.target; if (t.dataset.po && st.poDraft) { st.poDraft[t.dataset.po] = t.value; } if (t.dataset.pi != null && st.poDraft?.items[+t.dataset.pi]) { const x = st.poDraft.items[+t.dataset.pi]; x[t.dataset.pf] = t.dataset.pf === 'supplier' ? t.value : Math.max(0, +t.value || 0); renderItems(); } });
changeHandlers.push(e => { const t = e.target; if (t.id === 'po-pcari') { const pt = part(pickedKode('po-pcari')); if (pt && $('#po-h')) $('#po-h').value = pt.beli || 0; } });
