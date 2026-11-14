// Mengambil nota (trx) untuk periode di luar data realtime.
// Admin/super admin: berdasarkan tanggal (semua cabang). Karyawan: hanya cabangnya, per bulan
// (cabang + bulan = tanpa indeks tambahan di Firestore, dan sesuai aturan kunci cabang).
import { db, collection, getDocs, query, where } from './firebase.js';
import { st } from './state.js';
import { cabAktif, cabangQuery } from './cabang.js';
import { memo, lupakan } from './memo.js';

// 5.19.0: hasil pengambilan nota disimpan 60 detik di memori; dibersihkan otomatis setiap ada perubahan nota realtime.
export const lupakanTrx = () => lupakan('trx|');

// Nota yang pembatalannya sudah disetujui super admin tidak dihitung di laporan mana pun
export const sah = t => !(t.batal && t.batal.status === 'disetujui');
export const bulanAntara = (from, to) => { const out = [], akhir = to.slice(0, 7); let [y, m] = from.slice(0, 7).split('-').map(Number); while (out.length < 36) { const k = y + '-' + String(m).padStart(2, '0'); if (k > akhir) break; out.push(k); if (++m > 12) { m = 1; y++; } } return out; };

export async function ambilTrx(from, to, { termasukBatal = false } = {}) {
  const list = await memo(['trx', st.role, cabAktif(), from, to].join('|'), 60000, () => ambilTrxLangsung(from, to));
  return termasukBatal ? list.slice() : list.filter(sah);
}
async function ambilTrxLangsung(from, to) {
  let list;
  if (st.role === 'admin') {
    const s = await getDocs(query(collection(db, 'trx'), where('tgl', '>=', from), where('tgl', '<=', to + ' 99')));
    list = s.docs.map(d => d.data());
  } else {
    const bln = bulanAntara(from, to), hasil = [];
    for (const cab of cabangQuery(cabAktif())) for (let i = 0; i < bln.length; i += 10) {
      const s = await getDocs(query(collection(db, 'trx'), where('cabang', '==', cab), where('bulan', 'in', bln.slice(i, i + 10))));
      s.docs.forEach(d => hasil.push(d.data()));
    }
    list = hasil.filter(t => t.tgl.slice(0, 10) >= from && t.tgl.slice(0, 10) <= to);
  }
  return list;
}
