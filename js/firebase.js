// Inisialisasi Firebase. Versi SDK cukup diganti di satu tempat ini.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

export const fbApp = initializeApp(firebaseConfig);
export const auth = getAuth(fbApp);
// Cache lokal: data part tidak diunduh ulang penuh setiap kali halaman dibuka (hemat kuota baca).
export const db = initializeFirestore(fbApp, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
export {
  collection, doc, getDoc, onSnapshot, query, where, orderBy, limit,
  runTransaction, setDoc, updateDoc, addDoc, increment, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
