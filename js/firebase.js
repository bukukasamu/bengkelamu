// Inisialisasi Firebase. Versi SDK cukup diganti di satu tempat ini.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signOut as signOutAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const fbApp = initializeApp(firebaseConfig);
export const auth = getAuth(fbApp);
// Cache lokal: data part tidak diunduh ulang penuh setiap kali halaman dibuka (hemat kuota baca).
export const db = initializeFirestore(fbApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

// Membuat akun login petugas baru tanpa mengeluarkan admin yang sedang login
// (memakai instance Firebase kedua yang terpisah).
let secondary = null;
export async function createStaffAccount(email, password) {
  if (!secondary) secondary = getAuth(initializeApp(firebaseConfig, 'pembuat-akun'));
  await createUserWithEmailAndPassword(secondary, email, password);
  await signOutAuth(secondary);
}

export { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
export {
  collection, doc, getDoc, getDocs, onSnapshot, query, where, orderBy, limit,
  runTransaction, setDoc, updateDoc, addDoc, deleteDoc, increment, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
