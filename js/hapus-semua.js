// "Hapus semua data" (tersembunyi, khusus super admin): klik tulisan versi di bawah menu 7 kali berturut-turut.
// Menghapus SEMUA data aplikasi: cabang, karyawan & login PIN, konsumen, kendaraan, part, nota, WO, absensi, gaji,
// pengaturan, logo, dll. Yang tersisa hanya akun super admin. Wajib: baca peringatan, ketik kalimat konfirmasi,
// lalu kata sandi super admin.
import { $, esc, stamp, toast, errMsg, modal, closeModal } from './util.js';
import { st } from './state.js';
import { db, auth, collection, getDocs, query, limit, writeBatch, doc, setDoc, signOut } from './firebase.js';
import { mintaPassword } from './otorisasi.js';
import { KOLEKSI } from './backup.js';

const SEMUA = [...new Set([...KOLEKSI, 'absenFoto', 'absenKode', 'layarAbsen', 'pantau', 'masuk'])];
const NAMA = { parts: 'Part & stok', kendaraan: 'Konsumen & kendaraan', jasa: 'Jasa', mekanik: 'Mekanik', meta: 'Pengaturan & penomoran', publik: 'Cabang, logo, daftar login, layar TV', staff: 'Akun karyawan', trx: 'Nota', wo: 'Work order', pembelian: 'Pembelian', mutasi: 'Kartu stok', transfer: 'Transfer stok', opname: 'Stok opname', pengeluaran: 'Pengeluaran', kas: 'Kas harian', klaim: 'Klaim KSG', penghasilan: 'Aturan insentif & absensi', gaji: 'Gaji', slip: 'Slip gaji', penghasilanBulan: 'Kunci bulan gaji', absen: 'Absensi', absenPerangkat: 'HP absen', absenFoto: 'Foto absen', absenKode: 'Kode QR', layarAbsen: 'Layar QR', pantau: 'Cek servis konsumen', masuk: 'Barang masuk', imports: 'Riwayat import', ubahKonsumen: 'Riwayat perubahan konsumen', pengaturan: 'Hak akses menu' };

let klik = [];
document.addEventListener('click', e => {
  if (!e.target.closest?.('#app-shell .app-ver') || !st.petugas?.super) return;
  const kini = Date.now(); klik = klik.filter(t => kini - t < 4000); klik.push(kini);
  if (klik.length >= 7) { klik = []; bukaDialog(); }
});

function bukaDialog() {
  const kalimat = 'HAPUS SEMUA DATA ' + String(1000 + Math.floor(Math.random() * 9000));
  modal(`<h3 style="color:var(--bad)">⚠️ Hapus semua data</h3>
    <div class="note small" style="border-color:var(--bad)"><b>Tindakan ini tidak bisa dibatalkan.</b> Semua data aplikasi akan dihapus permanen dari database:
      cabang, karyawan &amp; login PIN, mekanik, konsumen &amp; kendaraan (termasuk KTP), part &amp; stok, nota, work order, pembelian, kartu stok, opname, transfer,
      kas, pengeluaran, klaim KSG, absensi &amp; foto, gaji &amp; slip, aturan insentif, pengaturan, logo, dan link cek servis konsumen.
      <br><br>Yang tersisa hanya akun super admin. Sebaiknya <b>unduh backup</b> dulu di menu Backup Data.</div>
    <div class="small">Untuk melanjutkan, ketik kalimat berikut persis sama:</div>
    <div class="mono" id="hs-kalimat" style="user-select:none;font-size:1.25rem;font-weight:700;letter-spacing:.06em;text-align:center;padding:8px;border:1px dashed var(--bad);border-radius:6px;color:var(--bad)">${esc(kalimat)}</div>
    <input id="hs-ketik" autocomplete="off" aria-label="Ketik kalimat konfirmasi" data-autofocus>
    <div class="err" id="hs-err" hidden></div>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Batal</button><button class="btn pri" type="button" id="hs-lanjut" style="background:var(--bad);border-color:var(--bad)">Hapus semua data</button></div>`);
  $('#hs-ketik').addEventListener('paste', e => e.preventDefault());
  $('#hs-lanjut').onclick = async () => {
    if (($('#hs-ketik').value || '').trim().toUpperCase().replace(/\s+/g, ' ') !== kalimat) { $('#hs-err').hidden = false; $('#hs-err').textContent = 'Kalimat tidak sama. Ketik persis seperti yang tertulis.'; return; }
    if (!(await mintaPassword('Hapus semua data', '<b style="color:var(--bad)">Langkah terakhir.</b> Semua data akan dihapus permanen.'))) return;
    jalankan();
  };
}

async function hapusKoleksi(nama, onProgress) {
  let n = 0;
  for (;;) {
    const s = await getDocs(query(collection(db, nama), limit(400)));
    if (!s.docs.length) return n;
    const b = writeBatch(db); s.docs.forEach(d => b.delete(d.ref)); await b.commit();
    n += s.docs.length; onProgress(n);
    if (s.docs.length < 400) return n;
  }
}

async function jalankan() {
  modal(`<h3>Menghapus semua data…</h3><p class="small muted" style="margin:0">Jangan tutup atau muat ulang halaman ini.</p><div id="hs-prog" class="small" style="max-height:50vh;overflow:auto"></div>`);
  const prog = $('#hs-prog'), hasil = [], gagal = [];
  for (const k of SEMUA) {
    const baris = document.createElement('div'); baris.textContent = (NAMA[k] || k) + ': menghapus…'; prog.appendChild(baris); prog.scrollTop = prog.scrollHeight;
    try { const n = await hapusKoleksi(k, x => { baris.textContent = (NAMA[k] || k) + ': ' + x + ' data dihapus…'; }); baris.textContent = '✓ ' + (NAMA[k] || k) + ': ' + n + ' data'; hasil.push([k, n]); }
    catch (e) { baris.textContent = '✕ ' + (NAMA[k] || k) + ': ' + errMsg(e); baris.style.color = 'var(--bad)'; gagal.push(k); }
  }
  // Tandai database sudah dikosongkan supaya data contoh (jasa, mekanik, tipe motor) tidak dibuat ulang otomatis
  try { await setDoc(doc(db, 'meta', 'settings'), { versiData: 4, dikosongkan: stamp(new Date()), dikosongkanOleh: st.petugas?.email || '' }); } catch (e) { gagal.push('meta'); }
  try { Object.keys(localStorage).filter(k => k.startsWith('amu-')).forEach(k => localStorage.removeItem(k)); } catch (e) {}
  const total = hasil.reduce((a, [, n]) => a + n, 0);
  $('#modal-root').querySelector('.modal').innerHTML = `<h3>${gagal.length ? 'Sebagian data gagal dihapus' : 'Semua data sudah dihapus'}</h3>
    <p style="margin:0">${total.toLocaleString('id-ID')} data dihapus.${gagal.length ? ` Gagal: ${esc(gagal.join(', '))}. Pastikan firestore.rules terbaru sudah dipublish, lalu ulangi.` : ''}</p>
    <div class="note small">Akun login karyawan (PIN) sudah tidak bisa dipakai karena data karyawannya terhapus. Untuk membersihkan akunnya juga, buka Firebase Console → <b>Authentication → Users</b>, lalu hapus semua pengguna <b>kecuali cashflow.amu@gmail.com</b>.</div>
    <div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" id="hs-selesai">Keluar &amp; muat ulang</button></div>`;
  $('#hs-selesai').onclick = async () => { closeModal(); try { await signOut(auth); } catch (e) {} location.reload(); };
  toast(gagal.length ? 'Sebagian data gagal dihapus' : 'Semua data dihapus');
}
