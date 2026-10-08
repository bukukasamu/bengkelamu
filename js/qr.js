// Pembuat QR code (pustaka qrcode-generator, lisensi MIT) dimuat dari CDN saat pertama dibutuhkan.
const QR_URL = 'https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js';
let loading = null;
export function loadQr() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (!loading) loading = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = QR_URL; s.async = true;
    s.onload = () => res(window.qrcode); s.onerror = () => { loading = null; rej(new Error('Pustaka QR gagal dimuat')); };
    document.head.appendChild(s);
  });
  return loading;
}
// SVG hitam-putih yang bisa diperbesar tanpa pecah
export async function qrSvg(text) {
  const qrcode = await loadQr(), q = qrcode(0, 'M');
  q.addData(text); q.make();
  return q.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
}
