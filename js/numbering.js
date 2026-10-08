// Penomoran nota, work order, pembelian, dan antrian. Dipanggil di dalam transaksi Firestore supaya nomor tidak pernah ganda.
// Setiap cabang punya penghitung sendiri: cabang utama di meta/counter (format lama), cabang lain di meta/counter-KODE.
import { db, doc } from './firebase.js';
import { dkey } from './util.js';
import { cabAktif, kodeNomor, CABANG_UTAMA } from './cabang.js';

export const counterRef = (cab = cabAktif()) => doc(db, 'meta', cab === CABANG_UTAMA ? 'counter' : 'counter-' + cab);

// snap = hasil tx.get(counterRef())
// prefix harian (mulai 001 tiap hari): PJ = jual part, SV = servis, PB = pembelian
// prefix berjalan: WO = work order (kartu kerja servis per motor)
// AN = nomor antrian harian konsumen servis (mulai 1 tiap hari)
// Cabang selain utama diberi kode di nomornya, mis. WO-LSK-0001, SV-LSK-261008-001.
export function nextNumber(snap, prefix, cab = cabAktif()) {
  const today = dkey(new Date()), kode = kodeNomor(cab);
  let c = snap.exists() ? snap.data() : {};
  if (c.day !== today) c = { ...c, day: today, PJ: 0, SV: 0, PB: 0, AN: 0 };
  if (prefix === 'WO') {
    const n = (c.WO || 0) + 1;
    return { no: 'WO-' + kode + String(n).padStart(4, '0'), counter: { ...c, WO: n } };
  }
  const n = (c[prefix] || 0) + 1;
  return { no: prefix + '-' + kode + today.slice(2).replace(/-/g, '') + '-' + String(n).padStart(3, '0'), counter: { ...c, [prefix]: n } };
}
