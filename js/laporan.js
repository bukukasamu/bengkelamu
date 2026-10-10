// Menu Laporan Penjualan: semua angka bisa diklik untuk menyaring daftar transaksi,
// setiap transaksi bisa diklik untuk melihat nota.
import { $, esc, rp, dkey, toast, errMsg } from './util.js';
import { S, st, views, actions, changeHandlers, can, go } from './state.js';
import { trxIn, sums } from './stats.js';
import { db, collection, getDocs, query, where } from './firebase.js';
import { jenisBadge } from './wo-common.js';
import { loadXLSX } from './import-excel.js';
import { ambilTrx, bulanAntara } from './data-trx.js';
import { ambilPengeluaran } from './keuangan.js';
import { getDoc, doc } from './firebase.js';
import { cabAktif, cabangOf, namaCabang, multiCabang, cabangList } from './cabang.js';
import { isRole } from './state.js';

// Admin/pemilik bisa melihat laporan gabungan semua cabang
const gabungan = () => st.lap.semuaCabang && isRole('admin') && multiCabang();

// Periode laporan: harian, mingguan (Senin–Minggu), bulanan, tahunan, atau custom; tombol ‹ › untuk mundur/maju
const RANGES = [['hari', 'Harian'], ['minggu', 'Mingguan'], ['bulan', 'Bulanan'], ['tahun', 'Tahunan'], ['pilih', 'Custom']];
const tgl = s => new Date(s + 'T00:00');
function geser(n) {
  const L = st.lap, d = tgl(L.anchor || dkey(new Date()));
  if (L.range === 'hari') d.setDate(d.getDate() + n);
  else if (L.range === 'minggu') d.setDate(d.getDate() + 7 * n);
  else if (L.range === 'bulan') d.setMonth(d.getMonth() + n, 1);
  else if (L.range === 'tahun') d.setFullYear(d.getFullYear() + n, 0, 1);
  L.anchor = dkey(d);
}
let loadedFrom = '';   // batas awal data transaksi yang sudah dimuat realtime (diisi main.js)
export const setLoadedFrom = f => { loadedFrom = f; };

function range() {
  const L = st.lap, a = tgl(L.anchor || dkey(new Date())), y = a.getFullYear(), m = a.getMonth();
  if (L.range === 'minggu') { const senin = new Date(a); senin.setDate(a.getDate() - ((a.getDay() + 6) % 7)); const minggu = new Date(senin); minggu.setDate(senin.getDate() + 6); return [dkey(senin), dkey(minggu)]; }
  if (L.range === 'bulan') return [dkey(new Date(y, m, 1)), dkey(new Date(y, m + 1, 0))];
  if (L.range === 'tahun') return [dkey(new Date(y, 0, 1)), dkey(new Date(y, 11, 31))];
  if (L.range === 'pilih' && L.from && L.to) return [L.from, L.to];
  return [dkey(a), dkey(a)];
}
function judulPeriode(from, to) {
  const L = st.lap, f = tgl(from);
  if (L.range === 'hari') return f.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (L.range === 'bulan') return f.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
  if (L.range === 'tahun') return 'Tahun ' + f.getFullYear();
  return tglLabel(from) + ' – ' + tglLabel(to);
}
// Rincian per hari (minggu/bulan/custom) atau per bulan (tahun)
function rincianPeriode(base, from, to) {
  const L = st.lap; if (L.range === 'hari') return '';
  const perBulan = L.range === 'tahun' || (tgl(to) - tgl(from)) / 864e5 > 62;
  const kunci = t => perBulan ? t.tgl.slice(0, 7) : t.tgl.slice(0, 10), g = {};
  base.forEach(t => { const k = kunci(t); (g[k] = g[k] || []).push(t); });
  const rows = [], d = tgl(from), akhir = tgl(to), hariIni = dkey(new Date());
  while (d <= akhir && dkey(d) <= hariIni) {
    const k = perBulan ? dkey(d).slice(0, 7) : dkey(d), l = g[k] || [], sm = sums(l);
    rows.push({ k, l: perBulan ? tgl(k + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) : d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }), n: sm.n, part: sm.part, jasa: sm.jasa + sm.biaya, total: sm.total });
    if (perBulan) d.setMonth(d.getMonth() + 1, 1); else d.setDate(d.getDate() + 1);
  }
  if (rows.length < 2) return '';
  const max = Math.max(...rows.map(r => r.total), 1);
  return `<div class="panel"><h3>Rincian per ${perBulan ? 'bulan' : 'hari'}</h3><div class="tw"><table><thead><tr><th>${perBulan ? 'Bulan' : 'Tanggal'}</th><th class="r">Nota</th><th class="r">Sparepart</th><th class="r">Jasa &amp; lain</th><th class="r">Total</th><th style="width:28%"></th></tr></thead><tbody>
    ${rows.reverse().map(r => `<tr class="row-click" tabindex="0" data-act="lap-buka" data-k="${r.k}" data-b="${perBulan ? 1 : 0}" title="Buka laporan ${esc(r.l)}"><td>${esc(r.l)}</td><td class="r num">${r.n || '–'}</td><td class="r num">${r.part ? rp(r.part) : '–'}</td><td class="r num">${r.jasa ? rp(r.jasa) : '–'}</td><td class="r num"><b>${r.total ? rp(r.total) : '–'}</b></td><td><span class="ph-bar"><i style="width:${r.total / max * 100}%"></i></span></td></tr>`).join('')}
  </tbody></table></div></div>`;
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
  if (f.type === 'cabang') return list.filter(t => cabangOf(t) === f.value);
  if (f.type === 'rek') return list.filter(t => (t.transfer || 0) > 0 && (t.rekeningId || '?') === f.value);
  return list;
}
const filterLabel = f => FILTERS[f.type]?.label || (f.type === 'cabang' ? 'Cabang ' + namaCabang(f.value) : f.type === 'kode' ? 'Part: ' + f.label : f.type === 'mekanik' ? 'Mekanik: ' + f.value : f.type === 'rek' ? 'Transfer ke ' + f.label : 'Kasir: ' + f.value);

async function source(from, to) {
  if (from >= loadedFrom) return trxIn(from, to, gabungan() ? S.trxSemua : S.trx);
  // Periode di luar data realtime: ambil sekali dari server
  return (await ambilTrx(from, to)).filter(t => gabungan() || cabangOf(t) === cabAktif());
}

let terakhir = null;
// Laba bersih = laba kotor − pengeluaran operasional − biaya gaji (gaji + insentif dari slip yang dikunci).
// Biaya gaji hanya bisa dibaca super admin dan hanya dihitung untuk bulan penuh.
async function biaya(from, to) {
  const bln = bulanAntara(from, to), out = { keluar: 0, perKat: {}, gaji: null, gajiBulan: [], gajiKurang: [] };
  const kel = (await ambilPengeluaran(bln, cabAktif(), gabungan()).catch(() => [])).filter(p => p.tgl >= from && p.tgl <= to);
  kel.forEach(p => { out.keluar += +p.jumlah || 0; out.perKat[p.kategori] = (out.perKat[p.kategori] || 0) + (+p.jumlah || 0); });
  out.list = kel;
  if (st.petugas?.super) {
    const penuh = bln.filter(ym => from <= ym + '-01' && to >= dkey(new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0)));
    if (penuh.length) {
      out.gaji = 0;
      const r = await Promise.all(penuh.map(ym => getDoc(doc(db, 'slip', ym + '__REKAP')).catch(() => null)));
      r.forEach((x, i) => { if (x?.exists()) { const d = x.data(); out.gaji += gabungan() ? (d.total || 0) : (d.perCabang?.[cabAktif()] || 0); out.gajiBulan.push(penuh[i]); } else out.gajiKurang.push(penuh[i]); });
    }
  }
  return out;
}
const namaBln = ym => new Date(ym + '-01T00:00').toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
// Penjualan sparepart dalam rupiah: harga jual, harga beli (modal), laba, margin — untuk periode yang dipilih
function partNominalHTML(list) {
  let qty = 0, jual = 0, beli = 0, qtyJ = 0, jualJ = 0, beliJ = 0;
  list.forEach(t => (t.items || []).forEach(x => { const j = x.qty * x.harga, b = x.qty * (x.beli || 0); qty += x.qty; jual += j; beli += b; if (t.jenis === 'PART') { qtyJ += x.qty; jualJ += j; beliJ += b; } }));
  if (!qty) return '';
  const laba = jual - beli, baris = (l, q, j, b) => `<tr><td>${l}</td><td class="r num">${q.toLocaleString('id-ID')}</td><td class="r num">${rp(j)}</td><td class="r num">${rp(b)}</td><td class="r num" style="color:${j - b < 0 ? 'var(--bad)' : 'var(--good)'}">${rp(j - b)}</td><td class="r num">${j ? Math.round((j - b) / j * 100) : 0}%</td></tr>`;
  return `<div class="panel"><h3>Penjualan sparepart (rupiah)</h3>
   <div class="tiles"><div class="tile"><span class="lbl">Terjual</span><span class="val">${qty.toLocaleString('id-ID')} pcs</span></div><div class="tile"><span class="lbl">Harga jual</span><span class="val">${rp(jual)}</span></div><div class="tile"><span class="lbl">Harga beli (modal)</span><span class="val">${rp(beli)}</span></div><div class="tile"><span class="lbl">Laba part</span><span class="val" style="color:var(--good)">${rp(laba)}</span><span class="sub">margin ${jual ? Math.round(laba / jual * 100) : 0}%</span></div></div>
   <div class="tw"><table><thead><tr><th></th><th class="r">Pcs</th><th class="r">Harga jual</th><th class="r">Harga beli</th><th class="r">Laba</th><th class="r">Margin</th></tr></thead><tbody>
    ${baris('Penjualan langsung (kasir)', qtyJ, jualJ, beliJ)}${baris('Dipakai di servis', qty - qtyJ, jual - jualJ, beli - beliJ)}
   </tbody></table></div><p class="small muted" style="margin:0">Mengikuti periode di atas (harian, mingguan, bulanan, tahunan, atau custom). Harga beli = harga beli part saat nota dibuat.</p></div>`;
}
function labaBersihHTML(all, b) {
  const bersih = all.laba - b.keluar - (b.gaji || 0), kat = Object.entries(b.perKat).sort((x, y) => y[1] - x[1]);
  return `<div class="panel"><div class="row spread"><h3>Laba bersih</h3>${can('kas') ? '<button class="btn sm" type="button" data-act="go-kas">Kas &amp; pengeluaran ›</button>' : ''}</div>
   <div class="tw"><table><tbody>
    <tr><td>Laba kotor <span class="small muted">(penjualan − harga beli part + jasa + klaim KSG − diskon)</span></td><td class="r num">${rp(all.laba)}</td></tr>
    <tr><td>− Pengeluaran operasional <span class="small muted">(${b.list.length} catatan)</span></td><td class="r num" style="color:var(--bad)">${rp(b.keluar)}</td></tr>
    ${kat.slice(0, 6).map(([k, v]) => `<tr><td class="small muted" style="padding-left:24px">${esc(k)}</td><td class="r num small muted">${rp(v)}</td></tr>`).join('')}
    ${b.gaji != null ? `<tr><td>− Gaji &amp; insentif karyawan <span class="small muted">(slip dikunci${b.gajiBulan.length ? ': ' + b.gajiBulan.map(namaBln).join(', ') : ''})</span>${b.gajiKurang.length ? `<br><span class="small" style="color:var(--warn)">Belum dikunci: ${b.gajiKurang.map(namaBln).join(', ')} (belum dihitung)</span>` : ''}</td><td class="r num" style="color:var(--bad)">${rp(b.gaji)}</td></tr>` : ''}
    <tr><td><b>Laba bersih${b.gaji == null ? ' sebelum gaji' : ''}</b></td><td class="r num"><b style="color:${bersih < 0 ? 'var(--bad)' : 'var(--good)'}">${rp(bersih)}</b></td></tr>
   </tbody></table></div>
   ${b.gaji == null ? `<p class="small muted" style="margin:0">${st.petugas?.super ? 'Biaya gaji dihitung bila laporan mencakup bulan penuh (Bulanan/Tahunan).' : 'Biaya gaji hanya terlihat oleh super admin.'}</p>` : ''}
  </div>`;
}
// Rekap per part / mekanik / kasir / cabang dari daftar transaksi
function rekap(list) {
  const top = {};
  list.forEach(t => t.items.forEach(x => { top[x.kode] = top[x.kode] || { nama: x.nama, qty: 0, nilai: 0 }; top[x.kode].qty += x.qty; top[x.kode].nilai += x.qty * x.harga; }));
  const per = key => { const m = {}; list.forEach(t => { const k = t[key]; if (k) { m[k] = m[k] || { n: 0, total: 0 }; m[k].n++; m[k].total += t.total; } }); return Object.entries(m).sort((a, b) => b[1].total - a[1].total); };
  const perCab = cabangList(true).map(c => { const l = list.filter(t => cabangOf(t) === c.id); return [c.id, { n: l.length, total: l.reduce((a, t) => a + t.total, 0) }]; }).filter(([, v]) => v.n).sort((a, b) => b[1].total - a[1].total);
  return { top: Object.entries(top).sort((a, b) => b[1].qty - a[1].qty), mek: per('mekanik'), kas: per('kasir'), perCab };
}
const tglLabel = d => new Date(d + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const periodeLabel = (from, to) => from === to ? tglLabel(from) : tglLabel(from) + ' s/d ' + tglLabel(to);

async function renderLaporan() {
  const [from, to] = range(), L = st.lap;
  let base;
  let by = { keluar: 0, perKat: {}, gaji: null, gajiBulan: [], gajiKurang: [], list: [] };
  try { [base, by] = await Promise.all([source(from, to), biaya(from, to).catch(() => by)]); } catch (e) { toast(errMsg(e)); base = []; }
  if (st.view !== 'laporan') return;
  base.sort((a, b) => b.tgl.localeCompare(a.tgl));
  const list = applyFilter(base); L.list = list; terakhir = { from, to, base, list, by };
  const all = sums(base), s = sums(list);
  const top = {};
  base.forEach(t => t.items.forEach(x => { top[x.kode] = top[x.kode] || { nama: x.nama, qty: 0, nilai: 0 }; top[x.kode].qty += x.qty; top[x.kode].nilai += x.qty * x.harga; }));
  const topL = Object.entries(top).sort((a, b) => b[1].qty - a[1].qty).slice(0, 8), mx = topL.length ? topL[0][1].qty : 1;
  const per = (key) => { const m = {}; base.forEach(t => { const k = t[key]; if (k) { m[k] = m[k] || { n: 0, total: 0 }; m[k].n++; m[k].total += t.total; } }); return Object.entries(m).sort((a, b) => b[1].total - a[1].total); };
  const mek = per('mekanik'), kas = per('kasir');
  const perCab = gabungan() ? cabangList(true).map(c => { const l = base.filter(t => cabangOf(t) === c.id); return [c.id, { n: l.length, total: l.reduce((a, t) => a + t.total, 0) }]; }).filter(([, v]) => v.n).sort((a, b) => b[1].total - a[1].total) : [];
  const tile = (type, lbl, val, sub, color) => `<button class="tile click" type="button" data-act="lap-f" data-t="${type}" aria-pressed="${L.filter?.type === type}"><span class="lbl">${lbl}</span><span class="val"${color ? ` style="color:${color}"` : ''}>${val}</span><span class="sub">${sub}</span></button>`;
  $('#view').innerHTML = `<div class="grid">
   <div class="row spread">
    <div class="seg" role="group" aria-label="Jenis laporan">${RANGES.map(([k, l]) => `<button type="button" data-act="lap-r" data-r="${k}" aria-pressed="${k === L.range}">${l}</button>`).join('')}</div>
    <div class="row">${isRole('admin') && multiCabang() ? `<select id="lap-cab" style="width:auto" aria-label="Cabang"><option value="ini" ${gabungan() ? '' : 'selected'}>Cabang ${esc(namaCabang(cabAktif()))}</option><option value="semua" ${gabungan() ? 'selected' : ''}>Semua cabang</option></select>` : ''}<button class="btn" type="button" data-act="lap-xlsx" title="Unduh laporan Excel">⬇ Excel</button><button class="btn" type="button" data-act="lap-pdf" title="Unduh laporan PDF">⬇ PDF</button></div>
   </div>
   ${L.range === 'pilih' ? `<div class="row"><label class="f" for="lap-from">Dari<input id="lap-from" type="date" value="${esc(L.from)}"></label><label class="f" for="lap-to">Sampai<input id="lap-to" type="date" value="${esc(L.to)}"></label><button class="btn pri" type="button" data-act="lap-go" style="align-self:flex-end">Tampilkan</button></div>` : ''}
   ${L.range !== 'pilih' ? `<div class="lap-nav"><button class="btn sm" type="button" data-act="lap-geser" data-n="-1" aria-label="Periode sebelumnya">‹</button><b>${esc(judulPeriode(from, to))}</b><button class="btn sm" type="button" data-act="lap-geser" data-n="1" aria-label="Periode berikutnya" ${to >= dkey(new Date()) ? 'disabled' : ''}>›</button><input id="lap-anchor" type="date" value="${esc(L.anchor || dkey(new Date()))}" aria-label="Pilih tanggal" style="width:auto">${(L.anchor || dkey(new Date())) !== dkey(new Date()) ? '<button class="btn sm ghost" type="button" data-act="lap-kini">Hari ini</button>' : ''}</div>` : ''}
   <p class="small muted" style="margin:0">${esc(judulPeriode(from, to))} · klik angka, part, mekanik, kasir, atau baris rincian untuk menyaring.</p>
   <div class="tiles t5">
    ${tile('semua', 'Total omzet', rp(all.total), all.n + ' transaksi')}
    ${tile('part', 'Penjualan part', rp(all.part), all.qty + ' pcs')}
    ${tile('servis', 'Jasa servis', rp(all.jasa), 'biaya lain ' + rp(all.biaya))}
    ${tile('ksg', 'Klaim KSG', rp(all.klaim), all.ksg + ' servis KSG')}
    <div class="tile"><span class="lbl">Laba kotor</span><span class="val" style="color:var(--good)">${rp(all.laba)}</span><span class="sub">diskon ${rp(all.dis)}</span></div>
   </div>
   ${partNominalHTML(base)}
   ${labaBersihHTML(all, by)}
   ${perCab.length ? `<div class="panel"><h3>Omzet per cabang</h3><div class="tw"><table><thead><tr><th>Cabang</th><th class="r">Nota</th><th class="r">Total</th></tr></thead><tbody>${perCab.map(([id, v]) => `<tr class="row-click" tabindex="0" data-act="lap-f" data-t="cabang" data-v="${esc(id)}"><td>${esc(namaCabang(id))}</td><td class="r num">${v.n}</td><td class="r num">${rp(v.total)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
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
   ${rincianPeriode(base, from, to)}
   <div class="panel"><div class="row spread"><h3>Daftar transaksi</h3>${L.filter ? `<span class="chip">${esc(filterLabel(L.filter))} · ${list.length} nota · ${rp(s.total)}<button type="button" data-act="lap-clear" aria-label="Hapus filter">✕</button></span>` : `<span class="small muted">${list.length} nota</span>`}</div>
    <div class="tw"><table><thead><tr><th>No. nota</th><th>Waktu</th><th>Jenis</th><th>Pelanggan</th><th>Kasir</th><th class="r">Total</th></tr></thead><tbody>${list.map(t => `<tr class="row-click" tabindex="0" data-act="nota" data-no="${esc(t.no)}"><td class="mono">${esc(t.no)}</td><td class="num">${t.tgl.slice(5).replace('-', '/')}</td><td>${t.jenis === 'SERVIS' ? jenisBadge(t) : '<span class="pill p-good">Part</span>'}</td><td>${esc(t.pelanggan)}${t.nopol ? ` <span class="small muted mono">${esc(t.nopol)}</span>` : ''}</td><td class="small">${esc(t.kasir || '')}</td><td class="r num">${rp(t.total)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Tidak ada transaksi.</td></tr>'}</tbody></table></div>
   </div></div>`;
}

async function exportXlsx() {
  const list = st.lap.list || [];
  if (!list.length) { toast('Tidak ada transaksi untuk diexport'); return; }
  try {
    const X = await loadXLSX();
    const rows = list.map(t => ({ nota: t.no, ...(multiCabang() ? { cabang: namaCabang(cabangOf(t)) } : {}), waktu: t.tgl, jenis: t.jenis === 'SERVIS' ? 'Servis ' + (t.jenisServis || 'Reguler') : 'Part', pelanggan: t.pelanggan, nopol: t.nopol || '', mekanik: t.mekanik || '', kasir: t.kasir || '',
      sparepart: t.items.reduce((a, x) => a + x.qty * x.harga, 0), jasa: (t.jasa || []).reduce((a, j) => a + j.harga, 0), klaim_ksg: t.jasaKlaim || 0, biaya_lain: (t.biaya || []).reduce((a, b) => a + b.jumlah, 0), diskon: t.diskon || 0, total: t.total, metode: t.metode || 'Cash', cash_bersih: t.cash == null ? t.total : (t.cash || 0) - (t.kembali || 0), transfer: t.transfer || 0, rekening: t.rekening || '' }));
    const r = rekap(list), sm = sums(list), [from, to] = range();
    const by = terakhir?.by || { keluar: 0, gaji: null, list: [] };
    let pJual = 0, pBeli = 0; list.forEach(t => (t.items || []).forEach(x => { pJual += x.qty * x.harga; pBeli += x.qty * (x.beli || 0); }));
    const ringkas = [
      { keterangan: 'Periode', nilai: judulPeriode(from, to) },
      { keterangan: 'Cabang', nilai: gabungan() ? 'Semua cabang' : namaCabang(cabAktif()) },
      ...(st.lap.filter ? [{ keterangan: 'Filter', nilai: filterLabel(st.lap.filter) }] : []),
      { keterangan: 'Jumlah transaksi', nilai: sm.n }, { keterangan: 'Total omzet', nilai: sm.total }, { keterangan: 'Penjualan sparepart', nilai: sm.part },
      { keterangan: 'Sparepart terjual (pcs)', nilai: sm.qty }, { keterangan: 'Jasa servis', nilai: sm.jasa }, { keterangan: 'Biaya lain', nilai: sm.biaya },
      { keterangan: 'Part: harga beli (modal)', nilai: pBeli }, { keterangan: 'Part: laba', nilai: pJual - pBeli },
      { keterangan: 'Klaim KSG (main dealer)', nilai: sm.klaim }, { keterangan: 'Diskon', nilai: sm.dis }, { keterangan: 'Laba kotor', nilai: sm.laba },
      { keterangan: 'Uang masuk cash', nilai: sm.cash }, { keterangan: 'Uang masuk transfer', nilai: sm.transfer },
      ...(st.lap.filter ? [] : [{ keterangan: 'Pengeluaran operasional', nilai: by.keluar }, ...(by.gaji != null ? [{ keterangan: 'Gaji & insentif (slip dikunci)', nilai: by.gaji }] : []), { keterangan: by.gaji != null ? 'Laba bersih' : 'Laba bersih sebelum gaji', nilai: sm.laba - by.keluar - (by.gaji || 0) }])
    ];
    const items = []; list.forEach(t => t.items.forEach(x => items.push({ nota: t.no, waktu: t.tgl, kode: x.kode, nama: x.nama, qty: x.qty, harga: x.harga, jumlah: x.qty * x.harga, harga_beli: x.beli || 0, laba: x.qty * (x.harga - (x.beli || 0)) })));
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(ringkas), 'Ringkasan');
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows), 'Transaksi');
    if (items.length) X.utils.book_append_sheet(wb, X.utils.json_to_sheet(items), 'Item sparepart');
    if (r.top.length) X.utils.book_append_sheet(wb, X.utils.json_to_sheet(r.top.map(([kode, v]) => ({ kode, nama: v.nama, qty: v.qty, nilai: v.nilai }))), 'Part terlaris');
    if (r.mek.length) X.utils.book_append_sheet(wb, X.utils.json_to_sheet(r.mek.map(([m, v]) => ({ mekanik: m, motor: v.n, total: v.total }))), 'Per mekanik');
    if (multiCabang()) X.utils.book_append_sheet(wb, X.utils.json_to_sheet(r.perCab.map(([id, v]) => ({ cabang: namaCabang(id), nota: v.n, total: v.total }))), 'Per cabang');
    X.writeFile(wb, `laporan-penjualan-${from}_${to}.xlsx`);
  } catch (e) { toast('Gagal export: ' + e.message); }
}

async function exportPdf(el) {
  const list = st.lap.list || [];
  if (!list.length) { toast('Tidak ada transaksi untuk dibuat PDF'); return; }
  const label = el?.textContent; if (el) { el.disabled = true; el.textContent = 'Menyiapkan…'; }
  try {
    const [from, to] = range(), r = rekap(list), sm = sums(list);
    const { laporanPdfBlob } = await import('./laporan-pdf.js');
    const { saveBlob } = await import('./nota-pdf.js');
    const rpx = v => rp(v);
    const blob = await laporanPdfBlob({
      judul: 'Laporan penjualan ' + judulPeriode(from, to), periode: judulPeriode(from, to),
      cabang: gabungan() ? 'Semua cabang' : multiCabang() ? 'Cabang ' + namaCabang(cabAktif()) : '',
      filter: st.lap.filter ? filterLabel(st.lap.filter) : '',
      ringkasan: [['Total omzet', rpx(sm.total), sm.n + ' transaksi'], ['Penjualan part', rpx(sm.part), sm.qty + ' pcs'], ['Jasa servis', rpx(sm.jasa), ''], ['Biaya lain', rpx(sm.biaya), ''],
        ['Klaim KSG', rpx(sm.klaim), sm.ksg + ' servis KSG'], ['Diskon', rpx(sm.dis), ''], ['Laba kotor', rpx(sm.laba), ''], ['Uang masuk', rpx(sm.cash + sm.transfer), 'cash ' + rpx(sm.cash)],
        ...(st.lap.filter ? [] : (() => { const by = terakhir?.by || { keluar: 0, gaji: null }; return [['Pengeluaran', rpx(by.keluar), 'operasional'], ...(by.gaji != null ? [['Gaji & insentif', rpx(by.gaji), 'slip dikunci']] : []), [by.gaji != null ? 'Laba bersih' : 'Laba bersih (sblm gaji)', rpx(sm.laba - by.keluar - (by.gaji || 0)), '']]; })())],
      perCabang: multiCabang() && gabungan() ? r.perCab.map(([id, v]) => [namaCabang(id), v]) : [],
      uangMasuk: [['Cash (setelah kembalian)', rpx(sm.cash)], ...Object.values(sm.rek).map(x => ['Transfer - ' + x.label + ' (' + x.n + ' nota)', rpx(x.total)]), ['Total uang masuk', rpx(sm.cash + sm.transfer)]],
      top: r.top.slice(0, 15), mekanik: r.mek, kasir: r.kas, list
    });
    saveBlob(blob, `laporan-penjualan-${from}_${to}.pdf`);
  } catch (e) { toast('Gagal membuat PDF: ' + e.message); }
  finally { if (el) { el.disabled = false; el.textContent = label; } }
}

views.laporan = renderLaporan;
Object.assign(actions, {
  'lap-r': el => { st.lap.range = el.dataset.r; st.lap.filter = null; if (el.dataset.r === 'pilih' && !st.lap.from) { const [f, t] = range(); st.lap.from = f; st.lap.to = t; } renderLaporan(); },
  'lap-geser': el => { geser(+el.dataset.n); st.lap.filter = null; renderLaporan(); },
  'lap-kini': () => { st.lap.anchor = dkey(new Date()); st.lap.filter = null; renderLaporan(); },
  'lap-buka': el => { st.lap.range = el.dataset.b === '1' ? 'bulan' : 'hari'; st.lap.anchor = el.dataset.b === '1' ? el.dataset.k + '-01' : el.dataset.k; st.lap.filter = null; renderLaporan(); },
  'lap-go': () => { if (st.lap.from > st.lap.to) { toast('Tanggal awal harus sebelum tanggal akhir'); return; } renderLaporan(); },
  'lap-f': el => {
    const t = el.dataset.t;
    st.lap.filter = t === 'semua' || (st.lap.filter && st.lap.filter.type === t && st.lap.filter.value === el.dataset.v) ? null : { type: t, value: el.dataset.v, label: el.dataset.l };
    renderLaporan();
  },
  'go-kas': () => go('kas'),
  'lap-clear': () => { st.lap.filter = null; renderLaporan(); },
  'lap-xlsx': exportXlsx,
  'lap-pdf': exportPdf
});
changeHandlers.push(e => { if (e.target.id === 'lap-cab') { st.lap.semuaCabang = e.target.value === 'semua'; st.lap.filter = null; renderLaporan(); } });
changeHandlers.push(e => { if (e.target.id === 'lap-anchor' && e.target.value) { st.lap.anchor = e.target.value; st.lap.filter = null; renderLaporan(); } });
changeHandlers.push(e => { if (e.target.id === 'lap-from') st.lap.from = e.target.value; if (e.target.id === 'lap-to') st.lap.to = e.target.value; });
