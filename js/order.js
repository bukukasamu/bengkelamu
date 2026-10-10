// Menu Order Sparepart: bagian sparepart memilih part untuk motor yang sudah diregistrasi,
// sesuai permintaan mekanik. Stok dipotong saat kasir menerima pembayaran.
import { $, esc, rp, clone, toast, errMsg, modal, stamp, konfirmasi } from './util.js';
import { S, st, part, views, refreshers, actions, inputHandlers, fkeys, partPicker, pickedKode, namaPetugas, idPetugas } from './state.js';
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

// Belum disimpan = beda dengan data di server. Tombol berubah warna: kuning "Simpan order" ↔ hijau "✓ Tersimpan".
const isDirty = w => JSON.stringify(w.parts) !== JSON.stringify(findWo(w.no)?.parts || []) || (w.catatanPart || '') !== (findWo(w.no)?.catatanPart || '');
function tombolSimpan(w) {
  const o = findWo(w.no), dirty = isDirty(w);
  const info = o?.orderTgl ? `Terakhir disimpan ${esc(o.orderTgl)}${o.orderOleh ? ' oleh ' + esc(o.orderOleh) : ''}` : (o?.orderOleh ? 'Disimpan oleh ' + esc(o.orderOleh) : '');
  return `<span class="small ${dirty ? 'diff-bad' : 'muted'}" id="ord-info">${dirty ? 'Ada perubahan yang BELUM disimpan' : info}</span>
    <button class="btn" type="button" data-act="ord-reset" ${dirty ? '' : 'disabled'}>Batalkan perubahan</button>
    <button class="btn ${dirty ? 'warn' : 'ok'}" type="button" data-act="ord-save" id="ord-save">${dirty ? 'Simpan order [F2]' : '✓ Tersimpan'}</button>`;
}
function segarkanStatus() {
  const w = st.orderDraft, b = $('#ord-aksi'); if (!w || !b) return;
  b.innerHTML = tombolSimpan(w);
  const p = $('#ord-pill'); if (p) p.innerHTML = isDirty(w) ? '<span class="pill p-warn">Belum disimpan</span>' : '<span class="pill p-good">Tersimpan</span>';
}

function renderDetail() {
  const w = st.orderDraft, c = woCalc(w);
  $('#ord-detail').innerHTML = `<div class="row spread"><h2>${esc(w.no)}</h2><span id="ord-pill"></span></div>
    ${woHeader({ ...w, catatanPart: '' })}
    <label class="f" for="o-cat">Permintaan mekanik<textarea id="o-cat" placeholder="mis. kampas rem belakang habis, V-belt retak">${esc(w.catatanPart || '')}</textarea></label>
    <h3>Order sparepart</h3>
    ${S.parts.length ? `<div class="row">${partPicker('o-pcari', 'Cari part')}<input id="o-pq" type="number" min="1" value="1" aria-label="Jumlah" style="width:70px"><button class="btn" type="button" data-act="ord-add">Tambah</button></div>` : '<div class="small muted">Belum ada data part. Import di menu Stok Part.</div>'}
    <div id="ord-parts">${partsTable(w, 'ord-rm')}</div>
    <div class="totals"><span class="muted">Total sparepart</span><span class="big num">${rp(c.parts)}</span></div>
    <div class="row" style="justify-content:flex-end" id="ord-aksi"></div>`;
  segarkanStatus();
}

async function save() {
  if (st.saving || !st.orderDraft) return;
  const w = st.orderDraft;
  if (!isDirty(w)) { toast('Order ' + w.no + ' sudah tersimpan, tidak ada perubahan'); return; }
  st.saving = true;
  const b = $('#ord-save'); if (b) { b.disabled = true; b.textContent = 'Menyimpan…'; }
  try {
    const orderTgl = stamp(new Date());
    await updateWo(w.no, { parts: w.parts, catatanPart: w.catatanPart || '', orderOleh: namaPetugas(), orderOlehId: idPetugas(), orderTgl });
    const o = findWo(w.no); if (o) { o.parts = clone(w.parts); o.catatanPart = w.catatanPart; o.orderOleh = namaPetugas(); o.orderTgl = orderTgl; syncPantau(o); }
    renderDetail();
    const c = woCalc(w);
    modal(`<h3>✓ Order sparepart tersimpan</h3>
      <p class="small" style="margin:0"><b>${esc(w.nopol || '')}</b> · ${esc(w.no)} · ${w.parts.length} item · ${rp(c.parts)}<br>Kasir sudah bisa melihat order ini di Pembayaran Servis.</p>
      <div class="row" style="justify-content:flex-end"><button class="btn ok" type="button" data-close="1" data-autofocus>OK</button></div>`, 'konfirmasi');
  } catch (e) { toast('Gagal menyimpan: ' + errMsg(e)); segarkanStatus(); } finally { st.saving = false; }
}

views.order = renderOrder;
refreshers.order = renderList;
fkeys.order = { simpan: 'ord-save' };
Object.assign(actions, {
  'ord-pick': async el => { const o = findWo(el.dataset.no); if (!o) return;
    if (st.orderDraft && st.orderDraft.no !== o.no && isDirty(st.orderDraft) && !(await konfirmasi('Order belum disimpan', `Perubahan order <b>${esc(st.orderDraft.nopol || st.orderDraft.no)}</b> belum disimpan dan akan hilang bila pindah motor.`, { ya: 'Buang perubahan', tidak: 'Kembali', bahaya: true }))) return; st.orderNo = o.no; st.orderDraft = clone({ ...o, parts: o.parts || [] }); renderOrder(); $('#o-pcari')?.focus(); },
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
inputHandlers.push(e => { if (e.target.id === 'o-cat' && st.orderDraft) { st.orderDraft.catatanPart = e.target.value; segarkanStatus(); } });
