// Database konsumen (pelanggan) — terpisah dari kendaraan, lalu disambungkan.
//   konsumen/{id}  = data KTP (nama, NIK, HP, alamat) + motor: [nopolKey…]
//   kendaraan/{nopolKey}.konsumenId = pemilik sekarang. Data KTP pemilik tetap disalin ke data kendaraan
//   (supaya cek servis, pengingat, export, dan nota lama tetap bekerja); setiap perubahan konsumen ikut
//   diterapkan ke semua motornya. Semua perubahan data pribadi tercatat di ubahKonsumen (siapa, kapan, lama → baru).
// Penanda konsumen: no. HP (dan NIK bila diisi). Nama hanya untuk mencari.
import { db, doc, getDoc, getDocs, setDoc, updateDoc, collection, query, where, limit, orderBy, writeBatch, arrayUnion, arrayRemove } from './firebase.js';
import { S, st, namaPetugas } from './state.js';
import { stamp, waNumber } from './util.js';
import { WIL_FIELDS } from './wilayah.js';
import { bedaKonsumen, simpanDenganCatatan } from './log-konsumen.js';
import { pindahPantauKunci, AKTIF } from './wo-common.js';
import { nopolKey } from './cari-kendaraan.js';

export const KTP = ['nik', 'nama', 'tempatLahir', 'tglLahir', 'jk', 'pekerjaan', 'hp', 'rtrw', ...WIL_FIELDS];
export const ambilKtp = o => Object.fromEntries(KTP.map(f => [f, String(o?.[f] ?? '').trim()]));
const hpAwal = d => d.startsWith('0') ? '62' + d.slice(1) : d.startsWith('8') ? '62' + d : d;

export async function ambilKonsumen(id) {
  if (!id) return null;
  const s = await getDoc(doc(db, 'konsumen', id));
  return s.exists() ? { id, ...s.data() } : null;
}
// Konsumen yang memakai no. HP / NIK ini (penanda), selain kecualiId
export async function konsumenGanda({ hp, nik }, kecualiId = '') {
  const hn = waNumber(hp), qs = [];
  if (hn) qs.push(getDocs(query(collection(db, 'konsumen'), where('hpNorm', '==', hn), limit(10))));
  if (/^\d{16}$/.test(nik || '')) qs.push(getDocs(query(collection(db, 'konsumen'), where('nik', '==', nik), limit(10))));
  const m = new Map();
  (await Promise.all(qs)).forEach(s => s.docs.forEach(d => { const k = { id: d.id, ...d.data() }; if (k.id !== kecualiId && !k.digabungKe && !k.dihapus) m.set(k.id, k); }));
  const list = [...m.values()];
  return { list, byHp: list.filter(k => hn && k.hpNorm === hn), byNik: list.filter(k => nik && k.nik === nik) };
}
// Cari konsumen: nama / no. HP / NIK, boleh sebagian depan
export async function cariKonsumen(teks) {
  const raw = String(teks || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (raw.replace(/\s/g, '').length < 3) return null;
  const digit = raw.replace(/\D/g, ''), hanyaAngka = /^[\d\s.\-+]+$/.test(raw);
  const awalan = (f, v) => getDocs(query(collection(db, 'konsumen'), where(f, '>=', v), where(f, '<=', v + ''), limit(12))).catch(() => ({ docs: [] }));
  const qs = hanyaAngka ? [digit.length >= 4 ? awalan('hpNorm', hpAwal(digit)) : null, digit.length >= 4 ? awalan('nik', digit) : null] : [awalan('nama', raw)];
  const m = new Map();
  (await Promise.all(qs.filter(Boolean))).forEach(s => s.docs.forEach(d => { const k = { id: d.id, ...d.data() }; if (!k.digabungKe && !k.dihapus) m.set(k.id, k); }));
  return [...m.values()].slice(0, 15);
}
export async function konsumenTerbaru(n = 50) {
  const s = await getDocs(query(collection(db, 'konsumen'), orderBy('updated', 'desc'), limit(n)));
  return s.docs.map(d => ({ id: d.id, ...d.data() })).filter(k => !k.digabungKe);
}
export async function motorKonsumen(k) {
  const ids = [...new Set(k?.motor || [])];
  const docs = await Promise.all(ids.map(id => getDoc(doc(db, 'kendaraan', id)).catch(() => null)));
  return docs.filter(d => d?.exists()).map(d => ({ id: d.id, ...d.data() })).filter(m => m.konsumenId === k.id && !m.pindahKe);
}

/* ---------- Tulis ---------- */
export async function buatKonsumen(data, sumber = '', extra = {}) {
  const ref = doc(collection(db, 'konsumen')), tgl = stamp(new Date());
  const ktp = ambilKtp(data);
  await setDoc(ref, { ...ktp, hpNorm: waNumber(ktp.hp), motor: [], dibuat: tgl, updated: tgl, dibuatOleh: namaPetugas(), sumber, ...extra });
  return ref.id;
}
const logRef = () => doc(collection(db, 'ubahKonsumen'));
const isiLog = (konsumenId, nama, ubah, sumber, nopol = '', kendaraanId = '') => {
  const tgl = stamp(new Date());
  return { konsumenId, kendaraanId, nopol, nama: nama || '', tgl, bulan: tgl.slice(0, 7), oleh: namaPetugas(), olehEmail: st.petugas?.email || '', peran: st.petugas?.super ? 'super' : st.role, sumber, ubah };
};
// Ubah data konsumen (dicatat) lalu terapkan ke semua motornya, servis yang masih berjalan, dan cek servis.
// lama = data konsumen sekarang; baru = data KTP baru. kecuali = nopolKey yang ditulis sendiri oleh pemanggil.
export async function ubahKonsumen(lama, baru, sumber, { kecuali = '', tambahan = {} } = {}) {
  const { isi, ubah } = bedaKonsumen(lama, ambilKtp(baru), KTP);
  if (!ubah.length && !Object.keys(tambahan).length) return 0;
  const b = writeBatch(db), lr = logRef(), tgl = stamp(new Date());
  if (ubah.length) b.set(lr, isiLog(lama.id, baru.nama || lama.nama, ubah, sumber));
  b.set(doc(db, 'konsumen', lama.id), { ...isi, ...('hp' in isi ? { hpNorm: waNumber(isi.hp) } : {}), ...tambahan, updated: tgl, ...(ubah.length ? { logTerakhir: lr.id, diubahOleh: namaPetugas(), diubahTgl: tgl } : {}) }, { merge: true });
  await b.commit();
  if (ubah.length) await terapkanKeMotor({ ...lama, ...isi }, lama, sumber, kecuali);
  return ubah.length;
}
// Salin data KTP konsumen ke semua motornya (+ servis berjalan + cek servis bila no. HP berubah)
export async function terapkanKeMotor(kBaru, kLama, sumber, kecuali = '') {
  const motor = await motorKonsumen(kBaru);
  for (const m of motor) {
    if (m.id === kecuali) continue;
    const { isi, ubah } = bedaKonsumen(m, ambilKtp(kBaru), KTP);
    if (!ubah.length) continue;
    try {
      await simpanDenganCatatan(m.id, m.nopol, isi, ubah, { updated: stamp(new Date()), ...('hp' in isi ? { hpNorm: waNumber(isi.hp) } : {}) }, sumber);
      await terapkanKeServis(m.nopol, isi);
      if ('hp' in isi) await pindahPantauKunci(m.nopol, m.hp, m.nopol, isi.hp, kBaru);
    } catch (e) { console.warn('Perbarui motor', m.nopol, e); }
  }
}
// Servis yang masih berjalan memakai data konsumen terbaru (nama/no. HP untuk WA & nota)
export async function terapkanKeServis(nopol, patch) {
  const aktif = (S.woSemua?.length ? S.woSemua : S.wo).filter(w => nopolKey(w.nopol) === nopolKey(nopol) && AKTIF.includes(w.status));
  for (const w of aktif) {
    const p = Object.fromEntries(Object.entries(patch).filter(([f, v]) => KTP.includes(f) && (w[f] ?? '') !== v));
    if (!Object.keys(p).length) continue;
    try { await updateDoc(doc(db, 'wo', w.no), p); Object.assign(w, p); } catch (e) { console.warn('Perbarui WO', w.no, e); }
  }
}
export const tambahMotorKe = (konsumenId, key) => konsumenId && key ? updateDoc(doc(db, 'konsumen', konsumenId), { motor: arrayUnion(key), updated: stamp(new Date()) }).catch(e => console.warn('Daftar motor konsumen', e)) : null;
export const lepasMotorDari = (konsumenId, key) => konsumenId && key ? updateDoc(doc(db, 'konsumen', konsumenId), { motor: arrayRemove(key), updated: stamp(new Date()) }).catch(e => console.warn('Daftar motor konsumen', e)) : null;

// Sambungkan motor ke konsumen lain: ganti pemilik (jual-beli) atau koreksi (pindahkan motor, admin).
// Data KTP motor diganti data konsumen baru, cek servis pindah ke no. HP pemilik baru.
export async function pindahkanMotor(m, kBaru, { jenis = 'koreksi', alasan = '' } = {}) {
  const ktp = ambilKtp(kBaru), { isi, ubah } = bedaKonsumen(m, { ...ktp, konsumenId: kBaru.id }, [...KTP, 'konsumenId']);
  const tambahan = { updated: stamp(new Date()), hpNorm: waNumber(ktp.hp) };
  if (jenis === 'jual') tambahan.riwayatPemilik = [...(m.riwayatPemilik || []), { konsumenId: m.konsumenId || '', nama: m.nama || '', sampai: stamp(new Date()), alasan, oleh: namaPetugas() }].slice(-10);
  const sumber = (jenis === 'jual' ? 'Ganti pemilik' : 'Koreksi: pindah motor') + (alasan ? ' — ' + alasan : '');
  if (!ubah.some(u => u.f === 'konsumenId')) ubah.push({ f: 'konsumenId', dari: m.konsumenId || '', ke: kBaru.id });
  isi.konsumenId = kBaru.id;
  await simpanDenganCatatan(m.id, m.nopol, isi, ubah, tambahan, sumber);
  await lepasMotorDari(m.konsumenId, m.id); await tambahMotorKe(kBaru.id, m.id);
  await terapkanKeServis(m.nopol, ktp);
  await pindahPantauKunci(m.nopol, m.hp, m.nopol, ktp.hp, ktp, { sembunyikan: jenis === 'jual' });
}

// Gabungkan konsumen ganda: semua motor sumber pindah ke tujuan, data tujuan = pilihan admin, sumber ditandai digabung.
export async function gabungkanKonsumen(sumber, tujuan, dataPilihan) {
  await ubahKonsumen(tujuan, dataPilihan, 'Gabung dengan ' + (sumber.nama || sumber.id));
  const tBaru = { ...tujuan, ...ambilKtp(dataPilihan) };
  for (const m of await motorKonsumen(sumber)) await pindahkanMotor(m, tBaru, { jenis: 'koreksi', alasan: 'gabung konsumen ganda' });
  const b = writeBatch(db), lr = logRef();
  b.set(lr, isiLog(sumber.id, sumber.nama, [{ f: 'digabungKe', dari: '', ke: tujuan.id + ' (' + (tujuan.nama || '') + ')' }], 'Gabung konsumen'));
  b.set(doc(db, 'konsumen', sumber.id), { digabungKe: tujuan.id, motor: [], updated: stamp(new Date()), logTerakhir: lr.id }, { merge: true });
  await b.commit();
}

// Hapus data pribadi (super admin): data KTP dikosongkan di konsumen & semua motornya, cek servis dihapus.
// Riwayat servis & nota tetap ada untuk laporan.
export async function hapusDataPribadi(k) {
  const kosong = Object.fromEntries(KTP.map(f => [f, ''])); kosong.nama = '(DATA DIHAPUS)';
  const motor = await motorKonsumen(k);
  const { pantauKey } = await import('./wo-common.js'), { deleteDoc } = await import('./firebase.js');
  for (const m of motor) {
    const key = await pantauKey(m.nopol, m.hp); if (key) await deleteDoc(doc(db, 'pantau', key)).catch(() => {});
    await setDoc(doc(db, 'kendaraan', m.id), { ...kosong, namaStnk: '', hpNorm: '', updated: stamp(new Date()) }, { merge: true });
  }
  await setDoc(doc(db, 'konsumen', k.id), { ...kosong, hpNorm: '', dihapus: stamp(new Date()), dihapusOleh: namaPetugas() }, { merge: true });
}

/* ---------- Bentuk database konsumen dari data kendaraan lama (sekali, super admin) ---------- */
const normNama = n => String(n || '').toUpperCase().replace(/\b(M|MHD|MUHD|MUH|MOH)\b\.?/g, 'MUHAMMAD').replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ').trim();
const samaOrang = (a, b) => {
  if (a.nik && b.nik) return a.nik === b.nik;
  const x = normNama(a.nama), y = normNama(b.nama); if (!x || !y) return true;
  if (x === y) return true;
  const tx = new Set(x.split(' ')), ty = y.split(' '), sama = ty.filter(t => tx.has(t)).length;
  return sama >= 2 || (sama >= 1 && Math.min(tx.size, ty.length) === 1);
};
export async function bentukDatabaseKonsumen(onProgress) {
  const s = await getDocs(collection(db, 'kendaraan'));
  const semua = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(k => !k.konsumenId && !k.pindahKe && (k.nama || k.hp || k.nik));
  // 1. kelompokkan per no. HP (atau NIK bila HP kosong); 2. di dalam satu HP, pisahkan nama yang jelas berbeda
  const grup = new Map();
  semua.forEach(k => { const hn = waNumber(k.hp), key = hn ? 'H' + hn : k.nik ? 'N' + k.nik : 'K' + k.id; (grup.get(key) || grup.set(key, []).get(key)).push(k); });
  const orang = [];
  grup.forEach(list => {
    const sub = [];
    list.sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || ''))).forEach(k => { const g = sub.find(x => samaOrang(x[0], k)); g ? g.push(k) : sub.push([k]); });
    sub.forEach(g => orang.push({ motor: g, cek: sub.length > 1 ? 'No. HP sama dipakai beberapa nama: ' + sub.map(x => x[0].nama || '?').join(', ') : '' }));
  });
  // NIK yang sama di kelompok berbeda → tandai untuk dicek admin
  const nikHit = {}; orang.forEach(o => { const n = o.motor.find(m => m.nik)?.nik; if (n) nikHit[n] = (nikHit[n] || 0) + 1; });
  orang.forEach(o => { const n = o.motor.find(m => m.nik)?.nik; if (n && nikHit[n] > 1) o.cek = (o.cek ? o.cek + '; ' : '') + 'NIK sama dengan konsumen lain'; });
  // Konsumen yang sudah ada (mis. dibuat Registrasi sebelum database dibentuk): motor disambungkan ke sana
  const ada = (await getDocs(collection(db, 'konsumen'))).docs.map(d => ({ id: d.id, ...d.data() })).filter(k => !k.digabungKe);
  let n = 0, b = writeBatch(db), ops = 0;
  const tgl = stamp(new Date());
  for (const o of orang) {
    const c = o.motor[0], hn = waNumber(c.hp), nik = o.motor.find(m => m.nik)?.nik;
    const lama = ada.find(k => (nik && k.nik === nik) || (hn && k.hpNorm === hn && samaOrang(k, c)));
    if (lama) {
      b.set(doc(db, 'konsumen', lama.id), { motor: arrayUnion(...o.motor.map(m => m.id)), updated: tgl }, { merge: true });
      o.motor.forEach(m => b.set(doc(db, 'kendaraan', m.id), { konsumenId: lama.id }, { merge: true }));
      ops += 1 + o.motor.length;
      if (ops >= 400) { await b.commit(); b = writeBatch(db); ops = 0; }
      onProgress?.(++n, orang.length); continue;
    }
    const data = {}; KTP.forEach(f => { data[f] = (o.motor.find(m => m[f]) || {})[f] || ''; });
    const ref = doc(collection(db, 'konsumen'));
    b.set(ref, { ...data, hpNorm: waNumber(data.hp), motor: o.motor.map(m => m.id), dibuat: o.motor.map(m => m.dibuat).filter(Boolean).sort()[0] || tgl, updated: tgl, dibuatOleh: 'Bentuk database', ...(o.cek ? { perluCek: true, alasanCek: o.cek } : {}) });
    o.motor.forEach(m => b.set(doc(db, 'kendaraan', m.id), { konsumenId: ref.id }, { merge: true }));
    ops += 1 + o.motor.length;
    if (ops >= 400) { await b.commit(); b = writeBatch(db); ops = 0; }
    onProgress?.(++n, orang.length);
  }
  if (ops) await b.commit();
  await setDoc(doc(db, 'meta', 'settings'), { konsumenSiap: tgl }, { merge: true });
  S.settings.konsumenSiap = tgl;
  return { konsumen: orang.length, cek: orang.filter(o => o.cek).length, motor: semua.length };
}
