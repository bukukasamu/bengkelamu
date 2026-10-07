// Fungsi bersama untuk work order (WO) servis: hitung biaya, tampilan ringkas, simpan.
import { esc, rp, clone, stamp, waButton, waNumber } from './util.js';
import { APP_NAME } from './config.js';
import { S, part, mekanikById, namaPetugas } from './state.js';
import { db, doc, getDoc, setDoc, runTransaction, updateDoc } from './firebase.js';
import { counterRef, nextNumber } from './numbering.js';

// Antri = belum ada mekanik · Dikerjakan = mekanik sedang mengerjakan (mekanik sibuk)
// Ditunda = lanjut lama, mis. menunggu part (mekanik bebas lagi) · Selesai = menunggu bayar · Lunas = sudah dibayar
export const STATUS = { Antri: 'p-warn', Dikerjakan: 'p-info', Ditunda: 'p-bad', Selesai: 'p-good', Lunas: 'p-good' };
export const statusPill = s => `<span class="pill ${STATUS[s] || 'p-info'}">${esc(s)}</span>`;
export const AKTIF = ['Antri', 'Dikerjakan', 'Ditunda', 'Selesai'];

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
    <span class="row spread"><span class="np">${esc(o.nopol)}</span>${statusPill(o.status)}</span>
    <span>${esc(o.tipe)} · ${esc(o.nama || '–')}</span>
    <span class="row spread small muted"><span>${esc(o.no)} · ${o.tgl.slice(5).replace('-', '/')} · ${esc(mekanikNama(o) || 'belum ada mekanik')}</span>${jenisBadge(o)}</span>
  </button>`;
}

export function woHeader(w) {
  return `<div class="note"><div class="row spread"><b class="mono">${esc(w.nopol)}</b><span class="row">${jenisBadge(w)}${statusPill(w.status)}</span></div>
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
      tx.set(counterRef(), counter);
      tx.set(doc(db, 'wo', no), { ...clone({ ...w, no }), dibuatOleh: namaPetugas() });
      return no;
    });
  }
  const { no, ...data } = clone(w);
  await updateDoc(doc(db, 'wo', no), data);
  return no;
}
export const updateWo = (no, patch) => updateDoc(doc(db, 'wo', no), clone(patch));
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
const ringkasWo = w => ({ no: w.no, tgl: w.tgl, status: w.status, tipe: w.tipe, km: w.km || '', jenisServis: w.jenisServis || 'Reguler', ksgKe: w.ksgKe || '', keluhan: w.keluhan || '', mekanik: mekanikNama(w), log: w.log || [],
  jasa: normJasa(w).map(j => j.nama), parts: (w.parts || []).map(x => ({ nama: part(x.kode)?.nama || x.kode, qty: x.qty })), estimasi: woCalc(w).total, alasanTunda: w.alasanTunda || '' });
// Dipanggil setelah WO disimpan / status berubah / dibayar. Gagal di sini tidak membatalkan pekerjaan kasir.
export async function syncPantau(w, trx) {
  try {
    const key = await pantauKey(w.nopol, w.hp); if (!key) return;
    const ref = doc(db, 'pantau', key), s = await getDoc(ref), cur = s.exists() ? s.data() : {};
    const riwayat = (cur.riwayat || []).filter(r => !trx || r.no !== trx.no);
    if (trx) riwayat.unshift({ ...trx, km: w.km || '', waktu: durasi(w), dibuat: null });
    const aktif = AKTIF.includes(w.status) ? ringkasWo(w) : (cur.aktif && cur.aktif.no !== w.no ? cur.aktif : null);
    await setDoc(ref, { nopol: w.nopol, tipe: w.tipe || '', nama: w.nama || '', updated: stamp(new Date()), aktif, riwayat: riwayat.slice(0, 12) });
  } catch (e) { console.warn('Gagal memperbarui data cek servis', e); }
}
