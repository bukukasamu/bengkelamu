// Menu Stok Part: daftar part, tambah/ubah part, import/export Excel. Barang masuk lewat menu Pembelian Stok.
import { $, esc, rp, toast, errMsg } from './util.js';
import { S, st, part, kategoriList, views, refreshers, actions, inputHandlers, changeHandlers, fkeys, go } from './state.js';
import { db, doc, setDoc, updateDoc, runTransaction, collection, getDocs, query, orderBy, limit, addDoc } from './firebase.js';
import { modal, closeModal, stamp } from './util.js';
import { partPicker, pickedKode, namaPetugas, isRole } from './state.js';
import { CABANG_UTAMA, cabAktif, cabangList, namaCabang, multiCabang, stokOf, stokField } from './cabang.js';

const MAX_ROWS = 200; // tabel dibatasi supaya tetap ringan dengan ribuan part

function renderStok() {
  $('#view').innerHTML = `<div class="grid">
   <div class="panel"><div class="row spread"><h3>Stok sparepart${multiCabang() ? ' · ' + esc(namaCabang(cabAktif())) : ''}</h3>
     <div class="row"><button class="btn" type="button" data-act="import-open">Import Excel</button><button class="btn" type="button" data-act="export-xlsx">Export Excel</button><button class="btn" type="button" data-act="go-pembelian">Pembelian stok</button>${multiCabang() ? '<button class="btn" type="button" data-act="tf-open">Transfer stok</button>' : ''}<button class="btn pri" type="button" data-act="part-new">+ Part baru [F1]</button></div></div>
    <div class="row"><input id="s-q" placeholder="Cari kode, nama, tipe motor" value="${esc(st.stokQ)}" style="flex:1 1 220px" aria-label="Cari part"><select id="s-kat" style="width:auto;max-width:100%" aria-label="Kategori"><option value="">Semua kategori</option>${kategoriList().map(k => `<option ${k === st.stokKat ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select><label class="row small" for="s-low" style="gap:6px;cursor:pointer"><input type="checkbox" id="s-low" style="width:auto" ${st.stokLow ? 'checked' : ''}>Hanya stok menipis</label></div>
    <div id="s-panel"></div>
    <div id="s-tbl"></div>
   </div></div>`;
  renderSPanel(); renderSTbl();
}

function renderSTbl() {
  if (!$('#s-tbl')) return;
  if (!S.parts.length) { $('#s-tbl').innerHTML = '<div class="empty">Belum ada part. <button class="btn sm" type="button" data-act="import-open">Import dari Excel</button> atau <button class="btn sm" type="button" data-act="seed">isi 20 part contoh</button></div>'; return; }
  const words = st.stokQ.toLowerCase().split(/\s+/).filter(Boolean);
  const r = S.parts.filter(p => {
    if (st.stokKat && p.kategori !== st.stokKat) return false;
    if (st.stokLow && !(p.min > 0 && p.stok <= p.min)) return false;
    if (!words.length) return true;
    const s = (p.kode + ' ' + p.nama + ' ' + (p.cocok || '') + ' ' + (p.pengganti || '')).toLowerCase();
    return words.every(w => s.includes(w));
  });
  const nilai = r.reduce((a, p) => a + p.stok * (p.beli || 0), 0), multi = multiCabang();
  const shown = r.slice(0, MAX_ROWS);
  $('#s-tbl').innerHTML = `<div class="tw"><table><thead><tr><th>Kode</th><th>Nama part</th><th>Kategori</th><th>Rak</th><th class="r">Harga beli</th><th class="r">Harga jual</th><th class="r">Stok</th>${multi ? '<th class="r" title="Jumlah stok di cabang lain">Cabang lain</th>' : ''}</tr></thead><tbody>${shown.map(p => `<tr class="row-click" tabindex="0" data-act="part-edit" data-k="${esc(p.kode)}"><td class="mono">${esc(p.kode)}${p.abc ? ` <span class="small muted">${esc(p.abc)}</span>` : ''}</td><td>${esc(p.nama)}${p.pengganti ? `<br><span class="small muted">Pengganti: <span class="mono">${esc(p.pengganti)}</span></span>` : ''}${p.cocok ? `<br><span class="small muted">${esc(p.cocok)}</span>` : ''}</td><td class="small">${esc(p.kategori)}</td><td class="mono">${esc(p.rak || '')}</td><td class="r num">${rp(p.beli)}</td><td class="r num">${rp(p.jual)}</td><td class="r"><span class="pill ${p.stok <= 0 ? 'p-bad' : p.min > 0 && p.stok <= p.min ? 'p-warn' : 'p-good'}">${p.stok}</span></td>${multi ? `<td class="r num muted">${(p.stokSemua || 0) - p.stok || '–'}</td>` : ''}</tr>`).join('') || '<tr><td colspan="8" class="empty">Tidak ada part yang cocok.</td></tr>'}</tbody></table></div>
   <p class="small muted" style="margin:0">${r.length.toLocaleString('id-ID')} part${r.length > MAX_ROWS ? ` (ditampilkan ${MAX_ROWS} pertama, persempit pencarian)` : ''} · nilai stok (harga beli) ${rp(nilai)} · klik baris untuk ubah</p>`;
}

function renderSPanel() {
  const el = $('#s-panel'); if (!el) return;
  const pe = st.partEdit;
  if (!pe) { el.innerHTML = ''; return; }
  const p = pe.data;
  el.innerHTML = `<div class="panel" style="background:var(--panel-2);box-shadow:none"><h3>${pe.mode === 'new' ? 'Part baru' : 'Ubah part ' + esc(p.kode)}</h3><div class="form">
   <label class="f" for="p-kode">Kode / barcode<input id="p-kode" class="mono" value="${esc(p.kode)}" ${pe.mode === 'edit' ? 'disabled' : ''}></label>
   <label class="f wide" for="p-nama">Nama part<input id="p-nama" value="${esc(p.nama)}"></label>
   <label class="f" for="p-kat">Kategori<input id="p-kat" list="dl-kat" value="${esc(p.kategori)}"><datalist id="dl-kat">${kategoriList().map(k => `<option value="${esc(k)}">`).join('')}</datalist></label>
   <label class="f" for="p-cocok">Cocok untuk<input id="p-cocok" value="${esc(p.cocok || '')}" placeholder="mis. NMAX, Aerox"></label>
   <label class="f" for="p-rak">Rak<input id="p-rak" class="mono" value="${esc(p.rak || '')}"></label>
   <label class="f" for="p-beli">Harga beli<input id="p-beli" type="number" min="0" class="num" value="${p.beli || 0}"></label>
   <label class="f" for="p-jual">Harga jual<input id="p-jual" type="number" min="0" class="num" value="${p.jual || 0}"></label>
   <label class="f" for="p-stok">Stok${multiCabang() ? ' di ' + esc(namaCabang(cabAktif())) : ''}<input id="p-stok" type="number" min="0" class="num" value="${p.stok || 0}"></label>
   <label class="f" for="p-min">Stok minimum<input id="p-min" type="number" min="0" class="num" value="${p.min || 0}"></label>
  </div><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="panel-close">Batal</button><button class="btn pri" type="button" data-act="part-save">Simpan part [F2]</button></div></div>`;
}

async function partSave() {
  if (st.saving) return;
  const pe = st.partEdit, v = id => $(id).value.trim();
  const d = { kode: pe.mode === 'new' ? v('#p-kode').toUpperCase() : pe.data.kode, nama: v('#p-nama'), kategori: v('#p-kat'), cocok: v('#p-cocok'), rak: v('#p-rak').toUpperCase(), beli: +v('#p-beli') || 0, jual: +v('#p-jual') || 0, stok: +v('#p-stok') || 0, min: +v('#p-min') || 0 };
  if (!d.kode || !d.nama) { toast('Kode dan nama part wajib diisi'); return; }
  if (!/^[A-Z0-9._-]+$/.test(d.kode)) { toast('Kode hanya boleh huruf, angka, titik, minus dan garis bawah'); return; }
  if (pe.mode === 'new' && part(d.kode)) { toast('Kode ' + d.kode + ' sudah dipakai'); return; }
  st.saving = true;
  try {
    // Stok yang diisi = stok cabang yang sedang dibuka
    const cab = cabAktif(), { stok, ...dasar } = d;
    if (pe.mode === 'new') await setDoc(doc(db, 'parts', d.kode), cab === CABANG_UTAMA ? d : { ...dasar, stok: 0, stokC: { [cab]: stok } });
    else { const { kode, ...rest } = dasar; await updateDoc(doc(db, 'parts', kode), { ...rest, [stokField(cab)]: stok }); }
    st.partEdit = null; toast('Part ' + d.kode + ' disimpan'); renderSPanel();
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

/* ---------- Transfer stok antar cabang ----------
   Stok dipindah langsung dari cabang yang sedang dibuka ke cabang tujuan, dicatat di koleksi "transfer". */
async function tfOpen() {
  const tujuan = cabangList().filter(c => c.id !== cabAktif());
  if (!tujuan.length) { toast('Belum ada cabang lain. Tambahkan di Master Data → Cabang.'); return; }
  modal(`<h2>Transfer stok</h2>
    <p class="small muted" style="margin:0">Dari <b>${esc(namaCabang(cabAktif()))}</b> ke cabang lain. Stok langsung berpindah.</p>
    <div class="form" style="grid-template-columns:minmax(0,1fr)">
     ${partPicker('tf-part', 'Part')}
     <label class="f" for="tf-qty">Jumlah<input id="tf-qty" type="number" min="1" value="1" class="num"></label>
     <label class="f" for="tf-ke">Ke cabang<select id="tf-ke">${tujuan.map(c => `<option value="${esc(c.id)}">${esc(c.nama)}</option>`).join('')}</select></label>
     <label class="f" for="tf-cat">Catatan<input id="tf-cat" placeholder="mis. dibawa oleh ..." autocomplete="off"></label>
    </div>
    <div id="tf-info" class="small muted"></div>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Tutup</button><button class="btn pri" type="button" data-act="tf-run">Transfer</button></div>
    <h3>Riwayat transfer</h3><div id="tf-riw" class="small muted">Memuat…</div>`, 'wide');
  try {
    const s = await getDocs(query(collection(db, 'transfer'), orderBy('tgl', 'desc'), limit(30)));
    const l = s.docs.map(d => d.data()).filter(t => t.dari === cabAktif() || t.ke === cabAktif()).slice(0, 15);
    const el = document.getElementById('tf-riw'); if (!el) return;
    el.innerHTML = l.length ? `<div class="tw"><table><thead><tr><th>Tanggal</th><th>Part</th><th class="r">Qty</th><th>Dari → Ke</th><th>Petugas</th></tr></thead><tbody>${l.map(t => `<tr><td class="small">${esc(t.tgl)}</td><td>${esc(t.nama)}<br><span class="small muted mono">${esc(t.kode)}</span></td><td class="r num">${t.qty}</td><td class="small">${esc(namaCabang(t.dari))} → ${esc(namaCabang(t.ke))}</td><td class="small">${esc(t.petugas || '')}</td></tr>`).join('')}</tbody></table></div>` : 'Belum ada transfer.';
  } catch (e) { const el = document.getElementById('tf-riw'); if (el) el.textContent = 'Riwayat tidak bisa dimuat: ' + errMsg(e); }
}
async function tfRun() {
  if (st.saving) return;
  const kode = pickedKode('tf-part'), qty = +$('#tf-qty').value || 0, ke = $('#tf-ke').value, dari = cabAktif(), p0 = part(kode);
  if (!p0) { toast('Pilih part dari daftar'); $('#tf-part').focus(); return; }
  if (qty < 1) { toast('Isi jumlah'); return; }
  st.saving = true;
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db, 'parts', kode), s = await tx.get(ref);
      if (!s.exists()) throw new Error('Part tidak ditemukan');
      const d = s.data(), ada = stokOf(d, dari);
      if (ada < qty) throw new Error(`Stok ${d.nama} di ${namaCabang(dari)} tinggal ${ada}`);
      tx.update(ref, { [stokField(dari)]: ada - qty, [stokField(ke)]: stokOf(d, ke) + qty });
      tx.set(doc(collection(db, 'transfer')), { tgl: stamp(new Date()), dari, ke, kode, nama: d.nama, qty, catatan: ($('#tf-cat').value || '').trim(), petugas: namaPetugas() });
    });
    toast(`${qty} × ${p0.nama} dikirim ke ${namaCabang(ke)}`); closeModal();
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

views.stok = renderStok;
refreshers.stok = renderSTbl;
fkeys.stok = { baru: 'part-new', simpan: () => st.partEdit ? 'part-save' : null };
Object.assign(actions, {
  'part-new': () => { st.partEdit = { mode: 'new', data: { kode: '', nama: '', kategori: '', cocok: '', rak: '', beli: 0, jual: 0, stok: 0, min: 0 } }; renderSPanel(); $('#p-kode').focus(); },
  'part-edit': el => { st.partEdit = { mode: 'edit', data: { ...part(el.dataset.k) } }; renderSPanel(); $('#s-panel').scrollIntoView({ block: 'nearest' }); $('#p-nama').focus(); },
  'go-pembelian': () => go('pembelian'),
  'panel-close': () => { st.partEdit = null; renderSPanel(); },
  'part-save': partSave,
  'tf-open': tfOpen,
  'tf-run': tfRun
});
inputHandlers.push(e => { if (e.target.id === 's-q') { st.stokQ = e.target.value; renderSTbl(); } });
changeHandlers.push(e => {
  const t = e.target;
  if (t.id === 's-kat') { st.stokKat = t.value; renderSTbl(); }
  if (t.id === 's-low') { st.stokLow = t.checked; renderSTbl(); }
});
