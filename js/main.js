// Titik masuk aplikasi: login + peran, sidebar, sinkron data Firestore, shortcut keyboard.
import { auth, db, onAuthStateChanged, signInWithEmailAndPassword, signOut, collection, doc, getDoc, onSnapshot, query, where, orderBy, limit, writeBatch } from './firebase.js';
import { $, esc, dkey, toast, modal, closeModal, errMsg } from './util.js';
import { S, st, setParts, views, actions, inputHandlers, changeHandlers, fkeys, go, refresh, can } from './state.js';
import { APP_NAME, APP_VERSION, ROLES, MENUS, HOME, DEFAULT_JASA, DEFAULT_MEKANIK, DEFAULT_TIPE, SUPER_ADMIN } from './config.js';
import { loadLoginList, isPinAccount, validPin, gantiPinSendiri } from './akun.js';
import { loadBrand, loaderHTML, gearsSVG } from './brand.js';
import { showNota } from './nota.js';
import { onSearchEnter } from './kasir.js';
import { setLoadedFrom } from './laporan.js';
// Modul menu: cukup diimpor, masing-masing mendaftarkan tampilan & aksinya sendiri.
import './beranda.js';
import './registrasi.js';
import './order.js';
import './bayar.js';
import './mekanik.js';
import './stok.js';
import './pembelian.js';
import './master.js';
import './import-excel.js';

document.querySelectorAll('.app-ver').forEach(e => { e.textContent = 'versi ' + APP_VERSION; });
document.querySelectorAll('.app-name').forEach(e => { e.textContent = APP_NAME.toUpperCase(); });

/* ---------- SIDEBAR ---------- */
function renderSidebar() {
  let html = '', group = '';
  MENUS.filter(m => can(m.id)).forEach(m => {
    if (m.group !== group) { group = m.group; html += `<div class="sb-group">${esc(group)}</div>`; }
    html += `<button class="sb-link" type="button" data-view="${m.id}">${esc(m.label)}</button>`;
  });
  $('#side-nav').innerHTML = html;
}
const isMobile = () => window.matchMedia('(max-width: 900px)').matches;
function toggleSidebar() {
  if (isMobile()) {
    const open = !document.body.classList.contains('sb-open');
    document.body.classList.toggle('sb-open', open); $('#sb-backdrop').hidden = !open;
  } else {
    const hidden = document.body.classList.toggle('sb-hidden');
    try { localStorage.setItem('amu-sb-hidden', hidden ? '1' : ''); } catch (e) {}
  }
}
try { if (localStorage.getItem('amu-sb-hidden')) document.body.classList.add('sb-hidden'); } catch (e) {}
$('#sb-toggle').addEventListener('click', toggleSidebar);
$('#sb-backdrop').addEventListener('click', toggleSidebar);
$('#side-nav').addEventListener('click', e => { const b = e.target.closest('.sb-link'); if (b) go(b.dataset.view); });

/* ---------- LOGIN ---------- */
// Petugas: pilih nama + PIN 6 digit. Super admin: email + kata sandi.
let loginMsg = '', unsubs = [], ready = {}, need = [], loginList = [], emailMode = false;

function setLoginMode(email) {
  emailMode = email;
  $('#login-pin-mode').hidden = email; $('#login-email-mode').hidden = !email;
  $('#login-switch').textContent = email ? 'Login petugas' : 'Super admin';
  $('#login-back').hidden = !email || !loginList.length;
  $('#login-title').textContent = email ? 'Super admin' : 'Selamat datang';
  $('#login-sub').textContent = email ? 'Masuk dengan email dan kata sandi.' : 'Pilih nama Anda lalu masukkan PIN.';
  (email ? $('#login-email') : ($('#login-nama').value ? $('#login-pin') : $('#login-nama')))?.focus();
}
async function fillLoginList() {
  try { loginList = await loadLoginList(); } catch (e) { loginList = []; }
  const groups = {};
  loginList.forEach(p => { (groups[p.peran] = groups[p.peran] || []).push(p); });
  let last = ''; try { last = localStorage.getItem('amu-login-id') || ''; } catch (e) {}
  $('#login-nama').innerHTML = loginList.length
    ? '<option value="">Pilih nama</option>' + Object.keys(ROLES).filter(r => groups[r]).map(r => `<optgroup label="${esc(ROLES[r])}">${groups[r].map(p => `<option value="${esc(p.id)}" ${p.id === last ? 'selected' : ''}>${esc(p.nama)}</option>`).join('')}</optgroup>`).join('')
    : '<option value="">Belum ada petugas</option>';
  if (!loginList.length) setLoginMode(true);
}
const bootDone = () => { $('#boot')?.remove(); };
function setBusy(b) { const btn = $('#login-btn'); btn.disabled = b; btn.innerHTML = b ? gearsSVG() + 'Memeriksa…' : 'Masuk'; }
function showLogin(msg) {
  bootDone(); setBusy(false);
  $('#app-shell').hidden = true; $('#login-screen').hidden = false;
  const m = msg || loginMsg; loginMsg = '';
  $('#login-err').hidden = !m; $('#login-err').textContent = m || '';
  $('#login-pin').value = ''; $('#login-pass').value = '';
}
$('#login-switch').addEventListener('click', () => setLoginMode(!emailMode));
$('#login-back').addEventListener('click', () => setLoginMode(false));
loadBrand();
$('#login-pin').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6); if (e.target.value.length === 6 && $('#login-nama').value) $('#login-form').requestSubmit(); });
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  let email, pass;
  if (emailMode) { email = $('#login-email').value.trim(); pass = $('#login-pass').value; if (!email || !pass) { showLogin('Isi email dan kata sandi.'); return; } }
  else {
    const p = loginList.find(x => x.id === $('#login-nama').value);
    if (!p) { showLogin('Pilih nama petugas dulu.'); $('#login-nama').focus(); return; }
    if (!validPin($('#login-pin').value)) { showLogin('PIN harus 6 angka.'); $('#login-pin').focus(); return; }
    email = p.email; pass = $('#login-pin').value;
    try { localStorage.setItem('amu-login-id', p.id); } catch (e) {}
  }
  setBusy(true); $('#login-err').hidden = true;
  try { await signInWithEmailAndPassword(auth, email, pass); }
  catch (err) {
    const m = { 'auth/invalid-credential': emailMode ? 'Email atau kata sandi salah.' : 'PIN salah.', 'auth/wrong-password': 'PIN salah.', 'auth/too-many-requests': 'Terlalu banyak percobaan salah. Tunggu beberapa menit.', 'auth/network-request-failed': 'Tidak ada koneksi internet.' };
    showLogin(m[err.code] || err.message); (emailMode ? $('#login-pass') : $('#login-pin')).focus();
  }
});
$('#logout').addEventListener('click', () => signOut(auth));

// Ganti PIN sendiri
$('#ganti-pin').addEventListener('click', () => {
  modal(`<h2>Ganti PIN</h2>
   <label class="f" for="gp-lama">PIN sekarang<input id="gp-lama" type="password" inputmode="numeric" maxlength="6" class="num pin-input" data-autofocus></label>
   <label class="f" for="gp-baru">PIN baru (6 angka)<input id="gp-baru" type="password" inputmode="numeric" maxlength="6" class="num pin-input"></label>
   <label class="f" for="gp-ulang">Ulangi PIN baru<input id="gp-ulang" type="password" inputmode="numeric" maxlength="6" class="num pin-input"></label>
   <div id="gp-err" class="err" hidden></div>
   <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Batal</button><button class="btn pri" type="button" data-act="gp-save">Simpan PIN</button></div>`);
});
actions['gp-save'] = async () => {
  const lama = $('#gp-lama').value, baru = $('#gp-baru').value, err = m => { $('#gp-err').hidden = false; $('#gp-err').textContent = m; };
  if (!validPin(baru)) return err('PIN baru harus 6 angka.');
  if (baru !== $('#gp-ulang').value) return err('Ulangan PIN baru tidak sama.');
  if (baru === lama) return err('PIN baru sama dengan PIN lama.');
  try { await gantiPinSendiri(lama, baru); closeModal(); toast('PIN berhasil diganti'); }
  catch (e) { err(e.code === 'auth/invalid-credential' || e.code === 'auth/wrong-password' ? 'PIN sekarang salah.' : e.code === 'auth/too-many-requests' ? 'Terlalu banyak percobaan. Tunggu sebentar.' : errMsg(e)); }
};

onAuthStateChanged(auth, async u => {
  unsubs.forEach(f => f()); unsubs = []; st.loaded = false; ready = {};
  if (!u) { st.petugas = null; st.role = null; showLogin(); fillLoginList(); return; }
  try {
    const email = (u.email || '').toLowerCase();
    let sd;
    try { sd = await getDoc(doc(db, 'staff', email)); }
    catch (e) {
      // Tepat setelah login, token kadang belum terpasang ke koneksi database: coba sekali lagi
      if (e.code !== 'permission-denied') throw e;
      await u.getIdToken(true); await new Promise(r => setTimeout(r, 1200));
      sd = await getDoc(doc(db, 'staff', email));
    }
    if (email === SUPER_ADMIN) {
      st.petugas = { email, nama: 'Super Admin', ...(sd.exists() ? sd.data() : {}), peran: 'admin', super: true };
    } else {
      if (!sd.exists()) { loginMsg = 'Akun ini sudah tidak aktif. Minta admin memeriksa di Master Data → Petugas.'; await signOut(auth); return; }
      st.petugas = { email, ...sd.data() };
    }
    st.role = ROLES[st.petugas.peran] ? st.petugas.peran : null;
    if (!st.role) { loginMsg = 'Peran "' + (st.petugas.peran || '') + '" tidak dikenal. Peran yang valid: ' + Object.keys(ROLES).join(', ') + '.'; await signOut(auth); return; }
  } catch (e) {
    loginMsg = e.code === 'permission-denied'
      ? 'Akses ke data petugas ditolak. Tutup tab lain aplikasi ini (termasuk tab Cek Servis), muat ulang halaman, lalu masuk lagi. Bila masih gagal, admin perlu publish ulang firestore.rules.'
      : 'Tidak bisa membaca data petugas: ' + errMsg(e);
    await signOut(auth); return;
  }
  bootDone(); $('#login-screen').hidden = true; $('#app-shell').hidden = false;
  $('#who').textContent = st.petugas.nama || st.petugas.email;
  $('#who-role').textContent = st.petugas.super ? 'Super Admin' : ROLES[st.role];
  $('#ganti-pin').hidden = !isPinAccount(st.petugas.email);
  renderSidebar();
  let last = null; try { last = localStorage.getItem('amu-tab-' + st.role); } catch (e) {}
  st.view = last && can(last) ? last : HOME[st.role];
  go(st.view);
  $('#view').innerHTML = loaderHTML('Memuat data bengkel…');
  subscribe();
});

/* ---------- SINKRON DATA (realtime) ---------- */
function subscribe() {
  const now = new Date();
  const from = dkey(new Date(now.getFullYear(), now.getMonth() - 1, 1));   // awal bulan lalu: cukup untuk grafik, laporan & gaji mekanik
  setLoadedFrom(from);
  const fail = e => { $('#view').innerHTML = '<div class="panel"><div class="err">Gagal memuat data: ' + esc(errMsg(e)) + '</div></div>'; };
  need = ['parts', 'trx', 'wo', 'jasa', 'mekanik', 'settings'];
  if (can('pembelian')) need.push('pembelian');
  const mark = k => {
    ready[k] = true;
    if (need.every(n => ready[n])) { if (!st.loaded) { st.loaded = true; seedMaster(); go(st.view); } else refresh(); }
  };
  const sub = (q, k, fn) => unsubs.push(onSnapshot(q, s => { fn(s); mark(k); }, fail));
  sub(collection(db, 'parts'), 'parts', s => setParts(s.docs.map(d => d.data())));
  sub(query(collection(db, 'trx'), where('tgl', '>=', from)), 'trx', s => { S.trx = s.docs.map(d => d.data()).sort((a, b) => a.tgl.localeCompare(b.tgl)); });
  sub(query(collection(db, 'wo'), orderBy('tgl', 'desc'), limit(200)), 'wo', s => { S.wo = s.docs.map(d => d.data()).reverse(); });
  sub(collection(db, 'jasa'), 'jasa', s => { S.jasa = s.docs.map(d => ({ id: d.id, ...d.data() })); });
  sub(collection(db, 'mekanik'), 'mekanik', s => { S.mekanik = s.docs.map(d => ({ id: d.id, ...d.data() })); });
  sub(doc(db, 'meta', 'settings'), 'settings', s => { S.settings = s.exists() ? s.data() : {}; });
  if (can('pembelian')) sub(query(collection(db, 'pembelian'), orderBy('input', 'desc'), limit(200)), 'pembelian', s => { S.pembelian = s.docs.map(d => d.data()); });
}

// Admin pertama kali: isi jasa, mekanik, tipe motor default supaya registrasi langsung bisa dipakai
async function seedMaster() {
  if (st.role !== 'admin' || S.jasa.length || S.mekanik.length || S.settings.tipe) return;
  try {
    const b = writeBatch(db);
    DEFAULT_JASA.forEach(([nama, harga], i) => b.set(doc(collection(db, 'jasa')), { nama, harga, aktif: true, urut: i }));
    DEFAULT_MEKANIK.forEach(nama => b.set(doc(collection(db, 'mekanik')), { nama, email: '', gaji: 0, komisi: 0, aktif: true }));
    b.set(doc(db, 'meta', 'settings'), { tipe: DEFAULT_TIPE }, { merge: true });
    await b.commit();
    toast('Data awal jasa, mekanik, dan tipe motor dibuat. Ubah di Master Data.');
  } catch (e) { toast(errMsg(e)); }
}

/* ---------- HURUF KAPITAL OTOMATIS ----------
   Semua isian teks diubah ke huruf kapital saat diketik (dijalankan sebelum handler lain).
   Dikecualikan: email, kata sandi/PIN, angka, tanggal, dan isian bertanda data-nocaps. */
const NO_CAPS = new Set(['email', 'password', 'number', 'date', 'file', 'checkbox', 'radio', 'range', 'color', 'time']);
document.addEventListener('input', e => {
  const t = e.target;
  if (t.tagName !== 'INPUT' && t.tagName !== 'TEXTAREA') return;
  if (t.tagName === 'INPUT' && NO_CAPS.has(t.type)) return;
  if (t.dataset.nocaps != null || t.getAttribute('inputmode') === 'numeric') return;
  const up = t.value.toUpperCase(); if (up === t.value) return;
  const a = t.selectionStart, b = t.selectionEnd; t.value = up;
  try { t.setSelectionRange(a, b); } catch (err) {}
}, true);

/* ---------- EVENT ---------- */
$('#modal-root').addEventListener('click', e => { if (e.target.dataset.close) closeModal(); });
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && actions[el.dataset.act]) actions[el.dataset.act](el);
});
document.addEventListener('input', e => inputHandlers.forEach(h => h(e)));
document.addEventListener('change', e => changeHandlers.forEach(h => h(e)));

function fk(k) {
  if (!st.loaded) return;
  if (k === 'cetak') { showNota(st.lastNota || [...S.trx].reverse().find(t => t.kasir === (st.petugas.nama || st.petugas.email)) || S.trx[S.trx.length - 1]); return; }
  let a = fkeys[st.view] && fkeys[st.view][k];
  if (typeof a === 'function') a = a();
  if (a && actions[a]) actions[a]({ dataset: {} });
  else toast(k === 'baru' ? 'Tidak ada data baru di halaman ini' : 'Tidak ada yang perlu disimpan di halaman ini');
}
$('#fk-baru').onclick = () => fk('baru');
$('#fk-simpan').onclick = () => fk('simpan');
$('#fk-cetak').onclick = () => fk('cetak');

document.addEventListener('keydown', e => {
  if ($('#app-shell').hidden) return;
  if (e.key === 'Enter' && e.target.classList?.contains('row-click')) { actions[e.target.dataset.act]?.(e.target); return; }
  if (e.key === 'Escape') { if ($('#modal-root').innerHTML) closeModal(); else if (document.body.classList.contains('sb-open')) toggleSidebar(); return; }
  if (e.key === 'Enter' && e.target.id === 'k-q') { e.preventDefault(); onSearchEnter(e.target); return; }
  if (e.key === 'F1') { e.preventDefault(); fk('baru'); }
  if (e.key === 'F2') { e.preventDefault(); fk('simpan'); }
  if (e.key === 'F8') { e.preventDefault(); fk('cetak'); }
});

/* ---------- JAM ---------- */
const tick = () => { $('#clock').textContent = new Date().toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
tick(); setInterval(tick, 30000);
