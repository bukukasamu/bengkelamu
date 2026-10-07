// Data bersama, pengaturan toko, dan navigasi antar menu.
import { $ } from './util.js';

/* ---- Pengaturan toko (silakan sesuaikan) ---- */
export const JASA = [['Ganti Oli', 15000], ['Servis Ringan', 45000], ['Servis CVT', 55000], ['Tune Up Injeksi', 85000], ['Ganti Kampas Rem', 20000], ['Servis Rem', 30000], ['Bongkar Pasang Ban', 20000], ['Cek Kelistrikan', 35000]];
export const MEKANIK = ['Fauzan', 'Rizki', 'Mahdi', 'T. Iqbal'];
export const TIPE = ['NMAX 155', 'Aerox 155', 'Lexi', 'Fazzio', 'Grand Filano', 'Gear 125', 'Mio M3', 'Fino', 'X-Ride', 'Jupiter Z1', 'Vega Force', 'MX King 150', 'Vixion', 'R15', 'XSR 155'];
export const KAT = ['Oli', 'Rem', 'CVT', 'Pengapian', 'Filter', 'Kelistrikan', 'Penggerak', 'Ban'];
export const STATUS = { Antri: 'p-warn', Dikerjakan: 'p-info', Selesai: 'p-good', Lunas: 'p-good' };

/* ---- Data dari Firestore (diisi oleh main.js) ---- */
export const S = { parts: [], map: new Map(), trx: [], wo: [] };
export const part = k => S.map.get(k);
export function setParts(list) {
  S.parts = list.sort((a, b) => a.kode.localeCompare(b.kode));
  S.map = new Map(S.parts.map(p => [p.kode, p]));
}
export const kategoriList = () => [...new Set([...KAT, ...S.parts.map(p => p.kategori).filter(Boolean)])].sort((a, b) => a.localeCompare(b));

/* ---- State tampilan ---- */
export const emptyCart = () => ({ items: [], pelanggan: '', diskon: 0, bayar: 0 });
export const st = {
  view: 'beranda', loaded: false, petugas: null, saving: false, lastNota: null,
  cart: emptyCart(), woDraft: null,
  stokQ: '', stokKat: '', stokLow: false, partEdit: null,
  lapRange: 'hari'
};
export const namaPetugas = () => (st.petugas && (st.petugas.nama || st.petugas.email)) || '';

/* ---- Registry: tiap modul mendaftarkan tampilan dan aksinya sendiri ---- */
export const views = {};        // nama menu -> fungsi render penuh
export const refreshers = {};   // nama menu -> render ringan saat data berubah (tidak menghapus isian form)
export const actions = {};      // data-act -> fungsi(el)
export const inputHandlers = []; // fungsi(event) untuk event input
export const changeHandlers = []; // fungsi(event) untuk event change
export const fkeys = {};        // nama menu -> { baru, simpan } nama aksi

export function go(v) {
  st.view = v;
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.view === v));
  try { localStorage.setItem('amu-tab', v); } catch (e) {}
  if (!st.loaded) return;
  views[v]();
  if (v === 'kasir') setTimeout(() => $('#k-q')?.focus(), 0);
}
export function refresh() {
  if (!st.loaded) return;
  (refreshers[st.view] || views[st.view])();
}

/* ---- Pemilih part (ketik kode/nama, cocok untuk ribuan part) ---- */
export const partPicker = (id, label) =>
  `<input id="${id}" list="dl-parts" placeholder="Ketik kode atau nama part" aria-label="${label}" autocomplete="off" style="flex:1 1 240px">` +
  `<datalist id="dl-parts">${S.parts.map(p => `<option value="${p.kode} — ${String(p.nama).replace(/"/g, '&quot;')} (stok ${p.stok})">`).join('')}</datalist>`;
export const pickedKode = id => (($('#' + id)?.value || '').split(' — ')[0] || '').trim().toUpperCase();
