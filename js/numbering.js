// Penomoran nota & work order. Dipanggil di dalam transaksi Firestore supaya nomor tidak pernah ganda.
import { db, doc } from './firebase.js';
import { dkey } from './util.js';

export const counterRef = () => doc(db, 'meta', 'counter');

// snap = hasil tx.get(counterRef()); prefix = 'PJ' (jual part), 'SV' (servis), 'WO' (work order)
export function nextNumber(snap, prefix) {
  const today = dkey(new Date());
  let c = snap.exists() ? snap.data() : {};
  if (c.day !== today) c = { ...c, day: today, PJ: 0, SV: 0 };   // nomor nota mulai lagi dari 001 tiap hari
  if (prefix === 'WO') {
    const n = (c.WO || 0) + 1;
    return { no: 'WO-' + String(n).padStart(4, '0'), counter: { ...c, WO: n } };
  }
  const n = (c[prefix] || 0) + 1;
  return { no: prefix + '-' + today.slice(2).replace(/-/g, '') + '-' + String(n).padStart(3, '0'), counter: { ...c, [prefix]: n } };
}
