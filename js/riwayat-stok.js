// 5.31.0 — Menu Riwayat Stok: semua barang masuk/keluar per cabang dalam satu halaman, dengan tanggal & hari,
// asal barang (Input sendiri vs Dari transfer), deteksi kemungkinan dobel, ringkasan per part, riwayat transfer lengkap,
// dan export Excel. Juga menyediakan ringkasan asal per part untuk kolom "Asal masuk" di Stok Part.
import { $, esc, dkey, toast, errMsg } from './util.js';
import { S, st, part, views, refreshers, actions, inputHandlers, changeHandlers, go, isRole } from './state.js';
import { db, collection, query, where, getDocs } from './firebase.js';
import { cabAktif, cabangQuery, namaCabang, multiCabang } from './cabang.js';
import { JENIS_MUTASI, ASAL, asalMutasi, pillAsal, fmtWaktu, cariDobel, kartuStok, HARI_DOBEL } from './kontrol.js';
import { muatRiwayatTransfer, tabelTransfer, bannerTransferMasuk, statusTf, detailTransfer, pcsTf, itemsTf, STATUS_TF } from './transfer.js';
import { loaderHTML } from './brand.js';

/* ---------- Ringkasan asal per part (untuk Stok Part) ---------- */
const JENIS_ASAL = ['beli', 'awal', 'import', 'transfer-masuk', 'batal-beli', 'koreksi-transfer'];
let asal = { cab: null, at: 0, map: null, janji: null };
export const lupakanAsal = () => { asal = { cab: null, at: 0, map: null, janji: null }; };
export const asalPart = kode => asal.cab === cabAktif() && asal.map ? (asal.map.get(kode) || null) : undefined;
export function muatAsal(cab = cabAktif()) {
  if (asal.cab === cab && asal.map && Date.now() - asal.at < 120000) return Promise.resolve(asal.map);
  if (asal.cab === cab && asal.janji) return asal.janji;
  asal.cab = cab; asal.map = null;
  asal.janji = (async () => {
    const list = [];
    for (const c of cabangQuery(cab)) {
      let s;
      try { s = await getDocs(query(collection(db, 'mutasi'), where('cabang', '==', c), where('jenis', 'in', JENIS_ASAL))); }
      catch (e) { try { s = await getDocs(query(collection(db, 'mutasi'), where('cabang', '==', c))); } catch (e2) { if (c === cabangQuery(cab)[0]) throw e2; continue; } }
      s.docs.forEach(d => { const m = d.data(); if (JENIS_ASAL.includes(m.jenis)) list.push(m); });
    }
    const map = new Map(), get = k => map.get(k) || map.set(k, { sendiri: 0, transfer: 0, dobel: false, terakhir: '' }).get(k);
    list.forEach(m => {
      const a = get(m.kode), q = +m.qty || 0;
      if (['beli', 'awal', 'import', 'batal-beli'].includes(m.jenis)) a.sendiri += q;
      else if (m.jenis === 'transfer-masuk' || (m.jenis === 'koreksi-transfer' && q < 0)) a.transfer += q;
      if (q > 0 && String(m.tgl) > a.terakhir) a.terakhir = String(m.tgl);
    });
    cariDobel(list).forEach((_, m) => { get(m.kode).dobel = true; });
    if (asal.cab === cab) { asal.map = map; asal.at = Date.now(); asal.janji = null; }
    return map;
  })().catch(e => { console.warn('Asal stok belum bisa dimuat:', e); if (asal.cab === cab) { asal.map = new Map(); asal.at = Date.now() - 90000; asal.janji = null; } return asal.map; });
  return asal.janji;
}

/* ---------- Halaman Riwayat Stok ---------- */
const hariIni = () => dkey(new Date());
const geser = (tgl, n) => { const d = new Date(tgl + 'T00:00'); d.setDate(d.getDate() + n); return dkey(d); };
const PERIODE = [['hari', 'Hari ini'], ['7', '7 hari'], ['30', '30 hari'], ['bulan', 'Bulan ini'], ['bulanLalu', 'Bulan lalu'], ['90', '90 hari'], ['custom', 'Pilih tanggal']];
const JENIS = [['masuk', 'Semua barang masuk'], ['sendiri', 'Input sendiri'], ['transfer', 'Dari transfer'], ['keluar', 'Transfer keluar'], ['jual', 'Terjual'], ['koreksi', 'Koreksi'], ['semua', 'Semua'], ['dobel', '⚠ Kemungkinan dobel']];
const RS = st.rs = st.rs || { tab: 'mutasi', periode: '30', dari: '', sampai: '', jenis: 'masuk', q: '', data: null, cab: null, kunci: '', fallback: false, tf: null, tfArah: '', tfStatus: '', bantuan: true, n: 300 };
try { RS.bantuan = localStorage.getItem('amu-rs-bantuan') !== '0'; } catch (e) { /* abaikan */ }

function rentang() {
  const t = hariIni(), now = new Date();
  if (RS.periode === 'hari') return [t, t];
  if (RS.periode === '7') return [geser(t, -6), t];
  if (RS.periode === '30') return [geser(t, -29), t];
  if (RS.periode === '90') return [geser(t, -89), t];
  if (RS.periode === 'bulan') return [t.slice(0, 8) + '01', t];
  if (RS.periode === 'bulanLalu') { const a = new Date(now.getFullYear(), now.getMonth() - 1, 1), b = new Date(now.getFullYear(), now.getMonth(), 0); return [dkey(a), dkey(b)]; }
  return [RS.dari || geser(t, -29), RS.sampai || t];
}

async function muatMutasi() {
  const [dari, sampai] = rentang(), cab = cabAktif(), kunci = cab + '|' + dari + '|' + sampai;
  if (RS.kunci === kunci && RS.data) return;
  RS.data = null; RS.kunci = kunci; RS.fallback = false;
  const awal = geser(dari, -HARI_DOBEL);   // diambil lebih awal supaya pasangan dobel di awal periode tetap terdeteksi
  const list = [];
  for (const c of cabangQuery(cab)) {
    let docs;
    try { docs = (await getDocs(query(collection(db, 'mutasi'), where('cabang', '==', c), where('tgl', '>=', awal), where('tgl', '<=', sampai + ' 99:99')))).docs; }
    catch (e) {
      // Index (cabang, tgl) belum dipasang: ambil semua mutasi cabang lalu saring di perangkat
      RS.fallback = true;
      let s2; try { s2 = await getDocs(query(collection(db, 'mutasi'), where('cabang', '==', c))); } catch (e2) { if (c === cabangQuery(cab)[0]) throw e2; continue; }
      docs = s2.docs.filter(d => { const g = String(d.data().tgl || ''); return g >= awal && g <= sampai + ' 99:99'; });
    }
    docs.forEach(d => list.push({ id: d.id, ...d.data() }));
  }
  if (RS.kunci !== kunci) return;
  list.sort((a, b) => String(b.tgl).localeCompare(String(a.tgl)));
  const dobel = cariDobel(list);
  list.forEach(m => { m._asal = asalMutasi(m); const p = dobel.get(m); if (p) m._dobel = p; m._dalam = String(m.tgl).slice(0, 10) >= dari; });
  RS.data = list;
}

const dataTampil = () => (RS.data || []).filter(m => m._dalam);
function saring(list) {
  const kata = RS.q.toLowerCase().split(/\s+/).filter(Boolean);
  return list.filter(m => {
    const j = RS.jenis;
    if (j === 'masuk' && !(m.qty > 0 && (m._asal === 'sendiri' || m._asal === 'transfer'))) return false;
    if (['sendiri', 'transfer', 'keluar', 'jual', 'koreksi'].includes(j) && m._asal !== j) return false;
    if (j === 'dobel' && !m._dobel) return false;
    if (!kata.length) return true;
    const s = `${m.kode} ${m.nama} ${m.ref} ${m.ket} ${m.petugas} ${JENIS_MUTASI[m.jenis] || m.jenis}`.toLowerCase();
    return kata.every(w => s.includes(w));
  });
}
const jumlah = (list, k) => list.filter(m => m._asal === k).reduce((a, m) => a + (+m.qty || 0), 0);

function tombolRef(m) {
  const r = m.ref || ''; if (!r) return '';
  if (/^PB/.test(r) || m.jenis === 'beli' || m.jenis === 'batal-beli') return `<button class="link-btn mono small" type="button" data-act="rs-pb" data-no="${esc(r)}" title="Buka pembelian">${esc(r)}</button>`;
  if (/^TF-/.test(r)) return `<button class="link-btn mono small" type="button" data-act="rs-tf" data-no="${esc(r)}" title="Buka transfer">${esc(r)}</button>`;
  return `<span class="mono small">${esc(r)}</span>`;
}
function saranDobel(m) {
  const p = m._dobel; if (!p) return '';
  const pb = m._asal === 'sendiri' ? m : p, tf = m._asal === 'transfer' ? m : p;
  return `<div class="rw-det dobel-saran">⚠ Pasangan: ${esc(JENIS_MUTASI[p.jenis] || p.jenis)} <b class="mono">${esc(p.ref || '')}</b> · ${esc(fmtWaktu(p.tgl, { jam: false }))} · ${p.qty} pcs. ${pb.jenis === 'beli' ? `Bila barang ${esc(tf.ref)} memang dari transfer, <button class="link-btn" type="button" data-act="rs-pb" data-no="${esc(pb.ref)}">batalkan ${esc(pb.ref)}</button>.` : 'Periksa fisik lalu koreksi lewat Stok opname.'}</div>`;
}

function tabMutasi() {
  const semua = dataTampil(), list = saring(semua), tampil = list.slice(0, RS.n), nDobelPart = new Set(semua.filter(m => m._dobel).map(m => m.kode)).size;
  const tile = (k, lbl, sub, val) => `<button class="tile click${RS.jenis === k ? ' aktif' : ''}" type="button" data-act="rs-jenis" data-j="${k}"><span class="lbl">${lbl}</span><span class="val">${val}</span><span class="sub">${sub}</span></button>`;
  return `<div class="tiles">
      ${tile('sendiri', '<span class="pill p-warn">Input sendiri</span>', `${semua.filter(m => m._asal === 'sendiri' && m.qty > 0).length} catatan · pembelian / stok awal`, jumlah(semua, 'sendiri') + ' pcs')}
      ${tile('transfer', '<span class="pill p-info">Dari transfer</span>', `${semua.filter(m => m._asal === 'transfer').length} catatan · transfer masuk diterima`, jumlah(semua, 'transfer') + ' pcs')}
      ${tile('keluar', '<span class="pill p-muted">Transfer keluar</span>', 'dikirim ke cabang lain', -jumlah(semua, 'keluar') + ' pcs')}
      ${tile('dobel', '<span class="pill p-bad">⚠ Kemungkinan dobel</span>', nDobelPart ? 'klik untuk melihat & koreksi' : 'tidak ditemukan', nDobelPart + ' part')}
    </div>
    <div class="row"><input id="rs-q" placeholder="Cari kode, nama part, no. PB/TF, petugas" value="${esc(RS.q)}" style="flex:1 1 240px" aria-label="Cari"><select id="rs-jenis" style="width:auto" aria-label="Jenis">${JENIS.map(([k, l]) => `<option value="${k}" ${k === RS.jenis ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    ${RS.jenis === 'dobel' && list.length ? `<div class="note small"><b>Cara membereskan dobel:</b> 1) Cocokkan fisik barang dengan nomor TF dan PB di bawah. 2) Bila barang memang kiriman cabang lain, buka nomor PB lalu tekan <b>${st.petugas?.super ? 'Batalkan pembelian' : 'Ajukan pembatalan'}</b> — stok dan hutang supplier ikut dikoreksi setelah disetujui Super Admin. 3) Bila penyebabnya lain (mis. stok awal), koreksi lewat <b>Stok opname</b>.</div>` : ''}
    <div class="tw"><table class="bernomor rw-tabel"><thead><tr><th>Tanggal &amp; hari</th><th>Part</th><th>Asal</th><th>Jenis / keterangan</th><th>No. dokumen</th><th class="r">Masuk</th><th class="r">Keluar</th><th>Petugas</th></tr></thead><tbody>
    ${tampil.map(m => `<tr${m._dobel ? ' class="row-dobel"' : ''}><td class="small">${esc(fmtWaktu(m.tgl))}</td>
      <td><button class="link-btn" type="button" data-act="rs-kartu" data-k="${esc(m.kode)}" title="Kartu stok">${esc(m.nama || part(m.kode)?.nama || m.kode)}</button><div class="mono small muted">${esc(m.kode)}</div></td>
      <td>${pillAsal(m)}${m._dobel ? ' <span class="pill p-bad">⚠ dobel?</span>' : ''}</td>
      <td class="small">${esc(JENIS_MUTASI[m.jenis] || m.jenis)}${m.ket ? `<div class="rw-det">${esc(m.ket)}</div>` : ''}${saranDobel(m)}</td>
      <td>${tombolRef(m)}</td><td class="r num">${m.qty > 0 ? '<b>' + m.qty + '</b>' : ''}</td><td class="r num">${m.qty < 0 ? -m.qty : ''}</td><td class="small">${esc(m.petugas || '')}</td></tr>`).join('') || `<tr><td colspan="8" class="empty">Tidak ada catatan pada pilihan ini.</td></tr>`}
    </tbody></table></div>
    <div class="row spread"><p class="small muted" style="margin:0">${list.length > tampil.length ? `Ditampilkan ${tampil.length} dari ` : ''}${list.length} catatan · klik nama part untuk kartu stok, klik nomor PB/TF untuk membuka dokumennya.</p>${list.length > tampil.length ? '<button class="btn sm" type="button" data-act="rs-lagi">Tampilkan lagi</button>' : ''}</div>`;
}

function rekapPart() {
  const m = new Map();
  dataTampil().forEach(x => {
    const r = m.get(x.kode) || m.set(x.kode, { kode: x.kode, nama: x.nama || part(x.kode)?.nama || x.kode, sendiri: 0, transfer: 0, keluar: 0, jual: 0, koreksi: 0, dobel: false, akhir: '' }).get(x.kode);
    r[x._asal] += +x.qty || 0; if (x._dobel) r.dobel = true; if (String(x.tgl) > r.akhir) r.akhir = String(x.tgl);
  });
  return [...m.values()];
}
function tabPart() {
  const kata = RS.q.toLowerCase().split(/\s+/).filter(Boolean);
  let list = rekapPart().filter(r => !kata.length || kata.every(w => (r.kode + ' ' + r.nama).toLowerCase().includes(w)));
  if (RS.jenis === 'dobel') list = list.filter(r => r.dobel);
  else if (['sendiri', 'transfer', 'keluar', 'jual', 'koreksi'].includes(RS.jenis)) list = list.filter(r => r[RS.jenis]);
  else if (RS.jenis === 'masuk') list = list.filter(r => r.sendiri || r.transfer);
  list.sort((a, b) => (b.dobel - a.dobel) || String(b.akhir).localeCompare(String(a.akhir)));
  return `<div class="row"><input id="rs-q" placeholder="Cari kode atau nama part" value="${esc(RS.q)}" style="flex:1 1 240px" aria-label="Cari"><select id="rs-jenis" style="width:auto" aria-label="Saring">${JENIS.map(([k, l]) => `<option value="${k}" ${k === RS.jenis ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="tw"><table class="bernomor rw-tabel"><thead><tr><th>Part</th><th class="r"><span class="pill p-warn">Input sendiri</span></th><th class="r"><span class="pill p-info">Dari transfer</span></th><th class="r">Transfer keluar</th><th class="r">Terjual</th><th class="r">Koreksi</th><th class="r">Stok sekarang</th><th>Terakhir</th><th></th></tr></thead><tbody>
    ${list.map(r => `<tr${r.dobel ? ' class="row-dobel"' : ''}><td>${esc(r.nama)}<div class="mono small muted">${esc(r.kode)}</div></td><td class="r num">${r.sendiri || ''}</td><td class="r num">${r.transfer || ''}</td><td class="r num">${r.keluar ? -r.keluar : ''}</td><td class="r num">${r.jual ? -r.jual : ''}</td><td class="r num">${r.koreksi ? (r.koreksi > 0 ? '+' : '') + r.koreksi : ''}</td><td class="r num"><b>${part(r.kode)?.stok ?? '–'}</b></td><td class="small">${esc(fmtWaktu(r.akhir, { jam: false }))}</td><td class="r">${r.dobel ? '<span class="pill p-bad">⚠ dobel?</span> ' : ''}<button class="btn sm" type="button" data-act="rs-kartu" data-k="${esc(r.kode)}">Kartu stok</button></td></tr>`).join('') || '<tr><td colspan="9" class="empty">Tidak ada part pada pilihan ini.</td></tr>'}
    </tbody></table></div><p class="small muted" style="margin:0">${list.length} part · angka adalah jumlah selama periode yang dipilih (bukan sejak awal).</p>`;
}

function tfTampil() {
  const [dari, sampai] = rentang(), kata = RS.q.toLowerCase().split(/\s+/).filter(Boolean);
  return (RS.tf || []).filter(t => {
    const g = String(t.tgl || '').slice(0, 10); if (g < dari || g > sampai) return false;
    const keluar = cabangQuery(cabAktif()).includes(t.dari);
    if (RS.tfArah === 'masuk' && keluar) return false; if (RS.tfArah === 'keluar' && !keluar) return false;
    if (RS.tfStatus === 'pengajuan' ? t.batal?.status !== 'diminta' : RS.tfStatus && statusTf(t) !== RS.tfStatus) return false;
    return !kata.length || kata.every(w => `${t.no} ${t.catatan || ''} ${t.pengirim || ''} ${t.penerima || ''} ${itemsTf(t).map(x => x.kode + ' ' + x.nama).join(' ')}`.toLowerCase().includes(w));
  });
}
function tabTransfer() {
  if (!RS.tf) return loaderHTML('Memuat riwayat transfer…');
  const list = tfTampil(), n = s => list.filter(t => statusTf(t) === s).length;
  return `<div class="row"><input id="rs-q" placeholder="Cari no. TF, part, petugas" value="${esc(RS.q)}" style="flex:1 1 220px" aria-label="Cari">
      <select id="rs-tfarah" style="width:auto" aria-label="Arah"><option value="">Masuk &amp; keluar</option><option value="masuk" ${RS.tfArah === 'masuk' ? 'selected' : ''}>Transfer masuk</option><option value="keluar" ${RS.tfArah === 'keluar' ? 'selected' : ''}>Transfer keluar</option></select>
      <select id="rs-tfstatus" style="width:auto" aria-label="Status"><option value="">Semua status</option>${Object.entries(STATUS_TF).map(([k, v]) => `<option value="${k}" ${RS.tfStatus === k ? 'selected' : ''}>${v[0]}</option>`).join('')}<option value="pengajuan" ${RS.tfStatus === 'pengajuan' ? 'selected' : ''}>Pembatalan diajukan</option></select></div>
    <div class="small muted">${list.length} transfer · ${n('dikirim')} belum diterima · ${n('diterima')} diterima · ${n('ditolak')} ditolak · ${n('dibatalkan')} dibatalkan · ${list.reduce((a, t) => a + pcsTf(t), 0)} pcs</div>
    ${tabelTransfer(list)}`;
}

function render() {
  const [dari, sampai] = rentang();
  $('#view').innerHTML = `<div class="grid"><div class="panel">
    <div class="row spread"><div><h3 style="margin:0">Riwayat stok${multiCabang() ? ' · ' + esc(namaCabang(cabAktif())) : ''}</h3><div class="small muted">${esc(fmtWaktu(dari, { jam: false }))} – ${esc(fmtWaktu(sampai, { jam: false }))}</div></div>
      <span class="row"><button class="btn sm ghost" type="button" data-act="rs-bantuan">${RS.bantuan ? 'Sembunyikan cara baca' : '❓ Cara membaca'}</button><button class="btn sm" type="button" data-act="rs-muat">⟳ Muat ulang</button><button class="btn sm" type="button" data-act="rs-excel">⬇ Excel</button></span></div>
    ${RS.bantuan ? `<div class="note small rs-bantuan"><b>Cara membaca:</b> setiap barang yang masuk ke cabang ini diberi label asal.
      <span class="pill p-warn">Input sendiri</span> = dicatat oleh petugas cabang ini lewat <b>Pembelian Stok</b> / terima PO supplier / stok awal part baru.
      <span class="pill p-info">Dari transfer</span> = kiriman cabang lain yang ditekan <b>Terima</b>.
      <span class="pill p-bad">⚠ dobel?</span> = part yang sama punya Input sendiri <b>dan</b> Dari transfer dengan jumlah sama dalam ±${HARI_DOBEL} hari — biasanya barang kiriman yang dicatat lagi di Pembelian. Klik nomor <b>PB</b> / <b>TF</b> untuk membuka dokumennya, klik nama part untuk kartu stoknya.</div>` : ''}
    ${multiCabang() && isRole('admin', 'sparepart') ? bannerTransferMasuk() : ''}
    <div class="seg" role="group" aria-label="Periode">${PERIODE.map(([k, l]) => `<button type="button" data-act="rs-periode" data-p="${k}" aria-pressed="${k === RS.periode}">${l}</button>`).join('')}</div>
    ${RS.periode === 'custom' ? `<div class="row"><label class="f" for="rs-dari">Dari<input id="rs-dari" type="date" value="${esc(dari)}"></label><label class="f" for="rs-sampai">Sampai<input id="rs-sampai" type="date" value="${esc(sampai)}"></label></div>` : ''}
    <div class="seg" role="tablist" aria-label="Tampilan">${[['mutasi', 'Barang masuk & keluar'], ['part', 'Ringkasan per part'], ...(multiCabang() ? [['transfer', 'Transfer antar cabang']] : [])].map(([k, l]) => `<button type="button" role="tab" data-act="rs-tab" data-t="${k}" aria-pressed="${k === RS.tab}">${l}</button>`).join('')}</div>
    ${RS.fallback ? '<div class="small muted">Catatan: index <code>mutasi (cabang, tgl)</code> belum dipasang, data diambil lebih lambat. Super Admin: deploy <code>firestore.indexes.json</code>.</div>' : ''}
    <div id="rs-isi">${RS.tab === 'transfer' ? tabTransfer() : RS.data ? (RS.tab === 'part' ? tabPart() : tabMutasi()) : loaderHTML('Memuat riwayat stok…')}</div>
  </div></div>`;
}
function renderIsi() { const el = $('#rs-isi'); if (!el) return; const pos = document.activeElement?.id === 'rs-q' ? $('#rs-q').selectionStart : null; el.innerHTML = RS.tab === 'transfer' ? tabTransfer() : RS.data ? (RS.tab === 'part' ? tabPart() : tabMutasi()) : loaderHTML('Memuat riwayat stok…'); if (pos != null) { const q = $('#rs-q'); q.focus(); q.setSelectionRange(pos, pos); } }

async function tampil(paksa = false) {
  if (paksa) { RS.kunci = ''; RS.tf = null; }
  if (RS.cab !== cabAktif()) { RS.cab = cabAktif(); RS.kunci = ''; RS.tf = null; }
  render();
  try {
    if (RS.tab === 'transfer') { if (!RS.tf) RS.tf = await muatRiwayatTransfer(cabAktif()); }
    else await muatMutasi();
  } catch (e) { const el = $('#rs-isi'); if (el) el.innerHTML = `<div class="err">Riwayat tidak bisa dimuat: ${esc(errMsg(e))}</div>`; return; }
  if (st.view === 'riwayatStok') renderIsi();
}

async function excel() {
  try {
    const { loadXLSX, beriKotak, filterOtomatis } = await import('./import-excel.js');
    const X = await loadXLSX(), wb = X.utils.book_new(), [dari, sampai] = rentang(), cab = namaCabang(cabAktif());
    let rows, nama;
    if (RS.tab === 'transfer') {
      rows = tfTampil().flatMap(t => itemsTf(t).map(x => ({ no_transfer: t.no, arah: cabangQuery(cabAktif()).includes(t.dari) ? 'Keluar' : 'Masuk', dari: namaCabang(t.dari), ke: namaCabang(t.ke), tgl_kirim: fmtWaktu(t.tgl), pengirim: t.pengirim || '', kode: x.kode, nama: x.nama, qty: x.qty, status: STATUS_TF[statusTf(t)]?.[0] || statusTf(t), tgl_terima: t.tglTerima ? fmtWaktu(t.tglTerima) : '', penerima: t.penerima || '', tgl_batal_tolak: fmtWaktu(t.tglBatal || t.tglTolak || ''), alasan: t.alasanBatal || t.alasanTolak || '', catatan: t.catatan || '' })));
      nama = 'Transfer';
    } else if (RS.tab === 'part') {
      rows = rekapPart().map(r => ({ kode: r.kode, nama: r.nama, input_sendiri: r.sendiri, dari_transfer: r.transfer, transfer_keluar: -r.keluar, terjual: -r.jual, koreksi: r.koreksi, stok_sekarang: part(r.kode)?.stok ?? '', kemungkinan_dobel: r.dobel ? 'YA' : '', terakhir: fmtWaktu(r.akhir) }));
      nama = 'Per part';
    } else {
      rows = saring(dataTampil()).map(m => ({ tanggal: fmtWaktu(m.tgl), kode: m.kode, nama: m.nama, asal: ASAL[m._asal].label, jenis: JENIS_MUTASI[m.jenis] || m.jenis, no_dokumen: m.ref || '', keterangan: m.ket || '', masuk: m.qty > 0 ? m.qty : '', keluar: m.qty < 0 ? -m.qty : '', petugas: m.petugas || '', kemungkinan_dobel: m._dobel ? 'YA · pasangan ' + (m._dobel.ref || '') : '' }));
      nama = 'Mutasi';
    }
    if (!rows.length) { toast('Tidak ada data untuk diexport'); return; }
    const ws = X.utils.json_to_sheet(rows); beriKotak(X, ws); filterOtomatis(X, ws, rows.length);
    X.utils.book_append_sheet(wb, ws, nama); X.writeFile(wb, `riwayat-stok-${cab.replace(/[^A-Za-z0-9]+/g, '-')}-${nama.replace(' ', '')}-${dari}_${sampai}.xlsx`);
  } catch (e) { toast('Gagal export: ' + errMsg(e)); }
}

views.riwayatStok = () => tampil();
refreshers.riwayatStok = () => {};
window.addEventListener('amu-stok-berubah', () => { lupakanAsal(); if (st.view === 'riwayatStok') tampil(true); });
Object.assign(actions, {
  'rs-tab': el => { RS.tab = el.dataset.t; RS.n = 300; tampil(); },
  'rs-periode': el => { RS.periode = el.dataset.p; RS.n = 300; tampil(); },
  'rs-jenis': el => { RS.jenis = RS.jenis === el.dataset.j ? 'masuk' : el.dataset.j; RS.n = 300; renderIsi(); },
  'rs-lagi': () => { RS.n += 300; renderIsi(); },
  'rs-muat': () => tampil(true),
  'rs-excel': excel,
  'rs-bantuan': () => { RS.bantuan = !RS.bantuan; try { localStorage.setItem('amu-rs-bantuan', RS.bantuan ? '1' : '0'); } catch (e) { /* abaikan */ } render(); renderIsi(); },
  'rs-kartu': el => kartuStok(el.dataset.k),
  'rs-pb': async el => { const m = await import('./pembelian.js'); m.bukaPembelian(el.dataset.no); },
  'rs-tf': async el => {
    const no = el.dataset.no; let t = (RS.tf || []).find(x => x.no === no);
    if (!t) { try { RS.tf = await muatRiwayatTransfer(cabAktif()); t = RS.tf.find(x => x.no === no); } catch (e) { toast(errMsg(e)); return; } }
    if (t) detailTransfer(t); else toast('Transfer ' + no + ' tidak ditemukan');
  },
  'go-riwayatStok-dobel': () => { RS.tab = 'mutasi'; RS.jenis = 'dobel'; RS.periode = '90'; go('riwayatStok'); }
});
inputHandlers.push(e => { if (e.target.id === 'rs-q') { RS.q = e.target.value; RS.n = 300; renderIsi(); } });
changeHandlers.push(e => {
  const t = e.target;
  if (t.id === 'rs-jenis') { RS.jenis = t.value; RS.n = 300; renderIsi(); }
  if (t.id === 'rs-tfarah') { RS.tfArah = t.value; renderIsi(); }
  if (t.id === 'rs-tfstatus') { RS.tfStatus = t.value; renderIsi(); }
  if (t.id === 'rs-dari' || t.id === 'rs-sampai') { RS[t.id === 'rs-dari' ? 'dari' : 'sampai'] = t.value; if (RS.dari && RS.sampai && RS.dari > RS.sampai) [RS.dari, RS.sampai] = [RS.sampai, RS.dari]; tampil(); }
});
