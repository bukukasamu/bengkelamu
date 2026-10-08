// Layar TV ruang tunggu (layar.html): tanpa login, hanya membaca dokumen publik/layar yang ditulis aplikasi petugas.
// Menampilkan nomor yang dipanggil, motor yang sedang dikerjakan, menunggu, dan siap diambil,
// plus suara panggilan, teks berjalan, dan QR code menuju halaman cek servis.
import { db, doc, onSnapshot } from './firebase.js';
import { $, esc, dkey, publicUrl } from './util.js';
import { loadBrand } from './brand.js';
import { APP_NAME, APP_SUB } from './config.js';
import { qrSvg } from './qr.js';
import './pwa.js';

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const INFO_DEFAULT = 'Selamat datang di ' + APP_NAME + ' · Nomor antrian dipanggil di layar ini saat motor selesai · Pantau status servis dari HP dengan scan QR code di layar';

let data = {}, seen = null, unsub = null;
const antre = []; let sibuk = false;

/* ---------- Tampilan ---------- */
const hariIni = () => dkey(new Date());
function jam() {
  const d = new Date();
  $('#tv-date').textContent = `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
  $('#tv-time').textContent = String(d.getHours()).padStart(2, '0') + '.' + String(d.getMinutes()).padStart(2, '0');
}
const baris = (x, extra = '') => `<li><span class="tv-no">${esc(x.a || '–')}</span><span class="tv-np">${esc(x.nopol)}</span><span class="tv-tp">${esc(x.tipe || '')}</span>${extra}</li>`;
function isiList(id, nId, list, kosong, extra) {
  const el = $('#' + id), top = el.scrollTop;
  el.innerHTML = list.length ? list.map(x => baris(x, extra ? extra(x) : '')).join('') : `<li class="tv-empty">${kosong}</li>`;
  el.scrollTop = top;
  $('#' + nId).textContent = list.length ? list.length : '';
}
function render() {
  isiList('l-kerja', 'n-kerja', data.dikerjakan || [], 'Belum ada motor yang dikerjakan', x => x.mek ? `<span class="tv-mek">${esc(x.mek)}</span>` : '');
  isiList('l-tunggu', 'n-tunggu', data.menunggu || [], 'Tidak ada antrian', x => x.tunda ? '<span class="tv-tag">Ditunda</span>' : '');
  isiList('l-siap', 'n-siap', data.siap || [], 'Belum ada', null);
  // Panggilan: hanya yang hari ini
  const p = (data.panggil || []).filter(x => String(x.t || '').startsWith(hariIni()));
  const c = p[0];
  $('#call-no').textContent = c ? (c.a || '–') : '–';
  $('#call-np').textContent = c ? c.nopol : 'Belum ada panggilan';
  $('#call-ke').textContent = c ? 'Silakan ke ' + (c.ke || 'KASIR') : '';
  $('#tv-call').classList.toggle('kosong', !c);
  $('#tv-prev').hidden = p.length < 2;
  $('#prev-list').innerHTML = p.slice(1, 4).map(x => `<span><b>${esc(x.a || '–')}</b> ${esc(x.nopol)}</span>`).join('');
  const info = (data.info || '').trim() || INFO_DEFAULT;
  const el = $('#tv-info');
  if (el.textContent !== info) { el.textContent = info; el.style.animationDuration = Math.max(18, info.length * 0.28) + 's'; }
}

// Daftar yang lebih panjang dari panelnya digeser per halaman setiap 7 detik
function pager() {
  ['l-kerja', 'l-tunggu', 'l-siap'].forEach(id => {
    const el = $('#' + id); if (el.scrollHeight <= el.clientHeight + 4) { el.scrollTop = 0; return; }
    const next = el.scrollTop + el.clientHeight - 8;
    el.scrollTo({ top: next >= el.scrollHeight - el.clientHeight - 2 && el.scrollTop > 0 ? 0 : next, behavior: 'smooth' });
  });
}

/* ---------- Suara panggilan ---------- */
let ctx = null, suaraId = null;
function siapkanAudio() {
  try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch (e) { ctx = null; }
}
// Bel "ding-dong"
function bel() {
  if (!ctx) return Promise.resolve();
  const t0 = ctx.currentTime;
  [[659.25, 0], [523.25, 0.55]].forEach(([f, d]) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, t0 + d); g.gain.exponentialRampToValueAtTime(0.5, t0 + d + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 1.1);
    o.start(t0 + d); o.stop(t0 + d + 1.2);
  });
  return new Promise(r => setTimeout(r, 1700));
}
function pilihSuara() {
  const v = window.speechSynthesis?.getVoices() || [];
  suaraId = v.find(x => /^(id|in)[-_]ID/i.test(x.lang)) || v.find(x => /^(id|in)\b/i.test(x.lang)) || null;
  const el = $('#tv-voice');
  if (el) el.textContent = suaraId ? 'Suara: ' + suaraId.name : 'Suara Bahasa Indonesia tidak ditemukan di perangkat ini, panggilan memakai bunyi bel saja.';
}
// "BL 4521 AB" dibaca per huruf/angka: "B L, 4 5 2 1, A B"
const eja = np => String(np || '').trim().split(/\s+/).map(g => g.split('').join(' ')).join(', ');
const kalimat = p => `Nomor antrian, ${p.a ? parseInt(p.a, 10) : ''}. ${eja(p.nopol)}. Silakan ke ${(p.ke || 'kasir').toLowerCase()}.`;
function ucap(teks) {
  return new Promise(res => {
    if (!suaraId || !window.speechSynthesis) return res();
    const u = new SpeechSynthesisUtterance(teks); u.voice = suaraId; u.lang = suaraId.lang; u.rate = 0.9;
    const batas = setTimeout(res, 12000); u.onend = u.onerror = () => { clearTimeout(batas); res(); };
    speechSynthesis.speak(u);
  });
}
const tunggu = ms => new Promise(r => setTimeout(r, ms));
async function umumkan() {
  if (sibuk) return; sibuk = true;
  while (antre.length) {
    const p = antre.shift();
    $('#pop-no').textContent = p.a || '';
    $('#pop-np').textContent = p.nopol;
    $('#pop-ke').textContent = 'Silakan ke ' + (p.ke || 'KASIR');
    $('#tv-pop').hidden = false; $('#tv-call').classList.add('baru');
    await bel(); await ucap(kalimat(p)); await tunggu(600); await ucap(kalimat(p));
    await tunggu(suaraId ? 2500 : 7000);
    $('#tv-pop').hidden = true;
    setTimeout(() => $('#tv-call').classList.remove('baru'), 4000);
  }
  sibuk = false;
}
function cekPanggilan() {
  const list = data.panggil || [];
  // Saat layar baru dibuka, panggilan lama tidak diumumkan ulang
  if (!seen) { seen = new Set(list.map(p => p.id)); return; }
  const baru = list.filter(p => !seen.has(p.id) && String(p.t || '').startsWith(hariIni())).reverse();
  list.forEach(p => seen.add(p.id));
  if (baru.length) { antre.push(...baru); umumkan(); }
}

/* ---------- Data langsung dari Firestore ---------- */
function online(ok) { const el = $('#tv-online'); el.classList.toggle('off', !ok); el.title = ok ? 'Tersambung' : 'Koneksi terputus, mencoba lagi…'; }
function langganan() {
  unsub?.();
  unsub = onSnapshot(doc(db, 'publik', 'layar'), s => { data = s.exists() ? s.data() : {}; online(true); render(); cekPanggilan(); },
    () => { online(false); setTimeout(langganan, 10000); });
}

/* ---------- Mulai ---------- */
let wake = null;
async function jagaLayar() { try { wake = await navigator.wakeLock?.request('screen'); } catch (e) { /* tidak didukung */ } }
function mulai() {
  siapkanAudio(); pilihSuara();
  $('#tv-start').hidden = true;
  document.documentElement.requestFullscreen?.().catch(() => {});
  jagaLayar();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') jagaLayar(); });
$('#tv-start').addEventListener('click', mulai);
document.addEventListener('keydown', e => { if (!$('#tv-start').hidden && (e.key === 'Enter' || e.key === ' ')) mulai(); });
window.speechSynthesis?.addEventListener?.('voiceschanged', pilihSuara);
// Klik layar kapan saja = layar penuh lagi (mis. setelah keluar dari layar penuh)
$('#tv').addEventListener('dblclick', () => document.documentElement.requestFullscreen?.().catch(() => {}));

document.title = 'Layar Antrian · ' + APP_NAME;
$('#tv-name').textContent = APP_NAME.toUpperCase();
$('#tv-sub').textContent = APP_SUB;
jam(); setInterval(jam, 5000);
setInterval(pager, 7000);
pilihSuara();
// Bila browser sudah mengizinkan suara tanpa klik (mode kiosk), layar langsung jalan
siapkanAudio(); if (ctx && ctx.state === 'running') mulai();
loadBrand();
const cek = publicUrl('cek');
$('#tv-url').textContent = cek.replace(/^https?:\/\//, '').replace(/\/$/, '');
qrSvg(cek).then(svg => { $('#tv-qr').innerHTML = svg; }).catch(() => { $('#tv-qr').hidden = true; });
langganan();
