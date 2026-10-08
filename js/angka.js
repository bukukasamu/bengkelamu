// Kolom angka dengan pemisah ribuan titik: 1000 → 1.000, 1250000 → 1.250.000.
// Semua <input type="number"> otomatis diubah menjadi kolom angka berformat (kecuali yang bertanda data-raw,
// mis. komisi persen yang boleh desimal). Kode lain tetap membaca .value sebagai angka polos tanpa titik.
const W = window, proto = W.HTMLInputElement.prototype;
const asli = Object.getOwnPropertyDescriptor(proto, 'value');
const isNum = el => el.dataset && 'num' in el.dataset;
export const formatRibuan = s => {
  const d = String(s ?? '').replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  return d ? d.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : '';
};
Object.defineProperty(proto, 'value', {
  configurable: true, enumerable: asli.enumerable,
  get() { const v = asli.get.call(this); return isNum(this) ? v.replace(/\D/g, '') : v; },
  set(v) { asli.set.call(this, isNum(this) ? formatRibuan(v) : v); }
});

function siapkan(el) {
  if (el.dataset.raw != null) return;
  if (el.type === 'number') { const v = asli.get.call(el); el.type = 'text'; el.dataset.num = ''; asli.set.call(el, v); }
  if (!isNum(el)) return;
  el.setAttribute('inputmode', 'numeric'); el.autocomplete = 'off';
  asli.set.call(el, formatRibuan(asli.get.call(el)));
}
export function siapkanAngka(root = document) {
  root.querySelectorAll?.('input[type="number"],input[data-num]').forEach(siapkan);
}
// Format ulang saat mengetik; posisi kursor dijaga (dihitung dari jumlah angka di depannya)
document.addEventListener('input', e => {
  const el = e.target; if (el.tagName !== 'INPUT' || !isNum(el)) return;
  const v = asli.get.call(el), pos = el.selectionStart ?? v.length;
  const nDepan = v.slice(0, pos).replace(/\D/g, '').length, baru = formatRibuan(v);
  if (baru === v) return;
  asli.set.call(el, baru);
  let i = 0, n = 0; while (i < baru.length && n < nDepan) { if (/\d/.test(baru[i])) n++; i++; }
  try { el.setSelectionRange(i, i); } catch (err) { /* abaikan */ }
}, true);
new W.MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType !== 1) return; if (n.tagName === 'INPUT') siapkan(n); else siapkanAngka(n); }))).observe(document.documentElement, { childList: true, subtree: true });
siapkanAngka();
