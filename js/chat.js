// Chat internal antar pengguna aplikasi. Semua petugas dapat membaca/mengirim;
// ekspor transkrip hanya tersedia dan diizinkan untuk Super Admin.
import { $, esc, toast, errMsg, stamp } from './util.js';
import { S, st, views, refreshers, actions, inputHandlers } from './state.js';
import { db, collection, addDoc, getDocs, query, orderBy, limit } from './firebase.js';
import { cabAktif, namaCabang } from './cabang.js';

let pesan = [], unsubscribe = null;
const chatCol = () => collection(db, 'chat');
const waktu = x => String(x?.tgl || '');
const tampilWaktu = x => { const d = x ? new Date(x.replace(' ', 'T')) : null; return d && !Number.isNaN(d.getTime()) ? d.toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '–'; };
const csv = v => '"' + String(v ?? '').replace(/"/g, '""').replace(/\r?\n/g, ' ') + '"';

function stopChat() { if (unsubscribe) { unsubscribe(); unsubscribe = null; } }
function subscribeChat() {
  stopChat();
  try {
    unsubscribe = query(collection(db, 'chat'), orderBy('tgl', 'desc'), limit(300));
    // onSnapshot is imported lazily to keep the module small and avoid a second global listener.
    import('./firebase.js').then(({ onSnapshot }) => {
      if (!unsubscribe) return;
      const q = unsubscribe; unsubscribe = onSnapshot(q, s => { pesan = s.docs.map(d => ({ id: d.id, ...d.data() })).reverse(); renderChatBody(); }, e => { console.warn('Chat', e); toast('Chat belum dapat dimuat: ' + errMsg(e)); });
    });
  } catch (e) { toast(errMsg(e)); }
}
function renderChatBody() {
  const el = $('#chat-body'); if (!el) return;
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  el.innerHTML = pesan.length ? pesan.map(p => `<article class="chat-msg ${p.olehId === (st.petugas?.loginId || st.petugas?.email) ? 'mine' : ''}"><div class="chat-meta"><b>${esc(p.oleh || 'Petugas')}</b><span>${esc(p.peranLabel || p.peran || '')} · ${esc(namaCabang(p.cabang || cabAktif()))} · ${esc(tampilWaktu(waktu(p)))}</span></div><div class="chat-text">${esc(p.teks || '')}</div></article>`).join('') : '<div class="empty">Belum ada pesan. Mulai percakapan untuk koordinasi tim.</div>';
  if (atBottom) el.scrollTop = el.scrollHeight;
}
function renderChat() {
  stopChat();
  $('#view').innerHTML = `<div class="grid chat-layout"><div class="panel"><div class="row spread"><div><h2 style="margin:0">Chat internal</h2><p class="small muted" style="margin:4px 0 0">Gunakan untuk koordinasi kerja. Semua pesan tersimpan sebagai log aktivitas.</p></div>${st.petugas?.super ? '<button class="btn" type="button" data-act="chat-download">Unduh transkrip</button>' : ''}</div><div id="chat-body" class="chat-body"></div><form id="chat-form" class="chat-form"><textarea id="chat-text" rows="2" maxlength="2000" placeholder="Tulis pesan untuk tim…" aria-label="Pesan chat"></textarea><button class="btn pri" type="submit">Kirim</button></form><p class="small muted" style="margin:6px 0 0">Transkrip hanya dapat diunduh oleh Super Admin.</p></div></div>`;
  renderChatBody(); subscribeChat(); setTimeout(() => { const e = $('#chat-text'); e?.focus(); }, 0);
}
async function kirimChat(e) {
  e.preventDefault(); const el = $('#chat-text'), teks = (el?.value || '').trim();
  if (!teks) return toast('Tulis pesan terlebih dahulu');
  if (teks.length > 2000) return toast('Pesan maksimal 2.000 karakter');
  const p = st.petugas || {};
  try { await addDoc(chatCol(), { teks, tgl: stamp(new Date()), oleh: p.nama || p.email || 'Petugas', olehId: p.loginId || p.email || '', olehEmail: p.email || '', peran: st.role || '', peranLabel: p.super ? 'Super Admin' : (st.role || ''), cabang: p.cabang || cabAktif() }); el.value = ''; } catch (e2) { toast('Pesan gagal dikirim: ' + errMsg(e2)); }
}
async function unduhTranskrip() {
  if (!st.petugas?.super) return toast('Hanya Super Admin yang dapat mengunduh transkrip chat');
  try {
    const s = await getDocs(query(collection(db, 'chat'), orderBy('tgl', 'asc'), limit(2000)));
    const rows = [['Waktu', 'Pengirim', 'Peran', 'Cabang', 'Pesan'], ...s.docs.map(d => { const p = d.data(); return [p.tgl, p.oleh, p.peranLabel || p.peran, namaCabang(p.cabang || ''), p.teks]; })];
    const blob = new Blob(['\ufeff' + rows.map(r => r.map(csv).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'transkrip-chat-' + stamp(new Date()).slice(0, 10) + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); toast('Transkrip chat berhasil diunduh');
  } catch (e) { toast('Transkrip gagal diunduh: ' + errMsg(e)); }
}

views.chat = renderChat;
refreshers.chat = renderChatBody;
actions['chat-download'] = unduhTranskrip;
inputHandlers.push(e => { if (e.target.id === 'chat-text' && e.target.value.length > 2000) e.target.value = e.target.value.slice(0, 2000); });
document.addEventListener('submit', e => { if (e.target.id === 'chat-form') kirimChat(e); });
