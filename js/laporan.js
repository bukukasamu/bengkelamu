// Menu Laporan Penjualan: semua angka bisa diklik untuk menyaring daftar transaksi,
// setiap transaksi bisa diklik untuk melihat nota.
import { $, esc, rp, dkey, toast, errMsg } from './util.js';
import { S, st, views, actions, changeHandlers } from './state.js';
import { trxIn, sums } from './stats.js';
import { db, collection, getDocs, query, where } from './firebase.js';
import { jenisBadge } from './wo-common.js';
import { loadXLSX } from './import-excel.js';

const RANGES = [['hari', 'Hari ini'], ['7', '7 hari'], ['bulan', 'Bulan ini'], ['lalu', 'Bulan lalu'], ['pilih', 'Pilih tanggal']];
let loadedFrom = '';   // batas awal data transaksi yang sudah dimuat realtime (diisi main.js)
export const setLoadedFrom = f => { loadedFrom = f; };

function range() {
  const now = new Date(), L = st.lap;
  if (L.range === '7') { const d = new Date(now); d.setDate(d.getDate() - 6); return [dkey(d), dkey(now)]; }
  if (L.range === 'bulan') return [dkey(new Date(now.getFullYear(), now.getMonth(), 1)), dkey(now)];
  if (L.range === 'lalu') return [dkey(new Date(now.getFullYear(), now.getMonth() - 1, 1)), dkey(new Date(now.getFullYear(), now.getMonth(), 0))];
  if (L.range === 'pilih' && L.from && L.to) return [L.from, L.to];
  return [dkey(now), dkey(now)];
}

// Filter yang bisa diklik
const FILTERS = {
  part: { label: 'Penjualan sparepart', test: t => t.jenis === 'PART' },
  servis: { label: 'Servis bengkel', test: t => t.jenis === 'SERVIS' },
  ksg: { label: 'Servis KSG (klaim)', test: t => t.jenisServis === 'KSG' },
  ksb: { label: 'Servis KSB', test: t => t.jenisServis === 'KSB' },
  biaya: { label: 'Ada biaya tambahan', test: t => (t.biaya || []).length > 0 },
  diskon: { label: 'Ada diskon', test: t => (t.diskon || 0) > 0 },
  cash: { label: 'Dibayar cash', test: t => t.cash == null || t.cash > 0 },
  transfer: { label: 'Dibayar transfer', test: t => (t.transfer || 0) > 0 }
};
function applyFilter(list) {
  const f = st.lap.filter; if (!f) return list;
  if (FILTERS[f.type]) return list.filter(FILTERS[f.type].test);
  if (f.type === 'kode') return list.filter(t => t.items.some(x => x.kode === f.value));
  if (f.type === 'mekanik') return list.filter(t => t.mekanik === f.value);
  if (f.type === 'kasir') return list.filter(t => (t.kasir || '') === f.value);
  if (f.type === 'rek') return list.filter(t => (t.transfer || 0) > 0 && (t.rekeningId || '?') === f.value);
  return list;
}
const filterLabel = f => FILTERS[f.type]?.label || (f.type === 'kode' ? 'Part: ' + f.label : f.type === 'mekanik' ? 'Mekanik: ' + f.value : f.type === 'rek' ? 'Transfer ke ' + f.label : 'Kasir: ' + f.value);

async function source(from, to) {
  if (from >= loadedFrom) return trxIn(from, to);
  // Periode di luar data realtime: ambil sekali dari server
  const s = await getDocs(query(collection(db, 'trx'), where('tgl', '>=', from), where('tgl', '<=', to + ' 99')));
  return s.docs.map(d => d.data());
}

async function renderLaporan() {
  const [from, to] = range(), L = st.lap;
  let base;
  try { base = await source(from, to); } catch (e) { toast(errMsg(e)); base = []; }
  if (st.view !== 'laporan') return;
  base.sort((a, b) => b.tgl.localeCompare(a.tgl));
  const list = applyFilter(base); L.list = list;
  const all = sums(base), s = sums(list);
  const top = {};
  base.forEach(t => t.items.forEach(x => { top[x.kode] = top[x.kode] || { nama: x.nama, qty: 0, nilai: 0 }; top[x.kode].qty += x.qty; top[x.kode].nilai += x.qty * x.harga; }));
  const topL = Object.entries(top).sort((a, b) => b[1].qty - a[1].qty).slice(0, 8), mx = topL.length ? topL[0][1].qty : 1;
  const per = (key) => { const m = {}; base.forEach(t => { const k = t[key]; if (k) { m[k] = m[k] || { n: 0, total: 0 }; m[k].n++; m[k].total += t.total; } }); return Object.entries(m).sort((a, b) => b[1].total - a[1].total); };
  const mek = per('mekanik'), kas = per('kasir');
  const tile = (type, lbl, val, sub, color) => `<button class="tile click" type="button" data-act="lap-f" data-t="${type}" aria-pressed="${L.filter?.type === type}"><span class="lbl">${lbl}</span><span class="val"${color ? ` style="color:${color}"` : ''}>${val}</span><span class="sub">${sub}</span></button>`;
  $('#view').innerHTML = `<div class="grid">
   <div class="row spread">
    <div class="seg" role="group" aria-label="Periode">${RANGES.map(([k, l]) => `<button type="button" data-act="lap-r" data-r="${k}" aria-pressed="${k === L.range}">${l}</button>`).join('')}</div>
    <button class="btn" type="button" data-act="lap-xlsx">Export Excel</button>
   </div>
   ${L.range === 'pilih' ? `<div class="row"><label class="f" for="lap-from">Dari<input id="lap-from" type="date" value="${esc(L.from)}"></label><label class="f" for="lap-to">Sampai<input id="lap-to" type="date" value="${esc(L.to)}"></label><button class="btn pri" type="button" data-act="lap-go" style="align-self:flex-end">Tampilkan</button></div>` : ''}
   <p class="small muted" style="margin:0">${from === to ? from : from + ' s/d ' + to} · klik angka, part, mekanik, atau kasir untuk menyaring daftar transaksi.</p>
   <div class="tiles t5">
    ${tile('semua', 'Total omzet', rp(all.total), all.n + ' transaksi')}
    ${tile('part', 'Penjualan part', rp(all.part), all.qty + ' pcs')}
    ${tile('servis', 'Jasa servis', rp(all.jasa), 'biaya lain ' + rp(all.biaya))}
    ${tile('ksg', 'Klaim KSG', rp(all.klaim), all.ksg + ' servis KSG')}
    <div class="tile"><span class="lbl">Laba kotor</span><span class="val" style="color:var(--good)">${rp(all.laba)}</span><span class="sub">diskon ${rp(all.dis)}</span></div>
   </div>
   <div class="grid g2">
    <div class="panel"><h3>Part terlaris</h3>${topL.length ? topL.map(([k, v]) => `<button class="bar-row" type="button" data-act="lap-f" data-t="kode" data-v="${esc(k)}" data-l="${esc(v.nama)}"><span class="row spread small"><span class="bar-lbl">${esc(v.nama)}</span><span class="num">${v.qty} pcs · ${rp(v.nilai)}</span></span><span class="bar-track"><span class="bar-fill" style="display:block;width:${v.qty / mx * 100}%"></span></span></button>`).join('') : '<div class="empty">Belum ada penjualan part.</div>'}</div>
    <div class="panel"><h3>Uang masuk</h3>
     <div class="tw"><table><tbody>
      <tr class="row-click" tabindex="0" data-act="lap-f" data-t="cash"><td><b>Cash</b> <span class="small muted">(setelah kembalian)</span></td><td class="r num">${rp(all.cash)}</td></tr>
      ${Object.entries(all.rek).map(([id, r]) => `<tr class="row-click" tabindex="0" data-act="lap-f" data-t="rek" data-v="${esc(id)}" data-l="${esc(r.label)}"><td>Transfer · ${esc(r.label)} <span class="small muted">(${r.n} nota)</span></td><td class="r num">${rp(r.total)}</td></tr>`).join('')}
      <tr><td><b>Total uang masuk</b></td><td class="r num"><b>${rp(all.cash + all.transfer)}</b></td></tr>
     </tbody></table></div>
    </div>
    <div class="panel"><h3>Per mekanik &amp; kasir</h3>
     ${mek.length ? `<div class="tw"><table><thead><tr><th>Mekanik</th><th class="r">Motor</th><th class="r">Total</th></tr></thead><tbody>${mek.map(([m, v]) => `<tr class="row-click" tabindex="0" data-act="lap-f" data-t="mekanik" data-v="${esc(m)}"><td>${esc(m)}</td><td class="r num">${v.n}</td><td class="r num">${rp(v.total)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="small muted">Belum ada servis lunas.</div>'}
     ${kas.length ? `<div class="tw"><table><thead><tr><th>Kasir</th><th class="r">Nota</th><th class="r">Total</th></tr></thead><tbody>${kas.map(([m, v]) => `<tr class="row-click" tabindex="0" data-act="lap-f" data-t="kasir" data-v="${esc(m)}"><td>${esc(m)}</td><td class="r num">${v.n}</td><td class="r num">${rp(v.total)}</td></tr>`).join('')}</tbody></table></div>` : ''}
    </div>
   </div>
   <div class="panel"><div class="row spread"><h3>Daftar transaksi</h3>${L.filter ? `<span class="chip">${esc(filterLabel(L.filter))} · ${list.length} nota · ${rp(s.total)}<button type="button" data-act="lap-clear" aria-label="Hapus filter">✕</button></span>` : `<span class="small muted">${list.length} nota</span>`}</div>
    <div class="tw"><table><thead><tr><th>No. nota</th><th>Waktu</th><th>Jenis</th><th>Pelanggan</th><th>Kasir</th><th class="r">Total</th></tr></thead><tbody>${list.map(t => `<tr class="row-click" tabindex="0" data-act="nota" data-no="${esc(t.no)}"><td class="mono">${esc(t.no)}</td><td class="num">${t.tgl.slice(5).replace('-', '/')}</td><td>${t.jenis === 'SERVIS' ? jenisBadge(t) : '<span class="pill p-good">Part</span>'}</td><td>${esc(t.pelanggan)}${t.nopol ? ` <span class="small muted mono">${esc(t.nopol)}</span>` : ''}</td><td class="small">${esc(t.kasir || '')}</td><td class="r num">${rp(t.total)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Tidak ada transaksi.</td></tr>'}</tbody></table></div>
   </div></div>`;
}

async function exportXlsx() {
  const list = st.lap.list || [];
  if (!list.length) { toast('Tidak ada transaksi untuk diexport'); return; }
  try {
    const X = await loadXLSX();
    const rows = list.map(t => ({ nota: t.no, waktu: t.tgl, jenis: t.jenis === 'SERVIS' ? 'Servis ' + (t.jenisServis || 'Reguler') : 'Part', pelanggan: t.pelanggan, nopol: t.nopol || '', mekanik: t.mekanik || '', kasir: t.kasir || '',
      sparepart: t.items.reduce((a, x) => a + x.qty * x.harga, 0), jasa: (t.jasa || []).reduce((a, j) => a + j.harga, 0), klaim_ksg: t.jasaKlaim || 0, biaya_lain: (t.biaya || []).reduce((a, b) => a + b.jumlah, 0), diskon: t.diskon || 0, total: t.total, metode: t.metode || 'Cash', cash_bersih: t.cash == null ? t.total : (t.cash || 0) - (t.kembali || 0), transfer: t.transfer || 0, rekening: t.rekening || '' }));
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows), 'Penjualan');
    const [from, to] = range();
    X.writeFile(wb, `laporan-penjualan-${from}_${to}.xlsx`);
  } catch (e) { toast('Gagal export: ' + e.message); }
}

views.laporan = renderLaporan;
Object.assign(actions, {
  'lap-r': el => { st.lap.range = el.dataset.r; st.lap.filter = null; if (el.dataset.r === 'pilih' && !st.lap.from) { st.lap.from = st.lap.to = dkey(new Date()); } renderLaporan(); },
  'lap-go': () => { if (st.lap.from > st.lap.to) { toast('Tanggal awal harus sebelum tanggal akhir'); return; } renderLaporan(); },
  'lap-f': el => {
    const t = el.dataset.t;
    st.lap.filter = t === 'semua' || (st.lap.filter && st.lap.filter.type === t && st.lap.filter.value === el.dataset.v) ? null : { type: t, value: el.dataset.v, label: el.dataset.l };
    renderLaporan();
  },
  'lap-clear': () => { st.lap.filter = null; renderLaporan(); },
  'lap-xlsx': exportXlsx
});
changeHandlers.push(e => { if (e.target.id === 'lap-from') st.lap.from = e.target.value; if (e.target.id === 'lap-to') st.lap.to = e.target.value; });
