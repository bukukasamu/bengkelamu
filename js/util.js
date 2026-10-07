// Fungsi bantu umum: format angka/tanggal, toast, modal.
export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const rp = n => 'Rp ' + Math.round(n || 0).toLocaleString('id-ID');
export const pad = n => String(n).padStart(2, '0');
export const dkey = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const stamp = d => dkey(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
export const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
export const clone = o => JSON.parse(JSON.stringify(o));

export function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2800);
}
export function modal(html, cls = '') {
  $('#modal-root').innerHTML = '<div class="modal-bg" data-close="1"><div class="modal ' + cls + '" role="dialog" aria-modal="true">' + html + '</div></div>';
  const f = $('#modal-root [data-autofocus]') || $('#modal-root button'); f && f.focus();
}
export function closeModal() { $('#modal-root').innerHTML = ''; }
export function errMsg(e) {
  const m = { 'permission-denied': 'Akses ditolak. Pastikan akun terdaftar di koleksi staff.', 'unavailable': 'Koneksi ke server terputus. Coba lagi.', 'resource-exhausted': 'Kuota harian Firebase habis. Coba lagi besok atau upgrade paket.' };
  return m[e && e.code] || (e && e.message) || 'Terjadi kesalahan';
}
