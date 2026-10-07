// Halaman cek servis untuk konsumen (cek.html): tanpa login, cukup no. polisi + no. HP.
// Data diambil dari dokumen pantau/{SHA-256(NOPOL|62HP)} yang diperbarui otomatis oleh bengkel.
import { db, doc, getDoc } from './firebase.js';
import { $, esc, rp, waNumber } from './util.js';
import { loadBrand, gearsSVG } from './brand.js';
import { pantauKey, durasi, fmtDur } from './wo-common.js';
import { APP_NAME } from './config.js';

const STEPS = [['Antri', 'Diterima'], ['Dikerjakan', 'Dikerjakan'], ['Selesai', 'Selesai'], ['Lunas', 'Diambil / lunas']];
const tgl = t => t ? new Date(String(t).replace(' ', 'T')).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
let data = null;

function showErr(m) { $('#cek-err').hidden = !m; $('#cek-err').textContent = m || ''; }
function busy(b) { const btn = $('#cek-btn'); btn.disabled = b; btn.innerHTML = b ? gearsSVG() + 'Mencari…' : 'Cek status'; }

function stepper(a) {
  const last = { Antri: a.tgl }; (a.log || []).forEach(l => { last[l.s] = l.t; });
  const cur = STEPS.findIndex(s => s[0] === a.status);
  return `<ol class="steps">${STEPS.map(([s, label], i) => `<li class="${i < cur || (i === cur && a.status === 'Lunas') ? 'done' : i === cur ? 'now' : ''}"><span class="dot"></span><b>${label}</b><span class="small muted">${esc(tgl(last[s]))}</span></li>`).join('')}</ol>
    ${a.status === 'Ditunda' ? `<div class="note small"><b>Ditunda sementara</b>${a.alasanTunda ? ': ' + esc(a.alasanTunda) : ''}. Pengerjaan akan dilanjutkan.</div>` : ''}`;
}

function render() {
  const d = data, a = d.aktif;
  $('#cek-result').innerHTML = `<div class="cek-card">
    <div class="row spread"><div><div class="mono cek-nopol">${esc(d.nopol)}</div><div class="muted small">${esc(d.tipe || '')}${d.nama ? ' · ' + esc(d.nama) : ''}</div></div><button class="btn sm" type="button" id="cek-reset">Cek kendaraan lain</button></div>
    ${a ? `<h3>Servis saat ini · ${esc(a.no)}</h3>
      ${stepper(a)}
      <div class="totals small">
        <span class="muted">Masuk</span><span>${esc(tgl(a.tgl))}</span>
        ${a.mekanik ? `<span class="muted">Mekanik</span><span>${esc(a.mekanik)}</span>` : ''}
        ${a.jenisServis && a.jenisServis !== 'Reguler' ? `<span class="muted">Jenis servis</span><span>${esc(a.jenisServis)}${a.ksgKe ? ' ke-' + esc(a.ksgKe) : ''}</span>` : ''}
        ${a.keluhan ? `<span class="muted">Keluhan</span><span>${esc(a.keluhan)}</span>` : ''}
        ${a.jasa?.length ? `<span class="muted">Jasa</span><span>${a.jasa.map(esc).join(', ')}</span>` : ''}
        ${a.parts?.length ? `<span class="muted">Sparepart</span><span>${a.parts.map(p => esc(p.nama) + ' ×' + p.qty).join(', ')}</span>` : ''}
        ${a.estimasi ? `<span class="muted">Estimasi biaya</span><span class="num"><b>${rp(a.estimasi)}</b></span>` : ''}
        ${durasi(a)?.kerja ? `<span class="muted">Sudah dikerjakan</span><span>${fmtDur(durasi(a).kerja)}</span>` : ''}
      </div>
      <p class="small muted" style="margin:0">Estimasi dapat berubah bila ada tambahan sparepart atau jasa.</p>` : '<div class="note small">Tidak ada servis yang sedang berjalan untuk kendaraan ini.</div>'}
    <h3>Riwayat servis</h3>
    ${(d.riwayat || []).length ? `<div class="riw">${d.riwayat.map((t, i) => `<div class="riw-row"><div><b>${esc(tgl(t.tgl))}</b><div class="small muted"><span class="mono">${esc(t.no)}</span>${t.km ? ' · ' + esc(t.km) + ' km' : ''}</div><div class="small">${esc((t.jasa || []).map(j => j.nama).join(', ') || t.jenisServis || '')}${t.items?.length ? (t.jasa?.length ? ' · ' : '') + esc(t.items.map(x => x.nama).join(', ')) : ''}</div></div><div class="riw-r"><span class="num"><b>${rp(t.total)}</b></span><button class="btn sm" type="button" data-pdf="${i}">Nota PDF</button></div></div>`).join('')}</div>` : '<div class="small muted">Belum ada riwayat servis.</div>'}
    <p class="small muted" style="margin:0">Diperbarui ${esc(tgl(d.updated))}.</p>
  </div>`;
  $('#cek-form').hidden = true;
}

async function cari(e) {
  e?.preventDefault();
  const nopol = $('#cek-nopol').value.trim(), hp = $('#cek-hp').value.trim();
  if (!nopol) { showErr('Isi nomor polisi.'); $('#cek-nopol').focus(); return; }
  if (!waNumber(hp)) { showErr('Isi nomor HP yang benar, mis. 0812 3456 7890.'); $('#cek-hp').focus(); return; }
  showErr(''); busy(true);
  try {
    const key = await pantauKey(nopol, hp);
    const s = await getDoc(doc(db, 'pantau', key));
    if (!s.exists()) { showErr('Data tidak ditemukan. Pastikan nomor polisi dan nomor HP sama dengan yang didaftarkan di bengkel.'); return; }
    data = s.data(); render();
  } catch (err) { showErr('Gagal memuat data. Periksa koneksi internet lalu coba lagi.'); }
  finally { busy(false); }
}

document.addEventListener('click', async e => {
  if (e.target.id === 'cek-reset') { data = null; $('#cek-result').innerHTML = ''; $('#cek-form').hidden = false; $('#cek-nopol').focus(); return; }
  const b = e.target.closest('[data-pdf]'); if (!b || !data) return;
  const t = data.riwayat[+b.dataset.pdf]; b.disabled = true; b.textContent = '…';
  try { const { notaPdfBlob, saveBlob } = await import('./nota-pdf.js'); saveBlob(await notaPdfBlob(t), `Nota-${t.no}.pdf`); }
  catch (err) { showErr('PDF gagal dibuat: ' + err.message); }
  finally { b.disabled = false; b.textContent = 'PDF'; }
});
$('#cek-form').addEventListener('submit', cari);
$('#cek-nopol').addEventListener('input', e => { const p = e.target.selectionStart; e.target.value = e.target.value.toUpperCase(); e.target.setSelectionRange(p, p); });

// Mulai
const q = new URLSearchParams(location.search).get('nopol');
if (q) $('#cek-nopol').value = q.toUpperCase().replace(/^([A-Z]{1,2})(\d{1,4})([A-Z]{0,3})$/, (m, a, b, c) => [a, b, c].filter(Boolean).join(' '));
document.title = 'Cek Servis · ' + APP_NAME;
loadBrand().finally(() => { $('#boot')?.remove(); $('#cek-screen').hidden = false; (q ? $('#cek-hp') : $('#cek-nopol')).focus(); });
