// Menu Order Sparepart: bagian sparepart memilih part untuk motor yang sudah diregistrasi,
// sesuai permintaan mekanik. Stok dipotong saat kasir menerima pembayaran.
import { $, esc, rp, clone, toast, errMsg } from './util.js';
import { S, st, part, views, refreshers, actions, inputHandlers, fkeys, partPicker, pickedKode } from './state.js';
import { AKTIF, woCard, woHeader, woCalc, partsTable, updateWo, findWo, dipesan, syncPantau } from './wo-common.js';

function renderList() {
  const el = $('#ord-list'); if (!el) return;
  const l = [...S.wo].reverse().filter(w => AKTIF.includes(w.status));
  el.innerHTML = l.map(o => woCard(o, st.orderNo, 'ord-pick') + (o.parts?.length ? '' : '')).join('') || '<div class="empty">Tidak ada motor yang sedang diservis.</div>';
}

function renderOrder() {
  const w = st.orderDraft;
  $('#view').innerHTML = `<div class="grid g-servis">
   <div class="panel"><h3>Motor di bengkel</h3><div class="wolist" id="ord-list"></div></div>
   <div class="panel" id="ord-detail">${w ? '' : '<div class="empty">Pilih motor di sebelah kiri untuk mengisi order sparepart.</div>'}</div>
  </div>`;
  renderList(); if (w) renderDetail();
}

function renderDetail() {
  const w = st.orderDraft, c = woCalc(w);
  const dirty = JSON.stringify(w.parts) !== JSON.stringify(findWo(w.no)?.parts || []) || (w.catatanPart || '') !== (findWo(w.no)?.catatanPart || '');
  $('#ord-detail').innerHTML = `<div class="row spread"><h2>${esc(w.no)}</h2>${dirty ? '<span class="pill p-warn">Belum disimpan</span>' : ''}</div>
    ${woHeader({ ...w, catatanPart: '' })}
    <label class="f" for="o-cat">Permintaan mekanik<textarea id="o-cat" placeholder="mis. kampas rem belakang habis, V-belt retak">${esc(w.catatanPart || '')}</textarea></label>
    <h3>Order sparepart</h3>
    ${S.parts.length ? `<div class="row">${partPicker('o-pcari', 'Cari part')}<input id="o-pq" type="number" min="1" value="1" aria-label="Jumlah" style="width:70px"><button class="btn" type="button" data-act="ord-add">Tambah</button></div>` : '<div class="small muted">Belum ada data part. Import di menu Stok Part.</div>'}
    <div id="ord-parts">${partsTable(w, 'ord-rm')}</div>
    <div class="totals"><span class="muted">Total sparepart</span><span class="big num">${rp(c.parts)}</span></div>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="ord-reset">Batalkan perubahan</button><button class="btn pri" type="button" data-act="ord-save">Simpan order [F2]</button></div>`;
}

async function save() {
  if (st.saving || !st.orderDraft) return;
  const w = st.orderDraft;
  st.saving = true;
  try {
    await updateWo(w.no, { parts: w.parts, catatanPart: w.catatanPart || '' });
    const o = findWo(w.no); if (o) { o.parts = clone(w.parts); o.catatanPart = w.catatanPart; syncPantau(o); }
    toast('Order sparepart ' + w.no + ' disimpan'); renderDetail();
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

views.order = renderOrder;
refreshers.order = renderList;
fkeys.order = { simpan: 'ord-save' };
Object.assign(actions, {
  'ord-pick': el => { const o = findWo(el.dataset.no); if (!o) return; st.orderNo = o.no; st.orderDraft = clone({ ...o, parts: o.parts || [] }); renderOrder(); $('#o-pcari')?.focus(); },
  'ord-add': () => {
    const k = pickedKode('o-pcari'), p = part(k);
    if (!p) { toast('Pilih part dari daftar yang muncul saat mengetik'); $('#o-pcari').focus(); return; }
    const q = Math.max(1, +$('#o-pq').value || 1), ex = st.orderDraft.parts.find(x => x.kode === k), tot = (ex ? ex.qty : 0) + q;
    const sisa = p.stok - dipesan(k, st.orderDraft.no);   // dikurangi order servis lain yang belum dibayar
    if (tot > sisa) { toast(`Stok ${p.nama} ${p.stok}` + (p.stok !== sisa ? `, ${p.stok - sisa} sudah dipesan servis lain` : '') + `. Bisa diorder: ${Math.max(0, sisa)}`); return; }
    ex ? ex.qty = tot : st.orderDraft.parts.push({ kode: k, qty: q });
    renderDetail(); $('#o-pcari').focus();
  },
  'ord-rm': el => { st.orderDraft.parts.splice(+el.dataset.i, 1); renderDetail(); },
  'ord-reset': () => { const o = findWo(st.orderNo); if (o) { st.orderDraft = clone({ ...o, parts: o.parts || [] }); renderDetail(); } },
  'ord-save': save
});
inputHandlers.push(e => { if (e.target.id === 'o-cat' && st.orderDraft) st.orderDraft.catatanPart = e.target.value; });
