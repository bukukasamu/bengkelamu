// Menu Beranda: ringkasan hari ini, grafik 7 hari, antrian bengkel, stok menipis.
import { $, esc, rp, dkey, HARI, toast, errMsg } from './util.js';
import { S, st, STATUS, views, actions, go } from './state.js';
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
  const aktif = S.wo.filter(w => w.status !== 'Lunas');
  const seedBox = S.parts.length ? '' : `<div class="panel"><h3>Database part masih kosong</h3><p style="margin:0">Upload data part dari Excel (ekspor DMS Yamaha atau template sendiri), atau isi 20 part contoh untuk mencoba.</p><div class="row"><button class="btn pri" type="button" data-act="import-open">Import dari Excel</button><button class="btn" type="button" data-act="seed">Isi 20 part contoh</button></div></div>`;
  $('#view').innerHTML = `<div class="grid">${seedBox}
   <div class="tiles">
    <div class="tile"><span class="lbl">Omzet hari ini</span><span class="val">${rp(s.total)}</span><span class="sub">${s.n} transaksi</span></div>
    <div class="tile"><span class="lbl">Part terjual</span><span class="val">${s.qty} pcs</span><span class="sub">${rp(s.part)}</span></div>
    <div class="tile"><span class="lbl">Motor masuk bengkel</span><span class="val">${woToday.length} unit</span><span class="sub">${aktif.length} belum lunas</span></div>
    <div class="tile"><span class="lbl">Stok menipis</span><span class="val" style="color:${low.length ? 'var(--bad)' : 'inherit'}">${low.length} item</span><span class="sub">dari ${S.parts.length.toLocaleString('id-ID')} part</span></div>
   </div>
   <div class="panel"><div class="row spread"><h3>Omzet 7 hari terakhir</h3><div class="legend"><span><i style="background:var(--accent)"></i>Sparepart</span><span><i style="background:var(--jasa)"></i>Jasa servis</span></div></div>${chartSVG()}</div>
   <div class="grid g2">
    <div class="panel"><div class="row spread"><h3>Antrian bengkel</h3><button class="btn sm" data-act="go-servis" type="button">Buka Servis</button></div>
     ${aktif.length ? `<div class="tw"><table><thead><tr><th>Nopol</th><th>Motor</th><th>Mekanik</th><th>Status</th></tr></thead><tbody>${aktif.map(w => `<tr class="row-click" tabindex="0" data-act="open-wo" data-no="${esc(w.no)}"><td class="mono">${esc(w.nopol)}</td><td>${esc(w.tipe)}</td><td>${esc(w.mekanik || '–')}</td><td><span class="pill ${STATUS[w.status]}">${w.status}</span></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Tidak ada motor dalam antrian.</div>'}
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
actions['go-servis'] = () => go('servis');
actions['go-stok'] = () => go('stok');
actions['go-low'] = () => { st.stokLow = true; go('stok'); };
