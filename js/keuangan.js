// Menu Kas & Pengeluaran dan Klaim KSG (admin & kasir, per cabang).
// Kas harian : buka kas (uang awal) → penjualan cash & pengeluaran tunai tercatat otomatis → tutup kas
//              (hitung uang fisik, setor). Selisih tercatat. Kas yang sudah ditutup hanya bisa dibuka ulang super admin.
// Pengeluaran: biaya operasional per cabang. Hanya super admin yang bisa menghapus (dengan kata sandi).
// Klaim KSG  : nota servis KSG dikumpulkan → diajukan ke main dealer → ditandai dibayar.
import { $, esc, rp, dkey, stamp, toast, errMsg, modal, closeModal, konfirmasi } from './util.js';
import { S, st, views, refreshers, actions, changeHandlers, inputHandlers, namaPetugas, idPetugas, isRole } from './state.js';
import { db, doc, collection, getDoc, getDocs, setDoc, addDoc, deleteDoc, query, where, writeBatch, deleteField } from './firebase.js';
import { cabAktif, namaCabang, multiCabang, cabangOf } from './cabang.js';
import { trxIn, sums } from './stats.js';
import { ambilTrx } from './data-trx.js';
import { mintaPassword, isSuper } from './otorisasi.js';
import { loaderHTML } from './brand.js';
import { loadXLSX } from './import-excel.js';

export const KATEGORI = ['Listrik & air', 'Sewa tempat', 'Internet & pulsa', 'Konsumsi', 'Transportasi & BBM', 'Perlengkapan bengkel', 'Perbaikan & alat', 'Kebersihan & keamanan', 'Iuran & pajak', 'Promosi', 'Bonus / uang makan (di luar slip)', 'Lain-lain'];
const KU = st.keu = st.keu || { tab: 'kas', tgl: dkey(new Date()), bulan: dkey(new Date()).slice(0, 7) };
const KL = st.klaim = st.klaim || { bulan: dkey(new Date()).slice(0, 7), pilih: {} };
const namaBulan = ym => new Date(ym + '-01T00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
const geserBulan = (ym, n) => { const d = new Date(ym + '-01T00:00'); d.setMonth(d.getMonth() + n, 1); return dkey(d).slice(0, 7); };
const blnSebelum = ym => geserBulan(ym, -1);
const kasId = (cab, tgl) => cab + '_' + tgl;
const tunai = p => (p.metode || 'Tunai') === 'Tunai';

/* ---------- Data ---------- */
// Pengeluaran per cabang & bulan (equality saja → tidak perlu indeks gabungan)
export async function ambilPengeluaran(bulanList, cab = cabAktif(), semuaCabang = false) {
  const out = [];
  for (let i = 0; i < bulanList.length; i += 10) {
    const w = [where('bulan', 'in', bulanList.slice(i, i + 10))];
    if (!semuaCabang) w.unshift(where('cabang', '==', cab));
    const s = await getDocs(query(collection(db, 'pengeluaran'), ...w));
    s.docs.forEach(d => out.push({ id: d.id, ...d.data() }));
  }
  return out.sort((a, b) => String(b.tgl).localeCompare(String(a.tgl)) || String(b.jam || '').localeCompare(String(a.jam || '')));
}
async function ambilKasBulan(bulanList, cab = cabAktif()) {
  const s = await getDocs(query(collection(db, 'kas'), where('cabang', '==', cab), where('bulan', 'in', bulanList)));
  return s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.tgl.localeCompare(a.tgl));
}

/* ---------- Tampilan utama ---------- */
let kasDoc = null, kasList = [], keluarHari = [], keluarBulan = [];
async function renderKas() {
  const tabs = [['kas', 'Kas harian'], ['keluar', 'Pengeluaran']];
  $('#view').innerHTML = `<div class="panel"><div class="subtabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-act="keu-tab" data-t="${k}" aria-selected="${k === KU.tab}">${l}</button>`).join('')}</div><div id="keu-body">${loaderHTML('Memuat…')}</div></div>`;
  try { if (KU.tab === 'kas') await muatKas(); else await muatKeluar(); }
  catch (e) { $('#keu-body').innerHTML = `<div class="err">${esc(errMsg(e))}</div>`; return; }
  if (st.view !== 'kas') return;
  KU.tab === 'kas' ? renderKasHarian() : renderKeluar();
}

/* ---------- Kas harian ---------- */
async function muatKas() {
  const cab = cabAktif(), ym = KU.tgl.slice(0, 7);
  const [s, list, kel] = await Promise.all([getDoc(doc(db, 'kas', kasId(cab, KU.tgl))), ambilKasBulan([blnSebelum(ym), ym], cab), ambilPengeluaran([ym], cab)]);
  kasDoc = s.exists() ? { id: s.id, ...s.data() } : null;
  kasList = list; keluarHari = kel.filter(p => p.tgl === KU.tgl);
}
// Penjualan cash hari itu dari nota yang sudah dimuat (dua bulan terakhir)
function hitungKas() {
  const nota = trxIn(KU.tgl, KU.tgl, S.trx), sm = sums(nota);
  const keluarTunai = keluarHari.filter(tunai).reduce((a, p) => a + (+p.jumlah || 0), 0);
  const awal = +kasDoc?.uangAwal || 0;
  return { nota: nota.length, cash: sm.cash, transfer: sm.transfer, keluarTunai, keluarLain: keluarHari.filter(p => !tunai(p)).reduce((a, p) => a + (+p.jumlah || 0), 0), awal, harus: awal + sm.cash - keluarTunai };
}
function saranAwal() {
  const lalu = kasList.find(k => k.tgl < KU.tgl && k.tutup);
  return lalu ? { nilai: +lalu.tutup.sisa || 0, tgl: lalu.tgl } : null;
}
const baris = (l, v, opt = {}) => `<tr${opt.cls ? ` class="${opt.cls}"` : ''}><td>${l}</td><td class="r num"${opt.color ? ` style="color:${opt.color}"` : ''}>${opt.b ? '<b>' + v + '</b>' : v}</td></tr>`;

function renderKasHarian() {
  const h = hitungKas(), k = kasDoc, hariIni = dkey(new Date()), min = blnSebelum(hariIni.slice(0, 7)) + '-01';
  const kunci = !!k?.tutup, saran = saranAwal();
  let isi;
  if (!k) {
    isi = `<div class="panel" style="max-width:520px"><h3>Buka kas ${KU.tgl === hariIni ? 'hari ini' : esc(KU.tgl)}</h3>
      <p class="small muted" style="margin:0">Hitung uang di laci sebelum mulai berjualan.${saran ? ` Sisa kas tutup ${esc(saran.tgl)}: <b>${rp(saran.nilai)}</b>.` : ''}</p>
      <label class="f" for="kas-awal">Uang awal di laci<input id="kas-awal" type="number" min="0" value="${saran ? saran.nilai : ''}" data-autofocus></label>
      <div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-act="kas-buka">Buka kas</button></div></div>`;
  } else {
    const t = k.tutup;
    isi = `<div class="grid g2">
     <div class="panel"><div class="row spread"><h3>Kas ${esc(KU.tgl)}</h3>${kunci ? '<span class="pill p-good">Sudah ditutup</span>' : '<span class="pill p-warn">Kas terbuka</span>'}</div>
      <div class="small muted">Dibuka ${esc(k.dibukaOleh || '')} ${esc(k.jamBuka || '')}${kunci ? ' · ditutup ' + esc(t.oleh || '') + ' ' + esc(t.jam || '') : ''}</div>
      <div class="tw"><table><tbody>
       ${baris('Uang awal', rp(kunci ? t.uangAwal : h.awal))}
       ${baris(`+ Penjualan cash <span class="small muted">(${kunci ? t.nota : h.nota} nota, setelah kembalian)</span>`, rp(kunci ? t.penjualanCash : h.cash), { color: 'var(--good)' })}
       ${baris('− Pengeluaran tunai', rp(kunci ? t.pengeluaranTunai : h.keluarTunai), { color: 'var(--bad)' })}
       ${baris('<b>Seharusnya di laci</b>', rp(kunci ? t.seharusnya : h.harus), { b: 1 })}
       ${kunci ? baris('Uang fisik dihitung', rp(t.uangFisik)) + baris('<b>Selisih</b>', (t.selisih > 0 ? '+' : '') + rp(t.selisih), { b: 1, color: t.selisih ? (t.selisih < 0 ? 'var(--bad)' : 'var(--warn)') : 'var(--good)' }) + baris('Disetor / diserahkan', rp(t.setor)) + baris('Sisa di laci (modal besok)', rp(t.sisa), { b: 1 }) : ''}
      </tbody></table></div>
      <div class="small muted">Transfer masuk hari ini ${rp(kunci ? t.transfer : h.transfer)} (langsung ke rekening, tidak masuk laci)${(kunci ? t.pengeluaranLain : h.keluarLain) ? ` · pengeluaran non-tunai ${rp(kunci ? t.pengeluaranLain : h.keluarLain)}` : ''}.</div>
      ${t?.catatan ? `<div class="note small">Catatan: ${esc(t.catatan)}</div>` : ''}
      ${kunci && isSuper() ? '<div class="row" style="justify-content:flex-end"><button class="btn sm" type="button" data-act="kas-bukaulang">🔓 Buka ulang kas</button></div>' : ''}
     </div>
     ${kunci ? `<div class="panel"><h3>Pengeluaran ${esc(KU.tgl)}</h3>${tabelKeluar(keluarHari, false)}</div>` : `<div class="panel"><h3>Tutup kas</h3>
      <p class="small muted" style="margin:0">Hitung semua uang di laci, lalu isi di bawah. Setelah ditutup, angka tidak bisa diubah kecuali oleh super admin.</p>
      <label class="f" for="kas-fisik">Uang fisik di laci<input id="kas-fisik" type="number" min="0"></label>
      <div id="kas-selisih" class="small"></div>
      <label class="f" for="kas-setor">Disetor ke bank / diserahkan ke kantor<input id="kas-setor" type="number" min="0" value="0"></label>
      <div id="kas-sisa" class="small muted"></div>
      <label class="f" for="kas-cat">Catatan (wajib bila ada selisih)<input id="kas-cat" data-nocaps placeholder="mis. kembalian kurang Rp 2.000"></label>
      <div class="row" style="justify-content:space-between"><button class="btn" type="button" data-act="keu-tambah">+ Catat pengeluaran</button><button class="btn pri" type="button" data-act="kas-tutup">Tutup kas</button></div>
      ${keluarHari.length ? `<h4 style="margin:8px 0 0">Pengeluaran hari ini</h4>${tabelKeluar(keluarHari, false)}` : ''}
     </div>`}
    </div>`;
  }
  const riwayat = kasList.filter(x => x.tgl.startsWith(KU.tgl.slice(0, 7)));
  $('#keu-body').innerHTML = `<div class="grid">
    <div class="row spread"><div class="lap-nav"><button class="btn sm" type="button" data-act="kas-geser" data-n="-1" aria-label="Hari sebelumnya" ${KU.tgl <= min ? 'disabled' : ''}>‹</button><b>${esc(new Date(KU.tgl + 'T00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</b><button class="btn sm" type="button" data-act="kas-geser" data-n="1" aria-label="Hari berikutnya" ${KU.tgl >= hariIni ? 'disabled' : ''}>›</button><input id="kas-tgl" type="date" value="${KU.tgl}" min="${min}" max="${hariIni}" style="width:auto" aria-label="Pilih tanggal"></div>
     <span class="small muted">${multiCabang() ? 'Cabang ' + esc(namaCabang(cabAktif())) : ''}</span></div>
    ${isi}
    <div class="panel"><h3>Rekap kas ${esc(namaBulan(KU.tgl.slice(0, 7)))}</h3>
     ${riwayat.length ? `<div class="tw"><table><thead><tr><th>Tanggal</th><th class="r">Awal</th><th class="r">Cash masuk</th><th class="r">Keluar tunai</th><th class="r">Seharusnya</th><th class="r">Fisik</th><th class="r">Selisih</th><th class="r">Setor</th><th>Ditutup</th></tr></thead><tbody>
      ${riwayat.map(x => { const t = x.tutup; return `<tr class="row-click" tabindex="0" data-act="kas-pilih" data-tgl="${esc(x.tgl)}"><td>${esc(x.tgl)}</td><td class="r num">${rp(t ? t.uangAwal : x.uangAwal)}</td><td class="r num">${t ? rp(t.penjualanCash) : '–'}</td><td class="r num">${t ? rp(t.pengeluaranTunai) : '–'}</td><td class="r num">${t ? rp(t.seharusnya) : '–'}</td><td class="r num">${t ? rp(t.uangFisik) : '–'}</td><td class="r num" style="color:${t?.selisih < 0 ? 'var(--bad)' : t?.selisih > 0 ? 'var(--warn)' : 'inherit'}">${t ? (t.selisih > 0 ? '+' : '') + rp(t.selisih) : '–'}</td><td class="r num">${t ? rp(t.setor) : '–'}</td><td class="small">${t ? esc(t.oleh || '') : '<span class="pill p-warn">Terbuka</span>'}</td></tr>`; }).join('')}
      <tr><td><b>Total</b></td><td></td><td class="r num"><b>${rp(riwayat.reduce((a, x) => a + (x.tutup?.penjualanCash || 0), 0))}</b></td><td class="r num"><b>${rp(riwayat.reduce((a, x) => a + (x.tutup?.pengeluaranTunai || 0), 0))}</b></td><td></td><td></td><td class="r num"><b>${rp(riwayat.reduce((a, x) => a + (x.tutup?.selisih || 0), 0))}</b></td><td class="r num"><b>${rp(riwayat.reduce((a, x) => a + (x.tutup?.setor || 0), 0))}</b></td><td></td></tr>
     </tbody></table></div>` : '<div class="small muted">Belum ada kas yang dibuka bulan ini.</div>'}
    </div></div>`;
  hitungTutup();
}
function hitungTutup() {
  const f = $('#kas-fisik'); if (!f || !kasDoc) return;
  const h = hitungKas(), fisik = f.value === '' ? null : +f.value, setor = +$('#kas-setor').value || 0;
  const sel = fisik == null ? null : fisik - h.harus;
  $('#kas-selisih').innerHTML = sel == null ? '' : sel === 0 ? '<span style="color:var(--good)">✓ Pas, tidak ada selisih</span>' : `<span style="color:${sel < 0 ? 'var(--bad)' : 'var(--warn)'}">Selisih ${sel > 0 ? 'lebih ' : 'kurang '}${rp(Math.abs(sel))}</span>`;
  $('#kas-sisa').textContent = fisik == null ? '' : 'Sisa di laci untuk modal besok: ' + rp(fisik - setor);
}

/* ---------- Pengeluaran ---------- */
async function muatKeluar() { keluarBulan = await ambilPengeluaran([KU.bulan]); }
function tabelKeluar(list, lengkap = true) {
  if (!list.length) return '<div class="small muted">Belum ada pengeluaran.</div>';
  return `<div class="tw"><table><thead><tr>${lengkap ? '<th>Tanggal</th>' : ''}<th>Kategori</th><th>Keterangan</th><th>Bayar</th><th class="r">Jumlah</th>${lengkap ? '<th>Dicatat</th>' : ''}${isSuper() ? '<th></th>' : ''}</tr></thead><tbody>
   ${list.map(p => `<tr>${lengkap ? `<td class="small">${esc(p.tgl)}</td>` : ''}<td class="small">${esc(p.kategori)}</td><td>${esc(p.ket || '')}</td><td class="small">${esc(p.metode || 'Tunai')}</td><td class="r num">${rp(p.jumlah)}</td>${lengkap ? `<td class="small muted">${esc(p.petugas || '')}</td>` : ''}${isSuper() ? `<td class="r"><button class="btn sm ghost" type="button" data-act="keu-hapus" data-id="${esc(p.id)}" aria-label="Hapus">✕</button></td>` : ''}</tr>`).join('')}
  </tbody></table></div>`;
}
function renderKeluar() {
  const list = keluarBulan, total = list.reduce((a, p) => a + (+p.jumlah || 0), 0), kini = dkey(new Date()).slice(0, 7);
  const perKat = {}; list.forEach(p => { perKat[p.kategori] = (perKat[p.kategori] || 0) + (+p.jumlah || 0); });
  const kat = Object.entries(perKat).sort((a, b) => b[1] - a[1]), mx = kat[0]?.[1] || 1;
  $('#keu-body').innerHTML = `<div class="grid">
   <div class="row spread"><div class="lap-nav"><button class="btn sm" type="button" data-act="keu-bln" data-n="-1" aria-label="Bulan sebelumnya">‹</button><b>${esc(namaBulan(KU.bulan))}</b><button class="btn sm" type="button" data-act="keu-bln" data-n="1" aria-label="Bulan berikutnya" ${KU.bulan >= kini ? 'disabled' : ''}>›</button></div>
    <div class="row"><button class="btn" type="button" data-act="keu-xlsx">⬇ Excel</button><button class="btn pri" type="button" data-act="keu-tambah">+ Catat pengeluaran</button></div></div>
   <div class="tiles"><div class="tile"><span class="lbl">Total pengeluaran</span><span class="val" style="color:var(--bad)">${rp(total)}</span><span class="sub">${list.length} catatan${multiCabang() ? ' · ' + esc(namaCabang(cabAktif())) : ''}</span></div>
    <div class="tile"><span class="lbl">Tunai dari kas</span><span class="val">${rp(list.filter(tunai).reduce((a, p) => a + (+p.jumlah || 0), 0))}</span><span class="sub">mengurangi uang di laci</span></div>
    <div class="tile"><span class="lbl">Transfer / bank</span><span class="val">${rp(list.filter(p => !tunai(p)).reduce((a, p) => a + (+p.jumlah || 0), 0))}</span><span class="sub">tidak lewat laci</span></div></div>
   <p class="small muted" style="margin:0">Gaji & insentif karyawan <b>tidak perlu</b> dicatat di sini: dihitung otomatis dari slip gaji yang dikunci super admin dan masuk ke laba bersih di Laporan. ${isSuper() ? '' : 'Salah catat? Minta super admin menghapusnya.'}</p>
   ${kat.length ? `<div class="panel"><h3>Per kategori</h3>${kat.map(([k, v]) => `<div class="bar-row"><span class="row spread small"><span class="bar-lbl">${esc(k)}</span><span class="num">${rp(v)} · ${Math.round(v / total * 100)}%</span></span><span class="ph-bar"><i style="width:${v / mx * 100}%"></i></span></div>`).join('')}</div>` : ''}
   <div class="panel"><h3>Daftar pengeluaran</h3>${tabelKeluar(list)}</div></div>`;
}
function formKeluar() {
  const hariIni = dkey(new Date()), tgl = KU.tab === 'kas' ? KU.tgl : (KU.bulan === hariIni.slice(0, 7) ? hariIni : KU.bulan + '-01');
  modal(`<h3>Catat pengeluaran${multiCabang() ? ' · ' + esc(namaCabang(cabAktif())) : ''}</h3>
   <div class="grid g2" style="gap:10px"><label class="f" for="pk-tgl">Tanggal<input id="pk-tgl" type="date" value="${tgl}" max="${hariIni}"></label>
    <label class="f" for="pk-kat">Kategori<select id="pk-kat">${KATEGORI.map(k => `<option>${esc(k)}</option>`).join('')}</select></label></div>
   <label class="f" for="pk-ket">Keterangan<input id="pk-ket" data-nocaps placeholder="mis. token listrik 200rb" data-autofocus></label>
   <div class="grid g2" style="gap:10px"><label class="f" for="pk-jml">Jumlah<input id="pk-jml" type="number" min="1"></label>
    <label class="f" for="pk-met">Dibayar dari<select id="pk-met"><option value="Tunai">Tunai (uang laci)</option><option value="Transfer">Transfer / rekening</option></select></label></div>
   <div class="err" id="pk-err" hidden></div>
   <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Batal</button><button class="btn pri" type="button" data-act="keu-simpan">Simpan</button></div>`);
}

/* ---------- Klaim KSG ---------- */
let klaimTrx = [], klaimBatch = [];
async function renderKlaim() {
  $('#view').innerHTML = `<div class="panel">${loaderHTML('Memuat klaim KSG…')}</div>`;
  const cab = cabAktif(), ym = KL.bulan, akhir = dkey(new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0));
  try {
    const [t, b] = await Promise.all([ambilTrx(ym + '-01', akhir), getDocs(query(collection(db, 'klaim'), where('cabang', '==', cab)))]);
    klaimTrx = t.filter(x => cabangOf(x) === cab && x.jenisServis === 'KSG').sort((a, b) => a.tgl.localeCompare(b.tgl));
    klaimBatch = b.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.tgl).localeCompare(String(a.tgl)));
  } catch (e) { $('#view').innerHTML = `<div class="panel"><div class="err">${esc(errMsg(e))}</div></div>`; return; }
  if (st.view !== 'klaim') return;
  gambarKlaim();
}
function gambarKlaim() {
  const kini = dkey(new Date()).slice(0, 7), belum = klaimTrx.filter(t => !t.klaimStatus), pil = belum.filter(t => KL.pilih[t.no]);
  const nilai = l => l.reduce((a, t) => a + (t.jasaKlaim || 0), 0);
  const st3 = s => klaimTrx.filter(t => t.klaimStatus === s);
  const pillK = s => s === 'dibayar' ? '<span class="pill p-good">Dibayar</span>' : s === 'diajukan' ? '<span class="pill p-warn">Diajukan</span>' : '<span class="pill">Belum diajukan</span>';
  $('#view').innerHTML = `<div class="grid">
   <div class="row spread"><div class="lap-nav"><button class="btn sm" type="button" data-act="kl-bln" data-n="-1" aria-label="Bulan sebelumnya">‹</button><b>${esc(namaBulan(KL.bulan))}</b><button class="btn sm" type="button" data-act="kl-bln" data-n="1" aria-label="Bulan berikutnya" ${KL.bulan >= kini ? 'disabled' : ''}>›</button></div><span class="small muted">${multiCabang() ? 'Cabang ' + esc(namaCabang(cabAktif())) : ''}</span></div>
   <div class="tiles"><div class="tile"><span class="lbl">Servis KSG</span><span class="val">${klaimTrx.length}</span><span class="sub">nilai klaim ${rp(nilai(klaimTrx))}</span></div>
    <div class="tile"><span class="lbl">Belum diajukan</span><span class="val" style="color:${belum.length ? 'var(--warn)' : 'inherit'}">${belum.length}</span><span class="sub">${rp(nilai(belum))}</span></div>
    <div class="tile"><span class="lbl">Menunggu pembayaran</span><span class="val">${st3('diajukan').length}</span><span class="sub">${rp(nilai(st3('diajukan')))}</span></div>
    <div class="tile"><span class="lbl">Sudah dibayar</span><span class="val" style="color:var(--good)">${st3('dibayar').length}</span><span class="sub">${rp(nilai(st3('dibayar')))}</span></div></div>
   <div class="panel"><div class="row spread"><h3>Nota servis KSG ${esc(namaBulan(KL.bulan))}</h3>${belum.length ? `<span class="row"><button class="btn sm" type="button" data-act="kl-semua">${pil.length === belum.length ? 'Batal pilih semua' : 'Pilih semua yang belum'}</button><button class="btn pri sm" type="button" data-act="kl-ajukan" ${pil.length ? '' : 'disabled'}>Ajukan ${pil.length || ''} klaim · ${rp(nilai(pil))}</button></span>` : ''}</div>
    ${klaimTrx.length ? `<div class="tw"><table><thead><tr><th></th><th>No. nota</th><th>Tanggal</th><th>Nopol / tipe</th><th>KSG</th><th>No. kupon</th><th>Mekanik</th><th class="r">Nilai klaim</th><th>Status</th></tr></thead><tbody>
     ${klaimTrx.map(t => `<tr><td>${t.klaimStatus ? '' : `<input type="checkbox" class="kl-cek" data-no="${esc(t.no)}" ${KL.pilih[t.no] ? 'checked' : ''} aria-label="Pilih ${esc(t.no)}">`}</td><td class="mono"><button class="link-btn" type="button" data-act="nota" data-no="${esc(t.no)}">${esc(t.no)}</button></td><td class="small">${esc(t.tgl.slice(0, 10))}</td><td><span class="mono">${esc(t.nopol)}</span><br><span class="small muted">${esc(t.tipe || '')}</span></td><td>ke-${esc(t.ksgKe || '?')}</td><td class="mono small">${esc(t.noKartu || '–')}</td><td class="small">${esc(t.mekanik || '')}</td><td class="r num">${t.jasaKlaim ? rp(t.jasaKlaim) : '<span class="diff-bad">tarif kosong</span>'}</td><td>${pillK(t.klaimStatus)}${t.klaimNo ? `<br><span class="small muted mono">${esc(t.klaimNo)}</span>` : ''}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">Tidak ada servis KSG di bulan ini.</div>'}
   </div>
   <div class="panel"><h3>Pengajuan klaim ke main dealer</h3>
    ${klaimBatch.length ? `<div class="tw"><table><thead><tr><th>No. klaim</th><th>Diajukan</th><th>Periode</th><th class="r">Nota</th><th class="r">Nilai diajukan</th><th class="r">Diterima</th><th>Status</th><th></th></tr></thead><tbody>
     ${klaimBatch.map(b => `<tr><td class="mono">${esc(b.no)}${b.ref ? `<br><span class="small muted">${esc(b.ref)}</span>` : ''}</td><td class="small">${esc(b.tgl)}<br><span class="muted">${esc(b.oleh || '')}</span></td><td class="small">${esc(namaBulan(b.bulan))}</td><td class="r num">${(b.nota || []).length}</td><td class="r num">${rp(b.total)}</td><td class="r num">${b.status === 'dibayar' ? rp(b.diterima) + (b.diterima !== b.total ? `<br><span class="small" style="color:var(--bad)">selisih ${rp(b.diterima - b.total)}</span>` : '') : '–'}</td><td>${pillK(b.status)}${b.tglBayar ? `<br><span class="small muted">${esc(b.tglBayar)}</span>` : ''}</td><td class="r">${b.status === 'diajukan' ? `<button class="btn sm" type="button" data-act="kl-bayar" data-id="${esc(b.id)}">Tandai dibayar</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="small muted">Belum ada pengajuan klaim.</div>'}
   </div></div>`;
}
const nomorKlaim = () => 'KL-' + (cabAktif() === 'UTM' ? '' : cabAktif() + '-') + KL.bulan.replace('-', '') + '-' + String(klaimBatch.filter(b => b.bulan === KL.bulan).length + 1).padStart(2, '0');

/* ---------- Registrasi ---------- */
views.kas = renderKas;
views.klaim = renderKlaim;
refreshers.kas = () => { if (KU.tab === 'kas' && kasDoc && !kasDoc.tutup && $('#kas-fisik')) { const f = $('#kas-fisik').value, s = $('#kas-setor').value, c = $('#kas-cat').value; renderKasHarian(); $('#kas-fisik').value = f; $('#kas-setor').value = s; $('#kas-cat').value = c; hitungTutup(); } };
refreshers.klaim = () => {};
Object.assign(actions, {
  'keu-tab': el => { KU.tab = el.dataset.t; renderKas(); },
  'kas-geser': el => { const d = new Date(KU.tgl + 'T00:00'); d.setDate(d.getDate() + +el.dataset.n); KU.tgl = dkey(d); renderKas(); },
  'kas-pilih': el => { KU.tgl = el.dataset.tgl; renderKas(); },
  'kas-buka': async () => {
    const v = $('#kas-awal').value; if (v === '') { toast('Isi uang awal (0 bila kosong)'); return; }
    const cab = cabAktif();
    try { await setDoc(doc(db, 'kas', kasId(cab, KU.tgl)), { cabang: cab, tgl: KU.tgl, bulan: KU.tgl.slice(0, 7), uangAwal: +v, dibukaOleh: namaPetugas(), dibukaId: idPetugas(), jamBuka: stamp(new Date()).slice(11) }); toast('Kas dibuka'); renderKas(); }
    catch (e) { toast(errMsg(e)); }
  },
  'kas-tutup': async el => {
    const f = $('#kas-fisik').value; if (f === '') { toast('Isi jumlah uang fisik di laci'); $('#kas-fisik').focus(); return; }
    const h = hitungKas(), fisik = +f, setor = +$('#kas-setor').value || 0, catatan = $('#kas-cat').value.trim(), selisih = fisik - h.harus;
    if (selisih && !catatan) { toast('Ada selisih ' + (selisih > 0 ? 'lebih ' : 'kurang ') + rp(Math.abs(selisih)) + '. Tulis catatan penyebabnya.'); $('#kas-cat').focus(); return; }
    if (setor > fisik) { toast('Setoran lebih besar dari uang di laci'); return; }
    if (!(await konfirmasi('Tutup kas ' + KU.tgl + '?', `Seharusnya <b>${rp(h.harus)}</b> · uang fisik <b>${rp(fisik)}</b> · ${selisih ? `<span class="diff-bad">selisih ${selisih > 0 ? 'lebih' : 'kurang'} ${rp(Math.abs(selisih))}</span>` : '<span class="diff-ok">pas</span>'}${setor ? ' · disetor ' + rp(setor) : ''}.<br>Setelah ditutup, hanya super admin yang bisa membuka ulang.`, { ya: 'Ya, tutup kas' }))) return;
    el.disabled = true;
    try {
      await setDoc(doc(db, 'kas', kasDoc.id), { tutup: { uangAwal: h.awal, nota: h.nota, penjualanCash: h.cash, transfer: h.transfer, pengeluaranTunai: h.keluarTunai, pengeluaranLain: h.keluarLain, seharusnya: h.harus, uangFisik: fisik, selisih, setor, sisa: fisik - setor, catatan, oleh: namaPetugas(), olehId: idPetugas(), jam: stamp(new Date()).slice(11) } }, { merge: true });
      toast(selisih ? 'Kas ditutup, selisih ' + (selisih > 0 ? 'lebih ' : 'kurang ') + rp(Math.abs(selisih)) : 'Kas ditutup, uang pas'); renderKas();
    } catch (e) { toast(errMsg(e)); el.disabled = false; }
  },
  'kas-bukaulang': async () => {
    if (!(await mintaPassword('Buka ulang kas ' + KU.tgl, 'Angka tutup kas dihapus dan kasir bisa menutup ulang.'))) return;
    try { await setDoc(doc(db, 'kas', kasDoc.id), { tutup: deleteField(), dibukaUlang: stamp(new Date()) }, { merge: true }); toast('Kas dibuka ulang'); renderKas(); } catch (e) { toast(errMsg(e)); }
  },
  'keu-bln': el => { KU.bulan = geserBulan(KU.bulan, +el.dataset.n); renderKas(); },
  'keu-tambah': formKeluar,
  'keu-simpan': async el => {
    const tgl = $('#pk-tgl').value, jumlah = +$('#pk-jml').value || 0, ket = $('#pk-ket').value.trim(), err = $('#pk-err');
    const gagal = m => { err.hidden = false; err.textContent = m; };
    if (!tgl) return gagal('Pilih tanggal'); if (!jumlah) return gagal('Isi jumlah'); if (!ket) return gagal('Isi keterangan');
    const cab = cabAktif(), metode = $('#pk-met').value;
    if (metode === 'Tunai') { const k = await getDoc(doc(db, 'kas', kasId(cab, tgl))).catch(() => null); if (k?.exists() && k.data().tutup) return gagal('Kas ' + tgl + ' sudah ditutup. Pilih "Transfer" atau minta super admin membuka ulang kas.'); }
    el.disabled = true;
    try {
      await addDoc(collection(db, 'pengeluaran'), { cabang: cab, tgl, bulan: tgl.slice(0, 7), kategori: $('#pk-kat').value, ket, jumlah, metode, petugas: namaPetugas(), petugasId: idPetugas(), jam: stamp(new Date()) });
      closeModal(); toast('Pengeluaran ' + rp(jumlah) + ' dicatat'); renderKas();
    } catch (e) { gagal(errMsg(e)); el.disabled = false; }
  },
  'keu-hapus': async el => {
    const p = [...keluarBulan, ...keluarHari].find(x => x.id === el.dataset.id); if (!p) return;
    if (!(await mintaPassword('Hapus pengeluaran', `${esc(p.tgl)} · ${esc(p.kategori)} · ${esc(p.ket || '')} · <b>${rp(p.jumlah)}</b>`))) return;
    try { await deleteDoc(doc(db, 'pengeluaran', p.id)); toast('Pengeluaran dihapus'); renderKas(); } catch (e) { toast(errMsg(e)); }
  },
  'keu-xlsx': async () => {
    if (!keluarBulan.length) { toast('Tidak ada pengeluaran'); return; }
    try { const X = await loadXLSX(), wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.json_to_sheet(keluarBulan.map(p => ({ tanggal: p.tgl, cabang: namaCabang(p.cabang), kategori: p.kategori, keterangan: p.ket, dibayar: p.metode || 'Tunai', jumlah: p.jumlah, dicatat: p.petugas }))), 'Pengeluaran'); X.writeFile(wb, `pengeluaran-${KU.bulan}.xlsx`); } catch (e) { toast('Gagal export: ' + e.message); }
  },
  'kl-bln': el => { KL.bulan = geserBulan(KL.bulan, +el.dataset.n); KL.pilih = {}; renderKlaim(); },
  'kl-semua': () => { const belum = klaimTrx.filter(t => !t.klaimStatus), semua = belum.every(t => KL.pilih[t.no]); KL.pilih = semua ? {} : Object.fromEntries(belum.map(t => [t.no, true])); gambarKlaim(); },
  'kl-ajukan': () => {
    const pil = klaimTrx.filter(t => !t.klaimStatus && KL.pilih[t.no]); if (!pil.length) return;
    const tanpa = pil.filter(t => !t.jasaKlaim).length;
    modal(`<h3>Ajukan klaim KSG</h3><p class="small" style="margin:0">${pil.length} nota · nilai <b>${rp(pil.reduce((a, t) => a + (t.jasaKlaim || 0), 0))}</b> · nomor <span class="mono">${esc(nomorKlaim())}</span>${tanpa ? `<br><span class="diff-bad">${tanpa} nota tanpa tarif KSG (Rp 0)</span>` : ''}</p>
     <label class="f" for="kl-ref">No. surat / referensi ke main dealer (opsional)<input id="kl-ref" data-nocaps></label>
     <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Batal</button><button class="btn pri" type="button" data-act="kl-kirim">Ajukan</button></div>`);
  },
  'kl-kirim': async el => {
    const pil = klaimTrx.filter(t => !t.klaimStatus && KL.pilih[t.no]), no = nomorKlaim(); el.disabled = true;
    try {
      const ref = doc(collection(db, 'klaim')), b = writeBatch(db);
      b.set(ref, { no, cabang: cabAktif(), bulan: KL.bulan, tgl: stamp(new Date()), oleh: namaPetugas(), ref: $('#kl-ref').value.trim(), status: 'diajukan', nota: pil.map(t => t.no), total: pil.reduce((a, t) => a + (t.jasaKlaim || 0), 0) });
      pil.forEach(t => b.update(doc(db, 'trx', t.no), { klaimStatus: 'diajukan', klaimId: ref.id, klaimNo: no }));
      await b.commit(); KL.pilih = {}; closeModal(); toast('Klaim ' + no + ' diajukan'); renderKlaim();
    } catch (e) { toast(errMsg(e)); el.disabled = false; }
  },
  'kl-bayar': el => {
    const k = klaimBatch.find(x => x.id === el.dataset.id); if (!k) return;
    modal(`<h3>Klaim ${esc(k.no)} dibayar</h3><p class="small" style="margin:0">${(k.nota || []).length} nota · diajukan ${rp(k.total)}</p>
     <div class="grid g2" style="gap:10px"><label class="f" for="kb-jml">Jumlah diterima<input id="kb-jml" type="number" min="0" value="${k.total}"></label><label class="f" for="kb-tgl">Tanggal diterima<input id="kb-tgl" type="date" value="${dkey(new Date())}"></label></div>
     <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Batal</button><button class="btn pri" type="button" data-act="kl-lunas" data-id="${esc(k.id)}">Simpan</button></div>`);
  },
  'kl-lunas': async el => {
    const k = klaimBatch.find(x => x.id === el.dataset.id); if (!k) return; el.disabled = true;
    try {
      const b = writeBatch(db);
      b.set(doc(db, 'klaim', k.id), { status: 'dibayar', diterima: +$('#kb-jml').value || 0, tglBayar: $('#kb-tgl').value, dicatatBayar: namaPetugas() }, { merge: true });
      (k.nota || []).forEach(no => b.update(doc(db, 'trx', no), { klaimStatus: 'dibayar' }));
      await b.commit(); closeModal(); toast('Klaim ' + k.no + ' ditandai dibayar'); renderKlaim();
    } catch (e) { toast(errMsg(e)); el.disabled = false; }
  }
});
inputHandlers.push(e => { if (['kas-fisik', 'kas-setor'].includes(e.target.id)) hitungTutup(); });
changeHandlers.push(e => {
  if (e.target.id === 'kas-tgl' && e.target.value) { KU.tgl = e.target.value; renderKas(); }
  if (e.target.classList?.contains('kl-cek')) { KL.pilih[e.target.dataset.no] = e.target.checked; gambarKlaim(); }
});
