// Chat internal 5.19.0: tampilan messenger dua kolom (daftar percakapan + isi percakapan),
// status Online/Sibuk/Offline setiap petugas, penanda belum dibaca per percakapan, dan pemisah tanggal.
// Pesan tetap log permanen (tidak dapat diedit/dihapus). Satu set listener dipakai bersama untuk badge sidebar
// dan layar chat, sehingga membuka Chat tidak mengunduh ulang pesan (lebih ringan & langsung tampil).
import { $, esc, toast, errMsg, stamp } from './util.js';
import { st, views, refreshers, actions, inputHandlers, changeHandlers, leaveHandlers, can } from './state.js';
import { db, collection, addDoc, getDocs, onSnapshot, query, where, orderBy, limit } from './firebase.js';
import { cabAktif, namaCabang } from './cabang.js';
import { loadLoginList } from './akun.js';
import { ROLES, SUPER_ADMIN } from './config.js';
import { loadXLSX, beriKotak, filterOtomatis } from './import-excel.js';
import { pantauPresence, statusDari, terakhirAktif, STATUS, pilihanSaya } from './presence.js';

/* ---------- Data bersama ---------- */
let pesanMap = new Map(), badgeUnsub = [], petugasList = [], presence = new Map(), presenceUnsub = null;
let percakapan = 'umum';           // 'umum' atau threadId "emailA|emailB"
let cariKontak = '', panelHp = 'daftar', snapshotPertama = true, jamUnsub = 0;
let suaraAktif = (() => { try { return localStorage.getItem('amu-chat-suara') !== '0'; } catch (e) { return true; } })();

const emailSaya = () => st.petugas?.email || '';
const threadId = (a, b) => [a, b].sort().join('|');
const msOf = p => +p?.tglMs || (p?.tgl ? Date.parse(String(p.tgl).replace(' ', 'T')) || 0 : 0);
const urut = (a, b) => msOf(a) - msOf(b) || String(a.tgl || '').localeCompare(String(b.tgl || ''));
const kunciPercakapan = p => p.ruang === 'pribadi' ? (p.threadId || threadId(...(p.participantEmails || []))) : 'umum';
const sayaPeserta = key => key === 'umum' || key.split('|').includes(emailSaya());
const lawanDari = key => key.split('|').find(e => e !== emailSaya()) || '';
const inisial = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join('').toUpperCase() || '?';
const warna = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) % 360; return h; };

/* ---------- Penanda sudah dibaca (per percakapan, per perangkat) ---------- */
const kunciBaca = () => 'amu-chat-read2-' + (emailSaya() || 'anon');
let bacaCache = null;
function bacaSemua() {
  if (bacaCache) return bacaCache;
  try { bacaCache = JSON.parse(localStorage.getItem(kunciBaca()) || '{}'); } catch (e) { bacaCache = {}; }
  // Kompatibel dengan versi lama (satu penanda untuk semua chat)
  if (bacaCache._lama == null) { let lama = ''; try { lama = localStorage.getItem('amu-chat-read-' + (emailSaya() || 'anon')) || ''; } catch (e) {} bacaCache._lama = lama ? Date.parse(lama.replace(' ', 'T')) || 0 : 0; }
  return bacaCache;
}
const dibacaSampai = key => bacaSemua()[key] ?? bacaSemua()._lama ?? 0;
function tandai(key) {
  const akhir = Math.max(0, ...pesanDi(key).map(msOf)); if (!akhir || akhir <= dibacaSampai(key)) return;
  bacaSemua()[key] = akhir; try { localStorage.setItem(kunciBaca(), JSON.stringify(bacaCache)); } catch (e) {}
}
const belumDibaca = key => pesanDi(key).filter(p => p.olehEmail !== emailSaya() && msOf(p) > dibacaSampai(key)).length;
export function tandaiChatDibaca() { tandai(percakapan); updateChatBadge(); }

/* ---------- Listener pesan (dimulai saat login, dipakai badge + layar chat) ---------- */
const semuaPesan = () => [...pesanMap.values()].sort(urut);
const pesanDi = key => semuaPesan().filter(p => kunciPercakapan(p) === key);

function beep() {
  if (!suaraAktif) return;
  try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; const c = new C(), o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = 740; g.gain.setValueAtTime(.001, c.currentTime); g.gain.exponentialRampToValueAtTime(.12, c.currentTime + .02); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .22); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + .24); setTimeout(() => c.close?.(), 400); } catch (e) {}
}
function updateChatBadge() {
  const b = document.querySelector('.sb-link[data-view="chat"]'); if (!b) return;
  b.querySelector('.sb-badge')?.remove();
  const kunci = new Set(semuaPesan().map(kunciPercakapan).filter(sayaPeserta));
  const n = [...kunci].reduce((a, k) => a + belumDibaca(k), 0);
  if (n) b.insertAdjacentHTML('beforeend', ` <span class="sb-badge chat-unread-badge">${n > 99 ? '99+' : n}</span>`);
}
function terima(s, tandaPertama) {
  const masuk = [];
  s.docChanges().forEach(c => { if (c.type === 'added' && !pesanMap.has(c.doc.id)) masuk.push(c.doc.data()); });
  s.docs.forEach(d => pesanMap.set(d.id, { id: d.id, ...d.data() }));
  if (!tandaPertama.v && masuk.some(p => p.olehEmail !== emailSaya() && sayaPeserta(kunciPercakapan(p)))) beep();
  tandaPertama.v = false;
  if (st.view === 'chat' && !document.hidden) tandai(percakapan);
  updateChatBadge();
  if (st.view === 'chat') renderIsi();
}
// Query berurutan waktu (butuh index chat di firestore.indexes.json). Bila index belum dibuat, otomatis memakai cara lama.
function dengarkan(qBaru, qLama) {
  const pertama = { v: true };
  let unsub = onSnapshot(qBaru, s => terima(s, pertama), e => {
    if (e?.code === 'failed-precondition' || /index/i.test(e?.message || '')) { console.warn('Index chat belum dibuat, memakai query lama.'); unsub = onSnapshot(qLama, s => terima(s, pertama), () => {}); badgeUnsub.push(() => unsub()); }
  });
  badgeUnsub.push(() => unsub());
}
export function pantauChatBadge() {
  badgeUnsub.forEach(f => f?.()); badgeUnsub = []; pesanMap = new Map(); bacaCache = null;
  if (!st.petugas || !can('chat')) { updateChatBadge(); return; }
  const c = collection(db, 'chat');
  try {
    dengarkan(query(c, where('ruang', '==', 'umum'), orderBy('tgl', 'desc'), limit(300)), query(c, where('ruang', '==', 'umum'), limit(300)));
    if (st.petugas.super) dengarkan(query(c, where('ruang', '==', 'pribadi'), orderBy('tgl', 'desc'), limit(600)), query(c, where('ruang', '==', 'pribadi'), limit(600)));
    else dengarkan(query(c, where('ruang', '==', 'pribadi'), where('participantEmails', 'array-contains', emailSaya()), orderBy('tgl', 'desc'), limit(500)), query(c, where('ruang', '==', 'pribadi'), where('participantEmails', 'array-contains', emailSaya()), limit(500)));
  } catch (e) { console.warn(e); }
}

/* ---------- Kontak & status ---------- */
function kontakSemua() {
  const list = petugasList.filter(p => p.email && p.email !== emailSaya()).map(p => ({ email: p.email, nama: p.nama, peran: ROLES[p.peran] || p.peran || '', cabang: p.cabang || '' }));
  if (emailSaya() !== SUPER_ADMIN) list.push({ email: SUPER_ADMIN, nama: 'Super Admin', peran: 'Pemilik', cabang: '' });
  return list;
}
const kontakDari = email => kontakSemua().find(k => k.email === email) || { email, nama: presence.get(email)?.nama || email.split('@')[0], peran: presence.get(email)?.peranLabel || '', cabang: presence.get(email)?.cabang || '' };
const statusOrang = email => email === emailSaya() ? pilihanSaya() : statusDari(presence.get(email));
const dot = (email, kecil = false) => { const s = statusOrang(email); return `<span class="st-dot ${STATUS[s].kelas}${kecil ? ' sm' : ''}" title="${STATUS[s].label}"></span>`; };
const avatar = (nama, email, cls = '') => `<span class="ch-av ${cls}" style="--h:${warna(email || nama)}"${email && cls !== 'xs' && cls !== '' ? ` data-act="profil-lihat" data-email="${esc(email)}" data-nama="${esc(nama || '')}" role="button" tabindex="0" title="Lihat profil ${esc(nama || '')}"` : ''}>${esc(inisial(nama))}${email ? dot(email, true) : ''}</span>`;
function teksStatus(email) {
  const s = statusOrang(email);
  if (s === 'online') return '<span class="ch-live"><i></i>Online · live</span>';
  if (s === 'sibuk') return '<span class="ch-busy">Sibuk</span>';
  return `<span class="muted">Offline · ${esc(terakhirAktif(presence.get(email)))}</span>`;
}
const jumlahOnline = () => kontakSemua().filter(k => statusOrang(k.email) !== 'offline').length + 1;

/* ---------- Format waktu ---------- */
const jam = ms => new Date(ms).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
function labelHari(ms) {
  const d = new Date(ms), h = new Date(); const sel = Math.round((new Date(h.toDateString()) - new Date(d.toDateString())) / 864e5);
  if (sel === 0) return 'Hari ini'; if (sel === 1) return 'Kemarin';
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: d.getFullYear() === h.getFullYear() ? undefined : 'numeric' });
}
function waktuSingkat(ms) {
  if (!ms) return ''; const d = new Date(ms), h = new Date();
  if (d.toDateString() === h.toDateString()) return jam(ms);
  const sel = Math.round((new Date(h.toDateString()) - new Date(d.toDateString())) / 864e5);
  return sel === 1 ? 'Kemarin' : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/* ---------- Render ---------- */
function daftarPercakapan() {
  const q = cariKontak.trim().toLowerCase();
  const terakhir = key => { const l = pesanDi(key); return l[l.length - 1]; };
  const item = (key, judul, sub, av, extra = '') => {
    const t = terakhir(key), n = sayaPeserta(key) ? belumDibaca(key) : 0;
    const cuplik = t ? (t.olehEmail === emailSaya() ? 'Anda: ' : (key === 'umum' ? (t.oleh || '').split(' ')[0] + ': ' : '')) + t.teks : sub;
    return `<button type="button" class="ch-item${key === percakapan ? ' on' : ''}${n ? ' unread' : ''}" data-act="chat-buka" data-k="${esc(key)}">${av}<span class="ch-item-main"><span class="ch-item-top"><b>${esc(judul)}</b><small>${t ? esc(waktuSingkat(msOf(t))) : ''}</small></span><span class="ch-item-sub"><span>${esc(String(cuplik || '').slice(0, 80))}</span>${n ? `<i class="ch-count">${n > 99 ? '99+' : n}</i>` : extra}</span></span></button>`;
  };
  let html = '';
  if (!q || 'umum semua petugas'.includes(q)) html += item('umum', 'Umum · semua petugas', 'Ruang bersama seluruh petugas', `<span class="ch-av ch-av-umum" aria-hidden="true">#</span>`);
  const kontak = kontakSemua().filter(k => !q || (k.nama + ' ' + k.peran + ' ' + namaCabang(k.cabang)).toLowerCase().includes(q)).map(k => {
    const key = threadId(emailSaya(), k.email), t = terakhir(key), s = statusOrang(k.email);
    return { k, key, ms: t ? msOf(t) : 0, rank: s === 'online' ? 0 : s === 'sibuk' ? 1 : 2 };
  }).sort((a, b) => (b.ms - a.ms) || (a.rank - b.rank) || String(a.k.nama).localeCompare(String(b.k.nama)));
  const aktifChat = kontak.filter(x => x.ms), lain = kontak.filter(x => !x.ms);
  if (aktifChat.length) html += `<div class="ch-sep">Percakapan</div>` + aktifChat.map(x => item(x.key, x.k.nama, '', avatar(x.k.nama, x.k.email))).join('');
  if (lain.length) html += `<div class="ch-sep">Petugas · ${lain.filter(x => x.rank < 2).length} online</div>` + lain.map(x => item(x.key, x.k.nama, `${x.k.peran}${x.k.cabang ? ' · ' + namaCabang(x.k.cabang) : ''}`, avatar(x.k.nama, x.k.email), `<small class="ch-st-txt">${STATUS[statusOrang(x.k.email)].label}</small>`)).join('');
  // Super admin: percakapan pribadi antarpetugas lain (hanya dipantau)
  if (st.petugas?.super) {
    const pantau = [...new Set(semuaPesan().map(kunciPercakapan))].filter(k => k !== 'umum' && !sayaPeserta(k));
    const judul = k => k.split('|').map(e => kontakDari(e).nama).join(' ↔ ');
    const l = pantau.filter(k => !q || judul(k).toLowerCase().includes(q)).sort((a, b) => msOf(terakhir(b)) - msOf(terakhir(a)));
    if (l.length) html += `<div class="ch-sep">Pantau percakapan petugas</div>` + l.map(k => item(k, judul(k), '', `<span class="ch-av ch-av-umum" aria-hidden="true">👁</span>`)).join('');
  }
  return html || '<div class="empty">Tidak ada petugas yang cocok.</div>';
}
function kepalaPercakapan() {
  const back = '<button class="ch-back" type="button" data-act="chat-kembali" aria-label="Kembali ke daftar">‹</button>';
  if (percakapan === 'umum') {
    const on = kontakSemua().filter(k => statusOrang(k.email) !== 'offline').slice(0, 5);
    return `${back}<span class="ch-av ch-av-umum">#</span><div class="ch-head-main"><b>Umum · semua petugas</b><small><span class="ch-live"><i></i>${jumlahOnline()} online</span> · pesan terlihat oleh semua petugas yang punya akses Chat</small></div><span class="ch-stack">${on.map(k => avatar(k.nama, k.email, 'xs')).join('')}</span>`;
  }
  if (!sayaPeserta(percakapan)) return `${back}<span class="ch-av ch-av-umum">👁</span><div class="ch-head-main"><b>${esc(percakapan.split('|').map(e => kontakDari(e).nama).join(' ↔ '))}</b><small>Mode pantau Super Admin · hanya baca</small></div>`;
  const k = kontakDari(lawanDari(percakapan));
  return `${back}${avatar(k.nama, k.email, 'lg')}<div class="ch-head-main"><b>${esc(k.nama)}</b><small>${teksStatus(k.email)}${k.peran ? ' · ' + esc(k.peran) : ''}${k.cabang ? ' · ' + esc(namaCabang(k.cabang)) : ''}</small></div>`;
}
function isiPesan() {
  const list = pesanDi(percakapan);
  if (!list.length) return `<div class="ch-empty"><div class="ch-empty-ic">💬</div><b>${percakapan === 'umum' ? 'Belum ada pesan umum' : 'Mulai percakapan'}</b><span>${percakapan === 'umum' ? 'Sapa rekan kerja atau sampaikan informasi untuk semua petugas.' : 'Tulis pesan pertama di bawah. Pesan pribadi hanya terlihat oleh Anda dan petugas ini (serta Super Admin untuk audit).'}</span></div>`;
  let html = '', hari = '', sebelum = null;
  list.forEach(p => {
    const ms = msOf(p), h = labelHari(ms), mine = p.olehEmail === emailSaya();
    if (h !== hari) { html += `<div class="ch-day"><span>${esc(h)}</span></div>`; hari = h; sebelum = null; }
    const lanjut = sebelum && sebelum.olehEmail === p.olehEmail && ms - msOf(sebelum) < 5 * 60000;
    html += `<div class="ch-row${mine ? ' mine' : ''}${lanjut ? ' cont' : ''}">${!mine && !lanjut ? avatar(p.oleh, p.olehEmail, 'sm') : '<span class="ch-av-sp"></span>'}<div class="ch-bubble">${!mine && !lanjut ? `<div class="ch-from"><b>${esc(p.oleh || 'Petugas')}</b><span>${esc(p.peranLabel || p.peran || '')}${p.cabang ? ' · ' + esc(namaCabang(p.cabang)) : ''}</span></div>` : ''}<div class="ch-text">${esc(p.teks || '')}</div><time title="${esc(new Date(ms).toLocaleString('id-ID'))}">${esc(jam(ms))}</time></div></div>`;
    sebelum = p;
  });
  return html;
}
function bolehKirim() { return percakapan === 'umum' || sayaPeserta(percakapan); }
function renderChat() {
  const el = $('#view'); if (!el) return;
  el.innerHTML = `<div class="ch-app" data-pane="${panelHp}">
    <aside class="ch-side">
      <div class="ch-side-h"><div><h2>Chat</h2><small>${jumlahOnline()} petugas online</small></div>${st.petugas?.super ? '<button class="btn sm" type="button" data-act="chat-download" title="Unduh transkrip seluruh chat (Excel)">⬇ Excel</button>' : ''}</div>
      <label class="ch-search"><span aria-hidden="true">⌕</span><input id="chat-cari" placeholder="Cari petugas atau cabang…" autocomplete="off" value="${esc(cariKontak)}" aria-label="Cari petugas"></label>
      <div class="ch-list" id="chat-list">${daftarPercakapan()}</div>
      <label class="ch-sound"><input id="chat-sound" type="checkbox" ${suaraAktif ? 'checked' : ''}> Bunyi notifikasi pesan baru</label>
    </aside>
    <section class="ch-main">
      <header class="ch-head" id="chat-head">${kepalaPercakapan()}</header>
      <div class="ch-body" id="chat-body">${isiPesan()}</div>
      ${bolehKirim() ? `<form id="chat-form" class="ch-form"><textarea id="chat-text" rows="1" maxlength="2000" placeholder="Tulis pesan…" title="Enter = kirim · Shift+Enter = baris baru" aria-label="Pesan chat" autocapitalize="sentences" spellcheck="false" enterkeyhint="send"></textarea><button class="ch-send" type="submit" aria-label="Kirim pesan"><svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12.6 2-12.6 2z"/></svg></button></form>` : '<div class="ch-readonly">Mode pantau: Super Admin hanya dapat membaca percakapan ini.</div>'}
    </section></div>`;
  const b = $('#chat-body'); if (b) b.scrollTop = b.scrollHeight;
}
// Render ringan saat ada pesan/status baru: hanya bagian yang berubah, posisi gulir & teks ketikan tetap
function renderIsi() {
  if (st.view !== 'chat' || !$('#chat-body')) return;
  const b = $('#chat-body'), bawah = b.scrollHeight - b.scrollTop - b.clientHeight < 90;
  b.innerHTML = isiPesan(); if (bawah) b.scrollTop = b.scrollHeight;
  $('#chat-list').innerHTML = daftarPercakapan();
  $('#chat-head').innerHTML = kepalaPercakapan();
  const h = document.querySelector('.ch-side-h small'); if (h) h.textContent = jumlahOnline() + ' petugas online';
}

/* ---------- Aksi ---------- */
async function kirimChat(e) {
  e.preventDefault(); const el = $('#chat-text'), teks = (el?.value || '').trim();
  if (!teks) return toast('Tulis pesan terlebih dahulu');
  if (!bolehKirim()) return;
  const p = st.petugas || {}, pribadi = percakapan !== 'umum', peserta = pribadi ? percakapan.split('|') : [];
  const kirim = { teks, tgl: stamp(new Date()), tglMs: Date.now(), ruang: pribadi ? 'pribadi' : 'umum', threadId: pribadi ? percakapan : 'umum', participantEmails: peserta, oleh: p.nama || p.email || 'Petugas', olehId: p.loginId || p.email || '', olehEmail: p.email || '', peran: st.role || '', peranLabel: p.super ? 'Super Admin' : (ROLES[st.role] || st.role || ''), cabang: p.cabang || cabAktif() };
  el.value = ''; autoTinggi(el); el.focus();
  try { await addDoc(collection(db, 'chat'), kirim); }
  catch (e2) { el.value = teks; autoTinggi(el); toast('Pesan gagal dikirim: ' + errMsg(e2)); }
}
function autoTinggi(t) { if (!t) return; t.style.height = 'auto'; t.style.height = Math.min(160, t.scrollHeight) + 'px'; }
async function unduhTranskrip() {
  if (!st.petugas?.super) return toast('Hanya Super Admin yang dapat mengunduh transkrip chat');
  try {
    const s = await getDocs(query(collection(db, 'chat'), limit(5000)));
    const rows = s.docs.map(d => { const p = d.data(); const t = p.ruang === 'pribadi' ? (p.participantEmails || []).filter(x => x !== p.olehEmail).map(e => kontakDari(e).nama).join(', ') : 'Semua petugas'; return { Waktu: p.tgl || '', Ruang: p.ruang === 'pribadi' ? 'Pribadi' : 'Umum', Lawan: t, Pengirim: p.oleh || '', Peran: p.peranLabel || p.peran || '', Cabang: namaCabang(p.cabang || ''), Pesan: p.teks || '', _ms: msOf(p) }; });
    rows.sort((a, b) => a._ms - b._ms || String(a.Waktu).localeCompare(String(b.Waktu))); rows.forEach(r => delete r._ms);
    const X = await loadXLSX(), wb = X.utils.book_new(), ws = X.utils.json_to_sheet(rows, { header: ['Waktu', 'Ruang', 'Lawan', 'Pengirim', 'Peran', 'Cabang', 'Pesan'] });
    beriKotak(X, ws); filterOtomatis(X, ws, rows.length); X.utils.book_append_sheet(wb, ws, 'Transkrip Chat'); X.writeFile(wb, `transkrip-chat-${stamp(new Date()).slice(0, 10)}.xlsx`); toast('Transkrip Excel berhasil diunduh');
  } catch (e) { toast('Transkrip gagal diunduh: ' + errMsg(e)); }
}

views.chat = () => {
  // Tampil langsung dari data yang sudah ada; daftar petugas & status menyusul tanpa menahan layar
  tandai(percakapan); updateChatBadge(); renderChat();
  loadLoginList().then(l => { petugasList = l; renderIsi(); }).catch(() => {});
  if (!presenceUnsub) presenceUnsub = pantauPresence(m => { presence = m; renderIsi(); });
  // Perbarui teks "aktif x menit lalu" & batas offline tiap 30 detik
  clearInterval(jamUnsub); jamUnsub = setInterval(() => { if (st.view === 'chat') renderIsi(); }, 30000);
};
refreshers.chat = () => { renderIsi(); updateChatBadge(); };
leaveHandlers.chat = () => { presenceUnsub?.(); presenceUnsub = null; clearInterval(jamUnsub); };
actions['chat-download'] = unduhTranskrip;
actions['chat-buka'] = el => { percakapan = el.dataset.k; panelHp = 'isi'; tandai(percakapan); updateChatBadge(); renderChat(); setTimeout(() => $('#chat-text')?.focus(), 0); };
actions['chat-kembali'] = () => { panelHp = 'daftar'; renderChat(); };
inputHandlers.push(e => {
  const t = e.target;
  if (t.id === 'chat-text') { if (t.value.length > 2000) t.value = t.value.slice(0, 2000); autoTinggi(t); }
  if (t.id === 'chat-cari') { cariKontak = t.value; $('#chat-list').innerHTML = daftarPercakapan(); }
});
changeHandlers.push(e => { const t = e.target; if (t.id === 'chat-sound') { suaraAktif = t.checked; try { localStorage.setItem('amu-chat-suara', suaraAktif ? '1' : '0'); } catch (err) {} } });
document.addEventListener('submit', e => { if (e.target.id === 'chat-form') kirimChat(e); });
document.addEventListener('keydown', e => { if (e.target?.id === 'chat-text' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#chat-form')?.requestSubmit(); } });
document.addEventListener('visibilitychange', () => { if (!document.hidden && st.view === 'chat') { tandai(percakapan); updateChatBadge(); renderIsi(); } });
window.addEventListener('amu-status-saya', () => { if (st.view === 'chat') renderIsi(); });
