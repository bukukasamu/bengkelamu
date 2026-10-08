// Fungsi bersama untuk work order (WO) servis: hitung biaya, tampilan ringkas, simpan.
import { esc, rp, clone, stamp, waButton, waNumber, toast } from './util.js';
import { APP_NAME } from './config.js';
import { S, part, mekanikById, namaPetugas, idPetugas, can } from './state.js';
import { db, doc, getDoc, getDocs, setDoc, runTransaction, updateDoc, collection, query, where } from './firebase.js';
import { counterRef, nextNumber } from './numbering.js';
import { cabAktif, cabangOf, namaCabang, layarDocId, multiCabang } from './cabang.js';

// Antri = belum ada mekanik · Dikerjakan = mekanik sedang mengerjakan (mekanik sibuk)
// Ditunda = lanjut lama, mis. menunggu part (mekanik bebas lagi) · Selesai = menunggu bayar · Lunas = sudah dibayar
export const STATUS = { Antri: 'p-warn', Dikerjakan: 'p-info', Ditunda: 'p-bad', Selesai: 'p-good', Lunas: 'p-good' };
export const statusPill = s => `<span class="pill ${STATUS[s] || 'p-info'}">${esc(s)}</span>`;
export const AKTIF = ['Antri', 'Dikerjakan', 'Ditunda', 'Selesai'];
// Nomor antrian harian (mulai 001 tiap hari), diberikan saat motor didaftarkan
export const fmtAntri = n => n ? String(n).padStart(3, '0') : '';
export const antriBadge = w => w.antrian ? `<span class="antri-no" title="Nomor antrian ${esc(w.antrianTgl || '')}">${fmtAntri(w.antrian)}</span>` : '';
export const kurangBadge = w => w.dataKurang ? '<span class="badge b-kurang">Data belum lengkap</span>' : '';

// Data lama menyimpan jasa sebagai nama saja; ubah ke {nama, harga}
export const normJasa = w => (w.jasa || []).map(j => typeof j === 'string' ? { nama: j, harga: S.jasa.find(x => x.nama === j)?.harga || 0 } : j);

export const jenisBadge = w => w.jenisServis === 'KSG' ? `<span class="badge b-ksg">KSG${w.ksgKe ? ' ke-' + w.ksgKe : ''}</span>`
  : w.jenisServis === 'KSB' ? '<span class="badge b-ksb">KSB</span>' : '<span class="badge b-reg">Reguler</span>';
export const jenisText = w => w.jenisServis === 'KSG' ? 'KSG' + (w.ksgKe ? ' ke-' + w.ksgKe : '') : w.jenisServis === 'KSB' ? 'KSB' : 'Reguler';

// Tarif klaim KSG dari main dealer: Master Data → Tarif KSG (per tipe motor, KSG ke-1..4)
export const tarifKsg = w => +(S.settings.ksgTarif?.[w.tipe]?.[(+w.ksgKe || 0) - 1] || 0);

// KSG: jasa tidak ditagih ke konsumen; nilai klaim = tarif main dealer. Sparepart & biaya tambahan tetap ditagih.
export function woCalc(w) {
  const parts = (w.parts || []).reduce((a, x) => a + x.qty * (part(x.kode)?.jual || 0), 0);
  const jasa = normJasa(w).reduce((a, j) => a + (+j.harga || 0), 0);
  const biaya = (w.biaya || []).reduce((a, b) => a + (+b.jumlah || 0), 0);
  const ksg = w.jenisServis === 'KSG';
  const jasaTagih = ksg ? 0 : jasa;
  return { parts, jasa, jasaTagih, klaim: ksg ? tarifKsg(w) : 0, biaya, total: parts + jasaTagih + biaya };
}

// Part yang sudah diorder untuk servis yang belum dibayar (stok baru dipotong saat bayar)
export function dipesan(kode, kecualiNo) {
  return S.wo.filter(w => AKTIF.includes(w.status) && w.no !== kecualiNo).reduce((a, w) => a + (w.parts || []).filter(x => x.kode === kode).reduce((b, x) => b + x.qty, 0), 0);
}

export const mekanikNama = w => (w.mekanikId && mekanikById(w.mekanikId)?.nama) || w.mekanik || '';

// Mekanik hanya mengerjakan 1 motor. Sibuk = punya WO berstatus Dikerjakan.
// Mekanik bebas lagi setelah kasir menandai motornya Selesai atau Ditunda (lanjut lama).
export function sibukMap() {
  const m = {};
  S.wo.filter(w => w.status === 'Dikerjakan' && (w.mekanikId || w.mekanik)).forEach(w => { m[w.mekanikId || w.mekanik] = w; });
  return m;
}
export const sibukOleh = (mek, kecualiNo) => { const w = sibukMap()[mek.id] || sibukMap()[mek.nama]; return w && w.no !== kecualiNo ? w : null; };

export function woCard(o, current, act = 'pick-wo') {
  return `<button class="wo" type="button" data-act="${act}" data-no="${esc(o.no)}" aria-current="${o.no === current}">
    <span class="row spread"><span class="row" style="gap:8px">${antriBadge(o)}<span class="np">${esc(o.nopol)}</span></span>${statusPill(o.status)}</span>
    <span>${esc(o.tipe || '–')} · ${esc(o.nama || '–')} ${kurangBadge(o)}</span>
    <span class="row spread small muted"><span>${esc(o.no)} · ${o.tgl.slice(5).replace('-', '/')} · ${esc(mekanikNama(o) || 'belum ada mekanik')}</span>${jenisBadge(o)}</span>
  </button>`;
}

export function woHeader(w) {
  return `<div class="note"><div class="row spread"><span class="row" style="gap:8px">${antriBadge(w)}<b class="mono">${esc(w.nopol)}</b>${can('riwayat') ? `<button class="btn sm ghost" type="button" data-act="rw-buka" data-np="${esc(w.nopol)}">Riwayat motor</button>` : ''}</span><span class="row">${jenisBadge(w)}${statusPill(w.status)}</span></div>
    <div>${esc(w.tipe)}${w.km ? ' · ' + esc(w.km) + ' km' : ''} · ${esc(w.nama || 'Umum')}${w.hp ? ' · ' + esc(w.hp) + ' ' + waButton(w.hp, `Halo ${w.nama || 'Bapak/Ibu'}, kami dari ${APP_NAME} mengenai motor ${w.nopol} (${w.no}). `) : ''}</div>
    <div class="small muted">Mekanik: ${esc(mekanikNama(w) || 'belum ditentukan')}${w.noKartu ? ' · No. kartu ' + esc(w.noKartu) : ''}</div>
    ${w.keluhan ? `<div class="small" style="margin-top:4px"><b>Keluhan:</b> ${esc(w.keluhan)}</div>` : ''}
    ${w.catatanPart ? `<div class="small"><b>Permintaan mekanik:</b> ${esc(w.catatanPart)}</div>` : ''}</div>`;
}

export function partsTable(w, removeAct) {
  if (!(w.parts || []).length) return '<div class="small muted">Belum ada order sparepart.</div>';
  return `<div class="tw"><table><thead><tr><th>Part</th><th class="r">Qty</th><th class="r">Stok</th><th class="r">Jumlah</th>${removeAct ? '<th></th>' : ''}</tr></thead><tbody>${w.parts.map((x, i) => {
    const p = part(x.kode) || { nama: x.kode + ' (tidak ada di master)', jual: 0, stok: 0 };
    return `<tr><td>${esc(p.nama)}<br><span class="small muted mono">${esc(x.kode)}</span></td><td class="r num">${x.qty}</td><td class="r">${p.stok < x.qty ? `<span class="pill p-bad">${p.stok}</span>` : `<span class="num">${p.stok}</span>`}</td><td class="r num">${rp(p.jual * x.qty)}</td>${removeAct ? `<td><button class="btn sm ghost" type="button" data-act="${removeAct}" data-i="${i}" aria-label="Hapus">✕</button></td>` : ''}</tr>`;
  }).join('')}</tbody></table></div>`;
}

// Simpan WO baru (nomor otomatis) atau perbarui WO yang sudah ada.
export async function saveWo(w) {
  if (!w.no) {
    return await runTransaction(db, async tx => {
      const cs = await tx.get(counterRef());
      const { no, counter } = nextNumber(cs, 'WO');
      // nomor antrian harian ikut dibuat di transaksi yang sama supaya tidak pernah kembar
      counter.AN = (counter.AN || 0) + 1; w.antrian = counter.AN; w.antrianTgl = counter.day;
      tx.set(counterRef(), counter);
      tx.set(doc(db, 'wo', no), { ...clone({ ...w, no, cabang: w.cabang || cabAktif(), bulan: String(w.tgl || stamp(new Date())).slice(0, 7), aktif: AKTIF.includes(w.status) }), dibuatOleh: namaPetugas(), dibuatOlehId: idPetugas() });
      return no;
    });
  }
  const { no, ...data } = clone(w);
  if ('status' in data) data.aktif = AKTIF.includes(data.status);
  await updateDoc(doc(db, 'wo', no), data);
  return no;
}
// aktif = masih di bengkel; dipakai untuk memuat WO aktif per cabang tanpa indeks tambahan
export const updateWo = (no, patch) => updateDoc(doc(db, 'wo', no), clone('status' in patch ? { ...patch, aktif: AKTIF.includes(patch.status) } : patch));
export const findWo = no => S.wo.find(x => x.no === no);

/* ---------- Catatan waktu servis ----------
   Setiap perubahan status disimpan di w.log = [{ s: status, t: 'YYYY-MM-DD HH:MM', o: petugas }].
   Lama kerja = jumlah waktu berstatus Dikerjakan (waktu Ditunda tidak dihitung). */
export const logStatus = (log, s) => [...(log || []), { s, t: stamp(new Date()), o: namaPetugas() }];
const toDate = t => new Date(String(t).replace(' ', 'T'));
export function durasi(w) {
  const log = [...(w.log || [])];
  if (!log.length) return null;
  let kerja = 0, tunda = 0, mulai = null, selesai = null;
  for (let i = 0; i < log.length; i++) {
    const a = log[i], end = log[i + 1] ? toDate(log[i + 1].t) : new Date();
    const m = Math.max(0, (end - toDate(a.t)) / 60000);
    if (a.s === 'Dikerjakan') { kerja += m; if (!mulai) mulai = a.t; }
    if (a.s === 'Ditunda') tunda += m;
    if (a.s === 'Selesai' && !selesai) selesai = a.t;
    if (a.s === 'Selesai' || a.s === 'Lunas') break;   // setelah selesai tidak dihitung lagi
  }
  const masuk = log[0].t;
  return {
    masuk, mulai, selesai,
    kerja: Math.round(kerja), tunda: Math.round(tunda),
    tunggu: mulai ? Math.round((toDate(mulai) - toDate(masuk)) / 60000) : null,
    total: selesai ? Math.round((toDate(selesai) - toDate(masuk)) / 60000) : null
  };
}
export const fmtDur = m => m == null ? '–' : m < 60 ? `${m} mnt` : m < 1440 ? `${Math.floor(m / 60)} j ${m % 60} mnt` : `${Math.floor(m / 1440)} hr ${Math.floor((m % 1440) / 60)} j`;
const jam = t => t ? String(t).slice(11, 16) : '';
export function timelineHTML(w) {
  const d = durasi(w); if (!d) return '';
  return `<div class="timeline">${(w.log || []).map(l => `<span class="tl"><b>${esc(l.s)}</b> ${esc(l.t.slice(5, 10).replace('-', '/'))} ${esc(jam(l.t))}</span>`).join('<span class="tl-sep">→</span>')}</div>
    <div class="small muted">Tunggu mekanik ${fmtDur(d.tunggu)} · Lama dikerjakan ${fmtDur(d.kerja)}${d.tunda ? ' · Ditunda ' + fmtDur(d.tunda) : ''}${d.total != null ? ' · Masuk s/d selesai ' + fmtDur(d.total) : ''}</div>`;
}

/* ---------- Data untuk halaman cek servis konsumen ----------
   Dokumen pantau/{kunci}, kunci = SHA-256 dari "NOPOL|62NOMORHP". Hanya bisa dibuka oleh yang tahu nopol + nomor HP. */
export async function pantauKey(nopol, hp) {
  const n = waNumber(hp), k = String(nopol || '').replace(/\s+/g, '').toUpperCase();
  if (!n || !k) return '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(k + '|' + n));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const ringkasWo = w => ({ no: w.no, cabang: namaCabang(cabangOf(w)), antrian: fmtAntri(w.antrian), tgl: w.tgl, status: w.status, tipe: w.tipe, km: w.km || '', jenisServis: w.jenisServis || 'Reguler', ksgKe: w.ksgKe || '', keluhan: w.keluhan || '', mekanik: mekanikNama(w), log: w.log || [],
  jasa: normJasa(w).map(j => j.nama), parts: (w.parts || []).map(x => ({ nama: part(x.kode)?.nama || x.kode, qty: x.qty })),
  biaya: (w.biaya || []).filter(b => b.jumlah).map(b => ({ ket: b.ket, jumlah: b.jumlah })), diskon: w.diskon || 0,
  estimasi: Math.max(0, woCalc(w).total - (w.diskon || 0)), alasanTunda: w.alasanTunda || '' });
// Dipanggil setelah WO disimpan / status berubah / dibayar. Gagal di sini tidak membatalkan pekerjaan kasir.
export async function syncPantau(w, trx) {
  syncLayar(w);
  try {
    const key = await pantauKey(w.nopol, w.hp); if (!key) return;
    const ref = doc(db, 'pantau', key), s = await getDoc(ref), cur = s.exists() ? s.data() : {};
    const riwayat = (cur.riwayat || []).filter(r => !trx || r.no !== trx.no);
    if (trx) riwayat.unshift({ ...trx, km: w.km || '', waktu: durasi(w), dibuat: null });
    const aktif = AKTIF.includes(w.status) ? ringkasWo(w) : (cur.aktif && cur.aktif.no !== w.no ? cur.aktif : null);
    await setDoc(ref, { nopol: w.nopol, tipe: w.tipe || '', nama: w.nama || '', updated: stamp(new Date()), aktif, riwayat: riwayat.slice(0, 12) });
  } catch (e) { pantauGagal(e); }
}
let warned = false;
function pantauGagal(e) {
  console.warn('Gagal memperbarui data cek servis', e);
  if (!warned && e && e.code === 'permission-denied') { warned = true; toast('Data cek servis konsumen gagal disimpan. Admin: publish ulang firestore.rules (versi 2.3.0).'); }
}

// Bangun ulang data cek servis dari work order & nota yang sudah ada (mis. servis sebelum versi 2.3.0).
// onProgress(n, total) dipanggil per kendaraan. Mengembalikan jumlah kendaraan yang ditulis.
export async function rebuildPantau(onProgress) {
  const grup = new Map();
  for (const w of (S.woSemua || S.wo)) {
    const key = await pantauKey(w.nopol, w.hp); if (!key) continue;
    const g = grup.get(key) || { wo: [] }; g.wo.push(w); grup.set(key, g);
  }
  let n = 0;
  for (const [key, g] of grup) {
    const wos = g.wo.sort((a, b) => a.tgl.localeCompare(b.tgl)), last = wos[wos.length - 1];
    const byNo = new Map(wos.map(w => [w.no, w]));
    const snap = await getDocs(query(collection(db, 'trx'), where('nopol', '==', last.nopol)));
    const riwayat = snap.docs.map(d => d.data()).filter(t => t.jenis === 'SERVIS')
      .sort((a, b) => b.tgl.localeCompare(a.tgl)).slice(0, 12)
      .map(t => { const w = byNo.get(t.wo) || {}; return { ...t, hp: t.hp || w.hp || '', km: t.km || w.km || '', tipe: t.tipe || w.tipe || '', waktu: t.waktu || (w.log ? durasi(w) : null), dibuat: null }; });
    const akt = [...wos].reverse().find(w => AKTIF.includes(w.status));
    await setDoc(doc(db, 'pantau', key), { nopol: last.nopol, tipe: last.tipe || '', nama: last.nama || '', updated: stamp(new Date()), aktif: akt ? ringkasWo(akt) : null, riwayat });
    onProgress?.(++n, grup.size);
  }
  return n;
}

/* ---------- Layar TV di ruang tunggu (layar.html) ----------
   Dokumen publik/layar berisi ringkasan yang aman ditampilkan: nomor antrian, nopol, tipe, mekanik.
   Tanpa nama konsumen, no. HP, maupun biaya. Ditulis oleh aplikasi petugas setiap ada perubahan servis. */
const urutAntri = w => (w.antrianTgl || String(w.tgl || '').slice(0, 10)) + String(w.antrian || 9999).padStart(4, '0') + (w.tgl || '');
const itemLayar = w => ({ a: fmtAntri(w.antrian), nopol: w.nopol || '', tipe: w.tipe || '', mek: w.status === 'Dikerjakan' ? mekanikNama(w) : '', tunda: w.status === 'Ditunda' });
export function dataLayar(list) {
  const aktif = list.filter(w => AKTIF.includes(w.status) && w.nopol).sort((a, b) => urutAntri(a).localeCompare(urutAntri(b)));
  return {
    dikerjakan: aktif.filter(w => w.status === 'Dikerjakan').map(itemLayar),
    menunggu: aktif.filter(w => w.status === 'Antri' || w.status === 'Ditunda').map(itemLayar),
    siap: aktif.filter(w => w.status === 'Selesai').map(itemLayar),
    updated: stamp(new Date())
  };
}
// Ditunda sebentar supaya beberapa perubahan beruntun cukup ditulis sekali.
// "terbaru" = WO yang barusan diubah (dipakai bila daftar S.wo belum ikut ter-update).
let layarTimer = null; const layarBaru = new Map();
export function syncLayar(terbaru, segera) {
  if (terbaru?.no) layarBaru.set(terbaru.no, { ...terbaru });
  clearTimeout(layarTimer);
  const run = async () => {
    const cab = cabAktif();
    const list = S.wo.map(w => layarBaru.has(w.no) ? { ...w, ...layarBaru.get(w.no) } : w);
    layarBaru.forEach((b, no) => { if (!list.find(w => w.no === no)) list.push(b); });
    layarBaru.clear();
    try { await setDoc(doc(db, 'publik', layarDocId(cab)), dataLayar(list.filter(w => cabangOf(w) === cab)), { merge: true }); }
    catch (e) { console.warn('Gagal memperbarui layar TV', e); }
  };
  if (segera) return run();
  layarTimer = setTimeout(run, 700);
}
// Panggil nomor antrian ke layar TV (bunyi + suara). Dipanggil otomatis saat motor ditandai Selesai.
export async function panggilLayar(w, ke = 'KASIR') {
  const ref = doc(db, 'publik', layarDocId(cabangOf(w)));
  const s = await getDoc(ref), lama = (s.exists() && s.data().panggil) || [];
  const p = { id: Date.now() + '-' + Math.random().toString(36).slice(2, 6), a: fmtAntri(w.antrian), nopol: w.nopol, tipe: w.tipe || '', ke, t: stamp(new Date()) };
  await setDoc(ref, { panggil: [p, ...lama.filter(x => x.nopol !== w.nopol)].slice(0, 6) }, { merge: true });
  return p;
}
