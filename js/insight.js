// Menu Insight Konsumen (admin/pemilik). Aplikasi bekerja per bulan, jadi Insight hanya membaca nota bulan
// yang dipilih (bisa diperluas ke 3/6/12 bulan lewat filter), kendaraan yang servis di periode itu,
// kendaraan baru terdaftar di periode itu, dan kendaraan yang sudah lama tidak servis (maks. 300).
// Seluruh database kendaraan hanya dibaca bila tombol "Muat seluruh database" ditekan.
import { $, esc, rp, dkey, stamp, toast, errMsg, waButton } from './util.js';
import { st, views, refreshers, actions, changeHandlers } from './state.js';
import { db, collection, getDocs, query, where, orderBy, limit, documentId } from './firebase.js';
import { nopolKey } from './cari-kendaraan.js';
import { cabangOf, multiCabang, cabangList } from './cabang.js';
import { loaderHTML } from './brand.js';
import { loadXLSX } from './import-excel.js';
import { cekLink } from './nota.js';
import { sah } from './data-trx.js';
import { APP_NAME } from './config.js';

let data = null, memuat = null, kendSemua = null;
const IS = st.insight = st.insight || {};
IS.jeda = IS.jeda || 3; IS.cabang = IS.cabang || ''; IS.periode = IS.periode || 1; IS.bulan = IS.bulan || dkey(new Date()).slice(0, 7);
const PERIODE = [[1, '1 bulan'], [3, '3 bulan'], [6, '6 bulan'], [12, '12 bulan']];
const geserBulan = (ym, n) => { const d = new Date(ym + '-01T00:00'); d.setMonth(d.getMonth() + n, 1); return dkey(d).slice(0, 7); };
const namaBulan = ym => new Date(ym + '-01T00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
const hariSejak = t => Math.floor((Date.now() - new Date(String(t).replace(' ', 'T'))) / 864e5);
const bulanPeriode = () => Array.from({ length: IS.periode }, (_, i) => geserBulan(IS.bulan, i - IS.periode + 1));
const judul = () => IS.periode === 1 ? namaBulan(IS.bulan) : namaBulan(bulanPeriode()[0]) + ' – ' + namaBulan(IS.bulan);

async function ambilKendaraan(keys) {
  const out = [];
  for (let i = 0; i < keys.length; i += 30) {
    const s = await getDocs(query(collection(db, 'kendaraan'), where(documentId(), 'in', keys.slice(i, i + 30))));
    s.docs.forEach(d => out.push({ id: d.id, ...d.data() }));
  }
  return out;
}

async function muat(paksa) {
  if (data && !paksa) return data;
  if (memuat) return memuat;
  memuat = (async () => {
    const bln = bulanPeriode(), dari = bln[0] + '-01 00:00', sampai = bln[bln.length - 1] + '-31 23:59';
    const trx = [];
    for (let i = 0; i < bln.length; i += 10) {
      const s = await getDocs(query(collection(db, 'trx'), where('bulan', 'in', bln.slice(i, i + 10))));
      s.docs.forEach(d => { const t = d.data(); if (t.jenis === 'SERVIS' && t.nopol && sah(t)) trx.push(t); });
    }
    const keys = [...new Set(trx.map(t => nopolKey(t.nopol)).filter(Boolean))];
    const batas = stamp(new Date(Date.now() - IS.jeda * 30 * 864e5));
    const [kend, baru, ingat] = await Promise.all([
      ambilKendaraan(keys),
      getDocs(query(collection(db, 'kendaraan'), where('dibuat', '>=', dari), where('dibuat', '<=', sampai))).then(s => s.docs.map(d => ({ id: d.id, ...d.data() }))),
      getDocs(query(collection(db, 'kendaraan'), where('servisTerakhir', '<=', batas), orderBy('servisTerakhir', 'desc'), limit(300))).then(s => s.docs.map(d => ({ id: d.id, ...d.data() })))
    ]);
    data = { trx, kend, baru, ingat, bln, waktu: new Date(), jeda: IS.jeda };
    return data;
  })();
  try { return await memuat; } finally { memuat = null; }
}

function olah() {
  const trx = data.trx.filter(t => !IS.cabang || cabangOf(t) === IS.cabang);
  const kendMap = new Map(data.kend.map(k => [k.id, k]));
  const per = new Map();
  trx.forEach(t => { const k = nopolKey(t.nopol), p = per.get(k) || { key: k, nopol: t.nopol, nama: t.pelanggan, hp: t.hp, tipe: t.tipe, n: 0, total: 0, terakhir: t.tgl, km: t.km };
    p.n++; p.total += t.total || 0; if (t.tgl >= p.terakhir) { p.terakhir = t.tgl; p.km = t.km || p.km; p.nama = t.pelanggan || p.nama; p.hp = t.hp || p.hp; } per.set(k, p); });
  const list = [...per.values()].map(p => ({ ...p, kend: kendMap.get(p.key) || null }));
  // Tren: per hari (1 bulan) atau per bulan (3–12 bulan)
  let tren;
  if (IS.periode === 1) {
    const akhir = new Date(IS.bulan + '-01T00:00'); akhir.setMonth(akhir.getMonth() + 1, 0);
    tren = Array.from({ length: akhir.getDate() }, (_, i) => { const k = IS.bulan + '-' + String(i + 1).padStart(2, '0'); return { k, label: String(i + 1), judul: new Date(k + 'T00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }), servis: trx.filter(t => t.tgl.startsWith(k)).length, baru: data.baru.filter(v => String(v.dibuat).startsWith(k)).length }; });
  } else {
    tren = data.bln.map((ym, i) => ({ k: ym, label: new Date(ym + '-01T00:00').toLocaleDateString('id-ID', { month: 'short' }) + (i === 0 || ym.endsWith('-01') ? ' ' + ym.slice(0, 4) : ''), judul: namaBulan(ym), servis: trx.filter(t => t.tgl.startsWith(ym)).length, baru: data.baru.filter(v => String(v.dibuat).startsWith(ym)).length }));
  }
  const hitung = (arr, f) => { const m = {}; arr.forEach(x => { const k = f(x); if (k) m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  // Demografi: kendaraan yang servis di periode ini, atau seluruh database bila sudah dimuat
  const basis = kendSemua || list.map(p => p.kend || { tipe: p.tipe });
  const umur = k => { if (!k?.tglLahir) return null; const u = Math.floor((Date.now() - new Date(k.tglLahir)) / 31557600000); return u < 20 ? '< 20' : u < 30 ? '20–29' : u < 40 ? '30–39' : u < 50 ? '40–49' : '50+'; };
  const kunjunganLama = list.filter(p => p.kend?.dibuat && p.kend.dibuat < data.bln[0]).length;
  return {
    trx, list, tren, basis,
    tipe: hitung(basis, k => k.tipe),
    kab: hitung(basis, k => k.kabupaten), kec: hitung(basis, k => k.kecamatan && (k.kecamatan + (k.kabupaten ? ', ' + k.kabupaten.replace(/^KABUPATEN |^KOTA /, '') : ''))),
    jenis: hitung(trx, t => t.jenisServis || 'Reguler'),
    jk: hitung(basis, k => k.jk), usia: hitung(basis, umur),
    top: [...list].sort((a, b) => b.total - a.total).slice(0, 10),
    ingat: [...data.ingat].sort((a, b) => String(b.servisTerakhir).localeCompare(String(a.servisTerakhir))),
    lama: kunjunganLama, omzet: trx.reduce((a, t) => a + (t.total || 0), 0)
  };
}

const barList = (rows, total, max = 8) => rows.length ? rows.slice(0, max).map(([k, v]) => `<div class="bar-row"><span class="row spread small"><span class="bar-lbl">${esc(k)}</span><span class="num">${v} · ${Math.round(v / (total || 1) * 100)}%</span></span><span class="ph-bar"><i style="width:${v / rows[0][1] * 100}%"></i></span></div>`).join('') : '<div class="small muted">Belum ada data.</div>';

function trenSVG(tren) {
  const W = 640, H = 200, L = 34, B = 26, T = 10, cw = (W - L - 8) / tren.length, max = Math.max(...tren.map(t => Math.max(t.servis, t.baru)), 4), top = Math.ceil(max / 4) * 4;
  const y = v => T + (H - T - B) * (1 - v / top);
  const rapat = tren.length > 14;
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = top / 4 * i; g += `<line x1="${L}" x2="${W - 8}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`; }
  tren.forEach((t, i) => {
    const x = L + cw * i + cw * 0.18, w = cw * 0.64;
    g += `<rect x="${x}" y="${y(t.servis)}" width="${w}" height="${y(0) - y(t.servis)}" fill="var(--accent)" rx="2"><title>${esc(t.judul)}: ${t.servis} servis, ${t.baru} kendaraan baru</title></rect>`;
    g += `<rect x="${x + w * 0.25}" y="${y(t.baru)}" width="${w * 0.5}" height="${y(0) - y(t.baru)}" fill="var(--jasa)" rx="1.5"/>`;
    if (!rapat || i % 2 === 0) g += `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${esc(t.label)}</text>`;
  });
  return `<div style="overflow-x:auto"><svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" style="min-width:520px;display:block" role="img" aria-label="Kunjungan servis">${g}</svg></div>`;
}

async function renderInsight() {
  $('#view').innerHTML = `<div class="panel">${loaderHTML('Mengolah data konsumen ' + judul() + '…')}</div>`;
  try { await muat(); } catch (e) { $('#view').innerHTML = `<div class="panel"><div class="err">Gagal memuat: ${esc(errMsg(e))}</div></div>`; return; }
  if (st.view !== 'insight') return;
  const o = olah(), kini = dkey(new Date()).slice(0, 7);
  const ulang = o.list.length ? Math.round(o.lama / o.list.length * 100) : 0;
  const rata = o.list.length ? (o.trx.length / o.list.length).toFixed(1).replace('.', ',') : '0';
  const baruN = data.baru.length;
  const pesan = k => `Halo ${k.nama && k.nama !== 'Umum' ? k.nama : 'Bapak/Ibu'}, kami dari ${APP_NAME}. Motor ${k.nopol} terakhir servis ${hariSejak(k.servisTerakhir)} hari lalu${k.kmTerakhir || k.km ? ' (KM ' + Number(k.kmTerakhir || k.km).toLocaleString('id-ID') + ')' : ''}. Sudah waktunya servis berkala agar motor tetap prima. Kami tunggu kedatangannya 🙏\nRiwayat servis: ${cekLink(k.nopol)}`;
  const demo = kendSemua ? `seluruh database (${kendSemua.length.toLocaleString('id-ID')} kendaraan)` : 'kendaraan yang servis di periode ini';
  $('#view').innerHTML = `<div class="grid">
   <div class="row spread">
    <div class="lap-nav"><button class="btn sm" type="button" data-act="is-geser" data-n="-1" aria-label="Bulan sebelumnya">‹</button><b>${esc(judul())}</b><button class="btn sm" type="button" data-act="is-geser" data-n="1" aria-label="Bulan berikutnya" ${IS.bulan >= kini ? 'disabled' : ''}>›</button>
     <input id="is-bln" type="month" value="${IS.bulan}" max="${kini}" style="width:auto" aria-label="Pilih bulan"></div>
    <div class="row"><div class="seg" role="group" aria-label="Rentang">${PERIODE.map(([n, l]) => `<button type="button" data-act="is-per" data-n="${n}" aria-pressed="${n === IS.periode}">${l}</button>`).join('')}</div>
     ${multiCabang() ? `<select id="is-cab" style="width:auto" aria-label="Cabang"><option value="">Semua cabang</option>${cabangList(true).map(c => `<option value="${esc(c.id)}" ${c.id === IS.cabang ? 'selected' : ''}>${esc(c.nama)}</option>`).join('')}</select>` : ''}
     <button class="btn" type="button" data-act="is-muat">Muat ulang</button><button class="btn" type="button" data-act="is-xlsx">⬇ Excel</button></div>
   </div>
   <p class="small muted" style="margin:0">Hanya membaca nota ${esc(judul())}${IS.periode > 1 ? ' (' + IS.periode + ' bulan)' : ''}, ${data.kend.length} kendaraan yang servis, dan ${data.ingat.length} kendaraan yang perlu diingatkan. Dimuat ${esc(data.waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))}.</p>
   <div class="tiles t5">
    <div class="tile"><span class="lbl">Kendaraan servis</span><span class="val">${o.list.length.toLocaleString('id-ID')}</span><span class="sub">${o.trx.length} kunjungan · rata-rata ${rata}×</span></div>
    <div class="tile"><span class="lbl">Omzet servis</span><span class="val">${rp(o.omzet)}</span><span class="sub">${esc(judul())}</span></div>
    <div class="tile"><span class="lbl">Kendaraan baru terdaftar</span><span class="val">${baruN}</span><span class="sub">${esc(judul())}</span></div>
    <div class="tile"><span class="lbl">Konsumen lama kembali</span><span class="val">${ulang}%</span><span class="sub">${o.lama} dari ${o.list.length} kendaraan</span></div>
    <button class="tile click" type="button" data-act="is-ingat"><span class="lbl">Perlu diingatkan</span><span class="val" style="color:${o.ingat.length ? 'var(--warn)' : 'inherit'}">${o.ingat.length}${o.ingat.length >= 300 ? '+' : ''}</span><span class="sub">tidak servis ≥ ${IS.jeda} bulan · lihat daftar</span></button>
   </div>
   <div class="panel"><div class="row spread"><h3>Kunjungan servis ${IS.periode === 1 ? 'per hari' : 'per bulan'}</h3><div class="legend"><span><i style="background:var(--accent)"></i>Servis</span><span><i style="background:var(--jasa)"></i>Kendaraan baru</span></div></div>${trenSVG(o.tren)}</div>
   <div class="row spread"><p class="small muted" style="margin:0">Tipe motor, wilayah, usia &amp; jenis kelamin di bawah dihitung dari <b>${demo}</b>.</p>${kendSemua ? '' : '<button class="btn sm" type="button" data-act="is-semua" title="Membaca semua data kendaraan sekali">Muat seluruh database kendaraan</button>'}</div>
   <div class="grid g2">
    <div class="panel"><h3>Tipe motor</h3>${barList(o.tipe, o.tipe.reduce((a, x) => a + x[1], 0))}</div>
    <div class="panel"><h3>Jenis servis</h3>${barList(o.jenis, o.trx.length || 1)}</div>
    <div class="panel"><h3>Wilayah: kabupaten / kota</h3>${barList(o.kab, o.kab.reduce((a, x) => a + x[1], 0))}</div>
    <div class="panel"><h3>Wilayah: kecamatan</h3>${barList(o.kec, o.kec.reduce((a, x) => a + x[1], 0))}</div>
    <div class="panel"><h3>Usia konsumen (sesuai KTP)</h3>${barList(o.usia.sort((a, b) => a[0].localeCompare(b[0])), o.usia.reduce((a, x) => a + x[1], 0) || 1)}</div>
    <div class="panel"><h3>Jenis kelamin</h3>${barList(o.jk, o.jk.reduce((a, x) => a + x[1], 0) || 1)}<p class="small muted" style="margin:0">Usia & jenis kelamin terisi untuk konsumen yang data KTP-nya diisi saat registrasi.</p></div>
   </div>
   <div class="panel"><h3>Konsumen terbaik · ${esc(judul())}</h3>
    ${o.top.length ? `<div class="tw"><table><thead><tr><th>Nopol</th><th>Konsumen</th><th class="r">Kunjungan</th><th class="r">Total belanja</th><th>Terakhir</th></tr></thead><tbody>${o.top.map(p => `<tr class="row-click" tabindex="0" data-act="rw-buka" data-np="${esc(p.nopol)}"><td class="mono">${esc(p.nopol)}<br><span class="small muted">${esc(p.tipe || '')}</span></td><td>${esc(p.nama || '–')}</td><td class="r num">${p.n}</td><td class="r num">${rp(p.total)}</td><td class="small">${esc(p.terakhir.slice(0, 10))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="small muted">Belum ada servis di periode ini.</div>'}
   </div>
   <div class="panel" id="is-ingat"><div class="row spread"><h3>Perlu diingatkan servis</h3><label class="f" for="is-jeda" style="flex-direction:row;align-items:center;gap:6px">Tidak servis ≥<select id="is-jeda" style="width:auto">${[2, 3, 4, 6].map(n => `<option value="${n}" ${n === IS.jeda ? 'selected' : ''}>${n} bulan</option>`).join('')}</select></label></div>
    ${o.ingat.length ? `<div class="tw"><table><thead><tr><th>Nopol</th><th>Konsumen</th><th class="r">Terakhir servis</th><th></th></tr></thead><tbody>${o.ingat.slice(0, 100).map(k => `<tr><td class="mono"><button class="link-btn" type="button" data-act="rw-buka" data-np="${esc(k.nopol)}">${esc(k.nopol)}</button><br><span class="small muted">${esc(k.tipe || '')}</span></td><td>${esc(k.nama || '–')}<br><span class="small muted">${esc(k.hp || '')}</span></td><td class="r small">${esc(String(k.servisTerakhir).slice(0, 10))}<br><span class="muted">${hariSejak(k.servisTerakhir)} hari lalu</span></td><td class="r">${k.hp ? waButton(k.hp, pesan(k), 'Ingatkan') : ''}</td></tr>`).join('')}</tbody></table></div><p class="small muted" style="margin:0">Diurutkan dari yang paling baru lewat batas. ${o.ingat.length > 100 ? `Ditampilkan 100 dari ${o.ingat.length}${o.ingat.length >= 300 ? '+' : ''}; unduh Excel untuk daftar lengkap.` : ''}</p>` : '<div class="small muted">Semua konsumen servis dalam rentang ini. 👍</div>'}
   </div>
  </div>`;
}

async function exportXlsx() {
  if (!data) return;
  try {
    const X = await loadXLSX(), o = olah();
    const rows = o.list.map(p => { const k = p.kend || {}; return { nopol: p.nopol, nama: k.nama || p.nama || '', hp: k.hp || p.hp || '', tipe: k.tipe || p.tipe || '', tahun: k.tahun || '', jenis_kelamin: k.jk || '', tgl_lahir: k.tglLahir || '', kabupaten: k.kabupaten || '', kecamatan: k.kecamatan || '', kelurahan: k.kelurahan || '', terdaftar: String(k.dibuat || '').slice(0, 10), kunjungan_periode: p.n, belanja_periode: p.total, servis_terakhir: p.terakhir.slice(0, 10) }; });
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows.length ? rows : [{ info: 'Tidak ada servis di periode ini' }]), 'Konsumen periode');
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(o.ingat.map(k => ({ nopol: k.nopol, nama: k.nama || '', hp: k.hp || '', tipe: k.tipe || '', servis_terakhir: String(k.servisTerakhir).slice(0, 10), hari_sejak: hariSejak(k.servisTerakhir) }))), 'Perlu diingatkan');
    if (data.baru.length) X.utils.book_append_sheet(wb, X.utils.json_to_sheet(data.baru.map(k => ({ nopol: k.nopol, nama: k.nama || '', hp: k.hp || '', tipe: k.tipe || '', terdaftar: String(k.dibuat).slice(0, 10) }))), 'Kendaraan baru');
    if (kendSemua) X.utils.book_append_sheet(wb, X.utils.json_to_sheet(kendSemua.map(k => ({ nopol: k.nopol, nama: k.nama || '', hp: k.hp || '', tipe: k.tipe || '', tahun: k.tahun || '', jenis_kelamin: k.jk || '', kabupaten: k.kabupaten || '', kecamatan: k.kecamatan || '', terdaftar: String(k.dibuat || '').slice(0, 10), servis_terakhir: String(k.servisTerakhir || '').slice(0, 10) }))), 'Seluruh database');
    X.writeFile(wb, `insight-konsumen-${IS.bulan}${IS.periode > 1 ? '-' + IS.periode + 'bln' : ''}.xlsx`);
  } catch (e) { toast('Gagal export: ' + e.message); }
}

const muatUlang = () => { data = null; renderInsight(); };
views.insight = renderInsight;
refreshers.insight = () => {};
Object.assign(actions, {
  'is-muat': muatUlang,
  'is-geser': el => { IS.bulan = geserBulan(IS.bulan, +el.dataset.n); muatUlang(); },
  'is-per': el => { IS.periode = +el.dataset.n; muatUlang(); },
  'is-semua': async el => {
    el.disabled = true; el.textContent = 'Memuat seluruh database…';
    try { const s = await getDocs(collection(db, 'kendaraan')); kendSemua = s.docs.map(d => ({ id: d.id, ...d.data() })); renderInsight(); }
    catch (e) { toast(errMsg(e)); el.disabled = false; }
  },
  'is-xlsx': exportXlsx,
  'is-ingat': () => $('#is-ingat')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
});
changeHandlers.push(e => {
  if (e.target.id === 'is-jeda') { IS.jeda = +e.target.value; muatUlang(); }
  if (e.target.id === 'is-cab') { IS.cabang = e.target.value; renderInsight(); }
  if (e.target.id === 'is-bln' && e.target.value) { IS.bulan = e.target.value; muatUlang(); }
});
