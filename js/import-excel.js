// Import / export data part dari & ke Excel (SheetJS dimuat hanya saat dibutuhkan).
import { $, esc, rp, dkey, stamp, toast, modal, closeModal, errMsg } from './util.js';
import { S, st, namaPetugas, actions, changeHandlers, isRole } from './state.js';
import { db, doc, collection, writeBatch, addDoc } from './firebase.js';
import { CABANG_UTAMA, cabAktif, stokSet, cabangList, namaCabang, multiCabang, cabangOf } from './cabang.js';
import { AKTIF } from './wo-common.js';
import { parseSheet, planImport, LABEL } from './excel-parser.js';
import { mintaPassword } from './otorisasi.js';

// Membaca file Excel (import): SheetJS resmi versi terbaru.
let XLSX = null;
export async function loadXLSXBaca() {
  if (!XLSX) XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
  return XLSX;
}

// Membuat file Excel (semua export): xlsx-js-style (SheetJS + gaya sel) supaya tabel punya garis kotak,
// judul kolom tebal berlatar, angka berpemisah ribuan, dan lebar kolom menyesuaikan isi.
const XS_URL = 'https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js';
let XS = null;
const GARIS = { style: 'thin', color: { rgb: '9AA8BD' } };
const KOTAK = { top: GARIS, bottom: GARIS, left: GARIS, right: GARIS };
export function beriKotak(X, ws) {
  if (!ws || !ws['!ref']) return ws;
  const r = X.utils.decode_range(ws['!ref']), lebar = [];
  for (let R = r.s.r; R <= r.e.r; R++) for (let C = r.s.c; C <= r.e.c; C++) {
    const a = X.utils.encode_cell({ r: R, c: C });
    if (!ws[a]) ws[a] = { t: 's', v: '' };
    const c = ws[a], judul = R === r.s.r, angka = c.t === 'n';
    c.s = { border: KOTAK, alignment: { vertical: 'center', wrapText: false, horizontal: judul ? 'center' : angka ? 'right' : 'left' },
      ...(judul ? { font: { bold: true, color: { rgb: '0E2B63' } }, fill: { patternType: 'solid', fgColor: { rgb: 'DDE6F4' } } } : {}) };
    if (angka && !judul && Number.isInteger(c.v) && Math.abs(c.v) >= 1000) c.z = '#,##0';
    const pj = String(c.v ?? '').length + (angka && Math.abs(c.v) >= 1000 ? Math.floor(String(Math.abs(c.v)).length / 3) : 0);
    lebar[C - r.s.c] = Math.max(lebar[C - r.s.c] || 0, Math.min(50, pj + 2));
  }
  ws['!cols'] = lebar.map(w => ({ wch: Math.max(8, w) }));
  return ws;
}
// Tombol filter (panah) di baris judul kolom: Excel bisa langsung menyaring per cabang, kategori, dll.
// nBaris = jumlah baris data (tanpa judul); baris catatan di bawah tabel tidak ikut disaring.
export function filterOtomatis(X, ws, nBaris) {
  if (!ws || !ws['!ref']) return ws;
  const r = X.utils.decode_range(ws['!ref']);
  ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: r.s.r, c: r.s.c }, e: { r: r.s.r + Math.max(1, nBaris ?? (r.e.r - r.s.r)), c: r.e.c } }) };
  return ws;
}
export async function loadXLSX() {
  if (!XS) {
    await new Promise((res, rej) => {
      if (window.XLSX?.style_version) return res();
      const sc = document.createElement('script'); sc.src = XS_URL; sc.async = true;
      sc.onload = res; sc.onerror = () => rej(new Error('Pustaka Excel gagal dimuat. Periksa koneksi internet.'));
      document.head.appendChild(sc);
    });
    const X = window.XLSX;
    XS = { ...X, writeFile: (wb, nama, opts) => { wb.SheetNames.forEach(n => beriKotak(X, wb.Sheets[n])); return X.writeFile(wb, nama, { cellStyles: true, ...opts }); } };
  }
  return XS;
}

let parsed = null, fileName = '';
const BATCH = 400; // Firestore maksimal 500 tulisan per batch

function openImport() {
  if (!st.petugas?.super) { toast('Import Excel hanya untuk super admin'); return; }
  parsed = null;
  modal(`<div class="row spread"><h2>Import part dari Excel</h2><button class="btn sm ghost" type="button" data-close="1" aria-label="Tutup">✕</button></div>
   <p class="small" style="margin:0">Format yang dikenali otomatis:</p>
   <ul class="small" style="margin:0;padding-left:18px">
    <li><b>Ekspor stok DMS Yamaha</b> (kolom Parts, On Hand Qty, Average Cost, Retail Price, Product Category)</li>
    <li><b>Template toko</b>: kode, nama, kategori, cocok, rak, harga_beli, harga_jual, stok, stok_min</li>
   </ul>
   <label class="f" for="imp-file">File Excel (.xlsx, .xls, .csv)<input id="imp-file" type="file" accept=".xlsx,.xls,.csv"></label>
   <div id="imp-body"></div>
   <div class="row spread"><button class="btn sm" type="button" data-act="template-xlsx">Unduh template</button><span class="small muted" id="imp-status"></span></div>`, 'wide');
  $('#imp-file').focus();
}

async function readFile(file) {
  fileName = file.name;
  $('#imp-body').innerHTML = '<div class="empty">Membaca file…</div>';
  try {
    const X = await loadXLSXBaca();
    const wb = X.read(await file.arrayBuffer(), { type: 'array' });
    // File hasil export stok berisi beberapa sheet: pakai sheet bernama cabang yang sedang dibuka bila ada
    const nmCab = namaSheet(namaCabang(cabAktif()), new Set()).toLowerCase();
    const hasilExport = wb.SheetNames.some(n => /^(semua cabang|total per cabang)$/i.test(n));
    const nmSheet = wb.SheetNames.find(n => n.toLowerCase() === nmCab) || (hasilExport ? null : wb.SheetNames[0]);
    if (!nmSheet) { $('#imp-body').innerHTML = `<div class="err">File ini tidak punya sheet untuk cabang <b>${esc(namaCabang(cabAktif()))}</b>. Pindah ke cabang yang sesuai dulu, atau ganti nama sheet menjadi nama cabang ini.</div>`; return; }
    const ws = wb.Sheets[nmSheet];
    const rows = X.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
    if ((rows[0] || []).some(h => String(h ?? '').trim().toLowerCase() === 'cabang')) { $('#imp-body').innerHTML = '<div class="err">Sheet ini berisi stok beberapa cabang sekaligus, jadi tidak bisa di-import. Pakai sheet satu cabang (nama sheet = nama cabang).</div>'; return; }
    if (wb.SheetNames.length > 1) fileName = file.name + ' · sheet ' + nmSheet;
    const r = parseSheet(rows);
    if (r.error) { $('#imp-body').innerHTML = `<div class="err">${esc(r.error)}</div>`; return; }
    parsed = r; renderPreview();
  } catch (e) { $('#imp-body').innerHTML = `<div class="err">File tidak bisa dibaca: ${esc(e.message)}</div>`; }
}

function currentMode() { return document.querySelector('input[name="imp-mode"]:checked')?.value || 'all'; }

function renderPreview() {
  const r = parsed, mode = currentMode();
  const plan = planImport(r.items, r.cols, S.map, mode);
  const kolom = Object.keys(r.cols).map(k => LABEL[k]).join(', ');
  const tidakAda = ['nama', 'jual', 'stok'].filter(k => r.cols[k] == null).map(k => LABEL[k]);
  const contoh = r.items.slice(0, 5);
  $('#imp-body').innerHTML = `
   <div class="small"><b>${esc(fileName)}</b> · ${r.items.length.toLocaleString('id-ID')} part terbaca</div>
   <div class="small muted">Kolom dikenali: ${esc(kolom)}</div>
   ${tidakAda.length ? `<div class="err">Kolom tidak ditemukan: ${esc(tidakAda.join(', '))}. Nilai kolom itu tidak akan diisi.</div>` : ''}
   <div class="tw"><table><thead><tr><th>Kode</th><th>Nama</th><th class="r">Jual</th><th class="r">Stok</th></tr></thead><tbody>${contoh.map(p => `<tr><td class="mono small">${esc(p.kode)}</td><td class="small">${esc(p.nama || '')}</td><td class="r num">${p.jual != null ? rp(p.jual) : '–'}</td><td class="r num">${p.stok ?? '–'}</td></tr>`).join('')}</tbody></table></div>
   <fieldset style="border:1px solid var(--line);border-radius:6px;padding:8px 10px;margin:0;display:flex;flex-direction:column;gap:6px">
    <legend class="small" style="padding:0 4px">Part yang kodenya sudah ada</legend>
    <label class="small row" style="gap:6px"><input type="radio" name="imp-mode" value="all" style="width:auto" ${mode === 'all' ? 'checked' : ''}>Perbarui stok, harga, nama &amp; kategori dari file (rak, cocok untuk, stok minimum tetap)</label>
    <label class="small row" style="gap:6px"><input type="radio" name="imp-mode" value="new" style="width:auto" ${mode === 'new' ? 'checked' : ''}>Biarkan, hanya tambahkan part baru</label>
   </fieldset>
   <div class="totals small"><span>Part baru ditambahkan</span><span class="num">${plan.baru.length.toLocaleString('id-ID')}</span><span>Part lama diperbarui</span><span class="num">${plan.ubah.length.toLocaleString('id-ID')}</span><span class="muted">Tidak berubah</span><span class="num">${plan.sama.length.toLocaleString('id-ID')}</span>${r.skipped.length + plan.tanpaNama.length ? `<span class="muted">Dilewati (kode tidak valid / nama kosong)</span><span class="num">${r.skipped.length + plan.tanpaNama.length}</span>` : ''}${r.dup ? `<span class="muted">Kode ganda di file (dipakai baris terakhir)</span><span class="num">${r.dup}</span>` : ''}</div>
   ${plan.baru.length && r.cols.min == null ? '<p class="small muted" style="margin:0">Stok minimum part baru diisi dari kategori ABC (A=2, B=1, lainnya 0). Bisa diubah per part nanti.</p>' : ''}
   <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Batal</button><button class="btn pri" type="button" data-act="import-run" ${plan.baru.length + plan.ubah.length ? '' : 'disabled'}>Import ${(plan.baru.length + plan.ubah.length).toLocaleString('id-ID')} part</button></div>`;
}

async function runImport() {
  if (st.saving || !parsed) return;
  // Import mengubah banyak data sekaligus: hanya super admin, dengan kata sandi
  const plan = planImport(parsed.items, parsed.cols, S.map, currentMode());
  const ops = [...plan.baru.map(p => [p.kode, p]), ...plan.ubah.map(u => [u.kode, u.patch])];
  if (!ops.length) return;
  if (!(await mintaPassword('Import data part dari Excel', `${plan.baru.length} part baru, ${plan.ubah.length} diperbarui.`))) return;
  st.saving = true;
  const btn = document.querySelector('[data-act="import-run"]'); if (btn) btn.disabled = true;
  let done = 0;
  try {
    for (let i = 0; i < ops.length; i += BATCH) {
      const b = writeBatch(db);
      // Kolom stok di file Excel = stok cabang yang sedang dibuka
      ops.slice(i, i + BATCH).forEach(([kode, data]) => {
        const cab = cabAktif();
        if (cab === CABANG_UTAMA || data.stok === undefined) { b.set(doc(db, 'parts', kode), data, { merge: true }); return; }
        const { stok, ...rest } = data;
        b.set(doc(db, 'parts', kode), { ...rest, ...(S.map.has(kode) ? {} : { stok: 0 }), ...stokSet(stok) }, { merge: true });
      });
      await b.commit();
      done = Math.min(ops.length, i + BATCH);
      $('#imp-status') && ($('#imp-status').textContent = `Menyimpan ${done.toLocaleString('id-ID')} / ${ops.length.toLocaleString('id-ID')}…`);
    }
    await addDoc(collection(db, 'imports'), { file: fileName, tgl: stamp(new Date()), petugas: namaPetugas(), baru: plan.baru.length, diperbarui: plan.ubah.length });
    closeModal(); parsed = null;
    toast(`Import selesai: ${plan.baru.length} baru, ${plan.ubah.length} diperbarui`);
  } catch (e) {
    toast(errMsg(e) + (done ? ` (${done} part sudah tersimpan, import ulang file yang sama untuk melanjutkan)` : ''));
    if (btn) btn.disabled = false;
  } finally { st.saving = false; }
}

const COLS = ['kode', 'nama', 'kategori', 'cocok', 'rak', 'harga_beli', 'harga_jual', 'stok', 'stok_min'];
async function downloadTemplate() {
  try {
    const X = await loadXLSX();
    const ws = X.utils.aoa_to_sheet([COLS, ['YML-SM08', 'Oli Yamalube Super Matic 0,8 L', 'Oli', 'Semua matic', 'A1', 38000, 48000, 42, 12], ['3C1F58051000', 'BRAKE PAD KIT (54P2)', 'Rem', 'Vixion, R15', 'B2', 51001, 65000, 24, 3]]);
    ws['!cols'] = [14, 34, 14, 18, 6, 11, 11, 7, 9].map(w => ({ wch: w }));
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Part');
    X.writeFile(wb, 'template-part-AMU.xlsx');
  } catch (e) { toast('Gagal membuat template: ' + e.message); }
}

/* Export stok: satu file berisi
   1. "Semua cabang" — satu baris per part per cabang, ada kolom Cabang + tombol filter → saring per cabang atau lihat semua
   2. "Total per cabang" — satu baris per part, kolom stok tiap cabang + total
   3. satu sheet per cabang (judul kolom sama dengan template, jadi bisa di-import kembali ke cabang itu) */
const namaSheet = (n, pakai) => { let b = String(n).replace(/[\\/?*[\]:]/g, ' ').slice(0, 28) || 'Cabang', x = b, i = 2; while (pakai.has(x.toLowerCase())) x = b.slice(0, 25) + ' ' + i++; pakai.add(x.toLowerCase()); return x; };
async function exportParts() {
  if (!S.parts.length) { toast('Belum ada data part'); return; }
  try {
    const X = await loadXLSX(), wb = X.utils.book_new(), admin = isRole('admin');
    const cabs = cabangList(), multi = multiCabang();
    const stokDi = (p, c) => +((p.stokCab || { [cabAktif()]: p.stok })[c] || 0);
    // Part yang sudah dipesan servis belum dibayar, per cabang (cabang lain hanya diketahui admin)
    const pesan = {};
    (admin && S.woSemua?.length ? S.woSemua : S.wo).filter(w => AKTIF.includes(w.status)).forEach(w => {
      const c = cabangOf(w); if (!admin && c !== cabAktif()) return;
      (w.parts || []).forEach(x => { const m = pesan[c] || (pesan[c] = {}); m[x.kode] = (m[x.kode] || 0) + (+x.qty || 0); });
    });
    const tahuPesan = c => admin || c === cabAktif();
    const parts = [...S.parts].sort((a, b) => String(a.kode).localeCompare(String(b.kode)));
    const dasar = p => ({ kode: p.kode, nama: p.nama, kategori: p.kategori || '', cocok: p.cocok || '', rak: p.rak || '', harga_beli: p.beli || 0, harga_jual: p.jual || 0 });
    const satuCabang = (p, c) => { const stok = stokDi(p, c), d = tahuPesan(c) ? (pesan[c]?.[p.kode] || 0) : ''; return { stok, dipesan: d, ready: d === '' ? '' : stok - d }; };
    const catatan = (ws, n, teks) => X.utils.sheet_add_aoa(ws, [[teks]], { origin: { r: n + 2, c: 1 } }); // kolom B: kolom kode kosong → baris ini dilewati saat import
    const ket = 'Dicetak ' + new Date().toLocaleString('id-ID') + ' oleh ' + namaPetugas() + '. Ready = stok dikurangi part yang sudah dipesan untuk servis yang belum dibayar' + (admin ? '.' : ' (cabang lain: hanya admin yang melihat pesanan servisnya).');
    const pakai = new Set();
    if (multi) {
      // 1. Semua cabang (format panjang, untuk filter)
      const rows = [];
      cabs.forEach(c => parts.forEach(p => { const s = satuCabang(p, c.id), b = dasar(p);
        rows.push({ Cabang: c.nama, Kode: b.kode, 'Nama part': b.nama, Kategori: b.kategori, 'Cocok untuk': b.cocok, Rak: b.rak, 'Harga beli': b.harga_beli, 'Harga jual': b.harga_jual, Stok: s.stok, 'Dipesan servis': s.dipesan, Ready: s.ready, 'Stok min': p.min || 0, 'Nilai stok (harga beli)': s.stok * (p.beli || 0), 'Nilai stok (harga jual)': s.stok * (p.jual || 0), Pengganti: p.pengganti || '', ABC: p.abc || '' }); }));
      const ws = X.utils.json_to_sheet(rows); filterOtomatis(X, ws, rows.length);
      catatan(ws, rows.length, 'Pakai tombol panah di judul kolom "Cabang" untuk melihat satu cabang atau semua. ' + ket);
      X.utils.book_append_sheet(wb, ws, namaSheet('Semua cabang', pakai));
      // 2. Total per cabang (format lebar)
      const rows2 = parts.map(p => { const b = dasar(p), o = { Kode: b.kode, 'Nama part': b.nama, Kategori: b.kategori, 'Harga beli': b.harga_beli, 'Harga jual': b.harga_jual }; let t = 0;
        cabs.forEach(c => { const n = stokDi(p, c.id); o['Stok ' + c.nama] = n; t += n; }); o['Total semua cabang'] = t; o['Nilai total (harga beli)'] = t * (p.beli || 0); return o; });
      const ws2 = X.utils.json_to_sheet(rows2); filterOtomatis(X, ws2, rows2.length);
      const jumlah = { Kode: 'TOTAL', 'Nama part': '', Kategori: '', 'Harga beli': '', 'Harga jual': '' };
      [...cabs.map(c => 'Stok ' + c.nama), 'Total semua cabang', 'Nilai total (harga beli)'].forEach(k => { jumlah[k] = rows2.reduce((a, r) => a + (+r[k] || 0), 0); });
      X.utils.sheet_add_json(ws2, [jumlah], { origin: { r: rows2.length + 1, c: 0 }, skipHeader: true });
      X.utils.book_append_sheet(wb, ws2, namaSheet('Total per cabang', pakai));
    }
    // 3. Satu sheet per cabang (cabang yang sedang dibuka paling depan)
    const urut = multi ? [...cabs.filter(c => c.id === cabAktif()), ...cabs.filter(c => c.id !== cabAktif())] : [{ id: cabAktif(), nama: namaCabang(cabAktif()) }];
    urut.forEach(c => {
      const rows = parts.map(p => { const s = satuCabang(p, c.id); return { ...dasar(p), stok: s.stok, dipesan_servis: s.dipesan, ready: s.ready, stok_min: p.min || 0, pengganti: p.pengganti || '', abc: p.abc || '' }; });
      const ws = X.utils.json_to_sheet(rows); filterOtomatis(X, ws, rows.length);
      catatan(ws, rows.length, 'Stok cabang ' + c.nama + '. ' + ket);
      X.utils.book_append_sheet(wb, ws, namaSheet(c.nama, pakai));
    });
    X.writeFile(wb, `stok-part-AMU-${multi ? 'semua-cabang' : namaCabang(cabAktif()).replace(/\s+/g, '_')}-${dkey(new Date())}.xlsx`);
  } catch (e) { toast('Gagal export: ' + e.message); }
}

Object.assign(actions, {
  'import-open': openImport,
  'import-run': runImport,
  'template-xlsx': downloadTemplate,
  'export-xlsx': exportParts
});
changeHandlers.push(e => {
  const t = e.target;
  if (t.id === 'imp-file' && t.files[0]) readFile(t.files[0]);
  if (t.name === 'imp-mode' && parsed) renderPreview();
});
