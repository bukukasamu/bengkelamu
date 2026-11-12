// Cabang bengkel. Daftar cabang ada di dokumen publik/cabang = { list: [{ id, nama, alamat, telp, aktif }] }
// (bisa dibaca tanpa login, dipakai juga oleh halaman cek servis & layar TV).
// Data yang dibuat sebelum ada fitur cabang tidak punya kolom "cabang" dan otomatis dianggap milik cabang utama.
//
// Yang dipisah per cabang : stok part, nomor nota/WO/antrian, work order, transaksi, pembelian, mekanik, layar TV.
// Yang dipakai bersama    : master part & harga, jasa & harga, tarif KSG, tipe motor, rekening, data konsumen/kendaraan.
import { db, doc, getDoc, onSnapshot, setDoc } from './firebase.js';
import { st } from './state.js';

export const CABANG_UTAMA = 'UTM';
let daftar = [];
const bawaan = () => [{ id: CABANG_UTAMA, nama: 'PUSAT', alamat: '', telp: '', aktif: true }];

export const cabangList = (termasukNonaktif = false) => { const l = daftar.length ? daftar : bawaan(); return termasukNonaktif ? l : l.filter(c => c.aktif !== false); };
export const cabangById = id => cabangList(true).find(c => c.id === (id || CABANG_UTAMA));
export const namaCabang = id => cabangById(id)?.nama || id || 'PUSAT';
export const cabangOf = d => (d && d.cabang) || CABANG_UTAMA;
export const multiCabang = () => cabangList().length > 1;
// Cabang yang sedang dipakai di aplikasi petugas
export const cabAktif = () => st.cabang || CABANG_UTAMA;
export const diCabang = (d, cab = cabAktif()) => cabangOf(d) === cab;

/* ---- Stok per cabang ----
   Cabang utama memakai kolom lama "stok" (data lama tetap benar); cabang lain di peta stokC: { KODE_CABANG: jumlah }. */
export const stokOf = (p, cab = cabAktif()) => cab === CABANG_UTAMA ? (+p.stok || 0) : (+(p.stokC && p.stokC[cab]) || 0);
export const stokField = (cab = cabAktif()) => cab === CABANG_UTAMA ? 'stok' : 'stokC.' + cab;          // untuk update()/tx.update()
export const stokSet = (v, cab = cabAktif()) => cab === CABANG_UTAMA ? { stok: v } : { stokC: { [cab]: v } };   // untuk set(..., {merge:true})
export const stokTotal = p => (+p.stok || 0) + Object.values(p.stokC || {}).reduce((a, b) => a + (+b || 0), 0);

// Kode cabang dipakai di nomor dokumen: cabang utama tanpa kode (format lama), cabang lain mis. WO-LSK-0001
export const kodeNomor = (cab = cabAktif()) => cab === CABANG_UTAMA ? '' : cab + '-';
// Dokumen layar TV per cabang
export const layarDocId = (cab = cabAktif()) => cab === CABANG_UTAMA ? 'layar' : 'layar-' + cab;

export async function loadCabang() {
  try { const s = await getDoc(doc(db, 'publik', 'cabang')); daftar = s.exists() ? (s.data().list || []) : []; } catch (e) { /* pakai bawaan */ }
  return cabangList(true);
}
export function watchCabang(cb) {
  return onSnapshot(doc(db, 'publik', 'cabang'), s => { daftar = s.exists() ? (s.data().list || []) : []; cb && cb(daftar); }, () => {});
}
export const simpanCabang = list => setDoc(doc(db, 'publik', 'cabang'), { list });
