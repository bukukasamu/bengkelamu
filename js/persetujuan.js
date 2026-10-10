// Menu Persetujuan. Super admin: pembatalan nota, stok opname, dan layar absen.
// Admin (pemilik/kepala cabang): hanya permintaan aktivasi layar absen.
import { $, esc, rp, stamp, toast, errMsg, konfirmasi } from './util.js';
import { st, views, refreshers, actions, go, namaPetugas } from './state.js';
import { db, collection, doc, query, where, onSnapshot, setDoc } from './firebase.js';
import { namaCabang, multiCabang } from './cabang.js';
import { setujuiBatal, tolakBatal } from './kontrol.js';
import { showNota } from './nota.js';

let batal = [], opname = [], layar = [], layarSemua = [];
export function segarkanBadge() {
  const n = batal.length + opname.length + layar.length, el = document.querySelector('.sb-link[data-view="persetujuan"]');
  if (el) el.innerHTML = 'Persetujuan' + (n ? ` <span class="sb-badge">${n}</span>` : '');
}
export function pantauPersetujuan(unsubs) {
  if (!st.petugas?.super && st.role !== 'admin') return;
  const badge = () => { segarkanBadge(); if (st.view === 'persetujuan') renderPersetujuan(); };
  unsubs.push(onSnapshot(collection(db, 'layarAbsen'), s => { layarSemua = s.docs.map(d => ({ id: d.id, ...d.data() })); layar = layarSemua.filter(l => l.status === 'menunggu'); badge(); }, () => {}));
  if (!st.petugas?.super) return;
  unsubs.push(onSnapshot(query(collection(db, 'trx'), where('batal.status', '==', 'diminta')), s => { batal = s.docs.map(d => d.data()); badge(); }, () => {}));
  unsubs.push(onSnapshot(query(collection(db, 'opname'), where('status', '==', 'diajukan')), s => { opname = s.docs.map(d => ({ id: d.id, ...d.data() })); badge(); }, () => {}));
}

const waktuMinta = l => l.tglMinta?.toDate ? l.tglMinta.toDate().toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : (typeof l.tglMinta === 'string' ? l.tglMinta : '');
const layarHTML = () => `<div class="panel"><h3>Aktivasi layar QR absen (${layar.length})</h3>
    <p class="small muted" style="margin:0">Setujui hanya bila <b>kode di layar perangkat cabang sama</b> dengan kode di bawah. Satu cabang hanya punya satu layar. Untuk ganti perangkat (rusak/hilang), super admin mencabut layar lama dulu, lalu perangkat baru membuka halaman absen.</p>
    ${layarSemua.some(l => l.status === 'aktif') ? `<div class="tw"><table><thead><tr><th>Layar aktif</th><th>Disetujui</th><th></th></tr></thead><tbody>${layarSemua.filter(l => l.status === 'aktif').map(l => `<tr><td>${esc(namaCabang(l.cabang))}<div class="small muted">${esc(l.info || '')}</div></td><td class="small">${esc(l.disetujuiOleh || '')}<br>${esc(l.tglSetuju || '')}</td><td class="r">${st.petugas?.super ? `<button class="btn sm" type="button" data-act="ps-cabut" data-id="${esc(l.id)}">Cabut</button>` : '<span class="small muted">cabut: super admin</span>'}</td></tr>`).join('')}</tbody></table></div>` : ''}
    ${layar.length ? `<div class="tw"><table><thead><tr><th>Cabang</th><th>Kode di layar</th><th>Diminta</th><th>Perangkat</th><th></th></tr></thead><tbody>${layar.map((l, i) => `<tr><td>${esc(namaCabang(l.cabang))}</td><td class="mono" style="font-size:1.4rem;font-weight:700;letter-spacing:.15em">${esc(l.kode)}</td><td class="small">${esc(waktuMinta(l))}</td><td class="small muted" style="max-width:260px">${esc(l.info || '')}</td><td class="r" style="white-space:nowrap"><button class="btn sm" type="button" data-act="ps-layar" data-i="${i}" data-s="ditolak">Tolak</button> <button class="btn sm pri" type="button" data-act="ps-layar" data-i="${i}" data-s="aktif">Setujui</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="small muted">Tidak ada permintaan.</div>'}
   </div>`;
function renderPersetujuan() {
  if (!st.petugas?.super) { $('#view').innerHTML = `<div class="grid">${layarHTML()}</div>`; return; }
  $('#view').innerHTML = `<div class="grid">${layar.length ? layarHTML() : ''}
   <div class="panel"><h3>Pembatalan nota (${batal.length})</h3>
    ${batal.length ? `<div class="tw"><table><thead><tr><th>Nota</th>${multiCabang() ? '<th>Cabang</th>' : ''}<th>Pelanggan</th><th class="r">Total</th><th>Diajukan</th><th>Alasan</th><th></th></tr></thead><tbody>${batal.map((t, i) => `<tr><td class="mono"><button class="link-btn" type="button" data-act="ps-nota" data-i="${i}">${esc(t.no)}</button><div class="small muted">${esc(t.tgl)}</div></td>${multiCabang() ? `<td class="small">${esc(namaCabang(t.cabang))}</td>` : ''}<td>${esc(t.pelanggan || 'Umum')}${t.nopol ? `<div class="small muted mono">${esc(t.nopol)}</div>` : ''}</td><td class="r num">${rp(t.total)}</td><td class="small">${esc(t.batal.oleh)}<br>${esc(t.batal.tgl)}</td><td class="small">${esc(t.batal.alasan)}</td><td class="r" style="white-space:nowrap"><button class="btn sm" type="button" data-act="ps-tolak" data-no="${esc(t.no)}">Tolak</button> <button class="btn sm pri" type="button" data-act="ps-setujui" data-no="${esc(t.no)}">Setujui</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="small muted">Tidak ada pengajuan pembatalan.</div>'}
   </div>
   <div class="panel"><h3>Stok opname (${opname.length})</h3>
    ${opname.length ? `<div class="tw"><table><thead><tr><th>No</th>${multiCabang() ? '<th>Cabang</th>' : ''}<th>Petugas</th><th>Diajukan</th><th class="r">Part dihitung</th><th></th></tr></thead><tbody>${opname.map(o => `<tr><td class="mono">${esc(o.no || '')}</td>${multiCabang() ? `<td class="small">${esc(namaCabang(o.cabang))}</td>` : ''}<td class="small">${esc(o.petugas || '')}</td><td class="small">${esc(o.tglAjukan || o.tgl)}</td><td class="r num">${Object.keys(o.items || {}).length}</td><td class="r"><button class="btn sm pri" type="button" data-act="ps-opname" data-id="${esc(o.id)}" data-c="${esc(o.cabang)}">Periksa</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="small muted">Tidak ada stok opname yang diajukan.</div>'}
   </div>${layar.length ? '' : layarHTML()}</div>`;
}
views.persetujuan = renderPersetujuan;
refreshers.persetujuan = () => {};
Object.assign(actions, {
  'ps-setujui': async el => { await setujuiBatal(el.dataset.no); },
  'ps-tolak': async el => { await tolakBatal(el.dataset.no); },
  'ps-nota': el => showNota(batal[+el.dataset.i]),
  'ps-cabut': async el => {
    const l = layarSemua.find(x => x.id === el.dataset.id); if (!l) return;
    if (!(await konfirmasi('Cabut layar absen ' + namaCabang(l.cabang) + '?', `Perangkat ini tidak bisa lagi menampilkan QR absen. ${esc(l.info || '')}<br>Perangkat baru harus meminta aktivasi ulang.`, { ya: 'Ya, cabut', bahaya: true }))) return;
    try { await setDoc(doc(db, 'layarAbsen', l.id), { status: 'dicabut', dicabutOleh: namaPetugas(), tglCabut: stamp(new Date()) }, { merge: true }); toast('Layar absen ' + namaCabang(l.cabang) + ' dicabut'); } catch (e) { toast(errMsg(e)); }
  },
  'ps-layar': async el => {
    const l = layar[+el.dataset.i]; if (!l) return; const s = el.dataset.s;
    const ok = s === 'aktif'
      ? await konfirmasi('Setujui layar absen ' + namaCabang(l.cabang) + '?', `Pastikan kode di layar perangkat cabang adalah <b class="mono" style="font-size:1.3rem;letter-spacing:.15em">${esc(l.kode)}</b>.<br>${esc(l.info || '')}`, { ya: 'Ya, setujui' })
      : await konfirmasi('Tolak permintaan layar ' + namaCabang(l.cabang) + '?', `Kode <b class="mono">${esc(l.kode)}</b>. Perangkat ini tidak bisa menampilkan QR absen.`, { ya: 'Ya, tolak', bahaya: true });
    if (!ok) return;
    el.disabled = true;
    try {
      await setDoc(doc(db, 'layarAbsen', l.id), s === 'aktif' ? { status: 'aktif', disetujuiOleh: namaPetugas(), tglSetuju: stamp(new Date()) } : { status: 'ditolak', disetujuiOleh: namaPetugas(), tglSetuju: stamp(new Date()) }, { merge: true });
      toast(s === 'aktif' ? 'Layar absen ' + namaCabang(l.cabang) + ' aktif' : 'Permintaan ditolak');
    } catch (e) { toast(errMsg(e)); el.disabled = false; }
  },
  'ps-opname': el => {
    // opname cabang lain: pindah ke cabang itu dulu supaya stok sistem yang tampil sesuai
    if (el.dataset.c && el.dataset.c !== st.cabang) { const sel = document.getElementById('cabang-pilih'); if (sel) { sel.value = el.dataset.c; sel.dispatchEvent(new Event('change', { bubbles: true })); } }
    st.opn = st.opn || {}; st.opn.aktif = el.dataset.id; go('opname');
  }
});
