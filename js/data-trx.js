// Mengambil nota (trx) untuk periode di luar data realtime.
// Admin/super admin: berdasarkan tanggal (semua cabang). Karyawan: hanya cabangnya, per bulan
// (cabang + bulan = tanpa indeks tambahan di Firestore, dan sesuai aturan kunci cabang).
import { db, collection, getDocs, query, where } from './firebase.js';
import { st } from './state.js';
import { cabAktif } from './cabang.js';

// Nota yang pembatalannya sudah disetujui super admin tidak dihitung di laporan mana pun
export const sah = t => !(t.batal && t.batal.status === 'disetujui');
export const bulanAntara = (from, to) => { const out = [], akhir = to.slice(0, 7); let [y, m] = from.slice(0, 7).split('-').map(Number); while (out.length < 36) { const k = y + '-' + String(m).padStart(2, '0'); if (k > akhir) break; out.push(k); if (++m > 12) { m = 1; y++; } } return out; };

export async function ambilTrx(from, to, { termasukBatal = false } = {}) {
  let list;
  if (st.role === 'admin') {
    const s = await getDocs(query(collection(db, 'trx'), where('tgl', '>=', from), where('tgl', '<=', to + ' 99')));
    list = s.docs.map(d => d.data());
  } else {
    const bln = bulanAntara(from, to), hasil = [];
    for (let i = 0; i < bln.length; i += 10) {
      const s = await getDocs(query(collection(db, 'trx'), where('cabang', '==', cabAktif()), where('bulan', 'in', bln.slice(i, i + 10))));
      s.docs.forEach(d => hasil.push(d.data()));
    }
    list = hasil.filter(t => t.tgl.slice(0, 10) >= from && t.tgl.slice(0, 10) <= to);
  }
  return termasukBatal ? list : list.filter(sah);
}
