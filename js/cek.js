// Halaman cek servis untuk konsumen (cek.html): tanpa login, cukup no. polisi + no. HP.
// Data diambil dari dokumen pantau/{SHA-256(NOPOL|62HP)} yang diperbarui otomatis oleh bengkel.
import { db, doc, getDoc, onSnapshot } from './firebase.js';
import { $, esc, rp, waNumber } from './util.js';
import { loadBrand, gearsSVG, loaderHTML } from './brand.js';
import { pantauKey, durasi, fmtDur } from './wo-common.js';
import { APP_NAME } from './config.js';
import { pasangTombol } from './pwa.js';

const STEPS = [['Antri', 'Diterima'], ['Dikerjakan', 'Dikerjakan'], ['Selesai', 'Selesai'], ['Lunas', 'Diambil / lunas']];
const tgl = t => t ? new Date(String(t).replace(' ', 'T')).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
let data = null, unsub = null;

// Sesi konsumen: kendaraan yang sudah pernah dicek disimpan di perangkat ini sampai konsumen menekan "Keluar".
// Yang disimpan hanya kunci acak (hash nopol + HP) dan nopol untuk tampilan, bukan nomor HP.
const SESI = 'amu-cek-sesi';
const sesi = () => { try { return JSON.parse(localStorage.getItem(SESI)) || { list: [], aktif: '' }; } catch (e) { return { list: [], aktif: '' }; } };
const simpanSesi = v => { try { localStorage.setItem(SESI, JSON.stringify(v)); } catch (e) {} };

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
    <div class="row spread"><div><div class="mono cek-nopol">${esc(d.nopol)}</div><div class="muted small">${esc(d.tipe || '')}${d.nama ? ' · ' + esc(d.nama) : ''}</div></div><div class="row" style="gap:6px"><button class="btn sm" type="button" id="cek-tambah">+ Kendaraan lain</button><button class="btn sm ghost" type="button" id="cek-keluar">Keluar</button></div></div>
    ${sesi().list.length > 1 ? `<div class="seg" role="group" aria-label="Kendaraan saya">${sesi().list.map(k => `<button type="button" data-kend="${esc(k.key)}" aria-pressed="${k.key === sesi().aktif}">${esc(k.nopol)}</button>`).join('')}</div>` : ''}
    ${a ? `<div class="row spread"><h3>Servis saat ini</h3>${a.antrian ? `<span class="cek-antri">Antrian <b>${esc(a.antrian)}</b></span>` : ''}</div>
      ${stepper(a)}
      <div class="totals small">
        <span class="muted">Masuk</span><span>${esc(tgl(a.tgl))}</span>
        ${a.mekanik ? `<span class="muted">Mekanik</span><span>${esc(a.mekanik)}</span>` : ''}
        ${a.jenisServis && a.jenisServis !== 'Reguler' ? `<span class="muted">Jenis servis</span><span>${esc(a.jenisServis)}${a.ksgKe ? ' ke-' + esc(a.ksgKe) : ''}</span>` : ''}
        ${a.keluhan ? `<span class="muted">Keluhan</span><span>${esc(a.keluhan)}</span>` : ''}
        ${a.jasa?.length ? `<span class="muted">Jasa</span><span>${a.jasa.map(esc).join(', ')}</span>` : ''}
        ${a.parts?.length ? `<span class="muted">Sparepart</span><span>${a.parts.map(p => esc(p.nama) + ' ×' + p.qty).join(', ')}</span>` : ''}
        ${a.biaya?.length ? `<span class="muted">Biaya lain</span><span>${a.biaya.map(b => esc(b.ket) + ' ' + rp(b.jumlah)).join(', ')}</span>` : ''}
        ${a.diskon ? `<span class="muted">Diskon</span><span class="num">−${rp(a.diskon)}</span>` : ''}
        ${a.estimasi ? `<span class="muted">${a.status === 'Selesai' ? 'Total biaya' : 'Estimasi biaya'}</span><span class="num"><b>${rp(a.estimasi)}</b></span>` : ''}
        ${durasi(a)?.kerja ? `<span class="muted">Sudah dikerjakan</span><span>${fmtDur(durasi(a).kerja)}</span>` : ''}
      </div>
      <p class="small muted" style="margin:0">Estimasi dapat berubah bila ada tambahan sparepart atau jasa.</p>` : '<div class="note small">Tidak ada servis yang sedang berjalan untuk kendaraan ini.</div>'}
    <h3>Riwayat servis</h3>
    ${(d.riwayat || []).length ? `<div class="riw">${d.riwayat.map((t, i) => `<div class="riw-row"><div><b>${esc(tgl(t.tgl))}</b><div class="small muted"><span class="mono">${esc(t.no)}</span>${t.km ? ' · ' + esc(t.km) + ' km' : ''}</div><div class="small">${esc((t.jasa || []).map(j => j.nama).join(', ') || t.jenisServis || '')}${t.items?.length ? (t.jasa?.length ? ' · ' : '') + esc(t.items.map(x => x.nama).join(', ')) : ''}</div></div><div class="riw-r"><span class="num"><b>${rp(t.total)}</b></span><button class="btn sm" type="button" data-pdf="${i}">Nota PDF</button></div></div>`).join('')}</div>` : '<div class="small muted">Belum ada riwayat servis.</div>'}
    <p class="small muted" style="margin:0">Diperbarui ${esc(tgl(d.updated))}.</p>
  </div>`;
  $('#cek-form').hidden = true; document.body.classList.add('cek-in');
}

// Buka data kendaraan & pantau perubahannya secara langsung (status servis ter-update sendiri)
function buka(key) {
  unsub?.(); unsub = null;
  const v = sesi(); v.aktif = key; simpanSesi(v);
  $('#cek-form').hidden = true; $('#cek-result').innerHTML = loaderHTML('Memuat data kendaraan…');
  unsub = onSnapshot(doc(db, 'pantau', key), s => {
    if (!s.exists()) { keluarSatu(key); formBaru(); showErr('Data kendaraan ini sudah berubah atau tidak tersedia. Silakan masukkan lagi nomor polisi dan nomor HP.'); return; }
    data = s.data(); render();
  }, () => { showErr('Gagal memuat data. Periksa koneksi internet.'); $('#cek-form').hidden = false; $('#cek-result').innerHTML = ''; });
}
function keluarSatu(key) { const v = sesi(); v.list = v.list.filter(k => k.key !== key); v.aktif = v.list[0]?.key || ''; simpanSesi(v); }
function formBaru() { unsub?.(); unsub = null; data = null; document.body.classList.remove('cek-in'); $('#cek-result').innerHTML = ''; $('#cek-form').hidden = false; $('#cek-batal').hidden = !sesi().aktif; showErr(''); $('#cek-nopol').value = ''; $('#cek-nopol').focus(); }

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
    const v = sesi(); v.list = [...v.list.filter(k => k.key !== key), { key, nopol: s.data().nopol }]; v.aktif = key; simpanSesi(v);
    $('#cek-hp').value = '';
    buka(key);
  } catch (err) { showErr('Gagal memuat data. Periksa koneksi internet lalu coba lagi.'); }
  finally { busy(false); }
}

document.addEventListener('click', async e => {
  if (e.target.id === 'cek-tambah') { formBaru(); return; }
  if (e.target.id === 'cek-keluar') { simpanSesi({ list: [], aktif: '' }); formBaru(); return; }
  if (e.target.id === 'cek-batal') { const v = sesi(); if (v.aktif) buka(v.aktif); return; }
  const kb = e.target.closest('[data-kend]'); if (kb) { buka(kb.dataset.kend); return; }
  const b = e.target.closest('[data-pdf]'); if (!b || !data) return;
  const t = data.riwayat[+b.dataset.pdf]; b.disabled = true; b.textContent = '…';
  try { const { notaPdfBlob, saveBlob } = await import('./nota-pdf.js'); saveBlob(await notaPdfBlob(t), `Nota-${t.no}.pdf`); }
  catch (err) { showErr('PDF gagal dibuat: ' + err.message); }
  finally { b.disabled = false; b.textContent = 'Nota PDF'; }
});
$('#cek-form').addEventListener('submit', cari);
$('#cek-nopol').addEventListener('input', e => { const p = e.target.selectionStart; e.target.value = e.target.value.toUpperCase(); e.target.setSelectionRange(p, p); });

// Mulai
const q = new URLSearchParams(location.search).get('nopol');
if (q) $('#cek-nopol').value = q.toUpperCase().replace(/^([A-Z]{1,2})(\d{1,4})([A-Z]{0,3})$/, (m, a, b, c) => [a, b, c].filter(Boolean).join(' '));
document.title = 'Cek Servis · ' + APP_NAME;
pasangTombol($('#cek-pasang'), t => { const el = $('#cek-pasang-info'); el.textContent = t; el.hidden = false; });
loadBrand().finally(() => {
  $('#boot')?.remove(); $('#cek-screen').hidden = false;
  const v = sesi();
  // Sudah pernah masuk di perangkat ini: langsung tampilkan (kecuali link membuka nopol lain yang belum tersimpan)
  const qKey = q && v.list.find(k => k.nopol.replace(/\s+/g, '') === q.replace(/\s+/g, '').toUpperCase());
  if (v.aktif && (!q || qKey)) { buka(qKey ? qKey.key : v.aktif); return; }
  if (v.list.length) $('#cek-batal').hidden = false;
  (q ? $('#cek-hp') : $('#cek-nopol')).focus();
});
