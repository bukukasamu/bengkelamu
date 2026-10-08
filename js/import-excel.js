// Import / export data part dari & ke Excel (SheetJS dimuat hanya saat dibutuhkan).
import { $, esc, rp, dkey, stamp, toast, modal, closeModal, errMsg } from './util.js';
import { S, st, namaPetugas, actions, changeHandlers } from './state.js';
import { db, doc, collection, writeBatch, addDoc } from './firebase.js';
import { CABANG_UTAMA, cabAktif, stokSet } from './cabang.js';
import { parseSheet, planImport, LABEL } from './excel-parser.js';

let XLSX = null;
export async function loadXLSX() {
  if (!XLSX) XLSX = await import('https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs');
  return XLSX;
}

let parsed = null, fileName = '';
const BATCH = 400; // Firestore maksimal 500 tulisan per batch

function openImport() {
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
    const X = await loadXLSX();
    const wb = X.read(await file.arrayBuffer(), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = X.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
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
  const plan = planImport(parsed.items, parsed.cols, S.map, currentMode());
  const ops = [...plan.baru.map(p => [p.kode, p]), ...plan.ubah.map(u => [u.kode, u.patch])];
  if (!ops.length) return;
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

async function exportParts() {
  if (!S.parts.length) { toast('Belum ada data part'); return; }
  try {
    const X = await loadXLSX();
    const rows = S.parts.map(p => ({ kode: p.kode, nama: p.nama, kategori: p.kategori || '', cocok: p.cocok || '', rak: p.rak || '', harga_beli: p.beli || 0, harga_jual: p.jual || 0, stok: p.stok || 0, stok_min: p.min || 0, pengganti: p.pengganti || '', abc: p.abc || '' }));
    const ws = X.utils.json_to_sheet(rows);
    ws['!cols'] = [14, 40, 20, 18, 6, 11, 11, 7, 9, 14, 5].map(w => ({ wch: w }));
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Stok');
    X.writeFile(wb, `stok-part-AMU-${dkey(new Date())}.xlsx`);
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
