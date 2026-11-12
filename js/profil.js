// 5.21.0 — Profil gaya media sosial.
// - Klik foto profil (kanan atas) → menu profil: kartu profil, status Online/Sibuk/Offline, Profil saya, Ganti foto,
//   Ganti PIN, Atur pintasan (HP), Mode gelap, Update aplikasi, Pasang aplikasi, Panduan, Keluar.
// - "Profil saya": biodata yang diisi sendiri (panggilan, bio, HP/WA, tanggal lahir, jenis kelamin, alamat, kota,
//   Instagram, hobi, mulai bekerja) + foto. Disimpan di profil/{email}; hanya pemilik yang dapat mengubah.
// - Rekan kerja dapat melihat kartu profil (mis. dengan mengetuk foto/nama di Chat). No. HP hanya tampil bila diizinkan.
import { $, esc, toast, errMsg, modal, closeModal, stamp } from './util.js';
import { st, actions, go } from './state.js';
import { db, doc, getDoc, setDoc } from './firebase.js';
import { ROLES, APP_VERSION } from './config.js';
import { namaCabang } from './cabang.js';
import { STATUS, pilihanSaya, setStatusSaya, statusDari, terakhirAktif } from './presence.js';

const FIELD = ['panggilan', 'bio', 'hp', 'tampilHp', 'tglLahir', 'jk', 'alamat', 'kota', 'instagram', 'hobi', 'mulaiKerja'];
const inisial = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';
const hp = () => matchMedia('(max-width: 900px)').matches;
const peranLabel = () => st.petugas?.super ? 'Super Admin' : (ROLES[st.role] || st.role || '');
const avatarHTML = (foto, nama, cls = '') => `<span class="pf-av ${cls}">${foto ? `<img src="${esc(foto)}" alt="">` : esc(inisial(nama))}</span>`;

/* ---------- Data profil sendiri ---------- */
export async function muatProfilSaya() {
  const email = st.petugas?.email; if (!email) return;
  try {
    const s = await getDoc(doc(db, 'profil', email)); st.profil = s.exists() ? s.data() : {};
    if (st.profil.foto) st.petugas.foto = st.profil.foto;
    window.dispatchEvent(new Event('amu-profile-changed'));
  } catch (e) { st.profil = st.profil || {}; }
}
// Perkecil foto (maks. 360 px, JPEG) agar ringan disimpan
export function kecilkanFoto(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader(); r.onerror = () => reject(new Error('Foto tidak dapat dibaca'));
    r.onload = () => { const im = new Image(); im.onerror = () => reject(new Error('Format foto tidak didukung')); im.onload = () => { const max = 360, sk = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * sk)); c.height = Math.max(1, Math.round(im.height * sk)); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); resolve(c.toDataURL('image/jpeg', .78)); }; im.src = r.result; };
    r.readAsDataURL(file);
  });
}
export async function simpanFotoProfil(file) {
  const email = st.petugas?.email; if (!file || !email) return;
  try {
    const foto = await kecilkanFoto(file);
    await setDoc(doc(db, 'profil', email), { foto, nama: st.petugas.nama || '', diubah: stamp(new Date()) }, { merge: true });
    st.petugas.foto = foto; st.profil = { ...(st.profil || {}), foto };
    window.dispatchEvent(new Event('amu-profile-changed')); toast('Foto profil berhasil diperbarui');
    if ($('#pf-form')) bukaProfilSaya();
  } catch (e) { toast('Foto gagal disimpan: ' + errMsg(e)); }
}

/* ---------- Menu profil (dropdown di PC, lembar bawah di HP) ---------- */
function tutupMenu() { const m = $('#pf-menu'); if (!m) return; m.classList.remove('on'); setTimeout(() => m.remove(), 180); document.removeEventListener('click', luar, true); }
function luar(e) { const m = $('#pf-menu'); if (m && !m.querySelector('.pf-panel').contains(e.target) && !e.target.closest('#top-profile')) tutupMenu(); }
export function bukaMenuProfil() {
  if ($('#pf-menu')) return tutupMenu();
  const p = st.petugas; if (!p) return;
  const nama = p.nama || p.email, v = pilihanSaya(), tampil = id => { const b = document.getElementById(id); return b && !b.hidden; };
  const tema = document.querySelector('.sb-foot [data-theme-toggle]')?.textContent?.trim() || '☾ Mode gelap';
  const item = (act, ic, label, sub = '', cls = '') => `<button type="button" class="pf-item ${cls}" data-pf="${act}"><span class="pf-ic" aria-hidden="true">${ic}</span><span class="pf-tx"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="pf-chev" aria-hidden="true">›</span></button>`;
  const m = document.createElement('div'); m.id = 'pf-menu'; m.className = 'pf-menu';
  m.innerHTML = `<div class="pf-backdrop" data-pf="tutup"></div><div class="pf-panel" role="menu" aria-label="Menu profil">
    <div class="pf-handle"><span></span></div>
    <div class="pf-card"><button type="button" class="pf-card-av" data-pf="foto" title="Ganti foto profil">${avatarHTML(p.foto, nama, 'lg')}<i aria-hidden="true">📷</i></button>
      <div class="pf-card-tx"><b>${esc(st.profil?.panggilan || nama)}</b><small>${esc(peranLabel())}${p.cabang ? ' · ' + esc(namaCabang(p.cabang)) : ''}</small><button type="button" class="pf-link" data-pf="profil">Lihat &amp; ubah profil</button></div></div>
    <div class="pf-status" role="radiogroup" aria-label="Status">${Object.entries(STATUS).map(([k, s]) => `<button type="button" role="radio" aria-checked="${k === v}" data-pf-status="${k}"><span class="st-dot ${s.kelas}"></span>${s.label}</button>`).join('')}</div>
    <div class="pf-list">
      ${item('profil', '👤', 'Profil saya', 'Biodata, foto, kontak')}
      ${item('foto', '📷', 'Ganti foto profil')}
      ${tampil('ganti-pin') ? item('pin', '🔑', 'Ganti PIN') : ''}
      ${hp() ? item('pintas', '★', 'Atur pintasan bawah', 'Pilih 4 menu di bilah bawah') : ''}
      ${item('tema', tema.startsWith('☀') ? '☀' : '☾', tema.replace(/^[☀☾]\s*/, ''))}
      ${item('update', '⟳', 'Update aplikasi', 'Versi ' + APP_VERSION)}
      ${tampil('pasang-app') ? item('pasang', '📲', 'Pasang aplikasi') : ''}
      ${item('panduan', '❓', 'Panduan penggunaan')}
      ${item('keluar', '⎋', 'Keluar', '', 'bad')}
    </div></div>`;
  document.body.appendChild(m);
  if (!hp()) { const r = $('#top-profile').getBoundingClientRect(), pn = m.querySelector('.pf-panel'); pn.style.top = (r.bottom + 8) + 'px'; pn.style.right = Math.max(8, innerWidth - r.right) + 'px'; }
  requestAnimationFrame(() => m.classList.add('on'));
  setTimeout(() => document.addEventListener('click', luar, true), 0);
  m.addEventListener('click', async e => {
    const s = e.target.closest('[data-pf-status]'); if (s) { await setStatusSaya(s.dataset.pfStatus); m.querySelectorAll('[data-pf-status]').forEach(b => b.setAttribute('aria-checked', b === s)); return; }
    const b = e.target.closest('[data-pf]'); if (!b) return; const a = b.dataset.pf;
    if (a === 'tema') { document.querySelector('.sb-foot [data-theme-toggle]')?.click(); tutupMenu(); setTimeout(bukaMenuProfil, 200); return; }
    tutupMenu();
    if (a === 'profil') setTimeout(bukaProfilSaya, 60);
    if (a === 'foto') $('#profile-file')?.click();
    if (a === 'pin') $('#ganti-pin')?.click();
    if (a === 'pintas') actions['atur-pintas']?.();
    if (a === 'update') $('#update-app')?.click();
    if (a === 'pasang') $('#pasang-app')?.click();
    if (a === 'panduan') go('panduan');
    if (a === 'keluar') $('#logout')?.click();
  });
  // HP: geser lembar ke bawah untuk menutup
  const pn = m.querySelector('.pf-panel'); let y0 = null, dy = 0;
  pn.addEventListener('touchstart', e => { y0 = pn.scrollTop <= 0 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  pn.addEventListener('touchmove', e => { if (y0 == null || !hp()) return; dy = Math.max(0, e.touches[0].clientY - y0); pn.style.transform = dy ? `translateY(${dy}px)` : ''; }, { passive: true });
  pn.addEventListener('touchend', () => { pn.style.transform = ''; if (dy > 90) tutupMenu(); y0 = null; });
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#pf-menu')) tutupMenu(); });

/* ---------- Profil saya (ubah biodata) ---------- */
export function bukaProfilSaya() {
  const p = st.petugas || {}, d = st.profil || {}, nama = p.nama || p.email || '';
  const f = (id, label, val = '', attr = '') => `<label class="f" for="pf-${id}">${label}<input id="pf-${id}" data-nocaps value="${esc(val || '')}" ${attr}></label>`;
  modal(`<form id="pf-form" class="pf-form" autocomplete="off">
    <div class="pf-hero"><button type="button" class="pf-card-av" data-act="pf-foto" title="Ganti foto">${avatarHTML(p.foto, nama, 'xl')}<i aria-hidden="true">📷</i></button>
      <div><b>${esc(nama)}</b><small>${esc(peranLabel())}${p.cabang ? ' · ' + esc(namaCabang(p.cabang)) : ''}</small><small class="muted">Nama lengkap, peran, dan cabang diatur Super Admin.</small></div></div>
    <div class="form pf-grid">
      ${f('panggilan', 'Nama panggilan', d.panggilan, 'maxlength="30" placeholder="mis. Rina"')}
      ${f('hp', 'No. HP / WhatsApp', d.hp, 'inputmode="tel" maxlength="20" placeholder="08xxxxxxxxxx"')}
      <label class="f pf-full" for="pf-bio">Bio / tentang saya<textarea id="pf-bio" data-nocaps maxlength="300" rows="3" placeholder="Ceritakan singkat tentang diri Anda, keahlian, atau motto kerja">${esc(d.bio || '')}</textarea></label>
      ${f('tglLahir', 'Tanggal lahir', d.tglLahir, 'type="date"')}
      <label class="f" for="pf-jk">Jenis kelamin<select id="pf-jk"><option value="">–</option>${['Laki-laki', 'Perempuan'].map(x => `<option ${d.jk === x ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      ${f('kota', 'Kota / domisili', d.kota, 'maxlength="40"')}
      ${f('mulaiKerja', 'Mulai bekerja', d.mulaiKerja, 'type="month"')}
      <label class="f pf-full" for="pf-alamat">Alamat<textarea id="pf-alamat" data-nocaps maxlength="200" rows="2">${esc(d.alamat || '')}</textarea></label>
      ${f('instagram', 'Instagram', d.instagram, 'maxlength="40" placeholder="@namaakun"')}
      ${f('hobi', 'Hobi / minat', d.hobi, 'maxlength="80"')}
      <label class="chk pf-full"><input type="checkbox" id="pf-tampilHp" ${d.tampilHp ? 'checked' : ''}> Tampilkan No. HP di kartu profil untuk rekan kerja</label>
    </div>
    <p class="small muted" style="margin:0">Alamat & tanggal lahir lengkap hanya terlihat oleh Anda dan Super Admin; rekan kerja hanya melihat tanggal & bulan ulang tahun.</p>
    <div class="row" style="justify-content:flex-end"><button type="button" class="btn" data-close="1">Batal</button><button type="submit" class="btn pri">Simpan profil</button></div></form>`, 'pf-modal');
}
async function simpanProfil(e) {
  e.preventDefault(); const email = st.petugas?.email; if (!email) return;
  const data = { nama: st.petugas.nama || '', diubah: stamp(new Date()) };
  FIELD.forEach(k => { const el = $('#pf-' + k); if (el) data[k] = el.type === 'checkbox' ? el.checked : el.value.trim(); });
  if (data.instagram && !data.instagram.startsWith('@')) data.instagram = '@' + data.instagram.replace(/^@+/, '');
  try { await setDoc(doc(db, 'profil', email), data, { merge: true }); st.profil = { ...(st.profil || {}), ...data }; closeModal(); toast('Profil disimpan'); window.dispatchEvent(new Event('amu-profile-changed')); }
  catch (err) { toast('Profil gagal disimpan: ' + errMsg(err)); }
}
document.addEventListener('submit', e => { if (e.target.id === 'pf-form') simpanProfil(e); });
actions['pf-foto'] = () => $('#profile-file')?.click();

/* ---------- Kartu profil rekan kerja ---------- */
export async function lihatProfil(email, cadangan = {}) {
  if (!email) return;
  if (email === st.petugas?.email) return bukaProfilSaya();
  modal(`<div class="pf-view"><div class="loader small">Memuat profil…</div></div>`, 'pf-modal');
  let d = {}, pr = null;
  try { const [a, b] = await Promise.all([getDoc(doc(db, 'profil', email)), getDoc(doc(db, 'presence', email)).catch(() => null)]); d = a.exists() ? a.data() : {}; pr = b?.exists() ? b.data() : null; } catch (e) {}
  if (!$('.pf-view')) return;
  const nama = d.nama || cadangan.nama || pr?.nama || email.split('@')[0], s = statusDari(pr);
  const ultah = d.tglLahir ? new Date(d.tglLahir + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long' }) : '';
  const baris = (ic, l, v) => v ? `<div class="pf-row"><span>${ic}</span><div><small>${l}</small><b>${v}</b></div></div>` : '';
  const wa = d.tampilHp && d.hp ? String(d.hp).replace(/\D/g, '').replace(/^0/, '62') : '';
  $('.pf-view').innerHTML = `<div class="pf-cover"></div>
    <div class="pf-view-head">${avatarHTML(d.foto, nama, 'xl')}<span class="st-dot ${STATUS[s].kelas}"></span></div>
    <div class="pf-view-name"><b>${esc(d.panggilan || nama)}</b>${d.panggilan ? `<small>${esc(nama)}</small>` : ''}<small>${esc(cadangan.peran || pr?.peranLabel || '')}${(cadangan.cabang || pr?.cabang) ? ' · ' + esc(namaCabang(cadangan.cabang || pr?.cabang)) : ''}</small>
      <span class="pf-st ${STATUS[s].kelas}">${s === 'offline' ? 'Offline · ' + esc(terakhirAktif(pr)) : STATUS[s].label}</span></div>
    ${d.bio ? `<p class="pf-bio">${esc(d.bio)}</p>` : '<p class="pf-bio muted">Belum menulis bio.</p>'}
    <div class="pf-rows">${baris('🎂', 'Ulang tahun', esc(ultah))}${baris('📍', 'Domisili', esc(d.kota || ''))}${baris('🧰', 'Mulai bekerja', d.mulaiKerja ? esc(new Date(d.mulaiKerja + '-01T00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })) : '')}${baris('🎯', 'Hobi', esc(d.hobi || ''))}${baris('📷', 'Instagram', esc(d.instagram || ''))}${wa ? baris('📱', 'No. HP', esc(d.hp)) : ''}${st.petugas?.super ? baris('🏠', 'Alamat (khusus Super Admin)', esc(d.alamat || '')) + baris('📅', 'Tanggal lahir (khusus Super Admin)', esc(d.tglLahir || '')) : ''}</div>
    <div class="row" style="justify-content:flex-end">${wa ? `<a class="btn" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}<button type="button" class="btn pri" data-close="1">Tutup</button></div>`;
}
actions['profil-lihat'] = el => lihatProfil(el.dataset.email, { nama: el.dataset.nama, peran: el.dataset.peran, cabang: el.dataset.cabang });
