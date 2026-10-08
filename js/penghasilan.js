// Menu Penghasilan: gaji pokok + insentif penjualan pribadi − potongan, per bulan.
// Karyawan melihat penghasilannya sendiri; admin/pemilik melihat rekap semua karyawan.
// Aturan insentif & potongan diatur super admin di Master Data → Insentif & Potongan (meta/settings.penghasilan).
//
// Penjualan pribadi dihitung dari nota:
//   mekanik    = servis yang dia kerjakan          kasir & admin = nota yang dia terima pembayarannya
//   registrasi = servis yang dia daftarkan          sparepart     = servis yang order sparepartnya dia input
// Insentif bertingkat: tingkat tertinggi yang tercapai, persennya dikalikan SELURUH nilai penjualan.
import { $, esc, rp, dkey, toast, errMsg } from './util.js';
import { S, st, views, refreshers, actions, changeHandlers, isRole } from './state.js';
import { db, collection, getDocs, query, where } from './firebase.js';
import { ROLES } from './config.js';
import { loadLoginList } from './akun.js';
import { namaCabang, multiCabang } from './cabang.js';
import { loaderHTML } from './brand.js';
import { loadXLSX } from './import-excel.js';

export const SUMBER = {
  part: 'Penjualan sparepart',
  jasa: 'Jasa servis (termasuk klaim KSG)',
  biaya: 'Biaya lain (cuci, las, dll.)',
  omzet: 'Total nota'
};
export const cfgPenghasilan = () => ({ insentif: [], potongan: [], ...(S.settings.penghasilan || {}) });

/* ---------- Perhitungan ---------- */
// org = { peran, id, nama, mekanikId, gaji, komisi }
export function trxPribadi(list, org) {
  const sama = (id, nama, idT, namaT) => (id && idT ? id === idT : !!nama && String(nama).toUpperCase() === String(namaT || '').toUpperCase());
  if (org.peran === 'mekanik') return list.filter(t => t.jenis === 'SERVIS' && (org.mekanikId && t.mekanikId ? t.mekanikId === org.mekanikId : String(t.mekanik || '').toUpperCase() === String(org.nama).toUpperCase()));
  if (org.peran === 'registrasi') return list.filter(t => t.jenis === 'SERVIS' && sama(org.id, org.nama, t.registrasiId, t.registrasiOleh));
  if (org.peran === 'sparepart') return list.filter(t => t.jenis === 'SERVIS' && sama(org.id, org.nama, t.orderOlehId, t.orderOleh));
  return list.filter(t => sama(org.id, org.nama, t.kasirId, t.kasir));   // kasir & admin
}
export function nilaiSumber(list, sumber) {
  return list.reduce((a, t) => a + (
    sumber === 'part' ? (t.items || []).reduce((b, x) => b + x.qty * x.harga, 0)
    : sumber === 'jasa' ? (t.jasa || []).reduce((b, j) => b + (+j.harga || 0), 0) + (t.jasaKlaim || 0)
    : sumber === 'biaya' ? (t.biaya || []).reduce((b, x) => b + (+x.jumlah || 0), 0)
    : (t.total || 0)), 0);
}
const berlaku = (item, peran) => item.aktif !== false && (item.peran || []).includes(peran);
const urutTingkat = item => [...(item.tingkat || [])].filter(t => t.persen > 0).sort((a, b) => a.min - b.min);

export function hitung(org, list, cfg = cfgPenghasilan()) {
  const pribadi = trxPribadi(list, org);
  const insentif = cfg.insentif.filter(i => berlaku(i, org.peran)).map(item => {
    const nilai = nilaiSumber(pribadi, item.sumber), tk = urutTingkat(item);
    const capai = [...tk].reverse().find(t => nilai >= t.min) || null;
    const berikut = tk.find(t => nilai < t.min) || null;
    return { item, nilai, capai, berikut, jumlah: capai ? Math.round(nilai * capai.persen / 100) : 0 };
  });
  // Komisi mekanik lama (Master Data → Mekanik, % dari nilai jasa) tetap dihitung bila diisi
  const komisi = org.peran === 'mekanik' && org.komisi ? Math.round(nilaiSumber(pribadi, 'jasa') * org.komisi / 100) : 0;
  const potongan = cfg.potongan.filter(p => berlaku(p, org.peran)).map(item => ({ item, jumlah: +item.jumlah || 0 }));
  const gaji = +org.gaji || 0, totIns = insentif.reduce((a, x) => a + x.jumlah, 0) + komisi, totPot = potongan.reduce((a, x) => a + x.jumlah, 0);
  return { org, pribadi, insentif, komisi, potongan, gaji, totIns, totPot, bersih: gaji + totIns - totPot };
}

/* ---------- Periode & data ---------- */
const bulanIni = () => dkey(new Date()).slice(0, 7);
const geserBulan = (ym, n) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return dkey(d).slice(0, 7); };
const namaBulan = ym => new Date(ym + '-01T00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
const akhirBulan = ym => { const [y, m] = ym.split('-').map(Number); return dkey(new Date(y, m, 0)); };
let loadedFrom = '';   // diisi main.js (awal data transaksi realtime)
export const setPhLoadedFrom = f => { loadedFrom = f; };
const cache = {};
async function trxBulan(ym) {
  const from = ym + '-01', to = akhirBulan(ym);
  if (from >= loadedFrom) return (S.trxSemua.length ? S.trxSemua : S.trx).filter(t => t.tgl.slice(0, 10) >= from && t.tgl.slice(0, 10) <= to);
  if (!cache[ym]) { const s = await getDocs(query(collection(db, 'trx'), where('tgl', '>=', from), where('tgl', '<=', to + ' 99'))); cache[ym] = s.docs.map(d => d.data()); }
  return cache[ym];
}

// Daftar karyawan (untuk rekap admin): petugas PIN + mekanik (termasuk yang belum punya login)
let staffGaji = null;
async function daftarKaryawan() {
  const [login, sd] = await Promise.all([loadLoginList(), staffGaji ? null : getDocs(collection(db, 'staff')).catch(() => null)]);
  if (sd) { staffGaji = {}; sd.docs.forEach(d => { const x = d.data(); if (x.loginId) staffGaji[x.loginId] = x; }); }
  const mek = S.mekanikSemua.length ? S.mekanikSemua : S.mekanik;
  const org = login.filter(p => p.peran !== 'mekanik').map(p => ({ peran: p.peran, id: p.id, nama: p.nama, cabang: p.cabang, gaji: staffGaji?.[p.id]?.gaji || 0 }));
  mek.filter(m => m.aktif !== false).forEach(m => org.push({ peran: 'mekanik', id: m.loginId || '', mekanikId: m.id, nama: m.nama, cabang: m.cabang, gaji: m.gaji || 0, komisi: m.komisi || 0 }));
  return org.sort((a, b) => a.nama.localeCompare(b.nama));
}
function saya() {
  const p = st.petugas || {};
  if (st.role === 'mekanik') {
    const m = (S.mekanikSemua.length ? S.mekanikSemua : S.mekanik).find(x => x.id === p.mekanikId) || {};
    return { peran: 'mekanik', id: p.loginId, mekanikId: p.mekanikId, nama: m.nama || p.nama, cabang: p.cabang, gaji: m.gaji || 0, komisi: m.komisi || 0 };
  }
  return { peran: st.role, id: p.loginId || p.email, nama: p.nama || p.email, cabang: p.cabang, gaji: p.gaji || 0 };
}

/* ---------- Tampilan ---------- */
const PH = st.ph = st.ph || { bulan: bulanIni(), pilih: null };
const bar = (v, max) => `<span class="ph-bar"><i style="width:${Math.max(2, Math.min(100, max ? v / max * 100 : 100))}%"></i></span>`;

function rincianHTML(h, judul) {
  const ins = h.insentif.map(x => {
    const tk = urutTingkat(x.item), target = x.berikut?.min || x.capai?.min || 0;
    return `<div class="ph-item">
      <div class="row spread"><b>${esc(x.item.nama)}</b><span class="num ${x.jumlah ? 'ph-plus' : 'muted'}">${x.jumlah ? '+' + rp(x.jumlah) : rp(0)}</span></div>
      <div class="small muted">${esc(SUMBER[x.item.sumber] || x.item.sumber)} pribadi bulan ini: <b class="num" style="color:var(--ink)">${rp(x.nilai)}</b></div>
      ${tk.length ? bar(x.nilai, target) : ''}
      <div class="small">${x.capai ? `Tercapai ≥ ${rp(x.capai.min)} → <b>${x.capai.persen}%</b> × ${rp(x.nilai)}` : '<span class="muted">Belum mencapai target</span>'}${x.berikut ? ` · <span class="muted">kurang <b>${rp(x.berikut.min - x.nilai)}</b> lagi untuk ${x.berikut.persen}%</span>` : ''}</div>
      <div class="ph-tk">${tk.map(t => `<span class="${x.capai && t.min <= x.capai.min ? 'on' : ''}">≥ ${rp(t.min)} · ${t.persen}%</span>`).join('')}</div>
    </div>`;
  }).join('');
  return `<div class="panel">
    <div class="row spread"><h3>${esc(judul)}</h3><span class="small muted">${h.pribadi.length} nota pribadi</span></div>
    <div class="tiles ph-tiles">
     <div class="tile"><span class="lbl">Gaji pokok</span><span class="val">${rp(h.gaji)}</span></div>
     <div class="tile"><span class="lbl">Insentif</span><span class="val" style="color:var(--good)">+${rp(h.totIns)}</span></div>
     <div class="tile"><span class="lbl">Potongan</span><span class="val" style="color:var(--bad)">−${rp(h.totPot)}</span></div>
     <div class="tile ph-net"><span class="lbl">Penghasilan bersih</span><span class="val">${rp(h.bersih)}</span><span class="sub">perkiraan, final ditetapkan pemilik</span></div>
    </div>
    <h3>Insentif</h3>
    ${ins || (h.komisi ? '' : '<div class="small muted">Belum ada insentif untuk peran ini.</div>')}
    ${h.komisi ? `<div class="ph-item"><div class="row spread"><b>Komisi mekanik ${h.org.komisi}%</b><span class="num ph-plus">+${rp(h.komisi)}</span></div><div class="small muted">dari nilai jasa servis yang dikerjakan</div></div>` : ''}
    <h3>Potongan</h3>
    ${h.potongan.length ? `<div class="tw"><table><tbody>${h.potongan.map(p => `<tr><td>${esc(p.item.nama)}</td><td class="r num" style="color:var(--bad)">−${rp(p.jumlah)}</td></tr>`).join('')}<tr><td><b>Total potongan</b></td><td class="r num"><b>−${rp(h.totPot)}</b></td></tr></tbody></table></div>` : '<div class="small muted">Tidak ada potongan.</div>'}
  </div>`;
}

let rekap = null;
async function renderPenghasilan() {
  const ym = PH.bulan, admin = isRole('admin');
  $('#view').innerHTML = `<div class="grid">
    <div class="row spread"><div class="seg" role="group" aria-label="Bulan">${[[bulanIni(), 'Bulan ini'], [geserBulan(bulanIni(), -1), 'Bulan lalu']].map(([k, l]) => `<button type="button" data-act="ph-bulan" data-b="${k}" aria-pressed="${k === ym}">${l}</button>`).join('')}</div>
     <div class="row"><label class="f" for="ph-bln" style="flex-direction:row;align-items:center;gap:6px">Bulan<input id="ph-bln" type="month" value="${ym}" style="width:auto"></label>${admin ? '<button class="btn" type="button" data-act="ph-xlsx">⬇ Excel</button>' : ''}</div></div>
    <p class="small muted" style="margin:0">${esc(namaBulan(ym))} · dihitung dari penjualan pribadi. ${admin ? 'Klik nama karyawan untuk melihat rinciannya.' : ''}</p>
    <div id="ph-isi">${loaderHTML('Menghitung…')}</div></div>`;
  let list;
  try { list = await trxBulan(ym); } catch (e) { $('#ph-isi').innerHTML = `<div class="err">${esc(errMsg(e))}</div>`; return; }
  if (st.view !== 'penghasilan' || PH.bulan !== ym) return;
  if (!admin) { $('#ph-isi').innerHTML = rincianHTML(hitung(saya(), list), 'Penghasilan saya · ' + namaBulan(ym)); return; }
  try {
    const org = await daftarKaryawan();
    rekap = org.map(o => hitung(o, list));
  } catch (e) { $('#ph-isi').innerHTML = `<div class="err">${esc(errMsg(e))}</div>`; return; }
  if (st.view !== 'penghasilan') return;
  const tot = k => rekap.reduce((a, h) => a + h[k], 0), sel = PH.pilih != null ? rekap[PH.pilih] : null;
  $('#ph-isi').innerHTML = `<div class="panel"><h3>Rekap penghasilan karyawan</h3>
    ${rekap.length ? `<div class="tw"><table><thead><tr><th>Nama</th><th>Peran</th>${multiCabang() ? '<th>Cabang</th>' : ''}<th class="r">Gaji pokok</th><th class="r">Insentif</th><th class="r">Potongan</th><th class="r">Bersih</th></tr></thead><tbody>
     ${rekap.map((h, i) => `<tr class="row-click" tabindex="0" data-act="ph-pilih" data-i="${i}" aria-current="${i === PH.pilih}"><td>${esc(h.org.nama)}</td><td class="small">${esc(ROLES[h.org.peran] || h.org.peran)}</td>${multiCabang() ? `<td class="small">${esc(namaCabang(h.org.cabang))}</td>` : ''}<td class="r num">${rp(h.gaji)}</td><td class="r num" style="color:var(--good)">${h.totIns ? '+' + rp(h.totIns) : '–'}</td><td class="r num" style="color:var(--bad)">${h.totPot ? '−' + rp(h.totPot) : '–'}</td><td class="r num"><b>${rp(h.bersih)}</b></td></tr>`).join('')}
     <tr><td colspan="${multiCabang() ? 3 : 2}"><b>Total</b></td><td class="r num"><b>${rp(tot('gaji'))}</b></td><td class="r num"><b>${rp(tot('totIns'))}</b></td><td class="r num"><b>${rp(tot('totPot'))}</b></td><td class="r num"><b>${rp(tot('bersih'))}</b></td></tr>
    </tbody></table></div>` : '<div class="small muted">Belum ada karyawan. Tambahkan di Master Data → Petugas &amp; PIN atau Mekanik.</div>'}
    ${st.petugas?.super ? '<p class="small muted" style="margin:0">Atur gaji pokok, insentif, dan potongan di Master Data → Insentif &amp; Potongan.</p>' : ''}
   </div>
   ${sel ? rincianHTML(sel, sel.org.nama + ' · ' + namaBulan(ym)) : ''}`;
}

async function exportXlsx() {
  if (!rekap?.length) { toast('Belum ada data'); return; }
  try {
    const X = await loadXLSX(), cfg = cfgPenghasilan();
    const rows = rekap.map(h => {
      const r = { nama: h.org.nama, peran: ROLES[h.org.peran] || h.org.peran, ...(multiCabang() ? { cabang: namaCabang(h.org.cabang) } : {}), gaji_pokok: h.gaji };
      h.insentif.forEach(x => { r[x.item.nama + ' (dasar)'] = x.nilai; r[x.item.nama] = x.jumlah; });
      if (h.komisi) r['Komisi mekanik'] = h.komisi;
      h.potongan.forEach(p => { r['Potongan ' + p.item.nama] = p.jumlah; });
      return { ...r, total_insentif: h.totIns, total_potongan: h.totPot, penghasilan_bersih: h.bersih };
    });
    // urutan kolom: identitas, rincian insentif/potongan (semua item), lalu total di paling kanan
    const akhir = ['total_insentif', 'total_potongan', 'penghasilan_bersih'], kol = [];
    rows.forEach(r => Object.keys(r).forEach(k => { if (!kol.includes(k) && !akhir.includes(k)) kol.push(k); }));
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows, { header: [...kol, ...akhir] }), 'Penghasilan ' + PH.bulan);
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet([...cfg.insentif.map(i => ({ jenis: 'Insentif', nama: i.nama, sumber: SUMBER[i.sumber], peran: (i.peran || []).map(r => ROLES[r]).join(', '), tingkat: urutTingkat(i).map(t => `>= ${t.min}: ${t.persen}%`).join('; '), aktif: i.aktif !== false ? 'ya' : 'tidak' })),
      ...cfg.potongan.map(p => ({ jenis: 'Potongan', nama: p.nama, sumber: '', peran: (p.peran || []).map(r => ROLES[r]).join(', '), tingkat: p.jumlah, aktif: p.aktif !== false ? 'ya' : 'tidak' }))]), 'Aturan');
    X.writeFile(wb, `penghasilan-karyawan-${PH.bulan}.xlsx`);
  } catch (e) { toast('Gagal export: ' + e.message); }
}

views.penghasilan = renderPenghasilan;
refreshers.penghasilan = () => {};
Object.assign(actions, {
  'ph-bulan': el => { PH.bulan = el.dataset.b; PH.pilih = null; renderPenghasilan(); },
  'ph-pilih': el => { PH.pilih = PH.pilih === +el.dataset.i ? null : +el.dataset.i; renderPenghasilan(); },
  'ph-xlsx': exportXlsx
});
changeHandlers.push(e => { if (e.target.id === 'ph-bln' && e.target.value) { PH.bulan = e.target.value; PH.pilih = null; renderPenghasilan(); } });
// Gaji pokok petugas berubah di master → muat ulang
export const resetStaffGaji = () => { staffGaji = null; };
