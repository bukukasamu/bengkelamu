// Titik masuk aplikasi: login + peran, sidebar, sinkron data Firestore, shortcut keyboard.
import { auth, db, onAuthStateChanged, signInWithEmailAndPassword, signOut, collection, doc, getDoc, onSnapshot, query, where, orderBy, limit, writeBatch } from './firebase.js';
import { $, esc, dkey, toast, closeModal, errMsg } from './util.js';
import { S, st, setParts, views, actions, inputHandlers, changeHandlers, fkeys, go, refresh, can } from './state.js';
import { APP_NAME, APP_VERSION, ROLES, MENUS, HOME, DEFAULT_JASA, DEFAULT_MEKANIK, DEFAULT_TIPE } from './config.js';
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
let loginMsg = '', unsubs = [], ready = {}, need = [];

function showLogin(msg) {
  $('#app-shell').hidden = true; $('#login-screen').hidden = false;
  const m = msg || loginMsg; loginMsg = '';
  $('#login-err').hidden = !m; $('#login-err').textContent = m || '';
  $('#login-btn').disabled = false;
}
$('#login-form').addEventListener('submit', async e => {
  e.preventDefault(); $('#login-btn').disabled = true; $('#login-err').hidden = true;
  try { await signInWithEmailAndPassword(auth, $('#login-email').value.trim(), $('#login-pass').value); }
  catch (err) {
    const m = { 'auth/invalid-credential': 'Email atau kata sandi salah.', 'auth/too-many-requests': 'Terlalu banyak percobaan. Tunggu sebentar.', 'auth/network-request-failed': 'Tidak ada koneksi internet.' };
    showLogin(m[err.code] || err.message);
  }
});
$('#logout').addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, async u => {
  unsubs.forEach(f => f()); unsubs = []; st.loaded = false; ready = {};
  if (!u) { st.petugas = null; st.role = null; showLogin(); return; }
  try {
    const sd = await getDoc(doc(db, 'staff', u.email));
    if (!sd.exists()) { loginMsg = 'Akun ' + u.email + ' belum terdaftar sebagai petugas. Minta admin menambahkan di Master Data → Petugas Login.'; await signOut(auth); return; }
    st.petugas = { email: u.email, ...sd.data() };
    st.role = ROLES[st.petugas.peran] ? st.petugas.peran : null;
    if (!st.role) { loginMsg = 'Peran "' + (st.petugas.peran || '') + '" tidak dikenal. Peran yang valid: ' + Object.keys(ROLES).join(', ') + '.'; await signOut(auth); return; }
  } catch (e) { loginMsg = 'Tidak bisa membaca data petugas: ' + errMsg(e); await signOut(auth); return; }
  $('#login-screen').hidden = true; $('#app-shell').hidden = false;
  $('#who').textContent = st.petugas.nama || st.petugas.email;
  $('#who-role').textContent = ROLES[st.role];
  renderSidebar();
  let last = null; try { last = localStorage.getItem('amu-tab-' + st.role); } catch (e) {}
  st.view = last && can(last) ? last : HOME[st.role];
  go(st.view);
  $('#view').innerHTML = '<div class="loading">Memuat data…</div>';
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
