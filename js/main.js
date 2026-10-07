// Titik masuk aplikasi: login, sinkron data Firestore, navigasi, shortcut keyboard.
import { auth, db, onAuthStateChanged, signInWithEmailAndPassword, signOut, collection, doc, getDoc, onSnapshot, query, where, orderBy, limit } from './firebase.js';
import { $, esc, dkey, toast, closeModal, errMsg } from './util.js';
import { S, st, setParts, views, actions, inputHandlers, changeHandlers, fkeys, go, refresh } from './state.js';
import { showNota } from './nota.js';
import { onSearchEnter } from './kasir.js';
// Modul menu: cukup diimpor, masing-masing mendaftarkan tampilan & aksinya sendiri.
import './beranda.js';
import './servis.js';
import './stok.js';
import './laporan.js';
import './import-excel.js';

/* ---------- LOGIN ---------- */
let loginMsg = '', unsubs = [], ready = {};

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
  if (!u) { st.petugas = null; showLogin(); return; }
  try {
    const sd = await getDoc(doc(db, 'staff', u.email));
    if (!sd.exists()) { loginMsg = 'Akun ' + u.email + ' belum terdaftar sebagai petugas. Minta admin menambahkan dokumen staff/' + u.email + ' di Firestore.'; await signOut(auth); return; }
    st.petugas = { email: u.email, ...sd.data() };
  } catch (e) { loginMsg = 'Tidak bisa membaca data petugas: ' + errMsg(e); await signOut(auth); return; }
  $('#login-screen').hidden = true; $('#app-shell').hidden = false;
  $('#who').textContent = st.petugas.nama || st.petugas.email;
  $('#view').innerHTML = '<div class="loading">Memuat data…</div>';
  subscribe();
});

/* ---------- SINKRON DATA (realtime) ---------- */
function subscribe() {
  const now = new Date();
  const d7 = new Date(now); d7.setDate(d7.getDate() - 6);
  const awalBulan = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = dkey(d7 < awalBulan ? d7 : awalBulan);   // cukup untuk grafik 7 hari & laporan bulan ini
  const fail = e => { $('#view').innerHTML = '<div class="panel"><div class="err">Gagal memuat data: ' + esc(errMsg(e)) + '</div></div>'; };
  const mark = k => {
    ready[k] = true;
    if (ready.parts && ready.trx && ready.wo) { if (!st.loaded) { st.loaded = true; go(st.view); } else refresh(); }
  };
  unsubs.push(onSnapshot(collection(db, 'parts'), s => { setParts(s.docs.map(d => d.data())); mark('parts'); }, fail));
  unsubs.push(onSnapshot(query(collection(db, 'trx'), where('tgl', '>=', from)), s => { S.trx = s.docs.map(d => d.data()).sort((a, b) => a.tgl.localeCompare(b.tgl)); mark('trx'); }, fail));
  unsubs.push(onSnapshot(query(collection(db, 'wo'), orderBy('tgl', 'desc'), limit(150)), s => { S.wo = s.docs.map(d => d.data()).reverse(); mark('wo'); }, fail));
}

/* ---------- EVENT ---------- */
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => go(t.dataset.view)));
$('#modal-root').addEventListener('click', e => { if (e.target.dataset.close) closeModal(); });

document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && actions[el.dataset.act]) actions[el.dataset.act](el);
});
document.addEventListener('input', e => inputHandlers.forEach(h => h(e)));
document.addEventListener('change', e => changeHandlers.forEach(h => h(e)));

function fk(k) {
  if (!st.loaded) return;
  if (k === 'cetak') { showNota(st.lastNota || S.trx[S.trx.length - 1]); return; }
  let a = fkeys[st.view] && fkeys[st.view][k];
  if (typeof a === 'function') a = a();
  if (a) actions[a]({ dataset: {} });
  else if (k === 'baru') go('kasir');
  else toast('Tidak ada yang perlu disimpan di halaman ini');
}
$('#fk-baru').onclick = () => fk('baru');
$('#fk-simpan').onclick = () => fk('simpan');
$('#fk-cetak').onclick = () => fk('cetak');

document.addEventListener('keydown', e => {
  if ($('#app-shell').hidden) return;
  if (e.key === 'Enter' && e.target.classList?.contains('row-click')) { actions[e.target.dataset.act]?.(e.target); return; }
  if (e.key === 'Escape' && $('#modal-root').innerHTML) { closeModal(); return; }
  if (e.key === 'Enter' && e.target.id === 'k-q') { e.preventDefault(); onSearchEnter(e.target); return; }
  if (e.key === 'F1') { e.preventDefault(); fk('baru'); }
  if (e.key === 'F2') { e.preventDefault(); fk('simpan'); }
  if (e.key === 'F8') { e.preventDefault(); fk('cetak'); }
});

/* ---------- JAM & MENU TERAKHIR ---------- */
const tick = () => { $('#clock').textContent = new Date().toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
tick(); setInterval(tick, 30000);
try { const t = localStorage.getItem('amu-tab'); if (views[t]) st.view = t; } catch (e) {}
go(st.view);
