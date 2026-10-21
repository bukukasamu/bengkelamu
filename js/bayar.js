// Menu Pembayaran & Status Servis (kasir):
// Menu Kasir hanya menerima pembayaran motor berstatus Selesai. Laporan selesai/tunda diterima Register.
import { $, esc, rp, stamp, toast, errMsg, konfirmasi } from './util.js';
import { APP_NAME } from './config.js';
import { S, st, views, refreshers, actions, inputHandlers, fkeys, namaPetugas, idPetugas } from './state.js';
import { db, doc, runTransaction, serverTimestamp } from './firebase.js';
import { counterRef, nextNumber } from './numbering.js';
import { AKTIF, woCard, woHeader, woCalc, partsTable, normJasa, mekanikNama, findWo, jenisBadge, tarifKsg, logStatus, timelineHTML, durasi, syncPantau, fmtAntri, kerjaPerMekanik } from './wo-common.js';
import { emptyPay, payFields, payTotals, payStatus, payRecord, registerPay } from './payment.js';
import { showNota, cekLink } from './nota.js';
import { cabangOf, stokOf, stokField } from './cabang.js';
import { nopolKey } from './cari-kendaraan.js';
import { catatMutasi, dataMutasi } from './kontrol.js';
import { oliDariNota } from './km-oli.js';

const ORDER = { Dikerjakan: 0, Selesai: 1, Ditunda: 2, Antri: 3 };

function renderList() {
  const el = $('#bay-list'); if (!el) return;
  const l = [...S.wo].reverse().filter(w => w.status === 'Selesai').sort((a, b) => a.tgl.localeCompare(b.tgl));
  el.innerHTML = l.map(o => woCard(o, st.bayarNo, 'bay-pick')).join('') || '<div class="empty">Tidak ada motor siap dibayar dari Register.</div>';
}

function renderBayar() {
  $('#view').innerHTML = `<div class="grid g-servis">
   <div class="panel"><h3>Motor di bengkel</h3><p class="small muted" style="margin:0">Dikerjakan: tunggu laporan mekanik. Selesai: siap dibayar.</p><div class="wolist" id="bay-list"></div></div>
   <div class="panel" id="bay-detail"><div class="empty">Pilih motor di sebelah kiri.</div></div>
  </div>`;
  renderList();
  if (st.bayarNo && AKTIF.includes(findWo(st.bayarNo)?.status)) renderDetail(); else st.bayarNo = null;
}

const draftWo = () => ({ ...findWo(st.bayarNo) });
const grandTotal = () => Math.max(0, woCalc(draftWo()).total - (draftWo().diskon || 0));

function statusPanel(w) {
  if (w.status === 'Dikerjakan') return '<div class="note small">Motor masih dikerjakan. Laporan selesai atau lanjut lama diterima di menu <b>Registrasi Servis</b> / akun Mekanik.</div>';
  if (w.status === 'Ditunda') return `<div class="tunda-box">${tundaInfo(w)}<div class="small" style="margin-top:6px">Laporan berikutnya diproses oleh Register. Kasir dapat menerima pembayaran setelah status menjadi Selesai.</div></div>`;
  if (w.status === 'Antri') return `<div class="note small">${w.dataKurang ? 'Data konsumen belum lengkap. ' : ''}Belum ada mekanik. Registrasi perlu memilih mekanik yang kosong.</div>`;
  if (w.status === 'Selesai') return '<div class="note small">Motor sudah difinalkan Register dan siap menerima pembayaran.</div>';
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
    ${bisaBayar ? `<div class="note small">Biaya tambahan dan diskon sudah difinalkan di <b>Register Servis</b>. Kasir hanya menerima pembayaran.</div>
    <h3>Pembayaran</h3>
    ${payFields('bay', d.pay)}
    <div id="bay-tot"></div>
    <div class="row" style="justify-content:flex-end"><button class="btn pri" type="button" data-act="bay-confirm">Terima pembayaran &amp; cetak nota [F2]</button></div>` : `<div class="totals"><span class="muted">Estimasi tagihan</span><span class="num">${rp(c.total)}</span></div>`}`;
  renderTot();
}

function renderTot() {
  const el = $('#bay-tot'); if (!el) return;
  const w = draftWo(), c = woCalc(w), d = st.bayarDraft, total = grandTotal();
  el.innerHTML = `<div class="totals"><span class="muted">Sparepart</span><span class="num">${rp(c.parts)}</span><span class="muted">Jasa ditagih</span><span class="num">${rp(c.jasaTagih)}</span><span class="muted">Biaya lain</span><span class="num">${rp(c.biaya)}</span><span class="muted">Diskon</span><span class="num">${w.diskon ? '−' + rp(w.diskon) : rp(0)}</span><span style="font-weight:600">Total bayar</span><span class="big num">${rp(total)}</span>${payTotals(d.pay, total)}</div>`;
}

async function confirm() {
  if (st.saving || !st.bayarNo) return;
  const w = draftWo(), d = st.bayarDraft;
  if (w.status !== 'Selesai') { toast('Motor belum dilaporkan selesai'); return; }
  if (w.dataKurang) { toast('Data konsumen belum lengkap. Lengkapi dulu di Registrasi Servis.'); return; }
  const chk = payStatus(d.pay, grandTotal());
  if (chk.err) { toast(chk.err); return; }
  if (!(await konfirmasi('Terima pembayaran ' + w.nopol + '?', `Total <b>${rp(grandTotal())}</b>${d.pay?.cash ? ' · cash ' + rp(d.pay.cash) : ''}${d.pay?.transfer ? ' · transfer ' + rp(d.pay.transfer) : ''}${chk.kembali ? ' · kembali <b>' + rp(chk.kembali) + '</b>' : ''}.<br>Nota dibuat, stok part dipotong, dan motor ditandai Lunas. Nota tidak bisa diubah setelah ini.`, { ya: 'Ya, terima & cetak nota' }))) return;
  if (st.saving) return;
  st.saving = true;
  try {
    const t = await runTransaction(db, async tx => {
      const cab = cabangOf(w);
      const cs = await tx.get(counterRef(cab));
      const woRef = doc(db, 'wo', w.no), ws = await tx.get(woRef);
      if (ws.data().status === 'Lunas') throw new Error('Work order ini sudah dibayar');
      const finalWo = ws.data();
      const parts = finalWo.parts || [];
      const refs = parts.map(x => doc(db, 'parts', x.kode));
      const ps = await Promise.all(refs.map(r => tx.get(r)));
      const kRef = nopolKey(w.nopol) ? doc(db, 'kendaraan', nopolKey(w.nopol)) : null, ks = kRef ? await tx.get(kRef) : null;
      const items = parts.map((x, i) => {
        if (!ps[i].exists()) throw new Error('Part ' + x.kode + ' tidak ada di master');
        const p = ps[i].data();
        if (stokOf(p, cab) < x.qty) throw new Error('Stok ' + p.nama + ' tinggal ' + stokOf(p, cab));
        return { kode: p.kode, nama: p.nama, qty: x.qty, harga: p.jual, beli: p.beli || 0 };
      });
      const ksg = finalWo.jenisServis === 'KSG', jasaAsli = normJasa(finalWo);
      const jasa = jasaAsli.map(j => ({ nama: j.nama, harga: ksg ? 0 : +j.harga || 0 }));
      const jasaKlaim = ksg ? tarifKsg(w) : 0;
      const biaya = (finalWo.biaya || []).filter(b => b.ket || b.jumlah).map(b => ({ ket: String(b.ket || 'Biaya lain').trim() || 'Biaya lain', jumlah: +b.jumlah || 0 }));
      const sub = items.reduce((a, x) => a + x.qty * x.harga, 0) + jasa.reduce((a, j) => a + j.harga, 0) + biaya.reduce((a, b) => a + b.jumlah, 0);
      const diskon = Math.min(finalWo.diskon || 0, sub), total = sub - diskon;
      const pay = payStatus(d.pay, total); if (pay.err) throw new Error(pay.err);
      const { no, counter } = nextNumber(cs, 'SV', cab);
      const log = logStatus(ws.data().log, 'Lunas'), waktu = durasi({ log });
      // Riwayat penundaan (alasan) & lama kerja per mekanik ikut tersimpan di nota, untuk riwayat servis & performa
      const tunda = log.filter(l => l.s === 'Ditunda').map(l => ({ t: l.t, a: l.a || '', m: l.m || '' }));
      const perMek = kerjaPerMekanik({ ...w, log });
      const trx = { no, cabang: cab, tgl: stamp(new Date()), jenis: 'SERVIS', pelanggan: w.nama || 'Umum', hp: w.hp || '', nopol: w.nopol, tipe: w.tipe || '', km: w.km || '', waktu, mekanik: mekanikNama(w), mekanikId: w.mekanikId || '', wo: w.no,
        jenisServis: w.jenisServis || 'Reguler', ksgKe: w.ksgKe || '', noKartu: w.noKartu || '', keluhan: w.keluhan || '', registrasiOleh: ws.data().dibuatOleh || '', registrasiId: ws.data().dibuatOlehId || '', orderOleh: ws.data().orderOleh || '', orderOlehId: ws.data().orderOlehId || '', items, jasa, jasaKlaim, biaya, diskon, total, ...payRecord(d.pay, total), kasir: namaPetugas(), kasirId: idPetugas(),
        ...(tunda.length ? { tunda } : {}), ...(Object.keys(perMek).length > 1 ? { kerjaMekanik: perMek } : {}) };
      // Ganti oli mesin di nota ini → jadwal ganti oli berikutnya (pengingat servis)
      const oli = oliDariNota(trx, ks?.exists() ? ks.data() : null);
      if (oli) trx.oli = { tglBerikut: oli.tglBerikut, kmBerikut: oli.kmBerikut };
      tx.set(counterRef(cab), counter);
      items.forEach((x, i) => { tx.update(refs[i], { [stokField(cab)]: stokOf(ps[i].data(), cab) - x.qty }); catatMutasi(tx, dataMutasi(cab, x.kode, x.nama, -x.qty, 'servis', no)); });
      tx.set(doc(db, 'trx', no), { ...trx, bulan: trx.tgl.slice(0, 7), dibuat: serverTimestamp() });
      tx.update(woRef, { status: 'Lunas', aktif: false, nota: no, biaya, log });
      // Tanggal servis terakhir di data kendaraan (untuk pengingat servis tanpa membaca semua nota)
      if (kRef) tx.set(kRef, { nopol: w.nopol, nopolKey: nopolKey(w.nopol), servisTerakhir: trx.tgl, ...(w.km ? { kmTerakhir: w.km } : {}), ...(oli ? { oli, pengingat: null } : {}) }, { merge: true });
      return trx;
    });
    syncPantau({ ...w, status: 'Lunas', log: [...(w.log || []), { s: 'Lunas', t: t.tgl }] }, t);
    st.lastNota = t; st.bayarNo = null; st.bayarDraft = null;
    renderBayar(); showNota(t);
  } catch (e) { toast(errMsg(e)); } finally { st.saving = false; }
}

registerPay('bay', { get: () => st.bayarDraft?.pay, total: grandTotal, onChange: renderTot });
// Klik "Kabari konsumen": simpan biaya terbaru dulu supaya link rincian sudah menampilkan total yang sama
views.bayar = renderBayar;
refreshers.bayar = () => { renderList(); if (st.bayarNo && !AKTIF.includes(findWo(st.bayarNo)?.status)) renderBayar(); };
fkeys.bayar = { simpan: 'bay-confirm' };
Object.assign(actions, {
  'bay-pick': el => {
    const o = findWo(el.dataset.no); if (!o) return;
    st.bayarNo = o.no; st.bayarDraft = { pay: emptyPay() };
    renderList(); renderDetail();
  },
  'bay-confirm': confirm
});

