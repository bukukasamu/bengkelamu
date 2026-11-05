// 5.20.0 — Navigasi gaya aplikasi untuk HP (lebar layar ≤ 900px).
// - Bilah bawah (bottom navigation): 4 menu utama sesuai peran + tombol "Menu".
// - Tombol "Menu" membuka lembar dari bawah (bottom sheet) berisi profil, status, seluruh menu yang boleh dibuka
//   (dikelompokkan seperti bilah kiri, dengan ikon & angka badge), serta Ganti PIN, Pasang/Update aplikasi, Mode gelap, Keluar.
// Isi diambil langsung dari bilah kiri (#side-nav) sehingga hak akses, badge, dan menu aktif selalu sama persis.
import { esc } from './util.js';

const UTAMA = ['beranda', 'registrasi', 'bayar', 'kasir', 'mekanik', 'order', 'cekstok', 'stok', 'laporan', 'absensi', 'penghasilan', 'chat', 'riwayat', 'panduan'];
const PENDEK = { beranda: 'Beranda', registrasi: 'Registrasi', bayar: 'Bayar', kasir: 'Jual Part', mekanik: 'Mekanik', order: 'Order', cekstok: 'Cek Stok', stok: 'Stok', laporan: 'Laporan', absensi: 'Absensi', penghasilan: 'Gaji', chat: 'Chat', riwayat: 'Riwayat', panduan: 'Panduan', konsumen: 'Konsumen', pengingat: 'Pengingat', pesananPart: 'Pesanan', opname: 'Opname', pembelian: 'Pembelian', kas: 'Kas', klaim: 'Klaim KSG', insight: 'Insight', backup: 'Backup', master: 'Master', persetujuan: 'Setujui', thr: 'THR' };
const hp = matchMedia('(max-width: 900px)');
let bar, sheet, terbuka = false;

const linkSidebar = () => [...document.querySelectorAll('#side-nav .sb-link')];
const badgeDari = el => { const b = el.querySelector('.sb-badge'); return b ? b.textContent.trim() : ''; };
const labelDari = el => [...el.childNodes].filter(n => n.nodeType === 3 || (n.nodeType === 1 && !n.classList.contains('sb-badge'))).map(n => n.textContent).join('').trim();
const angka = s => s === '99+' ? 99 : (+s || 0);

function pilihUtama(links) {
  const ada = links.map(l => l.dataset.view), aktif = links.find(l => l.getAttribute('aria-current') === 'page')?.dataset.view;
  let pilih = UTAMA.filter(v => ada.includes(v)).slice(0, 4);
  if (pilih.length < 4) pilih = [...pilih, ...ada.filter(v => !pilih.includes(v))].slice(0, 4);
  return { pilih, aktif };
}
function renderBar() {
  if (!bar) return;
  const shell = document.getElementById('app-shell');
  const links = shell && shell.hidden ? [] : linkSidebar(); if (!links.length) { tutup(); bar.hidden = true; document.body.classList.remove('has-bnav'); return; }
  bar.hidden = false; document.body.classList.add('has-bnav');
  const { pilih, aktif } = pilihUtama(links);
  const sisa = links.filter(l => !pilih.includes(l.dataset.view)).reduce((a, l) => a + angka(badgeDari(l)), 0);
  bar.innerHTML = pilih.map(v => { const l = links.find(x => x.dataset.view === v), b = badgeDari(l); return `<button type="button" class="bn-item" data-view="${esc(v)}" data-bn-go="${esc(v)}" ${v === aktif ? 'aria-current="page"' : ''}><i aria-hidden="true"></i><span>${esc(PENDEK[v] || labelDari(l))}</span>${b ? `<em>${esc(b)}</em>` : ''}</button>`; }).join('')
    + `<button type="button" class="bn-item bn-menu" data-bn-menu ${aktif && !pilih.includes(aktif) ? 'aria-current="page"' : ''} aria-haspopup="dialog" aria-expanded="${terbuka}"><i aria-hidden="true"></i><span>Menu</span>${sisa ? `<em>${sisa > 99 ? '99+' : sisa}</em>` : ''}</button>`;
  if (terbuka) renderSheet();
}
function renderSheet() {
  const nav = document.getElementById('side-nav'); if (!nav || !sheet) return;
  let html = '', grup = '', isi = '';
  const tutupGrup = () => { if (isi) html += `<section class="ms-group">${grup ? `<h4>${esc(grup)}</h4>` : ''}<div class="ms-grid">${isi}</div></section>`; isi = ''; };
  [...nav.children].forEach(el => {
    if (el.classList.contains('sb-group')) { tutupGrup(); grup = el.textContent.trim(); return; }
    if (!el.classList.contains('sb-link')) return;
    const b = badgeDari(el), v = el.dataset.view;
    isi += `<button type="button" class="ms-item" data-view="${esc(v)}" data-bn-go="${esc(v)}" ${el.getAttribute('aria-current') === 'page' ? 'aria-current="page"' : ''}><i aria-hidden="true"></i><span>${esc(labelDari(el))}</span>${b ? `<em>${esc(b)}</em>` : ''}</button>`;
  });
  tutupGrup();
  const who = document.getElementById('who')?.textContent || '', role = document.getElementById('who-role')?.textContent || '';
  const av = document.querySelector('#top-profile .top-avatar')?.innerHTML || esc(who.slice(0, 1));
  const st = document.getElementById('top-status');
  const tombol = (id, label, cls = '') => { const t = document.getElementById(id); return t && !t.hidden ? `<button type="button" class="ms-act ${cls}" data-bn-klik="${id}">${label}</button>` : ''; };
  const tema = document.querySelector('.sb-foot [data-theme-toggle]')?.textContent?.trim() || 'Mode gelap';
  sheet.querySelector('.ms-body').innerHTML = `
    <div class="ms-profile"><span class="ms-av">${av}</span><div class="ms-who"><b>${esc(who)}</b><small>${esc(role)}</small></div>${st && !st.hidden ? `<button type="button" class="ms-status" data-bn-status>${st.innerHTML}</button>` : ''}</div>
    ${html}
    <section class="ms-group"><h4>Akun &amp; aplikasi</h4><div class="ms-acts">${tombol('ganti-pin', '🔑 Ganti PIN')}${tombol('pasang-app', '📲 Pasang aplikasi')}${tombol('update-app', '⟳ Update aplikasi')}<button type="button" class="ms-act" data-bn-tema>${esc(tema)}</button>${tombol('logout', '⎋ Keluar', 'bad')}</div></section>
    <div class="ms-ver">${esc(document.querySelector('.sb-foot .app-ver')?.textContent || '')} · ${esc(document.querySelector('.sb-foot .copyright')?.textContent || '')}</div>`;
}
function buka() {
  terbuka = true; renderSheet(); sheet.hidden = false; document.body.classList.add('ms-open');
  requestAnimationFrame(() => sheet.classList.add('on')); bar.querySelector('[data-bn-menu]')?.setAttribute('aria-expanded', 'true');
  try { history.pushState({ amuSheet: 1 }, ''); } catch (e) {}
  setTimeout(() => sheet.querySelector('.ms-item[aria-current]')?.scrollIntoView({ block: 'nearest' }), 220);
}
function tutup(dariBack = false) {
  if (!terbuka) return; terbuka = false; sheet.classList.remove('on'); document.body.classList.remove('ms-open');
  bar.querySelector('[data-bn-menu]')?.setAttribute('aria-expanded', 'false');
  setTimeout(() => { if (!terbuka) sheet.hidden = true; }, 220);
  if (!dariBack && history.state?.amuSheet) { try { history.back(); } catch (e) {} }
}
function pergi(v) { const l = document.querySelector(`#side-nav .sb-link[data-view="${CSS.escape(v)}"]`); tutup(); if (l) setTimeout(() => { l.click(); window.scrollTo({ top: 0 }); }, terbuka ? 0 : 10); }

export function pasangNavHp() {
  if (bar) return;
  bar = document.createElement('nav'); bar.id = 'bottom-nav'; bar.className = 'bottom-nav'; bar.setAttribute('aria-label', 'Menu utama (HP)'); bar.hidden = true;
  sheet = document.createElement('div'); sheet.id = 'menu-sheet'; sheet.className = 'menu-sheet'; sheet.hidden = true; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-modal', 'true'); sheet.setAttribute('aria-label', 'Semua menu');
  sheet.innerHTML = '<div class="ms-backdrop" data-bn-tutup></div><div class="ms-panel"><div class="ms-handle" data-bn-tutup><span></span></div><div class="ms-body"></div></div>';
  document.body.append(bar, sheet);
  bar.addEventListener('click', e => { const g = e.target.closest('[data-bn-go]'); if (g) return pergi(g.dataset.bnGo); if (e.target.closest('[data-bn-menu]')) terbuka ? tutup() : buka(); });
  sheet.addEventListener('click', e => {
    const g = e.target.closest('[data-bn-go]'); if (g) return pergi(g.dataset.bnGo);
    if (e.target.closest('[data-bn-tutup]')) return tutup();
    const k = e.target.closest('[data-bn-klik]'); if (k) { const id = k.dataset.bnKlik; tutup(); setTimeout(() => document.getElementById(id)?.click(), 30); return; }
    if (e.target.closest('[data-bn-tema]')) { document.querySelector('.sb-foot [data-theme-toggle]')?.click(); setTimeout(renderSheet, 30); return; }
    if (e.target.closest('[data-bn-status]')) { tutup(); setTimeout(() => document.getElementById('top-status')?.click(), 240); }
  });
  // Geser lembar ke bawah untuk menutup
  let y0 = null, dy = 0; const panel = sheet.querySelector('.ms-panel');
  panel.addEventListener('touchstart', e => { const body = sheet.querySelector('.ms-body'); y0 = (body.scrollTop <= 0 || e.target.closest('.ms-handle')) ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  panel.addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); panel.style.transform = dy ? `translateY(${dy}px)` : ''; }, { passive: true });
  panel.addEventListener('touchend', () => { panel.style.transform = ''; if (dy > 90) tutup(); y0 = null; dy = 0; });
  window.addEventListener('popstate', () => { if (terbuka) tutup(true); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && terbuka) tutup(); });
  const nav = document.getElementById('side-nav');
  let jadwal = 0; const segarkan = () => { cancelAnimationFrame(jadwal); jadwal = requestAnimationFrame(renderBar); };
  new MutationObserver(segarkan).observe(nav, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-current'], characterData: true });
  const shell = document.getElementById('app-shell'); if (shell) new MutationObserver(segarkan).observe(shell, { attributes: true, attributeFilter: ['hidden'] });
  ['who', 'top-status', 'top-profile'].forEach(id => { const el = document.getElementById(id); if (el) new MutationObserver(() => terbuka && renderSheet()).observe(el, { childList: true, subtree: true, characterData: true, attributes: true }); });
  // Di HP daftar & rincian tersusun atas-bawah: setelah memilih motor/baris, gulir otomatis ke panel rincian
  document.getElementById('view')?.addEventListener('click', e => {
    if (!hp.matches || !e.target.closest('.wo, .row-click, [data-act$="-pilih"], [data-act$="-open"], [data-act$="-buka"]')) return;
    setTimeout(() => { const d = document.querySelector('#bay-detail, #ord-detail, #mk-detail, #kn-detail'); if (d && !d.querySelector('.empty') && d.getBoundingClientRect().top > innerHeight * 0.6) d.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 180);
  });
  hp.addEventListener?.('change', () => { if (!hp.matches) tutup(); });
  renderBar();
}
