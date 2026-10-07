// Alamat bertingkat: Provinsi → Kabupaten/Kota → Kecamatan → Kelurahan/Gampong + alamat jalan.
// Data resmi wilayah Indonesia ada di folder /wilayah (index.json + satu file per provinsi), dimuat saat dibutuhkan.
import { $, esc } from './util.js';
import { changeHandlers, inputHandlers } from './state.js';

export const DEFAULT_PROV = '11';   // Aceh
export const WIL_FIELDS = ['provinsi', 'kabKode', 'kabupaten', 'kecamatan', 'kelurahan', 'alamat'];

let index = null;
const kabCache = {};
export async function loadIndex() {
  if (!index) index = await fetch(new URL('../wilayah/index.json', import.meta.url)).then(r => { if (!r.ok) throw new Error('Data wilayah tidak ditemukan'); return r.json(); });
  return index;
}
// Satu file per provinsi: { "11.06": [[kecamatan, [kelurahan…]], …], … }
async function loadKab(kode) {
  if (!kode) return [];
  const prov = kode.slice(0, 2);
  if (!kabCache[prov]) kabCache[prov] = fetch(new URL(`../wilayah/${prov}.json`, import.meta.url)).then(r => r.ok ? r.json() : {}).catch(() => ({}));
  return (await kabCache[prov])[kode] || [];
}

const ctxs = {};   // prefix -> { get: () => objek data, onChange }

// Kerangka isian; pilihan diisi oleh fillWilayah() setelah data dimuat
export function wilayahHTML(px, d, disabled = false) {
  const dis = disabled ? 'disabled' : '';
  const sel = (k, label, val) => `<label class="f" for="${px}-${k}">${label}<select id="${px}-${k}" data-wil="${k}" data-wpx="${px}" ${dis}><option value="">${esc(val || 'Memuat…')}</option></select></label>`;
  return `${sel('prov', 'Provinsi', d.provinsi)}${sel('kab', 'Kabupaten / Kota', d.kabupaten)}${sel('kec', 'Kecamatan', d.kecamatan)}${sel('kel', 'Kelurahan / Gampong', d.kelurahan)}
    <label class="f wide" for="${px}-alamat">Alamat (jalan, dusun, no. rumah)<input id="${px}-alamat" data-wil="alamat" data-wpx="${px}" value="${esc(d.alamat || '')}" ${dis}></label>`;
}

const opts = (list, val, ph) => `<option value="">${ph}</option>` + list.map(([v, l]) => `<option value="${esc(v)}" ${v === val ? 'selected' : ''}>${esc(l)}</option>`).join('');

export async function fillWilayah(px, ctx) {
  ctxs[px] = ctx;
  const d = ctx.get();
  let idx;
  try { idx = await loadIndex(); } catch (e) { ['prov', 'kab', 'kec', 'kel'].forEach(k => { const s = $(`#${px}-${k}`); if (s) s.innerHTML = `<option value="">${esc(d[{ prov: 'provinsi', kab: 'kabupaten', kec: 'kecamatan', kel: 'kelurahan' }[k]] || 'Data wilayah gagal dimuat')}</option>`; }); return; }
  if (!$(`#${px}-prov`)) return;
  const provKode = (idx.prov.find(p => p[1] === d.provinsi) || [d.provinsi ? '' : DEFAULT_PROV])[0];
  if (!d.provinsi && provKode) d.provinsi = idx.prov.find(p => p[0] === provKode)[1];
  $(`#${px}-prov`).innerHTML = opts(idx.prov.map(p => [p[0], p[1]]), provKode, 'Pilih provinsi');
  const kabs = idx.kab[provKode] || [];
  if (!d.kabKode && d.kabupaten) d.kabKode = (kabs.find(k => k[1] === d.kabupaten) || [''])[0];
  $(`#${px}-kab`).innerHTML = opts(kabs.map(k => [k[0], k[1].replace(/^KABUPATEN /, 'KAB. ')]), d.kabKode, 'Pilih kabupaten / kota');
  const kecs = await loadKab(d.kabKode);
  if (!$(`#${px}-kec`)) return;
  $(`#${px}-kec`).innerHTML = opts(kecs.map(k => [k[0], k[0]]), d.kecamatan, d.kabKode ? 'Pilih kecamatan' : '—');
  const kec = kecs.find(k => k[0] === d.kecamatan);
  $(`#${px}-kel`).innerHTML = opts((kec ? kec[1] : []).map(n => [n, n]), d.kelurahan, d.kecamatan ? 'Pilih kelurahan / gampong' : '—');
}

changeHandlers.push(async e => {
  const t = e.target, k = t.dataset.wil, px = t.dataset.wpx;
  if (!k || k === 'alamat' || !ctxs[px]) return;
  const d = ctxs[px].get(); if (!d) return;
  const idx = await loadIndex();
  if (k === 'prov') { d.provinsi = (idx.prov.find(p => p[0] === t.value) || ['', ''])[1]; d.kabKode = d.kabupaten = d.kecamatan = d.kelurahan = ''; }
  if (k === 'kab') { const kb = Object.values(idx.kab).flat().find(x => x[0] === t.value); d.kabKode = t.value; d.kabupaten = kb ? kb[1] : ''; d.kecamatan = d.kelurahan = ''; }
  if (k === 'kec') { d.kecamatan = t.value; d.kelurahan = ''; }
  if (k === 'kel') d.kelurahan = t.value;
  if (k !== 'kel') await fillWilayah(px, ctxs[px]);
  ctxs[px].onChange?.();
});
inputHandlers.push(e => { const t = e.target; if (t.dataset.wil === 'alamat' && ctxs[t.dataset.wpx]) { const d = ctxs[t.dataset.wpx].get(); if (d) d.alamat = t.value; } });

// Satu baris alamat lengkap untuk ditampilkan
export const alamatLengkap = d => [d.alamat, d.kelurahan, d.kecamatan, d.kabupaten].filter(Boolean).join(', ');
