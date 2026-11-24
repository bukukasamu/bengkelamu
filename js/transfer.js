// 5.31.0 — Transfer stok antar cabang: status, riwayat lengkap, terima/tolak/batal, dan pengajuan pembatalan.
// Alur status:
//   dikirim ──Terima (cabang tujuan)──────────▶ diterima ──Ajukan pembatalan → disetujui Super Admin──▶ dibatalkan (stok dikoreksi di kedua cabang)
//      │ └─Tolak (cabang tujuan) ──▶ ditolak ──Kembalikan ke stok (cabang asal)──▶ dibatalkan
//      └──Batalkan kirim (cabang asal) ───────────────────────────────────────────▶ dibatalkan (stok kembali ke cabang asal)
// Tidak ada data yang dihapus: semua perubahan stok dicatat di kartu stok (mutasi) dengan nomor TF yang sama.
import { $, esc, stamp, toast, errMsg, konfirmasi, modal } from './util.js';
import { st, actions, namaPetugas, isRole } from './state.js';
import { db, doc, collection, query, where, getDocs, onSnapshot, runTransaction, updateDoc } from './firebase.js';
import { cabAktif, cabangQuery, namaCabang, multiCabang, stokOf, stokField } from './cabang.js';
import { catatMutasi, dataMutasi, mintaCatatan, fmtWaktu } from './kontrol.js';
import { mintaPassword } from './otorisasi.js';

export const STATUS_TF = {
  dikirim: ['Dikirim · belum diterima', 'p-warn'],
  diterima: ['Diterima', 'p-good'],
  ditolak: ['Ditolak penerima', 'p-bad'],
  dibatalkan: ['Dibatalkan', 'p-muted']
};
export const statusTf = t => t.status || 'diterima';   // transfer lama (sebelum 2 langkah) tidak punya status = langsung diterima
export const pillTf = t => { const s = STATUS_TF[statusTf(t)] || [statusTf(t), '']; return `<span class="pill ${s[1]}">${s[0]}</span>` + (t.batal?.status === 'diminta' ? ' <span class="pill p-bad">Pembatalan diajukan</span>' : ''); };
export const itemsTf = t => t.items || [{ kode: t.kode, nama: t.nama, qty: t.qty }];
export const pcsTf = t => itemsTf(t).reduce((a, x) => a + (+x.qty || 0), 0);
const sama = (a, b) => cabangQuery(a).includes(b);
const diAsal = t => sama(cabAktif(), t.dari);
const diTujuan = t => sama(cabAktif(), t.ke);
const bolehKelola = () => isRole('admin', 'sparepart');
const berubah = () => window.dispatchEvent(new CustomEvent('amu-stok-berubah'));

/* ---------- Transfer masuk yang menunggu diterima (badge menu + notifikasi) ---------- */
let tfMasuk = [], unsubTf = null, nSebelum = -1;
export const transferMenunggu = () => tfMasuk;
export function segarkanBadgeTf() {
  ['stok', 'pembelian', 'riwayatStok'].forEach(v => {
    const el = document.querySelector(`.sb-link[data-view="${v}"]`); if (!el) return;
    el.querySelector('.tf-badge')?.remove();
    if (tfMasuk.length) el.insertAdjacentHTML('beforeend', ` <span class="sb-badge tf-badge" title="Transfer masuk menunggu diterima">${tfMasuk.length}</span>`);
  });
}
export function pantauTransferMasuk(unsubs) {
  if (!bolehKelola() || !multiCabang()) return;
  unsubTf?.();
  unsubTf = onSnapshot(query(collection(db, 'transfer'), where('ke', '==', cabAktif()), where('status', '==', 'dikirim')), s => {
    tfMasuk = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(a.tgl).localeCompare(String(b.tgl)));
    if (st.loaded && nSebelum >= 0 && tfMasuk.length > nSebelum) toast(`Ada kiriman stok dari ${namaCabang(tfMasuk[tfMasuk.length - 1].dari)}. Cek barangnya lalu tekan Terima di Stok Part — jangan dicatat lagi di Pembelian.`);
    nSebelum = tfMasuk.length; segarkanBadgeTf(); berubah();
  }, () => {});
  if (unsubs) unsubs.push(() => { unsubTf?.(); unsubTf = null; nSebelum = -1; tfMasuk = []; });
}
// Admin pindah cabang: pantau cabang yang baru
document.addEventListener('change', e => { if (e.target.id === 'cabang-pilih' && unsubTf) setTimeout(() => { unsubTf?.(); unsubTf = null; tfMasuk = []; nSebelum = -1; segarkanBadgeTf(); pantauTransferMasuk(null); }, 60); });

// Kotak pemberitahuan di Stok Part / Pembelian / Riwayat Stok
export function bannerTransferMasuk({ tombol = true } = {}) {
  if (!tfMasuk.length) return '';
  return `<div class="note tf-banner"><b>📦 Kiriman dari cabang lain menunggu diterima (${tfMasuk.length})</b>
    <div class="small">Barang dari transfer <b>cukup ditekan Terima</b> setelah dicek fisik. <b>Jangan</b> dicatat lagi di Pembelian Stok, karena stok akan bertambah dua kali (dobel).</div>
    ${tfMasuk.map(t => `<div class="row spread" style="margin-top:6px"><span class="small"><span class="mono">${esc(t.no)}</span> · ${esc(fmtWaktu(t.tgl))} · dari <b>${esc(namaCabang(t.dari))}</b> · ${itemsTf(t).map(x => `${esc(x.nama)} <span class="mono muted">${esc(x.kode)}</span> ×${x.qty}`).join(', ')}${t.catatan ? ' · ' + esc(t.catatan) : ''}</span>
      ${tombol ? `<span class="row" style="gap:6px"><button class="btn sm" type="button" data-act="tf-aksi" data-a="tolak" data-id="${esc(t.id)}">Tolak</button><button class="btn sm pri" type="button" data-act="tf-aksi" data-a="terima" data-id="${esc(t.id)}">Terima</button></span>` : ''}</div>`).join('')}</div>`;
}

/* ---------- Riwayat transfer cabang ini (semua, tanpa batas 15) ---------- */
const cache = new Map();   // id → transfer (dipakai tombol aksi)
export async function muatRiwayatTransfer(cab = cabAktif()) {
  const qs = cabangQuery(cab).flatMap(c => [query(collection(db, 'transfer'), where('dari', '==', c)), query(collection(db, 'transfer'), where('ke', '==', c))]);
  // alias cabang utama (UTM/PUSAT) yang ditolak rules lama tidak boleh menggagalkan seluruh riwayat
  const snaps = (await Promise.all(qs.map((q, i) => getDocs(q).catch(e => { if (i < 2) throw e; return { docs: [] }; }))));
  const m = new Map(); snaps.forEach(s => s.docs.forEach(d => m.set(d.id, { id: d.id, ...d.data() })));
  const list = [...m.values()].sort((a, b) => String(b.tgl || '').localeCompare(String(a.tgl || '')));
  list.forEach(t => cache.set(t.id, t));
  return list;
}
export const ingatTransfer = list => list.forEach(t => cache.set(t.id, t));

function tombolAksi(t) {
  const s = statusTf(t), b = [], sup = !!st.petugas?.super;
  b.push(`<button class="btn sm ghost" type="button" data-act="tf-aksi" data-a="bast" data-id="${esc(t.id)}">BAST</button>`);
  if (!bolehKelola() && !sup) return b.join('');
  if (s === 'dikirim' && diTujuan(t)) b.push(`<button class="btn sm" type="button" data-act="tf-aksi" data-a="tolak" data-id="${esc(t.id)}">Tolak</button><button class="btn sm pri" type="button" data-act="tf-aksi" data-a="terima" data-id="${esc(t.id)}">Terima</button>`);
  if (s === 'dikirim' && (diAsal(t) || sup)) b.push(`<button class="btn sm danger" type="button" data-act="tf-aksi" data-a="batal-kirim" data-id="${esc(t.id)}">Batalkan kirim</button>`);
  if (s === 'ditolak' && (diAsal(t) || sup)) b.push(`<button class="btn sm pri" type="button" data-act="tf-aksi" data-a="batal-kirim" data-id="${esc(t.id)}">Kembalikan ke stok</button>`);
  if (s === 'diterima' && t.status && t.batal?.status !== 'diminta') b.push(`<button class="btn sm danger" type="button" data-act="tf-aksi" data-a="${sup ? 'batal-setuju' : 'batal-ajukan'}" data-id="${esc(t.id)}">${sup ? 'Batalkan transfer' : 'Ajukan pembatalan'}</button>`);
  if (s === 'diterima' && t.batal?.status === 'diminta' && sup) b.push(`<button class="btn sm" type="button" data-act="tf-aksi" data-a="batal-tolak" data-id="${esc(t.id)}">Tolak pengajuan</button><button class="btn sm danger" type="button" data-act="tf-aksi" data-a="batal-setuju" data-id="${esc(t.id)}">Setujui pembatalan</button>`);
  return b.join('');
}
export function tabelTransfer(list) {
  ingatTransfer(list);
  if (!list.length) return '<div class="empty">Belum ada transfer pada pilihan ini.</div>';
  return `<div class="tw"><table class="bernomor rw-tabel"><thead><tr><th>No. transfer</th><th>Arah</th><th>Barang</th><th>Dikirim</th><th>Diterima / batal</th><th>Status</th><th></th></tr></thead><tbody>${list.map(t => {
    const keluar = diAsal(t), s = statusTf(t);
    return `<tr><td class="mono small">${esc(t.no || t.id)}${t.mintaNo ? `<div class="rw-det">permintaan ${esc(t.mintaNo)}</div>` : ''}</td>
      <td><span class="pill ${keluar ? 'p-muted' : 'p-info'}">${keluar ? 'Keluar' : 'Masuk'}</span><div class="small">${esc(namaCabang(t.dari))} → ${esc(namaCabang(t.ke))}</div></td>
      <td class="small">${itemsTf(t).map(x => `${esc(x.nama)} <span class="mono muted">${esc(x.kode)}</span> ×<b>${x.qty}</b>`).join('<br>')}<div class="rw-det">${pcsTf(t)} pcs${t.catatan ? ' · ' + esc(t.catatan) : ''}</div></td>
      <td class="small">${esc(fmtWaktu(t.tgl))}<div class="rw-det">${esc(t.pengirim || '')}</div></td>
      <td class="small">${s === 'diterima' ? `${esc(fmtWaktu(t.tglTerima || t.tgl))}<div class="rw-det">${esc(t.penerima || '')}</div>` : s === 'ditolak' ? `${esc(fmtWaktu(t.tglTolak))}<div class="rw-det">${esc(t.ditolakOleh || '')}: ${esc(t.alasanTolak || '')}</div>` : s === 'dibatalkan' ? `${esc(fmtWaktu(t.tglBatal))}<div class="rw-det">${esc(t.dibatalkanOleh || '')}: ${esc(t.alasanBatal || '')}</div>` : '<span class="muted">menunggu</span>'}${t.batal?.status === 'diminta' ? `<div class="rw-det">Diajukan ${esc(t.batal.oleh || '')}: ${esc(t.batal.alasan || '')}</div>` : ''}${t.batal?.status === 'ditolak' ? `<div class="rw-det">Pengajuan batal ditolak: ${esc(t.batal.catatanSuper || '')}</div>` : ''}</td>
      <td>${pillTf(t)}</td><td class="r"><span class="row" style="gap:4px;justify-content:flex-end;flex-wrap:wrap">${tombolAksi(t)}</span></td></tr>`;
  }).join('')}</tbody></table></div>`;
}

/* ---------- Aksi ---------- */
async function terima(t) {
  if (st.saving) return;
  if (!(await konfirmasi('Terima transfer ' + t.no + '?', `Dari <b>${esc(namaCabang(t.dari))}</b> · ${itemsTf(t).length} jenis part (${pcsTf(t)} pcs):<br>${itemsTf(t).map(x => esc(x.nama) + ' ×' + x.qty).join(', ')}<br><br>Pastikan barang fisik sudah dicek. Stok cabang ini langsung bertambah dan tercatat sebagai <b>Dari transfer</b>.<br><b>Jangan</b> catat barang ini lagi di Pembelian Stok.`, { ya: 'Ya, barang sudah diterima' }))) return;
  st.saving = true;
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db, 'transfer', t.id), ts = await tx.get(ref); if (!ts.exists() || ts.data().status !== 'dikirim') throw new Error('Transfer ini sudah diproses (' + (ts.data()?.status || 'tidak ada') + ')');
      const d = ts.data(), items = itemsTf(d), refs = items.map(x => doc(db, 'parts', x.kode)), snaps = await Promise.all(refs.map(r => tx.get(r)));
      snaps.forEach((s, i) => { if (!s.exists()) throw new Error('Part ' + items[i].kode + ' tidak ada di master'); tx.update(refs[i], { [stokField(d.ke)]: stokOf(s.data(), d.ke) + items[i].qty }); catatMutasi(tx, dataMutasi(d.ke, items[i].kode, items[i].nama, items[i].qty, 'transfer-masuk', d.no, 'dari ' + namaCabang(d.dari))); });
      tx.update(ref, { status: 'diterima', penerima: namaPetugas(), tglTerima: stamp(new Date()) });
    });
    toast('Transfer ' + t.no + ' diterima, stok bertambah'); berubah();
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}
async function tolak(t) {
  const alasan = await mintaCatatan('Tolak transfer ' + t.no, 'Isi alasan, mis. barang tidak sampai, jumlah kurang, salah kirim. Stok TIDAK berubah; cabang pengirim lalu menekan "Kembalikan ke stok".');
  if (alasan === null) return;
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db, 'transfer', t.id), ts = await tx.get(ref); if (ts.data()?.status !== 'dikirim') throw new Error('Transfer ini sudah diproses');
      tx.update(ref, { status: 'ditolak', alasanTolak: alasan, ditolakOleh: namaPetugas(), tglTolak: stamp(new Date()) });
    });
    toast('Transfer ' + t.no + ' ditolak. Cabang ' + namaCabang(t.dari) + ' akan mengembalikan stoknya.'); berubah();
  } catch (e) { toast(errMsg(e)); }
}
async function batalKirim(t) {
  if (st.saving) return;
  const ditolak = statusTf(t) === 'ditolak';
  const alasan = ditolak ? (t.alasanTolak ? 'Ditolak penerima: ' + t.alasanTolak : 'Ditolak penerima') : await mintaCatatan('Batalkan kirim ' + t.no, `Barang batal dikirim ke ${namaCabang(t.ke)}. Stok ${namaCabang(t.dari)} bertambah kembali ${pcsTf(t)} pcs.`);
  if (alasan === null) return;
  if (ditolak && !(await konfirmasi('Kembalikan stok ' + t.no + '?', `Transfer ditolak ${esc(namaCabang(t.ke))}${t.alasanTolak ? ': <i>' + esc(t.alasanTolak) + '</i>' : ''}.<br>Stok ${esc(namaCabang(t.dari))} bertambah kembali: ${itemsTf(t).map(x => esc(x.nama) + ' ×' + x.qty).join(', ')}.<br>Pastikan barangnya memang sudah kembali.`, { ya: 'Ya, kembalikan ke stok' }))) return;
  st.saving = true;
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db, 'transfer', t.id), ts = await tx.get(ref), d = ts.data();
      if (!['dikirim', 'ditolak'].includes(d?.status)) throw new Error('Transfer ini sudah ' + (d?.status || 'tidak ada'));
      const items = itemsTf(d), refs = items.map(x => doc(db, 'parts', x.kode)), snaps = await Promise.all(refs.map(r => tx.get(r)));
      snaps.forEach((s, i) => { if (!s.exists()) throw new Error('Part ' + items[i].kode + ' tidak ada di master'); tx.update(refs[i], { [stokField(d.dari)]: stokOf(s.data(), d.dari) + items[i].qty }); catatMutasi(tx, dataMutasi(d.dari, items[i].kode, items[i].nama, items[i].qty, 'transfer-kembali', d.no, (ditolak ? 'ditolak ' : 'batal kirim ke ') + namaCabang(d.ke) + ': ' + alasan)); });
      tx.update(ref, { status: 'dibatalkan', alasanBatal: alasan, dibatalkanOleh: namaPetugas(), tglBatal: stamp(new Date()) });
    });
    if (t.mintaNo) {   // permintaan barang terkait ikut ditandai
      try { const s = await getDocs(query(collection(db, 'mintaStok'), where('no', '==', t.mintaNo))); await Promise.all(s.docs.map(d => updateDoc(d.ref, { status: 'ditolak', alasanTolak: 'Transfer ' + t.no + ' dibatalkan: ' + alasan, tglBatal: stamp(new Date()) }))); } catch (e) { /* tidak wajib */ }
    }
    toast('Transfer ' + t.no + ' dibatalkan, stok kembali ke ' + namaCabang(t.dari)); berubah();
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}
async function ajukanBatal(t) {
  const alasan = await mintaCatatan('Ajukan pembatalan ' + t.no, `Transfer sudah diterima. Bila disetujui Super Admin: stok ${namaCabang(t.ke)} berkurang ${pcsTf(t)} pcs dan stok ${namaCabang(t.dari)} bertambah kembali. Pakai ini HANYA bila barang benar-benar dikembalikan / tidak pernah sampai. Bila stok dobel karena barang transfer juga dicatat di Pembelian, yang dibatalkan adalah PEMBELIANNYA.`);
  if (alasan === null) return;
  try { await updateDoc(doc(db, 'transfer', t.id), { batal: { status: 'diminta', alasan, oleh: namaPetugas(), tgl: stamp(new Date()), cabang: cabAktif() } }); toast('Pengajuan pembatalan ' + t.no + ' dikirim ke Super Admin'); berubah(); }
  catch (e) { toast(errMsg(e)); }
}
export async function setujuiBatalTransfer(t) {
  if (!st.petugas?.super || st.saving) return false;
  const catatan = await mintaCatatan('Batalkan transfer ' + t.no, `Stok ${namaCabang(t.ke)} −${pcsTf(t)} pcs, stok ${namaCabang(t.dari)} +${pcsTf(t)} pcs.${t.batal?.alasan ? ' Alasan pengaju: ' + t.batal.alasan : ''}`);
  if (catatan === null) return false;
  if (!(await mintaPassword('Batalkan transfer ' + t.no, 'Stok dikoreksi di dua cabang dan tercatat di kartu stok.'))) return false;
  st.saving = true;
  try {
    await runTransaction(db, async tx => {
      const ref = doc(db, 'transfer', t.id), ts = await tx.get(ref), d = ts.data();
      if (statusTf(d || {}) !== 'diterima' || !d.status) throw new Error('Hanya transfer berstatus Diterima yang bisa dibatalkan di sini');
      const items = itemsTf(d), refs = items.map(x => doc(db, 'parts', x.kode)), snaps = await Promise.all(refs.map(r => tx.get(r)));
      snaps.forEach((s, i) => { if (!s.exists()) throw new Error('Part ' + items[i].kode + ' tidak ada di master'); const ada = stokOf(s.data(), d.ke); if (ada < items[i].qty) throw new Error(`Stok ${s.data().nama} di ${namaCabang(d.ke)} tinggal ${ada}, kurang dari ${items[i].qty}. Lakukan stok opname dulu.`); });
      snaps.forEach((s, i) => {
        const cur = s.data(), x = items[i];
        tx.update(refs[i], { [stokField(d.ke)]: stokOf(cur, d.ke) - x.qty, [stokField(d.dari)]: stokOf(cur, d.dari) + x.qty });
        catatMutasi(tx, dataMutasi(d.ke, x.kode, x.nama, -x.qty, 'koreksi-transfer', d.no, 'batal transfer dari ' + namaCabang(d.dari) + ': ' + catatan));
        catatMutasi(tx, dataMutasi(d.dari, x.kode, x.nama, x.qty, 'koreksi-transfer', d.no, 'batal transfer ke ' + namaCabang(d.ke) + ': ' + catatan));
      });
      tx.update(ref, { status: 'dibatalkan', alasanBatal: catatan, dibatalkanOleh: namaPetugas(), tglBatal: stamp(new Date()), batal: { ...(d.batal || {}), status: 'disetujui', catatanSuper: catatan, disetujuiOleh: namaPetugas(), tglSetuju: stamp(new Date()) } });
    });
    toast('Transfer ' + t.no + ' dibatalkan, stok kedua cabang dikoreksi'); berubah(); return true;
  } catch (e) { toast(errMsg(e)); return false; } finally { st.saving = false; }
}
export async function tolakBatalTransfer(t) {
  if (!st.petugas?.super) return false;
  const c = await mintaCatatan('Tolak pengajuan pembatalan ' + t.no, 'Transfer tetap berstatus Diterima.'); if (c === null) return false;
  try { await updateDoc(doc(db, 'transfer', t.id), { 'batal.status': 'ditolak', 'batal.catatanSuper': c, 'batal.disetujuiOleh': namaPetugas(), 'batal.tglSetuju': stamp(new Date()) }); toast('Pengajuan ditolak'); berubah(); return true; }
  catch (e) { toast(errMsg(e)); return false; }
}

actions['tf-aksi'] = async el => {
  const t = cache.get(el.dataset.id) || tfMasuk.find(x => x.id === el.dataset.id); if (!t) { toast('Data transfer belum termuat, buka ulang halaman'); return; }
  const a = el.dataset.a;
  if (a === 'bast') { const m = await import('./stok.js'); return m.bukaBast(t); }
  if (a === 'detail') return detailTransfer(t);
  if (a === 'terima') return terima(t);
  if (a === 'tolak') return tolak(t);
  if (a === 'batal-kirim') return batalKirim(t);
  if (a === 'batal-ajukan') return ajukanBatal(t);
  if (a === 'batal-setuju') return setujuiBatalTransfer(t);
  if (a === 'batal-tolak') return tolakBatalTransfer(t);
};
export function detailTransfer(t) {
  ingatTransfer([t]);
  modal(`<div class="row spread"><h2>Transfer ${esc(t.no || t.id)}</h2><button class="btn sm ghost" type="button" data-close="1" aria-label="Tutup">✕</button></div>${tabelTransfer([t])}`, 'wide');
}
