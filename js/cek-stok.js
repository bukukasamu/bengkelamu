// Cek Stok & permintaan barang antar cabang.
// - Cek Stok (Registrasi, Kasir, Sparepart, Admin): stok cabang ini, yang sudah dipesan servis, ready, dan stok per cabang.
// - Minta kirim: cabang yang butuh membuat permintaan (koleksi mintaStok) → bagian sparepart cabang pemilik barang
//   menekan Kirim (memakai transfer stok yang sudah ada) atau Tolak (dengan alasan) → cabang peminta menekan Terima
//   di Stok Part (transfer masuk). Semua tercatat di kartu stok kedua cabang.
import { $, esc, rp, stamp, toast, errMsg, modal, closeModal, konfirmasi } from './util.js';
import { S, st, part, views, refreshers, actions, inputHandlers, fkeys, namaPetugas, idPetugas, isRole, go } from './state.js';
import { db, doc, collection, query, where, getDocs, onSnapshot, addDoc, updateDoc } from './firebase.js';
import { cabAktif, cabangList, namaCabang, multiCabang, cabangOf } from './cabang.js';
import { AKTIF } from './wo-common.js';
import { mintaCatatan } from './kontrol.js';

const CS = { q: '', minta: [], masuk: [] };
const bolehMinta = () => isRole('admin', 'sparepart', 'kasir');
const bolehKirim = () => isRole('admin', 'sparepart');

/* ---------- Data stok per cabang ---------- */
// Part yang sudah dipesan servis yang belum dibayar, per cabang (cabang lain hanya diketahui admin)
export function dipesanDi(kode, cab) {
  const wos = isRole('admin') && S.woSemua?.length ? S.woSemua : S.wo;
  if (!isRole('admin') && cab !== cabAktif()) return null;
  return wos.filter(w => AKTIF.includes(w.status) && cabangOf(w) === cab).reduce((a, w) => a + (w.parts || []).filter(x => x.kode === kode).reduce((b, x) => b + x.qty, 0), 0);
}
export function stokPerCabang(p) {
  const sc = p.stokCab || { [cabAktif()]: p.stok };
  return cabangList().map(c => { const stok = +sc[c.id] || 0, d = dipesanDi(p.kode, c.id); return { id: c.id, nama: c.nama, stok, dipesan: d, ready: d == null ? null : stok - d, ini: c.id === cabAktif() }; });
}
const readyIni = p => p.stok - (dipesanDi(p.kode, cabAktif()) || 0);

/* ---------- Rincian per cabang + tombol Minta kirim ---------- */
export function rincianStok(kode, pesan = '') {
  const p = part(kode); if (!p) return;
  const rows = stokPerCabang(p);
  modal(`<div class="row spread"><h2>Stok ${esc(p.nama)}</h2><button class="btn sm ghost" type="button" data-close="1" aria-label="Tutup">✕</button></div>
    <div class="small muted"><span class="mono">${esc(p.kode)}</span>${p.cocok ? ' · ' + esc(p.cocok) : ''}${p.rak ? ' · rak ' + esc(p.rak) : ''} · harga jual <b>${rp(p.jual)}</b></div>
    ${pesan ? `<div class="note small">${pesan}</div>` : ''}
    <div class="tw"><table><thead><tr><th>Cabang</th><th class="r">Stok</th><th class="r">Dipesan servis</th><th class="r">Ready</th><th></th></tr></thead><tbody>
     ${rows.map(r => `<tr${r.ini ? ' style="font-weight:600"' : ''}><td>${esc(r.nama)}${r.ini ? ' <span class="pill p-info">cabang ini</span>' : ''}</td><td class="r num">${r.stok}</td><td class="r num">${r.dipesan == null ? '<span class="muted">–</span>' : r.dipesan}</td><td class="r num">${r.ready == null ? '<span class="muted">±' + r.stok + '</span>' : `<span class="pill ${r.ready > 0 ? 'p-good' : 'p-bad'}">${r.ready}</span>`}</td>
      <td class="r">${!r.ini && r.stok > 0 && bolehMinta() ? `<button class="btn sm pri" type="button" data-act="cs-minta" data-k="${esc(kode)}" data-c="${esc(r.id)}">Minta kirim</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>
    ${multiCabang() ? '<p class="small muted" style="margin:0">Ready = stok dikurangi part yang sudah dipesan untuk servis yang belum dibayar. Untuk cabang lain, pesanan servisnya hanya terlihat oleh admin.</p>' : ''}`, 'wide');
}
// Dipanggil Kasir / Order Sparepart saat stok cabang ini kurang
export function tawarkanCabangLain(p, pesanKurang) {
  if (!multiCabang() || !cabangList().some(c => c.id !== cabAktif() && (+(p.stokCab || {})[c.id] || 0) > 0)) { toast(pesanKurang); return; }
  rincianStok(p.kode, esc(pesanKurang) + '<br><b>Barang ada di cabang lain</b> — tekan <b>Minta kirim</b> untuk meminta dikirim ke cabang ini.');
}

function formMinta(kode, ke) {
  const p = part(kode); if (!p) return;
  const ada = +(p.stokCab || {})[ke] || 0;
  modal(`<h3>Minta kirim dari ${esc(namaCabang(ke))}</h3>
    <p class="small" style="margin:0"><b>${esc(p.nama)}</b> <span class="mono small muted">${esc(kode)}</span> · stok di ${esc(namaCabang(ke))}: <b>${ada}</b> · dikirim ke <b>${esc(namaCabang(cabAktif()))}</b></p>
    <div class="form"><label class="f" for="mt-qty">Jumlah<input id="mt-qty" type="number" min="1" max="${ada}" value="1" data-autofocus></label>
    <label class="f wide-2" for="mt-cat">Keperluan<input id="mt-cat" data-nocaps placeholder="mis. untuk servis BL 1234 NN, konsumen menunggu"></label></div>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Batal</button><button class="btn pri" type="button" data-act="cs-minta-kirim" data-k="${esc(kode)}" data-c="${esc(ke)}">Kirim permintaan</button></div>`);
}
async function kirimMinta(el) {
  const p = part(el.dataset.k), ke = el.dataset.c, qty = +$('#mt-qty').value || 0, catatan = ($('#mt-cat').value || '').trim();
  if (!p || qty < 1) { toast('Isi jumlah'); return; }
  const ada = +(p.stokCab || {})[ke] || 0;
  if (qty > ada) { toast(`Stok di ${namaCabang(ke)} hanya ${ada}`); return; }
  el.disabled = true;
  try {
    const no = 'MS-' + stamp(new Date()).replace(/\D/g, '').slice(2, 12);
    await addDoc(collection(db, 'mintaStok'), { no, tgl: stamp(new Date()), dari: cabAktif(), ke, items: [{ kode: p.kode, nama: p.nama, qty }], catatan, status: 'diminta', oleh: namaPetugas(), olehId: idPetugas() });
    closeModal(); toast(`Permintaan ${qty} ${p.nama} dikirim ke ${namaCabang(ke)}`);
    if (st.view === 'cekstok') muatMinta();
  } catch (e) { toast(errMsg(e)); el.disabled = false; }
}

/* ---------- Permintaan masuk / keluar ---------- */
async function muatMinta() {
  if (!multiCabang()) { CS.minta = []; CS.masuk = []; return gambarMinta(); }
  try {
    const cab = cabAktif();
    const [a, b] = await Promise.all([getDocs(query(collection(db, 'mintaStok'), where('dari', '==', cab))), getDocs(query(collection(db, 'mintaStok'), where('ke', '==', cab)))]);
    const urut = l => l.map(d => ({ id: d.id, ...d.data() })).sort((x, y) => String(y.tgl).localeCompare(String(x.tgl)));
    CS.minta = urut(a.docs).slice(0, 20); CS.masuk = urut(b.docs).filter(m => m.status === 'diminta' || String(m.tgl) >= stamp(new Date(Date.now() - 7 * 864e5))).slice(0, 30);
  } catch (e) { CS.minta = []; CS.masuk = []; console.warn('Permintaan stok', e); }
  gambarMinta();
}
const STATUS_M = { diminta: ['Menunggu', 'p-warn'], dikirim: ['Dikirim', 'p-info'], ditolak: ['Ditolak', 'p-bad'], batal: ['Dibatalkan', 'p-bad'] };
const pillM = m => `<span class="pill ${STATUS_M[m.status]?.[1] || ''}">${STATUS_M[m.status]?.[0] || esc(m.status)}</span>`;
const itemM = m => m.items.map(x => esc(x.nama) + ' ×' + x.qty).join(', ');
function gambarMinta() {
  const el = $('#cs-minta'); if (!el) return;
  if (!multiCabang()) { el.innerHTML = ''; return; }
  const masukTunggu = CS.masuk.filter(m => m.status === 'diminta');
  el.innerHTML = `${bolehKirim() || masukTunggu.length ? `<div class="panel"><h3>Permintaan masuk ke ${esc(namaCabang(cabAktif()))} (${masukTunggu.length})</h3>
     ${CS.masuk.length ? `<div class="tw"><table class="rw-tabel"><thead><tr><th>No</th><th>Dari cabang</th><th>Barang</th><th>Keperluan</th><th>Status</th><th></th></tr></thead><tbody>${CS.masuk.map(m => `<tr><td class="mono small">${esc(m.no)}<div class="rw-det">${esc(m.tgl)} · ${esc(m.oleh || '')}</div></td><td>${esc(namaCabang(m.dari))}</td><td>${itemM(m)}</td><td class="small">${esc(m.catatan || '')}</td><td>${pillM(m)}${m.transferNo ? `<div class="rw-det">${esc(m.transferNo)}</div>` : ''}${m.alasanTolak ? `<div class="rw-det">${esc(m.alasanTolak)}</div>` : ''}</td>
       <td class="r" style="white-space:nowrap">${m.status === 'diminta' && bolehKirim() ? `<button class="btn sm" type="button" data-act="cs-tolak" data-id="${esc(m.id)}">Tolak</button> <button class="btn sm pri" type="button" data-act="cs-kirim" data-id="${esc(m.id)}">Kirim</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="small muted">Tidak ada permintaan.</div>'}
   </div>` : ''}
   ${bolehMinta() ? `<div class="panel"><h3>Permintaan dari ${esc(namaCabang(cabAktif()))}</h3>
     ${CS.minta.length ? `<div class="tw"><table class="rw-tabel"><thead><tr><th>No</th><th>Ke cabang</th><th>Barang</th><th>Status</th><th></th></tr></thead><tbody>${CS.minta.map(m => `<tr><td class="mono small">${esc(m.no)}<div class="rw-det">${esc(m.tgl)} · ${esc(m.oleh || '')}</div></td><td>${esc(namaCabang(m.ke))}</td><td>${itemM(m)}</td><td>${pillM(m)}${m.status === 'dikirim' ? `<div class="rw-det">${esc(m.transferNo || '')} — terima di Stok Part</div>` : ''}${m.alasanTolak ? `<div class="rw-det">${esc(m.alasanTolak)}</div>` : ''}</td>
       <td class="r">${m.status === 'diminta' ? `<button class="btn sm ghost" type="button" data-act="cs-batal" data-id="${esc(m.id)}">Batalkan</button>` : m.status === 'dikirim' && isRole('admin', 'sparepart') ? '<button class="btn sm" type="button" data-act="cs-ke-stok">Terima di Stok Part</button>' : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="small muted">Belum ada permintaan. Cari part di atas, lalu tekan baris part → <b>Minta kirim</b> pada cabang yang punya stok.</div>'}
   </div>` : ''}`;
}
async function kirimDariMinta(el) {
  const m = CS.masuk.find(x => x.id === el.dataset.id); if (!m || st.saving) return;
  if (m.ke !== cabAktif()) { toast('Pindah ke cabang ' + namaCabang(m.ke) + ' dulu'); return; }
  const kurang = m.items.find(x => (part(x.kode)?.stok || 0) < x.qty);
  if (kurang) { toast(`Stok ${kurang.nama} di cabang ini ${part(kurang.kode)?.stok || 0}, diminta ${kurang.qty}`); return; }
  if (!(await konfirmasi('Kirim ke ' + namaCabang(m.dari) + '?', `${itemM(m)}<br>Permintaan ${esc(m.oleh || '')}${m.catatan ? ': ' + esc(m.catatan) : ''}.<br>Stok cabang ini langsung berkurang; cabang ${esc(namaCabang(m.dari))} menambah stok saat menekan Terima.`, { ya: 'Ya, kirim' }))) return;
  st.saving = true;
  try {
    const { kirimTransfer } = await import('./stok.js');
    const no = await kirimTransfer(m.items, m.ke, m.dari, 'Permintaan ' + m.no + (m.catatan ? ': ' + m.catatan : ''), { mintaNo: m.no });
    await updateDoc(doc(db, 'mintaStok', m.id), { status: 'dikirim', transferNo: no, pengirim: namaPetugas(), tglKirim: stamp(new Date()) });
    toast(`Dikirim (${no}). Menunggu diterima di ${namaCabang(m.dari)}.`); muatMinta();
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

/* ---------- Badge permintaan masuk di menu ---------- */
let nMasuk = 0;
function segarkanBadgeMinta() {
  ['cekstok', 'stok'].forEach(v => { const el = document.querySelector(`.sb-link[data-view="${v}"]`); if (!el) return; el.querySelector('.sb-badge')?.remove(); if (nMasuk) el.insertAdjacentHTML('beforeend', ` <span class="sb-badge">${nMasuk}</span>`); });
}
let unsubMinta = null;
// Admin pindah cabang: permintaan masuk yang dipantau ikut cabang yang baru
document.addEventListener('change', e => { if (e.target.id === 'cabang-pilih' && unsubMinta) setTimeout(() => { unsubMinta?.(); nMasuk = 0; segarkanBadgeMinta(); pantauMinta(null); }, 50); });
export function pantauMinta(unsubs) {
  if (!bolehKirim() || !multiCabang()) return;
  unsubMinta?.();
  unsubMinta = (onSnapshot(query(collection(db, 'mintaStok'), where('ke', '==', cabAktif()), where('status', '==', 'diminta')), s => {
    const baru = s.docs.length; if (baru > nMasuk && nMasuk >= 0 && st.loaded) toast(`Ada ${baru} permintaan barang dari cabang lain (menu Cek Stok)`);
    nMasuk = baru; segarkanBadgeMinta(); if (st.view === 'cekstok') muatMinta();
  }, () => {}));
  if (unsubs) unsubs.push(() => { unsubMinta?.(); unsubMinta = null; nMasuk = 0; });
}

/* ---------- Halaman Cek Stok ---------- */
function hasilCari() {
  const el = $('#cs-hasil'); if (!el) return;
  const kata = CS.q.toLowerCase().split(/\s+/).filter(Boolean);
  if (!kata.length) { el.innerHTML = '<div class="small muted">Ketik kode, nama part, atau tipe motor.</div>'; return; }
  const r = S.parts.filter(p => { const t = (p.kode + ' ' + p.nama + ' ' + (p.cocok || '') + ' ' + (p.pengganti || '')).toLowerCase(); return kata.every(w => t.includes(w)); }).slice(0, 60);
  const multi = multiCabang(), lain = cabangList().filter(c => c.id !== cabAktif());
  el.innerHTML = r.length ? `<div class="tw"><table class="rw-tabel bernomor"><thead><tr><th>Kode</th><th>Nama part</th><th class="r">Harga jual</th>${isRole('admin') ? '<th class="r">Harga beli</th>' : ''}<th class="r">Stok</th><th class="r">Dipesan</th><th class="r">Ready</th>${multi ? lain.map(c => `<th class="r">${esc(c.nama)}</th>`).join('') : ''}</tr></thead><tbody>
    ${r.map(p => { const d = dipesanDi(p.kode, cabAktif()) || 0, rd = p.stok - d; return `<tr class="rw-buka" tabindex="0" data-act="cs-rinci" data-k="${esc(p.kode)}"><td class="mono small">${esc(p.kode)}</td><td>${esc(p.nama)}${p.cocok ? `<div class="rw-det">${esc(p.cocok)}</div>` : ''}${p.rak ? `<div class="rw-det">rak ${esc(p.rak)}</div>` : ''}</td><td class="r num">${rp(p.jual)}</td>${isRole('admin') ? `<td class="r num">${rp(p.beli)}</td>` : ''}<td class="r num">${p.stok}</td><td class="r num">${d || '<span class="muted">–</span>'}</td><td class="r"><span class="pill ${rd > 0 ? 'p-good' : 'p-bad'}">${rd}</span></td>${multi ? lain.map(c => { const n = +(p.stokCab || {})[c.id] || 0; return `<td class="r num">${n ? `<b>${n}</b>` : '<span class="muted">0</span>'}</td>`; }).join('') : ''}</tr>`; }).join('')}
    </tbody></table></div><p class="small muted" style="margin:0">${r.length === 60 ? 'Ditampilkan 60 pertama, ketik lebih lengkap. ' : ''}Klik baris untuk rincian${multi && bolehMinta() ? ' & minta kirim dari cabang lain' : ''}.</p>` : '<div class="small muted">Tidak ada part yang cocok.</div>';
}
function renderCekStok() {
  $('#view').innerHTML = `<div class="grid"><div class="panel"><h3>Cek stok${multiCabang() ? ' · ' + esc(namaCabang(cabAktif())) : ''}</h3>
    <input id="cs-q" placeholder="Cari kode, nama part, atau tipe motor (mis. kampas rem nmax)" value="${esc(CS.q)}" autocomplete="off" aria-label="Cari part">
    <div id="cs-hasil"></div></div><div id="cs-minta"></div></div>`;
  hasilCari(); muatMinta();
  setTimeout(() => $('#cs-q')?.focus(), 0);
}
views.cekstok = renderCekStok;
fkeys.cekstok = { cari: 'cs-fokus' };
refreshers.cekstok = () => hasilCari();
Object.assign(actions, {
  'cs-rinci': el => rincianStok(el.dataset.k),
  'stok-rinci': el => rincianStok(el.dataset.k),
  'cs-minta': el => formMinta(el.dataset.k, el.dataset.c),
  'cs-minta-kirim': kirimMinta,
  'cs-kirim': kirimDariMinta,
  'cs-ke-stok': () => go('stok'),
  'cs-fokus': () => { const q = $('#cs-q'); if (q) { q.focus(); q.select(); } },
  'cs-tolak': async el => {
    const m = CS.masuk.find(x => x.id === el.dataset.id); if (!m) return;
    const alasan = await mintaCatatan('Tolak permintaan ' + m.no, `${itemM(m)} untuk ${namaCabang(m.dari)}. Alasan terlihat oleh peminta.`); if (alasan === null) return;
    try { await updateDoc(doc(db, 'mintaStok', m.id), { status: 'ditolak', alasanTolak: alasan, ditolakOleh: namaPetugas(), tglTolak: stamp(new Date()) }); toast('Permintaan ditolak'); muatMinta(); } catch (e) { toast(errMsg(e)); }
  },
  'cs-batal': async el => {
    const m = CS.minta.find(x => x.id === el.dataset.id); if (!m) return;
    if (!(await konfirmasi('Batalkan permintaan ' + m.no + '?', itemM(m) + ' dari ' + esc(namaCabang(m.ke)), { ya: 'Ya, batalkan', bahaya: true }))) return;
    try { await updateDoc(doc(db, 'mintaStok', m.id), { status: 'batal', tglBatal: stamp(new Date()) }); muatMinta(); } catch (e) { toast(errMsg(e)); }
  }
});
inputHandlers.push(e => { if (e.target.id === 'cs-q') { CS.q = e.target.value; hasilCari(); } });
document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset?.act === 'cs-rinci') { e.preventDefault(); rincianStok(e.target.dataset.k); } });
