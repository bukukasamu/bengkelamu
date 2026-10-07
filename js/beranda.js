// Menu Beranda: ringkasan hari ini, grafik 7 hari, antrian bengkel, stok menipis.
import { $, esc, rp, dkey, HARI, toast, errMsg, modal } from './util.js';
import { S, st, views, actions, go, can, mekanikAktif } from './state.js';
import { AKTIF, statusPill, jenisBadge, mekanikNama, sibukOleh, durasi, fmtDur } from './wo-common.js';
import { trxIn, sums } from './stats.js';
import { db, doc, writeBatch } from './firebase.js';
import { SEED_PARTS } from './seed.js';

function chartSVG() {
  const days = [], now = new Date();
  for (let b = 6; b >= 0; b--) {
    const d = new Date(now); d.setDate(d.getDate() - b);
    const s = sums(trxIn(dkey(d), dkey(d)));
    days.push({ lbl: b === 0 ? 'Hari ini' : HARI[d.getDay()] + ' ' + d.getDate(), part: s.part, jasa: s.jasa });
  }
  const max = Math.max(...days.map(d => d.part + d.jasa), 1);
  const step = [100000, 250000, 500000, 1000000, 2000000, 5000000, 10000000, 25000000].find(s => s * 4 >= max) || 50000000, top = step * 4;
  const W = 640, H = 230, L = 58, R = 10, T = 12, B = 30, cw = (W - L - R) / 7, bw = Math.min(46, cw * .55);
  const y = v => T + (H - T - B) * (1 - v / top);
  let g = '';
  for (let i = 0; i <= 4; i++) {
    const v = step * i;
    g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v >= 1e6 ? (v / 1e6).toLocaleString('id-ID') + ' jt' : v / 1000 + ' rb'}</text>`;
  }
  days.forEach((d, i) => {
    const x = L + cw * i + (cw - bw) / 2, hp = y(0) - y(d.part), hj = y(0) - y(d.jasa);
    g += `<rect x="${x}" y="${y(d.part)}" width="${bw}" height="${hp}" fill="var(--accent)" rx="2"><title>${d.lbl}: part ${rp(d.part)}</title></rect>`;
    g += `<rect x="${x}" y="${y(d.part) - hj}" width="${bw}" height="${hj}" fill="var(--jasa)" rx="2"><title>${d.lbl}: jasa ${rp(d.jasa)}</title></rect>`;
    g += `<text x="${x + bw / 2}" y="${H - 10}" text-anchor="middle"${i === 6 ? ' style="fill:var(--ink);font-weight:500"' : ''}>${d.lbl}</text>`;
  });
  return `<div style="overflow-x:auto"><svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" style="min-width:420px;display:block" role="img" aria-label="Omzet 7 hari terakhir">${g}</svg></div>`;
}

function renderBeranda() {
  const t = dkey(new Date()), s = sums(trxIn(t, t));
  const low = S.parts.filter(p => p.min > 0 && p.stok <= p.min);
  const woToday = S.wo.filter(w => w.tgl.slice(0, 10) === t);
  const aktif = S.wo.filter(w => AKTIF.includes(w.status));
  const seedBox = S.parts.length || !can('stok') ? '' : `<div class="panel"><h3>Database part masih kosong</h3><p style="margin:0">Upload data part dari Excel (ekspor DMS Yamaha atau template sendiri), atau isi 20 part contoh untuk mencoba.</p><div class="row">${can('stok') ? '<button class="btn pri" type="button" data-act="import-open">Import dari Excel</button>' : ''}<button class="btn" type="button" data-act="seed">Isi 20 part contoh</button></div></div>`;
  $('#view').innerHTML = `<div class="grid">${seedBox}
   <div class="tiles">
    <button class="tile click" type="button" data-act="hr-trx"><span class="lbl">Omzet hari ini</span><span class="val">${rp(s.total)}</span><span class="sub">${s.n} transaksi · lihat nota</span></button>
    <button class="tile click" type="button" data-act="hr-part"><span class="lbl">Part terjual</span><span class="val">${s.qty} pcs</span><span class="sub">${rp(s.part)} · lihat item</span></button>
    <button class="tile click" type="button" data-act="hr-wo"><span class="lbl">Motor masuk bengkel</span><span class="val">${woToday.length} unit</span><span class="sub">${aktif.length} belum lunas · lihat daftar</span></button>
    <button class="tile click" type="button" data-act="go-low"><span class="lbl">Stok menipis</span><span class="val" style="color:${low.length ? 'var(--bad)' : 'inherit'}">${low.length} item</span><span class="sub">dari ${S.parts.length.toLocaleString('id-ID')} part</span></button>
   </div>
   <div class="panel"><div class="row spread"><h3>Omzet 7 hari terakhir</h3><div class="legend"><span><i style="background:var(--accent)"></i>Sparepart</span><span><i style="background:var(--jasa)"></i>Jasa servis</span></div></div>${chartSVG()}</div>
   <div class="panel"><h3>Status mekanik</h3><div class="mek-list">${mekanikAktif().map(m => { const w = sibukOleh(m); return `<div class="mek${w ? ' busy' : ''}"><span>${esc(m.nama)}</span>${w ? `<span class="small">mengerjakan <span class="mono">${esc(w.nopol)}</span> <span class="pill p-info">Sibuk</span></span>` : '<span class="pill p-good">Kosong</span>'}</div>`; }).join('') || '<div class="small muted">Belum ada data mekanik.</div>'}</div></div>
   <div class="grid g2">
    <div class="panel"><div class="row spread"><h3>Antrian bengkel</h3>${can('registrasi') ? '<button class="btn sm" data-act="go-registrasi" type="button">Registrasi</button>' : ''}</div>
     ${aktif.length ? `<div class="tw"><table><thead><tr><th>Nopol</th><th>Motor</th><th>Mekanik</th><th>Status</th></tr></thead><tbody>${aktif.map(w => `<tr><td class="mono">${esc(w.nopol)}<br>${jenisBadge(w)}</td><td>${esc(w.tipe)}</td><td>${esc(mekanikNama(w) || '–')}</td><td>${statusPill(w.status)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Tidak ada motor dalam antrian.</div>'}
    </div>
    <div class="panel"><div class="row spread"><h3>Perlu dipesan ulang</h3><button class="btn sm" data-act="go-low" type="button">Lihat semua</button></div>
     ${low.length ? `<div class="tw"><table><thead><tr><th>Kode</th><th>Part</th><th class="r">Stok</th><th class="r">Min</th></tr></thead><tbody>${low.slice(0, 15).map(p => `<tr><td class="mono">${esc(p.kode)}</td><td>${esc(p.nama)}</td><td class="r"><span class="pill p-bad">${p.stok}</span></td><td class="r num">${p.min}</td></tr>`).join('')}</tbody></table></div>${low.length > 15 ? `<p class="small muted" style="margin:0">+${low.length - 15} part lainnya</p>` : ''}` : '<div class="empty">Semua stok aman.</div>'}
    </div>
   </div></div>`;
}

async function seedParts() {
  if (S.parts.length || st.saving) return; st.saving = true;
  try { const b = writeBatch(db); SEED_PARTS.forEach(p => b.set(doc(db, 'parts', p.kode), p)); await b.commit(); toast('20 part contoh ditambahkan'); }
  catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

views.beranda = renderBeranda;
actions['seed'] = seedParts;
actions['go-registrasi'] = () => go('registrasi');

/* ---- Rincian hari ini (klik kotak di beranda) ---- */
const hariIni = () => { const t = dkey(new Date()); return trxIn(t, t).sort((a, b) => b.tgl.localeCompare(a.tgl)); };
const tutup = '<div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-close="1">Tutup</button></div>';
// Item sparepart terjual hari ini, digabung per part (servis + penjualan langsung)
actions['hr-part'] = () => {
  const g = {};
  hariIni().forEach(t => t.items.forEach(x => { const r = g[x.kode] = g[x.kode] || { kode: x.kode, nama: x.nama, qty: 0, nilai: 0, nota: [] }; r.qty += x.qty; r.nilai += x.qty * x.harga; r.nota.push(t.no); }));
  const rows = Object.values(g).sort((a, b) => b.qty - a.qty), tq = rows.reduce((a, r) => a + r.qty, 0), tn = rows.reduce((a, r) => a + r.nilai, 0);
  modal(`<div class="row spread"><h2>Part terjual hari ini</h2><span class="small muted">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</span></div>
   ${rows.length ? `<div class="tw"><table><thead><tr><th>Part</th><th class="r">Qty</th><th class="r">Nilai</th><th class="r">Stok kini</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.nama)}<br><span class="small muted mono">${esc(r.kode)}</span> <span class="small muted">· ${[...new Set(r.nota)].map(esc).join(', ')}</span></td><td class="r num">${r.qty}</td><td class="r num">${rp(r.nilai)}</td><td class="r num">${S.map.get(r.kode)?.stok ?? '–'}</td></tr>`).join('')}<tr><td><b>Total</b></td><td class="r num"><b>${tq}</b></td><td class="r num"><b>${rp(tn)}</b></td><td></td></tr></tbody></table></div>` : '<div class="empty">Belum ada part terjual hari ini.</div>'}${tutup}`, 'wide');
};
// Daftar nota hari ini; klik untuk membuka nota
actions['hr-trx'] = () => {
  const l = hariIni();
  modal(`<h2>Transaksi hari ini</h2>
   ${l.length ? `<div class="tw"><table><thead><tr><th>Nota</th><th>Jam</th><th>Pelanggan</th><th>Item</th><th class="r">Total</th></tr></thead><tbody>${l.map(t => `<tr class="row-click" tabindex="0" data-act="nota" data-no="${esc(t.no)}"><td class="mono small">${esc(t.no)}</td><td class="num">${esc(t.tgl.slice(11, 16))}</td><td>${esc(t.pelanggan)}${t.nopol ? `<br><span class="small muted mono">${esc(t.nopol)}</span>` : ''}</td><td class="small">${t.items.map(x => esc(x.nama) + ' ×' + x.qty).join(', ') || (t.jasa || []).map(j => esc(j.nama)).join(', ')}</td><td class="r num">${rp(t.total)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Belum ada transaksi hari ini.</div>'}${tutup}`, 'wide');
};
// Motor masuk hari ini + yang masih di bengkel
actions['hr-wo'] = () => {
  const t = dkey(new Date()), l = S.wo.filter(w => w.tgl.slice(0, 10) === t || AKTIF.includes(w.status)).reverse();
  modal(`<h2>Motor di bengkel hari ini</h2>
   ${l.length ? `<div class="tw"><table><thead><tr><th>Nopol</th><th>Motor</th><th>Mekanik</th><th>Status</th><th class="r">Lama dikerjakan</th></tr></thead><tbody>${l.map(w => `<tr><td class="mono">${esc(w.nopol)}<br>${jenisBadge(w)}</td><td>${esc(w.tipe)}<br><span class="small muted">${esc(w.nama || '')}</span></td><td>${esc(mekanikNama(w) || '–')}</td><td>${statusPill(w.status)}</td><td class="r num">${fmtDur(durasi(w)?.kerja ?? null)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Belum ada motor masuk hari ini.</div>'}${tutup}`, 'wide');
};
actions['go-stok'] = () => go('stok');
actions['go-low'] = () => {
  if (can('stok')) { st.stokLow = true; go('stok'); return; }
  const low = S.parts.filter(p => p.min > 0 && p.stok <= p.min);
  modal(`<h2>Stok menipis</h2>${low.length ? `<div class="tw"><table><thead><tr><th>Part</th><th class="r">Stok</th><th class="r">Min</th></tr></thead><tbody>${low.map(p => `<tr><td>${esc(p.nama)}<br><span class="small muted mono">${esc(p.kode)}</span></td><td class="r"><span class="pill p-bad">${p.stok}</span></td><td class="r num">${p.min}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Semua stok aman.</div>'}<div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-close="1">Tutup</button></div>`, 'wide');
};
