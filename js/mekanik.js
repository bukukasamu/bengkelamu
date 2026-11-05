// Menu Performa Mekanik: pekerjaan saat ini, jumlah motor, waktu servis, nilai jasa (gaji & komisi ada di menu Penghasilan).
import { $, esc, rp, dkey, modal } from './util.js';
import { loaderHTML } from './brand.js';
import { S, st, views, refreshers, actions, changeHandlers, mekanikAktif, isRole, go } from './state.js';
import { trxIn } from './stats.js';
import { ambilTrx } from './data-trx.js';
import { AKTIF, statusPill, jenisBadge, durasi, fmtDur } from './wo-common.js';

function periode() {
  const now = new Date();
  if (st.mekPeriode === 'hari') return { from: dkey(now), to: dkey(now), label: 'Hari ini' };
  if (st.mekPeriode === 'minggu') { const a = new Date(now); a.setDate(now.getDate() - ((now.getDay() + 6) % 7)); return { from: dkey(a), to: dkey(now), label: 'Minggu ini' }; }
  if (st.mekPeriode === 'custom' && st.mekDari && st.mekSampai) return { from: st.mekDari, to: st.mekSampai, label: st.mekDari === st.mekSampai ? st.mekDari : st.mekDari + ' s/d ' + st.mekSampai };
  if (st.mekPeriode === 'lalu') {
    const a = new Date(now.getFullYear(), now.getMonth() - 1, 1), b = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: dkey(a), to: dkey(b), label: a.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) };
  }
  return { from: dkey(new Date(now.getFullYear(), now.getMonth(), 1)), to: dkey(now), label: now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) };
}
const milik = (t, m) => t.jenis === 'SERVIS' && (t.mekanikId ? t.mekanikId === m.id : t.mekanik === m.nama);
const nilaiKategori = t => ({ part: (t.items || []).reduce((a, x) => a + (+x.qty || 0) * (+x.harga || 0), 0), jasa: (t.jasa || []).reduce((a, j) => a + (+j.harga || 0), 0), ksg: +t.jasaKlaim || 0, biaya: (t.biaya || []).reduce((a, x) => a + (+x.jumlah || 0), 0) });
const nilaiJasa = t => { const x = nilaiKategori(t); return x.jasa + x.ksg; };
const rpM = n => 'Rp. ' + Math.round(n || 0).toLocaleString('id-ID');

export function hitung(m, from, to, sumber = null) {
  const list = (sumber || trxIn(from, to)).filter(t => milik(t, m)).sort((a, b) => b.tgl.localeCompare(a.tgl));
  const nilai = list.reduce((a, t) => { const x = nilaiKategori(t); Object.keys(x).forEach(k => { a[k] += x[k]; }); return a; }, { part: 0, jasa: 0, ksg: 0, biaya: 0 });
  const jasa = nilai.jasa + nilai.ksg;
  const ksg = list.filter(t => t.jenisServis === 'KSG').length;
  const w = waktuStat(list, m);
  return { list, unit: list.length, jasa, ksg, ...nilai, total: nilai.part + nilai.jasa + nilai.ksg + nilai.biaya, ...w };   // gaji & komisi ada di menu Penghasilan (privat)
}

// Statistik lama kerja (menit, waktu ditunda tidak dihitung). Nota lama tanpa catatan waktu dilewati.
// Bila motor dikerjakan bergantian (ditunda lalu dilanjutkan mekanik lain), yang dihitung hanya menit mekanik ini.
const kerjaOf = (t, m) => { const own = m && t.kerjaMekanik ? t.kerjaMekanik[m.nama] : undefined; if (own != null) return own > 0 ? own : null; return t.waktu && t.waktu.kerja > 0 ? t.waktu.kerja : null; };
const bersama = (t, m) => t.kerjaMekanik ? Object.keys(t.kerjaMekanik).filter(n => n !== m.nama) : [];
function waktuStat(list, m) {
  const k = list.map(t => kerjaOf(t, m)).filter(v => v != null);
  return { nWaktu: k.length, rata: k.length ? Math.round(k.reduce((a, b) => a + b, 0) / k.length) : null, cepat: k.length ? Math.min(...k) : null, lama: k.length ? Math.max(...k) : null };
}
// Rata-rata lama kerja per tipe motor
function perTipe(list, m) {
  const g = {};
  list.forEach(t => { const v = kerjaOf(t, m); if (v == null) return; const k = t.tipe || '(tanpa tipe)'; (g[k] = g[k] || []).push(v); });
  return Object.entries(g).map(([tipe, v]) => ({ tipe, n: v.length, rata: Math.round(v.reduce((a, b) => a + b, 0) / v.length), cepat: Math.min(...v), lama: Math.max(...v) })).sort((a, b) => b.n - a.n);
}

function myMekanik() {
  if (isRole('mekanik')) return S.mekanik.find(m => m.id === st.petugas.mekanikId) || S.mekanik.find(m => m.loginId && m.loginId === st.petugas.loginId);
  const l = mekanikAktif();
  return l.find(m => m.id === st.mekSel) || l[0];
}

function detailKategori(cat) {
  const m = myMekanik(), p = periode(), h = hitung(m, p.from, p.to, st.mekTrx || []);
  const rows = h.list.flatMap(t => cat === 'part' ? (t.items || []).map(x => ({ t, nama: x.nama || x.kode, kode: x.kode, qty: x.qty, nilai: (+x.qty || 0) * (+x.harga || 0) })) : cat === 'jasa' ? (t.jasa || []).map(x => ({ t, nama: x.nama, qty: 1, nilai: +x.harga || 0 })) : cat === 'ksg' ? (t.jasaKlaim ? [{ t, nama: 'Jasa KSG', qty: 1, nilai: +t.jasaKlaim }] : []) : (t.biaya || []).map(x => ({ t, nama: x.ket || 'Biaya lainnya', qty: 1, nilai: +x.jumlah || 0 })));
  const label = { part: 'Sparepart', jasa: 'Jasa servis', ksg: 'Jasa KSG', biaya: 'Biaya lainnya' }[cat];
  modal(`<div class="row spread"><h2>Detail ${label}</h2><button class="btn sm ghost" type="button" data-close="1">✕</button></div><div class="tw"><table><thead><tr><th>Tanggal</th><th>No. Polisi</th><th>Tipe motor</th><th>Rincian</th><th class="r">Qty</th><th class="r">Nilai</th></tr></thead><tbody>${rows.map(x => `<tr><td class="small">${esc((x.t.tgl || '').slice(0, 10))}</td><td class="mono">${esc(x.t.nopol || '–')}</td><td>${esc(x.t.tipe || '–')}</td><td>${esc(x.nama)}${x.kode ? `<br><span class="small muted mono">${esc(x.kode)}</span>` : ''}</td><td class="r num">${x.qty}</td><td class="r num">${rpM(x.nilai)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Belum ada rincian.</td></tr>'}</tbody></table></div><div class="totals"><b>Total ${label}</b><b class="num">${rpM(rows.reduce((a, x) => a + x.nilai, 0))}</b></div>`, 'wide');
}
function detailUnit() {
  const m = myMekanik(), p = periode(), h = hitung(m, p.from, p.to, st.mekTrx || []);
  modal(`<div class="row spread"><h2>Motor selesai · ${esc(p.label)}</h2><button class="btn sm ghost" type="button" data-close="1">✕</button></div><div class="tw"><table><thead><tr><th>Tanggal</th><th>No. Polisi</th><th>Tipe sepeda motor</th><th>Jenis</th></tr></thead><tbody>${h.list.map(t => `<tr><td>${esc((t.tgl || '').slice(0, 10))}</td><td class="mono">${esc(t.nopol || '–')}</td><td>${esc(t.tipe || '–')}</td><td>${jenisBadge(t)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">Belum ada motor selesai.</td></tr>'}</tbody></table></div>`, 'wide');
}
function detailTrx(no) {
  const t = (st.mekTrx || []).find(x => x.no === no); if (!t) return;
  const x = nilaiKategori(t);
  modal(`<div class="row spread"><h2>${esc(t.nopol || 'Motor')} · ${esc(t.tipe || '')}</h2><button class="btn sm ghost" type="button" data-close="1">✕</button></div><p class="small muted">${esc(t.tgl || '')} · ${esc(t.no || '')} · ${jenisBadge(t)}</p><div class="totals"><span>Sparepart</span><b class="num">${rpM(x.part)}</b><span>Jasa servis</span><b class="num">${rpM(x.jasa)}</b><span>Jasa KSG</span><b class="num">${rpM(x.ksg)}</b><span>Biaya lainnya</span><b class="num">${rpM(x.biaya)}</b></div>`, 'wide');
}

function targetMekanikHTML(m, h, p) {
  const aturan = (S.aturan?.insentif || []).filter(i => i.aktif !== false && (((i.orang || []).includes('M:' + m.id)) || (!(i.orang || []).length && (i.peran || []).includes('mekanik'))));
  if (!aturan.length) return `<div class="panel mek-target-empty"><div class="target-icon">◎</div><div><h3>Target mekanik</h3><p class="small muted">Belum ada aturan target aktif untuk ${esc(m.nama)}. Atur melalui Master Data → Insentif &amp; Potongan.</p></div></div>`;
  const nilai = { part: h.part, jasa: h.jasa + h.biaya, biaya: h.biaya };
  const kartu = aturan.map(it => {
    const sumber = it.sumber || 'jasa', val = nilai[sumber] || 0, tingkat = [...(it.tingkat || [])].filter(x => +x.persen > 0).sort((a, b) => (+a.min || 0) - (+b.min || 0));
    const capai = [...tingkat].reverse().find(x => val >= (+x.min || 0)), berikut = tingkat.find(x => val < (+x.min || 0)), target = berikut?.min || capai?.min || (tingkat[tingkat.length - 1]?.min || 0), pct = target ? Math.min(100, Math.round(val / target * 100)) : 0;
    return `<div class="mek-target-card"><div class="row spread"><div><span class="target-source">${esc(it.nama || 'Target insentif')}</span><div class="small muted">${esc({ part: 'Sparepart', jasa: 'Jasa servis + biaya lainnya', biaya: 'Biaya lainnya' }[sumber] || sumber)}</div></div><span class="target-pct">${pct}%</span></div><div class="target-track"><i style="width:${pct}%"></i></div><div class="row spread small"><span><b>${rpM(val)}</b> tercapai</span><span>${target ? 'Target ' + rpM(target) : 'Target belum diatur'}</span></div><div class="target-foot">${berikut ? `Kurang <b>${rpM(Math.max(0, berikut.min - val))}</b> untuk insentif <b>${berikut.persen}%</b>` : capai ? `Target tercapai · insentif <b>${capai.persen}%</b>` : 'Belum ada progres pada periode ini'}</div></div>`;
  }).join('');
  return `<div class="panel mek-target"><div class="row spread"><div><div class="eyebrow">PERFORMA &amp; PENCAPAIAN</div><h3 style="margin:2px 0">Target ${esc(m.nama)}</h3><div class="small muted">${esc(p.label)} · klik Penghasilan untuk rincian gaji</div></div><div class="target-icon">↗</div></div><div class="mek-target-grid">${kartu}</div></div>`;
}

let mekLoadKey = '';
async function renderMekanik() {
  const m = myMekanik(), p = periode(), key = p.from + '|' + p.to;
  if (key !== mekLoadKey) { mekLoadKey = key; $('#view').innerHTML = `<div class="panel">${loaderHTML('Memuat riwayat mekanik…')}</div>`; try { st.mekTrx = await ambilTrx(p.from, p.to); } catch (e) { st.mekTrx = []; } if (st.view !== 'mekanik') return; }
  if (!m) {
    $('#view').innerHTML = `<div class="panel"><div class="empty">${isRole('mekanik') ? 'Data mekanik untuk akun ini tidak ditemukan. Minta admin memeriksa di Master Data → Mekanik.' : 'Belum ada data mekanik. Tambahkan di Master Data → Mekanik.'}</div></div>`;
    return;
  }
  const h = hitung(m, p.from, p.to, st.mekTrx);
  const aktif = S.wo.filter(w => AKTIF.includes(w.status) && (w.mekanikId ? w.mekanikId === m.id : w.mekanik === m.nama));
  const semua = isRole('admin') ? mekanikAktif().map(x => ({ m: x, h: hitung(x, p.from, p.to, st.mekTrx) })) : [];
  $('#view').innerHTML = `<div class="grid">
   <div class="row spread">
    <div class="row">${isRole('admin') ? `<label class="f" for="mk-sel" style="flex-direction:row;align-items:center;gap:8px">Mekanik<select id="mk-sel" style="width:auto">${mekanikAktif().map(x => `<option value="${esc(x.id)}" ${x.id === m.id ? 'selected' : ''}>${esc(x.nama)}</option>`).join('')}</select></label>` : `<h2>${esc(m.nama)}</h2>`}</div>
    <div class="row" style="flex-wrap:wrap;justify-content:flex-end"><div class="seg" role="group" aria-label="Periode">${[['hari', 'Hari ini'], ['minggu', 'Minggu'], ['ini', 'Bulan ini'], ['lalu', 'Bulan lalu']].map(([k, l]) => `<button type="button" data-act="mk-per" data-p="${k}" aria-pressed="${k === st.mekPeriode}">${l}</button>`).join('')}</div><label class="small">Dari <input id="mk-dari" type="date" value="${esc(st.mekDari || p.from)}"></label><label class="small">s/d <input id="mk-sampai" type="date" value="${esc(st.mekSampai || p.to)}"></label><button class="btn sm" type="button" data-act="mk-date">Terapkan</button></div>
   </div>
   <div class="tiles t5">
    <button class="tile click" type="button" data-act="mk-unit"><span class="lbl">Motor selesai</span><span class="val">${h.unit}</span><span class="sub">${p.label}${h.ksg ? ' · ' + h.ksg + ' KSG' : ''} · klik untuk detail</span></button>
    <button class="tile click" type="button" data-act="mk-detail" data-cat="total"><span class="lbl">Total nilai pekerjaan</span><span class="val">${rpM(h.total)}</span><span class="sub">part + jasa + jasa KSG + biaya lain</span></button>
    <div class="tile"><span class="lbl">Rata-rata dikerjakan</span><span class="val">${h.nWaktu ? fmtDur(h.rata) : '–'}</span><span class="sub">${h.nWaktu} motor tercatat</span></div>
    ${isRole('mekanik') || st.petugas?.super ? `<button class="tile click" type="button" data-act="go-penghasilan"><span class="lbl">${isRole('mekanik') ? 'Penghasilan saya' : 'Penghasilan mekanik'}</span><span class="val" style="font-size:1.05rem">Lihat gaji, insentif &amp; target ›</span><span class="sub">menu Penghasilan</span></button>` : ''}
   </div>
   ${targetMekanikHTML(m, h, p)}
   <div class="panel"><h3>Rincian nilai pekerjaan <span class="small muted">(klik kategori untuk melihat detail)</span></h3><div class="mek-breakdown"><button class="tile click" data-act="mk-detail" data-cat="part"><span class="lbl">Sparepart</span><span class="val">${rpM(h.part)}</span></button><button class="tile click" data-act="mk-detail" data-cat="jasa"><span class="lbl">Jasa servis</span><span class="val">${rpM(h.jasa)}</span></button><button class="tile click" data-act="mk-detail" data-cat="ksg"><span class="lbl">Jasa KSG</span><span class="val">${rpM(h.ksg)}</span></button><button class="tile click" data-act="mk-detail" data-cat="biaya"><span class="lbl">Biaya lainnya</span><span class="val">${rpM(h.biaya)}</span></button></div><div class="totals"><b>Total semua</b><b class="num">${rpM(h.total)}</b></div></div>
   <div class="panel"><h3>Pekerjaan saat ini</h3>
    ${aktif.length ? `<div class="tw"><table class="bernomor"><thead><tr><th>WO</th><th>Motor</th><th>Keluhan</th><th>Status</th><th></th></tr></thead><tbody>${aktif.map(w => `<tr><td class="mono">${esc(w.no)}<br>${jenisBadge(w)}</td><td><span class="mono">${esc(w.nopol)}</span><br><span class="small muted">${esc(w.tipe)}</span></td><td class="small">${esc(w.keluhan || '–')}${w.catatanPart ? `<br><span class="muted">Part: ${esc(w.catatanPart)}</span>` : ''}</td><td>${statusPill(w.status)}${durasi(w) ? `<br><span class="small muted">dikerjakan ${fmtDur(durasi(w).kerja)}</span>` : ''}</td><td>${w.status === 'Dikerjakan' ? '<span class="small muted">Laporkan ke Register untuk diproses</span>' : w.status === 'Ditunda' ? esc(w.alasanTunda || 'Ditunda') : w.status === 'Selesai' ? 'Laporan diterima Register · menunggu pembayaran' : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Tidak ada pekerjaan aktif.</div>'}
   </div>
   <div class="panel"><h3>Waktu servis · ${esc(p.label)}</h3>
    ${h.nWaktu ? `<div class="tiles"><div class="tile"><span class="lbl">Rata-rata dikerjakan</span><span class="val">${fmtDur(h.rata)}</span><span class="sub">${h.nWaktu} motor tercatat</span></div><div class="tile"><span class="lbl">Tercepat</span><span class="val">${fmtDur(h.cepat)}</span></div><div class="tile"><span class="lbl">Terlama</span><span class="val">${fmtDur(h.lama)}</span></div></div>
    <div class="tw"><table><thead><tr><th>Tipe motor</th><th class="r">Motor</th><th class="r">Rata-rata</th><th class="r">Tercepat</th><th class="r">Terlama</th></tr></thead><tbody>${perTipe(h.list, m).map(r => `<tr><td>${esc(r.tipe)}</td><td class="r num">${r.n}</td><td class="r num">${fmtDur(r.rata)}</td><td class="r num">${fmtDur(r.cepat)}</td><td class="r num">${fmtDur(r.lama)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Belum ada servis dengan catatan waktu di periode ini.</div>'}
    <p class="small muted" style="margin:0">Lama dikerjakan dihitung dari mekanik mulai sampai laporan diterima Register; waktu Ditunda tidak dihitung.</p>
   </div>
   ${isRole('admin') ? (() => { const all = trxIn(p.from, p.to).filter(t => t.jenis === 'SERVIS'); const rows = perTipe(all); return rows.length ? `<div class="panel"><h3>Rata-rata waktu servis per tipe motor (semua mekanik)</h3><div class="tw"><table><thead><tr><th>Tipe motor</th><th class="r">Motor</th><th class="r">Rata-rata</th><th class="r">Tercepat</th><th class="r">Terlama</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.tipe)}</td><td class="r num">${r.n}</td><td class="r num">${fmtDur(r.rata)}</td><td class="r num">${fmtDur(r.cepat)}</td><td class="r num">${fmtDur(r.lama)}</td></tr>`).join('')}</tbody></table></div></div>` : ''; })() : ''}
   ${semua.length > 1 ? `<div class="panel"><h3>Semua mekanik · ${esc(p.label)}</h3><div class="tw"><table class="bernomor"><thead><tr><th>Mekanik</th><th class="r">Motor</th><th class="r">Rata-rata waktu</th><th class="r">Nilai jasa</th></tr></thead><tbody>${semua.map(({ m: x, h: y }) => `<tr class="row-click" tabindex="0" data-act="mk-pick" data-id="${esc(x.id)}"><td>${esc(x.nama)}</td><td class="r num">${y.unit}</td><td class="r num">${fmtDur(y.rata)}</td><td class="r num">${rp(y.jasa)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
   <div class="panel"><h3>Riwayat servis · ${esc(p.label)}</h3>
    ${h.list.length ? `<div class="tw"><table class="bernomor"><thead><tr><th>Tanggal</th><th>Motor</th><th>Jenis</th><th class="r">Part</th><th class="r">Jasa</th><th class="r">KSG</th><th class="r">Biaya lain</th><th class="r">Total</th></tr></thead><tbody>${h.list.map(t => { const x = nilaiKategori(t), total = x.part + x.jasa + x.ksg + x.biaya; return `<tr class="row-click" tabindex="0" data-act="mk-trx" data-no="${esc(t.no)}"><td class="num">${t.tgl.slice(5).replace('-', '/')}</td><td><span class="mono">${esc(t.nopol)}</span> <span class="small muted">${esc(t.tipe || '')}</span></td><td>${jenisBadge(t)}</td><td class="r num">${rp(x.part)}</td><td class="r num">${rp(x.jasa)}</td><td class="r num">${rp(x.ksg)}</td><td class="r num">${rp(x.biaya)}</td><td class="r num"><b>${rp(total)}</b></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty">Belum ada servis lunas di periode ini.</div>'}
   </div></div>`;
}

views.mekanik = renderMekanik;
Object.assign(actions, {
  'go-penghasilan': () => go('penghasilan'),
  'mk-per': el => { st.mekPeriode = el.dataset.p; mekLoadKey = ''; renderMekanik(); },
  'mk-date': () => { const a = $('#mk-dari')?.value, b = $('#mk-sampai')?.value; if (!a || !b || a > b) return; st.mekPeriode = 'custom'; st.mekDari = a; st.mekSampai = b; mekLoadKey = ''; renderMekanik(); },
  'mk-unit': detailUnit,
  'mk-detail': el => el.dataset.cat === 'total' ? detailUnit() : detailKategori(el.dataset.cat),
  'mk-trx': el => detailTrx(el.dataset.no),
  'mk-pick': el => { st.mekSel = el.dataset.id; renderMekanik(); }
});
changeHandlers.push(e => { if (e.target.id === 'mk-sel') { st.mekSel = e.target.value; renderMekanik(); } });
