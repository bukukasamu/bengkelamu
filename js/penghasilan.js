// Menu Penghasilan: gaji pokok + insentif penjualan pribadi − potongan, per bulan.
// Karyawan melihat penghasilannya sendiri; admin/pemilik melihat rekap semua karyawan.
// Aturan insentif & potongan diatur super admin di Master Data → Insentif & Potongan (meta/settings.penghasilan).
//
// Penjualan pribadi dihitung dari nota:
//   mekanik    = servis yang dia kerjakan          kasir & admin = nota yang dia terima pembayarannya
//   registrasi = servis yang dia daftarkan          sparepart     = servis yang order sparepartnya dia input
// Insentif bertingkat: tingkat tertinggi yang tercapai, persennya dikalikan SELURUH nilai penjualan.
import { $, esc, rp, dkey, stamp, toast, errMsg, modal } from './util.js';
import { S, st, views, refreshers, actions, changeHandlers, isRole } from './state.js';
import { db, collection, getDocs, getDoc, doc, setDoc, writeBatch, query, where } from './firebase.js';
import { mintaPassword } from './otorisasi.js';
import { ROLES, APP_NAME } from './config.js';
import { loadLoginList } from './akun.js';
import { namaCabang, multiCabang } from './cabang.js';
import { loaderHTML } from './brand.js';
import { loadXLSX } from './import-excel.js';
import { ambilTrx } from './data-trx.js';
import { muatAturanAbsen, absenBulan, rekapAbsen } from './absensi.js';

export const SUMBER = {
  part: 'Penjualan sparepart',
  jasa: 'Jasa servis (termasuk klaim KSG)',
  biaya: 'Biaya lain (cuci, las, dll.)',
  omzet: 'Total nota'
};
export const cfgPenghasilan = () => ({ insentif: [], potongan: [], ...(S.aturan || S.settings.penghasilan || {}) });

/* ---------- Perhitungan ---------- */
// org = { peran, id, nama, mekanikId, gaji, komisi }
// Dasar penjualan pribadi bisa dipilih per item insentif (kosong = otomatis sesuai peran)
export const DASAR = {
  kasir: 'Nota yang ia terima pembayarannya (kasir)',
  mekanik: 'Servis yang ia kerjakan (mekanik)',
  registrasi: 'Servis yang ia daftarkan',
  order: 'Servis yang order sparepart-nya ia input',
  cabang: 'Semua nota di cabangnya'
};
const DASAR_PERAN = { mekanik: ['mekanik'], registrasi: ['registrasi'], sparepart: ['order'], kasir: ['kasir'], admin: ['kasir'] };
export function trxPribadi(list, org, dasar) {
  const pakai = dasar && dasar.length ? dasar : (DASAR_PERAN[org.peran] || ['kasir']);
  const sama = (id, nama, idT, namaT) => (id && idT ? id === idT : !!nama && String(nama).toUpperCase() === String(namaT || '').toUpperCase());
  const cocok = {
    mekanik: t => t.jenis === 'SERVIS' && (org.mekanikId && t.mekanikId ? t.mekanikId === org.mekanikId : String(t.mekanik || '').toUpperCase() === String(org.nama).toUpperCase()),
    registrasi: t => t.jenis === 'SERVIS' && sama(org.id, org.nama, t.registrasiId, t.registrasiOleh),
    order: t => t.jenis === 'SERVIS' && sama(org.id, org.nama, t.orderOlehId, t.orderOleh),
    kasir: t => sama(org.id, org.nama, t.kasirId, t.kasir),
    cabang: t => (t.cabang || 'UTM') === (org.cabang || 'UTM')
  };
  return list.filter(t => pakai.some(k => cocok[k]?.(t)));
}
export function nilaiSumber(list, sumber) {
  return list.reduce((a, t) => a + (
    sumber === 'part' ? (t.items || []).reduce((b, x) => b + x.qty * x.harga, 0)
    : sumber === 'jasa' ? (t.jasa || []).reduce((b, j) => b + (+j.harga || 0), 0) + (t.jasaKlaim || 0)
    : sumber === 'biaya' ? (t.biaya || []).reduce((b, x) => b + (+x.jumlah || 0), 0)
    : (t.total || 0)), 0);
}
// Kunci karyawan: petugas = loginId, mekanik = 'M:' + id mekanik
export const kunciOrg = o => o.peran === 'mekanik' ? 'M:' + (o.mekanikId || '') : (o.id || '');
// Item berlaku untuk orang tertentu (bila dipilih) atau untuk semua orang di peran terpilih
const berlaku = (item, org) => item.aktif !== false && ((item.orang || []).length ? item.orang.includes(kunciOrg(org)) : (item.peran || []).includes(org.peran));
const urutTingkat = item => [...(item.tingkat || [])].filter(t => t.persen > 0).sort((a, b) => a.min - b.min);

export function hitung(org, list, cfg = cfgPenghasilan()) {
  const pribadi = trxPribadi(list, org);
  const insentif = cfg.insentif.filter(i => berlaku(i, org)).map(item => {
    const nilai = nilaiSumber(item.dasar?.length ? trxPribadi(list, org, item.dasar) : pribadi, item.sumber), tk = urutTingkat(item);
    const capai = [...tk].reverse().find(t => nilai >= t.min) || null;
    const berikut = tk.find(t => nilai < t.min) || null;
    return { item, nilai, capai, berikut, jumlah: capai ? Math.round(nilai * capai.persen / 100) : 0 };
  });
  // Komisi mekanik (% dari nilai jasa) dari data gaji privat, bila diisi super admin
  const komisi = org.peran === 'mekanik' && org.komisi ? Math.round(nilaiSumber(pribadi, 'jasa') * org.komisi / 100) : 0;
  const potongan = cfg.potongan.filter(p => berlaku(p, org)).map(item => ({ item, jumlah: +item.jumlah || 0 }));
  // Absensi: uang hadir per hari & potongan terlambat (dari menu Absensi), bila datanya dimuat
  const ab = org.absen ? { hadir: org.absen.hadir, uangHadir: org.absen.uangHadir || 0, telat: org.absen.telat, potongTelat: org.absen.potongTelat || 0, cepat: org.absen.cepat, potongCepat: org.absen.potongCepat || 0, tanpaPulang: org.absen.tanpaPulang, tarifHadir: org.absen.tarifHadir, tarifTelat: org.absen.tarifTelat } : null;
  const gaji = +org.gaji || 0, totIns = insentif.reduce((a, x) => a + x.jumlah, 0) + komisi + (ab?.uangHadir || 0), totPot = potongan.reduce((a, x) => a + x.jumlah, 0) + (ab ? ab.potongTelat + ab.potongCepat : 0);
  return { org, pribadi, insentif, komisi, potongan, absen: ab, gaji, totIns, totPot, bersih: gaji + totIns - totPot };
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
  if (!cache[ym]) cache[ym] = await ambilTrx(from, to);
  return cache[ym];
}

// Gaji pokok & komisi tersimpan privat di gaji/{kunci}: hanya karyawan ybs. dan super admin yang bisa membaca
let semuaGaji = null;
export const resetStaffGaji = () => { semuaGaji = null; };
async function daftarKaryawan() {
  const [login, gs] = await Promise.all([loadLoginList(), semuaGaji ? null : getDocs(collection(db, 'gaji'))]);
  if (gs) { semuaGaji = {}; gs.docs.forEach(d => { semuaGaji[d.id] = d.data(); }); }
  const mek = S.mekanikSemua.length ? S.mekanikSemua : S.mekanik;
  const org = login.filter(p => p.peran !== 'mekanik').map(p => ({ peran: p.peran, id: p.id, nama: p.nama, cabang: p.cabang, gaji: semuaGaji[p.id]?.gaji || 0 }));
  mek.filter(m => m.aktif !== false).forEach(m => org.push({ peran: 'mekanik', id: m.loginId || '', mekanikId: m.id, nama: m.nama, cabang: m.cabang, gaji: semuaGaji['M:' + m.id]?.gaji || 0, komisi: semuaGaji['M:' + m.id]?.komisi || 0 }));
  return org.sort((a, b) => a.nama.localeCompare(b.nama));
}
async function saya() {
  const p = st.petugas || {};
  const o = st.role === 'mekanik'
    ? { peran: 'mekanik', id: p.loginId, mekanikId: p.mekanikId, nama: ((S.mekanikSemua.length ? S.mekanikSemua : S.mekanik).find(x => x.id === p.mekanikId) || {}).nama || p.nama, cabang: p.cabang }
    : { peran: st.role, id: p.loginId || p.email, nama: p.nama || p.email, cabang: p.cabang };
  let g = {};
  try { const s = await getDoc(doc(db, 'gaji', kunciOrg(o))); g = s.exists() ? s.data() : {}; } catch (e) { /* belum diatur */ }
  return { ...o, gaji: +g.gaji || 0, komisi: +g.komisi || 0 };
}

// Lampirkan rekap absensi bulan itu ke setiap karyawan (org.absen)
async function lampirkanAbsen(orgs, ym, kunci = null) {
  try {
    const a = await muatAturanAbsen(true); if (a.aktif === false) return orgs;
    const rk = rekapAbsen(await absenBulan(ym, kunci), a);
    const nol = { hadir: 0, uangHadir: 0, telat: 0, potongTelat: 0, cepat: 0, potongCepat: 0, tanpaPulang: 0 };
    orgs.forEach(o => { o.absen = { ...nol, ...(rk[kunciOrg(o)] || {}), tarifHadir: +a.uangHadir || 0, tarifTelat: +a.potongTelat || 0 }; delete o.absen.list; });
  } catch (e) { console.warn('Absensi untuk penghasilan', e); }
  return orgs;
}

/* ---------- Kunci bulan ----------
   Super admin mengunci bulan → hasil hitung setiap karyawan disimpan sebagai slip (slip/{bulan}_{kunci}).
   Bulan terkunci selalu menampilkan slip tersimpan, jadi perubahan aturan sesudahnya tidak mengubah bulan itu. */
const slipId = (ym, key) => ym + '_' + key.replace(/[^A-Za-z0-9:_-]/g, '');
async function statusKunci(ym) { const s = await getDoc(doc(db, 'penghasilanBulan', ym)); return s.exists() && s.data().terkunci ? s.data() : null; }
const simpanHasil = h => ({ org: h.org, gaji: h.gaji, komisi: h.komisi, totIns: h.totIns, totPot: h.totPot, bersih: h.bersih, nNota: h.pribadi.length,
  insentif: h.insentif.map(x => ({ item: { nama: x.item.nama, sumber: x.item.sumber, tingkat: x.item.tingkat }, nilai: x.nilai, capai: x.capai, berikut: x.berikut, jumlah: x.jumlah })),
  potongan: h.potongan.map(p => ({ item: { nama: p.item.nama }, jumlah: p.jumlah })), absen: h.absen || null });
const dariSlip = d => ({ ...d, pribadi: { length: d.nNota || 0 }, terkunci: true });

/* ---------- Tampilan ---------- */
const PH = st.ph = st.ph || { bulan: bulanIni(), pilih: null };
const bar = (v, max) => `<span class="ph-bar"><i style="width:${Math.max(2, Math.min(100, max ? v / max * 100 : 100))}%"></i></span>`;

// Insight bulan berjalan: laju per hari, perkiraan akhir bulan, kebutuhan per hari untuk target berikutnya
function insight(x, ym) {
  if (ym !== bulanIni() || x.terkunci) return '';
  const now = new Date(), hari = now.getDate(), total = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(), sisa = total - hari + 1;
  const laju = x.nilai / hari, proyeksi = Math.round(laju * total), tk = urutTingkat(x.item);
  const tkProyeksi = [...tk].reverse().find(t => proyeksi >= t.min);
  const out = [];
  if (x.berikut) {
    const kurang = x.berikut.min - x.nilai, perHari = Math.ceil(kurang / sisa);
    out.push(`🎯 Untuk <b>${x.berikut.persen}%</b> perlu tambahan <b>${rp(kurang)}</b> dalam ${sisa} hari tersisa — sekitar <b>${rp(perHari)}/hari</b> (sekarang rata-rata ${rp(Math.round(laju))}/hari).`);
    out.push(`💰 Bila tercapai, insentif minimal <b>${rp(Math.round(x.berikut.min * x.berikut.persen / 100))}</b>${x.jumlah ? ` (naik dari ${rp(x.jumlah)})` : ''}.`);
  } else if (x.capai) out.push(`🏆 Tingkat tertinggi sudah tercapai. Setiap penjualan tambahan menambah ${x.capai.persen}% untuk Anda.`);
  if (x.nilai > 0) out.push(`📈 Dengan laju sekarang, akhir bulan diperkirakan <b>${rp(proyeksi)}</b> → ${tkProyeksi ? `insentif <b>${tkProyeksi.persen}%</b> ≈ ${rp(Math.round(proyeksi * tkProyeksi.persen / 100))}` : '<b>belum</b> mencapai target'}.`);
  else out.push(`📌 Belum ada penjualan pribadi bulan ini untuk item ini.`);
  return `<ul class="ph-insight">${out.map(t => `<li>${t}</li>`).join('')}</ul>`;
}

// Ringkasan target di atas: berapa insentif yang masih bisa dikejar bulan ini
function ringkasTarget(h, ym) {
  if (ym !== bulanIni() || h.terkunci || !h.insentif.length) return '';
  const kejar = h.insentif.filter(x => x.berikut), potensi = kejar.reduce((a, x) => a + Math.max(0, Math.round(x.berikut.min * x.berikut.persen / 100) - x.jumlah), 0);
  return `<div class="ph-ringkas">${kejar.length ? `Masih ada <b>${kejar.length}</b> target yang bisa dikejar bulan ini dengan potensi tambahan insentif minimal <b>${rp(potensi)}</b>. Lihat rincian per item di bawah.` : 'Semua target insentif bulan ini sudah tercapai. 👏'}</div>`;
}

function rincianHTML(h, judul, ym = PH.bulan, idx = -1) {
  const ins = h.insentif.map(x => {
    const tk = urutTingkat(x.item), target = x.berikut?.min || x.capai?.min || 0;
    return `<div class="ph-item">
      <div class="row spread"><b>${esc(x.item.nama)}</b><span class="num ${x.jumlah ? 'ph-plus' : 'muted'}">${x.jumlah ? '+' + rp(x.jumlah) : rp(0)}</span></div>
      <div class="small muted">${esc(SUMBER[x.item.sumber] || x.item.sumber)} pribadi bulan ini: <b class="num" style="color:var(--ink)">${rp(x.nilai)}</b></div>
      ${tk.length ? bar(x.nilai, target) : ''}
      <div class="small">${x.capai ? `Tercapai ≥ ${rp(x.capai.min)} → <b>${x.capai.persen}%</b> × ${rp(x.nilai)}` : '<span class="muted">Belum mencapai target</span>'}${x.berikut ? ` · <span class="muted">kurang <b>${rp(x.berikut.min - x.nilai)}</b> lagi untuk ${x.berikut.persen}%</span>` : ''}</div>
      <div class="ph-tk">${tk.map(t => `<span class="${x.capai && t.min <= x.capai.min ? 'on' : ''}">≥ ${rp(t.min)} · ${t.persen}%</span>`).join('')}</div>
      ${insight(x, ym)}
    </div>`;
  }).join('');
  return `<div class="panel">
    <div class="row spread"><h3>${esc(judul)}</h3><span class="row"><span class="small muted">${h.pribadi.length} nota pribadi</span><button class="btn sm" type="button" data-act="ph-slip" data-i="${idx}">Slip gaji (PDF)</button></span></div>
    ${ringkasTarget(h, ym)}
    <div class="tiles ph-tiles">
     <div class="tile"><span class="lbl">Gaji pokok</span><span class="val">${rp(h.gaji)}</span></div>
     <div class="tile"><span class="lbl">Insentif</span><span class="val" style="color:var(--good)">+${rp(h.totIns)}</span></div>
     <div class="tile"><span class="lbl">Potongan</span><span class="val" style="color:var(--bad)">−${rp(h.totPot)}</span></div>
     <div class="tile ph-net"><span class="lbl">Penghasilan bersih</span><span class="val">${rp(h.bersih)}</span><span class="sub">perkiraan, final ditetapkan manajemen</span></div>
    </div>
    <h3>Insentif</h3>
    ${ins || (h.komisi ? '' : '<div class="small muted">Belum ada insentif untuk peran ini.</div>')}
    ${h.komisi ? `<div class="ph-item"><div class="row spread"><b>Komisi mekanik ${h.org.komisi}%</b><span class="num ph-plus">+${rp(h.komisi)}</span></div><div class="small muted">dari nilai jasa servis yang dikerjakan</div></div>` : ''}
    ${h.absen ? `<div class="ph-item"><div class="row spread"><b>Uang hadir</b><span class="num ${h.absen.uangHadir ? 'ph-plus' : 'muted'}">+${rp(h.absen.uangHadir)}</span></div><div class="small muted">${h.absen.hadir} hari hadir${h.absen.tarifHadir ? ' × ' + rp(h.absen.tarifHadir) : ''}${h.absen.tanpaPulang ? ` · ${h.absen.tanpaPulang} hari tanpa scan pulang tidak dihitung` : ''} · rincian di menu Absensi</div></div>` : ''}
    <h3>Potongan</h3>
    ${h.potongan.length || h.absen?.potongTelat || h.absen?.potongCepat ? `<div class="tw"><table><tbody>${h.potongan.map(p => `<tr><td>${esc(p.item.nama)}</td><td class="r num" style="color:var(--bad)">−${rp(p.jumlah)}</td></tr>`).join('')}${h.absen?.potongTelat ? `<tr><td>Terlambat ${h.absen.telat}×</td><td class="r num" style="color:var(--bad)">−${rp(h.absen.potongTelat)}</td></tr>` : ''}${h.absen?.potongCepat ? `<tr><td>Pulang cepat ${h.absen.cepat}×</td><td class="r num" style="color:var(--bad)">−${rp(h.absen.potongCepat)}</td></tr>` : ''}<tr><td><b>Total potongan</b></td><td class="r num"><b>−${rp(h.totPot)}</b></td></tr></tbody></table></div>` : '<div class="small muted">Tidak ada potongan.</div>'}
  </div>`;
}

let rekap = null, milik = null;
async function renderPenghasilan() {
  const ym = PH.bulan, admin = !!st.petugas?.super;
  $('#view').innerHTML = `<div class="grid">
    <div class="row spread"><div class="seg" role="group" aria-label="Bulan">${[[bulanIni(), 'Bulan ini'], [geserBulan(bulanIni(), -1), 'Bulan lalu']].map(([k, l]) => `<button type="button" data-act="ph-bulan" data-b="${k}" aria-pressed="${k === ym}">${l}</button>`).join('')}</div>
     <div class="row"><label class="f" for="ph-bln" style="flex-direction:row;align-items:center;gap:6px">Bulan<input id="ph-bln" type="month" value="${ym}" style="width:auto"></label>${admin ? '<span id="ph-kunci-btn"></span><button class="btn" type="button" data-act="ph-xlsx">⬇ Excel</button>' : ''}</div></div>
    <p class="small muted" style="margin:0">${esc(namaBulan(ym))} · dihitung dari penjualan pribadi. ${admin ? 'Klik nama karyawan untuk melihat rinciannya.' : ''}</p>
    <div id="ph-isi">${loaderHTML('Menghitung…')}</div></div>`;
  let list, kunci;
  try { kunci = await statusKunci(ym); } catch (e) { kunci = null; }
  try { list = kunci ? [] : await trxBulan(ym); } catch (e) { $('#ph-isi').innerHTML = `<div class="err">${esc(errMsg(e))}</div>`; return; }
  if (st.view !== 'penghasilan' || PH.bulan !== ym) return;
  const pita = kunci ? `<div class="ph-kunci">🔒 Bulan ini sudah <b>dikunci</b> oleh super admin (${esc(kunci.tgl || '')}). Angka di bawah adalah slip final dan tidak berubah walau aturan insentif diubah.</div>` : '';
  if (!admin) {
    const o = await saya();
    if (kunci) {
      const ss = await getDoc(doc(db, 'slip', slipId(ym, kunciOrg(o)))).catch(() => null);
      milik = ss?.exists() ? dariSlip(ss.data()) : null;
      $('#ph-isi').innerHTML = pita + (milik ? rincianHTML(milik, 'Penghasilan saya · ' + namaBulan(ym), ym, -1) : '<div class="panel"><div class="empty">Tidak ada slip untuk Anda di bulan ini.</div></div>');
      return;
    }
    await lampirkanAbsen([o], ym, kunciOrg(o));
    milik = hitung(o, list); $('#ph-isi').innerHTML = rincianHTML(milik, 'Penghasilan saya · ' + namaBulan(ym), ym, -1); return;
  }
  try {
    if (kunci) { const ss = await getDocs(query(collection(db, 'slip'), where('ym', '==', ym))); rekap = ss.docs.filter(d => d.data().kunci !== '__rekap').map(d => dariSlip(d.data())).sort((a, b) => a.org.nama.localeCompare(b.org.nama)); }
    else { const org = await lampirkanAbsen(await daftarKaryawan(), ym); rekap = org.map(o => hitung(o, list)); }
  } catch (e) { $('#ph-isi').innerHTML = `<div class="err">${esc(errMsg(e))}</div>`; return; }
  if (st.view !== 'penghasilan') return;
  const kb = document.getElementById('ph-kunci-btn');
  if (kb) kb.innerHTML = kunci ? '<button class="btn" type="button" data-act="ph-buka">🔓 Buka kunci</button>' : (ym < bulanIni() || new Date().getDate() >= 25 ? '<button class="btn pri" type="button" data-act="ph-kunci">🔒 Kunci bulan ini</button>' : '<button class="btn" type="button" data-act="ph-kunci" title="Biasanya dikunci di akhir bulan">🔒 Kunci bulan</button>');
  const tot = k => rekap.reduce((a, h) => a + h[k], 0), sel = PH.pilih != null ? rekap[PH.pilih] : null;
  $('#ph-isi').innerHTML = pita + `<div class="panel"><h3>Rekap penghasilan karyawan</h3>
    ${rekap.length ? `<div class="tw"><table><thead><tr><th>Nama</th><th>Peran</th>${multiCabang() ? '<th>Cabang</th>' : ''}<th class="r">Gaji pokok</th><th class="r">Insentif</th><th class="r">Potongan</th><th class="r">Bersih</th></tr></thead><tbody>
     ${rekap.map((h, i) => `<tr class="row-click" tabindex="0" data-act="ph-pilih" data-i="${i}" aria-current="${i === PH.pilih}"><td>${esc(h.org.nama)}</td><td class="small">${esc(ROLES[h.org.peran] || h.org.peran)}</td>${multiCabang() ? `<td class="small">${esc(namaCabang(h.org.cabang))}</td>` : ''}<td class="r num">${rp(h.gaji)}</td><td class="r num" style="color:var(--good)">${h.totIns ? '+' + rp(h.totIns) : '–'}</td><td class="r num" style="color:var(--bad)">${h.totPot ? '−' + rp(h.totPot) : '–'}</td><td class="r num"><b>${rp(h.bersih)}</b></td></tr>`).join('')}
     <tr><td colspan="${multiCabang() ? 3 : 2}"><b>Total</b></td><td class="r num"><b>${rp(tot('gaji'))}</b></td><td class="r num"><b>${rp(tot('totIns'))}</b></td><td class="r num"><b>${rp(tot('totPot'))}</b></td><td class="r num"><b>${rp(tot('bersih'))}</b></td></tr>
    </tbody></table></div>` : '<div class="small muted">Belum ada karyawan. Tambahkan di Master Data → Petugas &amp; PIN atau Mekanik.</div>'}
    ${st.petugas?.super ? '<p class="small muted" style="margin:0">Atur gaji pokok, insentif, dan potongan di Master Data → Insentif &amp; Potongan.</p>' : ''}
   </div>
   ${sel ? rincianHTML(sel, sel.org.nama + ' · ' + namaBulan(ym), ym, PH.pilih) : ''}`;
}

async function exportXlsx() {
  if (!rekap?.length) { toast('Belum ada data'); return; }
  try {
    const X = await loadXLSX(), cfg = cfgPenghasilan();
    const rows = rekap.map(h => {
      const r = { nama: h.org.nama, peran: ROLES[h.org.peran] || h.org.peran, ...(multiCabang() ? { cabang: namaCabang(h.org.cabang) } : {}), gaji_pokok: h.gaji };
      h.insentif.forEach(x => { r[x.item.nama + ' (dasar)'] = x.nilai; r[x.item.nama] = x.jumlah; });
      if (h.komisi) r['Komisi mekanik'] = h.komisi;
      if (h.absen) { r['Hari hadir'] = h.absen.hadir; r['Uang hadir'] = h.absen.uangHadir; r['Terlambat (kali)'] = h.absen.telat; r['Potongan terlambat'] = h.absen.potongTelat + h.absen.potongCepat; }
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

/* ---------- Slip gaji: pratinjau dulu, lalu unduh PDF ---------- */
let slipAktif = null;
export function slipData(h, ym = PH.bulan) {
  return {
    periode: namaBulan(ym), ym, nama: h.org.nama, peran: ROLES[h.org.peran] || h.org.peran, cabang: multiCabang() ? namaCabang(h.org.cabang) : '',
    pendapatan: [['Gaji pokok', h.gaji, ''], ...h.insentif.map(x => [x.item.nama, x.jumlah, `${SUMBER[x.item.sumber] || ''} ${rp(x.nilai)}${x.capai ? ' × ' + x.capai.persen + '%' : ' (target belum tercapai)'}`]), ...(h.komisi ? [['Komisi mekanik ' + h.org.komisi + '%', h.komisi, 'dari nilai jasa']] : []), ...(h.absen ? [['Uang hadir', h.absen.uangHadir, h.absen.hadir + ' hari hadir']] : [])],
    potongan: [...h.potongan.map(p => [p.item.nama, p.jumlah]), ...(h.absen?.potongTelat ? [['Terlambat ' + h.absen.telat + 'x', h.absen.potongTelat]] : []), ...(h.absen?.potongCepat ? [['Pulang cepat ' + h.absen.cepat + 'x', h.absen.potongCepat]] : [])],
    totalPendapatan: h.gaji + h.totIns, totalPotongan: h.totPot, bersih: h.bersih, nota: h.pribadi.length
  };
}
export function slipHTML(d) {
  return `<div class="slip">
    <div class="slip-head"><div><b>${esc(APP_NAME.toUpperCase())}</b>${d.cabang ? `<div class="small">Cabang ${esc(d.cabang)}</div>` : ''}</div><div class="r"><b>SLIP GAJI</b><div class="small">${esc(d.periode)}</div></div></div>
    <div class="slip-id"><span>Nama</span><b>${esc(d.nama)}</b><span>Jabatan</span><b>${esc(d.peran)}</b><span>Nota pribadi</span><b>${d.nota}</b></div>
    <div class="slip-sec">PENDAPATAN</div>
    ${d.pendapatan.map(([l, v, k]) => `<div class="slip-row"><span>${esc(l)}${k ? `<small>${esc(k)}</small>` : ''}</span><span class="num">${rp(v)}</span></div>`).join('')}
    <div class="slip-row slip-sub"><span>Total pendapatan</span><span class="num">${rp(d.totalPendapatan)}</span></div>
    <div class="slip-sec">POTONGAN</div>
    ${d.potongan.length ? d.potongan.map(([l, v]) => `<div class="slip-row"><span>${esc(l)}</span><span class="num">−${rp(v)}</span></div>`).join('') : '<div class="slip-row"><span class="muted">Tidak ada</span><span></span></div>'}
    <div class="slip-row slip-sub"><span>Total potongan</span><span class="num">−${rp(d.totalPotongan)}</span></div>
    <div class="slip-row slip-net"><span>PENGHASILAN BERSIH</span><span class="num">${rp(d.bersih)}</span></div>
    <p class="small muted" style="margin:6px 0 0">Dihitung otomatis dari penjualan pribadi. Jumlah final ditetapkan manajemen.</p>
  </div>`;
}
function lihatSlip(h) {
  slipAktif = slipData(h);
  import('./nota-pdf.js').then(m => m.preloadPdf()).catch(() => {});
  modal(`<div class="row spread"><h2>Slip gaji</h2><button class="btn sm ghost" type="button" data-close="1" aria-label="Tutup">✕</button></div>${slipHTML(slipAktif)}
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Tutup</button><button class="btn pri" type="button" data-act="slip-unduh">Unduh PDF</button></div>`, 'wide');
}
async function unduhSlip(el) {
  if (!slipAktif) return;
  const label = el.textContent; el.disabled = true; el.textContent = 'Menyiapkan…';
  try {
    const { slipPdfBlob } = await import('./slip-pdf.js'), { saveBlob } = await import('./nota-pdf.js');
    saveBlob(await slipPdfBlob(slipAktif), `Slip-gaji-${slipAktif.nama.replace(/\s+/g, '-')}-${slipAktif.ym}.pdf`);
  } catch (e) { toast('Gagal membuat PDF: ' + e.message); }
  finally { el.disabled = false; el.textContent = label; }
}

views.penghasilan = renderPenghasilan;
refreshers.penghasilan = () => {};
Object.assign(actions, {
  'ph-bulan': el => { PH.bulan = el.dataset.b; PH.pilih = null; renderPenghasilan(); },
  'ph-pilih': el => { PH.pilih = PH.pilih === +el.dataset.i ? null : +el.dataset.i; renderPenghasilan(); },
  'ph-xlsx': exportXlsx,
  'ph-kunci': async () => {
    if (!rekap?.length) { toast('Belum ada data karyawan'); return; }
    if (!(await mintaPassword('Kunci penghasilan ' + namaBulan(PH.bulan), `Slip ${rekap.length} karyawan disimpan sebagai angka final. Perubahan aturan sesudahnya tidak mengubah bulan ini.`))) return;
    try {
      const ym = PH.bulan, b = writeBatch(db);
      rekap.forEach(h => b.set(doc(db, 'slip', slipId(ym, kunciOrg(h.org))), { ...simpanHasil(h), kunci: kunciOrg(h.org), ym, dibuat: stamp(new Date()) }));
      // Status kunci bisa dibaca semua karyawan; total biaya gaji per cabang (untuk laba bersih) hanya super admin
      b.set(doc(db, 'penghasilanBulan', ym), { terkunci: true, tgl: stamp(new Date()), oleh: st.petugas.nama || st.petugas.email });
      b.set(doc(db, 'slip', ym + '__REKAP'), { kunci: '__rekap', ym, dibuat: stamp(new Date()), total: rekap.reduce((a, h) => a + h.gaji + h.totIns, 0), bersih: rekap.reduce((a, h) => a + h.bersih, 0),
        perCabang: rekap.reduce((m, h) => { const c = h.org.cabang || 'UTM'; m[c] = (m[c] || 0) + h.gaji + h.totIns; return m; }, {}) });
      await b.commit(); toast('Penghasilan ' + namaBulan(ym) + ' dikunci'); renderPenghasilan();
    } catch (e) { toast(errMsg(e)); }
  },
  'ph-buka': async () => {
    if (!(await mintaPassword('Buka kunci ' + namaBulan(PH.bulan), 'Angka akan dihitung ulang dengan aturan yang berlaku sekarang sampai dikunci lagi.'))) return;
    try { await setDoc(doc(db, 'penghasilanBulan', PH.bulan), { terkunci: false, dibuka: stamp(new Date()) }, { merge: true }); toast('Kunci dibuka'); renderPenghasilan(); } catch (e) { toast(errMsg(e)); }
  },
  'ph-slip': el => { const h = +el.dataset.i >= 0 ? rekap?.[+el.dataset.i] : milik; if (h) lihatSlip(h); },
  'slip-unduh': unduhSlip
});
changeHandlers.push(e => { if (e.target.id === 'ph-bln' && e.target.value) { PH.bulan = e.target.value; PH.pilih = null; renderPenghasilan(); } });
