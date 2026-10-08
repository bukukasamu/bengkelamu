// Identitas tampilan: logo toko (diatur super admin) dan animasi loading dua roda gigi.
import { db, doc, getDoc, setDoc } from './firebase.js';

// Path SVG dua roda gigi yang saling mengait (12 gigi dan 8 gigi). Sama persis dengan loader awal di pos.html.
const G1 = 'M41.98 20.06 L46.44 19.21 L47.49 10.08 L52.51 10.08 L53.56 19.21 L58.02 20.06 L62.31 21.55 L67.79 14.17 L72.14 16.68 L68.48 25.11 L71.92 28.08 L74.89 31.52 L83.32 27.86 L85.83 32.21 L78.45 37.69 L79.94 41.98 L80.79 46.44 L89.92 47.49 L89.92 52.51 L80.79 53.56 L79.94 58.02 L78.45 62.31 L85.83 67.79 L83.32 72.14 L74.89 68.48 L71.92 71.92 L68.48 74.89 L72.14 83.32 L67.79 85.83 L62.31 78.45 L58.02 79.94 L53.56 80.79 L52.51 89.92 L47.49 89.92 L46.44 80.79 L41.98 79.94 L37.69 78.45 L32.21 85.83 L27.86 83.32 L31.52 74.89 L28.08 71.92 L25.11 68.48 L16.68 72.14 L14.17 67.79 L21.55 62.31 L20.06 58.02 L19.21 53.56 L10.08 52.51 L10.08 47.49 L19.21 46.44 L20.06 41.98 L21.55 37.69 L14.17 32.21 L16.68 27.86 L25.11 31.52 L28.08 28.08 L31.52 25.11 L27.86 16.68 L32.21 14.17 L37.69 21.55 Z M61.00 50.00 A11 11 0 1 0 39.00 50.00 A11 11 0 1 0 61.00 50.00 Z';
const G2 = 'M-7.65 -18.48 L-3.44 -19.70 L-2.64 -27.88 L2.64 -27.88 L3.44 -19.70 L7.65 -18.48 L11.50 -16.36 L17.85 -21.57 L21.57 -17.85 L16.36 -11.50 L18.48 -7.65 L19.70 -3.44 L27.88 -2.64 L27.88 2.64 L19.70 3.44 L18.48 7.65 L16.36 11.50 L21.57 17.85 L17.85 21.57 L11.50 16.36 L7.65 18.48 L3.44 19.70 L2.64 27.88 L-2.64 27.88 L-3.44 19.70 L-7.65 18.48 L-11.50 16.36 L-17.85 21.57 L-21.57 17.85 L-16.36 11.50 L-18.48 7.65 L-19.70 3.44 L-27.88 2.64 L-27.88 -2.64 L-19.70 -3.44 L-18.48 -7.65 L-16.36 -11.50 L-21.57 -17.85 L-17.85 -21.57 L-11.50 -16.36 Z M8.00 0.00 A8 8 0 1 0 -8.00 0.00 A8 8 0 1 0 8.00 0.00 Z';
export const gearsSVG = (cls = '') => `<svg class="gears ${cls}" viewBox="0 0 132 132" aria-hidden="true"><path class="g1" d="${G1}" fill-rule="evenodd"/><g transform="translate(92 92)"><path class="g2" d="${G2}" fill-rule="evenodd"/></g></svg>`;
export const loaderHTML = (text = 'Memuat data…') => `<div class="loader" role="status">${gearsSVG()}<span>${text}</span></div>`;

/* ---- Logo toko (dokumen publik/brand, bisa dibaca sebelum login) ---- */
let brand = {};
export const getBrand = () => brand;
export async function loadBrand() {
  try { const s = await getDoc(doc(db, 'publik', 'brand')); brand = s.exists() ? s.data() : {}; } catch (e) { brand = {}; }
  applyBrand(); return brand;
}
export function applyBrand() {
  document.querySelectorAll('.brand-logo').forEach(img => { if (brand.logo) { img.src = brand.logo; img.hidden = false; } else img.hidden = true; });
  document.querySelectorAll('.brand-ph').forEach(el => { el.hidden = !!brand.logo; });
}
// Gambar diperkecil di browser (maks. 600 px) supaya muat di satu dokumen Firestore
export function resizeImage(file, max = 600) {
  return new Promise((resolve, reject) => {
    if (!/^image\//.test(file.type)) return reject(new Error('File harus berupa gambar (PNG, JPG, SVG, WEBP)'));
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('File tidak bisa dibaca'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Gambar tidak bisa dibuka'));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width || max, img.height || max));
        const c = document.createElement('canvas'); c.width = Math.round((img.width || max) * k); c.height = Math.round((img.height || max) * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        let url = c.toDataURL('image/png');
        if (url.length > 700000) url = c.toDataURL('image/webp', 0.85);
        if (url.length > 900000) return reject(new Error('Gambar terlalu besar, gunakan logo yang lebih sederhana'));
        resolve(url);
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
export async function saveLogo(dataUrl) {
  await setDoc(doc(db, 'publik', 'brand'), { logo: dataUrl || '' }, { merge: true });
  brand = { ...brand, logo: dataUrl || '' }; applyBrand();
}
