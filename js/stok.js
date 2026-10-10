// Menu Stok Part: daftar part, tambah/ubah part, import/export Excel. Barang masuk lewat menu Pembelian Stok.
import { $, esc, rp, toast, errMsg } from './util.js';
import { S, st, part, kategoriList, views, refreshers, actions, inputHandlers, changeHandlers, fkeys, go } from './state.js';
import { db, doc, setDoc, updateDoc, runTransaction, collection, getDocs, query, orderBy, limit, addDoc, where, writeBatch } from './firebase.js';
import { modal, closeModal, stamp, dkey } from './util.js';
import { partPicker, pickedKode, namaPetugas, isRole, filterBuka, tombolFilter } from './state.js';
import { CABANG_UTAMA, cabAktif, cabangList, namaCabang, multiCabang, stokOf, stokField } from './cabang.js';
import { catatMutasi, dataMutasi } from './kontrol.js';

const MAX_ROWS = 200; // tabel dibatasi supaya tetap ringan dengan ribuan part

function renderStok() {
  $('#view').innerHTML = `<div class="grid">
   <div class="panel"><div class="row spread"><h3>Stok sparepart${multiCabang() ? ' · ' + esc(namaCabang(cabAktif())) : ''}</h3>
     <div class="row">${st.petugas?.super ? '<button class="btn" type="button" data-act="import-open">Import Excel</button>' : ''}<button class="btn" type="button" data-act="export-xlsx">Export Excel</button><button class="btn" type="button" data-act="go-pembelian">Pembelian stok</button><button class="btn" type="button" data-act="go-opname">Stok opname</button>${multiCabang() ? '<button class="btn" type="button" data-act="tf-open">Transfer stok</button>' : ''}<button class="btn pri" type="button" data-act="part-new">+ Part baru [F1]</button></div></div>
    <div class="row"><input id="s-q" placeholder="Cari kode, nama, tipe motor" value="${esc(st.stokQ)}" style="flex:1 1 220px" aria-label="Cari part">${tombolFilter('stok', (st.stokKat ? 1 : 0) + (st.stokLow ? 1 : 0))}</div>
    ${filterBuka('stok') ? `<div class="filter-box row"><select id="s-kat" style="width:auto;max-width:100%" aria-label="Kategori"><option value="">Semua kategori</option>${kategoriList().map(k => `<option ${k === st.stokKat ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select><label class="row small" for="s-low" style="gap:6px;cursor:pointer"><input type="checkbox" id="s-low" style="width:auto" ${st.stokLow ? 'checked' : ''}>Hanya stok menipis</label></div>` : ''}
    <div id="tf-masuk"></div>
    <div id="s-panel"></div>
    <div id="s-tbl"></div>
   </div></div>`;
  renderSPanel(); renderSTbl(); muatTransferMasuk();
}

function renderSTbl() {
  if (!$('#s-tbl')) return;
  if (!S.parts.length) { $('#s-tbl').innerHTML = '<div class="empty">Belum ada part. ' + (st.petugas?.super ? '<button class="btn sm" type="button" data-act="import-open">Import dari Excel</button> atau ' : '') + '<button class="btn sm" type="button" data-act="seed">isi 20 part contoh</button></div>'; return; }
  const words = st.stokQ.toLowerCase().split(/\s+/).filter(Boolean);
  const r = S.parts.filter(p => {
    if (st.stokKat && p.kategori !== st.stokKat) return false;
    if (st.stokLow && !(p.min > 0 && p.stok <= p.min)) return false;
    if (!words.length) return true;
    const s = (p.kode + ' ' + p.nama + ' ' + (p.cocok || '') + ' ' + (p.pengganti || '')).toLowerCase();
    return words.every(w => s.includes(w));
  });
  const nilai = r.reduce((a, p) => a + p.stok * (p.beli || 0), 0), multi = multiCabang();
  // Nilai stok dalam rupiah (stok cabang ini; mengikuti pencarian/filter bila aktif)
  const ada = r.filter(p => p.stok > 0), jual = ada.reduce((a, p) => a + p.stok * (p.jual || 0), 0), pcs = ada.reduce((a, p) => a + p.stok, 0);
  const laba = jual - nilai, saring = !!(words.length || st.stokKat || st.stokLow);
  const tiles = `<div class="tiles" style="margin-bottom:8px"><div class="tile"><span class="lbl">Stok${saring ? ' (sesuai filter)' : ''}</span><span class="val">${pcs.toLocaleString('id-ID')} pcs</span><span class="sub">${ada.length.toLocaleString('id-ID')} jenis part</span></div>
    <div class="tile"><span class="lbl">Nilai harga beli</span><span class="val">${rp(nilai)}</span><span class="sub">modal yang tertanam</span></div>
    <div class="tile"><span class="lbl">Nilai harga jual</span><span class="val">${rp(jual)}</span><span class="sub">bila semua terjual</span></div>
    <div class="tile"><span class="lbl">Proyeksi laba</span><span class="val" style="color:${laba < 0 ? 'var(--bad)' : 'var(--good)'}">${rp(laba)}</span><span class="sub">margin ${jual ? Math.round(laba / jual * 100) : 0}%</span></div></div>`;
  const shown = r.slice(0, MAX_ROWS);
  $('#s-tbl').innerHTML = tiles + `<div class="tw"><table><thead><tr><th>Kode</th><th>Nama part</th><th>Kategori</th><th>Rak</th><th class="r">Harga beli</th><th class="r">Harga jual</th><th class="r">Stok</th>${multi ? '<th class="r" title="Jumlah stok di cabang lain">Cabang lain</th>' : ''}</tr></thead><tbody>${shown.map(p => `<tr class="row-click" tabindex="0" data-act="part-edit" data-k="${esc(p.kode)}"><td class="mono">${esc(p.kode)}${p.abc ? ` <span class="small muted">${esc(p.abc)}</span>` : ''}</td><td>${esc(p.nama)}${p.pengganti ? `<br><span class="small muted">Pengganti: <span class="mono">${esc(p.pengganti)}</span></span>` : ''}${p.cocok ? `<br><span class="small muted">${esc(p.cocok)}</span>` : ''}</td><td class="small">${esc(p.kategori)}</td><td class="mono">${esc(p.rak || '')}</td><td class="r num">${rp(p.beli)}</td><td class="r num">${rp(p.jual)}</td><td class="r"><span class="pill ${p.stok <= 0 ? 'p-bad' : p.min > 0 && p.stok <= p.min ? 'p-warn' : 'p-good'}">${p.stok}</span></td>${multi ? `<td class="r num muted">${(p.stokSemua || 0) - p.stok || '–'}</td>` : ''}</tr>`).join('') || '<tr><td colspan="8" class="empty">Tidak ada part yang cocok.</td></tr>'}</tbody></table></div>
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
   <label class="f" for="p-stok">Stok${multiCabang() ? ' di ' + esc(namaCabang(cabAktif())) : ''}<input id="p-stok" type="number" min="0" class="num" value="${p.stok || 0}" ${pe.mode === 'edit' ? 'readonly title="Ubah stok lewat Stok opname, Pembelian, atau Transfer supaya tercatat di kartu stok"' : ''}></label>
   <label class="f" for="p-min">Stok minimum<input id="p-min" type="number" min="0" class="num" value="${p.min || 0}"></label>
  </div><div class="row" style="justify-content:flex-end">${pe.mode === 'edit' ? `<button class="btn ghost" type="button" data-act="kartu-stok" data-k="${esc(p.kode)}">Kartu stok</button><span class="small muted" style="margin-right:auto">Stok diubah lewat Stok opname / Pembelian / Transfer</span>` : ''}<button class="btn" type="button" data-act="panel-close">Batal</button><button class="btn pri" type="button" data-act="part-save">Simpan part [F2]</button></div></div>`;
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
    if (pe.mode === 'new') {
      const b = writeBatch(db);
      b.set(doc(db, 'parts', d.kode), cab === CABANG_UTAMA ? d : { ...dasar, stok: 0, stokC: { [cab]: stok } });
      if (stok) catatMutasi(b, dataMutasi(cab, d.kode, d.nama, stok, 'awal', d.kode));
      await b.commit();
    } else { const { kode, ...rest } = dasar; await updateDoc(doc(db, 'parts', kode), rest); }   // stok tidak diubah dari sini
    st.partEdit = null; toast('Part ' + d.kode + ' disimpan'); renderSPanel();
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

/* ---------- Transfer stok antar cabang (dua langkah) ----------
   1. Cabang asal mengirim: stok asal langsung berkurang, transfer berstatus "dikirim".
   2. Cabang tujuan menerima (cek fisik): stok tujuan bertambah, status "diterima". Semua tercatat di kartu stok. */
let tfBaris = [];
async function tfOpen() {
  const tujuan = cabangList().filter(c => c.id !== cabAktif());
  if (!tujuan.length) { toast('Belum ada cabang lain. Tambahkan di Master Data → Cabang.'); return; }
  tfBaris = [];
  modal(`<h2>Kirim stok ke cabang lain</h2>
    <p class="small muted" style="margin:0">Dari <b>${esc(namaCabang(cabAktif()))}</b>. Stok cabang ini langsung berkurang; cabang tujuan menambah stok saat menekan <b>Terima</b>.</p>
    <div class="form" style="grid-template-columns:minmax(0,1fr) 90px auto;align-items:end">${partPicker('tf-part', 'Part')}<label class="f" for="tf-qty">Jumlah<input id="tf-qty" type="number" min="1" value="1" class="num"></label><button class="btn" type="button" data-act="tf-tambah">+ Tambah</button></div>
    <div id="tf-list" class="small muted">Belum ada part.</div>
    <div class="form"><label class="f" for="tf-ke">Ke cabang<select id="tf-ke">${tujuan.map(c => `<option value="${esc(c.id)}">${esc(c.nama)}</option>`).join('')}</select></label>
     <label class="f wide-2" for="tf-cat">Catatan<input id="tf-cat" placeholder="mis. dibawa oleh ..." autocomplete="off"></label></div>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Tutup</button><button class="btn pri" type="button" data-act="tf-run">Kirim</button></div>
    <h3>Riwayat transfer cabang ini</h3><div id="tf-riw" class="small muted">Memuat…</div>`, 'wide');
  try {
    const [a, b] = await Promise.all([getDocs(query(collection(db, 'transfer'), where('dari', '==', cabAktif()))), getDocs(query(collection(db, 'transfer'), where('ke', '==', cabAktif())))]);
    const l = [...a.docs, ...b.docs].map(d => d.data()).sort((x, y) => y.tgl.localeCompare(x.tgl)).slice(0, 15);
    const el = document.getElementById('tf-riw'); if (!el) return;
    el.innerHTML = l.length ? `<div class="tw"><table><thead><tr><th>Tanggal</th><th>Part</th><th>Dari → Ke</th><th>Status</th></tr></thead><tbody>${l.map(t => `<tr><td class="small">${esc(t.tgl)}</td><td class="small">${(t.items || [{ nama: t.nama, qty: t.qty }]).map(x => esc(x.nama) + ' ×' + x.qty).join(', ')}</td><td class="small">${esc(namaCabang(t.dari))} → ${esc(namaCabang(t.ke))}</td><td>${t.status === 'diterima' || !t.status ? `<span class="pill p-good">Diterima</span>${t.penerima ? `<div class="small muted">${esc(t.penerima)}</div>` : ''}` : '<span class="pill p-warn">Dikirim</span>'}</td></tr>`).join('')}</tbody></table></div>` : 'Belum ada transfer.';
  } catch (e) { const el = document.getElementById('tf-riw'); if (el) el.textContent = 'Riwayat tidak bisa dimuat: ' + errMsg(e); }
}
function tfTambah() {
  const kode = pickedKode('tf-part'), qty = +$('#tf-qty').value || 0, p = part(kode);
  if (!p) { toast('Pilih part dari daftar'); return; }
  if (qty < 1) { toast('Isi jumlah'); return; }
  const ada = tfBaris.find(x => x.kode === kode), total = (ada?.qty || 0) + qty;
  if (total > p.stok) { toast(`Stok ${p.nama} di cabang ini ${p.stok}`); return; }
  if (ada) ada.qty = total; else tfBaris.push({ kode, nama: p.nama, qty });
  $('#tf-part').value = ''; $('#tf-qty').value = 1;
  tfList();
}
const tfList = () => { $('#tf-list').innerHTML = tfBaris.length ? `<div class="tw"><table><tbody>${tfBaris.map((x, i) => `<tr><td>${esc(x.nama)} <span class="small muted mono">${esc(x.kode)}</span></td><td class="r num">${x.qty}</td><td class="r"><button class="btn sm ghost" type="button" data-act="tf-hapus" data-i="${i}" aria-label="Hapus">✕</button></td></tr>`).join('')}</tbody></table></div>` : 'Belum ada part.'; };
async function tfRun() {
  if (st.saving) return;
  if (!tfBaris.length) { if (pickedKode('tf-part')) tfTambah(); if (!tfBaris.length) { toast('Tambahkan part yang dikirim'); return; } }
  const ke = $('#tf-ke').value, dari = cabAktif(), catatan = ($('#tf-cat').value || '').trim();
  st.saving = true;
  try {
    const no = await runTransaction(db, async tx => {
      const refs = tfBaris.map(x => doc(db, 'parts', x.kode)), snaps = await Promise.all(refs.map(r => tx.get(r)));
      snaps.forEach((s, i) => { if (!s.exists()) throw new Error('Part ' + tfBaris[i].kode + ' tidak ditemukan'); const ada = stokOf(s.data(), dari); if (ada < tfBaris[i].qty) throw new Error(`Stok ${s.data().nama} di ${namaCabang(dari)} tinggal ${ada}`); });
      const ref = doc(collection(db, 'transfer')), id = 'TF-' + dkey(new Date()).slice(2).replace(/-/g, '') + '-' + ref.id.slice(-4).toUpperCase();
      snaps.forEach((s, i) => { tx.update(refs[i], { [stokField(dari)]: stokOf(s.data(), dari) - tfBaris[i].qty }); catatMutasi(tx, dataMutasi(dari, tfBaris[i].kode, tfBaris[i].nama, -tfBaris[i].qty, 'transfer-keluar', id, 'ke ' + namaCabang(ke))); });
      tx.set(ref, { no: id, tgl: stamp(new Date()), dari, ke, items: tfBaris, catatan, status: 'dikirim', pengirim: namaPetugas() });
      return id;
    });
    toast(`Transfer ${no} dikirim ke ${namaCabang(ke)}. Stok bertambah setelah diterima di sana.`); closeModal(); tfBaris = [];
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}
// Transfer yang menunggu diterima di cabang ini
let tfMasuk = [];
async function muatTransferMasuk() {
  if (!multiCabang()) return;
  try {
    const s = await getDocs(query(collection(db, 'transfer'), where('ke', '==', cabAktif()), where('status', '==', 'dikirim')));
    tfMasuk = s.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { tfMasuk = []; }
  const el = $('#tf-masuk'); if (!el) return;
  el.innerHTML = tfMasuk.length ? `<div class="note"><b>Transfer masuk menunggu diterima (${tfMasuk.length})</b>${tfMasuk.map((t, i) => `<div class="row spread" style="margin-top:6px"><span class="small"><span class="mono">${esc(t.no)}</span> dari ${esc(namaCabang(t.dari))} · ${t.items.map(x => esc(x.nama) + ' ×' + x.qty).join(', ')}${t.catatan ? ' · ' + esc(t.catatan) : ''}</span><button class="btn sm pri" type="button" data-act="tf-terima" data-i="${i}">Terima</button></div>`).join('')}</div>` : '';
}
async function tfTerima(el) {
  const t = tfMasuk[+el.dataset.i]; if (!t || st.saving) return;
  st.saving = true;
  try {
    await runTransaction(db, async tx => {
      const ts = await tx.get(doc(db, 'transfer', t.id)); if (ts.data().status !== 'dikirim') throw new Error('Transfer ini sudah diterima');
      const refs = t.items.map(x => doc(db, 'parts', x.kode)), snaps = await Promise.all(refs.map(r => tx.get(r)));
      snaps.forEach((s, i) => { tx.update(refs[i], { [stokField(t.ke)]: stokOf(s.data(), t.ke) + t.items[i].qty }); catatMutasi(tx, dataMutasi(t.ke, t.items[i].kode, t.items[i].nama, t.items[i].qty, 'transfer-masuk', t.no, 'dari ' + namaCabang(t.dari))); });
      tx.update(doc(db, 'transfer', t.id), { status: 'diterima', penerima: namaPetugas(), tglTerima: stamp(new Date()) });
    });
    toast('Transfer ' + t.no + ' diterima, stok bertambah'); muatTransferMasuk();
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
  'tf-run': tfRun,
  'tf-tambah': tfTambah,
  'tf-hapus': el => { tfBaris.splice(+el.dataset.i, 1); tfList(); },
  'tf-terima': tfTerima,
  'go-opname': () => go('opname')
});
inputHandlers.push(e => { if (e.target.id === 's-q') { st.stokQ = e.target.value; renderSTbl(); } });
changeHandlers.push(e => {
  const t = e.target;
  if (t.id === 's-kat') { st.stokKat = t.value; renderSTbl(); }
  if (t.id === 's-low') { st.stokLow = t.checked; renderSTbl(); }
});
