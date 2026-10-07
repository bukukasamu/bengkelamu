// Menu Laporan: omzet, laba kotor, part terlaris, kinerja mekanik, daftar nota.
import { $, esc, rp, dkey } from './util.js';
import { st, views, actions } from './state.js';
import { trxIn, sums } from './stats.js';

function renderLaporan() {
  const now = new Date(); let from = dkey(now); const to = dkey(now);
  if (st.lapRange === '7') { const d = new Date(now); d.setDate(d.getDate() - 6); from = dkey(d); }
  if (st.lapRange === 'bulan') from = dkey(new Date(now.getFullYear(), now.getMonth(), 1));
  const list = trxIn(from, to).sort((a, b) => b.tgl.localeCompare(a.tgl)), s = sums(list);
  const top = {};
  list.forEach(t => t.items.forEach(x => { top[x.kode] = top[x.kode] || { nama: x.nama, qty: 0 }; top[x.kode].qty += x.qty; }));
  const topL = Object.entries(top).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5), mx = topL.length ? topL[0][1].qty : 1;
  const mek = {}; list.filter(t => t.mekanik).forEach(t => { mek[t.mekanik] = (mek[t.mekanik] || 0) + 1; });
  $('#view').innerHTML = `<div class="grid">
   <div class="row spread"><h2>Laporan penjualan</h2><div class="seg" role="group" aria-label="Periode">${[['hari', 'Hari ini'], ['7', '7 hari'], ['bulan', 'Bulan ini']].map(([k, l]) => `<button type="button" data-act="lap" data-r="${k}" aria-pressed="${k === st.lapRange}">${l}</button>`).join('')}</div></div>
   <div class="tiles">
    <div class="tile"><span class="lbl">Total omzet</span><span class="val">${rp(s.total)}</span><span class="sub">${s.n} transaksi</span></div>
    <div class="tile"><span class="lbl">Penjualan part</span><span class="val">${rp(s.part)}</span><span class="sub">${s.qty} pcs</span></div>
    <div class="tile"><span class="lbl">Jasa servis</span><span class="val">${rp(s.jasa)}</span><span class="sub">diskon ${rp(s.dis)}</span></div>
    <div class="tile"><span class="lbl">Laba kotor</span><span class="val" style="color:var(--good)">${rp(s.laba)}</span><span class="sub">margin part + jasa − diskon</span></div>
   </div>
   <div class="grid g2">
    <div class="panel"><h3>Part terlaris</h3>${topL.length ? topL.map(([k, v]) => `<div style="display:flex;flex-direction:column;gap:3px"><div class="row spread small"><span>${esc(v.nama)}</span><span class="num">${v.qty} pcs</span></div><div style="height:7px;background:var(--panel-2);border-radius:4px;overflow:hidden"><div style="height:100%;width:${v.qty / mx * 100}%;background:var(--accent)"></div></div></div>`).join('') : '<div class="empty">Belum ada penjualan part.</div>'}</div>
    <div class="panel"><h3>Motor ditangani per mekanik</h3>${Object.keys(mek).length ? `<div class="tw"><table><tbody>${Object.entries(mek).sort((a, b) => b[1] - a[1]).map(([m, n]) => `<tr><td>${esc(m)}</td><td class="r num">${n} unit</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Belum ada servis lunas di periode ini.</div>'}</div>
   </div>
   <div class="panel"><h3>Daftar transaksi</h3><div class="tw"><table><thead><tr><th>No. nota</th><th>Waktu</th><th>Jenis</th><th>Pelanggan</th><th>Kasir</th><th class="r">Total</th></tr></thead><tbody>${list.map(t => `<tr class="row-click" tabindex="0" data-act="nota" data-no="${esc(t.no)}"><td class="mono">${esc(t.no)}</td><td class="num">${t.tgl.slice(5).replace('-', '/')}</td><td><span class="pill ${t.jenis === 'SERVIS' ? 'p-info' : 'p-good'}">${t.jenis === 'SERVIS' ? 'Servis' : 'Part'}</span></td><td>${esc(t.pelanggan)}${t.nopol ? ` <span class="small muted mono">${esc(t.nopol)}</span>` : ''}</td><td class="small">${esc(t.kasir || '')}</td><td class="r num">${rp(t.total)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Tidak ada transaksi.</td></tr>'}</tbody></table></div></div>
  </div>`;
}

views.laporan = renderLaporan;
actions['lap'] = el => { st.lapRange = el.dataset.r; renderLaporan(); };
