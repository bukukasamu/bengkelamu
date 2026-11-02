// Chat internal: ruang umum dan percakapan pribadi antarpetugas lintas cabang.
import { $, esc, toast, errMsg, stamp } from './util.js';
import { S, st, views, refreshers, actions, inputHandlers, changeHandlers, can } from './state.js';
import { db, collection, addDoc, getDocs, onSnapshot, query, where, limit } from './firebase.js';
import { cabAktif, namaCabang } from './cabang.js';
import { loadLoginList } from './akun.js';
import { ROLES } from './config.js';
import { loadXLSX, beriKotak, filterOtomatis } from './import-excel.js';

let pesan = [], unsub = [], petugasList = [], ruang = 'umum', target = '', firstSnapshot = true;
let suaraAktif = true, badgeUnsub = [], badgeDocs = new Map(), badgeStarted = false;
const emailSaya = () => st.petugas?.email || '';
const idSaya = () => st.petugas?.loginId || emailSaya();
const waktu = x => String(x?.tgl || '');
const tampilWaktu = x => { const d = x ? new Date(x.replace(' ', 'T')) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–'; };
const threadId = (a, b) => [a, b].sort().join('|');
const targetData = () => petugasList.find(p => p.email === target);
const pesanRuang = () => pesan.filter(p => ruang === 'umum' ? p.ruang === 'umum' : p.ruang === 'pribadi' && p.threadId === threadId(emailSaya(), target));

function beep() {
  if (!suaraAktif || document.hidden) return;
  try { const C = window.AudioContext || window.webkitAudioContext; if (!C) return; const c = new C(), o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = 740; g.gain.setValueAtTime(.001, c.currentTime); g.gain.exponentialRampToValueAtTime(.12, c.currentTime + .02); g.gain.exponentialRampToValueAtTime(.001, c.currentTime + .22); o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + .24); } catch (e) {}
}

function badgeKey() { return 'amu-chat-read-' + (emailSaya() || 'anon'); }
function readAt() { try { return localStorage.getItem(badgeKey()) || ''; } catch (e) { return ''; } }
function updateChatBadge() {
  const b = document.querySelector('.sb-link[data-view="chat"]'); if (!b) return;
  b.querySelector('.sb-badge')?.remove();
  const n = [...badgeDocs.values()].filter(p => p.olehEmail !== emailSaya() && String(p.tgl || '') > readAt()).length;
  if (n) b.insertAdjacentHTML('beforeend', ` <span class="sb-badge chat-unread-badge">${n > 99 ? '99+' : n}</span>`);
}
export function tandaiChatDibaca() { try { localStorage.setItem(badgeKey(), stamp(new Date())); } catch (e) {} badgeDocs = new Map([...badgeDocs].filter(([, p]) => p.olehEmail === emailSaya())); updateChatBadge(); }
export function pantauChatBadge() {
  badgeUnsub.forEach(f => f?.()); badgeUnsub = []; badgeDocs = new Map();
  if (!st.petugas || !can('chat')) { updateChatBadge(); return; }
  const terima = s => { s.docs.forEach(d => badgeDocs.set(d.id, { id: d.id, ...d.data() })); updateChatBadge(); };
  try {
    badgeUnsub.push(onSnapshot(query(collection(db, 'chat'), where('ruang', '==', 'umum'), limit(300)), terima, () => {}));
    if (st.petugas.super) badgeUnsub.push(onSnapshot(query(collection(db, 'chat'), where('ruang', '==', 'pribadi'), limit(500)), terima, () => {}));
    else badgeUnsub.push(onSnapshot(query(collection(db, 'chat'), where('ruang', '==', 'pribadi'), where('participantEmails', 'array-contains', emailSaya()), limit(500)), terima, () => {}));
    badgeStarted = true;
  } catch (e) { badgeStarted = false; }
}

function stopChat() { unsub.forEach(f => f?.()); unsub = []; }
function terimaSnapshot(s) {
  const baru = s.docChanges().filter(c => c.type === 'added').map(c => ({ id: c.doc.id, ...c.doc.data() }));
  if (!firstSnapshot && baru.some(p => p.olehEmail !== emailSaya())) beep();
  const map = new Map(pesan.map(p => [p.id, p])); s.docs.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
  pesan = [...map.values()].sort((a, b) => waktu(a).localeCompare(waktu(b))).slice(-500); renderChatBody();
  firstSnapshot = false;
}
function subscribeChat() {
  stopChat(); firstSnapshot = true; pesan = [];
  try {
    const pub = query(collection(db, 'chat'), where('ruang', '==', 'umum'), limit(300));
    unsub.push(onSnapshot(pub, terimaSnapshot, e => toast('Chat umum belum dapat dimuat: ' + errMsg(e))));
    if (st.petugas?.super) {
      const all = query(collection(db, 'chat'), where('ruang', '==', 'pribadi'), limit(500));
      unsub.push(onSnapshot(all, terimaSnapshot, e => toast('Chat pribadi belum dapat dimuat: ' + errMsg(e))));
    } else {
      const own = query(collection(db, 'chat'), where('ruang', '==', 'pribadi'), where('participantEmails', 'array-contains', emailSaya()), limit(500));
      unsub.push(onSnapshot(own, terimaSnapshot, e => toast('Chat pribadi belum dapat dimuat: ' + errMsg(e))));
    }
  } catch (e) { toast(errMsg(e)); }
}
function renderChatBody() {
  const el = $('#chat-body'); if (!el) return;
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80, list = pesanRuang();
  el.innerHTML = list.length ? list.map(p => `<article class="chat-msg ${p.olehEmail === emailSaya() ? 'mine' : ''}"><div class="chat-meta"><b>${esc(p.oleh || 'Petugas')}</b><span>${esc(p.peranLabel || p.peran || '')} · ${esc(namaCabang(p.cabang || ''))} · ${esc(tampilWaktu(waktu(p)))}</span></div><div class="chat-text">${esc(p.teks || '')}</div></article>`).join('') : `<div class="empty">${ruang === 'umum' ? 'Belum ada pesan umum.' : 'Belum ada percakapan dengan petugas ini.'}</div>`;
  if (atBottom) el.scrollTop = el.scrollHeight;
}
function opsiPetugas() {
  return petugasList.filter(p => p.email && p.email !== emailSaya()).sort((a, b) => String(a.nama).localeCompare(String(b.nama))).map(p => `<option value="${esc(p.email)}" ${p.email === target ? 'selected' : ''}>${esc(p.nama)} · ${esc(ROLES[p.peran] || p.peran)} · ${esc(namaCabang(p.cabang || ''))}</option>`).join('');
}
function renderChat() {
  stopChat();
  $('#view').innerHTML = `<div class="grid chat-layout"><div class="panel"><div class="row spread"><div><h2 style="margin:0">Chat internal</h2><p class="small muted" style="margin:4px 0 0">Koordinasi umum atau percakapan pribadi antarpetugas, termasuk lintas cabang.</p></div>${st.petugas?.super ? '<button class="btn" type="button" data-act="chat-download">Unduh Excel</button>' : ''}</div><div class="chat-toolbar"><label class="f"><span>Ruang chat</span><select id="chat-room"><option value="umum" ${ruang === 'umum' ? 'selected' : ''}>Umum semua petugas</option><option value="pribadi" ${ruang === 'pribadi' ? 'selected' : ''}>Chat pribadi</option></select></label><label class="f" id="chat-target-wrap" ${ruang === 'umum' ? 'hidden' : ''}><span>Pilih petugas</span><select id="chat-target"><option value="">Pilih petugas tujuan</option>${opsiPetugas()}</select></label><label class="chk chat-sound"><input id="chat-sound" type="checkbox" ${suaraAktif ? 'checked' : ''}> Suara pesan baru</label></div><div id="chat-body" class="chat-body"></div><form id="chat-form" class="chat-form"><textarea id="chat-text" rows="2" maxlength="2000" placeholder="Tulis pesan seperti biasa…" aria-label="Pesan chat" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send"></textarea><button class="btn pri" type="submit">Kirim</button></form><p class="small muted" style="margin:6px 0 0">Transkrip Excel hanya dapat diunduh oleh Super Admin.</p></div></div>`;
  renderChatBody(); subscribeChat(); setTimeout(() => $('#chat-text')?.focus(), 0);
}
async function kirimChat(e) {
  e.preventDefault(); const el = $('#chat-text'), teks = (el?.value || '').trim();
  if (!teks) return toast('Tulis pesan terlebih dahulu');
  if (ruang === 'pribadi' && !target) return toast('Pilih petugas tujuan terlebih dahulu');
  const p = st.petugas || {}, privateChat = ruang === 'pribadi', peserta = privateChat ? [emailSaya(), target].filter(Boolean) : [];
  try { await addDoc(collection(db, 'chat'), { teks, tgl: stamp(new Date()), ruang, threadId: privateChat ? threadId(emailSaya(), target) : 'umum', participantEmails: peserta, oleh: p.nama || p.email || 'Petugas', olehId: p.loginId || p.email || '', olehEmail: p.email || '', peran: st.role || '', peranLabel: p.super ? 'Super Admin' : (ROLES[st.role] || st.role || ''), cabang: p.cabang || cabAktif() }); el.value = ''; } catch (e2) { toast('Pesan gagal dikirim: ' + errMsg(e2)); }
}
async function unduhTranskrip() {
  if (!st.petugas?.super) return toast('Hanya Super Admin yang dapat mengunduh transkrip chat');
  try {
    const s = await getDocs(query(collection(db, 'chat'), limit(5000)));
    const rows = s.docs.map(d => { const p = d.data(); const t = p.ruang === 'pribadi' ? (p.participantEmails || []).filter(x => x !== p.olehEmail).join(', ') : 'Semua petugas'; return { Waktu: p.tgl || '', Ruang: p.ruang === 'pribadi' ? 'Pribadi' : 'Umum', Lawan: t, Pengirim: p.oleh || '', Peran: p.peranLabel || p.peran || '', Cabang: namaCabang(p.cabang || ''), Pesan: p.teks || '' }; });
    rows.sort((a, b) => String(a.Waktu).localeCompare(String(b.Waktu)));
    const X = await loadXLSX(), wb = X.utils.book_new(), ws = X.utils.json_to_sheet(rows, { header: ['Waktu', 'Ruang', 'Lawan', 'Pengirim', 'Peran', 'Cabang', 'Pesan'] });
    beriKotak(X, ws); filterOtomatis(X, ws, rows.length); X.utils.book_append_sheet(wb, ws, 'Transkrip Chat'); X.writeFile(wb, `transkrip-chat-${stamp(new Date()).slice(0, 10)}.xlsx`); toast('Transkrip Excel berhasil diunduh');
  } catch (e) { toast('Transkrip gagal diunduh: ' + errMsg(e)); }
}
async function muatPetugas() { try { petugasList = await loadLoginList(); } catch (e) { petugasList = []; } }

views.chat = async () => { await muatPetugas(); tandaiChatDibaca(); renderChat(); };
refreshers.chat = () => { renderChatBody(); updateChatBadge(); };
actions['chat-download'] = unduhTranskrip;
inputHandlers.push(e => { const t = e.target; if (t.id === 'chat-text' && t.value.length > 2000) t.value = t.value.slice(0, 2000); if (t.id === 'chat-sound') suaraAktif = t.checked; });
changeHandlers.push(e => { const t = e.target; if (t.id === 'chat-room') { ruang = t.value; target = ''; renderChat(); } if (t.id === 'chat-target') { target = t.value; renderChat(); } });
document.addEventListener('submit', e => { if (e.target.id === 'chat-form') kirimChat(e); });
