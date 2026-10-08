// Menu Pembayaran & Status Servis (kasir):
// 1. Mekanik melapor ke kasir: motor Selesai, atau harus Lanjut lama (Ditunda). Keduanya membuat mekanik bebas lagi.
// 2. Motor Selesai: cek jasa, sparepart, biaya lain, diskon, terima pembayaran cash / transfer / campur.
import { $, esc, rp, stamp, clone, toast, errMsg, waButton } from './util.js';
import { APP_NAME } from './config.js';
import { S, st, views, refreshers, actions, inputHandlers, fkeys, namaPetugas } from './state.js';
import { db, doc, runTransaction, serverTimestamp } from './firebase.js';
import { counterRef, nextNumber } from './numbering.js';
import { AKTIF, woCard, woHeader, woCalc, partsTable, normJasa, mekanikNama, findWo, jenisBadge, tarifKsg, updateWo, logStatus, timelineHTML, durasi, syncPantau, panggilLayar, fmtAntri } from './wo-common.js';
import { emptyPay, payFields, payTotals, payStatus, payRecord, registerPay } from './payment.js';
import { showNota, cekLink } from './nota.js';

const ORDER = { Dikerjakan: 0, Selesai: 1, Ditunda: 2, Antri: 3 };

function renderList() {
  const el = $('#bay-list'); if (!el) return;
  const l = [...S.wo].reverse().filter(w => AKTIF.includes(w.status)).sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  el.innerHTML = l.map(o => woCard(o, st.bayarNo, 'bay-pick')).join('') || '<div class="empty">Tidak ada motor di bengkel.</div>';
}

function renderBayar() {
  $('#view').innerHTML = `<div class="grid g-servis">
   <div class="panel"><h3>Motor di bengkel</h3><p class="small muted" style="margin:0">Dikerjakan: tunggu laporan mekanik. Selesai: siap dibayar.</p><div class="wolist" id="bay-list"></div></div>
   <div class="panel" id="bay-detail"><div class="empty">Pilih motor di sebelah kiri.</div></div>
  </div>`;
  renderList();
  if (st.bayarNo && AKTIF.includes(findWo(st.bayarNo)?.status)) renderDetail(); else st.bayarNo = null;
}

const draftWo = () => ({ ...findWo(st.bayarNo), biaya: st.bayarDraft.biaya });
const grandTotal = () => Math.max(0, woCalc(draftWo()).total - (st.bayarDraft.diskon || 0));

function statusPanel(w) {
  if (w.status === 'Dikerjakan') return `<div class="note"><b>Laporan mekanik ${esc(mekanikNama(w))}</b>
    <div class="row" style="margin-top:6px"><button class="btn pri" type="button" data-act="bay-status" data-s="Selesai">Motor selesai</button><input id="bay-tunda" class="inline-input" placeholder="Alasan lanjut lama, mis. tunggu part" style="flex:1 1 200px" aria-label="Alasan ditunda"><button class="btn" type="button" data-act="bay-status" data-s="Ditunda">Lanjut lama (tunda)</button></div>
    <div class="small muted" style="margin-top:4px">Kedua pilihan membuat mekanik kosong dan bisa menerima motor berikutnya.</div></div>`;
  if (w.status === 'Ditunda') return `<div class="note"><b>Ditunda</b>${w.alasanTunda ? ': ' + esc(w.alasanTunda) : ''}${w.tglTunda ? ` <span class="small muted">(${esc(w.tglTunda)})</span>` : ''}
    <div class="row" style="margin-top:6px"><button class="btn pri" type="button" data-act="bay-status" data-s="Selesai">Motor sudah selesai</button><span class="small muted">Untuk dikerjakan lagi, pilih mekanik kosong di Registrasi → Lanjutkan dikerjakan.</span></div></div>`;
  if (w.status === 'Antri') return `<div class="note small">${w.dataKurang ? 'Data konsumen belum lengkap. ' : ''}Belum ada mekanik. Registrasi perlu memilih mekanik yang kosong.</div>`;
  if (w.status === 'Selesai') return `<div class="row"><button class="btn" type="button" data-act="bay-panggil">Panggil ulang di layar</button><span class="small muted">Nomor ${esc(fmtAntri(w.antrian) || w.nopol)} dipanggil ke kasir lewat layar TV.</span></div>`;
  return '';
}

function renderDetail() {
  const w = draftWo(), c = woCalc(w), d = st.bayarDraft, ksg = w.jenisServis === 'KSG';
  const jasa = normJasa(w), bisaBayar = w.status === 'Selesai';
  $('#bay-detail').innerHTML = `<div class="row spread"><h2>${esc(w.no)}</h2>${jenisBadge(w)}</div>
    ${woHeader(w)}
    ${timelineHTML(w)}
    ${statusPanel(w)}
    <h3>Jasa servis</h3>
    ${jasa.length ? `<div class="tw"><table><tbody>${jasa.map(j => `<tr><td>${esc(j.nama)}</td><td class="r num">${ksg ? `<s class="muted">${rp(j.harga)}</s> gratis` : rp(j.harga)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="small muted">Tidak ada jasa.</div>'}
    ${ksg ? `<div class="note small">KSG ke-${esc(w.ksgKe || '?')} ${esc(w.tipe)}: jasa gratis untuk konsumen. Klaim ke main dealer ${tarifKsg(w) ? rp(tarifKsg(w)) : '<span class="diff-bad">belum ada tarif (isi di Master Data → Tarif KSG)</span>'}.</div>` : ''}
    <h3>Order sparepart</h3>
    ${partsTable(w)}
    ${bisaBayar ? `<div class="row spread"><h3>Biaya tambahan lain</h3><button class="btn sm" type="button" data-act="bay-addbiaya">+ Tambah biaya</button></div>
    ${d.biaya.length ? `<div class="tw"><table><thead><tr><th>Keterangan</th><th class="r">Jumlah (Rp)</th><th></th></tr></thead><tbody>${d.biaya.map((b, i) => `<tr><td><input class="inline-input" id="bi-k${i}" data-bi="${i}" data-bf="ket" value="${esc(b.ket)}" placeholder="mis. Cuci motor, las knalpot" aria-label="Keterangan biaya"></td><td><input class="inline-input num" id="bi-j${i}" data-bi="${i}" data-bf="jumlah" type="number" min="0" step="1000" value="${b.jumlah || ''}" aria-label="Jumlah biaya" style="text-align:right"></td><td><button class="btn sm ghost" type="button" data-act="bay-rmbiaya" data-i="${i}" aria-label="Hapus">✕</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="small muted">Tidak ada biaya tambahan.</div>'}
    <div class="form"><label class="f" for="bay-dis">Diskon (Rp)<input id="bay-dis" type="number" min="0" step="1000" class="num" value="${d.diskon || ''}"></label></div>
    <h3>Pembayaran</h3>
    ${payFields('bay', d.pay)}
    <div id="bay-tot"></div>
    <div class="row" style="justify-content:flex-end"><span id="bay-wa">${waKabari()}</span><button class="btn pri" type="button" data-act="bay-confirm">Terima pembayaran &amp; cetak nota [F2]</button></div>`
    : `<div class="totals"><span class="muted">Estimasi tagihan</span><span class="num">${rp(c.total)}</span></div>`}`;
  renderTot();
}

// Pesan WA "motor selesai" selalu memakai total terbaru (termasuk biaya tambahan & diskon)
function waKabari() {
  const w = draftWo(), d = st.bayarDraft;
  const lain = d.biaya.filter(b => b.jumlah).map(b => `${b.ket || 'Biaya lain'} ${rp(b.jumlah)}`);
  return waButton(w.hp, `Halo ${w.nama || 'Bapak/Ibu'}, motor ${w.nopol} (${w.tipe}) di ${APP_NAME} sudah selesai diservis.${lain.length ? ' Termasuk biaya tambahan: ' + lain.join(', ') + '.' : ''}${d.diskon ? ' Diskon ' + rp(d.diskon) + '.' : ''} Total biaya ${rp(grandTotal())}. Silakan diambil. Terima kasih.\nRincian: ${cekLink(w.nopol)}`, 'Kabari konsumen');
}

// Biaya tambahan & diskon langsung disimpan ke work order (jeda 0,8 detik setelah berhenti mengetik),
// supaya halaman cek servis konsumen ikut menampilkan total terbaru.
let saveTimer = null;
function simpanDraft(segera) {
  clearTimeout(saveTimer);
  const no = st.bayarNo, d = st.bayarDraft; if (!no || !d) return Promise.resolve();
  const run = async () => {
    const biaya = d.biaya.filter(b => (b.ket || '').trim() || b.jumlah).map(b => ({ ket: (b.ket || '').trim() || 'Biaya lain', jumlah: +b.jumlah || 0 }));
    const w = findWo(no); if (!w || w.status === 'Lunas') return;
    if (JSON.stringify(w.biaya || []) === JSON.stringify(biaya) && (w.diskon || 0) === (d.diskon || 0)) return;
    try { await updateWo(no, { biaya, diskon: d.diskon || 0 }); Object.assign(w, { biaya, diskon: d.diskon || 0 }); syncPantau(w); }
    catch (e) { toast('Biaya tambahan belum tersimpan: ' + errMsg(e)); }
  };
  if (segera) return run();
  saveTimer = setTimeout(run, 800); return Promise.resolve();
}

function renderTot() {
  const wa = $('#bay-wa'); if (wa) wa.innerHTML = waKabari();
  const el = $('#bay-tot'); if (!el) return;
  const c = woCalc(draftWo()), d = st.bayarDraft, total = grandTotal();
  el.innerHTML = `<div class="totals"><span class="muted">Sparepart</span><span class="num">${rp(c.parts)}</span><span class="muted">Jasa ditagih</span><span class="num">${rp(c.jasaTagih)}</span><span class="muted">Biaya lain</span><span class="num">${rp(c.biaya)}</span><span class="muted">Diskon</span><span class="num">${d.diskon ? '−' + rp(d.diskon) : rp(0)}</span><span style="font-weight:600">Total bayar</span><span class="big num">${rp(total)}</span>${payTotals(d.pay, total)}</div>`;
}

async function setStatus(el) {
  if (st.saving || !st.bayarNo) return;
  const s = el.dataset.s, w = findWo(st.bayarNo);
  const base = { log: logStatus(w.log, s), lapor: namaPetugas() };
  const patch = s === 'Selesai' ? { ...base, status: 'Selesai', selesai: stamp(new Date()) }
    : { ...base, status: 'Ditunda', tglTunda: stamp(new Date()), alasanTunda: ($('#bay-tunda')?.value || '').trim() };
  st.saving = true;
  try {
    await updateWo(w.no, patch); Object.assign(w, patch); syncPantau(w);
    // Motor selesai: nomor antrian otomatis dipanggil di layar TV supaya konsumen datang ke kasir
    if (s === 'Selesai') panggilLayar(w).catch(e => console.warn('Panggilan layar gagal', e));
    toast(`${w.nopol}: ${s}. ${mekanikNama(w) || 'Mekanik'} sekarang kosong.${s === 'Selesai' ? ' Nomor dipanggil di layar.' : ''}`); renderList(); renderDetail();
  }
  catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

async function confirm() {
  if (st.saving || !st.bayarNo) return;
  clearTimeout(saveTimer);   // biaya ikut tersimpan lewat transaksi pembayaran
  const w = draftWo(), d = st.bayarDraft;
  if (w.status !== 'Selesai') { toast('Motor belum dilaporkan selesai'); return; }
  if (w.dataKurang) { toast('Data konsumen belum lengkap. Lengkapi dulu di Registrasi Servis.'); return; }
  const chk = payStatus(d.pay, grandTotal());
  if (chk.err) { toast(chk.err); return; }
  const biaya = d.biaya.filter(b => b.ket.trim() || b.jumlah).map(b => ({ ket: b.ket.trim() || 'Biaya lain', jumlah: +b.jumlah || 0 }));
  st.saving = true;
  try {
    const t = await runTransaction(db, async tx => {
      const cs = await tx.get(counterRef());
      const woRef = doc(db, 'wo', w.no), ws = await tx.get(woRef);
      if (ws.data().status === 'Lunas') throw new Error('Work order ini sudah dibayar');
      const parts = ws.data().parts || [];
      const refs = parts.map(x => doc(db, 'parts', x.kode));
      const ps = await Promise.all(refs.map(r => tx.get(r)));
      const items = parts.map((x, i) => {
        if (!ps[i].exists()) throw new Error('Part ' + x.kode + ' tidak ada di master');
        const p = ps[i].data();
        if (p.stok < x.qty) throw new Error('Stok ' + p.nama + ' tinggal ' + p.stok);
        return { kode: p.kode, nama: p.nama, qty: x.qty, harga: p.jual, beli: p.beli || 0 };
      });
      const ksg = w.jenisServis === 'KSG', jasaAsli = normJasa(ws.data());
      const jasa = jasaAsli.map(j => ({ nama: j.nama, harga: ksg ? 0 : +j.harga || 0 }));
      const jasaKlaim = ksg ? tarifKsg(w) : 0;
      const sub = items.reduce((a, x) => a + x.qty * x.harga, 0) + jasa.reduce((a, j) => a + j.harga, 0) + biaya.reduce((a, b) => a + b.jumlah, 0);
      const diskon = Math.min(d.diskon || 0, sub), total = sub - diskon;
      const pay = payStatus(d.pay, total); if (pay.err) throw new Error(pay.err);
      const { no, counter } = nextNumber(cs, 'SV');
      const log = logStatus(ws.data().log, 'Lunas'), waktu = durasi({ log });
      const trx = { no, tgl: stamp(new Date()), jenis: 'SERVIS', pelanggan: w.nama || 'Umum', hp: w.hp || '', nopol: w.nopol, tipe: w.tipe || '', km: w.km || '', waktu, mekanik: mekanikNama(w), mekanikId: w.mekanikId || '', wo: w.no,
        jenisServis: w.jenisServis || 'Reguler', ksgKe: w.ksgKe || '', noKartu: w.noKartu || '', items, jasa, jasaKlaim, biaya, diskon, total, ...payRecord(d.pay, total), kasir: namaPetugas() };
      tx.set(counterRef(), counter);
      items.forEach((x, i) => tx.update(refs[i], { stok: ps[i].data().stok - x.qty }));
      tx.set(doc(db, 'trx', no), { ...trx, dibuat: serverTimestamp() });
      tx.update(woRef, { status: 'Lunas', nota: no, biaya, log });
      return trx;
    });
    syncPantau({ ...w, status: 'Lunas', log: [...(w.log || []), { s: 'Lunas', t: t.tgl }] }, t);
    st.lastNota = t; st.bayarNo = null; st.bayarDraft = null;
    renderBayar(); showNota(t);
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

registerPay('bay', { get: () => st.bayarDraft?.pay, total: grandTotal, onChange: renderTot });
// Klik "Kabari konsumen": simpan biaya terbaru dulu supaya link rincian sudah menampilkan total yang sama
document.addEventListener('click', e => { if (e.target.closest('#bay-wa a')) simpanDraft(true); }, true);
views.bayar = renderBayar;
refreshers.bayar = () => { renderList(); if (st.bayarNo && !AKTIF.includes(findWo(st.bayarNo)?.status)) renderBayar(); };
fkeys.bayar = { simpan: 'bay-confirm' };
Object.assign(actions, {
  'bay-pick': el => {
    const o = findWo(el.dataset.no); if (!o) return;
    simpanDraft(true);   // simpan dulu biaya motor yang sebelumnya dibuka
    st.bayarNo = o.no; st.bayarDraft = { biaya: clone(o.biaya || []), diskon: o.diskon || 0, pay: emptyPay() };
    renderList(); renderDetail();
  },
  'bay-status': setStatus,
  'bay-panggil': async () => { const w = findWo(st.bayarNo); if (!w) return; try { await panggilLayar(w); toast('Nomor ' + (fmtAntri(w.antrian) || w.nopol) + ' dipanggil di layar'); } catch (e) { toast(errMsg(e)); } },
  'bay-addbiaya': () => { st.bayarDraft.biaya.push({ ket: '', jumlah: 0 }); renderDetail(); $('#bi-k' + (st.bayarDraft.biaya.length - 1))?.focus(); },
  'bay-rmbiaya': el => { st.bayarDraft.biaya.splice(+el.dataset.i, 1); renderDetail(); simpanDraft(); },
  'bay-confirm': confirm
});
inputHandlers.push(e => {
  const t = e.target, d = st.bayarDraft; if (!d) return;
  if (t.dataset.bi != null) { const b = d.biaya[+t.dataset.bi]; b[t.dataset.bf] = t.dataset.bf === 'jumlah' ? (+t.value || 0) : t.value; renderTot(); simpanDraft(); }
  if (t.id === 'bay-dis') { d.diskon = +t.value || 0; renderTot(); simpanDraft(); }
});
