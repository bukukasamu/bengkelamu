// Menu Stok Opname: hitung stok fisik per cabang → ajukan → super admin menyetujui (kata sandi + catatan)
// → stok disesuaikan dengan selisihnya dan tercatat di kartu stok.
import { $, esc, rp, stamp, toast, errMsg } from './util.js';
import { S, st, views, refreshers, actions, inputHandlers, changeHandlers, kategoriList, namaPetugas } from './state.js';
import { db, doc, collection, getDocs, getDoc, query, where, addDoc, updateDoc, deleteDoc } from './firebase.js';
import { cabAktif, namaCabang, multiCabang } from './cabang.js';
import { terapkanOpname, mintaCatatan } from './kontrol.js';
import { loaderHTML } from './brand.js';

const OP = st.opn = st.opn || { aktif: null, q: '', kat: '', hanyaHitung: false };
let daftar = [], draf = null, simpanTimer = null;
const STATUS = { draft: ['Draft', 'p-info'], diajukan: ['Menunggu persetujuan', 'p-warn'], disetujui: ['Disetujui', 'p-good'], ditolak: ['Ditolak', 'p-bad'] };
const pill = s => `<span class="pill ${STATUS[s]?.[1] || ''}">${STATUS[s]?.[0] || s}</span>`;
const ringkas = op => { const it = Object.values(op.items || {}).filter(v => v.fisik !== '' && v.fisik != null); const beda = it.filter(v => +v.fisik !== +v.sistem); return { n: it.length, beda: beda.length, nilai: beda.reduce((a, v) => a + (+v.fisik - +v.sistem) * (v.beli || 0), 0) }; };

async function muatDaftar() {
  const s = await getDocs(query(collection(db, 'opname'), where('cabang', '==', cabAktif())));
  daftar = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.tgl).localeCompare(String(a.tgl)));
}

async function renderOpname() {
  $('#view').innerHTML = `<div class="panel">${loaderHTML('Memuat stok opname…')}</div>`;
  try {
    if (OP.aktif) { const s = await getDoc(doc(db, 'opname', OP.aktif)); draf = s.exists() ? { id: s.id, ...s.data() } : null; if (!draf) OP.aktif = null; }
    if (!OP.aktif) await muatDaftar();
  } catch (e) { $('#view').innerHTML = `<div class="panel"><div class="err">${esc(errMsg(e))}</div></div>`; return; }
  if (st.view !== 'opname') return;
  if (OP.aktif) return renderEditor();
  $('#view').innerHTML = `<div class="panel"><div class="row spread"><h3>Stok opname${multiCabang() ? ' · ' + esc(namaCabang(cabAktif())) : ''}</h3><button class="btn pri" type="button" data-act="op-baru">+ Mulai opname</button></div>
    <p class="small muted" style="margin:0">Hitung stok fisik di rak, isi jumlahnya, lalu ajukan. Stok baru berubah setelah disetujui super admin. Penjualan selama penghitungan tetap aman: yang diterapkan adalah selisihnya.</p>
    ${daftar.length ? `<div class="tw"><table><thead><tr><th>No</th><th>Tanggal</th><th>Petugas</th><th class="r">Dihitung</th><th class="r">Berselisih</th><th class="r">Nilai selisih</th><th>Status</th></tr></thead><tbody>${daftar.map(o => { const r = ringkas(o); return `<tr class="row-click" tabindex="0" data-act="op-buka" data-id="${esc(o.id)}"><td class="mono">${esc(o.no || '')}</td><td class="small">${esc(o.tgl)}</td><td class="small">${esc(o.petugas || '')}</td><td class="r num">${r.n}</td><td class="r num">${r.beda}</td><td class="r num">${rp(r.nilai)}</td><td>${pill(o.status)}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">Belum ada stok opname di cabang ini.</div>'}
  </div>`;
}

function renderEditor() {
  const op = draf, bisaUbah = ['draft', 'ditolak'].includes(op.status), r = ringkas(op), sup = st.petugas?.super;
  const kata = OP.q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = S.parts.filter(p => (!OP.kat || p.kategori === OP.kat) && (!OP.hanyaHitung || op.items?.[p.kode]) && (!kata.length || kata.every(w => (p.kode + ' ' + p.nama + ' ' + (p.rak || '')).toLowerCase().includes(w))))
    .sort((a, b) => String(a.rak || '').localeCompare(String(b.rak || '')) || a.kode.localeCompare(b.kode)).slice(0, 300);
  $('#view').innerHTML = `<div class="grid"><div class="panel">
    <div class="row spread"><div><h3 style="margin:0">Stok opname ${esc(op.no || '')}</h3><div class="small muted">${esc(op.tgl)} · ${esc(op.petugas || '')}${multiCabang() ? ' · ' + esc(namaCabang(op.cabang)) : ''}</div></div><span class="row">${pill(op.status)}<button class="btn sm" type="button" data-act="op-kembali">‹ Daftar</button></span></div>
    ${op.catatanSuper ? `<div class="note small">Catatan super admin: ${esc(op.catatanSuper)}</div>` : ''}
    <div class="tiles"><div class="tile"><span class="lbl">Part dihitung</span><span class="val">${r.n}</span></div><div class="tile"><span class="lbl">Berselisih</span><span class="val" style="color:${r.beda ? 'var(--warn)' : 'inherit'}">${r.beda}</span></div><div class="tile"><span class="lbl">Nilai selisih (harga beli)</span><span class="val" style="color:${r.nilai < 0 ? 'var(--bad)' : 'var(--good)'}">${rp(r.nilai)}</span></div></div>
    <div class="row"><input id="op-q" placeholder="Cari kode, nama, atau rak" value="${esc(OP.q)}" style="flex:1 1 220px" aria-label="Cari"><select id="op-kat" style="width:auto"><option value="">Semua kategori</option>${kategoriList().map(k => `<option ${k === OP.kat ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select><label class="chk"><input type="checkbox" id="op-hitung" ${OP.hanyaHitung ? 'checked' : ''}>Hanya yang sudah dihitung</label></div>
    <div class="tw"><table><thead><tr><th>Rak</th><th>Kode</th><th>Nama part</th><th class="r">Stok sistem</th><th class="r">Stok fisik</th><th class="r">Selisih</th></tr></thead><tbody>
     ${list.map(p => { const v = op.items?.[p.kode], sistem = v ? +v.sistem : p.stok, d = v && v.fisik !== '' ? +v.fisik - sistem : null; return `<tr><td class="mono small">${esc(p.rak || '')}</td><td class="mono small">${esc(p.kode)}</td><td>${esc(p.nama)}</td><td class="r num">${sistem}</td><td class="r">${bisaUbah ? `<input class="inline-input num op-fisik" data-k="${esc(p.kode)}" type="number" min="0" value="${v ? esc(v.fisik) : ''}" style="width:80px;text-align:right" aria-label="Fisik ${esc(p.nama)}">` : `<span class="num">${v ? v.fisik : ''}</span>`}</td><td class="r num" id="op-d-${esc(p.kode)}" style="color:${d < 0 ? 'var(--bad)' : d > 0 ? 'var(--good)' : 'inherit'}">${d == null ? '' : d > 0 ? '+' + d : d}</td></tr>`; }).join('') || '<tr><td colspan="6" class="empty">Tidak ada part yang cocok.</td></tr>'}
    </tbody></table></div>
    <div class="row" style="justify-content:flex-end">
     ${bisaUbah ? `<span class="small muted" id="op-simpan-info"></span><button class="btn ghost" type="button" data-act="op-hapus">Hapus draft</button><button class="btn pri" type="button" data-act="op-ajukan">Ajukan ke super admin</button>` : ''}
     ${sup && op.status === 'diajukan' ? '<button class="btn" type="button" data-act="op-tolak">Tolak</button><button class="btn pri" type="button" data-act="op-setujui">Setujui &amp; sesuaikan stok</button>' : ''}
    </div>
  </div></div>`;
}

function simpanNanti() {
  clearTimeout(simpanTimer);
  const info = $('#op-simpan-info'); if (info) info.textContent = 'Menyimpan…';
  simpanTimer = setTimeout(async () => {
    try { await updateDoc(doc(db, 'opname', draf.id), { items: draf.items, diubah: stamp(new Date()) }); const i = $('#op-simpan-info'); if (i) i.textContent = 'Tersimpan ' + stamp(new Date()).slice(11); }
    catch (e) { toast(errMsg(e)); }
  }, 700);
}

views.opname = renderOpname;
refreshers.opname = () => {};
Object.assign(actions, {
  'op-baru': async () => {
    try {
      const no = 'OP-' + stamp(new Date()).slice(2, 10).replace(/-/g, '') + '-' + String(daftar.filter(o => String(o.tgl).startsWith(stamp(new Date()).slice(0, 10))).length + 1).padStart(2, '0');
      const ref = await addDoc(collection(db, 'opname'), { no, cabang: cabAktif(), tgl: stamp(new Date()), status: 'draft', petugas: namaPetugas(), items: {} });
      OP.aktif = ref.id; renderOpname();
    } catch (e) { toast(errMsg(e)); }
  },
  'op-buka': el => { OP.aktif = el.dataset.id; renderOpname(); },
  'op-kembali': () => { OP.aktif = null; draf = null; renderOpname(); },
  'op-ajukan': async () => {
    const r = ringkas(draf); if (!r.n) { toast('Belum ada part yang dihitung'); return; }
    clearTimeout(simpanTimer);
    try { await updateDoc(doc(db, 'opname', draf.id), { items: draf.items, status: 'diajukan', tglAjukan: stamp(new Date()) }); toast('Stok opname diajukan ke super admin'); renderOpname(); } catch (e) { toast(errMsg(e)); }
  },
  'op-hapus': async () => { if (!confirmHapus()) return; try { await deleteDoc(doc(db, 'opname', draf.id)); OP.aktif = null; toast('Draft dihapus'); renderOpname(); } catch (e) { toast(errMsg(e)); } },
  'op-setujui': async () => { if (await terapkanOpname(draf)) renderOpname(); },
  'op-tolak': async () => { const c = await mintaCatatan('Tolak stok opname', 'Petugas bisa memperbaiki lalu mengajukan lagi.'); if (c === null) return; try { await updateDoc(doc(db, 'opname', draf.id), { status: 'ditolak', catatanSuper: c }); toast('Stok opname ditolak'); renderOpname(); } catch (e) { toast(errMsg(e)); } }
});
let armHapus = 0;
const confirmHapus = () => { if (Date.now() - armHapus < 3000) return true; armHapus = Date.now(); toast('Klik Hapus draft sekali lagi untuk menghapus'); return false; };
inputHandlers.push(e => {
  const t = e.target;
  if (t.classList?.contains('op-fisik') && draf) {
    const k = t.dataset.k, p = S.map.get(k), v = t.value;
    draf.items = draf.items || {};
    if (v === '') delete draf.items[k];
    else draf.items[k] = { fisik: +v, sistem: draf.items[k]?.sistem ?? p.stok, nama: p.nama, beli: p.beli || 0 };
    const it = draf.items[k], d = it ? it.fisik - it.sistem : null, el = document.getElementById('op-d-' + k);
    if (el) { el.textContent = d == null ? '' : d > 0 ? '+' + d : d; el.style.color = d < 0 ? 'var(--bad)' : d > 0 ? 'var(--good)' : 'inherit'; }
    simpanNanti();
  }
  if (t.id === 'op-q') { OP.q = t.value; const pos = t.selectionStart; renderEditor(); const n = $('#op-q'); n.focus(); n.setSelectionRange(pos, pos); }
});
changeHandlers.push(e => {
  if (e.target.id === 'op-kat') { OP.kat = e.target.value; renderEditor(); }
  if (e.target.id === 'op-hitung') { OP.hanyaHitung = e.target.checked; renderEditor(); }
});
