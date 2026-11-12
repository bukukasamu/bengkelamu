// Tampilan bersama tracking & riwayat servis kendaraan: dipakai halaman cek servis konsumen
// dan menu Riwayat Kendaraan di aplikasi petugas.
import { esc, rp } from './util.js';
import { fmtDur } from './wo-common.js';
import { namaCabang, CABANG_UTAMA } from './cabang.js';

export const tglID = t => t ? new Date(String(t).replace(' ', 'T')).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
export const tglPendek = t => t ? new Date(String(t).replace(' ', 'T')).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const jamSaja = t => t ? String(t).slice(11, 16) : '';
const n = x => Math.round(x || 0).toLocaleString('id-ID');

/* ---- Tracking servis yang sedang berjalan ---- */
const STEPS = [['Antri', 'Diterima'], ['Dikerjakan', 'Dikerjakan'], ['Selesai', 'Selesai'], ['Lunas', 'Diambil / lunas']];
export function stepperHTML(a) {
  const last = { Antri: a.tgl }; (a.log || []).forEach(l => { last[l.s] = l.t; });
  const cur = STEPS.findIndex(s => s[0] === a.status);
  return `<ol class="steps">${STEPS.map(([s, label], i) => `<li class="${i < cur || (i === cur && a.status === 'Lunas') ? 'done' : i === cur ? 'now' : ''}"><span class="dot"></span><b>${label}</b><span class="small muted">${esc(tglID(last[s]))}</span></li>`).join('')}</ol>
    ${a.status === 'Ditunda' ? `<div class="tunda-box"><b>⏸ Ditunda sementara</b>${a.alasanTunda ? ': ' + esc(a.alasanTunda) : ''}<div class="small muted">Sejak ${esc(tglID(a.tglTunda || [...(a.log || [])].reverse().find(l => l.s === 'Ditunda')?.t))}. Pengerjaan akan dilanjutkan.</div></div>` : ''}
    ${riwayatTunda(a.log, a.status === 'Ditunda')}`;
}
// Daftar penundaan sebelumnya (yang sudah dilanjutkan) beserta alasannya
function riwayatTunda(log, kecualiTerakhir) {
  let l = (log || []).filter(x => x.s === 'Ditunda');
  if (kecualiTerakhir) l = l.slice(0, -1);
  return l.length ? `<div class="small muted">Riwayat penundaan: ${l.map(x => `${esc(tglID(x.t))}${x.a ? ' — ' + esc(x.a) : ''}`).join('; ')}</div>` : '';
}
export const tundaTeks = t => (t.tunda || []).map(x => tglPendek(x.t) + (x.a ? ': ' + x.a : '')).join('; ');

/* ---- Ringkasan riwayat ---- */
export function ringkasRiwayat(list) {
  if (!list.length) return '';
  const total = list.reduce((a, t) => a + (t.total || 0), 0), kmAkhir = list.find(t => t.km)?.km;
  return `<div class="riw-sum"><div><b>${list.length}×</b><span>servis</span></div><div><b>${esc(tglPendek(list[0].tgl))}</b><span>terakhir</span></div>${kmAkhir ? `<div><b>${n(kmAkhir)}</b><span>km terakhir</span></div>` : ''}<div><b>${rp(total)}</b><span>total biaya</span></div></div>`;
}

/* ---- Satu kartu riwayat servis (bisa dibuka-tutup) ----
   opts.notaAttr: atribut tombol nota, mis. 'data-pdf="0"' (konsumen) atau 'data-act="rw-nota" data-no="SV-…"' (petugas)
   opts.petugas: tampilkan juga kasir & catatan internal */
// Tempat servis: nama cabang (nota lama tanpa kode cabang = cabang utama)
export const lokasiServis = t => namaCabang(t.cabang || CABANG_UTAMA);
export function kartuRiwayat(t, opts = {}) {
  const w = t.waktu || {}, ksg = t.jenisServis === 'KSG';
  const jenis = t.jenis === 'PART' ? 'Pembelian sparepart' : t.jenisServis === 'KSG' ? 'Servis KSG' + (t.ksgKe ? ' ke-' + t.ksgKe : '') : t.jenisServis === 'KSB' ? 'Servis KSB (berkala)' : 'Servis reguler';
  const info = [
    ['Bengkel', esc(lokasiServis(t))],
    t.km ? ['Kilometer', n(t.km) + ' km'] : null,
    t.mekanik ? ['Mekanik', esc(t.mekanik)] : null,
    t.keluhan ? ['Keluhan', esc(t.keluhan)] : null,
    t.noKartu ? ['No. kartu', esc(t.noKartu)] : null,
    w.masuk ? ['Masuk', esc(tglID(w.masuk))] : null,
    w.selesai ? ['Selesai', esc(tglID(w.selesai))] : null,
    w.kerja ? ['Lama dikerjakan', fmtDur(w.kerja) + (w.tunda ? ` <span class="muted">(+ ditunda ${fmtDur(w.tunda)})</span>` : '')] : null,
    (t.tunda || []).length ? ['Pernah ditunda', esc(tundaTeks(t))] : null,
    opts.petugas && t.kasir ? ['Kasir', esc(t.kasir)] : null
  ].filter(Boolean);
  const daftar = (judul, rows) => rows.length ? `<div class="riw-sec"><div class="riw-h">${judul}</div>${rows.map(([l, r]) => `<div class="riw-li"><span>${l}</span><span class="num">${r}</span></div>`).join('')}</div>` : '';
  const bayar = [t.cash ? 'Cash ' + rp(t.cash) : '', t.transfer ? 'Transfer ' + rp(t.transfer) : ''].filter(Boolean).join(' · ');
  return `<details class="riw-card" data-no="${esc(t.no)}"${opts.buka ? ' open' : ''}>
    <summary><div class="riw-top"><div><b>${esc(tglPendek(t.tgl))}</b> <span class="small muted">${esc(jamSaja(t.tgl))}</span><div class="small muted">${esc(jenis)} · <span class="riw-cab">📍 ${esc(lokasiServis(t))}</span> · <span class="mono">${esc(t.no)}</span></div></div><div class="riw-tot num">${rp(t.total)}</div></div>
      <div class="small riw-ringkas">${esc([(t.jasa || []).map(j => j.nama).join(', '), (t.items || []).map(x => x.nama).join(', ')].filter(Boolean).join(' · ') || '–')}</div></summary>
    <div class="riw-body">
      ${info.length ? `<div class="riw-info">${info.map(([l, v]) => `<span class="muted">${l}</span><span>${v}</span>`).join('')}</div>` : ''}
      ${daftar('Jasa', (t.jasa || []).map(j => [esc(j.nama), ksg ? 'gratis (KSG)' : rp(j.harga)]))}
      ${daftar('Sparepart', (t.items || []).map(x => [`${esc(x.nama)} <span class="muted">× ${x.qty}</span>`, rp(x.qty * x.harga)]))}
      ${daftar('Biaya lain', (t.biaya || []).map(b => [esc(b.ket), rp(b.jumlah)]))}
      <div class="riw-sec">${t.diskon ? `<div class="riw-li"><span>Diskon</span><span class="num">−${rp(t.diskon)}</span></div>` : ''}<div class="riw-li riw-grand"><span>Total</span><span class="num">${rp(t.total)}</span></div>${bayar ? `<div class="riw-li small muted"><span>Dibayar</span><span>${esc(bayar)}</span></div>` : ''}</div>
      ${opts.notaAttr ? `<div class="row" style="justify-content:flex-end"><button class="btn sm" type="button" ${opts.notaAttr}>Lihat nota</button></div>` : ''}
    </div>
  </details>`;
}

/* ---- Riwayat servis dalam bentuk tabel (menu Riwayat Kendaraan petugas) ----
   Satu baris per servis, seperti lembar Excel, supaya hemat tempat. Klik baris = rincian. */
export function tabelRiwayat(list, opts = {}) {
  const buka = opts.buka || new Set();
  const jenisPendek = t => t.jenis === 'PART' ? 'Part' : t.jenisServis === 'KSG' ? 'KSG' + (t.ksgKe ? '-' + t.ksgKe : '') : t.jenisServis === 'KSB' ? 'KSB' : 'Reguler';
  const rinci = t => {
    const ksg = t.jenisServis === 'KSG';
    const baris = [
      ...(t.jasa || []).map(j => ['Jasa', esc(j.nama), ksg ? 'gratis (KSG)' : rp(j.harga)]),
      ...(t.items || []).map(x => ['Part', `${esc(x.nama)} <span class="muted">× ${x.qty}</span>`, rp(x.qty * x.harga)]),
      ...(t.biaya || []).map(b => ['Biaya lain', esc(b.ket), rp(b.jumlah)]),
      ...(t.diskon ? [['Diskon', '', '−' + rp(t.diskon)]] : [])
    ];
    const w = t.waktu || {};
    const ket = [w.masuk ? 'Masuk ' + tglID(w.masuk) : '', w.selesai ? 'selesai ' + tglID(w.selesai) : '', t.kasir ? 'kasir ' + t.kasir : '', t.cash ? 'cash ' + rp(t.cash) : '', t.transfer ? 'transfer ' + rp(t.transfer) : ''].filter(Boolean).join(' · ');
    const perMek = t.kerjaMekanik ? Object.entries(t.kerjaMekanik).map(([nm, m]) => nm + ' ' + fmtDur(m)).join(', ') : '';
    return `<table class="rw-tabel"><tbody>${baris.map(([a, b, c]) => `<tr><td class="small muted" style="width:80px">${a}</td><td>${b}</td><td class="r num">${c}</td></tr>`).join('')}<tr><td></td><td><b>Total</b></td><td class="r num"><b>${rp(t.total)}</b></td></tr></tbody></table>
      <div class="small muted" style="margin-top:4px">${esc(ket)}${perMek ? ' · lama kerja per mekanik: ' + esc(perMek) : ''}</div>
      ${(t.tunda || []).length ? `<div class="small wo-tunda">Pernah ditunda: ${esc(tundaTeks(t))}</div>` : ''}
      ${opts.notaAttr ? `<div class="row" style="justify-content:flex-end;margin-top:4px"><button class="btn sm" type="button" ${opts.notaAttr(t, list.indexOf(t))}>Lihat nota</button></div>` : ''}`;
  };
  return `<div class="tw"><table class="rw-tabel"><thead><tr><th>#</th><th>Tanggal</th><th>Nota</th><th>Bengkel</th><th>Jenis</th><th class="r">KM</th><th>Mekanik</th><th>Keluhan</th><th>Jasa</th><th>Sparepart</th><th class="r">Lama</th><th class="r">Total</th></tr></thead><tbody>
    ${list.map((t, i) => {
      const w = t.waktu || {}, b = buka.has(t.no);
      return `<tr class="rw-buka" data-act="rw-baris" data-no="${esc(t.no)}" tabindex="0" aria-expanded="${b}" title="Klik untuk rincian">
        <td class="num">${list.length - i}</td><td style="white-space:nowrap">${esc(tglPendek(t.tgl))}<div class="rw-det">${esc(jamSaja(t.tgl))}</div></td>
        <td class="mono small">${esc(t.no)}</td><td>${esc(lokasiServis(t))}</td><td>${esc(jenisPendek(t))}${t.noKartu ? `<div class="rw-det">${esc(t.noKartu)}</div>` : ''}</td>
        <td class="r num">${t.km ? n(t.km) : ''}</td><td>${esc(t.mekanik || '')}${t.kerjaMekanik ? `<div class="rw-det">bersama ${esc(Object.keys(t.kerjaMekanik).filter(x => x !== t.mekanik).join(', '))}</div>` : ''}</td><td>${esc(t.keluhan || '')}</td>
        <td>${esc((t.jasa || []).map(j => j.nama).join(', '))}</td>
        <td>${esc((t.items || []).map(x => x.nama + ' ×' + x.qty).join(', '))}</td>
        <td class="r">${w.kerja ? fmtDur(w.kerja) : ''}${(t.tunda || []).length ? `<div class="wo-tunda" title="${esc(tundaTeks(t))}">⏸ ditunda ${t.tunda.length}×</div>` : ''}</td>
        <td class="r num"><b>${rp(t.total)}</b></td></tr>
        ${b ? `<tr class="rw-detail"><td colspan="12">${rinci(t)}</td></tr>` : ''}`;
    }).join('')}
  </tbody></table></div>`;
}
