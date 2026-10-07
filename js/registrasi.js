// Menu Registrasi Servis: data konsumen & kendaraan, keluhan, jenis servis (Reguler/KSB/KSG), jasa, mekanik.
import { $, esc, rp, dkey, stamp, clone, toast, errMsg } from './util.js';
import { S, st, views, refreshers, actions, inputHandlers, changeHandlers, fkeys, tipeList, jasaAktif, mekanikAktif, mekanikById, isRole } from './state.js';
import { JENIS_SERVIS } from './config.js';
import { db, doc, getDoc, setDoc } from './firebase.js';
import { AKTIF, normJasa, woCalc, woCard, sibukOleh, tarifKsg, saveWo, findWo, statusPill, jenisBadge } from './wo-common.js';

export const nopolKey = n => String(n || '').replace(/\s+/g, '').toUpperCase();
const KEND_FIELDS = ['nopol', 'nama', 'hp', 'alamat', 'tipe', 'tahun', 'warna', 'noRangka', 'noMesin'];
const blank = () => ({ no: null, tgl: stamp(new Date()), nopol: '', nama: '', hp: '', alamat: '', tipe: '', tahun: '', warna: '', noRangka: '', noMesin: '', km: '', keluhan: '', jenisServis: 'Reguler', ksgKe: '', noKartu: '', jasa: [], mekanikId: '', mekanik: '', parts: [], biaya: [], catatanPart: '', status: 'Antri' });
let filter = 'aktif';

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
  el.innerHTML = l.map(o => woCard(o, st.regDraft?.no, 'reg-pick')).join('') || '<div class="empty">Tidak ada work order.</div>';
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
   <div class="panel"><div class="row spread"><h3>Work order</h3><button class="btn sm" data-act="reg-new" type="button">+ Motor masuk [F1]</button></div>
    <div class="seg" role="group" aria-label="Tampilkan">${[['aktif', 'Aktif'], ['hari', 'Hari ini'], ['semua', 'Semua']].map(([k, l]) => `<button type="button" data-act="reg-filter" data-f="${k}" aria-pressed="${k === filter}">${l}</button>`).join('')}</div>
    <div class="wolist" id="reg-list"></div>
   </div>
   <div class="panel"><div class="row spread"><h2>${w.no ? esc(w.no) : 'Registrasi motor masuk'}</h2>${w.no ? `<span class="row">${jenisBadge(w)}${statusPill(w.status)}</span>` : ''}</div>
    <h3>Pemilik &amp; kendaraan</h3>
    <div class="form">
     ${inp('nopol', 'No. Polisi', 'class="mono" placeholder="BL 1234 XX" autocomplete="off"')}
     ${inp('nama', 'Nama pemilik')}
     ${inp('hp', 'No. HP', 'inputmode="tel"')}
     <label class="f" for="r-tipe">Tipe motor<select id="r-tipe" data-rf="tipe" ${dis}><option value="">Pilih tipe</option>${[...new Set([...tipeList(), w.tipe].filter(Boolean))].map(t => `<option ${t === w.tipe ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
     ${inp('tahun', 'Tahun', 'inputmode="numeric" class="num"')}
     ${inp('warna', 'Warna')}
     ${inp('noRangka', 'No. rangka', 'class="mono"')}
     ${inp('noMesin', 'No. mesin', 'class="mono"')}
     ${inp('km', 'Kilometer', 'inputmode="numeric" class="num" placeholder="mis. 12.500"')}
     <label class="f wide" for="r-alamat">Alamat<input id="r-alamat" data-rf="alamat" value="${esc(w.alamat)}" ${dis}></label>
    </div>
    <h3>Servis</h3>
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
    <div class="totals small"><span class="muted">Jasa ditagih</span><span class="num">${rp(c.jasaTagih)}</span>${c.klaim ? `<span class="muted">Klaim KSG</span><span class="num">${rp(c.klaim)}</span>` : ''}${w.parts.length ? `<span class="muted">Order sparepart</span><span class="num">${rp(c.parts)}</span>` : ''}</div>
    <div class="row" style="justify-content:flex-end">
     ${w.no && !locked && isRole('admin') ? `<label class="f" for="r-status" style="flex-direction:row;align-items:center;gap:6px">Status<select id="r-status" style="width:auto">${AKTIF.map(s => `<option ${s === w.status ? 'selected' : ''}>${s}</option>`).join('')}</select></label>` : ''}
     ${w.status === 'Ditunda' && !locked ? '<span class="small muted">Ditunda (lanjut lama). Pilih mekanik kosong lalu</span><button class="btn" type="button" data-act="reg-lanjut">Lanjutkan dikerjakan</button>' : ''}
     ${locked ? '<span class="small muted">Sudah dibayar, tidak bisa diubah.</span>' : `<button class="btn pri" type="button" data-act="reg-save">${w.no ? 'Simpan perubahan' : 'Daftarkan'} [F2]</button>`}
    </div>
   </div></div>`;
  renderList();
}

async function lookupKendaraan(nopol) {
  const key = nopolKey(nopol); if (!key) return;
  try {
    const s = await getDoc(doc(db, 'kendaraan', key));
    if (!s.exists()) return;
    const k = s.data(), w = st.regDraft;
    let filled = false;
    KEND_FIELDS.forEach(f => { if (f !== 'nopol' && !w[f] && k[f]) { w[f] = k[f]; filled = true; } });
    if (filled) { renderRegistrasi(); toast('Kendaraan terdaftar: data ' + (k.nama || k.nopol) + ' diisi otomatis'); }
  } catch (e) { /* lookup gagal tidak menghalangi registrasi */ }
}

async function save() {
  if (st.saving) return;
  const w = st.regDraft; w.nopol = w.nopol.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!w.nopol) { toast('Isi nomor polisi dulu'); $('#r-nopol')?.focus(); return; }
  if (!w.tipe) { toast('Pilih tipe motor'); $('#r-tipe')?.focus(); return; }
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
  w.status = status; w.mekanik = mek?.nama || '';
  delete w._manual; delete w._lanjut;
  w.jasa = normJasa(w);
  st.saving = true;
  try {
    const no = await saveWo(w);
    w.no = no;
    const kend = Object.fromEntries(KEND_FIELDS.map(f => [f, w[f] || '']));
    await setDoc(doc(db, 'kendaraan', nopolKey(w.nopol)), { ...kend, km: w.km || '', updated: stamp(new Date()), woTerakhir: no }, { merge: true });
    toast('Work order ' + no + ' disimpan');
    renderRegistrasi();
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

views.registrasi = renderRegistrasi;
refreshers.registrasi = () => { renderList(); const sel = $('#r-mek'); if (sel) { const v = sel.value; sel.innerHTML = mekanikOptions(st.regDraft); sel.value = v; } };
fkeys.registrasi = { baru: 'reg-new', simpan: 'reg-save' };
Object.assign(actions, {
  'reg-new': () => { st.regDraft = blank(); renderRegistrasi(); $('#r-nopol')?.focus(); },
  'reg-pick': el => { const o = findWo(el.dataset.no); if (o) { st.regDraft = { ...blank(), ...clone(o), jasa: normJasa(o) }; renderRegistrasi(); } },
  'reg-filter': el => { filter = el.dataset.f; document.querySelectorAll('[data-act="reg-filter"]').forEach(b => b.setAttribute('aria-pressed', b === el)); renderList(); },
  'reg-save': save,
  'reg-lanjut': () => { st.regDraft._lanjut = true; save(); }
});
inputHandlers.push(e => { const t = e.target; if (t.dataset.rf && st.regDraft) st.regDraft[t.dataset.rf] = t.value; });
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
  if (t.id === 'r-nopol' && !w.no) { t.value = t.value.trim().toUpperCase(); w.nopol = t.value; lookupKendaraan(w.nopol); }
});
