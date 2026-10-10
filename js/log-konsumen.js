// Catatan perubahan data konsumen/kendaraan (koleksi ubahKonsumen).
// Setiap perubahan data pribadi (nama, HP, alamat, NIK, STNK, dll.) WAJIB ditulis bersama catatannya dalam satu
// batch: aturan database menolak perubahan tanpa catatan. Catatan hanya bisa ditambah, tidak bisa diubah/dihapus
// (kecuali super admin), dan hanya super admin yang bisa membacanya.
import { db, doc, collection, writeBatch } from './firebase.js';
import { st, namaPetugas } from './state.js';
import { stamp } from './util.js';

export const LABEL_KONSUMEN = {
  nik: 'NIK', nama: 'Nama', tempatLahir: 'Tempat lahir', tglLahir: 'Tanggal lahir', jk: 'Jenis kelamin', pekerjaan: 'Pekerjaan', hp: 'No. HP', rtrw: 'RT/RW',
  provinsi: 'Provinsi', kabupaten: 'Kabupaten/kota', kecamatan: 'Kecamatan', kelurahan: 'Kelurahan', alamat: 'Alamat', kabKode: 'Kode wilayah',
  nopol: 'No. polisi', namaStnk: 'Nama di STNK', stnkSama: 'Nama STNK sama dengan KTP', tipe: 'Tipe motor', tahun: 'Tahun', warna: 'Warna', noRangka: 'No. rangka', noMesin: 'No. mesin', km: 'KM'
};
const norm = v => v === undefined || v === null ? '' : typeof v === 'boolean' ? v : String(v).trim();

// Bandingkan data lama & baru → { isi: kolom yang benar-benar berubah, ubah: daftar untuk catatan }
// Kolom yang belum pernah ada dan nilai barunya kosong/bawaan tidak ditulis (bukan perubahan).
export function bedaKonsumen(lama, baru, kolom) {
  const isi = {}, ubah = [];
  kolom.forEach(f => {
    if (!(f in baru)) return;
    const a = norm(lama?.[f]), b = norm(baru[f]);
    if (a === b) return;
    if ((lama?.[f] === undefined) && (b === '' || b === true)) return;
    isi[f] = baru[f];
    if (f !== 'kabKode') ubah.push({ f, dari: String(a), ke: String(b) });
  });
  return { isi, ubah };
}

// Tulis perubahan + catatannya dalam satu batch. tambahan = kolom lain yang ikut ditulis (updated, hpNorm, dll.)
export async function simpanDenganCatatan(id, nopol, isi, ubah, tambahan = {}, sumber = '') {
  const b = writeBatch(db), kRef = doc(db, 'kendaraan', id), lRef = doc(collection(db, 'ubahKonsumen')), tgl = stamp(new Date());
  if (ubah.length) {
    b.set(lRef, { kendaraanId: id, nopol, tgl, bulan: tgl.slice(0, 7), oleh: namaPetugas(), olehEmail: st.petugas?.email || '', peran: st.petugas?.super ? 'super' : st.role, sumber, ubah });
    b.set(kRef, { ...isi, ...tambahan, logTerakhir: lRef.id, diubahOleh: namaPetugas(), diubahTgl: tgl }, { merge: true });
  } else b.set(kRef, { ...isi, ...tambahan }, { merge: true });
  await b.commit();
  return ubah.length;
}
