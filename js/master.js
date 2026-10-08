// Menu Master Data: pemilik & kendaraan, jasa servis, tarif KSG, mekanik (+PIN), rekening, tipe motor, petugas (+PIN).
import { $, esc, rp, stamp, toast, errMsg, waButton, waNumber, publicUrl } from './util.js';
import { loaderHTML, getBrand, resizeImage, saveLogo } from './brand.js';
import { S, st, views, refreshers, actions, inputHandlers, changeHandlers, fkeys, tipeList, isRole } from './state.js';
import { ROLES } from './config.js';
import { db, doc, getDoc, collection, getDocs, writeBatch, query, orderBy, limit, setDoc, updateDoc, addDoc, deleteDoc } from './firebase.js';
import { nopolKey } from './registrasi.js';
import { statusPill, rebuildPantau, syncLayar } from './wo-common.js';
import { wilayahHTML, fillWilayah, WIL_FIELDS } from './wilayah.js';
import { SUMBER, cfgPenghasilan, resetStaffGaji } from './penghasilan.js';
import { CABANG_UTAMA, cabangList, namaCabang, multiCabang, cabAktif, simpanCabang, layarDocId } from './cabang.js';
import { loadXLSX } from './import-excel.js';
import { loadLoginList, tambahPetugas, resetPin, ubahPetugas, hapusPetugas, validPin } from './akun.js';

const TABS = [
  ['kendaraan', 'Pemilik & Kendaraan', ['admin', 'registrasi']],
  ['jasa', 'Jasa Servis', ['admin']],
  ['ksg', 'Tarif KSG', ['admin']],
  ['mekanik', 'Mekanik', ['admin']],
  ['rekening', 'Rekening', ['admin']],
  ['tipe', 'Tipe Motor', ['admin']],
  ['petugas', 'Petugas & PIN', ['admin']],
  ['layar', 'Layar TV', ['admin']],
  ['cabang', 'Cabang', ['admin']],
  ['insentif', 'Insentif & Potongan', ['admin'], 'super'],
  ['logo', 'Logo', ['admin'], 'super']
];
const tabsFor = () => TABS.filter(t => isRole(...t[2]) && (t[3] !== 'super' || st.petugas?.super));
let kend = null, kendQ = '', kendEdit = null, logins = null;

// Hapus perlu diklik dua kali (dialog konfirmasi bawaan browser tidak dipakai)
let armed = null;
function confirmTwice(el, key, fn) {
  if (armed !== key) { armed = key; const t = el.textContent; el.textContent = 'Klik lagi'; setTimeout(() => { if (armed === key) { armed = null; el.textContent = t; } }, 3000); return; }
  armed = null; fn();
}
const saveSettings = patch => setDoc(doc(db, 'meta', 'settings'), patch, { merge: true });
const intro = t => `<p class="small muted" style="margin-block:12px 8px">${t}</p>`;

function renderMaster() {
  const tabs = tabsFor(); if (!tabs.find(t => t[0] === st.masterTab)) st.masterTab = tabs[0][0];
  $('#view').innerHTML = `<div class="panel"><div class="subtabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-act="ms-tab" data-t="${k}" aria-selected="${k === st.masterTab}">${l}</button>`).join('')}</div><div id="ms-body"></div></div>`;
  ({ kendaraan: renderKend, jasa: renderJasa, ksg: renderKsg, mekanik: renderMek, rekening: renderRek, tipe: renderTipe, petugas: renderStaff, layar: renderLayar, cabang: renderCabang, insentif: renderInsentif, logo: renderLogo })[st.masterTab]();
}

/* ---------- Pemilik & kendaraan ---------- */
// Kolom: [field, label, kelas, grup]  grup k = data konsumen (KTP), u = data kendaraan (STNK)
const KF = [['nik', 'NIK', 'num', 'k'], ['nama', 'Nama sesuai KTP', '', 'k'], ['tempatLahir', 'Tempat lahir', '', 'k'], ['tglLahir', 'Tanggal lahir', 'date', 'k'], ['jk', 'Jenis kelamin', '', 'k'], ['pekerjaan', 'Pekerjaan', '', 'k'], ['hp', 'No. HP', '', 'k'], ['rtrw', 'RT / RW', 'num', 'k'],
  ['nopol', 'No. Polisi', 'mono', 'u'], ['namaStnk', 'Nama di STNK', '', 'u'], ['tipe', 'Tipe motor', '', 'u'], ['tahun', 'Tahun', '', 'u'], ['warna', 'Warna', '', 'u'], ['noRangka', 'No. rangka', 'mono', 'u'], ['noMesin', 'No. mesin', 'mono', 'u'], ['km', 'KM terakhir', '', 'u']];
const KSAVE = [...KF.map(f => f[0]), ...WIL_FIELDS];
let fWil = { kab: '', kec: '', kel: '' };
async function loadKend() {
  try { const s = await getDocs(query(collection(db, 'kendaraan'), orderBy('updated', 'desc'), limit(1000))); kend = s.docs.map(d => ({ id: d.id, ...d.data() })); }
  catch (e) { kend = []; toast(errMsg(e)); }
  if (st.masterTab === 'kendaraan') renderKend();
  rapikanKend();
}
// Data kendaraan lama (sebelum v2.4) belum punya kolom pencarian nopolKey/hpNorm, sehingga tidak bisa dicari
// dengan sebagian no. HP di Registrasi. Dilengkapi otomatis sekali saat daftar ini dibuka.
let sudahRapi = false;
async function rapikanKend() {
  if (sudahRapi || !kend?.length) return; sudahRapi = true;
  const perlu = kend.map(k => {
    const patch = {};
    if (!k.nopolKey && k.nopol) patch.nopolKey = nopolKey(k.nopol);
    if (k.hpNorm === undefined && k.hp) patch.hpNorm = waNumber(k.hp);
    return [k, patch];
  }).filter(([, p]) => Object.keys(p).length);
  for (let i = 0; i < perlu.length; i += 400) {
    const b = writeBatch(db);
    perlu.slice(i, i + 400).forEach(([k, p]) => { b.set(doc(db, 'kendaraan', k.id), p, { merge: true }); Object.assign(k, p); });
    try { await b.commit(); } catch (e) { console.warn('Rapikan data kendaraan', e); return; }
  }
}
const uniq = a => [...new Set(a.filter(Boolean))].sort((x, y) => x.localeCompare(y));
function kendFiltered() {
  const q = kendQ.toLowerCase();
  return kend.filter(k => (!q || [k.nopol, k.nama, k.namaStnk, k.nik, k.hp, k.tipe, k.noRangka, k.noMesin, k.alamat, k.kelurahan, k.kecamatan].join(' ').toLowerCase().includes(q))
    && (!fWil.kab || k.kabupaten === fWil.kab) && (!fWil.kec || k.kecamatan === fWil.kec) && (!fWil.kel || k.kelurahan === fWil.kel));
}
function renderKend() {
  const el = $('#ms-body'); if (!el) return;
  if (!kend) { el.innerHTML = loaderHTML('Memuat data kendaraan…'); loadKend(); return; }
  const list = kendFiltered();
  const kabs = uniq(kend.map(k => k.kabupaten));
  const kecs = uniq(kend.filter(k => !fWil.kab || k.kabupaten === fWil.kab).map(k => k.kecamatan));
  const kels = uniq(kend.filter(k => (!fWil.kab || k.kabupaten === fWil.kab) && (!fWil.kec || k.kecamatan === fWil.kec)).map(k => k.kelurahan));
  // Rekap jumlah konsumen per wilayah satu tingkat di bawah filter yang dipilih
  const lvl = fWil.kec ? ['kelurahan', 'kel', 'Kelurahan / gampong'] : fWil.kab ? ['kecamatan', 'kec', 'Kecamatan'] : ['kabupaten', 'kab', 'Kabupaten / kota'];
  const rekap = {}; list.forEach(k => { const v = k[lvl[0]] || '(belum diisi)'; rekap[v] = (rekap[v] || 0) + 1; });
  const rk = Object.entries(rekap).sort((a, b) => b[1] - a[1]), mx = rk.length ? rk[0][1] : 1;
  const sel = (id, v, list, ph) => `<select id="${id}" style="width:auto;max-width:100%" aria-label="${ph}"><option value="">${ph}</option>${list.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select>`;
  el.innerHTML = `<div class="row spread" style="margin-top:12px"><input id="ms-kq" placeholder="Cari nopol, nama, NIK, HP, rangka, mesin, alamat" value="${esc(kendQ)}" style="flex:1 1 240px" aria-label="Cari kendaraan"><div class="row">${isRole('admin') ? '<button class="btn" type="button" data-act="ms-pantau" title="Bangun ulang data halaman cek servis konsumen dari servis yang sudah ada">Sinkron cek servis</button>' : ''}<button class="btn" type="button" data-act="ms-kxlsx">Export Excel</button><button class="btn pri" type="button" data-act="ms-kadd">+ Kendaraan [F1]</button></div></div>
   <div class="row" style="margin-top:8px"><span class="small muted">Filter wilayah:</span>${sel('fw-kab', fWil.kab, kabs, 'Semua kabupaten/kota')}${sel('fw-kec', fWil.kec, kecs, 'Semua kecamatan')}${sel('fw-kel', fWil.kel, kels, 'Semua kelurahan/gampong')}${fWil.kab || fWil.kec || fWil.kel ? '<button class="btn sm ghost" type="button" data-act="fw-clear">Hapus filter</button>' : ''}</div>
   <div id="ms-kform"></div>
   ${rk.length > 1 || (rk.length === 1 && !fWil.kel) ? `<div class="panel" style="box-shadow:none;margin-block:10px"><h3>Konsumen per ${lvl[2].toLowerCase()}</h3>${rk.slice(0, 12).map(([w, c]) => `<button class="bar-row" type="button" data-act="fw-pick" data-l="${lvl[1]}" data-v="${esc(w)}"><span class="row spread small"><span class="bar-lbl">${esc(w)}</span><span class="num">${c} kendaraan</span></span><span class="bar-track"><span class="bar-fill" style="display:block;width:${c / mx * 100}%"></span></span></button>`).join('')}</div>` : ''}
   <div class="tw"><table><thead><tr><th>Nopol</th><th>Konsumen</th><th>No. HP</th><th>Motor</th><th>Wilayah</th><th>Servis terakhir</th></tr></thead><tbody>${list.slice(0, 200).map(k => `<tr class="row-click" tabindex="0" data-act="ms-kedit" data-id="${esc(k.id)}"><td class="mono">${esc(k.nopol)}</td><td>${esc(k.nama || '–')}${k.namaStnk && k.namaStnk !== k.nama ? `<br><span class="small muted">STNK: ${esc(k.namaStnk)}</span>` : ''}</td><td class="mono small">${esc(k.hp || '')} ${waButton(k.hp, 'Halo ' + (k.nama || '') + ', ')}</td><td>${esc(k.tipe || '')}${k.tahun ? ' · ' + esc(k.tahun) : ''}${k.warna ? ' · ' + esc(k.warna) : ''}</td><td class="small">${esc([k.kelurahan, k.kecamatan, k.kabupaten].filter(Boolean).join(', ') || k.alamat || '–')}</td><td class="small">${esc((k.updated || '').slice(0, 10))}${k.woTerakhir ? ' · ' + esc(k.woTerakhir) : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">Tidak ada kendaraan yang cocok. Kendaraan otomatis tercatat saat registrasi servis.</td></tr>'}</tbody></table></div>
   <p class="small muted" style="margin:0">${list.length} kendaraan${list.length > 200 ? ' (ditampilkan 200, persempit pencarian)' : ''}.</p>`;
  renderKForm();
}
function renderKForm() {
  const el = $('#ms-kform'); if (!el) return;
  if (!kendEdit) { el.innerHTML = ''; return; }
  const k = kendEdit, isNew = !k.id;
  const riwayat = isNew ? [] : [...S.wo].reverse().filter(w => nopolKey(w.nopol) === k.id).slice(0, 10);
  el.innerHTML = `<div class="panel" style="background:var(--panel-2);box-shadow:none;margin-block:12px"><h3>${isNew ? 'Kendaraan baru' : 'Ubah ' + esc(k.nopol)}</h3>
   ${[['k', 'Data konsumen (KTP)'], ['u', 'Data kendaraan (STNK)']].map(([g, judul]) => `<h3>${judul}</h3><div class="form">${KF.filter(x => x[3] === g).map(([f, l, c]) => f === 'jk'
      ? `<label class="f" for="mk-jk">${l}<select id="mk-jk" data-kf="jk"><option value="">–</option>${['LAKI-LAKI', 'PEREMPUAN'].map(x => `<option ${x === k.jk ? 'selected' : ''}>${x}</option>`).join('')}</select></label>`
      : `<label class="f" for="mk-${f}">${l}<input id="mk-${f}" data-kf="${f}" ${c === 'mono' ? 'class="mono"' : c === 'num' ? 'class="num" inputmode="numeric"' : ''} ${c === 'date' ? 'type="date"' : ''} value="${esc(k[f] || '')}" ${f === 'nopol' && !isNew ? 'disabled' : ''} ${f === 'tipe' ? 'list="dl-tipe"' : ''} ${f === 'km' ? 'data-num' : ''}></label>`).join('')}</div>${g === 'k' ? `<div class="form form-wil">${wilayahHTML('mw', k)}</div>` : ''}`).join('')}<datalist id="dl-tipe">${tipeList().map(t => `<option value="${esc(t)}">`).join('')}</datalist>
   ${riwayat.length ? `<div class="small"><b>Riwayat servis:</b> ${riwayat.map(w => `${esc(w.no)} (${esc(w.tgl.slice(0, 10))}) ${statusPill(w.status)}`).join(' · ')}</div>` : ''}
   <div class="row" style="justify-content:flex-end">${!isNew && isRole('admin') ? '<button class="btn ghost" type="button" data-act="ms-kdel">Hapus</button>' : ''}<button class="btn" type="button" data-act="ms-kclose">Batal</button><button class="btn pri" type="button" data-act="ms-ksave">Simpan [F2]</button></div></div>`;
  fillWilayah('mw', { get: () => kendEdit });
}
async function saveKend() {
  const k = kendEdit; k.nopol = (k.nopol || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!k.nopol) { toast('Isi nomor polisi'); return; }
  const id = k.id || nopolKey(k.nopol);
  if (!k.id && kend.find(x => x.id === id)) { toast(k.nopol + ' sudah terdaftar'); return; }
  try {
    const data = Object.fromEntries(KSAVE.map(f => [f, (k[f] || '').toString().trim()]));
    if (data.nik && !/^\d{16}$/.test(data.nik)) { toast('NIK harus 16 angka'); return; }
    data.noRangka = data.noRangka.replace(/\s+/g, ''); data.noMesin = data.noMesin.replace(/\s+/g, '');
    await setDoc(doc(db, 'kendaraan', id), { ...data, nopolKey: id, hpNorm: waNumber(data.hp), updated: stamp(new Date()) }, { merge: true });
    toast('Kendaraan ' + k.nopol + ' disimpan'); kendEdit = null; kend = null; renderKend();
  } catch (e) { toast(errMsg(e)); }
}
async function exportKend() {
  const list = kendFiltered(); if (!list.length) { toast('Tidak ada data untuk diexport'); return; }
  try {
    const X = await loadXLSX();
    const rows = list.map(k => ({ nopol: k.nopol, pemilik: k.nama || '', hp: k.hp || '', tipe: k.tipe || '', tahun: k.tahun || '', warna: k.warna || '', alamat: k.alamat || '', kelurahan: k.kelurahan || '', kecamatan: k.kecamatan || '', kabupaten_kota: k.kabupaten || '', provinsi: k.provinsi || '', servis_terakhir: (k.updated || '').slice(0, 10) }));
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rows), 'Konsumen');
    X.writeFile(wb, `konsumen-${[fWil.kab, fWil.kec, fWil.kel].filter(Boolean).join('-') || 'semua'}.xlsx`.replace(/\s+/g, '_'));
  } catch (e) { toast('Gagal export: ' + e.message); }
}

/* ---------- Jasa servis ---------- */
function renderJasa() {
  const list = [...S.jasa].sort((a, b) => (a.urut ?? 99) - (b.urut ?? 99) || a.nama.localeCompare(b.nama));
  $('#ms-body').innerHTML = intro('Ubah nama atau harga lalu klik Simpan pada barisnya. Jasa nonaktif tidak muncul di registrasi, tapi tetap tercatat di nota lama.') + `
   <div class="tw"><table><thead><tr><th>Nama jasa</th><th class="r">Harga (Rp)</th><th>Aktif</th><th></th></tr></thead><tbody>
   ${list.map(j => `<tr><td><input class="inline-input" id="js-n-${j.id}" value="${esc(j.nama)}" aria-label="Nama jasa"></td><td><input class="inline-input num" type="number" min="0" step="1000" id="js-h-${j.id}" value="${j.harga}" style="text-align:right;width:120px" aria-label="Harga"></td><td><input type="checkbox" id="js-a-${j.id}" style="width:auto" ${j.aktif !== false ? 'checked' : ''} aria-label="Aktif"></td><td class="r" style="white-space:nowrap"><button class="btn sm" type="button" data-act="js-save" data-id="${j.id}">Simpan</button> <button class="btn sm ghost" type="button" data-act="js-del" data-id="${j.id}">Hapus</button></td></tr>`).join('')}
   <tr><td><input class="inline-input" id="js-n-new" placeholder="Jasa baru, mis. Servis Injeksi" aria-label="Nama jasa baru"></td><td><input class="inline-input num" type="number" min="0" step="1000" id="js-h-new" placeholder="0" style="text-align:right;width:120px" aria-label="Harga jasa baru"></td><td></td><td class="r"><button class="btn sm pri" type="button" data-act="js-add">Tambah</button></td></tr>
   </tbody></table></div>`;
}

/* ---------- Tarif KSG (dari main dealer) ---------- */
function renderKsg() {
  const tarif = S.settings.ksgTarif || {};
  $('#ms-body').innerHTML = intro('Tarif klaim jasa KSG dari main dealer, per tipe motor dan KSG ke-1 s.d. 4. Nilai ini yang tercatat sebagai klaim KSG di laporan dan nilai jasa mekanik. Kosongkan bila tipe tersebut tidak punya KSG.') + `
   <div class="tw"><table><thead><tr><th>Tipe motor</th>${[1, 2, 3, 4].map(n => `<th class="r">KSG ${n}</th>`).join('')}</tr></thead><tbody>
   ${tipeList().map((t, i) => `<tr><td>${esc(t)}</td>${[0, 1, 2, 3].map(k => `<td class="r"><input class="inline-input num" type="number" min="0" step="500" id="kt-${i}-${k}" value="${tarif[t]?.[k] || ''}" placeholder="0" style="text-align:right;width:100px" aria-label="${esc(t)} KSG ${k + 1}"></td>`).join('')}</tr>`).join('')}
   </tbody></table></div>
   <div class="row" style="justify-content:space-between;margin-top:8px"><span class="small muted">Tipe motor diatur di tab Tipe Motor.</span><button class="btn pri" type="button" data-act="kt-save">Simpan tarif KSG [F2]</button></div>`;
}
async function saveKsg() {
  const tarif = {};
  tipeList().forEach((t, i) => { const v = [0, 1, 2, 3].map(k => +$(`#kt-${i}-${k}`).value || 0); if (v.some(Boolean)) tarif[t] = v; });
  try { await saveSettings({ ksgTarif: tarif }); toast('Tarif KSG disimpan untuk ' + Object.keys(tarif).length + ' tipe motor'); } catch (e) { toast(errMsg(e)); }
}

/* ---------- Mekanik (+ login PIN) ---------- */
function renderMek() {
  const list = [...S.mekanik].sort((a, b) => a.nama.localeCompare(b.nama));
  const row = (m, id) => `<tr><td><input class="inline-input" id="mm-n-${id}" value="${esc(m.nama || '')}" placeholder="Nama mekanik" aria-label="Nama"></td><td><input class="inline-input num" type="number" min="0" step="50000" id="mm-g-${id}" value="${m.gaji ?? ''}" placeholder="0" style="text-align:right;width:120px" aria-label="Gaji pokok"></td><td><input class="inline-input num" type="number" min="0" max="100" step="0.5" data-raw id="mm-k-${id}" value="${m.komisi ?? ''}" placeholder="0" style="text-align:right;width:70px" aria-label="Komisi persen"></td>
    <td>${id === 'new' ? `<input class="inline-input num" id="mm-p-new" inputmode="numeric" maxlength="6" placeholder="PIN 6 angka" style="width:110px" aria-label="PIN login">` : m.loginId ? `<span class="pill p-good">Aktif</span> <button class="btn sm ghost" type="button" data-act="mm-pin" data-id="${id}">Reset PIN</button>` : `<button class="btn sm" type="button" data-act="mm-pin" data-id="${id}">Buat PIN</button>`}</td>
    <td>${id === 'new' ? '' : `<input type="checkbox" id="mm-a-${id}" style="width:auto" ${m.aktif !== false ? 'checked' : ''} aria-label="Aktif">`}</td>
    <td class="r" style="white-space:nowrap">${id === 'new' ? '<button class="btn sm pri" type="button" data-act="mm-add">Tambah</button>' : `<button class="btn sm" type="button" data-act="mm-save" data-id="${id}">Simpan</button> <button class="btn sm ghost" type="button" data-act="mm-del" data-id="${id}">Hapus</button>`}</td></tr>`;
  $('#ms-body').innerHTML = (multiCabang() ? `<p class="note small" style="margin:12px 0 0">Mekanik cabang <b>${esc(namaCabang(cabAktif()))}</b>. Untuk cabang lain, pindah cabang di kanan atas.</p>` : '') + intro('Mekanik login dengan memilih namanya lalu memasukkan PIN, untuk melihat performa dan gajinya. Estimasi gaji = gaji pokok + komisi % × nilai jasa (klaim KSG memakai tarif main dealer).') + `
   <div class="tw"><table><thead><tr><th>Nama</th><th class="r">Gaji pokok / bulan</th><th class="r">Komisi %</th><th>Login PIN</th><th>Aktif</th><th></th></tr></thead><tbody>${list.map(m => row(m, m.id)).join('')}${row({}, 'new')}</tbody></table></div>`;
}
function askPin(title, onOk) {
  // Isian PIN kecil di bawah tabel (tanpa dialog browser)
  const box = document.createElement('div');
  box.className = 'note'; box.style.marginTop = '10px';
  box.innerHTML = `<div class="row"><b>${esc(title)}</b><input id="pin-new" class="inline-input num" inputmode="numeric" maxlength="6" placeholder="PIN 6 angka" style="width:120px" aria-label="PIN baru"><button class="btn sm pri" type="button" id="pin-ok">Simpan PIN</button><button class="btn sm" type="button" id="pin-cancel">Batal</button></div><p class="small muted" style="margin:6px 0 0">Beritahukan PIN ini ke petugasnya. Petugas bisa menggantinya sendiri lewat tombol Ganti PIN.</p>`;
  $('#pin-box')?.remove(); box.id = 'pin-box'; $('#ms-body').appendChild(box); $('#pin-new').focus();
  $('#pin-cancel').onclick = () => box.remove();
  $('#pin-ok').onclick = async () => { const p = $('#pin-new').value.trim(); if (!validPin(p)) { toast('PIN harus 6 angka'); return; } $('#pin-ok').disabled = true; try { await onOk(p); box.remove(); } catch (e) { toast(pinErr(e)); $('#pin-ok').disabled = false; } };
}
const pinErr = e => e.code === 'auth/operation-not-allowed' ? 'Aktifkan login Email/Password di Firebase Console → Authentication' : e.code === 'auth/weak-password' ? 'PIN harus 6 angka' : errMsg(e);
async function mekPin(id) {
  const m = S.mekanik.find(x => x.id === id); if (!m) return;
  askPin((m.loginId ? 'PIN baru untuk ' : 'Buat PIN untuk ') + m.nama, async pin => {
    if (m.loginId) await resetPin(m.loginId, pin);
    else { const { id: loginId } = await tambahPetugas({ nama: m.nama, peran: 'mekanik', pin, mekanikId: m.id, cabang: m.cabang || CABANG_UTAMA }); await updateDoc(doc(db, 'mekanik', m.id), { loginId }); }
    toast('PIN ' + m.nama + ' disimpan'); logins = null;
  });
}

/* ---------- Rekening ---------- */
function renderRek() {
  const list = S.settings.rekening || [];
  const row = (r, i) => `<tr><td><input class="inline-input" id="rk-b-${i}" value="${esc(r.bank || '')}" placeholder="mis. BSI" aria-label="Bank"></td><td><input class="inline-input mono" id="rk-n-${i}" value="${esc(r.noRek || '')}" placeholder="No. rekening" aria-label="No rekening"></td><td><input class="inline-input" id="rk-a-${i}" value="${esc(r.atasNama || '')}" placeholder="Atas nama" aria-label="Atas nama"></td><td>${i === 'new' ? '' : `<input type="checkbox" id="rk-x-${i}" style="width:auto" ${r.aktif !== false ? 'checked' : ''} aria-label="Aktif">`}</td><td class="r" style="white-space:nowrap">${i === 'new' ? '<button class="btn sm pri" type="button" data-act="rk-add">Tambah</button>' : `<button class="btn sm" type="button" data-act="rk-save" data-i="${i}">Simpan</button> <button class="btn sm ghost" type="button" data-act="rk-del" data-i="${i}">Hapus</button>`}</td></tr>`;
  $('#ms-body').innerHTML = intro('Rekening tujuan transfer. Kasir memilih rekening saat konsumen membayar transfer; laporan menampilkan total per rekening.') + `
   <div class="tw"><table><thead><tr><th>Bank</th><th>No. rekening</th><th>Atas nama</th><th>Aktif</th><th></th></tr></thead><tbody>${list.map(row).join('')}${row({}, 'new')}</tbody></table></div>`;
}
const rekData = i => ({ bank: $('#rk-b-' + i).value.trim(), noRek: $('#rk-n-' + i).value.trim(), atasNama: $('#rk-a-' + i).value.trim() });

/* ---------- Tipe motor ---------- */
function renderTipe() {
  $('#ms-body').innerHTML = intro('Satu tipe per baris. Urutan di sini menjadi urutan pilihan di registrasi dan tabel tarif KSG.') + `
   <textarea id="tp-list" rows="14" aria-label="Daftar tipe motor">${esc(tipeList().join('\n'))}</textarea>
   <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn pri" type="button" data-act="tp-save">Simpan tipe motor [F2]</button></div>`;
}

/* ---------- Petugas & PIN ---------- */
async function loadLogins() {
  try { logins = await loadLoginList(); } catch (e) { logins = []; toast(errMsg(e)); }
  if (st.masterTab === 'petugas') renderStaff();
}
const ROLE_NON_MEK = Object.entries(ROLES).filter(([k]) => k !== 'mekanik');
function renderStaff() {
  const el = $('#ms-body');
  if (!logins) { el.innerHTML = loaderHTML('Memuat petugas…'); loadLogins(); return; }
  const multi = multiCabang();
  const cabSel = (id, v) => `<select class="inline-input" id="${id}" style="width:auto" aria-label="Cabang">${cabangList().map(c => `<option value="${esc(c.id)}" ${c.id === (v || CABANG_UTAMA) ? 'selected' : ''}>${esc(c.nama)}</option>`).join('')}</select>`;
  const roleSel = (id, v) => `<select class="inline-input" id="${id}" style="width:auto" aria-label="Peran">${ROLE_NON_MEK.map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  el.innerHTML = intro('Petugas masuk dengan memilih nama lalu PIN 6 angka, dan bisa mengganti PIN sendiri. Peran menentukan menu: Registrasi (motor masuk), Sparepart (order part &amp; pembelian), Kasir (pembayaran, status mekanik, penjualan), Admin (semua). Login mekanik diatur di tab Mekanik.') + `
   <div class="tw"><table><thead><tr><th>Nama</th><th>Peran</th>${multi ? '<th>Cabang</th>' : ''}<th></th></tr></thead><tbody>
   ${logins.map((s, i) => s.peran === 'mekanik'
      ? `<tr><td>${esc(s.nama)}</td><td><span class="small muted">Mekanik (atur di tab Mekanik)</span></td>${multi ? `<td class="small">${esc(namaCabang(s.cabang))}</td>` : ''}<td class="r"><button class="btn sm ghost" type="button" data-act="sf-pin" data-i="${i}">Reset PIN</button></td></tr>`
      : `<tr><td><input class="inline-input" id="sf-n-${i}" value="${esc(s.nama)}" aria-label="Nama"></td><td>${roleSel('sf-r-' + i, s.peran)}</td>${multi ? `<td>${cabSel('sf-c-' + i, s.cabang)}</td>` : ''}<td class="r" style="white-space:nowrap"><button class="btn sm" type="button" data-act="sf-save" data-i="${i}">Simpan</button> <button class="btn sm ghost" type="button" data-act="sf-pin" data-i="${i}">Reset PIN</button> <button class="btn sm ghost" type="button" data-act="sf-del" data-i="${i}">Hapus</button></td></tr>`).join('') || '<tr><td colspan="3" class="empty">Belum ada petugas.</td></tr>'}
   </tbody></table></div>
   <div class="panel" style="background:var(--panel-2);box-shadow:none;margin-top:12px"><h3>Tambah petugas</h3>
    <div class="form"><label class="f" for="sf-nama">Nama<input id="sf-nama" autocomplete="off"></label><label class="f" for="sf-peran">Peran${roleSel('sf-peran', 'kasir')}</label>${multi ? `<label class="f" for="sf-cabang">Cabang${cabSel('sf-cabang', cabAktif())}</label>` : ''}<label class="f" for="sf-pin">PIN awal (6 angka)<input id="sf-pin" class="num" inputmode="numeric" maxlength="6" autocomplete="off"></label></div>
    <div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-act="sf-add">Tambah petugas</button></div></div>
   <p class="small muted" style="margin:8px 0 0">Super admin (cashflow.amu@gmail.com) masuk dengan email dan kata sandi lewat tombol "Masuk sebagai super admin".</p>`;
}

/* ---------- Logo (hanya super admin) ---------- */
let logoDraft = null;
function renderLogo() {
  const cur = logoDraft ?? getBrand().logo;
  $('#ms-body').innerHTML = intro('Logo tampil di sisi kiri halaman login dan di atas menu samping. Gunakan PNG berlatar transparan atau putih; gambar otomatis diperkecil.') + `
   <div class="row" style="align-items:flex-start;gap:20px">
    <div class="auth-logo" style="width:160px;box-shadow:none;border:1px solid var(--line)">${cur ? `<img src="${cur}" alt="Pratinjau logo">` : '<span class="brand-ph">AMU</span>'}</div>
    <div style="display:flex;flex-direction:column;gap:10px;flex:1 1 220px">
     <label class="f" for="lg-file">Pilih gambar logo<input id="lg-file" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label>
     <div class="row"><button class="btn pri" type="button" data-act="lg-save" ${logoDraft == null ? 'disabled' : ''}>Simpan logo</button>${getBrand().logo ? '<button class="btn ghost" type="button" data-act="lg-del">Hapus logo</button>' : ''}${logoDraft != null ? '<button class="btn" type="button" data-act="lg-cancel">Batal</button>' : ''}</div>
     ${logoDraft != null ? '<p class="small muted" style="margin:0">Pratinjau. Klik Simpan logo untuk memasang.</p>' : ''}
    </div>
   </div>`;
}

// Layar TV ruang tunggu: teks berjalan + petunjuk pemasangan
async function renderLayar() {
  const cab = cabAktif(), url = publicUrl('layar', cab === CABANG_UTAMA ? {} : { c: cab });
  $('#ms-body').innerHTML = loaderHTML('Memuat pengaturan layar…');
  let info = '';
  try { const s = await getDoc(doc(db, 'publik', layarDocId(cab))); info = (s.exists() && s.data().info) || ''; } catch (e) { /* tetap tampilkan form */ }
  if (st.masterTab !== 'layar') return;
  $('#ms-body').innerHTML = (multiCabang() ? `<p class="note small" style="margin:12px 0 0">Layar TV cabang <b>${esc(namaCabang(cab))}</b>. Setiap cabang punya alamat layar sendiri.</p>` : '') + intro('Layar untuk konsumen di ruang tunggu: nomor antrian yang dipanggil, motor yang sedang dikerjakan, yang menunggu, dan yang siap diambil. Tidak menampilkan nama, no. HP, maupun biaya. Tidak perlu login.') + `
   <div class="form" style="grid-template-columns:minmax(0,1fr)">
    <label class="f" for="ly-info">Teks berjalan di bawah layar (jam buka, promo, info KSG, dll.)<textarea id="ly-info" rows="3" data-nocaps placeholder="Buka Senin–Sabtu 08.00–17.00 · Ganti oli gratis cek rem · Bawa buku KSG Anda">${esc(info)}</textarea></label>
   </div>
   <div class="row"><button class="btn pri" type="button" data-act="ly-save">Simpan teks</button><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Buka layar TV</a><button class="btn ghost" type="button" data-act="ly-sync">Perbarui isi layar sekarang</button></div>
   <h3>Cara memasang di TV</h3>
   <ol class="small" style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:4px">
    <li>Buka alamat ini di browser TV (Smart TV, Android TV box, atau laptop yang tersambung HDMI): <span class="mono">${esc(url)}</span></li>
    <li>Klik layar sekali untuk mengaktifkan suara panggilan dan layar penuh (aturan browser: suara baru boleh bunyi setelah ada klik).</li>
    <li>Nomor dipanggil otomatis saat kasir menandai motor <b>Selesai</b>. Di menu Pembayaran ada tombol <b>Panggil ulang di layar</b>.</li>
    <li>Suara memakai pembaca teks Bahasa Indonesia bawaan perangkat. Bila perangkat tidak punya, yang terdengar hanya bunyi bel.</li>
   </ol>`;
}

/* ---------- Cabang ----------
   Kode cabang (2–4 huruf/angka) dipakai di nomor dokumen dan tidak bisa diubah. Cabang tidak dihapus,
   cukup dinonaktifkan, supaya data lamanya tetap terbaca. */
function renderCabang() {
  const list = cabangList(true);
  const row = (c, i) => `<tr><td class="mono">${esc(c.id)}${c.id === CABANG_UTAMA ? '<div class="small muted">utama</div>' : ''}</td>
    <td><input class="inline-input" id="cb-n-${i}" value="${esc(c.nama)}" aria-label="Nama cabang"></td>
    <td><input class="inline-input" id="cb-a-${i}" value="${esc(c.alamat || '')}" placeholder="Alamat untuk nota" aria-label="Alamat"></td>
    <td><input class="inline-input" id="cb-t-${i}" value="${esc(c.telp || '')}" inputmode="tel" placeholder="No. telp/WA" aria-label="Telepon" style="width:140px"></td>
    <td>${c.id === CABANG_UTAMA ? '<span class="small muted">selalu aktif</span>' : `<input type="checkbox" id="cb-x-${i}" style="width:auto" ${c.aktif !== false ? 'checked' : ''} aria-label="Aktif">`}</td></tr>`;
  $('#ms-body').innerHTML = intro('Setiap cabang punya stok, nomor nota/WO/antrian, mekanik, petugas, dan layar TV sendiri. Master part &amp; harga, jasa, tarif KSG, tipe motor, rekening, dan data konsumen dipakai bersama. Alamat & telepon cabang tercetak di nota.') + `
   <div class="tw"><table><thead><tr><th>Kode</th><th>Nama cabang</th><th>Alamat</th><th>Telp / WA</th><th>Aktif</th></tr></thead><tbody>${list.map(row).join('')}</tbody></table></div>
   <div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-act="cb-save">Simpan perubahan</button></div>
   <div class="panel" style="background:var(--panel-2);box-shadow:none"><h3>Tambah cabang</h3>
    <div class="form"><label class="f" for="cb-kode">Kode (2–4 huruf, mis. LSK)<input id="cb-kode" maxlength="4" autocomplete="off" class="mono"></label><label class="f wide-2" for="cb-nama">Nama cabang<input id="cb-nama" placeholder="mis. LHOKSEUMAWE" autocomplete="off"></label><label class="f wide-2" for="cb-alamat">Alamat<input id="cb-alamat" autocomplete="off"></label><label class="f" for="cb-telp">Telp / WA<input id="cb-telp" inputmode="tel" autocomplete="off"></label></div>
    <div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-act="cb-add">Tambah cabang</button></div>
    <p class="small muted" style="margin:0">Setelah ditambah: pindah ke cabang baru di kanan atas, lalu isi mekaniknya (tab Mekanik), tambahkan petugas dengan cabang tersebut (tab Petugas &amp; PIN), dan kirim stok awal lewat <b>Stok Part → Transfer stok</b> atau Pembelian Stok.</p></div>`;
}
const cabangDariForm = () => cabangList(true).map((c, i) => ({ ...c, nama: ($('#cb-n-' + i)?.value || c.nama).trim().toUpperCase(), alamat: ($('#cb-a-' + i)?.value || '').trim(), telp: ($('#cb-t-' + i)?.value || '').trim(), aktif: c.id === CABANG_UTAMA ? true : !!$('#cb-x-' + i)?.checked }));

/* ---------- Insentif & potongan (hanya super admin) ----------
   Disimpan di meta/settings.penghasilan = { insentif: [{ id, nama, sumber, peran[], tingkat[{min, persen}], aktif }],
                                             potongan: [{ id, nama, jumlah, peran[], aktif }] }
   Gaji pokok: petugas di staff/{email}.gaji, mekanik di mekanik/{id}.gaji. */
let phDraft = null, phGaji = null;
const PERAN = Object.entries(ROLES);
const idBaru = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
function contohPh() {
  return { insentif: [
    { id: idBaru(), nama: 'INSENTIF SPAREPART', sumber: 'part', peran: ['kasir', 'sparepart'], tingkat: [{ min: 7000000, persen: 2 }], aktif: true },
    { id: idBaru(), nama: 'INSENTIF JASA SERVIS', sumber: 'jasa', peran: ['mekanik'], tingkat: [{ min: 7000000, persen: 2 }], aktif: true }],
    potongan: [{ id: idBaru(), nama: 'BPJS KESEHATAN', jumlah: 0, peran: PERAN.map(([k]) => k), aktif: true }], contoh: true };
}
const cekOrang = (pfx, sel) => phGaji?.length ? `<div class="small muted">Atau khusus karyawan tertentu — bila ada yang dicentang, item <b>hanya</b> berlaku untuk mereka:</div><div class="ph-orang">${phGaji.map((g, k) => `<label class="chk"><input type="checkbox" id="${pfx}-${k}" ${sel.includes(g.kunci) ? 'checked' : ''}>${esc(g.nama)} <span class="muted small">(${esc((ROLES[g.peran] || g.peran).split(' /')[0])})</span></label>`).join('')}</div>` : '';
const cekPeran = (pfx, sel) => `<div class="ph-peran">${PERAN.map(([k, l]) => `<label class="chk"><input type="checkbox" id="${pfx}-${k}" ${sel.includes(k) ? 'checked' : ''}>${esc(l.split(' /')[0])}</label>`).join('')}</div>`;
function kumpulPh() {
  if (!phDraft || !$('#ph-form')) return;
  phDraft.insentif = phDraft.insentif.map((it, i) => ({ ...it, nama: ($('#in-n-' + i)?.value || '').trim().toUpperCase(), sumber: $('#in-s-' + i)?.value || 'part', aktif: !!$('#in-a-' + i)?.checked,
    peran: PERAN.map(([k]) => k).filter(k => $(`#in-r-${i}-${k}`)?.checked), orang: (phGaji || []).filter((g, k) => $(`#in-o-${i}-${k}`)?.checked).map(g => g.kunci),
    tingkat: it.tingkat.map((t, j) => ({ min: +($('#tk-m-' + i + '-' + j)?.value || 0), persen: +String($('#tk-p-' + i + '-' + j)?.value || 0).replace(',', '.') })) }));
  phDraft.potongan = phDraft.potongan.map((it, i) => ({ ...it, nama: ($('#po-n-' + i)?.value || '').trim().toUpperCase(), jumlah: +($('#po-j-' + i)?.value || 0), aktif: !!$('#po-a-' + i)?.checked,
    peran: PERAN.map(([k]) => k).filter(k => $(`#po-r-${i}-${k}`)?.checked), orang: (phGaji || []).filter((g, k) => $(`#po-o-${i}-${k}`)?.checked).map(g => g.kunci) }));
}
async function renderInsentif() {
  if (!phGaji) { $('#ms-body').innerHTML = loaderHTML('Memuat karyawan…'); try { await muatGaji(); } catch (e) { phGaji = []; } if (st.masterTab !== 'insentif') return; }
  if (!phDraft) { const c = cfgPenghasilan(); phDraft = c.insentif.length || c.potongan.length ? JSON.parse(JSON.stringify({ insentif: c.insentif, potongan: c.potongan })) : contohPh(); }
  const d = phDraft;
  $('#ms-body').innerHTML = intro('Penghasilan karyawan per bulan = gaji pokok + insentif − potongan. Setiap item bisa berlaku per <b>peran</b> atau khusus <b>karyawan tertentu</b> (pola tiap orang boleh berbeda). Insentif dihitung dari <b>penjualan pribadi</b> (mekanik: servis yang dikerjakan; kasir/admin: nota yang dibayar di dia; registrasi: servis yang didaftarkan; sparepart: servis yang order part-nya dia input). Bila target tercapai, persen dikalikan <b>seluruh</b> penjualan; tingkat tertinggi yang tercapai yang dipakai. Karyawan melihat hasilnya di menu <b>Penghasilan</b>.') + `
   ${d.contoh ? '<div class="note small">Contoh awal (belum tersimpan). Ubah sesuai kebijakan, lalu tekan <b>Simpan aturan</b>.</div>' : ''}
   <div id="ph-form">
   <div class="row spread"><h3>Insentif penjualan</h3><button class="btn sm" type="button" data-act="in-add">+ Item insentif</button></div>
   ${d.insentif.map((it, i) => `<div class="ph-card">
     <div class="form"><label class="f wide-2" for="in-n-${i}">Nama insentif<input id="in-n-${i}" value="${esc(it.nama)}" placeholder="mis. INSENTIF SPAREPART"></label>
      <label class="f" for="in-s-${i}">Dihitung dari<select id="in-s-${i}">${Object.entries(SUMBER).map(([k, l]) => `<option value="${k}" ${k === it.sumber ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>
      <label class="chk" style="align-self:end"><input type="checkbox" id="in-a-${i}" ${it.aktif !== false ? 'checked' : ''}>Aktif</label></div>
     <div class="small muted">Berlaku untuk peran:</div>${cekPeran('in-r-' + i, it.peran || [])}${cekOrang('in-o-' + i, it.orang || [])}
     <div class="small muted">Tingkat target (bulanan):</div>
     <div class="ph-tingkat">${it.tingkat.map((t, j) => `<div class="row" style="gap:6px"><span class="small">Penjualan ≥ Rp</span><input id="tk-m-${i}-${j}" data-num value="${t.min || ''}" style="width:150px" aria-label="Target"><span class="small">→</span><input id="tk-p-${i}-${j}" type="number" data-raw step="0.1" min="0" value="${t.persen || ''}" style="width:80px" aria-label="Persen"><span class="small">%</span>${it.tingkat.length > 1 ? `<button class="btn sm ghost" type="button" data-act="tk-del" data-i="${i}" data-j="${j}" aria-label="Hapus tingkat">✕</button>` : ''}</div>`).join('')}</div>
     <div class="row spread"><button class="btn sm" type="button" data-act="tk-add" data-i="${i}">+ Tingkat</button><button class="btn sm ghost" type="button" data-act="in-del" data-i="${i}">Hapus item</button></div>
    </div>`).join('') || '<div class="small muted">Belum ada item insentif.</div>'}
   <div class="row spread"><h3>Potongan</h3><button class="btn sm" type="button" data-act="po-add">+ Item potongan</button></div>
   ${d.potongan.map((it, i) => `<div class="ph-card">
     <div class="form"><label class="f wide-2" for="po-n-${i}">Nama potongan<input id="po-n-${i}" value="${esc(it.nama)}" placeholder="mis. BPJS KESEHATAN"></label>
      <label class="f" for="po-j-${i}">Jumlah per bulan (Rp)<input id="po-j-${i}" data-num value="${it.jumlah || ''}"></label>
      <label class="chk" style="align-self:end"><input type="checkbox" id="po-a-${i}" ${it.aktif !== false ? 'checked' : ''}>Aktif</label></div>
     <div class="small muted">Berlaku untuk peran:</div>${cekPeran('po-r-' + i, it.peran || [])}${cekOrang('po-o-' + i, it.orang || [])}
     <div class="row" style="justify-content:flex-end"><button class="btn sm ghost" type="button" data-act="po-del" data-i="${i}">Hapus item</button></div>
    </div>`).join('') || '<div class="small muted">Belum ada potongan.</div>'}
   <div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-act="ph-save">Simpan aturan</button></div>
   </div>
   <h3>Gaji pokok karyawan</h3><div id="ph-gaji">${loaderHTML('Memuat karyawan…')}</div>`;
  renderGaji();
}
async function muatGaji() {
  if (!phGaji) {
      const [login, sd] = await Promise.all([loadLoginList(), getDocs(collection(db, 'staff'))]);
      const gaji = {}; sd.docs.forEach(x => { const v = x.data(); if (v.loginId) gaji[v.loginId] = v.gaji || 0; });
    phGaji = [...login.filter(p => p.peran !== 'mekanik').map(p => ({ jenis: 'staff', email: p.email, kunci: p.id, nama: p.nama, peran: p.peran, cabang: p.cabang, gaji: gaji[p.id] || 0 })),
      ...(S.mekanikSemua.length ? S.mekanikSemua : S.mekanik).map(m => ({ jenis: 'mekanik', id: m.id, kunci: 'M:' + m.id, nama: m.nama, peran: 'mekanik', cabang: m.cabang, gaji: m.gaji || 0 }))].sort((a, b) => a.nama.localeCompare(b.nama));
  }
}
async function renderGaji() {
  try { await muatGaji(); } catch (e) { const el = $('#ph-gaji'); if (el) el.innerHTML = `<div class="err">${esc(errMsg(e))}</div>`; return; }
  const el = $('#ph-gaji'); if (!el) return;
  el.innerHTML = phGaji.length ? `<div class="tw"><table><thead><tr><th>Nama</th><th>Peran</th>${multiCabang() ? '<th>Cabang</th>' : ''}<th class="r">Gaji pokok / bulan (Rp)</th></tr></thead><tbody>${phGaji.map((g, i) => `<tr><td>${esc(g.nama)}</td><td class="small">${esc(ROLES[g.peran] || g.peran)}</td>${multiCabang() ? `<td class="small">${esc(namaCabang(g.cabang))}</td>` : ''}<td class="r"><input class="inline-input num" id="gj-${i}" data-num value="${g.gaji || ''}" style="width:150px;text-align:right" aria-label="Gaji pokok ${esc(g.nama)}"></td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-act="gj-save">Simpan gaji pokok</button></div>` : '<div class="small muted">Belum ada karyawan.</div>';
}

views.master = renderMaster;
refreshers.master = () => {};   // jangan timpa isian yang sedang diketik saat data berubah
fkeys.master = { baru: () => st.masterTab === 'kendaraan' ? 'ms-kadd' : null, simpan: () => st.masterTab === 'kendaraan' && kendEdit ? 'ms-ksave' : st.masterTab === 'tipe' ? 'tp-save' : st.masterTab === 'ksg' ? 'kt-save' : null };
Object.assign(actions, {
  'ly-save': async () => { try { await setDoc(doc(db, 'publik', layarDocId()), { info: ($('#ly-info')?.value || '').trim() }, { merge: true }); toast('Teks layar disimpan'); } catch (e) { toast(errMsg(e)); } },
  'ly-sync': async () => { await syncLayar(null, true); toast('Isi layar TV diperbarui'); },
  'cb-save': async () => { try { await simpanCabang(cabangDariForm()); toast('Data cabang disimpan'); } catch (e) { toast(errMsg(e)); } },
  'cb-add': async () => {
    const id = ($('#cb-kode').value || '').trim().toUpperCase(), nama = ($('#cb-nama').value || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{2,4}$/.test(id)) { toast('Kode cabang 2–4 huruf/angka, mis. LSK'); $('#cb-kode').focus(); return; }
    if (cabangList(true).some(c => c.id === id) || id === CABANG_UTAMA) { toast('Kode ' + id + ' sudah dipakai'); return; }
    if (!nama) { toast('Isi nama cabang'); $('#cb-nama').focus(); return; }
    try { await simpanCabang([...cabangDariForm(), { id, nama, alamat: ($('#cb-alamat').value || '').trim(), telp: ($('#cb-telp').value || '').trim(), aktif: true }]); toast('Cabang ' + nama + ' ditambahkan'); setTimeout(renderCabang, 100); } catch (e) { toast(errMsg(e)); }
  },
  'in-add': () => { kumpulPh(); phDraft.insentif.push({ id: idBaru(), nama: '', sumber: 'part', peran: [], tingkat: [{ min: 0, persen: 0 }], aktif: true }); renderInsentif(); },
  'in-del': el => { kumpulPh(); phDraft.insentif.splice(+el.dataset.i, 1); renderInsentif(); },
  'tk-add': el => { kumpulPh(); const it = phDraft.insentif[+el.dataset.i], last = it.tingkat[it.tingkat.length - 1] || { min: 0, persen: 0 }; it.tingkat.push({ min: (last.min || 0) + 3000000, persen: (last.persen || 0) + 1 }); renderInsentif(); },
  'tk-del': el => { kumpulPh(); phDraft.insentif[+el.dataset.i].tingkat.splice(+el.dataset.j, 1); renderInsentif(); },
  'po-add': () => { kumpulPh(); phDraft.potongan.push({ id: idBaru(), nama: '', jumlah: 0, peran: [], aktif: true }); renderInsentif(); },
  'po-del': el => { kumpulPh(); phDraft.potongan.splice(+el.dataset.i, 1); renderInsentif(); },
  'ph-save': async () => {
    kumpulPh();
    const salah = phDraft.insentif.find(i => !i.nama) ? 'Isi nama setiap item insentif' : phDraft.potongan.find(p => !p.nama) ? 'Isi nama setiap item potongan'
      : phDraft.insentif.find(i => !i.peran.length && !i.orang?.length) ? `Pilih peran atau karyawan untuk ${phDraft.insentif.find(i => !i.peran.length && !i.orang?.length).nama}` : phDraft.potongan.find(p => !p.peran.length && !p.orang?.length) ? `Pilih peran atau karyawan untuk ${phDraft.potongan.find(p => !p.peran.length && !p.orang?.length).nama}`
      : phDraft.insentif.find(i => !i.tingkat.some(t => t.persen > 0)) ? `Isi persen insentif ${phDraft.insentif.find(i => !i.tingkat.some(t => t.persen > 0)).nama}` : '';
    if (salah) { toast(salah); return; }
    const { contoh, ...simpan } = phDraft;
    try { await saveSettings({ penghasilan: simpan }); delete phDraft.contoh; toast('Aturan insentif & potongan disimpan'); renderInsentif(); } catch (e) { toast(errMsg(e)); }
  },
  'gj-save': async () => {
    try {
      const b = writeBatch(db);
      phGaji.forEach((g, i) => { const v = +($('#gj-' + i)?.value || 0); if (v === (g.gaji || 0)) return; g.gaji = v;
        if (g.jenis === 'staff') b.set(doc(db, 'staff', g.email), { gaji: v }, { merge: true }); else b.update(doc(db, 'mekanik', g.id), { gaji: v }); });
      await b.commit(); resetStaffGaji(); toast('Gaji pokok disimpan');
    } catch (e) { toast(errMsg(e)); }
  },
  'ms-tab': el => { phDraft = null; phGaji = null; st.masterTab = el.dataset.t; kendEdit = null; renderMaster(); },
  'ms-kadd': () => { kendEdit = { nopol: '' }; renderKForm(); $('#mk-nopol')?.focus(); },
  'ms-kedit': el => { const k = kend.find(x => x.id === el.dataset.id); if (k) { kendEdit = { ...k }; renderKForm(); $('#ms-kform').scrollIntoView({ block: 'nearest' }); } },
  'ms-kclose': () => { kendEdit = null; renderKForm(); },
  'ms-ksave': saveKend,
  'ms-kxlsx': exportKend,
  'ms-pantau': async el => {
    if (el.disabled) return; el.disabled = true; const t = el.textContent;
    try { const n = await rebuildPantau((i, tot) => { el.textContent = `Sinkron ${i}/${tot}…`; }); toast(n ? `Data cek servis ${n} kendaraan diperbarui` : 'Tidak ada servis dengan nomor HP valid untuk disinkronkan'); }
    catch (e) { toast(e.code === 'permission-denied' ? 'Ditolak: publish ulang firestore.rules (versi 2.3.0) di Firebase Console' : errMsg(e)); }
    finally { el.disabled = false; el.textContent = t; }
  },
  'fw-clear': () => { fWil = { kab: '', kec: '', kel: '' }; renderKend(); },
  'fw-pick': el => { const l = el.dataset.l, v = el.dataset.v === '(belum diisi)' ? '' : el.dataset.v; if (!v) return; fWil[l] = v; if (l === 'kab') { fWil.kec = fWil.kel = ''; } if (l === 'kec') fWil.kel = ''; renderKend(); },
  'ms-kdel': el => confirmTwice(el, 'k' + kendEdit.id, async () => { try { await deleteDoc(doc(db, 'kendaraan', kendEdit.id)); toast('Kendaraan dihapus'); kendEdit = null; kend = null; renderKend(); } catch (e) { toast(errMsg(e)); } }),
  'js-save': async el => { const id = el.dataset.id, nama = $('#js-n-' + id).value.trim(); if (!nama) { toast('Nama jasa wajib diisi'); return; } try { await updateDoc(doc(db, 'jasa', id), { nama, harga: +$('#js-h-' + id).value || 0, aktif: $('#js-a-' + id).checked }); toast('Jasa ' + nama + ' disimpan'); } catch (e) { toast(errMsg(e)); } },
  'js-add': async () => { const nama = $('#js-n-new').value.trim(); if (!nama) { toast('Isi nama jasa'); return; } try { await addDoc(collection(db, 'jasa'), { nama, harga: +$('#js-h-new').value || 0, aktif: true, urut: S.jasa.length }); toast('Jasa ' + nama + ' ditambahkan'); renderJasa(); } catch (e) { toast(errMsg(e)); } },
  'js-del': el => confirmTwice(el, 'j' + el.dataset.id, async () => { try { await deleteDoc(doc(db, 'jasa', el.dataset.id)); toast('Jasa dihapus'); renderJasa(); } catch (e) { toast(errMsg(e)); } }),
  'kt-save': saveKsg,
  'mm-save': async el => { const id = el.dataset.id, nama = $('#mm-n-' + id).value.trim(); if (!nama) { toast('Nama mekanik wajib diisi'); return; } const m = S.mekanik.find(x => x.id === id); try { await updateDoc(doc(db, 'mekanik', id), { nama, gaji: +$('#mm-g-' + id).value || 0, komisi: +$('#mm-k-' + id).value || 0, aktif: $('#mm-a-' + id).checked }); if (m?.loginId && m.nama !== nama) await ubahPetugas(m.loginId, { nama }); toast('Mekanik ' + nama + ' disimpan'); } catch (e) { toast(errMsg(e)); } },
  'mm-add': async () => {
    const nama = $('#mm-n-new').value.trim(), pin = $('#mm-p-new').value.trim(); if (!nama) { toast('Isi nama mekanik'); return; }
    if (pin && !validPin(pin)) { toast('PIN harus 6 angka (atau kosongkan dulu)'); return; }
    try {
      const ref = await addDoc(collection(db, 'mekanik'), { nama, cabang: cabAktif(), gaji: +$('#mm-g-new').value || 0, komisi: +$('#mm-k-new').value || 0, aktif: true });
      if (pin) { const { id: loginId } = await tambahPetugas({ nama, peran: 'mekanik', pin, mekanikId: ref.id, cabang: cabAktif() }); await updateDoc(ref, { loginId }); }
      toast('Mekanik ' + nama + ' ditambahkan' + (pin ? ' dengan PIN' : '')); logins = null; renderMek();
    } catch (e) { toast(pinErr(e)); }
  },
  'mm-pin': el => mekPin(el.dataset.id),
  'mm-del': el => confirmTwice(el, 'm' + el.dataset.id, async () => { const m = S.mekanik.find(x => x.id === el.dataset.id); try { if (m?.loginId) await hapusPetugas(m.loginId); await deleteDoc(doc(db, 'mekanik', el.dataset.id)); toast('Mekanik dihapus (riwayat servis lama tetap tersimpan)'); logins = null; renderMek(); } catch (e) { toast(errMsg(e)); } }),
  'rk-add': async () => { const r = rekData('new'); if (!r.bank || !r.noRek) { toast('Isi bank dan nomor rekening'); return; } try { await saveSettings({ rekening: [...(S.settings.rekening || []), { id: Date.now().toString(36), ...r, aktif: true }] }); toast('Rekening ' + r.bank + ' ditambahkan'); setTimeout(renderRek, 50); } catch (e) { toast(errMsg(e)); } },
  'rk-save': async el => { const i = +el.dataset.i, list = [...(S.settings.rekening || [])]; list[i] = { ...list[i], ...rekData(i), aktif: $('#rk-x-' + i).checked }; try { await saveSettings({ rekening: list }); toast('Rekening disimpan'); } catch (e) { toast(errMsg(e)); } },
  'rk-del': el => confirmTwice(el, 'r' + el.dataset.i, async () => { const list = (S.settings.rekening || []).filter((_, i) => i !== +el.dataset.i); try { await saveSettings({ rekening: list }); toast('Rekening dihapus (transaksi lama tetap tercatat)'); setTimeout(renderRek, 50); } catch (e) { toast(errMsg(e)); } }),
  'tp-save': async () => { const tipe = [...new Set($('#tp-list').value.split('\n').map(s => s.trim()).filter(Boolean))]; if (!tipe.length) { toast('Isi minimal satu tipe'); return; } try { await saveSettings({ tipe }); toast(tipe.length + ' tipe motor disimpan'); } catch (e) { toast(errMsg(e)); } },
  'sf-save': async el => { const i = +el.dataset.i, s = logins[i]; try { await ubahPetugas(s.id, { nama: $('#sf-n-' + i).value.trim() || s.nama, peran: $('#sf-r-' + i).value, cabang: $('#sf-c-' + i)?.value || s.cabang || CABANG_UTAMA }); toast('Petugas ' + s.nama + ' disimpan'); logins = null; renderStaff(); } catch (e) { toast(errMsg(e)); } },
  'sf-pin': el => { const s = logins[+el.dataset.i]; askPin('PIN baru untuk ' + s.nama, async pin => { await resetPin(s.id, pin); toast('PIN ' + s.nama + ' diganti'); logins = null; setTimeout(renderStaff, 50); }); },
  'sf-del': el => { const s = logins[+el.dataset.i]; confirmTwice(el, 's' + s.id, async () => { try { await hapusPetugas(s.id); toast(s.nama + ' dihapus, tidak bisa login lagi'); logins = null; renderStaff(); } catch (e) { toast(errMsg(e)); } }); },
  'lg-save': async () => { try { await saveLogo(logoDraft); logoDraft = null; toast('Logo dipasang'); renderLogo(); } catch (e) { toast(errMsg(e)); } },
  'lg-cancel': () => { logoDraft = null; renderLogo(); },
  'lg-del': el => confirmTwice(el, 'logo', async () => { try { await saveLogo(''); logoDraft = null; toast('Logo dihapus'); renderLogo(); } catch (e) { toast(errMsg(e)); } }),
  'sf-add': async () => {
    const nama = $('#sf-nama').value.trim(), peran = $('#sf-peran').value, pin = $('#sf-pin').value.trim();
    if (!nama) { toast('Isi nama petugas'); return; }
    if (!validPin(pin)) { toast('PIN harus 6 angka'); return; }
    if ((logins || []).some(x => x.nama.toLowerCase() === nama.toLowerCase())) { toast('Nama ' + nama + ' sudah dipakai, bedakan supaya tidak tertukar saat login'); return; }
    $('[data-act="sf-add"]').disabled = true;
    try { await tambahPetugas({ nama, peran, pin, cabang: $('#sf-cabang')?.value || cabAktif() }); toast(nama + ' ditambahkan sebagai ' + ROLES[peran] + (multiCabang() ? ' di cabang ' + namaCabang($('#sf-cabang')?.value || cabAktif()) : '')); logins = null; renderStaff(); }
    catch (e) { toast(pinErr(e)); $('[data-act="sf-add"]').disabled = false; }
  }
});
inputHandlers.push(e => {
  const t = e.target;
  if (t.id === 'ms-kq') { kendQ = t.value; const pos = t.selectionStart; renderKend(); const n = $('#ms-kq'); n.focus(); n.setSelectionRange(pos, pos); }
  if (t.dataset.kf && kendEdit) kendEdit[t.dataset.kf] = t.value;
  if (['sf-pin', 'mm-p-new', 'pin-new'].includes(t.id)) t.value = t.value.replace(/\D/g, '').slice(0, 6);
});
changeHandlers.push(e => {
  const t = e.target;
  if (t.id === 'fw-kab') { fWil = { kab: t.value, kec: '', kel: '' }; renderKend(); }
  if (t.id === 'fw-kec') { fWil.kec = t.value; fWil.kel = ''; renderKend(); }
  if (t.id === 'fw-kel') { fWil.kel = t.value; renderKend(); }
});
changeHandlers.push(async e => {
  if (e.target.id !== 'lg-file' || !e.target.files[0]) return;
  try { logoDraft = await resizeImage(e.target.files[0]); renderLogo(); } catch (err) { toast(err.message); }
});
