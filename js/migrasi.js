// Pembaruan data ke versi 4 (dijalankan sekali oleh super admin):
// 1. Nota, WO, dan pembelian lama diberi kolom cabang + bulan (+ aktif untuk WO) supaya bisa dikunci per cabang.
// 2. Gaji pokok & komisi dipindah dari data mekanik/petugas (yang bisa dibaca karyawan lain) ke gaji/{kunci} (privat).
// 3. Aturan insentif dipindah dari meta/settings (bisa diubah admin) ke penghasilan/aturan (hanya super admin).
import { db, collection, getDocs, doc, writeBatch, deleteField, setDoc } from './firebase.js';
import { S } from './state.js';
import { CABANG_UTAMA } from './cabang.js';
import { nopolKey } from './cari-kendaraan.js';

export const VERSI_DATA = 4;
const AKTIF = ['Antri', 'Dikerjakan', 'Ditunda', 'Selesai'];
export const perluMigrasi = () => (S.settings.versiData || 0) < VERSI_DATA;

async function tulisBatch(ops, onProgress, label) {
  for (let i = 0; i < ops.length; i += 400) {
    const b = writeBatch(db);
    ops.slice(i, i + 400).forEach(([ref, data, op]) => op === 'update' ? b.update(ref, data) : b.set(ref, data, { merge: true }));
    await b.commit();
    onProgress?.(`${label}: ${Math.min(ops.length, i + 400)} / ${ops.length}`);
  }
}

export async function jalankanMigrasi(onProgress) {
  const ringkas = {}, servis = new Map();   // nopolKey -> { pertama, terakhir } dari nota servis lama
  // 1. Kolom cabang & bulan
  for (const [nama, tglDari] of [['trx', d => d.tgl], ['wo', d => d.tgl], ['pembelian', d => d.input || d.tglInvoice]]) {
    onProgress?.('Membaca ' + nama + '…');
    const s = await getDocs(collection(db, nama)), ops = [];
    s.docs.forEach(x => {
      const d = x.data(), patch = {};
      if (nama === 'trx' && d.jenis === 'SERVIS' && d.nopol && !(d.batal && d.batal.status === 'disetujui')) {
        const k = nopolKey(d.nopol), v = servis.get(k) || { pertama: d.tgl, terakhir: d.tgl };
        if (d.tgl < v.pertama) v.pertama = d.tgl; if (d.tgl > v.terakhir) v.terakhir = d.tgl; servis.set(k, v);
      }
      if (!d.cabang) patch.cabang = CABANG_UTAMA;
      const t = String(tglDari(d) || '');
      if (!d.bulan && t.length >= 7) patch.bulan = t.slice(0, 7);
      if (nama === 'wo' && d.aktif === undefined) patch.aktif = AKTIF.includes(d.status);
      if (Object.keys(patch).length) ops.push([x.ref, patch]);
    });
    await tulisBatch(ops, onProgress, nama);
    ringkas[nama] = ops.length;
  }
  // 1b. Tanggal pertama terdaftar & servis terakhir di data kendaraan (Insight & pengingat servis
  //     tidak perlu lagi membaca nota 12 bulan)
  onProgress?.('Membaca kendaraan…');
  const kops = [];
  (await getDocs(collection(db, 'kendaraan'))).docs.forEach(x => {
    const k = x.data(), v = servis.get(x.id), patch = {};
    if (!k.dibuat) patch.dibuat = (v?.pertama && (!k.updated || v.pertama < k.updated) ? v.pertama : k.updated) || '2000-01-01 00:00';
    if (v && (!k.servisTerakhir || v.terakhir > k.servisTerakhir)) patch.servisTerakhir = v.terakhir;
    if (Object.keys(patch).length) kops.push([x.ref, patch]);
  });
  await tulisBatch(kops, onProgress, 'kendaraan');
  ringkas.kendaraan = kops.length;
  // 2. Gaji pribadi
  onProgress?.('Memindahkan gaji…');
  const ops = [];
  const mek = await getDocs(collection(db, 'mekanik'));
  mek.docs.forEach(x => {
    const m = x.data();
    if (m.gaji !== undefined || m.komisi !== undefined) {
      ops.push([doc(db, 'gaji', 'M:' + x.id), { nama: m.nama, peran: 'mekanik', cabang: m.cabang || CABANG_UTAMA, gaji: +m.gaji || 0, komisi: +m.komisi || 0 }]);
      ops.push([x.ref, { gaji: deleteField(), komisi: deleteField() }, 'update']);
    }
  });
  const staff = await getDocs(collection(db, 'staff'));
  staff.docs.forEach(x => {
    const p = x.data();
    if (p.gaji !== undefined && p.loginId) {
      ops.push([doc(db, 'gaji', p.loginId), { nama: p.nama, peran: p.peran, cabang: p.cabang || CABANG_UTAMA, gaji: +p.gaji || 0 }]);
      ops.push([x.ref, { gaji: deleteField() }, 'update']);
    }
  });
  await tulisBatch(ops, onProgress, 'gaji');
  ringkas.gaji = ops.length / 2;
  // 3. Aturan insentif
  if (S.settings.penghasilan) {
    await setDoc(doc(db, 'penghasilan', 'aturan'), S.settings.penghasilan);
    await setDoc(doc(db, 'meta', 'settings'), { penghasilan: deleteField() }, { merge: true });
  }
  await setDoc(doc(db, 'meta', 'settings'), { versiData: VERSI_DATA }, { merge: true });
  return ringkas;
}
