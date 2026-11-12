// Pilihan dengan pencarian: daftar pilihan TIDAK langsung dibuka semua. Daftar baru muncul setelah mengetik
// (mis. ketik "A" → muncul ACEH BARAT, ACEH BESAR, …). Berlaku otomatis untuk:
//  - <select> dengan banyak pilihan (> 10, mis. provinsi/kabupaten/kecamatan/kelurahan, tipe motor)
//  - <input list="…"> (daftar saran: part, kategori, supplier, tipe motor)
// <select> aslinya tetap ada (disembunyikan) sehingga kode lain tetap membaca .value & menerima event change.
const BATAS = 10, MAKS = 60;
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/* ---------- 1. <input list> : sembunyikan daftar sampai ada yang diketik ---------- */
function aturList(el, ada) {
  if (!el.dataset.dl) { const l = el.getAttribute('list'); if (!l) return; el.dataset.dl = l; }
  if (ada) el.setAttribute('list', el.dataset.dl); else el.removeAttribute('list');
}
const pakaiList = el => el && el.tagName === 'INPUT' && (el.hasAttribute('list') || el.dataset.dl);
// Klik/fokus pada kotak kosong: daftar tidak dibuka
['mousedown', 'focusin'].forEach(t => document.addEventListener(t, e => { if (pakaiList(e.target)) aturList(e.target, !!e.target.value.trim()); }, true));
// Tombol huruf/angka ditekan: daftar diaktifkan sebelum huruf masuk, supaya saran langsung muncul
document.addEventListener('keydown', e => { if (pakaiList(e.target) && e.key.length === 1 && !e.ctrlKey && !e.metaKey) aturList(e.target, true); }, true);
document.addEventListener('input', e => { if (pakaiList(e.target)) aturList(e.target, !!e.target.value.trim()); }, true);

/* ---------- 2. <select> panjang → kotak ketik + daftar hasil ---------- */
function teksPilihan(sel) { const o = sel.options[sel.selectedIndex]; return o && o.value !== '' ? o.textContent.trim() : ''; }
function tingkatkan(sel) {
  if (sel.dataset.cariOk || sel.multiple || sel.closest('[data-tanpa-cari]')) return;
  const nyata = [...sel.options].filter(o => o.value !== '');
  if (nyata.length <= BATAS && !sel.dataset.wil) return;   // isian wilayah selalu bisa dicari
  sel.dataset.cariOk = '1';
  const bungkus = document.createElement('span'); bungkus.className = 'cari-pil';
  const inp = document.createElement('input'); inp.type = 'text'; inp.autocomplete = 'off'; inp.className = 'cari-pil-in'; inp.dataset.nocaps = '';
  const label = sel.closest('label')?.childNodes[0]?.textContent?.trim();
  inp.setAttribute('aria-label', label || 'Pilih'); inp.setAttribute('role', 'combobox'); inp.setAttribute('aria-expanded', 'false');
  inp.placeholder = (sel.options[0] && sel.options[0].value === '' ? sel.options[0].textContent.trim() : '') || 'Ketik untuk mencari…';
  const daftar = document.createElement('div'); daftar.className = 'cari-pil-list'; daftar.setAttribute('role', 'listbox'); daftar.hidden = true;
  sel.parentNode.insertBefore(bungkus, sel); bungkus.append(inp, daftar, sel);
  sel.classList.add('cari-pil-asli'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
  sel.addEventListener('focus', () => inp.focus());
  let aktif = -1, hasil = [];
  const segarkan = () => { inp.value = teksPilihan(sel); inp.disabled = sel.disabled; };
  const tutup = () => { daftar.hidden = true; inp.setAttribute('aria-expanded', 'false'); aktif = -1; };
  const pilih = o => {
    if (o) { sel.value = o.value; sel.dispatchEvent(new Event('input', { bubbles: true })); sel.dispatchEvent(new Event('change', { bubbles: true })); }
    tutup(); if (sel.isConnected) segarkan();
  };
  const tampilkan = () => {
    const q = norm(inp.value);
    if (!q) { tutup(); return; }
    const semua = [...sel.options].filter(o => o.value !== '');
    const awal = semua.filter(o => norm(o.textContent).startsWith(q)), isi = semua.filter(o => !norm(o.textContent).startsWith(q) && norm(o.textContent).includes(q));
    hasil = [...awal, ...isi].slice(0, MAKS); aktif = hasil.length ? 0 : -1;
    daftar.innerHTML = hasil.length ? hasil.map((o, i) => `<div class="cari-pil-op${i === aktif ? ' on' : ''}" role="option" data-i="${i}">${o.textContent.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</div>`).join('') : '<div class="cari-pil-kosong">Tidak ditemukan</div>';
    daftar.hidden = false; inp.setAttribute('aria-expanded', 'true');
  };
  const sorot = () => daftar.querySelectorAll('.cari-pil-op').forEach((d, i) => { d.classList.toggle('on', i === aktif); if (i === aktif) d.scrollIntoView({ block: 'nearest' }); });
  inp.addEventListener('focus', () => inp.select());
  inp.addEventListener('input', e => { e.stopPropagation(); tampilkan(); });
  inp.addEventListener('change', e => e.stopPropagation());
  inp.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown' && hasil.length) { e.preventDefault(); if (daftar.hidden) tampilkan(); else { aktif = Math.min(hasil.length - 1, aktif + 1); sorot(); } }
    else if (e.key === 'ArrowUp' && hasil.length) { e.preventDefault(); aktif = Math.max(0, aktif - 1); sorot(); }
    else if (e.key === 'Enter' && !daftar.hidden) { e.preventDefault(); e.stopPropagation(); pilih(hasil[aktif]); }
    else if (e.key === 'Escape') { tutup(); segarkan(); }
  });
  daftar.addEventListener('mousedown', e => { e.preventDefault(); const d = e.target.closest('.cari-pil-op'); if (d) pilih(hasil[+d.dataset.i]); });
  inp.addEventListener('blur', () => {
    setTimeout(() => {
      if (!sel.isConnected) return;
      if (!inp.value.trim() && sel.value !== '' && [...sel.options].some(o => o.value === '')) { sel.value = ''; sel.dispatchEvent(new Event('change', { bubbles: true })); }
      else if (!daftar.hidden && hasil.length === 1) { pilih(hasil[0]); return; }
      tutup(); segarkan();
    }, 120);
  });
  // Pilihan bisa dimuat ulang oleh kode lain (mis. daftar kecamatan setelah kabupaten dipilih)
  new window.MutationObserver(segarkan).observe(sel, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
  sel.addEventListener('change', () => { if (document.activeElement !== inp) segarkan(); });
  segarkan();
}
const pindai = (akar = document) => akar.querySelectorAll?.('select:not([data-cari-ok])').forEach(tingkatkan);
new window.MutationObserver(ms => { for (const m of ms) if (m.addedNodes.length || m.type === 'childList') { pindai(); break; } })
  .observe(document.documentElement, { childList: true, subtree: true });
pindai();
