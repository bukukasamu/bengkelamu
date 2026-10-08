// Fungsi bantu umum: format angka/tanggal, toast, modal.
import { SITE_DOMAIN } from './config.js';
// Alamat halaman: halaman utama = cek servis konsumen, /pos = aplikasi petugas, /layar = layar TV.
// Di domain sendiri pakai alamat pendek (www.amuservice.id/layar), di tempat lain pakai nama file.
const domainSendiri = () => location.hostname === SITE_DOMAIN || location.hostname === SITE_DOMAIN.replace(/^www\./, '');
const PENDEK = { cek: '', pos: 'pos', layar: 'layar' }, FILE = { cek: './', pos: 'pos.html', layar: 'layar.html' };
export const publicUrl = (hal, params = {}) => {
  const u = new URL(domainSendiri() ? 'https://' + SITE_DOMAIN + '/' + (PENDEK[hal] ?? hal) : (FILE[hal] || hal + '.html'), location.href);
  Object.entries(params).forEach(([k, v]) => v && u.searchParams.set(k, v));
  return u.toString();
};
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

// Nomor HP Indonesia → link WhatsApp (0812… / 812… / +62812… → 62812…)
export function waNumber(hp) {
  let d = String(hp || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  return /^62\d{8,13}$/.test(d) ? d : '';
}
export const waLink = (hp, text = '') => { const n = waNumber(hp); return n ? `https://wa.me/${n}${text ? '?text=' + encodeURIComponent(text) : ''}` : ''; };
const WA_ICON = '<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z"/></svg>';
// Tombol WhatsApp kecil; kosong bila nomor tidak valid
export const waButton = (hp, text = '', label = 'WA') => { const u = waLink(hp, text); return u ? `<a class="wa-btn" href="${u}" target="_blank" rel="noopener" title="Chat WhatsApp ${String(hp).replace(/"/g, '')}">${WA_ICON}<span>${label}</span></a>` : ''; };
