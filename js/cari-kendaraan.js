// Cari kendaraan/konsumen lama dengan sebagian data: nopol, nama, no. HP, NIK, no. rangka, atau no. mesin.
// Data kendaraan dicari dari awalannya di database (mis. "BL123" → BL1234NN); data servis yang sudah dimuat
// (semua cabang) dicocokkan di bagian mana pun (mis. "1234" atau "NN"). Dipakai Registrasi & Riwayat Kendaraan.
import { db, getDocs, query, collection, where, limit, documentId } from './firebase.js';
import { S } from './state.js';

export const nopolKey = n => String(n || '').replace(/\s+/g, '').toUpperCase();
const hpAwal = d => d.startsWith('0') ? '62' + d.slice(1) : d.startsWith('8') ? '62' + d : d;   // 0812… → 62812…

// Mengembalikan daftar (maks. 15) { id, nopol, nama, hp, tipe, … }, atau null bila kata kunci terlalu pendek
export async function cariKendaraan(teks) {
  const raw = String(teks || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (raw.replace(/\s/g, '').length < 3) return null;
  const rapat = raw.replace(/[\s.\-]/g, ''), digit = raw.replace(/\D/g, ''), hanyaAngka = /^[\d\s.\-+]+$/.test(raw);
  const found = new Map();
  const add = (id, d) => { if (!found.has(id)) found.set(id, { id, ...d }); };
  const awalan = (f, v) => getDocs(query(collection(db, 'kendaraan'), where(f, '>=', v), where(f, '<=', v + ''), limit(10))).catch(e => { console.warn('Cari kendaraan', e); return { docs: [] }; });
  const idKey = rapat.replace(/[^A-Z0-9]/g, '');
  const qs = [idKey ? awalan(documentId(), idKey) : null, awalan('noRangka', rapat), awalan('noMesin', rapat)];
  if (!hanyaAngka) qs.push(awalan('nama', raw));
  if (hanyaAngka && digit.length >= 4) qs.push(awalan('nik', digit), awalan('hpNorm', hpAwal(digit)));
  (await Promise.all(qs.filter(Boolean))).forEach(sn => sn.docs.forEach(d => add(d.id, d.data())));
  const cocok = w => {
    const teksW = [nopolKey(w.nopol), (w.noRangka || '').replace(/\s+/g, ''), (w.noMesin || '').replace(/\s+/g, ''), w.nik || '', String(w.nama || '').toUpperCase()];
    if (teksW.some(t => t && t.includes(rapat)) || (!hanyaAngka && String(w.nama || '').toUpperCase().includes(raw))) return true;
    const hp = String(w.hp || '').replace(/\D/g, '');
    return hanyaAngka && digit.length >= 4 && hp && (hp.includes(digit) || hpAwal(hp).includes(hpAwal(digit)));
  };
  [...(S.woSemua.length ? S.woSemua : S.wo)].reverse().forEach(w => { if (w.nopol && cocok(w)) add(nopolKey(w.nopol), w); });   // semua cabang
  return [...found.values()].slice(0, 15);
}
