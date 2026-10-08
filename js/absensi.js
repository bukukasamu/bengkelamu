// Absensi karyawan: scan QR yang berganti tiap 15 detik di halaman absen.html (dibuka super admin di bengkel)
// → selfie kamera depan (tidak bisa dari galeri) → tercatat dengan jam server, lokasi, dan HP terdaftar.
// Satu karyawan = satu HP terdaftar; ganti HP harus direset super admin.
// Uang hadir & potongan terlambat masuk otomatis ke Penghasilan / slip gaji.
//
// Data: absen/{kunci}_{YYYYMMDD}  (kunci = loginId petugas, atau 'M:' + id mekanik)
//       absenFoto/{idAbsen}_m|_p  (foto kecil ±20 KB, dihapus otomatis setelah N hari)
//       absenPerangkat/{kunci}    (HP terdaftar)    absenKode/{cabang} (kode QR aktif, hanya super admin)
//       penghasilan/absensi       (aturan: jam kerja, toleransi, uang hadir, potongan, lokasi cabang)
import { $, esc, rp, dkey, stamp, toast, errMsg, modal, closeModal } from './util.js';
import { S, st, views, refreshers, actions, changeHandlers, inputHandlers, isRole } from './state.js';
import { db, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where, limit, writeBatch, serverTimestamp } from './firebase.js';
import { cabAktif, namaCabang, multiCabang, cabangList, CABANG_UTAMA } from './cabang.js';
import { loadLoginList } from './akun.js';
import { mintaPassword, isSuper } from './otorisasi.js';
import { loaderHTML } from './brand.js';
import { loadXLSX } from './import-excel.js';
import { ROLES } from './config.js';

export const ABSEN_DEFAULT = { aktif: true, jamMasuk: '08:00', jamPulang: '17:00', toleransi: 5, hariKerja: [1, 2, 3, 4, 5, 6], uangHadir: 10000, potongTelat: 5000, wajibPulang: true, potongPulangCepat: 0, radius: 150, simpanFoto: 90, cabang: {}, lokasi: {} };
const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const STATUS_MANUAL = { hadir: 'Hadir (manual)', izin: 'Izin', sakit: 'Sakit', alpa: 'Tidak hadir' };

/* ---------- Aturan ---------- */
let aturan = null;
export async function muatAturanAbsen(paksa) {
  if (aturan && !paksa) return aturan;
  const s = await getDoc(doc(db, 'penghasilan', 'absensi')).catch(() => null);
  aturan = { ...ABSEN_DEFAULT, ...(s?.exists() ? s.data() : {}) };
  return aturan;
}
export const jamCabang = (a, cab) => ({ masuk: a.cabang?.[cab]?.jamMasuk || a.jamMasuk, pulang: a.cabang?.[cab]?.jamPulang || a.jamPulang });

/* ---------- Waktu (jam server, zona WIB) ---------- */
const FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false });
const FMT_TGL = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' });
export const waktuScan = x => x?.ts?.toDate ? x.ts.toDate() : new Date(x?.klien || 0);
export const jamWIB = d => FMT.format(d);
export const tglWIB = (d = new Date()) => FMT_TGL.format(d);   // YYYY-MM-DD
const menit = hhmm => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return h * 60 + (m || 0); };
const fmtMenit = m => m >= 60 ? Math.floor(m / 60) + ' j ' + (m % 60) + ' m' : m + ' mnt';
const hariNum = tgl => +tgl.replace(/-/g, '');
export const idAbsen = (kunci, tgl) => kunci + '_' + hariNum(tgl);

// Kunci karyawan yang sedang login (sama dengan kunci gaji)
export const kunciSaya = () => !st.petugas || st.petugas.super ? '' : st.role === 'mekanik' ? 'M:' + (st.petugas.mekanikId || '') : (st.petugas.loginId || '');
export const kunciLogin = p => p.peran === 'mekanik' ? 'M:' + (p.mekanikId || '') : p.id;

// Penilaian satu hari
export function nilaiHari(r, a, hariIni = tglWIB()) {
  if (r.manual) return { manual: r.manual, hadir: r.manual === 'hadir', telat: 0, cepat: 0, tanpaPulang: false, masuk: null, pulang: null };
  const j = jamCabang(a, r.cabang);
  const masuk = r.masuk ? menit(jamWIB(waktuScan(r.masuk))) : null, pulang = r.pulang ? menit(jamWIB(waktuScan(r.pulang))) : null;
  const telat = masuk != null && masuk > menit(j.masuk) + (+a.toleransi || 0) ? masuk - menit(j.masuk) : 0;
  const cepat = pulang != null && pulang < menit(j.pulang) ? menit(j.pulang) - pulang : 0;
  const belumSelesai = r.tgl === hariIni && pulang == null;
  return { hadir: masuk != null && (pulang != null || !a.wajibPulang), telat, cepat, tanpaPulang: masuk != null && pulang == null && !belumSelesai, belumPulang: belumSelesai && masuk != null, masuk, pulang };
}
// Rekap per karyawan untuk satu bulan → dipakai Penghasilan
export function rekapAbsen(docs, a) {
  const out = {};
  docs.forEach(r => {
    const k = r.kunci, n = nilaiHari(r, a), x = out[k] = out[k] || { hadir: 0, telat: 0, telatMenit: 0, cepat: 0, tanpaPulang: 0, izin: 0, sakit: 0, alpa: 0, list: [] };
    x.list.push({ r, n });
    if (n.hadir) x.hadir++;
    if (n.telat) { x.telat++; x.telatMenit += n.telat; }
    if (n.cepat) x.cepat++;
    if (n.tanpaPulang) x.tanpaPulang++;
    if (['izin', 'sakit', 'alpa'].includes(n.manual)) x[n.manual]++;
  });
  Object.values(out).forEach(x => {
    x.uangHadir = x.hadir * (+a.uangHadir || 0);
    x.potongTelat = x.telat * (+a.potongTelat || 0);
    x.potongCepat = x.cepat * (+a.potongPulangCepat || 0);
    x.list.sort((p, q) => p.r.tgl.localeCompare(q.r.tgl));
  });
  return out;
}
// Untuk Penghasilan: data absen sebulan (super admin semua, karyawan miliknya)
export async function absenBulan(ym, kunci = null) {
  const w = [where('bulan', '==', ym)]; if (kunci) w.unshift(where('kunci', '==', kunci));
  const s = await getDocs(query(collection(db, 'absen'), ...w));
  return s.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ---------- Jarak ke bengkel ---------- */
export function jarak(a, b) {
  if (!a || !b || a.lat == null || b.lat == null) return null;
  const R = 6371000, r = x => x * Math.PI / 180, dLat = r(b.lat - a.lat), dLng = r(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/* ---------- HP terdaftar ---------- */
function idPerangkat() {
  let id = null; try { id = localStorage.getItem('amu-perangkat'); } catch (e) {}
  if (!id) { id = 'hp-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); try { localStorage.setItem('amu-perangkat', id); } catch (e) {} }
  return id;
}

/* ---------- Link dari QR: pos.html?absen=KODECABANG~kode ---------- */
let tertunda = null;
try {
  const u = new URL(location.href), v = u.searchParams.get('absen');
  if (v) { sessionStorage.setItem('amu-absen', JSON.stringify({ v, t: Date.now() })); u.searchParams.delete('absen'); history.replaceState(null, '', u.pathname + (u.search || '') + u.hash); }
  const s = JSON.parse(sessionStorage.getItem('amu-absen') || 'null');
  if (s && Date.now() - s.t < 120000) tertunda = s.v; else sessionStorage.removeItem('amu-absen');
} catch (e) {}
export const adaAbsenTertunda = () => !!tertunda;
export function cekAbsenTertunda() {
  if (!tertunda) return;
  const v = tertunda; tertunda = null; try { sessionStorage.removeItem('amu-absen'); } catch (e) {}
  mulaiAbsen(v);
}
const uraiKode = v => { const s = String(v || ''); const m = s.match(/[?&]absen=([^&#]+)/); const x = decodeURIComponent(m ? m[1] : s); const [cab, kode] = x.split('~'); return cab && kode ? { cab, kode } : null; };

/* ---------- Kamera ---------- */
let stream = null;
const stopKamera = () => { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } };
function awasiModal() {
  const root = $('#modal-root'), obs = new MutationObserver(() => { if (!root.querySelector('video')) { stopKamera(); obs.disconnect(); } });
  obs.observe(root, { childList: true, subtree: true });
}
async function bukaKamera(video, depan) {
  stopKamera();
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: depan ? 'user' : { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
  video.srcObject = stream; await video.play().catch(() => {});
}

// Scan QR di dalam aplikasi (Chrome Android). Di HP lain: pakai aplikasi Kamera bawaan.
async function scanQr() {
  if (!kunciSaya()) { toast('Super admin tidak perlu absen'); return; }
  const bisa = 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;
  modal(`<h3>Scan QR absen</h3>${bisa ? `<video id="ab-scan" playsinline muted style="width:100%;border-radius:8px;background:#000;aspect-ratio:4/3;object-fit:cover"></video><p class="small muted" style="margin:0">Arahkan ke QR di layar absen bengkel.</p>`
    : `<p style="margin:0">Buka aplikasi <b>Kamera</b> HP, arahkan ke QR di layar absen bengkel, lalu ketuk link yang muncul. Aplikasi ini akan terbuka langsung ke langkah selfie.</p>`}
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Tutup</button></div>`);
  if (!bisa) return;
  awasiModal();
  const video = $('#ab-scan');
  try { await bukaKamera(video, false); } catch (e) { toast('Kamera tidak bisa dibuka: ' + (e.message || e.name)); return; }
  const det = new window.BarcodeDetector({ formats: ['qr_code'] });
  const loop = async () => {
    if (!video.isConnected || !stream) return;
    try { const r = await det.detect(video); const k = r.length && uraiKode(r[0].rawValue); if (k) { stopKamera(); closeModal(); mulaiAbsen(k.cab + '~' + k.kode); return; } } catch (e) {}
    setTimeout(loop, 300);
  };
  loop();
}

// Ambil selfie dari kamera depan → JPEG kecil (240×320)
function ambilFoto(video) {
  const W = 240, H = 320, c = document.createElement('canvas'); c.width = W; c.height = H;
  const vw = video.videoWidth || 640, vh = video.videoHeight || 480, skala = Math.max(W / vw, H / vh);
  const sw = W / skala, sh = H / skala, ctx = c.getContext('2d');
  ctx.translate(W, 0); ctx.scale(-1, 1);   // cermin, seperti yang terlihat di layar
  ctx.drawImage(video, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, W, H);
  return c.toDataURL('image/jpeg', 0.6);
}
const lokasiSekarang = () => new Promise(res => {
  if (!navigator.geolocation) return res(null);
  navigator.geolocation.getCurrentPosition(p => res({ lat: +p.coords.latitude.toFixed(6), lng: +p.coords.longitude.toFixed(6), akurasi: Math.round(p.coords.accuracy) }), () => res(null), { enableHighAccuracy: true, timeout: 9000, maximumAge: 30000 });
});

export async function mulaiAbsen(v) {
  const k = uraiKode(v), kunci = kunciSaya();
  if (!k) { toast('QR absen tidak dikenali'); return; }
  if (!kunci) { toast('Super admin tidak perlu absen'); return; }
  const cabSaya = st.petugas.cabang || CABANG_UTAMA;
  if (!isRole('admin') && k.cab !== cabSaya) { modal(`<h3>QR cabang lain</h3><p style="margin:0">QR ini untuk cabang <b>${esc(namaCabang(k.cab))}</b>, sedangkan Anda terdaftar di <b>${esc(namaCabang(cabSaya))}</b>. Minta super admin memindahkan cabang Anda bila perlu.</p><div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-close="1">Tutup</button></div>`); return; }
  // HP terdaftar
  const hp = idPerangkat();
  try {
    const ps = await getDoc(doc(db, 'absenPerangkat', kunci));
    if (!ps.exists()) await setDoc(doc(db, 'absenPerangkat', kunci), { kunci, device: hp, nama: st.petugas.nama || '', tgl: stamp(new Date()), info: navigator.userAgent.slice(0, 140) });
    else if (ps.data().device !== hp) { modal(`<h3>HP tidak terdaftar</h3><p style="margin:0">Absen Anda terdaftar di HP lain (sejak ${esc(ps.data().tgl || '')}). Absen hanya bisa dari HP itu. Bila ganti HP atau data browser terhapus, minta super admin <b>reset HP terdaftar</b> di menu Absensi.</p><div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-close="1">Tutup</button></div>`); return; }
  } catch (e) { toast(errMsg(e)); return; }
  const tgl = tglWIB(), id = idAbsen(kunci, tgl);
  let ada = null; try { const s = await getDoc(doc(db, 'absen', id)); ada = s.exists() ? s.data() : null; } catch (e) { /* belum ada */ }
  if (ada?.manual) { toast('Hari ini sudah dicatat super admin: ' + (STATUS_MANUAL[ada.manual] || ada.manual)); return; }
  const jenis = ada?.masuk ? 'pulang' : 'masuk';
  const lokasi = lokasiSekarang();
  modal(`<h3>Absen ${jenis} · ${esc(namaCabang(k.cab))}</h3>
    ${ada?.pulang ? `<div class="note small">Anda sudah absen pulang ${esc(jamWIB(waktuScan(ada.pulang)))}. Absen lagi akan mengganti jam pulang.</div>` : ''}
    <video id="ab-selfie" playsinline muted style="width:100%;max-width:320px;align-self:center;border-radius:12px;background:#000;aspect-ratio:3/4;object-fit:cover;transform:scaleX(-1)"></video>
    <p class="small muted" style="margin:0">Pastikan wajah terlihat jelas dan lokasi (GPS) aktif. Foto diambil langsung dari kamera (tidak bisa dari galeri) dan hanya bisa dilihat Anda &amp; super admin.</p>
    <div class="err" id="ab-err" hidden></div>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Batal</button><button class="btn pri" type="button" id="ab-ok" disabled>📸 Ambil foto &amp; absen ${jenis}</button></div>`);
  awasiModal();
  const video = $('#ab-selfie'), ok = $('#ab-ok'), err = $('#ab-err');
  try { await bukaKamera(video, true); ok.disabled = false; }
  catch (e) { err.hidden = false; err.textContent = 'Kamera depan tidak bisa dibuka. Izinkan akses kamera untuk situs ini lalu scan ulang.'; return; }
  ok.onclick = async () => {
    ok.disabled = true; ok.textContent = 'Menyimpan…';
    const foto = ambilFoto(video); stopKamera();
    const loc = await Promise.race([lokasi, new Promise(r => setTimeout(() => r(null), 8000))]);
    if (!loc) { ok.hidden = true; err.hidden = false; err.textContent = 'Lokasi (GPS) tidak terbaca. Aktifkan lokasi dan izinkan untuk situs ini, lalu scan ulang QR.'; return; }
    const scan = { ts: serverTimestamp(), klien: new Date().toISOString(), kode: k.kode, perangkat: hp, ...(loc || {}) };
    try {
      const b = writeBatch(db);
      if (jenis === 'masuk') b.set(doc(db, 'absen', id), { kunci, nama: st.petugas.nama || '', peran: st.role, cabang: k.cab, tgl, bulan: tgl.slice(0, 7), hari: hariNum(tgl), masuk: scan });
      else b.update(doc(db, 'absen', id), { pulang: scan });
      b.set(doc(db, 'absenFoto', id + (jenis === 'masuk' ? '_m' : '_p')), { kunci, tgl, cabang: k.cab, jenis, foto });
      await b.commit();
      closeModal(); toast(`Absen ${jenis} tercatat ${jamWIB(new Date())}`);
      if (st.view === 'absensi') renderAbsensi();
    } catch (e) {
      ok.hidden = true; err.hidden = false;
      err.textContent = e.code === 'permission-denied' ? 'Absen ditolak: kode QR sudah kedaluwarsa, HP tidak terdaftar, atau tanggal/jam HP tidak otomatis. Scan ulang QR di layar bengkel.' : errMsg(e);
    }
  };
}

/* ---------- Tampilan ---------- */
const AB = st.ab = st.ab || { tab: 'harian', tgl: tglWIB(), bulan: tglWIB().slice(0, 7), cab: '' };
const namaBulan = ym => new Date(ym + '-01T00:00').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
const geserBulan = (ym, n) => { const d = new Date(ym + '-01T00:00'); d.setMonth(d.getMonth() + n, 1); return dkey(d).slice(0, 7); };
const jamTampil = x => x ? jamWIB(waktuScan(x)) : '–';
function statusPill(n) {
  if (n.manual) return `<span class="pill ${n.manual === 'hadir' ? 'p-good' : n.manual === 'alpa' ? 'p-bad' : 'p-info'}">${esc(STATUS_MANUAL[n.manual])}</span>`;
  const p = [];
  if (n.telat) p.push(`<span class="pill p-warn">Terlambat ${fmtMenit(n.telat)}</span>`);
  if (n.tanpaPulang) p.push('<span class="pill p-bad">Tanpa scan pulang</span>');
  if (n.belumPulang) p.push('<span class="pill p-info">Belum pulang</span>');
  if (n.cepat) p.push(`<span class="pill p-warn">Pulang cepat ${fmtMenit(n.cepat)}</span>`);
  if (!p.length && n.hadir) p.push('<span class="pill p-good">Tepat waktu</span>');
  return p.join(' ');
}
const tilesRekap = (x, a) => `<div class="tiles t5">
  <div class="tile"><span class="lbl">Hari hadir</span><span class="val">${x.hadir}</span><span class="sub">uang hadir ${rp(x.uangHadir)}</span></div>
  <div class="tile"><span class="lbl">Terlambat</span><span class="val" style="color:${x.telat ? 'var(--warn)' : 'inherit'}">${x.telat}×</span><span class="sub">potongan ${rp(x.potongTelat)}</span></div>
  <div class="tile"><span class="lbl">Tanpa scan pulang</span><span class="val" style="color:${x.tanpaPulang ? 'var(--bad)' : 'inherit'}">${x.tanpaPulang}</span><span class="sub">${a.wajibPulang ? 'tidak dapat uang hadir' : 'tidak wajib'}</span></div>
  <div class="tile"><span class="lbl">Pulang cepat</span><span class="val">${x.cepat}×</span><span class="sub">${a.potongPulangCepat ? 'potongan ' + rp(x.potongCepat) : 'tanpa potongan'}</span></div>
  <div class="tile"><span class="lbl">Izin / sakit / alpa</span><span class="val">${x.izin} / ${x.sakit} / ${x.alpa}</span><span class="sub">dicatat super admin</span></div></div>`;
const kosong = () => ({ hadir: 0, telat: 0, telatMenit: 0, cepat: 0, tanpaPulang: 0, izin: 0, sakit: 0, alpa: 0, uangHadir: 0, potongTelat: 0, potongCepat: 0, list: [] });

async function renderAbsensi() {
  $('#view').innerHTML = `<div class="panel">${loaderHTML('Memuat absensi…')}</div>`;
  let a; try { a = await muatAturanAbsen(true); } catch (e) { a = { ...ABSEN_DEFAULT }; }
  if (st.view !== 'absensi') return;
  return isSuper() ? renderSuper(a) : renderSaya(a);
}

/* Karyawan: absen saya */
async function renderSaya(a) {
  const kunci = kunciSaya(), ym = AB.bulan;
  let docs = [], hp = null;
  try { [docs, hp] = await Promise.all([absenBulan(ym, kunci), getDoc(doc(db, 'absenPerangkat', kunci)).then(s => s.exists() ? s.data() : null).catch(() => null)]); }
  catch (e) { $('#view').innerHTML = `<div class="panel"><div class="err">${esc(errMsg(e))}</div></div>`; return; }
  if (st.view !== 'absensi') return;
  const x = rekapAbsen(docs, a)[kunci] || kosong(), hariIni = docs.find(r => r.tgl === tglWIB()), n = hariIni && nilaiHari(hariIni, a);
  const j = jamCabang(a, st.petugas.cabang || CABANG_UTAMA), hpIni = hp && hp.device === idPerangkat();
  $('#view').innerHTML = `<div class="grid">
   <div class="panel"><div class="row spread"><h3>Hari ini · ${esc(new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }))}</h3><span class="small muted">Jam kerja ${esc(j.masuk)}–${esc(j.pulang)} · toleransi ${a.toleransi} mnt</span></div>
    <div class="tiles"><div class="tile"><span class="lbl">Masuk</span><span class="val">${hariIni ? jamTampil(hariIni.masuk) : '–'}</span><span class="sub">${n ? statusPill({ ...n, tanpaPulang: false, belumPulang: false, cepat: 0 }) : 'belum absen'}</span></div>
     <div class="tile"><span class="lbl">Pulang</span><span class="val">${hariIni ? jamTampil(hariIni.pulang) : '–'}</span><span class="sub">${hariIni?.pulang ? (n.cepat ? 'pulang cepat ' + fmtMenit(n.cepat) : 'tercatat') : 'scan lagi saat pulang'}</span></div></div>
    <div class="row"><button class="btn pri" type="button" data-act="ab-scan" style="font-size:1.05rem;padding:12px 18px">📷 Scan QR absen ${hariIni?.masuk ? 'pulang' : 'masuk'}</button></div>
    <p class="small muted" style="margin:0">Scan QR di layar absen bengkel (berganti tiap 15 detik), lalu selfie. ${hp ? (hpIni ? '✅ HP ini adalah HP absen Anda.' : '⚠️ HP ini <b>bukan</b> HP absen terdaftar Anda; absen akan ditolak.') : 'HP yang dipakai pertama kali absen akan menjadi HP absen Anda.'}</p>
   </div>
   <div class="panel"><div class="row spread"><div class="lap-nav"><button class="btn sm" type="button" data-act="ab-bln" data-n="-1" aria-label="Bulan sebelumnya">‹</button><b>${esc(namaBulan(ym))}</b><button class="btn sm" type="button" data-act="ab-bln" data-n="1" aria-label="Bulan berikutnya" ${ym >= tglWIB().slice(0, 7) ? 'disabled' : ''}>›</button></div></div>
    ${tilesRekap(x, a)}
    ${x.list.length ? `<div class="tw"><table><thead><tr><th>Tanggal</th><th>Masuk</th><th>Pulang</th><th>Keterangan</th></tr></thead><tbody>${[...x.list].reverse().map(({ r, n }) => `<tr><td>${esc(new Date(r.tgl + 'T00:00').toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' }))}</td><td class="num">${jamTampil(r.masuk)}</td><td class="num">${jamTampil(r.pulang)}</td><td>${statusPill(n)}${r.catatan ? `<div class="small muted">${esc(r.catatan)}</div>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="small muted">Belum ada absensi bulan ini.</div>'}
   </div></div>`;
}

/* Super admin: harian, rekap, HP terdaftar, pengaturan */
let karyawan = null, fotoDibersihkan = false;
async function daftarKaryawan() {
  if (!karyawan) karyawan = (await loadLoginList()).map(p => ({ ...p, kunci: kunciLogin(p), cabang: p.cabang || CABANG_UTAMA })).filter(p => p.kunci && p.kunci !== 'M:').sort((x, y) => x.nama.localeCompare(y.nama));
  return karyawan.filter(p => !AB.cab || p.cabang === AB.cab);
}
async function bersihkanFoto(a) {
  if (fotoDibersihkan) return; fotoDibersihkan = true;
  try {
    const batas = dkey(new Date(Date.now() - (+a.simpanFoto || 90) * 864e5));
    const s = await getDocs(query(collection(db, 'absenFoto'), where('tgl', '<', batas), limit(300)));
    if (!s.docs.length) return;
    const b = writeBatch(db); s.docs.forEach(d => b.delete(d.ref)); await b.commit();
  } catch (e) { console.warn('Bersihkan foto absen', e); }
}
async function renderSuper(a) {
  const tabs = [['harian', 'Harian'], ['rekap', 'Rekap bulanan'], ['layar', 'Layar QR'], ['hp', 'HP terdaftar'], ['atur', 'Pengaturan']];
  // Lokasi bengkel & status layar diambil dari perangkat layar QR tiap cabang
  try { layarList = (await getDocs(collection(db, 'layarAbsen'))).docs.map(d => ({ id: d.id, ...d.data() })); } catch (e) { layarList = []; }
  a.lokasi = { ...(a.lokasi || {}) }; layarList.forEach(l => { if (l.status === 'aktif' && l.lokasi) a.lokasi[l.id] = l.lokasi; });
  const url = new URL('absen.html', location.href).href;
  $('#view').innerHTML = `<div class="panel"><div class="row spread"><div class="subtabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-act="ab-tab" data-t="${k}" aria-selected="${k === AB.tab}">${l}</button>`).join('')}</div>
    <span class="small muted">Layar QR: buka <b>${esc(url.replace(/^https?:\/\//, '').replace(/\.html$/, ''))}</b> di TV/tablet cabang</span></div><div id="ab-body">${loaderHTML('Memuat…')}</div></div>`;
  bersihkanFoto(a);
  try { await ({ harian: tabHarian, rekap: tabRekap, layar: tabLayar, hp: tabHp, atur: tabAtur })[AB.tab](a); }
  catch (e) { $('#ab-body').innerHTML = `<div class="err">${esc(errMsg(e))}</div>`; }
}
const pilihCabang = () => multiCabang() ? `<select id="ab-cab" style="width:auto" aria-label="Cabang"><option value="">Semua cabang</option>${cabangList(true).map(c => `<option value="${esc(c.id)}" ${c.id === AB.cab ? 'selected' : ''}>${esc(c.nama)}</option>`).join('')}</select>` : '';

let hariDocs = [], hariFoto = {};
async function tabHarian(a) {
  const tgl = AB.tgl, [org, s, f] = await Promise.all([daftarKaryawan(), getDocs(query(collection(db, 'absen'), where('hari', '==', hariNum(tgl)))), getDocs(query(collection(db, 'absenFoto'), where('tgl', '==', tgl)))]);
  hariDocs = s.docs.map(d => ({ id: d.id, ...d.data() })); hariFoto = {}; f.docs.forEach(d => { hariFoto[d.id] = d.data().foto; });
  const libur = !(a.hariKerja || []).includes(new Date(tgl + 'T00:00').getDay());
  const byK = new Map(hariDocs.map(r => [r.kunci, r]));
  const baris = org.map(p => ({ p, r: byK.get(p.kunci) || null }));
  const hadir = baris.filter(x => x.r && (x.r.masuk || x.r.manual === 'hadir')).length, telat = baris.filter(x => x.r && nilaiHari(x.r, a).telat).length;
  const flag = (r, sc) => { if (!sc) return ''; const lok = a.lokasi?.[r.cabang], d = jarak(sc, lok); const out = []; if (sc.lat == null) out.push('<span class="pill p-warn" title="Lokasi tidak terbaca">📍?</span>'); else if (d != null && d > (+a.radius || 150)) out.push(`<span class="pill p-bad" title="Jarak dari bengkel">📍 ${d >= 1000 ? (d / 1000).toFixed(1).replace('.', ',') + ' km' : d + ' m'}</span>`); return out.join(''); };
  const thumb = (id, sc) => hariFoto[id] ? `<button class="link-btn" type="button" data-act="ab-foto" data-id="${esc(id)}" title="Lihat foto"><img src="${hariFoto[id]}" alt="Selfie" style="width:42px;height:56px;object-fit:cover;border-radius:6px;display:block"></button>` : (sc ? '<span class="small muted">foto dihapus</span>' : '');
  $('#ab-body').innerHTML = `<div class="grid">
   <div class="row spread"><div class="lap-nav"><button class="btn sm" type="button" data-act="ab-hari" data-n="-1" aria-label="Hari sebelumnya">‹</button><b>${esc(new Date(tgl + 'T00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</b><button class="btn sm" type="button" data-act="ab-hari" data-n="1" aria-label="Hari berikutnya" ${tgl >= tglWIB() ? 'disabled' : ''}>›</button><input id="ab-tgl" type="date" value="${tgl}" max="${tglWIB()}" style="width:auto" aria-label="Pilih tanggal"></div>${pilihCabang()}</div>
   ${libur ? '<div class="note small">Hari ini bukan hari kerja menurut pengaturan.</div>' : ''}
   <div class="tiles"><div class="tile"><span class="lbl">Hadir</span><span class="val">${hadir} / ${org.length}</span></div><div class="tile"><span class="lbl">Terlambat</span><span class="val" style="color:${telat ? 'var(--warn)' : 'inherit'}">${telat}</span></div><div class="tile"><span class="lbl">Belum / tidak absen</span><span class="val">${org.length - baris.filter(x => x.r).length}</span></div></div>
   <div class="tw"><table><thead><tr><th>Karyawan</th>${multiCabang() ? '<th>Cabang</th>' : ''}<th>Masuk</th><th></th><th>Pulang</th><th></th><th>Keterangan</th><th></th></tr></thead><tbody>
    ${baris.map(({ p, r }) => { const n = r ? nilaiHari(r, a) : null; return `<tr><td>${esc(p.nama)}<div class="small muted">${esc(ROLES[p.peran] || p.peran)}</div></td>${multiCabang() ? `<td class="small">${esc(namaCabang(p.cabang))}</td>` : ''}
      <td class="num">${r ? jamTampil(r.masuk) : '–'}<div>${r ? flag(r, r.masuk) : ''}</div></td><td>${r ? thumb(r.id + '_m', r.masuk) : ''}</td>
      <td class="num">${r ? jamTampil(r.pulang) : '–'}<div>${r ? flag(r, r.pulang) : ''}</div></td><td>${r ? thumb(r.id + '_p', r.pulang) : ''}</td>
      <td>${n ? statusPill(n) : `<span class="pill">${tgl < tglWIB() ? 'Tidak absen' : 'Belum absen'}</span>`}${r?.catatan ? `<div class="small muted">${esc(r.catatan)}</div>` : ''}</td>
      <td class="r"><button class="btn sm ghost" type="button" data-act="ab-manual" data-k="${esc(p.kunci)}">Ubah</button></td></tr>`; }).join('') || `<tr><td colspan="8" class="empty">Belum ada karyawan.</td></tr>`}
   </tbody></table></div>
   <p class="small muted" style="margin:0">📍 merah = lokasi scan lebih dari ${a.radius} m dari bengkel${Object.keys(a.lokasi || {}).length ? '' : ' (lokasi bengkel belum ada: tekan "Simpan lokasi bengkel" di layar QR cabang)'}. Foto disimpan ${a.simpanFoto} hari.</p></div>`;
}

let rekapData = null;
async function tabRekap(a) {
  const ym = AB.bulan, [org, docs] = await Promise.all([daftarKaryawan(), absenBulan(ym)]);
  const rk = rekapAbsen(docs, a); rekapData = { ym, org, rk };
  const kini = tglWIB().slice(0, 7);
  $('#ab-body').innerHTML = `<div class="grid">
   <div class="row spread"><div class="lap-nav"><button class="btn sm" type="button" data-act="ab-bln" data-n="-1" aria-label="Bulan sebelumnya">‹</button><b>${esc(namaBulan(ym))}</b><button class="btn sm" type="button" data-act="ab-bln" data-n="1" aria-label="Bulan berikutnya" ${ym >= kini ? 'disabled' : ''}>›</button></div><div class="row">${pilihCabang()}<button class="btn" type="button" data-act="ab-xlsx">⬇ Excel</button></div></div>
   <div class="tw"><table><thead><tr><th>Karyawan</th>${multiCabang() ? '<th>Cabang</th>' : ''}<th class="r">Hadir</th><th class="r">Terlambat</th><th class="r">Tanpa pulang</th><th class="r">Izin/sakit/alpa</th><th class="r">Uang hadir</th><th class="r">Potongan</th></tr></thead><tbody>
    ${org.map(p => { const x = rk[p.kunci] || kosong(); return `<tr><td>${esc(p.nama)}</td>${multiCabang() ? `<td class="small">${esc(namaCabang(p.cabang))}</td>` : ''}<td class="r num">${x.hadir}</td><td class="r num">${x.telat ? x.telat + '× · ' + fmtMenit(x.telatMenit) : '–'}</td><td class="r num">${x.tanpaPulang || '–'}</td><td class="r num">${x.izin}/${x.sakit}/${x.alpa}</td><td class="r num" style="color:var(--good)">${rp(x.uangHadir)}</td><td class="r num" style="color:var(--bad)">${x.potongTelat + x.potongCepat ? '−' + rp(x.potongTelat + x.potongCepat) : '–'}</td></tr>`; }).join('')}
   </tbody></table></div>
   <p class="small muted" style="margin:0">Uang hadir ${rp(a.uangHadir)}/hari${a.wajibPulang ? ' (wajib scan masuk &amp; pulang)' : ''}, potongan terlambat ${rp(a.potongTelat)}/kali. Angka ini otomatis masuk ke Penghasilan Karyawan dan slip gaji.</p></div>`;
}

let layarList = [];
const fmtDetik = d => d >= 60 ? '= ' + Math.floor(d / 60) + ' menit' + (d % 60 ? ' ' + (d % 60) + ' detik' : '') : '';
const waktuTs = t => t?.toDate ? t.toDate() : (t ? new Date(t) : null);
const sejak = d => { if (!d) return '–'; const m = Math.round((Date.now() - d) / 60000); return m < 2 ? 'baru saja' : m < 60 ? m + ' menit lalu' : m < 1440 ? Math.round(m / 60) + ' jam lalu' : Math.round(m / 1440) + ' hari lalu'; };
function tabLayar() {
  const per = new Map(layarList.map(l => [l.id, l]));
  const url = new URL('absen.html', location.href).href.replace(/\.html$/, '');
  $('#ab-body').innerHTML = `<div class="grid"><p class="small muted" style="margin:0">Satu cabang = satu layar QR. Di TV/tablet cabang buka <b>${esc(url)}</b> → <b>Minta aktivasi</b> → muncul kode 4 angka → Anda atau admin menyetujui di menu <b>Persetujuan</b> setelah mencocokkan kodenya. Sejak itu layar langsung menampilkan QR setiap dinyalakan, tanpa login. Perangkat lain yang membuka link ditolak.</p>
   <div class="tw"><table><thead><tr><th>Cabang</th><th>Status</th><th>Terakhir menyala</th><th>Jam QR aktif &amp; pergantian</th><th>Lokasi</th><th></th></tr></thead><tbody>
    ${cabangList(true).map(c => { const l = per.get(c.id), st2 = l?.status; return `<tr><td>${esc(c.nama)}<div class="small muted">${esc(l?.info || '')}</div></td>
     <td>${st2 === 'aktif' ? `<span class="pill p-good">Aktif</span><div class="small muted">disetujui ${esc(l.disetujuiOleh || '')} ${esc(l.tglSetuju || '')}</div>` : st2 === 'menunggu' ? `<span class="pill p-warn">Menunggu · kode ${esc(l.kode)}</span>` : st2 ? `<span class="pill">${esc(st2)}</span>` : '<span class="pill">Belum ada</span>'}</td>
     <td class="small">${st2 === 'aktif' ? esc(sejak(waktuTs(l.terakhir))) : '–'}</td>
     <td>${l ? `<input class="ly-m" data-c="${esc(c.id)}" type="time" value="${esc(l.jamMulai || '07:00')}" style="width:auto"> – <input class="ly-s" data-c="${esc(c.id)}" type="time" value="${esc(l.jamSelesai || '18:00')}" style="width:auto"><div class="row" style="gap:6px;margin-top:6px;align-items:center"><span class="small">QR berganti tiap</span><input class="ly-j" data-c="${esc(c.id)}" type="number" data-raw min="10" max="600" value="${+l.jedaQr || 15}" style="width:80px" aria-label="Detik"><span class="small">detik</span><button class="btn sm" type="button" data-act="ly-jam" data-c="${esc(c.id)}">Simpan</button></div><div class="small muted ly-jl" data-c="${esc(c.id)}" style="min-height:1.3em">${fmtDetik(+l.jedaQr || 15)}</div>` : '<span class="small muted">–</span>'}</td>
     <td class="small">${l?.lokasi ? `✅ ±${l.lokasi.akurasi || '?'} m` : '<span class="muted">belum</span>'}</td>
     <td class="r">${st2 === 'aktif' || st2 === 'menunggu' ? `<button class="btn sm" type="button" data-act="ly-cabut" data-c="${esc(c.id)}">${st2 === 'aktif' ? 'Cabut' : 'Tolak'}</button>` : ''}</td></tr>`; }).join('')}
   </tbody></table></div></div>`;
}

async function tabHp() {
  const [org, s] = await Promise.all([daftarKaryawan(), getDocs(collection(db, 'absenPerangkat'))]);
  const hp = new Map(s.docs.map(d => [d.id, d.data()]));
  $('#ab-body').innerHTML = `<div class="grid"><p class="small muted" style="margin:0">Setiap karyawan hanya bisa absen dari satu HP (HP pertama yang dipakai absen). Reset bila karyawan ganti HP, memakai browser lain, atau data browser terhapus; HP berikutnya yang dipakai absen menjadi HP terdaftar.</p>
   <div class="row">${pilihCabang()}</div>
   <div class="tw"><table><thead><tr><th>Karyawan</th><th>HP terdaftar sejak</th><th>Perangkat</th><th></th></tr></thead><tbody>
    ${org.map(p => { const h = hp.get(p.kunci); return `<tr><td>${esc(p.nama)}</td><td class="small">${h ? esc(h.tgl) : '<span class="muted">belum ada</span>'}</td><td class="small muted" style="max-width:340px">${h ? esc(h.info || h.device) : ''}</td><td class="r">${h ? `<button class="btn sm" type="button" data-act="ab-reset-hp" data-k="${esc(p.kunci)}" data-n="${esc(p.nama)}">Reset HP</button>` : ''}</td></tr>`; }).join('')}
   </tbody></table></div></div>`;
}

function tabAtur(a) {
  const hk = a.hariKerja || [];
  $('#ab-body').innerHTML = `<div class="grid" style="max-width:820px">
   <div class="form"><label class="f" for="at-masuk">Jam masuk<input id="at-masuk" type="time" value="${esc(a.jamMasuk)}"></label>
    <label class="f" for="at-pulang">Jam pulang<input id="at-pulang" type="time" value="${esc(a.jamPulang)}"></label>
    <label class="f" for="at-tol">Toleransi terlambat (menit)<input id="at-tol" type="number" min="0" data-raw value="${a.toleransi}"></label>
    <label class="f" for="at-uang">Uang hadir per hari<input id="at-uang" type="number" min="0" value="${a.uangHadir}"></label>
    <label class="f" for="at-telat">Potongan per terlambat<input id="at-telat" type="number" min="0" value="${a.potongTelat}"></label>
    <label class="f" for="at-cepat">Potongan pulang cepat (0 = tidak)<input id="at-cepat" type="number" min="0" value="${a.potongPulangCepat || 0}"></label>
    <label class="f" for="at-radius">Radius lokasi bengkel (meter)<input id="at-radius" type="number" min="20" data-raw value="${a.radius}"></label>
    <label class="f" for="at-foto">Simpan foto selfie (hari)<input id="at-foto" type="number" min="7" max="365" data-raw value="${a.simpanFoto}"></label></div>
   <label class="chk"><input type="checkbox" id="at-wajib" ${a.wajibPulang ? 'checked' : ''}>Wajib scan pulang (tanpa scan pulang = tidak dapat uang hadir)</label>
   <div><div class="small muted" style="margin-bottom:4px">Hari kerja</div><div class="row">${HARI.map((h, i) => `<label class="chk"><input type="checkbox" class="at-hari" value="${i}" ${hk.includes(i) ? 'checked' : ''}>${h}</label>`).join('')}</div></div>
   ${multiCabang() ? `<div><h4 style="margin:4px 0">Jam khusus per cabang (kosongkan = ikut jam di atas)</h4><div class="tw"><table><thead><tr><th>Cabang</th><th>Masuk</th><th>Pulang</th><th>Lokasi bengkel</th></tr></thead><tbody>${cabangList(true).map(c => `<tr><td>${esc(c.nama)}</td><td><input class="at-cm" data-c="${esc(c.id)}" type="time" value="${esc(a.cabang?.[c.id]?.jamMasuk || '')}" style="width:auto"></td><td><input class="at-cp" data-c="${esc(c.id)}" type="time" value="${esc(a.cabang?.[c.id]?.jamPulang || '')}" style="width:auto"></td><td class="small">${a.lokasi?.[c.id] ? `✅ tersimpan ${esc(a.lokasi[c.id].tgl || '')}` : '<span class="muted">belum</span>'}</td></tr>`).join('')}</tbody></table></div></div>` : `<div class="small">Lokasi bengkel: ${a.lokasi?.[CABANG_UTAMA] ? '✅ tersimpan ' + esc(a.lokasi[CABANG_UTAMA].tgl || '') : '<span class="muted">belum diatur</span>'}</div>`}
   <p class="small muted" style="margin:0">Lokasi bengkel diambil otomatis dari perangkat layar QR cabang saat disetujui (bisa diperbarui dengan tombol "Simpan lokasi bengkel" di layar itu). Perubahan pengaturan berlaku untuk perhitungan bulan yang belum dikunci dan wajib kata sandi super admin.</p>
   <div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-act="ab-simpan">Simpan pengaturan</button></div></div>`;
}

async function exportXlsx() {
  if (!rekapData) return;
  try {
    const X = await loadXLSX(), a = await muatAturanAbsen(), { ym, org, rk } = rekapData, wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(org.map(p => { const x = rk[p.kunci] || kosong(); return { nama: p.nama, peran: ROLES[p.peran] || p.peran, cabang: namaCabang(p.cabang), hadir: x.hadir, terlambat: x.telat, menit_terlambat: x.telatMenit, tanpa_scan_pulang: x.tanpaPulang, pulang_cepat: x.cepat, izin: x.izin, sakit: x.sakit, alpa: x.alpa, uang_hadir: x.uangHadir, potongan: x.potongTelat + x.potongCepat }; })), 'Rekap ' + ym);
    const rinci = []; org.forEach(p => (rk[p.kunci]?.list || []).forEach(({ r, n }) => rinci.push({ tanggal: r.tgl, nama: p.nama, masuk: r.masuk ? jamTampil(r.masuk) : '', pulang: r.pulang ? jamTampil(r.pulang) : '', terlambat_menit: n.telat, keterangan: n.manual ? STATUS_MANUAL[n.manual] : n.tanpaPulang ? 'tanpa scan pulang' : '', catatan: r.catatan || '' })));
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rinci.length ? rinci : [{ info: 'kosong' }]), 'Rincian');
    X.writeFile(wb, `absensi-${ym}.xlsx`);
  } catch (e) { toast('Gagal export: ' + e.message); }
}

views.absensi = renderAbsensi;
refreshers.absensi = () => {};
Object.assign(actions, {
  'ab-scan': scanQr,
  'ab-tab': el => { AB.tab = el.dataset.t; renderAbsensi(); },
  'ab-bln': el => { AB.bulan = geserBulan(AB.bulan, +el.dataset.n); renderAbsensi(); },
  'ab-hari': el => { const d = new Date(AB.tgl + 'T00:00'); d.setDate(d.getDate() + +el.dataset.n); AB.tgl = dkey(d); renderAbsensi(); },
  'ab-xlsx': exportXlsx,
  'ly-jam': async el => {
    const c = el.dataset.c, m = document.querySelector(`.ly-m[data-c="${c}"]`).value, sl = document.querySelector(`.ly-s[data-c="${c}"]`).value;
    const j = Math.round(+document.querySelector(`.ly-j[data-c="${c}"]`).value);
    if (!m || !sl || menit(sl) <= menit(m)) { toast('Jam selesai harus setelah jam mulai'); return; }
    if (!(j >= 10 && j <= 600)) { toast('Pergantian QR antara 10 detik dan 10 menit'); return; }
    try { await setDoc(doc(db, 'layarAbsen', c), { jamMulai: m, jamSelesai: sl, jedaQr: j }, { merge: true }); toast('Layar ' + namaCabang(c) + ' disimpan: QR berganti tiap ' + j + ' detik'); } catch (e) { toast(errMsg(e)); }
  },
  'ly-cabut': async el => {
    const c = el.dataset.c, l = layarList.find(x => x.id === c); if (!l) return;
    if (!(await mintaPassword((l.status === 'aktif' ? 'Cabut' : 'Tolak') + ' layar absen ' + namaCabang(c), 'QR di perangkat itu langsung berhenti. Perangkat lain kemudian bisa meminta aktivasi.'))) return;
    try { await setDoc(doc(db, 'layarAbsen', c), { status: l.status === 'aktif' ? 'dicabut' : 'ditolak', dicabutOleh: st.petugas?.nama || 'Super Admin', tglCabut: stamp(new Date()) }, { merge: true }); toast('Layar ' + namaCabang(c) + ' ' + (l.status === 'aktif' ? 'dicabut' : 'ditolak')); renderAbsensi(); } catch (e) { toast(errMsg(e)); }
  },
  'ab-foto': el => { const f = hariFoto[el.dataset.id]; if (f) modal(`<img src="${f}" alt="Selfie absen" style="width:100%;max-width:360px;align-self:center;border-radius:12px"><div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-close="1">Tutup</button></div>`); },
  'ab-reset-hp': async el => {
    if (!(await mintaPassword('Reset HP absen ' + el.dataset.n, 'HP berikutnya yang dipakai absen akan menjadi HP terdaftar.'))) return;
    try { await deleteDoc(doc(db, 'absenPerangkat', el.dataset.k)); toast('HP absen ' + el.dataset.n + ' direset'); renderAbsensi(); } catch (e) { toast(errMsg(e)); }
  },
  'ab-manual': el => {
    const k = el.dataset.k, p = (karyawan || []).find(x => x.kunci === k), r = hariDocs.find(x => x.kunci === k);
    modal(`<h3>Ubah absensi ${esc(p?.nama || '')}</h3><p class="small" style="margin:0">${esc(new Date(AB.tgl + 'T00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }))}${r?.masuk ? ' · scan masuk ' + jamTampil(r.masuk) : ''}${r?.pulang ? ', pulang ' + jamTampil(r.pulang) : ''}</p>
     <label class="f" for="mn-st">Status<select id="mn-st"><option value="">Ikuti hasil scan</option>${Object.entries(STATUS_MANUAL).map(([v, l]) => `<option value="${v}" ${r?.manual === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
     <label class="f" for="mn-cat">Catatan (wajib)<input id="mn-cat" data-nocaps value="${esc(r?.catatan || '')}" placeholder="mis. HP rusak, sudah dicek di bengkel" data-autofocus></label>
     <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Batal</button><button class="btn pri" type="button" data-act="ab-manual-ok" data-k="${esc(k)}">Simpan</button></div>`);
  },
  'ab-manual-ok': async el => {
    const k = el.dataset.k, p = (karyawan || []).find(x => x.kunci === k), r = hariDocs.find(x => x.kunci === k), status = $('#mn-st').value, catatan = $('#mn-cat').value.trim();
    if (catatan.length < 3) { toast('Isi catatan'); return; }
    if (!status && !r?.masuk) { toast('Tidak ada scan untuk diikuti; pilih status'); return; }
    if (!(await mintaPassword('Ubah absensi ' + (p?.nama || ''), 'Berpengaruh pada uang hadir & potongan.'))) return;
    const id = idAbsen(k, AB.tgl);
    try {
      await setDoc(doc(db, 'absen', id), { kunci: k, nama: p?.nama || '', peran: p?.peran || '', cabang: r?.cabang || p?.cabang || CABANG_UTAMA, tgl: AB.tgl, bulan: AB.tgl.slice(0, 7), hari: hariNum(AB.tgl), manual: status || null, catatan, diubah: stamp(new Date()) }, { merge: true });
      toast('Absensi disimpan'); renderAbsensi();
    } catch (e) { toast(errMsg(e)); }
  },
  'ab-simpan': async () => {
    const hk = [...document.querySelectorAll('.at-hari:checked')].map(x => +x.value);
    const cab = {}; document.querySelectorAll('.at-cm').forEach(i => { const c = i.dataset.c, p = document.querySelector(`.at-cp[data-c="${c}"]`); if (i.value || p?.value) cab[c] = { jamMasuk: i.value || '', jamPulang: p?.value || '' }; });
    const baru = { jamMasuk: $('#at-masuk').value || '08:00', jamPulang: $('#at-pulang').value || '17:00', toleransi: +$('#at-tol').value || 0, uangHadir: +$('#at-uang').value || 0, potongTelat: +$('#at-telat').value || 0, potongPulangCepat: +$('#at-cepat').value || 0, radius: +$('#at-radius').value || 150, simpanFoto: Math.max(7, +$('#at-foto').value || 90), wajibPulang: $('#at-wajib').checked, hariKerja: hk, cabang: cab };
    if (menit(baru.jamPulang) <= menit(baru.jamMasuk)) { toast('Jam pulang harus setelah jam masuk'); return; }
    if (!(await mintaPassword('Simpan pengaturan absensi', 'Berpengaruh pada uang hadir & potongan karyawan.'))) return;
    try { const lama = await muatAturanAbsen(true); await setDoc(doc(db, 'penghasilan', 'absensi'), { ...baru, aktif: true, lokasi: lama.lokasi || {} }); aturan = null; toast('Pengaturan absensi disimpan'); renderAbsensi(); } catch (e) { toast(errMsg(e)); }
  }
});
changeHandlers.push(e => {
  if (e.target.id === 'ab-tgl' && e.target.value) { AB.tgl = e.target.value; renderAbsensi(); }
  if (e.target.id === 'ab-cab') { AB.cab = e.target.value; renderAbsensi(); }
});
inputHandlers.push(e => { if (e.target.classList?.contains('ly-j')) { const l = document.querySelector(`.ly-jl[data-c="${e.target.dataset.c}"]`); if (l) l.textContent = fmtDetik(+e.target.value || 0); } });
