// Menu Registrasi Servis: data konsumen & kendaraan, keluhan, jenis servis (Reguler/KSB/KSG), jasa, mekanik.
import { $, esc, rp, dkey, stamp, clone, toast, errMsg, waButton, waNumber, konfirmasi, modal } from './util.js';
import { APP_NAME } from './config.js';
import { S, st, views, refreshers, actions, inputHandlers, changeHandlers, fkeys, tipeList, jasaAktif, mekanikAktif, mekanikById, isRole, namaPetugas } from './state.js';
import { JENIS_SERVIS } from './config.js';
import { db, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc, collection, query, where, limit, documentId } from './firebase.js';
import { pindahPantau, AKTIF, normJasa, woCalc, woCard, sibukOleh, tarifKsg, saveWo, findWo, statusPill, jenisBadge, logStatus, timelineHTML, syncPantau, partsTable, fmtAntri, kurangBadge, tundaInfo, mekanikNama, syncLayar, laporStatus } from './wo-common.js';
import { showAntrian } from './antrian.js';
import { bedaKonsumen, simpanDenganCatatan } from './log-konsumen.js';
import { wilayahHTML, fillWilayah, WIL_FIELDS } from './wilayah.js';

import { cariKendaraan, nopolKey } from './cari-kendaraan.js';
import { kmTerakhir, angkaKm, fmtKm, tglPendek, statusOli, teksJadwal, catatOliLuar } from './km-oli.js';
import { mintaCatatan } from './kontrol.js';
import { pilihan } from './util.js';
import { ambilKonsumen, konsumenGanda, cariKonsumen, buatKonsumen, ubahKonsumen, tambahMotorKe, lepasMotorDari, pindahkanMotor, ambilKtp, KTP } from './konsumen-data.js';
import { simpanDenganCatatan as _simpanLog } from './log-konsumen.js';
import { pindahPantauKunci } from './wo-common.js';
export { nopolKey };
// Data konsumen sesuai KTP + data kendaraan sesuai STNK (disimpan bersama per kendaraan di koleksi kendaraan)
export const KONSUMEN_FIELDS = ['nik', 'nama', 'tempatLahir', 'tglLahir', 'jk', 'pekerjaan', 'hp', 'rtrw', ...WIL_FIELDS];
const UNIT_FIELDS = ['nopol', 'namaStnk', 'stnkSama', 'tipe', 'tahun', 'warna', 'noRangka', 'noMesin'];
const KEND_FIELDS = [...KONSUMEN_FIELDS, ...UNIT_FIELDS];
const blank = () => ({ no: null, tgl: stamp(new Date()), nik: '', nama: '', tempatLahir: '', tglLahir: '', jk: '', pekerjaan: '', hp: '', rtrw: '', namaStnk: '', stnkSama: true, nopol: '', provinsi: '', kabKode: '', kabupaten: '', kecamatan: '', kelurahan: '', alamat: '', tipe: '', tahun: '', warna: '', noRangka: '', noMesin: '', km: '', keluhan: '', jenisServis: 'KSB', ksgKe: '', noKartu: '', jasa: [], mekanikId: '', mekanik: '', parts: [], biaya: [], catatanPart: '', estimasi: '', bastTgl: dkey(new Date()), bastJam: new Date().toTimeString().slice(0, 5), bastKet: '', status: 'Antri', konsumenId: '' });
let filter = 'aktif';
const waMsg = w => `Halo ${w.nama || 'Bapak/Ibu'}, kami dari ${APP_NAME} mengenai motor ${w.nopol || ''}${w.antrian ? ' (antrian ' + fmtAntri(w.antrian) + ')' : ''}. `;

// Satu kendaraan hanya boleh punya satu servis yang masih di bengkel (Antri/Dikerjakan/Ditunda/Selesai)
const woAktifNopol = (nopol, kecualiNo) => { const k = nopolKey(nopol); if (!k) return null; return (S.woSemua?.length ? S.woSemua : S.wo).find(w => w.no !== kecualiNo && AKTIF.includes(w.status) && nopolKey(w.nopol) === k) || null; };
async function peringatanGanda(lama) {
  const ok = await konfirmasi(lama.nopol + ' masih di bengkel', `Kendaraan ini sudah terdaftar dan belum selesai/dibayar:<br><b>Antrian ${esc(fmtAntri(lama.antrian) || '–')}</b> · <span class="mono">${esc(lama.no)}</span> · ${esc(lama.status)}${mekanikNama(lama) ? ' · ' + esc(mekanikNama(lama)) : ''}
    ${lama.status === 'Ditunda' ? `<div class="tunda-box" style="margin-top:6px">${tundaInfo(lama)}</div>` : ''}
    <p style="margin:8px 0 0">Satu kendaraan tidak bisa didaftarkan dua kali. ${lama.status === 'Ditunda' ? 'Buka servis ini lalu tekan <b>Lanjutkan dikerjakan</b>.' : 'Buka servis ini untuk mengubah datanya.'}</p>`, { ya: 'Buka servis ' + (fmtAntri(lama.antrian) || lama.no), tidak: 'Tutup' });
  if (ok && (S.wo.find(w => w.no === lama.no))) { st.regDraft = { ...blank(), ...clone(lama), jasa: normJasa(lama) }; renderRegistrasi(); }
  else if (ok) toast(lama.no + ' ada di cabang lain. Pindah cabang dulu untuk membukanya.');
}

function listWo() {
  const t = dkey(new Date());
  const l = [...S.wo].reverse();
  if (filter === 'aktif') return l.filter(w => AKTIF.includes(w.status));
  if (filter === 'hari') return l.filter(w => w.tgl.slice(0, 10) === t);
  if (filter === 'tunda') return l.filter(w => w.status === 'Ditunda');
  return l;
}
function renderList() {
  const el = $('#reg-list'); if (!el) return;
  const l = listWo();
  el.innerHTML = l.map(o => woCard(o, st.regDraft?.no, 'reg-pick')).join('') || `<div class="empty">${filter === 'tunda' ? 'Tidak ada motor yang ditunda.' : 'Belum ada motor masuk.'}</div>`;
  const n = S.wo.filter(w => w.status === 'Ditunda').length, c = $('#reg-ntunda');
  if (c) { c.textContent = n; c.hidden = !n; }
}

// Mekanik hanya 1 motor: yang sedang mengerjakan motor lain tidak bisa dipilih
function mekanikOptions(w) {
  const list = mekanikAktif().map(m => ({ m, busy: sibukOleh(m, w.no) })).sort((a, b) => !!a.busy - !!b.busy || a.m.nama.localeCompare(b.m.nama));
  return `<option value="">Belum ada mekanik (antri)</option>` + list.map(({ m, busy }) => `<option value="${esc(m.id)}" ${m.id === w.mekanikId ? 'selected' : ''} ${busy && m.id !== w.mekanikId ? 'disabled' : ''}>${esc(m.nama)} — ${busy ? 'sibuk (' + esc(busy.nopol) + ')' : 'kosong'}</option>`).join('');
}

function laporanStatusHTML(w) {
  if (!w.no || !['Dikerjakan', 'Ditunda', 'Selesai'].includes(w.status) || !(isRole('registrasi') || isRole('admin'))) return '';
  if (w.status === 'Dikerjakan') return `<div class="note"><b>Laporan mekanik ${esc(mekanikNama(w) || '–')}</b>
    <div class="row" style="margin-top:6px"><button class="btn pri" type="button" data-act="reg-status" data-s="Selesai" data-no="${esc(w.no)}">Motor selesai</button><input id="reg-tunda" class="inline-input" placeholder="Alasan lanjut lama (wajib), mis. tunggu part" aria-label="Alasan lanjut lama" style="flex:1 1 230px"><button class="btn" type="button" data-act="reg-status" data-s="Ditunda" data-no="${esc(w.no)}">Lanjut lama (tunda)</button></div>
    <div class="small muted" style="margin-top:4px">Register menekan tombol setelah menerima laporan mekanik. Kedua pilihan membuat mekanik kosong.</div></div>`;
  if (w.status === 'Ditunda') return `<div class="tunda-box">${tundaInfo(w)}
    <div class="row" style="margin-top:6px"><button class="btn pri" type="button" data-act="reg-status" data-s="Selesai" data-no="${esc(w.no)}">Motor sudah selesai</button><span class="small muted">Untuk mengerjakan lagi, pilih mekanik kosong lalu tekan Lanjutkan dikerjakan.</span></div></div>`;
  return '<div class="note p-good"><b>Laporan selesai diterima Register.</b> Nomor antrean dipanggil ke REGISTER di layar TV; motor siap dibayar oleh kasir.</div>';
}
const bastKode = w => w.jenisServis === 'KSG' ? 'KSG' + (w.ksgKe || '') : w.jenisServis === 'KSB' ? 'KSB' : '';
const hariTanggal = t => t ? new Date(t + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '–';
function bastKendHtml(w, print = false) {
  const kode = bastKode(w), items = w.parts || [], jasa = normJasa(w);
  return `<div class="bk-doc ${print ? 'bk-print' : ''}"><div class="bk-head"><div><h1>BAST KENDARAAN MASUK</h1><div>BERITA ACARA SERAH TERIMA DARI KONSUMEN KE BENGKEL</div></div><div class="bk-code"><b>${esc(kode)}</b></div></div>
  <div class="bk-meta"><div><b>Data konsumen</b><br>Nama: ${esc(w.nama || '–')}<br>NIK: ${esc(w.nik || '–')}<br>No. HP/WA: ${esc(w.hp || '–')}</div><div><b>Data kendaraan</b><br>No. Polisi: <b>${esc(w.nopol || '–')}</b><br>Tipe: ${esc(w.tipe || '–')} · Tahun: ${esc(w.tahun || '–')}<br>Warna: ${esc(w.warna || '–')}<br>KM: ${esc(w.km || '–')}</div></div>
  <p class="bk-intro">Dengan ini konsumen menyerahkan kendaraan kepada bengkel untuk dilakukan pemeriksaan dan pengerjaan servis sesuai rincian berikut.</p><h3>Pengerjaan</h3><p>${esc(w.keluhan || '–')}</p><p><b>Jenis layanan:</b> ${esc(kode || w.jenisServis || '–')}${w.ksgKe ? ' · KSG ke-' + esc(w.ksgKe) : ''} · <b>Mekanik:</b> ${esc(w.mekanik || '–')}</p>
  <h3>Rincian part dan jasa</h3><table class="bk-table"><thead><tr><th>No.</th><th>Jenis</th><th>Rincian</th><th class="r">Qty</th></tr></thead><tbody>${jasa.map((x,i)=>`<tr><td>${i+1}</td><td>Jasa</td><td>${esc(x.nama)}</td><td class="r">1</td></tr>`).join('')}${items.map((x,i)=>`<tr><td>${jasa.length+i+1}</td><td>Part</td><td>${esc(x.nama || x.kode)} <span class="small">${esc(x.kode || '')}</span></td><td class="r">${x.qty}</td></tr>`).join('')}${!jasa.length && !items.length ? '<tr><td colspan="4">Tidak ada rincian part/jasa.</td></tr>' : ''}</tbody></table>
  <div class="bk-est"><b>Estimasi selesai / kendaraan dapat diambil:</b> ${esc(w.estimasi || '–')}</div><p><b>Hari, tanggal, jam:</b> ${esc(hariTanggal(w.bastTgl))}, ${esc(w.bastJam || '–')}</p><p><b>Keterangan:</b> ${esc(w.bastKet || 'Kendaraan diterima bengkel dari konsumen untuk dilakukan pengerjaan. BAST ini disimpan konsumen dan dibawa saat pengambilan kendaraan.')}</p>
  <div class="bk-sign"><div>Diserahkan oleh Konsumen<div class="bk-space"></div><b>${esc(w.nama || '________________')}</b></div><div>Diterima oleh Bengkel<div class="bk-space"></div><b>${esc(namaPetugas() || '________________')}</b></div></div></div>`;
}
function bastKendCss() { return `.bk-doc{font-family:Arial,sans-serif;color:#20242a;max-width:820px;margin:0 auto;padding:30px;background:#fff;font-size:13px;line-height:1.45}.bk-head{display:flex;justify-content:space-between;border-bottom:2px solid #20242a;padding-bottom:12px}.bk-head h1{margin:0 0 3px;font-size:21px}.bk-code{font-size:25px;border:2px solid #20242a;padding:8px 14px;height:max-content}.bk-meta{display:grid;grid-template-columns:1fr 1fr;gap:35px;margin:20px 0}.bk-doc h3{font-size:14px;border-bottom:1px solid #999;padding-bottom:4px;margin:15px 0 7px}.bk-table{width:100%;border-collapse:collapse}.bk-table th,.bk-table td{border:1px solid #555;padding:6px 8px}.bk-table th{text-align:left;background:#f0f1f3}.bk-table .r{text-align:right}.bk-intro{margin:18px 0 10px}.bk-est{border:1px solid #555;padding:10px;margin:18px 0;font-size:15px}.bk-sign{display:grid;grid-template-columns:1fr 1fr;gap:70px;text-align:center;margin-top:40px}.bk-space{height:52px}.small{font-size:11px;color:#666}@media print{@page{size:A4 portrait;margin:14mm}.bk-doc{padding:0;max-width:none}.no-print{display:none}}`; }
function bastKendPrint(w) { const x=window.open('', '_blank'); if (!x) { toast('Izinkan pop-up untuk membuka preview BAST'); return; } x.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>BAST ${esc(bastKode(w))} ${esc(w.nopol || '')}</title><style>${bastKendCss()}</style></head><body>${bastKendHtml(w,true)}<script>window.onload=()=>{window.focus();window.print()}<\/script></body></html>`); x.document.close(); }
function bastKendOpen(w) { modal(`<style>${bastKendCss()}</style><div class="row spread no-print"><h2>BAST Kendaraan · ${esc(bastKode(w))}</h2><button class="btn sm ghost" type="button" data-close="1">✕</button></div>${bastKendHtml(w)}<div class="row no-print" style="justify-content:flex-end"><button class="btn pri" type="button" data-act="reg-bast-print">Print / Simpan PDF</button></div>`, 'wide'); }

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
    <div class="seg" role="group" aria-label="Tampilkan">${[['aktif', 'Aktif'], ['hari', 'Hari ini'], ['tunda', 'Ditunda'], ['semua', 'Semua']].map(([k, l]) => `<button type="button" data-act="reg-filter" data-f="${k}" aria-pressed="${k === filter}" title="${k === 'tunda' ? 'Motor yang pengerjaannya ditunda (lanjut lama) beserta alasannya' : ''}">${l}${k === 'tunda' ? '<span class="cnt" id="reg-ntunda" hidden></span>' : ''}</button>`).join('')}</div>
    <div class="wolist" id="reg-list"></div>
   </div>
   <div class="panel"><div class="row spread"><h2 class="row" style="gap:10px">${w.no ? `<span>Antrian ${fmtAntri(w.antrian) || '–'}</span> <span class="small muted mono" title="Nomor kartu kerja (work order)">${esc(w.no)}</span><button class="btn sm ghost" type="button" data-act="rw-buka" data-np="${esc(w.nopol)}">Riwayat motor</button>` : 'Registrasi motor masuk'}${(w.jenisServis === 'KSG' || w.jenisServis === 'KSB') ? '<button class="btn sm pri" type="button" data-act="reg-bast" title="BAST serah terima konsumen ke bengkel">BAST masuk</button>' : ''}</h2>${w.no ? `<span class="row">${kurangBadge(w)}${jenisBadge(w)}${statusPill(w.status)}</span>` : ''}</div>
    ${w.status === 'Ditunda' && w.no ? `<div class="tunda-box">${tundaInfo(w)}<div class="small" style="margin-top:4px">Untuk melanjutkan: pilih mekanik yang kosong di bagian <b>3. Servis</b> (boleh mekanik yang sama atau lain), lalu tekan <b>Lanjutkan dikerjakan</b>.</div></div>` : ''}
    ${laporanStatusHTML(w)}
    ${locked ? '' : `<div class="cari-box"><label class="f" for="r-cari">Pernah servis di sini? Cari data lama<span class="row" style="gap:6px"><input id="r-cari" placeholder="No. polisi, nama, no. HP, NIK, no. rangka, atau no. mesin — boleh sebagian (F3)" autocomplete="off" style="flex:1 1 220px"><button class="btn" type="button" data-act="reg-cari">Cari [F3]</button></span></label><div id="r-cari-hasil"></div></div>`}
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
    ${w.pengantar ? `<div class="note small">🚶 <b>Diantar oleh ${esc(w.pengantar.nama || '')}</b> ${esc(w.pengantar.hp || '')} ${waButton(w.pengantar.hp, waMsg(w))} — pemilik motor tetap ${esc(w.nama)}. ${locked ? '' : '<button class="link-btn" type="button" data-act="reg-hapus-antar">hapus</button>'}</div>` : ''}
    <h3>2. Data kendaraan <span class="h-sub">sesuai STNK</span></h3>
    <div class="form">
     ${inp('nopol', 'No. Polisi', 'class="mono" placeholder="BL 1234 XX" autocomplete="off"')}
     <div class="f wide" id="r-pemilik"></div>
     <div class="f wide-2"><span class="f-wa"><label for="r-namaStnk">Nama di STNK</label><label class="chk small" for="r-stnkSama"><input type="checkbox" id="r-stnkSama" ${w.stnkSama !== false ? 'checked' : ''} ${dis}>sama dengan konsumen</label></span><input id="r-namaStnk" data-rf="namaStnk" value="${esc(w.stnkSama !== false ? w.nama : w.namaStnk)}" ${w.stnkSama !== false || locked ? 'disabled' : ''}></div>
     <label class="f" for="r-tipe">Tipe motor<select id="r-tipe" data-rf="tipe" ${dis}><option value="">Pilih tipe</option>${[...new Set([...tipeList(), w.tipe].filter(Boolean))].map(t => `<option ${t === w.tipe ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
     ${inp('tahun', 'Tahun pembuatan', 'inputmode="numeric" class="num" maxlength="4"')}
     ${inp('warna', 'Warna')}
     ${inp('noRangka', 'No. rangka', 'class="mono"')}
     ${inp('noMesin', 'No. mesin', 'class="mono"')}
     <label class="f" for="r-km"><span class="f-wa">Kilometer saat ini<span class="small muted" id="r-km-info"></span></span><input id="r-km" data-rf="km" value="${esc(w.km)}" data-num class="num" placeholder="mis. 12.500" ${dis}></label>
    </div>
    <div id="r-oli"></div>
    <h3>3. Servis</h3>
    <div class="form">
     <label class="f" for="r-jenis">Jenis servis<select id="r-jenis" data-rf="jenisServis" ${dis}>${Object.entries(JENIS_SERVIS).filter(([k]) => ['KSB', 'KSG'].includes(k) || k === w.jenisServis).map(([k, l]) => `<option value="${k}" ${k === w.jenisServis ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
     ${w.jenisServis === 'KSG' ? `<label class="f" for="r-ksgke">KSG ke-<select id="r-ksgke" data-rf="ksgKe" ${dis}><option value="">Pilih</option>${[1, 2, 3, 4].map(n => `<option ${String(n) === String(w.ksgKe) ? 'selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
     ${w.jenisServis !== 'Reguler' ? inp('noKartu', w.jenisServis === 'KSG' ? 'No. kupon / buku servis' : 'No. kartu KSB', 'class="mono"') : ''}
     <label class="f" for="r-mek">Mekanik<select id="r-mek" data-rf="mekanikId" ${dis}>${mekanikOptions(w)}</select></label>
     <label class="f wide" for="r-keluhan">Keluhan konsumen<textarea id="r-keluhan" data-rf="keluhan" ${dis}>${esc(w.keluhan)}</textarea></label>
    </div>
    ${w.jenisServis === 'KSG' ? `<div class="note small">KSG: jasa standar tidak dipilih satu per satu dan tidak ditagihkan ke konsumen. ${w.tipe && w.ksgKe ? (tarifKsg(w) ? `Klaim ke main dealer (${esc(w.tipe)}, KSG ke-${esc(w.ksgKe)}): <b>${rp(tarifKsg(w))}</b>.` : `<span class="diff-bad">Tarif KSG ${esc(w.tipe)} ke-${esc(w.ksgKe)} belum diisi</span> di Master Data → Tarif KSG.`) : 'Pilih tipe motor dan KSG ke berapa untuk melihat nilai klaim.'} Part dan jasa/biaya tambahan tetap ditampilkan.</div>` : ''}
    <h3>${w.jenisServis === 'KSG' ? 'Jasa lainnya' : 'Jasa servis'}</h3>
    ${w.jenisServis === 'KSG' ? '<div class="small muted">Jasa KSG otomatis mengikuti KSG ke-berapa. Tidak ada checklist jasa standar untuk KSG.</div>' : `<div class="checks">${[...jasaList, ...extra].map((j, i) => `<label for="r-j${i}"><input type="checkbox" id="r-j${i}" data-jasa="${esc(j.nama)}" data-harga="${j.harga}" ${selected.find(x => x.nama === j.nama) ? 'checked' : ''} ${dis}>${esc(j.nama)}<span class="hr">${rp(j.harga)}</span></label>`).join('') || '<div class="small muted">Belum ada jasa. Tambahkan di Master Data → Jasa Servis.</div>'}</div>`}
    <h3>Rincian part</h3>${partsTable(w)}
    ${w.no ? timelineHTML(w) : ''}
    ${(w.jenisServis === 'KSG' || w.jenisServis === 'KSB') ? `<h3>BAST kendaraan <span class="badge ${w.jenisServis === 'KSG' ? 'b-ksg' : 'b-ksb'}">${esc(bastKode(w))}</span></h3><div class="form"><label class="f wide" for="r-estimasi">Estimasi selesai / pengambilan (manual)<input id="r-estimasi" data-rf="estimasi" value="${esc(w.estimasi || '')}" placeholder="mis. Sore ini / 2 hari" ${dis}></label><label class="f" for="r-bastTgl">Tanggal BAST<input id="r-bastTgl" type="date" data-rf="bastTgl" value="${esc(w.bastTgl || dkey(new Date()))}" ${dis}></label><label class="f" for="r-bastJam">Jam<input id="r-bastJam" type="time" data-rf="bastJam" value="${esc(w.bastJam || '')}" ${dis}></label><label class="f wide-2" for="r-bastKet">Keterangan BAST<textarea id="r-bastKet" data-rf="bastKet" placeholder="Kendaraan diterima bengkel dari konsumen" ${dis}>${esc(w.bastKet || 'Kendaraan diterima bengkel dari konsumen untuk dilakukan pengerjaan. BAST ini disimpan konsumen dan dibawa saat pengambilan kendaraan.')}</textarea></label></div><div class="row" style="justify-content:flex-end"><button class="btn" type="button" data-act="reg-bast">Cetak BAST masuk ${esc(bastKode(w))}</button></div>` : ''}
    <h3>Biaya lainnya</h3>
    <div class="small muted" style="margin-bottom:6px">Tambahkan biaya di luar jasa dan sparepart, misalnya cuci motor, las, atau biaya lain. Biaya ini akan masuk ke total pembayaran Kasir.</div>
    <div class="tw"><table><thead><tr><th>Keterangan</th><th class="r">Nominal (Rp)</th>${locked ? '' : '<th></th>'}</tr></thead><tbody>${(w.biaya || []).length ? (w.biaya || []).map((b, i) => `<tr><td><input class="inline-input" data-bi="${i}" data-bf="ket" value="${esc(b.ket || '')}" placeholder="mis. Cuci motor" ${dis}></td><td><input class="inline-input num" data-bi="${i}" data-bf="jumlah" type="number" min="0" step="1000" value="${b.jumlah || ''}" placeholder="0" style="text-align:right" ${dis}></td>${locked ? '' : `<td><button class="btn sm ghost" type="button" data-act="reg-rm-biaya" data-i="${i}" aria-label="Hapus biaya">✕</button></td>`}</tr>`).join('') : `<tr><td colspan="${locked ? 2 : 3}" class="small muted">Belum ada biaya lainnya.</td></tr>`}</tbody></table></div>
    ${locked ? '' : '<button class="btn sm" type="button" data-act="reg-add-biaya">+ Tambah biaya lainnya</button>'}
    <div class="totals small"><span class="muted">Jasa ditagih</span><span class="num">${rp(c.jasaTagih)}</span>${c.klaim ? `<span class="muted">Klaim KSG</span><span class="num">${rp(c.klaim)}</span>` : ''}${w.parts.length ? `<span class="muted">Order sparepart</span><span class="num">${rp(c.parts)}</span>` : ''}${c.biaya ? `<span class="muted">Biaya lainnya</span><span class="num">${rp(c.biaya)}</span>` : ''}</div>
    <div class="row" style="justify-content:flex-end">
     ${w.no && !locked && isRole('admin') ? `<label class="f" for="r-status" style="flex-direction:row;align-items:center;gap:6px">Status<select id="r-status" style="width:auto">${AKTIF.map(s => `<option ${s === w.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>` : ''}
     ${w.status === 'Ditunda' && !locked ? '<button class="btn warn" type="button" data-act="reg-lanjut">▶ Lanjutkan dikerjakan</button>' : ''}
     ${w.no && !locked && isRole('admin') ? '<button class="btn ghost" type="button" data-act="reg-hapus" title="Untuk pendaftaran ganda / salah daftar">Batalkan pendaftaran</button>' : ''}
    ${locked ? '<span class="small muted">Sudah dibayar, tidak bisa diubah.</span>' : `${w.no ? '' : '<button class="btn" type="button" data-act="reg-cepat" title="Saat ramai: nomor antrian langsung keluar hanya dengan nomor polisi, data lain dilengkapi sesudahnya">Nomor cepat (cukup nopol)</button>'}<button class="btn pri" type="button" data-act="reg-save">${w.no ? 'Simpan perubahan' : 'Daftarkan &amp; beri nomor antrian'} [F2]</button>`}
    </div>
   </div></div>`;
  renderList();
  fillWilayah('rw', { get: () => st.regDraft });
  isiInfoKm();
  if (w.nopol) {
    const key = nopolKey(w.nopol);
    if (cachePemilik.key === key) tampilPemilik(cachePemilik.data);
    else getDoc(doc(db, 'kendaraan', key)).then(s2 => { cachePemilik = { key, data: s2.exists() ? s2.data() : null }; if (st.regDraft === w) tampilPemilik(cachePemilik.data); }).catch(() => {});
  }
}

// KM terakhir & jadwal ganti oli kendaraan ini (ditampilkan di formulir, dipakai juga untuk cek KM saat simpan)
let infoKm = { key: '', no: null, akhir: null, oli: null };
async function isiInfoKm() {
  const w = st.regDraft, key = nopolKey(w?.nopol);
  if (!key) { infoKm = { key: '', akhir: null, oli: null }; tampilInfoKm(); return; }
  if (infoKm.key !== key || infoKm.no !== w.no) {
    const akhir = await kmTerakhir(w.nopol, w.no);
    let oli = null; try { const s = await getDoc(doc(db, 'kendaraan', key)); oli = s.exists() ? s.data().oli || null : null; } catch (e) {}
    if (nopolKey(st.regDraft?.nopol) !== key) return;
    infoKm = { key, no: w.no, akhir, oli };
  }
  tampilInfoKm();
}
function tampilInfoKm() {
  const el = $('#r-km-info'), w = st.regDraft; if (!el || !w) return;
  const a = infoKm.akhir, km = angkaKm(w.km), kurang = a && km && km < a.km && !w.kmReset;
  el.className = 'small ' + (kurang ? 'diff-bad' : 'muted');
  el.textContent = a ? (kurang ? `min. ${fmtKm(a.km)}!` : `terakhir ${fmtKm(a.km)} · ${tglPendek(a.tgl)}`) : '';
  el.title = a ? `KM terakhir ${fmtKm(a.km)} (${a.asal}, ${a.tgl}). KM baru tidak boleh lebih kecil.` : '';
  const box = $('#r-oli'); if (!box) return;
  const o = infoKm.oli, s = statusOli(o, km);
  box.innerHTML = o && w.status !== 'Lunas' ? `<div class="note small row spread" style="gap:6px"><span>🛢 Ganti oli terakhir <b>${esc(tglPendek(o.tgl))}</b>${o.km ? ' di KM ' + fmtKm(angkaKm(o.km)) : ''}${o.sumber === 'luar' ? ' (di luar)' : ''} · jadwal berikut <b>${esc(teksJadwal(o))}</b> ${s ? `<span class="pill ${s.kelas}">${esc(s.teks)}</span>` : ''}</span><button class="btn sm ghost" type="button" data-act="reg-oli-luar" title="Konsumen bilang sudah ganti oli di bengkel lain">Sudah ganti oli di luar?</button></div>` : '';
}

async function lookupKendaraan(nopol) {
  const key = nopolKey(nopol); if (!key) return;
  try {
    const s = await getDoc(doc(db, 'kendaraan', key));
    if (!s.exists()) { tampilPemilik(); return; }
    const k = s.data(), w = st.regDraft;
    if (k.pindahKe) { const n2 = await getDoc(doc(db, 'kendaraan', k.pindahKe)).catch(() => null); const baru = n2?.data()?.nopol || k.pindahKe; toast(`Plat ${k.nopol} sudah berganti ke ${baru}`); w.nopol = baru; renderRegistrasi(); return lookupKendaraan(baru); }
    let filled = false;
    if (!w.konsumenId && !w.nama && k.konsumenId) w.konsumenId = k.konsumenId;
    KEND_FIELDS.forEach(f => { if (f !== 'nopol' && (w[f] === '' || w[f] == null) && k[f] != null && k[f] !== '') { w[f] = k[f]; filled = true; } });
    if (filled) { renderRegistrasi(); toast('Kendaraan terdaftar: data ' + (k.nama || k.nopol) + ' diisi otomatis'); }
    tampilPemilik(k);
  } catch (e) { /* lookup gagal tidak menghalangi registrasi */ }
}
let cachePemilik = { key: '', data: null };
// Info pemilik di bawah no. polisi: pemilik tercatat (motor lama) atau motor ke-n konsumen yang dipilih
async function tampilPemilik(kend) {
  const el = $('#r-pemilik'), w = st.regDraft; if (!el || !w) return;
  let html = '';
  try {
    if (kend?.konsumenId) {
      const p = await ambilKonsumen(kend.konsumenId);
      if (p) html = `👤 Pemilik tercatat: <b>${esc(p.nama)}</b> ${esc(p.hp || '')}${(p.motor || []).length > 1 ? ` · ${p.motor.length} motor` : ''}${w.konsumenId && w.konsumenId !== p.id ? ' <span class="diff-bad">— konsumen yang dipilih berbeda (ganti pemilik / hanya mengantar ditanyakan saat simpan)</span>' : ''}${(kend.riwayatPemilik || []).length ? `<div class="small muted">Pemilik sebelumnya: ${kend.riwayatPemilik.map(x => esc(x.nama || '?') + ' (s/d ' + esc(String(x.sampai).slice(0, 10)) + ')').join(', ')}</div>` : ''}`;
    } else if (!kend && w.konsumenId) {
      const p = await ambilKonsumen(w.konsumenId);
      if (p && (p.motor || []).length) html = `🏍 Motor baru untuk <b>${esc(p.nama)}</b> — sudah punya ${p.motor.length} motor: ${p.motor.map(esc).join(', ')}. Pastikan ini memang motor lain (bukan salah ketik nopol).`;
    }
  } catch (e) { /* abaikan */ }
  if (st.regDraft === w) el.innerHTML = html ? `<div class="note small">${html}</div>` : '';
}

// Cari data servis sebelumnya dengan salah satu: nopol, no. rangka, no. mesin, NIK, no. HP, atau nama.
// Cukup sebagian depannya (mis. "BL123" menemukan BL 1234 NN). Data servis yang sudah dimuat juga dicocokkan
// di bagian mana pun (mis. "1234" atau "NN").
let hasilCari = [];
async function cariData() {
  const box = $('#r-cari-hasil');
  box.innerHTML = '<div class="small muted">Mencari…</div>';
  const teks = $('#r-cari')?.value || '';
  const [hasil, kons] = await Promise.all([cariKendaraan(teks), cariKonsumen(teks).catch(() => [])]);
  if (!hasil) { box.innerHTML = ''; toast('Ketik minimal 3 huruf/angka'); return; }
  hasilCari = hasil.filter(k => !k.pindahKe); hasilKons = kons || [];
  box.innerHTML = (hasilKons.length ? `<div class="small muted">Konsumen</div><div class="cari-hasil">${hasilKons.map((k, i) => `<div class="cari-item"><div><b>👤 ${esc(k.nama)}</b> <span class="mono small">${esc(k.hp || '')}</span><div class="small muted">${esc([k.kelurahan, k.kecamatan].filter(Boolean).join(', '))}${k.nik ? ' · NIK ' + esc(k.nik) : ''}</div><div class="small">${(k.motor || []).length ? 'Motor: ' + k.motor.map((m, j) => `<button class="link-btn mono" type="button" data-act="reg-pakai-km" data-i="${i}" data-n="${esc(m)}" title="Pakai konsumen & motor ini">${esc(m)}</button>`).join(', ') : '<span class="muted">belum ada motor</span>'}</div></div><button class="btn sm" type="button" data-act="reg-pakai-k" data-i="${i}" title="Isi data konsumen; isi data motor (baru) di bagian 2">Pakai konsumen</button></div>`).join('')}</div>` : '') + (hasilCari.length ? `<div class="small muted">${hasilCari.length} ditemukan${hasilCari.length === 15 ? ' (ketik lebih lengkap untuk mempersempit)' : ''}</div><div class="cari-hasil">${hasilCari.map((k, i) => `<div class="cari-item"><div><b class="mono">${esc(k.nopol)}</b> · ${esc(k.tipe || '')} ${esc(k.warna || '')}<div class="small muted">${esc(k.nama || '–')}${k.nik ? ' · NIK ' + esc(k.nik) : ''}${k.hp ? ' · ' + esc(k.hp) : ''}</div><div class="small muted">${k.noRangka ? 'Rangka ' + esc(k.noRangka) : ''}${k.noMesin ? ' · Mesin ' + esc(k.noMesin) : ''}</div></div><div class="row" style="gap:6px"><button class="btn sm" type="button" data-act="reg-pakai" data-i="${i}" data-m="semua">Pakai data</button><button class="btn sm ghost" type="button" data-act="reg-pakai" data-i="${i}" data-m="konsumen" title="Untuk motor lain milik konsumen yang sama">Konsumen saja</button></div></div>`).join('')}</div>`
    : hasilKons.length ? '' : '<div class="small muted">Tidak ditemukan. Coba ketik bagian lain (mis. angka plat saja, nama, atau no. HP), atau isi data baru di bawah.</div>');
}
let hasilKons = [];
// Isi data KTP dari database konsumen
function isiDariKonsumen(w, k) { KTP.forEach(f => { w[f] = k[f] || ''; }); w.konsumenId = k.id; if (w.stnkSama !== false) w.namaStnk = w.nama; delete w._hpBersama; }
async function pakaiKonsumen(el, nopol) {
  const k = hasilKons[+el.dataset.i]; if (!k) return;
  const w = st.regDraft;
  if (nopol) { const g = woAktifNopol(nopol); if (g && !w.no) { peringatanGanda(g); return; } }
  isiDariKonsumen(w, k);
  if (nopol && !w.no) {
    const s2 = await getDoc(doc(db, 'kendaraan', nopol)).catch(() => null), m = s2?.exists() ? s2.data() : null;
    if (m) { ['nopol', 'namaStnk', 'stnkSama', 'tipe', 'tahun', 'warna', 'noRangka', 'noMesin'].forEach(f => { if (m[f] != null && m[f] !== '') w[f] = m[f]; }); }
  }
  renderRegistrasi(); toast(`Data ${k.nama} dipakai${nopol ? ' dengan motor ' + nopol : '. Isi data motornya di bagian 2'}.`);
  if (!nopol && !w.no) $('#r-nopol')?.focus();
}
function pakaiData(el) {
  const k = hasilCari[+el.dataset.i]; if (!k) return;
  if (el.dataset.m !== 'konsumen' && !st.regDraft.no) { const g = woAktifNopol(k.nopol); if (g) { peringatanGanda(g); return; } }
  const w = st.regDraft, fields = el.dataset.m === 'konsumen' ? KONSUMEN_FIELDS : KEND_FIELDS;
  fields.forEach(f => { if (k[f] != null && k[f] !== '') w[f] = k[f]; });
  if (k.konsumenId) w.konsumenId = k.konsumenId;
  if (el.dataset.m !== 'konsumen' && !k.namaStnk) { w.namaStnk = k.nama || ''; w.stnkSama = true; }
  renderRegistrasi(); toast('Data ' + (k.nama || k.nopol) + ' dipakai. Periksa dan ubah bila ada yang berbeda.');
}

async function save(opts = {}) {
  if (st.saving) return;
  const w = st.regDraft; w.nopol = w.nopol.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!w.nopol) { toast('Isi nomor polisi dulu'); $('#r-nopol')?.focus(); return; }
  const baru = !w.no;
  const ganda = baru ? woAktifNopol(w.nopol) : null;
  if (ganda) { peringatanGanda(ganda); return; }
  // Nomor cepat: saat ramai, nomor antrian keluar hanya dengan nopol. Motor menunggu (Antri) sampai datanya dilengkapi.
  if (opts.cepat) return simpanCepat(w);
  if (!w.nama.trim()) { toast('Isi nama konsumen sesuai KTP'); $('#r-nama')?.focus(); return; }
  if (w.nik && !/^\d{16}$/.test(w.nik)) { toast('NIK harus 16 angka (atau kosongkan)'); $('#r-nik')?.focus(); return; }
  if (!w.tipe) { toast('Pilih tipe motor'); $('#r-tipe')?.focus(); return; }
  w.noRangka = (w.noRangka || '').replace(/\s+/g, ''); w.noMesin = (w.noMesin || '').replace(/\s+/g, '');
  if (w.stnkSama !== false) w.namaStnk = w.nama;
  if (w.jenisServis === 'KSG' && !w.ksgKe) { toast('Pilih KSG ke berapa'); $('#r-ksgke')?.focus(); return; }
  // Konsumen & pemilik motor: penanda HP/NIK, ganti pemilik / hanya mengantar, ganti plat, no. rangka berbeda
  if (!(await tentukanPemilik(w))) { delete w._lanjut; return; }
  // (dicek sebelum status/log diubah, supaya draft tidak berubah bila simpan dibatalkan)
  // KM tidak boleh turun dari KM terakhir kendaraan ini (kecuali speedometer diganti — izin admin + catatan)
  const kmBaru = angkaKm(w.km);
  if (kmBaru && !w.kmReset) {
    const akhir = await kmTerakhir(w._gantiPlatNopol || w.nopol, w.no);
    if (akhir && kmBaru < akhir.km) {
      if (!isRole('admin')) { toast(`KM ${fmtKm(kmBaru)} lebih kecil dari KM terakhir ${fmtKm(akhir.km)} (${tglPendek(akhir.tgl)}). Periksa lagi; bila speedometer diganti, minta admin.`); delete w._lanjut; $('#r-km')?.focus(); return; }
      const cat = await mintaCatatan('KM lebih kecil dari KM terakhir', `KM terakhir ${fmtKm(akhir.km)} (${akhir.asal}, ${tglPendek(akhir.tgl)}), diisi ${fmtKm(kmBaru)}. Lanjutkan hanya bila speedometer diganti/direset. Tulis keterangannya.`);
      if (cat === null) { delete w._lanjut; $('#r-km')?.focus(); return; }
      w.kmReset = { dari: akhir.km, ke: kmBaru, ket: cat, oleh: namaPetugas(), tgl: stamp(new Date()) };
    }
  }
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
  // Melanjutkan motor yang ditunda: konfirmasi dulu, tampilkan mekanik sebelumnya
  const prevStatus = stored ? stored.status : null;
  if (prevStatus === 'Ditunda' && status === 'Dikerjakan') {
    const lama = stored.mekanikTunda || mekanikNama(stored), ganti = lama && lama !== mek.nama;
    const ok = await konfirmasi('Lanjutkan ' + w.nopol + '?', `${tundaInfo(stored)}<p style="margin:8px 0 0">Dilanjutkan oleh <b>${esc(mek.nama)}</b>${ganti ? ` <span class="diff-bad">(ganti mekanik dari ${esc(lama)})</span>. Lama kerja tiap mekanik tercatat terpisah.` : ' (mekanik yang sama).'}</p>`, { ya: 'Ya, lanjutkan' });
    if (!ok) { delete w._lanjut; return; }
  }
  // Catat jam setiap perubahan status (untuk menghitung lama servis) + mekanik yang mengerjakan
  const infoMek = mek ? { m: mek.nama, mid: mek.id } : {};
  if (status !== prevStatus) w.log = logStatus(w.log || (stored?.log) || [], status, status === 'Dikerjakan' ? infoMek : {});
  else if (status === 'Dikerjakan' && stored && mek && stored.mekanikId !== mek.id) w.log = logStatus(w.log || stored.log || [], 'Dikerjakan', { ...infoMek, a: 'ganti mekanik dari ' + (mekanikNama(stored) || '–') });
  w.status = status; w.mekanik = mek?.nama || '';
  delete w._manual; delete w._lanjut;
  if (w.jenisServis === 'KSG') w.jasa = [];
  w.jasa = normJasa(w); w.dataKurang = false;
  st.saving = true;
  try {
    // Tanda sementara (_…) tidak ikut disimpan; nomor antrian yang dibuat saveWo disalin kembali ke draft
    const bersih = Object.fromEntries(Object.entries(w).filter(([k2]) => !k2.startsWith('_')));
    const no = await saveWo(bersih);
    w.no = no; if (bersih.antrian) { w.antrian = bersih.antrian; w.antrianTgl = bersih.antrianTgl; }
    // Database konsumen: buat baru / perbarui (ikut ke semua motornya) — gagal di sini tidak membatalkan servis
    const ktp = ambilKtp(w);
    try {
      let kons = w.konsumenId ? await ambilKonsumen(w.konsumenId) : null;
      if (!kons) { w.konsumenId = await buatKonsumen(ktp, 'Registrasi ' + no); kons = null; }
      else await ubahKonsumen(kons, ktp, 'Registrasi ' + no, { kecuali: nopolKey(w.nopol) });
      await updateDoc(doc(db, 'wo', no), { konsumenId: w.konsumenId, ...(w.pengantar ? { pengantar: w.pengantar } : {}) });
      if (w._gantiPlat) await gantiPlat(w._gantiPlat, w, no);
      if (w._keputusan === 'jual' && w._kLama) await pindahkanMotor({ id: nopolKey(w.nopol), ...w._kLama, nopol: w.nopol }, { id: w.konsumenId, ...ktp }, { jenis: 'jual', alasan: w._alasan || '' });
    } catch (e) { console.warn('Database konsumen', e); toast('Servis tersimpan, tetapi database konsumen gagal diperbarui: ' + errMsg(e)); }
    // Servis lama (mis. dilanjutkan setelah ditunda): yang ditulis ke data kendaraan hanya kolom yang benar-benar
    // diubah di formulir ini, supaya data konsumen yang lebih baru tidak tertimpa data lama di work order.
    const nilai = (o, f) => f === 'stnkSama' ? o[f] !== false : String(o[f] ?? '').trim();
    const kolom = stored ? KEND_FIELDS.filter(f => f !== 'kabKode' && nilai(w, f) !== nilai(stored, f)) : KEND_FIELDS;
    if (stored && kolom.some(f => WIL_FIELDS.includes(f))) kolom.push('kabKode');
    const kend = Object.fromEntries(kolom.map(f => [f, f === 'stnkSama' ? w[f] !== false : (w[f] || '')]));
    if (w.konsumenId) kend.konsumenId = w.konsumenId;
    const kId = nopolKey(w.nopol), kRef = doc(db, 'kendaraan', kId), kSnap = await getDoc(kRef).catch(() => null);
    const kLama = kSnap?.exists() ? kSnap.data() : (kSnap ? null : undefined);
    const umum = { nopolKey: kId, ...(w.km ? { km: w.km } : {}), updated: stamp(new Date()), woTerakhir: no, ...(w.kmReset ? { kmReset: w.kmReset } : {}) };
    // WO sudah tersimpan. Gagal memperbarui data kendaraan tidak membatalkan servis, cukup diberi tahu.
    try {
    if (kLama === null) await setDoc(kRef, { ...Object.fromEntries(KEND_FIELDS.map(f => [f, f === 'stnkSama' ? w[f] !== false : (w[f] || '')])), ...umum, konsumenId: w.konsumenId || '', hpNorm: waNumber(w.hp), dibuat: stamp(new Date()) }, { merge: true });
    else if (kLama) {
      // Data konsumen yang berubah saat registrasi ikut tercatat (siapa, kapan, lama → baru)
      const { isi, ubah } = bedaKonsumen(kLama, kend, [...KEND_FIELDS, 'konsumenId']);
      await simpanDenganCatatan(kId, w.nopol, isi, ubah, { ...umum, ...('hp' in isi ? { hpNorm: waNumber(w.hp) } : {}) }, 'Registrasi ' + no);
      if ('hp' in isi) await pindahPantau(w.nopol, kLama.hp, w.hp, kend);
    }
    await tambahMotorKe(w.konsumenId, kId);
    } catch (e) { console.warn('Data kendaraan', e); toast('Servis tersimpan, tetapi data konsumen/kendaraan gagal diperbarui: ' + errMsg(e)); }
    cachePemilik = { key: '', data: null };
    Object.keys(w).filter(k2 => k2.startsWith('_')).forEach(k2 => delete w[k2]);
    w.dataKurang = false;
    syncPantau(w);
    toast(`Antrian ${fmtAntri(w.antrian)} · ${w.nopol} disimpan`);
    renderRegistrasi();
    if (baru) showAntrian(w);
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

// Sebelum simpan: siapa konsumennya & apakah motor ini miliknya. Mengembalikan false bila dibatalkan / perlu diperiksa.
async function tentukanPemilik(w) {
  const key = nopolKey(w.nopol);
  let s0 = await getDoc(doc(db, 'kendaraan', key)).catch(() => null), kLama = s0?.exists() ? s0.data() : null;
  if (kLama?.pindahKe) { toast(`Plat ${kLama.nopol} sudah berganti. Ketik nomor polisi yang baru.`); return false; }
  // 1. Ganti plat: nopol belum ada, tetapi no. rangka / no. mesin sudah tercatat di motor lain
  if (!kLama && !w.no && !w._gantiPlat && !w._bukanPlat && (w.noRangka || w.noMesin)) {
    for (const f of ['noRangka', 'noMesin']) {
      if (!w[f]) continue;
      const q = await getDocs(query(collection(db, 'kendaraan'), where(f, '==', String(w[f]).replace(/\s+/g, '').toUpperCase()), limit(3))).catch(() => ({ docs: [] }));
      const d = q.docs.find(x => x.id !== key && !x.data().pindahKe); if (!d) continue;
      const o = d.data();
      const v = await pilihan('Ganti nomor polisi?', `${f === 'noRangka' ? 'No. rangka' : 'No. mesin'} <b class="mono">${esc(w[f])}</b> sudah tercatat di motor <b class="mono">${esc(o.nopol)}</b> (${esc(o.tipe || '')}, ${esc(o.nama || '')}).<br>Bila platnya berganti (mutasi/plat baru), pilih <b>Ganti nomor polisi</b> supaya riwayat servisnya tetap bersambung.`,
        [{ v: 'beda', label: 'Bukan, motor berbeda' }, { v: 'ganti', label: 'Ya, ganti nomor polisi', kelas: 'pri' }]);
      if (!v) return false;
      if (v === 'beda') { w._bukanPlat = true; break; }
      w._gantiPlat = d.id; w._gantiPlatNopol = o.nopol; kLama = { ...o };
      if (!w.konsumenId && o.konsumenId) w.konsumenId = o.konsumenId;
      break;
    }
  }
  // 2. No. rangka / mesin berbeda dengan data nopol ini → periksa STNK
  if (kLama && !w._gantiPlat && !w._rangkaOk) {
    const beda = ['noRangka', 'noMesin'].filter(f => kLama[f] && w[f] && String(kLama[f]).replace(/\s+/g, '').toUpperCase() !== String(w[f]).replace(/\s+/g, '').toUpperCase());
    if (beda.length) {
      const ok = await pilihan('Data mesin/rangka berbeda', `${beda.map(f => `${f === 'noRangka' ? 'No. rangka' : 'No. mesin'} ${esc(w.nopol)} tercatat <b class="mono">${esc(kLama[f])}</b>, diisi <b class="mono">${esc(w[f])}</b>`).join('<br>')}.<br><b>Periksa STNK fisik.</b> Bisa salah ketik, plat tertukar, atau plat tidak sesuai motor.`, [{ v: 'ok', label: 'Sudah cek STNK, data baru benar', kelas: 'warn' }]);
      if (!ok) return false; w._rangkaOk = true;
    }
  }
  // Servis lama / data diisi manual: bila HP atau NIK sama dengan pemilik tercatat, itu orangnya
  if (!w.konsumenId && kLama?.konsumenId) {
    const own = await ambilKonsumen(kLama.konsumenId).catch(() => null);
    if (own && ((waNumber(own.hp) && waNumber(own.hp) === waNumber(w.hp)) || (own.nik && own.nik === w.nik))) w.konsumenId = own.id;
  }
  // 3. Penanda konsumen: no. HP & NIK
  if (!w.konsumenId) {
    const g = await konsumenGanda({ hp: w.hp, nik: w.nik }).catch(() => ({ byHp: [], byNik: [] }));
    if (g.byNik.length) {
      const x = g.byNik[0];
      const v = await pilihan('NIK sudah terdaftar', `NIK ${esc(w.nik)} milik <b>${esc(x.nama)}</b> ${esc(x.hp || '')}${(x.motor || []).length ? ' · motor ' + x.motor.map(esc).join(', ') : ''}. Satu NIK = satu orang.`, [{ v: 'pakai', label: 'Pakai data ' + x.nama, kelas: 'pri' }]);
      if (v) { isiDariKonsumen(w, { ...x, hp: w.hp || x.hp }); renderRegistrasi(); toast('Data ' + x.nama + ' dipakai. Periksa lalu simpan lagi.'); }
      return false;
    }
    if (g.byHp.length && !w._hpBersama) {
      const x = g.byHp[0];
      const v = await pilihan('No. HP sudah terdaftar', `No. HP ${esc(w.hp)} milik <b>${esc(x.nama)}</b>${(x.motor || []).length ? ' · motor ' + x.motor.map(esc).join(', ') : ''}.<br>Bila orangnya sama, pakai datanya. Bila <b>orang lain yang memakai nomor yang sama</b> (mis. suami/istri), pilih Orang lain.`,
        [{ v: 'lain', label: 'Orang lain, nomor sama' }, { v: 'pakai', label: 'Pakai data ' + x.nama, kelas: 'pri' }]);
      if (!v) return false;
      if (v === 'pakai') { isiDariKonsumen(w, x); renderRegistrasi(); toast('Data ' + x.nama + ' dipakai. Periksa lalu simpan lagi.'); return false; }
      w._hpBersama = true;
    }
  }
  // 3b. Konsumen sudah dipilih tetapi no. HP / NIK diganti: pastikan tidak bentrok dengan konsumen lain
  if (w.konsumenId) {
    const kini = await ambilKonsumen(w.konsumenId).catch(() => null);
    const hpBaru = kini && waNumber(w.hp) && waNumber(w.hp) !== waNumber(kini.hp), nikBaru = kini && w.nik && w.nik !== (kini.nik || '');
    if (hpBaru || nikBaru) {
      const g = await konsumenGanda({ hp: hpBaru ? w.hp : '', nik: nikBaru ? w.nik : '' }, w.konsumenId).catch(() => ({ byHp: [], byNik: [] }));
      if (g.byNik.length) { const x = g.byNik[0]; await pilihan('NIK milik konsumen lain', `NIK ${esc(w.nik)} terdaftar atas nama <b>${esc(x.nama)}</b>. Periksa KTP; satu NIK = satu orang.`, [], 'Kembali'); return false; }
      if (g.byHp.length && !w._hpBersama) {
        const x = g.byHp[0];
        const v = await pilihan('No. HP baru dipakai konsumen lain', `No. HP ${esc(w.hp)} milik <b>${esc(x.nama)}</b>. Data <b>${esc(kini.nama)}</b> akan memakai nomor yang sama.`, [{ v: 'bersama', label: 'Tetap simpan (nomor bersama)' }, { v: 'pakai', label: 'Ternyata orangnya ' + x.nama, kelas: 'pri' }]);
        if (!v) return false;
        if (v === 'pakai') { isiDariKonsumen(w, x); renderRegistrasi(); toast('Data ' + x.nama + ' dipakai. Periksa lalu simpan lagi.'); return false; }
        w._hpBersama = true;
      }
    }
  }
  // 4. Motor sudah punya pemilik lain → ganti pemilik (dijual) atau hanya mengantar
  const pemilikId = kLama?.konsumenId || '';
  const lainOrang = kLama && (pemilikId ? w.konsumenId !== pemilikId : (kLama.hpNorm && waNumber(w.hp) && kLama.hpNorm !== waNumber(w.hp) && String(kLama.nama || '').trim() !== String(w.nama || '').trim()));
  if (lainOrang && !w._keputusan && !w.pengantar) {
    const p = pemilikId ? (await ambilKonsumen(pemilikId)) || kLama : kLama;
    const v = await pilihan('Motor ini milik orang lain', `<b class="mono">${esc(w.nopol)}</b> tercatat milik <b>${esc(p.nama || '–')}</b> ${esc(p.hp || '')}.<br>Yang datang: <b>${esc(w.nama)}</b> ${esc(w.hp || '')}.`,
      [{ v: 'antar', label: 'Hanya mengantar' }, { v: 'jual', label: 'Ganti pemilik (motor dijual)', kelas: 'pri' }]);
    if (!v) return false;
    if (v === 'antar') { w.pengantar = { nama: w.nama, hp: w.hp }; isiDariKonsumen(w, pemilikId ? { ...p, id: pemilikId } : { ...kLama, id: '' }); if (!pemilikId) w.konsumenId = ''; w._keputusan = 'antar'; }
    else {
      const alasan = await mintaCatatan('Ganti pemilik ' + w.nopol, `Dari ${p.nama || '–'} ke ${w.nama}. Pastikan STNK/BPKB sudah dicek. Riwayat servis tetap ikut motor; nama & no. HP pemilik lama disembunyikan dari pemilik baru.`);
      if (alasan === null) return false;
      w._keputusan = 'jual'; w._alasan = alasan;
    }
  }
  w._kLama = kLama ? { ...kLama } : null;
  return true;
}
// Ganti plat: data motor lama pindah ke nopol baru (riwayat tetap bersambung lewat nopolLama), data lama ditandai pindah.
async function gantiPlat(lamaId, w, no) {
  const s2 = await getDoc(doc(db, 'kendaraan', lamaId)); if (!s2.exists()) return;
  const o = s2.data(), baruKey = nopolKey(w.nopol), tgl = stamp(new Date());
  await setDoc(doc(db, 'kendaraan', baruKey), { ...o, nopol: w.nopol, nopolKey: baruKey, nopolLama: [...(o.nopolLama || []), o.nopol], pindahDari: lamaId, updated: tgl, logTerakhir: o.logTerakhir || '' });
  await _simpanLog(lamaId, o.nopol, { pindahKe: baruKey }, [{ f: 'pindahKe', dari: '', ke: w.nopol }], { updated: tgl }, 'Ganti plat · Registrasi ' + no);
  await lepasMotorDari(o.konsumenId, lamaId); await tambahMotorKe(o.konsumenId || w.konsumenId, baruKey);
  await pindahPantauKunci(o.nopol, o.hp, w.nopol, o.hp, o);
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
fkeys.registrasi = { baru: 'reg-new', simpan: 'reg-save', cari: 'reg-fokus-cari' };
Object.assign(actions, {
  // F1: formulir baru, kursor langsung ke data konsumen (NIK) sesuai urutan formulir
  'reg-new': () => { st.regDraft = blank(); renderRegistrasi(); $('#r-nik')?.focus(); },
  // F3: langsung ke kotak "Pernah servis di sini? Cari data lama"
  'reg-fokus-cari': () => { const c = $('#r-cari'); if (!c) { toast('Pencarian tidak tersedia untuk servis yang sudah dibayar'); return; } c.scrollIntoView({ block: 'center' }); c.focus(); c.select(); },
  'reg-pick': el => { const o = findWo(el.dataset.no); if (o) { st.regDraft = { ...blank(), ...clone(o), jasa: normJasa(o) }; renderRegistrasi(); } },
  'reg-filter': el => { filter = el.dataset.f; document.querySelectorAll('[data-act="reg-filter"]').forEach(b => b.setAttribute('aria-pressed', b === el)); renderList(); },
  'reg-save': () => save(),
  'reg-bast': () => { if (!st.regDraft?.nopol || !st.regDraft?.nama) { toast('Lengkapi data konsumen dan kendaraan dulu'); return; } bastKendOpen(st.regDraft); },
  'reg-bast-print': () => st.regDraft && bastKendPrint(st.regDraft),
  'reg-cepat': () => save({ cepat: true }),
  'reg-cari': cariData,
  'reg-pakai': pakaiData,
  'reg-pakai-k': el => pakaiKonsumen(el),
  'reg-pakai-km': el => pakaiKonsumen(el, el.dataset.n),
  'reg-add-biaya': () => { if (st.regDraft?.status === 'Lunas') return; st.regDraft.biaya = [...(st.regDraft.biaya || []), { ket: '', jumlah: 0 }]; renderRegistrasi(); document.querySelector('[data-bi="' + (st.regDraft.biaya.length - 1) + '"][data-bf="ket"]')?.focus(); },
  'reg-rm-biaya': el => { if (st.regDraft?.status === 'Lunas') return; st.regDraft.biaya.splice(+el.dataset.i, 1); renderRegistrasi(); },
  'reg-hapus-antar': () => { delete st.regDraft.pengantar; renderRegistrasi(); },
  'reg-lanjut': async () => { const w = st.regDraft; w._lanjut = true; try { await save(); } finally { delete w._lanjut; } },
  'reg-status': async el => { const alasan = el.dataset.s === 'Ditunda' ? ($('#reg-tunda')?.value || '') : ''; if (await laporStatus(el.dataset.no, el.dataset.s, alasan)) { st.regDraft = { ...blank(), ...clone(findWo(el.dataset.no)), jasa: normJasa(findWo(el.dataset.no)) }; renderRegistrasi(); } },
  'reg-oli-luar': () => catatOliLuar(st.regDraft.nopol, oli => { infoKm.oli = oli; infoKm.key = ''; isiInfoKm(); }),
  // Admin: hapus pendaftaran yang salah/ganda (belum dibayar). Nomor antrian tidak dipakai ulang.
  'reg-hapus': async () => {
    const w = findWo(st.regDraft?.no); if (!w || w.status === 'Lunas') return;
    const ok = await konfirmasi('Batalkan pendaftaran ' + w.nopol + '?', `Antrian <b>${esc(fmtAntri(w.antrian) || '–')}</b> · <span class="mono">${esc(w.no)}</span> · ${esc(w.status)}${mekanikNama(w) ? ' · ' + esc(mekanikNama(w)) : ''}${(w.parts || []).length ? `<br><span class="diff-bad">Ada ${w.parts.length} order sparepart yang ikut terhapus.</span>` : ''}<br>Data servis ini dihapus dari daftar, layar TV, dan halaman cek servis konsumen. Data konsumen & kendaraan tidak terhapus.`, { ya: 'Ya, batalkan pendaftaran', bahaya: true });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'wo', w.no));
      const lain = woAktifNopol(w.nopol, w.no);
      syncLayar({ ...w, status: 'Batal' });
      syncPantau(lain || { ...w, status: 'Batal' });
      st.regDraft = blank(); renderRegistrasi(); toast('Pendaftaran ' + w.no + ' dibatalkan');
    } catch (e) { toast(errMsg(e)); }
  }
});
inputHandlers.push(e => {
  const t = e.target; if (t.dataset.rf && st.regDraft) st.regDraft[t.dataset.rf] = t.value;
  if (t.id === 'r-km') tampilInfoKm();
  if ((t.id === 'r-hp' || t.id === 'r-nama') && $('#r-wa')) $('#r-wa').innerHTML = waButton(st.regDraft.hp, waMsg(st.regDraft));
  if (t.id === 'r-nama' && st.regDraft.stnkSama !== false && $('#r-namaStnk')) $('#r-namaStnk').value = t.value;
  if (t.id === 'r-nik') t.value = t.value.replace(/\D/g, '').slice(0, 16), st.regDraft.nik = t.value;
  if (t.dataset.bi !== undefined && st.regDraft.biaya?.[+t.dataset.bi]) {
    st.regDraft.biaya[+t.dataset.bi][t.dataset.bf] = t.dataset.bf === 'jumlah' ? (+t.value || 0) : t.value;
  }
});
changeHandlers.push(e => {
  const t = e.target, w = st.regDraft; if (!w) return;
  if (t.dataset.rf) w[t.dataset.rf] = t.value;
  if (t.id === 'r-jenis') { if (w.jenisServis !== 'KSG') w.ksgKe = ''; if (w.jenisServis === 'KSG') w.jasa = []; renderRegistrasi(); }
  if ((t.id === 'r-ksgke' || t.id === 'r-tipe') && w.jenisServis === 'KSG') renderRegistrasi();   // perbarui nilai klaim KSG
  if (t.dataset.jasa && t.closest('.checks') && $('#r-nopol')) {
    const n = t.dataset.jasa;
    w.jasa = t.checked ? [...normJasa(w).filter(j => j.nama !== n), { nama: n, harga: +t.dataset.harga || 0 }] : normJasa(w).filter(j => j.nama !== n);
    renderRegistrasi();
  }
  if (t.id === 'r-status') { w.status = t.value; w._manual = true; }
  if (t.id === 'r-stnkSama') { w.stnkSama = t.checked; if (!t.checked && !w.namaStnk) w.namaStnk = w.nama; const n = $('#r-namaStnk'); n.disabled = t.checked; n.value = t.checked ? w.nama : w.namaStnk; if (!t.checked) n.focus(); }
  if (t.id === 'r-nopol' && !w.no) { t.value = t.value.trim().toUpperCase(); w.nopol = t.value; const g = woAktifNopol(w.nopol); if (g) peringatanGanda(g); else { lookupKendaraan(w.nopol); isiInfoKm(); } }
});
