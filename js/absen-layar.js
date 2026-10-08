// Layar QR absen (absen.html) — satu perangkat terdaftar per cabang.
// 1. Perangkat di cabang membuka halaman ini, memilih cabang, lalu "Minta aktivasi": muncul kode 4 angka.
// 2. Super admin atau admin menyetujui dari HP-nya (Beranda / Absensi) setelah mencocokkan kodenya.
// 3. Sejak itu perangkat ini menjadi satu-satunya layar QR cabang tersebut: setiap dibuka, QR langsung tampil
//    tanpa login. Perangkat lain yang membuka link ditolak. Hanya super admin yang bisa mencabutnya.
// Perangkat layar memakai identitas anonim tersendiri; aturan database hanya mengizinkannya memperbarui
// kode QR cabangnya, tidak bisa membaca data apa pun.
// QR berganti tiap 15 detik dan hanya selama jam aktif & layar terlihat (hemat kuota tulis).
import { auth, db, signInAnonymously, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, onSnapshot, serverTimestamp } from './firebase.js';
import { APP_NAME } from './config.js';
import { loadCabang, cabangList, namaCabang, multiCabang, CABANG_UTAMA } from './cabang.js';
import { qrSvg } from './qr.js';
import { esc } from './util.js';

const $ = s => document.querySelector(s);
const JEDA = 15000;
let cab = null, kodeKini = '', timer = null, jamTimer = null, detakTimer = null, berganti = 0, unsub = null, wake = null, layar = null, jam = { mulai: '07:00', selesai: '18:00' };

const FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false });
const kodeAcak = () => { const a = new Uint8Array(9); crypto.getRandomValues(a); return Array.from(a, b => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join(''); };
const pesan = t => { const m = $('#ab-msg'); if (m) m.textContent = t; };
const menit = hhmm => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
const dalamJam = () => { const n = menit(FMT.format(new Date())); return n >= menit(jam.mulai) && n < menit(jam.selesai); };
const simpanCab = c => { try { localStorage.setItem('amu-layar-cabang', c); } catch (e) {} };
const cabTersimpan = () => { try { return localStorage.getItem('amu-layar-cabang'); } catch (e) { return null; } };
const tampil = id => { ['#ab-setup', '#ab-main', '#ab-tutup'].forEach(s => { $(s).hidden = s !== id; }); };
const setup = html => { tampil('#ab-setup'); $('#ab-setup-isi').innerHTML = html; $('#ab-err').hidden = true; };
const salah = t => { $('#ab-err').hidden = false; $('#ab-err').textContent = t; };

/* ---------- Pendaftaran perangkat ---------- */
function formMinta(info = '') {
  const pilih = multiCabang() ? `<select id="ab-cabang" aria-label="Cabang">${cabangList().map(c => `<option value="${esc(c.id)}" ${c.id === cabTersimpan() ? 'selected' : ''}>Cabang ${esc(c.nama)}</option>`).join('')}</select>` : '';
  setup(`<p>${info || 'Perangkat ini belum terdaftar sebagai layar absen.'} Pilih cabang lalu minta aktivasi. Super admin atau admin akan menyetujuinya dari HP mereka.</p>${pilih}<button type="button" id="ab-minta">Minta aktivasi layar ini</button>`);
  $('#ab-minta').onclick = minta;
}
async function minta() {
  const btn = $('#ab-minta'); btn.disabled = true; btn.textContent = 'Mengirim…';
  const c = multiCabang() ? $('#ab-cabang').value : CABANG_UTAMA;
  try {
    if (!auth.currentUser) await signInAnonymously(auth);
    const kode = String(1000 + (crypto.getRandomValues(new Uint16Array(1))[0] % 9000));
    await setDoc(doc(db, 'layarAbsen', c), { cabang: c, status: 'menunggu', uid: auth.currentUser.uid, kode, tglMinta: serverTimestamp(), info: navigator.userAgent.slice(0, 140) });
    simpanCab(c); pantau(c);
  } catch (e) {
    btn.disabled = false; btn.textContent = 'Minta aktivasi layar ini';
    salah(e.code === 'permission-denied' ? 'Layar absen cabang ini sudah aktif di perangkat lain. Bila perangkat diganti, minta super admin mencabut layar lama dulu.'
      : e.code === 'auth/operation-not-allowed' || e.code === 'auth/admin-restricted-operation' ? 'Login anonim belum diaktifkan di Firebase Console (Authentication → Sign-in method → Anonymous).' : 'Gagal: ' + (e.message || e));
  }
}

/* ---------- Status perangkat (realtime) ---------- */
function pantau(c) {
  cab = c; unsub?.();
  unsub = onSnapshot(doc(db, 'layarAbsen', c), s => {
    layar = s.exists() ? s.data() : null;
    const milikSaya = layar && layar.uid === auth.currentUser?.uid;
    if (!layar || !milikSaya) { berhenti(); formMinta(layar ? 'Layar cabang ini sudah dipakai perangkat lain.' : ''); return; }
    if (layar.status === 'menunggu') { berhenti(); setup(`<p>Menunggu persetujuan untuk <b>Cabang ${esc(namaCabang(c))}</b>. Minta super admin atau admin membuka aplikasi dan menyetujui layar dengan kode:</p><div class="ab-kode">${esc(layar.kode)}</div><p>Halaman ini otomatis berganti ke QR setelah disetujui.</p>`); return; }
    if (layar.status === 'ditolak' || layar.status === 'dicabut') { berhenti(); formMinta(layar.status === 'ditolak' ? 'Permintaan sebelumnya ditolak.' : 'Layar ini sudah dicabut oleh super admin.'); return; }
    if (layar.status === 'aktif') { if (layar.jamMulai) jam = { mulai: layar.jamMulai, selesai: layar.jamSelesai || '18:00' }; mulai(); }
  }, () => { berhenti(); formMinta('Layar cabang ini sudah dipakai perangkat lain.'); });
}

/* ---------- QR ---------- */
async function ganti() {
  if (document.hidden || !dalamJam()) return;
  const lama = kodeKini; kodeKini = kodeAcak();
  try {
    await setDoc(doc(db, 'absenKode', cab), { cabang: cab, kode: kodeKini, kodeLama: lama || kodeKini, waktu: serverTimestamp() });
    const url = new URL('pos.html', location.href); url.searchParams.set('absen', cab + '~' + kodeKini);
    $('#ab-qr').innerHTML = await qrSvg(url.toString());
    berganti = Date.now(); pesan('');
  } catch (e) { kodeKini = lama; pesan(e.code === 'permission-denied' ? 'Ditolak database: layar ini belum/tidak lagi disetujui.' : 'Gagal memperbarui QR: ' + (e.message || e)); }
}
const detak = () => updateDoc(doc(db, 'layarAbsen', cab), { terakhir: serverTimestamp() }).catch(() => {});
function cekJam() {
  const d = new Date(), j = FMT.format(d);
  $('#ab-jam').textContent = j; $('#ab-jam2').textContent = j;
  $('#ab-tgl').textContent = d.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  if (!dalamJam()) {
    if ($('#ab-tutup').hidden) { tampil('#ab-tutup'); clearInterval(timer); timer = null; kodeKini = ''; }
    $('#ab-tutup-teks').innerHTML = `QR absen <b>${esc(namaCabang(cab))}</b> aktif pukul ${esc(jam.mulai)}–${esc(jam.selesai)} WIB.`;
    return;
  }
  if ($('#ab-main').hidden) { tampil('#ab-main'); if (!timer) { ganti(); timer = setInterval(ganti, JEDA); } }
  $('#ab-bar').style.width = (Math.max(0, JEDA - (Date.now() - berganti)) / JEDA * 100) + '%';
}
function mulai() {
  $('#ab-name').textContent = APP_NAME.toUpperCase();
  $('#ab-cabnama').textContent = (multiCabang() ? 'Absensi · Cabang ' + namaCabang(cab) : 'Absensi karyawan');
  $('#ab-info').innerHTML = `<span>Disetujui ${esc(layar.disetujuiOleh || '')}</span><span>Jam QR ${esc(jam.mulai)}–${esc(jam.selesai)}</span>`;
  if (jamTimer) return;
  cekJam(); jamTimer = setInterval(cekJam, 1000);
  detak(); detakTimer = setInterval(() => { if (!document.hidden) detak(); }, 60000);
  if (!layar.lokasi) catatLokasi(true);
  kunciLayar();
}
function berhenti() { clearInterval(timer); clearInterval(jamTimer); clearInterval(detakTimer); timer = jamTimer = detakTimer = null; kodeKini = ''; }
async function kunciLayar() { try { wake = await navigator.wakeLock?.request('screen'); } catch (e) { wake = null; } }
function catatLokasi(diam) {
  if (!navigator.geolocation) { if (!diam) pesan('Perangkat ini tidak punya GPS/lokasi.'); return; }
  if (!diam) pesan('Membaca lokasi…');
  navigator.geolocation.getCurrentPosition(async p => {
    try {
      await updateDoc(doc(db, 'layarAbsen', cab), { lokasi: { lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), akurasi: Math.round(p.coords.accuracy), tgl: new Date().toISOString().slice(0, 10) } });
      pesan(`Lokasi bengkel disimpan (akurasi ±${Math.round(p.coords.accuracy)} m).`);
    } catch (e) { pesan('Gagal menyimpan lokasi: ' + (e.message || e)); }
  }, () => { if (!diam) pesan('Izin lokasi ditolak. Izinkan lokasi untuk situs ini lalu coba lagi.'); }, { enableHighAccuracy: true, timeout: 15000 });
}

document.addEventListener('visibilitychange', () => {
  if ($('#ab-main').hidden && $('#ab-tutup').hidden) return;
  $('#ab-pause').hidden = !document.hidden;
  if (!document.hidden) { ganti(); detak(); kunciLayar(); }
});
$('#ab-pause').addEventListener('click', () => { $('#ab-pause').hidden = true; ganti(); });
$('#ab-layar').addEventListener('click', () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.().catch(() => {}); });
$('#ab-lokasi').addEventListener('click', () => catatLokasi(false));

(async () => {
  await loadCabang();
  let siap = false;
  onAuthStateChanged(auth, u => {
    if (siap) return; siap = true;
    const c = cabTersimpan();
    if (u && c) pantau(c); else formMinta();
  });
})();
