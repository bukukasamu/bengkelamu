// THR & Bonus karyawan (bagian dari menu Penghasilan).
// Jumlah = gaji pokok × persen (diatur sendiri, default untuk semua & bisa diubah per orang) × faktor masa kerja
// (THR: masa kerja < 12 bulan dihitung proporsional bila dicentang) + tambahan (Rp, opsional).
// Super admin menyusun draft → "Kunci & terbitkan" (kata sandi) → slip per karyawan tersimpan di slip/{id}_{kunci}
// (hanya terbaca karyawan ybs. & super admin) dan total per cabang tercatat sebagai pengeluaran (untuk laba bersih).
import { $, esc, rp, dkey, stamp, toast, errMsg, modal, konfirmasi } from './util.js';
import { st, actions, changeHandlers, inputHandlers, namaPetugas, idPetugas } from './state.js';
import { db, collection, getDocs, doc, setDoc, writeBatch, query, where } from './firebase.js';
import { mintaPassword } from './otorisasi.js';
import { ROLES } from './config.js';
import { namaCabang, multiCabang, CABANG_UTAMA } from './cabang.js';
import { loaderHTML } from './brand.js';
import { loadXLSX } from './import-excel.js';
import { daftarKaryawan, saya, kunciOrg, resetStaffGaji } from './penghasilan.js';

const BN = { list: null, aktif: null, draft: null, tab: '' };
let tabHTML = '';
const idAman = k => String(k).replace(/[^A-Za-z0-9:_-]/g, '');
const tglID = t => t ? new Date(String(t).slice(0, 10) + 'T00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '–';

/* ---------- Perhitungan ---------- */
export function bulanKerja(mulai, acuan) {
  if (!mulai || !acuan) return null;
  const a = new Date(mulai + 'T00:00'), b = new Date(String(acuan).slice(0, 10) + 'T00:00');
  if (isNaN(a) || isNaN(b) || b < a) return 0;
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()) - (b.getDate() < a.getDate() ? 1 : 0);
}
// Faktor masa kerja THR: ≥ 12 bulan = 1, 1–11 bulan = n/12, < 1 bulan = 0. Tanpa tanggal mulai kerja = 1 (ditandai).
const faktorMasa = bln => bln == null ? 1 : bln >= 12 ? 1 : bln < 1 ? 0 : bln / 12;
export function hitungBaris(r, b) {
  const bln = bulanKerja(r.mulaiKerja, b.tglAcuan || b.tglBayar);
  const faktor = b.jenis === 'THR' && b.prorata ? faktorMasa(bln) : 1;
  const persen = r.persen === '' || r.persen == null ? +b.persen || 0 : +r.persen;
  const pokok = Math.round((+r.gaji || 0) * persen / 100 * faktor);
  const jumlah = r.ikut === false ? 0 : pokok + (+r.tambahan || 0);
  // Batas minimal aturan THR (Permenaker 6/2016): 1× upah sebulan, proporsional bila < 12 bulan
  const minAturan = b.jenis === 'THR' ? Math.round((+r.gaji || 0) * faktorMasa(bln)) : 0;
  return { bln, faktor, persen, pokok, jumlah, minAturan, kurang: b.jenis === 'THR' && r.ikut !== false && jumlah < minAturan };
}
const totalDraft = b => b.rows.reduce((a, r) => a + hitungBaris(r, b).jumlah, 0);

/* ---------- Data ---------- */
async function muatDaftar() {
  const s = await getDocs(query(collection(db, 'slip'), where('kunci', '==', '__bonus')));
  BN.list = s.docs.map(d => ({ ...d.data(), _id: d.id })).sort((a, b) => String(b.tglBayar).localeCompare(String(a.tglBayar)));
}
async function draftBaru() {
  const org = await daftarKaryawan(), th = new Date().getFullYear();
  return {
    id: 'BN' + stamp(new Date()).replace(/\D/g, ''), kunci: '__bonus', status: 'draft', jenis: 'THR', nama: 'THR Idul Fitri ' + (th + (new Date().getMonth() >= 4 ? 1 : 0)),
    tglAcuan: '', tglBayar: dkey(new Date()), persen: 100, prorata: true, metode: 'Transfer', dibuat: stamp(new Date()),
    rows: org.map(o => ({ kunci: kunciOrg(o), nama: o.nama, peran: o.peran, cabang: o.cabang || CABANG_UTAMA, gaji: +o.gaji || 0, mulaiKerja: o.mulaiKerja || '', persen: '', tambahan: 0, ikut: true }))
  };
}
const simpanHeader = b => setDoc(doc(db, 'slip', b.id + '__HEADER'), JSON.parse(JSON.stringify({ ...b, _id: undefined })));

/* ---------- Tampilan ---------- */
export async function renderBonus(tab) {
  tabHTML = tab;
  if (!st.petugas?.super) return renderSaya();
  if (BN.aktif && BN.draft) return renderEditor();
  $('#view').innerHTML = `<div class="grid">${tabHTML}<div class="panel">${loaderHTML('Memuat THR & bonus…')}</div></div>`;
  try { await muatDaftar(); } catch (e) { $('#view').innerHTML = `<div class="grid">${tabHTML}<div class="err">${esc(errMsg(e))}</div></div>`; return; }
  $('#view').innerHTML = `<div class="grid">${tabHTML}
   <div class="panel"><div class="row spread"><h3>THR & Bonus karyawan</h3><button class="btn pri" type="button" data-act="bn-baru">+ THR / Bonus baru</button></div>
    <p class="small muted" style="margin:0">Jumlah = <b>gaji pokok × persen</b> yang Anda tentukan (bisa berbeda per orang) + tambahan bila ada. THR bisa dihitung proporsional untuk masa kerja di bawah 12 bulan. Setelah dikunci, setiap karyawan bisa melihat & mengunduh slipnya di Penghasilan Saya.</p>
    ${BN.list.length ? `<div class="tw"><table class="bernomor"><thead><tr><th>Nama</th><th>Jenis</th><th>Tanggal bayar</th><th class="r">Karyawan</th><th class="r">Total</th><th>Status</th></tr></thead><tbody>${BN.list.map(b => `<tr class="row-click" tabindex="0" data-act="bn-buka" data-id="${esc(b.id)}"><td>${esc(b.nama)}</td><td>${esc(b.jenis)}</td><td class="small">${esc(tglID(b.tglBayar))}</td><td class="r num">${b.rows.filter(r => r.ikut !== false).length}</td><td class="r num">${rp(totalDraft(b))}</td><td>${b.status === 'final' ? '<span class="pill p-good">🔒 Diterbitkan</span>' : '<span class="pill p-warn">Draft</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">Belum ada THR / bonus.</div>'}
   </div></div>`;
}

function renderEditor() {
  const b = BN.draft, kunci = b.status === 'final', dis = kunci ? 'disabled' : '';
  const hs = b.rows.map(r => hitungBaris(r, b)), tot = hs.reduce((a, h) => a + h.jumlah, 0), kurang = hs.filter(h => h.kurang).length;
  const tanpaTgl = b.jenis === 'THR' && b.prorata ? b.rows.filter(r => r.ikut !== false && !r.mulaiKerja).length : 0;
  const perCab = {}; b.rows.forEach((r, i) => { perCab[r.cabang] = (perCab[r.cabang] || 0) + hs[i].jumlah; });
  $('#view').innerHTML = `<div class="grid">${tabHTML}
   <div class="panel">
    <div class="row spread"><button class="btn sm ghost" type="button" data-act="bn-kembali">‹ Daftar THR & bonus</button>${kunci ? `<span class="pill p-good">🔒 Diterbitkan ${esc(b.tglFinal || '')}</span>` : '<span class="pill p-warn">Draft</span>'}</div>
    <div class="form">
     <label class="f" for="bn-jenis">Jenis<select id="bn-jenis" data-bf="jenis" ${dis}>${['THR', 'Bonus'].map(j => `<option ${j === b.jenis ? 'selected' : ''}>${j}</option>`).join('')}</select></label>
     <label class="f wide-2" for="bn-nama">Nama<input id="bn-nama" data-bf="nama" value="${esc(b.nama)}" ${dis}></label>
     ${b.jenis === 'THR' ? `<label class="f" for="bn-acuan">Tanggal hari raya<input id="bn-acuan" type="date" data-bf="tglAcuan" value="${esc(b.tglAcuan)}" ${dis}></label>` : ''}
     <label class="f" for="bn-tgl">Tanggal bayar<input id="bn-tgl" type="date" data-bf="tglBayar" value="${esc(b.tglBayar)}" ${dis}></label>
     <label class="f" for="bn-persen">Persen dari gaji pokok (semua)<input id="bn-persen" type="number" data-raw min="0" max="1000" step="1" data-bf="persen" value="${esc(b.persen)}" ${dis}></label>
     <label class="f" for="bn-metode">Catat ke pengeluaran<select id="bn-metode" data-bf="metode" ${dis}>${[['Transfer', 'Ya, dibayar transfer'], ['Tunai', 'Ya, dibayar tunai (kas)'], ['', 'Tidak dicatat']].map(([v, l]) => `<option value="${v}" ${v === b.metode ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    ${b.jenis === 'THR' ? `<label class="chk small" for="bn-prorata"><input type="checkbox" id="bn-prorata" ${b.prorata ? 'checked' : ''} ${dis}> Masa kerja di bawah 12 bulan dihitung proporsional (bulan kerja ÷ 12), di bawah 1 bulan tidak dapat — sesuai aturan THR</label>` : ''}
    ${b.jenis === 'THR' && b.prorata && b.tglAcuan && b.tglBayar > addDays(b.tglAcuan, -7) ? `<div class="note small diff-bad">Aturan: THR dibayar paling lambat 7 hari sebelum hari raya (${esc(tglID(addDays(b.tglAcuan, -7)))}).</div>` : ''}
    ${tanpaTgl ? `<div class="note small">${tanpaTgl} karyawan belum diisi <b>tanggal mulai kerja</b> → dihitung penuh. Isi di tabel untuk perhitungan proporsional (tersimpan untuk tahun berikutnya).</div>` : ''}
    ${kurang ? `<div class="note small diff-bad">${kurang} karyawan mendapat THR di bawah batas minimal aturan (1× gaji pokok, proporsional masa kerja). Kolom "Min. aturan" ditandai merah.</div>` : ''}
    <div class="tw"><table class="rw-tabel bernomor"><thead><tr><th>Ikut</th><th>Nama</th>${multiCabang() ? '<th>Cabang</th>' : ''}<th class="r">Gaji pokok</th>${b.jenis === 'THR' ? '<th>Mulai kerja</th><th class="r">Masa kerja</th>' : ''}<th class="r">Persen</th><th class="r">Gaji × %${b.jenis === 'THR' && b.prorata ? ' × masa' : ''}</th><th class="r">Tambahan (Rp)</th><th class="r">Diterima</th>${b.jenis === 'THR' ? '<th class="r">Min. aturan</th>' : ''}${kunci ? '<th></th>' : ''}</tr></thead><tbody>
     ${b.rows.map((r, i) => { const h = hs[i]; return `<tr${r.ikut === false ? ' style="opacity:.5"' : ''}>
      <td><input type="checkbox" data-bi="${i}" data-bk="ikut" ${r.ikut !== false ? 'checked' : ''} ${dis} aria-label="Ikut ${esc(r.nama)}" style="width:auto"></td>
      <td>${esc(r.nama)}<div class="rw-det">${esc(ROLES[r.peran] || r.peran)}</div></td>${multiCabang() ? `<td class="small">${esc(namaCabang(r.cabang))}</td>` : ''}
      <td class="r num">${rp(r.gaji)}</td>
      ${b.jenis === 'THR' ? `<td><input type="date" data-bi="${i}" data-bk="mulaiKerja" value="${esc(r.mulaiKerja)}" ${dis} style="width:140px" aria-label="Mulai kerja ${esc(r.nama)}"></td><td class="r small">${h.bln == null ? '<span class="muted">–</span>' : h.bln >= 12 ? Math.floor(h.bln / 12) + ' th ' + (h.bln % 12) + ' bln' : h.bln + ' bln'}</td>` : ''}
      <td class="r"><input class="inline-input num" type="number" data-raw min="0" step="1" data-bi="${i}" data-bk="persen" value="${esc(r.persen)}" placeholder="${esc(b.persen)}" ${dis} style="width:70px;text-align:right" aria-label="Persen ${esc(r.nama)}">%</td>
      <td class="r num" id="bn-p${i}">${rp(h.pokok)}${h.faktor < 1 ? `<div class="rw-det">× ${h.bln}/12</div>` : ''}</td>
      <td class="r"><input class="inline-input num" data-num data-bi="${i}" data-bk="tambahan" value="${esc(r.tambahan || '')}" ${dis} style="width:110px;text-align:right" aria-label="Tambahan ${esc(r.nama)}"></td>
      <td class="r num" id="bn-j${i}"><b>${rp(h.jumlah)}</b></td>
      ${b.jenis === 'THR' ? `<td class="r num ${h.kurang ? 'diff-bad' : 'muted'}" id="bn-m${i}">${rp(h.minAturan)}</td>` : ''}
      ${kunci ? `<td><button class="btn sm ghost" type="button" data-act="bn-slip" data-i="${i}">Slip</button></td>` : ''}</tr>`; }).join('')}
     <tr><td colspan="${2 + (multiCabang() ? 1 : 0) + 1 + (b.jenis === 'THR' ? 2 : 0) + 3}"><b>Total ${b.rows.filter(r => r.ikut !== false).length} karyawan</b>${multiCabang() ? ` <span class="small muted">(${Object.entries(perCab).filter(([, v]) => v).map(([c, v]) => esc(namaCabang(c)) + ' ' + rp(v)).join(' · ')})</span>` : ''}</td><td class="r num" id="bn-tot"><b>${rp(tot)}</b></td>${b.jenis === 'THR' ? '<td></td>' : ''}${kunci ? '<td></td>' : ''}</tr>
    </tbody></table></div>
    <div class="row" style="justify-content:flex-end">
     <button class="btn" type="button" data-act="bn-xlsx">⬇ Excel</button>
     ${kunci ? '<button class="btn" type="button" data-act="bn-batal">🔓 Batalkan penerbitan</button>'
      : `<button class="btn ghost" type="button" data-act="bn-hapus">Hapus draft</button><button class="btn" type="button" data-act="bn-simpan">Simpan draft</button><button class="btn pri" type="button" data-act="bn-terbit">🔒 Kunci & terbitkan slip</button>`}
    </div>
   </div></div>`;
}
const addDays = (t, n) => { const d = new Date(t + 'T00:00'); d.setDate(d.getDate() + n); return dkey(d); };

// Karyawan: daftar THR/bonus miliknya yang sudah diterbitkan
let milikSaya = [];
async function renderSaya() {
  $('#view').innerHTML = `<div class="grid">${tabHTML}<div class="panel">${loaderHTML('Memuat…')}</div></div>`;
  try {
    const o = await saya(), s = await getDocs(query(collection(db, 'slip'), where('kunci', '==', kunciOrg(o))));
    milikSaya = s.docs.map(d => d.data()).filter(d => d.jenisSlip === 'bonus').sort((a, b) => String(b.tglBayar).localeCompare(String(a.tglBayar)));
  } catch (e) { milikSaya = []; toast(errMsg(e)); }
  $('#view').innerHTML = `<div class="grid">${tabHTML}<div class="panel"><h3>THR & Bonus saya</h3>
    ${milikSaya.length ? milikSaya.map((d, i) => `<div class="ph-item"><div class="row spread"><b>${esc(d.judul)}</b><span class="num ph-plus">${rp(d.jumlah)}</span></div>
      <div class="small muted">Dibayar ${esc(tglID(d.tglBayar))} · ${d.persen}% × gaji pokok ${rp(d.gaji)}${d.faktor < 1 ? ` × masa kerja ${d.bulanKerja}/12` : ''}${d.tambahan ? ' + tambahan ' + rp(d.tambahan) : ''}</div>
      <div class="row" style="justify-content:flex-end"><button class="btn sm" type="button" data-act="bn-slip-saya" data-i="${i}">Slip (PDF)</button></div></div>`).join('') : '<div class="empty">Belum ada THR atau bonus yang diterbitkan untuk Anda.</div>'}
   </div></div>`;
}

/* ---------- Slip ---------- */
const slipDoc = (b, r, h) => ({ kunci: r.kunci, jenisSlip: 'bonus', bonusId: b.id, jenis: b.jenis, judul: b.nama, tglBayar: b.tglBayar, tglAcuan: b.tglAcuan || '', org: { nama: r.nama, peran: r.peran, cabang: r.cabang },
  gaji: +r.gaji || 0, persen: h.persen, bulanKerja: h.bln, faktor: h.faktor, pokok: h.pokok, tambahan: +r.tambahan || 0, jumlah: h.jumlah, dibuat: stamp(new Date()) });
function dataPdf(d) {
  return {
    judul: d.jenis === 'THR' ? 'SLIP THR' : 'SLIP BONUS', periode: d.judul, nama: d.org.nama, peran: ROLES[d.org.peran] || d.org.peran, cabang: multiCabang() ? namaCabang(d.org.cabang) : '',
    ident: [['Nama', d.org.nama], ['Jabatan', ROLES[d.org.peran] || d.org.peran], ['Tanggal bayar', tglID(d.tglBayar)]],
    pendapatan: [[`${d.jenis} ${d.persen}% × gaji pokok`, d.pokok, `gaji pokok ${rp(d.gaji)}${d.faktor < 1 ? ` · masa kerja ${d.bulanKerja} bulan (×${d.bulanKerja}/12)` : ''}`], ...(d.tambahan ? [['Tambahan', d.tambahan, '']] : [])],
    potongan: [], totalPendapatan: d.jumlah, totalPotongan: 0, bersih: d.jumlah, labelBersih: 'JUMLAH DITERIMA', nota: '',
    catatan: d.jenis === 'THR' ? 'Tunjangan Hari Raya keagamaan. Ditetapkan manajemen.' : 'Bonus karyawan. Ditetapkan manajemen.'
  };
}
async function unduhPdf(d, el) {
  const label = el.textContent; el.disabled = true; el.textContent = 'Menyiapkan…';
  try {
    const { slipPdfBlob } = await import('./slip-pdf.js'), { saveBlob } = await import('./nota-pdf.js');
    saveBlob(await slipPdfBlob(dataPdf(d)), `${d.jenis}-${d.org.nama.replace(/\s+/g, '-')}-${d.tglBayar}.pdf`);
  } catch (e) { toast('Gagal membuat PDF: ' + e.message); }
  finally { el.disabled = false; el.textContent = label; }
}

/* ---------- Aksi ---------- */
async function simpanDraft(diam) {
  const b = BN.draft;
  try {
    await simpanHeader(b);
    // Tanggal mulai kerja disimpan di data gaji privat supaya dipakai lagi tahun berikutnya
    const bt = writeBatch(db); let n = 0;
    b.rows.forEach(r => { if (r._mulaiBaru) { bt.set(doc(db, 'gaji', r.kunci), { mulaiKerja: r.mulaiKerja }, { merge: true }); delete r._mulaiBaru; n++; } });
    if (n) { await bt.commit(); resetStaffGaji(); }
    if (!diam) toast('Draft disimpan');
  } catch (e) { toast(errMsg(e)); throw e; }
}
async function terbitkan() {
  const b = BN.draft;
  if (!b.nama.trim()) { toast('Isi nama THR / bonus'); return; }
  if (!b.tglBayar) { toast('Isi tanggal bayar'); return; }
  const hs = b.rows.map(r => hitungBaris(r, b)), ikut = b.rows.filter((r, i) => r.ikut !== false && hs[i].jumlah > 0), tot = hs.reduce((a, h) => a + h.jumlah, 0);
  if (!ikut.length) { toast('Belum ada karyawan dengan jumlah lebih dari 0'); return; }
  const kurang = hs.filter(h => h.kurang).length;
  if (!(await konfirmasi('Terbitkan ' + b.nama + '?', `${ikut.length} karyawan · total <b>${rp(tot)}</b> · dibayar ${esc(tglID(b.tglBayar))}.${kurang ? `<br><span class="diff-bad">${kurang} karyawan di bawah batas minimal aturan THR.</span>` : ''}<br>Setiap karyawan bisa melihat slipnya.${b.metode ? ` Total per cabang dicatat sebagai pengeluaran (${esc(b.metode)}).` : ''}`, { ya: 'Lanjut' }))) return;
  if (!(await mintaPassword('Kunci & terbitkan ' + b.nama, `${ikut.length} slip · total ${rp(tot)}`))) return;
  try {
    await simpanDraft(true);
    const bt = writeBatch(db), pIds = [];
    b.rows.forEach((r, i) => { if (r.ikut !== false && hs[i].jumlah > 0) bt.set(doc(db, 'slip', b.id + '_' + idAman(r.kunci)), slipDoc(b, r, hs[i])); });
    if (b.metode) {
      const perCab = {}; b.rows.forEach((r, i) => { if (hs[i].jumlah) perCab[r.cabang || CABANG_UTAMA] = (perCab[r.cabang || CABANG_UTAMA] || 0) + hs[i].jumlah; });
      Object.entries(perCab).forEach(([cab, jml]) => {
        const ref = doc(collection(db, 'pengeluaran')); pIds.push(ref.id);
        bt.set(ref, { cabang: cab, tgl: b.tglBayar, bulan: b.tglBayar.slice(0, 7), kategori: 'THR & bonus karyawan', ket: `${b.nama} (${b.rows.filter((r, i) => hs[i].jumlah && (r.cabang || CABANG_UTAMA) === cab).length} karyawan)`, jumlah: jml, metode: b.metode, petugas: namaPetugas(), petugasId: idPetugas(), jam: stamp(new Date()), bonusId: b.id });
      });
    }
    Object.assign(b, { status: 'final', tglFinal: stamp(new Date()), oleh: namaPetugas(), pengeluaranIds: pIds, total: tot });
    bt.set(doc(db, 'slip', b.id + '__HEADER'), JSON.parse(JSON.stringify(b)));
    await bt.commit(); toast(b.nama + ' diterbitkan'); renderEditor();
  } catch (e) { toast(errMsg(e)); }
}
async function batalkan() {
  const b = BN.draft;
  if (!(await mintaPassword('Batalkan penerbitan ' + b.nama, 'Slip karyawan ditarik dan pengeluarannya dihapus. Data kembali menjadi draft.'))) return;
  try {
    const bt = writeBatch(db);
    b.rows.forEach(r => bt.delete(doc(db, 'slip', b.id + '_' + idAman(r.kunci))));
    (b.pengeluaranIds || []).forEach(id => bt.delete(doc(db, 'pengeluaran', id)));
    Object.assign(b, { status: 'draft', tglFinal: '', pengeluaranIds: [] });
    bt.set(doc(db, 'slip', b.id + '__HEADER'), JSON.parse(JSON.stringify(b)));
    await bt.commit(); toast('Penerbitan dibatalkan, kembali ke draft'); renderEditor();
  } catch (e) { toast(errMsg(e)); }
}
async function exportXlsx() {
  const b = BN.draft;
  try {
    const X = await loadXLSX(), rows = b.rows.map(r => { const h = hitungBaris(r, b); return { nama: r.nama, peran: ROLES[r.peran] || r.peran, ...(multiCabang() ? { cabang: namaCabang(r.cabang) } : {}), ikut: r.ikut !== false ? 'ya' : 'tidak', gaji_pokok: +r.gaji || 0, ...(b.jenis === 'THR' ? { mulai_kerja: r.mulaiKerja, masa_kerja_bulan: h.bln ?? '' } : {}), persen: h.persen, gaji_x_persen: h.pokok, tambahan: +r.tambahan || 0, diterima: h.jumlah, ...(b.jenis === 'THR' ? { min_aturan: h.minAturan } : {}) }; });
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows), b.jenis); X.writeFile(wb, `${b.nama.replace(/[^\w-]+/g, '-')}.xlsx`);
  } catch (e) { toast('Gagal export: ' + e.message); }
}

Object.assign(actions, {
  'bn-baru': async () => { BN.draft = await draftBaru(); BN.aktif = BN.draft.id; renderEditor(); },
  'bn-buka': el => { const b = BN.list?.find(x => x.id === el.dataset.id); if (!b) return; BN.draft = JSON.parse(JSON.stringify(b)); delete BN.draft._id; BN.aktif = b.id; renderEditor(); },
  'bn-kembali': () => { BN.aktif = null; BN.draft = null; renderBonus(tabHTML); },
  'bn-simpan': () => simpanDraft().catch(() => {}),
  'bn-terbit': terbitkan,
  'bn-batal': batalkan,
  'bn-xlsx': exportXlsx,
  'bn-hapus': async () => {
    const b = BN.draft; if (b.status === 'final') return;
    if (!(await konfirmasi('Hapus draft ' + b.nama + '?', 'Draft ini dihapus. Tanggal mulai kerja yang sudah disimpan tetap ada.', { ya: 'Ya, hapus', bahaya: true }))) return;
    try { const bt = writeBatch(db); bt.delete(doc(db, 'slip', b.id + '__HEADER')); await bt.commit(); BN.aktif = null; BN.draft = null; toast('Draft dihapus'); renderBonus(tabHTML); } catch (e) { toast(errMsg(e)); }
  },
  'bn-slip': el => { const b = BN.draft, r = b.rows[+el.dataset.i]; if (r) unduhPdf(slipDoc(b, r, hitungBaris(r, b)), el); },
  'bn-slip-saya': el => { const d = milikSaya[+el.dataset.i]; if (d) unduhPdf(d, el); }
});
// Ubah kolom: header (data-bf) atau baris (data-bi + data-bk). Angka diterima diperbarui tanpa menggambar ulang tabel.
function ubah(e, akhir) {
  const t = e.target, b = BN.draft; if (!b || b.status === 'final' || st.view !== 'penghasilan') return;
  if (t.dataset.bf) {
    const f = t.dataset.bf; b[f] = f === 'persen' ? (t.value === '' ? 0 : +t.value) : t.value;
    if (f === 'jenis' && akhir) { if (b.jenis === 'THR') b.prorata = true; renderEditor(); }
    else if (f === 'persen' || f === 'tglAcuan' || f === 'tglBayar') akhir && f !== 'persen' ? renderEditor() : segarkanAngka();
    return;
  }
  if (t.id === 'bn-prorata') { b.prorata = t.checked; renderEditor(); return; }
  if (t.dataset.bi == null) return;
  const r = b.rows[+t.dataset.bi], k = t.dataset.bk;
  if (k === 'ikut') { r.ikut = t.checked; renderEditor(); return; }
  if (k === 'mulaiKerja') { if (!akhir) return; r.mulaiKerja = t.value; r._mulaiBaru = true; renderEditor(); return; }
  r[k] = k === 'tambahan' ? (+t.value || 0) : t.value;
  segarkanAngka();
}
function segarkanAngka() {
  const b = BN.draft, g = id => document.getElementById(id); let tot = 0;
  b.rows.forEach((r, i) => {
    const h = hitungBaris(r, b); tot += h.jumlah;
    if (g('bn-j' + i)) g('bn-j' + i).innerHTML = `<b>${rp(h.jumlah)}</b>`;
    if (g('bn-p' + i)) g('bn-p' + i).innerHTML = rp(h.pokok) + (h.faktor < 1 ? `<div class="rw-det">× ${h.bln}/12</div>` : '');
    if (g('bn-m' + i)) g('bn-m' + i).className = 'r num ' + (h.kurang ? 'diff-bad' : 'muted');
  });
  if (g('bn-tot')) g('bn-tot').innerHTML = `<b>${rp(tot)}</b>`;
}
inputHandlers.push(e => { if (BN.draft && (e.target.dataset.bi != null || e.target.dataset.bf)) ubah(e, false); });
changeHandlers.push(e => { if (BN.draft && (e.target.dataset.bi != null || e.target.dataset.bf || e.target.id === 'bn-prorata')) ubah(e, true); });
