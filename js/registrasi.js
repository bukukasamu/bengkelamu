// Menu Registrasi Servis: data konsumen & kendaraan, keluhan, jenis servis (Reguler/KSB/KSG), jasa, mekanik.
import { $, esc, rp, dkey, stamp, clone, toast, errMsg, waButton, waNumber } from './util.js';
import { APP_NAME } from './config.js';
import { S, st, views, refreshers, actions, inputHandlers, changeHandlers, fkeys, tipeList, jasaAktif, mekanikAktif, mekanikById, isRole } from './state.js';
import { JENIS_SERVIS } from './config.js';
import { db, doc, getDoc, getDocs, setDoc, collection, query, where, limit, documentId } from './firebase.js';
import { AKTIF, normJasa, woCalc, woCard, sibukOleh, tarifKsg, saveWo, findWo, statusPill, jenisBadge, logStatus, timelineHTML, syncPantau, fmtAntri, kurangBadge } from './wo-common.js';
import { showAntrian } from './antrian.js';
import { wilayahHTML, fillWilayah, WIL_FIELDS } from './wilayah.js';

import { cariKendaraan, nopolKey } from './cari-kendaraan.js';
export { nopolKey };
// Data konsumen sesuai KTP + data kendaraan sesuai STNK (disimpan bersama per kendaraan di koleksi kendaraan)
export const KONSUMEN_FIELDS = ['nik', 'nama', 'tempatLahir', 'tglLahir', 'jk', 'pekerjaan', 'hp', 'rtrw', ...WIL_FIELDS];
const UNIT_FIELDS = ['nopol', 'namaStnk', 'stnkSama', 'tipe', 'tahun', 'warna', 'noRangka', 'noMesin'];
const KEND_FIELDS = [...KONSUMEN_FIELDS, ...UNIT_FIELDS];
const blank = () => ({ no: null, tgl: stamp(new Date()), nik: '', nama: '', tempatLahir: '', tglLahir: '', jk: '', pekerjaan: '', hp: '', rtrw: '', namaStnk: '', stnkSama: true, nopol: '', provinsi: '', kabKode: '', kabupaten: '', kecamatan: '', kelurahan: '', alamat: '', tipe: '', tahun: '', warna: '', noRangka: '', noMesin: '', km: '', keluhan: '', jenisServis: 'Reguler', ksgKe: '', noKartu: '', jasa: [], mekanikId: '', mekanik: '', parts: [], biaya: [], catatanPart: '', status: 'Antri' });
let filter = 'aktif';
const waMsg = w => `Halo ${w.nama || 'Bapak/Ibu'}, kami dari ${APP_NAME} mengenai motor ${w.nopol || ''}${w.antrian ? ' (antrian ' + fmtAntri(w.antrian) + ')' : ''}. `;

function listWo() {
  const t = dkey(new Date());
  const l = [...S.wo].reverse();
  if (filter === 'aktif') return l.filter(w => AKTIF.includes(w.status));
  if (filter === 'hari') return l.filter(w => w.tgl.slice(0, 10) === t);
  return l;
}
function renderList() {
  const el = $('#reg-list'); if (!el) return;
  const l = listWo();
  el.innerHTML = l.map(o => woCard(o, st.regDraft?.no, 'reg-pick')).join('') || '<div class="empty">Belum ada motor masuk.</div>';
}

// Mekanik hanya 1 motor: yang sedang mengerjakan motor lain tidak bisa dipilih
function mekanikOptions(w) {
  const list = mekanikAktif().map(m => ({ m, busy: sibukOleh(m, w.no) })).sort((a, b) => !!a.busy - !!b.busy || a.m.nama.localeCompare(b.m.nama));
  return `<option value="">Belum ada mekanik (antri)</option>` + list.map(({ m, busy }) => `<option value="${esc(m.id)}" ${m.id === w.mekanikId ? 'selected' : ''} ${busy && m.id !== w.mekanikId ? 'disabled' : ''}>${esc(m.nama)} — ${busy ? 'sibuk (' + esc(busy.nopol) + ')' : 'kosong'}</option>`).join('');
}

function renderRegistrasi() {
  if (!st.regDraft) st.regDraft = blank();
  const w = st.regDraft, locked = w.status === 'Lunas', dis = locked ? 'disabled' : '';
  const jasaList = jasaAktif();
  const selected = normJasa(w);
  const extra = selected.filter(j => !jasaList.find(x => x.nama === j.nama));   // jasa lama yang sudah tidak aktif
  const inp = (f, label, attrs = '') => `<label class="f" for="r-${f}">${label}<input id="r-${f}" data-rf="${f}" value="${esc(w[f])}" ${attrs} ${dis}></label>`;
  const c = woCalc(w);
  $('#view').innerHTML = `<div class="grid g-servis">
   <div class="panel"><div class="row spread"><h3>Motor masuk</h3><button class="btn sm" data-act="reg-new" type="button">+ Motor masuk [F1]</button></div>
    <div class="seg" role="group" aria-label="Tampilkan">${[['aktif', 'Aktif'], ['hari', 'Hari ini'], ['semua', 'Semua']].map(([k, l]) => `<button type="button" data-act="reg-filter" data-f="${k}" aria-pressed="${k === filter}">${l}</button>`).join('')}</div>
    <div class="wolist" id="reg-list"></div>
   </div>
   <div class="panel"><div class="row spread"><h2 class="row" style="gap:10px">${w.no ? `<span>Antrian ${fmtAntri(w.antrian) || '–'}</span> <span class="small muted mono" title="Nomor kartu kerja (work order)">${esc(w.no)}</span><button class="btn sm ghost" type="button" data-act="rw-buka" data-np="${esc(w.nopol)}">Riwayat motor</button>` : 'Registrasi motor masuk'}</h2>${w.no ? `<span class="row">${kurangBadge(w)}${jenisBadge(w)}${statusPill(w.status)}</span>` : ''}</div>
    ${locked ? '' : `<div class="cari-box"><label class="f" for="r-cari">Pernah servis di sini? Cari data lama<span class="row" style="gap:6px"><input id="r-cari" placeholder="No. polisi, nama, no. HP, NIK, no. rangka, atau no. mesin — boleh sebagian" autocomplete="off" style="flex:1 1 220px"><button class="btn" type="button" data-act="reg-cari">Cari</button></span></label><div id="r-cari-hasil"></div></div>`}
    <h3>1. Data konsumen <span class="h-sub">sesuai KTP</span></h3>
    <div class="form">
     ${inp('nik', 'NIK (16 angka)', 'inputmode="numeric" maxlength="16" class="num" autocomplete="off"')}
     <label class="f wide-2" for="r-nama">Nama lengkap<input id="r-nama" data-rf="nama" value="${esc(w.nama)}" ${dis}></label>
     ${inp('tempatLahir', 'Tempat lahir')}
     <label class="f" for="r-tglLahir">Tanggal lahir<input id="r-tglLahir" data-rf="tglLahir" type="date" value="${esc(w.tglLahir)}" ${dis}></label>
     <label class="f" for="r-jk">Jenis kelamin<select id="r-jk" data-rf="jk" ${dis}><option value="">–</option>${['LAKI-LAKI', 'PEREMPUAN'].map(x => `<option ${x === w.jk ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
     ${inp('pekerjaan', 'Pekerjaan')}
     <label class="f" for="r-hp"><span class="f-wa">No. HP / WA<span id="r-wa">${waButton(w.hp, waMsg(w))}</span></span><input id="r-hp" data-rf="hp" inputmode="tel" value="${esc(w.hp)}" ${dis}></label>
    </div>
    <div class="form form-wil">${wilayahHTML('rw', w, locked)}
     ${inp('rtrw', 'RT / RW', 'placeholder="mis. 002/005" class="num"')}</div>
    <h3>2. Data kendaraan <span class="h-sub">sesuai STNK</span></h3>
    <div class="form">
     ${inp('nopol', 'No. Polisi', 'class="mono" placeholder="BL 1234 XX" autocomplete="off"')}
     <div class="f wide-2"><span class="f-wa"><label for="r-namaStnk">Nama pemilik di STNK</label><label class="chk small" for="r-stnkSama"><input type="checkbox" id="r-stnkSama" ${w.stnkSama !== false ? 'checked' : ''} ${dis}>sama dengan konsumen</label></span><input id="r-namaStnk" data-rf="namaStnk" value="${esc(w.stnkSama !== false ? w.nama : w.namaStnk)}" ${w.stnkSama !== false || locked ? 'disabled' : ''}></div>
     <label class="f" for="r-tipe">Tipe motor<select id="r-tipe" data-rf="tipe" ${dis}><option value="">Pilih tipe</option>${[...new Set([...tipeList(), w.tipe].filter(Boolean))].map(t => `<option ${t === w.tipe ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
     ${inp('tahun', 'Tahun pembuatan', 'inputmode="numeric" class="num" maxlength="4"')}
     ${inp('warna', 'Warna')}
     ${inp('noRangka', 'No. rangka', 'class="mono"')}
     ${inp('noMesin', 'No. mesin', 'class="mono"')}
     ${inp('km', 'Kilometer saat ini', 'data-num class="num" placeholder="mis. 12.500"')}
    </div>
    <h3>3. Servis</h3>
    <div class="form">
     <label class="f" for="r-jenis">Jenis servis<select id="r-jenis" data-rf="jenisServis" ${dis}>${Object.entries(JENIS_SERVIS).map(([k, l]) => `<option value="${k}" ${k === w.jenisServis ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
     ${w.jenisServis === 'KSG' ? `<label class="f" for="r-ksgke">KSG ke-<select id="r-ksgke" data-rf="ksgKe" ${dis}><option value="">Pilih</option>${[1, 2, 3, 4].map(n => `<option ${String(n) === String(w.ksgKe) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
     ${w.jenisServis !== 'Reguler' ? inp('noKartu', w.jenisServis === 'KSG' ? 'No. kupon / buku servis' : 'No. kartu KSB', 'class="mono"') : ''}
     <label class="f" for="r-mek">Mekanik<select id="r-mek" data-rf="mekanikId" ${dis}>${mekanikOptions(w)}</select></label>
     <label class="f wide" for="r-keluhan">Keluhan konsumen<textarea id="r-keluhan" data-rf="keluhan" ${dis}>${esc(w.keluhan)}</textarea></label>
    </div>
    ${w.jenisServis === 'KSG' ? `<div class="note small">KSG: jasa servis gratis untuk konsumen. ${w.tipe && w.ksgKe ? (tarifKsg(w) ? `Klaim ke main dealer (${esc(w.tipe)}, KSG ke-${esc(w.ksgKe)}): <b>${rp(tarifKsg(w))}</b>.` : `<span class="diff-bad">Tarif KSG ${esc(w.tipe)} ke-${esc(w.ksgKe)} belum diisi</span> di Master Data → Tarif KSG.`) : 'Pilih tipe motor dan KSG ke berapa untuk melihat nilai klaim.'} Sparepart dan biaya lain tetap ditagih.</div>` : ''}
    <h3>Jasa servis</h3>
    <div class="checks">${[...jasaList, ...extra].map((j, i) => `<label for="r-j${i}"><input type="checkbox" id="r-j${i}" data-jasa="${esc(j.nama)}" data-harga="${j.harga}" ${selected.find(x => x.nama === j.nama) ? 'checked' : ''} ${dis}>${esc(j.nama)}<span class="hr">${w.jenisServis === 'KSG' ? 'gratis' : rp(j.harga)}</span></label>`).join('') || '<div class="small muted">Belum ada jasa. Tambahkan di Master Data → Jasa Servis.</div>'}</div>
    ${w.no ? timelineHTML(w) : ''}
    <div class="totals small"><span class="muted">Jasa ditagih</span><span class="num">${rp(c.jasaTagih)}</span>${c.klaim ? `<span class="muted">Klaim KSG</span><span class="num">${rp(c.klaim)}</span>` : ''}${w.parts.length ? `<span class="muted">Order sparepart</span><span class="num">${rp(c.parts)}</span>` : ''}</div>
    <div class="row" style="justify-content:flex-end">
     ${w.no && !locked && isRole('admin') ? `<label class="f" for="r-status" style="flex-direction:row;align-items:center;gap:6px">Status<select id="r-status" style="width:auto">${AKTIF.map(s => `<option ${s === w.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>` : ''}
     ${w.status === 'Ditunda' && !locked ? '<span class="small muted">Ditunda (lanjut lama). Pilih mekanik kosong lalu</span><button class="btn" type="button" data-act="reg-lanjut">Lanjutkan dikerjakan</button>' : ''}
     ${locked ? '<span class="small muted">Sudah dibayar, tidak bisa diubah.</span>' : `${w.no ? '' : '<button class="btn" type="button" data-act="reg-cepat" title="Saat ramai: nomor antrian langsung keluar hanya dengan nomor polisi, data lain dilengkapi sesudahnya">Nomor cepat (cukup nopol)</button>'}<button class="btn pri" type="button" data-act="reg-save">${w.no ? 'Simpan perubahan' : 'Daftarkan &amp; beri nomor antrian'} [F2]</button>`}
    </div>
   </div></div>`;
  renderList();
  fillWilayah('rw', { get: () => st.regDraft });
}

async function lookupKendaraan(nopol) {
  const key = nopolKey(nopol); if (!key) return;
  try {
    const s = await getDoc(doc(db, 'kendaraan', key));
    if (!s.exists()) return;
    const k = s.data(), w = st.regDraft;
    let filled = false;
    KEND_FIELDS.forEach(f => { if (f !== 'nopol' && (w[f] === '' || w[f] == null) && k[f] != null && k[f] !== '') { w[f] = k[f]; filled = true; } });
    if (filled) { renderRegistrasi(); toast('Kendaraan terdaftar: data ' + (k.nama || k.nopol) + ' diisi otomatis'); }
  } catch (e) { /* lookup gagal tidak menghalangi registrasi */ }
}

// Cari data servis sebelumnya dengan salah satu: nopol, no. rangka, no. mesin, NIK, no. HP, atau nama.
// Cukup sebagian depannya (mis. "BL123" menemukan BL 1234 NN). Data servis yang sudah dimuat juga dicocokkan
// di bagian mana pun (mis. "1234" atau "NN").
let hasilCari = [];
async function cariData() {
  const box = $('#r-cari-hasil');
  box.innerHTML = '<div class="small muted">Mencari…</div>';
  const hasil = await cariKendaraan($('#r-cari')?.value || '');
  if (!hasil) { box.innerHTML = ''; toast('Ketik minimal 3 huruf/angka'); return; }
  hasilCari = hasil;
  box.innerHTML = hasilCari.length ? `<div class="small muted">${hasilCari.length} ditemukan${hasilCari.length === 15 ? ' (ketik lebih lengkap untuk mempersempit)' : ''}</div><div class="cari-hasil">${hasilCari.map((k, i) => `<div class="cari-item"><div><b class="mono">${esc(k.nopol)}</b> · ${esc(k.tipe || '')} ${esc(k.warna || '')}<div class="small muted">${esc(k.nama || '–')}${k.nik ? ' · NIK ' + esc(k.nik) : ''}${k.hp ? ' · ' + esc(k.hp) : ''}</div><div class="small muted">${k.noRangka ? 'Rangka ' + esc(k.noRangka) : ''}${k.noMesin ? ' · Mesin ' + esc(k.noMesin) : ''}</div></div><div class="row" style="gap:6px"><button class="btn sm" type="button" data-act="reg-pakai" data-i="${i}" data-m="semua">Pakai data</button><button class="btn sm ghost" type="button" data-act="reg-pakai" data-i="${i}" data-m="konsumen" title="Untuk motor lain milik konsumen yang sama">Konsumen saja</button></div></div>`).join('')}</div>`
    : '<div class="small muted">Tidak ditemukan. Coba ketik bagian lain (mis. angka plat saja, nama, atau no. HP), atau isi data baru di bawah.</div>';
}
function pakaiData(el) {
  const k = hasilCari[+el.dataset.i]; if (!k) return;
  const w = st.regDraft, fields = el.dataset.m === 'konsumen' ? KONSUMEN_FIELDS : KEND_FIELDS;
  fields.forEach(f => { if (k[f] != null && k[f] !== '') w[f] = k[f]; });
  if (el.dataset.m !== 'konsumen' && !k.namaStnk) { w.namaStnk = k.nama || ''; w.stnkSama = true; }
  renderRegistrasi(); toast('Data ' + (k.nama || k.nopol) + ' dipakai. Periksa dan ubah bila ada yang berbeda.');
}

async function save(opts = {}) {
  if (st.saving) return;
  const w = st.regDraft; w.nopol = w.nopol.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!w.nopol) { toast('Isi nomor polisi dulu'); $('#r-nopol')?.focus(); return; }
  const baru = !w.no;
  // Nomor cepat: saat ramai, nomor antrian keluar hanya dengan nopol. Motor menunggu (Antri) sampai datanya dilengkapi.
  if (opts.cepat) return simpanCepat(w);
  if (!w.nama.trim()) { toast('Isi nama konsumen sesuai KTP'); $('#r-nama')?.focus(); return; }
  if (w.nik && !/^\d{16}$/.test(w.nik)) { toast('NIK harus 16 angka (atau kosongkan)'); $('#r-nik')?.focus(); return; }
  if (!w.tipe) { toast('Pilih tipe motor'); $('#r-tipe')?.focus(); return; }
  w.noRangka = (w.noRangka || '').replace(/\s+/g, ''); w.noMesin = (w.noMesin || '').replace(/\s+/g, '');
  if (w.stnkSama !== false) w.namaStnk = w.nama;
  if (w.jenisServis === 'KSG' && !w.ksgKe) { toast('Pilih KSG ke berapa'); $('#r-ksgke')?.focus(); return; }
  const mek = mekanikById(w.mekanikId);
  if (w._lanjut && !mek) { toast('Pilih mekanik yang kosong untuk melanjutkan'); delete w._lanjut; return; }
  // Status otomatis: ada mekanik = Dikerjakan, tanpa mekanik = Antri.
  // Selesai tidak diubah dari sini. Ditunda tetap Ditunda kecuali mekanik diganti atau tombol "Lanjutkan" ditekan.
  const stored = w.no ? findWo(w.no) : null;
  const tetapDitunda = w.status === 'Ditunda' && !w._lanjut && stored && stored.mekanikId === w.mekanikId;
  let status = w.status;
  if (!w._manual && w.status !== 'Selesai' && !tetapDitunda) status = mek ? 'Dikerjakan' : 'Antri';
  // Mekanik hanya boleh 1 motor yang sedang dikerjakan
  if (mek && status === 'Dikerjakan') {
    const busy = sibukOleh(mek, w.no);
    if (busy) { toast(mek.nama + ' masih mengerjakan ' + busy.nopol + '. Pilih mekanik lain.'); delete w._lanjut; return; }
  }
  // Catat jam setiap perubahan status (untuk menghitung lama servis)
  const prevStatus = stored ? stored.status : null;
  if (status !== prevStatus) w.log = logStatus(w.log || (stored?.log) || [], status);
  w.status = status; w.mekanik = mek?.nama || '';
  delete w._manual; delete w._lanjut;
  w.jasa = normJasa(w); w.dataKurang = false;
  st.saving = true;
  try {
    const no = await saveWo(w);
    w.no = no;
    const kend = Object.fromEntries(KEND_FIELDS.map(f => [f, f === 'stnkSama' ? w[f] !== false : (w[f] || '')]));
    const kRef = doc(db, 'kendaraan', nopolKey(w.nopol)), kAda = (await getDoc(kRef).catch(() => null))?.exists() ?? true;
    await setDoc(kRef, { ...kend, ...(kAda === false ? { dibuat: stamp(new Date()) } : {}), nopolKey: nopolKey(w.nopol), hpNorm: waNumber(w.hp), km: w.km || '', updated: stamp(new Date()), woTerakhir: no }, { merge: true });
    w.dataKurang = false;
    syncPantau(w);
    toast(`Antrian ${fmtAntri(w.antrian)} · ${w.nopol} disimpan`);
    renderRegistrasi();
    if (baru) showAntrian(w);
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

async function simpanCepat(w) {
  if (findWo(w.no)) return;
  w.status = 'Antri'; w.mekanikId = ''; w.mekanik = ''; w.dataKurang = !(w.nama.trim() && w.tipe);
  w.log = logStatus([], 'Antri'); w.jasa = normJasa(w);
  st.saving = true;
  try {
    w.no = await saveWo(w);
    syncPantau(w);
    renderRegistrasi(); showAntrian(w);
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

views.registrasi = renderRegistrasi;
refreshers.registrasi = () => { renderList(); const sel = $('#r-mek'); if (sel) { const v = sel.value; sel.innerHTML = mekanikOptions(st.regDraft); sel.value = v; } };
fkeys.registrasi = { baru: 'reg-new', simpan: 'reg-save' };
Object.assign(actions, {
  'reg-new': () => { st.regDraft = blank(); renderRegistrasi(); $('#r-nopol')?.focus(); },
  'reg-pick': el => { const o = findWo(el.dataset.no); if (o) { st.regDraft = { ...blank(), ...clone(o), jasa: normJasa(o) }; renderRegistrasi(); } },
  'reg-filter': el => { filter = el.dataset.f; document.querySelectorAll('[data-act="reg-filter"]').forEach(b => b.setAttribute('aria-pressed', b === el)); renderList(); },
  'reg-save': () => save(),
  'reg-cepat': () => save({ cepat: true }),
  'reg-cari': cariData,
  'reg-pakai': pakaiData,
  'reg-lanjut': () => { st.regDraft._lanjut = true; save(); }
});
inputHandlers.push(e => {
  const t = e.target; if (t.dataset.rf && st.regDraft) st.regDraft[t.dataset.rf] = t.value;
  if ((t.id === 'r-hp' || t.id === 'r-nama') && $('#r-wa')) $('#r-wa').innerHTML = waButton(st.regDraft.hp, waMsg(st.regDraft));
  if (t.id === 'r-nama' && st.regDraft.stnkSama !== false && $('#r-namaStnk')) $('#r-namaStnk').value = t.value;
  if (t.id === 'r-nik') t.value = t.value.replace(/\D/g, '').slice(0, 16), st.regDraft.nik = t.value;
});
changeHandlers.push(e => {
  const t = e.target, w = st.regDraft; if (!w) return;
  if (t.dataset.rf) w[t.dataset.rf] = t.value;
  if (t.id === 'r-jenis') { if (w.jenisServis !== 'KSG') w.ksgKe = ''; renderRegistrasi(); }
  if ((t.id === 'r-ksgke' || t.id === 'r-tipe') && w.jenisServis === 'KSG') renderRegistrasi();   // perbarui nilai klaim KSG
  if (t.dataset.jasa && t.closest('.checks') && $('#r-nopol')) {
    const n = t.dataset.jasa;
    w.jasa = t.checked ? [...normJasa(w).filter(j => j.nama !== n), { nama: n, harga: +t.dataset.harga || 0 }] : normJasa(w).filter(j => j.nama !== n);
    renderRegistrasi();
  }
  if (t.id === 'r-status') { w.status = t.value; w._manual = true; }
  if (t.id === 'r-stnkSama') { w.stnkSama = t.checked; if (!t.checked && !w.namaStnk) w.namaStnk = w.nama; const n = $('#r-namaStnk'); n.disabled = t.checked; n.value = t.checked ? w.nama : w.namaStnk; if (!t.checked) n.focus(); }
  if (t.id === 'r-nopol' && !w.no) { t.value = t.value.trim().toUpperCase(); w.nopol = t.value; lookupKendaraan(w.nopol); }
});
