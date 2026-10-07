// Akun login petugas dengan PIN.
// Setiap petugas punya akun Firebase dengan email buatan ({id}@PIN_DOMAIN) dan kata sandi = PIN 6 digit.
// Daftar nama untuk layar login disimpan di dokumen publik/login (hanya nama, peran, email buatan).
import { auth, db, doc, getDoc, setDoc, deleteDoc, createStaffAccount, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from './firebase.js';
import { PIN_DOMAIN } from './config.js';

const listRef = () => doc(db, 'publik', 'login');
export const validPin = p => /^\d{6}$/.test(p || '');
export const isPinAccount = email => (email || '').endsWith('@' + PIN_DOMAIN);
const newId = () => Math.random().toString(36).slice(2, 7) + Date.now().toString(36).slice(-4);

export async function loadLoginList() {
  const s = await getDoc(listRef());
  return s.exists() ? (s.data().petugas || []) : [];
}
const saveList = list => setDoc(listRef(), { petugas: list.sort((a, b) => a.nama.localeCompare(b.nama)) });

// Buat akun baru. extra = { mekanikId } untuk mekanik.
export async function tambahPetugas({ nama, peran, pin, ...extra }) {
  if (!validPin(pin)) throw new Error('PIN harus 6 angka');
  const id = newId(), email = `${id}@${PIN_DOMAIN}`;
  await createStaffAccount(email, pin);
  await setDoc(doc(db, 'staff', email), { nama, peran, loginId: id, ...extra });
  const list = await loadLoginList();
  list.push({ id, nama, peran, email, ...extra });
  await saveList(list);
  return { id, email };
}

// Admin mengganti PIN: dibuatkan akun baru (Firebase tidak mengizinkan mengubah kata sandi orang lain dari aplikasi web),
// hak akses dipindah ke akun baru, akun lama otomatis tidak bisa dipakai lagi.
export async function resetPin(id, pin) {
  if (!validPin(pin)) throw new Error('PIN harus 6 angka');
  const list = await loadLoginList(), e = list.find(x => x.id === id);
  if (!e) throw new Error('Petugas tidak ditemukan');
  const email = `${id}-${Date.now().toString(36)}@${PIN_DOMAIN}`;
  await createStaffAccount(email, pin);
  const old = await getDoc(doc(db, 'staff', e.email));
  await setDoc(doc(db, 'staff', email), { ...(old.exists() ? old.data() : { nama: e.nama, peran: e.peran }), loginId: id });
  await deleteDoc(doc(db, 'staff', e.email));
  e.email = email; await saveList(list);
}

export async function ubahPetugas(id, patch) {
  const list = await loadLoginList(), e = list.find(x => x.id === id);
  if (!e) throw new Error('Petugas tidak ditemukan');
  Object.assign(e, patch);
  await setDoc(doc(db, 'staff', e.email), patch, { merge: true });
  await saveList(list);
}

export async function hapusPetugas(id) {
  const list = await loadLoginList(), e = list.find(x => x.id === id);
  if (!e) return;
  await deleteDoc(doc(db, 'staff', e.email));
  await saveList(list.filter(x => x.id !== id));
}

// Petugas mengganti PIN-nya sendiri
export async function gantiPinSendiri(lama, baru) {
  if (!validPin(baru)) throw new Error('PIN baru harus 6 angka');
  const u = auth.currentUser;
  await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email, lama));
  await updatePassword(u, baru);
}
