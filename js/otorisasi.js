// Otorisasi super admin: tindakan penting (import Excel, ubah gaji/insentif, kunci/buka bulan gaji,
// setujui pembatalan nota & stok opname, hapus pengeluaran) wajib memasukkan ulang kata sandi super admin.
import { auth, EmailAuthProvider, reauthenticateWithCredential } from './firebase.js';
import { $, esc, modal, closeModal } from './util.js';
import { st } from './state.js';
import { SUPER_ADMIN } from './config.js';

export const isSuper = () => !!st.petugas?.super;

// Mengembalikan true bila kata sandi benar, false bila dibatalkan
export function mintaPassword(judul, ket = '') {
  if (!isSuper()) { modal(`<h3>Perlu super admin</h3><p style="margin:0">${esc(judul)} hanya bisa dilakukan oleh super admin.</p><div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-close="1">Tutup</button></div>`); return Promise.resolve(false); }
  return new Promise(resolve => {
    let selesai = false;
    const akhiri = v => { if (selesai) return; selesai = true; obs.disconnect(); resolve(v); };
    modal(`<h3>${esc(judul)}</h3>${ket ? `<p class="small" style="margin:0">${ket}</p>` : ''}
      <form id="otp-form" autocomplete="off" style="display:flex;flex-direction:column;gap:10px">
       <label class="f" for="otp-pass">Kata sandi super admin<input id="otp-pass" type="password" autocomplete="current-password" data-autofocus required></label>
       <div class="err" id="otp-err" hidden></div>
       <div class="row" style="justify-content:flex-end"><button class="btn" type="button" id="otp-batal">Batal</button><button class="btn pri" type="submit" id="otp-ok">Konfirmasi</button></div>
      </form>`);
    const root = $('#modal-root');
    const obs = new MutationObserver(() => { if (!root.querySelector('#otp-form')) akhiri(false); });
    obs.observe(root, { childList: true, subtree: true });
    $('#otp-batal').onclick = () => { closeModal(); akhiri(false); };
    $('#otp-form').onsubmit = async e => {
      e.preventDefault();
      const pw = $('#otp-pass').value, btn = $('#otp-ok'); if (!pw) return;
      btn.disabled = true; btn.textContent = 'Memeriksa…';
      try {
        await reauthenticateWithCredential(auth.currentUser, EmailAuthProvider.credential(SUPER_ADMIN, pw));
        obs.disconnect(); selesai = true; closeModal(); resolve(true);
      } catch (err) {
        $('#otp-err').hidden = false;
        $('#otp-err').textContent = err.code === 'auth/too-many-requests' ? 'Terlalu banyak percobaan. Tunggu sebentar.' : 'Kata sandi salah.';
        btn.disabled = false; btn.textContent = 'Konfirmasi'; $('#otp-pass').select();
      }
    };
  });
}
