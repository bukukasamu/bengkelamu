// Titik masuk aplikasi: login + peran, sidebar, sinkron data Firestore, shortcut keyboard.
import './angka.js';   // kolom angka berformat titik ribuan (dimuat paling awal)
import './cari-pilihan.js';   // pilihan panjang: daftar baru muncul setelah mengetik
import { auth, db, onAuthStateChanged, signInWithEmailAndPassword, signOut, collection, doc, getDoc, onSnapshot, query, where, orderBy, limit, writeBatch } from './firebase.js';
import { $, esc, dkey, toast, modal, closeModal, errMsg } from './util.js';
import { S, st, setParts, views, actions, inputHandlers, changeHandlers, fkeys, go, refresh, can, menuLabel, menuGroup, menuAwal } from './state.js';
import { APP_NAME, APP_VERSION, ROLES, MENUS, HOME, DEFAULT_JASA, DEFAULT_MEKANIK, DEFAULT_TIPE, SUPER_ADMIN } from './config.js';
import { loadLoginList, isPinAccount, validPin, gantiPinSendiri } from './akun.js';
import { loadBrand, loaderHTML, gearsSVG } from './brand.js';
import { showNota } from './nota.js';
import { pasangTombol } from './pwa.js';
import { CABANG_UTAMA, cabangList, cabangById, namaCabang, multiCabang, cabAktif, diCabang, stokOf, stokTotal, watchCabang, loadCabang } from './cabang.js';
import { onSearchEnter } from './kasir.js';
import { setLoadedFrom } from './laporan.js';
// Modul menu: cukup diimpor, masing-masing mendaftarkan tampilan & aksinya sendiri.
import './beranda.js';
import './registrasi.js';
import './riwayat.js';
import './insight.js';
import './opname.js';
import './keuangan.js';
import './backup.js';
import './hapus-semua.js';
import { adaAbsenTertunda, cekAbsenTertunda } from './absensi.js';
import { pantauPersetujuan, segarkanBadge } from './persetujuan.js';
import { setPhLoadedFrom } from './penghasilan.js';
import { sah } from './data-trx.js';
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
    if (menuGroup(m) !== group) { group = menuGroup(m); html += `<div class="sb-group">${esc(group)}</div>`; }
    html += `<button class="sb-link" type="button" data-view="${m.id}">${esc(menuLabel(m))}</button>`;
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
  try { [loginList] = await Promise.all([loadLoginList(), loadCabang()]); } catch (e) { loginList = loginList || []; }
  // Dikelompokkan per peran; bila ada beberapa cabang, per cabang + peran (admin/pemilik tidak terikat cabang)
  const multi = multiCabang(), groups = new Map();
  const urut = multi ? [['', 'admin'], ...cabangList().flatMap(c => Object.keys(ROLES).filter(r => r !== 'admin').map(r => [c.id, r]))] : Object.keys(ROLES).map(r => ['', r]);
  urut.forEach(k => groups.set(k.join('|'), []));
  loginList.forEach(p => { const key = (multi && p.peran !== 'admin' ? (p.cabang || CABANG_UTAMA) : '') + '|' + p.peran; (groups.get(key) || groups.set(key, []).get(key)).push(p); });
  const label = key => { const [c, r] = key.split('|'); return (c ? namaCabang(c) + ' · ' : '') + (ROLES[r] || r); };
  let last = ''; try { last = localStorage.getItem('amu-login-id') || ''; } catch (e) {}
  $('#login-nama').innerHTML = loginList.length
    ? '<option value="">Pilih nama</option>' + [...groups.entries()].filter(([, l]) => l.length).map(([k, l]) => `<optgroup label="${esc(label(k))}">${l.map(p => `<option value="${esc(p.id)}" ${p.id === last ? 'selected' : ''}>${esc(p.nama)}</option>`).join('')}</optgroup>`).join('')
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
  // Cabang: karyawan terikat cabangnya; admin/pemilik bisa berpindah (pilihan terakhir diingat di perangkat ini)
  await loadCabang();
  if (st.role === 'admin') { let c = null; try { c = localStorage.getItem('amu-cabang'); } catch (e) {} st.cabang = cabangById(c) ? c : CABANG_UTAMA; }
  else st.cabang = st.petugas.cabang || CABANG_UTAMA;
  if (!cabangById(st.cabang)) st.cabang = CABANG_UTAMA;
  bootDone(); $('#login-screen').hidden = true; $('#app-shell').hidden = false;
  renderCabangBox();
  $('#who').textContent = st.petugas.nama || st.petugas.email;
  $('#who-role').textContent = st.petugas.super ? 'Super Admin' : ROLES[st.role];
  $('#ganti-pin').hidden = !isPinAccount(st.petugas.email);
  try { const ak = await getDoc(doc(db, 'pengaturan', 'akses')); S.akses = ak.exists() ? ak.data() : null; } catch (e) { S.akses = null; }
  renderSidebar();
  let last = null; try { last = localStorage.getItem('amu-tab-' + st.role); } catch (e) {}
  st.view = last && can(last) ? last : menuAwal();
  if (adaAbsenTertunda() && can('absensi') && !st.petugas.super) st.view = 'absensi';
  go(st.view);
  $('#view').innerHTML = loaderHTML('Memuat data bengkel…');
  subscribe();
});

/* ---------- SINKRON DATA (realtime) ---------- */
function subscribe() {
  const now = new Date();
  const from = dkey(new Date(now.getFullYear(), now.getMonth() - 1, 1));   // awal bulan lalu: cukup untuk grafik, laporan & gaji mekanik
  setLoadedFrom(from); setPhLoadedFrom(from);
  const fail = e => { $('#view').innerHTML = '<div class="panel"><div class="err">Gagal memuat data: ' + esc(errMsg(e)) + '</div></div>'; };
  need = ['parts', 'trx', 'wo', 'jasa', 'mekanik', 'settings', 'aturan'];
  if (st.role !== 'admin') need.push('woAktif');
  if (can('pembelian')) need.push('pembelian');
  const mark = k => {
    ready[k] = true;
    if (need.every(n => ready[n])) { if (!st.loaded) { st.loaded = true; seedMaster(); go(st.view); cekAbsenTertunda(); } else refresh(); }
  };
  const sub = (q, k, fn) => unsubs.push(onSnapshot(q, s => { fn(s); terapkanCabang(); mark(k); }, fail));
  sub(collection(db, 'parts'), 'parts', s => { raw.parts = s.docs.map(d => d.data()); });
  sub(collection(db, 'jasa'), 'jasa', s => { S.jasa = s.docs.map(d => ({ id: d.id, ...d.data() })); });
  sub(collection(db, 'mekanik'), 'mekanik', s => { raw.mekanik = s.docs.map(d => ({ id: d.id, ...d.data() })); });
  sub(doc(db, 'meta', 'settings'), 'settings', s => { S.settings = s.exists() ? s.data() : {}; });
  sub(doc(db, 'penghasilan', 'aturan'), 'aturan', s => { S.aturan = s.exists() ? s.data() : null; });
  // Hak akses menu berubah (diatur super admin): perbarui menu tanpa perlu login ulang
  unsubs.push(onSnapshot(doc(db, 'pengaturan', 'akses'), s => {
    const baru = s.exists() ? s.data() : null; if (JSON.stringify(baru) === JSON.stringify(S.akses)) return;
    S.akses = baru; renderSidebar(); segarkanBadge(); if (st.loaded && !can(st.view)) go(st.view); else document.querySelectorAll('.sb-link').forEach(b => { if (b.dataset.view === st.view) b.setAttribute('aria-current', 'page'); });
  }, () => {}));
  if (st.role === 'admin') {
    // Admin & super admin: semua cabang (disaring di perangkat saat pindah cabang)
    sub(query(collection(db, 'trx'), where('tgl', '>=', from)), 'trx', s => { raw.trx = s.docs.map(d => d.data()).sort((a, b) => a.tgl.localeCompare(b.tgl)); });
    sub(query(collection(db, 'wo'), orderBy('tgl', 'desc'), limit(400)), 'wo', s => { raw.wo = s.docs.map(d => d.data()).reverse(); });
    if (can('pembelian')) sub(query(collection(db, 'pembelian'), orderBy('input', 'desc'), limit(300)), 'pembelian', s => { raw.pembelian = s.docs.map(d => d.data()); });
  } else {
    // Karyawan: hanya data cabangnya (dikunci juga oleh aturan database). Dua bulan terakhir + WO yang masih aktif.
    const cab = cabAktif(), bulan = [from.slice(0, 7), dkey(now).slice(0, 7)];
    sub(query(collection(db, 'trx'), where('cabang', '==', cab), where('bulan', 'in', bulan)), 'trx', s => { raw.trx = s.docs.map(d => d.data()).sort((a, b) => a.tgl.localeCompare(b.tgl)); });
    let woBulan = [], woAktif = [];
    const gabungWo = () => { const m = new Map(); [...woBulan, ...woAktif].forEach(w => m.set(w.no, w)); raw.wo = [...m.values()].sort((a, b) => a.tgl.localeCompare(b.tgl)); };
    sub(query(collection(db, 'wo'), where('cabang', '==', cab), where('bulan', 'in', bulan)), 'wo', s => { woBulan = s.docs.map(d => d.data()); gabungWo(); });
    sub(query(collection(db, 'wo'), where('cabang', '==', cab), where('aktif', '==', true)), 'woAktif', s => { woAktif = s.docs.map(d => d.data()); gabungWo(); });
    if (can('pembelian')) sub(query(collection(db, 'pembelian'), where('cabang', '==', cab)), 'pembelian', s => { raw.pembelian = s.docs.map(d => d.data()).sort((a, b) => String(b.input).localeCompare(String(a.input))); });
  }
  pantauPersetujuan(unsubs);
  unsubs.push(watchCabang(() => { if (!cabangById(st.cabang)) st.cabang = CABANG_UTAMA; renderCabangBox(); if (st.loaded) { terapkanCabang(); refresh(); } }));
}

/* ---------- CABANG ----------
   Data mentah semua cabang disimpan di "raw"; S.* berisi data cabang yang sedang dipakai.
   S.woSemua / S.trxSemua tetap berisi semua cabang (untuk laporan gabungan dan pencarian konsumen). */
const raw = { parts: [], trx: [], wo: [], mekanik: [], pembelian: [] };
function terapkanCabang() {
  const cab = cabAktif(), ini = d => diCabang(d, cab);
  setParts(raw.parts.map(p => ({ ...p, stok: stokOf(p, cab), stokSemua: stokTotal(p) })));
  const sahTrx = raw.trx.filter(sah);
  S.trxBatal = raw.trx.filter(t => !sah(t) && ini(t));
  S.trxSemua = sahTrx; S.trx = sahTrx.filter(ini);
  S.woSemua = raw.wo; S.wo = raw.wo.filter(ini);
  S.mekanikSemua = raw.mekanik; S.mekanik = raw.mekanik.filter(ini);
  S.pembelian = raw.pembelian.filter(ini);
}
function renderCabangBox() {
  const el = $('#cabang-box'); if (!el) return;
  if (!multiCabang() && cabAktif() === CABANG_UTAMA) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = st.role === 'admin'
    ? `<label class="cabang-pilih"><span>Cabang</span><select id="cabang-pilih" aria-label="Pindah cabang">${cabangList().map(c => `<option value="${esc(c.id)}" ${c.id === cabAktif() ? 'selected' : ''}>${esc(c.nama)}</option>`).join('')}</select></label>`
    : `<span class="cabang-tag" title="Cabang Anda">${esc(namaCabang(cabAktif()))}</span>`;
}
document.addEventListener('change', e => {
  if (e.target.id !== 'cabang-pilih') return;
  st.cabang = e.target.value; try { localStorage.setItem('amu-cabang', st.cabang); } catch (err) {}
  // draf yang sedang diisi milik cabang sebelumnya
  st.regDraft = null; st.orderNo = null; st.orderDraft = null; st.bayarNo = null; st.bayarDraft = null; st.pbDraft = null; st.partEdit = null;
  terapkanCabang(); go(st.view); toast('Pindah ke cabang ' + namaCabang(st.cabang));
});

// Admin pertama kali: isi jasa, mekanik, tipe motor default supaya registrasi langsung bisa dipakai
async function seedMaster() {
  if (!st.petugas?.super || S.jasa.length || S.mekanik.length || S.settings.tipe || S.settings.dikosongkan) return;
  try {
    const b = writeBatch(db);
    DEFAULT_JASA.forEach(([nama, harga], i) => b.set(doc(collection(db, 'jasa')), { nama, harga, aktif: true, urut: i }));
    DEFAULT_MEKANIK.forEach(nama => b.set(doc(collection(db, 'mekanik')), { nama, email: '', aktif: true }));
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
  else toast(k === 'baru' ? 'Tidak ada data baru di halaman ini' : k === 'cari' ? 'Tidak ada pencarian di halaman ini' : 'Tidak ada yang perlu disimpan di halaman ini');
}
$('#fk-baru').onclick = () => fk('baru');
$('#fk-simpan').onclick = () => fk('simpan');
$('#fk-cetak').onclick = () => fk('cetak');
if ($('#fk-cari')) $('#fk-cari').onclick = () => fk('cari');

document.addEventListener('keydown', e => {
  if ($('#app-shell').hidden) return;
  if (e.key === 'Enter' && e.target.classList?.contains('row-click')) { actions[e.target.dataset.act]?.(e.target); return; }
  if (e.key === 'Escape') { if ($('#modal-root').innerHTML) closeModal(); else if (document.body.classList.contains('sb-open')) toggleSidebar(); return; }
  if (e.key === 'Enter' && e.target.id === 'k-q') { e.preventDefault(); onSearchEnter(e.target); return; }
  if (e.key === 'Enter' && e.target.id === 'r-cari') { e.preventDefault(); actions['reg-cari'](); return; }
  if (e.key === 'F1') { e.preventDefault(); fk('baru'); }
  if (e.key === 'F2') { e.preventDefault(); fk('simpan'); }
  if (e.key === 'F3') { e.preventDefault(); fk('cari'); }
  if (e.key === 'F8') { e.preventDefault(); fk('cetak'); }
});

/* ---------- JAM ---------- */
const tick = () => { $('#clock').textContent = new Date().toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
tick(); setInterval(tick, 30000);

// Pasang aplikasi (PWA) di HP / PC
const petunjukPasang = t => modal(`<h3>Pasang aplikasi</h3><p style="margin:0">${esc(t)}</p><div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-close="1" data-autofocus>Mengerti</button></div>`);
pasangTombol($('#pasang-app'), petunjukPasang);
pasangTombol($('#pasang-login'), petunjukPasang);
