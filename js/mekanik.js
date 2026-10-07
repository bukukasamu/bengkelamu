// Menu Performa Mekanik: pekerjaan aktif (mulai/selesai), jumlah motor, nilai jasa, komisi, estimasi gaji.
import { $, esc, rp, dkey } from './util.js';
import { S, st, views, refreshers, actions, changeHandlers, mekanikAktif, isRole } from './state.js';
import { trxIn } from './stats.js';
import { AKTIF, statusPill, jenisBadge } from './wo-common.js';

function periode() {
  const now = new Date();
  if (st.mekPeriode === 'lalu') {
    const a = new Date(now.getFullYear(), now.getMonth() - 1, 1), b = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: dkey(a), to: dkey(b), label: a.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) };
  }
  return { from: dkey(new Date(now.getFullYear(), now.getMonth(), 1)), to: dkey(now), label: now.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' }) };
}
const milik = (t, m) => t.jenis === 'SERVIS' && (t.mekanikId ? t.mekanikId === m.id : t.mekanik === m.nama);
const nilaiJasa = t => (t.jasa || []).reduce((a, j) => a + (j.harga || 0), 0) + (t.jasaKlaim || 0);

export function hitung(m, from, to) {
  const list = trxIn(from, to).filter(t => milik(t, m)).sort((a, b) => b.tgl.localeCompare(a.tgl));
  const jasa = list.reduce((a, t) => a + nilaiJasa(t), 0);
  const ksg = list.filter(t => t.jenisServis === 'KSG').length;
  const komisi = Math.round(jasa * (+m.komisi || 0) / 100), gaji = +m.gaji || 0;
  return { list, unit: list.length, jasa, ksg, komisi, gaji, total: gaji + komisi };
}

function myMekanik() {
  if (isRole('mekanik')) return S.mekanik.find(m => m.id === st.petugas.mekanikId) || S.mekanik.find(m => m.loginId && m.loginId === st.petugas.loginId);
  const l = mekanikAktif();
  return l.find(m => m.id === st.mekSel) || l[0];
}

function renderMekanik() {
  const m = myMekanik(), p = periode();
  if (!m) {
    $('#view').innerHTML = `<div class="panel"><div class="empty">${isRole('mekanik') ? 'Data mekanik untuk akun ini tidak ditemukan. Minta admin memeriksa di Master Data → Mekanik.' : 'Belum ada data mekanik. Tambahkan di Master Data → Mekanik.'}</div></div>`;
    return;
  }
  const h = hitung(m, p.from, p.to);
  const aktif = S.wo.filter(w => AKTIF.includes(w.status) && (w.mekanikId ? w.mekanikId === m.id : w.mekanik === m.nama));
  const semua = isRole('admin') ? mekanikAktif().map(x => ({ m: x, h: hitung(x, p.from, p.to) })) : [];
  $('#view').innerHTML = `<div class="grid">
   <div class="row spread">
    <div class="row">${isRole('admin') ? `<label class="f" for="mk-sel" style="flex-direction:row;align-items:center;gap:8px">Mekanik<select id="mk-sel" style="width:auto">${mekanikAktif().map(x => `<option value="${esc(x.id)}" ${x.id === m.id ? 'selected' : ''}>${esc(x.nama)}</option>`).join('')}</select></label>` : `<h2>${esc(m.nama)}</h2>`}</div>
    <div class="seg" role="group" aria-label="Periode">${[['ini', 'Bulan ini'], ['lalu', 'Bulan lalu']].map(([k, l]) => `<button type="button" data-act="mk-per" data-p="${k}" aria-pressed="${k === st.mekPeriode}">${l}</button>`).join('')}</div>
   </div>
   <div class="tiles t5">
    <div class="tile"><span class="lbl">Motor selesai</span><span class="val">${h.unit}</span><span class="sub">${p.label}${h.ksg ? ' · ' + h.ksg + ' KSG' : ''}</span></div>
    <div class="tile"><span class="lbl">Nilai jasa</span><span class="val">${rp(h.jasa)}</span><span class="sub">klaim KSG pakai tarif main dealer</span></div>
    <div class="tile"><span class="lbl">Komisi ${+m.komisi || 0}%</span><span class="val">${rp(h.komisi)}</span><span class="sub">dari nilai jasa</span></div>
    <div class="tile"><span class="lbl">Gaji pokok</span><span class="val">${rp(h.gaji)}</span><span class="sub">per bulan</span></div>
    <div class="tile"><span class="lbl">Estimasi gaji</span><span class="val" style="color:var(--good)">${rp(h.total)}</span><span class="sub">gaji pokok + komisi</span></div>
   </div>
   <div class="panel"><h3>Pekerjaan saat ini</h3>
    ${aktif.length ? `<div class="tw"><table><thead><tr><th>WO</th><th>Motor</th><th>Keluhan</th><th>Status</th><th></th></tr></thead><tbody>${aktif.map(w => `<tr><td class="mono">${esc(w.no)}<br>${jenisBadge(w)}</td><td><span class="mono">${esc(w.nopol)}</span><br><span class="small muted">${esc(w.tipe)}</span></td><td class="small">${esc(w.keluhan || '–')}${w.catatanPart ? `<br><span class="muted">Part: ${esc(w.catatanPart)}</span>` : ''}</td><td>${statusPill(w.status)}</td><td class="small muted">${w.status === 'Dikerjakan' ? 'Lapor ke kasir bila selesai atau harus lanjut lama' : w.status === 'Ditunda' ? esc(w.alasanTunda || 'Ditunda') : w.status === 'Selesai' ? 'Menunggu pembayaran' : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Tidak ada pekerjaan aktif.</div>'}
   </div>
   ${semua.length > 1 ? `<div class="panel"><h3>Semua mekanik · ${esc(p.label)}</h3><div class="tw"><table><thead><tr><th>Mekanik</th><th class="r">Motor</th><th class="r">Nilai jasa</th><th class="r">Komisi</th><th class="r">Estimasi gaji</th></tr></thead><tbody>${semua.map(({ m: x, h: y }) => `<tr class="row-click" tabindex="0" data-act="mk-pick" data-id="${esc(x.id)}"><td>${esc(x.nama)}</td><td class="r num">${y.unit}</td><td class="r num">${rp(y.jasa)}</td><td class="r num">${rp(y.komisi)}</td><td class="r num">${rp(y.total)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
   <div class="panel"><h3>Riwayat servis · ${esc(p.label)}</h3>
    ${h.list.length ? `<div class="tw"><table><thead><tr><th>Tanggal</th><th>Nota</th><th>Motor</th><th>Jenis</th><th class="r">Nilai jasa</th></tr></thead><tbody>${h.list.map(t => `<tr class="row-click" tabindex="0" data-act="nota" data-no="${esc(t.no)}"><td class="num">${t.tgl.slice(5).replace('-', '/')}</td><td class="mono">${esc(t.no)}</td><td class="mono">${esc(t.nopol)}</td><td>${jenisBadge(t)}</td><td class="r num">${rp(nilaiJasa(t))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Belum ada servis lunas di periode ini.</div>'}
   </div></div>`;
}

views.mekanik = renderMekanik;
Object.assign(actions, {
  'mk-per': el => { st.mekPeriode = el.dataset.p; renderMekanik(); },
  'mk-pick': el => { st.mekSel = el.dataset.id; renderMekanik(); }
});
changeHandlers.push(e => { if (e.target.id === 'mk-sel') { st.mekSel = e.target.value; renderMekanik(); } });
