// Data bersama, peran, dan navigasi antar menu.
import { $ } from './util.js';
import { MENUS, HOME, KAT, DEFAULT_TIPE } from './config.js';

/* ---- Data dari Firestore (diisi oleh main.js) ---- */
// trx/wo/mekanik/pembelian = cabang yang sedang dibuka; trxSemua/woSemua/mekanikSemua = semua cabang
export const S = { parts: [], map: new Map(), trx: [], wo: [], jasa: [], mekanik: [], settings: {}, pembelian: [], trxSemua: [], woSemua: [], mekanikSemua: [] };
export const part = k => S.map.get(k);
export function setParts(list) {
  S.parts = list.sort((a, b) => a.kode.localeCompare(b.kode));
  S.map = new Map(S.parts.map(p => [p.kode, p]));
}
export const kategoriList = () => [...new Set([...KAT, ...S.parts.map(p => p.kategori).filter(Boolean)])].sort((a, b) => a.localeCompare(b));
export const tipeList = () => (S.settings.tipe && S.settings.tipe.length ? S.settings.tipe : DEFAULT_TIPE);
export const jasaAktif = () => S.jasa.filter(j => j.aktif !== false).sort((a, b) => (a.urut ?? 99) - (b.urut ?? 99) || a.nama.localeCompare(b.nama));
export const mekanikAktif = () => S.mekanik.filter(m => m.aktif !== false).sort((a, b) => a.nama.localeCompare(b.nama));
export const mekanikById = id => S.mekanik.find(m => m.id === id);

/* ---- State tampilan ---- */
export const emptyCart = () => ({ items: [], pelanggan: '', diskon: 0, pay: { cash: 0, transfer: 0, rekeningId: '', ref: '' } });
export const st = {
  view: 'beranda', loaded: false, petugas: null, role: null, saving: false, lastNota: null,
  cart: emptyCart(),
  regDraft: null, orderNo: null, orderDraft: null, bayarNo: null, bayarDraft: null,
  stokQ: '', stokKat: '', stokLow: false, partEdit: null,
  pbDraft: null, pbFilter: 'semua',
  mekSel: null, mekPeriode: 'ini',
  lap: { range: 'hari', from: '', to: '', filter: null, list: null },
  masterTab: 'kendaraan'
};
export const namaPetugas = () => (st.petugas && (st.petugas.nama || st.petugas.email)) || '';
export const can = menuId => !!MENUS.find(m => m.id === menuId)?.roles.includes(st.role);
export const isRole = (...r) => r.includes(st.role);

/* ---- Registry: tiap modul mendaftarkan tampilan dan aksinya sendiri ---- */
export const views = {};          // id menu -> render penuh
export const refreshers = {};     // id menu -> render ringan saat data berubah
export const actions = {};        // data-act -> fungsi(el)
export const inputHandlers = [];
export const changeHandlers = [];
export const fkeys = {};          // id menu -> { baru, simpan }

export function go(v) {
  if (!can(v)) v = HOME[st.role] || 'beranda';
  st.view = v;
  document.querySelectorAll('.sb-link').forEach(b => { if (b.dataset.view === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
  const m = MENUS.find(x => x.id === v); if ($('#page-title')) $('#page-title').textContent = m ? m.label : '';
  document.body.classList.remove('sb-open'); if ($('#sb-backdrop')) $('#sb-backdrop').hidden = true;
  try { localStorage.setItem('amu-tab-' + st.role, v); } catch (e) {}
  if (!st.loaded) return;
  views[v]();
  if (v === 'kasir') setTimeout(() => $('#k-q')?.focus(), 0);
}
export function refresh() {
  if (st.loaded) (refreshers[st.view] || views[st.view])();
}

/* ---- Pemilih part (ketik kode/nama, cocok untuk ribuan part) ---- */
export const partPicker = (id, label) =>
  `<input id="${id}" list="dl-parts" placeholder="Ketik kode atau nama part" aria-label="${label}" autocomplete="off" style="flex:1 1 240px">` +
  `<datalist id="dl-parts">${S.parts.map(p => `<option value="${p.kode} — ${String(p.nama).replace(/"/g, '&quot;')} (stok ${p.stok})">`).join('')}</datalist>`;
export const pickedKode = id => (($('#' + id)?.value || '').split(' — ')[0] || '').trim().toUpperCase();
