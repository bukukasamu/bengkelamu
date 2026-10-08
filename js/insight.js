// Menu Insight Konsumen (admin/pemilik): gambaran database konsumen & kendaraan dari data kendaraan
// dan nota servis 12 bulan terakhir (semua cabang): tren kunjungan, konsumen baru, tipe motor, wilayah,
// jenis servis, usia & jenis kelamin, konsumen terbaik, dan konsumen yang perlu diingatkan servis (WA).
import { $, esc, rp, dkey, toast, errMsg, waButton } from './util.js';
import { S, st, views, refreshers, actions, changeHandlers } from './state.js';
import { db, collection, getDocs, query, where } from './firebase.js';
import { nopolKey } from './cari-kendaraan.js';
import { namaCabang, cabangOf, multiCabang, cabangList } from './cabang.js';
import { loaderHTML } from './brand.js';
import { loadXLSX } from './import-excel.js';
import { cekLink } from './nota.js';
import { APP_NAME } from './config.js';

let data = null, memuat = null;
const IS = st.insight = st.insight || { jeda: 3, cabang: '' };
const bulanKe = (n) => { const d = new Date(); d.setMonth(d.getMonth() - n, 1); return dkey(d).slice(0, 7); };
const namaBln = ym => new Date(ym + '-01T00:00').toLocaleDateString('id-ID', { month: 'short' }) + " '" + ym.slice(2, 4);
const hariSejak = t => Math.floor((Date.now() - new Date(String(t).replace(' ', 'T'))) / 864e5);

async function muat(paksa) {
  if (data && !paksa) return data;
  if (memuat) return memuat;
  memuat = (async () => {
    const dari = bulanKe(11) + '-01';
    const [ks, ts] = await Promise.all([getDocs(collection(db, 'kendaraan')), getDocs(query(collection(db, 'trx'), where('tgl', '>=', dari)))]);
    data = { kend: ks.docs.map(d => ({ id: d.id, ...d.data() })), trx: ts.docs.map(d => d.data()).filter(t => t.jenis === 'SERVIS' && t.nopol), dari, waktu: new Date() };
    return data;
  })();
  try { return await memuat; } finally { memuat = null; }
}

function olah() {
  const trx = data.trx.filter(t => !IS.cabang || cabangOf(t) === IS.cabang);
  const kendMap = new Map(data.kend.map(k => [k.id, k]));
  // per kendaraan
  const per = new Map();
  trx.forEach(t => { const k = nopolKey(t.nopol), p = per.get(k) || { key: k, nopol: t.nopol, nama: t.pelanggan, hp: t.hp, tipe: t.tipe, n: 0, total: 0, pertama: t.tgl, terakhir: t.tgl, km: t.km };
    p.n++; p.total += t.total || 0; if (t.tgl < p.pertama) p.pertama = t.tgl; if (t.tgl >= p.terakhir) { p.terakhir = t.tgl; p.km = t.km || p.km; p.nama = t.pelanggan || p.nama; p.hp = t.hp || p.hp; } per.set(k, p); });
  const list = [...per.values()].map(p => ({ ...p, kend: kendMap.get(p.key) || null }));
  // tren 12 bulan
  const bulan = Array.from({ length: 12 }, (_, i) => bulanKe(11 - i));
  const tren = bulan.map(ym => { const l = trx.filter(t => t.tgl.startsWith(ym)); return { ym, servis: l.length, baru: list.filter(p => p.pertama.startsWith(ym)).length, omzet: l.reduce((a, t) => a + t.total, 0) }; });
  const hitung = (arr, f) => { const m = {}; arr.forEach(x => { const k = f(x); if (k) m[k] = (m[k] || 0) + 1; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const kendAktif = list.map(p => p.kend || { tipe: p.tipe });
  const umur = k => { if (!k?.tglLahir) return null; const u = Math.floor((Date.now() - new Date(k.tglLahir)) / 31557600000); return u < 20 ? '< 20' : u < 30 ? '20–29' : u < 40 ? '30–39' : u < 50 ? '40–49' : '50+'; };
  return {
    trx, list, tren,
    tipe: hitung(data.kend.length ? data.kend : kendAktif, k => k.tipe),
    kab: hitung(data.kend, k => k.kabupaten), kec: hitung(data.kend, k => k.kecamatan && (k.kecamatan + (k.kabupaten ? ', ' + k.kabupaten.replace(/^KABUPATEN |^KOTA /, '') : ''))),
    jenis: hitung(trx, t => t.jenisServis || 'Reguler'),
    jk: hitung(data.kend, k => k.jk), usia: hitung(data.kend, umur),
    top: [...list].sort((a, b) => b.total - a.total).slice(0, 10),
    ingat: list.filter(p => hariSejak(p.terakhir) >= IS.jeda * 30).sort((a, b) => b.total - a.total),
    sekali: list.filter(p => p.n === 1).length
  };
}

const barList = (rows, total, max = 8) => rows.length ? rows.slice(0, max).map(([k, v]) => `<div class="bar-row"><span class="row spread small"><span class="bar-lbl">${esc(k)}</span><span class="num">${v} · ${Math.round(v / total * 100)}%</span></span><span class="ph-bar"><i style="width:${v / rows[0][1] * 100}%"></i></span></div>`).join('') : '<div class="small muted">Belum ada data.</div>';

function trenSVG(tren) {
  const W = 640, H = 200, L = 34, B = 26, T = 10, cw = (W - L - 8) / tren.length, max = Math.max(...tren.map(t => t.servis), 4), top = Math.ceil(max / 4) * 4;
  const y = v => T + (H - T - B) * (1 - v / top);
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = top / 4 * i; g += `<line x1="${L}" x2="${W - 8}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`; }
  tren.forEach((t, i) => {
    const x = L + cw * i + cw * 0.18, w = cw * 0.64;
    g += `<rect x="${x}" y="${y(t.servis)}" width="${w}" height="${y(0) - y(t.servis)}" fill="var(--accent)" rx="2"><title>${namaBln(t.ym)}: ${t.servis} servis, ${t.baru} konsumen baru, ${rp(t.omzet)}</title></rect>`;
    g += `<rect x="${x + w * 0.25}" y="${y(t.baru)}" width="${w * 0.5}" height="${y(0) - y(t.baru)}" fill="var(--jasa)" rx="1.5"/>`;
    const bl = new Date(t.ym + '-01T00:00').toLocaleDateString('id-ID', { month: 'short' });
    g += `<text x="${x + w / 2}" y="${H - 8}" text-anchor="middle">${bl}${i === 0 || t.ym.endsWith('-01') ? ' ' + t.ym.slice(0, 4) : ''}</text>`;
  });
  return `<div style="overflow-x:auto"><svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" style="min-width:520px;display:block" role="img" aria-label="Kunjungan servis 12 bulan">${g}</svg></div>`;
}

async function renderInsight() {
  $('#view').innerHTML = `<div class="panel">${loaderHTML('Mengolah data konsumen…')}</div>`;
  try { await muat(); } catch (e) { $('#view').innerHTML = `<div class="panel"><div class="err">Gagal memuat: ${esc(errMsg(e))}</div></div>`; return; }
  if (st.view !== 'insight') return;
  const o = olah(), ini = o.tren[11], lalu = o.tren[10];
  const ulang = o.list.length ? Math.round((o.list.length - o.sekali) / o.list.length * 100) : 0;
  const rata = o.list.length ? (o.trx.length / o.list.length).toFixed(1).replace('.', ',') : '0';
  const pesan = p => `Halo ${p.nama && p.nama !== 'Umum' ? p.nama : 'Bapak/Ibu'}, kami dari ${APP_NAME}. Motor ${p.nopol} terakhir servis ${hariSejak(p.terakhir)} hari lalu${p.km ? ' (KM ' + Number(p.km).toLocaleString('id-ID') + ')' : ''}. Sudah waktunya servis berkala agar motor tetap prima. Kami tunggu kedatangannya 🙏\nRiwayat servis: ${cekLink(p.nopol)}`;
  $('#view').innerHTML = `<div class="grid">
   <div class="row spread"><p class="small muted" style="margin:0">Data kendaraan terdaftar + nota servis sejak ${esc(new Date(data.dari).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }))}. Dimuat ${esc(data.waktu.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }))}.</p>
    <div class="row">${multiCabang() ? `<select id="is-cab" style="width:auto" aria-label="Cabang"><option value="">Semua cabang</option>${cabangList(true).map(c => `<option value="${esc(c.id)}" ${c.id === IS.cabang ? 'selected' : ''}>${esc(c.nama)}</option>`).join('')}</select>` : ''}<button class="btn" type="button" data-act="is-muat">Muat ulang</button><button class="btn" type="button" data-act="is-xlsx">⬇ Excel</button></div></div>
   <div class="tiles t5">
    <div class="tile"><span class="lbl">Kendaraan terdaftar</span><span class="val">${data.kend.length.toLocaleString('id-ID')}</span><span class="sub">di database konsumen</span></div>
    <div class="tile"><span class="lbl">Kendaraan servis 12 bln</span><span class="val">${o.list.length.toLocaleString('id-ID')}</span><span class="sub">${o.trx.length} kunjungan · rata-rata ${rata}×</span></div>
    <div class="tile"><span class="lbl">Konsumen baru bulan ini</span><span class="val">${ini.baru}</span><span class="sub">bulan lalu ${lalu.baru}</span></div>
    <div class="tile"><span class="lbl">Kembali servis lagi</span><span class="val">${ulang}%</span><span class="sub">${o.sekali} kendaraan baru sekali datang</span></div>
    <button class="tile click" type="button" data-act="is-ingat"><span class="lbl">Perlu diingatkan</span><span class="val" style="color:${o.ingat.length ? 'var(--warn)' : 'inherit'}">${o.ingat.length}</span><span class="sub">tidak servis ≥ ${IS.jeda} bulan · lihat daftar</span></button>
   </div>
   <div class="panel"><div class="row spread"><h3>Kunjungan servis 12 bulan</h3><div class="legend"><span><i style="background:var(--accent)"></i>Servis</span><span><i style="background:var(--jasa)"></i>Konsumen baru</span></div></div>${trenSVG(o.tren)}</div>
   <div class="grid g2">
    <div class="panel"><h3>Tipe motor terbanyak</h3>${barList(o.tipe, o.tipe.reduce((a, x) => a + x[1], 0))}</div>
    <div class="panel"><h3>Jenis servis (12 bln)</h3>${barList(o.jenis, o.trx.length || 1)}</div>
    <div class="panel"><h3>Wilayah: kabupaten / kota</h3>${barList(o.kab, o.kab.reduce((a, x) => a + x[1], 0))}</div>
    <div class="panel"><h3>Wilayah: kecamatan</h3>${barList(o.kec, o.kec.reduce((a, x) => a + x[1], 0))}</div>
    <div class="panel"><h3>Usia pemilik (sesuai KTP)</h3>${barList(o.usia.sort((a, b) => a[0].localeCompare(b[0])), o.usia.reduce((a, x) => a + x[1], 0) || 1)}</div>
    <div class="panel"><h3>Jenis kelamin</h3>${barList(o.jk, o.jk.reduce((a, x) => a + x[1], 0) || 1)}<p class="small muted" style="margin:0">Usia & jenis kelamin terisi untuk konsumen yang data KTP-nya diisi saat registrasi.</p></div>
   </div>
   <div class="panel"><h3>Konsumen terbaik (12 bln)</h3>
    ${o.top.length ? `<div class="tw"><table><thead><tr><th>Nopol</th><th>Konsumen</th><th class="r">Kunjungan</th><th class="r">Total belanja</th><th>Terakhir</th></tr></thead><tbody>${o.top.map(p => `<tr class="row-click" tabindex="0" data-act="rw-buka" data-np="${esc(p.nopol)}"><td class="mono">${esc(p.nopol)}<br><span class="small muted">${esc(p.tipe || '')}</span></td><td>${esc(p.nama || '–')}</td><td class="r num">${p.n}</td><td class="r num">${rp(p.total)}</td><td class="small">${esc(p.terakhir.slice(0, 10))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="small muted">Belum ada data.</div>'}
   </div>
   <div class="panel" id="is-ingat"><div class="row spread"><h3>Perlu diingatkan servis</h3><label class="f" for="is-jeda" style="flex-direction:row;align-items:center;gap:6px">Tidak servis ≥<select id="is-jeda" style="width:auto">${[2, 3, 4, 6].map(n => `<option value="${n}" ${n === IS.jeda ? 'selected' : ''}>${n} bulan</option>`).join('')}</select></label></div>
    ${o.ingat.length ? `<div class="tw"><table><thead><tr><th>Nopol</th><th>Konsumen</th><th class="r">Terakhir servis</th><th class="r">Kunjungan</th><th></th></tr></thead><tbody>${o.ingat.slice(0, 100).map(p => `<tr><td class="mono"><button class="link-btn" type="button" data-act="rw-buka" data-np="${esc(p.nopol)}">${esc(p.nopol)}</button><br><span class="small muted">${esc(p.tipe || '')}</span></td><td>${esc(p.nama || '–')}<br><span class="small muted">${esc(p.hp || '')}</span></td><td class="r small">${esc(p.terakhir.slice(0, 10))}<br><span class="muted">${hariSejak(p.terakhir)} hari lalu</span></td><td class="r num">${p.n}</td><td class="r">${p.hp ? waButton(p.hp, pesan(p), 'Ingatkan') : ''}</td></tr>`).join('')}</tbody></table></div>${o.ingat.length > 100 ? `<p class="small muted" style="margin:0">Ditampilkan 100 dari ${o.ingat.length}. Unduh Excel untuk daftar lengkap.</p>` : ''}` : '<div class="small muted">Semua konsumen servis dalam rentang ini. 👍</div>'}
   </div>
  </div>`;
}

async function exportXlsx() {
  if (!data) return;
  try {
    const X = await loadXLSX(), o = olah(), per = new Map(o.list.map(p => [p.key, p]));
    const rows = data.kend.map(k => { const p = per.get(k.id) || {}; return { nopol: k.nopol, nama: k.nama || '', hp: k.hp || '', tipe: k.tipe || '', tahun: k.tahun || '', jenis_kelamin: k.jk || '', tgl_lahir: k.tglLahir || '', kabupaten: k.kabupaten || '', kecamatan: k.kecamatan || '', kelurahan: k.kelurahan || '', kunjungan_12bln: p.n || 0, belanja_12bln: p.total || 0, servis_terakhir: (p.terakhir || '').slice(0, 10), hari_sejak_servis: p.terakhir ? hariSejak(p.terakhir) : '' }; });
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows), 'Konsumen');
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(o.ingat.map(p => ({ nopol: p.nopol, nama: p.nama, hp: p.hp, tipe: p.tipe, servis_terakhir: p.terakhir.slice(0, 10), hari_sejak: hariSejak(p.terakhir), kunjungan: p.n, belanja: p.total }))), 'Perlu diingatkan');
    X.writeFile(wb, `insight-konsumen-${dkey(new Date())}.xlsx`);
  } catch (e) { toast('Gagal export: ' + e.message); }
}

views.insight = renderInsight;
refreshers.insight = () => {};
Object.assign(actions, {
  'is-muat': async () => { data = null; renderInsight(); },
  'is-xlsx': exportXlsx,
  'is-ingat': () => $('#is-ingat')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
});
changeHandlers.push(e => {
  if (e.target.id === 'is-jeda') { IS.jeda = +e.target.value; renderInsight(); }
  if (e.target.id === 'is-cab') { IS.cabang = e.target.value; renderInsight(); }
});
