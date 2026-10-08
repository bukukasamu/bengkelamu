// Menu Backup Data (super admin): unduh seluruh database ke satu file JSON, dan pulihkan dari file itu.
// Disarankan seminggu sekali; beranda super admin menampilkan pengingat bila backup terakhir > 7 hari.
import { $, esc, dkey, stamp, toast, errMsg } from './util.js';
import { S, st, views, refreshers, actions, changeHandlers } from './state.js';
import { db, collection, getDocs, doc, setDoc, writeBatch, Timestamp } from './firebase.js';
import { mintaPassword } from './otorisasi.js';
import { APP_NAME, APP_VERSION } from './config.js';

// Semua koleksi yang disimpan. "pantau" (link cek konsumen) tidak bisa didaftar dan dibuat ulang otomatis dari WO.
export const KOLEKSI = ['parts', 'kendaraan', 'jasa', 'mekanik', 'meta', 'publik', 'staff', 'trx', 'wo', 'pembelian', 'mutasi', 'transfer', 'opname',
  'pengeluaran', 'kas', 'klaim', 'penghasilan', 'gaji', 'slip', 'penghasilanBulan', 'absen', 'absenPerangkat', 'masuk', 'imports'];
// Foto selfie absen tidak ikut backup (besar dan dihapus otomatis setelah beberapa hari).
export const HARI_PENGINGAT = 7;
export const umurBackup = () => { const t = S.settings.backupTerakhir?.tgl; return t ? Math.floor((Date.now() - new Date(t.replace(' ', 'T'))) / 864e5) : null; };
export const perluBackup = () => { const u = umurBackup(); return u == null || u >= HARI_PENGINGAT; };

// Timestamp Firestore → { __ts: milidetik } supaya bisa disimpan sebagai JSON dan dipulihkan apa adanya
const keJson = v => v == null || typeof v !== 'object' ? v : typeof v.toMillis === 'function' ? { __ts: v.toMillis() } : Array.isArray(v) ? v.map(keJson) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, keJson(x)]));
const dariJson = v => v == null || typeof v !== 'object' ? v : Array.isArray(v) ? v.map(dariJson) : '__ts' in v && Object.keys(v).length === 1 ? Timestamp.fromMillis(v.__ts) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dariJson(x)]));

let berkas = null;   // isi file yang dipilih untuk dipulihkan

function renderBackup() {
  const b = S.settings.backupTerakhir, u = umurBackup();
  $('#view').innerHTML = `<div class="grid" style="max-width:860px">
   <div class="panel"><h3>Backup data</h3>
    <div class="tiles"><div class="tile"><span class="lbl">Backup terakhir</span><span class="val" style="color:${perluBackup() ? 'var(--warn)' : 'var(--good)'}">${b ? (u === 0 ? 'Hari ini' : u + ' hari lalu') : 'Belum pernah'}</span><span class="sub">${b ? esc(b.tgl) + ' · ' + esc(b.oleh || '') + ' · ' + (b.dokumen || 0).toLocaleString('id-ID') + ' data' : 'segera lakukan backup pertama'}</span></div></div>
    <p style="margin:0">Satu file berisi <b>semua</b> data: master part &amp; stok, konsumen &amp; kendaraan, nota, WO, pembelian, kartu stok, opname, kas, pengeluaran, klaim, gaji &amp; slip, petugas, dan pengaturan. Simpan file di <b>dua tempat</b> (mis. Google Drive dan flashdisk/laptop). Lakukan minimal <b>seminggu sekali</b> dan sebelum perubahan besar (import Excel, pembaruan aplikasi).</p>
    <p class="small muted" style="margin:0">File berisi data pribadi konsumen (KTP, HP) dan gaji karyawan. Jangan dibagikan; simpan di folder pribadi.</p>
    <div class="row"><button class="btn pri" type="button" data-act="bk-unduh">⬇ Backup sekarang</button><span class="small muted" id="bk-info"></span></div>
   </div>
   <div class="panel"><h3>Pulihkan dari backup</h3>
    <p class="small" style="margin:0">Untuk keadaan darurat (data terhapus/rusak). Data di file <b>menimpa</b> data dengan ID yang sama; data yang tidak ada di file tidak dihapus. Wajib kata sandi super admin.</p>
    <label class="f" for="bk-file">File backup (.json)<input id="bk-file" type="file" accept=".json,application/json"></label>
    <div id="bk-isi"></div>
   </div></div>`;
}

function isiBerkas() {
  const box = $('#bk-isi'); if (!box) return;
  if (!berkas) { box.innerHTML = ''; return; }
  const k = berkas.koleksi || {};
  box.innerHTML = `<div class="note small">Backup ${esc(berkas.app || '')} versi ${esc(berkas.versi || '?')} · dibuat ${esc(berkas.dibuat || '?')} oleh ${esc(berkas.oleh || '?')}${berkas.gagal?.length ? `<br><b>Tidak lengkap:</b> ${esc(berkas.gagal.join(', '))} tidak ikut ter-backup.` : ''}</div>
   <div class="tw"><table><thead><tr><th></th><th>Data</th><th class="r">Jumlah</th></tr></thead><tbody>
    ${Object.keys(k).map(n => `<tr><td><input type="checkbox" class="bk-pilih" data-k="${esc(n)}" ${['staff', 'gaji', 'penghasilan', 'meta', 'publik'].includes(n) ? '' : 'checked'} aria-label="Pulihkan ${esc(n)}"></td><td class="mono">${esc(n)}</td><td class="r num">${(k[n] || []).length.toLocaleString('id-ID')}</td></tr>`).join('')}
   </tbody></table></div>
   <p class="small muted" style="margin:0">Petugas, gaji, aturan insentif, dan pengaturan tidak dicentang secara bawaan; centang bila memang ingin dikembalikan.</p>
   <label class="f" for="bk-konfirm">Ketik <b>PULIHKAN</b> untuk melanjutkan<input id="bk-konfirm" data-nocaps autocomplete="off"></label>
   <div class="row"><button class="btn pri" type="button" data-act="bk-pulihkan">Pulihkan data terpilih</button><span class="small muted" id="bk-pinfo"></span></div>`;
}

views.backup = renderBackup;
refreshers.backup = () => {};
Object.assign(actions, {
  'bk-unduh': async el => {
    const info = $('#bk-info'), label = el.textContent; el.disabled = true;
    try {
      const koleksi = {}, gagal = []; let n = 0;
      for (const nama of KOLEKSI) {
        info.textContent = 'Membaca ' + nama + '…';
        try { const s = await getDocs(collection(db, nama)); koleksi[nama] = s.docs.map(d => ({ id: d.id, data: keJson(d.data()) })); n += s.size; }
        catch (e) { console.warn('Backup', nama, e); koleksi[nama] = []; gagal.push(nama); }
      }
      const isi = { app: APP_NAME, versi: APP_VERSION, dibuat: stamp(new Date()), oleh: st.petugas?.email || '', gagal, koleksi };
      const blob = new Blob([JSON.stringify(isi)], { type: 'application/json' }), url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = `backup-amu-${dkey(new Date())}.json`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
      await setDoc(doc(db, 'meta', 'settings'), { backupTerakhir: { tgl: stamp(new Date()), oleh: st.petugas?.nama || st.petugas?.email || '', dokumen: n, ukuran: blob.size } }, { merge: true });
      info.textContent = `Selesai: ${n.toLocaleString('id-ID')} data, ${(blob.size / 1048576).toFixed(1).replace('.', ',')} MB. Simpan file ke Google Drive/flashdisk.` + (gagal.length ? ` PERHATIAN: ${gagal.join(', ')} gagal dibaca (periksa firestore.rules sudah versi 4).` : '');
      toast(gagal.length ? 'Backup diunduh, tetapi ' + gagal.length + ' bagian gagal dibaca' : 'Backup diunduh');
    } catch (e) { info.textContent = ''; toast('Backup gagal: ' + errMsg(e)); }
    finally { el.disabled = false; el.textContent = label; }
  },
  'bk-pulihkan': async el => {
    if (!berkas) return;
    if (($('#bk-konfirm').value || '').trim().toUpperCase() !== 'PULIHKAN') { toast('Ketik PULIHKAN untuk konfirmasi'); return; }
    const pilih = [...document.querySelectorAll('.bk-pilih:checked')].map(x => x.dataset.k).filter(k => KOLEKSI.includes(k));
    if (!pilih.length) { toast('Pilih data yang dipulihkan'); return; }
    const total = pilih.reduce((a, k) => a + (berkas.koleksi[k] || []).length, 0);
    if (!(await mintaPassword('Pulihkan ' + total.toLocaleString('id-ID') + ' data', `Dari backup ${esc(berkas.dibuat || '')}: ${pilih.map(esc).join(', ')}. Data dengan ID yang sama akan ditimpa.`))) return;
    el.disabled = true;
    const info = $('#bk-pinfo'); let selesai = 0;
    try {
      for (const k of pilih) {
        const docs = berkas.koleksi[k] || [];
        for (let i = 0; i < docs.length; i += 400) {
          const b = writeBatch(db);
          docs.slice(i, i + 400).forEach(d => b.set(doc(db, k, d.id), dariJson(d.data)));
          await b.commit(); selesai += Math.min(400, docs.length - i);
          if (info) info.textContent = `Memulihkan ${k}: ${selesai.toLocaleString('id-ID')} / ${total.toLocaleString('id-ID')}`;
        }
      }
      toast('Pemulihan selesai: ' + selesai.toLocaleString('id-ID') + ' data'); berkas = null; renderBackup();
    } catch (e) { toast('Pemulihan berhenti di ' + selesai + ' data: ' + errMsg(e)); el.disabled = false; }
  }
});
changeHandlers.push(async e => {
  if (e.target.id !== 'bk-file') return;
  const f = e.target.files?.[0]; berkas = null;
  if (f) {
    try { const j = JSON.parse(await f.text()); if (!j.koleksi || typeof j.koleksi !== 'object') throw new Error('Bukan file backup aplikasi ini'); berkas = j; }
    catch (err) { toast('File tidak bisa dibaca: ' + err.message); }
  }
  isiBerkas();
});
