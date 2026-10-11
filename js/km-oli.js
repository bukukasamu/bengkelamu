// Kilometer & jadwal ganti oli.
// - KM yang dicatat tidak boleh lebih kecil dari KM terakhir kendaraan itu (kecuali speedometer diganti, izin admin).
// - Setiap nota servis yang berisi oli mesin mencatat jadwal ganti oli berikutnya di data kendaraan (kendaraan.oli),
//   lalu muncul di menu Pengingat Servis (petugas) dan di halaman cek servis (konsumen).
// - Konsumen yang ganti oli di tempat lain dicatat petugas ("Sudah ganti di luar") supaya jadwalnya ikut bergeser.
import { S, st, namaPetugas } from './state.js';
import { db, doc, getDoc, setDoc } from './firebase.js';
import { dkey, stamp, esc, modal, closeModal, toast, errMsg } from './util.js';
import { nopolKey } from './cari-kendaraan.js';
import { pantauKey } from './wo-common.js';

export const angkaKm = v => { const d = String(v ?? '').replace(/\D/g, ''); return d ? +d : 0; };
export const fmtKm = n => n ? Math.round(n).toLocaleString('id-ID') : '';
const hariAntara = (a, b) => Math.round((new Date(String(b).slice(0, 10)) - new Date(String(a).slice(0, 10))) / 86400000);
const tambahHari = (t, n) => { const d = new Date(String(t).slice(0, 10) + 'T00:00'); d.setDate(d.getDate() + Math.round(n)); return dkey(d); };
export const tglPendek = t => t ? new Date(String(t).slice(0, 10) + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

/* ---------- KM terakhir ---------- */
// Dari: nota servis (yang sudah dimuat), work order lain kendaraan ini, dan data kendaraan (kmTerakhir saat bayar,
// km saat registrasi lain, oli.km bila ganti oli di luar). WO yang sedang diedit tidak ikut dihitung.
export async function kmTerakhir(nopol, kecualiNo = null) {
  const key = nopolKey(nopol); if (!key) return null;
  const c = [];
  let reset = '';   // speedometer diganti: KM sebelum tanggal ini tidak dipakai lagi
  const tambah = (km, tgl, asal, tetap) => { const n = angkaKm(km); if (n) c.push({ km: n, tgl: String(tgl || '').slice(0, 16), asal, tetap }); };
  (S.trxSemua?.length ? S.trxSemua : S.trx).forEach(t => { if (t.jenis === 'SERVIS' && t.wo !== kecualiNo && nopolKey(t.nopol) === key) tambah(t.km, t.tgl, 'nota ' + t.no); });
  (S.woSemua?.length ? S.woSemua : S.wo).forEach(w => { if (w.no !== kecualiNo && nopolKey(w.nopol) === key) { tambah(w.km, w.tgl, w.no, !!w.kmReset); if (w.kmReset?.tgl > reset) reset = w.kmReset.tgl; } });
  try {
    const s = await getDoc(doc(db, 'kendaraan', key));
    if (s.exists()) {
      const k = s.data();
      if (k.kmReset?.tgl > reset) reset = k.kmReset.tgl;
      tambah(k.kmTerakhir, k.servisTerakhir, 'servis terakhir');
      if (k.woTerakhir !== kecualiNo) tambah(k.km, k.updated, k.woTerakhir || 'data kendaraan');
      if (k.oli) tambah(k.oli.km, k.oli.tgl, k.oli.sumber === 'luar' ? 'ganti oli di luar' : 'ganti oli');
    }
  } catch (e) { /* tanpa data kendaraan tetap memakai data yang sudah dimuat */ }
  return c.filter(x => x.tetap || !reset || x.tgl >= reset).sort((a, b) => b.km - a.km)[0] || null;
}

/* ---------- Oli mesin ---------- */
// Kata utuh (\b) supaya mis. "YAMALUBE PREMIUM" tidak dianggap oli rem
const BUKAN_OLI_MESIN = /GARDAN|\bGEAR\b|TRANSMI|SHOCK|\bREM\b|BRAKE|COOLANT|RADIATOR|\bFORK\b|\bTUTUP\b|\bSEAL\b|PACKING|FILTER/i;
const OLI = /\bOLI\b|\bOIL\b|YAMALUBE/i;
export const isOliPart = x => { const p = S.map?.get?.(x.kode); const nm = (x.nama || p?.nama || '') + ' ' + (p?.kategori || ''); return OLI.test(nm) && !BUKAN_OLI_MESIN.test(x.nama || p?.nama || ''); };
export const isOliJasa = j => OLI.test(j.nama || '') && !BUKAN_OLI_MESIN.test(j.nama || '');
export const adaGantiOli = t => (t.items || []).some(isOliPart) || (t.jasa || []).some(isOliJasa);

export const aturanOli = () => ({ km: 2000, hari: 60, ...(S.settings?.pengingatOli || {}) });

// Jadwal berikutnya: mana yang lebih dulu, (tgl + N hari) atau perkiraan tanggal KM tercapai dari rata-rata KM per hari.
export function jadwalOli(skrg, lalu, aturan = aturanOli()) {
  const km = angkaKm(skrg.km), tgl = String(skrg.tgl).slice(0, 10);
  let rata = null;
  const kmLalu = angkaKm(lalu?.km), tglLalu = lalu?.tgl ? String(lalu.tgl).slice(0, 10) : '';
  if (km && kmLalu && tglLalu && km > kmLalu) { const h = hariAntara(tglLalu, tgl); if (h >= 14) rata = Math.min(300, Math.max(3, (km - kmLalu) / h)); }
  let tglBerikut = tambahHari(tgl, aturan.hari);
  if (km && rata) { const t2 = tambahHari(tgl, aturan.km / rata); if (t2 < tglBerikut) tglBerikut = t2; }
  return { tgl, km: km || '', kmBerikut: km ? km + aturan.km : '', tglBerikut, rataKmHari: rata ? Math.round(rata) : null };
}

// Semua kolom selalu ditulis (null bila tidak ada): set(..., {merge:true}) menggabungkan isi map,
// jadi kolom lama (mis. nomor nota ganti oli sebelumnya) harus ditimpa supaya tidak tertinggal.
const KOLOM_OLI = ['tgl', 'km', 'kmBerikut', 'tglBerikut', 'rataKmHari', 'sumber', 'nota', 'cabang', 'ket', 'dicatat', 'tglCatat'];
export const oliLengkap = o => Object.fromEntries(KOLOM_OLI.map(k => [k, o[k] ?? null]));

// Status untuk tampilan: { kelas, teks, sisaHari }
export function statusOli(oli, kmSekarang = 0) {
  if (!oli?.tglBerikut) return null;
  const sisa = hariAntara(dkey(new Date()), oli.tglBerikut), lewatKm = kmSekarang && oli.kmBerikut && angkaKm(kmSekarang) >= angkaKm(oli.kmBerikut);
  if (sisa < 0 || lewatKm) return { kelas: 'p-bad', teks: lewatKm ? 'KM sudah lewat jadwal' : `Lewat ${-sisa} hari`, sisa };
  if (sisa <= 7) return { kelas: 'p-warn', teks: sisa ? `${sisa} hari lagi` : 'Hari ini', sisa };
  return { kelas: 'p-good', teks: `${sisa} hari lagi`, sisa };
}
export const teksJadwal = oli => oli?.tglBerikut ? `±${tglPendek(oli.tglBerikut)}${oli.kmBerikut ? ' atau KM ' + fmtKm(angkaKm(oli.kmBerikut)) : ''}` : '';

// Data oli untuk disimpan di nota & kendaraan saat pembayaran servis (dipanggil di dalam transaksi bayar)
export function oliDariNota(trx, kendLama) {
  if (!adaGantiOli(trx)) return null;
  const lalu = kendLama?.oli?.tgl ? { km: kendLama.oli.km, tgl: kendLama.oli.tgl } : (kendLama?.servisTerakhir ? { km: kendLama.kmTerakhir, tgl: kendLama.servisTerakhir } : null);
  return oliLengkap({ ...jadwalOli({ km: trx.km, tgl: trx.tgl }, lalu), sumber: 'bengkel', nota: trx.no, cabang: trx.cabang || '' });
}

// Salinan jadwal oli ke halaman cek servis konsumen
export async function oliKePantau(nopol, hp, oli) {
  try {
    const key = await pantauKey(nopol, hp); if (!key) return;
    const ref = doc(db, 'pantau', key), s = await getDoc(ref);
    if (s.exists()) await setDoc(ref, { oli: oli || null }, { merge: true });
  } catch (e) { console.warn('Jadwal oli ke cek servis', e); }
}

/* ---------- Konsumen ganti oli di tempat lain ---------- */
// Dipakai di Pengingat Servis & Registrasi. onSelesai(oliBaru) dipanggil setelah tersimpan.
export async function catatOliLuar(nopol, onSelesai) {
  const key = nopolKey(nopol); if (!key) return;
  let k = {};
  try { const s = await getDoc(doc(db, 'kendaraan', key)); k = s.exists() ? s.data() : {}; } catch (e) { toast(errMsg(e)); return; }
  const akhir = await kmTerakhir(nopol);
  modal(`<h3>Ganti oli di tempat lain · ${esc(k.nopol || nopol)}</h3>
    <p class="small" style="margin:0">Isi sesuai keterangan konsumen. Jadwal pengingat berikutnya dihitung ulang dari data ini.${akhir ? ` KM terakhir tercatat: <b>${fmtKm(akhir.km)}</b> (${esc(tglPendek(akhir.tgl))}).` : ''}</p>
    <div class="grid g2" style="gap:10px"><label class="f" for="ol-tgl">Tanggal ganti oli<input id="ol-tgl" type="date" value="${dkey(new Date())}" max="${dkey(new Date())}"></label>
    <label class="f" for="ol-km">KM saat ganti oli (bila tahu)<input id="ol-km" data-num placeholder="${akhir ? 'min. ' + fmtKm(akhir.km) : 'mis. 12.500'}"></label></div>
    <label class="f" for="ol-ket">Keterangan<input id="ol-ket" data-nocaps placeholder="mis. ganti di bengkel dekat rumah, info via WA"></label>
    <div class="err" id="ol-err" hidden></div>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Batal</button><button class="btn pri" type="button" id="ol-ok">Simpan</button></div>`);
  document.getElementById('ol-ok').onclick = async () => {
    const tgl = document.getElementById('ol-tgl').value, km = angkaKm(document.getElementById('ol-km').value), ket = document.getElementById('ol-ket').value.trim();
    const err = m => { const e = document.getElementById('ol-err'); e.hidden = false; e.textContent = m; };
    if (!tgl) return err('Isi tanggal');
    if (km && akhir && km < akhir.km) return err(`KM tidak boleh lebih kecil dari KM terakhir (${fmtKm(akhir.km)}).`);
    const lalu = k.oli?.tgl ? k.oli : (k.servisTerakhir ? { km: k.kmTerakhir, tgl: k.servisTerakhir } : null);
    const oli = oliLengkap({ ...jadwalOli({ km, tgl }, lalu), sumber: 'luar', ket, dicatat: namaPetugas(), tglCatat: stamp(new Date()), cabang: k.oli?.cabang || st.cabang || '' });
    try {
      await setDoc(doc(db, 'kendaraan', key), { oli, pengingat: null, ...(km > angkaKm(k.km) ? { km: String(km) } : {}) }, { merge: true });
      oliKePantau(k.nopol || nopol, k.hp, oli);
      closeModal(); toast(`Jadwal oli ${k.nopol || nopol} diperbarui: berikutnya ${teksJadwal(oli)}`);
      onSelesai?.(oli);
    } catch (e) { err(errMsg(e)); }
  };
}
