// Penomoran nota, work order, dan pembelian. Dipanggil di dalam transaksi Firestore supaya nomor tidak pernah ganda.
import { db, doc } from './firebase.js';
import { dkey } from './util.js';

export const counterRef = () => doc(db, 'meta', 'counter');

// snap = hasil tx.get(counterRef())
// prefix harian (mulai 001 tiap hari): PJ = jual part, SV = servis, PB = pembelian
// prefix berjalan: WO = work order (kartu kerja servis per motor)
// AN = nomor antrian harian konsumen servis (mulai 1 tiap hari)
export function nextNumber(snap, prefix) {
  const today = dkey(new Date());
  let c = snap.exists() ? snap.data() : {};
  if (c.day !== today) c = { ...c, day: today, PJ: 0, SV: 0, PB: 0, AN: 0 };
  if (prefix === 'WO') {
    const n = (c.WO || 0) + 1;
    return { no: 'WO-' + String(n).padStart(4, '0'), counter: { ...c, WO: n } };
  }
  const n = (c[prefix] || 0) + 1;
  return { no: prefix + '-' + today.slice(2).replace(/-/g, '') + '-' + String(n).padStart(3, '0'), counter: { ...c, [prefix]: n } };
}
