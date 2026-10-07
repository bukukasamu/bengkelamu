// Menu Master Data: pemilik & kendaraan, jasa servis + harga, mekanik (gaji & komisi), tipe motor, petugas login.
import { $, esc, rp, stamp, toast, errMsg } from './util.js';
import { S, st, views, refreshers, actions, inputHandlers, changeHandlers, fkeys, tipeList, isRole } from './state.js';
import { ROLES } from './config.js';
import { db, doc, collection, getDocs, query, orderBy, limit, setDoc, updateDoc, addDoc, deleteDoc, createStaffAccount } from './firebase.js';
import { nopolKey } from './registrasi.js';
import { statusPill } from './wo-common.js';

const TABS = [['kendaraan', 'Pemilik & Kendaraan', ['admin', 'registrasi']], ['jasa', 'Jasa Servis', ['admin']], ['mekanik', 'Mekanik', ['admin']], ['tipe', 'Tipe Motor', ['admin']], ['petugas', 'Petugas Login', ['admin']]];
const tabsFor = () => TABS.filter(t => isRole(...t[2]));
let kend = null, kendQ = '', kendEdit = null, staff = null;

// Hapus perlu diklik dua kali (dialog konfirmasi bawaan browser tidak dipakai)
let armed = null;
function confirmTwice(el, key, fn) {
  if (armed !== key) { armed = key; const t = el.textContent; el.textContent = 'Klik lagi'; setTimeout(() => { if (armed === key) { armed = null; el.textContent = t; } }, 3000); return; }
  armed = null; fn();
}

function renderMaster() {
  const tabs = tabsFor(); if (!tabs.find(t => t[0] === st.masterTab)) st.masterTab = tabs[0][0];
  $('#view').innerHTML = `<div class="panel"><div class="subtabs" role="tablist">${tabs.map(([k, l]) => `<button type="button" role="tab" data-act="ms-tab" data-t="${k}" aria-selected="${k === st.masterTab}">${l}</button>`).join('')}</div><div id="ms-body"></div></div>`;
  ({ kendaraan: renderKend, jasa: renderJasa, mekanik: renderMek, tipe: renderTipe, petugas: renderStaff })[st.masterTab]();
}

/* ---------- Pemilik & kendaraan ---------- */
const KF = [['nopol', 'No. Polisi', 'mono'], ['nama', 'Nama pemilik'], ['hp', 'No. HP'], ['tipe', 'Tipe motor'], ['tahun', 'Tahun'], ['warna', 'Warna'], ['noRangka', 'No. rangka', 'mono'], ['noMesin', 'No. mesin', 'mono'], ['km', 'KM terakhir'], ['alamat', 'Alamat', 'wide']];
async function loadKend() {
  try { const s = await getDocs(query(collection(db, 'kendaraan'), orderBy('updated', 'desc'), limit(500))); kend = s.docs.map(d => ({ id: d.id, ...d.data() })); }
  catch (e) { kend = []; toast(errMsg(e)); }
  if (st.masterTab === 'kendaraan') renderKend();
}
function renderKend() {
  const el = $('#ms-body'); if (!el) return;
  if (!kend) { el.innerHTML = '<div class="loading">Memuat data kendaraan…</div>'; loadKend(); return; }
  const q = kendQ.toLowerCase();
  const list = kend.filter(k => !q || [k.nopol, k.nama, k.hp, k.tipe].join(' ').toLowerCase().includes(q));
  el.innerHTML = `<div class="row spread" style="margin-top:12px"><input id="ms-kq" placeholder="Cari nopol, nama, HP, tipe" value="${esc(kendQ)}" style="flex:1 1 240px" aria-label="Cari kendaraan"><button class="btn pri" type="button" data-act="ms-kadd">+ Kendaraan [F1]</button></div>
   <div id="ms-kform"></div>
   <div class="tw"><table><thead><tr><th>Nopol</th><th>Pemilik</th><th>No. HP</th><th>Motor</th><th>Servis terakhir</th></tr></thead><tbody>${list.slice(0, 200).map(k => `<tr class="row-click" tabindex="0" data-act="ms-kedit" data-id="${esc(k.id)}"><td class="mono">${esc(k.nopol)}</td><td>${esc(k.nama || '–')}</td><td class="mono small">${esc(k.hp || '')}</td><td>${esc(k.tipe || '')}${k.tahun ? ' · ' + esc(k.tahun) : ''}${k.warna ? ' · ' + esc(k.warna) : ''}</td><td class="small">${esc((k.updated || '').slice(0, 10))}${k.woTerakhir ? ' · ' + esc(k.woTerakhir) : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">Belum ada kendaraan. Kendaraan otomatis tercatat saat registrasi servis.</td></tr>'}</tbody></table></div>
   <p class="small muted" style="margin:0">${list.length} kendaraan${list.length > 200 ? ' (ditampilkan 200, persempit pencarian)' : ''}.</p>`;
  renderKForm();
}
function renderKForm() {
  const el = $('#ms-kform'); if (!el) return;
  if (!kendEdit) { el.innerHTML = ''; return; }
  const k = kendEdit, isNew = !k.id;
  const riwayat = isNew ? [] : [...S.wo].reverse().filter(w => nopolKey(w.nopol) === k.id).slice(0, 10);
  el.innerHTML = `<div class="panel" style="background:var(--panel-2);box-shadow:none;margin-block:12px"><h3>${isNew ? 'Kendaraan baru' : 'Ubah ' + esc(k.nopol)}</h3>
   <div class="form">${KF.map(([f, l, c]) => `<label class="f${c === 'wide' ? ' wide' : ''}" for="mk-${f}">${l}<input id="mk-${f}" data-kf="${f}" ${c === 'mono' ? 'class="mono"' : ''} value="${esc(k[f] || '')}" ${f === 'nopol' && !isNew ? 'disabled' : ''} ${f === 'tipe' ? 'list="dl-tipe"' : ''}></label>`).join('')}<datalist id="dl-tipe">${tipeList().map(t => `<option value="${esc(t)}">`).join('')}</datalist></div>
   ${riwayat.length ? `<div class="small"><b>Riwayat servis:</b> ${riwayat.map(w => `${esc(w.no)} (${esc(w.tgl.slice(0, 10))}) ${statusPill(w.status)}`).join(' · ')}</div>` : ''}
   <div class="row" style="justify-content:flex-end">${!isNew && isRole('admin') ? '<button class="btn ghost" type="button" data-act="ms-kdel">Hapus</button>' : ''}<button class="btn" type="button" data-act="ms-kclose">Batal</button><button class="btn pri" type="button" data-act="ms-ksave">Simpan [F2]</button></div></div>`;
}
async function saveKend() {
  const k = kendEdit; k.nopol = (k.nopol || '').trim().toUpperCase().replace(/\s+/g, ' ');
  if (!k.nopol) { toast('Isi nomor polisi'); return; }
  const id = k.id || nopolKey(k.nopol);
  if (!k.id && kend.find(x => x.id === id)) { toast(k.nopol + ' sudah terdaftar'); return; }
  try {
    const data = Object.fromEntries(KF.map(([f]) => [f, (k[f] || '').toString().trim()]));
    await setDoc(doc(db, 'kendaraan', id), { ...data, updated: stamp(new Date()) }, { merge: true });
    toast('Kendaraan ' + k.nopol + ' disimpan'); kendEdit = null; kend = null; renderKend();
  } catch (e) { toast(errMsg(e)); }
}

/* ---------- Jasa servis ---------- */
function renderJasa() {
  const list = [...S.jasa].sort((a, b) => (a.urut ?? 99) - (b.urut ?? 99) || a.nama.localeCompare(b.nama));
  $('#ms-body').innerHTML = `<p class="small muted" style="margin-block:12px 8px">Ubah nama atau harga lalu klik Simpan pada barisnya. Jasa nonaktif tidak muncul di registrasi, tapi tetap tercatat di nota lama.</p>
   <div class="tw"><table><thead><tr><th>Nama jasa</th><th class="r">Harga (Rp)</th><th>Aktif</th><th></th></tr></thead><tbody>
   ${list.map(j => `<tr><td><input class="inline-input" id="js-n-${j.id}" value="${esc(j.nama)}" aria-label="Nama jasa"></td><td><input class="inline-input num" type="number" min="0" step="1000" id="js-h-${j.id}" value="${j.harga}" style="text-align:right;width:120px" aria-label="Harga"></td><td><input type="checkbox" id="js-a-${j.id}" style="width:auto" ${j.aktif !== false ? 'checked' : ''} aria-label="Aktif"></td><td class="r" style="white-space:nowrap"><button class="btn sm" type="button" data-act="js-save" data-id="${j.id}">Simpan</button> <button class="btn sm ghost" type="button" data-act="js-del" data-id="${j.id}">Hapus</button></td></tr>`).join('')}
   <tr><td><input class="inline-input" id="js-n-new" placeholder="Jasa baru, mis. Servis Injeksi" aria-label="Nama jasa baru"></td><td><input class="inline-input num" type="number" min="0" step="1000" id="js-h-new" placeholder="0" style="text-align:right;width:120px" aria-label="Harga jasa baru"></td><td></td><td class="r"><button class="btn sm pri" type="button" data-act="js-add">Tambah</button></td></tr>
   </tbody></table></div>`;
}

/* ---------- Mekanik ---------- */
function renderMek() {
  const list = [...S.mekanik].sort((a, b) => a.nama.localeCompare(b.nama));
  const row = (m, id) => `<tr><td><input class="inline-input" id="mm-n-${id}" value="${esc(m.nama || '')}" placeholder="Nama mekanik" aria-label="Nama"></td><td><input class="inline-input" type="email" id="mm-e-${id}" value="${esc(m.email || '')}" placeholder="email login (opsional)" aria-label="Email login"></td><td><input class="inline-input num" type="number" min="0" step="50000" id="mm-g-${id}" value="${m.gaji ?? ''}" placeholder="0" style="text-align:right;width:120px" aria-label="Gaji pokok"></td><td><input class="inline-input num" type="number" min="0" max="100" step="0.5" id="mm-k-${id}" value="${m.komisi ?? ''}" placeholder="0" style="text-align:right;width:70px" aria-label="Komisi persen"></td><td>${id === 'new' ? '' : `<input type="checkbox" id="mm-a-${id}" style="width:auto" ${m.aktif !== false ? 'checked' : ''} aria-label="Aktif">`}</td><td class="r" style="white-space:nowrap">${id === 'new' ? '<button class="btn sm pri" type="button" data-act="mm-add">Tambah</button>' : `<button class="btn sm" type="button" data-act="mm-save" data-id="${id}">Simpan</button> <button class="btn sm ghost" type="button" data-act="mm-del" data-id="${id}">Hapus</button>`}</td></tr>`;
  $('#ms-body').innerHTML = `<p class="small muted" style="margin-block:12px 8px">Email login menghubungkan akun peran Mekanik ke datanya, supaya mekanik bisa melihat performa dan gajinya sendiri. Estimasi gaji = gaji pokok + komisi % × nilai jasa (termasuk klaim KSG).</p>
   <div class="tw"><table><thead><tr><th>Nama</th><th>Email login</th><th class="r">Gaji pokok / bulan</th><th class="r">Komisi %</th><th>Aktif</th><th></th></tr></thead><tbody>${list.map(m => row(m, m.id)).join('')}${row({}, 'new')}</tbody></table></div>`;
}

/* ---------- Tipe motor ---------- */
function renderTipe() {
  $('#ms-body').innerHTML = `<p class="small muted" style="margin-block:12px 8px">Satu tipe per baris. Urutan di sini menjadi urutan pilihan di registrasi.</p>
   <textarea id="tp-list" rows="14" aria-label="Daftar tipe motor">${esc(tipeList().join('\n'))}</textarea>
   <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn pri" type="button" data-act="tp-save">Simpan tipe motor [F2]</button></div>`;
}

/* ---------- Petugas login ---------- */
async function loadStaff() {
  try { const s = await getDocs(collection(db, 'staff')); staff = s.docs.map(d => ({ email: d.id, ...d.data() })); }
  catch (e) { staff = []; toast(errMsg(e)); }
  if (st.masterTab === 'petugas') renderStaff();
}
function renderStaff() {
  const el = $('#ms-body');
  if (!staff) { el.innerHTML = '<div class="loading">Memuat petugas…</div>'; loadStaff(); return; }
  const roleSel = (id, v) => `<select class="inline-input" id="${id}" style="width:auto" aria-label="Peran">${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
  el.innerHTML = `<p class="small muted" style="margin-block:12px 8px">Peran menentukan menu yang bisa dibuka: Registrasi (motor masuk), Sparepart (order part &amp; pembelian), Kasir (pembayaran &amp; penjualan), Mekanik (performa &amp; gaji), Admin (semua).</p>
   <div class="tw"><table><thead><tr><th>Email</th><th>Nama</th><th>Peran</th><th></th></tr></thead><tbody>
   ${staff.map((s, i) => `<tr><td class="small mono">${esc(s.email)}</td><td><input class="inline-input" id="sf-n-${i}" value="${esc(s.nama || '')}" aria-label="Nama"></td><td>${roleSel('sf-r-' + i, s.peran)}</td><td class="r" style="white-space:nowrap"><button class="btn sm" type="button" data-act="sf-save" data-i="${i}">Simpan</button> ${s.email === st.petugas.email ? '' : `<button class="btn sm ghost" type="button" data-act="sf-del" data-i="${i}">Cabut akses</button>`}</td></tr>`).join('')}
   </tbody></table></div>
   <div class="panel" style="background:var(--panel-2);box-shadow:none;margin-top:12px"><h3>Tambah petugas</h3>
    <div class="form"><label class="f" for="sf-email">Email<input id="sf-email" type="email" autocomplete="off"></label><label class="f" for="sf-nama">Nama<input id="sf-nama"></label><label class="f" for="sf-peran">Peran${roleSel('sf-peran', 'kasir')}</label><label class="f" for="sf-pass">Kata sandi awal (min. 6)<input id="sf-pass" type="text" autocomplete="new-password"></label></div>
    <p class="small muted" style="margin:0">Akun login dibuat otomatis. Kalau email sudah punya akun, cukup diberi hak akses (kata sandi tidak diubah).</p>
    <div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-act="sf-add">Tambah petugas</button></div></div>`;
}
async function addStaff() {
  const email = $('#sf-email').value.trim().toLowerCase(), nama = $('#sf-nama').value.trim(), peran = $('#sf-peran').value, pass = $('#sf-pass').value;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { toast('Email tidak valid'); return; }
  if (!nama) { toast('Isi nama petugas'); return; }
  let info = 'Petugas ' + nama + ' ditambahkan';
  try {
    if (pass) {
      if (pass.length < 6) { toast('Kata sandi minimal 6 karakter'); return; }
      try { await createStaffAccount(email, pass); }
      catch (e) { if (e.code === 'auth/email-already-in-use') info += ' (akun sudah ada, kata sandi lama tetap berlaku)'; else throw e; }
    } else info += '. Buat akun loginnya di Firebase Console → Authentication, atau isi kata sandi awal.';
    await setDoc(doc(db, 'staff', email), { nama, peran });
    if (peran === 'mekanik' && !S.mekanik.find(m => (m.email || '').toLowerCase() === email)) {
      const same = S.mekanik.find(m => m.nama.toLowerCase() === nama.toLowerCase());
      if (same) await updateDoc(doc(db, 'mekanik', same.id), { email }); else await addDoc(collection(db, 'mekanik'), { nama, email, gaji: 0, komisi: 0, aktif: true });
      info += '. Data mekanik terhubung.';
    }
    toast(info); staff = null; renderStaff();
  } catch (e) { toast(e.code === 'auth/weak-password' ? 'Kata sandi terlalu lemah' : e.code === 'auth/operation-not-allowed' ? 'Aktifkan login Email/Password di Firebase Console' : errMsg(e)); }
}

views.master = renderMaster;
refreshers.master = () => { if (st.masterTab === 'jasa' || st.masterTab === 'mekanik') return; };   // jangan timpa isian yang sedang diketik
fkeys.master = { baru: () => st.masterTab === 'kendaraan' ? 'ms-kadd' : null, simpan: () => st.masterTab === 'kendaraan' && kendEdit ? 'ms-ksave' : st.masterTab === 'tipe' ? 'tp-save' : null };
Object.assign(actions, {
  'ms-tab': el => { st.masterTab = el.dataset.t; kendEdit = null; renderMaster(); },
  'ms-kadd': () => { kendEdit = { nopol: '' }; renderKForm(); $('#mk-nopol')?.focus(); },
  'ms-kedit': el => { const k = kend.find(x => x.id === el.dataset.id); if (k) { kendEdit = { ...k }; renderKForm(); $('#ms-kform').scrollIntoView({ block: 'nearest' }); } },
  'ms-kclose': () => { kendEdit = null; renderKForm(); },
  'ms-ksave': saveKend,
  'ms-kdel': el => confirmTwice(el, 'k' + kendEdit.id, async () => { try { await deleteDoc(doc(db, 'kendaraan', kendEdit.id)); toast('Kendaraan dihapus'); kendEdit = null; kend = null; renderKend(); } catch (e) { toast(errMsg(e)); } }),
  'js-save': async el => { const id = el.dataset.id, nama = $('#js-n-' + id).value.trim(); if (!nama) { toast('Nama jasa wajib diisi'); return; } try { await updateDoc(doc(db, 'jasa', id), { nama, harga: +$('#js-h-' + id).value || 0, aktif: $('#js-a-' + id).checked }); toast('Jasa ' + nama + ' disimpan'); } catch (e) { toast(errMsg(e)); } },
  'js-add': async () => { const nama = $('#js-n-new').value.trim(); if (!nama) { toast('Isi nama jasa'); return; } try { await addDoc(collection(db, 'jasa'), { nama, harga: +$('#js-h-new').value || 0, aktif: true, urut: S.jasa.length }); toast('Jasa ' + nama + ' ditambahkan'); renderJasa(); } catch (e) { toast(errMsg(e)); } },
  'js-del': el => confirmTwice(el, 'j' + el.dataset.id, async () => { try { await deleteDoc(doc(db, 'jasa', el.dataset.id)); toast('Jasa dihapus'); renderJasa(); } catch (e) { toast(errMsg(e)); } }),
  'mm-save': async el => { const id = el.dataset.id, nama = $('#mm-n-' + id).value.trim(); if (!nama) { toast('Nama mekanik wajib diisi'); return; } try { await updateDoc(doc(db, 'mekanik', id), { nama, email: $('#mm-e-' + id).value.trim().toLowerCase(), gaji: +$('#mm-g-' + id).value || 0, komisi: +$('#mm-k-' + id).value || 0, aktif: $('#mm-a-' + id).checked }); toast('Mekanik ' + nama + ' disimpan'); } catch (e) { toast(errMsg(e)); } },
  'mm-add': async () => { const nama = $('#mm-n-new').value.trim(); if (!nama) { toast('Isi nama mekanik'); return; } try { await addDoc(collection(db, 'mekanik'), { nama, email: $('#mm-e-new').value.trim().toLowerCase(), gaji: +$('#mm-g-new').value || 0, komisi: +$('#mm-k-new').value || 0, aktif: true }); toast('Mekanik ' + nama + ' ditambahkan'); renderMek(); } catch (e) { toast(errMsg(e)); } },
  'mm-del': el => confirmTwice(el, 'm' + el.dataset.id, async () => { try { await deleteDoc(doc(db, 'mekanik', el.dataset.id)); toast('Mekanik dihapus (riwayat servis lama tetap tersimpan)'); renderMek(); } catch (e) { toast(errMsg(e)); } }),
  'tp-save': async () => { const tipe = [...new Set($('#tp-list').value.split('\n').map(s => s.trim()).filter(Boolean))]; if (!tipe.length) { toast('Isi minimal satu tipe'); return; } try { await setDoc(doc(db, 'meta', 'settings'), { tipe }, { merge: true }); toast(tipe.length + ' tipe motor disimpan'); } catch (e) { toast(errMsg(e)); } },
  'sf-save': async el => { const s = staff[+el.dataset.i], i = el.dataset.i; try { await setDoc(doc(db, 'staff', s.email), { nama: $('#sf-n-' + i).value.trim(), peran: $('#sf-r-' + i).value }, { merge: true }); toast('Petugas ' + s.email + ' disimpan'); staff = null; renderStaff(); } catch (e) { toast(errMsg(e)); } },
  'sf-del': el => { const s = staff[+el.dataset.i]; confirmTwice(el, 's' + s.email, async () => { try { await deleteDoc(doc(db, 'staff', s.email)); toast('Akses ' + s.email + ' dicabut'); staff = null; renderStaff(); } catch (e) { toast(errMsg(e)); } }); },
  'sf-add': addStaff
});
inputHandlers.push(e => {
  const t = e.target;
  if (t.id === 'ms-kq') { kendQ = t.value; const pos = t.selectionStart; renderKend(); const n = $('#ms-kq'); n.focus(); n.setSelectionRange(pos, pos); }
  if (t.dataset.kf && kendEdit) kendEdit[t.dataset.kf] = t.value;
});
