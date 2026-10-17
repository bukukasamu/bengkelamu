// Menu Konsumen & Kendaraan → tab Konsumen: daftar ringan (50 terbaru, pencarian langsung ke database),
// tambah konsumen tanpa motor, ubah data (tercatat), tambah motor, gabungkan konsumen ganda & pindahkan motor (admin),
// hapus data pribadi (super admin), dan pembentukan database konsumen dari data kendaraan lama (sekali, super admin).
import { $, esc, stamp, toast, errMsg, modal, closeModal, waButton, waNumber, konfirmasi } from './util.js';
import { S, st, actions, inputHandlers, changeHandlers, isRole, tipeList } from './state.js';
import { db, doc, getDoc, getDocs, setDoc, updateDoc, collection, query, where, limit } from './firebase.js';
import { wilayahHTML, fillWilayah } from './wilayah.js';
import { nopolKey } from './cari-kendaraan.js';
import { mintaCatatan } from './kontrol.js';
import { mintaPassword } from './otorisasi.js';
import { loaderHTML } from './brand.js';
import './konsumen-daftar.js';
import { KTP, ambilKtp, ambilKonsumen, konsumenGanda, cariKonsumen, konsumenTerbaru, motorKonsumen, buatKonsumen, ubahKonsumen, tambahMotorKe, pindahkanMotor, gabungkanKonsumen, hapusDataPribadi, bentukDatabaseKonsumen } from './konsumen-data.js';

const KN = { list: null, q: '', cek: false, draft: null, motor: [], tambah: null, tCari: null };
const kosong = () => ({ id: null, ...Object.fromEntries(KTP.map(f => [f, ''])) });
const LABEL = { nik: 'NIK (16 angka)', nama: 'Nama lengkap', tempatLahir: 'Tempat lahir', tglLahir: 'Tanggal lahir', jk: 'Jenis kelamin', pekerjaan: 'Pekerjaan', hp: 'No. HP / WA', rtrw: 'RT / RW', provinsi: 'Provinsi', kabupaten: 'Kabupaten/kota', kecamatan: 'Kecamatan', kelurahan: 'Kelurahan', alamat: 'Alamat', kabKode: 'Kode wilayah' };
const bolehUbah = () => isRole('admin', 'registrasi');

async function muatList() {
  KN.list = null; gambarList();
  try {
    if (KN.q.replace(/\s/g, '').length >= 3) KN.list = await cariKonsumen(KN.q) || [];
    else if (KN.cek) { const s = await getDocs(query(collection(db, 'konsumen'), where('perluCek', '==', true), limit(200))); KN.list = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(k => !k.digabungKe); }
    else KN.list = await konsumenTerbaru(50);
  } catch (e) { KN.list = []; toast(errMsg(e)); }
  gambarList();
}
export function renderKonsumenTab() {
  const el = $('#ms-body'); if (!el) return;
  el.innerHTML = `<div class="row spread" style="margin-top:12px"><input id="kn-q" placeholder="Cari nama, no. HP, atau NIK (min. 3 huruf/angka)" value="${esc(KN.q)}" style="flex:1 1 260px" autocomplete="off" aria-label="Cari konsumen">
     <div class="row">${isRole('admin') ? '<button class="btn" type="button" data-act="kn-daftar" title="Daftar semua / yang servis / yang didaftarkan, per cabang — Excel, PDF, print">🖨 Daftar &amp; Cetak</button>' : ''}${isRole('admin') ? `<button class="btn${KN.cek ? ' pri' : ''}" type="button" data-act="kn-cek" title="Data yang perlu diperiksa (kemungkinan ganda)">⚑ Perlu dicek</button>` : ''}${bolehUbah() ? '<button class="btn pri" type="button" data-act="kn-baru">+ Konsumen baru [F1]</button>' : ''}</div></div>
   ${st.petugas?.super && !S.settings.konsumenSiap ? `<div class="note small" style="margin-top:10px"><b>Bentuk database konsumen (sekali saja).</b> Data konsumen lama masih menempel di data kendaraan. Tekan tombol ini untuk mengelompokkan kendaraan per no. HP menjadi data konsumen (satu orang bisa punya beberapa motor). Yang meragukan ditandai <b>Perlu dicek</b>.<div class="row" style="margin-top:6px"><button class="btn pri" type="button" data-act="kn-bentuk">Bentuk database konsumen</button></div></div>` : ''}
   <div id="kn-form"></div>
   <div id="kn-list"></div>`;
  gambarForm();
  if (!KN.list) muatList(); else gambarList();
}
function gambarList() {
  const el = $('#kn-list'); if (!el) return;
  if (!KN.list) { el.innerHTML = loaderHTML('Memuat konsumen…'); return; }
  const judul = KN.q.replace(/\s/g, '').length >= 3 ? `Hasil pencarian "${esc(KN.q)}"` : KN.cek ? 'Perlu dicek' : '50 konsumen terakhir diubah';
  el.innerHTML = `<h3 style="margin-top:12px">${judul}</h3>${KN.list.length ? `<div class="tw"><table class="rw-tabel bernomor"><thead><tr><th>Nama</th><th>No. HP</th><th>Alamat</th><th>Motor</th><th>Diubah</th></tr></thead><tbody>
    ${KN.list.map(k => `<tr class="rw-buka" tabindex="0" data-act="kn-buka" data-id="${esc(k.id)}" aria-current="${k.id === KN.draft?.id}"><td><b>${esc(k.nama || '–')}</b>${k.perluCek ? ' <span class="pill p-warn" title="' + esc(k.alasanCek || '') + '">perlu dicek</span>' : ''}${k.dihapus ? ' <span class="pill p-bad">dihapus</span>' : ''}${k.nik && isRole('admin') ? `<div class="rw-det">NIK ${esc(k.nik)}</div>` : ''}</td><td class="mono small">${esc(k.hp || '')}</td><td class="small">${esc([k.kelurahan, k.kecamatan].filter(Boolean).join(', '))}</td><td class="small">${(k.motor || []).map(m => `<span class="mono">${esc(m)}</span>`).join(', ') || '<span class="muted">belum ada</span>'}</td><td class="small muted">${esc(String(k.updated || '').slice(0, 10))}</td></tr>`).join('')}
   </tbody></table></div>` : '<div class="empty">Tidak ditemukan. Coba ketik bagian lain (nama, no. HP, atau NIK), atau tambah konsumen baru.</div>'}
   <p class="small muted" style="margin:0">Daftar dibatasi supaya ringan; konsumen lama tetap bisa dicari dengan kotak pencarian.</p>`;
}

/* ---------- Form konsumen ---------- */
async function buka(id) {
  const el = $('#kn-form'); if (el) el.innerHTML = loaderHTML('Memuat data konsumen…');
  try { const k = await ambilKonsumen(id); if (!k) { toast('Konsumen tidak ditemukan'); return; } KN.draft = { ...k }; KN.asli = k; KN.motor = await motorKonsumen(k); KN.tambah = null; }
  catch (e) { toast(errMsg(e)); }
  gambarForm(); $('#kn-form')?.scrollIntoView({ block: 'nearest' });
}
function gambarForm() {
  const el = $('#kn-form'); if (!el) return;
  const k = KN.draft; if (!k) { el.innerHTML = ''; return; }
  const baru = !k.id, dis = bolehUbah() && !k.dihapus ? '' : 'disabled';
  const inp = (f, extra = '') => `<label class="f" for="kn-${f}">${LABEL[f]}<input id="kn-${f}" data-kn="${f}" value="${esc(k[f] || '')}" ${extra} ${dis}></label>`;
  el.innerHTML = `<div class="panel" style="background:var(--panel-2);box-shadow:none;margin-block:12px">
   <div class="row spread"><h3>${baru ? 'Konsumen baru' : esc(k.nama || 'Konsumen')}</h3><span class="row">${k.hp ? waButton(k.hp, `Halo ${k.nama || 'Bapak/Ibu'}, `) : ''}<button class="btn sm ghost" type="button" data-act="kn-tutup" aria-label="Tutup">✕</button></span></div>
   ${k.perluCek ? `<div class="note small">⚑ <b>Perlu dicek:</b> ${esc(k.alasanCek || '')}${isRole('admin') ? ' — bila memang orang berbeda, tekan <button class="link-btn" type="button" data-act="kn-sudahcek">tandai sudah dicek</button>; bila orang yang sama, gunakan <b>Gabungkan dengan…</b>.' : ''}</div>` : ''}
   <div class="form">${inp('nik', 'inputmode="numeric" maxlength="16" class="num"')}<label class="f wide-2" for="kn-nama">Nama lengkap (sesuai KTP)<input id="kn-nama" data-kn="nama" value="${esc(k.nama || '')}" ${dis}></label>${inp('tempatLahir')}
    <label class="f" for="kn-tglLahir">Tanggal lahir<input id="kn-tglLahir" data-kn="tglLahir" type="date" value="${esc(k.tglLahir || '')}" ${dis}></label>
    <label class="f" for="kn-jk">Jenis kelamin<select id="kn-jk" data-kn="jk" ${dis}><option value="">–</option>${['LAKI-LAKI', 'PEREMPUAN'].map(x => `<option ${x === k.jk ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
    ${inp('pekerjaan')}${inp('hp', 'inputmode="tel"')}</div>
   <div class="form form-wil">${wilayahHTML('kw', k, !!dis)}${inp('rtrw', 'class="num" placeholder="mis. 002/005"')}</div>
   ${baru ? '' : `<h3>Motor (${KN.motor.length})</h3>
    ${KN.motor.length ? `<div class="tw"><table class="rw-tabel bernomor"><thead><tr><th>Nopol</th><th>Motor</th><th>No. rangka / mesin</th><th>Servis terakhir</th><th></th></tr></thead><tbody>${KN.motor.map((m, i) => `<tr><td class="mono"><b>${esc(m.nopol)}</b>${(m.nopolLama || []).length ? `<div class="rw-det">dulu ${m.nopolLama.map(esc).join(', ')}</div>` : ''}</td><td>${esc([m.tipe, m.warna, m.tahun].filter(Boolean).join(' · '))}${m.namaStnk && m.namaStnk !== m.nama ? `<div class="rw-det">STNK a.n. ${esc(m.namaStnk)}</div>` : ''}</td><td class="mono small">${esc(m.noRangka || '–')}<br>${esc(m.noMesin || '–')}</td><td class="small">${esc(String(m.servisTerakhir || '').slice(0, 10) || '–')}</td>
      <td class="r" style="white-space:nowrap"><button class="btn sm" type="button" data-act="rw-buka" data-np="${esc(m.nopol)}">Riwayat</button>${isRole('admin') ? ` <button class="btn sm ghost" type="button" data-act="kn-pindah" data-i="${i}" title="Koreksi: motor tersambung ke orang yang salah">Pindahkan</button>` : ''}</td></tr>`).join('')}</tbody></table></div>` : '<div class="small muted">Belum ada motor. Motor biasanya ditambahkan saat servis pertama di Registrasi.</div>'}
    ${bolehUbah() && !k.dihapus ? (KN.tambah ? formMotor() : '<button class="btn sm" type="button" data-act="kn-motor-baru">+ Tambah motor</button>') : ''}`}
   <div class="row" style="justify-content:flex-end;margin-top:10px">
    ${!baru && isRole('admin') && !k.dihapus ? '<button class="btn ghost" type="button" data-act="kn-gabung">Gabungkan dengan…</button>' : ''}
    ${!baru && st.petugas?.super && !k.dihapus ? '<button class="btn ghost" type="button" data-act="kn-hapus">Hapus data pribadi</button>' : ''}
    <button class="btn" type="button" data-act="kn-tutup">Tutup</button>${bolehUbah() && !k.dihapus ? `<button class="btn pri" type="button" data-act="kn-simpan">${baru ? 'Simpan konsumen' : 'Simpan perubahan'} [F2]</button>` : ''}</div>
  </div>`;
  fillWilayah('kw', { get: () => KN.draft });
}
const formMotor = () => { const t = KN.tambah; return `<div class="panel" style="box-shadow:none;margin-top:8px"><h3>Tambah motor</h3><div class="form">
  <label class="f" for="km-nopol">No. polisi<input id="km-nopol" data-km="nopol" class="mono" value="${esc(t.nopol)}" placeholder="BL 1234 XX"></label>
  <label class="f" for="km-tipe">Tipe motor<select id="km-tipe" data-km="tipe"><option value="">Pilih tipe</option>${tipeList().map(x => `<option ${x === t.tipe ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
  <label class="f" for="km-tahun">Tahun<input id="km-tahun" data-km="tahun" inputmode="numeric" maxlength="4" value="${esc(t.tahun)}"></label>
  <label class="f" for="km-warna">Warna<input id="km-warna" data-km="warna" value="${esc(t.warna)}"></label>
  <label class="f" for="km-noRangka">No. rangka<input id="km-noRangka" data-km="noRangka" class="mono" value="${esc(t.noRangka)}"></label>
  <label class="f" for="km-noMesin">No. mesin<input id="km-noMesin" data-km="noMesin" class="mono" value="${esc(t.noMesin)}"></label>
  <label class="f wide-2" for="km-namaStnk">Nama di STNK (kosongkan bila sama)<input id="km-namaStnk" data-km="namaStnk" value="${esc(t.namaStnk)}"></label></div>
  <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="kn-motor-batal">Batal</button><button class="btn pri" type="button" data-act="kn-motor-simpan">Simpan motor</button></div></div>`; };

async function simpan() {
  if (st.saving || !KN.draft) return;
  const k = KN.draft, data = ambilKtp(k);
  if (!data.nama) { toast('Isi nama sesuai KTP'); $('#kn-nama')?.focus(); return; }
  if (data.nik && !/^\d{16}$/.test(data.nik)) { toast('NIK harus 16 angka (atau kosongkan)'); $('#kn-nik')?.focus(); return; }
  if (!waNumber(data.hp) && !data.nik) { toast('Isi no. HP (atau NIK bila tidak punya HP) sebagai penanda konsumen'); $('#kn-hp')?.focus(); return; }
  if (data.hp && !waNumber(data.hp)) { toast('No. HP tidak valid'); $('#kn-hp')?.focus(); return; }
  // Penanda: no. HP & NIK tidak boleh dipakai konsumen lain (kecuali HP dipakai bersama, dengan konfirmasi)
  const asli = KN.asli || {};
  if (!k.id || data.hp !== (asli.hp || '') || data.nik !== (asli.nik || '')) {
    const g = await konsumenGanda(data, k.id || '');
    if (g.byNik.length) { const x = g.byNik[0]; if (await konfirmasi('NIK sudah terdaftar', `NIK ${esc(data.nik)} milik <b>${esc(x.nama)}</b> (${esc(x.hp || 'tanpa HP')}). Satu NIK = satu orang.`, { ya: 'Buka data ' + x.nama, tidak: 'Kembali' })) buka(x.id); return; }
    if (g.byHp.length && (!k.id || data.hp !== asli.hp)) {
      const x = g.byHp[0];
      const ok = await konfirmasi('No. HP sudah dipakai', `No. HP ${esc(data.hp)} terdaftar atas nama <b>${esc(x.nama)}</b>${(x.motor || []).length ? ' (' + x.motor.join(', ') + ')' : ''}.<br>Bila orangnya sama, buka datanya. Bila <b>orang lain yang memakai nomor yang sama</b> (mis. suami/istri), lanjutkan.`, { ya: 'Orang lain, nomor sama', tidak: 'Batal' });
      if (!ok) return;
    }
  }
  st.saving = true;
  try {
    if (!k.id) { const id = await buatKonsumen(data, 'Konsumen & Kendaraan'); toast('Konsumen ' + data.nama + ' ditambahkan'); KN.list = null; await buka(id); muatList(); }
    else { const n = await ubahKonsumen(KN.asli, data, 'Konsumen & Kendaraan'); toast(n ? `Data ${data.nama} disimpan (${n} perubahan, ikut diterapkan ke ${KN.motor.length} motor)` : 'Tidak ada perubahan'); await buka(k.id); muatList(); }
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

async function simpanMotor() {
  const k = KN.asli, t = KN.tambah; if (!k || !t) return;
  t.nopol = String(t.nopol || '').trim().toUpperCase().replace(/\s+/g, ' '); t.noRangka = String(t.noRangka || '').replace(/\s+/g, '').toUpperCase(); t.noMesin = String(t.noMesin || '').replace(/\s+/g, '').toUpperCase();
  const key = nopolKey(t.nopol);
  if (!key) { toast('Isi nomor polisi'); return; }
  if (!t.tipe) { toast('Pilih tipe motor'); return; }
  try {
    const s = await getDoc(doc(db, 'kendaraan', key));
    if (s.exists()) {
      const m = { id: key, ...s.data() };
      if (m.pindahKe) { toast(`Plat ${t.nopol} sudah berganti ke ${m.pindahKe}`); return; }
      if (m.konsumenId === k.id) { toast(t.nopol + ' sudah menjadi motor konsumen ini'); return; }
      if (m.konsumenId) { const p = await ambilKonsumen(m.konsumenId); toast(`${t.nopol} terdaftar milik ${p?.nama || 'konsumen lain'}. Bila motor dijual, lakukan Ganti pemilik lewat Registrasi servis.`); return; }
      if (!(await konfirmasi('Sambungkan ' + t.nopol + '?', `Motor ini sudah ada di data lama (${esc(m.nama || 'tanpa nama')}) tetapi belum punya pemilik di database konsumen. Sambungkan ke <b>${esc(k.nama)}</b>?`, { ya: 'Ya, sambungkan' }))) return;
      await pindahkanMotor(m, k, { jenis: 'koreksi', alasan: 'disambungkan dari data lama' });
    } else {
      for (const f of ['noRangka', 'noMesin']) if (t[f]) {
        const q = await getDocs(query(collection(db, 'kendaraan'), where(f, '==', t[f]), limit(1)));
        const ada = q.docs.find(d => !d.data().pindahKe);
        if (ada) { toast(`${f === 'noRangka' ? 'No. rangka' : 'No. mesin'} ini tercatat di ${ada.data().nopol}. Bila platnya berganti, daftarkan lewat Registrasi servis (ganti nomor polisi).`); return; }
      }
      const tgl = stamp(new Date());
      await setDoc(doc(db, 'kendaraan', key), { ...ambilKtp(k), nopol: t.nopol, nopolKey: key, tipe: t.tipe, tahun: t.tahun || '', warna: t.warna || '', noRangka: t.noRangka, noMesin: t.noMesin, namaStnk: t.namaStnk || k.nama, stnkSama: !t.namaStnk || t.namaStnk === k.nama, konsumenId: k.id, hpNorm: waNumber(k.hp), dibuat: tgl, updated: tgl });
      await tambahMotorKe(k.id, key);
    }
    toast('Motor ' + t.nopol + ' ditambahkan ke ' + k.nama); KN.tambah = null; await buka(k.id); muatList();
  } catch (e) { toast(errMsg(e)); }
}

/* ---------- Pilih konsumen lain (untuk gabung / pindah) ---------- */
export function pilihKonsumen(judul, kecualiId = '', ket = '') {
  return new Promise(resolve => {
    let hasil = [], selesai = false, t = null;
    const akhir = v => { if (selesai) return; selesai = true; obs.disconnect(); resolve(v); };
    modal(`<h3>${esc(judul)}</h3>${ket ? `<p class="small" style="margin:0">${ket}</p>` : ''}<input id="pk-q" placeholder="Cari nama, no. HP, atau NIK" autocomplete="off" data-autofocus><div id="pk-hasil" class="small muted">Ketik minimal 3 huruf/angka.</div>
      <div class="row" style="justify-content:flex-end"><button class="btn" type="button" id="pk-batal">Batal</button></div>`, 'wide');
    const root = $('#modal-root'), obs = new MutationObserver(() => { if (!root.querySelector('#pk-q')) akhir(null); });
    obs.observe(root, { childList: true, subtree: true });
    $('#pk-batal').onclick = () => { closeModal(); akhir(null); };
    $('#pk-q').oninput = e => { clearTimeout(t); t = setTimeout(async () => {
      const r = await cariKonsumen(e.target.value); const el = $('#pk-hasil'); if (!el) return;
      hasil = (r || []).filter(k => k.id !== kecualiId);
      el.innerHTML = !r ? 'Ketik minimal 3 huruf/angka.' : hasil.length ? `<div class="cari-hasil">${hasil.map((k, i) => `<button type="button" class="cari-item" data-pk="${i}"><div><b>${esc(k.nama)}</b> <span class="mono">${esc(k.hp || '')}</span><div class="small muted">${esc([k.kelurahan, k.kecamatan].filter(Boolean).join(', '))}${(k.motor || []).length ? ' · ' + k.motor.join(', ') : ''}</div></div></button>`).join('')}</div>` : 'Tidak ditemukan.';
      el.querySelectorAll('[data-pk]').forEach(b => { b.onclick = () => { const k = hasil[+b.dataset.pk]; closeModal(); akhir(k); }; });
    }, 300); };
  });
}

async function gabung() {
  const a = KN.asli; if (!a) return;
  const b = await pilihKonsumen('Gabungkan ' + a.nama + ' dengan…', a.id, 'Pilih data konsumen yang <b>dipertahankan</b>. Semua motor & riwayat <b>' + esc(a.nama) + '</b> pindah ke sana, lalu data ini ditandai digabung.');
  if (!b) return;
  const beda = KTP.filter(f => f !== 'kabKode' && (a[f] || '') !== (b[f] || '') && (a[f] || b[f]));
  modal(`<h3>Gabungkan konsumen</h3><p class="small" style="margin:0">Pilih isian yang benar untuk setiap kolom yang berbeda. Kolom yang sama tidak ditampilkan.</p>
    <div class="tw"><table class="rw-tabel"><thead><tr><th>Kolom</th><th>${esc(a.nama)} <span class="muted">(digabung)</span></th><th>${esc(b.nama)} <span class="muted">(dipertahankan)</span></th></tr></thead><tbody>
    ${beda.map(f => { const pilihA = !b[f] && a[f]; return `<tr><td>${esc(LABEL[f] || f)}</td><td><label class="chk"><input type="radio" name="gb-${f}" value="a" ${pilihA ? 'checked' : ''}> ${esc(a[f] || '–')}</label></td><td><label class="chk"><input type="radio" name="gb-${f}" value="b" ${pilihA ? '' : 'checked'}> ${esc(b[f] || '–')}</label></td></tr>`; }).join('') || '<tr><td colspan="3" class="muted">Semua data sama.</td></tr>'}
    <tr><td>Motor</td><td>${(a.motor || []).join(', ') || '–'}</td><td>${(b.motor || []).join(', ') || '–'} <b>+ ${(a.motor || []).length} motor</b></td></tr></tbody></table></div>
    <div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-close="1">Batal</button><button class="btn pri" type="button" id="gb-ok">Gabungkan</button></div>`, 'wide');
  $('#gb-ok').onclick = async () => {
    const data = { ...ambilKtp(b) };
    beda.forEach(f => { const v = document.querySelector(`input[name="gb-${f}"]:checked`)?.value; if (v === 'a') { data[f] = a[f] || ''; if (WIL.includes(f)) WIL.forEach(w => { data[w] = a[w] || ''; }); } });
    closeModal();
    if (!(await konfirmasi('Gabungkan sekarang?', `<b>${esc(a.nama)}</b> digabung ke <b>${esc(data.nama)}</b>. ${(a.motor || []).length} motor pindah. Tidak bisa dibatalkan otomatis.`, { ya: 'Ya, gabungkan', bahaya: true }))) return;
    try { await gabungkanKonsumen(a, b, data); toast(a.nama + ' digabung ke ' + data.nama); KN.list = null; await buka(b.id); muatList(); } catch (e) { toast(errMsg(e)); }
  };
}
const WIL = ['provinsi', 'kabKode', 'kabupaten', 'kecamatan', 'kelurahan'];

async function pindah(el) {
  const m = KN.motor[+el.dataset.i], a = KN.asli; if (!m || !a) return;
  const b = await pilihKonsumen('Pindahkan ' + m.nopol + ' ke…', a.id, 'Untuk <b>koreksi</b> (motor tersambung ke orang yang salah). Bila motor <b>dijual</b>, gunakan Ganti pemilik di Registrasi servis.');
  if (!b) return;
  const alasan = await mintaCatatan(`Pindahkan ${m.nopol} dari ${a.nama} ke ${b.nama}`, 'Tulis alasan koreksi, mis. "salah pilih konsumen saat registrasi". Tracking & pengingat oli ikut pindah ke no. HP ' + (b.hp || '–') + '.');
  if (alasan === null) return;
  try { await pindahkanMotor(m, b, { jenis: 'koreksi', alasan }); toast(`${m.nopol} dipindahkan ke ${b.nama}`); await buka(a.id); muatList(); } catch (e) { toast(errMsg(e)); }
}

Object.assign(actions, {
  'kn-baru': () => { KN.draft = kosong(); KN.asli = null; KN.motor = []; KN.tambah = null; gambarForm(); $('#kn-nik')?.focus(); },
  'kn-buka': el => buka(el.dataset.id),
  'kn-tutup': () => { KN.draft = null; KN.asli = null; const el = $('#kn-form'); if (el) el.innerHTML = ''; },
  'kn-simpan': simpan,
  'kn-cek': () => { KN.cek = !KN.cek; KN.q = ''; const q = $('#kn-q'); if (q) q.value = ''; renderKonsumenTab(); muatList(); },
  'kn-sudahcek': async () => { try { await updateDoc(doc(db, 'konsumen', KN.asli.id), { perluCek: false, alasanCek: '', updated: stamp(new Date()) }); toast('Ditandai sudah dicek'); await buka(KN.asli.id); muatList(); } catch (e) { toast(errMsg(e)); } },
  'kn-motor-baru': () => { KN.tambah = { nopol: '', tipe: '', tahun: '', warna: '', noRangka: '', noMesin: '', namaStnk: '' }; gambarForm(); $('#km-nopol')?.focus(); },
  'kn-motor-batal': () => { KN.tambah = null; gambarForm(); },
  'kn-motor-simpan': simpanMotor,
  'kn-gabung': gabung,
  'kn-pindah': pindah,
  'kn-hapus': async () => {
    const k = KN.asli; if (!k) return;
    if (!(await konfirmasi('Hapus data pribadi ' + k.nama + '?', `Nama, NIK, no. HP, dan alamat dihapus dari data konsumen & ${(k.motor || []).length} motornya; halaman cek servis motornya ditutup. Riwayat servis & nota tetap ada untuk laporan. <b>Tidak bisa dikembalikan.</b>`, { ya: 'Ya, hapus data pribadi', bahaya: true }))) return;
    if (!(await mintaPassword('Hapus data pribadi ' + k.nama, 'Permintaan konsumen / perlindungan data pribadi.'))) return;
    try { await hapusDataPribadi(k); toast('Data pribadi dihapus'); await buka(k.id); muatList(); } catch (e) { toast(errMsg(e)); }
  },
  'kn-bentuk': async el => {
    if (!(await konfirmasi('Bentuk database konsumen?', 'Seluruh data kendaraan dibaca sekali (memakai kuota baca sesuai jumlah kendaraan), lalu dikelompokkan per no. HP menjadi konsumen. Data kendaraan tidak dihapus.', { ya: 'Mulai' }))) return;
    el.disabled = true;
    try {
      const r = await bentukDatabaseKonsumen((i, n) => { el.textContent = `Membentuk ${i}/${n}…`; });
      toast(`${r.konsumen} konsumen dibentuk dari ${r.motor} kendaraan${r.cek ? ` · ${r.cek} perlu dicek` : ''}`); KN.list = null; renderKonsumenTab();
    } catch (e) { toast(errMsg(e)); el.disabled = false; el.textContent = 'Bentuk database konsumen'; }
  }
});
inputHandlers.push(e => {
  const t = e.target;
  if (t.dataset.kn && KN.draft) { KN.draft[t.dataset.kn] = t.value; if (t.id === 'kn-nik') { t.value = t.value.replace(/\D/g, '').slice(0, 16); KN.draft.nik = t.value; } }
  if (t.dataset.km && KN.tambah) KN.tambah[t.dataset.km] = t.value;
  if (t.id === 'kn-q') { KN.q = t.value; clearTimeout(KN.tCari); KN.tCari = setTimeout(() => { KN.cek = false; muatList(); }, 350); }
});
changeHandlers.push(e => { const t = e.target; if (t.dataset.kn && KN.draft) KN.draft[t.dataset.kn] = t.value; if (t.dataset.km && KN.tambah) KN.tambah[t.dataset.km] = t.value; });
export const konsumenState = KN;
