// Tampilan bersama tracking & riwayat servis kendaraan: dipakai halaman cek servis konsumen
// dan menu Riwayat Kendaraan di aplikasi petugas.
import { esc, rp } from './util.js';
import { fmtDur } from './wo-common.js';
import { namaCabang, multiCabang } from './cabang.js';

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
    ${a.status === 'Ditunda' ? `<div class="note small"><b>Ditunda sementara</b>${a.alasanTunda ? ': ' + esc(a.alasanTunda) : ''}. Pengerjaan akan dilanjutkan.</div>` : ''}`;
}

/* ---- Ringkasan riwayat ---- */
export function ringkasRiwayat(list) {
  if (!list.length) return '';
  const total = list.reduce((a, t) => a + (t.total || 0), 0), kmAkhir = list.find(t => t.km)?.km;
  return `<div class="riw-sum"><div><b>${list.length}×</b><span>servis</span></div><div><b>${esc(tglPendek(list[0].tgl))}</b><span>terakhir</span></div>${kmAkhir ? `<div><b>${n(kmAkhir)}</b><span>km terakhir</span></div>` : ''}<div><b>${rp(total)}</b><span>total biaya</span></div></div>`;
}

/* ---- Satu kartu riwayat servis (bisa dibuka-tutup) ----
   opts.notaAttr: atribut tombol nota, mis. 'data-pdf="0"' (konsumen) atau 'data-act="rw-nota" data-no="SV-…"' (petugas)
   opts.petugas: tampilkan juga kasir & catatan internal */
export function kartuRiwayat(t, opts = {}) {
  const w = t.waktu || {}, ksg = t.jenisServis === 'KSG';
  const jenis = t.jenis === 'PART' ? 'Pembelian sparepart' : t.jenisServis === 'KSG' ? 'Servis KSG' + (t.ksgKe ? ' ke-' + t.ksgKe : '') : t.jenisServis === 'KSB' ? 'Servis KSB (berkala)' : 'Servis reguler';
  const info = [
    multiCabang() && t.cabang ? ['Cabang', esc(namaCabang(t.cabang))] : null,
    t.km ? ['Kilometer', n(t.km) + ' km'] : null,
    t.mekanik ? ['Mekanik', esc(t.mekanik)] : null,
    t.keluhan ? ['Keluhan', esc(t.keluhan)] : null,
    t.noKartu ? ['No. kartu', esc(t.noKartu)] : null,
    w.masuk ? ['Masuk', esc(tglID(w.masuk))] : null,
    w.selesai ? ['Selesai', esc(tglID(w.selesai))] : null,
    w.kerja ? ['Lama dikerjakan', fmtDur(w.kerja) + (w.tunda ? ` <span class="muted">(+ ditunda ${fmtDur(w.tunda)})</span>` : '')] : null,
    opts.petugas && t.kasir ? ['Kasir', esc(t.kasir)] : null
  ].filter(Boolean);
  const daftar = (judul, rows) => rows.length ? `<div class="riw-sec"><div class="riw-h">${judul}</div>${rows.map(([l, r]) => `<div class="riw-li"><span>${l}</span><span class="num">${r}</span></div>`).join('')}</div>` : '';
  const bayar = [t.cash ? 'Cash ' + rp(t.cash) : '', t.transfer ? 'Transfer ' + rp(t.transfer) : ''].filter(Boolean).join(' · ');
  return `<details class="riw-card" data-no="${esc(t.no)}"${opts.buka ? ' open' : ''}>
    <summary><div class="riw-top"><div><b>${esc(tglPendek(t.tgl))}</b> <span class="small muted">${esc(jamSaja(t.tgl))}</span><div class="small muted">${esc(jenis)} · <span class="mono">${esc(t.no)}</span></div></div><div class="riw-tot num">${rp(t.total)}</div></div>
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
