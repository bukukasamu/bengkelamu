// Menu Pembelian Stok: catat invoice supplier (lunas / belum lunas), cek dulu lewat preview,
// lalu masukkan ke stok. Harga beli part diperbarui dengan harga rata-rata tertimbang.
import { $, esc, rp, dkey, stamp, clone, toast, modal, closeModal, errMsg } from './util.js';
import { S, st, part, views, refreshers, actions, inputHandlers, changeHandlers, fkeys, partPicker, pickedKode, namaPetugas, go } from './state.js';
import { db, doc, runTransaction, setDoc, updateDoc, deleteDoc } from './firebase.js';
import { counterRef, nextNumber } from './numbering.js';
import { cabAktif, cabangOf, stokOf, stokField, stokTotal } from './cabang.js';

const blank = () => ({ no: null, tglInvoice: dkey(new Date()), noInvoice: '', supplier: '', statusBayar: 'Belum lunas', jatuhTempo: '', totalInvoice: '', catatan: '', items: [], status: 'Draft' });
const totalOf = items => items.reduce((a, x) => a + (+x.qty || 0) * (+x.harga || 0), 0);
const qtyOf = items => items.reduce((a, x) => a + (+x.qty || 0), 0);
const fmtTgl = s => s ? new Date(s + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '–';
const bayarPill = p => p.statusBayar === 'Lunas' ? '<span class="pill p-good">Lunas</span>' : `<span class="pill ${p.jatuhTempo && p.jatuhTempo < dkey(new Date()) ? 'p-bad' : 'p-warn'}">Belum lunas</span>`;
const statusPill = p => p.status === 'Diterima' ? '<span class="pill p-info">Masuk stok</span>' : '<span class="pill p-warn">Draft</span>';

function filtered() {
  const f = st.pbFilter;
  return S.pembelian.filter(p => f === 'semua' || (f === 'draft' && p.status === 'Draft') || (f === 'belum' && p.statusBayar !== 'Lunas') || (f === 'lunas' && p.statusBayar === 'Lunas'));
}

function renderPembelian() {
  const now = new Date(), bulan = dkey(new Date(now.getFullYear(), now.getMonth(), 1));
  const hutang = S.pembelian.filter(p => p.status === 'Diterima' && p.statusBayar !== 'Lunas');
  const telat = hutang.filter(p => p.jatuhTempo && p.jatuhTempo < dkey(now));
  const bln = S.pembelian.filter(p => p.status === 'Diterima' && (p.tglInvoice || '') >= bulan);
  $('#view').innerHTML = `<div class="grid">
   <div class="tiles">
    <button class="tile click" type="button" data-act="pb-filter" data-f="belum"><span class="lbl">Hutang ke supplier</span><span class="val" style="color:${hutang.length ? 'var(--bad)' : 'inherit'}">${rp(hutang.reduce((a, p) => a + p.total, 0))}</span><span class="sub">${hutang.length} invoice belum lunas${telat.length ? ` · ${telat.length} lewat jatuh tempo` : ''}</span></button>
    <div class="tile"><span class="lbl">Pembelian bulan ini</span><span class="val">${rp(bln.reduce((a, p) => a + p.total, 0))}</span><span class="sub">${bln.length} invoice masuk stok</span></div>
    <button class="tile click" type="button" data-act="pb-filter" data-f="draft"><span class="lbl">Draft belum diterima</span><span class="val">${S.pembelian.filter(p => p.status === 'Draft').length}</span><span class="sub">perlu dicek &amp; diterima</span></button>
    <button class="tile click" type="button" data-act="pb-new"><span class="lbl">Invoice baru</span><span class="val">+</span><span class="sub">catat pembelian [F1]</span></button>
   </div>
   <div class="grid g-servis">
    <div class="panel"><h3>Daftar pembelian</h3>
     <div class="seg" role="group" aria-label="Saring">${[['semua', 'Semua'], ['draft', 'Draft'], ['belum', 'Belum lunas'], ['lunas', 'Lunas']].map(([k, l]) => `<button type="button" data-act="pb-filter" data-f="${k}" aria-pressed="${k === st.pbFilter}">${l}</button>`).join('')}</div>
     <div class="wolist" id="pb-list"></div>
    </div>
    <div class="panel" id="pb-form"></div>
   </div></div>`;
  renderList(); renderForm();
}

function renderList() {
  const el = $('#pb-list'); if (!el) return;
  el.innerHTML = filtered().map(p => `<button class="wo" type="button" data-act="pb-open" data-no="${esc(p.no)}" aria-current="${p.no === st.pbDraft?.no}">
    <span class="row spread"><b>${esc(p.supplier || '–')}</b><span class="num">${rp(p.total)}</span></span>
    <span class="small">Inv. <span class="mono">${esc(p.noInvoice)}</span> · ${fmtTgl(p.tglInvoice)}</span>
    <span class="row spread small"><span class="muted">${p.items.length} jenis · ${qtyOf(p.items)} pcs</span><span class="row">${statusPill(p)}${bayarPill(p)}</span></span></button>`).join('') || '<div class="empty">Belum ada pembelian.</div>';
}

function renderForm() {
  const el = $('#pb-form'); if (!el) return;
  if (!st.pbDraft) st.pbDraft = blank();
  const p = st.pbDraft, lock = p.status === 'Diterima', dis = lock ? 'disabled' : '';
  const suppliers = [...new Set(S.pembelian.map(x => x.supplier).filter(Boolean))];
  el.innerHTML = `<div class="row spread"><h2>${p.no ? esc(p.no) : 'Pembelian baru'}</h2><span class="row">${p.no ? statusPill(p) : ''}${p.no ? bayarPill(p) : ''}</span></div>
   ${lock ? `<div class="note small">Sudah masuk stok ${p.tglTerima ? 'pada ' + esc(p.tglTerima) : ''}${p.diterimaOleh ? ' oleh ' + esc(p.diterimaOleh) : ''}. Item tidak bisa diubah; status bayar masih bisa diperbarui.</div>` : ''}
   <div class="form">
    <label class="f" for="pb-tgl">Tanggal invoice<input id="pb-tgl" type="date" data-pb="tglInvoice" value="${esc(p.tglInvoice)}" ${dis}></label>
    <label class="f" for="pb-inv">No. invoice<input id="pb-inv" data-pb="noInvoice" class="mono" value="${esc(p.noInvoice)}" ${dis}></label>
    <label class="f" for="pb-sup">Supplier<input id="pb-sup" data-pb="supplier" list="dl-sup" value="${esc(p.supplier)}" ${dis}><datalist id="dl-sup">${suppliers.map(s => `<option value="${esc(s)}">`).join('')}</datalist></label>
    <label class="f" for="pb-bayar">Status bayar<select id="pb-bayar" data-pb="statusBayar">${['Belum lunas', 'Lunas'].map(s => `<option ${s === p.statusBayar ? 'selected' : ''}>${s}</option>`).join('')}</select></label>
    ${p.statusBayar !== 'Lunas' ? `<label class="f" for="pb-jt">Jatuh tempo<input id="pb-jt" type="date" data-pb="jatuhTempo" value="${esc(p.jatuhTempo)}"></label>` : `<label class="f" for="pb-tb">Tanggal bayar<input id="pb-tb" type="date" data-pb="tglBayar" value="${esc(p.tglBayar || dkey(new Date()))}"></label>`}
    <label class="f" for="pb-tinv">Total di invoice (Rp)<input id="pb-tinv" type="number" min="0" class="num" data-pb="totalInvoice" value="${esc(p.totalInvoice)}" placeholder="untuk dicocokkan" ${dis}></label>
    <label class="f wide" for="pb-cat">Catatan<input id="pb-cat" data-pb="catatan" value="${esc(p.catatan || '')}" ${dis}></label>
   </div>
   <h3>Barang dibeli</h3>
   ${lock ? '' : S.parts.length ? `<div class="row">${partPicker('pb-pcari', 'Cari part')}<input id="pb-q" type="number" min="1" value="1" aria-label="Jumlah" style="width:70px" class="num"><input id="pb-h" type="number" min="0" placeholder="Harga beli" aria-label="Harga beli satuan" style="width:120px" class="num"><button class="btn" type="button" data-act="pb-add">Tambah</button></div><p class="small muted" style="margin:0">Part belum ada di master? Tambahkan dulu di <button class="btn sm ghost" type="button" data-act="pb-gostok">Stok Part</button>.</p>` : '<div class="small muted">Belum ada data part. Import dulu di menu Stok Part.</div>'}
   <div id="pb-items"></div>
   <div id="pb-tot"></div>
   <div class="row" style="justify-content:flex-end">
    ${p.no && !lock ? '<button class="btn ghost" type="button" data-act="pb-del">Hapus draft</button>' : ''}
    ${lock ? (p.statusBayar !== 'Lunas' || p._bayarDirty ? '<button class="btn pri" type="button" data-act="pb-savepay">Simpan status bayar</button>' : '')
      : '<button class="btn" type="button" data-act="pb-save">Simpan draft [F2]</button><button class="btn pri" type="button" data-act="pb-preview">Preview &amp; terima barang</button>'}
   </div>`;
  renderItems();
}

function renderItems() {
  const p = st.pbDraft, lock = p.status === 'Diterima';
  $('#pb-items').innerHTML = p.items.length ? `<div class="tw"><table><thead><tr><th>Part</th><th class="r">Qty</th><th class="r">Harga beli</th><th class="r">Subtotal</th>${lock ? '' : '<th></th>'}</tr></thead><tbody>${p.items.map((x, i) => `<tr><td>${esc(x.nama)}<br><span class="small muted mono">${esc(x.kode)}</span></td>
    <td class="r">${lock ? `<span class="num">${x.qty}</span>` : `<input class="inline-input num" type="number" min="1" id="pi-q${i}" data-pi="${i}" data-pf="qty" value="${x.qty}" style="width:70px;text-align:right" aria-label="Qty">`}</td>
    <td class="r">${lock ? `<span class="num">${rp(x.harga)}</span>` : `<input class="inline-input num" type="number" min="0" id="pi-h${i}" data-pi="${i}" data-pf="harga" value="${x.harga}" style="width:110px;text-align:right" aria-label="Harga beli">`}</td>
    <td class="r num" id="pi-s${i}">${rp(x.qty * x.harga)}</td>${lock ? '' : `<td><button class="btn sm ghost" type="button" data-act="pb-rm" data-i="${i}" aria-label="Hapus">✕</button></td>`}</tr>`).join('')}</tbody></table></div>` : '<div class="empty" style="border:1px dashed var(--line);border-radius:6px">Belum ada barang.</div>';
  renderTot();
}

function renderTot() {
  const el = $('#pb-tot'); if (!el) return;
  const p = st.pbDraft, t = totalOf(p.items), inv = +p.totalInvoice || 0, sel = inv ? t - inv : 0;
  el.innerHTML = `<div class="totals"><span class="muted">Jumlah barang</span><span class="num">${p.items.length} jenis · ${qtyOf(p.items)} pcs</span><span style="font-weight:600">Total pembelian</span><span class="big num">${rp(t)}</span>${inv ? `<span class="muted">Total di invoice</span><span class="num">${rp(inv)}</span><span class="muted">Selisih</span><span class="${sel ? 'diff-bad' : 'diff-ok'} num">${sel ? (sel > 0 ? '+' : '−') + rp(Math.abs(sel)) : 'Cocok'}</span>` : ''}</div>`;
  p.items.forEach((x, i) => { const c = $('#pi-s' + i); if (c) c.textContent = rp(x.qty * x.harga); });
}

function validate(p) {
  if (!p.tglInvoice) return 'Isi tanggal invoice';
  if (!p.noInvoice.trim()) return 'Isi nomor invoice';
  if (!p.supplier.trim()) return 'Isi nama supplier';
  if (!p.items.length) return 'Tambahkan barang yang dibeli';
  if (p.items.some(x => !(+x.qty > 0))) return 'Qty setiap barang minimal 1';
  const dup = S.pembelian.find(x => x.no !== p.no && x.noInvoice.trim().toUpperCase() === p.noInvoice.trim().toUpperCase() && x.supplier.trim().toUpperCase() === p.supplier.trim().toUpperCase());
  if (dup) return `Invoice ${p.noInvoice} dari ${p.supplier} sudah dicatat (${dup.no})`;
  return '';
}

const toDoc = p => { const { _bayarDirty, ...d } = clone(p); return { ...d, noInvoice: d.noInvoice.trim(), supplier: d.supplier.trim(), totalInvoice: +d.totalInvoice || 0, items: d.items.map(x => ({ ...x, qty: +x.qty, harga: +x.harga })), total: totalOf(d.items) }; };

async function saveDraft(silent) {
  if (st.saving) return false;
  const p = st.pbDraft, err = validate(p);
  if (err) { toast(err); return false; }
  st.saving = true;
  try {
    if (!p.no) {
      p.no = await runTransaction(db, async tx => {
        const cs = await tx.get(counterRef());
        const { no, counter } = nextNumber(cs, 'PB');
        tx.set(counterRef(), counter);
        tx.set(doc(db, 'pembelian', no), { ...toDoc({ ...p, no }), cabang: cabAktif(), input: stamp(new Date()), dibuatOleh: namaPetugas() });
        return no;
      });
    } else await setDoc(doc(db, 'pembelian', p.no), toDoc(p), { merge: true });
    if (!silent) { toast('Draft ' + p.no + ' disimpan'); renderList(); renderForm(); }
    return true;
  } catch (e) { toast(errMsg(e)); return false; } finally { st.saving = false; }
}

function preview() {
  const p = st.pbDraft, err = validate(p);
  if (err) { toast(err); return; }
  const t = totalOf(p.items), inv = +p.totalInvoice || 0, sel = inv ? t - inv : 0;
  const rows = p.items.map(x => {
    const cur = part(x.kode) || { stok: 0, beli: 0 }, s0 = Math.max(0, cur.stok), q = +x.qty;
    const avg = s0 + q ? Math.round((s0 * (cur.beli || 0) + q * x.harga) / (s0 + q)) : x.harga;
    return `<tr><td>${esc(x.nama)}<br><span class="small muted mono">${esc(x.kode)}</span></td><td class="r num">${q}</td><td class="r num">${rp(x.harga)}</td><td class="r num">${rp(q * x.harga)}</td><td class="r num">${cur.stok} → <b>${cur.stok + q}</b></td><td class="r num small">${rp(cur.beli || 0)} → ${rp(avg)}</td></tr>`;
  }).join('');
  modal(`<div class="row spread"><h2>Cek sebelum masuk stok</h2><button class="btn sm ghost" type="button" data-close="1" aria-label="Tutup">✕</button></div>
   <div class="note small"><b>${esc(p.supplier)}</b> · Invoice <span class="mono">${esc(p.noInvoice)}</span> · ${fmtTgl(p.tglInvoice)} · ${p.statusBayar === 'Lunas' ? 'Lunas' : 'Belum lunas' + (p.jatuhTempo ? ', jatuh tempo ' + fmtTgl(p.jatuhTempo) : '')}</div>
   <div class="tw"><table><thead><tr><th>Part</th><th class="r">Qty</th><th class="r">Harga</th><th class="r">Subtotal</th><th class="r">Stok</th><th class="r">Harga beli rata-rata</th></tr></thead><tbody>${rows}</tbody></table></div>
   <div class="totals"><span class="muted">Jumlah barang</span><span class="num">${p.items.length} jenis · ${qtyOf(p.items)} pcs</span><span style="font-weight:600">Total pembelian</span><span class="big num">${rp(t)}</span>${inv ? `<span class="muted">Total di invoice</span><span class="num">${rp(inv)}</span><span class="muted">Selisih</span><span class="${sel ? 'diff-bad' : 'diff-ok'} num">${sel ? (sel > 0 ? '+' : '−') + rp(Math.abs(sel)) : 'Cocok'}</span>` : ''}</div>
   ${sel ? '<div class="err">Total tidak sama dengan invoice. Periksa lagi qty dan harga sebelum menerima barang.</div>' : ''}
   <label class="row small" for="pb-cek" style="gap:8px;cursor:pointer"><input type="checkbox" id="pb-cek" style="width:auto">Barang sudah dicek fisik dan sesuai dengan pesanan</label>
   <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Kembali</button><button class="btn pri" type="button" data-act="pb-receive" id="pb-recv" disabled>Masukkan ke stok</button></div>`, 'wide');
}

async function receive() {
  if (st.saving) return;
  if (!$('#pb-cek')?.checked) { toast('Centang dulu bahwa barang sudah dicek'); return; }
  if (!(await saveDraft(true))) return;
  const p = st.pbDraft;
  st.saving = true;
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db, 'pembelian', p.no), ps0 = await tx.get(ref);
      if (ps0.exists() && ps0.data().status === 'Diterima') throw new Error('Pembelian ini sudah masuk stok');
      const refs = p.items.map(x => doc(db, 'parts', x.kode));
      const snaps = await Promise.all(refs.map(r => tx.get(r)));
      snaps.forEach((s, i) => {
        if (!s.exists()) throw new Error('Part ' + p.items[i].kode + ' tidak ada di master');
        // harga beli rata-rata dihitung dari stok semua cabang; stok bertambah di cabang pembelian ini
        const cab = cabangOf(p), cur = s.data(), s0 = Math.max(0, stokTotal(cur)), q = +p.items[i].qty, h = +p.items[i].harga;
        const beli = s0 + q ? Math.round((s0 * (cur.beli || 0) + q * h) / (s0 + q)) : h;
        tx.update(refs[i], { [stokField(cab)]: stokOf(cur, cab) + q, beli });
      });
      tx.update(ref, { status: 'Diterima', tglTerima: stamp(new Date()), diterimaOleh: namaPetugas(), ...(p.statusBayar === 'Lunas' ? { tglBayar: p.tglBayar || dkey(new Date()) } : {}) });
    });
    p.status = 'Diterima';
    closeModal(); toast(`${qtyOf(p.items)} pcs dari ${p.noInvoice} masuk ke stok`); renderPembelian();
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

async function savePay() {
  if (st.saving) return;
  const p = st.pbDraft; st.saving = true;
  try {
    const patch = p.statusBayar === 'Lunas' ? { statusBayar: 'Lunas', tglBayar: p.tglBayar || dkey(new Date()) } : { statusBayar: 'Belum lunas', jatuhTempo: p.jatuhTempo || '' };
    await updateDoc(doc(db, 'pembelian', p.no), patch);
    p._bayarDirty = false; toast('Status bayar ' + p.noInvoice + ': ' + p.statusBayar); renderPembelian();
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

const del = { armed: null };
async function delDraft(el) {
  const p = st.pbDraft;
  if (del.armed !== p.no) { del.armed = p.no; el.textContent = 'Klik lagi untuk hapus'; setTimeout(() => { if (del.armed === p.no) { del.armed = null; el.textContent = 'Hapus draft'; } }, 3000); return; }
  try { await deleteDoc(doc(db, 'pembelian', p.no)); st.pbDraft = blank(); toast('Draft dihapus'); renderPembelian(); } catch (e) { toast(errMsg(e)); }
}

views.pembelian = renderPembelian;
refreshers.pembelian = renderList;
fkeys.pembelian = { baru: 'pb-new', simpan: 'pb-save' };
Object.assign(actions, {
  'pb-new': () => { st.pbDraft = blank(); renderList(); renderForm(); $('#pb-inv')?.focus(); },
  'pb-open': el => { const p = S.pembelian.find(x => x.no === el.dataset.no); if (p) { st.pbDraft = clone(p); renderList(); renderForm(); } },
  'pb-filter': el => { st.pbFilter = el.dataset.f; renderPembelian(); },
  'pb-add': () => {
    const k = pickedKode('pb-pcari'), pt = part(k);
    if (!pt) { toast('Pilih part dari daftar yang muncul saat mengetik'); $('#pb-pcari').focus(); return; }
    const q = Math.max(1, +$('#pb-q').value || 1), h = $('#pb-h').value === '' ? (pt.beli || 0) : Math.max(0, +$('#pb-h').value);
    const ex = st.pbDraft.items.find(x => x.kode === k && x.harga === h);
    ex ? ex.qty += q : st.pbDraft.items.push({ kode: k, nama: pt.nama, qty: q, harga: h });
    $('#pb-pcari').value = ''; $('#pb-q').value = 1; $('#pb-h').value = ''; renderItems(); $('#pb-pcari').focus();
  },
  'pb-rm': el => { st.pbDraft.items.splice(+el.dataset.i, 1); renderItems(); },
  'pb-save': () => saveDraft(),
  'pb-preview': preview,
  'pb-receive': receive,
  'pb-savepay': savePay,
  'pb-del': delDraft,
  'pb-gostok': () => go('stok')
});
inputHandlers.push(e => {
  const t = e.target, p = st.pbDraft; if (!p) return;
  if (t.dataset.pb) { p[t.dataset.pb] = t.value; if (t.id === 'pb-tinv') renderTot(); }
  if (t.dataset.pi != null) { const x = p.items[+t.dataset.pi]; x[t.dataset.pf] = Math.max(0, +t.value || 0); renderTot(); }
});
changeHandlers.push(e => {
  const t = e.target, p = st.pbDraft; if (!p) return;
  if (t.id === 'pb-bayar') { p.statusBayar = t.value; p._bayarDirty = true; renderForm(); }
  if (t.id === 'pb-pcari') { const pt = part(pickedKode('pb-pcari')); if (pt && $('#pb-h') && $('#pb-h').value === '') $('#pb-h').value = pt.beli || 0; }
  if (t.id === 'pb-cek' && $('#pb-recv')) $('#pb-recv').disabled = !t.checked;
});
