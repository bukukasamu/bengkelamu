// Aceh Mitra Utama POS — Sparepart & Bengkel Yamaha
// Data disimpan di Cloud Firestore, login petugas memakai Firebase Authentication (email + kata sandi).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, doc, getDoc, onSnapshot, query, where, orderBy, limit,
  runTransaction, setDoc, updateDoc, addDoc, increment, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);

/* ---------- KONSTANTA (silakan sesuaikan) ---------- */
const JASA = [['Ganti Oli',15000],['Servis Ringan',45000],['Servis CVT',55000],['Tune Up Injeksi',85000],['Ganti Kampas Rem',20000],['Servis Rem',30000],['Bongkar Pasang Ban',20000],['Cek Kelistrikan',35000]];
const MEKANIK = ['Fauzan','Rizki','Mahdi','T. Iqbal'];
const TIPE = ['NMAX 155','Aerox 155','Lexi','Fazzio','Grand Filano','Gear 125','Mio M3','Fino','X-Ride','Jupiter Z1','Vega Force','MX King 150','Vixion','R15','XSR 155'];
const KAT = ['Oli','Rem','CVT','Pengapian','Filter','Kelistrikan','Penggerak','Ban'];
const STATUS = {Antri:'p-warn',Dikerjakan:'p-info',Selesai:'p-good',Lunas:'p-good'};
const SEED_PARTS = [
 ['YML-SM08','Oli Yamalube Super Matic 0,8 L','Oli','Semua matic',38000,48000,42,12,'A1'],
 ['YML-SP10','Oli Yamalube Sport 1 L','Oli','Vixion, R15, MX King',52000,65000,18,8,'A1'],
 ['YML-GO10','Oli Gardan Yamalube 100 ml','Oli','Semua matic',12000,17000,30,10,'A1'],
 ['KRD-NMX','Kampas Rem Depan NMAX/Aerox','Rem','NMAX, Aerox, Lexi',58000,78000,9,6,'B2'],
 ['KRB-MIO','Kampas Rem Belakang Mio/Fino','Rem','Mio M3, Fino, Gear',32000,45000,4,6,'B2'],
 ['VB-NMX','V-Belt NMAX 155','CVT','NMAX 155',245000,310000,5,3,'C1'],
 ['VB-AEX','V-Belt Aerox 155','CVT','Aerox 155',250000,315000,2,3,'C1'],
 ['RL-MIO','Roller Set Mio/Gear','CVT','Mio M3, Gear 125',48000,65000,11,5,'C2'],
 ['KPL-MIO','Kampas Kopling Ganda Mio','CVT','Mio M3, Fino',95000,125000,4,3,'C2'],
 ['BSI-CPR','Busi CPR8EA-9','Pengapian','Mio, Fino, Jupiter',18000,25000,36,10,'D1'],
 ['BSI-LMR','Busi LMAR8A-9','Pengapian','NMAX, Aerox, R15',42000,58000,14,6,'D1'],
 ['FU-NMX','Filter Udara NMAX','Filter','NMAX 155',55000,72000,7,4,'D2'],
 ['FU-MIO','Filter Udara Mio M3','Filter','Mio M3, Gear',38000,52000,3,4,'D2'],
 ['FO-VIX','Filter Oli Vixion/R15','Filter','Vixion, R15, MX King',22000,32000,10,5,'D2'],
 ['AKI-5S','Aki GTZ5S','Kelistrikan','Mio, Fino, Gear, Lexi',215000,265000,6,3,'E1'],
 ['AKI-6V','Aki GTZ6V','Kelistrikan','NMAX, Aerox',285000,345000,3,2,'E1'],
 ['LMP-DPN','Bohlam Depan 12V 25/25W','Kelistrikan','Jupiter, Vega',15000,22000,20,8,'E2'],
 ['RTS-VIX','Rantai Set Vixion','Penggerak','Vixion',290000,365000,2,2,'F1'],
 ['BAN-9014','Ban Luar 90/90-14','Ban','Mio, Fino, Gear (belakang)',185000,230000,8,4,'G1'],
 ['BAN-1113','Ban Luar 110/70-13','Ban','NMAX (depan)',265000,320000,5,3,'G1']
].map(([kode,nama,kategori,cocok,beli,jual,stok,min,rak])=>({kode,nama,kategori,cocok,beli,jual,stok,min,rak}));

/* ---------- UTIL ---------- */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rp = n => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
const pad = n => String(n).padStart(2, '0');
const dkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const stamp = d => dkey(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
const HARI = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- STATE ---------- */
let S = { parts: [], trx: [], wo: [] };
let ready = { parts: false, trx: false, wo: false }, loaded = false, unsubs = [];
let petugas = null, loginMsg = '';
let view = 'beranda';
let cart = { items: [], pelanggan: '', diskon: 0, bayar: 0 };
let woDraft = null, stokQ = '', stokKat = '', stokLow = false, partEdit = null, lapRange = 'hari';
let lastNota = null, saving = false;
const part = k => S.parts.find(p => p.kode === k);
const namaPetugas = () => (petugas && (petugas.nama || petugas.email)) || '';

function toast(msg) { const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role','status'); el.textContent = msg; document.body.appendChild(el); setTimeout(() => el.remove(), 2800); }
function modal(html) { $('#modal-root').innerHTML = '<div class="modal-bg" data-close="1"><div class="modal" role="dialog" aria-modal="true">' + html + '</div></div>'; const f = $('#modal-root [data-autofocus]') || $('#modal-root button'); f && f.focus(); }
function closeModal() { $('#modal-root').innerHTML = ''; }
$('#modal-root').addEventListener('click', e => { if (e.target.dataset.close) closeModal(); });
function errMsg(e) {
  const m = { 'permission-denied': 'Akses ditolak. Pastikan akun terdaftar di koleksi staff.', 'unavailable': 'Koneksi ke server terputus. Coba lagi.' };
  return m[e && e.code] || (e && e.message) || 'Terjadi kesalahan';
}

/* ---------- LOGIN ---------- */
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
  unsubs.forEach(f => f()); unsubs = []; loaded = false; ready = { parts: false, trx: false, wo: false };
  if (!u) { petugas = null; showLogin(); return; }
  try {
    const st = await getDoc(doc(db, 'staff', u.email));
    if (!st.exists()) { loginMsg = 'Akun ' + u.email + ' belum terdaftar sebagai petugas. Minta admin menambahkan dokumen staff/' + u.email + ' di Firestore.'; await signOut(auth); return; }
    petugas = { email: u.email, ...st.data() };
  } catch (e) { loginMsg = 'Tidak bisa membaca data petugas: ' + errMsg(e); await signOut(auth); return; }
  $('#login-screen').hidden = true; $('#app-shell').hidden = false;
  $('#who').textContent = namaPetugas();
  $('#view').innerHTML = '<div class="loading">Memuat data…</div>';
  subscribe();
});

function subscribe() {
  const now = new Date();
  const d7 = new Date(now); d7.setDate(d7.getDate() - 6);
  const awalBulan = new Date(now.getFullYear(), now.getMonth(), 1);
  const from = dkey(d7 < awalBulan ? d7 : awalBulan);
  const fail = e => { $('#view').innerHTML = '<div class="panel"><div class="err">Gagal memuat data: ' + esc(errMsg(e)) + '</div></div>'; };
  const mark = k => { ready[k] = true; if (ready.parts && ready.trx && ready.wo) { if (!loaded) { loaded = true; go(view); } else refresh(); } };
  unsubs.push(onSnapshot(collection(db, 'parts'), s => { S.parts = s.docs.map(d => d.data()).sort((a, b) => a.kode.localeCompare(b.kode)); mark('parts'); }, fail));
  unsubs.push(onSnapshot(query(collection(db, 'trx'), where('tgl', '>=', from)), s => { S.trx = s.docs.map(d => d.data()).sort((a, b) => a.tgl.localeCompare(b.tgl)); mark('trx'); }, fail));
  unsubs.push(onSnapshot(query(collection(db, 'wo'), orderBy('tgl', 'desc'), limit(150)), s => { S.wo = s.docs.map(d => d.data()).reverse(); mark('wo'); }, fail));
}
// Saat data berubah dari kasir lain: perbarui tampilan tanpa menghapus isian form yang sedang diketik.
function refresh() {
  if (!loaded) return;
  if (view === 'beranda') renderBeranda();
  else if (view === 'laporan') renderLaporan();
  else if (view === 'kasir') { cart.items = cart.items.filter(x => part(x.kode)); renderKRes(); renderCart(); }
  else if (view === 'servis') renderWoList();
  else if (view === 'stok') renderSTbl();
}

/* ---------- PENOMORAN (atomik di dalam transaksi) ---------- */
function nextNumber(snap, prefix) {
  const today = dkey(new Date());
  let c = snap.exists() ? snap.data() : {};
  if (c.day !== today) c = { ...c, day: today, PJ: 0, SV: 0 };
  if (prefix === 'WO') { const n = (c.WO || 0) + 1; return { no: 'WO-' + String(n).padStart(4, '0'), counter: { ...c, WO: n } }; }
  const n = (c[prefix] || 0) + 1;
  return { no: prefix + '-' + today.slice(2).replace(/-/g, '') + '-' + String(n).padStart(3, '0'), counter: { ...c, [prefix]: n } };
}
const counterRef = () => doc(db, 'meta', 'counter');

/* ---------- NOTA ---------- */
function notaText(t) {
  const W = 38, line = '-'.repeat(W);
  const lr = (l, r) => { l = String(l); r = String(r); const sp = W - l.length - r.length; return sp > 0 ? l + ' '.repeat(sp) + r : l.slice(0, W - r.length - 1) + ' ' + r; };
  const n = x => Math.round(x).toLocaleString('id-ID');
  const c = s => ' '.repeat(Math.max(0, Math.floor((W - s.length) / 2))) + s;
  const o = [c('ACEH MITRA UTAMA'), c('Sparepart & Bengkel Yamaha'), line,
    lr('No', t.no), lr('Tanggal', t.tgl), lr('Pelanggan', (t.pelanggan || 'Umum').slice(0, 22))];
  if (t.nopol) o.push(lr('Nopol', t.nopol));
  if (t.mekanik) o.push(lr('Mekanik', t.mekanik));
  if (t.kasir) o.push(lr('Kasir', String(t.kasir).slice(0, 26)));
  o.push(line);
  t.items.forEach(x => { o.push(x.nama.slice(0, W)); o.push(lr('  ' + x.qty + ' x ' + n(x.harga), n(x.qty * x.harga))); });
  if (t.jasa.length) { o.push('JASA:'); t.jasa.forEach(j => o.push(lr('  ' + j.nama, n(j.harga)))); }
  o.push(line, lr('Subtotal', n(t.total + t.diskon)));
  if (t.diskon) o.push(lr('Diskon', '-' + n(t.diskon)));
  o.push(lr('TOTAL', n(t.total)), lr('Bayar', n(t.bayar)), lr('Kembali', n(t.bayar - t.total)), line, c('Terima kasih'), c('Barang yang sudah dibeli'), c('tidak dapat dikembalikan'));
  return o.join('\n');
}
function showNota(t) {
  if (!t) { toast('Belum ada nota untuk dicetak'); return; }
  modal('<div class="row spread"><h2>Nota ' + esc(t.no) + '</h2><span class="pill p-good">Tersimpan</span></div><div class="nota" id="nota-text">' + esc(notaText(t)) + '</div><div class="row" style="justify-content:flex-end"><button class="btn" data-act="print" type="button">Cetak</button><button class="btn pri" data-close="1" type="button">Tutup</button></div>');
}
function printNota() {
  const w = window.open('', '_blank', 'width=420,height=640');
  if (!w) { toast('Pop-up diblokir browser. Izinkan pop-up untuk mencetak.'); return; }
  w.document.write('<pre style="font:12px/1.4 monospace;margin:0">' + $('#nota-text').innerHTML + '</pre>');
  w.document.close(); w.focus(); w.print(); w.close();
}

/* ---------- BERANDA ---------- */
function trxIn(from, to) { return S.trx.filter(t => t.tgl.slice(0, 10) >= from && t.tgl.slice(0, 10) <= to); }
function sums(list) {
  let p = 0, jasa = 0, dis = 0, laba = 0, qty = 0;
  list.forEach(t => { t.items.forEach(x => { p += x.qty * x.harga; laba += x.qty * (x.harga - (x.beli || 0)); qty += x.qty; }); t.jasa.forEach(j => jasa += j.harga); dis += t.diskon; });
  return { part: p, jasa, dis, laba: laba + jasa - dis, qty, total: p + jasa - dis, n: list.length };
}
function chartSVG() {
  const days = [], now = new Date();
  for (let b = 6; b >= 0; b--) { const d = new Date(now); d.setDate(d.getDate() - b); const s = sums(trxIn(dkey(d), dkey(d))); days.push({ lbl: b === 0 ? 'Hari ini' : HARI[d.getDay()] + ' ' + d.getDate(), part: s.part, jasa: s.jasa }); }
  const max = Math.max(...days.map(d => d.part + d.jasa), 1);
  const step = [100000,250000,500000,1000000,2000000,5000000,10000000,25000000].find(s => s * 4 >= max) || 50000000, top = step * 4;
  const W = 640, H = 230, L = 58, R = 10, T = 12, B = 30, cw = (W - L - R) / 7, bw = Math.min(46, cw * .55);
  const y = v => T + (H - T - B) * (1 - v / top);
  let g = '';
  for (let i = 0; i <= 4; i++) { const v = step * i; g += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)" stroke-width="1"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${v >= 1e6 ? (v / 1e6).toLocaleString('id-ID') + ' jt' : v / 1000 + ' rb'}</text>`; }
  days.forEach((d, i) => {
    const x = L + cw * i + (cw - bw) / 2, hp = y(0) - y(d.part), hj = y(0) - y(d.jasa);
    g += `<rect x="${x}" y="${y(d.part)}" width="${bw}" height="${hp}" fill="var(--accent)" rx="2"><title>${d.lbl}: part ${rp(d.part)}</title></rect>`;
    g += `<rect x="${x}" y="${y(d.part) - hj}" width="${bw}" height="${hj}" fill="var(--jasa)" rx="2"><title>${d.lbl}: jasa ${rp(d.jasa)}</title></rect>`;
    g += `<text x="${x + bw / 2}" y="${H - 10}" text-anchor="middle"${i === 6 ? ' style="fill:var(--ink);font-weight:500"' : ''}>${d.lbl}</text>`;
  });
  return `<div style="overflow-x:auto"><svg class="chart" viewBox="0 0 ${W} ${H}" width="100%" style="min-width:420px;display:block" role="img" aria-label="Omzet 7 hari terakhir">${g}</svg></div>`;
}
function renderBeranda() {
  const t = dkey(new Date()), s = sums(trxIn(t, t));
  const low = S.parts.filter(p => p.stok <= p.min);
  const woToday = S.wo.filter(w => w.tgl.slice(0, 10) === t);
  const aktif = S.wo.filter(w => w.status !== 'Lunas');
  const seedBox = S.parts.length ? '' : `<div class="panel"><h3>Database masih kosong</h3><p style="margin:0">Belum ada data part. Tambahkan part sendiri di menu Stok Part, atau isi 20 part contoh untuk mencoba.</p><div class="row"><button class="btn pri" type="button" data-act="seed">Isi 20 part contoh</button><button class="btn" type="button" data-act="go-stok">Tambah part sendiri</button></div></div>`;
  $('#view').innerHTML = `<div class="grid">${seedBox}
   <div class="tiles">
    <div class="tile"><span class="lbl">Omzet hari ini</span><span class="val">${rp(s.total)}</span><span class="sub">${s.n} transaksi</span></div>
    <div class="tile"><span class="lbl">Part terjual</span><span class="val">${s.qty} pcs</span><span class="sub">${rp(s.part)}</span></div>
    <div class="tile"><span class="lbl">Motor masuk bengkel</span><span class="val">${woToday.length} unit</span><span class="sub">${aktif.length} belum lunas</span></div>
    <div class="tile"><span class="lbl">Stok menipis</span><span class="val" style="color:${low.length ? 'var(--bad)' : 'inherit'}">${low.length} item</span><span class="sub">di bawah stok minimum</span></div>
   </div>
   <div class="panel"><div class="row spread"><h3>Omzet 7 hari terakhir</h3><div class="legend"><span><i style="background:var(--accent)"></i>Sparepart</span><span><i style="background:var(--jasa)"></i>Jasa servis</span></div></div>${chartSVG()}</div>
   <div class="grid g2">
    <div class="panel"><div class="row spread"><h3>Antrian bengkel</h3><button class="btn sm" data-act="go-servis" type="button">Buka Servis</button></div>
     ${aktif.length ? `<div class="tw"><table><thead><tr><th>Nopol</th><th>Motor</th><th>Mekanik</th><th>Status</th></tr></thead><tbody>${aktif.map(w => `<tr class="row-click" tabindex="0" data-act="open-wo" data-no="${esc(w.no)}"><td class="mono">${esc(w.nopol)}</td><td>${esc(w.tipe)}</td><td>${esc(w.mekanik || '–')}</td><td><span class="pill ${STATUS[w.status]}">${w.status}</span></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Tidak ada motor dalam antrian.</div>'}
    </div>
    <div class="panel"><div class="row spread"><h3>Perlu dipesan ulang</h3><button class="btn sm" data-act="go-low" type="button">Lihat stok</button></div>
     ${low.length ? `<div class="tw"><table><thead><tr><th>Kode</th><th>Part</th><th class="r">Stok</th><th class="r">Min</th></tr></thead><tbody>${low.map(p => `<tr><td class="mono">${esc(p.kode)}</td><td>${esc(p.nama)}</td><td class="r"><span class="pill p-bad">${p.stok}</span></td><td class="r num">${p.min}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Semua stok aman.</div>'}
    </div>
   </div></div>`;
}
async function seedParts() {
  if (S.parts.length || saving) return; saving = true;
  try { const b = writeBatch(db); SEED_PARTS.forEach(p => b.set(doc(db, 'parts', p.kode), p)); await b.commit(); toast('20 part contoh ditambahkan'); }
  catch (e) { toast(errMsg(e)); } finally { saving = false; }
}

/* ---------- KASIR ---------- */
function searchParts(q) { q = q.trim().toLowerCase(); if (!q) return S.parts.slice(0, 8); return S.parts.filter(p => (p.kode + ' ' + p.nama + ' ' + p.cocok).toLowerCase().includes(q)).slice(0, 8); }
function renderKasir() {
  $('#view').innerHTML = `<div class="grid g-kasir">
   <div class="panel"><h3>Cari part</h3>
    <label class="f" for="k-q">Scan barcode / ketik kode, nama, atau tipe motor<input id="k-q" placeholder="mis. NMAX, busi, YML-SM08" autocomplete="off"></label>
    <div class="results" id="k-res"></div>
    <p class="small muted" style="margin:0">Tekan Enter untuk menambahkan hasil teratas, seperti saat scan barcode.</p>
   </div>
   <div class="panel"><div class="row spread"><h3>Penjualan sparepart</h3><span class="small muted">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
    <div class="form"><label class="f wide" for="k-pel">Pelanggan / bengkel<input id="k-pel" placeholder="Umum" value="${esc(cart.pelanggan)}"></label></div>
    <div id="k-cart"></div>
    <div class="form"><label class="f" for="k-dis">Diskon (Rp)<input id="k-dis" class="num" type="number" min="0" step="1000" value="${cart.diskon || ''}"></label><label class="f" for="k-bayar">Dibayar (Rp)<input id="k-bayar" class="num" type="number" min="0" step="1000" value="${cart.bayar || ''}"></label></div>
    <div id="k-tot"></div>
    <div class="row" style="justify-content:flex-end"><button class="btn" data-act="cart-clear" type="button">Kosongkan</button><button class="btn pri" data-act="cart-save" type="button">Simpan &amp; Cetak Nota [F2]</button></div>
   </div></div>`;
  renderKRes(); renderCart();
}
function renderKRes() {
  if (!$('#k-res')) return;
  const r = searchParts($('#k-q') ? $('#k-q').value : '');
  $('#k-res').innerHTML = r.length ? r.map(p => `<button class="res" type="button" data-act="add" data-k="${esc(p.kode)}"><span><span class="nm">${esc(p.nama)}</span><br><span class="sub"><span class="mono">${esc(p.kode)}</span> · ${esc(p.cocok)} · rak ${esc(p.rak)}</span></span><span style="text-align:right"><span class="num">${rp(p.jual)}</span><br><span class="pill ${p.stok <= 0 ? 'p-bad' : p.stok <= p.min ? 'p-warn' : 'p-good'}">stok ${p.stok}</span></span></button>`).join('') : '<div class="empty">Part tidak ditemukan.</div>';
}
function cartTotal() { const sub = cart.items.reduce((a, x) => a + x.qty * (part(x.kode)?.jual || 0), 0); return { sub, total: Math.max(0, sub - (cart.diskon || 0)) }; }
function renderCart() {
  if (!$('#k-cart')) return;
  $('#k-cart').innerHTML = cart.items.length ? `<div class="tw"><table><thead><tr><th>Part</th><th>Qty</th><th class="r">Harga</th><th class="r">Jumlah</th><th></th></tr></thead><tbody>${cart.items.map(x => { const p = part(x.kode); return `<tr><td>${esc(p.nama)}<br><span class="small muted mono">${esc(p.kode)}</span></td><td><span class="qty"><button type="button" data-act="dec" data-k="${esc(p.kode)}" aria-label="Kurangi">−</button><span class="num" style="min-width:22px;text-align:center">${x.qty}</span><button type="button" data-act="inc" data-k="${esc(p.kode)}" aria-label="Tambah">+</button></span></td><td class="r num">${rp(p.jual)}</td><td class="r num">${rp(p.jual * x.qty)}</td><td><button class="btn sm ghost" type="button" data-act="rm" data-k="${esc(p.kode)}" aria-label="Hapus">✕</button></td></tr>`; }).join('')}</tbody></table></div>` : '<div class="empty" style="border:1px dashed var(--line);border-radius:6px">Keranjang kosong. Pilih part di sebelah kiri.</div>';
  renderKTot();
}
function renderKTot() {
  if (!$('#k-tot')) return;
  const { sub, total } = cartTotal(), kb = (cart.bayar || 0) - total;
  $('#k-tot').innerHTML = `<div class="totals"><span class="muted">Subtotal</span><span class="num">${rp(sub)}</span><span class="muted">Diskon</span><span class="num">${cart.diskon ? '−' + rp(cart.diskon) : rp(0)}</span><span style="font-weight:600">Total</span><span class="big num">${rp(total)}</span><span class="muted">Kembalian</span><span class="num" style="color:${cart.bayar && kb < 0 ? 'var(--bad)' : 'inherit'}">${cart.bayar ? (kb < 0 ? 'Kurang ' + rp(-kb) : rp(kb)) : '–'}</span></div>`;
}
function addToCart(k) {
  const p = part(k), it = cart.items.find(x => x.kode === k), q = (it ? it.qty : 0) + 1;
  if (q > p.stok) { toast('Stok ' + p.nama + ' tinggal ' + p.stok); return; }
  it ? it.qty++ : cart.items.push({ kode: k, qty: 1 }); renderCart();
}
async function saveSale() {
  if (saving) return;
  if (!cart.items.length) { toast('Keranjang masih kosong'); return; }
  if ((cart.bayar || 0) < cartTotal().total) { toast('Uang dibayar kurang dari total'); $('#k-bayar')?.focus(); return; }
  saving = true;
  try {
    const diskon = cart.diskon || 0, bayar = cart.bayar || 0;
    const t = await runTransaction(db, async tx => {
      const cs = await tx.get(counterRef());
      const refs = cart.items.map(x => doc(db, 'parts', x.kode));
      const ps = await Promise.all(refs.map(r => tx.get(r)));
      const items = cart.items.map((x, i) => {
        if (!ps[i].exists()) throw new Error('Part ' + x.kode + ' sudah dihapus');
        const p = ps[i].data();
        if (p.stok < x.qty) throw new Error('Stok ' + p.nama + ' tinggal ' + p.stok);
        return { kode: p.kode, nama: p.nama, qty: x.qty, harga: p.jual, beli: p.beli };
      });
      const total = Math.max(0, items.reduce((a, x) => a + x.qty * x.harga, 0) - diskon);
      if (bayar < total) throw new Error('Uang dibayar kurang dari total');
      const { no, counter } = nextNumber(cs, 'PJ');
      const trx = { no, tgl: stamp(new Date()), jenis: 'PART', pelanggan: cart.pelanggan.trim() || 'Umum', nopol: '', items, jasa: [], diskon, total, bayar, kasir: namaPetugas() };
      tx.set(counterRef(), counter);
      items.forEach((x, i) => tx.update(refs[i], { stok: ps[i].data().stok - x.qty }));
      tx.set(doc(db, 'trx', no), { ...trx, dibuat: serverTimestamp() });
      return trx;
    });
    lastNota = t; cart = { items: [], pelanggan: '', diskon: 0, bayar: 0 }; renderKasir(); showNota(t);
  } catch (e) { toast(errMsg(e)); } finally { saving = false; }
}

/* ---------- SERVIS ---------- */
const blankWo = () => ({ no: null, tgl: stamp(new Date()), nopol: '', nama: '', hp: '', tipe: '', km: '', keluhan: '', mekanik: '', jasa: [], parts: [], status: 'Antri' });
function woCalc(w) { const p = w.parts.reduce((a, x) => a + x.qty * (part(x.kode)?.jual || 0), 0); const j = w.jasa.reduce((a, n) => a + (JASA.find(x => x[0] === n) || [0, 0])[1], 0); return { p, j, total: p + j }; }
function renderWoList() {
  const el = $('#wo-list'); if (!el) return; const w = woDraft;
  el.innerHTML = [...S.wo].reverse().map(o => `<button class="wo" type="button" data-act="open-wo" data-no="${esc(o.no)}" aria-current="${o.no === w.no}"><span class="row spread"><span class="np">${esc(o.nopol)}</span><span class="pill ${STATUS[o.status]}">${o.status}</span></span><span>${esc(o.tipe)} · ${esc(o.nama || '–')}</span><span class="small muted">${esc(o.no)} · ${o.tgl.slice(5).replace('-', '/')} · ${esc(o.mekanik || 'belum ada mekanik')}</span></button>`).join('') || '<div class="empty">Belum ada work order.</div>';
}
function renderServis() {
  if (!woDraft) woDraft = blankWo();
  const w = woDraft, locked = w.status === 'Lunas', dis = locked ? 'disabled' : '';
  $('#view').innerHTML = `<div class="grid g-servis">
   <div class="panel"><div class="row spread"><h3>Work order</h3><button class="btn sm" data-act="wo-new" type="button">+ Motor masuk [F1]</button></div>
    <div class="wolist" id="wo-list"></div>
   </div>
   <div class="panel"><div class="row spread"><h2>${w.no ? esc(w.no) : 'Work order baru'}</h2>${w.no ? `<span class="pill ${STATUS[w.status]}">${w.status}</span>` : ''}</div>
    <h3>Pemilik &amp; kendaraan</h3>
    <div class="form">
     <label class="f" for="w-nopol">No. Polisi<input id="w-nopol" data-f="nopol" class="mono" placeholder="BL 1234 XX" value="${esc(w.nopol)}" ${dis}></label>
     <label class="f" for="w-nama">Nama pemilik<input id="w-nama" data-f="nama" value="${esc(w.nama)}" ${dis}></label>
     <label class="f" for="w-hp">No. HP<input id="w-hp" data-f="hp" inputmode="tel" value="${esc(w.hp)}" ${dis}></label>
     <label class="f" for="w-tipe">Tipe motor Yamaha<select id="w-tipe" data-f="tipe" ${dis}><option value="">Pilih tipe</option>${TIPE.map(t => `<option ${t === w.tipe ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
     <label class="f" for="w-km">Kilometer<input id="w-km" data-f="km" class="num" inputmode="numeric" placeholder="mis. 12.500" value="${esc(w.km)}" ${dis}></label>
     <label class="f" for="w-mek">Mekanik<select id="w-mek" data-f="mekanik" ${dis}><option value="">Belum ditentukan</option>${MEKANIK.map(m => `<option ${m === w.mekanik ? 'selected' : ''}>${m}</option>`).join('')}</select></label>
     <label class="f wide" for="w-kel">Keluhan<textarea id="w-kel" data-f="keluhan" ${dis}>${esc(w.keluhan)}</textarea></label>
    </div>
    <h3>Jasa servis</h3>
    <div class="checks">${JASA.map(([n, h], i) => `<label for="w-j${i}"><input type="checkbox" id="w-j${i}" data-jasa="${n}" ${w.jasa.includes(n) ? 'checked' : ''} ${dis}>${n}<span class="hr">${h / 1000}rb</span></label>`).join('')}</div>
    <h3>Sparepart dipakai</h3>
    ${locked ? '' : S.parts.length ? `<div class="row"><select id="w-psel" aria-label="Pilih part" style="flex:1 1 220px">${S.parts.map(p => `<option value="${esc(p.kode)}">${esc(p.nama)} (stok ${p.stok})</option>`).join('')}</select><input id="w-pq" type="number" min="1" value="1" aria-label="Jumlah" style="width:70px"><button class="btn" type="button" data-act="wo-addpart">Tambah</button></div>` : '<div class="small muted">Belum ada data part di Stok Part.</div>'}
    <div id="w-parts"></div>
    <div id="w-tot"></div>
    <div class="row" style="justify-content:flex-end">
     ${w.no && !locked ? `<label class="f" for="w-st" style="flex-direction:row;align-items:center;gap:6px">Status<select id="w-st" data-f="status" style="width:auto">${['Antri', 'Dikerjakan', 'Selesai'].map(s => `<option ${s === w.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>` : ''}
     ${locked ? `<button class="btn" type="button" data-act="wo-nota">Lihat nota</button>` : `<button class="btn" type="button" data-act="wo-save">Simpan WO [F2]</button><button class="btn pri" type="button" data-act="wo-pay">Selesai &amp; Bayar</button>`}
    </div>
   </div></div>`;
  renderWoList(); renderWoParts();
}
function renderWoParts() {
  const w = woDraft, locked = w.status === 'Lunas';
  $('#w-parts').innerHTML = w.parts.length ? `<div class="tw"><table><thead><tr><th>Part</th><th class="r">Qty</th><th class="r">Jumlah</th><th></th></tr></thead><tbody>${w.parts.map((x, i) => { const p = part(x.kode) || { nama: x.kode + ' (dihapus)', jual: 0 }; return `<tr><td>${esc(p.nama)}</td><td class="r num">${x.qty}</td><td class="r num">${rp(p.jual * x.qty)}</td><td>${locked ? '' : `<button class="btn sm ghost" type="button" data-act="wo-rmpart" data-i="${i}" aria-label="Hapus">✕</button>`}</td></tr>`; }).join('')}</tbody></table></div>` : '<div class="small muted">Belum ada part.</div>';
  const c = woCalc(w);
  $('#w-tot').innerHTML = `<div class="totals"><span class="muted">Sparepart</span><span class="num">${rp(c.p)}</span><span class="muted">Jasa</span><span class="num">${rp(c.j)}</span><span style="font-weight:600">Estimasi total</span><span class="big num">${rp(c.total)}</span></div>`;
}
async function woSave(silent) {
  if (saving) return false;
  const w = woDraft; w.nopol = w.nopol.trim().toUpperCase();
  if (!w.nopol) { toast('Isi nomor polisi dulu'); $('#w-nopol')?.focus(); return false; }
  if (!w.tipe) { toast('Pilih tipe motor'); $('#w-tipe')?.focus(); return false; }
  saving = true;
  try {
    if (!w.no) {
      const no = await runTransaction(db, async tx => {
        const cs = await tx.get(counterRef());
        const { no, counter } = nextNumber(cs, 'WO');
        tx.set(counterRef(), counter);
        tx.set(doc(db, 'wo', no), { ...clone({ ...w, no }), dibuatOleh: namaPetugas() });
        return no;
      });
      w.no = no;
    } else {
      const { no, ...data } = clone(w);
      await updateDoc(doc(db, 'wo', no), data);
    }
    if (!silent) { toast('Work order ' + w.no + ' disimpan'); renderServis(); }
    return true;
  } catch (e) { toast(errMsg(e)); return false; } finally { saving = false; }
}
async function woPayModal() {
  if (!(await woSave(true))) return;
  const w = woDraft, c = woCalc(w);
  const kurang = w.parts.find(x => !part(x.kode) || part(x.kode).stok < x.qty);
  if (kurang) { toast('Stok ' + (part(kurang.kode)?.nama || kurang.kode) + ' tidak cukup'); renderServis(); return; }
  if (!c.total) { toast('Tambahkan jasa atau part dulu'); renderServis(); return; }
  renderServis();
  modal(`<h2>Pembayaran ${esc(w.no)}</h2><p class="small muted" style="margin:0">${esc(w.nopol)} · ${esc(w.tipe)} · ${esc(w.nama || 'Umum')}</p>
   <div class="totals"><span class="muted">Sparepart</span><span class="num">${rp(c.p)}</span><span class="muted">Jasa</span><span class="num">${rp(c.j)}</span></div>
   <div class="form"><label class="f" for="pay-dis">Diskon (Rp)<input id="pay-dis" type="number" min="0" step="1000" class="num" value="0"></label><label class="f" for="pay-bayar">Dibayar (Rp)<input id="pay-bayar" type="number" min="0" step="1000" class="num" data-autofocus value="${Math.ceil(c.total / 10000) * 10000}"></label></div>
   <div id="pay-tot"></div>
   <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Batal</button><button class="btn pri" type="button" data-act="wo-confirm">Bayar &amp; Cetak Nota</button></div>`);
  const upd = () => { const d = +$('#pay-dis').value || 0, b = +$('#pay-bayar').value || 0, t = c.total - d; $('#pay-tot').innerHTML = `<div class="totals"><span style="font-weight:600">Total</span><span class="big num">${rp(t)}</span><span class="muted">Kembalian</span><span class="num" style="color:${b < t ? 'var(--bad)' : 'inherit'}">${b < t ? 'Kurang ' + rp(t - b) : rp(b - t)}</span></div>`; };
  $('#pay-dis').oninput = upd; $('#pay-bayar').oninput = upd; upd();
}
async function woConfirm() {
  if (saving) return;
  const w = woDraft, d = +$('#pay-dis').value || 0, b = +$('#pay-bayar').value || 0;
  saving = true;
  try {
    const t = await runTransaction(db, async tx => {
      const cs = await tx.get(counterRef());
      const woRef = doc(db, 'wo', w.no), ws = await tx.get(woRef);
      if (ws.data().status === 'Lunas') throw new Error('Work order ini sudah dibayar');
      const refs = w.parts.map(x => doc(db, 'parts', x.kode));
      const ps = await Promise.all(refs.map(r => tx.get(r)));
      const items = w.parts.map((x, i) => {
        if (!ps[i].exists()) throw new Error('Part ' + x.kode + ' sudah dihapus');
        const p = ps[i].data();
        if (p.stok < x.qty) throw new Error('Stok ' + p.nama + ' tinggal ' + p.stok);
        return { kode: p.kode, nama: p.nama, qty: x.qty, harga: p.jual, beli: p.beli };
      });
      const jasa = w.jasa.map(n => ({ nama: n, harga: JASA.find(x => x[0] === n)[1] }));
      const total = items.reduce((a, x) => a + x.qty * x.harga, 0) + jasa.reduce((a, x) => a + x.harga, 0) - d;
      if (b < total) throw new Error('Uang dibayar kurang dari total');
      const { no, counter } = nextNumber(cs, 'SV');
      const trx = { no, tgl: stamp(new Date()), jenis: 'SERVIS', pelanggan: w.nama || 'Umum', nopol: w.nopol, mekanik: w.mekanik, wo: w.no, items, jasa, diskon: d, total, bayar: b, kasir: namaPetugas() };
      tx.set(counterRef(), counter);
      items.forEach((x, i) => tx.update(refs[i], { stok: ps[i].data().stok - x.qty }));
      tx.set(doc(db, 'trx', no), { ...trx, dibuat: serverTimestamp() });
      tx.update(woRef, { status: 'Lunas', nota: no });
      return trx;
    });
    w.status = 'Lunas'; w.nota = t.no; lastNota = t;
    closeModal(); renderServis(); showNota(t);
  } catch (e) { toast(errMsg(e)); } finally { saving = false; }
}

/* ---------- STOK ---------- */
function renderStok() {
  $('#view').innerHTML = `<div class="grid">
   <div class="panel"><div class="row spread"><h3>Stok sparepart</h3><div class="row"><button class="btn" type="button" data-act="masuk">Barang masuk</button><button class="btn pri" type="button" data-act="part-new">+ Part baru [F1]</button></div></div>
    <div class="row"><input id="s-q" placeholder="Cari kode, nama, tipe motor" value="${esc(stokQ)}" style="flex:1 1 220px" aria-label="Cari part"><select id="s-kat" style="width:auto" aria-label="Kategori"><option value="">Semua kategori</option>${KAT.map(k => `<option ${k === stokKat ? 'selected' : ''}>${k}</option>`).join('')}</select><label class="row small" for="s-low" style="gap:6px;cursor:pointer"><input type="checkbox" id="s-low" style="width:auto" ${stokLow ? 'checked' : ''}>Hanya stok menipis</label></div>
    <div id="s-panel"></div>
    <div id="s-tbl"></div>
   </div></div>`;
  renderSPanel(); renderSTbl();
}
function renderSTbl() {
  if (!$('#s-tbl')) return;
  if (!S.parts.length) { $('#s-tbl').innerHTML = '<div class="empty">Belum ada part. Klik "+ Part baru", atau <button class="btn sm" type="button" data-act="seed">isi 20 part contoh</button></div>'; return; }
  const q = stokQ.toLowerCase();
  const r = S.parts.filter(p => (!q || (p.kode + ' ' + p.nama + ' ' + p.cocok).toLowerCase().includes(q)) && (!stokKat || p.kategori === stokKat) && (!stokLow || p.stok <= p.min));
  const nilai = r.reduce((a, p) => a + p.stok * p.beli, 0);
  $('#s-tbl').innerHTML = `<div class="tw"><table><thead><tr><th>Kode</th><th>Nama part</th><th>Kategori</th><th>Cocok untuk</th><th>Rak</th><th class="r">Harga jual</th><th class="r">Stok</th></tr></thead><tbody>${r.map(p => `<tr class="row-click" tabindex="0" data-act="part-edit" data-k="${esc(p.kode)}"><td class="mono">${esc(p.kode)}</td><td>${esc(p.nama)}</td><td>${esc(p.kategori)}</td><td class="small">${esc(p.cocok)}</td><td class="mono">${esc(p.rak)}</td><td class="r num">${rp(p.jual)}</td><td class="r"><span class="pill ${p.stok <= 0 ? 'p-bad' : p.stok <= p.min ? 'p-warn' : 'p-good'}">${p.stok}</span></td></tr>`).join('') || '<tr><td colspan="7" class="empty">Tidak ada part yang cocok.</td></tr>'}</tbody></table></div><p class="small muted" style="margin:0">${r.length} part · nilai stok (harga beli) ${rp(nilai)} · klik baris untuk ubah</p>`;
}
function renderSPanel() {
  const el = $('#s-panel'); if (!el) return;
  if (!partEdit) { el.innerHTML = ''; return; }
  if (partEdit.mode === 'masuk') {
    if (!S.parts.length) { el.innerHTML = '<div class="empty">Tambahkan part dulu sebelum mencatat barang masuk.</div>'; return; }
    el.innerHTML = `<div class="panel" style="background:var(--panel-2);box-shadow:none"><h3>Barang masuk dari supplier</h3><div class="form"><label class="f wide" for="m-part">Part<select id="m-part">${S.parts.map(p => `<option value="${esc(p.kode)}">${esc(p.kode)} · ${esc(p.nama)} (stok ${p.stok})</option>`).join('')}</select></label><label class="f" for="m-qty">Jumlah masuk<input id="m-qty" type="number" min="1" value="10" class="num"></label><label class="f" for="m-sup">Supplier / No. faktur<input id="m-sup" placeholder="mis. Distributor Yamaha"></label></div><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="panel-close">Batal</button><button class="btn pri" type="button" data-act="masuk-save">Tambah stok [F2]</button></div></div>`;
    return;
  }
  const p = partEdit.data;
  el.innerHTML = `<div class="panel" style="background:var(--panel-2);box-shadow:none"><h3>${partEdit.mode === 'new' ? 'Part baru' : 'Ubah part ' + esc(p.kode)}</h3><div class="form">
   <label class="f" for="p-kode">Kode / barcode<input id="p-kode" class="mono" value="${esc(p.kode)}" ${partEdit.mode === 'edit' ? 'disabled' : ''}></label>
   <label class="f wide" for="p-nama">Nama part<input id="p-nama" value="${esc(p.nama)}"></label>
   <label class="f" for="p-kat">Kategori<select id="p-kat">${KAT.map(k => `<option ${k === p.kategori ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
   <label class="f" for="p-cocok">Cocok untuk<input id="p-cocok" value="${esc(p.cocok)}" placeholder="mis. NMAX, Aerox"></label>
   <label class="f" for="p-rak">Rak<input id="p-rak" class="mono" value="${esc(p.rak)}"></label>
   <label class="f" for="p-beli">Harga beli<input id="p-beli" type="number" min="0" class="num" value="${p.beli}"></label>
   <label class="f" for="p-jual">Harga jual<input id="p-jual" type="number" min="0" class="num" value="${p.jual}"></label>
   <label class="f" for="p-stok">Stok<input id="p-stok" type="number" min="0" class="num" value="${p.stok}"></label>
   <label class="f" for="p-min">Stok minimum<input id="p-min" type="number" min="0" class="num" value="${p.min}"></label>
  </div><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="panel-close">Batal</button><button class="btn pri" type="button" data-act="part-save">Simpan part [F2]</button></div></div>`;
}
async function partSave() {
  if (saving) return;
  if (partEdit.mode === 'masuk') {
    const kode = $('#m-part').value, p = part(kode), q = +$('#m-qty').value || 0;
    if (q < 1) { toast('Jumlah masuk minimal 1'); return; }
    saving = true;
    try {
      await updateDoc(doc(db, 'parts', kode), { stok: increment(q) });
      await addDoc(collection(db, 'masuk'), { kode, nama: p.nama, qty: q, supplier: $('#m-sup').value.trim(), tgl: stamp(new Date()), petugas: namaPetugas() });
      partEdit = null; toast(q + ' pcs ' + p.nama + ' masuk ke stok'); renderSPanel();
    } catch (e) { toast(errMsg(e)); } finally { saving = false; }
    return;
  }
  const v = id => $(id).value.trim();
  const d = { kode: partEdit.mode === 'new' ? v('#p-kode').toUpperCase() : partEdit.data.kode, nama: v('#p-nama'), kategori: v('#p-kat'), cocok: v('#p-cocok'), rak: v('#p-rak').toUpperCase(), beli: +v('#p-beli') || 0, jual: +v('#p-jual') || 0, stok: +v('#p-stok') || 0, min: +v('#p-min') || 0 };
  if (!d.kode || !d.nama) { toast('Kode dan nama part wajib diisi'); return; }
  if (!/^[A-Z0-9._-]+$/.test(d.kode)) { toast('Kode hanya boleh huruf, angka, titik, minus dan garis bawah'); return; }
  if (partEdit.mode === 'new' && part(d.kode)) { toast('Kode ' + d.kode + ' sudah dipakai'); return; }
  saving = true;
  try {
    if (partEdit.mode === 'new') await setDoc(doc(db, 'parts', d.kode), d);
    else { const { kode, ...rest } = d; await updateDoc(doc(db, 'parts', kode), rest); }
    partEdit = null; toast('Part ' + d.kode + ' disimpan'); renderSPanel();
  } catch (e) { toast(errMsg(e)); } finally { saving = false; }
}

/* ---------- LAPORAN ---------- */
function renderLaporan() {
  const now = new Date(); let from = dkey(now); const to = dkey(now);
  if (lapRange === '7') { const d = new Date(now); d.setDate(d.getDate() - 6); from = dkey(d); }
  if (lapRange === 'bulan') from = dkey(new Date(now.getFullYear(), now.getMonth(), 1));
  const list = trxIn(from, to).sort((a, b) => b.tgl.localeCompare(a.tgl)), s = sums(list);
  const top = {};
  list.forEach(t => t.items.forEach(x => { top[x.kode] = top[x.kode] || { nama: x.nama, qty: 0 }; top[x.kode].qty += x.qty; }));
  const topL = Object.entries(top).sort((a, b) => b[1].qty - a[1].qty).slice(0, 5), mx = topL.length ? topL[0][1].qty : 1;
  const mek = {}; list.filter(t => t.mekanik).forEach(t => { mek[t.mekanik] = (mek[t.mekanik] || 0) + 1; });
  $('#view').innerHTML = `<div class="grid">
   <div class="row spread"><h2>Laporan penjualan</h2><div class="seg" role="group" aria-label="Periode">${[['hari', 'Hari ini'], ['7', '7 hari'], ['bulan', 'Bulan ini']].map(([k, l]) => `<button type="button" data-act="lap" data-r="${k}" aria-pressed="${k === lapRange}">${l}</button>`).join('')}</div></div>
   <div class="tiles">
    <div class="tile"><span class="lbl">Total omzet</span><span class="val">${rp(s.total)}</span><span class="sub">${s.n} transaksi</span></div>
    <div class="tile"><span class="lbl">Penjualan part</span><span class="val">${rp(s.part)}</span><span class="sub">${s.qty} pcs</span></div>
    <div class="tile"><span class="lbl">Jasa servis</span><span class="val">${rp(s.jasa)}</span><span class="sub">diskon ${rp(s.dis)}</span></div>
    <div class="tile"><span class="lbl">Laba kotor</span><span class="val" style="color:var(--good)">${rp(s.laba)}</span><span class="sub">margin part + jasa − diskon</span></div>
   </div>
   <div class="grid g2">
    <div class="panel"><h3>Part terlaris</h3>${topL.length ? topL.map(([k, v]) => `<div style="display:flex;flex-direction:column;gap:3px"><div class="row spread small"><span>${esc(v.nama)}</span><span class="num">${v.qty} pcs</span></div><div style="height:7px;background:var(--panel-2);border-radius:4px;overflow:hidden"><div style="height:100%;width:${v.qty / mx * 100}%;background:var(--accent)"></div></div></div>`).join('') : '<div class="empty">Belum ada penjualan part.</div>'}</div>
    <div class="panel"><h3>Motor ditangani per mekanik</h3>${Object.keys(mek).length ? `<div class="tw"><table><tbody>${Object.entries(mek).sort((a, b) => b[1] - a[1]).map(([m, n]) => `<tr><td>${esc(m)}</td><td class="r num">${n} unit</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Belum ada servis lunas di periode ini.</div>'}</div>
   </div>
   <div class="panel"><h3>Daftar transaksi</h3><div class="tw"><table><thead><tr><th>No. nota</th><th>Waktu</th><th>Jenis</th><th>Pelanggan</th><th>Kasir</th><th class="r">Total</th></tr></thead><tbody>${list.map(t => `<tr class="row-click" tabindex="0" data-act="nota" data-no="${esc(t.no)}"><td class="mono">${esc(t.no)}</td><td class="num">${t.tgl.slice(5).replace('-', '/')}</td><td><span class="pill ${t.jenis === 'SERVIS' ? 'p-info' : 'p-good'}">${t.jenis === 'SERVIS' ? 'Servis' : 'Part'}</span></td><td>${esc(t.pelanggan)}${t.nopol ? ` <span class="small muted mono">${esc(t.nopol)}</span>` : ''}</td><td class="small">${esc(t.kasir || '')}</td><td class="r num">${rp(t.total)}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Tidak ada transaksi.</td></tr>'}</tbody></table></div></div>
  </div>`;
}

/* ---------- NAVIGASI & EVENT ---------- */
function go(v) {
  view = v;
  document.querySelectorAll('.tab').forEach(t => t.setAttribute('aria-selected', t.dataset.view === v));
  try { localStorage.setItem('amu-tab', v); } catch (e) {}
  if (!loaded) return;
  ({ beranda: renderBeranda, kasir: renderKasir, servis: renderServis, stok: renderStok, laporan: renderLaporan })[v]();
  if (v === 'kasir') setTimeout(() => $('#k-q')?.focus(), 0);
}
document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => go(t.dataset.view)));

function act(a, el) {
  switch (a) {
    case 'go-servis': go('servis'); break;
    case 'go-stok': go('stok'); break;
    case 'go-low': stokLow = true; go('stok'); break;
    case 'seed': seedParts(); break;
    case 'open-wo': { const o = S.wo.find(x => x.no === el.dataset.no); if (o) { woDraft = clone(o); go('servis'); } break; }
    case 'add': case 'inc': addToCart(el.dataset.k); break;
    case 'dec': { const it = cart.items.find(x => x.kode === el.dataset.k); it.qty--; if (!it.qty) cart.items = cart.items.filter(x => x !== it); renderCart(); break; }
    case 'rm': cart.items = cart.items.filter(x => x.kode !== el.dataset.k); renderCart(); break;
    case 'cart-clear': cart = { items: [], pelanggan: '', diskon: 0, bayar: 0 }; renderKasir(); break;
    case 'cart-save': saveSale(); break;
    case 'wo-new': woDraft = blankWo(); renderServis(); $('#w-nopol').focus(); break;
    case 'wo-addpart': {
      const k = $('#w-psel').value, q = Math.max(1, +$('#w-pq').value || 1), ex = woDraft.parts.find(x => x.kode === k), tot = (ex ? ex.qty : 0) + q;
      if (tot > part(k).stok) { toast('Stok ' + part(k).nama + ' tinggal ' + part(k).stok); break; }
      ex ? ex.qty = tot : woDraft.parts.push({ kode: k, qty: q }); renderWoParts(); break;
    }
    case 'wo-rmpart': woDraft.parts.splice(+el.dataset.i, 1); renderWoParts(); break;
    case 'wo-save': woSave(); break;
    case 'wo-pay': woPayModal(); break;
    case 'wo-confirm': woConfirm(); break;
    case 'wo-nota': showNota(S.trx.find(t => t.no === woDraft.nota) || (lastNota && lastNota.no === woDraft.nota ? lastNota : null)); break;
    case 'part-new': partEdit = { mode: 'new', data: { kode: '', nama: '', kategori: 'Oli', cocok: '', rak: '', beli: 0, jual: 0, stok: 0, min: 2 } }; renderSPanel(); $('#p-kode').focus(); break;
    case 'part-edit': partEdit = { mode: 'edit', data: { ...part(el.dataset.k) } }; renderSPanel(); $('#s-panel').scrollIntoView({ block: 'nearest' }); $('#p-nama').focus(); break;
    case 'masuk': partEdit = { mode: 'masuk' }; renderSPanel(); break;
    case 'panel-close': partEdit = null; renderSPanel(); break;
    case 'part-save': case 'masuk-save': partSave(); break;
    case 'lap': lapRange = el.dataset.r; renderLaporan(); break;
    case 'nota': showNota(S.trx.find(t => t.no === el.dataset.no)); break;
    case 'print': printNota(); break;
  }
}
document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (el) act(el.dataset.act, el); });
document.addEventListener('keydown', e => {
  if ($('#app-shell').hidden) return;
  if (e.key === 'Enter' && e.target.classList?.contains('row-click')) { act(e.target.dataset.act, e.target); return; }
  if (e.key === 'Escape' && $('#modal-root').innerHTML) { closeModal(); return; }
  if (e.key === 'Enter' && e.target.id === 'k-q') { e.preventDefault(); const r = searchParts(e.target.value); if (r.length) { addToCart(r[0].kode); e.target.value = ''; renderKRes(); } return; }
  if (e.key === 'F1') { e.preventDefault(); fk('baru'); }
  if (e.key === 'F2') { e.preventDefault(); fk('simpan'); }
  if (e.key === 'F8') { e.preventDefault(); fk('cetak'); }
});
document.addEventListener('input', e => {
  const t = e.target;
  if (t.id === 'k-q') renderKRes();
  if (t.id === 'k-pel') cart.pelanggan = t.value;
  if (t.id === 'k-dis') { cart.diskon = +t.value || 0; renderKTot(); }
  if (t.id === 'k-bayar') { cart.bayar = +t.value || 0; renderKTot(); }
  if (t.dataset.f && woDraft && t.dataset.f !== 'status') woDraft[t.dataset.f] = t.value;
  if (t.id === 's-q') { stokQ = t.value; renderSTbl(); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.jasa) { const n = t.dataset.jasa; woDraft.jasa = t.checked ? [...woDraft.jasa, n] : woDraft.jasa.filter(x => x !== n); renderWoParts(); }
  if (t.dataset.f === 'status') { woDraft.status = t.value; woSave(); }
  if (t.id === 'w-nopol' && !woDraft.no) {
    const np = t.value.trim().toUpperCase(); t.value = np; woDraft.nopol = np;
    const prev = [...S.wo].reverse().find(o => o.nopol === np);
    if (prev) { Object.assign(woDraft, { nama: woDraft.nama || prev.nama, hp: woDraft.hp || prev.hp, tipe: woDraft.tipe || prev.tipe }); renderServis(); toast('Pelanggan lama: data ' + prev.nama + ' diisi otomatis'); }
  }
  if (t.id === 's-kat') { stokKat = t.value; renderSTbl(); }
  if (t.id === 's-low') { stokLow = t.checked; renderSTbl(); }
});
function fk(k) {
  if (!loaded) return;
  if (k === 'cetak') { showNota(lastNota || S.trx[S.trx.length - 1]); return; }
  const m = { kasir: { baru: 'cart-clear', simpan: 'cart-save' }, servis: { baru: 'wo-new', simpan: 'wo-save' }, stok: { baru: 'part-new', simpan: partEdit ? (partEdit.mode === 'masuk' ? 'masuk-save' : 'part-save') : null } };
  const a = m[view] && m[view][k];
  if (a) act(a, { dataset: {} }); else if (k === 'baru') go('kasir'); else toast('Tidak ada yang perlu disimpan di halaman ini');
}
$('#fk-baru').onclick = () => fk('baru'); $('#fk-simpan').onclick = () => fk('simpan'); $('#fk-cetak').onclick = () => fk('cetak');

function tick() { $('#clock').textContent = new Date().toLocaleString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); }
tick(); setInterval(tick, 30000);
try { const t = localStorage.getItem('amu-tab'); if (['beranda', 'kasir', 'servis', 'stok', 'laporan'].includes(t)) view = t; } catch (e) {}
go(view);
