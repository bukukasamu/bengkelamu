// Daftar & Cetak konsumen (Admin & Super Admin): semua konsumen, yang servis pada periode tertentu, atau yang
// didaftarkan pada periode tertentu — disaring per cabang, wilayah, dan punya/belum punya motor. Bentuk per orang
// atau per motor. Hasil: tabel di layar, Excel, PDF, atau print. NIK hanya untuk super admin.
// Data dibaca saat tombol Tampilkan ditekan (bukan saat menu dibuka) supaya hemat kuota.
import { $, esc, rp, dkey, toast, errMsg } from './util.js';
import { st, actions, changeHandlers, namaPetugas, isRole } from './state.js';
import { db, collection, getDocs, query, where, documentId } from './firebase.js';
import { nopolKey } from './cari-kendaraan.js';
import { cabangList, namaCabang, multiCabang, cabangOf, cabAktif } from './cabang.js';
import { ambilTrx } from './data-trx.js';
import { loaderHTML } from './brand.js';
import { loadXLSX, filterOtomatis } from './import-excel.js';
import { lengkapiCabangPendaftar } from './konsumen-data.js';

const pad = n => String(n).padStart(2, '0');
const D = st.knDaftar = st.knDaftar || { isi: 'servis', periode: 'bulan', dari: '', sampai: '', cabang: '', kec: '', motor: 'semua', bentuk: 'orang', hasil: null, info: '' };
const super_ = () => !!st.petugas?.super;
function rentang() {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  if (D.periode === 'hari') return [dkey(now), dkey(now)];
  if (D.periode === 'lalu') return [dkey(new Date(y, m - 1, 1)), dkey(new Date(y, m, 0))];
  if (D.periode === 'pilih' && D.dari && D.sampai) return [D.dari, D.sampai];
  return [dkey(new Date(y, m, 1)), dkey(now)];
}
const labelPeriode = () => { const [a, b] = rentang(); return a === b ? a : a + ' s/d ' + b; };
const per = (arr, n) => { const out = []; for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n)); return out; };
async function ambilId(col, ids) {
  const hasil = [];
  for (const g of per([...new Set(ids.filter(Boolean))], 30)) { const s = await getDocs(query(collection(db, col), where(documentId(), 'in', g))); s.docs.forEach(d => hasil.push({ id: d.id, ...d.data() })); }
  return hasil;
}

export function renderDaftar() {
  const el = $('#kn-form'); if (!el) return;
  // Admin (bukan super admin) hanya cabang yang sedang dibuka
  if (!super_()) D.cabang = multiCabang() ? cabAktif() : '';
  const cab = multiCabang() ? cabangList(true) : [];
  el.innerHTML = `<div class="panel" style="background:var(--panel-2);box-shadow:none;margin-block:12px">
   <div class="row spread"><h3>Daftar & cetak konsumen</h3><button class="btn sm ghost" type="button" data-act="kn-tutup" aria-label="Tutup">✕</button></div>
   <div class="form">
    <label class="f" for="kd-isi">Isi daftar<select id="kd-isi" data-kd="isi">${[['servis', 'Yang servis pada periode'], ['daftar', 'Yang didaftarkan pada periode'], ['semua', 'Semua konsumen']].map(([v, l]) => `<option value="${v}" ${v === D.isi ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    ${D.isi !== 'semua' ? `<label class="f" for="kd-periode">Periode<select id="kd-periode" data-kd="periode">${[['hari', 'Hari ini'], ['bulan', 'Bulan ini'], ['lalu', 'Bulan lalu'], ['pilih', 'Pilih tanggal']].map(([v, l]) => `<option value="${v}" ${v === D.periode ? 'selected' : ''}>${l}</option>`).join('')}</select></label>` : ''}
    ${D.isi !== 'semua' && D.periode === 'pilih' ? `<label class="f" for="kd-dari">Dari<input id="kd-dari" type="date" data-kd="dari" value="${esc(D.dari)}"></label><label class="f" for="kd-sampai">Sampai<input id="kd-sampai" type="date" data-kd="sampai" value="${esc(D.sampai)}"></label>` : ''}
    ${cab.length ? `<label class="f" for="kd-cabang">${D.isi === 'servis' ? 'Cabang tempat servis' : 'Cabang pendaftar'}<select id="kd-cabang" data-kd="cabang" ${super_() ? '' : 'disabled title="Admin: cabang yang sedang dibuka"'}><option value="">Semua cabang</option>${cab.map(c => `<option value="${esc(c.id)}" ${c.id === D.cabang ? 'selected' : ''}>${esc(c.nama)}</option>`).join('')}${D.isi !== 'servis' ? `<option value="-" ${D.cabang === '-' ? 'selected' : ''}>(belum diketahui)</option>` : ''}</select></label>` : ''}
    <label class="f" for="kd-motor">Motor<select id="kd-motor" data-kd="motor">${[['semua', 'Semua'], ['ada', 'Punya motor'], ['belum', 'Belum punya motor']].map(([v, l]) => `<option value="${v}" ${v === D.motor ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="f" for="kd-bentuk">Bentuk<select id="kd-bentuk" data-kd="bentuk">${[['orang', 'Per konsumen (motor digabung)'], ['motor', 'Per motor']].map(([v, l]) => `<option value="${v}" ${v === D.bentuk ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
   </div>
   <div class="row" style="justify-content:space-between"><span class="small muted">${D.isi === 'semua' ? 'Membaca seluruh data konsumen & kendaraan (kuota baca sesuai jumlah data).' : 'Membaca nota / data pada periode yang dipilih saja.'}</span><button class="btn pri" type="button" data-act="kd-tampil">Tampilkan</button></div>
   <div id="kd-hasil">${D.hasil ? hasilHTML() : ''}</div>
  </div>`;
}

// Muat data sesuai pilihan → D.semua = [{ k: konsumen, motor: [kendaraan], nServis, total, cabangServis }]
async function muat() {
  const el = $('#kd-hasil'); if (el) el.innerHTML = loaderHTML('Memuat data…');
  const [dari, sampai] = rentang();
  try {
    let kons = [], kend = [], servis = new Map();
    if (D.isi === 'servis') {
      const trx = (await ambilTrx(dari, sampai)).filter(t => t.jenis === 'SERVIS' && (!D.cabang || cabangOf(t) === D.cabang));
      trx.forEach(t => { const key = nopolKey(t.nopol); if (!key) return; const s = servis.get(key) || { n: 0, total: 0, cab: new Set(), akhir: '' }; s.n++; s.total += t.total || 0; s.cab.add(cabangOf(t)); if (t.tgl > s.akhir) s.akhir = t.tgl; servis.set(key, s); });
      kend = await ambilId('kendaraan', [...servis.keys()]);
      kons = await ambilId('konsumen', kend.map(m => m.konsumenId));
    } else if (D.isi === 'daftar') {
      const s = await getDocs(query(collection(db, 'konsumen'), where('dibuat', '>=', dari), where('dibuat', '<=', sampai + ' 99')));
      kons = s.docs.map(d => ({ id: d.id, ...d.data() }));
      kend = await ambilId('kendaraan', kons.flatMap(k => k.motor || []));
    } else {
      const [a, b] = await Promise.all([getDocs(collection(db, 'konsumen')), getDocs(collection(db, 'kendaraan'))]);
      kons = a.docs.map(d => ({ id: d.id, ...d.data() })); kend = b.docs.map(d => ({ id: d.id, ...d.data() }));
    }
    kend = kend.filter(m => !m.pindahKe);
    kons = kons.filter(k => !k.digabungKe && !k.dihapus);
    const perK = new Map(kons.map(k => [k.id, { k, motor: [] }]));
    kend.forEach(m => {
      let g = m.konsumenId && perK.get(m.konsumenId);
      // Motor lama yang belum tersambung ke database konsumen: data pemilik diambil dari data kendaraan
      if (!g && (D.isi === 'servis' || (D.isi === 'semua' && !m.konsumenId))) { g = { k: { id: 'K:' + m.id, ...m, motor: [m.id], cabang: '' }, motor: [] }; perK.set(g.k.id, g); }
      if (g) g.motor.push({ ...m, servis: servis.get(m.id) });
    });
    D.semua = [...perK.values()]; D.waktu = new Date(); D.label = { isi: D.isi, periode: D.isi === 'semua' ? '' : labelPeriode() };
    saring();
  } catch (e) { if (el) el.innerHTML = `<div class="err">${esc(errMsg(e))}</div>`; }
}
function saring() {
  let l = D.semua || [];
  if (D.isi !== 'servis' && D.cabang) l = l.filter(g => D.cabang === '-' ? !g.k.cabang : g.k.cabang === D.cabang);
  if (D.kec) l = l.filter(g => g.k.kecamatan === D.kec);
  if (D.motor === 'ada') l = l.filter(g => g.motor.length); if (D.motor === 'belum') l = l.filter(g => !g.motor.length);
  D.hasil = l.sort((a, b) => String(a.k.nama || '').localeCompare(String(b.k.nama || '')));
  const el = $('#kd-hasil'); if (el) el.innerHTML = hasilHTML();
}
const alamat = k => [k.alamat, k.rtrw ? 'RT/RW ' + k.rtrw : '', k.kelurahan, k.kecamatan, k.kabupaten].filter(Boolean).join(', ');
const servisAkhir = g => g.motor.map(m => m.servis?.akhir || m.servisTerakhir || '').sort().pop() || '';
// Baris untuk tabel/Excel/PDF
function baris() {
  const sup = super_(), out = [];
  D.hasil.forEach(g => {
    const k = g.k, dasar = { nama: k.nama || '', ...(sup ? { nik: k.nik || '' } : {}), hp: k.hp || '', alamat: alamat(k), kecamatan: k.kecamatan || '', kabupaten: k.kabupaten || '', cabang: k.cabang ? namaCabang(k.cabang) : '', terdaftar: String(k.dibuat || '').slice(0, 10) };
    if (D.bentuk === 'motor' && g.motor.length) g.motor.forEach(m => out.push({ ...dasar, nopol: m.nopol, tipe: [m.tipe, m.warna, m.tahun].filter(Boolean).join(' '), noRangka: m.noRangka || '', noMesin: m.noMesin || '', servisTerakhir: String(m.servis?.akhir || m.servisTerakhir || '').slice(0, 10), nServis: m.servis?.n || '', totalServis: m.servis?.total || '' }));
    else out.push({ ...dasar, nopol: g.motor.map(m => m.nopol).join(', '), tipe: g.motor.map(m => m.tipe || '').filter(Boolean).join(', '), jumlahMotor: g.motor.length, servisTerakhir: String(servisAkhir(g)).slice(0, 10), nServis: g.motor.reduce((a, m) => a + (m.servis?.n || 0), 0) || '', totalServis: g.motor.reduce((a, m) => a + (m.servis?.total || 0), 0) || '' });
  });
  return out;
}
function judul() {
  const L = D.label || {}, cab = D.cabang ? (D.cabang === '-' ? 'cabang belum diketahui' : (D.isi === 'servis' ? 'servis di ' : 'didaftarkan di ') + namaCabang(D.cabang)) : '';
  return [L.isi === 'servis' ? 'Konsumen yang servis ' + L.periode : L.isi === 'daftar' ? 'Konsumen didaftarkan ' + L.periode : 'Semua konsumen', cab, D.kec ? 'kec. ' + D.kec : '', D.motor === 'ada' ? 'punya motor' : D.motor === 'belum' ? 'belum punya motor' : ''].filter(Boolean).join(' · ');
}
function hasilHTML() {
  if (!D.hasil) return '';
  const rows = baris(), sup = super_(), kecs = [...new Set((D.semua || []).map(g => g.k.kecamatan).filter(Boolean))].sort();
  const tanpaCab = (D.semua || []).filter(g => !g.k.cabang && !String(g.k.id).startsWith('K:')).length;
  return `<div class="row spread" style="margin-top:10px"><b>${esc(judul())}</b><span class="row">
     ${kecs.length > 1 ? `<select id="kd-kec" data-kd="kec" style="width:auto" aria-label="Kecamatan"><option value="">Semua kecamatan</option>${kecs.map(k => `<option ${k === D.kec ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select>` : ''}
     <button class="btn" type="button" data-act="kd-xlsx">⬇ Excel</button><button class="btn" type="button" data-act="kd-pdf">⬇ PDF</button><button class="btn" type="button" data-act="kd-print">🖨 Print</button></span></div>
   <p class="small muted" style="margin:0">${D.hasil.length.toLocaleString('id-ID')} konsumen · ${rows.length.toLocaleString('id-ID')} baris${rows.length > 300 ? ' (ditampilkan 300 pertama; Excel/PDF/print berisi semua)' : ''}${D.isi === 'servis' ? ' · jumlah & total servis = pada periode ini' : ''}.</p>
   ${sup && D.isi !== 'servis' && tanpaCab && multiCabang() ? `<div class="note small">${tanpaCab} konsumen belum punya cabang pendaftar (data lama). <button class="link-btn" type="button" data-act="kd-lengkapi">Isi dari cabang servis pertamanya</button></div>` : ''}
   ${rows.length ? `<div class="tw"><table class="rw-tabel"><thead><tr><th>#</th><th>Nama</th>${sup ? '<th>NIK</th>' : ''}<th>No. HP</th><th>Alamat</th><th>Motor</th>${multiCabang() ? '<th>Cabang daftar</th>' : ''}<th>Servis terakhir</th>${D.isi === 'servis' ? '<th class="r">Servis</th><th class="r">Total</th>' : ''}</tr></thead><tbody>
    ${rows.slice(0, 300).map((r, i) => `<tr><td class="num">${i + 1}</td><td><b>${esc(r.nama)}</b></td>${sup ? `<td class="mono small">${esc(r.nik)}</td>` : ''}<td class="mono small">${esc(r.hp)}</td><td class="small">${esc(r.alamat)}</td><td class="small"><span class="mono">${esc(r.nopol)}</span>${r.tipe ? `<div class="rw-det">${esc(r.tipe)}</div>` : ''}</td>${multiCabang() ? `<td class="small">${esc(r.cabang || '–')}</td>` : ''}<td class="small">${esc(r.servisTerakhir || '–')}</td>${D.isi === 'servis' ? `<td class="r num">${r.nServis || ''}</td><td class="r num">${r.totalServis ? rp(r.totalServis) : ''}</td>` : ''}</tr>`).join('')}
   </tbody></table></div>` : '<div class="empty">Tidak ada konsumen yang cocok.</div>'}`;
}

async function keExcel() {
  try {
    const X = await loadXLSX(), rows = baris().map((r, i) => ({ no: i + 1, nama: r.nama, ...(super_() ? { nik: r.nik } : {}), no_hp: r.hp, alamat: r.alamat, kecamatan: r.kecamatan, kabupaten_kota: r.kabupaten, no_polisi: r.nopol, motor: r.tipe, ...(D.bentuk === 'motor' ? { no_rangka: r.noRangka, no_mesin: r.noMesin } : { jumlah_motor: r.jumlahMotor }), ...(multiCabang() ? { cabang_daftar: r.cabang } : {}), terdaftar: r.terdaftar, servis_terakhir: r.servisTerakhir, ...(D.isi === 'servis' ? { jumlah_servis: r.nServis, total_servis: r.totalServis } : {}) }));
    const wb = X.utils.book_new(), ws = X.utils.json_to_sheet(rows); filterOtomatis(X, ws, rows.length);
    X.utils.sheet_add_aoa(ws, [[judul() + ' · dicetak ' + new Date().toLocaleString('id-ID') + ' oleh ' + namaPetugas()]], { origin: { r: rows.length + 2, c: 0 } });
    X.utils.book_append_sheet(wb, ws, 'Konsumen'); X.writeFile(wb, `daftar-konsumen-${dkey(new Date())}.xlsx`);
  } catch (e) { toast('Gagal export: ' + e.message); }
}
async function kePdf(el) {
  const label = el.textContent; el.disabled = true; el.textContent = 'Menyiapkan…';
  try {
    const sup = super_(), rows = baris();
    const kolom = [
      ['No', 9, (k, i) => [String(i + 1)]],
      ['Nama', 52, k => [k.nama || '–', sup && k.nik ? 'NIK ' + k.nik : ''].filter(Boolean)],
      ['No. HP', 28, k => [k.hp || '']],
      ['Alamat', 86, k => [k.alamat || '']],
      ['Motor', 56, k => [k.nopol || '–', k.tipe || ''].filter(Boolean)],
      ['Cabang / daftar', 30, k => [k.cabang || '–', k.terdaftar || ''].filter(Boolean)],
      [D.isi === 'servis' ? 'Servis' : 'Servis terakhir', 26, k => [k.servisTerakhir || '–', D.isi === 'servis' && k.nServis ? k.nServis + '× ' + rp(k.totalServis) : ''].filter(Boolean)]
    ];
    const { konsumenPdfBlob } = await import('./konsumen-pdf.js'), { saveBlob } = await import('./nota-pdf.js');
    saveBlob(await konsumenPdfBlob(rows, { kolom, judul: 'Daftar konsumen', satuan: D.bentuk === 'motor' ? 'baris' : 'konsumen', filter: judul(), oleh: namaPetugas(), kolomTebal: 1, kolomAlamat: 3 }), `daftar-konsumen-${dkey(new Date())}.pdf`);
  } catch (e) { toast('Gagal membuat PDF: ' + e.message); }
  finally { el.disabled = false; el.textContent = label; }
}
function cetak() {
  const sup = super_(), rows = baris(), w = window.open('', '_blank');
  if (!w) { toast('Izinkan pop-up untuk mencetak'); return; }
  w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Daftar konsumen</title><style>body{font-family:Arial,sans-serif;font-size:11px;margin:12mm}h1{font-size:15px;margin:0}p{margin:2px 0 8px;color:#444}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:3px 5px;vertical-align:top;text-align:left}th{background:#e8eef8}tr{page-break-inside:avoid}@page{size:A4 landscape;margin:10mm}</style></head><body>
    <h1>Daftar konsumen</h1><p>${esc(judul())} · ${rows.length} baris · dicetak ${esc(new Date().toLocaleString('id-ID'))} oleh ${esc(namaPetugas())} · RAHASIA: berisi data pribadi</p>
    <table><thead><tr><th>#</th><th>Nama</th>${sup ? '<th>NIK</th>' : ''}<th>No. HP</th><th>Alamat</th><th>Motor</th>${multiCabang() ? '<th>Cabang</th>' : ''}<th>Terdaftar</th><th>Servis terakhir</th>${D.isi === 'servis' ? '<th>Servis</th><th>Total</th>' : ''}</tr></thead><tbody>
    ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.nama)}</td>${sup ? `<td>${esc(r.nik)}</td>` : ''}<td>${esc(r.hp)}</td><td>${esc(r.alamat)}</td><td>${esc(r.nopol)}${r.tipe ? '<br>' + esc(r.tipe) : ''}</td>${multiCabang() ? `<td>${esc(r.cabang)}</td>` : ''}<td>${esc(r.terdaftar)}</td><td>${esc(r.servisTerakhir)}</td>${D.isi === 'servis' ? `<td>${r.nServis || ''}</td><td>${r.totalServis ? esc(rp(r.totalServis)) : ''}</td>` : ''}</tr>`).join('')}
    </tbody></table></body></html>`);
  w.document.close(); w.focus(); setTimeout(() => w.print(), 300);
}

Object.assign(actions, {
  'kn-daftar': () => { if (!isRole('admin')) return; renderDaftar(); $('#kn-form')?.scrollIntoView({ block: 'nearest' }); },
  'kd-tampil': () => muat(),
  'kd-xlsx': keExcel,
  'kd-pdf': kePdf,
  'kd-print': cetak,
  'kd-lengkapi': async el => { el.disabled = true; el.textContent = 'Mengisi…'; try { const n = await lengkapiCabangPendaftar(); toast(n + ' konsumen diisi cabang pendaftarnya'); muat(); } catch (e) { toast(errMsg(e)); el.disabled = false; } }
});
changeHandlers.push(e => {
  const t = e.target; if (!t.dataset.kd) return;
  D[t.dataset.kd] = t.value;
  if (['kec', 'motor', 'bentuk'].includes(t.dataset.kd) && D.semua) { saring(); return; }
  if (t.dataset.kd === 'cabang' && D.semua && D.isi !== 'servis') { saring(); return; }
  if (['isi', 'periode', 'cabang', 'dari', 'sampai'].includes(t.dataset.kd)) { D.hasil = null; D.semua = null; renderDaftar(); }
});
