// 5.21.0 — Navigasi HP "model 2": sidebar kiri sebagai laci geser + bilah pintasan bawah.
// - Laci kiri berisi SEMUA menu (sama dengan PC). Dibuka dengan tombol ☰, tombol "Menu" di bilah bawah,
//   atau menggeser dari tepi kiri layar; ditutup dengan geser ke kiri, ketuk area gelap, atau tombol Kembali HP.
// - Bilah bawah: 4 pintasan sesuai peran (mengikuti Hak Akses Menu) + tombol Menu.
// - Pintasan dapat diganti sendiri: tekan lama sebuah menu di sidebar → "Jadikan pintasan", atau tombol
//   "★ Atur pintasan" di sidebar. Pilihan disimpan per pengguna di perangkat ini.
import { esc, modal, closeModal, toast } from './util.js';
import { st, actions } from './state.js';

const hp = matchMedia('(max-width: 900px)');
export const PINTAS_BAWAAN = {
  super: ['beranda', 'persetujuan', 'laporan', 'chat'],
  admin: ['beranda', 'registrasi', 'bayar', 'laporan'],
  registrasi: ['registrasi', 'riwayat', 'konsumen', 'cekstok'],
  sparepart: ['order', 'orderSupplier', 'stok', 'cekstok'],
  kasir: ['bayar', 'kasir', 'kas', 'laporan'],
  mekanik: ['mekanik', 'cekstok', 'absensi', 'penghasilan'],
  sa: ['beranda', 'mekanik', 'riwayat', 'laporan'],
  sales: ['absensi', 'penghasilan', 'chat', 'panduan']
};
const CADANGAN = ['beranda', 'registrasi', 'bayar', 'kasir', 'mekanik', 'order', 'orderSupplier', 'cekstok', 'stok', 'laporan', 'chat', 'absensi', 'penghasilan', 'riwayat', 'panduan'];
const PENDEK = { beranda: 'Beranda', registrasi: 'Registrasi', bayar: 'Bayar', kasir: 'Jual Part', mekanik: 'Mekanik', order: 'Order', cekstok: 'Cek Stok', stok: 'Stok', laporan: 'Laporan', absensi: 'Absensi', penghasilan: 'Gaji', chat: 'Chat', riwayat: 'Riwayat', panduan: 'Panduan', konsumen: 'Konsumen', pengingat: 'Pengingat', pesananPart: 'Pesanan', opname: 'Opname', orderSupplier: 'PO Supplier', pembelian: 'Pembelian', kas: 'Kas', klaim: 'Klaim', insight: 'Insight', backup: 'Backup', master: 'Master', persetujuan: 'Setujui', thr: 'THR' };
let bar = null;

const links = () => [...document.querySelectorAll('#side-nav .sb-link')];
const badgeDari = el => el?.querySelector('.sb-badge')?.textContent.trim() || '';
const labelDari = el => el ? [...el.childNodes].filter(n => n.nodeType === 3 || (n.nodeType === 1 && !n.classList.contains('sb-badge'))).map(n => n.textContent).join('').trim() : '';
const angka = s => s === '99+' ? 99 : (+s || 0);
const kunci = () => 'amu-pintas-' + (st.petugas?.email || 'anon');
const peranKu = () => st.petugas?.super ? 'super' : st.role;
function pintasTersimpan() { try { const v = JSON.parse(localStorage.getItem(kunci()) || 'null'); return Array.isArray(v) ? v : null; } catch (e) { return null; } }
function simpanPintas(v) { try { if (v) localStorage.setItem(kunci(), JSON.stringify(v.slice(0, 4))); else localStorage.removeItem(kunci()); } catch (e) {} renderBar(); }
export function pintasAktif() {
  const ada = links().map(l => l.dataset.view);
  const dasar = (pintasTersimpan() || PINTAS_BAWAAN[peranKu()] || []).filter(v => ada.includes(v));
  return [...dasar, ...CADANGAN.filter(v => ada.includes(v) && !dasar.includes(v)), ...ada.filter(v => !dasar.includes(v) && !CADANGAN.includes(v))].slice(0, Math.min(4, ada.length));
}

/* ---------- Bilah pintasan bawah ---------- */
function renderBar() {
  if (!bar) return;
  const shell = document.getElementById('app-shell'), semua = shell?.hidden ? [] : links();
  if (!semua.length) { bar.hidden = true; document.body.classList.remove('has-bnav'); return; }
  bar.hidden = false; document.body.classList.add('has-bnav');
  const pilih = pintasAktif(), aktif = semua.find(l => l.getAttribute('aria-current') === 'page')?.dataset.view;
  const sisa = semua.filter(l => !pilih.includes(l.dataset.view)).reduce((a, l) => a + angka(badgeDari(l)), 0);
  bar.innerHTML = pilih.map(v => { const l = semua.find(x => x.dataset.view === v), b = badgeDari(l); return `<button type="button" class="bn-item" data-view="${esc(v)}" data-bn-go="${esc(v)}" ${v === aktif ? 'aria-current="page"' : ''}><i aria-hidden="true"></i><span>${esc(PENDEK[v] || labelDari(l))}</span>${b ? `<em>${esc(b)}</em>` : ''}</button>`; }).join('')
    + `<button type="button" class="bn-item bn-menu" data-bn-menu aria-controls="sidebar" ${aktif && !pilih.includes(aktif) ? 'aria-current="page"' : ''}><i aria-hidden="true"></i><span>Menu</span>${sisa ? `<em>${sisa > 99 ? '99+' : sisa}</em>` : ''}</button>`;
  tandaiSidebar(pilih);
}
// Bintang kecil di sidebar untuk menu yang sedang jadi pintasan
function tandaiSidebar(pilih) { links().forEach(l => l.toggleAttribute('data-pintas', pilih.includes(l.dataset.view))); }

/* ---------- Laci kiri ---------- */
const terbuka = () => document.body.classList.contains('sb-open');
export function bukaLaci() {
  if (terbuka()) return;
  document.body.classList.add('sb-open'); const bd = document.getElementById('sb-backdrop'); if (bd) bd.hidden = false;
  setTimeout(() => document.querySelector('#side-nav .sb-link[aria-current]')?.scrollIntoView({ block: 'center' }), 230);
}
export function tutupLaci(dariBack = false) {
  if (!terbuka()) return;
  document.body.classList.remove('sb-open'); const bd = document.getElementById('sb-backdrop'); if (bd) bd.hidden = true;
  const sb = document.getElementById('sidebar'); if (sb) sb.style.transform = '';
}

/* ---------- Editor pintasan ---------- */
function editorPintas(fokus) {
  const semua = links(), pilih = pintasAktif();
  if (fokus && !pilih.includes(fokus)) { if (pilih.length >= 4) pilih.pop(); pilih.push(fokus); }
  const baris = () => `<ol class="pt-pilih">${pilih.map((v, i) => { const l = semua.find(x => x.dataset.view === v); return `<li><span class="pt-ic" data-view="${esc(v)}"><i aria-hidden="true"></i></span><b>${esc(labelDari(l))}</b><span class="pt-btn"><button type="button" class="btn sm" data-pt-naik="${i}" ${i ? '' : 'disabled'} aria-label="Geser ke kiri">◀</button><button type="button" class="btn sm" data-pt-turun="${i}" ${i < pilih.length - 1 ? '' : 'disabled'} aria-label="Geser ke kanan">▶</button><button type="button" class="btn sm" data-pt-hapus="${esc(v)}" aria-label="Hapus">✕</button></span></li>`; }).join('')}</ol>
    <h4 class="pt-h">Menu lain — ketuk untuk menambahkan (maks. 4)</h4><div class="pt-lain">${semua.filter(l => !pilih.includes(l.dataset.view)).map(l => `<button type="button" class="pt-chip" data-pt-tambah="${esc(l.dataset.view)}" ${pilih.length >= 4 ? 'disabled' : ''}>＋ ${esc(labelDari(l))}</button>`).join('')}</div>`;
  modal(`<h3>Atur pintasan bawah</h3><p class="small muted" style="margin:0">Pilih hingga 4 menu yang tampil di bilah bawah HP. Urutan kiri ke kanan sesuai daftar. Disimpan untuk akun Anda di perangkat ini.</p><div id="pt-isi">${baris()}</div>
    <div class="row" style="justify-content:space-between"><button type="button" class="btn ghost" data-pt-reset>Kembalikan bawaan</button><span class="row"><button type="button" class="btn" data-close="1">Batal</button><button type="button" class="btn pri" data-pt-simpan>Simpan</button></span></div>`);
  const root = document.getElementById('modal-root');
  const ulang = () => { const el = document.getElementById('pt-isi'); if (el) el.innerHTML = baris(); };
  const h = e => {
    const t = e.target.closest('button'); if (!t || !root.contains(t)) return;
    if (t.dataset.ptTambah) { if (pilih.length < 4) pilih.push(t.dataset.ptTambah); ulang(); }
    else if (t.dataset.ptHapus) { const i = pilih.indexOf(t.dataset.ptHapus); if (i >= 0) pilih.splice(i, 1); ulang(); }
    else if (t.dataset.ptNaik) { const i = +t.dataset.ptNaik; [pilih[i - 1], pilih[i]] = [pilih[i], pilih[i - 1]]; ulang(); }
    else if (t.dataset.ptTurun) { const i = +t.dataset.ptTurun; [pilih[i + 1], pilih[i]] = [pilih[i], pilih[i + 1]]; ulang(); }
    else if ('ptReset' in t.dataset) { simpanPintas(null); root.removeEventListener('click', h); closeModal(); toast('Pintasan dikembalikan ke bawaan peran'); }
    else if ('ptSimpan' in t.dataset) { if (!pilih.length) return toast('Pilih minimal 1 menu'); simpanPintas(pilih); root.removeEventListener('click', h); closeModal(); toast('Pintasan bawah disimpan'); }
    else if (t.dataset.close) root.removeEventListener('click', h);
  };
  root.addEventListener('click', h);
}
actions['atur-pintas'] = () => { tutupLaci(); setTimeout(() => editorPintas(), 60); };

// Tekan lama menu di sidebar → menu kecil: Buka / Jadikan pintasan / Hapus dari pintasan
function menuTekanLama(link) {
  const v = link.dataset.view, ada = pintasAktif().includes(v);
  modal(`<h3>${esc(labelDari(link))}</h3><div class="pt-aksi">
    <button type="button" class="ms-act" data-pl="buka">↗ Buka menu</button>
    ${ada ? '<button type="button" class="ms-act" data-pl="hapus">✕ Hapus dari pintasan bawah</button>' : '<button type="button" class="ms-act" data-pl="tambah">★ Jadikan pintasan bawah</button>'}
    <button type="button" class="ms-act" data-pl="atur">⚙ Atur semua pintasan…</button></div>`);
  const root = document.getElementById('modal-root');
  const h = e => {
    const b = e.target.closest('[data-pl]'); if (!b) { if (e.target.closest('[data-close]') || e.target === root.firstElementChild) root.removeEventListener('click', h); return; }
    root.removeEventListener('click', h); closeModal();
    if (b.dataset.pl === 'buka') { tutupLaci(); link.click(); }
    if (b.dataset.pl === 'hapus') { simpanPintas(pintasAktif().filter(x => x !== v)); toast('Dihapus dari pintasan'); }
    if (b.dataset.pl === 'tambah') { const p = pintasAktif(); if (p.length >= 4) { tutupLaci(); setTimeout(() => editorPintas(v), 60); } else { simpanPintas([...p, v]); toast('Ditambahkan ke pintasan bawah'); } }
    if (b.dataset.pl === 'atur') { tutupLaci(); setTimeout(() => editorPintas(), 60); }
  };
  root.addEventListener('click', h);
}

export function pasangNavHp() {
  if (bar) return;
  bar = document.createElement('nav'); bar.id = 'bottom-nav'; bar.className = 'bottom-nav'; bar.setAttribute('aria-label', 'Pintasan menu'); bar.hidden = true;
  document.body.append(bar);
  bar.addEventListener('click', e => {
    const g = e.target.closest('[data-bn-go]');
    if (g) { tutupLaci(); document.querySelector(`#side-nav .sb-link[data-view="${CSS.escape(g.dataset.bnGo)}"]`)?.click(); window.scrollTo({ top: 0 }); return; }
    if (e.target.closest('[data-bn-menu]')) terbuka() ? tutupLaci() : bukaLaci();
  });
  // Tutup laci setelah memilih menu (HP)
  document.getElementById('side-nav')?.addEventListener('click', e => { if (hp.matches && e.target.closest('.sb-link') && !tahanAktif) setTimeout(() => tutupLaci(), 0); }, true);
  // Tekan lama di sidebar (HP & PC: klik kanan)
  let tahan = 0, tahanAktif = false, x0 = 0, y0 = 0;
  const nav = document.getElementById('side-nav');
  nav?.addEventListener('touchstart', e => { const l = e.target.closest('.sb-link'); if (!l) return; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; tahanAktif = false; tahan = setTimeout(() => { tahanAktif = true; navigator.vibrate?.(15); menuTekanLama(l); }, 520); }, { passive: true });
  nav?.addEventListener('touchmove', e => { if (Math.abs(e.touches[0].clientX - x0) > 8 || Math.abs(e.touches[0].clientY - y0) > 8) clearTimeout(tahan); }, { passive: true });
  nav?.addEventListener('touchend', e => { clearTimeout(tahan); if (tahanAktif) { e.preventDefault(); setTimeout(() => { tahanAktif = false; }, 50); } });
  nav?.addEventListener('contextmenu', e => { const l = e.target.closest('.sb-link'); if (!l || !hp.matches) return; e.preventDefault(); menuTekanLama(l); });
  nav?.addEventListener('click', e => { if (tahanAktif) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  // Geser dari tepi kiri untuk membuka, geser ke kiri untuk menutup
  let sx = null, sy = 0, dx = 0, mode = '';
  const sb = document.getElementById('sidebar');
  document.addEventListener('touchstart', e => {
    if (!hp.matches || document.getElementById('modal-root')?.innerHTML) { sx = null; return; }
    const t = e.touches[0]; sx = t.clientX; sy = t.clientY; dx = 0;
    mode = terbuka() ? 'tutup' : (sx < 22 ? 'buka' : '');
    if (!mode) sx = null;
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (sx == null || !sb) return; const t = e.touches[0]; dx = t.clientX - sx;
    if (Math.abs(t.clientY - sy) > Math.abs(dx) && Math.abs(dx) < 12) return;
    const w = sb.offsetWidth;
    if (mode === 'buka') sb.style.transform = `translateX(${Math.min(0, -w + Math.max(0, dx))}px)`;
    if (mode === 'tutup' && dx < 0) sb.style.transform = `translateX(${Math.max(-w, dx)}px)`;
    sb.style.transition = 'none';
  }, { passive: true });
  document.addEventListener('touchend', () => {
    if (sx == null || !sb) return; sb.style.transition = ''; sb.style.transform = '';
    if (mode === 'buka' && dx > 70) bukaLaci();
    if (mode === 'tutup' && dx < -70) tutupLaci();
    sx = null;
  });
  // Sinkron dengan sidebar
  let jadwal = 0; const segarkan = () => { cancelAnimationFrame(jadwal); jadwal = requestAnimationFrame(renderBar); };
  if (nav) new MutationObserver(segarkan).observe(nav, { childList: true, subtree: true, attributeFilter: ['aria-current'], attributes: true, characterData: true });
  const shell = document.getElementById('app-shell'); if (shell) new MutationObserver(segarkan).observe(shell, { attributes: true, attributeFilter: ['hidden'] });
  hp.addEventListener?.('change', () => { if (!hp.matches) tutupLaci(); });
  // Warna bilah status HP mengikuti warna awal gradasi bilah atas (tidak terlihat seperti halaman web)
  const warnaStatus = () => { const v = getComputedStyle(document.documentElement).getPropertyValue('--g1-rgb').trim(); if (!v) return; document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', `rgb(${v})`)); };
  new MutationObserver(warnaStatus).observe(document.documentElement, { attributes: true, attributeFilter: ['data-tema', 'data-theme'] }); warnaStatus();
  renderBar();
}
