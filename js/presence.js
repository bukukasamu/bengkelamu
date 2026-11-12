// 5.19.0 — Status kehadiran petugas: Online (live), Sibuk, Offline.
// Setiap perangkat yang sedang membuka aplikasi mengirim "detak" kecil ke presence/{email} setiap 2,5 menit
// (hanya saat layar aplikasi terlihat). Petugas dianggap Offline bila tidak ada detak lebih dari 6 menit,
// atau bila ia memilih "Tampil offline". Pilihan status diingat di perangkat dan di server.
// Waktu memakai jam server (serverTimestamp) supaya jam HP yang tidak tepat tidak membuat status salah.
import { db, doc, setDoc, collection, onSnapshot, serverTimestamp } from './firebase.js';
import { st } from './state.js';
import { ROLES } from './config.js';
import { esc } from './util.js';

export const DETAK_MS = 150000;        // 2,5 menit
export const BATAS_OFFLINE_MS = 360000; // 6 menit tanpa detak = offline
export const STATUS = {
  online: { label: 'Online', ket: 'Siap membalas chat', kelas: 'st-online' },
  sibuk: { label: 'Sibuk', ket: 'Sedang melayani / tidak bisa membalas cepat', kelas: 'st-sibuk' },
  offline: { label: 'Offline', ket: 'Tampil offline untuk petugas lain', kelas: 'st-offline' }
};

let timer = 0, aktif = false, selisihServer = 0, unsubSaya = null;
const emailSaya = () => st.petugas?.email || '';
const kunciPilihan = () => 'amu-status-' + (emailSaya() || 'anon');
export function pilihanSaya() { try { return localStorage.getItem(kunciPilihan()) || 'online'; } catch (e) { return 'online'; } }
// Perkiraan jam server (dihitung dari detak sendiri) — dipakai untuk menghitung "aktif x menit lalu"
export const kiniServer = () => Date.now() + selisihServer;

async function detak(status) {
  const email = emailSaya(); if (!email || !st.petugas) return;
  const p = st.petugas, pilih = status || pilihanSaya();
  try {
    await setDoc(doc(db, 'presence', email), {
      email, nama: p.nama || email, peran: st.role || '', peranLabel: p.super ? 'Super Admin' : (ROLES[st.role] || st.role || ''),
      cabang: p.cabang || '', status: pilih, aktif: serverTimestamp()
    });
  } catch (e) { /* aturan Firestore lama belum dipublish: status tidak tampil, aplikasi tetap jalan */ }
}
function jadwal() { clearTimeout(timer); if (aktif && !document.hidden) timer = setTimeout(() => { detak(); jadwal(); }, DETAK_MS); }
let terakhirTerlihat = 0;
function saatTerlihat() {
  if (!aktif) return;
  if (document.hidden) { clearTimeout(timer); return; }
  // Kembali ke aplikasi: kirim detak bila detak terakhir sudah lebih dari 1 menit
  if (Date.now() - terakhirTerlihat > 60000) { terakhirTerlihat = Date.now(); detak(); }
  jadwal();
}
function saatKeluar() { if (aktif && emailSaya()) { try { setDoc(doc(db, 'presence', emailSaya()), { status: 'offline', aktif: serverTimestamp() }, { merge: true }); } catch (e) {} } }

export function mulaiPresence() {
  hentikanPresence(); if (!st.petugas) return;
  aktif = true; terakhirTerlihat = Date.now(); detak(); jadwal();
  // Selisih jam perangkat vs server dihitung dari dokumen sendiri
  try {
    unsubSaya = onSnapshot(doc(db, 'presence', emailSaya()), s => {
      const t = s.data()?.aktif; if (t?.toMillis && !s.metadata.hasPendingWrites) selisihServer = t.toMillis() - Date.now();
    }, () => {});
  } catch (e) {}
}
export function hentikanPresence() {
  if (aktif) saatKeluar();
  aktif = false; clearTimeout(timer); unsubSaya?.(); unsubSaya = null;
}
export async function setStatusSaya(v) {
  if (!STATUS[v]) return;
  try { localStorage.setItem(kunciPilihan(), v); } catch (e) {}
  renderStatusSaya(); await detak(v);
  window.dispatchEvent(new CustomEvent('amu-status-saya', { detail: v }));
}
document.addEventListener('visibilitychange', saatTerlihat);
window.addEventListener('pagehide', saatKeluar);

/* ---- Membaca status orang lain (dipakai saat Chat dibuka) ---- */
// Mengembalikan 'online' | 'sibuk' | 'offline' berdasarkan dokumen presence
export function statusDari(d) {
  if (!d) return 'offline';
  const ms = d.aktif?.toMillis ? d.aktif.toMillis() : 0;
  if (!ms || kiniServer() - ms > BATAS_OFFLINE_MS || d.status === 'offline') return 'offline';
  return d.status === 'sibuk' ? 'sibuk' : 'online';
}
export function terakhirAktif(d) {
  const ms = d?.aktif?.toMillis ? d.aktif.toMillis() : 0; if (!ms) return 'belum pernah aktif';
  const mnt = Math.max(0, Math.round((kiniServer() - ms) / 60000));
  if (mnt < 1) return 'aktif barusan';
  if (mnt < 60) return 'aktif ' + mnt + ' menit lalu';
  const jam = Math.round(mnt / 60); if (jam < 24) return 'aktif ' + jam + ' jam lalu';
  return 'aktif ' + new Date(ms).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}
// Langganan seluruh status (koleksi kecil: satu dokumen per petugas). Kembalikan fungsi berhenti.
export function pantauPresence(cb) {
  try { return onSnapshot(collection(db, 'presence'), s => { const m = new Map(); s.docs.forEach(d => m.set(d.id, d.data())); cb(m); }, () => cb(new Map())); }
  catch (e) { cb(new Map()); return () => {}; }
}

/* ---- Tombol status di bilah atas ---- */
export function renderStatusSaya() {
  const v = pilihanSaya(), s = STATUS[v];
  document.querySelector('.top-avatar')?.setAttribute('data-status', v);
  const el = document.getElementById('top-status'); if (!el) return;   // 5.21.0: status dipindah ke menu profil
  if (!st.petugas) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<span class="st-dot ${s.kelas}" aria-hidden="true"></span><span class="top-status-lbl">${esc(s.label)}</span>`;
  el.title = 'Status Anda: ' + s.label + ' — klik untuk mengganti';
  document.querySelector('.top-avatar')?.setAttribute('data-status', v);
}
function menuStatus(anchor) {
  document.getElementById('status-menu')?.remove();
  const r = anchor.getBoundingClientRect(), v = pilihanSaya();
  const m = document.createElement('div'); m.id = 'status-menu'; m.className = 'status-menu'; m.setAttribute('role', 'menu');
  m.innerHTML = `<div class="status-menu-h">Atur status Anda</div>` + Object.entries(STATUS).map(([k, s]) => `<button type="button" role="menuitemradio" aria-checked="${k === v}" data-status-pilih="${k}"><span class="st-dot ${s.kelas}"></span><span><b>${s.label}</b><small>${s.ket}</small></span>${k === v ? '<i aria-hidden="true">✓</i>' : ''}</button>`).join('') + `<div class="status-menu-f">Tanpa aktivitas lebih dari 6 menit, status otomatis menjadi Offline.</div>`;
  document.body.appendChild(m);
  const w = m.offsetWidth; m.style.top = (r.bottom + 8) + 'px'; m.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.right - w)) + 'px';
  m.querySelector('[aria-checked="true"]')?.focus();
  const tutup = e => { if (!m.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) { m.remove(); document.removeEventListener('click', tutup, true); } };
  setTimeout(() => document.addEventListener('click', tutup, true), 0);
  m.addEventListener('click', e => { const b = e.target.closest('[data-status-pilih]'); if (!b) return; setStatusSaya(b.dataset.statusPilih); m.remove(); document.removeEventListener('click', tutup, true); });
  m.addEventListener('keydown', e => { if (e.key === 'Escape') { m.remove(); anchor.focus(); } });
}
document.addEventListener('click', e => { const b = e.target.closest?.('#top-status'); if (b) menuStatus(b); });
