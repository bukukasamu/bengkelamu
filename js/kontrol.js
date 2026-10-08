// Kontrol stok & nota: kartu stok (mutasi), pembatalan nota dengan persetujuan super admin,
// dan penerapan hasil stok opname yang disetujui.
import { db, doc, collection, getDocs, getDoc, query, where, writeBatch, increment, updateDoc, setDoc } from './firebase.js';
import { $, esc, rp, stamp, toast, errMsg, modal, closeModal } from './util.js';
import { S, st, actions, namaPetugas, isRole } from './state.js';
import { cabangOf, cabAktif, stokField, namaCabang, multiCabang } from './cabang.js';
import { mintaPassword } from './otorisasi.js';
import { pantauKey, logStatus } from './wo-common.js';

/* ---------- Kartu stok ----------
   Setiap perubahan stok dicatat di koleksi mutasi: { tgl, cabang, kode, nama, qty (+ masuk / − keluar), jenis, ref, ket, petugas } */
export const JENIS_MUTASI = { jual: 'Penjualan', servis: 'Servis', beli: 'Pembelian', 'transfer-keluar': 'Transfer keluar', 'transfer-masuk': 'Transfer masuk', opname: 'Stok opname', batal: 'Batal nota', awal: 'Stok awal', import: 'Import Excel' };
export const dataMutasi = (cabang, kode, nama, qty, jenis, ref = '', ket = '') => ({ tgl: stamp(new Date()), cabang, kode, nama, qty, jenis, ref, ket, petugas: namaPetugas() });
// tx: transaksi atau batch Firestore
export const catatMutasi = (tx, m) => tx.set(doc(collection(db, 'mutasi')), m);

export async function kartuStok(kode) {
  const p = S.map.get(kode); if (!p) return;
  modal(`<div class="row spread"><h2>Kartu stok</h2><button class="btn sm ghost" type="button" data-close="1" aria-label="Tutup">✕</button></div>
    <div><b>${esc(p.nama)}</b> <span class="mono small muted">${esc(kode)}</span>${multiCabang() ? ` · cabang ${esc(namaCabang(cabAktif()))}` : ''}<div class="small">Stok sekarang: <b class="num">${p.stok}</b></div></div>
    <div id="ks-isi" class="small muted">Memuat…</div>`, 'wide');
  try {
    const s = await getDocs(query(collection(db, 'mutasi'), where('kode', '==', kode), where('cabang', '==', cabAktif())));
    const l = s.docs.map(d => d.data()).sort((a, b) => b.tgl.localeCompare(a.tgl)).slice(0, 200);
    let saldo = p.stok;
    const rows = l.map(m => { const r = { ...m, saldo }; saldo -= m.qty; return r; });
    const el = $('#ks-isi'); if (!el) return;
    el.innerHTML = rows.length ? `<div class="tw"><table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Referensi</th><th class="r">Masuk</th><th class="r">Keluar</th><th class="r">Saldo</th><th>Petugas</th></tr></thead><tbody>${rows.map(m => `<tr><td class="small">${esc(m.tgl)}</td><td>${esc(JENIS_MUTASI[m.jenis] || m.jenis)}${m.ket ? `<div class="small muted">${esc(m.ket)}</div>` : ''}</td><td class="mono small">${esc(m.ref || '')}</td><td class="r num">${m.qty > 0 ? m.qty : ''}</td><td class="r num">${m.qty < 0 ? -m.qty : ''}</td><td class="r num"><b>${m.saldo}</b></td><td class="small">${esc(m.petugas || '')}</td></tr>`).join('')}</tbody></table></div><p class="small muted" style="margin:0">Saldo dihitung mundur dari stok sekarang. Mutasi sebelum versi 4.0 tidak tercatat.</p>` : 'Belum ada mutasi tercatat untuk part ini di cabang ini.';
  } catch (e) { const el = $('#ks-isi'); if (el) el.textContent = 'Gagal memuat: ' + errMsg(e); }
}

/* ---------- Pembatalan nota ----------
   Kasir/admin mengajukan dengan alasan → super admin menyetujui (kata sandi + catatan) atau menolak.
   Disetujui: nota tidak dihitung di laporan/penghasilan, stok part dikembalikan, motor servis kembali "Selesai"
   (bisa dibayar ulang dengan data yang benar), dan nota dihapus dari riwayat cek servis konsumen. */
export const statusBatal = t => t?.batal?.status || '';
export function batalHTML(t) {
  const b = t.batal; if (!b) return '';
  if (b.status === 'disetujui') return `<div class="note small batal-on"><b>DIBATALKAN</b> · disetujui ${esc(b.disetujuiOleh || '')} ${esc(b.tglSetuju || '')}<br>Alasan: ${esc(b.alasan)}${b.catatanSuper ? `<br>Catatan super admin: ${esc(b.catatanSuper)}` : ''}</div>`;
  if (b.status === 'diminta') return `<div class="note small"><b>Pembatalan diajukan</b> oleh ${esc(b.oleh)} (${esc(b.tgl)}): ${esc(b.alasan)} — menunggu persetujuan super admin.</div>`;
  if (b.status === 'ditolak') return `<div class="note small"><b>Pengajuan pembatalan ditolak</b>${b.catatanSuper ? ': ' + esc(b.catatanSuper) : ''}</div>`;
  return '';
}
export function tombolBatal(t) {
  if (!t || statusBatal(t) === 'disetujui' || statusBatal(t) === 'diminta' || !(isRole('admin') || isRole('kasir'))) return '';
  return `<button class="btn ghost" type="button" data-act="batal-ajukan" data-no="${esc(t.no)}">${st.petugas?.super ? 'Batalkan nota' : 'Ajukan pembatalan'}</button>`;
}
const cariTrx = async no => S.trx.find(t => t.no === no) || (S.trxBatal || []).find(t => t.no === no) || (await getDoc(doc(db, 'trx', no))).data();

async function ajukanBatal(el) {
  const t = await cariTrx(el.dataset.no); if (!t) return;
  modal(`<h3>${st.petugas?.super ? 'Batalkan' : 'Ajukan pembatalan'} nota ${esc(t.no)}</h3>
    <p class="small" style="margin:0">${esc(t.pelanggan || 'Umum')}${t.nopol ? ' · ' + esc(t.nopol) : ''} · ${rp(t.total)}. ${st.petugas?.super ? 'Stok dikembalikan dan nota tidak dihitung lagi.' : 'Nota baru batal setelah disetujui super admin.'}</p>
    <label class="f" for="bt-alasan">Alasan pembatalan (wajib)<textarea id="bt-alasan" rows="3" data-nocaps placeholder="mis. salah input jumlah oli, konsumen batal beli" data-autofocus></textarea></label>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Batal</button><button class="btn pri" type="button" data-act="batal-kirim" data-no="${esc(t.no)}">${st.petugas?.super ? 'Lanjut' : 'Kirim pengajuan'}</button></div>`);
}
async function kirimBatal(el) {
  const alasan = ($('#bt-alasan')?.value || '').trim(), no = el.dataset.no;
  if (alasan.length < 5) { toast('Tulis alasan pembatalan dengan jelas'); $('#bt-alasan')?.focus(); return; }
  const permintaan = { status: 'diminta', alasan, oleh: namaPetugas(), tgl: stamp(new Date()) };
  try {
    if (st.petugas?.super) { closeModal(); await setujuiBatal(no, permintaan); return; }
    await updateDoc(doc(db, 'trx', no), { batal: permintaan });
    closeModal(); toast('Pengajuan pembatalan ' + no + ' terkirim ke super admin');
  } catch (e) { toast(errMsg(e)); }
}

export async function setujuiBatal(no, permintaanBaru) {
  const t = await cariTrx(no); if (!t) return false;
  const catatan = await mintaCatatan('Setujui pembatalan ' + no, `Alasan: ${(permintaanBaru || t.batal)?.alasan || ''}`);
  if (catatan === null) return false;
  if (!(await mintaPassword('Setujui pembatalan nota ' + no, 'Stok part dikembalikan dan nota tidak dihitung di laporan.'))) return false;
  const cab = cabangOf(t), b = writeBatch(db), ref = 'BATAL ' + no;
  b.update(doc(db, 'trx', no), { batal: { ...(permintaanBaru || t.batal), status: 'disetujui', catatanSuper: catatan, disetujuiOleh: namaPetugas(), tglSetuju: stamp(new Date()) } });
  (t.items || []).forEach(x => { b.update(doc(db, 'parts', x.kode), { [stokField(cab)]: increment(x.qty) }); catatMutasi(b, dataMutasi(cab, x.kode, x.nama, x.qty, 'batal', ref, catatan)); });
  if (t.jenis === 'SERVIS' && t.wo) {
    const ws = await getDoc(doc(db, 'wo', t.wo));
    if (ws.exists()) b.update(ws.ref, { status: 'Selesai', aktif: true, nota: '', log: logStatus(ws.data().log, 'Selesai') });
  }
  try {
    await b.commit();
    hapusDariCekServis(t);
    toast('Nota ' + no + ' dibatalkan'); return true;
  } catch (e) { toast(errMsg(e)); return false; }
}
export async function tolakBatal(no) {
  const catatan = await mintaCatatan('Tolak pembatalan ' + no, 'Alasan penolakan akan terlihat oleh kasir.');
  if (catatan === null) return false;
  try { const t = await cariTrx(no); await updateDoc(doc(db, 'trx', no), { batal: { ...t.batal, status: 'ditolak', catatanSuper: catatan, disetujuiOleh: namaPetugas(), tglSetuju: stamp(new Date()) } }); toast('Pengajuan ditolak'); return true; }
  catch (e) { toast(errMsg(e)); return false; }
}
async function hapusDariCekServis(t) {
  try {
    if (!t.nopol || !t.hp) return;
    const key = await pantauKey(t.nopol, t.hp); if (!key) return;
    const s = await getDoc(doc(db, 'pantau', key)); if (!s.exists()) return;
    await setDoc(doc(db, 'pantau', key), { riwayat: (s.data().riwayat || []).filter(r => r.no !== t.no) }, { merge: true });
  } catch (e) { console.warn('Hapus riwayat cek servis', e); }
}

// Kotak catatan (wajib) sebelum kata sandi
export function mintaCatatan(judul, ket = '') {
  return new Promise(resolve => {
    let selesai = false;
    modal(`<h3>${esc(judul)}</h3>${ket ? `<p class="small" style="margin:0">${esc(ket)}</p>` : ''}
      <label class="f" for="ct-isi">Catatan (wajib)<textarea id="ct-isi" rows="3" data-nocaps data-autofocus></textarea></label>
      <div class="row" style="justify-content:flex-end"><button class="btn" type="button" id="ct-batal">Batal</button><button class="btn pri" type="button" id="ct-ok">Lanjut</button></div>`);
    const root = $('#modal-root');
    const obs = new MutationObserver(() => { if (!root.querySelector('#ct-isi') && !selesai) { selesai = true; obs.disconnect(); resolve(null); } });
    obs.observe(root, { childList: true, subtree: true });
    $('#ct-batal').onclick = () => { selesai = true; obs.disconnect(); closeModal(); resolve(null); };
    $('#ct-ok').onclick = () => { const v = $('#ct-isi').value.trim(); if (v.length < 3) { toast('Isi catatan'); return; } selesai = true; obs.disconnect(); closeModal(); resolve(v); };
  });
}

/* ---------- Stok opname disetujui ----------
   Selisih = fisik − stok sistem saat dihitung; diterapkan sebagai tambahan/kurangan (aman walau ada penjualan setelah dihitung). */
export async function terapkanOpname(op) {
  const items = Object.entries(op.items || {}).filter(([, v]) => v.fisik !== '' && v.fisik != null && +v.fisik !== +v.sistem);
  const catatan = await mintaCatatan('Setujui stok opname ' + (op.no || ''), `${items.length} part berselisih akan disesuaikan.`);
  if (catatan === null) return false;
  if (!(await mintaPassword('Setujui stok opname', `${items.length} part disesuaikan di cabang ${namaCabang(op.cabang)}.`))) return false;
  try {
    for (let i = 0; i < items.length; i += 200) {
      const b = writeBatch(db);
      items.slice(i, i + 200).forEach(([kode, v]) => {
        const d = +v.fisik - +v.sistem;
        b.update(doc(db, 'parts', kode), { [stokField(op.cabang)]: increment(d) });
        catatMutasi(b, dataMutasi(op.cabang, kode, v.nama || kode, d, 'opname', op.no || op.id, catatan));
      });
      await b.commit();
    }
    await updateDoc(doc(db, 'opname', op.id), { status: 'disetujui', catatanSuper: catatan, disetujuiOleh: namaPetugas(), tglSetuju: stamp(new Date()) });
    toast('Stok opname disetujui, stok disesuaikan'); return true;
  } catch (e) { toast(errMsg(e)); return false; }
}

Object.assign(actions, {
  'batal-ajukan': ajukanBatal,
  'batal-kirim': kirimBatal,
  'kartu-stok': el => kartuStok(el.dataset.k)
});
